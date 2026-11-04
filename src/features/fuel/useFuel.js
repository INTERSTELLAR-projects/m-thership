// Fuel (Studios meter + Refuel wallet) for the client portal. Every number comes from the `fuel` backend function;
// nothing here decides access (the server refuses locked / out-of-fuel work on its own).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export const fuelCall = async (action, args = {}) => (await base44.functions.invoke("fuel", { action, ...args })).data;

export function useFuel(scopeId, { enabled = true } = {}) {
  const qc = useQueryClient();
  const key = ["portal", scopeId, "fuel"];
  const q = useQuery({
    queryKey: key, enabled, retry: false, staleTime: 30_000, refetchOnWindowFocus: true,
    queryFn: () => fuelCall("summary", { client_id: scopeId }),
  });
  return { fuel: q.data && q.data.visible ? q.data : null, loading: q.isLoading, refresh: () => qc.invalidateQueries({ queryKey: key }) };
}

export const fmt = (n) => (n == null ? "Unlimited" : Number(n).toLocaleString("en-US"));
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

// "ok" | "alert" (80%+) | "out" (allowance + wallet at 0)
export function fuelTone(f) {
  if (!f) return "ok";
  if (f.out_of_fuel) return "out";
  if (f.alert) return "alert";
  return "ok";
}

// Share of fuel left across allowance + wallet, for one kind (0..1). Unlimited = 1.
export function leftShare(k) {
  if (!k || k.cap == null) return 1;
  const tank = (k.cap || 0) + (k.wallet || 0);
  if (!tank) return 0;
  return Math.max(0, Math.min(1, (k.left || 0) / tank));
}
