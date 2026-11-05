// QA-only fake data for the `addons` function (preview sandbox with ?qa=1). Never used on the live app.
// Pick a portal state with ?addonqa=fresh | trial | last | ended | active (remembered for the tab session).
// Mirrors the server rules in base44/shared/addons.ts closely enough to click through every screen.
const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
if (params.get("addonqa")) { try { sessionStorage.setItem("ms_addonqa", params.get("addonqa")); } catch { /* ignore */ } }
const initial = () => { try { return sessionStorage.getItem("ms_addonqa") || "fresh"; } catch { return "fresh"; } };

const iso = (ms) => new Date(ms).toISOString();
const DESCRIPTION = "Design a customer's backyard in minutes and walk them through it in 3D before a single paver is laid.\n\nDraw the yard on a plan, drop in patios, walkways, pool decks, fire pits, pergolas and outdoor kitchens, and pick real materials from your catalog. The 3D view updates as you draw, with day-to-night lighting.\n\nEvery design comes with a material estimate and a branded PDF, and you can send the customer a private link to look around on their phone.";

function seed(state) {
  const trial = {
    fresh: null,
    trial: { state: "trial", uses_total: 3, uses_left: 2 },
    last: { state: "trial", uses_total: 3, uses_left: 1 },
    ended: { state: "trial", uses_total: 3, uses_left: 0 },
    active: { state: "active" },
  }[state] || null;
  return {
    dreamscape_3d: {
      key: "dreamscape_3d", name: "Dreamscape 3D™", category: "Design & sales", icon: "box",
      tagline: "Show customers their new backyard in 3D, then close the job on the spot.",
      description: DESCRIPTION,
      highlights: ["Plan + live 3D side by side", "Your material catalog and pricing", "Branded PDF and HD/4K renders", "Private customer link for phones", "Day-to-night lighting"],
      media: [], demo_url: "https://example.com/demo", status: "live",
      price_model: "both", plans: [{ plan: "both", label: "Setup + monthly", one_time: 5000, monthly: 349, link: false }],
      trial_mode: "uses", trial_uses: 3,
      ca: trial,
    },
    instant_quotes: {
      key: "instant_quotes", name: "Instant Quote Builder™", category: "Sales", icon: "receipt",
      tagline: "Send a polished, itemized quote from your phone before you leave the driveway.",
      description: "Pick services, adjust quantities and send a branded quote by text or email. Customers approve with one tap.",
      highlights: ["Branded quotes in seconds", "One-tap approval", "Syncs to your CRM"],
      media: [], demo_url: "", status: "live",
      price_model: "monthly", plans: [{ plan: "monthly", label: "Monthly", one_time: 0, monthly: 79, link: false }],
      trial_mode: "days", trial_days: 14, ca: null,
    },
  };
}
let store = null;
const db = () => (store ||= seed(initial()));

function trialOf(a) {
  const ca = a.ca;
  const started = !!ca && (ca.state === "trial" || ca.started);
  const uses_left = ca?.uses_left ?? null;
  const over = started && uses_left != null && uses_left <= 0;
  return {
    mode: a.trial_mode, started, over, available: a.trial_mode !== "none" && !started,
    uses_total: a.trial_mode === "uses" ? a.trial_uses : a.trial_mode === "one_use" ? 1 : null,
    days_total: a.trial_mode === "days" ? a.trial_days : null,
    uses_left, ends_at: ca?.ends_at || null, days_left: ca?.ends_at ? Math.max(0, Math.ceil((Date.parse(ca.ends_at) - Date.now()) / 864e5)) : null,
  };
}
function pub(a) {
  const t = trialOf(a);
  const raw = a.ca?.state || "preview";
  const state = raw === "active" ? "active" : raw === "trial" ? (t.over ? "trial_ended" : "trial") : raw;
  const access = state === "active" || state === "trial";
  return {
    key: a.key, name: a.name, tagline: a.tagline, description: a.description, category: a.category, highlights: a.highlights, media: a.media, demo_url: a.demo_url,
    status: a.status, draft: a.status === "draft", icon: a.icon, price_model: a.price_model, plans: a.plans, priced: a.plans.length > 0,
    state, access, trial: t, plan: a.ca?.plan || null, activated_at: a.ca?.activated_at || null, cancel_at: null, can_cancel: state === "active",
    delivery_type: "external_url", feature_flag: "", open_url: access ? "https://example.com/studio?from=mothership" : "",
  };
}

const admin = () => {
  const addons = Object.values(db()).map((a, i) => ({
    id: `qa_addon_${i}`, ...a, ca: undefined, client_ids: ["c1"], industries: [], availability: i ? "industries" : "selected", industries_hint: "",
    price_one_time: a.plans[0]?.one_time || null, price_monthly: a.plans[0]?.monthly || null, delivery_type: "external_url", external_url: "https://example.com/studio",
    pricing_note: i ? "" : "QA sample price (not real)", sort_order: i,
    funnel: i ? { clients: 3, views: 9, viewed: 3, trials: 1, buyers: 0, revenue: 0, active: 0, mrr: 0, view_to_trial: 0.33, trial_to_buy: 0, view_to_buy: 0 }
      : { clients: 2, views: 14, viewed: 2, trials: 2, buyers: 1, revenue: 5349, active: 1, mrr: 349, view_to_trial: 1, trial_to_buy: 0.5, view_to_buy: 0.5 },
    offered_to: ["c1", "c2"],
  }));
  const now = Date.now();
  return {
    addons, stripe_ready: true, portal_url: "https://interstellar-mothership.com",
    clients: [{ id: "c1", business: "Summit Roofing Co", industry: "Roofing", portal_enabled: true }, { id: "c2", business: "Harbor Coffee", industry: "Coffee shop", portal_enabled: true }],
    client_addons: [
      { id: "qa_ca1", client_id: "c1", client_name: "Summit Roofing Co", addon_key: "dreamscape_3d", state: "active", plan: "both", views: 9, trial_started_at: iso(now - 9 * 864e5), trial_uses_left: 0, trial_uses_total: 3, activated_at: iso(now - 2 * 864e5), purchases: [{ session_id: "cs_test_qa", amount_usd: 5349, plan: "both", at: iso(now - 2 * 864e5) }], stripe_subscription_id: "sub_qa", has_license_key: true, license_key_hint: "Q7xA", last_app_check_at: iso(now - 3600e3) },
      { id: "qa_ca2", client_id: "c2", client_name: "Harbor Coffee", addon_key: "dreamscape_3d", state: "trial", views: 5, trial_started_at: iso(now - 864e5), trial_uses_left: 1, trial_uses_total: 3, purchases: [] },
    ],
  };
};

export function qaAddonsInvoke(args = {}) {
  const a = db()[args.key];
  switch (args.action) {
    case "store": return { client: { id: args.client_id || "c1", business: "Summit Roofing Co" }, admin_preview: false, addons: Object.values(db()).map(pub) };
    case "view": return { ok: true };
    case "check": return a ? { ...pub(a), enforce: true } : { error: "not found" };
    case "start_trial": {
      if (!a) return { error: "not found" };
      a.ca = a.trial_mode === "days" ? { state: "trial", started: true, ends_at: iso(Date.now() + a.trial_days * 864e5) } : { state: "trial", uses_total: a.trial_uses || 1, uses_left: a.trial_uses || 1 };
      return { ok: true, addon: pub(a) };
    }
    case "use": {
      if (!a) return { allowed: false };
      const p = pub(a);
      if (p.state === "active") return { allowed: true, state: "active" };
      if (p.state !== "trial") return { allowed: false, paywall: true, state: p.state };
      if (a.ca.uses_left != null) a.ca.uses_left -= 1;
      return { allowed: true, ...pub(a) };
    }
    case "checkout": {
      // QA: pretend Stripe returned and the (mocked) webhook activated it.
      if (!a) return { error: "not found" };
      a.ca = { ...(a.ca || {}), state: "active", plan: args.plan, activated_at: iso(Date.now()) };
      return { url: "", qa_activated: true };
    }
    case "cancel": return { ok: true, cancel_at: iso(Date.now() + 20 * 864e5) };
    case "admin_overview": return admin();
    case "issue_key": return { ok: true, license_key: "msk_QA_SAMPLE_KEY_not_real_0000000000", note: "Shown once." };
    case "mock_checkout_completed": return { event: { type: "checkout.session.completed" }, result: { activated: true } };
    default: return { ok: true };
  }
}
