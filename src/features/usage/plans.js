// Studios plans + per-client Studio state, for the UI. Mirror of base44/shared/usagePlans.ts (keep in sync).
// 2026-11-04 (pending Justin's final approval): Studios are HyperCare+ only; caps scale with the HyperCare+ tier;
// one-time Refuel packs top up a 12-month wallet. Live numbers come from the `fuel` function (shared/fuel.ts);
// these are fallbacks only.

export const PLAN_CAPS = {
  hypercare: { label: "HyperCare+", ai_action: 1000, marketing_email: 25000, ads: "daily" },
  website: { label: "Website-only", ai_action: 50, marketing_email: 0, ads: "none" },
  gravitycare: { label: "GravïtyCare", ai_action: 50, marketing_email: 0, ads: "none" },
  none: { label: "No care plan", ai_action: 0, marketing_email: 0, ads: "none" },
};
export const ADS_RUNS_PER_MONTH = { daily: 31, weekly: 5, none: 0 };
export const ADS_LABEL = { daily: "Daily", weekly: "Weekly", none: "Not included" };

export const AI_MODELS = {
  routine: { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
  long: { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
};

// Studio states: off = hidden, preview = visible + locked (default), on = usable.
export const STUDIO_STATES = [
  { value: "off", label: "Hidden" },
  { value: "preview", label: "Preview" },
  { value: "on", label: "On" },
];
export const STUDIO_KEYS = ["social", "email", "ads", "accounting", "hiring", "presentations"];
export const STUDIO_LABELS = {
  social: "Social Studio", email: "Email Studio", ads: "Ads Studio",
  accounting: "Accounting & Taxes", hiring: "Hiring plan", presentations: "Presentations",
};

export function studioState(client, key) {
  const v = client?.studios?.[key];
  return v === "on" || v === true ? "on" : v === "off" ? "off" : "preview";
}
export const anyStudioOn = (client) => STUDIO_KEYS.some((k) => studioState(client, k) === "on");
// Studios unlock only on HyperCare+ (or an explicit admin exception).
export const planUnlocksStudios = (client) => planOf(client) === "hypercare" || client?.usage_overrides?.unlimited === true || client?.usage_overrides?.studios_unlocked === true;

export function planOf(client) {
  const forced = client?.usage_overrides?.plan;
  if (forced && PLAN_CAPS[forced]) return forced;
  // Canceled / ended care subscription (set by the Stripe sync): no plan, whatever the free text says.
  if (client?.plan_status === "inactive") return "none";
  const managed = Array.isArray(client?.services_managed) ? client.services_managed : [];
  if (managed.includes("orbit_seo")) return "hypercare";
  if (managed.includes("website_care")) return "website";
  if (managed.includes("starship_care")) return "gravitycare";
  const text = [client?.plan, ...((client?.services || []).map((s) => s?.name))].filter(Boolean).join(" ").toLowerCase();
  if (/hypercare|ørbit|orbit/.test(text)) return "hypercare";
  if (/website[- ]only|back[- ]?end plan|website care/.test(text)) return "website";
  if (/gravity|gravïty|starship/.test(text)) return "gravitycare";
  return "none";
}

export function capsFor(client) {
  const plan = planOf(client);
  const base = PLAN_CAPS[plan];
  const o = client?.usage_overrides || {};
  const unlimited = o.unlimited === true;
  const num = (v, d) => (typeof v === "number" && isFinite(v) && v >= 0 ? Math.floor(v) : d);
  const ads = ["daily", "weekly", "none"].includes(o.ads_cadence) ? o.ads_cadence : base.ads;
  return {
    plan, plan_label: base.label, unlimited,
    ai_action: unlimited ? null : num(o.ai_actions, base.ai_action),
    marketing_email: unlimited ? null : num(o.marketing_emails, base.marketing_email),
    ads_cadence: ads,
    custom: o.ai_actions != null || o.marketing_emails != null || o.ads_cadence != null || !!o.plan,
  };
}

export const fmtNum = (n) => (n == null ? "∞" : Number(n).toLocaleString("en-US"));
export const fmtUsd = (n) => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
