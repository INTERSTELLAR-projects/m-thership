// Idea Vault ranking: a transparent 0-100 score built on Hormozi's value equation.
//   value = (dream outcome x likelihood) / (time delay x effort)
// Seven sub-scores (1-10, higher is always better) are judged by AI through the admin ai-gateway (InvokeLLM fallback),
// each with a one-line rationale. The score itself is computed here, deterministically, so anyone can check it:
//   dream      = revenue potential toward the $1M goal
//   likelihood = mean(fit with the Interstellar offer, existing assets to reuse, market timing, risk (10 = low risk))
//   time       = 11 - time-to-first-dollar   (1 = days, 10 = years)
//   effort     = 11 - build effort           (1 = tiny,  10 = huge)
//   raw        = dream x likelihood / (time x effort)   -> ranges 0.01 .. 100
//   score      = 100 x (log10(raw) + 2) / 4             -> 0 .. 100 (raw 1 = 50)
// Justin can override the score (override.score) or pin a rank by dragging (override.rank). Both are stored on the Idea.
import { base44 } from "@/api/base44Client";
import { invokeAI } from "@/lib/aiGateway";
import { loadContext } from "@/features/ideas/planGen";

export const FORMULA_VERSION = "v1-hormozi-log";

export const FACTORS = [
  { key: "revenue", label: "Revenue potential", short: "Revenue", hint: "How much this could add toward $1M in 2027 (10 = $250k+/yr realistic)", role: "dream" },
  { key: "fit", label: "Interstellar fit", short: "Fit", hint: "Home-service / local clients, Base44 builds, Studios", role: "likelihood" },
  { key: "time_to_dollar", label: "Time to first $", short: "Speed", hint: "10 = paid within days, 1 = years away", role: "time" },
  { key: "effort", label: "Build effort", short: "Ease", hint: "10 = an afternoon, 1 = a funded team for a year", role: "effort" },
  { key: "assets", label: "Existing assets", short: "Assets", hint: "Clients, apps, audience, skills already owned", role: "likelihood" },
  { key: "timing", label: "Market timing", short: "Timing", hint: "Is the market pulling for this right now?", role: "likelihood" },
  { key: "risk", label: "Risk (10 = low)", short: "Safety", hint: "Legal, capital, reputation, dependency risk", role: "likelihood" },
];

export const STAGES = [
  { key: "idea", label: "Idea" },
  { key: "validating", label: "Validating" },
  { key: "building", label: "Building" },
  { key: "live", label: "Live" },
  { key: "parked", label: "Parked" },
];

export const TIERS = [
  { key: "S", min: 70, label: "S · build now" },
  { key: "A", min: 58, label: "A · strong" },
  { key: "B", min: 45, label: "B · maybe later" },
  { key: "C", min: 0, label: "C · park" },
];

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const f = (bd, k) => clamp(Number(bd?.factors?.[k]?.score) || 5, 1, 10);

export function valueEquation(bd) {
  const dream = f(bd, "revenue");
  const likelihood = (f(bd, "fit") + f(bd, "assets") + f(bd, "timing") + f(bd, "risk")) / 4;
  const time = 11 - f(bd, "time_to_dollar");
  const effort = 11 - f(bd, "effort");
  const raw = (dream * likelihood) / (time * effort);
  const score = Math.round(clamp((100 * (Math.log10(raw) + 2)) / 4, 0, 100));
  return { dream, likelihood: Math.round(likelihood * 10) / 10, time, effort, raw: Math.round(raw * 100) / 100, score };
}

export const effectiveScore = (idea) => {
  const o = idea?.override?.score;
  if (o !== undefined && o !== null && o !== "") return Number(o);
  return typeof idea?.score === "number" ? idea.score : null;
};

export const tierOf = (score) => (score === null || score === undefined ? null : TIERS.find((t) => score >= t.min)?.key || "C");

export function stageOf(idea) {
  if (idea?.stage) return idea.stage;
  if (idea?.status === "Shelved") return "parked";
  if (idea?.status === "Implemented") return "live";
  if (idea?.status === "Planned") return "building";
  if (idea?.status === "In Review") return "validating";
  return "idea";
}

// Order: unscored last; parked ideas sink below active ones; pinned (override.rank) ideas take their slot.
export function orderIdeas(ideas) {
  const active = (i) => stageOf(i) !== "parked";
  const base = [...ideas].sort((a, b) => {
    if (active(a) !== active(b)) return active(a) ? -1 : 1;
    const sa = effectiveScore(a), sb = effectiveScore(b);
    if (sa === null && sb !== null) return 1;
    if (sb === null && sa !== null) return -1;
    return (sb ?? 0) - (sa ?? 0) || String(a.title).localeCompare(String(b.title));
  });
  const pinned = base.filter((i) => Number(i.override?.rank) > 0).sort((a, b) => a.override.rank - b.override.rank);
  const rest = base.filter((i) => !(Number(i.override?.rank) > 0));
  const out = [...rest];
  for (const p of pinned) out.splice(clamp(p.override.rank - 1, 0, out.length), 0, p);
  return out;
}

// Persist rank (and prev_rank for the movement arrows) for every idea whose position changed.
export async function persistRanks(ordered) {
  const now = new Date().toISOString();
  const changes = [];
  ordered.forEach((idea, i) => {
    const rank = i + 1;
    if (idea.rank !== rank) changes.push({ id: idea.id, fields: { rank, prev_rank: idea.rank || null, rank_changed_at: now } });
  });
  for (const c of changes) await base44.entities.Idea.update(c.id, c.fields);
  return changes;
}

const factorProp = { type: "object", properties: { score: { type: "number", description: "1-10, higher is better" }, why: { type: "string", description: "One line, concrete" } }, required: ["score", "why"] };

export const SCORE_SCHEMA = {
  type: "object",
  properties: {
    factors: {
      type: "object",
      properties: Object.fromEntries(FACTORS.map((x) => [x.key, factorProp])),
      required: FACTORS.map((x) => x.key),
    },
    revenue_band: { type: "string", description: "Estimated yearly revenue band, e.g. '$25k-$100k/yr (estimate)'" },
    sizing_note: { type: "string", description: "The reasoning behind the revenue band: price x buyers you can realistically reach. Must say it is an estimate. Never cite market-size numbers you cannot source." },
    effort_band: { type: "string", enum: ["S", "M", "L", "XL"], description: "S < 1 week, M 1-4 weeks, L 1-3 months, XL 3+ months" },
    time_to_dollar_label: { type: "string", description: "e.g. '2-4 weeks (estimate)'" },
    next_action: { type: "string", description: "The single next action, concrete, doable this week" },
  },
  required: ["factors", "revenue_band", "sizing_note", "effort_band", "time_to_dollar_label", "next_action"],
};

export async function scoreIdea(idea, ctx) {
  const c = ctx || (await loadContext().catch(() => ({ active: [], clients: [], liveProjects: [] })));
  const clients = (c.active || []).slice(0, 30).map((x) => `${x.business}${x.industry ? ` (${x.industry})` : ""}`).join("; ") || "(none listed)";
  const w = idea.writeup;
  const prompt = `You score business ideas for Justin Cowell, founder of Interstellar Strategies (Molalla, OR): a full-stack digital agency selling websites, SEO (local, AIO/GEO/AEO), automation and custom Base44 apps, plus "Studios" (client-facing AI tools for social, ads and email) and care plans. Main market: home-service and local businesses. Goal: $1M revenue in 2027 using Alex Hormozi's value equation. He builds fast with Claude and Base44 and has a small team.
Active clients: ${clients}

Score this idea on 7 factors, each 1-10 where HIGHER IS ALWAYS BETTER, each with a one-line concrete rationale:
- revenue: realistic revenue toward $1M in 2027 (10 = $250k+/yr realistic for him, 1 = under $5k)
- fit: fit with the Interstellar offer (home-service/local clients, Base44 builds, Studios)
- time_to_dollar: speed to first paying dollar (10 = days, 5 = ~3 months, 1 = years)
- effort: ease of building it (10 = an afternoon, 5 = a month of focused work, 1 = funded team for a year+)
- assets: existing assets to reuse (clients, Møthership apps, portal, skills, audience)
- timing: market timing right now (late 2026)
- risk: 10 = very low risk (legal, capital, reputation, platform dependency), 1 = very high risk
Be honest and calibrated: most ideas are average. Do not inflate. Never invent market statistics; revenue_band is YOUR estimate from price x reachable buyers and must be labelled "(estimate)". sizing_note explains that arithmetic.

IDEA
Title: ${idea.title}
Category: ${idea.category || "—"}
Description: ${String(idea.description || "(none — infer from the title)").slice(0, 2500)}
${w ? `Concept brief: ${JSON.stringify({ pitch: w.pitch, who_for: w.who_for, wedge: w.wedge, mvp: w.mvp, monetization: w.monetization }).slice(0, 2500)}` : ""}
${idea.plan?.verdict ? `Existing plan verdict: ${idea.plan.verdict}` : ""}`;

  const out = await invokeAI({ prompt, response_json_schema: SCORE_SCHEMA, tier: "long", feature: "idea_vault_score" });
  const bd = { ...out, model: "ai-gateway", formula_version: FORMULA_VERSION };
  const ve = valueEquation(bd);
  bd.value_eq = ve;
  const fields = { score_breakdown: bd, score: ve.score, scored_at: new Date().toISOString() };
  await base44.entities.Idea.update(idea.id, fields);
  return fields;
}
