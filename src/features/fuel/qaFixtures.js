// QA-only fake data for the `fuel` function (preview sandbox with ?qa=1). Never used on the live app.
// Pick a portal state with ?fuelqa=hypercare | gravity | alert | out | refueled (remembered for the tab session).
const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
if (params.get("fuelqa")) { try { sessionStorage.setItem("ms_fuelqa", params.get("fuelqa")); } catch { /* ignore */ } }
const stateNow = () => { try { return sessionStorage.getItem("ms_fuelqa") || "hypercare"; } catch { return "hypercare"; } };

const PACKS = [
  { key: "refuel", label: "Refuel", price_usd: 25, ai_actions: 500, emails: 10000 },
  { key: "big_refuel", label: "Big Refuel", price_usd: 99, ai_actions: 2000, emails: 40000 },
];
const next1st = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1); };
const resetLabel = () => next1st().toLocaleDateString("en-US", { month: "long", day: "numeric" });
const iso = (d) => d.toISOString();
const inMonths = (n) => { const d = new Date(); d.setMonth(d.getMonth() + n); return d; };

function kind(cap, used, wallet, alertAt = 0.8) {
  const left = Math.max(0, cap - used) + wallet;
  return { cap, used, allowance_left: Math.max(0, cap - used), wallet, left, pct: cap ? used / cap : 0, alert: cap > 0 && used / cap >= alertAt, out: left <= 0, buffer: Math.floor(cap * 0.03), from_wallet: 0 };
}

export function qaFuelSummary(state = stateNow()) {
  const base = {
    visible: true, config_status: "Pending Justin's final approval", month: new Date().toISOString().slice(0, 7), reset_on: iso(next1st()).slice(0, 10), reset_label: resetLabel(),
    plan: "hypercare", plan_label: "HyperCare+", tier: "local", tier_label: "Local + 1 extra location", extra_locations: 1, studios_unlocked: true, nova_only: false, unlimited: false,
    studios: { social: "on", email: "on", ads: "preview", accounting: "preview", hiring: "preview", presentations: "preview" }, free_for_life: ["signatures", "qr"],
    paused: { kinds: [], since: null, posts: 0, campaigns: 0, campaign_emails: 0 },
    wallet: { ai_action: 0, marketing_email: 0, next_expiry: null, lots: [] }, packs: PACKS, credit_validity_months: 12,
    auto_refuel: { enabled: false, pack: "refuel", monthly_ceiling_usd: 0, spent_this_month_usd: 0, max_ceiling_usd: 500, live: false },
    media: { enabled: false }, stripe_ready: true,
  };
  if (state === "gravity") {
    return { ...base, plan: "gravitycare", plan_label: "GravïtyCare", tier: null, tier_label: "", extra_locations: 0, studios_unlocked: false, nova_only: true,
      studios: { social: "locked", email: "locked", ads: "locked", accounting: "locked", hiring: "locked", presentations: "locked" },
      ai: kind(50, 12, 0), email: kind(0, 0, 0), out_of_fuel: false, out_kinds: [], alert: false };
  }
  if (state === "alert") {
    const ai = kind(1300, 1104, 0), email = kind(32500, 9800, 0);
    return { ...base, ai, email, out_of_fuel: false, out_kinds: [], alert: true };
  }
  if (state === "out") {
    const ai = kind(1300, 1318, 0), email = kind(32500, 32500, 0);
    return { ...base, ai, email, out_of_fuel: true, out_kinds: ["ai_action", "marketing_email"], alert: true,
      paused: { kinds: ["ai_action", "marketing_email"], since: iso(new Date(Date.now() - 5 * 3600e3)), posts: 4, campaigns: 1, campaign_emails: 2140 } };
  }
  if (state === "refueled") {
    const lots = [{ pack_label: "Big Refuel", ai_left: 2000, emails_left: 40000, expires_at: iso(inMonths(12)), purchased_at: iso(new Date()) }];
    const ai = kind(1300, 1318, 2000), email = kind(32500, 32500, 40000);
    ai.left = 2000 - 18; ai.wallet = 1982; ai.from_wallet = 18; lots[0].ai_left = 1982;
    return { ...base, ai, email, out_of_fuel: false, out_kinds: [], alert: true,
      wallet: { ai_action: 1982, marketing_email: 40000, next_expiry: lots[0].expires_at, lots },
      auto_refuel: { ...base.auto_refuel, enabled: true, monthly_ceiling_usd: 100 } };
  }
  const ai = kind(1300, 412, 0), email = kind(32500, 6120, 0);
  return { ...base, ai, email, out_of_fuel: false, out_kinds: [], alert: false };
}

const row = (id, business, plan, tier, caps, u, cost, revenue, refuel, extra = {}) => {
  const total = cost.ai + cost.email;
  return {
    id, business, plan, plan_label: plan === "hypercare" ? "HyperCare+" : plan === "gravitycare" ? "GravïtyCare" : "Website-only", tier, tier_label: tier,
    studios_unlocked: plan === "hypercare", caps,
    usage: { ai_units: u.ai, ai_calls: u.calls, admin_ai_units: u.admin || 0, emails: u.emails, admin_emails: 0, haiku_calls: u.haiku, sonnet_calls: u.sonnet, nova_messages: u.nova || 0, in_tokens: u.in, out_tokens: u.out, wallet_units: u.wallet || 0, absorbed_units: u.absorbed || 0 },
    pct: { ai_action: caps.ai_action ? u.ai / caps.ai_action : 0, marketing_email: caps.marketing_email ? u.emails / caps.marketing_email : 0 },
    wallet: { ai_action: extra.wallet_ai || 0, marketing_email: extra.wallet_em || 0 },
    est_cost: { ai: cost.ai, email: cost.email, total: Math.round(total * 10000) / 10000 },
    plan_revenue: revenue, plan_revenue_source: "billed lines", list_price: revenue, refuel_revenue: refuel,
    margin: Math.round((revenue + refuel - total) * 100) / 100, margin_pct: revenue + refuel ? (revenue + refuel - total) / (revenue + refuel) : null,
    near_cap: (caps.ai_action && u.ai / caps.ai_action >= 0.8) || (caps.marketing_email && u.emails / caps.marketing_email >= 0.8), out_of_fuel: !!extra.out,
  };
};

export function qaFuelEconomics() {
  const clients = [
    row("c1", "Summit Roofing Co", "hypercare", "Local + 1 extra location", { ai_action: 1300, marketing_email: 32500 }, { ai: 1318, calls: 702, haiku: 610, sonnet: 92, emails: 32500, in: 3_910_000, out: 610_000, nova: 41, wallet: 18, absorbed: 0 }, { ai: 3.81, email: 3.25 }, 1100, 99, { out: false, wallet_ai: 1982, wallet_em: 40000 }),
    row("c2", "Harbor Coffee", "hypercare", "Local", { ai_action: 1000, marketing_email: 25000 }, { ai: 842, calls: 520, haiku: 459, sonnet: 61, emails: 6120, in: 2_210_000, out: 380_000, nova: 22 }, { ai: 2.34, email: 0.61 }, 750, 0),
    row("c4", "Cascade Plumbing", "hypercare", "National", { ai_action: 2500, marketing_email: 60000 }, { ai: 690, calls: 390, haiku: 330, sonnet: 60, emails: 18400, in: 1_640_000, out: 300_000, nova: 9 }, { ai: 1.97, email: 1.84 }, 1750, 25),
    row("c3", "Northline Fitness", "gravitycare", "", { ai_action: 50, marketing_email: 0 }, { ai: 12, calls: 12, haiku: 0, sonnet: 0, emails: 0, in: 0, out: 0, nova: 12 }, { ai: 0, email: 0 }, 197, 0),
  ];
  const t = clients.reduce((s, c) => ({ ai_units: s.ai_units + c.usage.ai_units, emails: s.emails + c.usage.emails, ai_cost: s.ai_cost + c.est_cost.ai, email_cost: s.email_cost + c.est_cost.email, plan_revenue: s.plan_revenue + c.plan_revenue, refuel_revenue: s.refuel_revenue + c.refuel_revenue, in_tokens: s.in_tokens + c.usage.in_tokens, out_tokens: s.out_tokens + c.usage.out_tokens, nova_messages: s.nova_messages + c.usage.nova_messages, near_caps: s.near_caps + (c.near_cap ? 1 : 0), out_of_fuel: s.out_of_fuel + (c.out_of_fuel ? 1 : 0) }), { ai_units: 0, emails: 0, ai_cost: 0, email_cost: 0, plan_revenue: 0, refuel_revenue: 0, in_tokens: 0, out_tokens: 0, nova_messages: 0, near_caps: 0, out_of_fuel: 0 });
  const agency = { ai_units: 388, ai_calls: 214, in_tokens: 2_400_000, out_tokens: 410_000, ai_cost: 8.9 };
  const cost = t.ai_cost + t.email_cost + agency.ai_cost;
  return {
    month: new Date().toISOString().slice(0, 7), truncated: false, config_status: "Pending Justin's final approval",
    costs: { sonnet_in_per_m: 2, sonnet_out_per_m: 10, haiku_in_per_m: 0.1, haiku_out_per_m: 0.5, ses_per_1000: 0.1 },
    clients, near_caps: clients.filter((c) => c.near_cap || c.out_of_fuel).map((c) => ({ id: c.id, business: c.business, pct: c.pct, out_of_fuel: c.out_of_fuel })),
    agency,
    totals: { clients: clients.length, ...t, ai_cost: Math.round((t.ai_cost + agency.ai_cost) * 100) / 100, cost: Math.round(cost * 100) / 100, margin: Math.round((t.plan_revenue + t.refuel_revenue - cost) * 100) / 100, in_tokens: t.in_tokens + agency.in_tokens, out_tokens: t.out_tokens + agency.out_tokens },
    base44_credits: {
      source: "docs.base44.com/Account-and-billing/Credits (rates are Base44's published approximations)",
      fixed_jobs: [
        { name: "Studios: drain bulk email queue (*/5)", runs: 8640, workflow_credits: 864, function_credits: 86.4 },
        { name: "Social Studio: publish approved posts (*/15)", runs: 2880, workflow_credits: 288, function_credits: 28.8 },
        { name: "Social Studio: publish approved variants (*/15)", runs: 2880, workflow_credits: 288, function_credits: 28.8 },
        { name: "Daily jobs (8 workflows, one has 2 steps)", runs: 240, workflow_credits: 27, function_credits: 2.4 },
        { name: "Fuel: resume paused queues (daily)", runs: 30, workflow_credits: 3, function_credits: 0.3 },
      ],
      fixed_monthly: 1617, nova_messages_this_month: t.nova_messages, nova_credits_this_month: t.nova_messages * 3,
      per_client_monthly_estimate: { light: 45, typical: 140, heavy: 420 }, active_clients: clients.length,
    },
  };
}

export function qaFuelConfig() {
  return {
    status_note: "Pending Justin's final approval",
    config: {
      studios_require_hypercare: true, nova_only_ai_actions: 50,
      tiers: { local: { label: "Local", ai_action: 1000, marketing_email: 25000 }, national: { label: "National", ai_action: 2500, marketing_email: 60000 }, global: { label: "Global", ai_action: 5000, marketing_email: 120000 } },
      extra_location: { ai_action: 300, marketing_email: 7500 }, alert_at: 0.8, overshoot_buffer_pct: 0.03, packs: PACKS, credit_validity_months: 12,
      auto_refuel: { default_enabled: false, live_charging: false, default_pack: "refuel", max_monthly_ceiling_usd: 500 },
      weights: { haiku: 1, sonnet: 3, agent_large: 5, nova: 1, large_context_tokens: 50000 },
      media_credits: { enabled: false, starter: { hypercare: 0, website: 0, gravitycare: 0, none: 0 }, weights: { image: 1, video_second: 5, voice_50_chars: 1 }, packs: [] },
      costs: { sonnet_in_per_m: 2, sonnet_out_per_m: 10, haiku_in_per_m: 0.1, haiku_out_per_m: 0.5, ses_per_1000: 0.1 },
      plan_prices: { local: 750, national: 1750, global: 3000, extra_location: 350, website: 500, gravitycare: 197, none: 0 },
      resume: { spacing_minutes: 120, window_start: "09:00", window_end: "19:00", timezone: "America/Los_Angeles", weekends: true },
    },
  };
}

export function qaFuelInvoke(args = {}) {
  if (args.action === "summary") return qaFuelSummary();
  if (args.action === "economics") return qaFuelEconomics();
  if (args.action === "get_config") return qaFuelConfig();
  if (args.action === "save_config") return { ok: true, config: args.config };
  if (args.action === "nova_tick") return { ok: stateNow() !== "out", code: stateNow() === "out" ? "out_of_fuel" : undefined, reset_label: resetLabel() };
  if (args.action === "set_auto_refuel") return { ok: true, enabled: !!args.enabled, monthly_ceiling_usd: args.monthly_ceiling_usd, live: false };
  if (args.action === "checkout") return { error: "QA preview: checkout is disabled (no real charges)." };
  if (args.action === "mock_checkout_completed" || args.action === "grant") return { ok: true, result: { credited: true, test: true } };
  return {};
}
