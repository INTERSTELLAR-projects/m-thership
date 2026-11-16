// Launch Week core for the browser (QA mode and offline). Generated from base44/shared/launchWeek.js:
// edit that file, then run npm run sync:launchweek.
// ---- shared body below (keep identical) ----

export const LW_SLUGS = ["powerlift", "redline", "smallcakes", "north-woods", "chasing-gains", "bobablastic", "bulba-bros"];
// Fallback mapping when an audit file has no client_name / app_id the CRM recognises.
export const LW_CLIENTS = {
  powerlift: { client_id: "6a6c13548653b2e1e6c3de46", client_name: "PowerLift Doors of Oregon" },
  redline: { client_id: "69d884d30f93ad2e14bbbeb3", client_name: "Redline Visuals" },
  smallcakes: { client_id: "6aebc2933e7ada5fece300d8", client_name: "Smallcakes Baton Rouge" },
  "north-woods": { client_id: "69d884d38fe4bacbc82853ac", client_name: "North Woods Tree Service" },
  "chasing-gains": { client_id: "69d884d3dd31b39b6a77c7cd", client_name: "Chasing Gains Coaching" },
  bobablastic: { client_id: "6a28bfea1bde8e3ea488f04d", client_name: "Bobablastic (Molalla)" },
  "bulba-bros": { client_id: "6a3c9320b05f612c08347d74", client_name: "The Bulba Bros" },
};
export const LW_STATUSES = ["open", "answered", "ask_client", "skipped"];

// Cross-client questions: asked in every pack, shown once (slug "all"), answered once, applied to every site it covers.
// Each pack's own wording and apply_to are kept on the shared row's covers[].
export const LW_ALL = "all";
export const LW_CROSS = [{
  key: "ga4",
  match: /\bga4\b|google analytics/i,
  question: "Add Interstellar-owned GA4 to every launch site (and verify Search Console wherever it isn't set up yet)?",
  default_answer: "Yes: Interstellar-owned GA4 on every site, lead and booking forms marked as key events, and Search Console verified wherever it isn't already",
  options: ["Yes, Interstellar-owned GA4 on all of them", "Use the client's own GA4 where they already have one", "Skip analytics for now"],
  category: "seo",
}];
export const lwCrossOf = (q) => LW_CROSS.find((c) => c.match.test(s(q?.question))) || null;
export function lwCrossRow(def, covers, now = new Date().toISOString()) {
  const n = covers.length;
  return {
    question_id: `${LW_ALL}:${def.key}`, source_id: def.key, slug: LW_ALL, scope: "all", client_id: "", client_name: `All ${n} sites`, app_id: "",
    question: def.question, default_answer: def.default_answer, options: def.options, category: def.category,
    blocks_launch: covers.some((c) => c.blocks_launch), apply_to: `Every site: ${covers.map((c) => c.client_name).join(", ")}`.slice(0, 300),
    covers, order: -1, imported_at: now,
  };
}

const s = (v) => (v == null ? "" : String(v)).trim();
const arr = (v) => (Array.isArray(v) ? v : v == null || v === "" ? [] : [v]);
const rowsOf = (r) => (Array.isArray(r) ? r : (r && r.items) || []);
const bool = (v) => v === true || v === "true" || v === 1 || v === "yes";

export const lwQuestionId = (slug, id, i = 0) => {
  let raw = s(id) || `q${i + 1}`;
  if (raw.startsWith(`${slug}:`)) return raw;
  if (raw.startsWith(`${slug}-`)) raw = raw.slice(slug.length + 1); // "powerlift-q1" -> "powerlift:q1"
  return `${slug}:${raw}`;
};
export const lwQuestionKey = (questionId) => `launchweek.${questionId}`;

// Match the audit file to a CRM client: by site app id, then by name, then by the slug table.
export function lwResolveClient(json, slug, clients = []) {
  const fb = LW_CLIENTS[slug] || {};
  const appId = s(json?.app_id);
  const name = s(json?.client_name);
  const norm = (t) => s(t).toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, " ").replace(/^the /, "").trim();
  const c = (appId && clients.find((x) => s(x.site_app_id) === appId))
    || (name && clients.find((x) => norm(x.business) === norm(name)))
    || (fb.client_id && clients.find((x) => x.id === fb.client_id)) || null;
  return { client_id: c?.id || fb.client_id || "", client_name: c?.business || name || fb.client_name || slug, logo_url: s(c?.logo_url), app_id: appId || s(c?.site_app_id) };
}

// One audit file -> the status row and the question rows (not yet saved).
export function lwNormalize(json, slug, client, { now = new Date().toISOString(), screenshots } = {}) {
  const status = {
    slug, client_id: client.client_id, client_name: client.client_name, app_id: client.app_id, logo_url: client.logo_url || "",
    preview_url: s(json?.preview_url), launch_readiness_pct: Math.max(0, Math.min(100, Math.round(Number(json?.launch_readiness_pct) || 0))),
    status_summary: s(json?.status_summary).slice(0, 2000), done: arr(json?.done).map(s).filter(Boolean).slice(0, 60),
    blocking: arr(json?.blocking).map(s).filter(Boolean).slice(0, 60), screenshots: arr(screenshots ?? []).map(s).filter((u) => /^https?:\/\//.test(u)).slice(0, 8),
    order: LW_SLUGS.includes(slug) ? LW_SLUGS.indexOf(slug) : Number(json?.order) || 0, imported_at: now,
  };
  const seen = new Set();
  const questions = [];
  const cross = [];
  arr(json?.questions).forEach((q, i) => {
    if (!q || !s(q.question)) return;
    const question_id = lwQuestionId(slug, q.id, i);
    if (seen.has(question_id)) return;
    seen.add(question_id);
    const def = lwCrossOf(q);
    if (def) {
      cross.push({ key: def.key, cover: { slug, client_id: client.client_id, client_name: client.client_name, app_id: client.app_id, question_id, question: s(q.question).slice(0, 1000), apply_to: s(Array.isArray(q.apply_to) ? q.apply_to.join(", ") : q.apply_to).slice(0, 300), blocks_launch: bool(q.blocks_launch) } });
      return;
    }
    questions.push({
      question_id, source_id: s(q.id) || `q${i + 1}`, slug, client_id: client.client_id, client_name: client.client_name, app_id: client.app_id,
      question: s(q.question).slice(0, 1000), default_answer: s(q.default_answer).slice(0, 1000),
      options: arr(q.options).map(s).filter(Boolean).slice(0, 8), blocks_launch: bool(q.blocks_launch), category: s(q.category).slice(0, 60),
      apply_to: s(Array.isArray(q.apply_to) ? q.apply_to.join(", ") : q.apply_to).slice(0, 300), order: i, imported_at: now,
    });
  });
  return { status, questions, cross };
}

// Pure upsert plan. Re-imports refresh the wording but never touch Justin's answer or status.
export const LW_IMPORT_FIELDS = ["source_id", "slug", "client_id", "client_name", "app_id", "question", "default_answer", "options", "blocks_launch", "category", "apply_to", "order", "imported_at"];
export function lwPlanUpsert(existing, incoming) {
  const byKey = new Map();
  for (const r of existing || []) if (r?.question_id && !byKey.has(r.question_id)) byKey.set(r.question_id, r);
  const create = [], update = [];
  for (const q of incoming || []) {
    const old = byKey.get(q.question_id);
    if (!old) { create.push({ ...q, status: "open" }); continue; }
    const patch = {};
    for (const k of LW_IMPORT_FIELDS) if (k !== "imported_at" && JSON.stringify(old[k] ?? null) !== JSON.stringify(q[k] ?? null)) patch[k] = q[k];
    if (Object.keys(patch).length) update.push({ id: old.id, patch: { ...patch, imported_at: q.imported_at } });
  }
  return { create, update };
}

export async function lwImport(db, json, slug, { clients = [], now, screenshots, anySlug = false } = {}) {
  if (!anySlug && !LW_SLUGS.includes(slug)) throw new Error(`Unknown launch-week client: ${slug}`);
  const client = lwResolveClient(json, slug, clients);
  const { status, questions, cross } = lwNormalize(json, slug, client, { now, screenshots });
  const existing = rowsOf(await db.LaunchQuestion.filter({ slug }, "order", 500));
  const plan = lwPlanUpsert(existing, questions);
  for (const r of plan.create) await db.LaunchQuestion.create(r);
  for (const u of plan.update) await db.LaunchQuestion.update(u.id, u.patch);
  const prev = rowsOf(await db.LaunchClientStatus.filter({ slug }, "-created_date", 5))[0];
  if (!status.screenshots.length && prev?.screenshots?.length) status.screenshots = prev.screenshots;
  const st = prev ? await db.LaunchClientStatus.update(prev.id, status) : await db.LaunchClientStatus.create(status);
  // Shared cross-client rows: add or refresh this site's cover; never touch the answer.
  for (const { key, cover } of cross) {
    const def = LW_CROSS.find((d) => d.key === key);
    const old = rowsOf(await db.LaunchQuestion.filter({ question_id: `${LW_ALL}:${key}` }, "-created_date", 5))[0];
    const covers = [...(old?.covers || []).filter((c) => c.slug !== slug), cover].sort((a, b) => LW_SLUGS.indexOf(a.slug) - LW_SLUGS.indexOf(b.slug));
    const row = lwCrossRow(def, covers, now);
    if (old) await db.LaunchQuestion.update(old.id, { covers: row.covers, client_name: row.client_name, blocks_launch: row.blocks_launch, apply_to: row.apply_to, question: row.question, default_answer: row.default_answer, options: row.options, imported_at: row.imported_at });
    else await db.LaunchQuestion.create({ ...row, status: "open" });
  }
  return { slug, client_name: client.client_name, created: plan.create.length, updated: plan.update.length, total: questions.length, cross: cross.map((c) => c.key), status_id: prev?.id || st?.id };
}

// ---------------------------------------------------------------- progress
export function lwProgress(rows) {
  const r = rows || [];
  const count = (f) => r.filter(f).length;
  const blocking = r.filter((q) => q.blocks_launch);
  return {
    total: r.length, answered: count((q) => q.status === "answered"), open: count((q) => !q.status || q.status === "open"),
    ask_client: count((q) => q.status === "ask_client"), skipped: count((q) => q.status === "skipped"),
    resolved: count((q) => q.status === "answered" || q.status === "skipped"),
    blocking_total: blocking.length, blocking_answered: blocking.filter((q) => q.status === "answered").length,
  };
}
// Ready for the agent: every blocks_launch question answered; with none marked blocking, every question settled
// (answered or skipped) and at least one answer to apply.
export function lwReadyForJob(rows) {
  const r = rows || [];
  if (!r.some((q) => q.status === "answered")) return false;
  const blocking = r.filter((q) => q.blocks_launch);
  if (blocking.length) return blocking.every((q) => q.status === "answered");
  return r.every((q) => q.status === "answered" || q.status === "skipped");
}

// ---------------------------------------------------------------- answers -> Brain
export function lwPillar(category) {
  const c = s(category).toLowerCase();
  if (/seo|marketing|social|gbp|google business|review|content|blog/.test(c)) return "marketing";
  if (/pric|offer|sales|package|checkout|payment/.test(c)) return "sales";
  return "delivery";
}
// One-tap answers become a self-contained fact; dictated answers keep the cleaned sentences Justin confirmed.
export function lwStatements(row, { statements, mode }, clientName = row.client_name, note = "") {
  const list = arr(statements).map(s).filter(Boolean).slice(0, 3);
  if (mode === "default" || mode === "option") {
    const q = s(row.question).replace(/\s+/g, " ").replace(/\?+$/, "");
    return [`${clientName} website launch${note}: ${q}? ${list.join(" ") || s(row.default_answer)}`.slice(0, 1000)];
  }
  return list.map((x) => x.slice(0, 1000));
}

const CRED = /password|passcode|\bpin\b\s*[:=]?\s*\d{3,}/i;
export async function lwAnswer(db, id, { statements, raw_text, mode = "typed", today, now = new Date().toISOString() } = {}) {
  const row = await db.LaunchQuestion.get(id);
  if (!row) throw new Error("Question not found");
  const facts = lwStatements(row, { statements, mode });
  if (!facts.length) throw new Error("Say or type an answer");
  const raw = s(raw_text) || arr(statements).map(s).join(" ");
  if (CRED.test(`${raw} ${facts.join(" ")}`) && /\d{3,}|[:=]/.test(raw)) throw new Error("That looks like a password or PIN. Never store credentials here: say where they live instead.");
  const answer = (mode === "default" || mode === "option") ? (arr(statements).map(s).filter(Boolean).join(" ") || s(row.default_answer)) : facts.join(" ");
  // Supersede the facts from an earlier answer to the same question, then save the new ones.
  const key = lwQuestionKey(row.question_id);
  const old = rowsOf(await db.BrainFact.filter({ question_key: key, status: "active" }, "-created_date", 20).catch(() => []));
  for (const f of old) await db.BrainFact.update(f.id, { status: "superseded" }).catch(() => null);
  const pillar = lwPillar(row.category);
  const ids = [];
  // A cross-client answer files the fact in every covered client's Brain.
  const targets = row.slug === LW_ALL ? (row.covers || []).map((c) => ({ client_name: c.client_name, slug: c.slug })) : [{ client_name: row.client_name, slug: row.slug }];
  const note = row.slug === LW_ALL ? ` (same answer for all ${targets.length} launch sites)` : "";
  for (const t of targets) {
    for (const statement of (row.slug === LW_ALL ? lwStatements(row, { statements, mode }, t.client_name, note) : facts)) {
      const f = await db.BrainFact.create({ pillar, statement, raw_text: raw.slice(0, 4000), client_name: t.client_name, question_key: key, question: s(row.question).slice(0, 400), source: "interview", confidence: "high", date: today || now.slice(0, 10), status: "active", data: { launch_week: true, slug: t.slug, question_id: row.question_id, mode, ...(note ? { all_sites: true } : {}) } });
      if (f?.id) ids.push(f.id);
    }
  }
  const updated = await db.LaunchQuestion.update(id, { status: "answered", answer: answer.slice(0, 4000), raw_text: raw.slice(0, 4000), answer_mode: mode, answered_at: now, brain_fact_ids: ids });
  const jobs = [];
  for (const t of targets) { const j = await lwMaybeQueueJob(db, t.slug, { now }); if (j) jobs.push({ ...j, slug: t.slug, client_name: t.client_name }); }
  return { question: { ...row, ...(updated || {}), status: "answered", answer, answer_mode: mode, answered_at: now, brain_fact_ids: ids }, facts: ids, job: jobs.find((j) => j.created) || jobs[0] || null, jobs };
}

export async function lwSetStatus(db, id, status) {
  if (!["open", "ask_client", "skipped"].includes(status)) throw new Error("Unknown status");
  const row = await db.LaunchQuestion.get(id);
  if (!row) throw new Error("Question not found");
  const patch = { status };
  if (status !== "answered" && row.status === "answered") {
    for (const fid of row.brain_fact_ids || []) await db.BrainFact.update(fid, { status: "superseded" }).catch(() => null);
    Object.assign(patch, { answer: "", raw_text: "", brain_fact_ids: [] });
  }
  await db.LaunchQuestion.update(id, patch);
  const jobs = [];
  if (status === "skipped") {
    const slugs = row.slug === LW_ALL ? (row.covers || []).map((c) => [c.slug, c.client_name]) : [[row.slug, row.client_name]];
    for (const [sl, name] of slugs) { const j = await lwMaybeQueueJob(db, sl, {}); if (j) jobs.push({ ...j, slug: sl, client_name: name }); }
  }
  return { question: { ...row, ...patch }, job: jobs.find((j) => j.created) || jobs[0] || null, jobs };
}

// ---------------------------------------------------------------- the Claude job
export const LW_JOB_RULES = [
  "Work only in the client website app named below. Edit the code, preview and verify; checkpoint when done.",
  "Do NOT publish or deploy, change domains, delete data, or add secrets or API keys. Publishing is Justin's step.",
  "Never show the builder platform's name in client-facing UI. Use ™, never ®.",
  "Apply each answer exactly where 'Apply to' says. When an answer conflicts with the live content, follow the answer and note it.",
  "Questions marked 'Ask client' or 'Skipped' are not decided: leave those parts as they are and list them under needs_from_justin.",
  "Do not invent prices, hours, addresses, phone numbers or claims. If a fact is missing, list it under needs_from_justin.",
  "Brand gradient for Interstellar work: #ff3c00 → #ff6a00 → #ffaa00. Client sites keep their own brand.",
];
export function lwJobTitle(clientName) { return `Apply launch answers to ${clientName} site`; }
export function lwJobBrief(st, rows) {
  const L = [];
  L.push(`# ${lwJobTitle(st.client_name)}`, "", "Launch Week (Nov 16-17, 2026). Justin answered the questions from the site audit. Apply every answer to the site so it is ready to launch, then stop for his approval.", "");
  L.push("## Site");
  [["Client", st.client_name], ["Website app id", st.app_id], ["Preview", st.preview_url], ["Readiness at audit", st.launch_readiness_pct != null ? `${st.launch_readiness_pct}%` : ""], ["Status at audit", st.status_summary]].forEach(([k, v]) => v && L.push(`- ${k}: ${v}`));
  if (st.blocking?.length) { L.push("", "## Blocking launch at audit"); st.blocking.forEach((b) => L.push(`- ${b}`)); }
  const ans = (rows || []).filter((q) => q.status === "answered");
  L.push("", "## Answers to apply");
  ans.forEach((q, i) => {
    L.push(`${i + 1}. ${q.question}${q.blocks_launch ? " (blocks launch)" : ""}${q.all_sites ? " (one answer for every launch site)" : ""}`);
    L.push(`   - Answer: ${q.answer}`);
    if (q.apply_to) L.push(`   - Apply to: ${q.apply_to}`);
    if (q.category) L.push(`   - Category: ${q.category}`);
  });
  const later = (rows || []).filter((q) => q.status === "ask_client" || q.status === "skipped" || !q.status || q.status === "open");
  if (later.length) { L.push("", "## Not decided yet (leave as is)"); later.forEach((q) => L.push(`- [${q.status === "ask_client" ? "Ask client" : q.status === "skipped" ? "Skipped" : "Open"}] ${q.question}`)); }
  L.push("", "## Rules", ...LW_JOB_RULES.map((r) => `- ${r}`));
  L.push("", "## When you finish", "Set result_summary (what changed), result_body (markdown, per answer: done / changed where), result_links (preview), needs_from_justin (anything left), status needs_approval.");
  return L.join("\n");
}
export function lwJobContext(st, rows) {
  return {
    stream: "launch_week", slug: st.slug, app_id: st.app_id, preview_url: st.preview_url,
    answers: (rows || []).filter((q) => q.status === "answered").map((q) => ({ question_id: q.question_id, question: q.question, answer: q.answer, apply_to: q.apply_to, blocks_launch: !!q.blocks_launch, category: q.category, ...(q.all_sites ? { all_sites: true } : {}) })),
  };
}
// Queue the job once per client when it is ready; while still queued, later answers refresh its brief.
export async function lwMaybeQueueJob(db, slug, { now = new Date().toISOString() } = {}) {
  if (!slug || slug === LW_ALL) return null;
  const rows = rowsOf(await db.LaunchQuestion.filter({ slug }, "order", 500));
  // Cross-client answers ride along in every covered site's bundle, with that site's own apply_to.
  const cross = rowsOf(await db.LaunchQuestion.filter({ slug: LW_ALL }, "order", 50).catch(() => []))
    .map((q) => ({ q, c: (q.covers || []).find((c) => c.slug === slug) })).filter((x) => x.c)
    .map(({ q, c }) => ({ ...q, question: c.question || q.question, apply_to: c.apply_to || q.apply_to, all_sites: true }));
  const bundle = [...cross, ...rows];
  const st = rowsOf(await db.LaunchClientStatus.filter({ slug }, "-created_date", 5))[0]
    || (rows[0] ? { slug, client_id: rows[0].client_id, client_name: rows[0].client_name, app_id: rows[0].app_id } : null);
  if (!st) return null;
  const title = lwJobTitle(st.client_name);
  let job = st.job_id ? await db.ClaudeJob.get(st.job_id).catch(() => null) : null;
  if (!job) job = rowsOf(await db.ClaudeJob.filter({ title }, "-created_date", 5).catch(() => [])).find((j) => j.status !== "cancelled") || null;
  if (job) {
    if (job.status === "queued") {
      await db.ClaudeJob.update(job.id, { instructions: lwJobBrief(st, bundle), context: lwJobContext(st, bundle) });
      return { id: job.id, status: "queued", refreshed: true };
    }
    return { id: job.id, status: job.status, refreshed: false };
  }
  if (!lwReadyForJob(rows)) return null;
  const created = await db.ClaudeJob.create({
    title, kind: "build_website", client_id: st.client_id, client_name: st.client_name, instructions: lwJobBrief(st, bundle),
    status: "queued", priority: 1, requested_at: now, complete_task_on_approve: false, context: lwJobContext(st, bundle),
  });
  if (st.id && created?.id) await db.LaunchClientStatus.update(st.id, { job_id: created.id, job_queued_at: now });
  return { id: created?.id, status: "queued", created: true };
}

// ---------------------------------------------------------------- the Ask client text
export function lwAskClientText(clientName, rows, contactFirstName = "") {
  const qs = (rows || []).filter((q) => q.status === "ask_client");
  if (!qs.length) return "";
  const hi = contactFirstName ? `Hi ${contactFirstName}!` : "Hi!";
  const lines = [`${hi} A few quick questions so we can finish the new ${clientName} website:`, ""];
  qs.forEach((q, i) => lines.push(`${i + 1}. ${q.question}${q.options?.length ? ` (${q.options.join(" / ")})` : ""}`));
  lines.push("", "Reply here whenever works. Thank you!");
  return lines.join("\n");
}
