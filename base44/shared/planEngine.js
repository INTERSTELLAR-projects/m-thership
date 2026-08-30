// Deterministic Plan-to-Execute math engine.
// Pure JS — no SDK, shared by backend function and frontend live preview.
// The LLM is NEVER allowed to compute numbers; everything here is authoritative.
//
// Model: pure linear subscription accumulation. We are just counting
// subscriptions. Each route adds (clients_per_month × monthly_price) of
// recurring revenue every month. No churn decay, no one-time cash.
//   MRR(month m) = currentMrr + m × monthlyAdd
//   months_to_goal = ceil(gap / monthlyAdd)
//   mrr_total_at_goal = currentMrr + months_to_goal × monthlyAdd   (= the MRR
//     you actually land at the moment you cross the goal — e.g. $10,202)
//   new_mrr_added = months_to_goal × monthlyAdd  (route-specific, auto-updates
//     off currentMrr)

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export const ROUTE_PRESETS = [
  {
    key: "orbit_seo_base",
    name: "Ørbit SEO Base",
    monthly_price: 500,
    has_addons: false,
    clients_per_month: 1,
    monthly_churn_rate: 0,
  },
  {
    key: "starship_maintenance",
    name: "Starshïp App Maintenance",
    monthly_price: 150,
    has_addons: true,
    addon_low: 250,
    addon_high: 5000,
    addon_avg: 1200,
    addon_attach_rate: 0.5,
    clients_per_month: 2,
    monthly_churn_rate: 0,
  },
  {
    key: "custom",
    name: "Custom Route",
    monthly_price: 0,
    has_addons: false,
    clients_per_month: 0,
    monthly_churn_rate: 0,
  },
];

export function presetFor(key) {
  return ROUTE_PRESETS.find((r) => r.key === key) || null;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function goalDateFromMonths(months) {
  if (months === null || months === undefined) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return MONTH_ABBR[d.getMonth()] + " " + d.getFullYear();
}

function buildSeries(currentMrr, monthlyAdd, cpmTotal, months) {
  const horizon = months != null ? Math.min(24, months + 2) : 24;
  const out = [];
  for (let m = 1; m <= horizon; m++) {
    out.push({
      month: m,
      mrr: round2(currentMrr + m * monthlyAdd),
      clients: round1(cpmTotal * m),
    });
  }
  return out;
}

function solveLinear(currentMrr, goalMrr, monthlyAdd) {
  const cur = Number(currentMrr) || 0;
  const goal = Number(goalMrr) || 0;
  const gap = Math.max(0, goal - cur);
  if (gap <= 0) return { months: 0, mrrAtGoal: round2(cur), newAdded: 0, reached: true };
  if (monthlyAdd > 0) {
    const months = Math.ceil(gap / monthlyAdd);
    return { months, mrrAtGoal: round2(cur + months * monthlyAdd), newAdded: round2(months * monthlyAdd), reached: true };
  }
  return { months: null, mrrAtGoal: null, newAdded: null, reached: false };
}

export function computeRoute(route, currentMrr, goalMrr) {
  const cur = Number(currentMrr) || 0;
  const goal = Number(goalMrr) || 0;
  const price = Number(route.monthly_price) || 0;
  const cpm = Number(route.clients_per_month) || 0;
  const monthlyAdd = round2(price * cpm);
  const gap = Math.max(0, goal - cur);
  const { months, mrrAtGoal, newAdded, reached } = solveLinear(cur, goal, monthlyAdd);
  const clients_needed_raw = gap <= 0 ? 0 : price > 0 ? Math.ceil(gap / price) : null;
  return {
    id: route.id || null,
    name: route.name,
    system_generated: !!route.system_generated,
    monthly_price: round2(price),
    has_addons: !!route.has_addons,
    clients_needed_raw,
    months_to_goal: months,
    goal_date: goalDateFromMonths(months),
    mrr_total_at_goal: mrrAtGoal,
    new_mrr_added: newAdded,
    mrr_per_client: round2(price),
    reached,
    mrr_at_36: round2(cur + 36 * monthlyAdd),
    flags: { never_reaches: !reached },
    series: buildSeries(cur, monthlyAdd, cpm, months),
  };
}

// Blended (auto): run BOTH primary routes at once, each at the velocity you
// choose (blendedVelocities array, per primary route index; null/missing falls
// back to that route's own clients_per_month). "Monthly price" for the blend
// is the total recurring added per month (Σ velocity × price), e.g.
// 1 × $500 + 1 × $150 = $650.
function buildBlended(routes, currentMrr, goalMrr, blendedVelocities) {
  const cur = Number(currentMrr) || 0;
  const goal = Number(goalMrr) || 0;
  const norm = routes.map((r) => ({
    price: Number(r.monthly_price) || 0,
    cpm: Number(r.clients_per_month) || 0,
    has_addons: !!r.has_addons,
  }));
  const primary = norm.slice(0, 2).filter((r) => r.price > 0);
  if (primary.length < 2) {
    return {
      id: "blended",
      name: "Blended (auto)",
      system_generated: true,
      monthly_price: 0,
      has_addons: norm.some((r) => r.has_addons),
      clients_needed_raw: null,
      months_to_goal: null,
      goal_date: null,
      mrr_total_at_goal: null,
      new_mrr_added: null,
      mrr_per_client: 0,
      reached: false,
      mrr_at_36: round2(cur),
      flags: { never_reaches: true },
      series: [],
    };
  }
  const bv = blendedVelocities || [];
  const inflows = primary.map((r, i) => ({
    price: r.price,
    cpm: bv[i] != null && !Number.isNaN(Number(bv[i])) ? Number(bv[i]) || 0 : r.cpm,
    has_addons: r.has_addons,
  }));
  const monthlyAdd = round2(inflows.reduce((s, inf) => s + inf.cpm * inf.price, 0));
  const totalCpm = inflows.reduce((s, inf) => s + inf.cpm, 0);
  const pricePerClient = totalCpm > 0 ? round2(monthlyAdd / totalCpm) : 0;
  const gap = Math.max(0, goal - cur);
  const { months, mrrAtGoal, newAdded, reached } = solveLinear(cur, goal, monthlyAdd);
  const clients_needed_raw = gap <= 0 ? 0 : totalCpm > 0 ? Math.ceil(gap / pricePerClient) : null;
  return {
    id: "blended",
    name: "Blended (auto)",
    system_generated: true,
    monthly_price: monthlyAdd,
    has_addons: inflows.some((inf) => inf.has_addons),
    clients_needed_raw,
    months_to_goal: months,
    goal_date: goalDateFromMonths(months),
    mrr_total_at_goal: mrrAtGoal,
    new_mrr_added: newAdded,
    mrr_per_client: pricePerClient,
    reached,
    mrr_at_36: round2(cur + 36 * monthlyAdd),
    flags: { never_reaches: !reached },
    series: buildSeries(cur, monthlyAdd, totalCpm, months),
  };
}

export function computePlan(plan, currentMrr) {
  const goal = Number(plan.target_mrr != null ? plan.target_mrr : plan.goal_mrr) || 0;
  const cur = Number(currentMrr) || 0;
  const routes = (plan.routes || []).map((r) => computeRoute(r, cur, goal));
  const blended = buildBlended(plan.routes || [], cur, goal, plan.blended_velocities);
  const all = [...routes, blended];
  const reachedRoutes = all
    .filter((r) => r.reached)
    .sort((a, b) => a.months_to_goal - b.months_to_goal || b.mrr_at_36 - a.mrr_at_36);
  const winner = reachedRoutes[0] || all.slice().sort((a, b) => b.mrr_at_36 - a.mrr_at_36)[0];
  return {
    goal_mrr: round2(goal),
    target_mrr: round2(goal),
    current_mrr: round2(cur),
    gap_at_run: round2(Math.max(0, goal - cur)),
    baseline_mrr: plan.baseline_mrr != null ? round2(plan.baseline_mrr) : round2(cur),
    routes,
    blended,
    winner_name: winner ? winner.name : null,
    achieved: cur >= goal && goal > 0,
  };
}