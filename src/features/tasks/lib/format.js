export const money = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000) {
    const k = v / 1000;
    return "$" + (Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)) + "k";
  }
  return "$" + v.toLocaleString("en-US");
};

export const moneyFull = (n) => "$" + (Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });

export const hours = (n) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? v + "h" : v.toFixed(1) + "h";
};

export const days = (n) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? v + "d" : v.toFixed(1) + "d";
};

const parse = (d) => (d ? new Date(String(d).slice(0, 10) + "T12:00:00") : null);

export const shortDate = (d) => {
  const date = parse(d);
  return date && !isNaN(date) ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
};

export const longDate = (d) => {
  const date = parse(d);
  return date && !isNaN(date) ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
};

export const daysUntil = (d) => {
  const date = parse(d);
  if (!date || isNaN(date)) return null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
};

export const dueLabel = (d, status) => {
  if (status === "done") return "Complete";
  const n = daysUntil(d);
  if (n === null) return "No date";
  if (n < 0) return Math.abs(n) + "d overdue";
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  if (n <= 14) return "In " + n + " days";
  return shortDate(d);
};

export const dueTone = (d, status) => {
  if (status === "done") return "text-green-700";
  const n = daysUntil(d);
  if (n === null) return "text-ink/35";
  if (n < 0) return "text-red-600";
  if (n <= 2) return "text-amber-700";
  return "text-ink/55";
};

export const percent = (part, total) => {
  const p = Number(part) || 0;
  const t = Number(total) || 0;
  if (!t) return 0;
  return Math.max(0, Math.min(100, Math.round((p / t) * 100)));
};

export const initials = (name) =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
