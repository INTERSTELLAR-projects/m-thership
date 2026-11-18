// @ts-nocheck
// Client Email Studio engine (server side, Deno). Used by email-client (portal UI), email-bulk (send + 5-minute
// drain job), email-track (opens/clicks), email-signup (forms), email-hook (Command System triggers) and
// email-unsubscribe. Pure logic lives in emailCore.ts (unit tested); this file talks to the database and SES.
//
// Sending path (one email per recipient, nobody sees anyone else):
//   campaign -> EmailSendBatch rows (500) -> drain(): personalize -> unsubscribe link -> link + open tracking -> SES
//   Scheduled batches wait as status "scheduled" with not_before; drain promotes them (metering the campaign then).
//   Automations: EmailEnrollment rows; drain runs due steps (email / wait) and the daily trigger scans.
// Test clients (CRMClient.usage_overrides.email_dry_run = true) go through every step except the SES call.

import { sesConfig, sesSendEmail, SesError } from "./ses.ts";
import { clientUnsubscribeUrl, purposeKey, appBaseUrl, normEmail } from "./emailUnsub.ts";
import { inviteSettings } from "./portalInvite.ts";
import * as core from "./emailCore.ts";
import { renderClientEmail, renderClientText, themeFrom, normalizeClientBlocks } from "./clientEmail.ts";
import { check, record } from "./meter.ts";
import { markOutOfFuel, loadFuelConfig } from "./fuel.ts";
import { getSecret } from "./portalClient.ts";
import { SES_COST_PER_EMAIL } from "./usagePlans.ts";

export { core };
export const BATCH = 500;
const DEFAULT_RATE = 10;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();

/* ---------------- keys + urls ---------------- */

let KEYS = null;
export async function emailKeys() {
  return (KEYS ||= {
    track: await purposeKey("email-track:v1"), rid: await purposeKey("email-rid:v1"),
    confirm: await purposeKey("email-confirm:v1"), unsub: await purposeKey("email-unsub-contact:v1"),
  });
}
export async function baseUrl(db) { return appBaseUrl((await inviteSettings(db).catch(() => ({ portal_url: "" }))).portal_url); }

export async function trackToken(keys, p) { return await core.signToken(keys.track, "t", core.trackPayload(p)); }
export async function contactUnsubUrl(base, keys, clientId, contactId, p) {
  const tok = await core.signToken(keys.unsub, "u", [clientId, contactId, p.src || "", p.id || "", p.step || ""].map((x) => String(x).replace(/\|/g, "")).join("|"));
  return `${base}/functions/email-optout?u=${encodeURIComponent(tok)}`;
}

// Personalize + unsubscribe + tracking for ONE recipient. r = { email, name, first_name, last_name, cid?, vars? }.
export async function buildMessage({ base, keys, clientId, src, id, step = "", links, html, text, subject, r, extraVars = {}, track = true }) {
  const rid = await core.ridFor(keys.rid, r.cid, r.email);
  const p = { src, id, step, rid };
  const unsub = r.cid ? await contactUnsubUrl(base, keys, clientId, r.cid, p) : await clientUnsubscribeUrl(base, clientId, r.email, await trackToken(keys, { ...p, link: -1 }));
  const vars = core.recipientVars(r, { ...extraVars, unsubscribe_url: unsub });
  let h = core.personalize(html, vars, true);
  if (track) {
    const open = `${base}/functions/email-track?o=${encodeURIComponent(await trackToken(keys, { ...p, link: -1 }))}`;
    const clicks = [];
    for (let i = 0; i < links.length; i++) clicks.push(`${base}/functions/email-track?c=${encodeURIComponent(await trackToken(keys, { ...p, link: i }))}`);
    h = core.addPixel(core.rewriteLinks(h, links, (i) => clicks[i]), open);
  }
  return { html: h, text: text ? core.personalize(text, vars, false) : undefined, subject: core.personalize(subject, vars, false), unsub, rid };
}

/* ---------------- readiness + transport ---------------- */

export const isDryRun = (client) => client?.usage_overrides?.email_dry_run === true;

export function readiness(client, settings) {
  if (!settings?.physical_address?.trim()) return { ready: false, code: "no_address", reason: "Add your business mailing address in Email Studio settings. The law (CAN-SPAM) requires it in every email." };
  if (isDryRun(client)) return { ready: true, code: "dry_run", dry_run: true, reason: "Test mode: emails go through every step but are never actually sent." };
  if (!sesConfig()) return { ready: false, code: "ses_not_configured", reason: "Sending isn't switched on yet. Interstellar is finishing the setup for your sending domain." };
  if (!client?.ses_from_email || !core.isEmail(String(client.ses_from_email))) return { ready: false, code: "no_sender", reason: "No sending address is set for your business yet. Interstellar sets this up." };
  if (!client.ses_domain_verified) return { ready: false, code: "domain_unverified", reason: "Your sending domain is still being verified. Interstellar will let you know when it's ready." };
  return { ready: true, code: "ok", reason: "" };
}

export async function deliver(client, m) {
  if (isDryRun(client)) return { messageId: "dry-run", dry_run: true };
  const cfg = sesConfig();
  if (!cfg) throw new SesError(503, "NotConfigured", "SES not configured");
  return await sesSendEmail(cfg, m);
}

async function rateLimit(db) {
  const rows = await db.AppSettings.filter({ key: "studios_email" }, "-updated_date", 1).catch(() => []);
  const n = Number(rows?.[0]?.advancedSettings?.ses_max_per_second);
  return n > 0 && n <= 200 ? n : DEFAULT_RATE;
}

/* ---------------- settings, theme, contacts ---------------- */

export async function loadSettings(db, client, create = true) {
  const cid = String(client.id);
  const rows = (await db.EmailStudioSettings.filter({ client_id: cid }, "-updated_date", 1).catch(() => [])) || [];
  if (rows[0]) return rows[0];
  const draft = { client_id: cid, timezone: "America/Los_Angeles", physical_address: "", review_link: "", from_name: client.ses_from_name || client.business || "", trigger_secret_name: core.triggerSecretName(client.business, cid), brand: {} };
  const map = ((await db.MapPackPlan.filter({ client_id: cid }, "-updated_date", 1).catch(() => [])) || [])[0];
  if (map?.primary_location?.address) draft.physical_address = String(map.primary_location.address).slice(0, 300);
  const rc = ((await db.ReviewClient.filter({ crm_client_id: cid }, "-updated_date", 1).catch(() => [])) || [])[0];
  if (rc?.place_id) draft.review_link = `https://search.google.com/local/writereview?placeid=${encodeURIComponent(rc.place_id)}`;
  if (!create) return draft;
  return await db.EmailStudioSettings.create(draft);
}

export async function brandKitOf(db, clientId) {
  const rows = (await db.BrandKit.filter({ client_id: String(clientId) }, "-updated_date", 5).catch(() => [])) || [];
  return (rows.find((r) => r.status === "approved") || rows[0])?.kit || null;
}

export async function loadTheme(db, client, settings) {
  const kit = await brandKitOf(db, client.id);
  return themeFrom({ business: settings?.from_name || client.business, logo_url: client.logo_url, kit, overrides: settings?.brand, address: settings?.physical_address, footer_note: settings?.footer_note });
}

export async function allContacts(db, clientId, fields = undefined, max = 30000) {
  const out = [];
  for (let skip = 0; skip < max; skip += 5000) {
    const rows = ((await db.EmailContact.filter({ client_id: String(clientId) }, "created_date", 5000, skip, fields).catch(() => [])) || []);
    out.push(...rows);
    if (rows.length < 5000) break;
  }
  return out;
}

export async function suppressedSet(db, clientId) {
  const rows = ((await db.EmailSuppression.filter({ client_id: String(clientId) }, "-created_date", 20000).catch(() => [])) || []);
  return new Map(rows.map((s) => [normEmail(s.email), s.reason]));
}

const contactVars = (c) => {
  const v = {};
  for (const k of ["city", "state", "zip", "country", "phone"]) if (c[k]) v[k] = String(c[k]).slice(0, 100);
  for (const [k, val] of Object.entries(c.fields || {}).slice(0, 12)) if (/^[a-z0-9_]{1,40}$/.test(k) && val != null) v[k] = String(val).slice(0, 120);
  return v;
};
export const recipientOf = (c) => ({ email: normEmail(c.email), name: c.name || "", first_name: c.first_name || "", last_name: c.last_name || "", cid: c.id, tz: c.timezone || "", vars: contactVars(c) });

// Audience = lists (any of) AND segment (if set) AND NOT exclude segment. Only subscribed, never suppressed.
export async function resolveAudience(db, clientId, audience) {
  const listIds = (audience?.list_ids || []).map(String).filter(Boolean);
  const seg = audience?.segment_id ? await db.EmailSegment.get(String(audience.segment_id)).catch(() => null) : null;
  const excl = audience?.exclude_segment_id ? await db.EmailSegment.get(String(audience.exclude_segment_id)).catch(() => null) : null;
  if (seg && seg.client_id !== String(clientId)) throw new Error("Segment not found");
  if (excl && excl.client_id !== String(clientId)) throw new Error("Segment not found");
  if (!listIds.length && !seg) return { recipients: [], counts: { matched: 0 }, error: "Pick a list or a segment." };
  const [contacts, sup] = [await allContacts(db, clientId), await suppressedSet(db, clientId)];
  const now = Date.now();
  const counts = { matched: 0, unsubscribed: 0, suppressed: 0, pending: 0 };
  const out = [];
  for (const c of contacts) {
    if (listIds.length && !(c.list_ids || []).some((l) => listIds.includes(l))) continue;
    if (seg && !core.matchSegment(c, seg, now)) continue;
    if (excl && core.matchSegment(c, excl, now)) continue;
    counts.matched++;
    if (c.status === "pending") { counts.pending++; continue; }
    if (c.status !== "subscribed") { counts.unsubscribed++; continue; }
    if (sup.has(normEmail(c.email))) { counts.suppressed++; continue; }
    out.push(recipientOf(c));
  }
  return { recipients: out, counts: { ...counts, sendable: out.length } };
}

/* ---------------- contacts upsert + enrollment ---------------- */

export async function findContact(db, clientId, email) {
  return ((await db.EmailContact.filter({ client_id: String(clientId), email: normEmail(email) }, "-created_date", 1).catch(() => [])) || [])[0] || null;
}

const FIELDS = ["first_name", "last_name", "name", "phone", "city", "state", "zip", "country", "timezone", "birthday", "anniversary"];
// data: contact fields; opts: { lists, tags, status (for NEW contacts), consent, source, source_detail, overwrite }
export async function upsertContact(db, clientId, data, opts = {}) {
  const email = normEmail(data.email);
  if (!core.isEmail(email)) return { error: "invalid_email" };
  const have = opts.existing !== undefined ? opts.existing : await findContact(db, clientId, email);
  const lists = (opts.lists || []).map(String).filter(Boolean);
  const tags = core.normTags([...(data.tags || []), ...(opts.tags || [])]);
  if (!have) {
    const row = {
      client_id: String(clientId), email, list_ids: lists, tags, status: opts.status || "subscribed", source: opts.source || "manual", source_detail: String(opts.source_detail || "").slice(0, 200),
      consent: opts.consent || {}, created_at: nowIso(), sent_count: 0, open_count: 0, click_count: 0, fields: data.fields || {}, test: !!opts.test,
      ...(opts.status === "subscribed" && opts.consent?.basis === "double_opt_in" ? { confirmed_at: nowIso() } : {}),
    };
    for (const k of FIELDS) if (data[k]) row[k] = String(data[k]).slice(0, 200);
    if (!row.name && (row.first_name || row.last_name)) row.name = [row.first_name, row.last_name].filter(Boolean).join(" ");
    const created = await db.EmailContact.create(row);
    return { contact: created, created: true, lists_added: lists };
  }
  const patch = {};
  for (const k of FIELDS) if (data[k] && (opts.overwrite || !have[k])) patch[k] = String(data[k]).slice(0, 200);
  const newLists = lists.filter((l) => !(have.list_ids || []).includes(l));
  if (newLists.length) patch.list_ids = [...(have.list_ids || []), ...newLists];
  const newTags = tags.filter((t) => !(have.tags || []).includes(t));
  if (newTags.length) patch.tags = [...(have.tags || []), ...newTags];
  if (data.fields && Object.keys(data.fields).length) patch.fields = { ...(have.fields || {}), ...data.fields };
  if (Object.keys(patch).length) await db.EmailContact.update(have.id, patch);
  return { contact: { ...have, ...patch }, created: false, lists_added: newLists };
}

// Start every matching active automation for this contact. trig: { type: "list_join", list_id } | { type: "event", name, data, key }
export async function enroll(db, client, contact, trig) {
  if (!contact?.id || contact.status !== "subscribed") return 0;
  const autos = ((await db.EmailAutomation.filter({ client_id: String(client.id), status: "active" }, "-created_date", 100).catch(() => [])) || []);
  let n = 0;
  for (const a of autos) {
    const t = a.trigger || {};
    if (t.type !== trig.type) continue;
    if (trig.type === "list_join" && t.list_id && t.list_id !== trig.list_id) continue;
    if (trig.type === "event" && String(t.event_name || "").toLowerCase() !== String(trig.name || "").toLowerCase()) continue;
    const key = trig.key || (trig.type === "list_join" ? `join:${trig.list_id || "any"}` : `event:${trig.name}`);
    const prior = ((await db.EmailEnrollment.filter({ automation_id: a.id, contact_id: contact.id }, "-created_date", 20).catch(() => [])) || []);
    if (prior.some((e) => e.trigger_key === key)) continue;
    const days = Number(a.reenroll_days) || 0;
    if (trig.type === "list_join" && prior.length && (!days || prior.some((e) => Date.now() - Date.parse(e.started_at || e.created_date) < days * 864e5))) continue;
    await db.EmailEnrollment.create({ client_id: String(client.id), automation_id: a.id, contact_id: contact.id, email: contact.email, step_index: 0, next_run_at: nowIso(), status: "active", trigger_key: key, data: trig.data || {}, history: [], started_at: nowIso(), test: !!contact.test });
    await db.EmailAutomation.update(a.id, { enrolled_count: (Number(a.enrolled_count) || 0) + 1 }).catch(() => null);
    n++;
  }
  return n;
}

/* ---------------- campaigns: queue / schedule ---------------- */

export async function renderCampaign(db, client, settings, camp) {
  const theme = await loadTheme(db, client, settings);
  const doc = { subject: camp.subject, blocks: normalizeClientBlocks(camp.blocks) };
  const html = renderClientEmail(doc, theme);
  return { html, text: renderClientText(doc, theme), links: core.extractLinks(html), theme };
}

// when: "now" | "schedule". For "schedule": send_local (YYYY-MM-DDTHH:mm), send_tz, tz_mode fixed | subscriber.
export async function queueCampaign(db, client, settings, camp, recipients, { when, send_local, send_tz, tz_mode, user, isAdmin }) {
  const cid = String(client.id);
  const { html, text, links } = await renderCampaign(db, client, settings, camp);
  const fallbackTz = core.validTz(send_tz) ? send_tz : settings.timezone || "America/Los_Angeles";
  const groups = new Map();
  if (when === "schedule" && tz_mode === "subscriber") {
    for (const r of recipients) { const tz = core.validTz(r.tz) ? r.tz : fallbackTz; if (!groups.has(tz)) groups.set(tz, []); groups.get(tz).push(r); }
  } else groups.set(fallbackTz, recipients);
  const plan = [];
  for (const [tz, list] of groups) {
    const at = when === "schedule" ? core.zonedToUtc(send_local, tz) : new Date();
    if (!at) throw new Error("Pick a valid date and time");
    plan.push({ tz, at: at.getTime() < Date.now() ? new Date() : at, list });
  }
  const earliest = new Date(Math.min(...plan.map((p) => p.at.getTime())));
  const total = recipients.length;
  let pause = false, m = null;
  if (when === "now") {
    m = await check(db, client, "marketing_email", total, { admin: isAdmin, feature: "email.campaign" });
    pause = !m.ok && (m.code === "out_of_fuel" || m.code === "insufficient_fuel");
    if (!m.ok && !pause) return { error: m.reason, code: m.code, meter: m };
  }
  const status = when === "schedule" ? "scheduled" : pause ? "paused" : "queued";
  const saved = await db.EmailCampaign.update(camp.id, {
    html, text, links, track: true, status, total, sent_count: 0, failed_count: 0, skipped_count: 0, batches: 0, dry_run: isDryRun(client),
    from_email: client.ses_from_email || "", from_name: settings.from_name || client.ses_from_name || client.business, reply_to: settings.reply_to || client.ses_reply_to || "",
    send_at: earliest.toISOString(), send_local: when === "schedule" ? send_local : "", send_tz: fallbackTz, tz_mode: when === "schedule" && tz_mode === "subscriber" ? "subscriber" : "fixed",
    metered: when === "now" && !pause, by_admin: isAdmin, updated_by: user.email, ...(pause ? { fuel_paused_at: nowIso() } : {}), created_at: camp.created_at || nowIso(),
  });
  let n = 0;
  for (const p of plan) {
    for (let i = 0; i < p.list.length; i += BATCH) {
      await db.EmailSendBatch.create({
        campaign_id: camp.id, client_id: cid, index: n++, recipients: p.list.slice(i, i + BATCH).map(({ tz: _tz, ...r }) => r),
        status: when === "schedule" ? "scheduled" : pause ? "held" : "pending", not_before: p.at.toISOString(), tz: p.tz, cursor: 0, sent: 0, failed: 0, errors: [], attempts: 0,
      });
    }
  }
  await db.EmailCampaign.update(camp.id, { batches: n });
  if (when === "now" && !pause) {
    await record(db, client, "marketing_email", total, { admin: isAdmin, model: "ses", est_cost_usd: total * SES_COST_PER_EMAIL, feature: "email.campaign", user_email: user.email, campaign_id: camp.id });
  }
  if (pause && m?.code === "out_of_fuel") await markOutOfFuel(db, client, "marketing_email", await loadFuelConfig(db), getSecret("STRIPE_SECRET_KEY") || null).catch(() => null);
  return { ok: true, status, campaign: { ...saved, status, batches: n }, paused: pause, message: pause ? m?.reason : "", plan: plan.map((p) => ({ tz: p.tz, at: p.at.toISOString(), count: p.list.length })) };
}

// Cancel (status cancelled) or reschedule (new wall-clock time) before anything was sent.
export async function cancelCampaign(db, camp) {
  const batches = ((await db.EmailSendBatch.filter({ campaign_id: camp.id }, "created_date", 500).catch(() => [])) || []);
  for (const b of batches) if (["scheduled", "pending", "held"].includes(b.status)) await db.EmailSendBatch.update(b.id, { status: "cancelled" }).catch(() => null);
  return await db.EmailCampaign.update(camp.id, { status: "cancelled", cancelled_at: nowIso() });
}
export async function rescheduleCampaign(db, camp, send_local, send_tz, tz_mode) {
  const batches = ((await db.EmailSendBatch.filter({ campaign_id: camp.id, status: "scheduled" }, "created_date", 500).catch(() => [])) || []);
  let earliest = Infinity;
  const tzFixed = core.validTz(send_tz) ? send_tz : camp.send_tz;
  for (const b of batches) {
    const at = core.zonedToUtc(send_local, camp.tz_mode === "subscriber" && tz_mode !== "fixed" ? b.tz || tzFixed : tzFixed);
    if (!at) throw new Error("Pick a valid date and time");
    const t = Math.max(at.getTime(), Date.now());
    earliest = Math.min(earliest, t);
    await db.EmailSendBatch.update(b.id, { not_before: new Date(t).toISOString() });
  }
  return await db.EmailCampaign.update(camp.id, { send_local, send_tz: tzFixed, send_at: new Date(Number.isFinite(earliest) ? earliest : Date.now()).toISOString() });
}

/* ---------------- drain (5-minute job) ---------------- */

// Scheduled batches whose time has come -> pending. The campaign is metered when its first batch is promoted.
async function promoteScheduled(db) {
  const rows = ((await db.EmailSendBatch.filter({ status: "scheduled" }, "not_before", 200).catch(() => [])) || []);
  const due = rows.filter((b) => !b.not_before || Date.parse(b.not_before) <= Date.now());
  const byCamp = new Map();
  for (const b of due) { if (!byCamp.has(b.campaign_id)) byCamp.set(b.campaign_id, []); byCamp.get(b.campaign_id).push(b); }
  let promoted = 0;
  for (const [id, list] of byCamp) {
    const camp = await db.EmailCampaign.get(id).catch(() => null);
    if (!camp || camp.status === "cancelled") { for (const b of list) await db.EmailSendBatch.update(b.id, { status: "cancelled" }).catch(() => null); continue; }
    if (!camp.metered && camp.status === "scheduled") {
      const client = await db.CRMClient.get(camp.client_id).catch(() => null);
      if (!client) continue;
      const m = await check(db, client, "marketing_email", Number(camp.total) || 0, { admin: !!camp.by_admin, feature: "email.campaign.scheduled" });
      if (!m.ok) {
        if (m.code === "out_of_fuel" || m.code === "insufficient_fuel") {
          const all = ((await db.EmailSendBatch.filter({ campaign_id: id, status: "scheduled" }, "created_date", 500).catch(() => [])) || []);
          for (const b of all) await db.EmailSendBatch.update(b.id, { status: "held" }).catch(() => null);
          await db.EmailCampaign.update(id, { status: "paused", fuel_paused_at: nowIso(), last_error: m.reason });
          if (m.code === "out_of_fuel") await markOutOfFuel(db, client, "marketing_email", await loadFuelConfig(db), getSecret("STRIPE_SECRET_KEY") || null).catch(() => null);
        } else await db.EmailCampaign.update(id, { status: "failed", last_error: m.reason });
        continue;
      }
      await record(db, client, "marketing_email", Number(camp.total) || 0, { admin: !!camp.by_admin, model: "ses", est_cost_usd: (Number(camp.total) || 0) * SES_COST_PER_EMAIL, feature: "email.campaign", user_email: camp.updated_by || camp.created_by || "", campaign_id: id });
      await db.EmailCampaign.update(id, { metered: true, status: "queued" });
    }
    for (const b of list) { await db.EmailSendBatch.update(b.id, { status: "pending" }).catch(() => null); promoted++; }
  }
  return promoted;
}

export async function drain(db, { onlyCampaign = "", budgetMs = 45_000 } = {}) {
  const started = Date.now();
  const promoted = onlyCampaign ? 0 : await promoteScheduled(db).catch((e) => { console.error("email.promote", e?.message); return 0; });
  const base = await baseUrl(db);
  const keys = await emailKeys();
  const rate = await rateLimit(db);
  let sent = 0, failed = 0, throttled = false;
  const q = onlyCampaign ? { campaign_id: onlyCampaign, status: "pending" } : { status: "pending" };
  const batches = ((await db.EmailSendBatch.filter(q, "created_date", 20).catch(() => [])) || []);
  const stale = onlyCampaign ? [] : ((await db.EmailSendBatch.filter({ status: "sending" }, "created_date", 20).catch(() => [])) || []);
  for (const b of stale) if (b.locked_at && Date.now() - Date.parse(b.locked_at) > 600_000) batches.push(b);
  const campaigns = {}, clients = {};
  for (const b of batches) {
    if (Date.now() - started > budgetMs || throttled) break;
    const camp = campaigns[b.campaign_id] ||= await db.EmailCampaign.get(b.campaign_id).catch(() => null);
    if (!camp || camp.status === "cancelled") { await db.EmailSendBatch.update(b.id, { status: "cancelled" }).catch(() => null); continue; }
    if (camp.status === "paused") { await db.EmailSendBatch.update(b.id, { status: "held" }).catch(() => null); continue; }
    const client = clients[b.client_id] ||= await db.CRMClient.get(b.client_id).catch(() => null);
    if (!client) continue;
    if (!isDryRun(client) && !sesConfig()) continue; // SES not configured: real sends wait in the queue
    await db.EmailSendBatch.update(b.id, { status: "sending", locked_at: nowIso(), attempts: (Number(b.attempts) || 0) + 1 });
    if (["queued", "scheduled"].includes(camp.status)) await db.EmailCampaign.update(camp.id, { status: "sending", started_at: camp.started_at || nowIso() }).catch(() => null);
    const sup = await suppressedSet(db, b.client_id);
    const links = Array.isArray(camp.links) ? camp.links : core.extractLinks(camp.html);
    const recips = b.recipients || [];
    let cursor = Number(b.cursor) || 0;
    let bs = Number(b.sent) || 0, bf = Number(b.failed) || 0, skipped = 0;
    const errors = (b.errors || []).slice(0, 50);
    const gap = isDryRun(client) ? 0 : 1000 / rate;
    const stamps = [];
    let sample = "";
    while (cursor < recips.length) {
      if (Date.now() - started > budgetMs) break;
      const r = recips[cursor];
      const email = normEmail(r.email);
      if (sup.has(email)) { skipped++; cursor++; continue; }
      const t0 = Date.now();
      try {
        const msg = await buildMessage({ base, keys, clientId: client.id, src: "c", id: camp.id, links, html: camp.html, text: camp.text, subject: camp.subject, r: { ...r, email }, extraVars: { business: client.business }, track: camp.track !== false });
        await deliver(client, {
          from: client.ses_from_email || "test@example.com", fromName: camp.from_name || client.ses_from_name || client.business, replyTo: camp.reply_to || client.ses_reply_to || undefined,
          to: email, subject: msg.subject, html: msg.html, text: msg.text ? `${msg.text}` : undefined, unsubscribeUrl: msg.unsub, tags: { client_id: client.id, campaign_id: camp.id, rid: msg.rid },
        });
        if (isDryRun(client) && !sample) sample = msg.html;
        if (r.cid) stamps.push(db.EmailContact.update(r.cid, { last_sent_at: nowIso() }).catch(() => null));
        bs++; sent++;
      } catch (e) {
        if (e instanceof SesError && e.retryable) { throttled = true; break; }
        bf++; failed++;
        if (errors.length < 50) errors.push({ email, error: String(e?.message || e).slice(0, 200) });
        if (e instanceof SesError && /MailFromDomainNotVerified|NotVerified|AccountSuspended|SendingPaused/i.test(e.code + e.message)) {
          await db.EmailCampaign.update(camp.id, { status: "failed", last_error: e.message.slice(0, 300) }).catch(() => null);
          cursor = recips.length; break;
        }
      }
      cursor++;
      const wait = gap - (Date.now() - t0);
      if (wait > 0) await sleep(wait);
    }
    await Promise.all(stamps);
    const done = cursor >= recips.length;
    await db.EmailSendBatch.update(b.id, { cursor, sent: bs, failed: bf, errors, status: done ? "done" : "pending", locked_at: null });
    const fresh = await db.EmailCampaign.get(camp.id).catch(() => camp);
    campaigns[camp.id] = await db.EmailCampaign.update(camp.id, {
      sent_count: (Number(fresh.sent_count) || 0) + (bs - (Number(b.sent) || 0)),
      failed_count: (Number(fresh.failed_count) || 0) + (bf - (Number(b.failed) || 0)),
      skipped_count: (Number(fresh.skipped_count) || 0) + skipped,
      ...(sample ? { dry_run_sample: sample.slice(0, 200_000) } : {}),
    }).catch(() => fresh);
  }
  for (const id of Object.keys(campaigns)) {
    const left = await db.EmailSendBatch.filter({ campaign_id: id, status: "pending" }, "created_date", 1).catch(() => []);
    const later = await db.EmailSendBatch.filter({ campaign_id: id, status: "scheduled" }, "created_date", 1).catch(() => []);
    const c = await db.EmailCampaign.get(id).catch(() => null);
    if (c && !left?.length && !later?.length && ["queued", "sending"].includes(c.status)) {
      await db.EmailCampaign.update(id, { status: (c.failed_count || 0) > 0 ? ((c.sent_count || 0) > 0 ? "partial" : "failed") : "sent", finished_at: nowIso() }).catch(() => null);
    }
  }
  let automations = null;
  if (!onlyCampaign) automations = await runAutomations(db, started + budgetMs + 8000).catch((e) => ({ error: e?.message }));
  return { ok: true, promoted, sent, failed, throttled, batches: batches.length, automations };
}

/* ---------------- automations ---------------- */

const localHour = (d, tz) => Number(new Intl.DateTimeFormat("en-US", { timeZone: core.validTz(tz) ? tz : "UTC", hour: "2-digit", hourCycle: "h23" }).format(d));

export function stepLinks(step, theme) {
  if (Array.isArray(step.links)) return step.links;
  return core.extractLinks(renderClientEmail({ subject: step.subject, blocks: step.blocks }, theme));
}

// Daily scans for inactive (win-back) and date-field (birthday / anniversary) automations, at the trigger's local hour.
async function scanTriggers(db, deadline) {
  const autos = ((await db.EmailAutomation.filter({ status: "active" }, "-updated_date", 200).catch(() => [])) || []).filter((a) => ["inactive", "date_field"].includes(a.trigger?.type));
  let enrolled = 0;
  for (const a of autos) {
    if (Date.now() > deadline) break;
    const client = await db.CRMClient.get(a.client_id).catch(() => null);
    if (!client) continue;
    const settings = await loadSettings(db, client);
    const tz = settings.timezone || "America/Los_Angeles";
    const now = new Date();
    const today = core.dayIn(now, tz);
    if (a.last_scan_day === today || localHour(now, tz) < (Number(a.trigger?.send_hour) || 9)) continue;
    const contacts = (await allContacts(db, client.id)).filter((c) => c.status === "subscribed");
    const prior = ((await db.EmailEnrollment.filter({ automation_id: a.id }, "-created_date", 20000).catch(() => [])) || []);
    const byContact = new Map();
    for (const e of prior) { if (!byContact.has(e.contact_id)) byContact.set(e.contact_id, []); byContact.get(e.contact_id).push(e); }
    const year = today.slice(0, 4);
    for (const c of contacts) {
      let key = "";
      if (a.trigger.type === "inactive") {
        const months = Math.max(1, Number(a.trigger.months) || 6);
        const last = core.lastActivity(c);
        if (!Number.isFinite(last) || Date.now() - last < months * 30.44 * 864e5) continue;
        const mine = byContact.get(c.id) || [];
        if (mine.some((e) => Date.now() - Date.parse(e.started_at || e.created_date) < months * 30.44 * 864e5)) continue;
        if (mine.length && !(Number(a.reenroll_days) > 0)) continue;
        key = `inactive:${today.slice(0, 7)}`;
      } else {
        const field = a.trigger.field === "anniversary" ? "anniversary" : "birthday";
        if (core.monthDay(c[field]) !== today.slice(5)) continue;
        key = `${field}:${year}`;
        if ((byContact.get(c.id) || []).some((e) => e.trigger_key === key)) continue;
      }
      await db.EmailEnrollment.create({ client_id: a.client_id, automation_id: a.id, contact_id: c.id, email: c.email, step_index: 0, next_run_at: nowIso(), status: "active", trigger_key: key, data: {}, history: [], started_at: nowIso(), test: !!c.test });
      enrolled++;
    }
    await db.EmailAutomation.update(a.id, { last_scan_day: today, enrolled_count: (Number(a.enrolled_count) || 0) + enrolled }).catch(() => null);
  }
  return enrolled;
}

export async function runAutomations(db, deadline) {
  const scanned = await scanTriggers(db, deadline).catch((e) => { console.error("email.scan", e?.message); return 0; });
  const rows = ((await db.EmailEnrollment.filter({ status: "active" }, "next_run_at", 150).catch(() => [])) || []);
  const due = rows.filter((e) => !e.next_run_at || Date.parse(e.next_run_at) <= Date.now());
  const autos = {}, clients = {}, settingsOf = {}, themes = {}, fuel = {}, metered = {}, sups = {};
  const base = await baseUrl(db);
  const keys = await emailKeys();
  let sent = 0, waited = 0, finished = 0, exited = 0;
  for (const e of due) {
    if (Date.now() > deadline) break;
    const a = autos[e.automation_id] ||= await db.EmailAutomation.get(e.automation_id).catch(() => null);
    if (!a || a.status === "draft") { await db.EmailEnrollment.update(e.id, { status: "exited", exit_reason: "automation turned off", finished_at: nowIso() }); exited++; continue; }
    if (a.status === "paused") continue;
    const client = clients[e.client_id] ||= await db.CRMClient.get(e.client_id).catch(() => null);
    if (!client) continue;
    const settings = settingsOf[client.id] ||= await loadSettings(db, client);
    const contact = await db.EmailContact.get(e.contact_id).catch(() => null);
    const sup = sups[client.id] ||= await suppressedSet(db, client.id);
    if (!contact || contact.status !== "subscribed" || sup.has(normEmail(contact.email))) {
      await db.EmailEnrollment.update(e.id, { status: "exited", exit_reason: "unsubscribed or removed", finished_at: nowIso() }); exited++; continue;
    }
    const steps = Array.isArray(a.steps) ? a.steps : [];
    let idx = Number(e.step_index) || 0;
    const history = (e.history || []).slice(-30);
    const patch = {};
    while (true) {
      const step = steps[idx];
      if (!step) { Object.assign(patch, { status: "done", finished_at: nowIso() }); finished++; await db.EmailAutomation.update(a.id, { completed_count: (Number(a.completed_count) || 0) + 1 }).catch(() => null); a.completed_count = (Number(a.completed_count) || 0) + 1; break; }
      if (step.type === "wait") {
        Object.assign(patch, { next_run_at: new Date(Date.now() + core.waitMs(step)).toISOString() });
        history.push({ step_id: step.id, at: nowIso(), result: "waiting" });
        idx++; waited++; break;
      }
      const ready = readiness(client, settings);
      if (!ready.ready) { Object.assign(patch, { next_run_at: new Date(Date.now() + 3600e3).toISOString() }); history.push({ step_id: step.id, at: nowIso(), result: `waiting: ${ready.code}` }); break; }
      if (fuel[client.id] === undefined) {
        const n = due.filter((x) => x.client_id === client.id).length;
        const m = await check(db, client, "marketing_email", n, { feature: "email.automation" });
        fuel[client.id] = m.ok || m.code === "insufficient_fuel";
      }
      if (!fuel[client.id]) { Object.assign(patch, { next_run_at: new Date(Date.now() + 6 * 3600e3).toISOString() }); history.push({ step_id: step.id, at: nowIso(), result: "waiting: out of fuel" }); break; }
      const theme = themes[client.id] ||= await loadTheme(db, client, settings);
      const html = renderClientEmail({ subject: step.subject, blocks: step.blocks }, theme);
      const text = renderClientText({ subject: step.subject, blocks: step.blocks }, theme);
      const flat = Object.fromEntries(Object.entries(e.data || {}).filter(([k, v]) => /^[a-z0-9_]{1,40}$/.test(k) && ["string", "number"].includes(typeof v)).map(([k, v]) => [k, String(v).slice(0, 200)]));
      try {
        const msg = await buildMessage({ base, keys, clientId: client.id, src: "a", id: a.id, step: step.id, links: stepLinks(step, theme), html, text, subject: step.subject || a.name, r: recipientOf(contact), extraVars: { business: client.business, review_link: settings.review_link || "", ...flat } });
        await deliver(client, { from: client.ses_from_email || "test@example.com", fromName: settings.from_name || client.ses_from_name || client.business, replyTo: settings.reply_to || client.ses_reply_to || undefined, to: normEmail(contact.email), subject: msg.subject, html: msg.html, text: msg.text, unsubscribeUrl: msg.unsub, tags: { client_id: client.id, automation_id: a.id, step_id: step.id, rid: msg.rid } });
        await db.EmailContact.update(contact.id, { last_sent_at: nowIso() }).catch(() => null);
        metered[client.id] = (metered[client.id] || 0) + 1;
        history.push({ step_id: step.id, at: nowIso(), result: isDryRun(client) ? "sent (test mode)" : "sent" });
        sent++;
        idx++;
      } catch (err) {
        if (err instanceof SesError && err.retryable) { Object.assign(patch, { next_run_at: new Date(Date.now() + 600e3).toISOString() }); break; }
        history.push({ step_id: step.id, at: nowIso(), result: `failed: ${String(err?.message || err).slice(0, 120)}` });
        Object.assign(patch, { status: "failed", finished_at: nowIso() });
        break;
      }
    }
    await db.EmailEnrollment.update(e.id, { ...patch, step_index: idx, history });
  }
  for (const [cid, n] of Object.entries(metered)) {
    const client = clients[cid];
    if (client && n) await record(db, client, "marketing_email", n, { model: "ses", est_cost_usd: n * SES_COST_PER_EMAIL, feature: "email.automation" }).catch(() => null);
  }
  return { scanned, due: due.length, sent, waited, finished, exited };
}

/* ---------------- Command System events (email-hook) ---------------- */

// payload: { event, email, first_name?, last_name?, name?, phone?, tags?, list?, fields?, consent?, occurred_at?, idempotency_key? }
export async function ingestEvent(db, client, payload) {
  const event = String(payload?.event || "").trim().toLowerCase();
  if (!/^[a-z][a-z0-9_.-]{1,60}$/.test(event)) return { error: "bad_event", status: 400 };
  const email = normEmail(payload?.email);
  if (!core.isEmail(email)) return { error: "bad_email", status: 400 };
  const cid = String(client.id);
  const fields = {};
  for (const [k, v] of Object.entries(payload?.fields || {}).slice(0, 30)) if (/^[a-z0-9_]{1,40}$/i.test(k) && v != null && typeof v !== "object") fields[k.toLowerCase()] = String(v).slice(0, 300);
  const at = payload?.occurred_at && Number.isFinite(Date.parse(payload.occurred_at)) ? new Date(payload.occurred_at).toISOString() : nowIso();
  if (event === "job.completed") fields.last_job_at = at;
  let listId = "";
  if (payload?.list) {
    const lists = ((await db.EmailContactList.filter({ client_id: cid }, "name", 200).catch(() => [])) || []);
    const want = String(payload.list).trim().toLowerCase();
    listId = lists.find((l) => l.id === payload.list || String(l.name).trim().toLowerCase() === want)?.id || "";
  }
  const existing = await findContact(db, cid, email);
  if (event === "contact.unsubscribed") {
    if (existing) await db.EmailContact.update(existing.id, { status: "unsubscribed", unsubscribed_at: nowIso() });
    const have = await db.EmailSuppression.filter({ client_id: cid, email, reason: "unsubscribe" }, "-created_date", 1).catch(() => []);
    if (!have?.length) await db.EmailSuppression.create({ client_id: cid, email, reason: "unsubscribe", detail: "Command System: contact.unsubscribed", created_at: nowIso() });
    return { ok: true, contact_id: existing?.id || null, enrolled: 0 };
  }
  const optOut = payload?.marketing_opt_out === true;
  const data = { email, first_name: payload?.first_name, last_name: payload?.last_name, name: payload?.name, phone: payload?.phone, city: payload?.city, state: payload?.state, zip: payload?.zip, timezone: core.validTz(payload?.timezone) ? payload.timezone : "", birthday: core.normDate(payload?.birthday, true), anniversary: core.normDate(payload?.anniversary), tags: core.normTags(payload?.tags), fields };
  const up = await upsertContact(db, cid, data, {
    existing, lists: listId ? [listId] : [], source: "webhook", source_detail: `Command System: ${event}`, overwrite: true,
    status: optOut ? "unsubscribed" : "subscribed",
    consent: { basis: payload?.consent === true ? "express" : "existing_customer", source: `command_system:${event}`, at, text: payload?.consent_text ? String(payload.consent_text).slice(0, 300) : "" },
  });
  if (up.error) return { error: up.error, status: 400 };
  const c = up.contact;
  let enrolled = 0;
  for (const l of up.lists_added || []) enrolled += await enroll(db, client, c, { type: "list_join", list_id: l });
  const key = payload?.idempotency_key ? `event:${event}:${String(payload.idempotency_key).slice(0, 80)}` : `event:${event}:${at}`;
  const flat = { ...fields };
  for (const k of ["first_name", "last_name", "name"]) if (payload?.[k]) flat[k] = String(payload[k]).slice(0, 120);
  enrolled += await enroll(db, client, c, { type: "event", name: event, data: flat, key });
  return { ok: true, contact_id: c.id, created: up.created, status: c.status, enrolled };
}
