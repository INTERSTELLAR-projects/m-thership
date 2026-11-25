// Weekly "always learning" refresh for Financial > Advisor.
// Builds a snapshot from real records (CRMClient services, Expense, RevenueProjection,
// FinanceSnapshot, RevenueGoal), feeds the last 40 recommendations + Justin's feedback to
// the LLM and saves a new InvestmentAdvice batch (trigger: "scheduled").
// Advisory only: never executes trades, moves money or spends anything.
// Safe to schedule weekly; skips itself if a batch exists from the last 6 days (pass {force:true} to override as admin).
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";

const MODEL = "claude_sonnet_4_6";
const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

function serviceMonthly(sv: any) {
  if (!sv || sv.discontinued) return 0;
  const st = String(sv.status || "").toLowerCase();
  if (st === "canceled" || st === "incomplete_expired") return 0;
  const price = Number(sv.price) || 0;
  const interval = String(sv.interval || "month").toLowerCase();
  if (interval === "year") return price / 12;
  if (interval === "week") return (price * 52) / 12;
  return price;
}
const expenseMonthly = (e: any) => (e.frequency === "Annually" ? (Number(e.amount) || 0) / 12 : e.frequency === "Quarterly" ? (Number(e.amount) || 0) / 3 : Number(e.amount) || 0);

const SCHEMA = {
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

import { schedulerGate } from "../../shared/schedulerGate.ts";
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    if (!user) { const g = await schedulerGate(base44, user, "financeAdvisorWeekly", 1, 2); if (g) return g; }
    const body = await req.json().catch(() => ({}));
    const db = base44.asServiceRole.entities;

    const existing = (await db.InvestmentAdvice.list("-generated_at", 60)) || [];
    const latest = existing[0];
    if (!(body.force && user) && latest?.generated_at && Date.now() - new Date(latest.generated_at).getTime() < 6 * 86400000) {
      return Response.json({ skipped: true, reason: "A batch exists from the last 6 days", last: latest.generated_at });
    }

    const [clients, expenses, projections, snaps, goals] = await Promise.all([
      db.CRMClient.list("-created_date", 500),
      db.Expense.list("platform", 500),
      db.RevenueProjection.list("-expectedCloseDate", 500),
      db.FinanceSnapshot.list("-date", 60),
      db.RevenueGoal.list("-created_date", 10),
    ]);

    const active = (clients || []).filter((c: any) => c.status === "Active");
    const rows = active.map((c: any) => ({ id: c.id, name: c.business, bundle: c.bundle || null, plan: c.plan || "", mrr: (c.services || []).reduce((s: number, sv: any) => s + serviceMonthly(sv), 0) }));
    const mrr = rows.reduce((s: number, r: any) => s + r.mrr, 0);
    const accountKeys = new Set(rows.filter((r: any) => r.mrr > 0).map((r: any) => (r.bundle ? `b:${r.bundle}` : `c:${r.id}`)));
    const accounts = accountKeys.size;
    const expensesMonthly = (expenses || []).reduce((s: number, e: any) => s + expenseMonthly(e), 0);
    const pending = (projections || []).filter((p: any) => p.status === "Pending" && (p.projectionType || "Recurring") === "Recurring");
    const goal = (goals || []).find((g: any) => g.is_primary) || (goals || [])[0] || null;

    const snapshot = {
      as_of: new Date().toISOString(),
      mrr: round(mrr),
      arr_run_rate: round(mrr * 12),
      paying_accounts: accounts,
      active_clients: rows.length,
      avg_mrr_per_account: accounts ? round(mrr / accounts) : null,
      expenses_monthly_equiv: round(expensesMonthly),
      collected_this_month: "unknown in scheduled run (Stripe not queried)",
      pending_pipeline_mrr: round(pending.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)),
      pending_deals: pending.map((p: any) => ({ client: p.clientName, service: p.serviceTitle || "", mrr: Number(p.amount) || 0, close: p.expectedCloseDate || null })),
      plans: rows.filter((r: any) => r.mrr > 0).map((r: any) => ({ client: r.name, plan: r.plan, mrr: round(r.mrr) })),
      mrr_history: (snaps || []).slice(0, 30).map((s: any) => ({ date: s.date, mrr: s.mrr })),
    };
    const goalInfo = goal ? { title: goal.title, target_amount: goal.target_amount, metric: goal.metric, start_date: goal.start_date, deadline: goal.deadline } : "No revenue goal set";
    const history = existing.slice(0, 40).map((r: any) => ({ generated_at: r.generated_at, title: r.title, category: r.category, status: r.status, note: r.feedback_note || undefined, mrr_at_the_time: r.snapshot?.mrr }));

    const prompt = `Business: Interstellar Strategies, a small full-stack digital agency in Molalla, Oregon, run by founder Justin Cowell (web design/dev, SEO incl. AIO/GEO/AEO and local SEO, Google Business Profiles, automation, custom apps). Revenue is mostly monthly care plans plus one-time builds.

You are his always-learning investment advisor. Recommend where to put MONEY and TIME next so he reaches his revenue goal.
Rules:
- Business investments first (hires/contractors, ads, tools, productized offers, systems, sales). Rank by payback against the goal.
- At most ONE "personal" item, general education only. No specific securities, no allocation percentages. Its rationale must end with "General information, not financial advice."
- You never execute trades or move money; recommendations only. Costs, impact and payback are estimates grounded in the numbers below.

LEARN FROM HIS FEEDBACK (accepted = plans to do it, done = did it, rejected = does not want it; respect his notes). Do not re-recommend rejected ideas unless the numbers changed materially and you say so. Build on accepted/done items. Avoid duplicating open items.
${history.length ? JSON.stringify(history, null, 2) : "No prior recommendations yet."}

CURRENT NUMBERS (authoritative):
${JSON.stringify(snapshot, null, 2)}

GOAL:
${JSON.stringify(goalInfo, null, 2)}

Return 4-6 recommendations ordered by priority (1 = highest). learning_summary: 1-3 sentences on what you learned from his feedback and how this batch adapts, plus what changed in the numbers since the last batch.`;

    const res: any = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, model: MODEL, response_json_schema: SCHEMA });
    const out = typeof res === "string" ? JSON.parse(res) : res;
    const batch_id = `adv-${Date.now()}`;
    const generated_at = new Date().toISOString();
    const recs = (out?.recommendations || []).slice(0, 6).map((r: any, i: number) => ({
      batch_id, generated_at, trigger: "scheduled",
      title: r.title, kind: r.kind === "personal" ? "personal" : "business", category: r.category || "other",
      rationale: r.rationale || "", first_step: r.first_step || "",
      est_cost: Number.isFinite(r.est_cost) ? r.est_cost : undefined, cost_type: r.cost_type || "one_time",
      hours_per_week: Number.isFinite(r.hours_per_week) ? r.hours_per_week : undefined,
      est_monthly_impact: Number.isFinite(r.est_monthly_impact) ? r.est_monthly_impact : undefined,
      payback_months: Number.isFinite(r.payback_months) ? r.payback_months : undefined,
      confidence: r.confidence || "medium", priority: Number.isFinite(r.priority) ? r.priority : i + 1,
      learning_summary: out?.learning_summary || "", status: "new", snapshot: { ...snapshot, goal: goalInfo },
    }));
    if (recs.length) await db.InvestmentAdvice.bulkCreate(recs);

    // Also record a snapshot so MRR history keeps growing even if the page isn't opened.
    const today = new Date().toISOString().slice(0, 10);
    if (!(snaps || []).some((s: any) => s.date === today)) {
      const per_client: Record<string, unknown> = {};
      rows.forEach((r: any) => { per_client[r.id] = { name: r.name, mrr: round(r.mrr) }; });
      await db.FinanceSnapshot.create({ date: today, mrr: round(mrr), paying_clients: accounts, active_clients: rows.length, per_client, expenses_monthly: round(expensesMonthly), source: "scheduled" });
    }

    return Response.json({ ok: true, created: recs.length, batch_id });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
