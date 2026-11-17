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
// Workflow "Playbooks — weekly prompt agent" (no signed-in user): weekly_sync, weekly_cluster, weekly_draft, each at most once per 6 days.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { arr, cut, nowIso, industryGroup, checkKindFor, listAll, createMany } from "../../shared/playbooks.ts";

const MODEL = "claude_sonnet_4_6";
const STATE_KEY = "playbooks_agent";
const WEEK = 6 * 86400000;

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
    if ((p.status || "watching") === "watching" && (mine.length >= 3 || clients.length >= 2)) { patch.status = "proposed"; proposed++; }
    await db.PromptPattern.update(p.id, patch);
  }
  return proposed;
}

async function cluster(base44: any, db: any) {
  const [areas, patterns, logs] = await Promise.all([
    listAll(db.PlaybookArea, {}, "order", 100),
    listAll(db.PromptPattern, {}, "-last_seen", 400),
    listAll(db.PromptLog, {}, "-said_at", 3000),
  ]);
  const todo = logs.filter((l: any) => !l.pattern_id).slice(0, 80);
  if (!todo.length) { const proposed = await recount(db); return { clustered: 0, new_patterns: 0, proposed }; }
  const prompt = `You are the Prompt Agent inside Møthership, Justin's agency command app. Justin (Interstellar Strategies) builds client websites and apps.
Group his requests into repeated PATTERNS: things he asks for again and again (especially in tweak/polish rounds) that should become a standard baked into every future build.

AREAS (id: name):
${areas.map((a: any) => `${a.id}: ${a.name} (${a.kind})`).join("\n")}

EXISTING PATTERNS (id | status | area | title | rule):
${patterns.map((p: any) => `${p.id} | ${p.status} | ${p.area_id || "-"} | ${cut(p.title, 80)} | ${cut(p.rule, 160)}`).join("\n") || "(none yet)"}

NEW REQUESTS (log id | client | phase | area | text):
${todo.map((l: any) => `${l.id} | ${l.client_name || "Interstellar"} | ${l.phase || "-"} | ${l.area_id || "-"} | ${cut(l.text, 300)}`).join("\n")}

Instructions:
- Assign EVERY new request to exactly one pattern: an existing pattern id when it is the same underlying ask (even if worded differently or for another client), or a new pattern ref like "new1".
- Make new patterns general and reusable (not client-specific): title <= 8 words, rule = the standard in one sentence, how_to_check = one sentence. Pick the best area_id and kind.
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
    const rec = await db.PromptPattern.create({ area_id: area, title: cut(np.title, 120), rule: cut(np.rule, 400), how_to_check: cut(np.how_to_check, 300), kind, status: "watching", count: 0, clients: [], example_quotes: [] });
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
const DRAFT_SCHEMA = {
  type: "object",
  properties: { title: { type: "string" }, body: { type: "string" }, changelog: { type: "string" } },
  required: ["body", "changelog"],
};

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
Return: title ("${area.name}${industry ? ` (${industry})` : ""} — foundation v${nextVersion}"), body (markdown, the complete ready-to-paste prompt), changelog (2-5 short lines: what changed vs the current version and why).
${HOUSE}`;
  const res: any = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, model: MODEL, response_json_schema: DRAFT_SCHEMA });
  const out = typeof res === "string" ? JSON.parse(res) : res || {};
  if (!out.body) throw new Error("The model returned no prompt body");
  return db.FoundationPrompt.create({
    area_id: area.id, industry, version: nextVersion, title: cut(out.title || `${area.name} — foundation v${nextVersion}`, 160),
    body: cut(out.body, 40000).replace(/®/g, "™"), changelog: cut(out.changelog, 4000), status: "draft", drafted_by: "prompt_agent",
    based_on_id: opts.base?.id || "", source_pattern_ids: opts.patterns.map((p: any) => p.id),
  });
}

async function draft(base44: any, db: any, onlyArea?: string) {
  const [areas, patterns, prompts, standards] = await Promise.all([
    listAll(db.PlaybookArea, {}, "order", 100), listAll(db.PromptPattern, { status: "standard" }, "-decided_at", 500),
    listAll(db.FoundationPrompt, {}, "-version", 1000), listAll(db.FoundationStandard, {}, "order", 1000),
  ]);
  const drafted: any[] = [];
  for (const area of areas) {
    if (onlyArea && area.id !== onlyArea) continue;
    if (drafted.length >= 3) break;
    const versions = prompts.filter((p: any) => p.area_id === area.id);
    const live = versions.find((p: any) => p.status === "approved" && !p.industry) || null;
    const covered = new Set<string>();
    versions.filter((v: any) => v.status === "approved" || (v.status === "draft" && !v.rejected_at)).forEach((v: any) => arr(v.source_pattern_ids).forEach((id: string) => covered.add(id)));
    const fresh = patterns.filter((p: any) => p.area_id === area.id && !covered.has(p.id));
    if (!fresh.length) continue;
    const rec = await draftFor(base44, db, area, { patterns: fresh, base: live, versions, standards: standards.filter((s: any) => s.area_id === area.id && s.active !== false) });
    drafted.push({ area: area.name, prompt_id: rec.id, version: rec.version, patterns: fresh.length });
  }
  return { drafted };
}

// ---------- approvals ----------
async function approvePattern(db: any, b: any) {
  const p = await db.PromptPattern.get(String(b.pattern_id || ""));
  if (!p) throw new Error("Pattern not found");
  if (p.status === "standard" && p.standard_id) return { standard_id: p.standard_id, already: true };
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
      if (!["weekly_sync", "weekly_cluster", "weekly_draft"].includes(action)) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const { ps } = await getState(db);
      const last = ps.steps?.[action];
      if (last && Date.now() - new Date(last).getTime() < WEEK) return Response.json({ ok: true, skipped: "ran in the last 6 days" });
    } else if (user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
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
