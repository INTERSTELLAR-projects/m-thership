import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
const TOKEN = "77041168e7bcd89d8cac0704e64e89ae02e2a57628d4c80d";
const arr = (x: any) => (Array.isArray(x) ? x : (x && x.items) || []);
const r2 = (n: number) => Math.round(n * 100) / 100;
const iso = (u: number) => new Date(u * 1000).toISOString().slice(0, 10);
async function stripeAll(key: string, path: string, params: Record<string, string>) {
  const out: any[] = []; let after: string | null = null;
  for (let i = 0; i < 60; i++) {
    const p = new URLSearchParams({ limit: "100", ...params }); if (after) p.set("starting_after", after);
    const r = await fetch(`https://api.stripe.com/v1/${path}?${p}`, { headers: { Authorization: `Bearer ${key}` } });
    const j: any = await r.json(); if (!r.ok) throw new Error(j?.error?.message || `Stripe ${r.status}`);
    out.push(...(j.data || [])); if (!j.has_more || !(j.data || []).length) break; after = j.data[j.data.length - 1].id;
  }
  return out;
}
Deno.serve(async (req) => {
  try {
    const body: any = await req.json().catch(() => ({}));
    if (body.token !== TOKEN) return Response.json({ error: "Forbidden" }, { status: 403 });
    const db = createClientFromRequest(req).asServiceRole.entities;
    if (body.action === "stripe") {
      const key = Deno.env.get("STRIPE_SECRET_KEY") || "";
      if (!key) return Response.json({ configured: false });
      const gte = String(Math.floor(Date.UTC(2026, 0, 1) / 1000)), lt = String(Math.floor(Date.UTC(2027, 0, 1) / 1000));
      const txns = await stripeAll(key, "balance_transactions", { "created[gte]": gte, "created[lt]": lt, "expand[]": "data.source" });
      const payouts = (await stripeAll(key, "payouts", { "created[gte]": String(Math.floor(Date.UTC(2025, 11, 20) / 1000)) }))
        .map((x: any) => ({ id: x.id, amount: x.amount / 100, arrival: iso(x.arrival_date), created: iso(x.created), method: x.method, status: x.status, dest: x.destination && typeof x.destination === "string" ? x.destination.slice(0, 5) : x.type }));
      const existing = arr(await db.LedgerTransaction.filter({ business_id: "interstellar", source: "stripe", tax_year: 2026 }, "date", 5000));
      const refs = new Set(existing.map((e: any) => e.source_ref));
      const base = { business_id: "interstellar", tax_year: 2026, source: "stripe", account: "Stripe", reconciled: true, review_status: "approved" };
      const create: any[] = []; const fees: Record<string, number> = {}; const types: Record<string, { n: number; amt: number }> = {};
      for (const tx of txns) {
        const type = String(tx.type || ""); const amount = (tx.amount || 0) / 100; const fee = (tx.fee || 0) / 100; const month = iso(tx.created).slice(0, 7);
        types[type] = types[type] || { n: 0, amt: 0 }; types[type].n++; types[type].amt = r2(types[type].amt + amount);
        if (type.startsWith("payout") || type.startsWith("transfer") || type.includes("capital") || type.includes("financ") || type.includes("advance")) continue;
        if (fee) fees[month] = (fees[month] || 0) + fee;
        const src = tx.source && typeof tx.source === "object" ? tx.source : {};
        const payee = src.billing_details?.name || src.receipt_email || tx.description || "Stripe customer";
        if (refs.has(tx.id)) continue;
        if (type === "charge" || type === "payment") create.push({ ...base, date: iso(tx.created), amount: r2(amount), direction: "in", payee, description: tx.description || "Stripe payment", category: "revenue", tax_category: "income", form_line: "Sch C L1", source_ref: tx.id, dedupe_key: `stripe:${tx.id}` });
        else if (type === "refund" || type === "payment_refund") create.push({ ...base, date: iso(tx.created), amount: r2(Math.abs(amount)), direction: "out", payee, description: tx.description || "Stripe refund", category: "refunds", tax_category: "contra", form_line: "Sch C L2", source_ref: tx.id, dedupe_key: `stripe:${tx.id}` });
        else if (type === "stripe_fee" || type === "tax_fee" || type === "application_fee") create.push({ ...base, date: iso(tx.created), amount: r2(Math.abs(amount)), direction: "out", payee: "Stripe", description: tx.description || "Stripe fee", category: "merchant_fees", tax_category: "deductible", form_line: "Sch C L10", source_ref: tx.id, dedupe_key: `stripe:${tx.id}` });
        else if (amount !== 0) create.push({ ...base, review_status: "needs_review", reconciled: false, date: iso(tx.created), amount: r2(Math.abs(amount)), direction: amount > 0 ? "in" : "out", payee: "Stripe", description: `${type}: ${tx.description || ""}`.trim(), source_ref: tx.id, dedupe_key: `stripe:${tx.id}`, notes: `Stripe balance transaction type "${type}"` });
      }
      for (const [month, total] of Object.entries(fees)) {
        const ref = `fees:${month}`; if (refs.has(ref)) continue;
        const [y, m] = month.split("-").map(Number);
        create.push({ ...base, date: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10), amount: r2(total), direction: "out", payee: "Stripe", description: `Stripe processing fees ${month}`, category: "merchant_fees", tax_category: "deductible", form_line: "Sch C L10", source_ref: ref, dedupe_key: `stripe:${ref}` });
      }
      let created = 0; for (let i = 0; i < create.length; i += 100) created += arr(await db.LedgerTransaction.bulkCreate(create.slice(i, i + 100))).length;
      const prof = arr(await db.BusinessTaxProfile.filter({ business_id: "interstellar" }, "-updated_date", 1))[0];
      if (prof) await db.BusinessTaxProfile.update(prof.id, { stripe_synced_at: new Date().toISOString() });
      const rows = arr(await db.LedgerTransaction.filter({ business_id: "interstellar", source: "stripe", tax_year: 2026 }, "date", 5000));
      return Response.json({ configured: true, fetched: txns.length, created, types, payouts, stripe_rows: rows.map((r: any) => ({ d: r.date, a: r.amount, dir: r.direction, c: r.category, p: r.payee, rs: r.review_status, n: r.description })) });
    }
    if (body.action === "insert") {
      const existing = arr(await db.LedgerTransaction.filter({ business_id: "interstellar", source: "csv" }, "-date", 20000));
      const keys = new Set(existing.map((e: any) => e.dedupe_key));
      const fresh = (body.rows || []).filter((r: any) => !keys.has(r.dedupe_key));
      let created = 0; for (let i = 0; i < fresh.length; i += 100) created += arr(await db.LedgerTransaction.bulkCreate(fresh.slice(i, i + 100))).length;
      return Response.json({ received: (body.rows || []).length, created, skipped: (body.rows || []).length - fresh.length });
    }
    if (body.action === "count") {
      const rows = arr(await db.LedgerTransaction.filter({ business_id: "interstellar" }, "-date", 20000));
      const by: Record<string, number> = {}; rows.forEach((r: any) => { by[r.source] = (by[r.source] || 0) + 1; });
      return Response.json({ total: rows.length, by });
    }
    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch (e: any) { return Response.json({ error: e?.message || String(e) }, { status: 500 }); }
});
