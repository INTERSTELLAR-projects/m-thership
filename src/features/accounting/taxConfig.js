// Accounting & Tax center: EVERY rate, threshold and date the tax engine uses lives here, once.
// Each value carries its tax year, where it came from and whether it was verified against the
// primary source (irs.gov / oregon.gov) when this file was written (2026-11-03).
//   status "verified"            -> read on the cited official page
//   status "needs_confirmation"  -> could not be read on an official page; treat as a placeholder
// Justin can override any value from Accounting > Settings > Tax figures (stored on BusinessTaxProfile.config_overrides).
// The reminder function (base44/functions/accounting/entry.ts) keeps its own copy of DUE_DATES: keep both in sync.

const V = "verified";
const NC = "needs_confirmation";

const RP_25_32 = "https://www.irs.gov/pub/irs-drop/rp-25-32.pdf";
const OR_EST_2026 = "https://www.oregon.gov/dor/forms/FormsPubs/publication-or-estimate_101-026_2026.pdf";
const OR_40_INST_2025 = "https://www.oregon.gov/dor/forms/FormsPubs/form-or-40-inst_101-040-1_2025.pdf";
const IRS_EST_FAQ = "https://www.irs.gov/faqs/estimated-tax";
const TAS_EST_2026 = "https://www.taxpayeradvocate.irs.gov/news/tax-tips/estimated-payments/2026/01/";
const PUB_505 = "https://www.irs.gov/publications/p505";
const IRS_SE = "https://www.irs.gov/taxtopics/tc554";
const OED_RATES = "https://www.oregon.gov/employ/Businesses/Pages/Current-Tax-Rate.aspx";

export const TAX_YEAR = 2026;

export const TAX_CONFIG = {
  // ---------------- Federal income tax ----------------
  fed_brackets_single: {
    label: "Federal brackets: single (upper limits 10/12/22/24/32/35%, 37% above)",
    value: [12400, 50400, 105700, 201775, 256225, 640600], year: 2026, status: V, url: RP_25_32, source: "Rev. Proc. 2025-32 §4.01",
  },
  fed_brackets_mfj: {
    label: "Federal brackets: married filing jointly",
    value: [24800, 100800, 211400, 403550, 512450, 768700], year: 2026, status: V, url: RP_25_32, source: "Rev. Proc. 2025-32 §4.01",
  },
  fed_brackets_hoh: {
    label: "Federal brackets: head of household",
    value: [17700, 67450, 105700, 201750, 256200, 640600], year: 2026, status: V, url: RP_25_32, source: "Rev. Proc. 2025-32 §4.01",
  },
  fed_brackets_mfs: {
    label: "Federal brackets: married filing separately",
    value: [12400, 50400, 105700, 201775, 256225, 384350], year: 2026, status: V, url: RP_25_32, source: "Rev. Proc. 2025-32 §4.01",
  },
  fed_rates: { label: "Federal bracket rates", value: [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37], year: 2026, status: V, url: RP_25_32, source: "IRC §1(j) as extended by OBBBA" },
  std_deduction: {
    label: "Federal standard deduction (single / MFJ / MFS / HoH)",
    value: { single: 16100, mfj: 32200, mfs: 16100, hoh: 24150 }, year: 2026, status: V, url: RP_25_32, source: "Rev. Proc. 2025-32 §4.14",
  },
  qbi_rate: { label: "QBI deduction rate", value: 0.20, year: 2026, status: V, url: RP_25_32, source: "IRC §199A (made permanent by OBBBA)" },
  qbi_threshold: {
    label: "QBI threshold (single+HoH / MFJ / MFS)",
    value: { single: 201750, hoh: 201750, mfj: 403500, mfs: 201775 }, year: 2026, status: V, url: RP_25_32, source: "Rev. Proc. 2025-32 §4.26",
  },
  qbi_phase_in: {
    label: "QBI phase-in range width (single / MFJ)",
    value: { single: 75000, hoh: 75000, mfj: 150000, mfs: 75000 }, year: 2026, status: V, url: RP_25_32,
    source: "Rev. Proc. 2025-32 §4.26 (threshold+range: $276,750 / $553,500)",
  },
  qbi_minimum: {
    label: "QBI minimum deduction ($400 if active QBI ≥ $1,000)",
    value: { deduction: 400, min_qbi: 1000 }, year: 2026, status: V, url: RP_25_32, source: "IRC §199A(i) (OBBBA), Rev. Proc. 2025-32 §2.12",
  },
  ctc_per_child: {
    label: "Child tax credit per qualifying child",
    value: 2200, year: 2026, status: NC, url: "https://www.irs.gov/newsroom/one-big-beautiful-bill-provisions",
    source: "OBBBA set $2,200 for 2025, indexed after; 2026 amount not read on irs.gov this session", note: "Phase-out $50 per $1,000 over $200k / $400k MAGI assumed",
  },
  // ---------------- Self-employment tax ----------------
  se_net_factor: { label: "Net earnings factor (92.35%)", value: 0.9235, year: 2026, status: V, url: IRS_SE, source: "IRC §1402(a)(12); Schedule SE line 4a" },
  se_ss_rate: { label: "SE Social Security rate", value: 0.124, year: 2026, status: V, url: IRS_SE, source: "IRC §1401(a)" },
  se_medicare_rate: { label: "SE Medicare rate", value: 0.029, year: 2026, status: V, url: IRS_SE, source: "IRC §1401(b)" },
  se_min_earnings: { label: "No SE tax below net earnings of", value: 400, year: 2026, status: V, url: IRS_SE, source: "IRC §6017" },
  ss_wage_base: { label: "Social Security wage base", value: 184500, year: 2026, status: V, url: PUB_505, source: "IRS Pub. 505 (2026) reminders; SSA" },
  addl_medicare_rate: { label: "Additional Medicare tax rate", value: 0.009, year: 2026, status: V, url: PUB_505, source: "IRS Pub. 505 (2026)" },
  addl_medicare_threshold: {
    label: "Additional Medicare threshold (single / MFJ / MFS / HoH)",
    value: { single: 200000, mfj: 250000, mfs: 125000, hoh: 200000 }, year: 2026, status: V, url: PUB_505, source: "IRS Pub. 505 (2026); not indexed",
  },
  // ---------------- Estimated tax / safe harbor ----------------
  est_required_threshold: { label: "Federal estimates required if tax due ≥", value: 1000, year: 2026, status: V, url: IRS_EST_FAQ, source: "IRS Estimated tax FAQ" },
  safe_harbor_current_pct: { label: "Safe harbor: % of current-year tax", value: 0.90, year: 2026, status: V, url: IRS_EST_FAQ, source: "IRS Estimated tax FAQ" },
  safe_harbor_prior_pct: { label: "Safe harbor: % of prior-year tax", value: 1.00, year: 2026, status: V, url: IRS_EST_FAQ, source: "IRS Estimated tax FAQ" },
  safe_harbor_high_income_pct: {
    label: "Safe harbor: % of prior-year tax when prior AGI > $150,000 ($75,000 MFS)",
    value: { pct: 1.10, agi: 150000, agi_mfs: 75000 }, year: 2026, status: V, url: IRS_EST_FAQ, source: "IRS Estimated tax FAQ",
  },
  or_est_required_threshold: { label: "Oregon estimates required if tax due ≥", value: 1000, year: 2026, status: V, url: OR_EST_2026, source: "Oregon 2026 estimated tax instructions" },
  or_safe_harbor: {
    label: "Oregon safe harbor (90% current or 100% prior; no 110% rule stated)",
    value: { current: 0.90, prior: 1.00 }, year: 2026, status: V, url: OR_EST_2026, source: "Oregon 2026 estimated tax instructions",
  },
  // ---------------- Oregon personal income tax ----------------
  or_brackets_single: {
    label: "Oregon Chart S (single/MFS): upper limits 4.75/6.75/8.75%, 9.9% above",
    value: [4550, 11400, 125000], year: 2026, status: V, url: OR_EST_2026, source: "Oregon 2026 estimated tax instructions, Chart S",
  },
  or_brackets_joint: {
    label: "Oregon Chart J (MFJ/HoH): upper limits",
    value: [9100, 22800, 250000], year: 2026, status: V, url: OR_EST_2026, source: "Oregon 2026 estimated tax instructions, Chart J",
  },
  or_rates: { label: "Oregon rates", value: [0.0475, 0.0675, 0.0875, 0.099], year: 2026, status: V, url: OR_EST_2026, source: "Oregon 2026 estimated tax instructions" },
  or_std_deduction: {
    label: "Oregon standard deduction (single / MFJ / MFS / HoH)",
    value: { single: 2900, mfj: 5800, mfs: 2900, hoh: 4650 }, year: 2026, status: V, url: OR_EST_2026, source: "Oregon 2026 estimated tax instructions",
  },
  or_exemption_credit: {
    label: "Oregon personal exemption credit per exemption (none if AGI > $100k single/MFS, $200k joint/HoH)",
    value: { amount: 260, agi_single: 100000, agi_joint: 200000 }, year: 2026, status: V, url: OR_EST_2026, source: "Oregon 2026 estimated tax instructions",
  },
  or_fed_subtraction_max: {
    label: "Oregon federal tax subtraction cap", value: 8750, year: 2026, status: V, url: OR_EST_2026, source: "Oregon 2026 estimated tax instructions",
  },
  or_fed_subtraction_phaseout: {
    label: "Oregon federal tax subtraction phase-out (AGI start, $5k steps of 20%, zero at +$20k) single / joint",
    value: { single: 125000, joint: 250000 }, year: 2025, status: NC, url: OR_40_INST_2025,
    source: "2025 OR-40 instructions Table 4 (2026 table not published yet)", note: "Assumes 2026 uses the same AGI bands as 2025",
  },
  // ---------------- Oregon / local business taxes ----------------
  or_cat: {
    label: "Oregon CAT: register at $750k, file over $1M, $250 + 0.57% over $1M (after 35% subtraction)",
    value: { register: 750000, file: 1000000, base: 250, rate: 0.0057, subtraction: 0.35 }, year: 2026, status: V,
    url: "https://www.oregon.gov/dor/programs/businesses/pages/corporate-activity-tax.aspx", source: "Oregon DOR CAT page",
  },
  sctd_se_rate: {
    label: "South Clackamas Transportation District (Molalla) self-employment tax rate",
    value: 0.005, year: 2026, status: NC, url: "https://www.sctd.org/transit-tax",
    source: "SCTD publishes a self-employment tax form; 0.5% rate from secondary source (Wikipedia), not the SCTD tax code",
    note: "Confirm rate, base and whether your address is inside the district with SCTD (503-829-7000, info@sctd.org)",
  },
  trimet_applies: {
    label: "TriMet self-employment tax applies to Molalla?", value: false, year: 2026, status: NC, url: "https://trimet.org/taxinfo/",
    source: "Molalla withdrew from the TriMet district on 1989-01-01 (now SCTD)", note: "Confirm your address on trimet.org/taxinfo",
  },
  metro_shs: {
    label: "Metro SHS income tax: 1% over $128k single / $205k joint (2026)",
    value: { rate: 0.01, single: 128000, joint: 205000 }, year: 2026, status: V, url: "https://www.portland.gov/revenue/personal-tax",
    source: "Portland Revenue Division", note: "Applies only if you live in, work in, or have income from the Metro district. Molalla is outside Metro; check with Metro's address lookup",
  },
  multnomah_pfa: {
    label: "Multnomah County Preschool for All tax", value: "not_applicable", year: 2026, status: V, url: "https://www.portland.gov/revenue/personal-tax",
    source: "Portland Revenue Division", note: "Multnomah County residents/income only; Molalla is in Clackamas County",
  },
  // ---------------- Depreciation, mileage, home office, info returns ----------------
  sec179_limit: { label: "Section 179 limit / phase-out start", value: { limit: 2560000, phaseout: 4090000 }, year: 2026, status: V, url: RP_25_32, source: "Rev. Proc. 2025-32 §4.24" },
  bonus_depreciation: {
    label: "Bonus depreciation (property acquired after 2025-01-19)", value: 1.0, year: 2026, status: V,
    url: "https://www.irs.gov/newsroom/treasury-irs-issue-guidance-on-the-additional-first-year-depreciation-deduction-amended-as-part-of-the-one-big-beautiful-bill",
    source: "OBBBA §70301; IRS guidance",
  },
  de_minimis_safe_harbor: {
    label: "De minimis safe harbor per item/invoice (no audited financials)", value: 2500, year: 2026, status: NC,
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/tangible-property-final-regulations", source: "Notice 2015-82 (not re-read this session)",
  },
  mileage_rate: {
    label: "Business standard mileage rate (Jan 1–Jun 30 / Jul 1–Dec 31)",
    value: [{ from: "2026-01-01", rate: 0.725 }, { from: "2026-07-01", rate: 0.76 }], year: 2026, status: V,
    url: "https://www.irs.gov/irb/2026-29_irb", source: "Notice 2026-10; Announcement 2026-11 (midyear increase effective 2026-07-01)",
  },
  home_office_simplified: {
    label: "Home office simplified method ($ per sq ft, max sq ft)", value: { rate: 5, max_sqft: 300 }, year: 2026, status: NC,
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/simplified-option-for-home-office-deduction", source: "Rev. Proc. 2013-13 (unchanged since 2013; not re-read this session)",
  },
  form_1099_nec_threshold: {
    label: "1099-NEC/MISC reporting threshold (payments after 2025-12-31)", value: 2000, year: 2026, status: V,
    url: "https://www.irs.gov/faqs/small-business-self-employed-other-business/form-1099-nec-independent-contractors/form-1099-nec-independent-contractors",
    source: "IRS 1099-NEC FAQ (OBBBA)",
  },
  form_1099_k_threshold: {
    label: "1099-K threshold (over $20,000 AND over 200 transactions)", value: { amount: 20000, count: 200 }, year: 2026, status: V,
    url: "https://www.irs.gov/publications/p1099", source: "IRS Pub. 1099 (2026)",
  },
  receipt_threshold: {
    label: "Keep receipts for travel/gift/meal expenses of", value: 75, year: 2026, status: NC, url: "https://www.irs.gov/publications/p463", source: "IRS Pub. 463 (not re-read this session)",
  },
  meals_deductible_pct: { label: "Business meals deductible share", value: 0.5, year: 2026, status: NC, url: "https://www.irs.gov/publications/p463", source: "IRC §274(n) (not re-read this session)" },
  // ---------------- S-corp what-if (payroll) ----------------
  fica_employee_rate: { label: "FICA (each side): 6.2% SS + 1.45% Medicare", value: { ss: 0.062, medicare: 0.0145 }, year: 2026, status: V, url: PUB_505, source: "IRC §3101/§3111" },
  futa: { label: "FUTA net rate on first $7,000 (after 5.4% state credit)", value: { rate: 0.006, base: 7000 }, year: 2026, status: NC, url: "https://www.irs.gov/taxtopics/tc759", source: "IRC §3301; Oregon assumed not a credit-reduction state" },
  or_ui: {
    label: "Oregon UI: new-employer rate / taxable wage base", value: { rate: 0.024, base: 56700 }, year: 2026, status: V, url: OED_RATES,
    source: "Oregon Employment Dept. current rates", note: "Corporate officers may be able to elect exemption; ask a payroll provider",
  },
  or_paid_leave: {
    label: "Paid Leave Oregon: 1% of wages up to $184,500 (employee 60%, employer 40% only with 25+ employees)",
    value: { rate: 0.01, base: 184500, employee_share: 0.6, employer_share_small: 0 }, year: 2026, status: NC, url: OED_RATES,
    source: "Oregon Employment Dept. (1% and base verified; the split was not on the page)",
  },
  or_statewide_transit: {
    label: "Oregon statewide transit tax (employee withholding)", value: 0.001, year: 2026, status: NC,
    url: "https://www.oregon.gov/dor/programs/businesses/pages/statewide-transit-tax.aspx", source: "Oregon DOR (rate not re-read this session)",
  },
  or_scorp_minimum: { label: "Oregon S-corp minimum tax", value: 150, year: 2026, status: NC, url: "https://www.oregon.gov/dor/programs/businesses/Pages/corp-tax.aspx", source: "ORS 317.090 (not re-read this session)" },
};

// Estimated-payment due dates (federal 1040-ES and Oregon OR-40-V share them).
export const DUE_DATES = {
  2026: {
    status: V, url: TAS_EST_2026, source: "IRS Taxpayer Advocate (2026 dates); Oregon 2026 estimated tax instructions",
    dates: [
      { q: 1, date: "2026-04-15", covers: "Jan 1 – Mar 31" },
      { q: 2, date: "2026-06-15", covers: "Apr 1 – May 31" },
      { q: 3, date: "2026-09-15", covers: "Jun 1 – Aug 31" },
      { q: 4, date: "2027-01-15", covers: "Sep 1 – Dec 31" },
    ],
  },
  2027: {
    status: NC, url: IRS_EST_FAQ, source: "Computed from the 15th rule with weekend/holiday roll-forward; 2027 Form 1040-ES not yet released",
    dates: [
      { q: 1, date: "2027-04-15", covers: "Jan 1 – Mar 31" },
      { q: 2, date: "2027-06-15", covers: "Apr 1 – May 31" },
      { q: 3, date: "2027-09-15", covers: "Jun 1 – Aug 31" },
      { q: 4, date: "2028-01-18", covers: "Sep 1 – Dec 31 (Jan 15 2028 is a Saturday; Jan 17 is MLK Day)" },
    ],
  },
};

export const DISCLAIMER =
  "Estimates — verify with a tax professional before filing. Decision support only: Møthership never files a return, never moves money and is not a CPA.";

// Merge saved overrides over the defaults. Returns { key: { ...entry, value, overridden } }.
export function resolveConfig(overrides = {}) {
  const out = {};
  Object.entries(TAX_CONFIG).forEach(([k, entry]) => {
    const has = overrides && Object.prototype.hasOwnProperty.call(overrides, k) && overrides[k] !== null && overrides[k] !== "";
    out[k] = { ...entry, key: k, value: has ? overrides[k] : entry.value, overridden: has };
  });
  return out;
}

export const configValue = (cfg, key) => (cfg[key] ? cfg[key].value : undefined);

export const needsConfirmation = () =>
  Object.entries(TAX_CONFIG).filter(([, e]) => e.status === NC).map(([k, e]) => ({ key: k, ...e }));
