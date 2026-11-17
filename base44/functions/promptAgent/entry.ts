// Playbooks prompt agent (Møthership > Agents > Playbooks). The "prompt CEO": learns how Justin builds from his
// PromptLogs and keeps a better foundation prompt ready for every area of work. Built-in InvokeLLM only.
// It NEVER approves anything: patterns become standards and drafts become live prompts only through Justin's
// approve_* calls from the Playbooks page.
//
// Admin actions (signed-in admin):
//   sync_checks                        add a StandardCheck (status unknown, never guessed) for every active standard x client site/app missing one
//   cluster                            group unclustered PromptLogs into PromptPatterns, recount, propose (3+ times or 2+ clients)
//   draft      { area_id? }            draft new FoundationPrompt versions folding approved (standard) patterns in
//   draft_variant { area_id, industry } draft an industry variant of the area's live prompt
//   approve_pattern { pattern_id, title?, rule?, how_to_check?, kind? }  -> FoundationStandard + unknown checks
//   reject_pattern  { pattern_id }
//   approve_prompt  { prompt_id }      -> live; retires the previous live version for that area + industry
//   reject_prompt   { prompt_id, note? }
//   status                             last run summary
// Workflow "Playbooks — weekly prompt agent" (no signed-in user): weekly_sync, weekly_cluster, weekly_draft, each at most once per 5 days.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { arr, cut, nowIso, industryGroup, checkKindFor, listAll, createMany } from "../../shared/playbooks.ts";
import { SEED_INDUSTRIES, AREA_BRIEFS, SEED_HOUSE } from "../../shared/playbookSeed.ts";

// Apps that are never part of the standards matrix (Justin, Nov 17 2026): onboarding forms and side tools.
const EXCLUDED_APP_IDS = new Set(["6adff43533bf116e5c3f014b" /* Smallcakes Onboarding */, "6abec94ea33d526bb1fcffd1" /* SMPL Projects */]);

const MODEL = "claude_sonnet_4_6";
const STATE_KEY = "playbooks_agent";
const WEEK = 5 * 86400000; // scheduled steps run at most once per 5 days (a manual run mid-week never blocks Monday's run)

const HOUSE = `House rules for anything you write:
- Trademarks use ™, never ®.
- Never name the hosting/builder platform (say "the platform"); never mention "Base44" or base44.app.
- Never include passwords, keys, tokens or credentials. Never invent client facts, stats, reviews or prices.
- Plain, direct English. Keep [PLACEHOLDERS] for client-specific facts.`;

async function getState(db: any) {
  const row = (await listAll(db.AppSettings, { key: STATE_KEY }, "-updated_date", 1))[0] || null;
  return { row, ps: (row && row.pageSettings) || {} };
}
async function saveState(db: any, row: any, ps: any) {
  if (row?.id) return db.AppSettings.update(row.id, { pageSettings: ps });
  return db.AppSettings.create({ key: STATE_KEY, pageSettings: ps });
}
async function recordRun(db: any, step: string, summary: string, extra: Record<string, unknown> = {}) {
  const { row, ps } = await getState(db);
  const runs = arr(ps.runs).slice(-29);
  runs.push({ step, at: nowIso(), summary, ...extra });
  const steps = { ...(ps.steps || {}), [step]: nowIso() };
  await saveState(db, row, { ...ps, runs, steps, last_run_at: nowIso(), last_summary: summary });
  await db.AutomationRun?.create?.({ automation_name: "Playbooks — prompt agent", kind: "other", status: "success", message: `${step}: ${summary}`, started_at: nowIso(), finished_at: nowIso(), processed: true }).catch(() => null);
}

// ---------- standards matrix ----------
async function syncChecks(db: any, onlyStandardId?: string) {
  const [standards, profiles, clients, checks] = await Promise.all([
    listAll(db.FoundationStandard, {}, "order", 1000),
    listAll(db.ClientAppProfile, {}, "client_name", 1000),
    listAll(db.CRMClient, { status: "Active" }, "business", 500),
    listAll(db.StandardCheck, {}, "-created_date", 20000),
  ]);
  const active = standards.filter((s: any) => s.active !== false && (!onlyStandardId || s.id === onlyStandardId));
  const byClient = new Map(clients.map((c: any) => [c.id, c]));
  const have = new Set(checks.map((c: any) => `${c.standard_id}|${c.app_or_site}|${c.client_id}`));
  const targets: any[] = [];
  for (const p of profiles) {
    const c: any = byClient.get(p.client_id);
    if (!c) continue;
    // Only websites and command systems are checked; onboarding / other apps never get StandardChecks.
    if (EXCLUDED_APP_IDS.has(p.app_id) || !(p.kind === "website" || p.kind === "command" || p.combined)) continue;
    const base = { client_id: c.id, client_name: c.business, app_or_site: p.app_id, app_name: p.app_name, industry: industryGroup(c.industry) };
    if (p.kind === "website" || p.combined) targets.push({ ...base, app_kind: "site" });
    if (p.kind === "command") targets.push({ ...base, app_kind: "app" });
  }
  for (const c of clients) targets.push({ client_id: c.id, client_name: c.business, app_or_site: "client", app_name: c.business, industry: industryGroup(c.industry), app_kind: "business" });
  const rows: any[] = [];
  for (const s of active) {
    const want = checkKindFor(s.kind);
    for (const t of targets) {
      if (t.app_kind !== want) continue;
      if (s.industry && industryGroup(s.industry).toLowerCase() !== t.industry.toLowerCase()) continue;
      const k = `${s.id}|${t.app_or_site}|${t.client_id}`;
      if (have.has(k)) continue;
      have.add(k);
      rows.push({ client_id: t.client_id, client_name: t.client_name, app_or_site: t.app_or_site, app_name: t.app_name, app_kind: t.app_kind, standard_id: s.id, status: "unknown" });
    }
  }
  const made = await createMany(db.StandardCheck, rows);
  return { created: made, standards: active.length, targets: targets.length };
}

// ---------- clustering ----------
const CLUSTER_SCHEMA = {
  type: "object",
  properties: {
    new_patterns: { type: "array", items: { type: "object", properties: {
      ref: { type: "string" }, area_id: { type: "string" }, title: { type: "string" }, rule: { type: "string" },
      kind: { type: "string", enum: ["website", "app", "brand", "account", "mappack", "other"] }, how_to_check: { type: "string" },
      covered_by: { type: "string", description: "Id of an existing standard that already covers this pattern, else empty" },
    }, required: ["ref", "title", "rule"] } },
    assignments: { type: "array", items: { type: "object", properties: { log_id: { type: "string" }, pattern: { type: "string" } }, required: ["log_id", "pattern"] } },
  },
  required: ["assignments"],
};

async function recount(db: any) {
  const [patterns, logs] = await Promise.all([listAll(db.PromptPattern, {}, "-updated_date", 2000), listAll(db.PromptLog, {}, "said_at", 10000)]);
  let proposed = 0;
  for (const p of patterns) {
    const mine = logs.filter((l: any) => l.pattern_id === p.id);
    if (!mine.length && !p.count) continue;
    const clients = [...new Set(mine.map((l: any) => l.client_name).filter(Boolean))] as string[];
    const times = mine.map((l: any) => l.said_at || l.created_date).filter(Boolean).sort();
    const quotes = [...new Set(mine.map((l: any) => cut(l.text, 140)))].slice(-5);
    const patch: any = { count: mine.length, clients, example_quotes: quotes, first_seen: times[0] || p.first_seen, last_seen: times[times.length - 1] || p.last_seen };
    // Patterns already covered by an existing standard are tracked but never re-proposed.
    if ((p.status || "watching") === "watching" && !p.standard_id && (mine.length >= 3 || clients.length >= 2)) { patch.status = "proposed"; proposed++; }
    await db.PromptPattern.update(p.id, patch);
  }
  return proposed;
}

async function cluster(base44: any, db: any) {
  const [areas, patterns, logs, standards] = await Promise.all([
    listAll(db.PlaybookArea, {}, "order", 100),
    listAll(db.PromptPattern, {}, "-last_seen", 400),
    listAll(db.PromptLog, {}, "-said_at", 3000),
    listAll(db.FoundationStandard, {}, "order", 1000),
  ]);
  const stdIds = new Set(standards.map((s: any) => s.id));
  const todo = logs.filter((l: any) => !l.pattern_id).slice(0, 80);
  if (!todo.length) { const proposed = await recount(db); return { clustered: 0, new_patterns: 0, proposed }; }
  const prompt = `You are the Prompt Agent inside Møthership, Justin's agency command app. Justin (Interstellar Strategies) builds client websites and apps.
Group his requests into repeated PATTERNS: things he asks for again and again (especially in tweak/polish rounds) that should become a standard baked into every future build.

AREAS (id: name):
${areas.map((a: any) => `${a.id}: ${a.name} (${a.kind})`).join("\n")}

EXISTING PATTERNS (id | status | area | title | rule):
${patterns.map((p: any) => `${p.id} | ${p.status} | ${p.area_id || "-"} | ${cut(p.title, 80)} | ${cut(p.rule, 160)}`).join("\n") || "(none yet)"}

STANDARDS ALREADY IN PLACE (id | title | rule):
${standards.filter((s: any) => s.active !== false).map((s: any) => `${s.id} | ${cut(s.title, 60)} | ${cut(s.rule, 140)}`).join("\n") || "(none)"}

NEW REQUESTS (log id | client | phase | area | text):
${todo.map((l: any) => `${l.id} | ${l.client_name || "Interstellar"} | ${l.phase || "-"} | ${l.area_id || "-"} | ${cut(l.text, 300)}`).join("\n")}

Instructions:
- Assign EVERY new request to exactly one pattern: an existing pattern id when it is the same underlying ask (even if worded differently or for another client), or a new pattern ref like "new1".
- Make new patterns general and reusable (not client-specific): title <= 8 words, rule = the standard in one sentence, how_to_check = one sentence. Pick the best area_id and kind.
- When a new pattern is already covered by one of the STANDARDS ALREADY IN PLACE, set covered_by to that standard id (it is tracked, not re-proposed).
- One-off, client-specific requests still get their own pattern (they just won't repeat). Prefer merging into an existing pattern over near-duplicates.
${HOUSE}`;
  const res: any = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, model: MODEL, response_json_schema: CLUSTER_SCHEMA });
  const out = typeof res === "string" ? JSON.parse(res) : res || {};
  const areaIds = new Set(areas.map((a: any) => a.id));
  const refMap = new Map<string, string>();
  let made = 0;
  for (const np of arr(out.new_patterns)) {
    if (!np?.ref || !np?.title) continue;
    const area = areaIds.has(np.area_id) ? np.area_id : "";
    const kind = np.kind || areas.find((a: any) => a.id === area)?.kind || "other";
    const rec = await db.PromptPattern.create({ area_id: area, title: cut(np.title, 120), rule: cut(np.rule, 400), how_to_check: cut(np.how_to_check, 300), kind, status: "watching", count: 0, clients: [], example_quotes: [], standard_id: stdIds.has(np.covered_by) ? np.covered_by : "" });
    refMap.set(np.ref, rec.id);
    made++;
  }
  const known = new Set(patterns.map((p: any) => p.id));
  let clustered = 0;
  const stamp = nowIso();
  for (const a of arr(out.assignments)) {
    const log = todo.find((l: any) => l.id === a?.log_id);
    if (!log) continue;
    const pid = refMap.get(a.pattern) || (known.has(a.pattern) ? a.pattern : "");
    if (!pid) continue;
    const patch: any = { pattern_id: pid, clustered_at: stamp };
    if (!log.area_id) { const p = patterns.find((x: any) => x.id === pid); if (p?.area_id) patch.area_id = p.area_id; }
    await db.PromptLog.update(log.id, patch);
    clustered++;
  }
  const proposed = await recount(db);
  return { clustered, new_patterns: made, proposed, waiting: todo.length - clustered };
}

// ---------- drafting ----------
// Prompts come back in a plain-text envelope, not JSON: long markdown full of quotes breaks JSON output.
const ENVELOPE = `\n\nKeep the body under 1,800 words. Reply in EXACTLY this format and nothing else:\n<<<TITLE>>>\n(title)\n<<<CHANGELOG>>>\n(changelog)\n<<<BODY>>>\n(the complete markdown prompt)\n<<<END>>>`;
async function llmPrompt(base44: any, prompt: string, label: string) {
  const res: any = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt: prompt + ENVELOPE, model: MODEL });
  const text = typeof res === "string" ? res : String(res?.response || res?.text || res?.content || "");
  const m = text.match(/<<<TITLE>>>\s*([\s\S]*?)\s*<<<CHANGELOG>>>\s*([\s\S]*?)\s*<<<BODY>>>\s*([\s\S]*?)\s*<<<END>>>/);
  if (!m) throw new Error(`Incomplete output for ${label} (${text.length} chars)`);
  return { title: m[1].trim(), changelog: m[2].trim(), body: m[3].trim() };
}

async function draftFor(base44: any, db: any, area: any, opts: { industry?: string; patterns: any[]; base: any; versions: any[]; standards: any[]; note?: string }) {
  const industry = opts.industry || "";
  const nextVersion = Math.max(0, ...opts.versions.filter((v: any) => (v.industry || "") === industry).map((v: any) => Number(v.version) || 0)) + 1;
  const prompt = `You are the Prompt Agent ("prompt CEO") in Møthership. You maintain Justin's copy-paste FOUNDATION PROMPT for the area "${area.name}"${industry ? `, industry variant: ${industry}` : ""}.
He pastes it into a builder AI on day one of every new client so his usual tweak-round requests are already done.

CURRENT LIVE PROMPT${opts.base ? ` (v${opts.base.version}${opts.base.industry ? `, ${opts.base.industry}` : ""})` : ""}:
"""
${opts.base ? cut(opts.base.body, 14000) : "(none yet: write the first version)"}
"""

APPROVED PATTERNS TO FOLD IN (Justin approved these as standards):
${opts.patterns.map((p: any) => `- ${p.title}: ${p.rule}${arr(p.example_quotes).length ? ` (he said: "${cut(arr(p.example_quotes)[0], 120)}")` : ""}`).join("\n") || "(none)"}

STANDARDS FOR THIS AREA (must stay covered):
${opts.standards.map((s: any) => `- ${s.title}: ${s.rule}${s.industry ? ` [${s.industry} only]` : ""}`).join("\n") || "(none)"}
${opts.note ? `\nEXTRA INSTRUCTION: ${opts.note}\n` : ""}
Write the next version (v${nextVersion}). Keep the existing structure and everything still true; fold each approved pattern into the right section as a concrete instruction; tighten wording; never drop a standard.${industry ? ` Adapt design direction, page set, schema types and local-search structure to the ${industry} industry.` : ""}
Title: "${area.name}${industry ? ` (${industry})` : ""} — foundation v${nextVersion}". Body: the complete ready-to-paste markdown prompt. Changelog: 2-5 short lines on what changed vs the current version and why.
${HOUSE}`;
  const out = await llmPrompt(base44, prompt, `${area.name}${industry ? ` (${industry})` : ""}`);
  if (!out.body) throw new Error("The model returned no prompt body");
  return db.FoundationPrompt.create({
    area_id: area.id, industry, version: nextVersion, title: cut(out.title || `${area.name} — foundation v${nextVersion}`, 160),
    body: cut(out.body, 40000), changelog: cut(out.changelog, 4000), status: "draft", drafted_by: "prompt_agent",
    based_on_id: opts.base?.id || "", source_pattern_ids: opts.patterns.map((p: any) => p.id),
  });
}

async function draft(base44: any, db: any, onlyArea?: string) {
  const [areas, patterns, prompts, standards] = await Promise.all([
    listAll(db.PlaybookArea, {}, "order", 100), listAll(db.PromptPattern, { status: "standard" }, "-decided_at", 500),
    listAll(db.FoundationPrompt, {}, "-version", 1000), listAll(db.FoundationStandard, {}, "order", 1000),
  ]);
  const stdById = new Map(standards.map((s: any) => [s.id, s]));
  // Fold in only patterns Justin approved into a NEW standard (approved patterns already covered by a seeded standard are in the prompt).
  const foldable = patterns.filter((p: any) => !p.standard_id || (stdById.get(p.standard_id) as any)?.origin_pattern_id === p.id);
  const drafted: any[] = [];
  for (const area of areas) {
    if (onlyArea && area.id !== onlyArea) continue;
    if (drafted.length >= 3) break;
    const versions = prompts.filter((p: any) => p.area_id === area.id);
    const live = versions.find((p: any) => p.status === "approved" && !p.industry) || null;
    const covered = new Set<string>();
    versions.filter((v: any) => v.status === "approved" || (v.status === "draft" && !v.rejected_at)).forEach((v: any) => arr(v.source_pattern_ids).forEach((id: string) => covered.add(id)));
    const fresh = foldable.filter((p: any) => p.area_id === area.id && !covered.has(p.id));
    if (!fresh.length) continue;
    const rec = await draftFor(base44, db, area, { patterns: fresh, base: live, versions, standards: standards.filter((s: any) => s.area_id === area.id && s.active !== false) });
    drafted.push({ area: area.name, prompt_id: rec.id, version: rec.version, patterns: fresh.length });
  }
  return { drafted };
}

// ---------- one-time seed: generic v1 for empty areas + industry versions of every area (all drafts) ----------
async function seedOne(base44: any, db: any, x: any, ctx: any) {
  const { area, industry, ind } = x;
  const areaPrompts = ctx.prompts.filter((p: any) => p.area_id === area.id);
  const base = areaPrompts.find((p: any) => p.status === "approved" && !p.industry) || areaPrompts.filter((p: any) => !p.industry && p.status === "draft").sort((a: any, b: any) => (b.version || 0) - (a.version || 0))[0] || null;
  const standards = ctx.standards.filter((s: any) => s.area_id === area.id && s.active !== false);
  const brief = AREA_BRIEFS[area.slug] || area.description || "";
  let prompt: string;
  if (!industry) {
    prompt = `You are the Prompt Agent ("prompt CEO") in Møthership for Interstellar Strategies, Justin's full-stack digital agency (web design/dev, SEO incl. AIO/GEO/AEO and local SEO, Google Business Profiles, automation, custom apps).
Write v1 of the copy-paste FOUNDATION PROMPT for the area "${area.name}". Justin pastes it into an AI agent on day one for a new client so the work comes out at his standard without tweak rounds.

WHAT THIS AREA COVERS (Justin's standards + current best practice):
${brief}

STANDARDS FOR THIS AREA:
${standards.map((s: any) => `- ${s.title}: ${s.rule}`).join("\n") || "(none yet)"}

${SEED_HOUSE}

STYLE REFERENCE: an approved foundation prompt from another area (match its structure, tone and completeness, not its content):
"""
${cut(ctx.reference?.body, 5000)}
"""

Write a complete, ready-to-paste prompt in markdown: a title line, a one-paragraph brief with [CLIENT], [INDUSTRY], [CITY, STATE], [DOMAIN] placeholders, numbered sections with concrete instructions and checklists using current best practices, a "Do not" section, and a "Report" section. Do not name specific clients.
Title: "${area.name} — foundation v1". Changelog: one line on what this first version establishes.`;
  } else {
    const glances = ind.clients.map((n: string) => {
      const b = ctx.brains.find((br: any) => String(br.client_name || "").toLowerCase() === n.toLowerCase());
      return b?.glance ? `### ${n}\n${cut(b.glance, 700)}` : "";
    }).filter(Boolean).join("\n\n");
    prompt = `You are the Prompt Agent ("prompt CEO") in Møthership for Interstellar Strategies (full-stack digital agency).
Write the INDUSTRY VERSION of the foundation prompt for "${area.name}", industry: ${industry}.

BASE PROMPT (all industries${base ? `, v${base.version}, ${base.status}` : ""}):
"""
${cut(base?.body, 12000)}
"""

WHAT DIFFERS IN THIS INDUSTRY (Justin's knowledge + current best practice):
${ind.brief}

AREA NOTES: ${cut(brief, 1500)}

REAL CLIENTS IN THIS INDUSTRY (context only; do not name them in the prompt):
${glances || "(no brain summaries yet)"}

${SEED_HOUSE}

Rules for the industry version:
- Output ONE complete, ready-to-paste prompt: keep every base instruction and standard (you may tighten wording, never drop a standard).
- Focus the changes on what actually differs for ${industry} in this area: structure, page or screen types, schema types, search/map footprint, tone, image style, compliance, integrations. Put the main differences in a section titled "## ${industry}: what's different" near the top, and adjust the specific base lines they affect.
- Only include what is relevant to this area (${area.name}). Keep [PLACEHOLDERS] for client facts.
Title: "${area.name} (${industry}) — foundation v1". Changelog: one line on what this industry version changes vs the base.`;
  }
  const out = await llmPrompt(base44, prompt, `${area.name} ${industry || "(all)"}`);
  if (!seedComplete(out)) throw new Error(`Output failed checks for ${area.name} ${industry || "(all)"}`);
  const rec = {
    title: cut(out.title || `${area.name}${industry ? ` (${industry})` : ""} — foundation v1`, 160),
    body: cut(out.body, 40000), changelog: cut(out.changelog, 1200),
  };
  if (x.redo) return db.FoundationPrompt.update(x.redo.id, rec); // fix an earlier malformed seed draft in place
  const version = Math.max(0, ...areaPrompts.filter((v: any) => (v.industry || "") === industry).map((v: any) => Number(v.version) || 0)) + 1;
  return db.FoundationPrompt.create({ ...rec, area_id: area.id, industry, version, status: "draft", drafted_by: "prompt_agent", based_on_id: industry ? base?.id || "" : "", source_pattern_ids: [] });
}

// A seeded draft is usable when it has a report section, a real changelog line and no mangled trademark rule.
function seedComplete(p: any) {
  const body = String(p?.body || "");
  return body.length > 1500 && /^#+ .*report/im.test(body) && String(p?.changelog || "").trim().length >= 25 && !/never ™/.test(body);
}

async function seedVariants(base44: any, db: any, max = 3) {
  const [areas, prompts, standards, brains] = await Promise.all([
    listAll(db.PlaybookArea, {}, "order", 100), listAll(db.FoundationPrompt, {}, "-version", 2000),
    listAll(db.FoundationStandard, {}, "order", 1000), listAll(db.BusinessBrain, {}, "-updated_date", 300),
  ]);
  const live = (p: any) => p.status !== "retired";
  const pending: any[] = [];
  // An earlier seed draft that came out malformed is redone in place (never deleted).
  const slot = (area: any, industry: string) => {
    const mine = prompts.filter((p: any) => p.area_id === area.id && (p.industry || "") === industry && live(p));
    if (!mine.length) return { need: true };
    const bad = mine.find((p: any) => p.status === "draft" && p.drafted_by === "prompt_agent" && !seedComplete(p));
    return bad && mine.length === 1 ? { need: true, redo: bad } : { need: false };
  };
  for (const area of areas) { const s = slot(area, ""); if (s.need) pending.push({ area, industry: "", redo: s.redo }); }
  for (const ind of SEED_INDUSTRIES) for (const area of areas) { const s = slot(area, ind.key); if (s.need) pending.push({ area, industry: ind.key, ind, redo: s.redo }); }
  if (!pending.length) return { created: 0, remaining: 0, errors: [] };
  const genericWaiting = new Set(pending.filter((x) => !x.industry).map((x) => x.area.id));
  const batch: any[] = [];
  for (const x of pending) {
    if (batch.length >= max) break;
    if (x.industry && genericWaiting.has(x.area.id)) continue; // the base draft comes first
    batch.push(x);
  }
  const reference = prompts.find((p: any) => p.status === "approved" && !p.industry && areas.find((a: any) => a.id === p.area_id)?.slug === "website-polish-launch") || prompts.find((p: any) => p.status === "approved");
  const ctx = { prompts, standards, brains, reference };
  const settled = await Promise.allSettled(batch.map((x) => seedOne(base44, db, x, ctx)));
  const created = settled.filter((s) => s.status === "fulfilled").length;
  const errors = settled.filter((s) => s.status === "rejected").map((s: any) => cut(s.reason?.message || s.reason, 200));
  return { created, remaining: pending.length - created, errors, batch: batch.map((x) => `${x.area.name}${x.industry ? ` · ${x.industry}` : ""}`) };
}

// ---------- approvals ----------
async function approvePattern(db: any, b: any) {
  const p = await db.PromptPattern.get(String(b.pattern_id || ""));
  if (!p) throw new Error("Pattern not found");
  if (p.status === "standard" && p.standard_id) return { standard_id: p.standard_id, already: true };
  if (p.standard_id) {
    // Already covered by an existing standard: confirm it, no duplicate standard.
    await db.PromptPattern.update(p.id, { status: "standard", decided_at: nowIso() });
    return { standard_id: p.standard_id, already: true };
  }
  const area = p.area_id ? await db.PlaybookArea.get(p.area_id).catch(() => null) : null;
  const title = cut(b.title || p.title, 160), rule = cut(b.rule || p.rule || p.title, 600), how = cut(b.how_to_check ?? p.how_to_check ?? "", 400);
  const kind = ["website", "app", "brand", "account", "mappack", "other"].includes(b.kind) ? b.kind : (p.kind && p.kind !== "other" ? p.kind : area?.kind || "other");
  const existing = await listAll(db.FoundationStandard, {}, "-order", 1);
  const std = await db.FoundationStandard.create({ area_id: p.area_id || "", kind, title, rule, how_to_check: how, industry: cut(b.industry || "", 60), added_at: nowIso(), origin_pattern_id: p.id, order: (Number(existing[0]?.order) || 0) + 1, active: true });
  await db.PromptPattern.update(p.id, { status: "standard", decided_at: nowIso(), standard_id: std.id, title, rule, how_to_check: how, kind });
  const checks = await syncChecks(db, std.id);
  return { standard_id: std.id, checks_created: checks.created };
}

async function approvePrompt(db: any, b: any) {
  const p = await db.FoundationPrompt.get(String(b.prompt_id || ""));
  if (!p) throw new Error("Prompt not found");
  const same = await listAll(db.FoundationPrompt, { area_id: p.area_id, status: "approved" }, "-version", 100);
  for (const o of same) if (o.id !== p.id && (o.industry || "") === (p.industry || "")) await db.FoundationPrompt.update(o.id, { status: "retired" });
  await db.FoundationPrompt.update(p.id, { status: "approved", approved_at: nowIso(), rejected_at: null });
  if (!p.industry) await db.PlaybookArea.update(p.area_id, { current_prompt_id: p.id });
  return { approved: p.id };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const b = await req.json().catch(() => ({}));
    const action = String(b?.action || "");
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      // Scheduled path: the weekly workflow only, each step at most once per 6 days.
      const { ps } = await getState(db);
      if (action === "seed_variants") {
        // One-time seed run from the "Playbooks — seed industry variants" workflow; refuses once the seed is complete.
        if (ps.seed_variants_done) return Response.json({ ok: true, skipped: "seed already complete" });
      } else if (!["weekly_sync", "weekly_cluster", "weekly_draft"].includes(action)) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const last = ps.steps?.[action];
      if (last && Date.now() - new Date(last).getTime() < WEEK) return Response.json({ ok: true, skipped: "ran in the last 5 days" });
    } else if (user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (action === "seed_variants") {
      const r = await seedVariants(base44, db, 3);
      const { row, ps } = await getState(db);
      const seed = { ...(ps.seed_variants || {}), last_at: nowIso(), remaining: r.remaining, created_total: (Number(ps.seed_variants?.created_total) || 0) + r.created, errors: [...arr(ps.seed_variants?.errors), ...r.errors].slice(-20) };
      await saveState(db, row, { ...ps, seed_variants: seed, seed_variants_done: r.remaining === 0 });
      return Response.json({ ok: true, ...r });
    }
    if (action === "status") { const { ps } = await getState(db); return Response.json({ ok: true, state: ps }); }
    if (action === "sync_checks" || action === "weekly_sync") {
      const r = await syncChecks(db);
      await recordRun(db, action === "weekly_sync" ? "weekly_sync" : "sync_checks", `${r.created} new standard checks (${r.standards} standards × ${r.targets} sites/apps/clients)`);
      return Response.json({ ok: true, ...r });
    }
    if (action === "cluster" || action === "weekly_cluster") {
      const r = await cluster(base44, db);
      await recordRun(db, action === "weekly_cluster" ? "weekly_cluster" : "cluster", `${r.clustered} requests clustered, ${r.new_patterns} new patterns, ${r.proposed} proposed for approval`, r);
      return Response.json({ ok: true, ...r });
    }
    if (action === "draft" || action === "weekly_draft") {
      const r = await draft(base44, db, b.area_id ? String(b.area_id) : undefined);
      await recordRun(db, action === "weekly_draft" ? "weekly_draft" : "draft", r.drafted.length ? `Drafted ${r.drafted.map((d: any) => `${d.area} v${d.version}`).join(", ")}` : "No approved patterns waiting to be folded in", r);
      return Response.json({ ok: true, ...r });
    }
    if (action === "draft_variant") {
      const area = await db.PlaybookArea.get(String(b.area_id || ""));
      const industry = cut(b.industry, 60).trim();
      if (!area || !industry) return Response.json({ error: "area_id and industry are required" }, { status: 400 });
      const versions = await listAll(db.FoundationPrompt, { area_id: area.id }, "-version", 200);
      const base = versions.find((v: any) => v.status === "approved" && v.industry === industry) || versions.find((v: any) => v.status === "approved" && !v.industry) || null;
      const standards = (await listAll(db.FoundationStandard, { area_id: area.id }, "order", 500)).filter((s: any) => s.active !== false && (!s.industry || s.industry === industry));
      const clients = (await listAll(db.CRMClient, { status: "Active" }, "business", 300)).filter((c: any) => industryGroup(c.industry) === industry).map((c: any) => `${c.business} (${c.industry})`);
      const rec = await draftFor(base44, db, area, { industry, patterns: [], base, versions, standards, note: `Industry clients for context: ${clients.join("; ") || "none yet"}. ${cut(b.note, 600)}` });
      await recordRun(db, "draft_variant", `Drafted ${area.name} (${industry}) v${rec.version}`);
      return Response.json({ ok: true, prompt_id: rec.id, version: rec.version });
    }
    if (action === "approve_pattern") return Response.json({ ok: true, ...(await approvePattern(db, b)) });
    if (action === "reject_pattern") {
      await db.PromptPattern.update(String(b.pattern_id || ""), { status: "rejected", decided_at: nowIso() });
      return Response.json({ ok: true });
    }
    if (action === "approve_prompt") return Response.json({ ok: true, ...(await approvePrompt(db, b)) });
    if (action === "reject_prompt") {
      await db.FoundationPrompt.update(String(b.prompt_id || ""), { status: "retired", rejected_at: nowIso(), reject_note: cut(b.note, 600) });
      return Response.json({ ok: true });
    }
    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
