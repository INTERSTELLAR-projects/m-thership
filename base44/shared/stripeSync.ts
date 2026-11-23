import { loadPicture, PLAN_OF } from "./stripe.ts";
import { moveStage } from "./leadStage.ts";

/*
 * Stripe → CRM. For every subscription matched to a client, the client's billing line items are
 * rewritten from Stripe (name + monthly amount), so what Møthership shows is what Stripe charges.
 * Subscription plans also switch services_managed (orbit_seo ↔ HyperCare+, starship_care ↔ GravïtyCare).
 * Lines that are not on any Stripe subscription (legacy / off-Stripe arrangements) are kept and marked.
 * Returns a report; never deletes a client.
 */
const LABEL = (plan: string, name: string) =>
  plan === "hypercare" ? "HyperCare+" : plan === "gravitycare" ? "GravïtyCare" : plan === "appcare" ? "AppCare" : plan === "manage" ? "Manage+" : plan === "mission" ? name.replace(/^Interstellar[®™]?\s*/i, "") + " (financed)" : name.replace(/^Interstellar[®™]?\s*/i, "");
const DISCONTINUED = /badge|reviews|app management/i;

// Care-plan flags in services_managed and the plan each one stands for.
const CARE_FLAGS: Record<string, string> = { hypercare: "orbit_seo", gravitycare: "starship_care" };
const careOfName = (n: string) => { const p = PLAN_OF(String(n || "")); return p === "hypercare" || p === "gravitycare" ? p : ""; };
// Care plans a client was billed for through Stripe before this sync (so we only ever switch off a plan that
// Stripe used to bill; clients on off-Stripe or combined arrangements are never flipped by this).
const stripeCareBefore = (c: any) => new Set<string>((Array.isArray(c.services) ? c.services : []).filter((x: any) => x.stripe && x.status !== "canceled").map((x: any) => careOfName(x.name)).filter(Boolean));
// Off-Stripe care lines that are still meant to be billed keep the plan on.
const offStripeCare = (lines: any[]) => new Set<string>(lines.filter((x: any) => !x.stripe && x.status !== "canceled").map((x: any) => careOfName(x.name)).filter(Boolean));

// A canceled or ended care subscription removes its flag (orbit_seo = HyperCare+, starship_care = GravïtyCare).
// When no care plan is left the client is plan_status "inactive": Studios lock and the portal shows the
// "plan inactive, contact us" screen. Nothing is deleted.
function carePatch(client: any, livePlans: Set<string>, keptLines: any[], managed: Set<string>) {
  const before = stripeCareBefore(client);
  const off = offStripeCare(keptLines);
  const ended: string[] = [];
  for (const plan of Object.keys(CARE_FLAGS)) {
    if (before.has(plan) && !livePlans.has(plan) && !off.has(plan)) { managed.delete(CARE_FLAGS[plan]); ended.push(plan); }
  }
  const hasCare = Object.keys(CARE_FLAGS).some((p) => livePlans.has(p) || off.has(p) || managed.has(CARE_FLAGS[p]));
  const patch: any = {};
  if (hasCare) {
    if (client.plan_status === "inactive") { patch.plan_status = "active"; patch.plan_inactive_reason = ""; }
    else if (!client.plan_status) patch.plan_status = "active";
  } else if (ended.length) {
    patch.plan_status = "inactive";
    patch.plan_inactive_at = new Date().toISOString();
    patch.plan_inactive_reason = `${ended.map((p) => (p === "hypercare" ? "HyperCare+" : "GravïtyCare")).join(" + ")} subscription canceled or ended in Stripe`;
  }
  return { patch, ended };
}

// One CRM line per live Stripe subscription, with its items underneath (e.g. "Google + SEO management", $X/mo).
// price = the subscription's monthly total, so every MRR sum in Møthership (cards, profile, totals, Plan to Execute)
// equals the sum of active + trialing Stripe subscriptions.
const clean = (n: string) => String(n || "").replace(/®/g, "™");
const shortName = (n: string) => clean(n).replace(/^Interstellar[®™]?\s*/i, "").trim();
const isRecurring = (x: any) => String(x?.interval || "month") !== "one_time";

function subscriptionLine(s: any) {
  const items = s.lines.map((l: any) => ({ id: l.id, name: clean(l.name), short: LABEL(l.plan, l.name), plan: l.plan, monthly: l.monthly, amount: l.amount, interval: l.interval, quantity: l.quantity, price_id: l.price_id, product_id: l.product_id }));
  const names = items.map((i: any) => shortName(i.name)).filter(Boolean);
  return {
    id: s.id,
    subscription_id: s.id,
    name: names.join(" + ") || "Subscription",
    short: items.map((i: any) => i.short).join(" + "),
    price: s.mrr,
    interval: "month",
    stripe: true,
    status: s.status,
    stripe_customer_id: s.customer.id,
    stripe_price_id: items[0]?.price_id || null,
    stripe_product_id: items[0]?.product_id || null,
    items,
    started: s.started,
    current_period_end: s.current_period_end,
    cancel_at_period_end: s.cancel_at_period_end,
    discontinued: false,
  };
}

// Lines that leave the live list are kept as history (never counted): price 0, status ended, the old amount kept.
const toHistory = (x: any, reason: string, at: string) => ({ ...x, status: "ended", ended_reason: reason, ended_at: at, last_price: x.last_price ?? x.price ?? 0, price: 0 });
function mergeHistory(prev: any[], add: any[]) {
  const out = [...add, ...(Array.isArray(prev) ? prev : [])];
  const seen = new Set<string>();
  return out.filter((x) => { const k = String(x.subscription_id || x.id || x.name); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 60);
}
const summary = (lines: any[]) => lines.map((l) => `${l.name} $${Math.round(l.price * 100) / 100}/mo`).join(" · ");

export async function syncFromStripe(base44: any, key: string) {
  const picture = await loadPicture(base44, key);
  const db = base44.asServiceRole.entities;
  const clients = await db.CRMClient.list("business", 300);
  const byId = new Map<string, any>(clients.map((c: any) => [c.id, c]));
  const now = new Date().toISOString();
  const touched = new Map<string, { client: any; subs: any[]; itemLines: any[]; plans: Set<string>; customer: string; customers: Set<string> }>();

  for (const s of picture.subscriptions) {
    if (!s.client) continue;
    const client = byId.get(s.client.id);
    if (!client) continue;
    const t = touched.get(client.id) || { client, subs: [] as any[], itemLines: [] as any[], plans: new Set<string>(), customer: s.customer.id, customers: new Set<string>() };
    t.customers.add(s.customer.id);
    t.subs.push(s);
    s.lines.forEach((l: any) => {
      t.itemLines.push({ name: clean(l.name), short: LABEL(l.plan, l.name), stripe_price_id: l.price_id, stripe_product_id: l.product_id });
      t.plans.add(l.plan);
    });
    t.plans.add(s.plan);
    touched.set(client.id, t);
  }

  const report: any[] = [];
  for (const [id, t] of touched) {
    // A lead with a live Stripe subscription has bought: move it to Won (auto, undoable), which converts it to a
    // client and starts new-client prep. Then Stripe's lines replace the committed ones below.
    if (t.client.status === "Lead") {
      await moveStage(db, t.client, "won", { by: "automation:stripe", reason: `Stripe subscription ${t.subs[0]?.id || ""} is ${t.subs[0]?.status || "active"}`, auto: true, source: "automation" }).catch(() => null);
      t.client = (await db.CRMClient.get(id).catch(() => null)) || t.client;
    }
    const existing: any[] = Array.isArray(t.client.services) ? t.client.services : [];
    const lines = t.subs.sort((a: any, b: any) => b.mrr - a.mrr).map(subscriptionLine);
    const liveIds = new Set(lines.map((l: any) => l.subscription_id));
    // One-time lines (financed builds, missions) are not subscriptions: they stay as they are and never count toward MRR.
    const oneTime = existing.filter((x) => !x.stripe && !isRecurring(x));
    // Everything else that Stripe is not billing right now goes to history: old per-item lines, subscriptions
    // replaced by a merge, canceled ones, and recurring lines typed in by hand.
    // (Older per-item lines of a subscription that is still live are simply replaced by its one line.)
    const gone = existing.filter((x) => isRecurring(x) && !(x.stripe && (liveIds.has(x.subscription_id) || liveIds.has(x.id))))
      .map((x) => toHistory(x, x.stripe ? "no longer an active subscription in Stripe (canceled or replaced by a merge)" : "not billed in Stripe", now));
    const services = [...lines, ...oneTime];
    const managed = new Set<string>(t.client.services_managed || []);
    if (t.plans.has("hypercare")) managed.add("orbit_seo");
    if (t.plans.has("gravitycare")) managed.add("starship_care");
    if (t.plans.has("appcare") || t.plans.has("manage")) managed.add("system");
    // A client with a live Stripe subscription is paying: never switch a care plan off here just because a merge
    // renamed the product (e.g. HyperCare+ folded into "Google + SEO management"). Only a client with no live
    // subscription at all can go inactive (below).
    const care: any = { patch: t.client.plan_status === "inactive" ? { plan_status: "active", plan_inactive_reason: "" } : (!t.client.plan_status ? { plan_status: "active" } : {}), ended: [] };
    const ids = new Set<string>([...(t.client.stripe_customer_ids || []), ...t.customers]);
    const mrr = Math.round(lines.reduce((a: number, l: any) => a + l.price, 0) * 100) / 100;
    const patch: any = { ...care.patch, services, services_history: mergeHistory(t.client.services_history, gone), services_managed: [...managed], stripe_customer_id: t.customer, stripe_customer_ids: [...ids], stripe_mrr: mrr, stripe_plan: summary(lines), stripe_synced_at: now };
    if (t.client.status !== "Active") patch.status = "Active";
    // Lead Engine: paying flips a lead-tier portal to the full client portal (never deletes anything).
    if (t.client.portal_tier === "lead" && lines.some((l: any) => ["active", "trialing"].includes(String(l.status)))) { patch.portal_tier = "client"; patch.portal_tier_changed_at = now; }
    const err = await db.CRMClient.update(id, patch).then(() => null).catch((e: any) => String(e?.message || e).slice(0, 300));
    report.push({ ...(err ? { error: err } : {}), client: t.client.business, subscriptions: lines.map((l: any) => ({ id: l.subscription_id, status: l.status, name: l.name, mrr: l.price, items: l.items.map((i: any) => `${i.name} $${i.monthly}/mo`) })), mrr, moved_to_history: gone.map((x: any) => x.name), ...(care.ended.length ? { care_ended: care.ended, plan_status: patch.plan_status || t.client.plan_status } : {}) });
  }

  // Clients with Stripe lines but no live subscription any more: those lines move to history (never counted).
  for (const c of clients) {
    if (touched.has(c.id)) continue;
    const lines: any[] = Array.isArray(c.services) ? c.services : [];
    const stale = lines.filter((x) => x.stripe);
    if (!stale.length) continue;
    const managed = new Set<string>(c.services_managed || []);
    const kept = lines.filter((x) => !x.stripe);
    const care = carePatch(c, new Set<string>(), kept, managed);
    const err = await db.CRMClient.update(c.id, { ...care.patch, services_managed: [...managed], services: kept, services_history: mergeHistory(c.services_history, stale.map((x) => toHistory(x, "no longer an active subscription in Stripe", now))), stripe_mrr: 0, stripe_plan: "", stripe_synced_at: now }).then(() => null).catch((e: any) => String(e?.message || e).slice(0, 300));
    report.push({ ...(err ? { error: err } : {}), client: c.business, subscriptions: [], mrr: 0, moved_to_history: stale.map((x) => x.name), ...(care.ended.length ? { care_ended: care.ended, plan_status: care.patch.plan_status || c.plan_status } : {}) });
  }

  const matchedMrr = Math.round(report.reduce((a, r) => a + (r.mrr || 0), 0) * 100) / 100;
  const unmatched = picture.subscriptions.filter((s: any) => !s.client).map((s: any) => ({ id: s.id, status: s.status, customer: s.customer, mrr: s.mrr, lines: s.lines.map((l: any) => l.name) }));
  const errors = report.filter((r) => r.error).map((r) => ({ client: r.client, error: r.error }));
  // Last-sync status for the Clients page and for checking a run later (admin-only AppSettings row).
  const status = { at: now, subscriptions: picture.subscriptions.length, mrr: picture.mrr, matched_mrr: Math.round(report.reduce((a, r) => a + (r.mrr || 0), 0) * 100) / 100, clients: report.map((r) => ({ client: r.client, subscriptions: r.subscriptions.length, mrr: r.mrr, lines: r.subscriptions.map((x: any) => `${x.name} $${x.mrr}/mo`) })), unmatched: picture.subscriptions.filter((x: any) => !x.client).map((x: any) => ({ id: x.id, status: x.status, mrr: x.mrr, customer: x.customer?.name || x.customer?.id, lines: x.lines.map((l: any) => l.name) })), errors };
  try {
    const row = ((await db.AppSettings.filter({ key: "stripe_sync_status" }, "-updated_date", 1).catch(() => [])) || [])[0];
    if (row) await db.AppSettings.update(row.id, { pageSettings: status });
    else await db.AppSettings.create({ key: "stripe_sync_status", pageSettings: status });
  } catch { /* status row is a convenience; the sync itself already ran */ }
  return { synced: report.length - errors.length, errors, synced_at: now, subscriptions: picture.subscriptions.length, mrr: picture.mrr, matched_mrr: matchedMrr, unmatched, report, plans: picture.plans };
}
