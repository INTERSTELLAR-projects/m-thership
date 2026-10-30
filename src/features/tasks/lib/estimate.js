// One canonical unit for effort: minutes. Days/weeks/months are working time (8h day, 5-day week, 4-week month).
export const UNITS = [
  { value: "min", label: "minutes", short: "m", minutes: 1 },
  { value: "h", label: "hours", short: "h", minutes: 60 },
  { value: "d", label: "days", short: "d", minutes: 480 },
  { value: "w", label: "weeks", short: "w", minutes: 2400 },
  { value: "mo", label: "months", short: "mo", minutes: 9600 }
];
const unitOf = (u) => UNITS.find((x) => x.value === u) || UNITS[2];

export const toMinutes = (amount, unit) => Math.max(0, (Number(amount) || 0) * unitOf(unit).minutes);
export const minutesToDays = (m) => (Number(m) || 0) / 480;
export const daysToMinutes = (d) => (Number(d) || 0) * 480;

// Minutes an SOP step / task carries, whichever field it was saved with.
export const itemMinutes = (item) => {
  if (!item) return 0;
  if (Number(item.estimated_minutes) > 0) return Number(item.estimated_minutes);
  if (item.estimate_amount != null && item.estimate_unit) return toMinutes(item.estimate_amount, item.estimate_unit);
  if (Number(item.estimated_hours) > 0) return Number(item.estimated_hours) * 60;
  return daysToMinutes(item.estimated_days);
};

// 45m · 3h · 1.5h · 2d · 1.5w · 2mo
export const fmtMinutes = (m) => {
  const v = Math.round(Number(m) || 0);
  if (v <= 0) return "—";
  const one = (n, s) => (Number.isInteger(n) ? n : n.toFixed(1).replace(/\.0$/, "")) + s;
  if (v < 60) return v + "m";
  if (v < 480) return one(v / 60, "h");
  if (v < 2400) return one(v / 480, "d");
  if (v < 9600) return one(v / 2400, "w");
  return one(v / 9600, "mo");
};

// Elapsed clock: 1:12:40 or 0:04:09
export const fmtClock = (seconds) => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h + ":" + String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
};

// Pick the friendliest (amount, unit) pair for a minute total.
export const splitMinutes = (m) => {
  const v = Number(m) || 0;
  if (v <= 0) return { amount: "", unit: "h" };
  for (const u of [...UNITS].reverse()) {
    const a = v / u.minutes;
    if (a >= 1 && Math.abs(a - Math.round(a * 2) / 2) < 1e-6) return { amount: Math.round(a * 2) / 2, unit: u.value };
  }
  if (v >= 480) return { amount: Math.round((v / 480) * 10) / 10, unit: "d" };
  if (v >= 60) return { amount: Math.round((v / 60) * 10) / 10, unit: "h" };
  return { amount: v, unit: "min" };
};

// Normalise an SOP item / task payload so every estimate field agrees.
export const withEstimate = (obj, amount, unit) => {
  const minutes = toMinutes(amount, unit);
  return {
    ...obj,
    estimate_amount: Number(amount) || 0,
    estimate_unit: unitOf(unit).value,
    estimated_minutes: minutes,
    estimated_hours: Math.round((minutes / 60) * 100) / 100,
    estimated_days: Math.round(minutesToDays(minutes) * 100) / 100
  };
};
