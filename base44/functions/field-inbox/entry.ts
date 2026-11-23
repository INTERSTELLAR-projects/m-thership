// Field inbox, admin side (docs/field-inbox.md). Admin only.
//   { action: "status" }                         -> which WhatsApp secrets exist (names only), the webhook URL, allowed numbers (masked)
//   { action: "save_numbers", numbers: [..] }    -> Settings > Field inbox allowed numbers (AppSettings field_inbox)
//   { action: "route", text, client_id? }        -> web quick capture: same routing as WhatsApp
//   { action: "site_visit", client_id | lead {name, website, city}, prompt, media [{url,type,size,name,duration,parts}],
//     outputs {website, operations, content}, is_test? } -> FieldInbox (upload, site_visit) + ClaudeJob kind site_visit (queued, priority 2)
// Nothing here publishes or sends.
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { requireAdmin } from "../../shared/assistant.ts";
import { SECRET_NAMES, SETTINGS_KEY, WEBHOOK_URL, maskNumber, parseAllowed, digits } from "../../shared/fieldInbox.js";
import { env, loadClients, loadSettings, queueSiteVisit, routeItem } from "../../shared/fieldInboxServer.ts";

const s = (v: unknown) => (v == null ? "" : String(v));
const cleanUrl = (u: unknown) => { const v = s(u).trim(); if (!v) return ""; const w = /^https?:\/\//i.test(v) ? v : `https://${v}`; try { return new URL(w).toString(); } catch { return ""; } };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user, denied } = await requireAdmin(base44);
    if (denied) return denied;
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const action = s(body.action || "status");

    if (action === "status") {
      const row = await loadSettings(db);
      const fromSecret = parseAllowed(env("JUSTIN_WHATSAPP_NUMBERS"));
      const fromSettings = parseAllowed((row && row.pageSettings && row.pageSettings.allowed_numbers) || []);
      return Response.json({
        secrets: Object.fromEntries(SECRET_NAMES.map((n) => [n, !!env(n)])),
        optional: { OPENAI_API_KEY: !!env("OPENAI_API_KEY") },
        webhook_url: WEBHOOK_URL,
        allowed: { from_secret: fromSecret.map(maskNumber), from_settings: fromSettings },
        ready: ["WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"].every((n) => !!env(n)) && (fromSecret.length + fromSettings.length) > 0,
        checked_at: new Date().toISOString(),
      });
    }

    if (action === "save_numbers") {
      const numbers = parseAllowed(Array.isArray(body.numbers) ? body.numbers : s(body.numbers));
      const row = await loadSettings(db);
      const pageSettings = { ...((row && row.pageSettings) || {}), allowed_numbers: numbers, saved_at: new Date().toISOString(), saved_by: user.email };
      if (row) await db.AppSettings.update(row.id, { pageSettings });
      else await db.AppSettings.create({ key: SETTINGS_KEY, pageSettings });
      return Response.json({ ok: true, allowed_numbers: numbers });
    }

    if (action === "route") {
      const text = s(body.text).trim().slice(0, 6000);
      if (!text) return Response.json({ error: "Say or type something first." }, { status: 400 });
      const out = await routeItem(base44, { source: "web", text, clientId: s(body.client_id), fromNumber: "", isTest: !!body.is_test });
      return Response.json({ ok: !out.error, reply: out.reply, item: out.row, routed_to: out.routed });
    }

    if (action === "site_visit") {
      const media = (Array.isArray(body.media) ? body.media : []).slice(0, 30).map((m: any) => ({
        url: cleanUrl(m.url), type: ["video", "image", "audio"].includes(m.type) ? m.type : "file", mime: s(m.mime).slice(0, 60),
        size: Number(m.size) || 0, duration: Number(m.duration) || 0, name: s(m.name).slice(0, 120), ...(m.parts ? { parts: Number(m.parts) || 0, part_urls: (m.part_urls || []).map(cleanUrl).filter(Boolean) } : {}),
      })).filter((m: any) => m.url);
      const prompt = s(body.prompt).trim().slice(0, 6000);
      const outputs = { website: !!body.outputs?.website, operations: !!body.outputs?.operations, content: !!body.outputs?.content };
      const clients = await loadClients(db);
      let client = body.client_id ? clients.find((c: any) => c.id === s(body.client_id)) || null : null;
      let lead: any = null;
      if (!client) {
        const name = s(body.lead?.name).trim().slice(0, 140);
        if (!name) return Response.json({ error: "Pick a client or name the business." }, { status: 400 });
        lead = { name, website: cleanUrl(body.lead?.website), city: s(body.lead?.city).trim().slice(0, 80) };
        // Already in the CRM under that name or domain? Link it instead of treating it as new (never a duplicate).
        const host = lead.website ? new URL(lead.website).hostname.replace(/^www\./, "") : "";
        client = clients.find((c: any) => c.business.toLowerCase() === name.toLowerCase() || (host && (c.domain === host || (c.websites || []).some((w: string) => s(w).includes(host))))) || null;
        if (client) lead = null;
      }
      if (!media.length && !prompt) return Response.json({ error: "Add a video or photo, or say what you want." }, { status: 400 });
      const now = new Date().toISOString();
      const row = await db.FieldInbox.create({
        source: "upload", intent: "site_visit", status: "new", text: prompt, media, outputs, client_id: client ? client.id : "", client_name: client ? client.business : "",
        lead_business: lead, is_test: !!body.is_test, from_number: "", created_at: now,
      });
      try {
        const { job, title } = await queueSiteVisit(db, { fieldId: row.id, client, lead, prompt, media: media.map((m: any) => (m.part_urls ? { ...m, url: m.part_urls.join(" ") } : m)), outputs, isTest: !!body.is_test });
        const routed = { entity: "ClaudeJob", id: job.id, label: title, path: `/claude?job=${job.id}` };
        const updated = await db.FieldInbox.update(row.id, { status: "processing", routed_to: routed, rule: "site_visit_form", confidence: 1, ai_summary: "Site visit queued for Claude (analysis and drafts only).", reply_text: `Site visit queued for Claude: ${title}`, processed_at: now });
        return Response.json({ ok: true, item: { ...row, ...(updated || {}) }, job_id: job.id, routed_to: routed });
      } catch (e) {
        await db.FieldInbox.update(row.id, { status: "failed", error: s((e as Error).message).slice(0, 500) }).catch(() => null);
        return Response.json({ error: "Could not queue the site visit." }, { status: 500 });
      }
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (_e) {
    return Response.json({ error: "Field inbox error" }, { status: 500 });
  }
});
// digits is re-exported for symmetry with the webhook; kept referenced so linters do not flag it.
export const _keep = digits;
