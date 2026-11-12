// Client financing: schedule math shared by the Financing page and the sidebar badge.
// A plan is N equal installments of `payment_amount`, starting `first_due_date`, every `frequency`.
// Payments received are pooled and applied to the oldest installment first.

export const FREQUENCIES = [
  { value: "weekly", label: "Weekly", perYear: 52 },
  { value: "biweekly", label: "Every 2 weeks", perYear: 26 },
  { value: "monthly", label: "Monthly", perYear: 12 },
  { value: "quarterly", label: "Quarterly", perYear: 4 },
];
export const freqLabel = (f) => FREQUENCIES.find((x) => x.value === f)?.label || "Monthly";
const perYear = (f) => FREQUENCIES.find((x) => x.value === f)?.perYear || 12;

const DAY = 86400000;
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
// Parse "YYYY-MM-DD" as a local date (not UTC) so due dates don't shift a day.
export function parseDate(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  if (!m) { const d = new Date(s); return isNaN(d) ? null : startOfDay(d); }
  return new Date(+m[1], +m[2] - 1, +m[3]);
}
export const toISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fmtDate = (d) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);

function addMonthsClamped(d, months) {
  const day = d.getDate();
  const x = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, last));
  return x;
}

export function dueDates(plan) {
  const first = parseDate(plan.first_due_date);
  const n = Math.max(0, Math.floor(Number(plan.num_payments) || 0));
  if (!first || !n) return [];
  const out = [];
  for (let i = 0; i < n; i++) {
    if (plan.frequency === "weekly") out.push(new Date(first.getTime() + i * 7 * DAY));
    else if (plan.frequency === "biweekly") out.push(new Date(first.getTime() + i * 14 * DAY));
    else if (plan.frequency === "quarterly") out.push(addMonthsClamped(first, i * 3));
    else out.push(addMonthsClamped(first, i));
  }
  return out;
}

// Level payment for an amortized loan. APR 0 → simple split.
export function suggestPayment({ total_price, down_payment, interest_rate, num_payments, frequency }) {
  const P = (Number(total_price) || 0) - (Number(down_payment) || 0);
  const n = Math.floor(Number(num_payments) || 0);
  if (P <= 0 || n <= 0) return null;
  const r = (Number(interest_rate) || 0) / 100 / perYear(frequency);
  const pmt = r > 0 ? (P * r) / (1 - Math.pow(1 + r, -n)) : P / n;
  return Math.round(pmt * 100) / 100;
}

export const totalPaid = (plan) => (plan.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);

// Everything the page needs about one plan, as of `now`.
export function analyze(plan, now = new Date()) {
  const today = startOfDay(now);
  const amt = Number(plan.payment_amount) || 0;
  const dates = dueDates(plan);
  const n = dates.length;
  const scheduledTotal = amt * n;
  const paid = totalPaid(plan);
  const balance = Math.max(0, Math.round((scheduledTotal - paid) * 100) / 100);
  const grace = Number.isFinite(Number(plan.grace_days)) ? Number(plan.grace_days) : 3;

  // Installments fully covered by what has been paid, oldest first.
  const covered = amt > 0 ? Math.min(n, Math.floor((paid + 0.005) / amt)) : 0;
  const partial = amt > 0 && covered < n ? Math.max(0, paid - covered * amt) : 0;

  const installments = dates.map((date, i) => {
    let state = "upcoming";
    if (i < covered) state = "paid";
    else if (daysBetween(date, today) > grace) state = "late";
    else if (daysBetween(date, today) >= 0) state = "due";
    return { index: i + 1, date, amount: amt, state, partial: i === covered ? partial : 0 };
  });

  const lateItems = installments.filter((x) => x.state === "late");
  const behind = Math.max(0, Math.round((lateItems.length * amt - partial * (lateItems.length ? 1 : 0)) * 100) / 100);
  const next = installments.find((x) => x.state !== "paid") || null;
  const daysLate = lateItems.length ? daysBetween(lateItems[0].date, today) : 0;
  const daysToNext = next ? daysBetween(today, next.date) : null;

  let health;
  if (plan.status === "cancelled") health = "cancelled";
  else if (plan.status === "defaulted") health = "defaulted";
  else if (plan.status === "paid_off" || (n > 0 && balance <= 0.004)) health = "paid_off";
  else if (plan.status === "paused") health = "paused";
  else if (lateItems.length) health = "late";
  else if (next && daysToNext !== null && daysToNext <= 7) health = "due_soon";
  else health = "on_track";

  const lastPayment = (plan.payments || []).map((p) => parseDate(p.date)).filter(Boolean).sort((a, b) => b - a)[0] || null;
  const endDate = dates[n - 1] || null;
  const progress = scheduledTotal > 0 ? Math.min(1, paid / scheduledTotal) : 0;

  return { amt, dates, n, scheduledTotal, paid, balance, covered, partial, installments, lateItems, behind, next, daysLate, daysToNext, health, lastPayment, endDate, progress };
}

export const HEALTH = {
  late: { label: "Late", tone: "bg-[#ff3c00] text-white" },
  due_soon: { label: "Due soon", tone: "bg-[#ffaa00]/20 text-[#8a4b00]" },
  on_track: { label: "On track", tone: "bg-emerald-500/12 text-emerald-700" },
  paused: { label: "Paused", tone: "bg-ink/8 text-ink/60" },
  paid_off: { label: "Paid off", tone: "bg-ink text-white" },
  defaulted: { label: "Defaulted", tone: "bg-red-900 text-white" },
  cancelled: { label: "Cancelled", tone: "bg-ink/8 text-ink/50" },
};

// Count of plans that need attention (late), for the sidebar badge.
export const lateCount = (plans, now = new Date()) => plans.filter((p) => analyze(p, now).health === "late").length;
