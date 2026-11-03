// Filing pack builders: Schedule C line totals, 1099 lists, the step-by-step guide and CSV/PDF exports.
import { jsPDF } from "jspdf";
import { CAT, FORM_LABEL, FORM_OF_ENTITY, ENTITY_LABEL } from "./ledger";
import { DISCLAIMER } from "./taxConfig";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const m0 = (n) => `$${Math.round(Number(n) || 0).toLocaleString("en-US")}`;

export const SCHED_C_LINES = [
  ["1", "Gross receipts or sales"], ["2", "Returns and allowances"], ["6", "Other income"], ["8", "Advertising"], ["9", "Car and truck expenses"],
  ["10", "Commissions and fees"], ["11", "Contract labor"], ["13", "Depreciation and section 179"], ["15", "Insurance (other than health)"],
  ["16b", "Interest (other)"], ["17", "Legal and professional services"], ["18", "Office expense"], ["20a", "Rent: vehicles, machinery, equipment"],
  ["20b", "Rent: other business property"], ["21", "Repairs and maintenance"], ["22", "Supplies"], ["23", "Taxes and licenses"], ["24a", "Travel"],
  ["24b", "Deductible meals"], ["25", "Utilities"], ["26", "Wages"], ["27a", "Other expenses (from Part V)"], ["30", "Business use of home"],
];

// Totals per Schedule C line from the ledger summary + extras.
export function scheduleC({ summary, extras, mileage, homeOffice, depreciation }) {
  const lines = Object.fromEntries(SCHED_C_LINES.map(([l]) => [l, 0]));
  const partV = {};
  summary.rows.forEach((r) => {
    const c = CAT[r.key];
    if (!c) return;
    const m = String(c.lines.schedule_c || "").match(/^Sch C L(\w+)/);
    if (!m) return;
    const line = m[1];
    const amt = c.tax === "income" ? r.gross : c.tax === "contra" ? r.gross : r.deductible;
    if (line === "27a") partV[c.label] = (partV[c.label] || 0) + amt;
    lines[line] = (lines[line] || 0) + amt;
  });
  if (mileage && mileage.deduction) lines["9"] += mileage.deduction;
  lines["13"] += depreciation ? depreciation.total : 0;
  lines["22"] += 0;
  lines["30"] = homeOffice ? homeOffice.deduction : 0;
  const gross = lines["1"];
  const line3 = gross - lines["2"];
  const line7 = line3 + lines["6"];
  const totalExp = SCHED_C_LINES.filter(([l]) => !["1", "2", "6", "30"].includes(l)).reduce((s, [l]) => s + lines[l], 0);
  const line29 = line7 - totalExp;
  const line31 = line29 - lines["30"];
  Object.keys(lines).forEach((k) => { lines[k] = r2(lines[k]); });
  return { lines, partV, line3: r2(line3), line7: r2(line7), line28: r2(totalExp), line29: r2(line29), line31: r2(line31), extras };
}

export function form1099s({ ledger, threshold, kThreshold }) {
  const live = ledger.filter((t) => t.review_status !== "excluded");
  const sum = (filter) => {
    const m = {};
    live.filter(filter).forEach((t) => { const k = (t.payee || "Unknown").trim(); m[k] = (m[k] || 0) + (Number(t.amount) || 0); });
    return Object.entries(m).map(([payee, total]) => ({ payee, total: r2(total) })).sort((a, b) => b.total - a.total);
  };
  const contractors = sum((t) => t.category === "contract_labor" && t.direction === "out");
  const clients = sum((t) => t.category === "revenue" && t.direction === "in");
  const stripeRows = live.filter((t) => t.source === "stripe" && t.category === "revenue");
  const stripeGross = stripeRows.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  return {
    toIssue: contractors.filter((c) => c.total >= threshold),
    belowThreshold: contractors.filter((c) => c.total < threshold),
    clientsOverThreshold: clients.filter((c) => c.total >= threshold),
    stripe: { gross: r2(stripeGross), count: stripeRows.length, expectK: stripeGross > kThreshold.amount && stripeRows.length > kThreshold.count },
  };
}

// Step-by-step guide (Schedule C path). Line references follow the 2025 forms; confirm on the 2026 forms.
export function buildGuide({ plan, sc, profile, taxYear }) {
  const t = plan.tax;
  const isC = (FORM_OF_ENTITY[profile.entity_type] || "schedule_c") === "schedule_c";
  const steps = [];
  if (!isC) {
    steps.push({ form: FORM_LABEL[FORM_OF_ENTITY[profile.entity_type]], items: [
      { line: "—", text: `This business is set up as: ${ENTITY_LABEL[profile.entity_type]}. The P&L above is mapped to that form's lines; the entity return, K-1s and payroll forms should be prepared with a CPA. The personal-return walkthrough below is written for Schedule C and does not apply as-is.`, value: null },
    ] });
    return steps;
  }
  steps.push({ form: "Schedule C (Form 1040) — Profit or Loss From Business", items: [
    { line: "A–J", text: "Business name Interstellar Strategies LLC, principal business code 541510 (Computer systems design) or 541800 (Advertising) — pick the one that best describes most revenue; accounting method Cash; you materially participated: Yes. If you paid a contractor $2,000+, answer I/J about 1099s.", value: null },
    ...SCHED_C_LINES.filter(([l]) => sc.lines[l]).map(([l, label]) => ({ line: l, text: label, value: sc.lines[l] })),
    { line: "28", text: "Total expenses (lines 8 through 27b)", value: sc.line28 },
    { line: "29", text: "Tentative profit", value: sc.line29 },
    { line: "31", text: "Net profit — carries to Schedule 1 line 3 and Schedule SE line 2", value: sc.line31 },
  ] });
  if (Object.keys(sc.partV).length) steps.push({ form: "Schedule C Part V — Other expenses", items: Object.entries(sc.partV).map(([k, v]) => ({ line: "48", text: k, value: r2(v) })) });
  steps.push({ form: "Schedule SE — Self-Employment Tax", items: [
    { line: "2", text: "Net profit from Schedule C line 31", value: sc.line31 },
    { line: "4a", text: "Line 3 × 92.35%", value: r2(t.nese) },
    { line: "10", text: "Social Security portion (12.4% up to the wage base)", value: r2(t.seSS) },
    { line: "11", text: "Medicare portion (2.9%)", value: r2(t.seMed) },
    { line: "12", text: "Self-employment tax -> Schedule 2 line 4", value: r2(t.seTax) },
    { line: "13", text: "Deduction for one-half of SE tax -> Schedule 1 line 15", value: r2(t.halfSe) },
  ] });
  steps.push({ form: "Form 8995 — Qualified Business Income Deduction (simplified)", items: [
    { line: "1", text: "Qualified business income (net profit - ½ SE tax - SE health - retirement)", value: r2(t.qbiBase) },
    { line: "15", text: `QBI deduction -> Form 1040 line 13 (${t.qbiNote})`, value: r2(t.qbi) },
  ] });
  steps.push({ form: "Schedule 1 — Additional Income and Adjustments", items: [
    { line: "3", text: "Business income (Schedule C line 31)", value: sc.line31 },
    { line: "15", text: "Deductible part of self-employment tax", value: r2(t.halfSe) },
    ...(t.retirement ? [{ line: "16", text: "Self-employed SEP, SIMPLE and qualified plans", value: r2(t.retirement) }] : []),
    ...(t.seHealth ? [{ line: "17", text: "Self-employed health insurance deduction", value: r2(t.seHealth) }] : []),
  ] });
  steps.push({ form: "Form 1040", items: [
    ...(profile.other_wages ? [{ line: "1z", text: "Wages (W-2s)", value: r2(profile.other_wages) }] : []),
    { line: "11", text: "Adjusted gross income", value: r2(t.agi) },
    { line: "12", text: t.itemized > t.stdDed ? "Itemized deductions (Schedule A)" : "Standard deduction", value: r2(t.deduction) },
    { line: "13", text: "Qualified business income deduction (Form 8995)", value: r2(t.qbi) },
    { line: "15", text: "Taxable income", value: r2(t.taxable) },
    { line: "16", text: "Tax", value: r2(t.incomeTax) },
    ...(t.ctc ? [{ line: "19", text: "Child tax credit", value: r2(t.ctc) }] : []),
    { line: "23", text: "Other taxes incl. SE tax (Schedule 2)", value: r2(t.seTax + t.addlMedicare) },
    { line: "26", text: `${taxYear} estimated tax payments`, value: r2(plan.payments.filter((p) => p.jurisdiction === "federal").reduce((s, p) => s + p.amount, 0)) },
  ] });
  steps.push({ form: "Oregon Form OR-40 (full-year resident)", items: [
    { line: "—", text: "Federal adjusted gross income (from Form 1040 line 11)", value: r2(t.agi) },
    { line: "—", text: "Federal tax liability subtraction (capped; phases out with AGI)", value: r2(t.fedSub) },
    { line: "—", text: "Oregon standard deduction", value: r2(t.orStd) },
    { line: "—", text: "Oregon taxable income", value: r2(t.orTaxable) },
    { line: "—", text: "Oregon tax (rate charts)", value: r2(t.orTaxRaw) },
    { line: "—", text: "Personal exemption credit", value: r2(t.exCredit) },
    { line: "—", text: "Estimated tax payments made", value: r2(plan.payments.filter((p) => p.jurisdiction === "oregon").reduce((s, p) => s + p.amount, 0)) },
    ...(profile.in_sctd_district ? [{ line: "SCTD", text: "South Clackamas Transportation District self-employment tax return (filed with SCTD, not on OR-40) — confirm rate and form with SCTD", value: r2(t.sctd) }] : []),
  ] });
  return steps;
}

const csvCell = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\n");

export function download(name, text, type = "text/csv") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ledgerCsv(ledger) {
  const head = ["date", "direction", "amount", "payee", "description", "account", "category", "form_line", "source", "review_status", "reconciled", "receipt", "notes"];
  return toCsv([head, ...ledger.map((t) => [t.date, t.direction, t.amount, t.payee, t.description, t.account, CAT[t.category] ? CAT[t.category].label : "", t.form_line, t.source, t.review_status, t.reconciled ? "yes" : "", t.receipt_url ? "attached" : "", t.notes])]);
}

export function packPdf({ plan, sc, guide, f1099, depreciation, mileage, homeOffice, profile, taxYear }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 0;
  const ink = [26, 26, 26];
  const header = () => {
    doc.setFillColor(...ink); doc.rect(0, 0, W, 54, "F");
    [[255, 60, 0], [255, 106, 0], [255, 170, 0]].forEach((c, i) => { doc.setFillColor(...c); doc.rect((W / 3) * i, 54, W / 3, 3, "F"); });
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text("INTERSTELLAR™  ·  Filing pack", 40, 33);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`Tax year ${taxYear} · generated ${new Date().toLocaleDateString("en-US")}`, W - 40, 33, { align: "right" });
    y = 84;
  };
  const need = (h) => { if (y + h > H - 50) { doc.addPage(); header(); } };
  const h2 = (s) => { need(34); doc.setTextColor(...ink); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(s, 40, y); doc.setDrawColor(255, 60, 0); doc.setLineWidth(1.5); doc.line(40, y + 5, 110, y + 5); y += 22; };
  const line = (l, txt, val, bold) => {
    const wrapped = doc.splitTextToSize(txt, W - 230);
    need(13 * wrapped.length + 4);
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(9.5); doc.setTextColor(110, 110, 110);
    if (l) doc.text(String(l), 40, y);
    doc.setTextColor(...ink); doc.text(wrapped, 90, y);
    if (val != null) doc.text(m0(val), W - 40, y, { align: "right" });
    y += 13 * wrapped.length + 3;
  };
  const para = (s) => { const w = doc.splitTextToSize(s, W - 80); need(12 * w.length + 6); doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90, 90, 90); doc.text(w, 40, y); y += 12 * w.length + 6; };

  header();
  para(`${profile.business_name || "Interstellar Strategies LLC"} · ${ENTITY_LABEL[profile.entity_type] || ""} · ${profile.city || "Molalla"}, Oregon · filing status ${profile.filing_status}${profile.completed ? "" : " (ASSUMED — business profile not completed)"}.`);
  para(DISCLAIMER);
  h2("Summary");
  line("", "Net profit", plan.tax.netProfit, true);
  line("", "Federal total (income tax + SE tax)", plan.tax.federalTotal);
  line("", "Oregon income tax", plan.tax.oregonTotal);
  line("", "Local (SCTD / Metro)", plan.tax.localTotal);
  line("", "Total estimated tax", plan.tax.total, true);
  line("", "Estimated payments recorded", plan.totalPaid);
  guide.forEach((g) => { h2(g.form); g.items.forEach((it) => line(it.line, it.text, it.value)); });
  h2("1099s");
  if (f1099.toIssue.length) f1099.toIssue.forEach((c) => line("NEC", `Issue 1099-NEC to ${c.payee} (collect a W-9; due to the contractor and the IRS by Jan 31)`, c.total));
  else para("No contractor reached the 1099-NEC threshold from bank/ACH payments in the ledger.");
  para(f1099.stripe.expectK ? `Expect a 1099-K from Stripe (${m0(f1099.stripe.gross)} across ${f1099.stripe.count} payments). It is already inside gross receipts; do not add it again.` : "A Stripe 1099-K is not expected at the current volume (over $20,000 AND over 200 payments).");
  f1099.clientsOverThreshold.forEach((c) => line("", `Client may send a 1099-NEC: ${c.payee} (already in gross receipts)`, c.total));
  h2("Depreciation list");
  if (depreciation.rows.length) depreciation.rows.forEach((r) => line("", `${r.asset.name} (${r.asset.placed_in_service || "date?"}, cost ${m0(r.asset.cost)}, ${r.asset.business_use_pct || 100}% business) — ${r.method}`, r.amount));
  else para("No assets recorded.");
  h2("Mileage & home office");
  line("", `Business miles ${Math.round(mileage.miles).toLocaleString()} at the IRS standard rates`, mileage.deduction);
  line("", homeOffice.note, homeOffice.deduction);
  h2("Line-by-line P&L (Schedule C)");
  SCHED_C_LINES.forEach(([l, label]) => line(l, label, sc.lines[l]));
  line("31", "Net profit", sc.line31, true);
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(140, 140, 140); doc.text(`Estimates — verify with a tax professional before filing · page ${i}/${pages}`, 40, H - 24); }
  doc.save(`filing-pack-${taxYear}.pdf`);
}
