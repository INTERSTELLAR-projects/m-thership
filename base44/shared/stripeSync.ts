import { loadPicture, PLAN_OF } from "./stripe.ts";

/*
 * Stripe → CRM. For every subscription matched to a client, the client's billing line items are
 * rewritten from Stripe (name + monthly amount), so what Møthership shows is what Stripe charges.
 * Subscription plans also switch services_managed (orbit_seo ↔ HyperCare+, starship_care ↔ GravïtyCare).
 * Lines that are not on any Stripe subscription (legacy / off-Stripe arrangements) are kept and marked.
 * Returns a report; never deletes a client.
 */
const LABEL = (plan: string, name: string) =>
  plan === "hypercare" ? "HyperCare+" : plan === "gravitycare" ? "GravïtyCare" : plan === "appcare" ? "AppCare" : plan === "manage" ? "Manage+" : plan === "mission" ? name.replace(/^Interstellar®?\s*/i, "") + " (financed)" : name.replace(/^Interstellar®?\s*/i, "");
const DISCONTINUED = /badge|reviews|app management/i;

export async function syncFromStripe(base44: any, key: string) {
  const picture = await loadPicture(base44, key);
  const db = base44.asServiceRole.entities;
  const clients = await db.CRMClient.list("business", 300);
  const byId = new Map<string, any>(clients.map((c: any) => [c.id, c]));
  const touched = new Map<string, { client: any; lines: any[]; plans: Set<string>; customer: string; customers: Set<string> }>();

  for (const s of picture.subscriptions) {
    if (!s.client) continue;
    const client = byId.get(s.client.id);
    if (!client) continue;
    const t = touched.get(client.id) || { client, lines: [] as any[], plans: new Set<string>(), customer: s.customer.id, customers: new Set<string>() };
    t.customers.add(s.customer.id);
    s.lines.forEach((l: any) => {
      // Named exactly as the product is in Stripe (LABEL kept only as a short display alias).
      t.lines.push({ id: l.id, name: l.name, short: LABEL(l.plan, l.name), price: l.monthly, stripe: true, stripe_price_id: l.price_id, stripe_product_id: l.product_id, subscription_id: s.id, interval: l.interval, discontinued: DISCONTINUED.test(l.name), status: s.status });
      t.plans.add(s.plan);
    });
    touched.set(client.id, t);
  }

  const report: any[] = [];
  for (const [id, t] of touched) {
    const existing: any[] = Array.isArray(t.client.services) ? t.client.services : [];
    // Keep lines that aren't in Stripe only when they are still meant to be billed (e.g. a plan that starts next week).
    // Discontinued add-ons that Stripe no longer bills are dropped — their value now lives inside the merged plan price.
    // A line added by hand from the Stripe dropdown is replaced by the real subscription line once Stripe bills it
    // (same price, same product, same name, or the same care plan).
    const careOf = (n: string) => { const p = PLAN_OF(n); return p === "hypercare" || p === "gravitycare" ? p : ""; };
    const covered = (x: any) => t.lines.some((l) =>
      (x.stripe_price_id && x.stripe_price_id === l.stripe_price_id) ||
      (x.stripe_product_id && x.stripe_product_id === l.stripe_product_id) ||
      [l.name, l.short].some((n) => String(n).toLowerCase() === String(x.name || "").toLowerCase()) ||
      // Generic care-plan lines written by start-service ("HyperCare+", no Stripe ids) give way to the billed plan.
      (!x.stripe_product_id && /^(hypercare\+|gravïtycare|gravitycare)$/i.test(String(x.name || "").trim()) && careOf(String(x.name)) === careOf(l.name)));
    const kept = existing.filter((x) => !x.stripe && !x.discontinued && !DISCONTINUED.test(String(x.name || "")) && !covered(x));
    const services = [...t.lines, ...kept.map((x) => ({ ...x, off_stripe: true, note: x.note || "not in Stripe yet" }))];
    const managed = new Set<string>(t.client.services_managed || []);
    if (t.plans.has("hypercare")) managed.add("orbit_seo");
    if (t.plans.has("gravitycare")) managed.add("starship_care");
    if (t.plans.has("appcare") || t.plans.has("manage")) managed.add("system");
    const ids = new Set<string>([...(t.client.stripe_customer_ids || []), ...t.customers]);
    const patch: any = { services, services_managed: [...managed], stripe_customer_id: t.customer, stripe_customer_ids: [...ids], stripe_synced_at: new Date().toISOString() };
    if (t.client.status !== "Active") patch.status = "Active";
    await db.CRMClient.update(id, patch);
    report.push({ client: t.client.business, lines: t.lines.map((l) => `${l.name} $${l.price}/mo`), kept_off_stripe: kept.map((x) => x.name) });
  }

  // clients with Stripe lines but no live subscription any more → mark those lines ended
  for (const c of clients) {
    if (touched.has(c.id)) continue;
    const lines: any[] = Array.isArray(c.services) ? c.services : [];
    const stale = lines.filter((x) => x.stripe);
    if (!stale.length) continue;
    await db.CRMClient.update(c.id, { services: lines.map((x) => (x.stripe ? { ...x, status: "canceled", price: 0 } : x)), stripe_synced_at: new Date().toISOString() });
    report.push({ client: c.business, canceled: stale.map((x) => x.name) });
  }

  return { synced: report.length, unmatched: picture.subscriptions.filter((s: any) => !s.client).map((s: any) => ({ id: s.id, customer: s.customer, mrr: s.mrr, lines: s.lines.map((l: any) => l.name) })), report, mrr: picture.mrr, plans: picture.plans };
}
