// Møthership Command: frontend API. Every call goes to a backend function first. When the function cannot be
// reached (or in QA mode on the preview host) the same engine runs in the browser on the same entities, so the
// home screen always renders: the last good brief from DailyBrief, else a rule brief computed here.
import { base44 } from "@/api/base44Client";
import { IS_QA } from "@/lib/qa";
import * as E from "./engine";

export const errMsg = (e) => e?.response?.data?.error || e?.message || "Something went wrong";
const call = async (fn, args) => (await base44.functions.invoke(fn, args))?.data;
const rows = (r) => (Array.isArray(r) ? r : (r && r.items) || []);
const todosOf = (scores, cands) => Object.fromEntries(Object.entries(scores).map(([id, v]) => [id, { ...v, todos: cands.filter((c) => c.pillar === id).slice(0, 5).map((c) => ({ title: c.title, why: c.why, ref: c.ref })) }]));

// ---------------------------------------------------------------- local engine (QA + offline)
async function localCompute(user, opts = {}) {
  const src = await E.loadSources(base44.entities);
  const out = E.computeAll(src, new Date(), { name: user?.full_name, events: null, ...opts });
  return { ...out, src };
}
async function localBrief(user, opts = {}) {
  const { s, scores, rule } = await localCompute(user, opts);
  const brief = {
    date: s.today, version: 1, source: "rules", greeting: rule.greeting, since_yesterday: rule.since_yesterday, outcomes: rule.outcomes,
    plan_today: rule.plan_today, tomorrow: rule.tomorrow, day_after: rule.day_after, gaps: rule.gaps, pillar_scores: todosOf(scores, rule.cands),
    facts: { ...E.factsSummary(s), after_hours: rule.after_hours }, interruptions: opts.interruptions || [], extra_blocks: opts.extraBlocks || [],
    generated_at: new Date().toISOString(), tz: s.tz, local: true,
  };
  // Seed the Needs-you stream locally too (QA store or, offline, nothing is written).
  if (IS_QA) {
    const have = rows(await base44.entities.ProposedAction.list("-created_date", 300)).map((p) => p.dedupe_key);
    for (const p of E.ruleProposals(s, scores)) if (!have.includes(p.dedupe_key)) await base44.entities.ProposedAction.create(p);
    const prev = rows(await base44.entities.DailyBrief.filter({ date: s.today }))[0];
    if (prev) await base44.entities.DailyBrief.update(prev.id, brief); else await base44.entities.DailyBrief.create(brief);
  }
  return brief;
}

// ---------------------------------------------------------------- brief
export async function getBrief(user, { force = false } = {}) {
  if (IS_QA) {
    const prev = rows(await base44.entities.DailyBrief.list("-generated_at", 1))[0];
    if (prev && !force) return { brief: prev };
    return { brief: await localBrief(user, { interruptions: prev?.interruptions || [], extraBlocks: prev?.extra_blocks || [] }) };
  }
  try {
    return await call("command-brief", { action: force ? "generate" : "get" });
  } catch (e) {
    const last = rows(await base44.entities.DailyBrief.list("-date", 1).catch(() => []))[0];
    if (last) return { brief: last, stale: true, error: errMsg(e) };
    return { brief: await localBrief(user), stale: true, error: errMsg(e) };
  }
}
export async function interrupt(user, text, minutes) {
  if (IS_QA) {
    const prev = rows(await base44.entities.DailyBrief.list("-generated_at", 1))[0];
    const p = E.zonedParts(new Date(), E.TZ_DEFAULT);
    const it = { date: p.date, start: E.fromMin(Math.ceil((p.hour * 60 + p.minute) / 5) * 5), minutes: minutes || 60, text };
    return { brief: await localBrief(user, { interruptions: [...(prev?.interruptions || []), it], keepPast: prev?.plan_today || [] }) };
  }
  return call("command-brief", { action: "interrupt", text, minutes });
}
export async function liveScores(user) {
  if (!IS_QA) {
    try { return await call("command-brief", { action: "scores" }); } catch { /* fall through to local */ }
  }
  const { s, scores, rule } = await localCompute(user);
  return { scores, todos: Object.fromEntries(E.PILLAR_IDS.map((id) => [id, rule.cands.filter((c) => c.pillar === id).slice(0, 6)])), facts: E.factsSummary(s), errors: s.errors, local: true };
}

// ---------------------------------------------------------------- Needs you
export async function listActions() {
  const now = Date.now();
  const list = rows(await base44.entities.ProposedAction.filter({ status: { $in: ["pending", "snoozed"] } }, "-priority", 150));
  return list
    .filter((a) => a.status === "pending" || (a.status === "snoozed" && (!a.snooze_until || Date.parse(a.snooze_until) <= now)))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0) || String(b.created_date).localeCompare(String(a.created_date)));
}
export async function act(action, id, extra = {}) {
  if (IS_QA) return localAct(action, id, extra);
  return call("command-execute", { action, id, ...extra });
}
async function localAct(action, id, extra) {
  const pa = await base44.entities.ProposedAction.get(id);
  if (action === "skip") { await base44.entities.ProposedAction.update(id, { status: "skipped" }); return { ok: true }; }
  if (action === "snooze") { await base44.entities.ProposedAction.update(id, { status: "snoozed", snooze_until: new Date(Date.now() + 3 * 3600e3).toISOString() }); return { ok: true }; }
  if (pa.kind === "send_email" && !extra.confirm) { const err = new Error("confirm"); err.response = { status: 428, data: { code: "confirm_required" } }; throw err; }
  if (pa.kind === "send_email" && extra.test) return { ok: true, test: true, to: E.TEST_EMAIL };
  const result = pa.kind === "send_sms" ? { sms_url: `sms:${String(pa.payload?.phone || "").replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(pa.payload?.body || "")}` } : { qa: true };
  await base44.entities.ProposedAction.update(id, { status: pa.kind === "question" ? "answered" : "executed", executed_at: new Date().toISOString(), result, answer: extra.answer });
  if (pa.kind === "question" && (extra.answer || extra.raw_text)) for (const st of extra.statements?.length ? extra.statements : [extra.answer]) await base44.entities.BrainFact.create({ pillar: pa.pillar, statement: st, raw_text: extra.raw_text || extra.answer, question_key: pa.payload?.question_key, source: "interview", status: "active", date: E.zonedParts(new Date()).date });
  return { ok: true, status: "executed", result };
}
export async function undo(auditId) {
  if (IS_QA) return { ok: true };
  return call("command-execute", { action: "undo", audit_id: auditId });
}
export async function recentAudit(limit = 12) {
  return rows(await base44.entities.AgentAuditLog.list("-at", limit).catch(() => []));
}

// ---------------------------------------------------------------- Ask
export async function ask(user, text) {
  if (!IS_QA) {
    try { return await call("command-ask", { text }); } catch (e) { if (e?.response?.status && e.response.status < 500) throw e; }
  }
  // QA / offline: the rule parser only.
  const it = E.fallbackIntent(text);
  const { s, scores } = await localCompute(user);
  const brief = rows(await base44.entities.DailyBrief.list("-generated_at", 1).catch(() => []))[0];
  if (it.type === "interruption") { await interrupt(user, it.title, it.minutes); return { reply: `Re-planned around it: ${it.title}. Blocks after now moved; the rest rolled to tomorrow.`, done: [{ type: "replan", label: "Day re-planned" }], proposed: [], replanned: true, offline: !IS_QA }; }
  if (it.type === "create_task") { const t = await base44.entities.Task.create({ title: it.title, status: "next", priority: 3, source: "voice", category: "ops" }); return { reply: `Added a task: ${it.title}.`, done: [{ type: "task", id: t?.id, label: `Task added: ${it.title}` }], proposed: [] }; }
  if (it.type === "brain_fact") { await base44.entities.BrainFact.create({ pillar: "owner", statement: it.statement, source: "ask", status: "active", date: s.today }); return { reply: "Saved to the Brain.", done: [{ type: "fact", label: "Brain learned a fact" }], proposed: [] }; }
  return { reply: E.answerFromSnapshot(text, s, scores, brief), done: [], proposed: [], offline: !IS_QA };
}

// ---------------------------------------------------------------- Brain
export async function brain(action, args = {}) {
  if (!IS_QA) {
    try { return await call("command-brain", { action, ...args }); }
    catch (e) { if (action === "clean") return { statements: [E.ruleClean(args.text)], source: "rules" }; throw e; }
  }
  if (action === "clean") return { statements: [E.ruleClean(args.text)], source: "rules", about_client: "", pillar_hint: "" };
  const { s, scores } = await localCompute(null);
  if (action === "answer") for (const st of args.statements?.length ? args.statements : [args.text]) await base44.entities.BrainFact.create({ pillar: args.pillar, statement: st, raw_text: args.raw_text || args.text, question_key: args.question_key, source: "interview", status: "active", date: s.today, data: E.factData(args.question_key, args.raw_text || "", st) });
  const facts = rows(await base44.entities.BrainFact.list("-created_date", 500)).filter((f) => f.status !== "superseded" && f.source !== "client_app").slice(0, 300);
  const factsBy = Object.fromEntries(E.PILLAR_IDS.map((id) => [id, facts.filter((f) => f.pillar === id).length]));
  return {
    question: E.nextQuestion(facts, scores, args.skip || []),
    coverage: Object.fromEntries(E.PILLARS.map((p) => [p.id, { name: p.name, facts: factsBy[p.id], confidence: scores[p.id].confidence, score: scores[p.id].score }])),
    total_questions: E.BRAIN_QUESTIONS.length, answered: facts.filter((f) => f.question_key).length, facts,
    ...(action === "answer" ? { saved: { statement: (args.statements || [args.text]).join(" "), pillar: args.pillar } } : {}),
  };
}
