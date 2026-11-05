import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { requireSecondFactor } from "../../shared/twoFactor.ts";
import { resolveClient, getSecret } from "../../shared/portalClient.ts";
import { inviteSettings } from "../../shared/portalInvite.ts";
import {
  addonByKey, offeredTo, checkFor, startTrial, useOnce, ensureClientAddOn, clientAddOnOf, publicAddon, funnel, stateOf,
  createAddonCheckout, paymentLinkUrl, activateFromCheckoutSession, handleSubscriptionEvent, stripePost, issueLicenseKey,
  findByLicense, notifyJustin, refFor, plansOf,
} from "../../shared/addons.ts";

// Upgrade Store (add-on features sold into client portals and client apps).
// --- client apps (no login; per-client license key from Møthership > Upgrade Store > App keys) ---
//   check        { client_id, key, license_key }          -> { enforce, access, state, trial, plans, buy_url }
//   use          { client_id, key, license_key, ref }     -> meters one trial use (idempotent per ref); paywall when over
// --- portal (client login, or admin previewing with client_id) ---
//   store        {}                                       -> add-ons offered to this client with their state
//   check        { key }                                  -> same shape as the app check (feature-flag add-ons in Møthership)
//   view         { key }                                  -> counts a detail view (conversion funnel)
//   start_trial  { key }  ·  use { key, ref }
//   checkout     { key, plan }                            -> Stripe Checkout URL, or Justin's Payment Link + client_reference_id
//   cancel       { key }                                  -> monthly plans: cancel at period end (no refund, no charge)
// --- admin ---
//   admin_overview · save { addon } · grant / revoke { client_id, key } · reset_trial · issue_key
//   mock_checkout_completed { client_id, key, plan }   TEST ONLY: the exact webhook path on a fake paid session
//   mock_subscription_deleted { client_id, key }       TEST ONLY: the exact webhook path on a fake deleted subscription
// Never reads or returns secret values. Never charges a card itself (Checkout is the client's own action in Stripe).

const json = (d: unknown, status = 200) => Response.json(d, { status });

const ADDON_FIELDS = [
  "key", "name", "tagline", "description", "category", "icon", "media", "demo_url", "highlights", "price_model", "price_one_time", "price_monthly",
  "payment_link_one_time", "payment_link_monthly", "trial_mode", "trial_days", "trial_uses", "availability", "client_ids", "industries",
  "delivery_type", "feature_flag", "external_url", "provisioning_notes", "status", "pricing_note", "sort_order", "notes",
];
function cleanAddon(input: any) {
  const out: Record<string, unknown> = {};
  for (const k of ADDON_FIELDS) if (input && input[k] !== undefined) out[k] = input[k];
  if (out.key !== undefined) out.key = String(out.key).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
  for (const k of ["price_one_time", "price_monthly", "trial_days", "trial_uses", "sort_order"]) {
    if (out[k] === "" || out[k] === null) out[k] = null;
    else if (out[k] !== undefined) out[k] = Math.max(0, Number(out[k]) || 0);
  }
  for (const k of ["payment_link_one_time", "payment_link_monthly", "external_url", "demo_url"]) {
    if (out[k] !== undefined && out[k] && !/^https:\/\/\S+$/.test(String(out[k]))) throw new Error(`${k.replace(/_/g, " ")} must be an https link`);
  }
  for (const k of ["client_ids", "industries", "highlights"]) if (out[k] !== undefined) out[k] = (Array.isArray(out[k]) ? out[k] as unknown[] : []).map(String).filter(Boolean).slice(0, 200);
  if (out.media !== undefined) out.media = (Array.isArray(out.media) ? out.media : []).filter((m: any) => m && /^https:\/\//.test(String(m.url || ""))).slice(0, 12)
    .map((m: any) => ({ type: m.type === "video" ? "video" : "image", url: String(m.url), caption: String(m.caption || "").slice(0, 200) }));
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const user = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "store");
    const settings = await inviteSettings(db).catch(() => ({ portal_url: "" }));
    const portalUrl = settings.portal_url || "";

    // ----- client apps: license key, no login -----
    if (!user) {
      if (action !== "check" && action !== "use") return json({ error: "Not signed in" }, 401);
      const key = String(body?.key || "");
      const ca = await findByLicense(db, String(body?.license_key || ""), key, body?.client_id ? String(body.client_id) : undefined);
      if (!ca) return json({ error: "Unknown app key", code: "bad_key" }, 403);
      const [client, addon] = await Promise.all([db.CRMClient.get(String(ca.client_id)).catch(() => null), addonByKey(db, key)]);
      if (!client || !addon) return json({ error: "Not found" }, 404);
      await db.ClientAddOn.update(ca.id, { last_app_check_at: new Date().toISOString() }).catch(() => null);
      if (action === "use") {
        const out = await useOnce(db, client, addon, { ref: String(body?.ref || ""), via: String(body?.via || "app") });
        return json({ ...out, ...(await checkFor(db, client, addon, { portalUrl })) , allowed: out.allowed });
      }
      return json(await checkFor(db, client, addon, { portalUrl }));
    }

    const gate = await requireSecondFactor(base44, req, user);
    if (gate) return gate;
    const isAdmin = user.role === "admin";

    // ----- portal -----
    const PORTAL = ["store", "check", "view", "start_trial", "use", "checkout", "cancel"];
    if (PORTAL.includes(action)) {
      const client = await resolveClient(db, user, body?.client_id);
      if (!client) return json(action === "store" ? { addons: [] } : { error: "No portal is set up for this login yet.", code: "no_client" }, action === "store" ? 200 : 403);
      if (action === "store") {
        const all = ((await db.AddOn.list("sort_order", 200).catch(() => [])) || []) as any[];
        const mine = ((await db.ClientAddOn.filter({ client_id: String(client.id) }, "-updated_date", 200).catch(() => [])) || []) as any[];
        const byKey = new Map(mine.map((r) => [r.addon_key, r]));
        const list = all.filter((a) => {
          const ca = byKey.get(a.key);
          if (ca && ["active", "trial"].includes(ca.state) && a.status !== "draft") return true; // owners keep seeing what they bought
          if (!offeredTo(a, client)) return false;
          return a.status === "live" || (isAdmin && a.status === "draft");
        });
        return json({ client: { id: client.id, business: client.business }, admin_preview: isAdmin, addons: list.map((a) => publicAddon(a, byKey.get(a.key) || null, client, { admin: isAdmin })) });
      }
      const addon = await addonByKey(db, String(body?.key || ""));
      const visible = addon && (offeredTo(addon, client) || ["active", "trial"].includes((await clientAddOnOf(db, client.id, addon.key))?.state)) && (addon.status !== "draft" || isAdmin);
      if (!addon || !visible) return json({ error: "That upgrade isn't available.", code: "not_offered" }, 404);
      if (action === "check") return json(await checkFor(db, client, addon, { portalUrl }));
      if (action === "view") {
        if (isAdmin) return json({ ok: true, admin_preview: true });
        const ca = await ensureClientAddOn(db, client, addon);
        const now = new Date().toISOString();
        await db.ClientAddOn.update(ca.id, { views: (Number(ca.views) || 0) + 1, first_viewed_at: ca.first_viewed_at || now, last_viewed_at: now });
        return json({ ok: true });
      }
      if (action === "start_trial") {
        if (isAdmin) return json({ error: "Admin preview: the client starts their own free try. Use Grant in the Upgrade Store to unlock it for them.", code: "admin_preview" }, 403);
        if (addon.status !== "live") return json({ error: "This upgrade isn't open yet.", code: "not_live" }, 409);
        const out = await startTrial(db, client, addon, "portal");
        if (!out.ok) return json(out, 409);
        if (out.started) await notifyJustin(db, { client, priority: 3, title: `Trial started: ${client.business} is trying ${addon.name}`, notes: "Started from the portal Upgrades page. Good moment for a quick check-in." });
        return json({ ok: true, addon: publicAddon(addon, out.ca, client) });
      }
      if (action === "use") {
        if (isAdmin) return json({ allowed: true, admin_preview: true });
        return json(await useOnce(db, client, addon, { ref: String(body?.ref || ""), via: "portal" }));
      }
      if (action === "checkout") {
        if (isAdmin) return json({ error: "Admin preview: only the client's own login can buy. Use Grant to unlock it for them.", code: "admin_preview" }, 403);
        if (addon.status !== "live") return json({ error: "This upgrade isn't open for purchase yet.", code: "not_live" }, 409);
        const plan = String(body?.plan || plansOf(addon)[0]?.plan || "");
        const p = plansOf(addon).find((x) => x.plan === plan);
        if (!p) return json({ error: "Pricing for this upgrade is coming soon. Message us and we'll set it up.", code: "not_priced" }, 409);
        const ca = await ensureClientAddOn(db, client, addon);
        if (stateOf(addon, ca).state === "active") return json({ error: "You already have this upgrade.", code: "already_active" }, 409);
        await db.ClientAddOn.update(ca.id, { checkout_started_at: new Date().toISOString(), checkout_plan: plan }).catch(() => null);
        if (p.link) {
          const url = paymentLinkUrl(addon, plan, client, String(user.email || ""));
          if (url) return json({ url, via: "payment_link" });
        }
        const key = getSecret("STRIPE_SECRET_KEY");
        if (!key) return json({ error: "Payments aren't set up yet. Interstellar has been notified.", code: "stripe_not_configured" }, 503);
        const session = await createAddonCheckout(key, { client, addon, plan, user_email: String(user.email || ""), return_url: portalUrl });
        return json({ url: session.url, id: session.id, via: "checkout" });
      }
      if (action === "cancel") {
        const ca = await clientAddOnOf(db, client.id, addon.key);
        if (!ca?.stripe_subscription_id || ca.state !== "active") return json({ error: "There's no subscription to cancel.", code: "no_subscription" }, 409);
        if (isAdmin) return json({ error: "Admin preview: use Revoke in the Upgrade Store.", code: "admin_preview" }, 403);
        const key = getSecret("STRIPE_SECRET_KEY");
        if (!key) return json({ error: "Payments aren't set up yet.", code: "stripe_not_configured" }, 503);
        const sub = await stripePost(key, `subscriptions/${encodeURIComponent(ca.stripe_subscription_id)}`, { cancel_at_period_end: "true" });
        const cancelAt = sub?.cancel_at ? new Date(Number(sub.cancel_at) * 1000).toISOString() : null;
        await db.ClientAddOn.update(ca.id, { cancel_at: cancelAt, cancel_reason: `client:${user.email}` });
        await notifyJustin(db, { client, priority: 2, title: `Upgrade canceling: ${client.business} · ${addon.name}`, notes: `Canceled from the portal. Access stays on until ${cancelAt ? cancelAt.slice(0, 10) : "the period ends"}.` });
        return json({ ok: true, cancel_at: cancelAt });
      }
    }

    if (!isAdmin) return json({ error: "Admins only" }, 403);

    if (action === "admin_overview") {
      const [addons, rows, clients] = await Promise.all([
        db.AddOn.list("sort_order", 200).catch(() => []),
        db.ClientAddOn.list("-updated_date", 2000).catch(() => []),
        db.CRMClient.list("business", 1000).catch(() => []),
      ]);
      const slim = ((clients || []) as any[]).filter((c) => c.status !== "Archived").map((c) => ({ id: c.id, business: c.business, industry: c.industry || "", status: c.status || "", portal_enabled: !!c.portal_enabled }));
      const safeRows = ((rows || []) as any[]).map(({ license_key_hash, ...r }) => ({ ...r, has_license_key: !!license_key_hash }));
      return json({
        addons: ((addons || []) as any[]).map((a) => ({ ...a, funnel: funnel(rows as any[], a), plans: plansOf(a), offered_to: slim.filter((c) => offeredTo(a, c)).map((c) => c.id) })),
        client_addons: safeRows, clients: slim, stripe_ready: !!getSecret("STRIPE_SECRET_KEY"), portal_url: portalUrl,
      });
    }
    if (action === "save") {
      const data = cleanAddon(body?.addon || {});
      const id = String(body?.addon?.id || "");
      if (!id) {
        if (!data.key || !data.name) return json({ error: "Key and name are required" }, 400);
        if (await addonByKey(db, String(data.key))) return json({ error: "That key is taken" }, 409);
        const row = await db.AddOn.create({ status: "draft", price_model: "one_time", trial_mode: "one_use", availability: "selected", delivery_type: "external_url", ...data });
        return json({ ok: true, addon: row });
      }
      const cur = await db.AddOn.get(id).catch(() => null);
      if (!cur) return json({ error: "Not found" }, 404);
      delete data.key; // keys are permanent: client apps and ClientAddOn rows point at them
      if (data.status === "live" && cur.status !== "live") (data as any).launched_at = new Date().toISOString();
      const next = { ...cur, ...data };
      if (data.status === "live" && !plansOf(next).length) return json({ error: "Set a price (or a Payment Link) before going live." }, 400);
      return json({ ok: true, addon: await db.AddOn.update(id, data) });
    }

    const client = body?.client_id ? await db.CRMClient.get(String(body.client_id)).catch(() => null) : null;
    const addon = await addonByKey(db, String(body?.key || ""));
    if (!client || !addon) return json({ error: "Pick a client and an add-on" }, 400);

    if (action === "grant") {
      const ca = await ensureClientAddOn(db, client, addon);
      await db.ClientAddOn.update(ca.id, { state: "active", activated_at: new Date().toISOString(), granted_by: user.email, canceled_at: null, cancel_at: null, notes: String(body?.note || ca.notes || "").slice(0, 500) });
      return json({ ok: true });
    }
    if (action === "revoke") {
      const ca = await clientAddOnOf(db, client.id, addon.key);
      if (!ca) return json({ ok: true, nothing: true });
      let stripe = null;
      if (body?.cancel_stripe && ca.stripe_subscription_id) {
        const key = getSecret("STRIPE_SECRET_KEY");
        if (key) stripe = await stripePost(key, `subscriptions/${encodeURIComponent(ca.stripe_subscription_id)}`, { cancel_at_period_end: "true" }).then(() => "cancel_at_period_end").catch((e: Error) => `error: ${e.message}`);
      }
      await db.ClientAddOn.update(ca.id, { state: "canceled", canceled_at: new Date().toISOString(), cancel_reason: `revoked by ${user.email}` });
      return json({ ok: true, stripe });
    }
    if (action === "reset_trial") {
      const ca = await ensureClientAddOn(db, client, addon);
      await db.ClientAddOn.update(ca.id, { state: ca.state === "active" ? "active" : "preview", trial_started_at: null, trial_uses_left: null, trial_uses_total: null, trial_ends_at: null, trial_use_refs: [] });
      return json({ ok: true });
    }
    if (action === "issue_key") {
      const ca = await ensureClientAddOn(db, client, addon);
      const key = await issueLicenseKey(db, ca);
      return json({ ok: true, license_key: key, client_id: client.id, addon_key: addon.key, note: "Shown once. Save it as the client app's MOTHERSHIP_ADDON_KEY secret. Issuing a new key replaces this one." });
    }
    if (action === "mock_checkout_completed") {
      // TEST ONLY. The payload Stripe sends for a paid Checkout Session; runs the exact webhook activation code.
      const plan = String(body?.plan || plansOf(addon)[0]?.plan || addon.price_model || "one_time");
      const p = plansOf(addon).find((x) => x.plan === plan);
      const session = {
        id: String(body?.session_id || `cs_test_mock_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`), object: "checkout.session",
        mode: plan === "one_time" ? "payment" : "subscription", payment_status: "paid", status: "complete",
        amount_total: Math.round(((p?.one_time || 0) + (plan === "one_time" ? 0 : p?.monthly || 0)) * 100), currency: "usd",
        client_reference_id: refFor(client.id, addon.key), customer_details: { email: user.email },
        subscription: plan === "one_time" ? null : `sub_test_mock_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`,
        metadata: { purpose: "addon", client_id: client.id, addon_key: addon.key, addon_id: addon.id, plan, test: "1" },
      };
      return json({ event: { type: "checkout.session.completed", data: { object: { id: session.id } } }, result: await activateFromCheckoutSession(db, session) });
    }
    if (action === "mock_subscription_deleted") {
      const ca = await clientAddOnOf(db, client.id, addon.key);
      if (!ca?.stripe_subscription_id) return json({ error: "No subscription on this add-on" }, 400);
      const event = { type: "customer.subscription.deleted", data: { object: { id: ca.stripe_subscription_id, status: "canceled", metadata: { purpose: "addon", client_id: client.id, addon_key: addon.key, test: "1" } } } };
      return json({ event: { type: event.type }, result: await handleSubscriptionEvent(db, event) });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("addons", (e as Error)?.message);
    return json({ error: (e as Error)?.message || "Upgrade Store request failed" }, 500);
  }
});
