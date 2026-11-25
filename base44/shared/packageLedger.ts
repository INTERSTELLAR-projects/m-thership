/*
 * The 40-Day Business Rebuild ledger (Nov 25 2026). Mirror of src/features/financing/schedule.js (keep in sync).
 * A package is a ClientFinancing row with kind "package". Clients are billed monthly on their HyperCare+ subscription in
 * Stripe; every paid subscription invoice is applied to the package balance here, once (idempotent by invoice id).
 *   - The start payment ($2,000, or $1,500 referred) is separate from the balance: a paid one-time invoice for that
 *     amount before launch marks start_paid_date instead.
 *   - The subscription is linked on its first paid invoice that matches the plan's current monthly; after that only
 *     that subscription's invoices count, so add-on subscriptions on the same customer never touch the balance.
 *   - When the balance reaches $0 the row is marked paid_off and ONE task is created for Justin to move the Stripe
 *     subscription to HyperCare+ at $750/mo. Nothing here changes a price in Stripe.
 */
export const PACKAGE_PLANS: Record<string, { monthly: number; months: number; total: number; label: string }> = {
  p24: { label: "24-month plan", monthly: 750, months: 24, total: 18000 },
  p12: { label: "12-month plan", monthly: 1250, months: 12, total: 15000 },
};
export const PACKAGE_START = 2000;
export const PACKAGE_REFERRAL_OFF = 500;
export const PACKAGE_CARE = 750;

const r2 = (n: number) => Math.round(n * 100) / 100;

export function packageAmounts(plan: any): number[] {
  const n = Math.max(0, Math.floor(Number(plan.num_payments) || 0));
  const base = Number(plan.payment_amount) || 0;
  const ups = [...(plan.upgrades || [])].filter((u: any) => Number(u.amount) > 0).sort((a: any, b: any) => (a.from_installment || 0) - (b.from_installment || 0));
  let remaining = Number(plan.total_price) || base * n;
  let current = base;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const here = ups.filter((u: any) => (Number(u.from_installment) || 0) === i);
    if (here.length) {
      remaining += here.reduce((s: number, u: any) => s + Number(u.amount), 0);
      current = r2(remaining / (n - i));
    }
    const amt = i === n - 1 ? r2(remaining) : current;
    out.push(amt);
    remaining = r2(remaining - amt);
  }
  const late = ups.filter((u: any) => (Number(u.from_installment) || 0) >= n).reduce((s: number, u: any) => s + Number(u.amount), 0);
  if (late && out.length) out[out.length - 1] = r2(out[out.length - 1] + late);
  return out;
}

export function packageState(plan: any) {
  const amounts = packageAmounts(plan);
  const total = r2(amounts.reduce((s, x) => s + x, 0));
  const paid = r2((plan.payments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0));
  let covered = 0;
  let pool = paid + 0.005;
  while (covered < amounts.length && pool >= amounts[covered]) { pool -= amounts[covered]; covered++; }
  return { total, paid, balance: Math.max(0, r2(total - paid)), current: amounts[Math.min(covered, amounts.length - 1)] || 0, monthsLeft: amounts.length - covered };
}

const near = (a: number, b: number) => Math.abs(a - b) < 1;
const isoDate = (unix?: number) => new Date((unix || Date.now() / 1000) * 1000).toISOString().slice(0, 10);

async function clientsForCustomer(db: any, customer: string) {
  if (!customer) return [];
  const a = await db.CRMClient.filter({ stripe_customer_id: customer }).catch(() => []);
  const b = await db.CRMClient.filter({ stripe_customer_ids: customer }).catch(() => []);
  const seen = new Map<string, any>();
  for (const c of [...(a || []), ...(b || [])]) seen.set(c.id, c);
  return [...seen.values()];
}

// Apply one paid Stripe invoice to the client's package. Safe to call on every invoice.paid (retries included).
export async function recordPackageInvoice(db: any, inv: any) {
  if (!inv || inv.status !== "paid") return { applied: false, reason: "not paid" };
  const amount = r2((Number(inv.amount_paid) || 0) / 100);
  if (amount <= 0) return { applied: false, reason: "zero" };
  const clients = await clientsForCustomer(db, String(inv.customer || ""));
  if (!clients.length) return { applied: false, reason: "no client for customer" };

  for (const client of clients) {
    const rows = (await db.ClientFinancing.filter({ client_id: client.id, kind: "package" }).catch(() => [])) || [];
    const plan = rows.find((p: any) => !["paid_off", "cancelled"].includes(p.status));
    if (!plan) continue;
    if ((plan.payments || []).some((p: any) => p.stripe_invoice_id === inv.id)) return { applied: false, reason: "already recorded", plan: plan.id };

    const subId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id || inv.parent?.subscription_details?.subscription || "";
    const isSub = !!subId || /^subscription/.test(String(inv.billing_reason || ""));

    // Start payment: a one-time invoice for the start amount, before it's been recorded.
    if (!isSub) {
      const start = Number(plan.start_payment) || (plan.referred ? PACKAGE_START - PACKAGE_REFERRAL_OFF : PACKAGE_START);
      if (!plan.start_paid_date && near(amount, start)) {
        await db.ClientFinancing.update(plan.id, { start_paid_date: isoDate(inv.status_transitions?.paid_at) });
        return { applied: true, kind: "start", plan: plan.id };
      }
      continue; // other one-time invoices (upgrades paid up front, refuels) don't touch the balance
    }

    const st = packageState(plan);
    if (plan.stripe_subscription_id && subId && plan.stripe_subscription_id !== subId) continue; // an add-on subscription
    const patch: any = {};
    if (!plan.stripe_subscription_id) {
      if (!subId || !near(amount, st.current)) continue; // only link the subscription that bills the package amount
      patch.stripe_subscription_id = subId;
    }
    const payments = [...(plan.payments || []), { date: isoDate(inv.status_transitions?.paid_at), amount, method: "Stripe", note: `Invoice ${inv.number || inv.id}`, stripe_invoice_id: inv.id }];
    patch.payments = payments;
    const after = packageState({ ...plan, payments });
    if (after.balance <= 0.004) {
      patch.status = "paid_off";
      if (!plan.payoff_task_id) {
        const task = await db.Task.create({
          title: `${plan.client_name}: package paid off. Switch Stripe to HyperCare+ $${plan.after_payoff_monthly || PACKAGE_CARE}/mo`,
          notes: `The 40-Day Business Rebuild balance is paid in full (last invoice ${inv.number || inv.id}). The client now owns the code. Change their Stripe subscription to HyperCare+ at $${plan.after_payoff_monthly || PACKAGE_CARE}/mo before the next billing date, and send the ownership handover note.`,
          client_id: plan.client_id || "",
          client_name: plan.client_name || "",
          category: "finance",
          priority: 1,
          status: "next",
          source: "automation",
        }).catch(() => null);
        if (task?.id) patch.payoff_task_id = task.id;
      }
    }
    await db.ClientFinancing.update(plan.id, patch);
    return { applied: true, kind: "monthly", plan: plan.id, balance: after.balance, paid_off: after.balance <= 0.004 };
  }
  return { applied: false, reason: "no matching package" };
}
