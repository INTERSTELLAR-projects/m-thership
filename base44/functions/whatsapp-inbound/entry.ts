// WhatsApp Business Cloud API webhook → Field inbox (docs/field-inbox.md).
// URL to paste into Meta (App > WhatsApp > Configuration > Webhook): https://base44.app/api/apps/69d80bb06c5ad07a795df54e/functions/whatsapp-inbound
//   GET   verification handshake: hub.mode=subscribe + hub.verify_token == WHATSAPP_VERIFY_TOKEN → echo hub.challenge.
//   POST  X-Hub-Signature-256 checked against WHATSAPP_APP_SECRET (constant time, rejected when missing), then only
//         messages from Justin's numbers (JUSTIN_WHATSAPP_NUMBERS secret + Settings > Field inbox) are stored; anything
//         else is ignored silently. Media is downloaded with WHATSAPP_TOKEN and stored in app storage. Dedupe on the
//         message id. Each message is routed (task / idea / note / Claude job / site visit) and Justin gets a one-line
//         confirmation from WHATSAPP_PHONE_NUMBER_ID (free-form text is allowed inside the 24h window he opened).
// Missing secrets → 503 and nothing happens. Secret values are read by name only and never logged or returned.
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { dedupeMessages, extractMessages, isAllowedSender, safeEqual, verifySignature } from "../../shared/fieldInbox.js";
import { allowedNumbers, env, fetchWhatsAppMedia, routeItem, sendWhatsApp, storeBytes, transcribe } from "../../shared/fieldInboxServer.ts";

const MAX_MEDIA = 100 * 1024 * 1024;

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const verify = env("WHATSAPP_VERIFY_TOKEN");
    if (!verify) return new Response("Field inbox is not configured", { status: 503 });
    const mode = url.searchParams.get("hub.mode") || "";
    const token = url.searchParams.get("hub.verify_token") || "";
    const challenge = url.searchParams.get("hub.challenge") || "";
    if (mode === "subscribe" && safeEqual(token, verify) && challenge) return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    return new Response("Forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const appSecret = env("WHATSAPP_APP_SECRET");
  const token = env("WHATSAPP_TOKEN");
  const phoneId = env("WHATSAPP_PHONE_NUMBER_ID");
  if (!appSecret || !token || !phoneId || !env("WHATSAPP_VERIFY_TOKEN")) return Response.json({ error: "Field inbox is not configured" }, { status: 503 });

  const raw = await req.text();
  const ok = await verifySignature(raw, req.headers.get("x-hub-signature-256") || "", appSecret);
  if (!ok) return Response.json({ error: "Bad signature" }, { status: 401 });

  let body: any = null;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Bad JSON" }, { status: 400 }); }
  const all = extractMessages(body).filter((m: any) => !m.phone_number_id || m.phone_number_id === phoneId);
  if (!all.length) return Response.json({ received: true, messages: 0 }); // status callbacks, other numbers

  const base44 = createClientFromRequest(req);
  const db = base44.asServiceRole.entities;
  const allowed = await allowedNumbers(db);
  if (!allowed.length) return Response.json({ error: "No allowed numbers set" }, { status: 503 });
  // Silently ignore anyone who is not Justin: no row, no reply, a plain 200 so Meta stops retrying.
  const mine = all.filter((m: any) => isAllowedSender(m.from, allowed));
  if (!mine.length) return Response.json({ received: true });

  const seen: string[] = [];
  for (const m of mine) {
    const hit = await db.FieldInbox.filter({ external_id: m.id }, "-created_date", 1).catch(() => []);
    if ((Array.isArray(hit) ? hit : hit?.items || []).length) seen.push(m.id);
  }
  const fresh = dedupeMessages(mine, seen);

  const results: any[] = [];
  for (const m of fresh) {
    const media: any[] = [];
    let text = m.text;
    let transcriptSource = text ? "typed" : "";
    let pendingTranscript = false;
    let mediaError = "";
    if (m.media && m.media.id) {
      try {
        const got = await fetchWhatsAppMedia(token, m.media.id);
        if (got.bytes.length > MAX_MEDIA) throw new Error("file is over 100 MB");
        const fileUrl = await storeBytes(base44, got.bytes, got.mime || m.media.mime, `wa-${m.media.kind}-${m.id.slice(-10).replace(/[^A-Za-z0-9]/g, "")}`);
        media.push({ url: fileUrl, type: m.media.kind, mime: got.mime || m.media.mime, size: got.bytes.length, name: m.media.filename || `${m.media.kind} from WhatsApp` });
        if (m.media.kind === "audio" && !text) {
          text = await transcribe(got.bytes, got.mime || m.media.mime).catch(() => "");
          transcriptSource = text ? "whisper_api" : "pending_runner";
          pendingTranscript = !text;
        }
      } catch (e) {
        mediaError = (e as Error).message;
      }
    }
    if (!text && !media.length) {
      results.push({ id: m.id, skipped: mediaError || "empty" });
      await db.FieldInbox.create({ source: "whatsapp", external_id: m.id, from_number: m.from, contact_name: m.contact_name, message_type: m.type, status: "failed", error: mediaError || "Nothing to file (empty message)", created_at: new Date().toISOString() }).catch(() => null);
      await sendWhatsApp(token, phoneId, m.from, mediaError ? "I couldn't download that file. Try sending it again, or upload it on /field." : "Got an empty message, nothing saved.", m.id).catch(() => false);
      continue;
    }
    const out = await routeItem(base44, { source: "whatsapp", text, media, fromNumber: m.from, externalId: m.id, contactName: m.contact_name, messageType: m.type, transcriptSource, pendingTranscript });
    const sent = await sendWhatsApp(token, phoneId, m.from, out.reply, m.id).catch(() => false);
    await db.FieldInbox.update(out.row.id, { reply_status: sent ? "sent" : "failed", ...(mediaError ? { error: `media: ${mediaError}` } : {}) }).catch(() => null);
    results.push({ id: m.id, field_inbox_id: out.row.id, intent: out.row.intent, routed_to: out.routed ? out.routed.entity : null });
  }
  return Response.json({ received: true, stored: results.length, duplicates: seen.length });
});
