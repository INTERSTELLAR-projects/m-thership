import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

/*
 * Live subscription picture from Stripe, matched to CRM clients.
 *   subscriptions[]  every active/trialing/past_due subscription with its lines, customer and matched client
 *   month            revenue this month split: subscriptions (paid invoices with a subscription) vs other
 *   plans            HyperCare+ / GravïtyCare / other recurring: count + MRR
 * Matching: Stripe customer email ∈ CRMClient.emails, else customer name ≈ business name, else stripe_customer_id saved on the client.
 */
const STRIPE_API = "https://api.stripe.com/v1";
const round = (n: number) => Math.round(n * 100) / 100;
const norm = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const PLAN_OF = (name: string) => {
  const n = String(name || "").toLowerCase();
  if (/hypercare|ørbit|orbit/.test(n)) return "hypercare";
  if (/gravity|gravïty|starsh/.test(n)) return "gravitycare";
  return "other";
};

async function stripe(path: string, key: string, params: Record<string, string> = {}) {
  const out: any[] = [];
  let startingAfter: string | null = null;
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ limit: "100", ...params });
    if (startingAfter) q.set("starting_after", startingAfter);
    const res = await fetch(`${STRIPE_API}/${path}?${q.toString()}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20000) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error?.message || `Stripe responded ${res.status}`);
    out.push(...(body.data || []));
    if (!body.has_more || !body.data?.length) break;
    startingAfter = body.data[body.data.length - 1].id;
  }
  return out;
}

export async function loadPicture(base44: any, key: string) {
  const [subs, clients] = await Promise.all([
    stripe("subscriptions", key, { status: "all", "expand[]": "data.customer" } as any).then((rows) =>
      // Stripe only allows one expand per key via URLSearchParams; items.price.product is fetched below
      rows.filter((s: any) => ["active", "trialing", "past_due", "unpaid"].includes(s.status))
    ),
    base44.asServiceRole.entities.CRMClient.list("business", 300)
  ]);

  // product names
  const productIds = new Set<string>();
  subs.forEach((s: any) => (s.items?.data || []).forEach((it: any) => productIds.add(String(it.price?.product || ""))));
  const products = new Map<string, any>();
  await Promise.all(
    [...productIds].filter(Boolean).map(async (id) => {
      const res = await fetch(`${STRIPE_API}/products/${id}`, { headers: { Authorization: `Bearer ${key}` } });
      if (res.ok) products.set(id, await res.json());
    })
  );

  const byEmail = new Map<string, any>();
  clients.forEach((c: any) => (c.emails || []).forEach((e: string) => byEmail.set(String(e).toLowerCase(), c)));
  const byStripe = new Map<string, any>();
  clients.forEach((c: any) => c.stripe_customer_id && byStripe.set(c.stripe_customer_id, c));
  const match = (cust: any) => {
    if (!cust) return null;
    if (byStripe.has(cust.id)) return byStripe.get(cust.id);
    const email = String(cust.email || "").toLowerCase();
    if (email && byEmail.has(email)) return byEmail.get(email);
    const n = norm(cust.name || cust.description || "");
    if (!n) return null;
    return clients.find((c: any) => { const b = norm(c.business); return b && (n.includes(b) || b.includes(n)); }) || null;
  };

  const monthly = (price: any, qty = 1) => {
    const amt = (price?.unit_amount || 0) / 100 * (qty || 1);
    const { interval, interval_count } = price?.recurring || { interval: "month", interval_count: 1 };
    const per = interval === "year" ? amt / (12 * (interval_count || 1)) : interval === "week" ? (amt * 52) / 12 / (interval_count || 1) : interval === "day" ? (amt * 365) / 12 / (interval_count || 1) : amt / (interval_count || 1);
    return round(per);
  };

  const subscriptions = subs.map((s: any) => {
    const cust = typeof s.customer === "object" ? s.customer : { id: s.customer };
    const client = match(cust);
    const lines = (s.items?.data || []).map((it: any) => {
      const product = products.get(String(it.price?.product)) || {};
      const name = product.name || it.price?.nickname || "Subscription";
      return { id: it.id, product_id: product.id || null, name, plan: PLAN_OF(name), monthly: monthly(it.price, it.quantity), amount: (it.price?.unit_amount || 0) / 100, interval: it.price?.recurring?.interval || "month", quantity: it.quantity || 1, price_id: it.price?.id };
    });
    const mrr = round(lines.reduce((a: number, l: any) => a + l.monthly, 0));
    return {
      id: s.id,
      status: s.status,
      started: s.start_date ? new Date(s.start_date * 1000).toISOString().slice(0, 10) : null,
      current_period_end: s.current_period_end ? new Date(s.current_period_end * 1000).toISOString().slice(0, 10) : null,
      cancel_at_period_end: Boolean(s.cancel_at_period_end),
      customer: { id: cust.id, name: cust.name || cust.description || null, email: cust.email || null },
      client: client ? { id: client.id, business: client.business } : null,
      lines,
      mrr,
      plan: lines.some((l: any) => l.plan === "hypercare") ? "hypercare" : lines.some((l: any) => l.plan === "gravitycare") ? "gravitycare" : "other"
    };
  });

  const plans: Record<string, { count: number; mrr: number }> = { hypercare: { count: 0, mrr: 0 }, gravitycare: { count: 0, mrr: 0 }, other: { count: 0, mrr: 0 } };
  subscriptions.forEach((s: any) => {
    plans[s.plan].count += 1;
    s.lines.forEach((l: any) => { plans[l.plan === "other" && s.plan !== "other" ? s.plan : l.plan].mrr = round(plans[l.plan === "other" && s.plan !== "other" ? s.plan : l.plan].mrr + l.monthly); });
  });
  const mrr = round(subscriptions.reduce((a: number, s: any) => a + s.mrr, 0));

  // This month: paid invoices (subscription revenue) vs everything else collected
  const monthStart = Math.floor(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1) / 1000);
  const [invoices, txns] = await Promise.all([
    stripe("invoices", key, { status: "paid", "created[gte]": String(monthStart) }),
    stripe("balance_transactions", key, { "created[gte]": String(monthStart) })
  ]);
  const subscriptionRevenue = round(invoices.filter((i: any) => i.subscription).reduce((a: number, i: any) => a + (i.amount_paid || 0) / 100, 0));
  const collected = round(txns.filter((t: any) => t.type === "charge" || t.type === "payment").reduce((a: number, t: any) => a + (t.amount || 0) / 100, 0));
  const fees = round(txns.filter((t: any) => !String(t.type).startsWith("payout") && !String(t.type).startsWith("transfer")).reduce((a: number, t: any) => a + (t.fee || 0) / 100, 0));
  const refunds = round(txns.filter((t: any) => /refund/.test(String(t.type))).reduce((a: number, t: any) => a - (t.amount || 0) / 100, 0));
  const capital = round(txns.filter((t: any) => /capital|financ|loan|advance|obligation/.test(String(t.type))).reduce((a: number, t: any) => a - (t.amount || 0) / 100, 0));
  const net = round(txns.reduce((a: number, t: any) => a + (t.net || 0) / 100, 0));

  return {
    configured: true,
    generated_at: new Date().toISOString(),
    subscriptions: subscriptions.sort((a: any, b: any) => b.mrr - a.mrr),
    plans,
    mrr,
    month: { key: new Date().toISOString().slice(0, 7), subscriptions: subscriptionRevenue, other: round(Math.max(0, collected - subscriptionRevenue)), collected, fees, refunds, capital, net, invoices: invoices.length },
    unmatched: subscriptions.filter((s: any) => !s.client).length
  };
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    let key = "";
    try { key = secrets.get("STRIPE_SECRET_KEY") || ""; } catch { key = ""; }
    if (!key) return Response.json({ configured: false });
    return Response.json(await loadPicture(base44, key));
  } catch (error: any) {
    return Response.json({ configured: true, error: error.message }, { status: 502 });
  }
}
