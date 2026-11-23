// @ts-nocheck
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { staffOf, canWorkLead, forStaff, assignLead, clip, nowIso, noteDate, isEmail } from "../../shared/staff.ts";
import { seedTemplates, SEED_KEYS, matchTemplate, buildPreview, applyOverrides, presentationPack, nextAction, followUpDraft, presenterFor, routeLead, OUTCOMES, OUTCOME_BY_KEY, DIAL_OUTCOMES, DAILY_DIAL_TARGET, PAY_METHODS, INCENTIVE, heatOf, sheetOrder, prepCard } from "../../shared/leadEngine.js";
import { sweepLead, followUpRules } from "../../shared/leadFollowups.ts";
import { runScrape } from "../../shared/leadScrape.ts";
import { moveStage, stageOf } from "../../shared/leadStage.ts";
import { inviteSettings, normEmail } from "../../shared/portalInvite.ts";
import { sendBrandedEmail } from "../../shared/onboardingEmail.ts";
import { leadInviteEmail, leadSettings, optOutUrl, verifyOptOut, optOutPage } from "../../shared/leadInvite.ts";
import { leadHome } from "../../shared/leadPortal.ts";

/*
 * Lead Engine: templates, lead previews, presentation packs, agents, the Lead Desk and the lead-tier portal invite.
 * Admins see everything; sales reps (SalesRep rows) only their own leads (assigned to them or built by them).
 * Nothing here emails, texts or invites anyone except invite_send, which needs a person's click (confirm: true)
 * and refuses do-not-contact / opted-out leads and a missing postal address.
 * Public: GET/POST ?optout=<signed token> (one-click opt-out from the invite email).
 */

const err = (error: string, status = 400, extra = {}) => Response.json({ error, ...extra }, { status });
const arr = (v: any) => (Array.isArray(v) ? v : []);

async function templatesOf(db: any) {
  const rows = ((await db.IndustryTemplate.filter({ archived: { $ne: true } }, "name", 100).catch(() => [])) || []) as any[];
  return { rows, list: rows.length ? rows : seedTemplates(), seeded: rows.length > 0 };
}
async function previewOf(db: any, clientId: string) {
  return (((await db.LeadPreview.filter({ client_id: clientId }, "-updated_date", 1).catch(() => [])) || []) as any[])[0] || null;
}
const logEntry = (by: string, action: string, version: number, note = "") => ({ at: nowIso(), by, action, version, note: String(note).slice(0, 300) });
const audit = (db: any, actor: string, action: string, record: any, summary: string) => db.AgentAuditLog.create({ at: nowIso(), ok: true, actor, action, entity: "LeadPreview", record_id: record?.id || "", summary }).catch(() => null);

// Build queue worker: approved leads → scrape → template preview → Ready, under the daily cap, 2 per run, with
// backoff (15 min × 2^attempts, 3 tries). If research keeps failing, the preview is still built from the Google data
// so calling is never blocked. Template-rendered: no app is created per lead.
async function queueRun(base44: any, db: any, by: string) {
  const ls = await leadSettings(db);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  let built = ls.queue_day === today ? ls.queue_today : 0;
  if (built >= ls.daily_cap) return { ran: 0, reason: `Daily cap of ${ls.daily_cap} reached`, built_today: built };
  const all = ((await db.CRMClient.filter({ status: "Lead" }, "-created_date", 1500).catch(() => [])) || []) as any[];
  const due = all.filter((c) => c.build_queue?.status === "queued" && Date.parse(c.build_queue.next_try_at || 0) <= Date.now() && !c.do_not_contact)
    .sort((a, b) => String(a.build_queue.approved_at || "").localeCompare(String(b.build_queue.approved_at || ""))).slice(0, Math.min(2, ls.daily_cap - built));
  const stuck = all.filter((c) => c.build_queue?.status === "building" && Date.now() - Date.parse(c.build_queue.started_at || 0) > 20 * 60000);
  for (const c of stuck) await db.CRMClient.update(c.id, { build_queue: { ...c.build_queue, status: "queued", reason: "Restarted after a stall", next_try_at: nowIso() } }).catch(() => null);
  const tpl = await templatesOf(db);
  const results: any[] = [];
  for (const c0 of due) {
    const q = { ...(c0.build_queue || {}) };
    await db.CRMClient.update(c0.id, { build_queue: { ...q, status: "building", started_at: nowIso() } });
    let c = c0, note = "";
    if (!c.scrape_summary) {
      const r = await runScrape(base44, c).catch((e: any) => ({ error: String(e?.message || e) }));
      if (r?.error) {
        const attempts = (Number(q.attempts) || 0) + 1;
        if (attempts < 3) {
          await db.CRMClient.update(c.id, { build_queue: { ...q, status: "queued", attempts, reason: `Research failed (${String(r.error).slice(0, 120)}); retrying`, next_try_at: new Date(Date.now() + 15 * 60000 * 2 ** attempts).toISOString() } });
          results.push({ id: c.id, business: c.business, status: "retry", reason: r.error });
          continue;
        }
        note = `Built from Google data only: research failed ${attempts} times (${String(r.error).slice(0, 100)})`;
      }
      c = await db.CRMClient.get(c.id);
    }
    try {
      const t = matchTemplate(tpl.list, { industry_key: c.industry_key, text: `${c.industry || ""} ${c.one_liner || ""} ${c.scrape_summary?.industry || ""}`, niche_key: c.niche_key });
      const builtP = buildPreview({ client: c, template: t, now: nowIso() });
      const prev = await previewOf(db, c.id);
      const overrides = prev?.website_overrides || {};
      const version = (Number(prev?.version) || 0) + 1;
      const data: any = { client_id: c.id, client_name: c.business, industry_key: t.industry_key, website_base: builtP.website_config, website_overrides: overrides, website_config: applyOverrides(builtP.website_config, overrides), command_config: builtP.command_config, missing: builtP.missing, built_at: nowIso(), built_by: "build queue", version, template_version: t.version || 1, status: prev && ["sent", "viewed"].includes(prev.status) ? prev.status : "ready", ready_at: nowIso(), build_log: [...arr(prev?.build_log), logEntry("build queue", prev ? "rebuild" : "build", version, `${t.name} template · auto Ready${note ? ` · ${note}` : ""}`)].slice(-40) };
      const row = prev ? await db.LeadPreview.update(prev.id, data) : await db.LeadPreview.create(data);
      await db.CRMClient.update(c.id, { industry_key: c.industry_key || t.industry_key, build_queue: { ...q, status: "ready", done_at: nowIso(), reason: note || "", attempts: Number(q.attempts) || 0 } });
      built++;
      results.push({ id: c.id, business: c.business, status: "ready", preview: row.id });
    } catch (e: any) {
      const attempts = (Number(q.attempts) || 0) + 1;
      await db.CRMClient.update(c.id, { build_queue: { ...q, status: attempts < 3 ? "queued" : "failed", attempts, reason: `Build error: ${String(e?.message || e).slice(0, 160)}`, next_try_at: new Date(Date.now() + 15 * 60000 * 2 ** attempts).toISOString() } });
      results.push({ id: c.id, business: c.business, status: "error", reason: String(e?.message || e) });
    }
  }
  if (results.length) {
    await saveQueueCount(db, ls, today, built);
    await db.AgentAuditLog.create({ at: nowIso(), ok: true, actor: by === "schedule" ? "automation:build-queue" : by, action: "build_queue_run", entity: "LeadPreview", record_id: "", summary: `Build queue: ${results.filter((r) => r.status === "ready").length} ready, ${results.filter((r) => r.status !== "ready").length} retrying · ${built}/${ls.daily_cap} today` }).catch(() => null);
  }
  return { ran: results.length, results, built_today: built, daily_cap: ls.daily_cap };
}
async function saveQueueCount(db: any, ls: any, day: string, count: number) {
  const row = ls.row;
  const ps = { ...(row?.pageSettings || {}), queue_day: day, queue_today: count };
  if (row) await db.AppSettings.update(row.id, { pageSettings: ps }).catch(() => null);
  else await db.AppSettings.create({ key: "lead_engine", pageSettings: ps }).catch(() => null);
}
async function followupsSweep(db: any) {
  const rules = await followUpRules(db);
  const [leads, previews] = await Promise.all([db.CRMClient.filter({ status: "Lead" }, "-updated_date", 800).catch(() => []), db.LeadPreview.list("-updated_date", 1500).catch(() => [])]);
  const pv = new Map(((previews || []) as any[]).map((p) => [p.client_id, p]));
  let n = 0;
  for (const c of (leads || []) as any[]) {
    const p = pv.get(c.id);
    if (!p || c.do_not_contact) continue;
    await sweepLead(db, c, { preview: p, rules }).catch(() => null);
    n++;
  }
  return { swept: n };
}

async function optOutHandler(req: Request, db: any, url: URL) {
  let tok = url.searchParams.get("optout") || "";
  if (req.method === "POST") { const f = await req.formData().catch(() => null); if (f) tok = String(f.get("optout") || tok); }
  const html = (s: string, status = 200) => new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
  const id = await verifyOptOut(tok);
  if (!id) return html(optOutPage("This link isn't valid", "Reply to the email you received and ask to be removed, and we'll take you off right away."), 400);
  const c = await db.CRMClient.get(id).catch(() => null);
  if (!c) return html(optOutPage("You're off the list", "We won't contact you again."));
  if (req.method !== "POST") {
    const esc = (s: string) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string));
    return html(optOutPage("Stop hearing from us?", `We'll stop contacting ${esc(c.business || "your business")} about the preview we built. No calls, no emails.`, `<form method="POST"><input type="hidden" name="optout" value="${esc(tok)}"><button type="submit">Opt out</button></form>`));
  }
  if (!c.do_not_contact || !c.email_opt_out) {
    await db.CRMClient.update(c.id, { email_opt_out: true, do_not_contact: true, dnc_reason: "Opted out from the invite email link", dnc_at: nowIso() });
    await db.LeadCallLog.create({ client_id: c.id, client_name: c.business, outcome: "do_not_contact", note: "Opted out with the email link", caller: "opt-out link", at: nowIso() }).catch(() => null);
  }
  return html(optOutPage("You're off the list", "Done. We won't call or email you about this again."));
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    if (url.searchParams.get("optout") || (req.method === "POST" && (req.headers.get("content-type") || "").includes("form"))) return await optOutHandler(req, db, url);

    const user = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    // Scheduled runs (no user): only work a person already approved (build queue) or tasks/drafts (follow-ups).
    if (!user && action === "queue_run") return Response.json(await queueRun(base44, db, "schedule"));
    if (!user && action === "followups_sweep") return Response.json(await followupsSweep(db));
    const staff = await staffOf(db, user);
    if (!staff) return err("Admins and sales reps only", 403);
    const admin = staff.kind === "admin";
    const lead = async () => {
      const c = await db.CRMClient.get(clip(body.client_id, 64)).catch(() => null);
      if (!c) throw Object.assign(new Error("Lead not found"), { status: 404 });
      if (!canWorkLead(staff, c)) throw Object.assign(new Error("This lead isn't assigned to you"), { status: 403 });
      return c;
    };

    /* ---------------- Templates ---------------- */
    if (action === "templates") {
      const { list, seeded } = await templatesOf(db);
      return Response.json({ templates: list, seeded, can_edit: admin, allowed: staff.rep?.allowed_industries || null, multi: !!staff.rep?.multi_industry_ready });
    }
    if (action === "templates_seed") {
      if (!admin) return err("Admins only", 403);
      const { rows } = await templatesOf(db);
      const have = new Set(rows.map((r: any) => r.industry_key));
      const add = seedTemplates().filter((t) => !have.has(t.industry_key));
      for (const t of add) await db.IndustryTemplate.create({ ...t, updated_by: "Claude (seed)" });
      return Response.json({ created: add.length, total: have.size + add.length, keys: SEED_KEYS });
    }
    if (action === "template_save") {
      if (!admin) return err("Admins only. Use Suggest to send a refinement.", 403);
      const t = await db.IndustryTemplate.get(clip(body.id, 64)).catch(() => null);
      if (!t) return err("Template not found", 404);
      const p = body.patch || {};
      const allowed = ["name", "category", "status", "places_query", "match_keywords", "website_template", "command_template", "reference_builds"];
      const patch: any = {};
      for (const k of allowed) if (p[k] !== undefined) patch[k] = p[k];
      if (patch.status && !["draft", "refining", "ready"].includes(patch.status)) delete patch.status;
      const changed = Object.keys(patch).filter((k) => JSON.stringify(patch[k]) !== JSON.stringify(t[k]));
      if (!changed.length && !clip(body.note)) return Response.json({ template: t, unchanged: true });
      const note = { at: nowIso(), author: staff.name, email: staff.email, kind: body.agent === true ? "agent" : "human", note: clip(body.note, 1000) || `Edited ${changed.join(", ")}`, fields: changed };
      const saved = await db.IndustryTemplate.update(t.id, { ...patch, version: (Number(t.version) || 1) + (changed.length ? 1 : 0), refinement_notes: [...arr(t.refinement_notes), note].slice(-200), updated_by: staff.email });
      return Response.json({ template: saved });
    }
    if (action === "template_suggest") {
      const t = await db.IndustryTemplate.get(clip(body.id, 64)).catch(() => null);
      if (!t) return err("Template not found (ask Justin to seed the library).", 404);
      const text = clip(body.note, 1500);
      if (text.length < 5) return err("Write the refinement you're suggesting.");
      const note = { at: nowIso(), author: staff.name, email: staff.email, kind: "suggestion", note: text, status: "open" };
      await db.IndustryTemplate.update(t.id, { refinement_notes: [...arr(t.refinement_notes), note].slice(-200) });
      return Response.json({ ok: true });
    }

    /* ---------------- Leads ---------------- */
    if (action === "leads") {
      const all = ((await db.CRMClient.filter({ status: "Lead" }, "-created_date", 1000).catch(() => [])) || []) as any[];
      const mine = admin ? all : all.filter((c) => canWorkLead(staff, c));
      const ids = new Set(mine.map((c) => c.id));
      const previews = ((await db.LeadPreview.list("-updated_date", 1000).catch(() => [])) || []).filter((p: any) => ids.has(p.client_id));
      const byClient = new Map(previews.map((p: any) => [p.client_id, p]));
      const reps = admin ? (((await db.SalesRep.list("name", 200).catch(() => [])) || []) as any[]).map((r) => ({ id: r.id, name: r.name, status: r.status, mode: r.mode })) : [];
      return Response.json({
        leads: mine.map((c) => {
          const p = byClient.get(c.id) || null;
          return { ...forStaff(staff, c), preview: p ? { id: p.id, status: p.status, version: p.version, built_at: p.built_at, engagement: p.engagement || null, industry_key: p.industry_key, has_pack: !!p.presentation } : null, next: nextAction(c, p) };
        }),
        reps, me: staff.kind === "sales" ? { id: staff.rep.id, name: staff.rep.name, mode: staff.rep.mode } : null,
      });
    }
    if (action === "lead") {
      const c = await lead();
      const [p, calls, tpl] = await Promise.all([previewOf(db, c.id), db.LeadCallLog.filter({ client_id: c.id }, "-at", 50).catch(() => []), templatesOf(db)]);
      const t = matchTemplate(tpl.list, { industry_key: c.industry_key, text: `${c.industry || ""} ${c.one_liner || ""} ${(c.scrape_summary?.gbp?.categories || []).join(" ")}`, niche_key: c.niche_key });
      const [tasks, portal, reps] = await Promise.all([db.LeadTask.filter({ client_id: c.id }, "-created_date", 20).catch(() => []), leadHome(db, c, { email: staff.email, full_name: staff.name, role: "admin" }).catch(() => null), admin ? db.SalesRep.list("name", 200).catch(() => []) : Promise.resolve([])]);
      return Response.json({ client: forStaff(staff, c), preview: p, calls: calls || [], tasks: tasks || [], portal, heat: heatOf(c, p), template: t ? { industry_key: t.industry_key, name: t.name, version: t.version } : null, templates: tpl.list.map((x: any) => ({ industry_key: x.industry_key, name: x.name })), next: nextAction(c, p), follow_up: followUpDraft(c.desk_outcome || "no_answer", { client: c, rep: staff.rep }), reps: (reps || []).map((r: any) => ({ id: r.id, name: r.name, status: r.status })), admin });
    }
    if (action === "scrape") {
      const c = await lead();
      const r = await runScrape(base44, c);
      if (r?.error) return err(r.error, r.status || 500);
      return Response.json(r);
    }
    if (action === "build_preview") {
      const c = await lead();
      const tpl = await templatesOf(db);
      const t = matchTemplate(tpl.list, { industry_key: clip(body.industry_key, 60) || c.industry_key, text: `${c.industry || ""} ${c.one_liner || ""} ${(c.scrape_summary?.gbp?.categories || []).join(" ")} ${c.scrape_summary?.industry || ""}`, niche_key: c.niche_key });
      if (!t) return err("No templates yet. Seed the library on the Templates page.");
      const built = buildPreview({ client: c, template: t, now: nowIso() });
      const prev = await previewOf(db, c.id);
      const overrides = body.reset_edits === true ? {} : prev?.website_overrides || {};
      const version = (Number(prev?.version) || 0) + 1;
      const data: any = {
        client_id: c.id, client_name: c.business, industry_key: t.industry_key, website_base: built.website_config, website_overrides: overrides,
        website_config: applyOverrides(built.website_config, overrides), command_config: built.command_config, missing: built.missing,
        built_at: nowIso(), built_by: staff.email, version, template_version: t.version || 1,
        status: prev && ["sent", "viewed"].includes(prev.status) ? prev.status : "draft",
        build_log: [...arr(prev?.build_log), logEntry(staff.email, prev ? "rebuild" : "build", version, `${t.name} template v${t.version || 1}${built.missing.length ? ` · missing: ${built.missing.join(", ")}` : ""}`)].slice(-40),
      };
      const row = prev ? await db.LeadPreview.update(prev.id, data) : await db.LeadPreview.create(data);
      const cpatch: any = {};
      if (!c.industry_key) cpatch.industry_key = t.industry_key;
      if (staff.kind === "sales") {
        cpatch.builder_rep_id = staff.rep.id;
        // First right to present: the builder takes the lead when they sell (closer or both) and nobody else has it.
        if (staff.rep.mode !== "builder" && (!c.assigned_rep_id || c.assigned_rep_id === staff.rep.id)) Object.assign(cpatch, { assigned_rep_id: staff.rep.id, assigned_rep_name: staff.rep.name, assigned_at: c.assigned_at || nowIso() });
      }
      if (Object.keys(cpatch).length) await db.CRMClient.update(c.id, cpatch);
      await audit(db, staff.email, prev ? "preview_rebuilt" : "preview_built", row, `${c.business}: preview v${version} from ${t.name}`);
      return Response.json({ preview: row, missing: built.missing });
    }
    if (action === "preview_patch") {
      const c = await lead();
      const p = await previewOf(db, c.id);
      if (!p) return err("Build the preview first.");
      const o = body.overrides && typeof body.overrides === "object" ? body.overrides : {};
      const merged = { hero: { ...(p.website_overrides?.hero || {}), ...(o.hero || {}) }, sections: { ...(p.website_overrides?.sections || {}), ...(o.sections || {}) }, order: Array.isArray(o.order) ? o.order.map((x: any) => clip(x, 40)).slice(0, 30) : p.website_overrides?.order || [], seo: { ...(p.website_overrides?.seo || {}), ...(o.seo || {}) } };
      const row = await db.LeadPreview.update(p.id, { website_overrides: merged, website_config: applyOverrides(p.website_base || p.website_config, merged), build_log: [...arr(p.build_log), logEntry(staff.email, "edit", p.version || 1, clip(body.note, 200) || "Text / sections edited")].slice(-40) });
      return Response.json({ preview: row });
    }
    if (action === "preview_status") {
      const c = await lead();
      const p = await previewOf(db, c.id);
      if (!p) return err("Build the preview first.");
      const status = body.status === "ready" ? "ready" : "draft";
      const row = await db.LeadPreview.update(p.id, { status: ["sent", "viewed"].includes(p.status) && status === "ready" ? p.status : status, ...(status === "ready" ? { ready_at: nowIso() } : {}), build_log: [...arr(p.build_log), logEntry(staff.email, status, p.version || 1)].slice(-40) });
      return Response.json({ preview: row });
    }
    if (action === "presentation") {
      const c = await lead();
      const p = await previewOf(db, c.id);
      if (!p) return err("Build the preview first; the pack is made from it.");
      const tpl = await templatesOf(db);
      const t = tpl.list.find((x: any) => x.industry_key === p.industry_key) || null;
      const reps = ((await db.SalesRep.list("name", 200).catch(() => [])) || []) as any[];
      const pack = presentationPack({ client: c, preview: p, template: t, rep: staff.rep || presenterFor(c, reps) });
      const row = await db.LeadPreview.update(p.id, { presentation: pack, build_log: [...arr(p.build_log), logEntry(staff.email, "presentation", p.version || 1)].slice(-40) });
      return Response.json({ presentation: pack, preview: row });
    }
    if (action === "agent_run") {
      // The lead agent: research, build, prep, suggest. Never sends anything; drafts wait for a person.
      const ids: string[] = body.all_new === true && admin
        ? (((await db.CRMClient.filter({ status: "Lead", lead_source: "lead_finder" }, "-created_date", 200).catch(() => [])) || []) as any[]).filter((c) => !c.do_not_contact && c.scrape_status !== "running").slice(0, Math.min(5, Number(body.limit) || 3)).map((c) => c.id)
        : [clip(body.client_id, 64)];
      const out: any[] = [];
      for (const id of ids) {
        let c = await db.CRMClient.get(id).catch(() => null);
        if (!c || !canWorkLead(staff, c)) { out.push({ id, error: "not allowed" }); continue; }
        const steps: string[] = [];
        if (!c.scrape_summary && c.scrape_status !== "running") { const r = await runScrape(base44, c); steps.push(r?.error ? `scrape failed: ${r.error}` : `scraped (Brain ${r.completeness ?? 0}%)`); c = await db.CRMClient.get(id); }
        let p = await previewOf(db, id);
        if (!p && c.scrape_summary) {
          const tpl = await templatesOf(db);
          const t = matchTemplate(tpl.list, { industry_key: c.industry_key, text: `${c.industry || ""} ${c.one_liner || ""} ${c.scrape_summary?.industry || ""}`, niche_key: c.niche_key });
          const built = buildPreview({ client: c, template: t, now: nowIso() });
          p = await db.LeadPreview.create({ client_id: id, client_name: c.business, industry_key: t.industry_key, website_base: built.website_config, website_overrides: {}, website_config: built.website_config, command_config: built.command_config, missing: built.missing, built_at: nowIso(), built_by: "agent", version: 1, template_version: t.version || 1, status: "draft", build_log: [logEntry("agent", "build", 1, `Drafted by the lead agent from ${t.name}`)] });
          if (!c.industry_key) await db.CRMClient.update(id, { industry_key: t.industry_key });
          steps.push(`preview drafted from ${t.name} (waits for a person to mark it Ready)`);
        }
        if (p && !p.presentation) {
          const tpl = await templatesOf(db);
          const pack = presentationPack({ client: c, preview: p, template: tpl.list.find((x: any) => x.industry_key === p.industry_key) || null, rep: staff.rep });
          p = await db.LeadPreview.update(p.id, { presentation: pack });
          steps.push("presentation pack prepared");
        }
        const next = nextAction(c, p);
        const draft = followUpDraft(c.desk_outcome || "no_answer", { client: c, rep: staff.rep });
        await audit(db, "agent:lead", "lead_agent_run", p, `${c.business}: ${steps.join("; ") || "nothing to do"} · next: ${next.label}`);
        out.push({ id, business: c.business, steps, next, draft });
      }
      return Response.json({ results: out });
    }

    /* ---------------- Lead Desk ---------------- */
    if (action === "desk_log") {
      const c = await lead();
      const outcome = String(body.outcome || "");
      const def = OUTCOME_BY_KEY[outcome];
      if (!def && outcome !== "note") return err("Pick an outcome.");
      if (c.do_not_contact && outcome !== "note") return err("This lead is marked do-not-call.", 409);
      const note = clip(body.note, 2000);
      const callbackAt = outcome === "callback" && body.callback_at && !Number.isNaN(Date.parse(body.callback_at)) ? new Date(body.callback_at).toISOString() : outcome === "callback" ? new Date(Date.now() + 86400000).toISOString() : null;
      const follow = callbackAt ? callbackAt.slice(0, 10) : /^\d{4}-\d{2}-\d{2}$/.test(String(body.follow_up_at || "")) ? body.follow_up_at : "";
      await db.LeadCallLog.create({ client_id: c.id, client_name: c.business, outcome, note, caller: staff.email, at: nowIso(), ...(follow ? { follow_up_at: follow } : {}) });
      const label = def?.label || "Note";
      const patch: any = { notes: [...arr(c.notes).filter((n: any) => n && typeof n === "object"), { id: Date.now(), text: `Call sheet · ${label}${note ? `: ${note}` : ""} (${staff.name})`, date: noteDate() }] };
      if (def) Object.assign(patch, { desk_outcome: outcome, desk_last_call_at: nowIso() });
      if (callbackAt) Object.assign(patch, { callback_at: callbackAt, next_step: "Call back", next_step_at: follow });
      if (outcome === "booked") Object.assign(patch, { next_step: "Walkthrough", next_step_at: follow || null });
      if (outcome === "not_interested") Object.assign(patch, { next_step: "", next_step_at: null });
      if (outcome === "dnc") Object.assign(patch, { do_not_contact: true, dnc_reason: note || "Asked not to be called", dnc_at: nowIso(), next_step: "", next_step_at: null });
      await db.CRMClient.update(c.id, patch);
      const stage = stageOf(c);
      if (outcome === "booked" && ["new", "contacted"].includes(stage)) await moveStage(db, c.id, "call_booked", { by: staff.email, reason: "Meeting booked from the call sheet", source: "dropdown" }).catch(() => null);
      else if (def?.connect && stage === "new") await moveStage(db, c.id, "contacted", { by: staff.email, reason: `Call sheet: ${label}`, source: "dropdown" }).catch(() => null);
      if (outcome === "booked" && !(c.lead_incentive?.status && c.lead_incentive.status !== "none")) await db.CRMClient.update(c.id, { lead_incentive: { status: "owed", amount: INCENTIVE.amount, minutes: INCENTIVE.minutes, owed_at: nowIso() } });
      // Close the task this call answered, then let the follow-up engine decide what's next.
      const open = ((await db.LeadTask.filter({ client_id: c.id, status: "open" }, "due_at", 10).catch(() => [])) || []) as any[];
      for (const t of open.filter((t: any) => Date.parse(t.due_at) <= Date.now() + 3600000)) await db.LeadTask.update(t.id, { status: "done", done_at: nowIso(), done_by: staff.email }).catch(() => null);
      const fresh = await db.CRMClient.get(c.id);
      const sw = await sweepLead(db, fresh).catch(() => null);
      return Response.json({ ok: true, callback_at: callbackAt, next: sw });
    }
    if (action === "task_done") {
      const t = await db.LeadTask.get(clip(body.id, 64)).catch(() => null);
      if (!t) return err("Task not found", 404);
      const c = await db.CRMClient.get(t.client_id).catch(() => null);
      if (!canWorkLead(staff, c)) return err("Not your lead", 403);
      await db.LeadTask.update(t.id, { status: body.skip ? "skipped" : "done", done_at: nowIso(), done_by: staff.email });
      return Response.json({ ok: true });
    }
    if (action === "sheet") {
      // The daily call sheet: one call for everything the caller needs, ordered by priority.
      const [all, previews, tasks, tpl, calls] = await Promise.all([
        db.CRMClient.filter({ status: "Lead" }, "-created_date", 1500).catch(() => []),
        db.LeadPreview.list("-updated_date", 1500).catch(() => []),
        db.LeadTask.filter({ status: "open" }, "due_at", 1500).catch(() => []),
        templatesOf(db),
        db.LeadCallLog.filter({ caller: staff.email, at: { $gte: new Date(new Date().setHours(0, 0, 0, 0) - 10 * 3600000).toISOString() } }, "-at", 1000).catch(() => []),
      ]);
      const mine = ((all || []) as any[]).filter((c) => !c.do_not_contact && c.desk_outcome !== "not_interested" && (admin ? (body.rep_id ? c.assigned_rep_id === body.rep_id : true) : canWorkLead(staff, c)));
      const pv = new Map(((previews || []) as any[]).map((p) => [p.client_id, p]));
      const tk = new Map();
      for (const t of (tasks || []) as any[]) if (!tk.has(t.client_id)) tk.set(t.client_id, t);
      const tname = new Map(tpl.list.map((t: any) => [t.industry_key, t.name]));
      const rows = mine.filter((c) => { const p = pv.get(c.id); return (p && ["ready", "sent", "viewed"].includes(p.status)) || tk.has(c.id); }).map((c) => {
        const p = pv.get(c.id) || null;
        return {
          client: forStaff(staff, c), task: tk.get(c.id) || null, heat: heatOf(c, p),
          preview: p ? { id: p.id, status: p.status, version: p.version, engagement: p.engagement || null, industry_key: p.industry_key, sent_at: p.sent_at || null } : null,
          prep: prepCard(c, p, tname.get(p?.industry_key || c.industry_key) || ""),
        };
      });
      // Today's counters for this caller (Pacific day boundary approximated server-side).
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
      const todays = ((calls || []) as any[]).filter((x) => new Date(x.at).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }) === today);
      const dials = todays.filter((x) => DIAL_OUTCOMES.includes(x.outcome));
      const myIds = new Set(mine.map((c) => c.id));
      const logins = ((previews || []) as any[]).filter((p) => myIds.has(p.client_id) && p.engagement?.first_login_at && new Date(p.engagement.first_login_at).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }) === today).length;
      const dealsToday = ((await db.Deal.filter({ status: "won" }, "-closed_at", 200).catch(() => [])) || []).filter((d: any) => (admin || d.rep_id === staff.rep?.id) && d.closed_at && new Date(d.closed_at).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }) === today).length;
      return Response.json({
        rows: sheetOrder(rows), outcomes: OUTCOMES, target: DAILY_DIAL_TARGET,
        counters: { dials: dials.length, connects: dials.filter((x) => OUTCOME_BY_KEY[x.outcome]?.connect).length, owners: dials.filter((x) => OUTCOME_BY_KEY[x.outcome]?.owner).length, portals: todays.filter((x) => x.outcome === "invite_sent").length, logins, meetings: dials.filter((x) => x.outcome === "booked").length, deals: dealsToday },
        queue: { building: ((all || []) as any[]).filter((c) => ["queued", "building"].includes(c.build_queue?.status)).length, pending: ((all || []) as any[]).filter((c) => c.build_queue?.status === "pending").length },
      });
    }
    if (action === "followups_sweep") {
      if (!admin) return err("Admins only", 403);
      return Response.json(await followupsSweep(db));
    }

    /* ---------------- Build queue ---------------- */
    if (action === "queue") {
      const all = ((await db.CRMClient.filter({ status: "Lead" }, "-created_date", 1500).catch(() => [])) || []) as any[];
      const mine = all.filter((c) => c.build_queue?.status && (admin || canWorkLead(staff, c)));
      const ls = await leadSettings(db);
      const counts: Record<string, number> = {};
      for (const c of mine) counts[c.build_queue.status] = (counts[c.build_queue.status] || 0) + 1;
      return Response.json({ items: mine.slice(0, 400).map((c) => ({ id: c.id, business: c.business, city: c.city, state: c.state, industry_key: c.industry_key, lead_flags: c.lead_flags || [], rating: c.gbp_cache?.rating ?? null, reviews: c.gbp_cache?.review_count ?? null, website: (c.websites || [])[0] || "", queue: c.build_queue, assigned_rep_name: c.assigned_rep_name || "" })), counts, daily_cap: ls.daily_cap, built_today: ls.queue_today });
    }
    if (action === "queue_decide") {
      const ids = arr(body.ids).map((x: any) => clip(x, 64)).slice(0, 200);
      const approve = body.decision === "approve";
      let n = 0;
      for (const id of ids) {
        const c = await db.CRMClient.get(id).catch(() => null);
        if (!c || !canWorkLead(staff, c)) continue;
        if (approve && ["ready", "building"].includes(c.build_queue?.status)) continue;
        await db.CRMClient.update(id, { build_queue: approve ? { status: "queued", attempts: 0, next_try_at: nowIso(), approved_at: nowIso(), approved_by: staff.email } : { ...(c.build_queue || {}), status: "skipped", reason: "Skipped", decided_by: staff.email } });
        n++;
      }
      return Response.json({ ok: true, updated: n });
    }
    if (action === "queue_run") {
      if (!admin) return err("Admins only", 403);
      return Response.json(await queueRun(base44, db, staff.email));
    }

    if (action === "incentive_save") {
      const c = await lead();
      const status = ["none", "owed", "paid"].includes(body.status) ? body.status : "owed";
      const method = PAY_METHODS.includes(body.method) ? body.method : "";
      const note = clip(body.note, 300);
      // Never store payment account numbers, handles or emails for the payout.
      if (/\d{5,}|@|\$[a-z]/i.test(note)) return err("Don't store account numbers, handles or emails here. Just the method and date.");
      if (status === "paid" && !method) return err("Pick how it was paid.");
      const inc = { ...(c.lead_incentive || {}), status, amount: Math.max(0, Math.min(500, Number(body.amount) || INCENTIVE.amount)), minutes: Math.max(0, Math.min(240, Number(body.minutes) || INCENTIVE.minutes)), method, note, paid_at: status === "paid" ? (/^\d{4}-\d{2}-\d{2}$/.test(String(body.paid_at || "")) ? body.paid_at : nowIso().slice(0, 10)) : null, updated_by: staff.email, updated_at: nowIso() };
      await db.CRMClient.update(c.id, { lead_incentive: inc });
      await db.LeadCallLog.create({ client_id: c.id, client_name: c.business, outcome: "incentive", note: `$${inc.amount} ${status}${method ? ` via ${method}` : ""}`, caller: staff.email, at: nowIso(), incentive: inc });
      return Response.json({ incentive: inc });
    }
    if (action === "dnc_set") {
      const c = await lead();
      const on = body.on !== false;
      if (!on && !admin) return err("Only an admin can remove do-not-contact.", 403);
      await db.CRMClient.update(c.id, on ? { do_not_contact: true, dnc_reason: clip(body.reason, 200) || "Asked not to be contacted", dnc_at: nowIso(), next_step: "", next_step_at: null } : { do_not_contact: false, dnc_reason: "", dnc_at: null });
      await db.LeadCallLog.create({ client_id: c.id, client_name: c.business, outcome: "do_not_contact", note: on ? clip(body.reason, 200) || "Asked not to be contacted" : "Do-not-contact removed", caller: staff.email, at: nowIso() });
      return Response.json({ ok: true, do_not_contact: on });
    }
    if (action === "invite_compose" || action === "invite_send") {
      const c = await lead();
      const p = await previewOf(db, c.id);
      const email = normEmail(body.email || (c.portal_emails || [])[0] || (c.emails || [])[0] || "");
      const settings = await inviteSettings(db);
      const ls = await leadSettings(db);
      const blockers: string[] = [];
      if (c.do_not_contact) blockers.push("This lead is marked do-not-contact.");
      if (c.email_opt_out) blockers.push("This lead opted out of emails.");
      if (!p || !["ready", "sent", "viewed"].includes(p.status)) blockers.push("Mark the preview Ready to show first.");
      if (!isEmail(email)) blockers.push("Add the owner's email address.");
      if (!ls.postal_address.trim()) blockers.push("Add Interstellar's mailing address in Lead Desk › Settings (the law requires it in this email).");
      if (c.status !== "Lead" || c.portal_tier === "client") blockers.push("This is already a client; use the normal portal invite.");
      const optOut = await optOutUrl(settings.portal_url, c.id);
      const repName = staff.kind === "sales" ? staff.rep.name : "";
      const { subject, html } = leadInviteEmail({ business: c.business, contact: c.contact || "", email: email || "you@example.com", loginUrl: `${settings.portal_url}/login`, optOut, postal: ls.postal_address || "[mailing address needed]", logo: c.logo_url || "", replyEmail: ls.reply_email, repName });
      if (action === "invite_compose") return Response.json({ to: email, subject, html, blockers, portal_url: settings.portal_url });
      if (body.confirm !== true) return err("Click Send to confirm.");
      if (blockers.length) return err(blockers[0], 409, { blockers });
      const emails = [...new Set([...(c.portal_emails || []).map(normEmail), email])];
      await db.CRMClient.update(c.id, { portal_emails: emails, portal_enabled: true, portal_tier: "lead", portal_tier_changed_at: nowIso(), emails: [...new Set([...(c.emails || []), email])] });
      const inv = await db.PortalInvite.create({ client_id: c.id, client_name: c.business, email, source: "manual", status: "queued", due_at: nowIso(), invited_by: staff.email, package: "Lead preview (lead tier)" });
      try {
        try { await base44.asServiceRole.users.inviteUser(email, "user"); } catch (e) { if (!/already|exist/i.test(String(e?.response?.data?.message || e?.message || e))) throw e; }
        await sendBrandedEmail(base44, { to: email, subject, html });
      } catch (e) {
        const msg = String(e?.response?.data?.message || e?.message || e).slice(0, 300);
        await db.PortalInvite.update(inv.id, { status: "failed", message: msg });
        return err(`Couldn't send: ${msg}`, 502);
      }
      await db.PortalInvite.update(inv.id, { status: "sent", sent_at: nowIso(), message: `Lead-tier portal access granted and the preview email sent to ${email} by ${staff.email}.` });
      await db.LeadPreview.update(p.id, { status: p.status === "viewed" ? "viewed" : "sent", sent_at: nowIso(), build_log: [...arr(p.build_log), logEntry(staff.email, "sent", p.version || 1, `Invite to ${email}`)].slice(-40) });
      await db.LeadCallLog.create({ client_id: c.id, client_name: c.business, outcome: "invite_sent", note: `Portal invite sent to ${email}`, caller: staff.email, at: nowIso() });
      await db.CRMClient.update(c.id, { desk_outcome: c.desk_outcome || "sent_portal", lead_heat: "warm" });
      await sweepLead(db, await db.CRMClient.get(c.id)).catch(() => null);
      return Response.json({ ok: true, to: email });
    }

    /* ---------------- Admin ---------------- */
    if (action === "settings") {
      if (!admin) return err("Admins only", 403);
      const ls = await leadSettings(db);
      if (body.save) {
        const next = { postal_address: clip(body.postal_address, 200), reply_email: isEmail(body.reply_email) ? normEmail(body.reply_email) : ls.reply_email, daily_cap: [25, 50, 100].includes(Number(body.daily_cap)) ? Number(body.daily_cap) : ls.daily_cap, voicemail_attempts: Math.max(1, Math.min(10, Number(body.voicemail_attempts) || 4)) };
        if (ls.row) await db.AppSettings.update(ls.row.id, { pageSettings: { ...(ls.row.pageSettings || {}), ...next } });
        else await db.AppSettings.create({ key: "lead_engine", pageSettings: next });
        return Response.json({ settings: next });
      }
      return Response.json({ settings: { postal_address: ls.postal_address, reply_email: ls.reply_email, daily_cap: ls.daily_cap, voicemail_attempts: (await followUpRules(db)).voicemail_attempts } });
    }
    if (action === "set_tier") {
      if (!admin) return err("Admins only", 403);
      const c = await lead();
      const tier = body.tier === "client" ? "client" : "lead";
      await db.CRMClient.update(c.id, { portal_tier: tier, portal_tier_changed_at: nowIso() });
      await db.AgentAuditLog.create({ at: nowIso(), ok: true, actor: staff.email, action: "portal_tier", entity: "CRMClient", record_id: c.id, summary: `${c.business}: portal tier → ${tier} (by hand; nothing deleted)` }).catch(() => null);
      return Response.json({ ok: true, tier });
    }
    if (action === "route_unassigned") {
      if (!admin) return err("Admins only", 403);
      const open = ((await db.CRMClient.filter({ status: "Lead" }, "-created_date", 500).catch(() => [])) || []).filter((c: any) => !c.assigned_rep_id && !c.do_not_contact && !["won", "lost"].includes(String(c.pipeline_stage || ""))).slice(0, 100);
      const res: any[] = [];
      for (const c of open) { const r = await assignLead(db, c, routeLead, { by: staff.email }); if (r) res.push({ lead: c.business, rep: r.name }); }
      return Response.json({ assigned: res, left: open.length - res.length });
    }
    if (action === "assign") {
      if (!admin) return err("Admins only", 403);
      const c = await lead();
      const rep = body.rep_id ? await db.SalesRep.get(clip(body.rep_id, 64)).catch(() => null) : null;
      await db.CRMClient.update(c.id, rep ? { assigned_rep_id: rep.id, assigned_rep_name: rep.name, assigned_at: nowIso() } : { assigned_rep_id: "", assigned_rep_name: "", assigned_at: null });
      if (rep) await db.SalesRep.update(rep.id, { assigned_total: (Number(rep.assigned_total) || 0) + 1, last_assigned_at: nowIso() });
      return Response.json({ ok: true });
    }
    if (action === "stats") {
      if (!admin) return err("Admins only", 403);
      const week = new Date(Date.now() - 7 * 86400000).toISOString();
      const [found, previews, all] = await Promise.all([
        db.CRMClient.filter({ lead_source: "lead_finder", created_date: { $gte: week } }, "-created_date", 1000).catch(() => []),
        db.LeadPreview.list("-updated_date", 1000).catch(() => []),
        db.CRMClient.filter({ lead_source: "lead_finder" }, "-created_date", 2000).catch(() => []),
      ]);
      const pv = (previews || []) as any[];
      const withPreview = new Set(pv.map((p) => p.client_id));
      const leads = (all || []) as any[];
      const owed = leads.filter((c) => c.lead_incentive?.status === "owed");
      return Response.json({
        found_week: (found || []).length,
        previews_ready: pv.filter((p) => ["ready", "sent", "viewed"].includes(p.status)).length,
        previews_draft: pv.filter((p) => p.status === "draft").length,
        portal_logins: pv.filter((p) => p.engagement?.first_login_at).length,
        walkthroughs: pv.filter((p) => p.engagement?.walkthrough_booked_at).length + leads.filter((c) => c.desk_outcome === "booked" && !pv.find((p) => p.client_id === c.id && p.engagement?.walkthrough_booked_at)).length,
        incentives_owed: owed.length, incentives_owed_usd: owed.reduce((a, c) => a + (Number(c.lead_incentive?.amount) || INCENTIVE.amount), 0),
        conversions: leads.filter((c) => c.status === "Active" && withPreview.has(c.id)).length,
      });
    }

    return err("Unknown action");
  } catch (e) {
    return Response.json({ error: String(e?.message || e).slice(0, 300) }, { status: e?.status || 500 });
  }
});
