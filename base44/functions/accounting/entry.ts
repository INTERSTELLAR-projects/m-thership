// Accounting & Tax center backend (admin only, except the scheduled reminder run).
// Read-only toward money: it reads Stripe and QuickBooks, writes Møthership ledger rows, tasks and alerts.
// It never files a return, never moves money and never writes to Stripe or QuickBooks.
//
// actions:
//   sync_stripe   { tax_year }            Stripe balance transactions -> LedgerTransaction (revenue, refunds, fees)
//   qbo_status    {}                      Is the QuickBooks connector authorized? which company (realm)?
//   qbo_sync      { tax_year, realm_id? } QuickBooks accounts, P&L, balance sheet (snapshot) + transactions -> ledger
//   ai_categorize { ids, categories, examples }  InvokeLLM suggestions for uncategorized rows (Justin approves in the UI)
//   run_reminders {}                      Daily (workflow "Accounting reminders"): estimated-tax reminder 14 days before each
//                                         due date + monthly close task, as Task + AccountingAlert. Idempotent by alert key.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { secrets } from "base44:runtime";
import { callClaude } from "../../shared/anthropic.ts";
import { getSecret } from "../../shared/portalClient.ts";
import { estimateAiCost } from "../../shared/usagePlans.ts";

const BUSINESS_ID = "interstellar";
// Justin's decision (2026-11-03): no QuickBooks / bank connections. qbo_* actions stay dormant until this is flipped.
const QBO_ENABLED = false;
const STRIPE_API = "https://api.stripe.com/v1";
const QBO_API = "https://quickbooks.api.intuit.com/v3/company";
const MODEL = "claude_sonnet_4_6";
const TZ = "America/Los_Angeles";

// Keep in sync with src/features/accounting/taxConfig.js DUE_DATES.
const DUE_DATES: Record<number, { q: number; date: string }[]> = {
  2026: [{ q: 1, date: "2026-04-15" }, { q: 2, date: "2026-06-15" }, { q: 3, date: "2026-09-15" }, { q: 4, date: "2027-01-15" }],
  2027: [{ q: 1, date: "2027-04-15" }, { q: 2, date: "2027-06-15" }, { q: 3, date: "2027-09-15" }, { q: 4, date: "2028-01-18" }],
};

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const iso = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10);
const arr = (x: any) => (Array.isArray(x) ? x : (x && x.items) || []);

function todayLA(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return parts; // YYYY-MM-DD
}
const dayDiff = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86400000);
const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const money = (n: number) => `$${(Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

async function listAll(entity: any, query: any, sort = "-date", limit = 5000) {
  return arr(await entity.filter(query, sort, limit).catch(() => []));
}

async function bulkCreate(entity: any, rows: any[]) {
  const out: any[] = [];
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    if (chunk.length) out.push(...arr(await entity.bulkCreate(chunk)));
  }
  return out;
}

async function getProfile(db: any) {
  const rows = arr(await db.BusinessTaxProfile.filter({ business_id: BUSINESS_ID }, "-updated_date", 1).catch(() => []));
  return rows[0] || null;
}

// ---------------- Stripe ----------------
export async function syncStripe(db: any, taxYear: number) {
  let key = "";
  try { key = secrets.get("STRIPE_SECRET_KEY") || ""; } catch { key = ""; }
  if (!key) return { configured: false };
  const headers = { Authorization: `Bearer ${key}` };
  const gte = Math.floor(Date.UTC(taxYear, 0, 1) / 1000);
  const lt = Math.floor(Date.UTC(taxYear + 1, 0, 1) / 1000);
  const txns: any[] = [];
  let after: string | null = null;
  for (let page = 0; page < 60; page++) {
    const params = new URLSearchParams({ limit: "100", "created[gte]": String(gte), "created[lt]": String(lt) });
    params.append("expand[]", "data.source");
    if (after) params.set("starting_after", after);
    const res = await fetch(`${STRIPE_API}/balance_transactions?${params}`, { headers, signal: AbortSignal.timeout(25000) });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error?.message || `Stripe responded ${res.status}`);
    const data = body.data || [];
    txns.push(...data);
    if (!body.has_more || !data.length) break;
    after = data[data.length - 1].id;
  }

  const existing = await listAll(db.LedgerTransaction, { business_id: BUSINESS_ID, source: "stripe", tax_year: taxYear });
  const byRef = new Map(existing.map((e: any) => [e.source_ref, e]));
  const create: any[] = [];
  const fees: Record<string, number> = {};
  let skipped = 0;
  const base = { business_id: BUSINESS_ID, tax_year: taxYear, source: "stripe", account: "Stripe", reconciled: true, review_status: "approved" };

  for (const tx of txns) {
    const type = String(tx.type || "");
    const amount = (tx.amount || 0) / 100;
    const fee = (tx.fee || 0) / 100;
    const month = iso(tx.created).slice(0, 7);
    if (type.startsWith("payout") || type.startsWith("transfer") || type.includes("capital") || type.includes("financ")) { skipped++; continue; }
    if (fee) fees[month] = (fees[month] || 0) + fee;
    const src = tx.source && typeof tx.source === "object" ? tx.source : {};
    const payee = src.billing_details?.name || src.receipt_email || src.customer_details?.name || tx.description || "Stripe customer";
    if (type === "charge" || type === "payment") {
      if (!byRef.has(tx.id)) create.push({ ...base, date: iso(tx.created), amount: r2(amount), direction: "in", payee, description: tx.description || "Stripe payment", category: "revenue", tax_category: "income", form_line: "Sch C L1", source_ref: tx.id, dedupe_key: `stripe:${tx.id}` });
    } else if (type === "refund" || type === "payment_refund") {
      if (!byRef.has(tx.id)) create.push({ ...base, date: iso(tx.created), amount: r2(Math.abs(amount)), direction: "out", payee, description: tx.description || "Stripe refund", category: "refunds", tax_category: "contra", form_line: "Sch C L2", source_ref: tx.id, dedupe_key: `stripe:${tx.id}` });
    } else if (type === "stripe_fee" || type === "tax_fee" || type === "application_fee") {
      if (!byRef.has(tx.id)) create.push({ ...base, date: iso(tx.created), amount: r2(Math.abs(amount)), direction: "out", payee: "Stripe", description: tx.description || "Stripe fee", category: "merchant_fees", tax_category: "deductible", form_line: "Sch C L10", source_ref: tx.id, dedupe_key: `stripe:${tx.id}` });
    } else if (amount !== 0 && !byRef.has(tx.id)) {
      // adjustments, disputes, etc.: land in the review inbox rather than guessing.
      create.push({ ...base, review_status: "needs_review", reconciled: false, date: iso(tx.created), amount: r2(Math.abs(amount)), direction: amount > 0 ? "in" : "out", payee: "Stripe", description: `${type}: ${tx.description || ""}`.trim(), source_ref: tx.id, dedupe_key: `stripe:${tx.id}`, notes: `Stripe balance transaction type "${type}"` });
    }
  }

  // One fee row per month (processing fees are netted from each payment in Stripe).
  let feeUpdates = 0;
  for (const [month, total] of Object.entries(fees)) {
    const ref = `fees:${month}`;
    const row: any = byRef.get(ref);
    const [y, m] = month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    if (row) {
      if (Math.abs((row.amount || 0) - r2(total)) > 0.009) { await db.LedgerTransaction.update(row.id, { amount: r2(total) }); feeUpdates++; }
    } else create.push({ ...base, date: last, amount: r2(total), direction: "out", payee: "Stripe", description: `Stripe processing fees ${month}`, category: "merchant_fees", tax_category: "deductible", form_line: "Sch C L10", source_ref: ref, dedupe_key: `stripe:${ref}` });
  }

  const created = await bulkCreate(db.LedgerTransaction, create);
  const profile = await getProfile(db);
  const stamp = { stripe_synced_at: new Date().toISOString() };
  if (profile) await db.BusinessTaxProfile.update(profile.id, stamp).catch(() => null);
  else await db.BusinessTaxProfile.create({ business_id: BUSINESS_ID, ...stamp }).catch(() => null);
  return { configured: true, fetched: txns.length, created: created.length, fee_months_updated: feeUpdates, skipped_transfers: skipped };
}

// ---------------- QuickBooks ----------------
async function qboConnection(base44: any, profile: any, realmOverride?: string) {
  let conn: any = null;
  try { conn = await base44.asServiceRole.connectors.getConnection("quickbooks"); } catch (e: any) {
    return { connected: false, reason: e?.message || "QuickBooks connector not authorized" };
  }
  if (!conn?.accessToken) return { connected: false, reason: "QuickBooks connector returned no token" };
  const cfg = conn.connectionConfig || {};
  const realm = realmOverride || cfg.realmId || cfg.realm_id || cfg.realmID || cfg.company_id || cfg.companyId || profile?.qbo_realm_id || "";
  return { connected: true, token: conn.accessToken, realm, configKeys: Object.keys(cfg) };
}

async function qboGet(c: any, path: string) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${QBO_API}/${c.realm}/${path}${sep}minorversion=75`, {
    headers: { Authorization: `Bearer ${c.token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(30000),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.Fault?.Error?.[0]?.Detail || body?.Fault?.Error?.[0]?.Message || `QuickBooks responded ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

// Flatten a QBO report into { label, amount } summary lines.
function reportLines(rep: any) {
  const out: { label: string; amount: number; group?: string }[] = [];
  const walk = (rows: any[], group = "") => {
    for (const r of rows || []) {
      if (r.Rows?.Row) walk(r.Rows.Row, r.Header?.ColData?.[0]?.value || group);
      const cols = r.Summary?.ColData || r.ColData;
      if (cols && cols.length >= 2) {
        const amount = Number(cols[cols.length - 1]?.value);
        if (Number.isFinite(amount)) out.push({ label: cols[0]?.value || "", amount, group });
      }
    }
  };
  walk(rep?.Rows?.Row || []);
  return out;
}

const QBO_CATEGORY_HINTS: [RegExp, string][] = [
  [/advertis|marketing/i, "advertising"], [/car|truck|auto|fuel|gas/i, "car_truck"], [/merchant|stripe|processing|commission|fee/i, "merchant_fees"],
  [/contract|subcontract|freelanc/i, "contract_labor"], [/insurance/i, "insurance"], [/interest/i, "interest"], [/legal|professional|accounting/i, "legal_professional"],
  [/office/i, "office"], [/rent|lease/i, "rent_property"], [/repair|maint/i, "repairs"], [/supplies|equipment/i, "supplies"], [/tax|license|permit/i, "taxes_licenses"],
  [/travel/i, "travel"], [/meal/i, "meals"], [/phone|internet|utilit/i, "utilities"], [/payroll|wage|salar/i, "wages"], [/software|subscription|saas/i, "software"],
  [/hosting|domain|web/i, "hosting"], [/bank|service charge/i, "bank_fees"], [/education|training/i, "education"], [/dues|membership/i, "dues"],
  [/sales|income|revenue|service/i, "revenue"], [/draw|owner|equity|distribution/i, "owner_draw"], [/transfer/i, "transfer"],
];
const qboHint = (name: string) => { for (const [re, k] of QBO_CATEGORY_HINTS) if (re.test(name || "")) return k; return null; };

async function qboSync(base44: any, db: any, taxYear: number, realmOverride?: string) {
  const profile = await getProfile(db);
  const c: any = await qboConnection(base44, profile, realmOverride);
  if (!c.connected) return c;
  if (!c.realm) return { connected: true, needs_realm: true, config_keys: c.configKeys, reason: "Connected, but no company (realm) id was returned. Enter it in Settings > Connections." };
  const start = `${taxYear}-01-01`;
  const end = taxYear < new Date().getFullYear() ? `${taxYear}-12-31` : todayLA();

  const [acc, pl, bs, tl] = await Promise.all([
    qboGet(c, `query?query=${encodeURIComponent("select * from Account where Active = true MAXRESULTS 1000")}`),
    qboGet(c, `reports/ProfitAndLoss?start_date=${start}&end_date=${end}&accounting_method=Cash`),
    qboGet(c, `reports/BalanceSheet?start_date=${start}&end_date=${end}&accounting_method=Cash`),
    qboGet(c, `reports/TransactionList?start_date=${start}&end_date=${end}&columns=tx_date,txn_type,doc_num,name,memo,account_name,other_account,subt_nat_amount`),
  ]);

  const accounts = (acc?.QueryResponse?.Account || []).map((a: any) => ({ id: a.Id, name: a.Name, type: a.AccountType, subtype: a.AccountSubType, balance: Number(a.CurrentBalance) || 0 }));
  const cashAccounts = accounts.filter((a: any) => a.type === "Bank");
  const plLines = reportLines(pl);
  const find = (lines: any[], re: RegExp) => { const l = lines.find((x) => re.test(x.label)); return l ? l.amount : null; };
  const bsLines = reportLines(bs);
  const snapshot = {
    at: new Date().toISOString(), realm: c.realm, period: { start, end },
    accounts, cash_total: r2(cashAccounts.reduce((s: number, a: any) => s + a.balance, 0)),
    credit_cards_total: r2(accounts.filter((a: any) => a.type === "Credit Card").reduce((s: number, a: any) => s + a.balance, 0)),
    pl: { income: find(plLines, /^total income/i), expenses: find(plLines, /^total expenses/i), net: find(plLines, /^net income/i), lines: plLines.slice(0, 80) },
    bs: { assets: find(bsLines, /^total assets/i), liabilities: find(bsLines, /^total liabilities$/i), equity: find(bsLines, /^total equity/i) },
  };

  // Transactions
  const cols = (tl?.Columns?.Column || []).map((x: any) => (x.MetaData?.find((m: any) => m.Name === "ColKey")?.Value) || x.ColType || x.ColTitle);
  const idx = (k: string) => cols.indexOf(k);
  const rows: any[] = [];
  const walk = (list: any[]) => { for (const r of list || []) { if (r.Rows?.Row) walk(r.Rows.Row); if (r.ColData && r.type !== "Section") rows.push(r.ColData); } };
  walk(tl?.Rows?.Row || []);
  const OUT_TYPES = /expense|check|bill payment|credit card expense|purchase|cash expense|payroll/i;
  const IN_TYPES = /deposit|sales receipt|payment|credit card credit|refund receipt/i;

  const existing = await listAll(db.LedgerTransaction, { business_id: BUSINESS_ID, tax_year: taxYear });
  const refs = new Set(existing.map((e: any) => e.source_ref));
  const create: any[] = [];
  let duplicates = 0;
  for (const cd of rows) {
    const get = (k: string) => (idx(k) >= 0 ? cd[idx(k)] : null);
    const date = get("tx_date")?.value;
    const type = get("txn_type")?.value || "";
    const txId = get("txn_type")?.id || "";
    const amountRaw = Number(get("subt_nat_amount")?.value);
    if (!date || !Number.isFinite(amountRaw) || amountRaw === 0) continue;
    if (/invoice|estimate|bill$|purchase order|journal/i.test(type) && !/payment/i.test(type)) continue; // not cash movements
    const name = get("name")?.value || "";
    const memo = get("memo")?.value || "";
    const account = get("account_name")?.value || "";
    const other = get("other_account")?.value || "";
    const direction = /transfer/i.test(type) ? (amountRaw < 0 ? "out" : "in") : OUT_TYPES.test(type) ? "out" : IN_TYPES.test(type) ? "in" : amountRaw < 0 ? "out" : "in";
    const amount = r2(Math.abs(amountRaw));
    const ref = `qbo:${type}:${txId || `${date}:${amount}:${name}`}`;
    if (refs.has(ref)) continue;
    // Same money already in the ledger from a bank CSV or the expense schedule? Skip it (counted once).
    const t = new Date(date).getTime();
    const dup = existing.find((e: any) => e.source !== "quickbooks" && e.source !== "stripe" && e.direction === direction && Math.abs((e.amount || 0) - amount) <= Math.max(1, amount * 0.01) && Math.abs(new Date(e.date).getTime() - t) <= 3 * 86400000);
    if (dup) { duplicates++; continue; }
    refs.add(ref);
    const isStripeDeposit = direction === "in" && /stripe/i.test(`${name} ${memo}`);
    const hint = /transfer/i.test(type) ? "transfer" : qboHint(other) || qboHint(account);
    create.push({
      business_id: BUSINESS_ID, tax_year: taxYear, source: "quickbooks", source_ref: ref, dedupe_key: ref, date, amount, direction,
      account, payee: name || memo, description: [type, memo, other && `→ ${other}`].filter(Boolean).join(" · "), reconciled: true,
      ...(isStripeDeposit
        ? { category: "transfer", tax_category: "transfer", review_status: "approved", notes: "Stripe payout: revenue is counted from Stripe" }
        : { review_status: "needs_review", ai_suggestion: hint ? { category: hint, confidence: 0.7, reason: `QuickBooks account: ${other || account}`, at: new Date().toISOString(), by: "quickbooks" } : undefined }),
    });
  }
  const created = await bulkCreate(db.LedgerTransaction, create);
  const patch = { qbo_snapshot: snapshot, qbo_realm_id: c.realm };
  if (profile) await db.BusinessTaxProfile.update(profile.id, patch);
  else await db.BusinessTaxProfile.create({ business_id: BUSINESS_ID, ...patch });
  return { connected: true, realm: c.realm, accounts: accounts.length, transactions_seen: rows.length, created: created.length, duplicates_skipped: duplicates, snapshot };
}

// ---------------- AI categorization ----------------
async function aiCategorize(base44: any, db: any, body: any) {
  const ids: string[] = (body.ids || []).slice(0, 60);
  const cats: any[] = (body.categories || []).filter((c: any) => c && c.key);
  if (!ids.length || !cats.length) return { suggestions: [] };
  const rows = await listAll(db.LedgerTransaction, { id: { $in: ids } }, "-date", 100);
  if (!rows.length) return { suggestions: [] };
  const keys = new Set(cats.map((c) => c.key));
  const examples = (body.examples || []).slice(0, 40);
  const prompt = `You are a bookkeeper for Interstellar Strategies LLC, a one-person US digital agency in Molalla, Oregon (web design/development, SEO, automation, custom software; revenue arrives through Stripe).
Categorize each bank/card transaction into exactly one category key from this list:
${cats.map((c) => `- ${c.key}: ${c.label}${c.dir && c.dir !== "any" ? ` (money ${c.dir})` : ""}`).join("\n")}

Rules:
- Stripe deposits into the bank are "transfer" (revenue is already counted from Stripe).
- Payments to the IRS are est_tax_federal; to the Oregon Department of Revenue are est_tax_oregon.
- Software/SaaS for running the agency is "software"; AI subscriptions are "ai_tools"; hosting/domains are "hosting".
- Groceries, streaming, personal shopping, restaurants with no business purpose noted -> "personal".
- If unsure, pick the most likely key and give a low confidence. Never invent new keys.
${examples.length ? `\nJustin's past decisions (payee -> category):\n${examples.map((e: any) => `- ${e.payee} (${e.direction}) -> ${e.category}`).join("\n")}` : ""}

Transactions:
${rows.map((r: any) => `- id=${r.id} | ${r.date} | ${r.direction === "in" ? "+" : "-"}$${r.amount} | payee: ${r.payee || ""} | desc: ${r.description || ""} | account: ${r.account || ""}`).join("\n")}`;

  const schema = {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: { id: { type: "string" }, category: { type: "string" }, confidence: { type: "number" }, reason: { type: "string" } },
          required: ["id", "category", "confidence", "reason"],
        },
      },
    },
    required: ["results"],
  };
  // Classification against a fixed category list: routed to Claude Haiku on our own Anthropic key (was Sonnet via
  // Base44 InvokeLLM, which also spent Base44 integration credits). Falls back to InvokeLLM if the key is missing or
  // the call fails, so categorizing never breaks. Justin still approves every suggestion.
  let res: any = null;
  const akey = getSecret("ANTHROPIC_API_KEY");
  if (akey) {
    try {
      const r = await callClaude({ key: akey, tier: "routine", prompt, schema, max_tokens: 4096 });
      res = r.json;
      await db.UsageLedger.create({ client_id: "agency", client_name: "Interstellar (admin)", month: new Date().toISOString().slice(0, 7), kind: "ai_action", units: 1, calls: 1, model: r.model, est_cost_usd: estimateAiCost(r.model, r.input_tokens, r.output_tokens), feature: "accounting.ai_categorize", by_admin: true, input_tokens: r.input_tokens, output_tokens: r.output_tokens, created_at: new Date().toISOString() }).catch(() => null);
    } catch (e) { console.error("accounting haiku", (e as Error)?.message); res = null; }
  }
  if (!res) res = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, model: MODEL, response_json_schema: schema });
  const out = typeof res === "string" ? JSON.parse(res) : res;
  const at = new Date().toISOString();
  const valid = (out?.results || []).filter((x: any) => ids.includes(x.id) && keys.has(x.category));
  await Promise.all(valid.map((x: any) => db.LedgerTransaction.update(x.id, {
    ai_suggestion: { category: x.category, confidence: Math.max(0, Math.min(1, Number(x.confidence) || 0)), reason: String(x.reason || "").slice(0, 240), at, by: "ai" },
  }).catch(() => null)));
  return { suggestions: valid };
}

// ---------------- Reminders ----------------
async function runReminders(db: any) {
  const today = todayLA();
  const profile = await getProfile(db);
  const proj = profile?.last_projection || null;
  const alerts = await listAll(db.AccountingAlert, { business_id: BUSINESS_ID }, "-created_date", 500);
  const have = new Set(alerts.map((a: any) => a.key));
  const made: string[] = [];

  // 1) Estimated tax: 14 days before each due date (and up to the day itself if a run was missed).
  for (const [yearStr, list] of Object.entries(DUE_DATES)) {
    for (const d of list) {
      const days = dayDiff(today, d.date);
      if (days < 0 || days > 14) continue;
      const key = `est-${yearStr}-Q${d.q}`;
      if (have.has(key)) continue;
      const fed = proj && Number(proj.tax_year) === Number(yearStr) ? proj.federal?.find((x: any) => x.q === d.q) : null;
      const ore = proj && Number(proj.tax_year) === Number(yearStr) ? proj.oregon?.find((x: any) => x.q === d.q) : null;
      const amounts = fed || ore
        ? `Planned (safe-harbor track): IRS ${money(fed?.safe || 0)} · Oregon ${money(ore?.safe || 0)}. Projection from ${String(proj.at || "").slice(0, 10)}; open Financial > Accounting & Taxes > Tax plan to refresh before paying.`
        : "Open Financial > Accounting & Taxes > Tax plan for the amounts (no saved projection yet).";
      const title = `Pay Q${d.q} ${yearStr} estimated taxes (IRS 1040-ES + Oregon OR-40-V), due ${fmtDate(d.date)}`;
      const notes = `${amounts}\n\nPay yourself (Møthership never moves money):\n- IRS Direct Pay: https://www.irs.gov/payments/direct-pay (reason: Estimated Tax, form 1040-ES, tax year ${yearStr})\n- Oregon Revenue Online: https://revenueonline.dor.oregon.gov/ (estimated payment, tax year ${yearStr})\nThen record both payments in Accounting > Tax plan.\n\nEstimates — verify with a tax professional before filing.`;
      const task = await db.Task.create({ title, category: "finance", priority: 1, status: "next", source: "automation", task_type: "internal", due_date: today, notes }).catch(() => null);
      await db.AccountingAlert.create({ business_id: BUSINESS_ID, key, kind: "estimated_tax", title, body: amounts, due_date: d.date, link: "/financial?tab=accounting&sub=plan", task_id: task?.id, status: "new" });
      made.push(key);
    }
  }

  // 2) Monthly close for the previous month (created on the 1st; catches up through the 7th).
  const [y, m, dd] = today.split("-").map(Number);
  if (dd <= 7) {
    const prev = new Date(Date.UTC(y, m - 2, 1));
    const pk = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
    const key = `close-${pk}`;
    if (!have.has(key)) {
      const label = prev.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
      const due = `${y}-${String(m).padStart(2, "0")}-05`;
      const title = `Monthly books close: ${label}`;
      const notes = `Accounting > Transactions:\n1. Sync Stripe, then download last month's statement CSV from each bank/card website and upload it (Import bank CSV).\n2. Clear the review inbox (bulk-approve AI suggestions).\n3. Attach receipts for anything over $75.\n4. Log business miles.\n5. Update the tax reserve balance.\n6. Check the Tax plan set-aside %.`;
      const task = await db.Task.create({ title, category: "finance", priority: 2, status: "next", source: "automation", task_type: "internal", due_date: today > due ? today : due, notes }).catch(() => null);
      await db.AccountingAlert.create({ business_id: BUSINESS_ID, key, kind: "monthly_close", title, body: `Close ${label}: categorize, reconcile, receipts, mileage, reserve.`, due_date: due, link: "/financial?tab=accounting&sub=transactions", task_id: task?.id, status: "new" });
      made.push(key);
    }
  }
  return { today, created: made };
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const body: any = await req.json().catch(() => ({}));
    const action = body.action || "run_reminders";
    if (!user && action !== "run_reminders") return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user && user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    const db = base44.asServiceRole.entities;
    const taxYear = Number(body.tax_year) || new Date().getFullYear();

    if (action === "sync_stripe") return Response.json(await syncStripe(db, taxYear));
    if (!QBO_ENABLED && (action === "qbo_status" || action === "qbo_sync")) return Response.json({ connected: false, disabled: true, reason: "QuickBooks is disabled: bank data comes only from CSV uploads." });
    if (action === "qbo_status") {
      const profile = await getProfile(db);
      const c: any = await qboConnection(base44, profile, body.realm_id);
      return Response.json({ connected: c.connected, realm: c.realm || null, reason: c.reason || null, config_keys: c.configKeys || [] });
    }
    if (action === "qbo_sync") return Response.json(await qboSync(base44, db, taxYear, body.realm_id));
    if (action === "ai_categorize") return Response.json(await aiCategorize(base44, db, body));
    if (action === "run_reminders") return Response.json(await runReminders(db));
    return Response.json({ error: `Unknown action ${action}` }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
