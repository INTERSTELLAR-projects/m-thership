// Client portal "Work we did": how many things we finished for a client, by period and by category.
// Counts only, never time. Pure (no imports) so functions/portal and tests/unit/workCounts.test.js share it.
// Callers pass ONLY the items a client is allowed to see (client-visible, finished, with client-safe copy).
// Periods are calendar days in America/Los_Angeles; weeks run Monday to Sunday.

const TZ = "America/Los_Angeles";
const DAY_MS = 864e5;
const fmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function pacificDay(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // already a calendar day (old work-log rows)
  const d = v instanceof Date ? v : new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(d)) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}

export type CountItem = { at?: unknown; category?: unknown };
export type WorkCounts = { today: number; this_week: number; this_month: number; last_month: number; this_year: number; all_time: number; by_category_this_month: Record<string, number> };

export function workCounts(items: CountItem[], now: Date = new Date()): WorkCounts {
  const today = pacificDay(now) as string;
  const [y, m, d] = today.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const weekStart = new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY_MS).toISOString().slice(0, 10);
  const weekEnd = new Date(Date.parse(`${weekStart}T00:00:00Z`) + 6 * DAY_MS).toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const lastMonth = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const out: WorkCounts = { today: 0, this_week: 0, this_month: 0, last_month: 0, this_year: 0, all_time: 0, by_category_this_month: {} };
  for (const it of items || []) {
    out.all_time += 1; // undated items count in all time only
    const day = pacificDay(it?.at);
    if (!day) continue;
    if (day === today) out.today += 1; // portal v2: Today / This week / This month / This year toggles
    if (day.slice(0, 4) === today.slice(0, 4)) out.this_year += 1;
    if (day >= weekStart && day <= weekEnd) out.this_week += 1;
    if (day.slice(0, 7) === lastMonth) out.last_month += 1;
    if (day.slice(0, 7) === month) {
      out.this_month += 1;
      const c = String(it?.category || "website");
      out.by_category_this_month[c] = (out.by_category_this_month[c] || 0) + 1;
    }
  }
  return out;
}
