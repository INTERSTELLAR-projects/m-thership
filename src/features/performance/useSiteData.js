import { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useList, useInvalidate } from "@/lib/useData";
import { siteUrl } from "./policy";

// Everything the Performance dashboard reads. All real records; nothing is derived from guesses.
export function useSiteData() {
  const clients = useList("CRMClient", { sort: "business", limit: 300 });
  const audits = useList("SiteAudit", { sort: "-run_at", limit: 1000 });
  const fixes = useList("SeoFix", { sort: "-updated_date", limit: 1000 });
  const gaps = useList("ClientGap", { sort: "-created_date", limit: 1000 });
  const snaps = useList("PerformanceSnapshot", { sort: "-period_end", limit: 1000 });
  const work = useList("WorkLog", { sort: "-date", limit: 2000 });
  const invalidate = useInvalidate();

  const sites = useMemo(() => (clients.data || []).filter((c) => c.status === "Active" && siteUrl(c)
    && ((c.services_managed || []).includes("website") || (c.services_managed || []).includes("orbit_seo"))), [clients.data]);

  const byClient = useMemo(() => {
    const group = (rows) => {
      const m = new Map();
      (rows || []).forEach((r) => { if (!m.has(r.client_id)) m.set(r.client_id, []); m.get(r.client_id).push(r); });
      return m;
    };
    return { audits: group(audits.data), fixes: group(fixes.data), gaps: group(gaps.data), snaps: group(snaps.data), work: group(work.data) };
  }, [audits.data, fixes.data, gaps.data, snaps.data, work.data]);

  return {
    loading: clients.isLoading || audits.isLoading,
    sites,
    allAudits: audits.data || [],
    allFixes: fixes.data || [],
    allWork: work.data || [],
    byClient,
    refresh: () => invalidate("SiteAudit", "SeoFix", "ClaudeJob", "WorkLog", "ClientGap"),
  };
}

export async function runAudit(clientId, { strategy = "mobile", force = false } = {}) {
  const res = await base44.functions.invoke("site-audit", { action: "run", client_id: clientId, strategy, mode: "manual", force });
  return res?.data || {};
}

export async function runDueAudits() {
  const res = await base44.functions.invoke("site-audit", { action: "run_due", max_age_days: 7, limit: 3 });
  return res?.data || {};
}

// Latest completed audit for a strategy, plus the one before it (for deltas).
export function latestPair(audits = [], strategy = "mobile") {
  const list = audits.filter((a) => (a.strategy || "mobile") === strategy && a.status !== "failed")
    .sort((a, b) => String(b.run_at).localeCompare(String(a.run_at)));
  return [list[0] || null, list[1] || null];
}
