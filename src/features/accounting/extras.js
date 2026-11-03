// Mileage, home office and depreciation helpers for the projection and the filing pack.
const n0 = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function mileageRateOn(date, cfg) {
  const steps = (cfg.mileage_rate && cfg.mileage_rate.value) || [];
  let rate = steps.length ? steps[0].rate : 0;
  steps.forEach((s) => { if (String(date) >= s.from) rate = s.rate; });
  return rate;
}

export function mileageDeduction(entries, cfg) {
  let miles = 0;
  let deduction = 0;
  (entries || []).forEach((e) => { const m = n0(e.miles); miles += m; deduction += m * mileageRateOn(e.date, cfg); });
  return { miles, deduction };
}

export function homeOfficeDeduction(profile, cfg) {
  const p = profile || {};
  if (p.home_office_method === "simplified") {
    const s = (cfg.home_office_simplified && cfg.home_office_simplified.value) || { rate: 5, max_sqft: 300 };
    const sqft = Math.min(n0(p.home_office_sqft), s.max_sqft);
    return { method: "simplified", sqft, deduction: sqft * s.rate, note: `${sqft} sq ft × $${s.rate} (max ${s.max_sqft} sq ft) — Schedule C line 30` };
  }
  if (p.home_office_method === "regular") {
    const share = n0(p.home_total_sqft) > 0 ? n0(p.home_office_sqft) / n0(p.home_total_sqft) : 0;
    return { method: "regular", sqft: n0(p.home_office_sqft), share, deduction: share * n0(p.home_expenses_annual), note: `${(share * 100).toFixed(1)}% of home expenses — Form 8829, then Schedule C line 30 (depreciation of the home not included)` };
  }
  return { method: "none", sqft: 0, deduction: 0, note: "No home office claimed" };
}

// MACRS half-year convention tables (IRS Pub. 946 Table A-1).
const MACRS = {
  5: [0.2, 0.32, 0.192, 0.1152, 0.1152, 0.0576],
  7: [0.1429, 0.2449, 0.1749, 0.1249, 0.0893, 0.0892, 0.0893, 0.0446],
};
const CLASS_LIFE = { computer: 5, office_equipment: 5, vehicle: 5, furniture: 7, other: 7, software: 3 };

export function assetDeduction(asset, taxYear, cfg) {
  const year = Number(String(asset.placed_in_service || "").slice(0, 4)) || taxYear;
  const basis = n0(asset.cost) * Math.min(100, n0(asset.business_use_pct || 100)) / 100;
  const age = taxYear - year;
  if (age < 0) return { amount: 0, method: "future" };
  const t = asset.treatment || "undecided";
  const deMin = (cfg.de_minimis_safe_harbor && cfg.de_minimis_safe_harbor.value) || 2500;
  if (t === "de_minimis") return { amount: age === 0 ? basis : 0, method: `De minimis safe harbor (≤ $${deMin}/item) — expensed`, line: "Sch C L22 (supplies)" };
  if (t === "section_179") {
    const ok = n0(asset.business_use_pct || 100) > 50;
    return { amount: age === 0 && ok ? basis : 0, method: ok ? "Section 179 — Form 4562 Part I" : "Section 179 needs > 50% business use", line: "Sch C L13" };
  }
  if (t === "bonus" || t === "undecided") {
    const bonus = (cfg.bonus_depreciation && cfg.bonus_depreciation.value) ?? 1;
    return { amount: age === 0 ? basis * bonus : 0, method: t === "undecided" ? "Undecided — projected as 100% bonus (Form 4562 line 14)" : "Bonus depreciation — Form 4562 line 14", line: "Sch C L13" };
  }
  const life = CLASS_LIFE[asset.asset_class] || 7;
  if (life === 3) {
    const months = age === 0 ? 12 - (Number(String(asset.placed_in_service).slice(5, 7)) || 1) + 1 : 12;
    return { amount: age <= 3 ? Math.min(basis, (basis / 36) * months) : 0, method: "Software: straight line over 36 months", line: "Sch C L13" };
  }
  const table = MACRS[life];
  return { amount: age < table.length ? basis * table[age] : 0, method: `MACRS ${life}-year, half-year convention (year ${age + 1})`, line: "Sch C L13 via Form 4562" };
}

export function depreciationForYear(assets, taxYear, cfg) {
  const rows = (assets || []).map((a) => ({ asset: a, ...assetDeduction(a, taxYear, cfg) }));
  return { rows, total: rows.reduce((s, r) => s + r.amount, 0) };
}
