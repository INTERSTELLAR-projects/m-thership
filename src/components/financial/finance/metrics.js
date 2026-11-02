// Pure finance math for the Financial dashboard, Goal tab and Advisor.
// Every number here is derived from real records (CRMClient services, Expense,
// RevenueProjection, FinanceSnapshot, Stripe functions). Nothing is invented:
// when a source is missing the value is null and the UI shows an empty state.

export const FLAME = { deep: "#ff3c00", mid: "#ff6a00", light: "#ffaa00", ink: "#1a1a1a" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LIVE_SUB = new Set(["active", "trialing", "past_due", "unpaid", "canceled"]);

export const pad = (n) => String(n).padStart(2, "0");
export const monthKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const keyToDate = (k) => { const [y, m] = String(k).split("-").map(Number); return new Date(y, m - 1, 1); };
export const monthLabel = (k, withYear = false) => { const d = keyToDate(k); return withYear ? `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}` : MONTHS[d.getMonth()]; };
export const addMonths = (k, n) => { const d = keyToDate(k); return monthKeyOf(new Date(d.getFullYear(), d.getMonth() + n, 1)); };
export const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export function lastMonthKeys(n = 12, now = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  return out;
}

export const money = (n, digits = 0) =>
  n == null || Number.isNaN(n) ? "—" : `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export function compactMoney(n) {
  if (n == null || Number.isNaN(n)) return "—";
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.0+$/, "")}M`;
  if (a >= 1e4) return `${s}$${(a / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return money(n);
}

export const pct = (n, digits = 1) => (n == null || !Number.isFinite(n) ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`);

// ---------- Clients / MRR (CRMClient.services) ----------

export function serviceMonthly(sv) {
  if (!sv || sv.discontinued) return 0;
  const st = String(sv.status || "").toLowerCase();
  if (st === "canceled" || st === "incomplete_expired") return 0;
  const price = Number(sv.price) || 0;
  const interval = String(sv.interval || "month").toLowerCase();
  if (interval === "year") return price / 12;
  if (interval === "week") return (price * 52) / 12;
  return price;
}

export const clientMrr = (c) => (c?.services || []).reduce((s, sv) => s + serviceMonthly(sv), 0);
export const clientStripeMrr = (c) => (c?.services || []).filter((sv) => sv.stripe).reduce((s, sv) => s + serviceMonthly(sv), 0);

export function clientRows(clients) {
  return (clients || [])
    .filter((c) => c.status === "Active")
    .map((c) => ({ id: c.id, name: c.business, bundle: c.bundle || null, plan: c.plan || "", mrr: clientMrr(c), stripeMrr: clientStripeMrr(c) }));
}

// Accounts = clients billed together (same bundle) count as one account.
export function accountRows(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const key = r.bundle ? `b:${r.bundle}` : `c:${r.id}`;
    const cur = map.get(key) || { key, name: r.bundle || r.name, members: [], mrr: 0 };
    cur.members.push(r.name);
    cur.mrr += r.mrr;
    map.set(key, cur);
  });
  return [...map.values()].map((a) => ({ ...a, label: a.members.length > 1 ? `${a.name} (${a.members.join(" + ")})` : a.members[0] })).sort((a, b) => b.mrr - a.mrr);
}

// ---------- Expenses ----------

export function expenseMonthlyEquiv(e) {
  const amt = Number(e.amount) || 0;
  if (e.frequency === "Annually") return amt / 12;
  if (e.frequency === "Quarterly") return amt / 3;
  return amt;
}

// Cash actually marked paid, bucketed by month, from Expense.paidCycles.
// Monthly/quarterly cycle keys are "YYYY-<0-based month>"; annual keys are "YYYY"
// (the due year). An annual bill paid ahead of its due date lands in the current month.
export function expenseCashOutByMonth(expenses, now = new Date()) {
  const out = {};
  const curKey = monthKeyOf(now);
  (expenses || []).forEach((e) => {
    (e.paidCycles || []).forEach((cycle) => {
      let key;
      if (/^\d{4}-\d{1,2}$/.test(cycle)) {
        const [y, m] = cycle.split("-").map(Number);
        key = `${y}-${pad(m + 1)}`;
      } else if (/^\d{4}$/.test(cycle)) {
        key = `${cycle}-${pad(e.dueMonth || 1)}`;
        if (key > curKey) key = curKey;
      }
      if (key) out[key] = (out[key] || 0) + (Number(e.amount) || 0);
    });
  });
  return out;
}

// ---------- Stripe-derived history ----------

const monthEnd = (k) => { const d = keyToDate(k); return new Date(d.getFullYear(), d.getMonth() + 1, 0); };
const dayStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function liveSubs(subs) {
  return (subs || []).filter((s) => LIVE_SUB.has(s.status) && s.started && (s.status !== "canceled" || s.ended));
}

// MRR at each month end, from Stripe subscription start/end dates (ended needs the shared/stripe.ts `ended` field).
export function mrrHistoryFromStripe(subs, keys) {
  const list = liveSubs(subs);
  if (!list.length) return null;
  return keys.map((k) => {
    const end = dayStr(monthEnd(k));
    const active = list.filter((s) => s.started <= end && (!s.ended || s.ended > end));
    const customers = new Set(active.map((s) => s.client?.id || s.customer?.id || s.id));
    return { key: k, mrr: active.reduce((a, s) => a + (Number(s.mrr) || 0), 0), clients: customers.size };
  });
}

// New / expansion / churn per month from Stripe subscriptions.
export function movementFromStripe(subs, keys) {
  const list = liveSubs(subs);
  if (!list.length) return null;
  const owner = (s) => s.client?.id || s.customer?.id || s.id;
  return keys.map((k) => {
    const start = `${k}-01`;
    const end = dayStr(monthEnd(k));
    let added = 0, expansion = 0, churn = 0;
    list.forEach((s) => {
      if (s.started >= start && s.started <= end) {
        const hadBefore = list.some((o) => o !== s && owner(o) === owner(s) && o.started < start && (!o.ended || o.ended >= start));
        if (hadBefore) expansion += Number(s.mrr) || 0; else added += Number(s.mrr) || 0;
      }
      if (s.ended && s.ended >= start && s.ended <= end) churn += Number(s.mrr) || 0;
    });
    return { key: k, new: added, expansion, churn: -churn, net: added + expansion - churn };
  });
}

// ---------- Snapshot-derived history (fallback, grows daily) ----------

function lastSnapshotPerMonth(snapshots) {
  const map = new Map();
  [...(snapshots || [])].sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((s) => map.set(String(s.date).slice(0, 7), s));
  return map;
}

export function mrrHistoryFromSnapshots(snapshots, keys) {
  const map = lastSnapshotPerMonth(snapshots);
  const pts = keys.map((k) => (map.has(k) ? { key: k, mrr: Number(map.get(k).mrr) || 0, clients: Number(map.get(k).paying_clients) || 0 } : { key: k, mrr: null, clients: null }));
  return pts.filter((p) => p.mrr != null).length >= 2 ? pts : null;
}

export function movementFromSnapshots(snapshots, keys) {
  const map = lastSnapshotPerMonth(snapshots);
  const have = keys.filter((k) => map.has(k));
  if (have.length < 2) return null;
  const out = [];
  for (let i = 1; i < have.length; i++) {
    const prev = map.get(have[i - 1]).per_client || {};
    const cur = map.get(have[i]).per_client || {};
    let added = 0, expansion = 0, churn = 0;
    new Set([...Object.keys(prev), ...Object.keys(cur)]).forEach((id) => {
      const a = Number(prev[id]?.mrr) || 0;
      const b = Number(cur[id]?.mrr) || 0;
      if (a === 0 && b > 0) added += b;
      else if (b > a) expansion += b - a;
      else if (b < a) churn += a - b;
    });
    out.push({ key: have[i], new: added, expansion, churn: -churn, net: added + expansion - churn });
  }
  return out;
}

// ---------- Main roll-up ----------

export function computeFinance({ clients, expenses, projections, snapshots, stripeRev, stripeSubs, now = new Date() }) {
  const keys = lastMonthKeys(12, now);
  const curKey = monthKeyOf(now);
  const rows = clientRows(clients);
  const paying = rows.filter((r) => r.mrr > 0);
  const accounts = accountRows(paying);
  const mrr = rows.reduce((s, r) => s + r.mrr, 0);
  const stripeBilledMrr = rows.reduce((s, r) => s + r.stripeMrr, 0);
  const offStripeMrr = mrr - stripeBilledMrr;
  const avgPerAccount = accounts.length ? mrr / accounts.length : null;

  const expensesMonthly = (expenses || []).reduce((s, e) => s + expenseMonthlyEquiv(e), 0);
  const cashOutMap = expenseCashOutByMonth(expenses, now);

  const stripeOk = Boolean(stripeRev?.configured && !stripeRev?.error && Array.isArray(stripeRev?.months));
  const stripeMonths = stripeOk ? new Map(stripeRev.months.map((m) => [m.key, m])) : null;
  const subsOk = Boolean(stripeSubs?.configured && !stripeSubs?.error && Array.isArray(stripeSubs?.subscriptions));

  const collectedThisMonth = stripeOk ? Number(stripeMonths.get(curKey)?.collected) || 0 : null;
  const feesThisMonth = stripeOk ? Number(stripeMonths.get(curKey)?.fees) || 0 : 0;
  const subRevenueThisMonth = subsOk ? Number(stripeSubs.month?.subscriptions) || 0 : null;
  const outstanding = subRevenueThisMonth != null ? Math.max(0, stripeBilledMrr - subRevenueThisMonth) : null;

  // Monthly series (12 months)
  const history = (subsOk && mrrHistoryFromStripe(stripeSubs.subscriptions, keys)) || mrrHistoryFromSnapshots(snapshots, keys);
  const historySource = subsOk && mrrHistoryFromStripe(stripeSubs.subscriptions, keys) ? "stripe" : history ? "snapshots" : null;
  const movement = (subsOk && movementFromStripe(stripeSubs.subscriptions, keys)) || movementFromSnapshots(snapshots, keys);
  const movementSource = subsOk && movementFromStripe(stripeSubs.subscriptions, keys) ? "stripe" : movement ? "snapshots" : null;

  const series = keys.map((k, i) => {
    const sm = stripeMonths?.get(k);
    const cashOut = (cashOutMap[k] || 0) + (sm ? (Number(sm.fees) || 0) + (Number(sm.capital) || 0) : 0);
    const collected = sm ? Number(sm.collected) || 0 : null;
    const h = history ? history[i] : null;
    return {
      key: k,
      label: monthLabel(k),
      collected,
      stripeNet: sm ? Number(sm.net) || 0 : null,
      expensesPaid: cashOutMap[k] || 0,
      cashOut,
      net: collected != null ? collected - cashOut : null,
      mrr: h?.mrr ?? null,
      clients: h?.clients ?? null,
    };
  });
  // The current month's MRR point is always the live CRM figure.
  series[series.length - 1].mrr = mrr;
  series[series.length - 1].clients = accounts.length;

  const netThisMonth = collectedThisMonth != null ? collectedThisMonth - series[series.length - 1].cashOut : null;

  const pipeline = (projections || []).filter((p) => p.status === "Pending" && (p.projectionType || "Recurring") === "Recurring");
  const pipelineMrr = pipeline.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const trailing12Collected = stripeOk ? stripeRev.months.reduce((s, m) => s + (Number(m.collected) || 0), 0) : null;

  return {
    keys, curKey, rows, paying, accounts, mrr, arr: mrr * 12, stripeBilledMrr, offStripeMrr, avgPerAccount,
    expensesMonthly, cashOutMap, stripeOk, subsOk, collectedThisMonth, feesThisMonth, subRevenueThisMonth, outstanding,
    netThisMonth, series, history, historySource, movement, movementSource, pipeline, pipelineMrr, trailing12Collected,
    activeClients: rows.length,
  };
}

// Compact, real-number snapshot passed to the AI and stored with its output.
export function aiSnapshot(f) {
  return {
    as_of: new Date().toISOString(),
    mrr: round(f.mrr),
    arr_run_rate: round(f.arr),
    paying_accounts: f.accounts.length,
    active_clients: f.activeClients,
    avg_mrr_per_account: f.avgPerAccount != null ? round(f.avgPerAccount) : null,
    expenses_monthly_equiv: round(f.expensesMonthly),
    collected_this_month: f.collectedThisMonth != null ? round(f.collectedThisMonth) : "unknown (Stripe not connected)",
    trailing_12mo_collected: f.trailing12Collected != null ? round(f.trailing12Collected) : "unknown",
    pending_pipeline_mrr: round(f.pipelineMrr),
    pending_deals: f.pipeline.map((p) => ({ client: p.clientName, service: p.serviceTitle || "", mrr: Number(p.amount) || 0, close: p.expectedCloseDate || null })),
    accounts: f.accounts.map((a) => ({ account: a.label, mrr: round(a.mrr) })),
    plans: f.paying.map((r) => ({ client: r.name, plan: r.plan, mrr: round(r.mrr) })),
    mrr_history: f.history ? f.history.filter((h) => h.mrr != null).map((h) => ({ month: h.key, mrr: round(h.mrr) })) : "not enough history yet",
  };
}

export const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ---------- Goal math ----------

export function goalDefaults() {
  const y = new Date().getFullYear() + (new Date().getMonth() >= 6 ? 1 : 0);
  return { title: `$1M in ${y}`, target_amount: 1000000, metric: "annual_revenue", start_date: `${y}-01-01`, deadline: `${y}-12-31`, is_primary: true };
}

// Solve for the constant monthly growth rate g so that the in-period MRR stream hits the target.
function solveGrowth(mrr, offsets, needed) {
  if (!(mrr > 0) || !offsets.length) return null;
  const total = (g) => offsets.reduce((s, k) => s + mrr * Math.pow(1 + g, k), 0);
  if (total(0) >= needed) return 0;
  let lo = 0, hi = 3;
  if (total(hi) < needed) return null;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (total(mid) < needed) lo = mid; else hi = mid; }
  return hi;
}

export function computeGoal(goal, f, now = new Date()) {
  const target = Number(goal.target_amount) || 0;
  const startKey = String(goal.start_date || "").slice(0, 7) || f.curKey;
  const endKey = String(goal.deadline || "").slice(0, 7) || f.curKey;
  const curKey = f.curKey;
  const deadlineDate = goal.deadline ? new Date(`${goal.deadline}T23:59:59`) : null;
  const msLeft = deadlineDate ? Math.max(0, deadlineDate - now) : 0;
  const mrr = f.mrr;
  const avg = f.avgPerAccount;

  // Future months (after the current one) up to the deadline, with offsets in months from now.
  const future = [];
  for (let k = addMonths(curKey, 1), i = 1; k <= endKey && i < 240; k = addMonths(k, 1), i++) future.push({ key: k, offset: i, inPeriod: k >= startKey });
  const inPeriod = future.filter((m) => m.inPeriod);

  if (goal.metric === "run_rate") {
    const targetMrr = target / 12;
    const n = future.length;
    const g = mrr > 0 && n > 0 ? Math.max(0, Math.pow(targetMrr / mrr, 1 / n) - 1) : null;
    const progress = target > 0 ? (mrr * 12) / target : 0;
    const trajectory = future.map((m) => ({ key: m.key, required: g != null ? mrr * Math.pow(1 + g, m.offset) : null, runRate: mrr }));
    return {
      metric: "run_rate", target, targetMrr, progress, current: mrr * 12, gap: Math.max(0, target - mrr * 12),
      requiredGrowth: g, monthsLeft: n, msLeft, deadlineDate, trajectory,
      neededMrr: targetMrr, mrrGap: Math.max(0, targetMrr - mrr),
      clientsNeeded: avg ? Math.ceil(Math.max(0, targetMrr - mrr) / avg) : null,
      projected: mrr * 12, onPace: progress >= 1,
    };
  }

  // annual_revenue: collected inside [start, deadline] + MRR stream for the rest.
  let realized = 0;
  let realizedKnown = true;
  if (curKey >= startKey) {
    if (!f.stripeOk) realizedKnown = false;
    else f.series.forEach((s) => { if (s.key >= startKey && s.key <= endKey && s.collected != null) realized += s.collected; });
  }
  const restOfThisMonth = curKey >= startKey && curKey <= endKey ? Math.max(0, mrr - (f.collectedThisMonth || 0)) : 0;
  const projected = realized + restOfThisMonth + mrr * inPeriod.length;
  const remaining = Math.max(0, target - realized - restOfThisMonth);
  const g = solveGrowth(mrr, inPeriod.map((m) => m.offset), remaining);
  const neededMrr = inPeriod.length ? remaining / inPeriod.length : null;
  const trajectory = future.map((m) => ({ key: m.key, required: g != null ? mrr * Math.pow(1 + g, m.offset) : null, runRate: mrr, inPeriod: m.inPeriod }));
  const endRequiredMrr = g != null && inPeriod.length ? mrr * Math.pow(1 + g, inPeriod[inPeriod.length - 1].offset) : null;

  return {
    metric: "annual_revenue", target, realized, realizedKnown, projected, progress: target > 0 ? realized / target : 0,
    paceRatio: target > 0 ? projected / target : 0, current: realized, gap: Math.max(0, target - projected),
    remaining, requiredGrowth: g, monthsLeft: inPeriod.length, monthsUntilStart: future.filter((m) => !m.inPeriod).length,
    msLeft, deadlineDate, trajectory, neededMrr, endRequiredMrr, mrrGap: neededMrr != null ? Math.max(0, neededMrr - mrr) : null,
    clientsNeeded: avg && neededMrr != null ? Math.ceil(Math.max(0, neededMrr - mrr) / avg) : null,
    onPace: projected >= target,
  };
}
