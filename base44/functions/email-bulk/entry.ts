import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { requireSecondFactor } from "../../shared/twoFactor.ts";
import { resolveClient } from "../../shared/portalClient.ts";
import { sesConfig, sesSendEmail, SesError } from "../../shared/ses.ts";
import { clientUnsubscribeUrl, sesHookToken, normEmail } from "../../shared/emailUnsub.ts";
import { inviteSettings } from "../../shared/portalInvite.ts";
import { check, record } from "../../shared/meter.ts";
import { studioState, planUnlocksStudios, MAX_FREE_LIST_SIZE, SES_COST_PER_EMAIL } from "../../shared/usagePlans.ts";
import { markOutOfFuel, loadFuelConfig } from "../../shared/fuel.ts";
import { getSecret } from "../../shared/portalClient.ts";

// Client Studios bulk / marketing email through Amazon SES (our AWS account, each client's own verified domain).
// Base44 SendEmail stays in use for 1:1 and system mail (email-studio, invites, alerts). Nobody ever sees another
// recipient: one SES SendEmail per recipient.
//
//   status    { client_id? }                       sending readiness for the client (no secret values)
//   send      { client_id?, name?, subject, html, text?, recipients: [{ email, name?, first_name? }] }
//             -> queues an EmailCampaign + EmailSendBatch rows (500 each), meters marketing_email units up front,
//                then sends as much as fits in this request; the "Studios: drain bulk email" workflow finishes it.
//   drain     {}                                   scheduled (no user) or admin: continue queued batches
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

const BATCH = 500;
const TIME_BUDGET_MS = 45_000;
const DEFAULT_RATE = 10; // emails / second; SES production accounts start at 14/s
const isEmail = (e: string) => /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(e);
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rateLimit(db: any) {
  const rows = await db.AppSettings.filter({ key: "studios_email" }, "-updated_date", 1).catch(() => []);
  const n = Number(rows?.[0]?.advancedSettings?.ses_max_per_second);
  return n > 0 && n <= 200 ? n : DEFAULT_RATE;
}

function personalize(tpl: string, r: Record<string, string>, html: boolean) {
  const first = r.first_name || String(r.name || "").split(/\s+/)[0] || "there";
  const vars: Record<string, string> = { first_name: first, name: r.name || first, email: r.email, unsubscribe_url: r.unsub || "" };
  return tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k) => (k in vars ? (html && k !== "unsubscribe_url" ? esc(vars[k]) : vars[k]) : m));
}

function withFooter(html: string, client: any, unsub: string) {
  if (/\{\{\s*unsubscribe_url\s*\}\}/.test(html)) return html;
  const foot = `<div style="margin:24px auto 0;max-width:600px;padding:16px;font:12px/18px Helvetica,Arial,sans-serif;color:#8a8780;text-align:center">You're getting this because you're on the ${esc(client.business)} list. <a href="${esc(unsub)}" style="color:#8a8780">Unsubscribe</a></div>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${foot}</body>`) : html + foot;
}

function readiness(client: any) {
  const cfg = sesConfig();
  if (!cfg) return { ready: false, code: "ses_not_configured", reason: "Marketing email isn't set up yet: Amazon SES hasn't been connected. Interstellar has been notified." };
  if (!client?.ses_from_email || !isEmail(String(client.ses_from_email))) return { ready: false, code: "no_sender", reason: "No sending address is set for this business yet." };
  if (!client.ses_domain_verified) return { ready: false, code: "domain_unverified", reason: "This business's sending domain isn't verified in Amazon SES yet." };
  return { ready: true, code: "ok", reason: "" };
}

// Send pending batches until the time budget runs out. Returns counts for this run.
async function drain(db: any, onlyCampaign?: string) {
  const cfg = sesConfig();
  if (!cfg) return { ok: false, reason: "SES not configured", sent: 0 };
  const settings = await inviteSettings(db).catch(() => ({ portal_url: "" }));
  const rate = await rateLimit(db);
  const started = Date.now();
  let sent = 0, failed = 0, throttled = false;
  const q = onlyCampaign ? { campaign_id: onlyCampaign, status: "pending" } : { status: "pending" };
  const batches = ((await db.EmailSendBatch.filter(q, "created_date", 20).catch(() => [])) || []) as any[];
  const stale = ((await db.EmailSendBatch.filter({ status: "sending" }, "created_date", 20).catch(() => [])) || []) as any[];
  // A batch left "sending" for 10+ minutes (function timed out) is picked up again from its cursor.
  for (const b of stale) if (!onlyCampaign && b.locked_at && Date.now() - Date.parse(b.locked_at) > 600_000) batches.push(b);
  const campaigns: Record<string, any> = {};
  const clients: Record<string, any> = {};
  for (const b of batches) {
    if (Date.now() - started > TIME_BUDGET_MS || throttled) break;
    const camp = campaigns[b.campaign_id] ||= await db.EmailCampaign.get(b.campaign_id).catch(() => null);
    if (!camp || camp.status === "cancelled") { await db.EmailSendBatch.update(b.id, { status: "failed" }).catch(() => null); continue; }
    if (camp.status === "paused") { await db.EmailSendBatch.update(b.id, { status: "held" }).catch(() => null); continue; }
    const client = clients[b.client_id] ||= await db.CRMClient.get(b.client_id).catch(() => null);
    if (!client) continue;
    await db.EmailSendBatch.update(b.id, { status: "sending", locked_at: new Date().toISOString(), attempts: (Number(b.attempts) || 0) + 1 });
    if (camp.status === "queued") await db.EmailCampaign.update(camp.id, { status: "sending", started_at: new Date().toISOString() }).catch(() => null);
    const sup = new Set((((await db.EmailSuppression.filter({ client_id: b.client_id }, "-created_date", 5000).catch(() => [])) || []) as any[]).map((s) => normEmail(s.email)));
    const recips = (b.recipients || []) as any[];
    let cursor = Number(b.cursor) || 0;
    let bs = Number(b.sent) || 0, bf = Number(b.failed) || 0, skipped = 0;
    const errors = (b.errors || []).slice(0, 50) as any[];
    const gap = 1000 / rate;
    while (cursor < recips.length) {
      if (Date.now() - started > TIME_BUDGET_MS) break;
      const r = recips[cursor];
      const email = normEmail(r.email);
      if (sup.has(email)) { skipped++; cursor++; continue; }
      const t0 = Date.now();
      try {
        const unsub = await clientUnsubscribeUrl(settings.portal_url, client.id, email);
        const ctx = { ...r, email, unsub };
        await sesSendEmail(cfg, {
          from: client.ses_from_email, fromName: camp.from_name || client.ses_from_name || client.business, replyTo: camp.reply_to || client.ses_reply_to || undefined,
          to: email, subject: personalize(camp.subject, ctx, false), html: withFooter(personalize(camp.html, ctx, true), client, unsub),
          text: camp.text ? `${personalize(camp.text, ctx, false)}\n\nUnsubscribe: ${unsub}` : undefined,
          unsubscribeUrl: unsub, tags: { client_id: client.id, campaign_id: camp.id },
        });
        bs++; sent++;
      } catch (e) {
        if (e instanceof SesError && e.retryable) { throttled = true; break; } // leave the cursor here; next run retries
        bf++; failed++;
        if (errors.length < 50) errors.push({ email, error: String((e as Error)?.message || e).slice(0, 200) });
        if (e instanceof SesError && /MailFromDomainNotVerified|NotVerified|AccountSuspended|SendingPaused/i.test(e.code + e.message)) {
          await db.EmailCampaign.update(camp.id, { status: "failed", last_error: e.message.slice(0, 300) }).catch(() => null);
          cursor = recips.length; break;
        }
      }
      cursor++;
      const wait = gap - (Date.now() - t0);
      if (wait > 0) await sleep(wait);
    }
    const done = cursor >= recips.length;
    await db.EmailSendBatch.update(b.id, { cursor, sent: bs, failed: bf, errors, status: done ? "done" : "pending", locked_at: null });
    await db.EmailCampaign.update(camp.id, {
      sent_count: (Number(camp.sent_count) || 0) + (bs - (Number(b.sent) || 0)),
      failed_count: (Number(camp.failed_count) || 0) + (bf - (Number(b.failed) || 0)),
      skipped_count: (Number(camp.skipped_count) || 0) + skipped,
    }).then((c: any) => { campaigns[camp.id] = c || camp; }).catch(() => null);
  }
  // Close out campaigns with nothing left.
  for (const id of Object.keys(campaigns)) {
    const left = await db.EmailSendBatch.filter({ campaign_id: id, status: "pending" }, "created_date", 1).catch(() => []);
    const c = await db.EmailCampaign.get(id).catch(() => null);
    if (c && !left?.length && ["queued", "sending"].includes(c.status)) {
      await db.EmailCampaign.update(id, { status: (c.failed_count || 0) > 0 ? ((c.sent_count || 0) > 0 ? "partial" : "failed") : "sent", finished_at: new Date().toISOString() }).catch(() => null);
    }
  }
  return { ok: true, sent, failed, throttled, batches: batches.length };
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
  const add = async (email: string, reason: string, detail: string) => {
    const e = normEmail(email);
    if (!isEmail(e)) return;
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
      return Response.json(await drain(db, body?.campaign_id ? String(body.campaign_id) : undefined));
    }

    const client = await resolveClient(db, user, body?.client_id);
    if (!client) return Response.json({ error: isAdmin ? "Pick a client" : "No portal is set up for this login yet.", code: "no_client" }, { status: isAdmin ? 400 : 403 });
    if (!isAdmin && !planUnlocksStudios(client)) return Response.json({ error: "Email Studio is included with HyperCare+. Ask us about upgrading from your portal.", code: "studios_locked" }, { status: 403 });
    if (!isAdmin && studioState(client, "email") !== "on") return Response.json({ error: "Email Studio isn't switched on for your account yet.", code: "studio_off" }, { status: 403 });
    const cid = String(client.id);

    if (action === "status") {
      const r = readiness(client);
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
      const ready = readiness(client);
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
        client_id: cid, client_name: client.business, name: String(body?.name || subject).slice(0, 160), subject, html,
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
      const run = await drain(db, camp.id).catch((e) => ({ ok: false, error: (e as Error).message }));
      const now = await db.EmailCampaign.get(camp.id).catch(() => camp);
      return Response.json({ ok: true, campaign_id: camp.id, queued: queue.length, skipped, status: now?.status, sent_so_far: now?.sent_count || 0, run, meter: { used: m.used + (isAdmin ? 0 : queue.length), cap: m.cap } });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("email-bulk", (e as Error)?.message);
    return Response.json({ error: (e as Error)?.message || "Send failed" }, { status: 500 });
  }
});

