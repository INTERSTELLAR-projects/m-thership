// Calls to the portal-terms function (docs/portal-terms.md).
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export async function terms(action, args = {}) {
  try {
    const r = await base44.functions.invoke("portal-terms", { action, ...args });
    if (r?.data?.error) throw new Error(r.data.error);
    return r?.data || {};
  } catch (e) {
    throw new Error(e?.response?.data?.error || e?.message || "Terms request failed");
  }
}

export const useTermsVersions = () => useQuery({ queryKey: ["terms", "versions"], queryFn: () => terms("versions"), staleTime: 15_000 });
export const useClientTerms = (clientId) => useQuery({ queryKey: ["terms", "client", clientId], queryFn: () => terms("client_status", { client_id: clientId }), enabled: !!clientId, staleTime: 30_000 });
export const useTermsSummary = () => useQuery({ queryKey: ["terms", "summary"], queryFn: () => terms("summary"), staleTime: 60_000, retry: false });

export async function openAcceptancePdf(id) {
  const { url } = await terms("pdf_link", { acceptance_id: id });
  if (url) window.open(url, "_blank", "noopener");
}

export const fmtWhen = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }); } catch { return iso; }
};
