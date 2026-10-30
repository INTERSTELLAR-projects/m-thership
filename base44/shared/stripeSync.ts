import { loadPicture } from "./stripe.ts";

/*
 * Stripe → CRM. For every subscription matched to a client, the client's billing line items are
 * rewritten from Stripe (name + monthly amount), so what Møthership shows is what Stripe charges.
 * Subscription plans also switch services_managed (orbit_seo ↔ HyperCare+, starship_care ↔ GravïtyCare).
 * Lines that are not on any Stripe subscription (legacy / off-Stripe arrangements) are kept and marked.
 * Returns a report; never deletes a client.
 */
const LABEL = (plan: string, name: string) => (plan === "hypercare" ? "HyperCare+" : plan === "gravitycare" ? "GravïtyCare" : name);
const DISCONTINUED = /badge|app management|app maintenance|software maintenance|ops management/i;

export async function syncFromStripe(base44: any, key: string) {
  const picture = await loadPicture(base44, key);
  const db = base44.asServiceRole.entities;
  const clients = await db.CRMClient.list("business", 300);
  const byId = new Map<string, any>(clients.map((c: any) => [c.id, c]));
  const touched = new Map<string, { client: any; lines: any[]; plans: Set<string>; customer: string }>();

  for (const s of picture.subscriptions) {
    if (!s.client) continue;
    const client = byId.get(s.client.id);
    if (!client) continue;
    const t = touched.get(client.id) || { client, lines: [] as any[], plans: new Set<string>(), customer: s.customer.id };
    s.lines.forEach((l: any) => {
      t.lines.push({ id: l.id, name: LABEL(l.plan, l.name), price: l.monthly, stripe: true, stripe_price_id: l.price_id, subscription_id: s.id, interval: l.interval, discontinued: DISCONTINUED.test(l.name), status: s.status });
      t.plans.add(s.plan);
    });
    touched.set(client.id, t);
  }

  const report: any[] = [];
  for (const [id, t] of touched) {
    const existing: any[] = Array.isArray(t.client.services) ? t.client.services : [];
    // keep non-Stripe lines (e.g. Dad's ops management paid outside Stripe), drop stale Stripe lines
    const kept = existing.filter((x) => !x.stripe && !t.lines.some((l) => String(l.name).toLowerCase() === String(x.name || "").toLowerCase()));
    const services = [...t.lines, ...kept.map((x) => ({ ...x, off_stripe: true }))];
    const managed = new Set<string>(t.client.services_managed || []);
    if (t.plans.has("hypercare")) managed.add("orbit_seo");
    if (t.plans.has("gravitycare")) managed.add("starship_care");
    const patch: any = { services, services_managed: [...managed], stripe_customer_id: t.customer, stripe_synced_at: new Date().toISOString() };
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
