// AI generation for the Goal routes and the Investment Advisor.
// Both prompts are fed only real numbers (aiSnapshot + computed goal math) and every
// output is stored with the snapshot it came from. Figures the AI returns are estimates.
import { base44 } from "@/api/base44Client";
import { aiSnapshot, round } from "./metrics";

const MODEL = "claude_sonnet_4_6";

const CONTEXT =
  "Business: Interstellar Strategies, a small full-stack digital agency in Molalla, Oregon, run by founder Justin Cowell " +
  "(web design/dev on Base44 and Framer, SEO incl. AIO/GEO/AEO and local SEO, Google Business Profiles, automation, custom apps). " +
  "Revenue is mostly monthly care plans (HyperCare+, AppCare, Manage+) plus one-time builds (Mission packages). " +
  "He is planning a 2027 rebrand around Hormozi-style offers and a referral program.";

const milestone = {
  type: "object",
  properties: { month: { type: "string", description: "YYYY-MM" }, target_mrr: { type: "number" }, focus: { type: "string" } },
  required: ["month", "target_mrr", "focus"],
};

const ROUTES_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    flagship: {
      type: "object",
      properties: {
        title: { type: "string" },
        thesis: { type: "string" },
        grand_slam_offer: {
          type: "object",
          properties: { name: { type: "string" }, dream_outcome: { type: "string" }, price: { type: "string" }, guarantee: { type: "string" }, bonuses: { type: "array", items: { type: "string" } } },
        },
        price_move: { type: "string" },
        lead_magnet: { type: "string" },
        referral_engine: { type: "string" },
        core_offer_focus: { type: "string" },
        what_to_stop: { type: "array", items: { type: "string" } },
        est_end_mrr: { type: "number" },
        est_period_revenue: { type: "number" },
        milestones: { type: "array", items: milestone },
        first_actions: { type: "array", items: { type: "string" } },
        risks: { type: "string" },
      },
      required: ["title", "thesis", "milestones", "first_actions"],
    },
    routes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          thesis: { type: "string" },
          levers: { type: "array", items: { type: "string" } },
          est_end_mrr: { type: "number" },
          est_period_revenue: { type: "number" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          risks: { type: "string" },
          milestones: { type: "array", items: milestone },
          first_actions: { type: "array", items: { type: "string" } },
        },
        required: ["name", "thesis", "milestones", "first_actions"],
      },
    },
  },
  required: ["flagship", "routes"],
};

export function goalSummary(goal, g) {
  return {
    goal_title: goal.title,
    metric: goal.metric === "run_rate" ? "ARR run-rate (MRR x 12) reached by the deadline" : "total revenue collected between start_date and deadline",
    target_amount: goal.target_amount,
    start_date: goal.start_date,
    deadline: goal.deadline,
    months_left_in_goal_window: g.monthsLeft,
    months_until_window_starts: g.monthsUntilStart || 0,
    revenue_collected_in_window_so_far: g.metric === "annual_revenue" ? (g.realizedKnown ? round(g.realized) : "unknown") : undefined,
    projected_at_current_run_rate: round(g.projected),
    gap_at_current_run_rate: round(g.gap),
    required_constant_monthly_mrr_growth_pct: g.requiredGrowth != null ? round(g.requiredGrowth * 100) : "not solvable from current MRR",
    mrr_needed: g.metric === "run_rate" ? round(g.targetMrr) : g.neededMrr != null ? round(g.neededMrr) : null,
    mrr_needed_meaning: g.metric === "run_rate" ? "MRR required at the deadline" : "average MRR needed across remaining in-window months",
    end_of_window_mrr_on_required_curve: g.endRequiredMrr != null ? round(g.endRequiredMrr) : undefined,
    new_accounts_needed_at_current_avg_price: g.clientsNeeded,
  };
}

export async function generateRoutes(goal, g, finance) {
  const snapshot = aiSnapshot(finance);
  const goalInfo = goalSummary(goal, g);
  const prompt = `${CONTEXT}

REAL NUMBERS (authoritative, from his CRM, expense tracker and Stripe):
${JSON.stringify(snapshot, null, 2)}

GOAL MATH (computed, authoritative):
${JSON.stringify(goalInfo, null, 2)}

TASK
Design routes to hit the goal. Base every route on the numbers above (current MRR, account count, average price, plans, pipeline). Do not invent current figures; any figure you project (prices, client counts, end MRR, period revenue) is an estimate.

1) flagship: "What Alex Hormozi would do". Apply his playbook concretely to THIS agency: build one Grand Slam Offer (dream outcome, price, a strong guarantee, bonuses), raise prices (state the move against today's average), a lead magnet, a referral/affiliate engine, and scale ONE core offer before adding new ones (say what to stop doing). Title it "What Alex Hormozi would do".
2) routes: 3 or 4 distinct alternatives, each a different primary lever, e.g. pricing/package redesign, more clients at current price (outbound/local SEO for his own brand), upsells/expansion into the existing base, productized apps/SaaS (he builds Base44 apps), referrals/partners. No two routes may share the same primary lever.
For the flagship and every route:
- milestones: one per month from next month through the deadline month (YYYY-MM), each with the target MRR for that month and a short focus. Milestones must be a realistic ramp from today's MRR.
- first_actions: exactly 3 concrete actions he can start this week (verbs first, specific).
- est_end_mrr and est_period_revenue (estimates), confidence, and the main risk.
headline: one blunt sentence on how hard the goal is from today's numbers and which route you would bet on.`;

  const res = await base44.integrations.Core.InvokeLLM({ prompt, model: MODEL, response_json_schema: ROUTES_SCHEMA });
  const out = typeof res === "string" ? JSON.parse(res) : res;
  return base44.entities.GoalRoutePlan.create({
    goal_id: goal.id,
    generated_at: new Date().toISOString(),
    flagship: out.flagship || {},
    routes: out.routes || [],
    headline: out.headline || "",
    snapshot: { ...snapshot, goal: goalInfo },
    model: MODEL,
  });
}

// ---------- Advisor ----------

const ADVICE_SCHEMA = {
  type: "object",
  properties: {
    learning_summary: { type: "string" },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          kind: { type: "string", enum: ["business", "personal"] },
          category: { type: "string", enum: ["hire", "ads", "tools", "productized_offer", "systems", "sales", "training", "personal_general", "other"] },
          rationale: { type: "string" },
          first_step: { type: "string" },
          est_cost: { type: "number" },
          cost_type: { type: "string", enum: ["one_time", "monthly", "time_only"] },
          hours_per_week: { type: "number" },
          est_monthly_impact: { type: "number" },
          payback_months: { type: "number" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          priority: { type: "number" },
        },
        required: ["title", "kind", "category", "rationale", "first_step"],
      },
    },
  },
  required: ["learning_summary", "recommendations"],
};

export function advicePrompt({ snapshot, goalInfo, history }) {
  return `${CONTEXT}

You are his always-learning investment advisor. Your job: recommend where to put MONEY and TIME next so he reaches his revenue goal.
Rules:
- Business investments first (hires/contractors, ads, tools, productized offers, systems, sales). Rank by payback against the goal.
- At most ONE "personal" item, general education only (e.g. emergency fund, tax-advantaged retirement accounts, index funds as a concept). No specific securities, no allocation percentages. Its rationale must end with "General information, not financial advice."
- You never execute trades or move money; recommendations only.
- Costs, impact and payback are estimates; keep them grounded in his real numbers below.

LEARN FROM HIS FEEDBACK (most recent first). Status meanings: accepted = he plans to do it, done = he did it, rejected = he does not want it (respect his note). Do not re-recommend rejected ideas unless the numbers changed materially and you say so. Build on accepted/done items (next step, or measure the result in the numbers). Avoid duplicating open items.
${history.length ? JSON.stringify(history, null, 2) : "No prior recommendations yet: this is the first run."}

CURRENT NUMBERS (authoritative):
${JSON.stringify(snapshot, null, 2)}

GOAL:
${JSON.stringify(goalInfo || "No revenue goal set", null, 2)}

Return 4-6 recommendations ordered by priority (1 = highest). learning_summary: 1-3 sentences on what you learned from his feedback and how this batch adapts (or say it is the first run), plus what changed in the numbers since the last batch if a previous snapshot exists.`;
}

export function adviceHistory(records) {
  return (records || []).slice(0, 40).map((r) => ({
    generated_at: r.generated_at,
    title: r.title,
    category: r.category,
    status: r.status,
    note: r.feedback_note || undefined,
    mrr_at_the_time: r.snapshot?.mrr,
  }));
}

export async function generateAdvice({ finance, goal, goalMath, existing, trigger = "manual" }) {
  const snapshot = aiSnapshot(finance);
  const goalInfo = goal && goalMath ? goalSummary(goal, goalMath) : null;
  const prompt = advicePrompt({ snapshot, goalInfo, history: adviceHistory(existing) });
  const res = await base44.integrations.Core.InvokeLLM({ prompt, model: MODEL, response_json_schema: ADVICE_SCHEMA });
  const out = typeof res === "string" ? JSON.parse(res) : res;
  const batch_id = `adv-${Date.now()}`;
  const generated_at = new Date().toISOString();
  const recs = (out.recommendations || []).slice(0, 6).map((r, i) => ({
    batch_id, generated_at, trigger,
    title: r.title,
    kind: r.kind === "personal" ? "personal" : "business",
    category: r.category || "other",
    rationale: r.rationale || "",
    first_step: r.first_step || "",
    est_cost: Number.isFinite(r.est_cost) ? r.est_cost : undefined,
    cost_type: r.cost_type || "one_time",
    hours_per_week: Number.isFinite(r.hours_per_week) ? r.hours_per_week : undefined,
    est_monthly_impact: Number.isFinite(r.est_monthly_impact) ? r.est_monthly_impact : undefined,
    payback_months: Number.isFinite(r.payback_months) ? r.payback_months : undefined,
    confidence: r.confidence || "medium",
    priority: Number.isFinite(r.priority) ? r.priority : i + 1,
    learning_summary: out.learning_summary || "",
    status: "new",
    snapshot: { ...snapshot, goal: goalInfo },
  }));
  return base44.entities.InvestmentAdvice.bulkCreate(recs);
}
