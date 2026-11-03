// FAKE data for QA mode only (preview sandbox + ?qa=1, see src/lib/qa.js). Fictional clients and vendors.
const Y = new Date().getFullYear();
const m = new Date().getMonth(); // 0-based current month
const d = (mo, day) => `${Y}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
let n = 0;
const id = () => `qa_l${++n}`;
const base = { business_id: "interstellar", tax_year: Y };

const rows = [];
const clients = [["Summit Roofing Co", 750], ["Harbor Coffee", 500], ["Peak Fitness Lab", 297], ["Cascade Plumbing", 1200], ["Evergreen Landscaping", 650]];
for (let mo = 0; mo <= m; mo++) {
  clients.forEach(([name, amt], i) => {
    if (mo < i) return;
    rows.push({ ...base, id: id(), date: d(mo, 3 + i * 4), amount: amt, direction: "in", payee: name, description: "Monthly retainer", category: "revenue", tax_category: "income", form_line: "Sch C L1", source: "stripe", account: "Stripe", reconciled: true, review_status: "approved" });
  });
  rows.push({ ...base, id: id(), date: d(mo, 28), amount: 62.4 + mo * 3, direction: "out", payee: "Stripe", description: "Stripe processing fees", category: "merchant_fees", tax_category: "deductible", form_line: "Sch C L10", source: "stripe", account: "Stripe", reconciled: true, review_status: "approved" });
  [["Anthropic", 200, "ai_tools"], ["Base44", 200, "hosting"], ["Canva", 15, "software"], ["Envato", 39, "software"]].forEach(([p, a, c], j) => {
    rows.push({ ...base, id: id(), date: d(mo, 7 + j * 5), amount: a, direction: "out", payee: p, description: `${p} subscription`, category: c, tax_category: "deductible", form_line: "Sch C L27a (Part V)", source: "csv", account: "Mercury checking", reconciled: true, review_status: "approved" });
  });
}
rows.push({ ...base, id: id(), date: d(Math.max(0, m - 2), 14), amount: 1800, direction: "out", payee: "Freelance Dev Co", description: "Contract build sprint", category: "contract_labor", tax_category: "deductible", form_line: "Sch C L11", source: "csv", account: "Mercury checking", reconciled: true, review_status: "approved" });
rows.push({ ...base, id: id(), date: d(Math.max(0, m - 5), 20), amount: 1200, direction: "out", payee: "Freelance Dev Co", description: "Contract design", category: "contract_labor", tax_category: "deductible", form_line: "Sch C L11", source: "csv", account: "Mercury checking", reconciled: true, review_status: "approved" });
// Inbox
const inbox = [
  ["GOOGLE *ADS4471", 180, "out", { category: "advertising", confidence: 0.92, reason: "Google Ads billing descriptor", by: "ai" }],
  ["SQ *PORTLAND COFFEE ROASTERS", 18.5, "out", { category: "meals", confidence: 0.55, reason: "Coffee shop; business purpose not recorded", by: "ai" }],
  ["FRED-MEYER #0412", 64.2, "out", { category: "personal", confidence: 0.7, reason: "Grocery store; likely personal", by: "ai" }],
  ["STRIPE TRANSFER ST-8H2K", 2950, "in", { category: "transfer", confidence: 0.85, reason: 'Rule: "stripe transfer"', by: "rule" }],
  ["IRS USATAXPYMT", 3100, "out", { category: "est_tax_federal", confidence: 0.85, reason: 'Rule: "irs usataxpymt"', by: "rule" }],
  ["AMAZON MKTPL*2K91", 129.99, "out", null],
  ["ADOBE *CREATIVE CLD", 59.99, "out", { category: "software", confidence: 0.9, reason: "Creative Cloud subscription", by: "ai" }],
];
inbox.forEach(([p, a, dir, sug], i) => rows.push({ ...base, id: id(), date: d(m, Math.min(28, 1 + i)), amount: a, direction: dir, payee: p, description: p, account: "Mercury checking", source: "csv", reconciled: true, review_status: "needs_review", ai_suggestion: sug || undefined }));

export const QA_ACCOUNTING = {
  LedgerTransaction: rows,
  LedgerRule: [
    { id: "qa_r1", business_id: "interstellar", pattern: "stripe transfer", category: "transfer", direction: "in", priority: 5, active: true, learned: false },
    { id: "qa_r2", business_id: "interstellar", pattern: "anthropic", category: "ai_tools", direction: "out", priority: 50, active: true, learned: false },
    { id: "qa_r3", business_id: "interstellar", pattern: "freelance dev co", category: "contract_labor", direction: "out", priority: 30, active: true, learned: true },
  ],
  BusinessTaxProfile: [{ id: "qa_p1", business_id: "interstellar", entity_type: "smllc_schedule_c", planned_scorp_year: Y + 1, completed: false }],
  AccountingAsset: [{ id: "qa_a1", business_id: "interstellar", name: "MacBook Pro 16\"", cost: 2899, placed_in_service: d(Math.max(0, m - 6), 10), business_use_pct: 90, asset_class: "computer", treatment: "bonus" }],
  MileageEntry: [{ id: "qa_m1", business_id: "interstellar", date: d(Math.max(0, m - 1), 12), miles: 46, purpose: "Client meeting — Summit Roofing" }, { id: "qa_m2", business_id: "interstellar", date: d(m, 2), miles: 22, purpose: "Bank + post office" }],
  AccountingAlert: [{ id: "qa_al1", business_id: "interstellar", key: `est-${Y}-Q4`, kind: "estimated_tax", status: "new", title: `Pay Q4 ${Y} estimated taxes (IRS 1040-ES + Oregon OR-40-V), due Jan 15, ${Y + 1}`, body: "Planned (safe-harbor track): IRS $4,120 · Oregon $1,260.", due_date: `${Y + 1}-01-15`, link: "/financial?tab=accounting&sub=plan" }],
};
