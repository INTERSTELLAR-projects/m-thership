// Studios plans: plan detection + the base caps table. Mirrored for the UI in src/features/usage/plans.js
// (keep the two in sync). UPDATED 2026-11-04 (Justin's decisions, numbers pending his final approval):
//   Studios are HyperCare+ only. GravïtyCare and Website-only see locked previews and get a Nøva-only allowance.
//   HyperCare+ caps scale with the tier (Local / National / Global + extra locations) and one-time "Refuel" packs
//   top up a 12-month wallet. The live, editable numbers live in base44/shared/fuel.ts (DEFAULT_FUEL + Fuel
//   economics settings); PLAN_CAPS below is only the fallback for code that has no config loaded.
//   80% -> Justin is alerted. Allowance + wallet at 0 -> queued items pause in place until a Refuel or the reset.

export type PlanKey = "hypercare" | "website" | "gravitycare" | "none";
export type UsageKind = "ai_action" | "marketing_email" | "ads_run";
export type AdsCadence = "daily" | "weekly" | "none";

export const PLAN_CAPS: Record<PlanKey, { label: string; ai_action: number; marketing_email: number; ads: AdsCadence }> = {
  hypercare: { label: "HyperCare+", ai_action: 1000, marketing_email: 25000, ads: "daily" },
  // Nøva-only allowance (Studios locked on these plans).
  website: { label: "Website-only", ai_action: 50, marketing_email: 0, ads: "none" },
  gravitycare: { label: "GravïtyCare", ai_action: 50, marketing_email: 0, ads: "none" },
  none: { label: "No care plan", ai_action: 0, marketing_email: 0, ads: "none" },
};

// Ads agent cadence -> runs per month (the meter also enforces the spacing between runs).
export const ADS_RUNS_PER_MONTH: Record<AdsCadence, number> = { daily: 31, weekly: 5, none: 0 };
export const ADS_MIN_GAP_HOURS: Record<AdsCadence, number> = { daily: 20, weekly: 6 * 24, none: 0 };

// Not offered free (expensive): AI video / image generation, lists over this size.
export const MAX_FREE_LIST_SIZE = 25000;
export const ALERT_AT = 0.8;

// Per-client Studio state: off (hidden) / preview (visible in the portal, locked: the default) / on (usable).
// Server functions only ever act for a portal user when the Studio is "on".
export const STUDIO_KEYS = ["social", "email", "ads", "accounting", "hiring", "presentations"] as const;
export type StudioState = "off" | "preview" | "on";

// ---- Model routing (Anthropic Messages API, our own key, never Base44 InvokeLLM credits for clients) ----
// IDs verified 2026-11-04 at https://platform.claude.com/docs/en/about-claude/models/overview and pricing at
// https://platform.claude.com/docs/en/about-claude/pricing.
export const AI_MODELS = {
  routine: { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", max_tokens: 2048 },
  long: { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", max_tokens: 8192 },
} as const;
export type AiTier = keyof typeof AI_MODELS;

// USD per million tokens. Haiku 5.5 is priced by prompt length (over 100k input tokens costs more).
export function estimateAiCost(model: string, inputTokens: number, outputTokens: number) {
  const i = Number(inputTokens) || 0;
  const o = Number(outputTokens) || 0;
  let pin = 0, pout = 0;
  if (/haiku-5-5/.test(model)) { pin = i > 100000 ? 0.5 : 0.1; pout = i > 100000 ? 2.5 : 0.5; }
  else if (/sonnet-5-5/.test(model)) { pin = 2; pout = 10; }
  else return 0;
  return Math.round(((i * pin + o * pout) / 1e6) * 1e6) / 1e6;
}

// Amazon SES outbound: $0.10 per 1,000 emails (attachments/data extra; not used here).
export const SES_COST_PER_EMAIL = 0.0001;

type Client = Record<string, any>;

// Plan from existing client fields: services_managed (Stripe sync switches orbit_seo <-> HyperCare+,
// starship_care <-> GravïtyCare; website_care = the $500 back-end Website-only plan), then the free-text plan /
// service names, then an explicit admin choice (usage_overrides.plan) which wins over everything.
export function planOf(client: Client): PlanKey {
  const forced = client?.usage_overrides?.plan;
  if (forced && forced in PLAN_CAPS) return forced as PlanKey;
  const managed: string[] = Array.isArray(client?.services_managed) ? client.services_managed : [];
  if (managed.includes("orbit_seo")) return "hypercare";
  if (managed.includes("website_care")) return "website";
  if (managed.includes("starship_care")) return "gravitycare";
  const text = [client?.plan, ...((client?.services || []) as any[]).map((s) => s?.name)].filter(Boolean).join(" ").toLowerCase();
  if (/hypercare|ørbit|orbit/.test(text)) return "hypercare";
  if (/website[- ]only|back[- ]?end plan|website care/.test(text)) return "website";
  if (/gravity|gravïty|starship/.test(text)) return "gravitycare";
  return "none";
}

export function capsFor(client: Client) {
  const plan = planOf(client);
  const base = PLAN_CAPS[plan];
  const o = client?.usage_overrides || {};
  const unlimited = o.unlimited === true;
  const num = (v: unknown, d: number) => (typeof v === "number" && isFinite(v) && v >= 0 ? Math.floor(v) : d);
  const ads: AdsCadence = ["daily", "weekly", "none"].includes(o.ads_cadence) ? o.ads_cadence : base.ads;
  return {
    plan,
    plan_label: base.label,
    unlimited,
    ai_action: unlimited ? Infinity : num(o.ai_actions, base.ai_action),
    marketing_email: unlimited ? Infinity : num(o.marketing_emails, base.marketing_email),
    ads_cadence: unlimited && ads === "none" ? "daily" as AdsCadence : ads,
    ads_run: unlimited ? Infinity : ADS_RUNS_PER_MONTH[ads],
    custom: o.ai_actions != null || o.marketing_emails != null || o.ads_cadence != null || !!o.plan,
  };
}

export const studioState = (client: Client, key: string): StudioState => {
  const v = client?.studios?.[key];
  return v === "on" || v === true ? "on" : v === "off" ? "off" : "preview";
};
// Studios unlock only on HyperCare+ (or an explicit admin exception: usage_overrides.studios_unlocked / unlimited).
// Same rule as fuel.ts studiosUnlocked with the default config; the meter re-checks with the live config.
export const planUnlocksStudios = (client: Client) => {
  const o = client?.usage_overrides || {};
  return planOf(client) === "hypercare" || o.unlimited === true || o.studios_unlocked === true;
};
// true only for Studios that are switched ON (usable) AND on a plan that includes Studios. Preview, off and
// locked-by-plan are all refused server-side.
export const studiosOf = (client: Client) =>
  Object.fromEntries(STUDIO_KEYS.map((k) => [k, planUnlocksStudios(client) && studioState(client, k) === "on"])) as Record<(typeof STUDIO_KEYS)[number], boolean>;
export const anyStudioOn = (client: Client) => Object.values(studiosOf(client)).some(Boolean);

// Months roll over on Justin's clock (Pacific), so "until next month" means the 1st in Molalla.
export const monthKey = (d = new Date()) => {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit" }).formatToParts(d);
  return `${p.find((x) => x.type === "year")?.value}-${p.find((x) => x.type === "month")?.value}`;
};
export const dayKeyLA = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d);
