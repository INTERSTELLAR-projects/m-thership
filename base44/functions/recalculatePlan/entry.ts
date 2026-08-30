import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { computePlan } from "../../shared/planEngine.js";

const SYSTEM_PROMPT =
  "You are a revenue strategist for a solo-operated digital agency. You will receive " +
  "pre-computed financial projections as JSON. Every number in your output must come directly " +
  "from that JSON — never calculate, estimate, or infer a new figure. Be direct and specific. " +
  "No hedging, no filler, no restating the obvious. The reader is the owner and already knows " +
  "his business; tell him what the numbers mean and what to do, not what they say.";

const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string" },
    reasoning: { type: "array", items: { type: "string" } },
    route_takes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          route_name: { type: "string" },
          strength: { type: "string" },
          weakness: { type: "string" },
        },
      },
    },
    hidden_insight: { type: "string" },
    switch_trigger: { type: "string" },
    next_30_days: { type: "array", items: { type: "string" } },
    delta_since_last_run: { type: "string" },
  },
};

function collectNumbers(obj) {
  const set = new Set();
  const str = JSON.stringify(obj || {});
  const re = /-?\d+(?:\.\d+)?/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    const n = Number(m[0]);
    set.add(n);
    set.add(Math.round(n));
    set.add(round2(n));
    set.add(n * 100);
    set.add(Math.round(n * 100));
    set.add(round2(n * 100));
  }
  return set;
}
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function numbersValid(aiSummary, allowed) {
  if (!aiSummary) return false;
  const str = JSON.stringify(aiSummary);
  const re = /-?\d+(?:\.\d+)?/g;
  let m;
  let violations = 0;
  while ((m = re.exec(str)) !== null) {
    const n = Number(m[0]);
    const ok = allowed.has(n) || allowed.has(Math.round(n)) || allowed.has(round2(n)) ||
      allowed.has(n / 100) || allowed.has(Math.round(n / 100)) || allowed.has(round2(n / 100));
    if (!ok) violations++;
  }
  return violations === 0;
}

async function runLLM(base44, computed, previousAnalysis) {
  const allowed = collectNumbers(computed);
  const payload = {
    computed,
    previous: previousAnalysis
      ? {
          mrr_at_run: previousAnalysis.mrr_at_run,
          gap_at_run: previousAnalysis.gap_at_run,
          winner_name: previousAnalysis.computed?.winner_name,
          months_to_goal: previousAnalysis.computed?.winner_name
            ? (previousAnalysis.computed.routes || [])
                .concat(previousAnalysis.computed.blended ? [previousAnalysis.computed.blended] : [])
                .find((r) => r.name === previousAnalysis.computed.winner_name)?.months_to_goal
            : null,
          ai_summary: previousAnalysis.ai_summary,
        }
      : null,
  };

  const userPrompt =
    "Pre-computed projections (authoritative — never restate numbers not present here):\n" +
    JSON.stringify(payload, null, 2) +
    "\n\nReturn STRICT JSON with this shape:\n" +
    "{ verdict, reasoning[], route_takes[{route_name,strength,weakness}], hidden_insight, switch_trigger, next_30_days[], delta_since_last_run }\n" +
    "verdict: one sentence under 20 words naming the winning route and why.\n" +
    "reasoning: max 3 bullets, each under 25 words, each citing a specific number from the JSON.\n" +
    "route_takes: one entry per route (including Blended auto).\n" +
    "hidden_insight: one non-obvious tradeoff, capacity ceiling, cash-timing issue, or case where the slower route is correct.\n" +
    "switch_trigger: a specific condition that changes the recommendation.\n" +
    "next_30_days: 2-3 concrete actions, each starting with a verb.\n" +
    "delta_since_last_run: if previous is null return null; otherwise state plainly what changed (and if MRR dropped, address it directly — no spin).\n";

  let attempt = 0;
  while (attempt < 2) {
    attempt++;
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: SYSTEM_PROMPT + "\n\n" + userPrompt,
        response_json_schema: SUMMARY_SCHEMA,
        model: "gemini_3_flash",
      });
      const out = typeof res === "string" ? safeParse(res) : res;
      if (out && numbersValid(out, allowed)) {
        if (!previousAnalysis) out.delta_since_last_run = null;
        return out;
      }
    } catch (e) {
      // fall through to retry
    }
  }
  return null;
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

async function resolvePrimaryGoal(base44) {
  const primary = await base44.entities.Goal.filter({ is_primary: true }, "priority", 50);
  const found = (primary || []).find((g) => g.status !== "archived") || (primary || [])[0];
  if (found) return found;
  const active = await base44.entities.Goal.filter({ status: "active" }, "priority", 50);
  return (active || [])[0] || null;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const trigger = body.trigger || (body.event ? "mrr_change" : "manual");

    const clients = await base44.entities.CRMClient.list("-created_date", 500);
    const currentMrr = (clients || [])
      .filter((c) => c.status === "Active")
      .reduce((s, c) => s + (c.services || []).reduce((t, sv) => t + (Number(sv.price) || 0), 0), 0);

    let goal;
    if (body.goalId) goal = await base44.entities.Goal.get(body.goalId);
    if (!goal) goal = await resolvePrimaryGoal(base44);
    if (!goal) return Response.json({ error: "No goal" }, { status: 404 });

    const recent = await base44.entities.PlanAnalysis.filter({ goal_id: goal.id }, "-created_date", 1);
    const last = (recent || [])[0];
    if (trigger === "mrr_change" && last) {
      const ageMs = Date.now() - new Date(last.created_date).getTime();
      if (ageMs < 60000) {
        return Response.json({ skipped: true, reason: "debounced", analysis_id: last.id });
      }
    }

    const computed = computePlan(goal, currentMrr);

    const prevList = await base44.entities.PlanAnalysis.filter({ goal_id: goal.id }, "-created_date", 1);
    const previousAnalysis = (prevList || [])[0] || null;

    let aiSummary = null;
    try {
      aiSummary = await runLLM(base44, computed, previousAnalysis);
    } catch (e) {
      aiSummary = null;
    }

    const assumptions_snapshot = {
      blended_mix: goal.blended_mix == null ? null : goal.blended_mix,
      routes: (goal.routes || []).map((r) => ({
        name: r.name,
        monthly_price: Number(r.monthly_price) || 0,
        clients_per_month: Number(r.clients_per_month) || 0,
        monthly_churn_rate: Number(r.monthly_churn_rate) || 0,
        has_addons: !!r.has_addons,
        addon_attach_rate: r.has_addons ? Number(r.addon_attach_rate) || 0 : null,
        addon_avg: r.has_addons ? Number(r.addon_avg) || 0 : null,
      })),
    };

    const created = await base44.entities.PlanAnalysis.create({
      goal_id: goal.id,
      target_mrr: computed.target_mrr,
      mrr_at_run: computed.current_mrr,
      gap_at_run: computed.gap_at_run,
      computed,
      ai_summary: aiSummary,
      assumptions_snapshot,
      previous_analysis_id: previousAnalysis ? previousAnalysis.id : null,
      trigger,
    });

    if (computed.achieved && goal.status !== "achieved") {
      await base44.entities.Goal.update(goal.id, { status: "achieved" });
    }

    return Response.json({ ok: true, analysis_id: created.id, computed, ai_summary: aiSummary, mrr: currentMrr });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}