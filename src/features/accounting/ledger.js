// Ledger vocabulary: categories, form-line mapping per entity type, the rules engine,
// bank CSV parsing and dedupe. Pure functions only (no SDK calls).

export const BUSINESS_ID = "interstellar";

// tax: income | contra | deductible | partial | non_deductible | transfer | equity | tax_payment | personal | adjustment
// lines: form line per entity type. Line numbers follow the 2025 forms; the IRS can renumber lines on the 2026 forms.
export const CATEGORIES = [
  { key: "revenue", label: "Client revenue", dir: "in", tax: "income", lines: { schedule_c: "Sch C L1", f1065: "1065 L1a", f1120s: "1120-S L1a", f1120: "1120 L1a" } },
  { key: "refunds", label: "Refunds to clients", dir: "out", tax: "contra", lines: { schedule_c: "Sch C L2", f1065: "1065 L1b", f1120s: "1120-S L1b", f1120: "1120 L1b" } },
  { key: "other_income", label: "Other business income", dir: "in", tax: "income", lines: { schedule_c: "Sch C L6", f1065: "1065 L7", f1120s: "1120-S L5", f1120: "1120 L10" } },
  { key: "advertising", label: "Advertising & marketing", dir: "out", tax: "deductible", lines: { schedule_c: "Sch C L8", f1065: "1065 L21", f1120s: "1120-S L16", f1120: "1120 L22" } },
  { key: "car_truck", label: "Car & truck (actual costs)", dir: "out", tax: "deductible", lines: { schedule_c: "Sch C L9", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  { key: "merchant_fees", label: "Payment processing fees (Stripe)", dir: "out", tax: "deductible", lines: { schedule_c: "Sch C L10", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  { key: "contract_labor", label: "Contractors (1099 labor)", dir: "out", tax: "deductible", lines: { schedule_c: "Sch C L11", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  { key: "insurance", label: "Business insurance (not health)", dir: "out", tax: "deductible", lines: { schedule_c: "Sch C L15", f1065: "1065 L20", f1120s: "1120-S L19", f1120: "1120 L26" } },
  { key: "interest", label: "Business interest", dir: "out", tax: "deductible", lines: { schedule_c: "Sch C L16b", f1065: "1065 L15", f1120s: "1120-S L13", f1120: "1120 L18" } },
  { key: "legal_professional", label: "Legal & professional (CPA, attorney)", dir: "out", tax: "deductible", lines: { schedule_c: "Sch C L17", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  { key: "office", label: "Office expense", dir: "out", tax: "deductible", lines: { schedule_c: "Sch C L18", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  { key: "rent_equipment", label: "Rent: equipment", dir: "out", tax: "deductible", lines: { schedule_c: "Sch C L20a", f1065: "1065 L13", f1120s: "1120-S L11", f1120: "1120 L16" } },
  { key: "rent_property", label: "Rent: office / coworking", dir: "out", tax: "deductible", lines: { schedule_c: "Sch C L20b", f1065: "1065 L13", f1120s: "1120-S L11", f1120: "1120 L16" } },
  { key: "repairs", label: "Repairs & maintenance", dir: "out", tax: "deductible", lines: { schedule_c: "Sch C L21", f1065: "1065 L11", f1120s: "1120-S L9", f1120: "1120 L14" } },
  { key: "supplies", label: "Supplies & small equipment", dir: "out", tax: "deductible", lines: { schedule_c: "Sch C L22", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  { key: "taxes_licenses", label: "Business taxes & licenses (annual report, permits)", dir: "out", tax: "deductible", lines: { schedule_c: "Sch C L23", f1065: "1065 L14", f1120s: "1120-S L12", f1120: "1120 L17" } },
  { key: "travel", label: "Travel (lodging, airfare)", dir: "out", tax: "deductible", lines: { schedule_c: "Sch C L24a", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  { key: "meals", label: "Business meals (50%)", dir: "out", tax: "partial", share: 0.5, lines: { schedule_c: "Sch C L24b", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  { key: "utilities", label: "Phone & internet (business share)", dir: "out", tax: "deductible", lines: { schedule_c: "Sch C L25", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  { key: "wages", label: "Employee wages", dir: "out", tax: "deductible", lines: { schedule_c: "Sch C L26", f1065: "1065 L9", f1120s: "1120-S L8", f1120: "1120 L13" } },
  { key: "software", label: "Software & SaaS subscriptions", dir: "out", tax: "deductible", other: true, lines: { schedule_c: "Sch C L27a (Part V)", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  { key: "hosting", label: "Hosting & domains", dir: "out", tax: "deductible", other: true, lines: { schedule_c: "Sch C L27a (Part V)", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  { key: "ai_tools", label: "AI tools", dir: "out", tax: "deductible", other: true, lines: { schedule_c: "Sch C L27a (Part V)", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  { key: "bank_fees", label: "Bank fees", dir: "out", tax: "deductible", other: true, lines: { schedule_c: "Sch C L27a (Part V)", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  { key: "education", label: "Education & training", dir: "out", tax: "deductible", other: true, lines: { schedule_c: "Sch C L27a (Part V)", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  { key: "dues", label: "Dues & memberships", dir: "out", tax: "deductible", other: true, lines: { schedule_c: "Sch C L27a (Part V)", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  { key: "other_expense", label: "Other business expense", dir: "out", tax: "deductible", other: true, lines: { schedule_c: "Sch C L27a (Part V)", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  { key: "equipment", label: "Equipment / asset purchase (depreciation list)", dir: "out", tax: "non_deductible", lines: { schedule_c: "Sch C L13 via Form 4562", f1065: "1065 L16a", f1120s: "1120-S L14", f1120: "1120 L20" }, note: "Add it to the depreciation list; the deduction is taken there, not as a plain expense." },
  // Not on the P&L
  { key: "se_health_insurance", label: "Health insurance (self-employed)", dir: "out", tax: "adjustment", lines: { schedule_c: "Schedule 1 L17", f1065: "1065 L19 / guaranteed payment", f1120s: "W-2 box 1 (2%+ owner)", f1120: "1120 L24" } },
  { key: "retirement", label: "Retirement contribution (SEP/Solo 401k)", dir: "out", tax: "adjustment", lines: { schedule_c: "Schedule 1 L16", f1065: "Schedule 1 L16", f1120s: "1120-S L17", f1120: "1120 L23" } },
  { key: "est_tax_federal", label: "Estimated tax payment: IRS", dir: "out", tax: "tax_payment", jurisdiction: "federal", lines: { schedule_c: "1040 L26" } },
  { key: "est_tax_oregon", label: "Estimated tax payment: Oregon", dir: "out", tax: "tax_payment", jurisdiction: "oregon", lines: { schedule_c: "OR-40 estimated payments" } },
  { key: "owner_draw", label: "Owner draw (to personal)", dir: "out", tax: "equity", lines: {} },
  { key: "owner_contribution", label: "Owner contribution", dir: "in", tax: "equity", lines: {} },
  { key: "transfer", label: "Transfer between accounts / Stripe payout", dir: "any", tax: "transfer", lines: {} },
  { key: "loan", label: "Loan proceeds / principal", dir: "any", tax: "transfer", lines: {} },
  { key: "personal", label: "Personal (not business)", dir: "any", tax: "personal", lines: {} },
];

export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
export const PL_TAX = new Set(["income", "contra", "deductible", "partial"]);

export const FORM_OF_ENTITY = {
  smllc_schedule_c: "schedule_c", sole_prop: "schedule_c", mmllc_1065: "f1065", s_corp_1120s: "f1120s", c_corp_1120: "f1120",
};
export const ENTITY_LABEL = {
  smllc_schedule_c: "Single-member LLC taxed as sole proprietor (Schedule C)",
  sole_prop: "Sole proprietor (Schedule C)",
  mmllc_1065: "Multi-member LLC (Form 1065 partnership)",
  s_corp_1120s: "S-corp election (Form 1120-S)",
  c_corp_1120: "C-corp (Form 1120)",
};
export const FORM_LABEL = { schedule_c: "Schedule C (Form 1040)", f1065: "Form 1065", f1120s: "Form 1120-S", f1120: "Form 1120" };

export const formLineFor = (catKey, entityType) => {
  const c = CAT[catKey];
  if (!c) return "";
  return c.lines[FORM_OF_ENTITY[entityType] || "schedule_c"] || c.lines.schedule_c || "";
};

export const categoryPatch = (catKey, entityType) => ({
  category: catKey,
  tax_category: CAT[catKey] ? CAT[catKey].tax : "",
  form_line: formLineFor(catKey, entityType),
});

// ---------- Default rules (Justin's known vendors + common bank strings) ----------
export const DEFAULT_RULES = [
  { pattern: "stripe transfer", category: "transfer", direction: "in", priority: 5, notes: "Stripe payouts: revenue is counted from Stripe itself, so the bank deposit is a transfer" },
  { pattern: "stripe payout", category: "transfer", direction: "in", priority: 5 },
  { pattern: "stripe", category: "transfer", direction: "in", priority: 9 },
  { pattern: "irs usataxpymt", category: "est_tax_federal", direction: "out", priority: 5 },
  { pattern: "irs  usataxpymt", category: "est_tax_federal", direction: "out", priority: 5 },
  { pattern: "us treasury", category: "est_tax_federal", direction: "out", priority: 8 },
  { pattern: "oregon dept of revenue", category: "est_tax_oregon", direction: "out", priority: 5 },
  { pattern: "or dept rev", category: "est_tax_oregon", direction: "out", priority: 5 },
  { pattern: "anthropic", category: "ai_tools", direction: "out" },
  { pattern: "claude.ai", category: "ai_tools", direction: "out" },
  { pattern: "openai", category: "ai_tools", direction: "out" },
  { pattern: "chatgpt", category: "ai_tools", direction: "out" },
  { pattern: "genspark", category: "ai_tools", direction: "out" },
  { pattern: "elevenlabs", category: "ai_tools", direction: "out" },
  { pattern: "base44", category: "hosting", direction: "out" },
  { pattern: "framer", category: "hosting", direction: "out" },
  { pattern: "render.com", category: "hosting", direction: "out" },
  { pattern: "mongodb", category: "hosting", direction: "out" },
  { pattern: "godaddy", category: "hosting", direction: "out" },
  { pattern: "squarespace", category: "hosting", direction: "out" },
  { pattern: "namecheap", category: "hosting", direction: "out" },
  { pattern: "canva", category: "software", direction: "out" },
  { pattern: "envato", category: "software", direction: "out" },
  { pattern: "typeform", category: "software", direction: "out" },
  { pattern: "zapier", category: "software", direction: "out" },
  { pattern: "serpapi", category: "software", direction: "out" },
  { pattern: "google *gsuite", category: "software", direction: "out" },
  { pattern: "google workspace", category: "software", direction: "out" },
  { pattern: "intuit", category: "software", direction: "out" },
  { pattern: "quickbooks", category: "software", direction: "out" },
  { pattern: "apple.com/bill", category: "software", direction: "out" },
  { pattern: "google ads", category: "advertising", direction: "out" },
  { pattern: "facebk", category: "advertising", direction: "out" },
  { pattern: "meta verified", category: "advertising", direction: "out" },
  { pattern: "zenbusiness", category: "taxes_licenses", direction: "out" },
  { pattern: "secretary of state", category: "taxes_licenses", direction: "out" },
  { pattern: "smpl", category: "contract_labor", direction: "out" },
  { pattern: "upwork", category: "contract_labor", direction: "out" },
  { pattern: "fiverr", category: "contract_labor", direction: "out" },
  { pattern: "service fee", category: "bank_fees", direction: "out", priority: 60 },
  { pattern: "wire fee", category: "bank_fees", direction: "out" },
];

// Expense entity category -> ledger category (for the scheduled-expense import).
export const EXPENSE_CATEGORY_MAP = {
  "AI Tools": "ai_tools", Design: "software", Finance: "software", Hosting: "hosting", Marketing: "advertising", Operations: "software", SEO: "software",
};

export const normalize = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

// Clean a raw bank payee into a stable rule pattern: drop card numbers, dates, store ids and trailing city/state.
export function payeePattern(s) {
  let p = normalize(s)
    .replace(/(pos|debit|card|purchase|recurring|ach|withdrawal|payment|online|checkcard|visa|mc)\s+/g, " ")
    .replace(/[#*]\s*\w*\d\w*/g, " ")
    .replace(/\b\d{2,}\b/g, " ")
    .replace(/\b(xx+\d*|\d+x+)\b/g, " ")
    .replace(/[^a-z0-9 .&'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  p = p.replace(/\s+[a-z]{2}$/, "").trim();
  return p.split(" ").slice(0, 3).join(" ");
}

function ruleMatches(rule, tx) {
  if (rule.active === false) return false;
  if (rule.direction && rule.direction !== "any" && rule.direction !== tx.direction) return false;
  const pat = normalize(rule.pattern);
  if (!pat) return false;
  const fields = rule.match_field === "payee" ? [tx.payee] : rule.match_field === "description" ? [tx.description] : [tx.payee, tx.description];
  return fields.some((f) => {
    const v = normalize(f);
    if (!v) return false;
    if (rule.match_type === "equals") return v === pat;
    if (rule.match_type === "starts_with") return v.startsWith(pat);
    return v.includes(pat);
  });
}

// Lowest priority number wins; ties -> learned rules first, then longer patterns.
export function findRule(rules, tx) {
  const hits = (rules || []).filter((r) => ruleMatches(r, tx));
  hits.sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50) || (b.learned ? 1 : 0) - (a.learned ? 1 : 0) || normalize(b.pattern).length - normalize(a.pattern).length);
  return hits[0] || null;
}

// ---------- CSV ----------
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  const s = String(text || "").replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const findCol = (headers, tests) => {
  const h = headers.map((x) => normalize(x));
  for (const t of tests) {
    const i = h.findIndex((x) => (t instanceof RegExp ? t.test(x) : x === t));
    if (i >= 0) return i;
  }
  return -1;
};

// Guess the column mapping for Mercury and most bank exports.
export function guessMapping(headers) {
  return {
    date: findCol(headers, ["date (utc)", "date", "posted date", "posting date", "transaction date", /date/]),
    description: findCol(headers, ["description", "bank description", "name", "payee", "merchant", "details", /desc/, /memo/]),
    payee: findCol(headers, ["name", "payee", "merchant", "counterparty", "description"]),
    amount: findCol(headers, ["amount", "amount (usd)", "transaction amount", /^amount/]),
    debit: findCol(headers, ["debit", "withdrawal", "withdrawals", "money out", /debit/]),
    credit: findCol(headers, ["credit", "deposit", "deposits", "money in", /credit/]),
    account: findCol(headers, ["source account", "account", "account name", "card"]),
    status: findCol(headers, ["status"]),
    category: findCol(headers, ["mercury category", "category"]),
  };
}

const num = (v) => {
  if (v == null) return NaN;
  let s = String(v).trim();
  if (!s) return NaN;
  const neg = /^\(.*\)$/.test(s) || /-/.test(s.replace(/e-/i, ""));
  s = s.replace(/[()$,\s]/g, "").replace(/^-/, "").replace(/-$/, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? (neg ? -n : n) : NaN;
};

export function toIsoDate(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// Turn parsed rows into ledger drafts. Skips failed/pending rows when a status column says so.
export function rowsToDrafts(rows, mapping, { account = "", batch = "" } = {}) {
  const [, ...body] = rows;
  const out = [];
  const errors = [];
  body.forEach((r, idx) => {
    const status = mapping.status >= 0 ? normalize(r[mapping.status]) : "";
    if (status && /(failed|cancel|pending|declined)/.test(status)) return;
    const date = toIsoDate(r[mapping.date]);
    let amt = mapping.amount >= 0 ? num(r[mapping.amount]) : NaN;
    if (!Number.isFinite(amt)) {
      const d = mapping.debit >= 0 ? num(r[mapping.debit]) : NaN;
      const c = mapping.credit >= 0 ? num(r[mapping.credit]) : NaN;
      if (Number.isFinite(c) && c !== 0) amt = Math.abs(c);
      else if (Number.isFinite(d) && d !== 0) amt = -Math.abs(d);
    }
    if (!date || !Number.isFinite(amt) || amt === 0) { errors.push(idx + 2); return; }
    const description = String(mapping.description >= 0 ? r[mapping.description] : "").trim();
    const payee = String(mapping.payee >= 0 ? r[mapping.payee] : description).trim() || description;
    out.push({
      date,
      amount: Math.round(Math.abs(amt) * 100) / 100,
      direction: amt > 0 ? "in" : "out",
      payee,
      description,
      account: String(mapping.account >= 0 ? r[mapping.account] : "").trim() || account,
      bank_category: mapping.category >= 0 ? String(r[mapping.category] || "").trim() : "",
      source: "csv",
      import_batch: batch,
    });
  });
  return { drafts: withDedupeKeys(out), errors };
}

// Same date + amount + direction + payee can legitimately repeat (two identical coffees):
// the n-th repeat inside one file gets #n, so re-importing the same file still dedupes exactly.
export function withDedupeKeys(drafts) {
  const seen = {};
  return drafts.map((d) => {
    const base = `${d.date}|${d.direction}|${d.amount.toFixed(2)}|${payeePattern(d.payee || d.description)}`;
    seen[base] = (seen[base] || 0) + 1;
    return { ...d, dedupe_key: `${base}#${seen[base]}` };
  });
}

// Find an existing row that is the same money movement from another source (expense schedule, QuickBooks):
// same direction, amount within 1% (min $1), date within 6 days.
export function findCrossSourceMatch(draft, existing) {
  const t = new Date(draft.date).getTime();
  return (existing || []).find((e) => {
    if (e.source === draft.source || e.direction !== draft.direction || e.matched_id) return false;
    if (e.review_status === "excluded" && e.source !== "expense_schedule") return false;
    const tol = Math.max(1, draft.amount * 0.01);
    if (Math.abs((Number(e.amount) || 0) - draft.amount) > tol) return false;
    return Math.abs(new Date(e.date).getTime() - t) <= 6 * 86400000;
  }) || null;
}

export const money2 = (n) => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money0 = (n) => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const pct = (n, d = 1) => `${((Number(n) || 0) * 100).toFixed(d)}%`;

// Signed P&L effect of one row (meals at 50%). Non-P&L rows -> 0.
export function plAmount(tx, mealsShare = 0.5) {
  const c = CAT[tx.category];
  if (!c || tx.review_status === "excluded" || !PL_TAX.has(c.tax)) return 0;
  const a = Number(tx.amount) || 0;
  if (c.tax === "income") return tx.direction === "in" ? a : -a;
  if (c.tax === "contra") return tx.direction === "out" ? -a : a;
  const share = c.tax === "partial" ? mealsShare : 1;
  return (tx.direction === "out" ? -a : a) * share;
}

// P&L grouped by form line for the year (approved + needs_review rows that already have a category).
export function summarize(txs, { entityType = "smllc_schedule_c", mealsShare = 0.5 } = {}) {
  const byCat = {};
  let gross = 0;
  let returns = 0;
  let expenses = 0;
  let other = 0;
  txs.forEach((t) => {
    if (t.review_status === "excluded") return;
    const c = CAT[t.category];
    if (!c) return;
    const a = Number(t.amount) || 0;
    const row = byCat[c.key] || (byCat[c.key] = { key: c.key, label: c.label, line: formLineFor(c.key, entityType), tax: c.tax, gross: 0, deductible: 0, count: 0 });
    row.count += 1;
    const signed = t.direction === "out" ? a : -a;
    row.gross += c.tax === "income" ? (t.direction === "in" ? a : -a) : signed;
    if (c.tax === "income") { if (c.key === "other_income") other += t.direction === "in" ? a : -a; else gross += t.direction === "in" ? a : -a; }
    else if (c.tax === "contra") returns += signed;
    else if (c.tax === "deductible") { expenses += signed; row.deductible += signed; }
    else if (c.tax === "partial") { expenses += signed * mealsShare; row.deductible += signed * mealsShare; }
  });
  const rows = Object.values(byCat).sort((a, b) => a.line.localeCompare(b.line, undefined, { numeric: true }));
  return { rows, gross, returns, other, expenses, net: gross - returns + other - expenses };
}
