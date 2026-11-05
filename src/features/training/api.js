// Training API wrappers. Owners (Justin in Møthership, client owners in the portal) go through the `training`
// function; trainees go through the public `training-player` function with their private link.
import { base44 } from "@/api/base44Client";
import { IS_QA } from "@/lib/qa";
import { qaPlayerInvoke } from "./qaFixtures";

export function trainingApi(scopeId) {
  return async (action, args = {}) => (await base44.functions.invoke("training", { action, ...(scopeId ? { client_id: scopeId } : {}), ...args })).data;
}

export const errText = (e, fallback = "Something went wrong. Try again.") => e?.response?.data?.error || e?.message || fallback;
export const errCode = (e) => e?.response?.data?.code || "";

export async function playerCall(action, args) {
  if (IS_QA) return qaPlayerInvoke(action, args);
  const r = await fetch(`${window.location.origin}/functions/training-player`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...args }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "We couldn't reach your training. Check your connection and try again.");
  return d;
}

export const traineeLink = (a) => `${window.location.origin}/t/${a.id}?k=${a.access_token}`;
