// Upgrade Store client API: every call goes to the `addons` backend function. On the preview sandbox with ?qa=1 the
// calls are answered by qaFixtures.js instead (fake data, never the live app).
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { IS_QA } from "@/lib/qa";
import { qaAddonsInvoke } from "./qaFixtures";

export async function addonsCall(action, args = {}) {
  if (IS_QA) return qaAddonsInvoke({ action, ...args });
  return (await base44.functions.invoke("addons", { action, ...args })).data;
}

export const errText = (e, fallback = "Something went wrong. Try again in a moment.") => e?.response?.data?.error || e?.message || fallback;

// The client's store (portal). scopeId = admin preview id or the business a package-deal owner picked.
export function useAddonStore(scopeId, { enabled = true } = {}) {
  const q = useQuery({
    queryKey: ["addons", "store", scopeId || "me"],
    queryFn: () => addonsCall("store", { client_id: scopeId }),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
  return { store: q.data, addons: q.data?.addons || [], loading: q.isLoading, refetch: q.refetch };
}

export const usd = (n) => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function priceLine(a) {
  if (!a?.plans?.length) return "Pricing coming soon";
  const p = a.plans[0];
  if (p.plan === "one_time") return `${usd(p.one_time)} one-time`;
  if (p.plan === "monthly") return `${usd(p.monthly)}/mo`;
  return `${usd(p.one_time)} setup + ${usd(p.monthly)}/mo`;
}

export function trialLine(t) {
  if (!t || t.mode === "none") return "";
  if (t.mode === "one_use") return "Try it once, free";
  if (t.mode === "uses") return `${t.uses_total} free tries`;
  return `${t.days_total}-day free trial`;
}

export function stateLabel(a) {
  const t = a?.trial || {};
  if (a.state === "active") return { text: "Active", tone: "green" };
  if (a.state === "trial") {
    if (t.uses_left != null) return { text: `Trial · ${t.uses_left} ${t.uses_left === 1 ? "try" : "tries"} left`, tone: "flame" };
    if (t.days_left != null) return { text: `Trial · ${t.days_left} ${t.days_left === 1 ? "day" : "days"} left`, tone: "flame" };
    return { text: "Trial", tone: "flame" };
  }
  if (a.state === "trial_ended") return { text: "Free try used", tone: "amber" };
  if (a.state === "canceled") return { text: "Ended", tone: "muted" };
  return { text: t.available ? "Free try" : "New", tone: "muted" };
}

// Home spotlight -> Upgrades tab: remember which add-on to open (per tab session).
const OPEN_KEY = "ms_addon_open";
export const rememberOpen = (key) => { try { sessionStorage.setItem(OPEN_KEY, key); } catch { /* storage blocked */ } };
export const takeOpen = () => { try { const k = sessionStorage.getItem(OPEN_KEY) || ""; sessionStorage.removeItem(OPEN_KEY); return k; } catch { return ""; } };
