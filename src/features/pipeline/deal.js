// Deal value in two parts (Nov 2026): a one-time build/project price with a payment status, and a monthly plan.
//   deal_one_time { amount, status: quoted|invoiced|partly_paid|paid, paid_amount, source: manual|stripe, label }
//   deal_monthly  { plan: hypercare|gravitycare|none, amount, start: now|build_done|date, start_date }
// Pipeline value = one-time + 12 × monthly. Older leads with only lead_value read it as the one-time amount.
export const ONE_STATUS = [
  { key: "quoted", label: "Quoted" },
  { key: "invoiced", label: "Invoiced" },
  { key: "partly_paid", label: "Partly paid" },
  { key: "paid", label: "Paid" },
];
export const PLANS = [
  { key: "hypercare", label: "HyperCare+" },
  { key: "gravitycare", label: "GravïtyCare", hint: "Rare: no SEO or management" },
  { key: "none", label: "No plan" },
];
export const STARTS = [
  { key: "now", label: "Starts now" },
  { key: "build_done", label: "When the build is done" },
  { key: "date", label: "On a date" },
];

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const usd = (v) => `$${Math.round(n(v)).toLocaleString("en-US")}`;

export function dealOf(c) {
  const one = c?.deal_one_time || {};
  const mon = c?.deal_monthly || {};
  return {
    one: { amount: n(one.amount) || n(c?.lead_value), status: one.status || "quoted", paid: n(one.paid_amount), source: one.source || "manual", label: one.label || "" },
    mon: { plan: mon.plan || (n(mon.amount) ? "hypercare" : "none"), amount: n(mon.amount), start: mon.start || "now", start_date: mon.start_date || "" },
  };
}

export const planLabel = (k) => (PLANS.find((p) => p.key === k) || PLANS[0]).label;

// "$2,500 + $500/mo HyperCare+"
export function dealLabel(c) {
  const d = dealOf(c);
  const parts = [];
  if (d.one.amount) parts.push(usd(d.one.amount));
  if (d.mon.plan !== "none" && (d.mon.amount || parts.length)) parts.push(`${d.mon.amount ? `${usd(d.mon.amount)}/mo ` : ""}${planLabel(d.mon.plan)}`);
  return parts.join(" + ");
}

export const oneTimeOf = (c) => dealOf(c).one.amount;
export const monthlyOf = (c) => { const d = dealOf(c); return d.mon.plan === "none" ? 0 : d.mon.amount; };
export const pipelineValueOf = (c) => oneTimeOf(c) + 12 * monthlyOf(c);

// Patch for CRMClient from the editor's values.
export function dealPatch(v) {
  const one = { amount: n(v.one_amount) || null, status: v.one_status || "quoted", paid_amount: v.one_status === "partly_paid" || v.one_status === "paid" ? n(v.one_paid) || (v.one_status === "paid" ? n(v.one_amount) : 0) : 0, source: v.one_source || "manual" };
  if (v.one_label) one.label = v.one_label;
  const mon = { plan: v.mon_plan || "none", amount: v.mon_plan === "none" ? 0 : n(v.mon_amount) || null, start: v.mon_start || "now", start_date: v.mon_start === "date" ? v.mon_start_date || "" : "" };
  return { deal_one_time: one, deal_monthly: mon, lead_value: one.amount || null };
}

export function dealForm(c) {
  const d = dealOf(c);
  return {
    one_amount: d.one.amount ? String(d.one.amount) : "", one_status: d.one.status, one_paid: d.one.paid ? String(d.one.paid) : "", one_source: d.one.source, one_label: d.one.label,
    mon_plan: d.mon.plan, mon_amount: d.mon.amount ? String(d.mon.amount) : "", mon_start: d.mon.start, mon_start_date: d.mon.start_date,
  };
}
