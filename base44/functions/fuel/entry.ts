import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { requireSecondFactor } from "../../shared/twoFactor.ts";
import { resolveClient, getSecret } from "../../shared/portalClient.ts";
import { inviteSettings } from "../../shared/portalInvite.ts";
import { monthKey, studioState, STUDIO_KEYS } from "../../shared/usagePlans.ts";
import { check, record } from "../../shared/meter.ts";
import {
  loadFuelConfig, sanitizeFuelConfig, clearFuelCache, FUEL_SETTINGS_KEY, FUEL_STATUS_NOTE, DEFAULT_FUEL,
  allowanceFor, tierOf, walletOf, usedThisMonth, fuelLeft, fuelStateOf, packOf, resetDate, resetLabel,
  createRefuelCheckout, creditPack, creditFromCheckoutSession, resumeClient, resumeDue, aiCost, type FuelConfig,
} from "../../shared/fuel.ts";

// Fuel: the client's Studios meter, Refuel wallet and Auto-refuel opt-in, plus Justin's Fuel economics.
//   summary          { client_id? }             portal: own client; admin: any client. Allowance, used, wallet, pause.
//   checkout         { pack, client_id? }       portal user only: Stripe Checkout (payment mode, inline price_data) URL
//   set_auto_refuel  { enabled, monthly_ceiling_usd, pack }   portal user (own client) or admin. Off by default.
//   nova_tick        { client_id? }             meter one Nøva message (works on every plan, Nøva-only allowance)
//   --- admin ---
//   economics        { month? }                 per client: actions, emails, est. cost, margin, refuel revenue, near caps
//   get_config / save_config { config }        every fuel number (approved Nov 4, 2026)
//   grant            { client_id, pack, note }  admin-granted credits (no charge)
//   mock_checkout_completed { client_id, pack, session_id? }  TEST ONLY: runs the exact webhook crediting path on a
//                                               fake checkout.session.completed payload. Never charges anyone.
//   resume           { client_id }              resume one client now
//   resume_due       {}                         daily job (no user) or admin: resume paused clients with fuel again
// Never reads or returns secret values.

const json = (d: unknown, status = 200) => Response.json(d, { status });
const round = (n: number, p = 2) => Math.round((Number(n) || 0) * 10 ** p) / 10 ** p;

async function summary(db: any, client: any, cfg: FuelConfig, isAdmin: boolean) {
  const allow = allowanceFor(client, cfg);
  const used = await usedThisMonth(db, String(client.id));
  const wallet = await walletOf(db, String(client.id));
  const st = await fuelStateOf(db, client);
  const kind = (k: "ai_action" | "marketing_email", cap: number, w: number) => {
    const u = used[k] || 0;
    const left = fuelLeft(cap, u, w);
    const fin = isFinite(cap);
    return {
      cap: fin ? cap : null, used: u, allowance_left: fin ? Math.max(0, cap - u) : null, wallet: w, left: isFinite(left) ? left : null,
      pct: fin && cap > 0 ? Math.min(1.5, u / cap) : 0, alert: fin && cap > 0 && u / cap >= cfg.alert_at, out: fin && left <= 0 && (cap > 0 || w > 0 || u > 0),
      buffer: fin ? Math.floor(cap * cfg.overshoot_buffer_pct) : 0, from_wallet: used[`wallet_${k}`] || 0,
    };
  };
  const ai = kind("ai_action", allow.ai_action, wallet.ai_action);
  const email = kind("marketing_email", allow.marketing_email, wallet.marketing_email);
  const pausedPosts = ((await db.SocialVariant.filter({ client_id: String(client.id), status: "approved", fuel_paused: true }, "scheduled_at", 200).catch(() => [])) || []).length;
  const pausedCamps = ((await db.EmailCampaign.filter({ client_id: String(client.id), status: "paused" }, "created_date", 100).catch(() => [])) || []) as any[];
  const outKinds = [...(ai.out && allow.ai_action !== 0 ? ["ai_action"] : []), ...(email.out && allow.marketing_email !== 0 ? ["marketing_email"] : [])];
  return {
    visible: true, config_status: FUEL_STATUS_NOTE, month: monthKey(), reset_on: resetDate(), reset_label: resetLabel(),
    plan: allow.plan, plan_label: allow.plan_label, tier: allow.tier, tier_label: allow.tier_label, extra_locations: allow.extra_locations,
    studios_unlocked: allow.studios_unlocked, nova_only: allow.nova_only, unlimited: allow.unlimited,
    studios: Object.fromEntries(STUDIO_KEYS.map((k) => [k, allow.studios_unlocked ? studioState(client, k) : "locked"])),
    free_for_life: cfg.free_for_life,
    ai, email,
    out_of_fuel: outKinds.length > 0, out_kinds: outKinds, alert: ai.alert || email.alert,
    paused: { kinds: st?.paused_kinds || [], since: st?.paused_at || null, posts: pausedPosts, campaigns: pausedCamps.length, campaign_emails: pausedCamps.reduce((s, c) => s + (Number(c.total) || 0), 0) },
    wallet: { ai_action: wallet.ai_action, marketing_email: wallet.marketing_email, next_expiry: wallet.next_expiry, lots: wallet.lots.map((l) => ({ pack_label: l.pack_label, ai_left: l.ai_left, emails_left: l.emails_left, expires_at: l.expires_at, purchased_at: l.purchased_at, ...(isAdmin ? { source: l.source, test: l.test } : {}) })) },
    packs: cfg.packs, credit_validity_months: cfg.credit_validity_months,
    auto_refuel: { enabled: !!st?.auto_refuel_enabled, pack: st?.auto_refuel_pack || cfg.auto_refuel.default_pack, monthly_ceiling_usd: Number(st?.auto_refuel_monthly_ceiling_usd) || 0, spent_this_month_usd: Number(st?.auto_refuel_spent?.[monthKey()]) || 0, max_ceiling_usd: cfg.auto_refuel.max_monthly_ceiling_usd, live: !!cfg.auto_refuel.live_charging },
    media: { enabled: !!cfg.media_credits.enabled },
    stripe_ready: !!getSecret("STRIPE_SECRET_KEY"),
  };
}

// ---------- Fuel economics (admin) ----------
const lineRevenue = (c: any) => ((Array.isArray(c.services) ? c.services : []) as any[])
  .filter((s) => s && s.status !== "canceled" && !s.discontinued && (s.interval || "month") === "month")
  .reduce((sum, s) => sum + (Number(s.price) || 0), 0);

async function economics(db: any, cfg: FuelConfig, month: string) {
  const clients = ((await db.CRMClient.filter({ status: "Active" }, "business", 500).catch(() => [])) || []) as any[];
  const rows = ((await db.UsageLedger.filter({ month }, "-created_date", 5000).catch(() => [])) || []) as any[];
  const buys = ((await db.CreditPurchase.list("-created_date", 2000).catch(() => [])) || []) as any[];
  const agg: Record<string, any> = {};
  const blank = () => ({ ai_units: 0, ai_calls: 0, admin_ai_units: 0, emails: 0, admin_emails: 0, nova_messages: 0, haiku_calls: 0, sonnet_calls: 0, other_calls: 0, in_tokens: 0, out_tokens: 0, ai_cost: 0, email_cost: 0, wallet_units: 0, absorbed_units: 0 });
  for (const r of rows) {
    const a = (agg[r.client_id] ||= blank());
    const u = Number(r.units) || 0;
    if (r.kind === "ai_action") {
      if (r.by_admin) a.admin_ai_units += u; else a.ai_units += u;
      a.ai_calls += Number(r.calls) || 1;
      const model = String(r.model || "");
      if (/haiku/i.test(model)) a.haiku_calls++; else if (/sonnet|opus/i.test(model)) a.sonnet_calls++; else a.other_calls++;
      if (/^nova/.test(String(r.feature || ""))) a.nova_messages++;
      a.in_tokens += Number(r.input_tokens) || 0; a.out_tokens += Number(r.output_tokens) || 0;
      // Real token counts first (cost re-priced with the current settings), the stored estimate as a fallback.
      const tokCost = aiCost(model, Number(r.input_tokens) || 0, Number(r.output_tokens) || 0, cfg);
      a.ai_cost += tokCost || Number(r.est_cost_usd) || 0;
    } else if (r.kind === "marketing_email") {
      if (r.by_admin) a.admin_emails += u; else a.emails += u;
      a.email_cost += u * (cfg.costs.ses_per_1000 / 1000);
    }
    a.wallet_units += Number(r.wallet_units) || 0;
    a.absorbed_units += Number(r.absorbed_units) || 0;
  }
  const monthStart = `${month}-01`;
  const inMonth = (iso: string) => String(iso || "").slice(0, 7) === month;
  const out = [];
  const totals = { clients: 0, ai_units: 0, emails: 0, ai_cost: 0, email_cost: 0, cost: 0, plan_revenue: 0, refuel_revenue: 0, margin: 0, near_caps: 0, out_of_fuel: 0, in_tokens: 0, out_tokens: 0, nova_messages: 0 };
  for (const c of clients) {
    const allow = allowanceFor(c, cfg);
    const a = agg[c.id] || blank();
    const wallet = await walletOf(db, String(c.id));
    const billed = lineRevenue(c);
    const t = tierOf(c);
    const listPrice = allow.plan === "hypercare" ? (cfg.plan_prices[t.tier] || 0) + t.extra_locations * (cfg.plan_prices.extra_location || 0) : cfg.plan_prices[allow.plan] || 0;
    const planRevenue = billed > 0 ? billed : 0;
    const refuel = buys.filter((b) => String(b.client_id) === String(c.id) && !b.test && ["stripe", "auto_refuel"].includes(b.source) && inMonth(b.purchased_at)).reduce((s, b) => s + (Number(b.price_usd) || 0), 0);
    const cost = a.ai_cost + a.email_cost;
    const aiPct = isFinite(allow.ai_action) && allow.ai_action > 0 ? a.ai_units / allow.ai_action : 0;
    const emPct = isFinite(allow.marketing_email) && allow.marketing_email > 0 ? a.emails / allow.marketing_email : 0;
    const leftAi = fuelLeft(allow.ai_action, a.ai_units, wallet.ai_action);
    const leftEm = fuelLeft(allow.marketing_email, a.emails, wallet.marketing_email);
    const row = {
      id: c.id, business: c.business, plan: allow.plan, plan_label: allow.plan_label, tier: allow.tier, tier_label: allow.tier_label,
      studios_unlocked: allow.studios_unlocked,
      caps: { ai_action: isFinite(allow.ai_action) ? allow.ai_action : null, marketing_email: isFinite(allow.marketing_email) ? allow.marketing_email : null },
      usage: { ai_units: a.ai_units, ai_calls: a.ai_calls, admin_ai_units: a.admin_ai_units, emails: a.emails, admin_emails: a.admin_emails, haiku_calls: a.haiku_calls, sonnet_calls: a.sonnet_calls, nova_messages: a.nova_messages, in_tokens: a.in_tokens, out_tokens: a.out_tokens, wallet_units: a.wallet_units, absorbed_units: a.absorbed_units },
      pct: { ai_action: round(aiPct, 3), marketing_email: round(emPct, 3) },
      wallet: { ai_action: wallet.ai_action, marketing_email: wallet.marketing_email },
      est_cost: { ai: round(a.ai_cost, 4), email: round(a.email_cost, 4), total: round(cost, 4) },
      plan_revenue: round(planRevenue), plan_revenue_source: billed > 0 ? "billed lines" : "not billed on this client (package or off-Stripe)", list_price: listPrice,
      refuel_revenue: round(refuel), margin: round(planRevenue + refuel - cost), margin_pct: planRevenue + refuel > 0 ? round((planRevenue + refuel - cost) / (planRevenue + refuel), 4) : null,
      near_cap: aiPct >= cfg.alert_at || emPct >= cfg.alert_at, out_of_fuel: (isFinite(leftAi) && leftAi <= 0 && allow.ai_action > 0) || (isFinite(leftEm) && leftEm <= 0 && allow.marketing_email > 0),
    };
    out.push(row);
    totals.clients++; totals.ai_units += a.ai_units; totals.emails += a.emails; totals.ai_cost += a.ai_cost; totals.email_cost += a.email_cost; totals.cost += cost;
    totals.plan_revenue += planRevenue; totals.refuel_revenue += refuel; totals.near_caps += row.near_cap ? 1 : 0; totals.out_of_fuel += row.out_of_fuel ? 1 : 0;
    totals.in_tokens += a.in_tokens; totals.out_tokens += a.out_tokens; totals.nova_messages += a.nova_messages;
  }
  const agency = agg.agency || blank();
  totals.ai_cost += agency.ai_cost; totals.cost += agency.ai_cost; totals.in_tokens += agency.in_tokens; totals.out_tokens += agency.out_tokens;
  totals.margin = totals.plan_revenue + totals.refuel_revenue - totals.cost;
  for (const k of ["ai_cost", "email_cost", "cost", "plan_revenue", "refuel_revenue", "margin"] as const) (totals as any)[k] = round((totals as any)[k], 2);
  return {
    month, month_start: monthStart, truncated: rows.length >= 5000, config_status: FUEL_STATUS_NOTE, costs: cfg.costs,
    clients: out.sort((x, y) => (y.est_cost.total - x.est_cost.total) || String(x.business).localeCompare(String(y.business))),
    near_caps: out.filter((r) => r.near_cap || r.out_of_fuel).map((r) => ({ id: r.id, business: r.business, pct: r.pct, out_of_fuel: r.out_of_fuel })),
    agency: { ai_units: agency.admin_ai_units + agency.ai_units, ai_calls: agency.ai_calls, in_tokens: agency.in_tokens, out_tokens: agency.out_tokens, ai_cost: round(agency.ai_cost, 4) },
    totals,
    base44_credits: base44CreditEstimate(totals.nova_messages, out.length),
  };
}

// Base44 integration credits (fixed monthly pool, no rollover). Rates from docs.base44.com/Account-and-billing/Credits
// (checked 2026-11-04): backend function ~1 credit / 100 invocations; workflow ~1 credit / 10 steps; InvokeLLM
// ~1 credit (Automatic) or ~3+ (named models); in-app agent message ~3+ credits; SendEmail ~1 (~2 custom domain);
// UploadFile ~1; database reads/writes and our own API keys (Anthropic, SES, Stripe, Meta) are free.
function base44CreditEstimate(novaMessages: number, clientCount: number) {
  // Scheduled workflows in base44/workflows (runs per 30-day month).
  const jobs = [
    ["Studios: drain bulk email queue (*/5)", 8640, 1],
    ["Social Studio: publish approved posts (*/15)", 2880, 1],
    ["Social Studio: publish approved variants (*/15)", 2880, 1],
    ["Daily jobs (8 workflows, one has 2 steps)", 240, 1.125],
    ["Fuel: resume paused queues (daily)", 30, 1],
  ] as const;
  const fixed = jobs.map(([name, runs, steps]) => ({ name, runs, workflow_credits: round((runs * steps) / 10, 1), function_credits: round(runs / 100, 1) }));
  const fixedTotal = fixed.reduce((s, j) => s + j.workflow_credits + j.function_credits, 0);
  return {
    source: "docs.base44.com/Account-and-billing/Credits (rates are Base44's published approximations)",
    fixed_jobs: fixed, fixed_monthly: round(fixedTotal, 0),
    per_client_assumptions: {
      nova_message: 3, portal_briefing_card_invokellm_per_day: 1, ads_optimizer_invokellm_per_day: 1, portal_function_calls_per_100: 1,
    },
    nova_messages_this_month: novaMessages, nova_credits_this_month: novaMessages * 3,
    per_client_monthly_estimate: { light: 45, typical: 140, heavy: 420 },
    active_clients: clientCount,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const user = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || (user ? "summary" : "resume_due"));

    // Scheduled run (no user): the daily resume job only.
    if (!user) {
      if (action === "resume_due") return json(await resumeDue(db));
      return json({ error: "Not signed in" }, 401);
    }
    const gate = await requireSecondFactor(base44, req, user);
    if (gate) return gate;
    const isAdmin = user.role === "admin";
    const cfg = await loadFuelConfig(db);

    if (action === "summary") {
      const client = await resolveClient(db, user, body?.client_id);
      if (!client) return json({ visible: false });
      return json(await summary(db, client, cfg, isAdmin));
    }

    if (action === "checkout") {
      if (isAdmin) return json({ error: "Admin preview: only the client's own login can buy a Refuel. Use Grant credits in Fuel economics instead.", code: "admin_preview" }, 403);
      const client = await resolveClient(db, user, body?.client_id);
      if (!client) return json({ error: "No portal is set up for this login yet.", code: "no_client" }, 403);
      const pack = packOf(cfg, String(body?.pack || ""));
      if (!pack) return json({ error: "Unknown pack" }, 400);
      const key = getSecret("STRIPE_SECRET_KEY");
      if (!key) return json({ error: "Payments aren't set up yet. Interstellar has been notified.", code: "stripe_not_configured" }, 503);
      const st = await fuelStateOf(db, client);
      const settings = await inviteSettings(db).catch(() => ({ portal_url: "" }));
      const session = await createRefuelCheckout({ key, client, pack, user_email: String(user.email || ""), return_url: settings.portal_url || "https://interstellar-mothership.com", save_card: !!st?.auto_refuel_enabled });
      return json({ url: session.url, id: session.id });
    }

    if (action === "set_auto_refuel") {
      const client = await resolveClient(db, user, body?.client_id);
      if (!client) return json({ error: "No client" }, 403);
      const st = await fuelStateOf(db, client, true);
      const ceiling = Math.max(0, Math.min(Number(body?.monthly_ceiling_usd) || 0, cfg.auto_refuel.max_monthly_ceiling_usd));
      const enabled = body?.enabled === true && ceiling > 0;
      const pack = packOf(cfg, String(body?.pack || "")) ? String(body.pack) : cfg.auto_refuel.default_pack;
      await db.ClientFuel.update(st.id, { auto_refuel_enabled: enabled, auto_refuel_monthly_ceiling_usd: ceiling, auto_refuel_pack: pack, auto_refuel_set_by: user.email, auto_refuel_set_at: new Date().toISOString() });
      return json({ ok: true, enabled, monthly_ceiling_usd: ceiling, pack, live: !!cfg.auto_refuel.live_charging });
    }

    if (action === "nova_tick") {
      const client = await resolveClient(db, user, body?.client_id);
      if (!client) return json({ ok: true, skipped: "no client" });
      if (isAdmin) return json({ ok: true, admin_preview: true });
      const units = cfg.weights.nova;
      const c = await check(db, client, "ai_action", units, { feature: "nova.chat" });
      if (!c.ok) return json({ ok: false, code: c.code, reason: c.reason, reset_label: resetLabel() });
      await record(db, client, "ai_action", units, { model: "base44-agent", feature: "nova.chat", user_email: user.email, calls: 1 });
      return json({ ok: true });
    }

    if (!isAdmin) return json({ error: "Admins only" }, 403);

    if (action === "economics") {
      const month = /^\d{4}-\d{2}$/.test(String(body?.month || "")) ? String(body.month) : monthKey();
      return json(await economics(db, cfg, month));
    }
    if (action === "get_config") return json({ config: cfg, defaults: DEFAULT_FUEL, status_note: FUEL_STATUS_NOTE });
    if (action === "save_config") {
      const next = sanitizeFuelConfig(body?.config || {});
      const { status_note: _s, ...store } = next as any;
      const row = ((await db.AppSettings.filter({ key: FUEL_SETTINGS_KEY }, "-updated_date", 1).catch(() => [])) || [])[0];
      if (row) await db.AppSettings.update(row.id, { advancedSettings: store });
      else await db.AppSettings.create({ key: FUEL_SETTINGS_KEY, advancedSettings: store });
      clearFuelCache();
      return json({ ok: true, config: await loadFuelConfig(db, true) });
    }
    if (action === "grant") {
      const client = await db.CRMClient.get(String(body?.client_id || "")).catch(() => null);
      if (!client) return json({ error: "Pick a client" }, 400);
      const pack = packOf(cfg, String(body?.pack || "refuel"));
      if (!pack) return json({ error: "Unknown pack" }, 400);
      const out = await creditPack(db, { client, pack_key: pack.key, source: "admin", price_usd: 0, note: String(body?.note || `Granted by ${user.email}`), cfg });
      return json({ ok: true, lot_id: out.lot?.id, resumed: (out as any).resumed });
    }
    if (action === "mock_checkout_completed") {
      // TEST ONLY. Builds the payload Stripe would send for a paid Refuel Checkout Session and runs the same crediting
      // code the webhook runs. metadata.test = "1" marks the lot as a mock (excluded from revenue). No Stripe call.
      const client = await db.CRMClient.get(String(body?.client_id || "")).catch(() => null);
      if (!client) return json({ error: "Pick a client" }, 400);
      const pack = packOf(cfg, String(body?.pack || "refuel"));
      if (!pack) return json({ error: "Unknown pack" }, 400);
      const session = {
        id: String(body?.session_id || `cs_test_mock_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`), object: "checkout.session", mode: "payment",
        payment_status: "paid", status: "complete", amount_total: Math.round(pack.price_usd * 100), currency: "usd", client_reference_id: client.id,
        customer_details: { email: user.email }, payment_intent: null,
        metadata: { purpose: "refuel", client_id: client.id, pack: pack.key, ai_actions: String(pack.ai_actions), emails: String(pack.emails), test: "1" },
      };
      return json({ event: { type: "checkout.session.completed", data: { object: { id: session.id } } }, result: await creditFromCheckoutSession(db, session) });
    }
    if (action === "resume") {
      const client = await db.CRMClient.get(String(body?.client_id || "")).catch(() => null);
      if (!client) return json({ error: "Pick a client" }, 400);
      return json(await resumeClient(db, client, `manual by ${user.email}`, cfg));
    }
    if (action === "resume_due") return json(await resumeDue(db));

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("fuel", (e as Error)?.message);
    return json({ error: (e as Error)?.message || "Fuel request failed" }, 500);
  }
});
// Terms gate (Nov 23 2026): portal logins resolve only after accepting the active Terms of Service (docs/portal-terms.md).
