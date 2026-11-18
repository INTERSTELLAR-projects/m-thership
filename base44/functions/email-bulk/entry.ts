import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { requireSecondFactor } from "../../shared/twoFactor.ts";
import { resolveClient } from "../../shared/portalClient.ts";
import { sesHookToken, normEmail } from "../../shared/emailUnsub.ts";
import { drain, readiness, loadSettings, isDryRun, BATCH } from "../../shared/emailStudio.ts";
import { extractLinks } from "../../shared/emailCore.ts";
import { check, record } from "../../shared/meter.ts";
import { studioState, planUnlocksStudios, MAX_FREE_LIST_SIZE, SES_COST_PER_EMAIL } from "../../shared/usagePlans.ts";
import { markOutOfFuel, loadFuelConfig } from "../../shared/fuel.ts";
import { getSecret } from "../../shared/portalClient.ts";

// Client Studios bulk / marketing email through Amazon SES (engine: base44/shared/emailStudio.ts, Nov 2026) (our AWS account, each client's own verified domain).
// Base44 SendEmail stays in use for 1:1 and system mail (email-studio, invites, alerts). Nobody ever sees another
// recipient: one SES SendEmail per recipient.
//
//   status    { client_id? }                       sending readiness for the client (no secret values)
//   send      { client_id?, name?, subject, html, text?, recipients: [{ email, name?, first_name? }] }
//             -> queues an EmailCampaign + EmailSendBatch rows (500 each), meters marketing_email units up front,
//                then sends as much as fits in this request; the "Studios: drain bulk email" workflow finishes it.
//   drain     {}                                   scheduled (no user) or admin: promote due scheduled batches, continue
//                                                  queued batches, run Email Studio automations (shared/emailStudio.ts)
//   campaigns { client_id? }                       recent campaigns for the client
//   suppressions / suppress / unsuppress           per-client do-not-send list (portal: own client; admin: any)
//   POST ?hook=<token>                             SES -> SNS bounce / complaint notifications (no login; token-gated)
//
// Portal users act only for their own client, only on HyperCare+ with Email Studio "on", within the plan's monthly
// marketing-email fuel (allowance + Refuel wallet) and the 25,000-contact list limit. Admin sends are never capped.
// Batching: ONE function invocation per campaign (all recipients queued as 500-recipient EmailSendBatch rows), then
// the 5-minute drain job; never one invocation per recipient. SES itself gets one SendEmail per recipient (privacy).
// Out of fuel: a campaign that doesn't fit is saved as "paused" (batches "held", not metered) and resumes in order
// after a Refuel or the monthly reset (fuel.ts resumeClient). A campaign already sending always finishes.
// If SES secrets are missing, client marketing sends are disabled with a clear message.

const isEmail = (e: string) => /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(e);
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// Legacy raw-HTML sends get the CAN-SPAM footer with the {{unsubscribe_url}} merge tag (filled per recipient).
function withFooter(html: string, client: any, address: string) {
  if (/\{\{\s*unsubscribe_url\s*\}\}/.test(html)) return html;
  const foot = `<div style="margin:24px auto 0;max-width:600px;padding:16px;font:12px/18px Helvetica,Arial,sans-serif;color:#8a8780;text-align:center">${esc(client.business)}${address ? `<br>${esc(address)}` : ""}<br>You're getting this because you're on the ${esc(client.business)} list. <a href="{{unsubscribe_url}}" style="color:#8a8780">Unsubscribe</a></div>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${foot}</body>`) : html + foot;
}

// SES feedback through SNS. SubscriptionConfirmation is confirmed only for an amazonaws.com SubscribeURL.
async function snsHook(req: Request, db: any) {
  const raw = await req.text();
  let msg: any = {};
  try { msg = JSON.parse(raw); } catch { return new Response("bad", { status: 400 }); }
  if (msg.Type === "SubscriptionConfirmation") {
    const u = new URL(String(msg.SubscribeURL || ""));
    if (u.protocol === "https:" && /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(u.hostname)) await fetch(u.toString()).catch(() => null);
    return new Response("ok");
  }
  if (msg.Type !== "Notification") return new Response("ignored");
  let n: any = {};
  try { n = JSON.parse(msg.Message || "{}"); } catch { return new Response("ignored"); }
  const type = String(n.notificationType || n.eventType || "");
  const mail = n.mail || {};
  const tags = mail.tags || {};
  let clientId = String((tags.client_id || [])[0] || "");
  const campaignId = String((tags.campaign_id || [])[0] || "");
  if (!clientId && mail.source) {
    const from = normEmail(String(mail.source).replace(/^.*<|>.*$/g, ""));
    const hit = ((await db.CRMClient.filter({ ses_from_email: from }, "business", 1).catch(() => [])) || [])[0];
    clientId = hit?.id || "";
  }
  if (!clientId) return new Response("no client");
  const automationId = String((tags.automation_id || [])[0] || "");
  const stepId = String((tags.step_id || [])[0] || "");
  const rid = String((tags.rid || [])[0] || "");
  const add = async (email: string, reason: string, detail: string) => {
    const e = normEmail(email);
    if (!isEmail(e)) return;
    await db.EmailEvent.create({ client_id: clientId, campaign_id: campaignId, automation_id: automationId, step_id: stepId, rid, email: e, type: reason, at: new Date().toISOString(), url: "", link_index: -1 }).catch(() => null);
    const contact = ((await db.EmailContact.filter({ client_id: clientId, email: e }, "-created_date", 1).catch(() => [])) || [])[0];
    if (contact) await db.EmailContact.update(contact.id, { status: "cleaned" }).catch(() => null);
    const have = await db.EmailSuppression.filter({ client_id: clientId, email: e, reason }, "-created_date", 1).catch(() => []);
    if (!have?.length) await db.EmailSuppression.create({ client_id: clientId, email: e, reason, detail: detail.slice(0, 300), campaign_id: campaignId, created_at: new Date().toISOString() }).catch(() => null);
  };
  if (type === "Bounce" && n.bounce?.bounceType === "Permanent") {
    for (const r of n.bounce.bouncedRecipients || []) await add(r.emailAddress, "bounce", `${n.bounce.bounceSubType || "Permanent"} ${r.diagnosticCode || ""}`.trim());
  } else if (type === "Complaint") {
    for (const r of n.complaint?.complainedRecipients || []) await add(r.emailAddress, "complaint", String(n.complaint?.complaintFeedbackType || "complaint"));
  }
  return new Response("ok");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const url = new URL(req.url);
    const hook = url.searchParams.get("hook");
    if (hook) {
      if (hook !== (await sesHookToken().catch(() => "~"))) return new Response("forbidden", { status: 403 });
      return await snsHook(req, db);
    }

    const user = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || (user ? "status" : "drain"));
    if (!user) {
      if (action === "drain") return Response.json(await drain(db));
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }
    const gate = await requireSecondFactor(base44, req, user);
    if (gate) return gate;
    const isAdmin = user.role === "admin";
    if (action === "drain") {
      if (!isAdmin) return Response.json({ error: "Admins only" }, { status: 403 });
      return Response.json(await drain(db, { onlyCampaign: body?.campaign_id ? String(body.campaign_id) : "" }));
    }

    const client = await resolveClient(db, user, body?.client_id);
    if (!client) return Response.json({ error: isAdmin ? "Pick a client" : "No portal is set up for this login yet.", code: "no_client" }, { status: isAdmin ? 400 : 403 });
    if (!isAdmin && !planUnlocksStudios(client)) return Response.json({ error: "Email Studio is included with HyperCare+. Ask us about upgrading from your portal.", code: "studios_locked" }, { status: 403 });
    if (!isAdmin && studioState(client, "email") !== "on") return Response.json({ error: "Email Studio isn't switched on for your account yet.", code: "studio_off" }, { status: 403 });
    const cid = String(client.id);

    const settings = await loadSettings(db, client);
    if (action === "status") {
      const r = readiness(client, settings);
      return Response.json({ ...r, from_email: client.ses_from_email || "", from_name: client.ses_from_name || client.business, max_list: MAX_FREE_LIST_SIZE });
    }

    if (action === "campaigns") {
      const rows = (await db.EmailCampaign.filter({ client_id: cid }, "-created_date", 50).catch(() => [])) || [];
      return Response.json({ campaigns: rows.map((c: any) => ({ id: c.id, name: c.name, subject: c.subject, status: c.status, total: c.total, sent_count: c.sent_count, failed_count: c.failed_count, skipped_count: c.skipped_count, created_at: c.created_at, finished_at: c.finished_at })) });
    }

    if (action === "suppressions") {
      const rows = (await db.EmailSuppression.filter({ client_id: cid }, "-created_date", 2000).catch(() => [])) || [];
      return Response.json({ suppressions: rows.map((s: any) => ({ id: s.id, email: s.email, reason: s.reason, created_at: s.created_at || s.created_date })) });
    }
    if (action === "suppress") {
      const emails = (Array.isArray(body?.emails) ? body.emails : [body?.email]).map(normEmail).filter(isEmail).slice(0, 1000);
      for (const e of emails) {
        const have = await db.EmailSuppression.filter({ client_id: cid, email: e }, "-created_date", 1).catch(() => []);
        if (!have?.length) await db.EmailSuppression.create({ client_id: cid, email: e, reason: "manual", detail: `Added by ${user.email}`, created_at: new Date().toISOString() });
      }
      return Response.json({ ok: true, added: emails.length });
    }
    if (action === "unsuppress") {
      // Only manual blocks and unsubscribes can be lifted here; bounces and complaints stay (admin can delete rows).
      const e = normEmail(body?.email);
      const rows = (await db.EmailSuppression.filter({ client_id: cid, email: e }, "-created_date", 20).catch(() => [])) || [];
      let removed = 0;
      for (const r of rows) if (isAdmin || r.reason === "manual") { await db.EmailSuppression.delete(r.id); removed++; }
      return Response.json({ ok: true, removed });
    }

    if (action === "send") {
      const ready = readiness(client, settings);
      if (!ready.ready) return Response.json({ error: ready.reason, code: ready.code }, { status: ready.code === "ses_not_configured" ? 503 : 400 });
      const subject = String(body?.subject || "").trim().slice(0, 250);
      const html = String(body?.html || "");
      if (!subject) return Response.json({ error: "Add a subject line first" }, { status: 400 });
      if (!html.trim()) return Response.json({ error: "The email is empty" }, { status: 400 });
      if (html.length > 400_000) return Response.json({ error: "The email is too large" }, { status: 413 });
      const raw = Array.isArray(body?.recipients) ? body.recipients : [];
      if (raw.length > MAX_FREE_LIST_SIZE) return Response.json({ error: `Lists over ${MAX_FREE_LIST_SIZE.toLocaleString("en-US")} contacts aren't included. Talk to Interstellar about larger sends.`, code: "list_too_large" }, { status: 400 });
      const seen = new Set<string>();
      const recipients: Record<string, string>[] = [];
      for (const r of raw) {
        const email = normEmail(r?.email);
        if (!isEmail(email) || seen.has(email)) continue;
        seen.add(email);
        recipients.push({ email, name: String(r?.name || "").slice(0, 120), first_name: String(r?.first_name || "").slice(0, 60) });
      }
      const sup = new Set((((await db.EmailSuppression.filter({ client_id: cid }, "-created_date", 5000).catch(() => [])) || []) as any[]).map((s) => normEmail(s.email)));
      const queue = recipients.filter((r) => !sup.has(r.email));
      const skipped = recipients.length - queue.length + (raw.length - recipients.length);
      if (!queue.length) return Response.json({ error: "No one left to send to: every address is invalid, a duplicate or on the do-not-send list." }, { status: 400 });

      const meta = { admin: isAdmin, model: "ses", est_cost_usd: queue.length * SES_COST_PER_EMAIL, feature: "email.campaign", user_email: user.email };
      const m = await check(db, client, "marketing_email", queue.length, { admin: isAdmin, feature: "email.campaign" });
      // Out of fuel (or not enough for this list): keep the campaign, paused in place, instead of refusing it.
      const pause = !m.ok && (m.code === "out_of_fuel" || m.code === "insufficient_fuel");
      if (!m.ok && !pause) return Response.json({ error: m.reason, code: m.code, meter: m }, { status: 429 });

      const camp = await db.EmailCampaign.create({
        client_id: cid, client_name: client.business, name: String(body?.name || subject).slice(0, 160), subject, html: withFooter(html, client, settings.physical_address || ""), links: extractLinks(html), track: true, dry_run: isDryRun(client),
        text: String(body?.text || "").slice(0, 100_000), from_email: client.ses_from_email, from_name: String(body?.from_name || client.ses_from_name || client.business).slice(0, 120),
        reply_to: client.ses_reply_to || "", status: pause ? "paused" : "queued", total: queue.length, sent_count: 0, failed_count: 0, skipped_count: skipped,
        batches: Math.ceil(queue.length / BATCH), created_by: user.email, by_admin: isAdmin, created_at: new Date().toISOString(),
        metered: !pause, ...(pause ? { fuel_paused_at: new Date().toISOString() } : {}),
      });
      for (let i = 0; i < queue.length; i += BATCH) {
        await db.EmailSendBatch.create({ campaign_id: camp.id, client_id: cid, index: i / BATCH, recipients: queue.slice(i, i + BATCH), status: pause ? "held" : "pending", cursor: 0, sent: 0, failed: 0, errors: [], attempts: 0 });
      }
      if (pause) {
        if (m.code === "out_of_fuel") await markOutOfFuel(db, client, "marketing_email", await loadFuelConfig(db), getSecret("STRIPE_SECRET_KEY") || null).catch(() => null);
        return Response.json({ ok: true, paused: true, campaign_id: camp.id, queued: queue.length, skipped, status: "paused", code: m.code, message: m.reason, meter: { used: m.used, cap: m.cap, left: m.left, wallet: m.wallet } });
      }
      await record(db, client, "marketing_email", queue.length, { ...meta, campaign_id: camp.id });
      const run = await drain(db, { onlyCampaign: camp.id }).catch((e) => ({ ok: false, error: (e as Error).message }));
      const now = await db.EmailCampaign.get(camp.id).catch(() => camp);
      return Response.json({ ok: true, campaign_id: camp.id, queued: queue.length, skipped, status: now?.status, sent_so_far: now?.sent_count || 0, run, meter: { used: m.used + (isAdmin ? 0 : queue.length), cap: m.cap } });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("email-bulk", (e as Error)?.message);
    return Response.json({ error: (e as Error)?.message || "Send failed" }, { status: 500 });
  }
});

