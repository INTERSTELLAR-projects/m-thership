// TEMPORARY one-time importer for Justin's 2026 Mercury statement rows + Stripe reconciliation.
// Guarded by a random token; deleted right after use.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { secrets } from "base44:runtime";
import { syncStripe } from "../accounting/entry.ts";

const TOKEN = "77041168e7bcd89d8cac0704e64e89ae02e2a57628d4c80d";
const arr = (x: any) => (Array.isArray(x) ? x : (x && x.items) || []);

export default async function (req: Request) {
  try {
    const body: any = await req.json().catch(() => ({}));
    if (body.token !== TOKEN) return Response.json({ error: "Forbidden" }, { status: 403 });
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    if (body.action === "stripe") {
      const sync = await syncStripe(db, 2026);
      let key = ""; try { key = secrets.get("STRIPE_SECRET_KEY") || ""; } catch { key = ""; }
      const payouts: any[] = [];
      let after: string | null = null;
      for (let i = 0; i < 20 && key; i++) {
        const p = new URLSearchParams({ limit: "100", "created[gte]": String(Math.floor(Date.UTC(2025, 11, 20) / 1000)) });
        if (after) p.set("starting_after", after);
        const r = await fetch(`https://api.stripe.com/v1/payouts?${p}`, { headers: { Authorization: `Bearer ${key}` } });
        const j: any = await r.json();
        if (!r.ok) return Response.json({ sync, payout_error: j?.error?.message });
        payouts.push(...(j.data || []).map((x: any) => ({ id: x.id, amount: x.amount / 100, arrival: new Date(x.arrival_date * 1000).toISOString().slice(0, 10), created: new Date(x.created * 1000).toISOString().slice(0, 10), method: x.method, type: x.type, status: x.status })));
        if (!j.has_more || !j.data.length) break;
        after = j.data[j.data.length - 1].id;
      }
      // other balance types (capital/loans) for 2026
      const bt: Record<string, { n: number; amt: number }> = {};
      after = null;
      for (let i = 0; i < 40 && key; i++) {
        const p = new URLSearchParams({ limit: "100", "created[gte]": String(Math.floor(Date.UTC(2026, 0, 1) / 1000)) });
        if (after) p.set("starting_after", after);
        const r = await fetch(`https://api.stripe.com/v1/balance_transactions?${p}`, { headers: { Authorization: `Bearer ${key}` } });
        const j: any = await r.json();
        if (!r.ok) break;
        for (const t of j.data || []) { const k = t.type; bt[k] = bt[k] || { n: 0, amt: 0 }; bt[k].n++; bt[k].amt += (t.amount || 0) / 100; }
        if (!j.has_more || !j.data.length) break;
        after = j.data[j.data.length - 1].id;
      }
      const rows = arr(await db.LedgerTransaction.filter({ business_id: "interstellar", source: "stripe", tax_year: 2026 }, "date", 5000));
      return Response.json({ sync, payouts, balance_types: bt, stripe_rows: rows.map((r: any) => ({ d: r.date, a: r.amount, dir: r.direction, c: r.category, p: r.payee })) });
    }
    if (body.action === "insert") {
      const existing = arr(await db.LedgerTransaction.filter({ business_id: "interstellar", source: "csv" }, "-date", 20000));
      const keys = new Set(existing.map((e: any) => e.dedupe_key));
      const fresh = (body.rows || []).filter((r: any) => !keys.has(r.dedupe_key));
      let created = 0;
      for (let i = 0; i < fresh.length; i += 100) created += arr(await db.LedgerTransaction.bulkCreate(fresh.slice(i, i + 100))).length;
      return Response.json({ received: (body.rows || []).length, created, skipped: (body.rows || []).length - fresh.length });
    }
    if (body.action === "count") {
      const rows = arr(await db.LedgerTransaction.filter({ business_id: "interstellar" }, "-date", 20000));
      const by: Record<string, number> = {};
      rows.forEach((r: any) => { by[r.source] = (by[r.source] || 0) + 1; });
      return Response.json({ total: rows.length, by });
    }
    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
