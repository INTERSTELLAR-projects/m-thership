// Data layer for the Accounting & Tax center. Every record is scoped by business_id (and later client_id)
// so the same center can run per client in the portal; today only the agency scope exists and it is admin-only.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { resolveConfig, TAX_YEAR } from "./taxConfig";
import { BUSINESS_ID, CATEGORIES, DEFAULT_RULES, categoryPatch, summarize, plAmount, CAT } from "./ledger";
import { buildPlan, DEFAULT_PROFILE, snapshotForReminders } from "./taxEngine";
import { mileageDeduction, homeOfficeDeduction, depreciationForYear } from "./extras";

const arr = (p) => Promise.resolve(p).then((r) => (Array.isArray(r) ? r : (r && r.items) || [])).catch(() => []);

export const invokeAccounting = (action, payload = {}) =>
  base44.functions.invoke("accounting", { action, ...payload }).then((r) => r.data).catch((e) => ({ error: (e && e.response && e.response.data && e.response.data.error) || (e && e.message) || "Request failed" }));

export default function useAccounting({ businessId = BUSINESS_ID, clientId = null } = {}) {
  const [taxYear, setTaxYear] = useState(() => {
    const now = new Date();
    return now.getMonth() === 0 && now.getDate() <= 31 ? now.getFullYear() - (now.getMonth() === 0 ? 1 : 0) : now.getFullYear();
  });
  const [profile, setProfile] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [rules, setRules] = useState([]);
  const [assets, setAssets] = useState([]);
  const [mileage, setMileage] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const seeded = useRef(false);
  const scope = useMemo(() => ({ business_id: businessId, ...(clientId ? { client_id: clientId } : {}) }), [businessId, clientId]);

  const load = useCallback(async () => {
    const [profiles, rows, ruleRows, assetRows, miles, alertRows, exp] = await Promise.all([
      arr(base44.entities.BusinessTaxProfile.filter(scope, "-updated_date", 1)),
      arr(base44.entities.LedgerTransaction.filter({ ...scope, tax_year: taxYear }, "-date", 5000)),
      arr(base44.entities.LedgerRule.filter(scope, "priority", 1000)),
      arr(base44.entities.AccountingAsset.filter(scope, "-placed_in_service", 500)),
      arr(base44.entities.MileageEntry.filter(scope, "-date", 2000)),
      arr(base44.entities.AccountingAlert.filter({ business_id: businessId }, "-created_date", 50)),
      clientId ? Promise.resolve([]) : arr(base44.entities.Expense.list("platform", 500)),
    ]);
    let ruleList = ruleRows;
    if (!ruleRows.length && !seeded.current) {
      seeded.current = true;
      ruleList = await arr(base44.entities.LedgerRule.bulkCreate(DEFAULT_RULES.map((r) => ({ ...scope, match_field: "any", match_type: "contains", direction: "any", priority: 50, learned: false, active: true, hits: 0, ...r }))));
    }
    setProfile(profiles[0] || null);
    setLedger(rows);
    setRules(ruleList);
    setAssets(assetRows);
    setMileage(miles);
    setAlerts(alertRows);
    setExpenses(exp);
    setLoading(false);
  }, [scope, taxYear, businessId, clientId]);

  useEffect(() => { load(); }, [load]);

  const effectiveProfile = useMemo(() => ({ ...DEFAULT_PROFILE, ...(profile || {}), tax_year: taxYear }), [profile, taxYear]);
  const cfg = useMemo(() => resolveConfig(effectiveProfile.config_overrides || {}), [effectiveProfile.config_overrides]);
  const entityType = effectiveProfile.entity_type || "smllc_schedule_c";
  const mealsShare = cfg.meals_deductible_pct ? cfg.meals_deductible_pct.value : 0.5;

  const saveProfile = useCallback(async (patch) => {
    if (profile && profile.id) {
      const next = { ...profile, ...patch };
      setProfile(next);
      await base44.entities.BusinessTaxProfile.update(profile.id, patch);
      return next;
    }
    const created = await base44.entities.BusinessTaxProfile.create({ ...scope, business_name: DEFAULT_PROFILE.business_name, ...patch });
    setProfile(created);
    return created;
  }, [profile, scope]);

  // ---------- derived ----------
  const live = useMemo(() => ledger.filter((t) => t.review_status !== "excluded"), [ledger]);
  const summary = useMemo(() => summarize(live, { entityType, mealsShare }), [live, entityType, mealsShare]);
  const monthly = useMemo(() => {
    const m = {};
    live.forEach((t) => {
      const c = CAT[t.category];
      if (!c) return;
      const key = String(t.date || "").slice(0, 7);
      const row = m[key] || (m[key] = { key, gross: 0, expenses: 0 });
      const a = plAmount(t, mealsShare);
      if (c.tax === "income" || c.tax === "contra") row.gross += a; else if (a < 0) row.expenses += -a; else row.expenses -= a;
    });
    return Object.values(m).sort((a, b) => a.key.localeCompare(b.key));
  }, [live, mealsShare]);

  const extras = useMemo(() => ({
    mileageYtd: mileageDeduction(mileage.filter((x) => String(x.date || "").startsWith(String(taxYear))), cfg).deduction,
    homeOffice: homeOfficeDeduction(effectiveProfile, cfg).deduction,
    depreciation: depreciationForYear(assets, taxYear, cfg).total,
  }), [mileage, taxYear, cfg, effectiveProfile, assets]);

  const plan = useMemo(() => {
    if (loading) return null;
    return buildPlan({ profile: effectiveProfile, cfg, ytd: summary, monthly, extras, ledger, taxYear });
  }, [loading, effectiveProfile, cfg, summary, monthly, extras, ledger, taxYear]);

  // Persist a compact projection once per load so the reminder function can quote amounts.
  const savedSnap = useRef("");
  useEffect(() => {
    if (!plan || !profile || !profile.id || taxYear !== new Date().getFullYear()) return;
    const snap = snapshotForReminders(plan);
    const sig = JSON.stringify({ ...snap, at: "" });
    if (sig === savedSnap.current) return;
    const prev = profile.last_projection ? JSON.stringify({ ...profile.last_projection, at: "" }) : "";
    savedSnap.current = sig;
    if (prev === sig) return;
    base44.entities.BusinessTaxProfile.update(profile.id, { last_projection: snap }).catch(() => {});
  }, [plan, profile, taxYear]);

  const inbox = useMemo(() => ledger.filter((t) => t.review_status === "needs_review"), [ledger]);

  // ---------- ledger mutations ----------
  const patchRows = useCallback(async (ids, patch) => {
    const set = new Set(ids);
    setLedger((prev) => prev.map((t) => (set.has(t.id) ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)));
    const rows = ledger.filter((t) => set.has(t.id));
    for (let i = 0; i < rows.length; i += 10) {
      await Promise.all(rows.slice(i, i + 10).map((t) => base44.entities.LedgerTransaction.update(t.id, typeof patch === "function" ? patch(t) : patch).catch(() => null)));
    }
  }, [ledger]);

  const addRows = useCallback(async (rows) => {
    const created = [];
    for (let i = 0; i < rows.length; i += 100) created.push(...(await arr(base44.entities.LedgerTransaction.bulkCreate(rows.slice(i, i + 100)))));
    setLedger((prev) => [...created, ...prev].sort((a, b) => String(b.date).localeCompare(String(a.date))));
    return created;
  }, []);

  const deleteRows = useCallback(async (ids) => {
    const set = new Set(ids);
    setLedger((prev) => prev.filter((t) => !set.has(t.id)));
    for (const id of ids) await base44.entities.LedgerTransaction.delete(id).catch(() => null);
  }, []);

  const addRule = useCallback(async (rule) => {
    const created = await base44.entities.LedgerRule.create({ ...scope, match_field: "any", match_type: "contains", direction: "any", priority: 40, active: true, hits: 0, ...rule });
    setRules((prev) => [...prev, created]);
    return created;
  }, [scope]);
  const updateRule = useCallback(async (id, patch) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await base44.entities.LedgerRule.update(id, patch);
  }, []);
  const deleteRule = useCallback(async (id) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    await base44.entities.LedgerRule.delete(id);
  }, []);

  const crud = (entity, setter) => ({
    add: async (row) => { const c = await base44.entities[entity].create({ ...scope, ...row }); setter((p) => [c, ...p]); return c; },
    update: async (id, patch) => { setter((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x))); await base44.entities[entity].update(id, patch); },
    remove: async (id) => { setter((p) => p.filter((x) => x.id !== id)); await base44.entities[entity].delete(id); },
  });

  const dismissAlert = useCallback(async (id, status = "dismissed") => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    await base44.entities.AccountingAlert.update(id, { status }).catch(() => null);
  }, []);

  return {
    loading, reload: load, taxYear, setTaxYear, scope,
    profile: effectiveProfile, rawProfile: profile, profileComplete: !!(profile && profile.completed), saveProfile,
    cfg, entityType, mealsShare, ledger, live, inbox, summary, monthly, extras, plan,
    rules, addRule, updateRule, deleteRule,
    assets, assetsApi: crud("AccountingAsset", setAssets),
    mileage, mileageApi: crud("MileageEntry", setMileage),
    alerts, dismissAlert, expenses,
    patchRows, addRows, deleteRows,
    categoryPatch: (key) => categoryPatch(key, entityType),
    categories: CATEGORIES,
    defaultTaxYear: TAX_YEAR,
  };
}
