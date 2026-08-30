// Deterministic Plan-to-Execute math engine.
// Pure JS — no SDK, shared by backend function and frontend live preview.
// The LLM is NEVER allowed to compute numbers; everything here is authoritative.

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
    monthly_churn_rate: 0.03,
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
    monthly_churn_rate: 0.02,
  },
  {
    key: "custom",
    name: "Custom Route",
    monthly_price: 0,
    has_addons: false,
    clients_per_month: 0,
    monthly_churn_rate: 0.03,
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

function normalizeInflow(route) {
  const price = Number(route.monthly_price) || 0;
  const hasAddons = !!route.has_addons;
  const addonAvg = hasAddons
    ? Number(route.addon_avg) || (route.addon_low != null && route.addon_high != null ? (Number(route.addon_low) + Number(route.addon_high)) / 2 : 0)
    : 0;
  return {
    price,
    cpm: Number(route.clients_per_month) || 0,
    churn: Number(route.monthly_churn_rate) || 0,
    has_addons: hasAddons,
    addon_avg: round2(addonAvg),
    attach: Number(route.addon_attach_rate) || 0,
  };
}

// 36-month simulation with per-inflow buckets. Base (existing) MRR depreciates
// at baseChurn; each inflow's bucket depreciates at its own churn then grows.
function simulate(inflows, baseChurn, currentMrr, goalMrr) {
  let base = Number(currentMrr) || 0;
  const buckets = inflows.map(() => 0);
  const clients = inflows.map(() => 0);
  let cumulative = 0;
  let monthsToGoal = null;
  let clientsAtGoal = null;
  const series = [];

  for (let m = 1; m <= 36; m++) {
    base = base * (1 - baseChurn);
    inflows.forEach((inf, k) => {
      buckets[k] = buckets[k] * (1 - inf.churn);
      buckets[k] += inf.cpm * inf.price;
      clients[k] += inf.cpm;
      if (inf.has_addons && inf.addon_avg) {
        cumulative += inf.cpm * inf.attach * inf.addon_avg;
      }
    });
    const mrr = base + buckets.reduce((s, b) => s + b, 0);
    const clientsTotal = clients.reduce((s, c) => s + c, 0);
    series.push({
      month: m,
      mrr: round2(mrr),
      cumulative_one_time: round2(cumulative),
      clients: round1(clientsTotal),
    });
    if (mrr >= goalMrr && monthsToGoal === null) {
      monthsToGoal = m;
      clientsAtGoal = clients.slice();
    }
  }
  return { series, monthsToGoal, clientsAtGoal };
}

function deriveRoute(route, inflows, sim, currentMrr, goalMrr) {
  const { series, monthsToGoal, clientsAtGoal } = sim;
  const reached = monthsToGoal !== null;
  const idx = reached ? monthsToGoal - 1 : 35;
  const point = series[idx];
  const one_time_cash = reached ? round2(point.cumulative_one_time) : 0;
  const mrr_total_at_goal = reached ? round2(point.mrr) : null;

  const totalCpm = inflows.reduce((s, inf) => s + inf.cpm, 0);
  const monthly_add = round2(inflows.reduce((s, inf) => s + inf.cpm * inf.price, 0));
  const pricePerClient = totalCpm > 0 ? round2(monthly_add / totalCpm) : 0;
  const churnUsed = inflows.length === 1
    ? inflows[0].churn
    : monthly_add > 0 ? round2(inflows.reduce((s, inf) => s + inf.cpm * inf.price * inf.churn, 0) / monthly_add) : 0;
  const churn_drag = round2(churnUsed * currentMrr);
  const gap = Math.max(0, goalMrr - currentMrr);
  const clients_needed_raw = pricePerClient > 0 ? Math.ceil(gap / pricePerClient) : null;
  const flags = {
    churn_trap: round2(churnUsed * goalMrr) > pricePerClient && pricePerClient > 0,
    never_reaches: !reached,
    addon_dependency: one_time_cash > goalMrr * 3,
  };
  return {
    id: route.id || null,
    name: route.name,
    system_generated: !!route.system_generated,
    monthly_price: pricePerClient,
    has_addons: inflows.some((i) => i.has_addons),
    clients_needed_raw,
    clients_needed_real: reached ? round1(clientsAtGoal ? clientsAtGoal.reduce((s, c) => s + c, 0) : 0) : null,
    months_to_goal: monthsToGoal,
    goal_date: goalDateFromMonths(monthsToGoal),
    one_time_cash_at_goal: round2(one_time_cash),
    mrr_total_at_goal: mrr_total_at_goal,
    mrr_per_client: pricePerClient,
    churn_drag,
    reached,
    mrr_at_36: series[35].mrr,
    flags,
    series,
  };
}

export function computeRoute(route, currentMrr, goalMrr) {
  const inf = normalizeInflow(route);
  const sim = simulate([inf], inf.churn, currentMrr, goalMrr);
  return deriveRoute(route, [inf], sim, currentMrr, goalMrr);
}

// Auto "Blended (auto)" route: run BOTH primary routes at once, each at the
// velocity you choose. blendedVelocities is an array (per primary route index)
// of explicit clients-per-month; a null/missing entry falls back to that
// route's own clients_per_month.
function buildBlended(routes, currentMrr, goalMrr, blendedVelocities) {
  const norm = routes.map(normalizeInflow);
  const primary = norm.slice(0, 2).filter((inf) => inf.price > 0);
  if (primary.length < 2) {
    return {
      id: "blended",
      name: "Blended (auto)",
      system_generated: true,
      monthly_price: 0,
      has_addons: norm.some((v) => v.has_addons),
      clients_needed_raw: null,
      clients_needed_real: null,
      months_to_goal: null,
      goal_date: null,
      one_time_cash_at_goal: 0,
      mrr_total_at_goal: null,
      mrr_per_client: 0,
      churn_drag: 0,
      reached: false,
      mrr_at_36: round2(currentMrr),
      flags: { churn_trap: false, never_reaches: true, addon_dependency: false },
      series: [],
    };
  }
  const bv = blendedVelocities || [];
  const inflows = primary.map((inf, i) => ({
    ...inf,
    cpm: bv[i] != null && !Number.isNaN(Number(bv[i])) ? Number(bv[i]) || 0 : inf.cpm,
  }));
  const monthlyAdd = inflows.reduce((s, inf) => s + inf.cpm * inf.price, 0) || 1;
  const baseChurn = round2(inflows.reduce((s, inf) => s + inf.cpm * inf.price * inf.churn, 0) / monthlyAdd);
  const sim = simulate(inflows, baseChurn, currentMrr, goalMrr);
  return deriveRoute({ id: "blended", name: "Blended (auto)", system_generated: true }, inflows, sim, currentMrr, goalMrr);
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