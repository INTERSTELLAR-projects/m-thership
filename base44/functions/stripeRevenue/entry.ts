import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

const STRIPE_API = "https://api.stripe.com/v1";
const MONTHS_BACK = 12;
const MAX_PAGES = 40;

const INCOME_TYPES = new Set(["charge", "payment"]);

const isRefund = (t) => t === "refund" || t === "payment_refund" || t === "refund_failure";
const isCapital = (t) =>
  t.includes("capital") || t.includes("financ") || t.startsWith("advance") || t.includes("loan") || t.includes("obligation");
const isMoneyMovement = (t) => t.startsWith("payout") || t.startsWith("transfer") || t === "connect_collection_transfer";

const round = (n) => Math.round(n * 100) / 100;

function monthKey(unixSeconds) {
  const d = new Date(unixSeconds * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    let key = "";
    try {
      key = secrets.get("STRIPE_SECRET_KEY") || "";
    } catch {
      key = "";
    }
    if (!key) return Response.json({ configured: false });

    const headers = { Authorization: `Bearer ${key}` };
    const since = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 365;

    // ---- Balance transactions: every movement of money in and out of Stripe ----
    const txns = [];
    let startingAfter = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({ limit: "100", "created[gte]": String(since) });
      if (startingAfter) params.set("starting_after", startingAfter);
      const res = await fetch(`${STRIPE_API}/balance_transactions?${params.toString()}`, {
        headers,
        signal: AbortSignal.timeout(20000),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return Response.json(
          { configured: true, error: body?.error?.message || `Stripe responded ${res.status}` },
          { status: 502 }
        );
      }
      const data = body.data || [];
      txns.push(...data);
      if (!body.has_more || data.length === 0) break;
      startingAfter = data[data.length - 1].id;
    }

    // ---- Buckets ----
    const currencyCounts = {};
    const months = [];
    for (let i = MONTHS_BACK - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - i, 1));
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      months.push({ key: k, collected: 0, refunds: 0, fees: 0, capital: 0, net: 0, payments: 0 });
    }
    const byMonth = new Map(months.map((m) => [m.key, m]));
    const byTypeMap = new Map();
    const activity = [];

    for (const tx of txns) {
      const type = tx.type || "unknown";
      const amount = (tx.amount || 0) / 100;
      const fee = (tx.fee || 0) / 100;
      const net = (tx.net || 0) / 100;
      currencyCounts[tx.currency || "usd"] = (currencyCounts[tx.currency || "usd"] || 0) + 1;

      const bucket = byMonth.get(monthKey(tx.created));
      if (bucket) {
        if (INCOME_TYPES.has(type)) {
          bucket.collected += amount;
          bucket.payments += 1;
        } else if (isRefund(type)) {
          bucket.refunds += -amount;
        } else if (isCapital(type)) {
          bucket.capital += -amount;
        }
        if (!isMoneyMovement(type)) bucket.fees += -fee;
        bucket.net += net;
      }

      const entry = byTypeMap.get(type) || { type, count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += amount;
      byTypeMap.set(type, entry);

      if (!isMoneyMovement(type)) {
        activity.push({
          id: tx.id,
          created: tx.created,
          type,
          description: tx.description || "",
          gross: amount,
          fee: -fee,
          net,
        });
      }
    }

    const currency = Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "usd";
    const cleanMonths = months.map((m) => ({
      key: m.key,
      collected: round(m.collected),
      refunds: round(m.refunds),
      fees: round(m.fees),
      capital: round(m.capital),
      net: round(m.net),
      payments: m.payments,
    }));

    const currentKey = monthKey(Math.floor(Date.now() / 1000));
    const current =
      cleanMonths.find((m) => m.key === currentKey) ||
      { key: currentKey, collected: 0, refunds: 0, fees: 0, capital: 0, net: 0, payments: 0 };

    const totals = cleanMonths.reduce(
      (acc, m) => ({
        collected: acc.collected + m.collected,
        refunds: acc.refunds + m.refunds,
        fees: acc.fees + m.fees,
        capital: acc.capital + m.capital,
        net: acc.net + m.net,
        payments: acc.payments + m.payments,
      }),
      { collected: 0, refunds: 0, fees: 0, capital: 0, net: 0, payments: 0 }
    );

    const byType = [...byTypeMap.values()]
      .map((t) => ({ ...t, amount: round(t.amount) }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 10);

    activity.sort((a, b) => b.created - a.created);

    return Response.json({
      configured: true,
      currency,
      generated_at: new Date().toISOString(),
      months: cleanMonths,
      current,
      totals: {
        collected: round(totals.collected),
        refunds: round(totals.refunds),
        fees: round(totals.fees),
        capital: round(totals.capital),
        net: round(totals.net),
        payments: totals.payments,
      },
      byType,
      recent: activity.slice(0, 12),
      transaction_count: txns.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}