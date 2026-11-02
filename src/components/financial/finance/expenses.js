// Expense schedule math shared by the Expenses and Categories tabs.
// Expense fields: platform, amount, frequency (Monthly|Quarterly|Annually),
// dueDay, dueMonth (annual only), category, paidCycles[].
import { addMonths, expenseMonthlyEquiv, keyToDate, lastMonthKeys, monthKeyOf, expenseCashOutByMonth } from "./metrics";

export const FREQUENCIES = ["Monthly", "Quarterly", "Annually"];
export const DAY_MS = 24 * 60 * 60 * 1000;

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const dateIn = (y, m, day) => new Date(y, m, Math.min(Math.max(1, Number(day) || 1), daysInMonth(y, m)));

// The due date of the current billing cycle (same rules the page has always used).
export function getCurrentDueDate(expense, now) {
  const today = startOfDay(now);
  if (expense.frequency === "Monthly" || expense.frequency === "Quarterly") {
    return new Date(now.getFullYear(), now.getMonth(), expense.dueDay);
  }
  const thisYear = new Date(now.getFullYear(), (expense.dueMonth || 1) - 1, expense.dueDay);
  if (thisYear < today) return new Date(now.getFullYear() + 1, (expense.dueMonth || 1) - 1, expense.dueDay);
  return thisYear;
}

// Monthly/quarterly cycle keys are "YYYY-<0-based month>"; annual keys are "YYYY".
export function getCycleKey(expense, now) {
  const due = getCurrentDueDate(expense, now);
  if (expense.frequency === "Monthly" || expense.frequency === "Quarterly") return `${due.getFullYear()}-${due.getMonth()}`;
  return `${due.getFullYear()}`;
}

export function getStatus(expense, now) {
  if ((expense.paidCycles || []).includes(getCycleKey(expense, now))) return "Paid";
  if (getCurrentDueDate(expense, now) < startOfDay(now)) return "Overdue";
  return "Upcoming";
}

export const enrichExpense = (e, now) => ({ ...e, dueDate: getCurrentDueDate(e, now), status: getStatus(e, now), monthly: expenseMonthlyEquiv(e) });

export const formatDueDate = (date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const daysUntil = (date, now) => Math.round((startOfDay(date) - startOfDay(now)) / DAY_MS);

// Anchor month (0-based) for quarterly bills: dueMonth if set, otherwise the current month.
const quarterAnchor = (e, now) => (e.dueMonth ? Number(e.dueMonth) - 1 : now.getMonth());

// Does this expense bill in month (y, m)?
function billsInMonth(e, y, m, now) {
  if (e.frequency === "Annually") return m === (Number(e.dueMonth) || 1) - 1;
  if (e.frequency === "Quarterly") return (((m - quarterAnchor(e, now)) % 3) + 3) % 3 === 0;
  return true;
}

// Dated occurrences between [from, to] (inclusive), with their cycle key and paid flag.
export function occurrencesBetween(expenses, from, to, now) {
  const out = [];
  const start = startOfDay(from);
  const end = startOfDay(to);
  (expenses || []).forEach((e) => {
    for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const y = d.getFullYear();
      const m = d.getMonth();
      if (!billsInMonth(e, y, m, now)) continue;
      const date = dateIn(y, m, e.dueDay);
      if (date < start || date > end) continue;
      const cycle = e.frequency === "Annually" ? `${y}` : `${y}-${m}`;
      out.push({ expense: e, date, cycle, paid: (e.paidCycles || []).includes(cycle), amount: Number(e.amount) || 0 });
    }
  });
  return out.sort((a, b) => a.date - b.date);
}

// Projected billed amount per month for the next n months (from recurrence).
export function projectSpend(expenses, n, now) {
  const first = monthKeyOf(now);
  return Array.from({ length: n }, (_, i) => {
    const key = addMonths(first, i);
    const d = keyToDate(key);
    const total = (expenses || []).reduce((s, e) => s + (billsInMonth(e, d.getFullYear(), d.getMonth(), now) ? Number(e.amount) || 0 : 0), 0);
    return { key, projected: total };
  });
}

// Real paid history (last n months) from paidCycles.
export function paidHistory(expenses, n, now) {
  const map = expenseCashOutByMonth(expenses, now);
  return lastMonthKeys(n, now).map((key) => ({ key, paid: map[key] || 0 }));
}

// Billed totals per year by frequency.
export function billedBreakdown(expenses) {
  const by = { Monthly: 0, Quarterly: 0, Annually: 0 };
  (expenses || []).forEach((e) => {
    const amt = Number(e.amount) || 0;
    if (e.frequency === "Annually") by.Annually += amt;
    else if (e.frequency === "Quarterly") by.Quarterly += amt * 4;
    else by.Monthly += amt * 12;
  });
  return by;
}

export function categoryTotals(expenses) {
  const map = new Map();
  (expenses || []).forEach((e) => {
    const cat = e.category || "Uncategorized";
    const cur = map.get(cat) || { name: cat, monthly: 0, count: 0, items: [] };
    cur.monthly += expenseMonthlyEquiv(e);
    cur.count += 1;
    cur.items.push(e);
    map.set(cat, cur);
  });
  return [...map.values()].sort((a, b) => b.monthly - a.monthly);
}

const STOP = new Set(["the", "and", "pro", "plus", "start", "simple", "business", "custom", "plan", "basic", "premium", "team", "app", "inc", "llc", "com", "subscription", "management", "start-up", "startup"]);
const tokens = (s) => String(s || "").toLowerCase().split(/[^a-z0-9+]+/).filter((t) => t.length >= 3 && !STOP.has(t));

// Suggestions only: name overlaps and crowded categories. No savings estimates.
export function savingsWatch(expenses) {
  const list = (expenses || []).filter((e) => e.platform);
  const nameFlags = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = tokens(list[i].platform);
      const b = new Set(tokens(list[j].platform));
      const shared = a.filter((t) => b.has(t));
      if (shared.length) nameFlags.push({ items: [list[i], list[j]], reason: `Both mention "${shared[0]}"` });
    }
  }
  const crowded = categoryTotals(list).filter((c) => c.count >= 2 && c.name !== "Uncategorized").sort((a, b) => b.count - a.count || b.monthly - a.monthly).slice(0, 3);
  const top = [...list].sort((a, b) => expenseMonthlyEquiv(b) - expenseMonthlyEquiv(a)).slice(0, 3);
  return { nameFlags: nameFlags.slice(0, 4), crowded, top };
}
