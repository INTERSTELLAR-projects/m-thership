// Tax projection engine (pure). Every rate comes from the resolved taxConfig (see taxConfig.js).
// Output is an ESTIMATE for planning; it is not a return and not tax advice.
import { DUE_DATES } from "./taxConfig";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const n0 = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const v = (cfg, k) => cfg[k] && cfg[k].value;
const isJoint = (fs) => fs === "mfj" || fs === "hoh";

export const DEFAULT_PROFILE = {
  business_id: "interstellar",
  business_name: "Interstellar Strategies LLC",
  entity_type: "smllc_schedule_c",
  state: "OR",
  city: "Molalla",
  county: "Clackamas",
  filing_status: "single",
  qualifying_children: 0,
  other_wages: 0,
  other_income: 0,
  withholding_federal: 0,
  withholding_oregon: 0,
  itemized_deductions: 0,
  se_health_insurance: 0,
  retirement_contributions: 0,
  is_sstb: false,
  estimated_payments: [],
  home_office_method: "none",
  home_office_sqft: 0,
  home_total_sqft: 0,
  home_expenses_annual: 0,
  in_sctd_district: true,
  in_metro_district: false,
  reserve_balance: 0,
  projection_method: "run_rate",
  scorp_payroll_service_cost: 600,
  scorp_extra_prep_cost: 1500,
  completed: false,
};

// ---------- Brackets ----------
export function bracketTax(income, limits, rates) {
  let tax = 0;
  let prev = 0;
  const x = Math.max(0, income);
  for (let i = 0; i < rates.length; i++) {
    const top = i < limits.length ? limits[i] : Infinity;
    if (x <= prev) break;
    tax += (Math.min(x, top) - prev) * rates[i];
    prev = top;
  }
  return tax;
}

export function marginalRate(income, limits, rates) {
  for (let i = 0; i < limits.length; i++) if (income <= limits[i]) return rates[i];
  return rates[rates.length - 1];
}

const fedLimits = (cfg, fs) => v(cfg, { single: "fed_brackets_single", mfj: "fed_brackets_mfj", hoh: "fed_brackets_hoh", mfs: "fed_brackets_mfs" }[fs] || "fed_brackets_single");
const orLimits = (cfg, fs) => v(cfg, isJoint(fs) ? "or_brackets_joint" : "or_brackets_single");

// ---------- QBI (IRC §199A) ----------
export function qbiDeduction({ qbi, tiBeforeQbi, fs, sstb, w2Wages = 0, cfg }) {
  if (qbi <= 0) return { amount: 0, note: "No qualified business income" };
  const rate = v(cfg, "qbi_rate");
  const threshold = (v(cfg, "qbi_threshold") || {})[fs] ?? 201750;
  const phase = (v(cfg, "qbi_phase_in") || {})[fs] ?? 75000;
  const min = v(cfg, "qbi_minimum") || { deduction: 400, min_qbi: 1000 };
  let tentative = rate * qbi;
  let wageLimit = 0.5 * w2Wages;
  let note = "Below the threshold: full 20%";
  let d;
  if (tiBeforeQbi <= threshold) d = tentative;
  else {
    const ratio = Math.min(1, (tiBeforeQbi - threshold) / phase);
    if (sstb) { const app = 1 - ratio; tentative *= app; wageLimit *= app; }
    d = ratio >= 1 ? Math.min(tentative, wageLimit) : tentative - ratio * Math.max(0, tentative - wageLimit);
    note = ratio >= 1 ? "Above the phase-in range: limited to 50% of W-2 wages" + (sstb ? " (SSTB: none)" : "") : `In the phase-in range (${Math.round(ratio * 100)}%)`;
  }
  d = Math.min(Math.max(0, d), rate * Math.max(0, tiBeforeQbi));
  if (qbi >= min.min_qbi && d < min.deduction && tiBeforeQbi > 0) { d = Math.min(min.deduction, tiBeforeQbi); note += "; $400 minimum applied"; }
  return { amount: d, note };
}

// ---------- Oregon federal tax subtraction ----------
export function orFedSubtraction(fedLiability, agi, fs, cfg) {
  const cap0 = v(cfg, "or_fed_subtraction_max");
  const starts = v(cfg, "or_fed_subtraction_phaseout") || { single: 125000, joint: 250000 };
  const start = isJoint(fs) ? starts.joint : starts.single;
  const step = isJoint(fs) ? 10000 : 5000;
  let share = 1;
  if (agi >= start) share = Math.max(0, 0.8 - Math.floor((agi - start) / step) * 0.2);
  const cap = cap0 * share * (fs === "mfs" ? 0.5 : 1);
  return Math.min(Math.max(0, fedLiability), cap);
}

// ---------- One full computation for a given net profit ----------
// mode "schedule_c" (sole prop / SMLLC) or "s_corp" with salary.
export function computeTaxes(np, profile, cfg, opts = {}) {
  const p = { ...DEFAULT_PROFILE, ...(profile || {}) };
  const fs = p.filing_status || "single";
  const scorp = opts.mode === "s_corp";
  const salary = scorp ? Math.max(0, n0(opts.salary)) : 0;
  const otherWages = n0(p.other_wages);
  const wageBase = v(cfg, "ss_wage_base");
  const fica = v(cfg, "fica_employee_rate");
  const addlThr = (v(cfg, "addl_medicare_threshold") || {})[fs] ?? 200000;
  const addlRate = v(cfg, "addl_medicare_rate");
  const out = { mode: scorp ? "s_corp" : "schedule_c", netProfit: r2(np), lines: [] };

  // --- business-level (S-corp payroll) ---
  let k1 = 0;
  let payroll = null;
  if (scorp) {
    const ss = fica.ss * Math.min(salary, wageBase);
    const med = fica.medicare * salary;
    const futa = v(cfg, "futa");
    const ui = v(cfg, "or_ui");
    const pl = v(cfg, "or_paid_leave");
    const employer = {
      fica: ss + med,
      futa: futa.rate * Math.min(salary, futa.base),
      or_ui: ui.rate * Math.min(salary, ui.base),
      paid_leave: (pl.employer_share_small || 0) * pl.rate * Math.min(salary, pl.base),
      sctd_payroll: p.in_sctd_district ? n0(v(cfg, "sctd_se_rate")) * salary : 0,
    };
    const employee = {
      fica: ss + med,
      paid_leave: pl.employee_share * pl.rate * Math.min(salary, pl.base),
      transit: n0(v(cfg, "or_statewide_transit")) * salary,
    };
    const costs = { payroll_service: n0(p.scorp_payroll_service_cost), extra_prep: n0(p.scorp_extra_prep_cost), or_minimum: n0(v(cfg, "or_scorp_minimum")) };
    const employerTotal = Object.values(employer).reduce((s, x) => s + x, 0);
    k1 = np - salary - employerTotal - costs.payroll_service - costs.extra_prep - costs.or_minimum;
    payroll = { salary, employer, employee, costs, employerTotal, employeeTotal: Object.values(employee).reduce((s, x) => s + x, 0), k1 };
  }

  // --- self-employment tax (Schedule SE) ---
  let nese = 0;
  let seSS = 0;
  let seMed = 0;
  if (!scorp && np > 0) {
    nese = np * v(cfg, "se_net_factor");
    if (nese >= v(cfg, "se_min_earnings")) {
      seSS = v(cfg, "se_ss_rate") * Math.min(nese, wageBase);
      seMed = v(cfg, "se_medicare_rate") * nese;
    } else nese = 0;
  }
  const seTax = seSS + seMed;
  const halfSe = seTax / 2;
  const medicareWagesAndSe = otherWages + salary + nese;
  const addlMedicare = addlRate * Math.max(0, medicareWagesAndSe - addlThr);

  // --- AGI ---
  const bizIncome = scorp ? k1 : np;
  const seHealth = Math.min(n0(p.se_health_insurance), Math.max(0, (scorp ? salary : np - halfSe)));
  const retirement = n0(p.retirement_contributions);
  const agi = bizIncome + salary + otherWages + n0(p.other_income) - halfSe - seHealth - retirement;
  const stdDed = (v(cfg, "std_deduction") || {})[fs] ?? 16100;
  const itemized = n0(p.itemized_deductions);
  const deduction = Math.max(stdDed, itemized);
  const tiBeforeQbi = Math.max(0, agi - deduction);
  const qbiBase = Math.max(0, bizIncome - (scorp ? 0 : halfSe + seHealth + retirement));
  const qbi = qbiDeduction({ qbi: qbiBase, tiBeforeQbi, fs, sstb: !!p.is_sstb, w2Wages: salary, cfg });
  const taxable = Math.max(0, tiBeforeQbi - qbi.amount);
  const rates = v(cfg, "fed_rates");
  const incomeTax = bracketTax(taxable, fedLimits(cfg, fs), rates);
  // Child tax credit (non-refundable part only: conservative).
  const kids = n0(p.qualifying_children);
  const ctcThr = fs === "mfj" ? 400000 : 200000;
  const ctcRaw = kids * n0(v(cfg, "ctc_per_child"));
  const ctc = Math.min(incomeTax, Math.max(0, ctcRaw - Math.ceil(Math.max(0, agi - ctcThr) / 1000) * 50));
  const fedIncomeTax = Math.max(0, incomeTax - ctc);
  const federalTotal = fedIncomeTax + seTax + addlMedicare + (payroll ? payroll.employee.fica + payroll.employer.fica + payroll.employer.futa : 0);

  // --- Oregon ---
  const orStd = (v(cfg, "or_std_deduction") || {})[fs] ?? 2900;
  const fedSub = orFedSubtraction(fedIncomeTax, agi, fs, cfg);
  const orTaxable = Math.max(0, agi - orStd - fedSub);
  const orTaxRaw = bracketTax(orTaxable, orLimits(cfg, fs), v(cfg, "or_rates"));
  const ex = v(cfg, "or_exemption_credit") || { amount: 260, agi_single: 100000, agi_joint: 200000 };
  const exemptions = 1 + (fs === "mfj" ? 1 : 0) + kids;
  const exCredit = agi <= (isJoint(fs) ? ex.agi_joint : ex.agi_single) ? exemptions * ex.amount : 0;
  const oregonIncomeTax = Math.max(0, orTaxRaw - exCredit);
  const oregonPayroll = payroll ? payroll.employer.or_ui + payroll.employer.paid_leave + payroll.employee.paid_leave + payroll.employee.transit + payroll.costs.or_minimum : 0;

  // --- Local ---
  const sctd = !scorp && p.in_sctd_district ? n0(v(cfg, "sctd_se_rate")) * Math.max(0, np) : payroll ? payroll.employer.sctd_payroll : 0;
  const metro = v(cfg, "metro_shs");
  const metroTax = p.in_metro_district ? metro.rate * Math.max(0, taxable - (isJoint(fs) ? metro.joint : metro.single)) : 0;
  const localTotal = sctd + metroTax;

  const oregonTotal = oregonIncomeTax;
  const total = federalTotal + oregonTotal + localTotal + oregonPayroll;
  const extraCosts = payroll ? payroll.costs.payroll_service + payroll.costs.extra_prep : 0;

  return Object.assign(out, {
    fs, nese, seSS, seMed, seTax, halfSe, addlMedicare, seHealth, retirement, agi, stdDed, itemized, deduction,
    tiBeforeQbi, qbiBase, qbi: qbi.amount, qbiNote: qbi.note, taxable, incomeTax, ctc, fedIncomeTax, federalTotal,
    fedMarginal: marginalRate(taxable, fedLimits(cfg, fs), rates),
    orStd, fedSub, orTaxable, orTaxRaw, exCredit, oregonIncomeTax, oregonTotal, oregonPayroll,
    orMarginal: marginalRate(orTaxable, orLimits(cfg, fs), v(cfg, "or_rates")),
    sctd, metroTax, localTotal, total, payroll, extraCosts, allIn: total + extraCosts,
  });
}

// ---------- Year projection from ledger actuals ----------
export function yearFraction(taxYear, now = new Date()) {
  const y = now.getFullYear();
  if (taxYear < y) return 1;
  if (taxYear > y) return 0;
  const start = new Date(y, 0, 1).getTime();
  const end = new Date(y + 1, 0, 1).getTime();
  return Math.min(1, Math.max(1 / 365, (now.getTime() - start) / (end - start)));
}

// monthly: [{ key: "2026-01", gross, expenses }] actuals by month for the tax year.
export function projectYear({ ytd, monthly, method = "run_rate", taxYear, now = new Date(), extras = {} }) {
  const frac = yearFraction(taxYear, now);
  const ytdGross = ytd.gross - ytd.returns + ytd.other;
  const ytdExp = ytd.expenses;
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const complete = (monthly || []).filter((m) => m.key < curKey && m.key.startsWith(String(taxYear)));
  const last3 = complete.slice(-3);
  let fullGross;
  let fullExp;
  let used = method;
  if (frac >= 1) { fullGross = ytdGross; fullExp = ytdExp; used = "actual"; }
  else if (method === "run_rate" && last3.length) {
    const remainingMonths = 12 * (1 - frac);
    const avgG = last3.reduce((s, m) => s + m.gross, 0) / last3.length;
    const avgE = last3.reduce((s, m) => s + m.expenses, 0) / last3.length;
    fullGross = ytdGross + avgG * remainingMonths;
    fullExp = ytdExp + avgE * remainingMonths;
  } else {
    fullGross = ytdGross / frac;
    fullExp = ytdExp / frac;
    used = "annualized";
  }
  const extraFull = n0(extras.homeOffice) + n0(extras.depreciation) + (frac >= 1 ? n0(extras.mileageYtd) : n0(extras.mileageYtd) / frac);
  const extraYtd = (n0(extras.homeOffice) + n0(extras.depreciation)) * frac + n0(extras.mileageYtd);
  return {
    frac, used,
    ytdGross, ytdExp, ytdNet: ytdGross - ytdExp - extraYtd,
    fullGross, fullExp: fullExp + extraFull, fullNet: fullGross - fullExp - extraFull,
    annualizedNet: frac > 0 ? (ytdGross - ytdExp) / frac - extraFull : 0,
    runRateAvailable: last3.length > 0,
  };
}

// ---------- Estimated payments ----------
export function paymentTaxYear(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
}

// Profile entries + ledger rows tagged est_tax_*; a manual entry within 10 days and $1 of a ledger row counts once.
export function mergePayments(profile, ledger, taxYear) {
  const manual = ((profile && profile.estimated_payments) || []).map((p) => ({ ...p, amount: n0(p.amount), origin: "manual", tax_year: p.tax_year || paymentTaxYear(p.date) }));
  const fromLedger = (ledger || [])
    .filter((t) => (t.category === "est_tax_federal" || t.category === "est_tax_oregon") && t.review_status !== "excluded")
    .map((t) => ({ date: t.date, amount: n0(t.amount), jurisdiction: t.category === "est_tax_oregon" ? "oregon" : "federal", origin: "ledger", id: t.id, tax_year: paymentTaxYear(t.date) }));
  const merged = [...manual];
  fromLedger.forEach((l) => {
    const dup = manual.some((m) => m.jurisdiction === l.jurisdiction && Math.abs(m.amount - l.amount) <= 1 && Math.abs(new Date(m.date) - new Date(l.date)) <= 10 * 86400000);
    if (!dup) merged.push(l);
  });
  return merged.filter((p) => Number(p.tax_year) === Number(taxYear)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// Required annual payment (safe harbor) and the per-quarter plan for one jurisdiction.
export function quarterPlan({ jurisdiction, projectedTax, withholding, prior, priorAgi, fs, payments, taxYear, cfg, now = new Date() }) {
  const due = (DUE_DATES[taxYear] || DUE_DATES[2026]).dates;
  let currentPct = v(cfg, "safe_harbor_current_pct");
  let priorPct = v(cfg, "safe_harbor_prior_pct");
  if (jurisdiction === "oregon") {
    const o = v(cfg, "or_safe_harbor");
    currentPct = o.current; priorPct = o.prior;
  } else if (prior != null && priorAgi != null) {
    const hi = v(cfg, "safe_harbor_high_income_pct");
    if (n0(priorAgi) > (fs === "mfs" ? hi.agi_mfs : hi.agi)) priorPct = hi.pct;
  }
  const byCurrent = currentPct * projectedTax;
  const byPrior = prior != null && prior !== "" ? priorPct * n0(prior) : null;
  const required = Math.max(0, (byPrior != null ? Math.min(byCurrent, byPrior) : byCurrent) - n0(withholding));
  const actualNeeded = Math.max(0, projectedTax - n0(withholding));
  const threshold = jurisdiction === "oregon" ? v(cfg, "or_est_required_threshold") : v(cfg, "est_required_threshold");
  const paid = (payments || []).filter((p) => p.jurisdiction === jurisdiction);
  const today = now.toISOString().slice(0, 10);
  let paidCum = 0;
  const rows = due.map((d) => {
    const paidBy = paid.filter((p) => p.date <= d.date && !(d.q > 1 && p.date <= due[d.q - 2].date)).reduce((s, p) => s + p.amount, 0);
    paidCum += paidBy;
    return { ...d, paidThisPeriod: paidBy, paidCum, cumSafe: (required * d.q) / 4, cumActual: (actualNeeded * d.q) / 4, past: d.date < today };
  });
  const totalPaid = paid.reduce((s, p) => s + p.amount, 0);
  const next = rows.find((r) => !r.past) || null;
  const remainingInst = rows.filter((r) => !r.past).length;
  // To stay on the safe-harbor track: catch up to the cumulative amount due by the next date.
  const paidBeforeNext = next ? paid.filter((p) => p.date <= next.date).reduce((s, p) => s + p.amount, 0) : totalPaid;
  const nextSafe = next ? Math.max(0, next.cumSafe - paidBeforeNext) : 0;
  const nextActual = next && remainingInst ? Math.max(0, (actualNeeded - totalPaid) / remainingInst) : 0;
  return {
    jurisdiction, projectedTax, withholding: n0(withholding), byCurrent, byPrior, required, actualNeeded, threshold,
    mustPay: actualNeeded >= threshold, rows, totalPaid, next, nextSafe, nextActual,
    usingPrior: byPrior != null && byPrior < byCurrent,
  };
}

// ---------- The full plan ----------
export function buildPlan({ profile, cfg, ytd, monthly, extras, ledger, taxYear, now = new Date() }) {
  const p = { ...DEFAULT_PROFILE, ...(profile || {}) };
  const proj = projectYear({ ytd, monthly, method: p.projection_method, taxYear, now, extras });
  const tax = computeTaxes(proj.fullNet, p, cfg);
  const taxAnnualized = computeTaxes(proj.annualizedNet, p, cfg);
  const plus = computeTaxes(proj.fullNet + 1000, p, cfg);
  const payments = mergePayments(p, ledger, taxYear);
  const fedProjected = tax.federalTotal;
  const orProjected = tax.oregonTotal;
  const fed = quarterPlan({ jurisdiction: "federal", projectedTax: fedProjected, withholding: p.withholding_federal, prior: p.prior_year_federal_tax, priorAgi: p.prior_year_agi, fs: tax.fs, payments, taxYear, cfg, now });
  const or = quarterPlan({ jurisdiction: "oregon", projectedTax: orProjected, withholding: p.withholding_oregon, prior: p.prior_year_oregon_tax, priorAgi: p.prior_year_agi, fs: tax.fs, payments, taxYear, cfg, now });
  const withholding = n0(p.withholding_federal) + n0(p.withholding_oregon);
  const totalPaid = payments.reduce((s, x) => s + x.amount, 0);
  const setAsidePct = proj.fullGross > 0 ? Math.max(0, tax.total - withholding) / proj.fullGross : 0;
  const marginal = (plus.total - tax.total) / 1000;
  const accrued = proj.fullNet > 0 ? tax.total * Math.min(1, Math.max(0, proj.ytdNet) / proj.fullNet) : 0;
  const neededInReserve = Math.max(0, accrued - withholding * proj.frac - totalPaid);
  const reserve = n0(p.reserve_balance);
  const cat = v(cfg, "or_cat");
  const nextDue = [fed.next, or.next].filter(Boolean).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  return {
    taxYear, profile: p, proj, tax, taxAnnualized, payments, fed, or, withholding, totalPaid,
    effectiveRate: proj.fullNet > 0 ? tax.total / proj.fullNet : 0,
    setAsidePct, marginal, accrued, neededInReserve, reserve,
    reserveFunded: neededInReserve > 0 ? Math.min(1, reserve / neededInReserve) : 1,
    nextDue, nextDueAmount: nextDue ? (fed.next && fed.next.date === nextDue.date ? fed.nextSafe : 0) + (or.next && or.next.date === nextDue.date ? or.nextSafe : 0) : 0,
    nextDueActual: nextDue ? (fed.next && fed.next.date === nextDue.date ? fed.nextActual : 0) + (or.next && or.next.date === nextDue.date ? or.nextActual : 0) : 0,
    cat: { ...cat, projected: proj.fullGross, registerPct: proj.fullGross / cat.register, mustRegister: proj.fullGross >= cat.register, mustFile: proj.fullGross > cat.file },
  };
}

// S-corp what-if: compare at a given salary. Returns both results and the difference (positive = S-corp saves).
export function scorpCompare(np, profile, cfg, salary) {
  const sole = computeTaxes(np, profile, cfg);
  const sc = computeTaxes(np, profile, cfg, { mode: "s_corp", salary });
  return { sole, sc, savings: sole.allIn - sc.allIn };
}

export function snapshotForReminders(plan) {
  const rows = (j) => j.rows.map((r) => ({ q: r.q, date: r.date, safe: r2(Math.max(0, r.cumSafe - r.paidCum + r.paidThisPeriod)), actual: r2(j.actualNeeded / 4) }));
  return {
    at: new Date().toISOString(), tax_year: plan.taxYear, total: r2(plan.tax.total), set_aside_pct: r2(plan.setAsidePct * 100),
    federal: rows(plan.fed), oregon: rows(plan.or), next_due: plan.nextDue ? plan.nextDue.date : null,
    next_federal: r2(plan.fed.nextSafe), next_oregon: r2(plan.or.nextSafe),
  };
}
