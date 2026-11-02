import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { computeFinance, todayKey } from "./metrics";

const REFRESH_MS = 5 * 60 * 1000;

const safeInvoke = (name) =>
  base44.functions.invoke(name, {}).then((r) => r?.data || null).catch((e) => e?.response?.data || null);

// Loads every money source once (only when `enabled`), recomputes the roll-up,
// refreshes every 5 minutes and writes one FinanceSnapshot per day.
export default function useFinanceData(enabled = true) {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const started = useRef(false);
  const snapWritten = useRef(false);

  const load = useCallback(async (silent) => {
    if (silent) setRefreshing(true); else setLoading(true);
    const [clients, expenses, projections, snapshots, stripeRev, stripeSubs] = await Promise.all([
      base44.entities.CRMClient.list("-created_date", 500).catch(() => []),
      base44.entities.Expense.list("platform", 500).catch(() => []),
      base44.entities.RevenueProjection.list("-expectedCloseDate", 500).catch(() => []),
      base44.entities.FinanceSnapshot.list("-date", 400).catch(() => []),
      safeInvoke("stripeRevenue"),
      safeInvoke("stripeSubscriptions"),
    ]);
    setRaw({ clients, expenses, projections, snapshots, stripeRev, stripeSubs });
    setUpdatedAt(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    load(false);
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(id);
  }, [enabled, load]);

  const finance = useMemo(() => (raw ? computeFinance(raw) : null), [raw]);

  // One snapshot per day: builds real MRR history going forward.
  useEffect(() => {
    if (!finance || !raw || snapWritten.current) return;
    snapWritten.current = true;
    const today = todayKey();
    if ((raw.snapshots || []).some((s) => s.date === today)) return;
    const per_client = {};
    finance.rows.forEach((r) => { per_client[r.id] = { name: r.name, mrr: Math.round(r.mrr * 100) / 100 }; });
    base44.entities.FinanceSnapshot.create({
      date: today,
      mrr: Math.round(finance.mrr * 100) / 100,
      paying_clients: finance.accounts.length,
      active_clients: finance.activeClients,
      per_client,
      expenses_monthly: Math.round(finance.expensesMonthly * 100) / 100,
      collected_month: finance.collectedThisMonth ?? undefined,
      source: "page",
    }).then((snap) => setRaw((prev) => (prev ? { ...prev, snapshots: [snap, ...(prev.snapshots || [])] } : prev))).catch(() => {});
  }, [finance, raw]);

  return { raw, finance, loading: loading || (enabled && !raw), refreshing, updatedAt, reload: () => load(true) };
}
