// Work ledger (Møthership > Command > Output, and the client portal "Work we did" feed).
//   sync    {}                         Workflow "Work ledger — hourly sync" (no user) or admin. Turns real, finished work into
//                                      WorkEntry rows (deduped by dedupe_key): LaunchItems marked done, ClaudeJob completions,
//                                      AutomationRun / agent runs that produced something, WorkLog (blogs, posts, edits),
//                                      completed ClientRequests, engine starts, admin-made social posts and email campaigns.
//                                      Updates status when a source moves (e.g. ClaudeJob approved, blog verified live), then
//                                      runs `process`. Records only: never sends, publishes or changes a client site.
//   process { ids?, limit? }           Admin/sync: fill baseline minutes, saved minutes, default visibility and client copy
//                                      for rows with processed != true (rows Claude wrote with create_entities) or pending copy.
//   copy    { ids }                    Admin: regenerate client_title / client_summary (ai-gateway, prompting standard).
//   log     { entry } | { entries }    Admin, or header x-mothership-key = MOTHERSHIP_INGEST_KEY (scripts, other apps):
//                                      { client_id? | domain?, title, task_type, done_by, agent_key?, manual_minutes?,
//                                        category?, link?, evidence?, completed_at?, dedupe_key?, status? }
//   config  { rows?, hourly_rate? }    Admin: read (no args) or save the time-saved estimates table + hourly rate.
//   summary {}                         Admin or key: totals (week / month / all time) for briefs.
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { callAI } from "../../shared/anthropic.ts";
import { getSecret } from "../../shared/portalClient.ts";
import { monthKey } from "../../shared/usagePlans.ts";
import {
  loadConfig, normalize, savedMinutes, copyProblems, COPY_SCHEMA, COPY_SYSTEM, copyPrompt, fallbackCopy, isClientSafeUrl,
  launchItemType, launchItemDoneBy, CLAUDE_JOB_TYPE, WORKLOG_TYPE, RUN_SKIP, runType, DEFAULT_BASELINES, CATEGORIES, DONE_BY,
  sensitiveTitle, directingMinutes, withConfirmMark,
} from "../../shared/workLedger.ts";

const arr = (v: any) => (Array.isArray(v) ? v : (v && v.items) || []);
const clip = (v: unknown, n: number) => (v == null ? "" : String(v).slice(0, n));
const iso = (v: any) => (v ? new Date(v).toISOString() : null);

async function all(ent: any, q: any = {}, sort = "-created_date", page = 500, max = 5000) {
  const out: any[] = [];
  for (let skip = 0; skip < max; skip += page) {
    const rows = arr(await ent.filter(q, sort, page, skip).catch(() => []));
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

const bareDomain = (s = "") => s.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();

// ---------------------------------------------------------------- sources -> candidate rows
async function candidates(db: any) {
  const [clients, admins, registry] = await Promise.all([
    all(db.CRMClient, {}, "business"),
    all(db.User, { role: "admin" }, "-created_date").catch(() => []),
    all(db.AgentRegistry, {}, "sort"),
  ]);
  const nameOf = new Map(clients.map((c: any) => [c.id, c.business]));
  const adminEmails = new Set(admins.map((u: any) => String(u.email || "").toLowerCase()));
  const byName = (n: string) => clients.find((c: any) => String(c.business || "").toLowerCase() === n.toLowerCase().trim());
  const out: any[] = [];
  const add = (r: any) => out.push({ ...r, client_name: r.client_name || (r.client_id === "agency" ? "Interstellar" : nameOf.get(r.client_id) || "") });

  // 1. Road to Dec 31 items marked done (questions Justin answered count as his decisions).
  for (const i of await all(db.LaunchItem, { status: "done" }, "-updated_date")) {
    let cid = i.client_id || "";
    if (!cid && String(i.workstream || "").startsWith("Client:")) cid = byName(String(i.workstream).slice(7))?.id || "";
    const type = launchItemType(i);
    add({
      dedupe_key: `li:${i.id}`, source_type: "launch_item", source_id: i.id, client_id: cid || "agency", client_name: cid ? i.client_name : "",
      title: clip(i.title, 300), notes: clip(i.notes || i.answer, 1500), evidence: clip(i.source, 600), task_type: type,
      done_by: launchItemDoneBy(i), status: "done", completed_at: iso(i.done_at || i.answered_at || i.updated_date),
    });
  }

  // 2. Claude queue jobs that finished (approved = done; needs approval = waiting; blogs only count once verified live).
  for (const j of await all(db.ClaudeJob, { status: { $in: ["approved", "needs_approval", "changes_requested"] } }, "-created_date")) {
    if (/^test run/i.test(String(j.title || "")) || !(j.finished_at || j.approved_at)) continue;
    let status = j.status === "approved" ? "done" : j.status === "needs_approval" ? "awaiting_approval" : "in_progress";
    if (j.kind === "blog" && j.context?.publish_state !== "verified_live") status = j.context?.publish_state === "published_unverified" ? "in_progress" : status === "done" ? "in_progress" : status;
    const link = arr(j.result_links).map((l: any) => l?.url).find(isClientSafeUrl) || "";
    add({
      dedupe_key: `cj:${j.id}`, source_type: "claude_job", source_id: j.id, client_id: j.client_id || "agency", client_name: j.client_name,
      title: clip(j.title, 300), notes: clip(j.result_summary, 1500), evidence: `ClaudeJob ${j.id}`, task_type: CLAUDE_JOB_TYPE[j.kind] || "other",
      done_by: "scheduled_task", agent_key: "claude_queue", agent_name: "Claude queue", status, completed_at: iso(j.approved_at || j.finished_at), link,
    });
  }

  // 3. Agent and workflow runs that produced something. Blog/post runs are counted through their WorkLog row; Claude queue
  //    runs through the job; approval-policy clears are bookkeeping.
  const regFor = (name: string) => registry.find((r: any) => arr(r.run_match).some((m: string) => String(m).toLowerCase() === name.toLowerCase()) || String(r.name || "").toLowerCase() === name.toLowerCase());
  for (const r of await all(db.AutomationRun, { status: "success" }, "-created_date", 500, 3000)) {
    const name = String(r.automation_name || "");
    if (!name || RUN_SKIP.test(name) || r.kind === "claude_job" || r.work_log_id) continue;
    const reg = regFor(name);
    const what = clip(r.title || r.message, 220);
    add({
      dedupe_key: `ar:${r.id}`, source_type: "automation_run", source_id: r.id, client_id: r.client_id || "agency", client_name: r.client_name,
      title: clip(`${name}${what ? `: ${what}` : ""}`, 300), notes: clip(r.message, 1200), evidence: `AutomationRun ${r.id}`,
      task_type: runType(name, String(r.kind || "")), done_by: reg?.kind === "claude_scheduled_task" ? "scheduled_task" : "agent",
      agent_key: reg?.key || "", agent_name: reg?.name || name, status: "done", completed_at: iso(r.finished_at || r.started_at || r.created_date),
      link: isClientSafeUrl(r.output_url) ? r.output_url : "",
    });
  }

  // 4. Published work (blogs, posts, edits, listings). A generated blog is not published until verified live.
  for (const w of await all(db.WorkLog, {}, "-date")) {
    if (w.status === "failed" || w.status === "scheduled") continue;
    // Mirrored from a WorkEntry by brain-to-dossier (so the Constellations web can read it): already on the ledger.
    if (String(w.dedupe_key || "").startsWith("we:")) continue;
    const blogLike = ["blog", "gbp_post", "project_page", "new_page"].includes(w.kind);
    const live = w.status === "live" && (!blogLike || w.verified_live || !w.url);
    add({
      dedupe_key: `wl:${w.id}`, source_type: "work_log", source_id: w.id, client_id: w.client_id || "agency", client_name: w.client_name,
      title: clip(w.title, 300), notes: clip(w.description, 1200), evidence: `WorkLog ${w.id}`, task_type: WORKLOG_TYPE[w.kind] || "other",
      done_by: w.source === "automation" ? "scheduled_task" : w.source === "claude" ? "claude_session" : "team",
      // Undated rows were logged by hand before the ledger existed: no date is invented, so they count in all-time only.
      status: live ? "done" : "in_progress", completed_at: iso(w.date), link: isClientSafeUrl(w.url) ? w.url : "",
      ...(!w.date ? { notes: clip(`${w.description ? `${w.description} · ` : ""}Logged before the work ledger; date and who did it weren't recorded.`, 1200) } : {}),
      ...(w.portal_visible === false ? { visibility: "internal", visibility_locked: true, visibility_reason: "Hidden from the portal on the work log" } : {}),
    });
  }

  // 5. Client requests we completed.
  for (const q of await all(db.ClientRequest, { status: "complete" }, "-updated_date")) {
    add({
      dedupe_key: `rq:${q.id}`, source_type: "request", source_id: q.id, client_id: q.client_id || "agency", client_name: q.client_name,
      title: clip(`Request: ${q.title || q.kind || "client request"}`, 300), notes: clip(q.client_note, 800), evidence: `ClientRequest ${q.id}`,
      task_type: "client_request", done_by: "team", status: "done", completed_at: iso(q.completed_at || q.updated_date),
      link: q.page_status === "live" && isClientSafeUrl(q.page_url) ? q.page_url : "",
    });
  }

  // 6. Monthly engines started.
  for (const e of await all(db.EngineStart, {}, "-started_at")) {
    if (!e.client_id || !["queued", "running"].includes(String(e.status || "queued"))) continue;
    add({
      dedupe_key: `en:${e.id}`, source_type: "engine", source_id: e.id, client_id: e.client_id, client_name: e.client_name,
      title: `Started the monthly growth engine (blogs, outreach, social, reviews) for ${e.client_name || "the client"}`, evidence: `EngineStart ${e.id}`,
      task_type: "automation_setup", done_by: "team", status: "done", completed_at: iso(e.started_at || e.created_date),
    });
  }

  // 7. Social posts and email campaigns we made (client-made ones in their own Studio are theirs, not ours).
  const ours = (r: any) => adminEmails.has(String(r.created_by || "").toLowerCase());
  for (const v of await all(db.SocialVariant, { status: "posted" }, "-published_at").catch(() => [])) {
    if (!ours(v)) continue;
    add({
      dedupe_key: `sv:${v.id}`, source_type: "social_post", source_id: v.id, client_id: v.client_id || "agency",
      title: clip(`Social post (${v.platform || "social"}): ${v.title || ""}`, 300), evidence: `SocialVariant ${v.id}`, task_type: "social_post",
      done_by: "agent", agent_key: "wf:social-publish", agent_name: "Social Studio publisher", status: "done", completed_at: iso(v.published_at || v.updated_date),
      link: isClientSafeUrl(v.posted_url) ? v.posted_url : "",
    });
  }
  for (const p of await all(db.SocialPost, { status: "posted" }, "-published_at").catch(() => [])) {
    add({
      dedupe_key: `sp:${p.id}`, source_type: "social_post", source_id: p.id, client_id: "agency", title: clip(`Interstellar social post: ${p.title || ""}`, 300),
      evidence: `SocialPost ${p.id}`, task_type: "social_post", done_by: "agent", agent_key: "wf:social-publish", agent_name: "Social Studio publisher",
      status: "done", completed_at: iso(p.published_at || p.posted_at || p.updated_date), link: isClientSafeUrl(p.posted_url) ? p.posted_url : "",
    });
  }
  for (const c of await all(db.EmailCampaign, { status: { $in: ["sent", "partial"] } }, "-finished_at").catch(() => [])) {
    if (!ours(c)) continue;
    add({
      dedupe_key: `em:${c.id}`, source_type: "email_campaign", source_id: c.id, client_id: c.client_id || "agency", client_name: c.client_name,
      title: clip(`Email campaign: ${c.subject || c.name || ""}`, 300), evidence: `EmailCampaign ${c.id}`, task_type: "email_campaign",
      done_by: "team", status: "done", completed_at: iso(c.finished_at || c.started_at || c.created_date),
    });
  }
  return out;
}

async function loadIndex(db: any) {
  const rows = await all(db.WorkEntry, {}, "-created_date", 500, 20000);
  return new Map(rows.filter((r: any) => r.dedupe_key).map((r: any) => [r.dedupe_key, r]));
}

async function sync(db: any, base44: any, user: any) {
  const cfg = await loadConfig(db);
  const index = await loadIndex(db);
  const cands = await candidates(db);
  let created = 0, updated = 0;
  const toCreate: any[] = [];
  for (const c of cands) {
    const ex = index.get(c.dedupe_key);
    if (!ex) {
      const row = { ...c, processed: true, client_copy_status: "pending" };
      Object.assign(row, normalize(row, cfg));
      toCreate.push(row);
      continue;
    }
    // Source moved on (job approved, blog verified live) or the mapping improved: follow it, unless Justin edited the
    // row (locked) or marked it duplicate/cancelled.
    if (["duplicate", "cancelled"].includes(ex.status) || ex.locked) continue;
    const remap = ex.task_type !== c.task_type || ex.done_by !== c.done_by;
    if (ex.status === c.status && !remap) continue;
    const patch: any = { status: c.status, completed_at: c.completed_at || ex.completed_at, task_type: c.task_type, done_by: c.done_by };
    if (remap && ex.client_copy_status === "skipped") patch.client_copy_status = "pending";
    // Moving off "Justin by hand": his minutes were only the estimate, so they no longer apply.
    if (ex.done_by === "justin_manual" && c.done_by !== "justin_manual") patch.manual_minutes = 0;
    Object.assign(patch, normalize({ ...ex, ...patch }, cfg));
    if (patch.status === "done" && !ex.client_title) patch.client_copy_status = "pending";
    await db.WorkEntry.update(ex.id, patch);
    updated++;
  }
  for (let i = 0; i < toCreate.length; i += 50) {
    const batch = toCreate.slice(i, i + 50);
    try { await db.WorkEntry.bulkCreate(batch); } catch { for (const r of batch) await db.WorkEntry.create(r); }
    created += batch.length;
  }
  const processed = await processPending(db, base44, user, { limit: 48 });
  return { ran_at: new Date().toISOString(), candidates: cands.length, created, updated, processed };
}

// ---------------------------------------------------------------- client copy
async function writeCopy(db: any, base44: any, user: any, rows: any[], otherNames: (cid: string) => string[]) {
  if (!rows.length) return { generated: 0, fallback: 0 };
  const prompt = copyPrompt(rows);
  let items: any[] | null = null;
  let copyError = ""; // surfaced as copy_errors so an unattended run never fails silently
  // Preferred path: the ai-gateway (house rules, metering, model per the prompting standard) as the signed-in admin.
  if (user?.role === "admin") {
    try {
      const r = await base44.functions.invoke("ai-gateway", { action: "complete", tier: "routine", feature: "work_ledger_copy", system: COPY_SYSTEM, prompt, response_json_schema: COPY_SCHEMA, max_tokens: 4000 });
      items = arr((r?.data || r)?.json?.items);
    } catch { items = null; }
  }
  // Unattended (hourly workflow) or gateway unavailable: the same house rules in process. No key needed: callAI runs
  // on the built-in InvokeLLM (service role) when ANTHROPIC_API_KEY is absent, which is the normal case.
  if (!items?.length) {
    try {
      const out = await callAI(base44, { key: getSecret("ANTHROPIC_API_KEY") || null, tier: "routine", system: COPY_SYSTEM, prompt, schema: COPY_SCHEMA, max_tokens: 4000 });
      items = arr(out.json?.items);
      await db.UsageLedger.create({ client_id: "agency", client_name: "Interstellar (admin)", month: monthKey(), kind: "ai_action", units: 1, calls: 1, model: out.model, feature: "work_ledger_copy", by_admin: true, input_tokens: out.input_tokens, output_tokens: out.output_tokens, created_at: new Date().toISOString() }).catch(() => null);
      if (!items.length) copyError = `empty reply: ${JSON.stringify(out.json || out.text || "").slice(0, 200)}`;
    } catch (e) { copyError = String((e as Error)?.message || e).slice(0, 300); console.error("work-ledger copy", copyError); items = null; }
  }
  let generated = 0, fallback = 0;
  for (const r of rows) {
    const it = (items || []).find((x: any) => String(x?.id) === String(r.id));
    const t = clip(it?.client_title, 120).trim();
    const s = clip(it?.client_summary, 400).trim();
    const problems = it ? copyProblems(t, s, otherNames(r.client_id)) : ["no reply"];
    if (it && it.client_safe !== false && !problems.length) {
      await db.WorkEntry.update(r.id, { client_title: t, client_summary: s, client_copy_status: "generated" });
      generated++;
    } else if (it && it.client_safe === false && !r.visibility_locked) {
      await db.WorkEntry.update(r.id, { visibility: "internal", visibility_reason: "Writer judged it internal-only", client_copy_status: "skipped" });
    } else if (!it) {
      const [ft, fs] = fallbackCopy(r.category);
      await db.WorkEntry.update(r.id, { client_title: ft, client_summary: fs, client_copy_status: "fallback" });
      fallback++;
    } else {
      // The draft broke a rule (AI/tool names, money, ids, another client): keep it off the portal until Justin edits it.
      await db.WorkEntry.update(r.id, { ...(r.visibility_locked ? {} : { visibility: "internal" }), visibility_reason: `Client copy held back: ${problems.join(", ")}`, client_copy_status: "skipped" });
    }
  }
  if (!copyError && fallback) copyError = `no matching reply (${(items || []).length} items for ${rows.length} rows)`;
  return { generated, fallback, ...(copyError ? { error: copyError } : {}) };
}

async function processPending(db: any, base44: any, user: any, { ids, limit = 48 }: { ids?: string[]; limit?: number } = {}) {
  const cfg = await loadConfig(db);
  let rows: any[];
  if (ids?.length) rows = (await Promise.all(ids.slice(0, 100).map((id) => db.WorkEntry.get(id).catch(() => null)))).filter(Boolean);
  else {
    const raw = arr(await db.WorkEntry.filter({ processed: { $ne: true } }, "-created_date", 200).catch(() => []));
    const copy = arr(await db.WorkEntry.filter({ visibility: "client", status: "done", client_copy_status: { $in: ["pending", null] } }, "-completed_at", 200).catch(() => []));
    const seen = new Set<string>();
    rows = [...raw, ...copy].filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  }
  const clients = await all(db.CRMClient, {}, "business");
  const otherNames = (cid: string) => clients.filter((c: any) => c.id !== cid).map((c: any) => String(c.business || "")).filter((n: string) => n.length > 3 && !/test|delete me/i.test(n));
  let normalized = 0;
  for (const r of rows) {
    if (r.processed === true && !ids?.length) continue;
    const patch = { ...normalize(r, cfg), processed: true };
    if (!r.client_copy_status) (patch as any).client_copy_status = "pending";
    await db.WorkEntry.update(r.id, patch);
    Object.assign(r, patch);
    normalized++;
  }
  const needCopy = rows.filter((r) => r.visibility === "client" && r.status === "done" && (ids?.length ? true : !r.client_title || r.client_copy_status === "pending") && r.client_copy_status !== "edited").slice(0, limit);
  let generated = 0, fallback = 0;
  const errors: string[] = [];
  for (let i = 0; i < needCopy.length; i += 12) {
    const res: any = await writeCopy(db, base44, user, needCopy.slice(i, i + 12), otherNames);
    generated += res.generated; fallback += res.fallback;
    if (res.error && !errors.includes(res.error)) errors.push(res.error);
  }
  return { normalized, copy_generated: generated, copy_fallback: fallback, ...(errors.length ? { copy_errors: errors } : {}), copy_left: Math.max(0, rows.filter((r) => r.visibility === "client" && r.status === "done" && !r.client_title).length - needCopy.length) };
}

// ---------------------------------------------------------------- log (Claude sessions, scripts, other apps)
async function logEntries(db: any, list: any[]) {
  const cfg = await loadConfig(db);
  const clients = await all(db.CRMClient, {}, "business");
  const out: any[] = [];
  for (const e of list.slice(0, 100)) {
    if (!e || !e.title) { out.push({ error: "title required" }); continue; }
    let cid = clip(e.client_id, 64);
    if (!cid && e.domain) cid = clients.find((c: any) => bareDomain(String(c.domain || "")) === bareDomain(String(e.domain)) || arr(c.websites).some((w: string) => bareDomain(w) === bareDomain(String(e.domain))))?.id || "";
    if (!cid && e.client_name) cid = clients.find((c: any) => String(c.business || "").toLowerCase() === String(e.client_name).toLowerCase())?.id || "";
    const key = clip(e.dedupe_key, 200) || `api:${(cid || "agency")}:${clip(e.title, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${String(e.completed_at || new Date().toISOString()).slice(0, 10)}`;
    const ex = arr(await db.WorkEntry.filter({ dedupe_key: key }, "-created_date", 1).catch(() => []))[0];
    if (ex) { out.push({ id: ex.id, dedupe_key: key, duplicate: true }); continue; }
    // Auto-approve: logged work is finished work. Only a real "failed" or "in_progress" from the caller is kept;
    // anything else (including awaiting_approval) lands as done, so Justin never has to approve ledger rows.
    const status = e.status === "failed" || e.status === "in_progress" ? e.status : "done";
    const realClient = !!cid && cid !== "agency" && clients.some((c: any) => c.id === cid);
    const row: any = {
      client_id: cid || "agency", client_name: cid ? clients.find((c: any) => c.id === cid)?.business || "" : "Interstellar",
      title: clip(e.title, 300), notes: clip(e.notes || e.summary, 1500), evidence: clip(e.evidence, 800), link: isClientSafeUrl(e.link) ? e.link : "",
      task_type: clip(e.task_type, 40) || "other", category: CATEGORIES.includes(e.category) ? e.category : undefined,
      done_by: DONE_BY.includes(e.done_by) ? e.done_by : "claude_session", agent_key: clip(e.agent_key, 120), agent_name: clip(e.agent_name, 120),
      manual_minutes: Math.max(0, Number(e.manual_minutes) || 0), status,
      completed_at: iso(e.completed_at) || new Date().toISOString(), source_type: clip(e.source_type, 40) || "api", source_id: clip(e.source_id, 120),
      dedupe_key: key, processed: true, client_copy_status: e.client_title ? "edited" : "pending",
      ...(e.client_title ? { client_title: clip(e.client_title, 120), client_summary: clip(e.client_summary, 400) } : {}),
      ...(Number(e.minutes_baseline) > 0 ? { minutes_baseline: Number(e.minutes_baseline), baseline_override: true } : {}),
      ...(e.visibility === "internal" || e.visibility === "client" ? { visibility: e.visibility, visibility_locked: true, visibility_reason: "Set when logged" } : {}),
    };
    Object.assign(row, normalize(row, cfg));
    if (CATEGORIES.includes(e.category)) row.category = e.category; // an explicit category from the caller wins
    // Visibility default: a real client's finished work is client-visible; Interstellar's own work is internal. Locked
    // so a later re-normalize doesn't pull it back by category. Guards that still apply: a money / security title stays
    // internal, the copy writer's client_safe=false and copyProblems checks keep the row's copy off the portal
    // (client_copy_status "skipped", no client_title), and the portal only shows rows with a client_title.
    if (!(e.visibility === "internal" || e.visibility === "client")) {
      const sensitive = sensitiveTitle(row.title);
      if (!realClient) Object.assign(row, { visibility: "internal", visibility_reason: "Interstellar's own work", visibility_locked: true });
      else if (sensitive || status !== "done") Object.assign(row, { visibility: "internal", visibility_reason: sensitive || "Not finished yet" });
      else Object.assign(row, { visibility: "client", visibility_reason: "Client work, auto-approved when logged", visibility_locked: true });
    }
    // Minutes: given minutes count as confirmed; missing ones get Justin's directing/review estimate for the task type
    // (by-hand rows keep the full baseline from normalize; agent / scheduled runs take none of Justin's time).
    if (Number(e.manual_minutes) > 0) {
      row.notes = withConfirmMark(row.notes);
    } else if (row.done_by === "claude_session" || row.done_by === "team") {
      const est = directingMinutes(row.task_type, row.minutes_baseline);
      row.manual_minutes = est;
      row.notes = withConfirmMark(`${row.notes ? `${row.notes} ` : ""}Directing time auto-filled from the task type (${est} min).`);
    } else {
      row.notes = withConfirmMark(row.notes);
    }
    row.minutes_saved_estimate = savedMinutes(row);
    const created = await db.WorkEntry.create(row);
    out.push({ id: created.id, dedupe_key: key, status: row.status, visibility: row.visibility, manual_minutes: row.manual_minutes, minutes_saved_estimate: row.minutes_saved_estimate });
  }
  return out;
}

// ---------------------------------------------------------------- summary
function summarize(rows: any[], rate: number) {
  const done = rows.filter((r) => r.status === "done");
  const now = new Date();
  const la = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const weekStart = new Date(la); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const monthStart = new Date(la.getFullYear(), la.getMonth(), 1);
  const offset = now.getTime() - la.getTime();
  const since = (d: Date) => done.filter((r) => r.completed_at && new Date(r.completed_at).getTime() >= d.getTime() + offset);
  const tot = (xs: any[]) => {
    const saved = xs.reduce((s, r) => s + (Number(r.minutes_saved_estimate) || savedMinutes(r)), 0) / 60;
    const manual = xs.filter((r) => r.done_by === "justin_manual").reduce((s, r) => s + (Number(r.manual_minutes) || 0), 0) / 60;
    const split: Record<string, number> = {};
    for (const r of xs) split[r.done_by || "claude_session"] = (split[r.done_by || "claude_session"] || 0) + 1;
    return { tasks: xs.length, hours_saved: Math.round(saved * 10) / 10, value_usd: Math.round(saved * rate), justin_manual_hours: Math.round(manual * 10) / 10, by_done_by: split };
  };
  return { hourly_rate: rate, week: tot(since(weekStart)), month: tot(since(monthStart)), all_time: tot(done), estimates: true };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : Object.fromEntries(new URL(req.url).searchParams);
    const action = String(body?.action || "summary");
    const db = base44.asServiceRole.entities;
    const user = await base44.auth.me().catch(() => null);
    const ingestKey = getSecret("MOTHERSHIP_INGEST_KEY");
    const keyOk = !!ingestKey && req.headers.get("x-mothership-key") === ingestKey;
    const isAdmin = user?.role === "admin";

    if (action === "sync") {
      // Safe without a user (hourly workflow): it only reads Møthership records and writes WorkEntry rows.
      if (user && !isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
      return Response.json(await sync(db, base44, user));
    }
    if (action === "log") {
      if (!isAdmin && !keyOk) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const list = Array.isArray(body.entries) ? body.entries : body.entry ? [body.entry] : [];
      if (!list.length) return Response.json({ error: "Send entry or entries" }, { status: 400 });
      const results = await logEntries(db, list);
      const created = results.filter((r: any) => r.id && !r.duplicate).map((r: any) => r.id);
      const copy = created.length ? await processPending(db, base44, isAdmin ? user : null, { ids: created, limit: 24 }) : null;
      return Response.json({ ok: true, results, copy });
    }
    if (action === "summary") {
      if (!isAdmin && !keyOk) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const cfg = await loadConfig(db);
      return Response.json(summarize(await all(db.WorkEntry, {}, "-completed_at", 500, 20000), cfg.hourly_rate));
    }
    if (!isAdmin) return Response.json({ error: user ? "Forbidden" : "Unauthorized" }, { status: user ? 403 : 401 });

    if (action === "process") return Response.json(await processPending(db, base44, user, { ids: Array.isArray(body.ids) ? body.ids : undefined, limit: Math.min(96, Number(body.limit) || 48) }));
    if (action === "copy") {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
      if (!ids.length) return Response.json({ error: "ids required" }, { status: 400 });
      await Promise.all(ids.map((id: string) => db.WorkEntry.update(id, { client_copy_status: "pending" }).catch(() => null)));
      return Response.json(await processPending(db, base44, user, { ids, limit: 48 }));
    }
    if (action === "config") {
      const cfg = await loadConfig(db);
      if (body.rows || body.hourly_rate) {
        const rows = arr(body.rows).filter((r: any) => r && r.key).map((r: any) => ({ key: clip(r.key, 40), label: clip(r.label, 120), category: CATEGORIES.includes(r.category) ? r.category : "ops", minutes: Math.max(0, Math.round(Number(r.minutes) || 0)) }));
        const pageSettings = { rows: rows.length ? rows : cfg.rows.map(({ key, label, category, minutes }: any) => ({ key, label, category, minutes })), hourly_rate: Number(body.hourly_rate) > 0 ? Number(body.hourly_rate) : cfg.hourly_rate, updated_by: user.email, updated_at: new Date().toISOString() };
        if (cfg.id) await db.AppSettings.update(cfg.id, { pageSettings });
        else await db.AppSettings.create({ key: "work_baselines", pageSettings });
        // Re-apply the new estimates to every row that doesn't carry its own override.
        const next = await loadConfig(db);
        let changed = 0;
        for (const r of await all(db.WorkEntry, { baseline_override: { $ne: true } }, "-created_date", 500, 20000)) {
          const b = next.map.get(r.task_type);
          if (!b || Number(r.minutes_baseline) === b.minutes) continue;
          // Justin's own minutes were only estimated (= the old baseline) unless he entered them; keep entered ones.
          const followManual = r.done_by === "justin_manual" && Number(r.manual_minutes) === Number(r.minutes_baseline);
          const m = { ...r, minutes_baseline: b.minutes, ...(followManual ? { manual_minutes: b.minutes } : {}) };
          await db.WorkEntry.update(r.id, { minutes_baseline: b.minutes, minutes_saved_estimate: savedMinutes(m), ...(followManual ? { manual_minutes: b.minutes } : {}) });
          changed++;
        }
        return Response.json({ ok: true, rows: next.rows, hourly_rate: next.hourly_rate, updated: changed });
      }
      return Response.json({ rows: cfg.rows, hourly_rate: cfg.hourly_rate, updated_at: cfg.updated_at, defaults: DEFAULT_BASELINES });
    }
    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    console.error("work-ledger", (e as Error)?.message);
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
