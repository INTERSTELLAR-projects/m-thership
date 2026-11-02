// Date logic for LegalItem.dueDate (a free-text string).
// - "2027-03-01", "Jun 30, 2026", "3/1/2027"  -> fixed one-time date
// - "March 1st", "Apr 15", "3/26"             -> no year = repeats every year (annual)
// - anything else / empty                      -> undated (prompt to add a date)
// Nothing is ever invented: an unparseable string stays undated and is shown as-is.

const DAY = 86400000;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const monthIndex = (word) => {
  const w = String(word || "").toLowerCase().replace(/\./g, "");
  if (w.length < 3) return -1;
  return MONTHS.findIndex((m) => m.startsWith(w));
};

const valid = (y, m, d) => {
  if (m < 0 || m > 11 || d < 1 || d > 31) return false;
  const t = new Date(y ?? 2024, m, d); // 2024 = leap year so Feb 29 survives for yearless dates
  return t.getMonth() === m && t.getDate() === d;
};

export function parseDue(raw) {
  const s = String(raw || "").trim();
  if (!s) return { kind: "none", raw: s };
  const clean = s.replace(/(\d+)(st|nd|rd|th)\b/gi, "$1").replace(/,/g, " ").replace(/\s+/g, " ").trim();
  let m;
  // ISO yyyy-mm-dd
  if ((m = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) {
    const [y, mo, d] = [+m[1], +m[2] - 1, +m[3]];
    if (valid(y, mo, d)) return { kind: "fixed", year: y, month: mo, day: d, raw: s };
  }
  // m/d(/yyyy)
  if ((m = clean.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/))) {
    const mo = +m[1] - 1;
    const d = +m[2];
    let y = m[3] ? +m[3] : null;
    if (y !== null && y < 100) y += 2000;
    if (valid(y, mo, d)) return y === null ? { kind: "annual", month: mo, day: d, raw: s } : { kind: "fixed", year: y, month: mo, day: d, raw: s };
  }
  // "March 1 2027" / "Mar 1"
  if ((m = clean.match(/^([A-Za-z.]+) (\d{1,2})(?: (\d{4}))?$/))) {
    const mo = monthIndex(m[1]);
    const d = +m[2];
    const y = m[3] ? +m[3] : null;
    if (valid(y, mo, d)) return y === null ? { kind: "annual", month: mo, day: d, raw: s } : { kind: "fixed", year: y, month: mo, day: d, raw: s };
  }
  // "1 March 2027" / "1 Mar"
  if ((m = clean.match(/^(\d{1,2}) ([A-Za-z.]+)(?: (\d{4}))?$/))) {
    const mo = monthIndex(m[2]);
    const d = +m[1];
    const y = m[3] ? +m[3] : null;
    if (valid(y, mo, d)) return y === null ? { kind: "annual", month: mo, day: d, raw: s } : { kind: "fixed", year: y, month: mo, day: d, raw: s };
  }
  return { kind: "none", raw: s };
}

// Safe date for a month/day in a given year (Feb 29 -> Feb 28 in non-leap years).
const mkDate = (y, mo, d) => {
  const last = new Date(y, mo + 1, 0).getDate();
  return new Date(y, mo, Math.min(d, last));
};

const daysBetween = (a, b) => Math.round((b.getTime() - a.getTime()) / DAY);

// Whole months + leftover days from `from` to `to` (to >= from).
export function monthsDays(from, to) {
  let months = 0;
  let cursor = new Date(from);
  for (;;) {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + 1);
    if (next > to) break;
    cursor = next;
    months += 1;
  }
  return { months, days: daysBetween(cursor, to) };
}

export function computeDeadline(item, today = startOfToday()) {
  const p = parseDue(item.dueDate);
  if (p.kind === "none") return { item, parsed: p, dated: false };

  let due;
  let cycleStart = null;
  if (p.kind === "annual") {
    due = mkDate(today.getFullYear(), p.month, p.day);
    if (due < today) due = mkDate(today.getFullYear() + 1, p.month, p.day);
    cycleStart = mkDate(due.getFullYear() - 1, p.month, p.day);
  } else {
    due = mkDate(p.year, p.month, p.day);
  }

  const days = daysBetween(today, due);
  const overdue = days < 0;
  const span = overdue ? monthsDays(due, today) : monthsDays(today, due);
  let progress = null;
  if (cycleStart) {
    const total = daysBetween(cycleStart, due);
    progress = total > 0 ? Math.min(1, Math.max(0, daysBetween(cycleStart, today) / total)) : null;
  }
  const urgency = overdue ? "overdue" : days <= 30 ? "soon" : days <= 90 ? "near" : "later";
  return { item, parsed: p, dated: true, due, days, overdue, span, cycleStart, progress, urgency, recurring: p.kind === "annual" };
}

export const fmtDate = (d) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

export function spanText(span) {
  const parts = [];
  if (span.months) parts.push(`${span.months} ${span.months === 1 ? "month" : "months"}`);
  parts.push(`${span.days} ${span.days === 1 ? "day" : "days"}`);
  return parts.join(" ");
}

// Category is derived from the item name only (the entity has no category field).
export function categoryOf(item) {
  const t = String(item.task || "").toLowerCase();
  if (/licen[cs]e|permit/.test(t)) return "License";
  if (/annual report|filing|registration|secretary of state|sos\b/.test(t)) return "Filing";
  if (/tax|irs|quarterly|1099|w-?9|s-?corp/.test(t)) return "Tax";
  if (/insur|liability|bond/.test(t)) return "Insurance";
  if (/contract|agreement|retainer|nda/.test(t)) return "Contract";
  if (/trademark|copyright|patent|domain/.test(t)) return "IP";
  return item.section === "deadline" ? "Deadline" : "Date";
}

// Convert an editor value back to a dueDate string.
// annual -> "March 1" (yearless = repeats yearly); one-time -> ISO "2027-03-01".
export function toDueString(iso, annual) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  if (annual) return `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${d}`;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Editor initial value from a stored dueDate.
export function toEditorValue(raw, today = startOfToday()) {
  const p = parseDue(raw);
  if (p.kind === "none") return { iso: "", annual: false };
  let y = p.year;
  if (p.kind === "annual") {
    y = today.getFullYear();
    if (mkDate(y, p.month, p.day) < today) y += 1;
  }
  return { iso: `${y}-${String(p.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`, annual: p.kind === "annual" };
}
