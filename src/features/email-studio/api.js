// Client Email Studio data layer: every call goes to the `email-client` function, scoped to the portal's client
// (scopeId = admin preview id or the business a package-deal owner picked).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export const errMsg = (e, fallback = "Something went wrong. Try again.") => e?.response?.data?.error || e?.message || fallback;

export function useEmailStudio(scopeId) {
  const qc = useQueryClient();
  const call = async (action, args = {}) => (await base44.functions.invoke("email-client", { action, client_id: scopeId, ...args })).data;
  const key = ["email-studio", scopeId || "me"];
  const overview = useQuery({ queryKey: [...key, "overview"], queryFn: () => call("overview"), retry: false, staleTime: 15_000 });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  return { call, overview, refresh, key };
}

export const pct = (n) => (n == null || Number.isNaN(Number(n)) ? "–" : `${Number(n).toFixed(Number(n) >= 10 || Number(n) === 0 ? 0 : 1)}%`);
export const num = (n) => Number(n || 0).toLocaleString("en-US");

export function fmtWhen(iso, tz) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...(tz ? { timeZone: tz, timeZoneName: "short" } : {}) });
  } catch { return iso; }
}
export const ago = (iso) => {
  if (!iso) return "never";
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const FALLBACK_TZ = ["America/Los_Angeles", "America/Denver", "America/Phoenix", "America/Chicago", "America/New_York", "America/Anchorage", "Pacific/Honolulu", "America/Toronto", "America/Vancouver", "Europe/London", "Europe/Berlin", "Australia/Sydney"];
export const TIMEZONES = (() => {
  try {
    const all = Intl.supportedValuesOf("timeZone");
    const us = FALLBACK_TZ.filter((z) => all.includes(z));
    return [...us, ...all.filter((z) => !us.includes(z) && /^(America|Europe|Australia|Pacific|Asia)\//.test(z))];
  } catch { return FALLBACK_TZ; }
})();

// "YYYY-MM-DDTHH:mm" for <input type="datetime-local">, `mins` from now, in a zone.
export function localInput(mins = 60, tz = "America/Los_Angeles") {
  const d = new Date(Date.now() + mins * 60000);
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  } catch { return d.toISOString().slice(0, 16); }
}
