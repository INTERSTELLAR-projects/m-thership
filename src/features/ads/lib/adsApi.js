import { base44 } from "@/api/base44Client";

// Data access for Ads Studio. Every ad entity is admin-only (RLS). Rows carry client_id ("" = Interstellar's
// own ads) so a later per-client portal view can reuse these calls with a scope, read-only.

export const KEYS = {
  accounts: ["ads", "accounts"],
  campaigns: ["ads", "campaigns"],
  adsets: ["ads", "adsets"],
  ads: ["ads", "ads"],
  metrics: (days) => ["ads", "metrics", days],
  creatives: ["ads", "creatives"],
  recs: ["ads", "recs"],
  learnings: ["ads", "learnings"],
  log: ["ads", "log"],
  settings: ["ads", "settings"],
  checks: ["ads", "checks"],
  status: ["ads", "status"],
  rules: ["ads", "rules"],
};

const arr = (r) => (Array.isArray(r) ? r : (r && r.items) || []);
export const inScope = (clientId = "") => (r) => (r?.client_id || "") === (clientId || "");

export const E = () => base44.entities;

export const listAccounts = async () => arr(await E().AdAccount.list("-created_date", 100));
export const listCampaigns = async () => arr(await E().AdCampaign.list("-updated_date", 500));
export const listAdSets = async () => arr(await E().AdSet.list("-updated_date", 1000));
export const listAds = async () => arr(await E().Ad.list("-updated_date", 2000));
export const listCreatives = async () => arr(await E().AdCreative.list("-updated_date", 300));
export const listRecs = async () => arr(await E().AdRecommendation.list("-created_date", 300));
export const listLearnings = async () => arr(await E().AdLearning.list("-created_date", 300));
export const listLog = async () => arr(await E().AdChangeLog.list("-created_date", 200));
export const listChecks = async () => arr(await E().AdPolicyCheck.list("-created_date", 200));

export function sinceDay(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

/** Daily metrics for the last `days` (plus the same span before it, for deltas). */
export async function listMetrics(days) {
  const since = sinceDay(days * 2);
  return arr(await E().AdMetricDaily.filter({ date: { $gte: since } }, "-date", 10000));
}

/* ---------------- settings ---------------- */

export const DEFAULT_SETTINGS = {
  scope: "agency",
  target_roas: null,
  target_cpa: null,
  monthly_budget_cap: null,
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

export async function loadSettings(scope = "agency") {
  const rows = arr(await E().AdSettings.filter({ scope }, "-updated_date", 1).catch(() => []));
  const row = rows[0] || null;
  return { id: row?.id || null, ...DEFAULT_SETTINGS, ...(row || {}), auto_pause: { ...DEFAULT_SETTINGS.auto_pause, ...(row?.auto_pause || {}) } };
}

export async function saveSettings(patch, scope = "agency") {
  const cur = await loadSettings(scope);
  const { id, created_date: _c, updated_date: _u, created_by: _b, ...rest } = { ...cur, ...patch };
  if (id) return E().AdSettings.update(id, rest);
  return E().AdSettings.create({ ...rest, scope });
}

/* ---------------- backend functions ---------------- */

async function call(name, data) {
  try {
    const res = await base44.functions.invoke(name, data);
    return res.data;
  } catch (e) {
    const body = e?.response?.data;
    const err = new Error(body?.error || e?.message || "Request failed");
    err.body = body;
    throw err;
  }
}

export const adsSync = (data) => call("ads-sync", data);
export const adsPolicy = (data) => call("ads-policy", data);
export const adsOptimizer = (data) => call("ads-optimizer", data);
/** Every money-moving call carries confirm:true, sent only from an approval dialog. */
export const adsExecute = (data) => call("ads-execute", { ...data, confirm: true });
