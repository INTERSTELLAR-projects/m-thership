// @ts-nocheck
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { requireSecondFactor } from "../../shared/twoFactor.ts";
import { resolveClient, hasSecret } from "../../shared/portalClient.ts";
import { studioState, planUnlocksStudios, MAX_FREE_LIST_SIZE } from "../../shared/usagePlans.ts";
import { check, record } from "../../shared/meter.ts";
import * as S from "../../shared/emailStudio.ts";
import * as core from "../../shared/emailCore.ts";
import { renderClientEmail, normalizeClientBlocks, CLIENT_EMAIL_SCHEMA } from "../../shared/clientEmail.ts";
import { normEmail } from "../../shared/emailUnsub.ts";

// Client Email Studio API for the portal (and Justin previewing a client). Every action is scoped to the caller's
// own client (resolveClient); portal users need HyperCare+ and Email Studio "on". Sending goes through the shared
// engine (base44/shared/emailStudio.ts): suppression + unsubscribe + CAN-SPAM footer on every email, fuel metered.
//
//   overview                                   readiness, settings, lists (+counts), segments, forms, automations, campaigns
//   settings_save {…}                          mailing address, time zone, review link, sender name, brand overrides
//   list_save {id?, name, description}
//   contacts {q, list_id, status, tag, segment_id, skip, limit} / contact_get {id} / contact_save {…} / contact_unsubscribe {id}
//   import_check {emails} / import {rows, mapping, custom, list_id, tags, consent, update_existing, start_automations, file_name}
//   segment_save / segment_delete / segment_count {match, rules, list_ids?}
//   audience_count {audience}
//   campaign_save / campaign_get / campaign_delete (drafts) / campaign_duplicate
//   campaign_send_test {id}                    ONE email to the signed-in login, subject "[TEST] …"
//   campaign_schedule {id, when: now|schedule, send_local, send_tz, tz_mode: fixed|subscriber}
//   campaign_cancel / campaign_reschedule {id, send_local, send_tz}
//   campaign_results {id, filter, skip}
//   ai_draft {prompt, purpose}                 InvokeLLM (Base44) fills subject + blocks; metered as 1 AI action
//   form_save / form_delete                    sign-up forms (+ embed code)
//   automation_save / automation_get / automation_status {id, status} / automation_delete (drafts)
//   trigger_test {event, email, …}             admin or test client only: runs a Command System event without a signature

const nowIso = () => new Date().toISOString();
const str = (v, n = 200) => String(v ?? "").trim().slice(0, n);
const err = (error, status = 400, extra = {}) => Response.json({ error, ...extra }, { status });
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));
const randKey = (n = 18) => Array.from(crypto.getRandomValues(new Uint8Array(n))).map((b) => "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 57]).join("");

async function pagedEvents(db, q, max = 50000) {
  const out = [];
  for (let skip = 0; skip < max; skip += 5000) {
    const rows = (await db.EmailEvent.filter(q, "at", 5000, skip).catch(() => [])) || [];
    out.push(...rows);
    if (rows.length < 5000) break;
  }
  return out;
}

function summarize(events, sent) {
  const bounces = new Set(), complaints = new Set(), unsubs = new Set(), opens = new Set(), clickers = new Set();
  let openTotal = 0, clickTotal = 0;
  const links = new Map();
  for (const e of events) {
    if (e.type === "open") { openTotal++; opens.add(e.rid); }
    else if (e.type === "click") {
      if (e.machine) continue;
      clickTotal++; clickers.add(e.rid); opens.add(e.rid);
      const k = `${e.link_index}|${e.url}`;
      const l = links.get(k) || { url: e.url, clicks: 0, people: new Set() };
      l.clicks++; l.people.add(e.rid); links.set(k, l);
    } else if (e.type === "bounce") bounces.add(e.rid || e.email);
    else if (e.type === "complaint") complaints.add(e.rid || e.email);
    else if (e.type === "unsubscribe") unsubs.add(e.rid || e.email);
  }
  const delivered = Math.max(0, (Number(sent) || 0) - bounces.size);
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  return {
    sent: Number(sent) || 0, delivered, opens: openTotal, unique_opens: opens.size, clicks: clickTotal, unique_clicks: clickers.size,
    bounces: bounces.size, complaints: complaints.size, unsubscribes: unsubs.size,
    open_rate: pct(opens.size, delivered), click_rate: pct(clickers.size, delivered), click_to_open: pct(clickers.size, opens.size),
    top_links: [...links.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 10).map((l) => ({ url: l.url, clicks: l.clicks, unique: l.people.size })),
  };
}

async function campaignResults(db, camp, { filter = "all", skip = 0 } = {}) {
  const events = await pagedEvents(db, { campaign_id: camp.id });
  const stats = summarize(events, camp.sent_count);
  // Opens over time (hourly for the first 72 hours after the send started).
  const t0 = Date.parse(camp.started_at || camp.send_at || camp.created_at || camp.created_date || nowIso());
  const hours = new Array(72).fill(0);
  for (const e of events) if (e.type === "open" || e.type === "click") { const h = Math.floor((Date.parse(e.at) - t0) / 3600e3); if (h >= 0 && h < 72) hours[h]++; }
  // Per-subscriber activity: recipients from the batches, joined to events by opaque rid.
  const keys = await S.emailKeys();
  const batches = (await db.EmailSendBatch.filter({ campaign_id: camp.id }, "created_date", 120).catch(() => [])) || [];
  const people = new Map();
  for (const b of batches) for (let i = 0; i < (b.recipients || []).length; i++) {
    const r = b.recipients[i];
    const rid = await core.ridFor(keys.rid, r.cid, r.email);
    const sentIt = b.status === "done" || i < (Number(b.cursor) || 0);
    people.set(rid, { rid, email: r.email, name: r.name || [r.first_name, r.last_name].filter(Boolean).join(" "), contact_id: r.cid || "", sent: sentIt, opens: 0, clicks: 0, bounced: false, unsubscribed: false, complained: false, last_at: "" });
  }
  for (const e of events) {
    const p = people.get(e.rid);
    if (!p) continue;
    if (e.type === "open") p.opens++;
    if (e.type === "click" && !e.machine) { p.clicks++; if (!p.opens) p.opens = 1; }
    if (e.type === "bounce") p.bounced = true;
    if (e.type === "unsubscribe") p.unsubscribed = true;
    if (e.type === "complaint") p.complained = true;
    if (!p.last_at || e.at > p.last_at) p.last_at = e.at;
  }
  const all = [...people.values()].filter((p) => p.sent);
  const by = {
    all: () => true, opened: (p) => p.opens > 0, clicked: (p) => p.clicks > 0, not_opened: (p) => !p.opens && !p.bounced,
    bounced: (p) => p.bounced || p.complained, unsubscribed: (p) => p.unsubscribed,
  }[filter] || (() => true);
  const rows = all.filter(by).sort((a, b) => (b.clicks - a.clicks) || (b.opens - a.opens) || String(b.last_at).localeCompare(String(a.last_at)));
  await db.EmailCampaign.update(camp.id, { stats, stats_at: nowIso() }).catch(() => null);
  return { stats, timeline: hours, people: rows.slice(skip, skip + 50).map(({ rid: _r, ...p }) => p), people_total: rows.length };
}

function campaignRow(c) {
  return {
    ...pick(c, ["id", "name", "subject", "status", "total", "sent_count", "failed_count", "skipped_count", "send_at", "send_local", "send_tz", "tz_mode", "created_at", "created_date", "finished_at", "started_at", "audience", "last_error", "dry_run", "kind"]),
    stats: c.stats ? pick(c.stats, ["open_rate", "click_rate", "unique_opens", "unique_clicks", "delivered"]) : null,
  };
}

function cleanSteps(steps, theme) {
  return (Array.isArray(steps) ? steps : []).slice(0, 12).map((s) => {
    const id = /^[a-z0-9]{3,40}$/i.test(String(s?.id || "")) ? String(s.id) : `s${Math.random().toString(36).slice(2, 9)}`;
    if (s?.type === "wait") return { id, type: "wait", wait_value: Math.max(1, Math.min(365, Number(s.wait_value) || 1)), wait_unit: s.wait_unit === "hours" ? "hours" : "days" };
    const blocks = normalizeClientBlocks(s?.blocks);
    const subject = str(s?.subject, 200);
    return { id, type: "email", subject, blocks, links: core.extractLinks(renderClientEmail({ subject, blocks }, theme)) };
  });
}

function cleanTrigger(t) {
  const type = ["list_join", "event", "inactive", "date_field"].includes(t?.type) ? t.type : "list_join";
  if (type === "list_join") return { type, list_id: str(t.list_id, 64) };
  if (type === "event") return { type, event_name: str(t.event_name, 60).toLowerCase().replace(/[^a-z0-9_.-]/g, "") || "job.completed" };
  if (type === "inactive") return { type, months: Math.max(1, Math.min(36, Number(t.months) || 6)), send_hour: Math.max(0, Math.min(23, Number(t.send_hour ?? 10))) };
  return { type, field: t.field === "anniversary" ? "anniversary" : "birthday", send_hour: Math.max(0, Math.min(23, Number(t.send_hour ?? 9))) };
}

async function stepStats(db, a) {
  const events = await pagedEvents(db, { automation_id: a.id }, 20000);
  const enr = (await db.EmailEnrollment.filter({ automation_id: a.id }, "-created_date", 20000).catch(() => [])) || [];
  const out = {};
  for (const s of a.steps || []) {
    if (s.type !== "email") continue;
    const sent = enr.reduce((n, e) => n + (e.history || []).filter((h) => h.step_id === s.id && String(h.result).startsWith("sent")).length, 0);
    out[s.id] = summarize(events.filter((e) => e.step_id === s.id), sent);
  }
  const counts = { active: 0, done: 0, exited: 0, failed: 0 };
  for (const e of enr) counts[e.status] = (counts[e.status] || 0) + 1;
  return { steps: out, enrollments: counts, recent: enr.slice(0, 25).map((e) => pick(e, ["id", "email", "status", "step_index", "next_run_at", "started_at", "finished_at", "exit_reason", "history"])) };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return err("Not signed in", 401);
    const gate = await requireSecondFactor(base44, req, user);
    if (gate) return gate;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "overview");
    const db = base44.asServiceRole.entities;
    const isAdmin = user.role === "admin";
    const client = await resolveClient(db, user, body?.client_id);
    if (!client) return err(isAdmin ? "Pick a client" : "No portal is set up for this login yet.", isAdmin ? 400 : 403, { code: "no_client" });
    const dry = S.isDryRun(client);
    if (!isAdmin && !(planUnlocksStudios(client) || dry)) return err("Email Studio is included with HyperCare+. Ask us about upgrading from your portal.", 403, { code: "studios_locked" });
    if (!isAdmin && studioState(client, "email") !== "on") return err("Email Studio isn't switched on for your account yet.", 403, { code: "studio_off" });
    const cid = String(client.id);
    const own = (row) => row && row.client_id === cid;
    const settings = await S.loadSettings(db, client);

    /* ---------- overview ---------- */
    if (action === "overview") {
      const [contacts, lists, segments, forms, autos, camps] = await Promise.all([
        S.allContacts(db, cid, ["id", "status", "list_ids"]),
        db.EmailContactList.filter({ client_id: cid }, "name", 200).catch(() => []),
        db.EmailSegment.filter({ client_id: cid }, "name", 200).catch(() => []),
        db.EmailSignupForm.filter({ client_id: cid }, "-created_date", 100).catch(() => []),
        db.EmailAutomation.filter({ client_id: cid }, "-created_date", 100).catch(() => []),
        db.EmailCampaign.filter({ client_id: cid }, "-created_date", 100).catch(() => []),
      ]);
      const counts = { total: contacts.length, subscribed: 0, unsubscribed: 0, pending: 0, cleaned: 0 };
      const perList = {};
      for (const c of contacts) { counts[c.status] = (counts[c.status] || 0) + 1; for (const l of c.list_ids || []) perList[l] = perList[l] || { total: 0, subscribed: 0 }, perList[l].total++, c.status === "subscribed" && perList[l].subscribed++; }
      const base = await S.baseUrl(db);
      const theme = await S.loadTheme(db, client, settings);
      const secretName = settings.trigger_secret_name || core.triggerSecretName(client.business, cid);
      return Response.json({
        client: { id: cid, business: client.business },
        readiness: S.readiness(client, settings), dry_run: dry, max_list: MAX_FREE_LIST_SIZE,
        settings: { ...pick(settings, ["physical_address", "timezone", "review_link", "from_name", "reply_to", "footer_note", "brand", "default_list_id"]), ...(isAdmin ? { trigger_secret_name: secretName } : {}), trigger_configured: hasSecret(secretName), is_admin: isAdmin },
        theme, counts,
        lists: lists.map((l) => ({ ...pick(l, ["id", "name", "description", "created_at", "created_date"]), count: perList[l.id]?.total || 0, subscribed: perList[l.id]?.subscribed || 0 })),
        segments: segments.map((s) => pick(s, ["id", "name", "match", "rules", "last_count", "last_counted_at"])),
        forms: forms.map((f) => ({ ...pick(f, ["id", "name", "list_id", "tags", "double_opt_in", "fields", "heading", "intro", "button_label", "consent_text", "success_message", "redirect_url", "form_key", "status", "submissions", "confirmations", "last_submission_at"]), url: `${base}/functions/email-signup?f=${f.form_key}` })),
        automations: autos.map((a) => pick(a, ["id", "name", "kind", "trigger", "steps", "status", "enrolled_count", "completed_count", "reenroll_days", "activated_at", "paused_at"])),
        campaigns: camps.map(campaignRow),
        endpoints: { signup: `${base}/functions/email-signup`, hook: `${base}/functions/email-hook?c=${cid}` },
      });
    }

    /* ---------- settings ---------- */
    if (action === "settings_save") {
      const p = body?.settings || {};
      const patch = {};
      if (p.physical_address !== undefined) patch.physical_address = str(p.physical_address, 300);
      if (p.timezone !== undefined && core.validTz(p.timezone)) patch.timezone = p.timezone;
      if (p.review_link !== undefined) patch.review_link = /^https:\/\//.test(String(p.review_link)) ? str(p.review_link, 500) : "";
      if (p.from_name !== undefined) patch.from_name = str(p.from_name, 120);
      if (p.reply_to !== undefined) patch.reply_to = core.isEmail(p.reply_to) ? normEmail(p.reply_to) : "";
      if (p.footer_note !== undefined) patch.footer_note = str(p.footer_note, 300);
      if (p.default_list_id !== undefined) patch.default_list_id = str(p.default_list_id, 64);
      if (p.brand && typeof p.brand === "object") {
        const b = {};
        for (const k of ["primary", "accent", "text", "background"]) if (/^#[0-9a-f]{6}$/i.test(String(p.brand[k] || ""))) b[k] = p.brand[k];
        if (/^https:\/\//.test(String(p.brand.logo_url || ""))) b.logo_url = str(p.brand.logo_url, 500);
        if (p.brand.font) b.font = str(p.brand.font, 40);
        patch.brand = b;
      }
      if (isAdmin && p.trigger_secret_name !== undefined && /^[A-Z][A-Z0-9_]{2,80}$/.test(String(p.trigger_secret_name))) patch.trigger_secret_name = p.trigger_secret_name;
      const saved = await db.EmailStudioSettings.update(settings.id, patch);
      return Response.json({ ok: true, settings: pick(saved, ["physical_address", "timezone", "review_link", "from_name", "reply_to", "footer_note", "brand", "default_list_id", ...(isAdmin ? ["trigger_secret_name"] : [])]), readiness: S.readiness(client, saved), theme: await S.loadTheme(db, client, saved) });
    }

    /* ---------- lists ---------- */
    if (action === "list_save") {
      const name = str(body?.name, 80);
      if (!name) return err("Give the list a name");
      if (body?.id) {
        const l = await db.EmailContactList.get(String(body.id)).catch(() => null);
        if (!own(l)) return err("List not found", 404);
        return Response.json({ list: await db.EmailContactList.update(l.id, { name, description: str(body?.description, 300) }) });
      }
      return Response.json({ list: await db.EmailContactList.create({ client_id: cid, name, description: str(body?.description, 300), created_at: nowIso(), contact_count: 0, test: dry }) });
    }

    /* ---------- contacts ---------- */
    if (action === "contacts") {
      let rows = await S.allContacts(db, cid);
      const q = str(body?.q, 120).toLowerCase();
      if (body?.list_id) rows = rows.filter((c) => (c.list_ids || []).includes(String(body.list_id)));
      if (body?.status) rows = rows.filter((c) => c.status === body.status);
      if (body?.tag) rows = rows.filter((c) => (c.tags || []).includes(String(body.tag).toLowerCase()));
      if (body?.segment_id) {
        const seg = await db.EmailSegment.get(String(body.segment_id)).catch(() => null);
        if (own(seg)) rows = rows.filter((c) => core.matchSegment(c, seg));
      }
      if (q) rows = rows.filter((c) => `${c.email} ${c.name || ""} ${c.first_name || ""} ${c.last_name || ""} ${c.city || ""} ${(c.tags || []).join(" ")}`.toLowerCase().includes(q));
      rows.sort((a, b) => String(b.created_at || b.created_date).localeCompare(String(a.created_at || a.created_date)));
      const skip = Math.max(0, Number(body?.skip) || 0), limit = Math.min(200, Number(body?.limit) || 50);
      const tags = [...new Set((await S.allContacts(db, cid, ["tags"])).flatMap((c) => c.tags || []))].sort().slice(0, 200);
      return Response.json({ total: rows.length, contacts: rows.slice(skip, skip + limit).map((c) => pick(c, ["id", "email", "name", "first_name", "last_name", "status", "list_ids", "tags", "city", "state", "source", "created_at", "created_date", "last_opened_at", "last_clicked_at", "last_sent_at", "test"])), tags });
    }
    if (action === "contact_get") {
      const c = await db.EmailContact.get(String(body?.id || "")).catch(() => null);
      if (!own(c)) return err("Contact not found", 404);
      const events = ((await db.EmailEvent.filter({ contact_id: c.id }, "-at", 100).catch(() => [])) || []);
      const campIds = [...new Set(events.map((e) => e.campaign_id).filter(Boolean))];
      const names = {};
      for (const id of campIds.slice(0, 30)) { const k = await db.EmailCampaign.get(id).catch(() => null); if (k) names[id] = k.name || k.subject; }
      const enr = ((await db.EmailEnrollment.filter({ contact_id: c.id }, "-created_date", 30).catch(() => [])) || []);
      const sup = ((await db.EmailSuppression.filter({ client_id: cid, email: c.email }, "-created_date", 5).catch(() => [])) || []);
      return Response.json({ contact: c, suppressed: sup.map((s) => ({ reason: s.reason, at: s.created_at || s.created_date })), activity: events.map((e) => ({ type: e.type, at: e.at, url: e.url, campaign: names[e.campaign_id] || "", automation_id: e.automation_id, machine: e.machine })), enrollments: enr.map((e) => pick(e, ["automation_id", "status", "step_index", "started_at", "finished_at"])) });
    }
    if (action === "contact_save") {
      const d = body?.contact || {};
      const email = normEmail(d.email);
      if (!core.isEmail(email)) return err("Enter a valid email address");
      const lists = (Array.isArray(body?.list_ids) ? body.list_ids : []).map(String);
      const owned = new Set(((await db.EmailContactList.filter({ client_id: cid }, "name", 200).catch(() => [])) || []).map((l) => l.id));
      const okLists = lists.filter((l) => owned.has(l));
      const existing = body?.id ? await db.EmailContact.get(String(body.id)).catch(() => null) : await S.findContact(db, cid, email);
      if (body?.id && !own(existing)) return err("Contact not found", 404);
      if (!existing) {
        const basis = String(body?.consent?.basis || "");
        if (!core.CONSENT_BASES[basis] || basis === "double_opt_in" || !str(body?.consent?.source)) return err("Say how this person agreed to get emails (consent is required).", 400, { code: "consent_required" });
      }
      const data = { email, ...pick(d, ["first_name", "last_name", "name", "phone", "city", "state", "zip", "country"]), timezone: core.validTz(d.timezone) ? d.timezone : "", birthday: core.normDate(d.birthday, true), anniversary: core.normDate(d.anniversary), tags: core.normTags(d.tags), fields: d.fields && typeof d.fields === "object" ? Object.fromEntries(Object.entries(d.fields).slice(0, 30).filter(([k]) => /^[a-z0-9_]{1,40}$/.test(k)).map(([k, v]) => [k, str(v, 300)])) : undefined };
      const sup = await db.EmailSuppression.filter({ client_id: cid, email }, "-created_date", 5).catch(() => []);
      const up = await S.upsertContact(db, cid, data, {
        existing, lists: okLists, overwrite: true, source: "manual", source_detail: `Added by ${user.email}`, test: dry,
        status: (sup || []).some((s) => ["bounce", "complaint"].includes(s.reason)) ? "cleaned" : (sup || []).length ? "unsubscribed" : "subscribed",
        consent: existing ? existing.consent : { basis: body.consent.basis, source: str(body.consent.source, 200), at: nowIso(), by: user.email },
      });
      if (up.error) return err("Enter a valid email address");
      // List membership can also be removed when editing.
      if (existing && Array.isArray(body?.list_ids)) await db.EmailContact.update(existing.id, { list_ids: okLists, tags: data.tags });
      let enrolled = 0;
      if (body?.start_automations) for (const l of up.lists_added || []) enrolled += await S.enroll(db, client, up.contact, { type: "list_join", list_id: l });
      return Response.json({ ok: true, contact: up.contact, created: up.created, enrolled });
    }
    if (action === "contact_unsubscribe") {
      const c = await db.EmailContact.get(String(body?.id || "")).catch(() => null);
      if (!own(c)) return err("Contact not found", 404);
      await db.EmailContact.update(c.id, { status: "unsubscribed", unsubscribed_at: nowIso() });
      const have = await db.EmailSuppression.filter({ client_id: cid, email: c.email }, "-created_date", 1).catch(() => []);
      if (!have?.length) await db.EmailSuppression.create({ client_id: cid, email: c.email, reason: "manual", detail: `Unsubscribed by ${user.email}`, created_at: nowIso() });
      return Response.json({ ok: true });
    }

    /* ---------- import ---------- */
    if (action === "import_check") {
      const emails = (Array.isArray(body?.emails) ? body.emails : []).slice(0, MAX_FREE_LIST_SIZE + 1000).map(normEmail);
      const have = new Map((await S.allContacts(db, cid, ["id", "email", "status"])).map((c) => [normEmail(c.email), c.status]));
      const sup = await S.suppressedSet(db, cid);
      let existing = 0, suppressed = 0, unsubscribed = 0;
      for (const e of new Set(emails)) {
        if (sup.has(e)) suppressed++;
        else if (have.has(e) && have.get(e) !== "subscribed") unsubscribed++;
        else if (have.has(e)) existing++;
      }
      return Response.json({ existing, suppressed, unsubscribed, current_total: have.size, max: MAX_FREE_LIST_SIZE });
    }
    if (action === "import") {
      const consent = body?.consent || {};
      if (!["express", "existing_customer"].includes(consent.basis) || !str(consent.source) || consent.confirm !== true) return err("Confirm how these people agreed to get your emails before importing.", 400, { code: "consent_required" });
      const mapping = body?.mapping || {};
      if (!(Number(mapping.email) >= 0)) return err("Pick which column holds the email address.");
      const rows = (Array.isArray(body?.rows) ? body.rows : []).slice(0, 500);
      const listId = str(body?.list_id, 64);
      if (listId) { const l = await db.EmailContactList.get(listId).catch(() => null); if (!own(l)) return err("List not found", 404); }
      const existingRows = await S.allContacts(db, cid, ["id", "email", "status", "list_ids", "tags", "first_name", "last_name", "name", "phone", "city", "state", "zip", "country", "timezone", "birthday", "anniversary", "fields"]);
      if (existingRows.length + rows.length > MAX_FREE_LIST_SIZE + 500) return err(`Lists over ${MAX_FREE_LIST_SIZE.toLocaleString("en-US")} contacts aren't included. Talk to Interstellar about larger lists.`, 400, { code: "list_too_large" });
      const have = new Map(existingRows.map((c) => [normEmail(c.email), c]));
      const sup = await S.suppressedSet(db, cid);
      const seen = new Set((Array.isArray(body?.seen) ? body.seen : []).map(normEmail));
      const res = { created: 0, updated: 0, unchanged: 0, invalid: 0, duplicates: 0, suppressed: 0, kept_unsubscribed: 0, enrolled: 0, errors: [] };
      const tags = core.normTags(body?.tags);
      const at = nowIso();
      const cons = { basis: consent.basis, source: str(consent.source, 200), at, by: user.email, text: `Imported by ${user.email}${body?.file_name ? ` from ${str(body.file_name, 120)}` : ""}` };
      const toCreate = [];
      for (const cells of rows) {
        const c = core.rowToContact(Array.isArray(cells) ? cells : [], mapping, body?.custom || {});
        if (c.error) { res.invalid++; if (res.errors.length < 20) res.errors.push({ email: c.email || "", error: "Not a valid email" }); continue; }
        if (seen.has(c.email)) { res.duplicates++; continue; }
        seen.add(c.email);
        const s = sup.get(c.email);
        const ex = have.get(c.email);
        if (ex) {
          if (!body?.update_existing && !listId && !tags.length) { res.unchanged++; continue; }
          const up = await S.upsertContact(db, cid, { ...c, tags: [...(c.tags || []), ...tags] }, { existing: ex, lists: listId ? [listId] : [], overwrite: !!body?.update_existing });
          if (ex.status !== "subscribed") res.kept_unsubscribed++;
          res.updated++;
          if (body?.start_automations && ex.status === "subscribed") for (const l of up.lists_added || []) res.enrolled += await S.enroll(db, client, up.contact, { type: "list_join", list_id: l });
          continue;
        }
        if (s) res.suppressed++;
        toCreate.push({
          client_id: cid, email: c.email, ...pick(c, ["first_name", "last_name", "name", "phone", "city", "state", "zip", "country", "timezone", "birthday", "anniversary"]),
          list_ids: listId ? [listId] : [], tags: core.normTags([...(c.tags || []), ...tags]), fields: c.fields || {},
          status: s ? (s === "bounce" || s === "complaint" ? "cleaned" : "unsubscribed") : "subscribed",
          source: "import", source_detail: str(body?.file_name, 120), consent: cons, created_at: at, sent_count: 0, open_count: 0, click_count: 0, test: dry,
        });
      }
      for (let i = 0; i < toCreate.length; i += 100) {
        const chunk = toCreate.slice(i, i + 100);
        let made = await db.EmailContact.bulkCreate(chunk).catch(() => null);
        if (!made) { made = []; for (const r of chunk) { const x = await db.EmailContact.create(r).catch(() => null); if (x) made.push(x); } }
        res.created += Array.isArray(made) ? made.length : chunk.length;
        if (body?.start_automations && listId) for (const m of Array.isArray(made) ? made : []) if (m.status === "subscribed") res.enrolled += await S.enroll(db, client, m, { type: "list_join", list_id: listId });
      }
      return Response.json({ ok: true, ...res, seen: [...seen] });
    }

    /* ---------- segments ---------- */
    if (action === "segment_count" || action === "segment_save") {
      const seg = { match: body?.match === "any" ? "any" : "all", rules: core.cleanRules(body?.rules) };
      const contacts = await S.allContacts(db, cid);
      const sup = await S.suppressedSet(db, cid);
      const matched = contacts.filter((c) => core.matchSegment(c, seg));
      const sendable = matched.filter((c) => c.status === "subscribed" && !sup.has(normEmail(c.email)));
      if (action === "segment_count") return Response.json({ count: matched.length, sendable: sendable.length, sample: sendable.slice(0, 5).map((c) => ({ email: c.email, name: c.name || c.first_name || "" })) });
      const name = str(body?.name, 80);
      if (!name) return err("Give the segment a name");
      const row = { ...seg, name, last_count: sendable.length, last_counted_at: nowIso() };
      if (body?.id) {
        const s = await db.EmailSegment.get(String(body.id)).catch(() => null);
        if (!own(s)) return err("Segment not found", 404);
        return Response.json({ segment: await db.EmailSegment.update(s.id, row) });
      }
      return Response.json({ segment: await db.EmailSegment.create({ client_id: cid, ...row, test: dry }) });
    }
    if (action === "segment_delete") {
      const s = await db.EmailSegment.get(String(body?.id || "")).catch(() => null);
      if (!own(s)) return err("Segment not found", 404);
      await db.EmailSegment.delete(s.id);
      return Response.json({ ok: true });
    }
    if (action === "audience_count") {
      const r = await S.resolveAudience(db, cid, body?.audience || {});
      return Response.json({ counts: r.counts, error: r.error || "", sample: r.recipients.slice(0, 5).map((x) => x.email) });
    }

    /* ---------- campaigns ---------- */
    const getCamp = async () => { const c = await db.EmailCampaign.get(String(body?.id || "")).catch(() => null); return own(c) ? c : null; };
    if (action === "campaign_save") {
      const patch = { name: str(body?.name, 160), subject: str(body?.subject, 250), blocks: normalizeClientBlocks(body?.blocks), audience: { list_ids: (body?.audience?.list_ids || []).map(String).slice(0, 20), segment_id: str(body?.audience?.segment_id, 64), exclude_segment_id: str(body?.audience?.exclude_segment_id, 64) }, updated_by: user.email };
      if (body?.id) {
        const c = await getCamp();
        if (!c) return err("Campaign not found", 404);
        if (!["draft", "scheduled"].includes(c.status)) return err("This campaign was already sent. Duplicate it to send again.");
        if (c.status === "scheduled") return err("Cancel the schedule before editing.", 409, { code: "scheduled" });
        return Response.json({ campaign: await db.EmailCampaign.update(c.id, patch) });
      }
      return Response.json({ campaign: await db.EmailCampaign.create({ client_id: cid, client_name: client.business, kind: "campaign", status: "draft", ...patch, subject: patch.subject || "Untitled email", created_by: user.email, by_admin: isAdmin, created_at: nowIso(), total: 0, sent_count: 0, failed_count: 0, skipped_count: 0, test: dry }) });
    }
    if (action === "campaign_get") {
      const c = await getCamp();
      if (!c) return err("Campaign not found", 404);
      return Response.json({ campaign: { ...campaignRow(c), blocks: c.blocks || [], links: c.links || [] } });
    }
    if (action === "campaign_duplicate") {
      const c = await getCamp();
      if (!c) return err("Campaign not found", 404);
      return Response.json({ campaign: await db.EmailCampaign.create({ client_id: cid, client_name: client.business, kind: "campaign", status: "draft", name: `${c.name || c.subject} (copy)`.slice(0, 160), subject: c.subject, blocks: c.blocks || [], audience: c.audience || {}, created_by: user.email, by_admin: isAdmin, created_at: nowIso(), total: 0, sent_count: 0, failed_count: 0, skipped_count: 0, test: dry }) });
    }
    if (action === "campaign_delete") {
      const c = await getCamp();
      if (!c) return err("Campaign not found", 404);
      if (c.status !== "draft") return err("Only drafts can be deleted.");
      await db.EmailCampaign.delete(c.id);
      return Response.json({ ok: true });
    }
    if (action === "campaign_send_test") {
      const c = await getCamp();
      if (!c) return err("Campaign not found", 404);
      if (!settings.physical_address) return err("Add your mailing address in Settings first (it goes in every email footer).", 400, { code: "no_address" });
      const { html, text } = await S.renderCampaign(db, client, settings, c);
      const to = normEmail(user.email);
      const vars = core.recipientVars({ email: to, first_name: String(user.full_name || "").split(/\s+/)[0] || "there", name: user.full_name || "" }, { business: client.business, review_link: settings.review_link, unsubscribe_url: `${await S.baseUrl(db)}/functions/email-unsubscribe` });
      const subject = `[TEST] ${core.personalize(c.subject, vars, false)}`;
      const body = core.personalize(html, vars, true);
      const ready = S.readiness(client, settings);
      if (ready.ready && !dry) {
        await S.deliver(client, { from: client.ses_from_email, fromName: settings.from_name || client.business, to, subject, html: body, text: core.personalize(text, vars, false), tags: { client_id: cid, campaign_id: c.id, test: "1" } });
      } else {
        // Sending domain not live yet (or test mode): the test goes through the app's own mail service instead.
        await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body, from_name: str(settings.from_name || client.business, 60) });
      }
      return Response.json({ ok: true, to, via: ready.ready && !dry ? "your sending domain" : "Interstellar test mail" });
    }
    if (action === "campaign_schedule") {
      const c = await getCamp();
      if (!c) return err("Campaign not found", 404);
      if (c.status !== "draft") return err("This campaign isn't a draft any more.");
      if (!str(c.subject)) return err("Add a subject line first");
      if (!normalizeClientBlocks(c.blocks).length) return err("The email is empty");
      const ready = S.readiness(client, settings);
      if (!ready.ready) return err(ready.reason, ready.code === "ses_not_configured" ? 503 : 400, { code: ready.code });
      const when = body?.when === "schedule" ? "schedule" : "now";
      if (when === "schedule") {
        const at = core.zonedToUtc(body?.send_local, core.validTz(body?.send_tz) ? body.send_tz : settings.timezone);
        if (!at) return err("Pick a date and time");
        if (at.getTime() < Date.now() - 60_000 && body?.tz_mode !== "subscriber") return err("That time has already passed.");
        if (at.getTime() > Date.now() + 366 * 864e5) return err("Schedule within the next year.");
      }
      const aud = await S.resolveAudience(db, cid, c.audience || {});
      if (aud.error) return err(aud.error);
      if (!aud.recipients.length) return err("No one to send to: everyone in this audience is unsubscribed, pending or on the do-not-send list.");
      if (aud.recipients.length > MAX_FREE_LIST_SIZE) return err(`Sends over ${MAX_FREE_LIST_SIZE.toLocaleString("en-US")} contacts aren't included.`, 400, { code: "list_too_large" });
      const out = await S.queueCampaign(db, client, settings, c, aud.recipients, { when, send_local: body?.send_local, send_tz: body?.send_tz || settings.timezone, tz_mode: body?.tz_mode, user, isAdmin });
      if (out.error) return err(out.error, 429, { code: out.code });
      let run = null;
      if (when === "now" && !out.paused) run = await S.drain(db, { onlyCampaign: c.id, budgetMs: 25_000 }).catch((e) => ({ error: e?.message }));
      const fresh = await db.EmailCampaign.get(c.id).catch(() => out.campaign);
      return Response.json({ ok: true, status: fresh.status, paused: out.paused, message: out.message, plan: out.plan, campaign: campaignRow(fresh), run: run ? pick(run, ["sent", "failed"]) : null });
    }
    if (action === "campaign_cancel") {
      const c = await getCamp();
      if (!c) return err("Campaign not found", 404);
      if (!["scheduled", "paused", "queued"].includes(c.status) || (Number(c.sent_count) || 0) > 0) return err("This campaign has started sending and can't be cancelled.");
      const saved = await S.cancelCampaign(db, c);
      // Back to a draft copy so it can be edited and scheduled again.
      const draft = await db.EmailCampaign.create({ client_id: cid, client_name: client.business, kind: "campaign", status: "draft", name: c.name, subject: c.subject, blocks: c.blocks || [], audience: c.audience || {}, created_by: user.email, by_admin: isAdmin, created_at: nowIso(), total: 0, sent_count: 0, failed_count: 0, skipped_count: 0, test: dry });
      return Response.json({ ok: true, campaign: campaignRow(saved), draft: campaignRow(draft) });
    }
    if (action === "campaign_reschedule") {
      const c = await getCamp();
      if (!c) return err("Campaign not found", 404);
      if (c.status !== "scheduled") return err("Only scheduled campaigns can be moved.");
      const at = core.zonedToUtc(body?.send_local, core.validTz(body?.send_tz) ? body.send_tz : c.send_tz);
      if (!at || (at.getTime() < Date.now() - 60_000 && c.tz_mode !== "subscriber")) return err("Pick a future date and time");
      const saved = await S.rescheduleCampaign(db, c, body.send_local, body?.send_tz || c.send_tz);
      return Response.json({ ok: true, campaign: campaignRow(saved) });
    }
    if (action === "campaign_results") {
      const c = await getCamp();
      if (!c) return err("Campaign not found", 404);
      const r = await campaignResults(db, c, { filter: String(body?.filter || "all"), skip: Math.max(0, Number(body?.skip) || 0) });
      return Response.json({ campaign: campaignRow({ ...c, stats: r.stats }), ...r });
    }

    /* ---------- AI first drafts (Base44 InvokeLLM) ---------- */
    if (action === "ai_draft") {
      const prompt = str(body?.prompt, 1500);
      if (!prompt) return err("Describe the email you want");
      const m = await check(db, client, "ai_action", 1, { admin: isAdmin, feature: "email.ai_draft" });
      if (!m.ok) return err(m.reason, 429, { code: m.code });
      const kit = await S.brandKitOf(db, cid);
      const brain = ((await db.BusinessBrain.filter({ client_id: cid }, "-updated_date", 1).catch(() => [])) || [])[0];
      const facts = [brain?.glance ? JSON.stringify(brain.glance).slice(0, 1500) : "", String(brain?.context_md || "").slice(0, 3500)].filter(Boolean).join("\n");
      const voice = kit ? [kit.overview, kit.voice ? JSON.stringify(kit.voice).slice(0, 800) : "", (kit.dos || []).slice(0, 8).join("; "), (kit.donts || []).slice(0, 8).join("; ")].filter(Boolean).join("\n") : "";
      const purpose = { review_request: "a review request sent after a job is finished (ask for a Google review, use {{review_link}} as the button link)", welcome: "a welcome email for someone who just joined the list", win_back: "a friendly win-back email for a customer we haven't seen in a while", birthday: "a short birthday email", anniversary: "a short customer-anniversary thank-you email" }[String(body?.purpose)] || "a marketing email";
      const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You write ${purpose} for ${client.business}, a small business. Write in the business's own voice, warm and plain, short sentences, no hype.
REQUEST: ${prompt}

BUSINESS FACTS (the only facts you may state):
${facts || "(none on file)"}

BRAND VOICE NOTES:
${voice || "(none on file)"}

RULES:
- Never invent prices, discounts, percentages, statistics, dates, guarantees, awards or customer quotes. If the email needs one that is not in the facts, write a clear placeholder in square brackets, e.g. [ADD PRICE] or [ADD OFFER END DATE].
- Start the first text block with "Hi {{first_name}}," on its own line.
- 3 to 6 blocks: usually heading, text, optional callout (the offer), button, short text sign-off from the team. Keep the whole email under 180 words.
- Button url: use {{review_link}} for review requests; otherwise a placeholder like [ADD LINK] if no URL is in the facts.
- Subject under 60 characters, no ALL CAPS, no emoji spam (one emoji max).
- Plain text only in every field; **bold** is allowed in text blocks. No HTML.`,
        response_json_schema: CLIENT_EMAIL_SCHEMA,
      });
      await record(db, client, "ai_action", 1, { admin: isAdmin, model: "base44-invokellm", feature: "email.ai_draft", user_email: user.email });
      const blocks = normalizeClientBlocks((llm?.blocks || []).map((b) => ({ ...b, url: b.url && /^\[|^\{\{/.test(b.url) ? (/^\{\{/.test(b.url) ? b.url : "") : b.url })));
      return Response.json({ subject: str(llm?.subject, 200), blocks });
    }

    /* ---------- sign-up forms ---------- */
    if (action === "form_save") {
      const f = body?.form || {};
      const listId = str(f.list_id, 64);
      if (listId) { const l = await db.EmailContactList.get(listId).catch(() => null); if (!own(l)) return err("List not found", 404); }
      else return err("Pick the list sign-ups go to");
      const row = {
        name: str(f.name, 80) || "Sign-up form", list_id: listId, tags: core.normTags(f.tags), double_opt_in: f.double_opt_in !== false,
        fields: (Array.isArray(f.fields) ? f.fields : []).filter((x) => ["first_name", "last_name", "phone", "birthday", "zip"].includes(x)),
        heading: str(f.heading, 120), intro: str(f.intro, 400), button_label: str(f.button_label, 40), consent_text: str(f.consent_text, 300), success_message: str(f.success_message, 300),
        redirect_url: /^https:\/\//.test(String(f.redirect_url || "")) ? str(f.redirect_url, 500) : "", status: f.status === "paused" ? "paused" : "active",
      };
      if (body?.id) {
        const x = await db.EmailSignupForm.get(String(body.id)).catch(() => null);
        if (!own(x)) return err("Form not found", 404);
        return Response.json({ form: await db.EmailSignupForm.update(x.id, row) });
      }
      return Response.json({ form: await db.EmailSignupForm.create({ client_id: cid, ...row, form_key: randKey(), submissions: 0, confirmations: 0, test: dry }) });
    }
    if (action === "form_delete") {
      const x = await db.EmailSignupForm.get(String(body?.id || "")).catch(() => null);
      if (!own(x)) return err("Form not found", 404);
      await db.EmailSignupForm.update(x.id, { status: "paused" });
      return Response.json({ ok: true });
    }

    /* ---------- automations ---------- */
    if (action === "automation_save") {
      const a = body?.automation || {};
      const theme = await S.loadTheme(db, client, settings);
      const row = { name: str(a.name, 100) || "Automation", kind: str(a.kind, 30) || "custom", trigger: cleanTrigger(a.trigger || {}), steps: cleanSteps(a.steps, theme), reenroll_days: Math.max(0, Math.min(3650, Number(a.reenroll_days) || 0)) };
      if (row.trigger.type === "list_join" && row.trigger.list_id) { const l = await db.EmailContactList.get(row.trigger.list_id).catch(() => null); if (!own(l)) return err("List not found", 404); }
      if (body?.id) {
        const x = await db.EmailAutomation.get(String(body.id)).catch(() => null);
        if (!own(x)) return err("Automation not found", 404);
        return Response.json({ automation: await db.EmailAutomation.update(x.id, row) });
      }
      return Response.json({ automation: await db.EmailAutomation.create({ client_id: cid, ...row, status: "draft", enrolled_count: 0, completed_count: 0, test: dry }) });
    }
    if (action === "automation_get") {
      const x = await db.EmailAutomation.get(String(body?.id || "")).catch(() => null);
      if (!own(x)) return err("Automation not found", 404);
      return Response.json({ automation: x, ...(await stepStats(db, x)) });
    }
    if (action === "automation_status") {
      const x = await db.EmailAutomation.get(String(body?.id || "")).catch(() => null);
      if (!own(x)) return err("Automation not found", 404);
      const status = ["active", "paused", "draft"].includes(body?.status) ? body.status : "paused";
      if (status === "active") {
        if (!(x.steps || []).some((s) => s.type === "email" && s.subject && (s.blocks || []).length)) return err("Add at least one email step with a subject first.");
        const ready = S.readiness(client, settings);
        if (!ready.ready && ready.code === "no_address") return err(ready.reason, 400, { code: ready.code });
      }
      const saved = await db.EmailAutomation.update(x.id, { status, ...(status === "active" ? { activated_at: x.activated_at || nowIso(), paused_at: null } : status === "paused" ? { paused_at: nowIso() } : {}) });
      return Response.json({ automation: saved, readiness: S.readiness(client, settings) });
    }
    if (action === "automation_delete") {
      const x = await db.EmailAutomation.get(String(body?.id || "")).catch(() => null);
      if (!own(x)) return err("Automation not found", 404);
      if (x.status !== "draft" || (Number(x.enrolled_count) || 0) > 0) return err("Pause it instead: automations that have run are kept for their history.");
      await db.EmailAutomation.delete(x.id);
      return Response.json({ ok: true });
    }
    if (action === "trigger_test") {
      if (!isAdmin && !dry) return err("Admins only", 403);
      const out = await S.ingestEvent(db, client, { ...body?.payload });
      return Response.json(out, { status: out.error ? out.status || 400 : 200 });
    }

    return err("Unknown action");
  } catch (e) {
    console.error("email-client", e?.message);
    return err(e?.message || "Something went wrong", 500);
  }
});
