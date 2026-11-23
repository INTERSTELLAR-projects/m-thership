// Lead Engine client helpers. Every screen (admin and sales rep) goes through the lead-engine, lead-finder and
// sales-team functions, which check who is calling; reps never read entities directly.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export async function call(fn, action, args = {}) {
  try {
    const r = await base44.functions.invoke(fn, { action, ...args });
    return r?.data || {};
  } catch (e) {
    const msg = e?.response?.data?.error || e?.message || "Something went wrong";
    const err = new Error(msg);
    err.data = e?.response?.data || null;
    err.status = e?.response?.status || 0;
    throw err;
  }
}
export const engine = (action, args) => call("lead-engine", action, args);
export const finder = (action, args) => call("lead-finder", action, args);
export const sales = (action, args) => call("sales-team", action, args);

export const useEngine = (action, args = {}, opts = {}) => useQuery({ queryKey: ["lead-engine", action, args], queryFn: () => engine(action, args), retry: false, staleTime: 15000, ...opts });
export const useFinder = (action, args = {}, opts = {}) => useQuery({ queryKey: ["lead-finder", action, args], queryFn: () => finder(action, args), retry: false, staleTime: 30000, ...opts });
export const useSales = (action, args = {}, opts = {}) => useQuery({ queryKey: ["sales-team", action, args], queryFn: () => sales(action, args), retry: false, staleTime: 15000, ...opts });

export function useRefresh() {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: ["lead-engine"] }); qc.invalidateQueries({ queryKey: ["sales-team"] }); qc.invalidateQueries({ queryKey: ["CRMClient"] }); };
}

export const money = (n) => (n == null || Number.isNaN(Number(n)) ? "—" : `$${Math.round(Number(n)).toLocaleString("en-US")}`);
export const pct = (n) => `${Math.round((Number(n) || 0) * 100)}%`;
export const shortDate = (d) => (d ? new Date(String(d).length <= 10 ? `${d}T12:00:00` : d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—");
export const ago = (d) => {
  if (!d) return "never";
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};
export const mins = (s) => { const n = Math.round((Number(s) || 0) / 60); return n < 1 && s ? "<1 min" : `${n} min`; };
