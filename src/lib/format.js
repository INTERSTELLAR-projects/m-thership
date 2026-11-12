// Shared display formatters for the finance widgets (were copied into each file).
export const fmtMoney = (n) => `$${Math.round(n).toLocaleString()}`;

// "2026-11-12" → "Nov 12, 2026"; empty → em dash.
export const fmtDate = (d) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
