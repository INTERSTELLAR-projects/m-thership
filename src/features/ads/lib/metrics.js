// Aggregation over AdMetricDaily rows. Derived ratios are always recomputed from summed totals
// (never averaged), and are null when the denominator is zero so the UI shows "—" instead of a made-up 0.

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function emptyAgg() {
  return { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, reach: 0, freqW: 0, rows: 0 };
}

export function addRow(a, r) {
  a.spend += n(r.spend);
  a.impressions += n(r.impressions);
  a.clicks += n(r.clicks);
  a.conversions += n(r.conversions);
  a.revenue += n(r.revenue);
  a.reach += n(r.reach);
  a.freqW += n(r.frequency) * n(r.impressions);
  a.rows += 1;
  return a;
}

export function derive(a) {
  return {
    ...a,
    ctr: a.impressions ? (a.clicks / a.impressions) * 100 : null,
    cpc: a.clicks ? a.spend / a.clicks : null,
    cpa: a.conversions ? a.spend / a.conversions : null,
    roas: a.spend && a.revenue ? a.revenue / a.spend : a.spend ? 0 : null,
    frequency: a.impressions ? a.freqW / a.impressions : null,
  };
}

export const sum = (rows) => derive(rows.reduce(addRow, emptyAgg()));

/** Split rows into the current window (last `days`) and the window before it. */
export function windows(rows, days) {
  const today = new Date();
  const cut = new Date(today.getTime() - days * 86400000).toISOString().slice(0, 10);
  const cut2 = new Date(today.getTime() - days * 2 * 86400000).toISOString().slice(0, 10);
  return { cur: rows.filter((r) => r.date >= cut), prev: rows.filter((r) => r.date >= cut2 && r.date < cut) };
}

/** Daily series for charts (fills missing days with zero spend only inside the observed range). */
export function series(rows, days) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.date)) map.set(r.date, emptyAgg());
    addRow(map.get(r.date), r);
  }
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const a = derive(map.get(d) || emptyAgg());
    out.push({ date: d, label: d.slice(5), spend: round(a.spend), revenue: round(a.revenue), conversions: a.conversions, roas: a.roas == null ? null : round(a.roas), cpa: a.cpa == null ? null : round(a.cpa) });
  }
  return out;
}

export function groupBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, { key: k, name: r.name || k, platform: r.platform, rows: [] });
    const g = m.get(k);
    g.rows.push(r);
    if (r.name) g.name = r.name;
  }
  return [...m.values()].map((g) => ({ ...g, ...sum(g.rows) }));
}

export const round = (v, d = 2) => Math.round(n(v) * 10 ** d) / 10 ** d;

export function money(v, cur = "USD") {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: cur || "USD", maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 }).format(v);
}
export const pct = (v, d = 2) => (v === null || v === undefined ? "—" : `${round(v, d)}%`);
export const ratio = (v) => (v === null || v === undefined ? "—" : `${round(v, 2)}x`);
export const int = (v) => (v === null || v === undefined ? "—" : Math.round(n(v)).toLocaleString("en-US"));

export function monthToDate(rows) {
  const d = new Date();
  const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  return rows.filter((r) => r.level === "campaign" && r.date >= first).reduce((s, r) => s + n(r.spend), 0);
}

export function projectMonth(mtd) {
  const d = new Date();
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return (mtd / Math.max(1, d.getDate())) * dim;
}
