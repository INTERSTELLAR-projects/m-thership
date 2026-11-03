// Ads Studio backend helpers: settings, the Meta Marketing API (Graph) through the app's "meta_ads" connector,
// metric normalisation and the spend-safety checks every money-moving action goes through.
//
// SAFETY CONTRACT (do not loosen without Justin):
//  - Nothing here launches, unpauses or raises a budget on its own. Those calls live only in ads-execute and
//    run only for a signed-in admin approving one specific AdRecommendation / campaign in the UI.
//  - Every budget change is clamped to max_budget_change_pct (default 20%) per object per rolling 24h,
//    counting earlier changes in AdChangeLog, and is refused at/over the monthly cap.
//  - Every change writes AdChangeLog with before/after.

export const DEFAULT_SETTINGS = {
  scope: "agency",
  target_roas: null as number | null,
  target_cpa: null as number | null,
  monthly_budget_cap: null as number | null,
  max_budget_change_pct: 20,
  auto_pause: { enabled: false, roas_below: 0.5, min_spend: 50, lookback_days: 7, max_per_day: 2 },
  pause_at_cap: false,
  conversion_action_types: ["purchase", "lead", "complete_registration", "schedule"],
  graph_version: "v23.0",
  default_utm: { source: "facebook", medium: "paid_social" },
  policy_overrides: {},
  custom_rules: [],
  optimizer_enabled: true,
};

export const HARD_MAX_CHANGE_PCT = 50; // even if settings say more, never exceed this in one day

export async function loadSettings(db: any, scope = "agency") {
  const rows = (await db.AdSettings.filter({ scope }, "-updated_date", 1).catch(() => [])) || [];
  const row = rows[0] || null;
  const s = { ...DEFAULT_SETTINGS, ...(row || {}) };
  s.auto_pause = { ...DEFAULT_SETTINGS.auto_pause, ...((row && row.auto_pause) || {}) };
  const pct = Number(s.max_budget_change_pct);
  s.max_budget_change_pct = Number.isFinite(pct) && pct > 0 ? Math.min(pct, HARD_MAX_CHANGE_PCT) : 20;
  if (!Array.isArray(s.conversion_action_types) || !s.conversion_action_types.length) s.conversion_action_types = DEFAULT_SETTINGS.conversion_action_types;
  return { row, settings: s };
}

export const round = (n: number, d = 2) => Math.round((Number(n) || 0) * 10 ** d) / 10 ** d;
export const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86400000));

/* ---------------- Meta Graph ---------------- */

export class MetaError extends Error {
  code?: number;
  sub?: number;
  constructor(msg: string, code?: number, sub?: number) {
    super(msg);
    this.code = code;
    this.sub = sub;
  }
}

export async function metaToken(base44: any) {
  try {
    const c = await base44.asServiceRole.connectors.getConnection("meta_ads");
    if (c && c.accessToken) return c.accessToken as string;
  } catch (_e) {
    /* fall through */
  }
  return null;
}

export function graph(token: string, version = "v23.0") {
  const base = `https://graph.facebook.com/${version}`;
  async function call(method: string, path: string, params: Record<string, unknown> = {}) {
    const url = new URL(path.startsWith("http") ? path : `${base}/${path.replace(/^\//, "")}`);
    const init: RequestInit = { method, headers: { Authorization: `Bearer ${token}` } };
    if (method === "GET") {
      for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) url.searchParams.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    } else {
      const body = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) body.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      init.body = body;
      (init.headers as Record<string, string>)["Content-Type"] = "application/x-www-form-urlencoded";
    }
    const res = await fetch(url.toString(), init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      const e = data.error || {};
      throw new MetaError(`Meta API: ${e.error_user_msg || e.message || res.statusText}`, e.code, e.error_subcode);
    }
    return data;
  }
  async function all(path: string, params: Record<string, unknown> = {}, max = 2000) {
    const out: any[] = [];
    let page: any = await call("GET", path, { limit: 200, ...params });
    for (;;) {
      out.push(...(page.data || []));
      const next = page.paging && page.paging.next;
      if (!next || out.length >= max) break;
      page = await call("GET", next);
    }
    return out;
  }
  return { get: (p: string, q?: Record<string, unknown>) => call("GET", p, q), post: (p: string, b?: Record<string, unknown>) => call("POST", p, b), all };
}

export const actId = (id: string) => (String(id).startsWith("act_") ? String(id) : `act_${id}`);

// Meta budgets are integers in the currency's minor unit (cents for USD). Zero-decimal currencies exist
// (JPY, KRW...): we keep a small list.
const ZERO_DEC = new Set(["JPY", "KRW", "CLP", "VND", "ISK", "HUF", "TWD", "COP", "IDR"]);
export const toMinor = (major: number, cur = "USD") => Math.round(major * (ZERO_DEC.has(cur) ? 1 : 100));
export const toMajor = (minor: unknown, cur = "USD") => (minor === undefined || minor === null || minor === "" ? null : num(minor) / (ZERO_DEC.has(cur) ? 1 : 100));

export function sumActions(list: any[] | undefined, types: string[]) {
  if (!Array.isArray(list)) return 0;
  let t = 0;
  for (const a of list) if (types.includes(a.action_type)) t += num(a.value);
  return t;
}

/** Normalise one Meta insights row into AdMetricDaily fields. */
export function metricFromInsight(row: any, level: string, settings: any, account: any) {
  const types = settings.conversion_action_types;
  const spend = num(row.spend);
  const impressions = num(row.impressions);
  const clicks = num(row.clicks);
  const link_clicks = sumActions(row.actions, ["link_click"]);
  const conversions = sumActions(row.actions, types);
  const revenue = sumActions(row.action_values, types);
  const external_id = level === "campaign" ? row.campaign_id : level === "adset" ? row.adset_id : level === "ad" ? row.ad_id : row.account_id;
  return {
    key: `meta|${level}|${external_id}|${row.date_start}`,
    date: row.date_start,
    level,
    platform: "meta",
    account_ref: account.id,
    external_id,
    campaign_external_id: row.campaign_id || "",
    adset_external_id: row.adset_id || "",
    name: row.ad_name || row.adset_name || row.campaign_name || "",
    spend: round(spend),
    impressions,
    reach: num(row.reach),
    frequency: round(num(row.frequency)),
    clicks,
    link_clicks,
    ctr: impressions ? round((clicks / impressions) * 100, 3) : 0,
    cpc: clicks ? round(spend / clicks) : 0,
    cpm: impressions ? round((spend / impressions) * 1000) : 0,
    conversions,
    cpa: conversions ? round(spend / conversions) : 0,
    revenue: round(revenue),
    roas: spend ? round(revenue / spend, 3) : 0,
    currency: account.currency || "USD",
    source: "meta_api",
    client_id: account.client_id || "",
  };
}

/* ---------------- spend safety ---------------- */

export async function monthToDateSpend(db: any, clientId = "") {
  const start = new Date();
  const first = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const rows = (await db.AdMetricDaily.filter({ level: "campaign", date: { $gte: first } }, "-date", 5000).catch(() => [])) || [];
  return round(rows.filter((r: any) => (r.client_id || "") === (clientId || "")).reduce((s: number, r: any) => s + num(r.spend), 0));
}

/**
 * Check a proposed daily budget for one object against the per-day change cap. `current` is the live budget
 * read from Meta right before the change. Earlier changes to the same object in the last 24h count toward the
 * cap, measured from the budget as it was before the first of them.
 */
export async function budgetGate(db: any, settings: any, externalId: string, current: number, proposed: number) {
  const pct = settings.max_budget_change_pct;
  const since = new Date(Date.now() - 86400000).toISOString();
  const recent = ((await db.AdChangeLog.filter({ target_external_id: externalId, action: "budget_change", result: "ok" }, "created_date", 50).catch(() => [])) || []).filter(
    (r: any) => String(r.created_date || "") >= since,
  );
  const baseline = recent.length ? num(recent[0].before?.daily_budget) || current : current;
  const lo = round(baseline * (1 - pct / 100));
  const hi = round(baseline * (1 + pct / 100));
  const clamped = Math.min(hi, Math.max(lo, proposed));
  return { ok: Math.abs(clamped - proposed) < 0.01 && baseline > 0, baseline, lo, hi, clamped: round(clamped), pct };
}

export async function logChange(db: any, row: Record<string, unknown>) {
  try {
    return await db.AdChangeLog.create(row);
  } catch (_e) {
    return null;
  }
}

export async function requireAdmin(base44: any) {
  const user = await base44.auth.me().catch(() => null);
  return user && user.role === "admin" ? user : null;
}
