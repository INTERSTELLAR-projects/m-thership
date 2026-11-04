// Fuel: Studios plan gating, tier-scaled monthly allowances, Refuel wallet (one-time credit packs), out-of-fuel
// pause / resume, model weights and the media-credit hooks. One source of truth for the backend; the UI mirror is
// src/features/fuel/fuelConfig.js (defaults only, the live numbers always come from the `fuel` function).
//
// EVERY NUMBER HERE IS PENDING JUSTIN'S FINAL APPROVAL. Defaults live in DEFAULT_FUEL; Justin edits them in
// Møthership > Fuel economics > Settings, saved as AppSettings { key: "fuel_config", advancedSettings: {...} }.
//
//   loadFuelConfig(db)                         -> merged config (defaults + saved overrides)
//   allowanceFor(client, cfg)                  -> plan, tier, Studios unlocked?, monthly caps
//   weightFor(model, inputTokens, feature, cfg)-> AI-action units for one model call (Haiku 1 / Sonnet 3 / big agent 5)
//   walletOf(db, clientId)                     -> active lots + balance (purchased - used, not expired)
//   drawWallet(db, clientId, kind, units)      -> takes units from lots, soonest-expiring first; returns units taken
//   creditPack(db, {...})                      -> new wallet lot; idempotent by stripe_session_id / payment intent
//   creditFromCheckoutSession(db, session)     -> webhook handler body for checkout.session.completed
//   createRefuelCheckout(...)                  -> Stripe Checkout Session, payment mode, inline price_data
//   markOutOfFuel / resumeClient / resumeDue   -> pause queued items in place, resume them in order, spaced out
//
// Nothing here ever charges a card unless cfg.auto_refuel.live_charging is true AND the client opted in.

import { planOf, monthKey, dayKeyLA, PLAN_CAPS, type PlanKey, type UsageKind } from "./usagePlans.ts";

type Db = any;
type Client = Record<string, any>;

export const FUEL_STATUS_NOTE = "Pending Justin's final approval";

export const DEFAULT_FUEL = {
  status_note: FUEL_STATUS_NOTE,
  // 1. Studios are HyperCare+ only. Signatures + QR Codes stay free for life on every plan.
  studios_require_hypercare: true,
  gated_studios: ["social", "email", "ads", "accounting", "hiring", "presentations"],
  free_for_life: ["signatures", "qr"],
  // Nøva works on every plan; non-HyperCare plans get a small Nøva-only AI allowance.
  nova_only_ai_actions: 50,
  // 2. HyperCare+ caps by tier. Extra locations add on top of the tier.
  tiers: {
    local: { label: "Local", ai_action: 1000, marketing_email: 25000 },
    national: { label: "National", ai_action: 2500, marketing_email: 60000 },
    global: { label: "Global", ai_action: 5000, marketing_email: 120000 },
  } as Record<string, { label: string; ai_action: number; marketing_email: number }>,
  extra_location: { ai_action: 300, marketing_email: 7500 },
  alert_at: 0.8,
  // 4. In-progress items may finish past zero by up to this share of the cap; Interstellar absorbs it.
  overshoot_buffer_pct: 0.03,
  // 3. Refuel packs: one-time, no subscriptions. Credits last 12 months and are used after the allowance.
  packs: [
    { key: "refuel", label: "Refuel", price_usd: 25, ai_actions: 500, emails: 10000 },
    { key: "big_refuel", label: "Big Refuel", price_usd: 99, ai_actions: 2000, emails: 40000 },
  ] as { key: string; label: string; price_usd: number; ai_actions: number; emails: number }[],
  credit_validity_months: 12,
  auto_refuel: {
    // Clients opt in themselves; off for everyone by default. live_charging must also be switched on by Justin
    // before any off-session charge is attempted (until then an opted-in client just gets the normal prompt).
    default_enabled: false,
    live_charging: false,
    default_pack: "refuel",
    max_monthly_ceiling_usd: 500,
  },
  // 5. Weighted AI actions by model.
  weights: { haiku: 1, sonnet: 3, agent_large: 5, nova: 1, large_context_tokens: 50000 },
  // 5. Media credits (Simple Social image / video / voice). Hooks only: disabled, nothing generates yet.
  media_credits: {
    enabled: false,
    starter: { hypercare: 0, website: 0, gravitycare: 0, none: 0 } as Record<string, number>,
    weights: { image: 1, video_second: 5, voice_50_chars: 1 },
    packs: [] as { key: string; label: string; price_usd: number; media_credits: number }[],
  },
  // 6. Cost assumptions for Fuel economics (USD).
  costs: { sonnet_in_per_m: 2, sonnet_out_per_m: 10, haiku_in_per_m: 0.1, haiku_out_per_m: 0.5, ses_per_1000: 0.1 },
  // List prices, used for margin only when a client has no billed plan lines.
  plan_prices: { local: 750, national: 1750, global: 3000, extra_location: 350, website: 500, gravitycare: 197, none: 0 } as Record<string, number>,
  // Resume: paused posts that missed their time move to the next valid slot, spaced out (never a burst).
  resume: { spacing_minutes: 120, window_start: "09:00", window_end: "19:00", timezone: "America/Los_Angeles", weekends: true },
};
export type FuelConfig = typeof DEFAULT_FUEL;

const isObj = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v);
function deepMerge<T>(base: T, over: any): T {
  if (!isObj(over)) return base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined || v === null) continue;
    const b = (base as any)?.[k];
    if (isObj(b) && isObj(v)) out[k] = deepMerge(b, v);
    else if (Array.isArray(b)) out[k] = Array.isArray(v) ? v : b;
    else if (typeof b === "number") out[k] = typeof v === "number" && isFinite(v) && v >= 0 ? v : b;
    else if (typeof b === "boolean") out[k] = typeof v === "boolean" ? v : b;
    else out[k] = v;
  }
  return out;
}

export const FUEL_SETTINGS_KEY = "fuel_config";
let cache: { at: number; cfg: FuelConfig } | null = null;
export async function loadFuelConfig(db: Db, fresh = false): Promise<FuelConfig> {
  if (!fresh && cache && Date.now() - cache.at < 30_000) return cache.cfg;
  const row = ((await db.AppSettings.filter({ key: FUEL_SETTINGS_KEY }, "-updated_date", 1).catch(() => [])) || [])[0];
  const cfg = deepMerge(DEFAULT_FUEL, row?.advancedSettings || {});
  cfg.status_note = FUEL_STATUS_NOTE;
  cache = { at: Date.now(), cfg };
  return cfg;
}
export function sanitizeFuelConfig(input: any) { return deepMerge(DEFAULT_FUEL, input || {}); }
export function clearFuelCache() { cache = null; }

// ---------- plan, tier, allowance ----------
const linesOf = (c: Client) => ((Array.isArray(c?.services) ? c.services : []) as any[]).filter((s) => s && s.status !== "canceled" && !s.discontinued);

export function tierOf(client: Client): { tier: "local" | "national" | "global"; extra_locations: number; source: string } {
  const o = client?.usage_overrides || {};
  const forced = ["local", "national", "global"].includes(o.hypercare_tier) ? o.hypercare_tier : null;
  let extra = typeof o.extra_locations === "number" && o.extra_locations >= 0 ? Math.floor(o.extra_locations) : -1;
  const names = linesOf(client).map((s) => String(s?.name || ""));
  const text = [client?.plan, ...names].filter(Boolean).join(" ").toLowerCase();
  let tier: "local" | "national" | "global" = forced || (/(hypercare\+?|ørbit|orbit)[^,·]*global/.test(text) ? "global" : /(hypercare\+?|ørbit|orbit)[^,·]*national/.test(text) ? "national" : "local");
  if (extra < 0) {
    extra = 0;
    for (const n of names) {
      if (!/extra location|additional location|multi[- ]location/i.test(n)) continue;
      const m = n.match(/[×x]\s*(\d+)/i);
      extra += m ? Number(m[1]) : 1;
    }
  }
  return { tier, extra_locations: extra, source: forced ? "override" : "services" };
}

export function studiosUnlocked(client: Client, cfg: FuelConfig = DEFAULT_FUEL) {
  const o = client?.usage_overrides || {};
  if (o.unlimited === true || o.studios_unlocked === true) return true; // explicit admin exception
  if (!cfg.studios_require_hypercare) return true;
  return planOf(client) === "hypercare";
}

export type Allowance = {
  plan: PlanKey; plan_label: string; tier: string | null; tier_label: string; extra_locations: number;
  studios_unlocked: boolean; nova_only: boolean; unlimited: boolean;
  ai_action: number; marketing_email: number; media_credit: number;
};

export function allowanceFor(client: Client, cfg: FuelConfig = DEFAULT_FUEL): Allowance {
  const plan = planOf(client);
  const o = client?.usage_overrides || {};
  const unlimited = o.unlimited === true;
  const num = (v: unknown, d: number) => (typeof v === "number" && isFinite(v) && v >= 0 ? Math.floor(v) : d);
  const unlocked = studiosUnlocked(client, cfg);
  let ai = 0, email = 0, tier: string | null = null, tierLabel = "", extra = 0;
  if (plan === "hypercare") {
    const t = tierOf(client);
    tier = t.tier; extra = t.extra_locations;
    const base = cfg.tiers[t.tier] || cfg.tiers.local;
    ai = base.ai_action + extra * cfg.extra_location.ai_action;
    email = base.marketing_email + extra * cfg.extra_location.marketing_email;
    tierLabel = `${base.label}${extra ? ` + ${extra} extra location${extra === 1 ? "" : "s"}` : ""}`;
  } else if (plan !== "none") {
    ai = cfg.nova_only_ai_actions; // Nøva only
    email = 0;
  }
  if (unlocked && plan !== "hypercare" && (o.studios_unlocked === true)) {
    // An admin exception on a non-HyperCare plan gets Local caps unless explicit numbers are set.
    ai = cfg.tiers.local.ai_action; email = cfg.tiers.local.marketing_email;
  }
  return {
    plan, plan_label: PLAN_CAPS[plan]?.label || plan, tier, tier_label: tierLabel, extra_locations: extra,
    studios_unlocked: unlocked, nova_only: !unlocked, unlimited,
    ai_action: unlimited ? Infinity : num(o.ai_actions, ai),
    marketing_email: unlimited ? Infinity : num(o.marketing_emails, email),
    media_credit: cfg.media_credits.enabled ? num(o.media_credits, Number(cfg.media_credits.starter?.[plan]) || 0) : 0,
  };
}

// ---------- model weights ----------
export function weightFor(model: string, inputTokens: number, feature: string, cfg: FuelConfig = DEFAULT_FUEL) {
  const w = cfg.weights;
  const f = String(feature || "");
  if (/^nova/.test(f)) return w.nova;
  const big = (Number(inputTokens) || 0) >= w.large_context_tokens;
  if (/^agents?\.|brain|ceo_/.test(f) && big) return w.agent_large;
  if (/sonnet|opus/i.test(model)) return big ? w.agent_large : w.sonnet;
  if (/haiku/i.test(model)) return w.haiku;
  return w.haiku;
}

export function aiCost(model: string, inTok: number, outTok: number, cfg: FuelConfig = DEFAULT_FUEL) {
  const c = cfg.costs;
  const i = Number(inTok) || 0, o = Number(outTok) || 0;
  if (/sonnet|opus/i.test(model)) return (i * c.sonnet_in_per_m + o * c.sonnet_out_per_m) / 1e6;
  if (/haiku/i.test(model)) return (i * c.haiku_in_per_m + o * c.haiku_out_per_m) / 1e6;
  return 0;
}

// ---------- wallet ----------
const WALLET_FIELD: Record<string, [string, string]> = { ai_action: ["ai_actions", "ai_used"], marketing_email: ["emails", "emails_used"], media_credit: ["media_credits", "media_used"] };

export async function walletOf(db: Db, clientId: string) {
  const rows = ((await db.CreditPurchase.filter({ client_id: String(clientId) }, "expires_at", 500).catch(() => [])) || []) as any[];
  const now = Date.now();
  const lots = rows
    .filter((r) => (r.status || "active") === "active")
    .map((r) => {
      const expired = r.expires_at && Date.parse(r.expires_at) <= now;
      return {
        id: r.id, pack_key: r.pack_key, pack_label: r.pack_label || r.pack_key, price_usd: Number(r.price_usd) || 0, source: r.source, test: !!r.test,
        purchased_at: r.purchased_at, expires_at: r.expires_at, expired,
        ai_left: Math.max(0, (Number(r.ai_actions) || 0) - (Number(r.ai_used) || 0)),
        emails_left: Math.max(0, (Number(r.emails) || 0) - (Number(r.emails_used) || 0)),
        media_left: Math.max(0, (Number(r.media_credits) || 0) - (Number(r.media_used) || 0)),
      };
    })
    .filter((l) => !l.expired && (l.ai_left > 0 || l.emails_left > 0 || l.media_left > 0))
    .sort((a, b) => String(a.expires_at).localeCompare(String(b.expires_at)));
  return {
    lots,
    ai_action: lots.reduce((s, l) => s + l.ai_left, 0),
    marketing_email: lots.reduce((s, l) => s + l.emails_left, 0),
    media_credit: lots.reduce((s, l) => s + l.media_left, 0),
    next_expiry: lots[0]?.expires_at || null,
  };
}

// Takes up to `units` from the wallet, soonest-expiring lot first. Returns how many it took.
export async function drawWallet(db: Db, clientId: string, kind: string, units: number) {
  const f = WALLET_FIELD[kind];
  if (!f || units <= 0) return 0;
  const w = await walletOf(db, clientId);
  let need = units, took = 0;
  for (const l of w.lots) {
    if (need <= 0) break;
    const left = kind === "ai_action" ? l.ai_left : kind === "marketing_email" ? l.emails_left : l.media_left;
    if (left <= 0) continue;
    const take = Math.min(left, need);
    const row = await db.CreditPurchase.get(l.id).catch(() => null);
    if (!row) continue;
    const used = (Number(row[f[1]]) || 0) + take;
    const patch: any = { [f[1]]: used };
    const rest = { ai: (Number(row.ai_actions) || 0) - (kind === "ai_action" ? used : Number(row.ai_used) || 0), em: (Number(row.emails) || 0) - (kind === "marketing_email" ? used : Number(row.emails_used) || 0) };
    if (rest.ai <= 0 && rest.em <= 0 && !(Number(row.media_credits) > Number(row.media_used || 0))) patch.status = "used_up";
    await db.CreditPurchase.update(l.id, patch).catch(() => null);
    need -= take; took += take;
  }
  return took;
}

export function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
export const packOf = (cfg: FuelConfig, key: string) => cfg.packs.find((p) => p.key === key) || null;

export async function creditPack(db: Db, args: {
  client: Client; pack_key: string; source: "stripe" | "auto_refuel" | "mock" | "admin"; price_usd?: number;
  ai_actions?: number; emails?: number; stripe_session_id?: string; stripe_payment_intent?: string; buyer_email?: string; note?: string; test?: boolean; cfg?: FuelConfig;
}) {
  const cfg = args.cfg || (await loadFuelConfig(db));
  // Idempotency: one lot per Checkout Session / PaymentIntent, however many times Stripe retries the event.
  for (const [field, val] of [["stripe_session_id", args.stripe_session_id], ["stripe_payment_intent", args.stripe_payment_intent]] as const) {
    if (!val) continue;
    const have = ((await db.CreditPurchase.filter({ [field]: val }, "-created_date", 1).catch(() => [])) || [])[0];
    if (have) return { duplicate: true, lot: have };
  }
  const pack = packOf(cfg, args.pack_key);
  const now = new Date();
  const lot = await db.CreditPurchase.create({
    client_id: String(args.client.id), client_name: String(args.client.business || ""), pack_key: args.pack_key, pack_label: pack?.label || args.pack_key,
    price_usd: Number(args.price_usd ?? pack?.price_usd ?? 0), ai_actions: Number(args.ai_actions ?? pack?.ai_actions ?? 0), emails: Number(args.emails ?? pack?.emails ?? 0),
    media_credits: 0, ai_used: 0, emails_used: 0, media_used: 0,
    purchased_at: now.toISOString(), expires_at: addMonths(now, cfg.credit_validity_months).toISOString(), status: "active",
    source: args.source, test: !!args.test || args.source === "mock", stripe_session_id: args.stripe_session_id || "", stripe_payment_intent: args.stripe_payment_intent || "",
    buyer_email: args.buyer_email || "", note: String(args.note || "").slice(0, 300),
  });
  const resumed = await resumeClient(db, args.client, `refuel:${args.pack_key}`, cfg).catch((e: Error) => ({ error: e?.message }));
  return { duplicate: false, lot, resumed };
}

// checkout.session.completed -> wallet lot. Only sessions this app created (metadata.purpose = "refuel").
export async function creditFromCheckoutSession(db: Db, session: any) {
  const md = session?.metadata || {};
  if (md.purpose !== "refuel") return { ignored: "not a refuel session" };
  if (session.payment_status && session.payment_status !== "paid") return { ignored: `payment_status ${session.payment_status}` };
  const client = await db.CRMClient.get(String(md.client_id || session.client_reference_id || "")).catch(() => null);
  if (!client) return { error: "client not found", client_id: md.client_id };
  const cfg = await loadFuelConfig(db, true);
  const pack = packOf(cfg, String(md.pack || ""));
  const paid = Number(session.amount_total || 0) / 100;
  const out = await creditPack(db, {
    client, pack_key: String(md.pack || "refuel"), source: md.test === "1" ? "mock" : "stripe", price_usd: paid || pack?.price_usd || 0,
    ai_actions: Number(md.ai_actions ?? pack?.ai_actions ?? 0), emails: Number(md.emails ?? pack?.emails ?? 0),
    stripe_session_id: String(session.id || ""), stripe_payment_intent: String(session.payment_intent || ""),
    buyer_email: String(session.customer_details?.email || session.customer_email || ""), test: md.test === "1", cfg,
    note: pack && paid && Math.abs(paid - pack.price_usd) > 0.009 ? `Paid $${paid} vs pack price $${pack.price_usd} (price changed after checkout?)` : "",
  });
  return { credited: !out.duplicate, duplicate: out.duplicate, lot_id: out.lot?.id, client: client.business };
}

// ---------- Stripe Checkout (payment mode, inline price_data: no Stripe products needed) ----------
function form(obj: Record<string, unknown>, prefix = "", out: string[] = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v as Record<string, unknown>, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join("&");
}
async function stripePost(key: string, path: string, body: Record<string, unknown>, idem?: string) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", ...(idem ? { "Idempotency-Key": idem } : {}) },
    body: form(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(data?.error?.message || `Stripe ${res.status}`).slice(0, 300));
  return data;
}

export async function createRefuelCheckout(opts: { key: string; client: Client; pack: { key: string; label: string; price_usd: number; ai_actions: number; emails: number }; user_email: string; return_url: string; save_card: boolean }) {
  const { client, pack } = opts;
  const md = { purpose: "refuel", client_id: String(client.id), pack: pack.key, ai_actions: String(pack.ai_actions), emails: String(pack.emails) };
  const base = opts.return_url.replace(/[?#].*$/, "").replace(/\/+$/, "");
  const body: Record<string, unknown> = {
    mode: "payment",
    client_reference_id: String(client.id),
    success_url: `${base}/?fuel=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/?fuel=cancelled`,
    line_items: { 0: { quantity: 1, price_data: { currency: "usd", unit_amount: Math.round(pack.price_usd * 100), product_data: { name: `${pack.label}: +${pack.ai_actions.toLocaleString("en-US")} AI actions, +${pack.emails.toLocaleString("en-US")} emails`, description: `One-time Studios credit pack for ${client.business}. Credits last 12 months and are used after your monthly allowance.` } } } },
    metadata: md,
    payment_intent_data: { metadata: md, ...(opts.save_card ? { setup_future_usage: "off_session" } : {}), description: `${pack.label} for ${client.business}` },
    ...(client.stripe_customer_id ? { customer: client.stripe_customer_id } : { customer_email: opts.user_email || undefined, customer_creation: "always" }),
  };
  return await stripePost(opts.key, "checkout/sessions", body, `refuel-${client.id}-${pack.key}-${opts.user_email}-${Math.floor(Date.now() / 60000)}`);
}

// Auto-refuel: only for clients who opted in, under their monthly ceiling, and only when Justin has switched
// live_charging on. Charges the saved card off-session; credits the lot right away (idempotent by PaymentIntent).
export async function tryAutoRefuel(db: Db, client: Client, cfg: FuelConfig, key: string | null) {
  const st = await fuelStateOf(db, client);
  if (!st?.auto_refuel_enabled) return { skipped: "client has not opted in" };
  if (!cfg.auto_refuel.live_charging) return { skipped: "Auto-refuel charging is off (pending Justin's approval)" };
  if (!key) return { skipped: "Stripe not configured" };
  if (!client.stripe_customer_id) return { skipped: "no Stripe customer on file" };
  const pack = packOf(cfg, st.auto_refuel_pack || cfg.auto_refuel.default_pack);
  if (!pack) return { skipped: "unknown pack" };
  const month = monthKey();
  const spent = Number(st.auto_refuel_spent?.[month]) || 0;
  const ceiling = Math.min(Number(st.auto_refuel_monthly_ceiling_usd) || 0, cfg.auto_refuel.max_monthly_ceiling_usd);
  if (spent + pack.price_usd > ceiling) return { skipped: `monthly ceiling $${ceiling} reached` };
  const cus = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(client.stripe_customer_id)}`, { headers: { Authorization: `Bearer ${key}` } }).then((r) => r.json()).catch(() => null);
  const pm = cus?.invoice_settings?.default_payment_method;
  if (!pm) return { skipped: "no saved card" };
  const md = { purpose: "refuel_auto", client_id: String(client.id), pack: pack.key, ai_actions: String(pack.ai_actions), emails: String(pack.emails) };
  const pi = await stripePost(key, "payment_intents", { amount: Math.round(pack.price_usd * 100), currency: "usd", customer: client.stripe_customer_id, payment_method: pm, off_session: "true", confirm: "true", metadata: md, description: `Auto-refuel (${pack.label}) for ${client.business}` }, `auto-refuel-${client.id}-${month}-${Math.floor(spent * 100)}`);
  if (pi?.status !== "succeeded") return { skipped: `payment ${pi?.status || "failed"}` };
  await db.ClientFuel.update(st.id, { auto_refuel_spent: { ...(st.auto_refuel_spent || {}), [month]: spent + pack.price_usd } }).catch(() => null);
  const out = await creditPack(db, { client, pack_key: pack.key, source: "auto_refuel", price_usd: pack.price_usd, stripe_payment_intent: pi.id, cfg });
  return { charged: pack.price_usd, lot_id: out.lot?.id };
}

// ---------- fuel state, pause, resume ----------
export async function fuelStateOf(db: Db, client: Client, create = false) {
  const row = ((await db.ClientFuel.filter({ client_id: String(client.id) }, "-updated_date", 1).catch(() => [])) || [])[0];
  if (row || !create) return row || null;
  return await db.ClientFuel.create({ client_id: String(client.id), client_name: String(client.business || ""), paused_kinds: [], auto_refuel_enabled: false, auto_refuel_pack: "refuel", auto_refuel_monthly_ceiling_usd: 0, auto_refuel_spent: {} }).catch(() => null);
}

const nextMonthDate = () => {
  const p = monthKey().split("-").map(Number);
  const y = p[1] === 12 ? p[0] + 1 : p[0];
  const m = p[1] === 12 ? 1 : p[1] + 1;
  return `${y}-${String(m).padStart(2, "0")}-01`;
};
export const resetDate = () => nextMonthDate();
export const resetLabel = () => new Date(`${nextMonthDate()}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric" });

// Fuel left for one kind: what's left of the allowance this month, plus the wallet.
export function fuelLeft(cap: number, used: number, wallet: number) {
  if (!isFinite(cap)) return Infinity;
  return Math.max(0, cap - used) + Math.max(0, wallet);
}

// The client just ran dry on `kind`: flag it (queued items for that kind wait in place), tell Justin once a month
// (Command Briefing task + in-app alert), and try Auto-refuel if the client opted in.
export async function markOutOfFuel(db: Db, client: Client, kind: UsageKind | "media_credit", cfg: FuelConfig, stripeKey: string | null) {
  const st = await fuelStateOf(db, client, true);
  if (!st) return;
  const kinds = new Set<string>(st.paused_kinds || []);
  const fresh = !kinds.has(kind);
  kinds.add(kind);
  await db.ClientFuel.update(st.id, { paused_kinds: [...kinds], paused_at: st.paused_at && !fresh ? st.paused_at : new Date().toISOString(), paused_month: monthKey() }).catch(() => null);
  if (kind === "ai_action") await pauseSocialQueue(db, client).catch(() => null);
  const auto = await tryAutoRefuel(db, client, cfg, stripeKey).catch((e: Error) => ({ skipped: e?.message }));
  if ((auto as any)?.charged) return;
  const month = monthKey();
  const key = `fuel-out-${kind}-${client.id}-${month}`;
  const exists = await db.AccountingAlert.filter({ key }, "-created_date", 1).catch(() => []);
  if (exists?.length) return;
  const label = kind === "ai_action" ? "AI actions" : kind === "marketing_email" ? "marketing emails" : "media credits";
  const title = `${client.business} is out of fuel (${label}). Queued Studio items are paused until they Refuel or the month resets on ${resetLabel()}.`;
  const body = `Their portal shows Refuel $25 / Big Refuel $99 / Upgrade / Wait for reset. Raise their cap in Client usage or grant credits in Fuel economics if they should keep going.`;
  const today = dayKeyLA();
  const task = await db.Task.create({ title: `Out of fuel: ${client.business} (${label})`, category: "ops", priority: 1, status: "next", source: "automation", task_type: "internal", due_date: today, client_id: String(client.id), notes: `${title}\n${body}\nOpen: /fuel-economics` }).catch(() => null);
  await db.AccountingAlert.create({ business_id: "interstellar", key, kind: "usage", title, body, due_date: today, link: "/fuel-economics", task_id: task?.id, status: "new" }).catch(() => null);
}

// Approved, scheduled posts of a paused client keep their slot and wait (flagged so the queue can say why).
async function pauseSocialQueue(db: Db, client: Client) {
  const rows = ((await db.SocialVariant.filter({ client_id: String(client.id), status: "approved" }, "scheduled_at", 300).catch(() => [])) || []) as any[];
  for (const v of rows) if (!v.fuel_paused) await db.SocialVariant.update(v.id, { fuel_paused: true }).catch(() => null);
  return rows.length;
}

// Next valid slot inside the posting window (Pacific by default).
function zonedParts(ms: number, tz: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(new Date(ms));
  const g = (t: string) => p.find((x) => x.type === t)?.value || "";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hm: `${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}`, wd: g("weekday") };
}
function zonedToMs(date: string, hm: string, tz: string) {
  // Find the UTC instant whose wall time in tz is date hm (two-pass offset correction).
  const guess = Date.parse(`${date}T${hm}:00Z`);
  const off = (ms: number) => { const z = zonedParts(ms, tz); return Date.parse(`${z.date}T${z.hm}:00Z`) - ms; };
  let t = guess - off(guess);
  t = guess - off(t);
  return t;
}
export function nextSlots(count: number, opts: { from: number; spacing_minutes: number; window_start: string; window_end: string; timezone: string; weekends: boolean; taken?: number[] }) {
  const out: number[] = [];
  const gap = Math.max(5, opts.spacing_minutes) * 60000;
  const taken = [...(opts.taken || [])];
  let t = opts.from;
  for (let guard = 0; out.length < count && guard < 5000; guard++) {
    const z = zonedParts(t, opts.timezone);
    const weekend = z.wd === "Sat" || z.wd === "Sun";
    if ((!opts.weekends && weekend) || z.hm >= opts.window_end) {
      const nextDay = zonedParts(zonedToMs(z.date, "12:00", opts.timezone) + 86400000, opts.timezone).date;
      t = zonedToMs(nextDay, opts.window_start, opts.timezone); continue;
    }
    if (z.hm < opts.window_start) { t = zonedToMs(z.date, opts.window_start, opts.timezone); continue; }
    if (taken.some((x) => Math.abs(x - t) < gap)) { t += gap; continue; }
    out.push(t); taken.push(t); t += gap;
  }
  return out;
}

// Resume one client: clear the pause for every kind that has fuel again, push missed posts to the next valid
// slots (in their original order, spaced out), and release paused email campaigns that now fit.
export async function resumeClient(db: Db, client: Client, reason: string, cfg?: FuelConfig) {
  cfg = cfg || (await loadFuelConfig(db));
  const st = await fuelStateOf(db, client);
  const allow = allowanceFor(client, cfg);
  const used = await usedThisMonth(db, String(client.id));
  const wallet = await walletOf(db, String(client.id));
  const leftAi = fuelLeft(allow.ai_action, used.ai_action, wallet.ai_action);
  const leftEm = fuelLeft(allow.marketing_email, used.marketing_email, wallet.marketing_email);
  const still = new Set<string>();
  if (leftAi <= 0) still.add("ai_action");
  if (leftEm <= 0) still.add("marketing_email");
  const out: any = { posts_rescheduled: 0, posts_released: 0, campaigns_resumed: 0, campaigns_waiting: 0, still_paused: [...still] };

  if (!still.has("ai_action")) {
    const rows = ((await db.SocialVariant.filter({ client_id: String(client.id), status: "approved" }, "scheduled_at", 300).catch(() => [])) || []) as any[];
    const paused = rows.filter((v) => v.fuel_paused);
    const missed = paused.filter((v) => v.scheduled_at && Date.parse(v.scheduled_at) <= Date.now() + 15 * 60000)
      .sort((a, b) => String(a.fuel_original_scheduled_at || a.scheduled_at).localeCompare(String(b.fuel_original_scheduled_at || b.scheduled_at)));
    const future = rows.filter((v) => v.scheduled_at && Date.parse(v.scheduled_at) > Date.now() + 15 * 60000).map((v) => Date.parse(v.scheduled_at));
    const slots = nextSlots(missed.length, { from: Date.now() + 15 * 60000, spacing_minutes: cfg.resume.spacing_minutes, window_start: cfg.resume.window_start, window_end: cfg.resume.window_end, timezone: cfg.resume.timezone, weekends: cfg.resume.weekends, taken: future });
    for (let i = 0; i < missed.length; i++) {
      const v = missed[i];
      await db.SocialVariant.update(v.id, { fuel_paused: false, fuel_original_scheduled_at: v.fuel_original_scheduled_at || v.scheduled_at, scheduled_at: new Date(slots[i] || Date.now() + (i + 1) * cfg.resume.spacing_minutes * 60000).toISOString() }).catch(() => null);
      out.posts_rescheduled++;
    }
    for (const v of paused.filter((x) => !missed.includes(x))) { await db.SocialVariant.update(v.id, { fuel_paused: false }).catch(() => null); out.posts_released++; }
  }

  if (!still.has("marketing_email")) {
    const camps = ((await db.EmailCampaign.filter({ client_id: String(client.id), status: "paused" }, "created_date", 50).catch(() => [])) || []) as any[];
    let left = leftEm;
    const buffer = isFinite(allow.marketing_email) ? Math.floor(allow.marketing_email * cfg.overshoot_buffer_pct) : 0;
    for (const c of camps) {
      const units = Number(c.total) || 0;
      if (units > left + buffer) { out.campaigns_waiting++; continue; }
      // Meter it now (allowance first, then wallet), then hand it back to the drain job.
      await meterUnits(db, client, "marketing_email", units, { model: "ses", est_cost_usd: units * (cfg.costs.ses_per_1000 / 1000), feature: "email.campaign.resumed", campaign_id: c.id }, cfg);
      await db.EmailCampaign.update(c.id, { status: "queued", metered: true }).catch(() => null);
      left -= units; out.campaigns_resumed++;
    }
    if (out.campaigns_waiting) still.add("marketing_email_campaigns");
  }

  if (st) {
    const keep = [...still].filter((k) => k === "ai_action" || k === "marketing_email");
    await db.ClientFuel.update(st.id, { paused_kinds: keep, ...(keep.length ? {} : { paused_at: null }), last_resumed_at: new Date().toISOString(), last_resume_reason: reason }).catch(() => null);
  }
  return out;
}

// Daily job (and after any refuel): every paused client whose fuel is back (refuel or the 1st of the month).
export async function resumeDue(db: Db) {
  const cfg = await loadFuelConfig(db, true);
  const rows = ((await db.ClientFuel.filter({}, "-updated_date", 500).catch(() => [])) || []) as any[];
  const paused = rows.filter((r) => (r.paused_kinds || []).length);
  // Campaigns or posts flagged without a ClientFuel row (shouldn't happen) are picked up too.
  const pc = ((await db.EmailCampaign.filter({ status: "paused" }, "created_date", 200).catch(() => [])) || []) as any[];
  const ids = new Set<string>([...paused.map((r) => String(r.client_id)), ...pc.map((c) => String(c.client_id))]);
  const results: any[] = [];
  for (const id of ids) {
    const client = await db.CRMClient.get(id).catch(() => null);
    if (!client) continue;
    const r = await resumeClient(db, client, "scheduled check (monthly reset / refuel)", cfg).catch((e: Error) => ({ error: e?.message }));
    results.push({ client: client.business, ...r });
  }
  return { checked: ids.size, results };
}

// ---------- usage this month (client usage only: admin rows never count toward a client's fuel) ----------
export async function usedThisMonth(db: Db, clientId: string, month = monthKey()) {
  const rows = ((await db.UsageLedger.filter({ client_id: clientId, month }, "-created_date", 5000).catch(() => [])) || []) as any[];
  const out: Record<string, number> = { ai_action: 0, marketing_email: 0, ads_run: 0, media_credit: 0, wallet_ai_action: 0, wallet_marketing_email: 0, absorbed_ai_action: 0, absorbed_marketing_email: 0 };
  for (const r of rows) {
    if (r.by_admin) continue;
    const k = String(r.kind);
    if (!(k in out)) continue;
    out[k] += Number(r.units) || 0;
    if (k === "ai_action" || k === "marketing_email") {
      out[`wallet_${k}`] += Number(r.wallet_units) || 0;
      out[`absorbed_${k}`] += Number(r.absorbed_units) || 0;
    }
  }
  return out;
}

// Write one metered row for a client: allowance first, then the wallet, any remainder absorbed (the buffer).
export async function meterUnits(db: Db, client: Client, kind: UsageKind | "media_credit", units: number, meta: Record<string, any>, cfg: FuelConfig) {
  const allow = allowanceFor(client, cfg);
  const cap = (allow as any)[kind] as number;
  const used = (await usedThisMonth(db, String(client.id)))[kind] || 0;
  const fromAllowance = isFinite(cap) ? Math.max(0, Math.min(units, cap - used)) : units;
  const rest = units - fromAllowance;
  const fromWallet = rest > 0 ? await drawWallet(db, String(client.id), kind, rest) : 0;
  const absorbed = Math.max(0, rest - fromWallet);
  const row = await db.UsageLedger.create({
    client_id: String(client.id), client_name: String(client.business || ""), month: monthKey(), kind, units,
    model: meta.model || "", est_cost_usd: Number(meta.est_cost_usd) || 0, feature: String(meta.feature || "").slice(0, 80),
    user_email: meta.user_email || "", by_admin: false, input_tokens: meta.input_tokens || 0, output_tokens: meta.output_tokens || 0,
    campaign_id: meta.campaign_id || "", calls: meta.calls || 1, wallet_units: fromWallet, absorbed_units: absorbed, created_at: new Date().toISOString(),
  }).catch((e: Error) => { console.error("fuel.meterUnits", e?.message); return null; });
  return { row, cap, used_before: used, from_allowance: fromAllowance, from_wallet: fromWallet, absorbed };
}

// Paused clients (for the publish jobs).
export async function pausedClientIds(db: Db, kind: string) {
  const rows = ((await db.ClientFuel.filter({}, "-updated_date", 500).catch(() => [])) || []) as any[];
  return new Set<string>(rows.filter((r) => (r.paused_kinds || []).includes(kind)).map((r) => String(r.client_id)));
}

// ---------- media credits (hooks only; disabled) ----------
// Future Simple Social generation calls checkMedia() first and meterMedia() after. Disabled config = refused.
export async function checkMedia(db: Db, client: Client, units: number) {
  const cfg = await loadFuelConfig(db);
  if (!cfg.media_credits.enabled) return { ok: false, code: "media_disabled", reason: "Image, video and voice generation isn't available yet." };
  const allow = allowanceFor(client, cfg);
  const used = (await usedThisMonth(db, String(client.id))).media_credit || 0;
  const wallet = await walletOf(db, String(client.id));
  const left = fuelLeft(allow.media_credit, used, wallet.media_credit);
  return left >= units ? { ok: true, left } : { ok: false, code: "out_of_media_credits", reason: "You're out of media credits for this month.", left };
}
export const mediaUnits = (kind: "image" | "video" | "voice", amount = 1, cfg: FuelConfig = DEFAULT_FUEL) =>
  kind === "image" ? amount * cfg.media_credits.weights.image : kind === "video" ? Math.ceil(amount) * cfg.media_credits.weights.video_second : Math.ceil(amount / 50) * cfg.media_credits.weights.voice_50_chars;
