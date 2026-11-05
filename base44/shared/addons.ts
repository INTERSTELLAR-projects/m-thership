// Upgrade Store: add-on features Justin sells into each client's portal and client apps.
// One source of truth for the backend. Entities: AddOn (the catalog) and ClientAddOn (one row per client per add-on).
//
//   offeredTo(addon, client)              -> may this client see / buy it (availability: all | selected | industries)
//   stateOf(addon, ca)                    -> effective state: preview | trial | trial_ended | active | canceled, + access
//   checkFor(db, client, addon)           -> what a client app needs: enforce?, access?, trial uses / days left, plans
//   startTrial / useOnce                  -> server-side trial metering (uses and days), idempotent per `ref`
//   activateFromCheckoutSession(db, s)    -> webhook body for checkout.session.completed (idempotent by session id)
//   handleSubscriptionEvent(db, event)    -> customer.subscription.updated / deleted (monthly plans): cancel, deactivate
//   createAddonCheckout(...)              -> Stripe Checkout (payment or subscription mode, inline price_data)
//   paymentLinkUrl(...)                   -> Justin's own Stripe Payment Link + client_reference_id
//   issueLicenseKey / findByLicense       -> per-client app keys for cross-app checks (stored as SHA-256 only)
//
// GATING RULE: an add-on only gates anything once Justin sets it live. Draft = nothing changes in the client app
// (enforce false, access true). Live or retired = enforced: access only while active or inside an unexpired trial.
// Nothing here charges a card. Prices are Justin's decision (approval policy: money + pricing always need him).

type Db = any;
type Rec = Record<string, any>;

export const ADDON_STATES = ["preview", "trial", "active", "canceled"] as const;
export const PORTAL_URL_FALLBACK = "https://interstellar-mothership.com";
const DAY = 86400000;
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const usd = (n: number) => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export const todayLA = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

// ---------- catalog ----------
export async function addonByKey(db: Db, key: string): Promise<Rec | null> {
  if (!key) return null;
  return ((await db.AddOn.filter({ key: String(key) }, "-updated_date", 1).catch(() => [])) || [])[0] || null;
}

export function offeredTo(addon: Rec | null, client: Rec | null): boolean {
  if (!addon || !client) return false;
  const ids = ((addon.client_ids as string[]) || []).map(String);
  const mode = addon.availability || "selected";
  if (mode === "all") return true;
  if (ids.includes(String(client.id))) return true;
  if (mode === "industries") {
    const ind = `${client.industry || ""} ${client.industry_key || ""}`.toLowerCase();
    return ((addon.industries as string[]) || []).some((i) => i && ind.includes(String(i).toLowerCase().trim()));
  }
  return false;
}

// Plans a client can buy. An add-on with no price and no Payment Link is "not priced yet" (no Buy button).
export function plansOf(addon: Rec) {
  const one = Number(addon.price_one_time) || 0, mo = Number(addon.price_monthly) || 0;
  const linkOne = String(addon.payment_link_one_time || ""), linkMo = String(addon.payment_link_monthly || "");
  const m = addon.price_model || "one_time";
  const out: Rec[] = [];
  if (m === "one_time" && (one > 0 || linkOne)) out.push({ plan: "one_time", label: "One-time", one_time: one, monthly: 0, link: !!linkOne });
  if (m === "monthly" && (mo > 0 || linkMo)) out.push({ plan: "monthly", label: "Monthly", one_time: 0, monthly: mo, link: !!linkMo });
  if (m === "both" && ((one > 0 && mo > 0) || linkMo)) out.push({ plan: "both", label: "Setup + monthly", one_time: one, monthly: mo, link: !!linkMo });
  return out;
}
export const expectedFirstCharge = (addon: Rec, plan: string) => {
  const p = plansOf(addon).find((x) => x.plan === plan);
  return p ? round2((p.one_time || 0) + (p.monthly || 0)) : 0;
};

// ---------- state ----------
export function trialOf(addon: Rec, ca: Rec | null, now = Date.now()) {
  const mode = addon?.trial_mode || "none";
  const started = !!ca?.trial_started_at;
  const usesLeft = ca?.trial_uses_left == null ? null : Number(ca.trial_uses_left);
  const ends = ca?.trial_ends_at || null;
  const over = started && ((usesLeft != null && usesLeft <= 0) || (!!ends && Date.parse(ends) <= now));
  return {
    mode, started, over,
    available: mode !== "none" && !started,
    uses_total: mode === "one_use" ? 1 : mode === "uses" ? Math.max(1, Number(addon.trial_uses) || 1) : null,
    days_total: mode === "days" ? Math.max(1, Number(addon.trial_days) || 7) : null,
    uses_left: usesLeft,
    ends_at: ends,
    days_left: ends ? Math.max(0, Math.ceil((Date.parse(ends) - now) / DAY)) : null,
  };
}

export function stateOf(addon: Rec, ca: Rec | null, now = Date.now()) {
  const t = trialOf(addon, ca, now);
  const raw = ca?.state || "preview";
  const state = raw === "active" ? "active" : raw === "canceled" ? "canceled" : raw === "trial" ? (t.over ? "trial_ended" : "trial") : "preview";
  return { state, access: state === "active" || state === "trial", trial: t };
}

export async function clientAddOnOf(db: Db, clientId: string, addonKey: string): Promise<Rec | null> {
  return ((await db.ClientAddOn.filter({ client_id: String(clientId), addon_key: String(addonKey) }, "-updated_date", 1).catch(() => [])) || [])[0] || null;
}
export async function ensureClientAddOn(db: Db, client: Rec, addon: Rec): Promise<Rec> {
  const have = await clientAddOnOf(db, client.id, addon.key);
  if (have) return have;
  return await db.ClientAddOn.create({
    client_id: String(client.id), client_name: String(client.business || ""), addon_id: String(addon.id), addon_key: String(addon.key), addon_name: String(addon.name || addon.key),
    state: "preview", views: 0, usage_count: 0, purchases: [], trial_use_refs: [],
  });
}

// enforce: does the client app gate on this right now. Draft add-ons never gate (Justin hasn't launched them).
export function enforced(addon: Rec) { return addon?.status === "live" || addon?.status === "retired"; }

export function portalBuyUrl(portalUrl: string, addonKey: string) {
  return `${String(portalUrl || PORTAL_URL_FALLBACK).replace(/\/+$/, "")}/?tab=upgrades&addon=${encodeURIComponent(addonKey)}`;
}

export async function checkFor(db: Db, client: Rec, addon: Rec, opts: { portalUrl?: string } = {}) {
  const ca = await clientAddOnOf(db, client.id, addon.key);
  const s = stateOf(addon, ca);
  const enforce = enforced(addon);
  return {
    key: addon.key, name: addon.name, status: addon.status, offered: offeredTo(addon, client),
    enforce, access: enforce ? s.access : true, state: s.state,
    trial: s.trial, plans: plansOf(addon).map(({ link: _l, ...p }) => p),
    activated_at: ca?.activated_at || null, cancel_at: ca?.cancel_at || null,
    buy_url: portalBuyUrl(opts.portalUrl || "", addon.key),
  };
}

// ---------- trial metering ----------
export async function startTrial(db: Db, client: Rec, addon: Rec, via: string) {
  const mode = addon.trial_mode || "none";
  if (mode === "none") return { ok: false, code: "no_trial", error: "This upgrade doesn't include a free try." };
  const ca = await ensureClientAddOn(db, client, addon);
  if (ca.state === "active") return { ok: true, already: "active", ca };
  if (ca.trial_started_at) return { ok: true, already: "trial", ca };
  const now = new Date();
  const patch: Rec = {
    state: "trial", trial_started_at: now.toISOString(), trial_started_via: via, trial_use_refs: [],
    trial_uses_total: mode === "one_use" ? 1 : mode === "uses" ? Math.max(1, Number(addon.trial_uses) || 1) : null,
    trial_uses_left: mode === "one_use" ? 1 : mode === "uses" ? Math.max(1, Number(addon.trial_uses) || 1) : null,
    trial_ends_at: mode === "days" ? new Date(now.getTime() + Math.max(1, Number(addon.trial_days) || 7) * DAY).toISOString() : null,
  };
  const next = await db.ClientAddOn.update(ca.id, patch);
  return { ok: true, started: true, ca: { ...ca, ...patch, ...(next || {}) } };
}

// One metered use (Dreamscape: one project render). Same `ref` twice never counts twice.
export async function useOnce(db: Db, client: Rec, addon: Rec, args: { ref?: string; via: string }) {
  if (!enforced(addon)) return { allowed: true, enforce: false, state: "not_enforced" };
  let ca = await ensureClientAddOn(db, client, addon);
  const ref = String(args.ref || "").slice(0, 120);
  if (ca.state === "active") {
    await db.ClientAddOn.update(ca.id, { usage_count: (Number(ca.usage_count) || 0) + 1, last_used_at: new Date().toISOString() }).catch(() => null);
    return { allowed: true, enforce: true, state: "active" };
  }
  // First use from a client app starts the free try on its own (no separate "start" click needed).
  if (ca.state !== "canceled" && !ca.trial_started_at && (addon.trial_mode || "none") !== "none") {
    const st = await startTrial(db, client, addon, args.via);
    if (st.ca) ca = st.ca;
  }
  const s = stateOf(addon, ca);
  if (s.state !== "trial") return { allowed: false, enforce: true, state: s.state, paywall: true, trial: s.trial };
  const refs = ((ca.trial_use_refs as string[]) || []);
  if (ref && refs.includes(ref)) return { allowed: true, enforce: true, state: "trial", duplicate: true, trial: s.trial };
  const patch: Rec = { trial_use_refs: ref ? [...refs, ref].slice(-200) : refs, trial_last_used_at: new Date().toISOString(), usage_count: (Number(ca.usage_count) || 0) + 1 };
  if (ca.trial_uses_left != null) patch.trial_uses_left = Math.max(0, Number(ca.trial_uses_left) - 1);
  await db.ClientAddOn.update(ca.id, patch);
  const after = stateOf(addon, { ...ca, ...patch });
  return { allowed: true, enforce: true, state: after.state, trial: after.trial, last_trial_use: after.state === "trial_ended" };
}

// ---------- notifications (Command Briefing: a Task due today shows in the briefing's due list) ----------
export async function notifyJustin(db: Db, t: { title: string; notes: string; client?: Rec | null; priority?: number }) {
  return await db.Task.create({
    title: t.title.slice(0, 200), notes: t.notes.slice(0, 2000), status: "next", priority: t.priority ?? 1, category: "sales",
    source: "automation", task_type: "internal", due_date: todayLA(), labels: ["upgrade-store"],
    ...(t.client ? { client_id: String(t.client.id), client_name: String(t.client.business || "") } : {}),
  }).catch(() => null);
}

// ---------- purchases ----------
export function refFor(clientId: string, addonKey: string) { return `addon-${clientId}-${addonKey}`; }
export function parseRef(ref: string) {
  const s = String(ref || "");
  if (!s.startsWith("addon-")) return null;
  const rest = s.slice(6), i = rest.indexOf("-");
  if (i <= 0) return null;
  return { client_id: rest.slice(0, i), addon_key: rest.slice(i + 1) };
}

// checkout.session.completed -> activate. Sessions the `addons` function created (metadata.purpose = "addon") or
// Justin's own Payment Links opened from the portal (client_reference_id "addon-<client>-<key>").
export async function activateFromCheckoutSession(db: Db, session: Rec) {
  const md = session?.metadata || {};
  const fromRef = parseRef(session?.client_reference_id);
  if (md.purpose !== "addon" && !fromRef) return { ignored: "not an add-on session" };
  if (session.payment_status && !["paid", "no_payment_required"].includes(session.payment_status)) return { ignored: `payment_status ${session.payment_status}` };
  const clientId = String(md.client_id || fromRef?.client_id || ""), key = String(md.addon_key || fromRef?.addon_key || "");
  const [client, addon] = await Promise.all([db.CRMClient.get(clientId).catch(() => null), addonByKey(db, key)]);
  if (!client || !addon) return { error: "client or add-on not found", client_id: clientId, addon_key: key };
  const ca = await ensureClientAddOn(db, client, addon);
  const sid = String(session.id || "");
  if (sid && ((ca.purchases as Rec[]) || []).some((p) => p.session_id === sid)) return { duplicate: true, client_addon_id: ca.id };
  const test = md.test === "1";
  const plan = String(md.plan || (session.mode === "subscription" ? (addon.price_model === "both" ? "both" : "monthly") : "one_time"));
  const paid = round2(Number(session.amount_total || 0) / 100);
  const expected = expectedFirstCharge(addon, plan);
  const short = !test && expected > 0 && paid + 0.009 < expected;
  const purchase = {
    session_id: sid, at: new Date().toISOString(), plan, mode: session.mode || "payment", amount_usd: paid, currency: session.currency || "usd",
    subscription_id: session.subscription || "", payment_intent: session.payment_intent || "", email: session.customer_details?.email || session.customer_email || "",
    source: md.purpose === "addon" ? "checkout" : "payment_link", test, needs_review: short,
  };
  const purchases = [...((ca.purchases as Rec[]) || []), purchase].slice(-50);
  if (short) {
    // Paid less than the listed price (wrong Payment Link?): record it, don't unlock, ask Justin.
    await db.ClientAddOn.update(ca.id, { purchases });
    await notifyJustin(db, { client, title: `Review upgrade payment: ${client.business} paid ${usd(paid)} for ${addon.name} (listed ${usd(expected)})`, notes: `Stripe session ${sid}. Not unlocked automatically. Grant it in Møthership > Upgrade Store if this is right.` });
    return { activated: false, needs_review: true, client_addon_id: ca.id };
  }
  const now = new Date().toISOString();
  await db.ClientAddOn.update(ca.id, {
    purchases, state: "active", plan, activated_at: ca.activated_at && ca.state === "active" ? ca.activated_at : now,
    stripe_session_id: sid, stripe_subscription_id: String(session.subscription || ca.stripe_subscription_id || ""), stripe_customer_id: String(session.customer || ca.stripe_customer_id || ""),
    canceled_at: null, cancel_at: null, cancel_reason: "", test: test || !!ca.test,
  });
  const what = plan === "one_time" ? usd(paid) : plan === "both" ? `${usd(paid)} today, then ${usd(Number(addon.price_monthly) || 0)}/mo` : `${usd(paid)}/mo`;
  await notifyJustin(db, { client, title: `${test ? "TEST · " : ""}Upgrade sold: ${client.business} bought ${addon.name} (${what})`, notes: `Activated automatically from Stripe (${purchase.source}, session ${sid}). ${ca.trial_started_at ? `Tried it first on ${String(ca.trial_started_at).slice(0, 10)}.` : "Bought without a trial."}` });
  if (addon.delivery_type === "provisioning_task") {
    await notifyJustin(db, { client, priority: 2, title: `Provision ${addon.name} for ${client.business}`, notes: String(addon.provisioning_notes || "Set up the upgrade for this client.") });
  }
  return { activated: true, client_addon_id: ca.id, client: client.business, addon: addon.key };
}

// customer.subscription.updated / deleted for monthly add-ons.
export async function handleSubscriptionEvent(db: Db, event: Rec) {
  const sub = event?.data?.object || {};
  if (!/^customer\.subscription\./.test(String(event?.type || ""))) return { ignored: "not a subscription event" };
  const subId = String(sub.id || "");
  let ca = subId ? ((await db.ClientAddOn.filter({ stripe_subscription_id: subId }, "-updated_date", 1).catch(() => [])) || [])[0] : null;
  if (!ca && sub.metadata?.purpose === "addon") ca = await clientAddOnOf(db, String(sub.metadata.client_id || ""), String(sub.metadata.addon_key || ""));
  if (!ca) return { ignored: "no add-on for this subscription" };
  const ended = event.type === "customer.subscription.deleted" || ["canceled", "unpaid", "incomplete_expired"].includes(String(sub.status));
  if (ended) {
    if (ca.state === "canceled") return { duplicate: true, client_addon_id: ca.id };
    await db.ClientAddOn.update(ca.id, { state: "canceled", canceled_at: new Date().toISOString(), cancel_reason: `stripe:${sub.status || event.type}`, stripe_subscription_id: subId || ca.stripe_subscription_id });
    const client = await db.CRMClient.get(String(ca.client_id)).catch(() => null);
    await notifyJustin(db, { client, priority: 2, title: `Upgrade ended: ${ca.client_name} · ${ca.addon_name}`, notes: `Stripe subscription ${subId} is ${sub.status || "deleted"}. Access is off; their work is kept.` });
    return { deactivated: true, client_addon_id: ca.id };
  }
  const patch: Rec = { cancel_at: sub.cancel_at_period_end && sub.cancel_at ? new Date(Number(sub.cancel_at) * 1000).toISOString() : null };
  if (["active", "trialing"].includes(String(sub.status)) && ca.state === "canceled") Object.assign(patch, { state: "active", canceled_at: null, cancel_reason: "" });
  if (String(sub.status) === "past_due") patch.notes = `Payment past due since ${todayLA()}`;
  await db.ClientAddOn.update(ca.id, patch);
  return { updated: true, client_addon_id: ca.id, ...patch };
}

// ---------- Stripe ----------
function form(obj: Rec, prefix = "", out: string[] = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v as Rec, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join("&");
}
export async function stripePost(key: string, path: string, body: Rec, idem?: string) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", ...(idem ? { "Idempotency-Key": idem } : {}) },
    body: form(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(data?.error?.message || `Stripe ${res.status}`).slice(0, 300));
  return data;
}

// Builds the Checkout Session body (exported so it can be checked without calling Stripe).
export function checkoutBody(opts: { client: Rec; addon: Rec; plan: string; user_email: string; return_url: string }) {
  const { client, addon, plan } = opts;
  const p = plansOf(addon).find((x) => x.plan === plan);
  if (!p) throw new Error("This plan isn't priced yet.");
  const md = { purpose: "addon", client_id: String(client.id), addon_key: String(addon.key), addon_id: String(addon.id), plan };
  const base = String(opts.return_url || PORTAL_URL_FALLBACK).replace(/[?#].*$/, "").replace(/\/+$/, "");
  const product = (suffix = "") => ({ name: `${addon.name}${suffix}`, description: String(addon.tagline || `Upgrade for ${client.business}`).slice(0, 300) });
  const cents = (n: number) => Math.round(Number(n) * 100);
  const subscription = plan !== "one_time";
  const line: Rec = {};
  let i = 0;
  if (plan === "one_time") line[i++] = { quantity: 1, price_data: { currency: "usd", unit_amount: cents(p.one_time), product_data: product() } };
  if (plan === "both" && p.one_time > 0) line[i++] = { quantity: 1, price_data: { currency: "usd", unit_amount: cents(p.one_time), product_data: product(" · setup") } };
  if (subscription) line[i++] = { quantity: 1, price_data: { currency: "usd", unit_amount: cents(p.monthly), recurring: { interval: "month" }, product_data: product(" · monthly license") } };
  return {
    mode: subscription ? "subscription" : "payment",
    client_reference_id: refFor(client.id, addon.key),
    success_url: `${base}/?tab=upgrades&addon=${encodeURIComponent(addon.key)}&upgrades=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/?tab=upgrades&addon=${encodeURIComponent(addon.key)}&upgrades=cancelled`,
    line_items: line,
    metadata: md,
    ...(subscription ? { subscription_data: { metadata: md, description: `${addon.name} for ${client.business}` } } : { payment_intent_data: { metadata: md, description: `${addon.name} for ${client.business}` } }),
    ...(client.stripe_customer_id ? { customer: client.stripe_customer_id } : { customer_email: opts.user_email || undefined, ...(subscription ? {} : { customer_creation: "always" }) }),
  };
}

export async function createAddonCheckout(key: string, opts: { client: Rec; addon: Rec; plan: string; user_email: string; return_url: string }) {
  const body = checkoutBody(opts);
  return await stripePost(key, "checkout/sessions", body, `addon-${opts.client.id}-${opts.addon.key}-${opts.plan}-${Math.floor(Date.now() / 60000)}`);
}

export function paymentLinkUrl(addon: Rec, plan: string, client: Rec, email: string) {
  const link = String(plan === "one_time" ? addon.payment_link_one_time || "" : addon.payment_link_monthly || "");
  if (!/^https:\/\/(buy|checkout)\.stripe\.com\//.test(link)) return "";
  const u = new URL(link);
  u.searchParams.set("client_reference_id", refFor(client.id, addon.key));
  if (email) u.searchParams.set("prefilled_email", email);
  return u.toString();
}

// ---------- app license keys (cross-app checks) ----------
async function sha256(s: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function issueLicenseKey(db: Db, ca: Rec) {
  const raw = crypto.getRandomValues(new Uint8Array(24));
  const key = `msk_${btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
  await db.ClientAddOn.update(ca.id, { license_key_hash: await sha256(key), license_key_hint: key.slice(-4), license_issued_at: new Date().toISOString() });
  return key; // shown once to the admin, never stored in plain text
}
export async function findByLicense(db: Db, licenseKey: string, addonKey: string, clientId?: string) {
  if (!/^msk_[A-Za-z0-9_-]{20,}$/.test(String(licenseKey || ""))) return null;
  const hash = await sha256(String(licenseKey));
  const row = ((await db.ClientAddOn.filter({ license_key_hash: hash }, "-updated_date", 1).catch(() => [])) || [])[0];
  if (!row || row.addon_key !== addonKey || (clientId && String(row.client_id) !== String(clientId))) return null;
  return row;
}

// ---------- reporting ----------
export function funnel(rows: Rec[], addon: Rec) {
  const mine = rows.filter((r) => r.addon_key === addon.key);
  const real = (r: Rec) => ((r.purchases as Rec[]) || []).filter((p) => !p.test && !p.needs_review);
  const viewed = mine.filter((r) => (Number(r.views) || 0) > 0).length;
  const trials = mine.filter((r) => r.trial_started_at).length;
  const buyers = mine.filter((r) => real(r).length > 0).length;
  const revenue = round2(mine.reduce((s, r) => s + real(r).reduce((a, p) => a + (Number(p.amount_usd) || 0), 0), 0));
  const activeMonthly = mine.filter((r) => r.state === "active" && (r.plan === "monthly" || r.plan === "both") && !r.test).length;
  return {
    clients: mine.length, views: mine.reduce((s, r) => s + (Number(r.views) || 0), 0), viewed, trials, buyers, revenue,
    active: mine.filter((r) => r.state === "active").length, mrr: round2(activeMonthly * (Number(addon.price_monthly) || 0)),
    view_to_trial: viewed ? trials / viewed : 0, trial_to_buy: trials ? mine.filter((r) => r.trial_started_at && real(r).length).length / trials : 0, view_to_buy: viewed ? buyers / viewed : 0,
  };
}

// What a client sees about an add-on (no internal notes, no pricing note, no license data).
export function publicAddon(addon: Rec, ca: Rec | null, client: Rec, opts: { admin?: boolean } = {}) {
  const s = stateOf(addon, ca);
  const open = String(addon.external_url || "");
  return {
    key: addon.key, name: addon.name, tagline: addon.tagline || "", description: addon.description || "", category: addon.category || "",
    highlights: addon.highlights || [], media: addon.media || [], demo_url: /^https:\/\//.test(String(addon.demo_url || "")) ? addon.demo_url : "", status: addon.status, draft: addon.status === "draft", icon: addon.icon || "",
    price_model: addon.price_model || "one_time", plans: plansOf(addon), priced: plansOf(addon).length > 0,
    state: s.state, access: s.access, trial: s.trial, plan: ca?.plan || null, activated_at: ca?.activated_at || null, cancel_at: ca?.cancel_at || null,
    can_cancel: s.state === "active" && !!ca?.stripe_subscription_id && !ca?.cancel_at,
    delivery_type: addon.delivery_type || "external_url", feature_flag: addon.feature_flag || "",
    open_url: s.access && /^https:\/\//.test(open) ? `${open}${open.includes("?") ? "&" : "?"}from=mothership&client=${encodeURIComponent(String(client.id))}` : "",
    ...(opts.admin ? { admin_preview: true } : {}),
  };
}
