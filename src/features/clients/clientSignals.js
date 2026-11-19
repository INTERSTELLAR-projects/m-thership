// One pass over the records the Clients list needs, grouped per client: Brain %, pillars (weakest), build status,
// live Stripe MRR vs committed, and a needs-attention flag with its reasons. Real data only.
import { useMemo } from "react";
import { useList } from "@/lib/useData";
import { scorePillars, weakestPillar, automationIssue } from "@/lib/clientPillars";
import { isHeld } from "@/features/build/engine";

const group = (rows) => { const m = new Map(); (rows || []).forEach((r) => { if (!r.client_id) return; if (!m.has(r.client_id)) m.set(r.client_id, []); m.get(r.client_id).push(r); }); return m; };

// Live MRR = active/trialing Stripe subscription lines. Committed = monthly lines not in Stripe yet (and the won
// deal's monthly when there are no lines). Committed never adds to the Stripe number.
export function mrrOf(c) {
  const lines = c.services || [];
  const stripe = lines.filter((l) => l.stripe && ["active", "trialing"].includes(String(l.status || "active"))).reduce((t, l) => t + (Number(l.price) || 0), 0);
  let committed = lines.filter((l) => !l.stripe && l.interval !== "one_time" && l.interval !== "once" && !l.discontinued && !l.included && !["canceled", "cancelled", "ended", "not_started"].includes(String(l.status || ""))).reduce((t, l) => t + (Number(l.price) || 0), 0);
  if (!committed && !stripe && c.deal_monthly && c.deal_monthly.plan !== "none") committed = Number(c.deal_monthly.amount) || 0;
  return { stripe, committed };
}

export function useClientSignals(clients) {
  const brains = useList("BusinessBrain", { limit: 500, sort: "-updated_date" });
  const autos = useList("Automation", { limit: 1500 });
  const gaps = useList("ClientGap", { limit: 1500 });
  const reqs = useList("ClientRequest", { limit: 1000 });
  const work = useList("WorkLog", { limit: 2000, sort: "-date" });
  const preps = useList("PrepChecklist", { limit: 300 });
  const jobs = useList("ClaudeJob", { limit: 600, sort: "-created_date" });
  return useMemo(() => {
    const b = group(brains.data), a = group(autos.data), g = group(gaps.data), r = group(reqs.data), w = group(work.data), p = group(preps.data), j = group(jobs.data);
    const out = {};
    const now = Date.now();
    for (const c of clients || []) {
      const brain = (b.get(c.id) || [])[0] || null;
      const pillars = scorePillars({ brain, automations: a.get(c.id), gaps: g.get(c.id), requests: r.get(c.id), work: w.get(c.id), now });
      const weak = weakestPillar(pillars);
      const myJobs = j.get(c.id) || [];
      const prep = (p.get(c.id) || []).find((x) => x.status === "active");
      const build = myJobs.find((x) => ["lead_build", "build_website", "build_app"].includes(x.kind) && !["approved", "done", "cancelled"].includes(x.status));
      const buildStatus = build ? (isHeld(build) ? "Build queued" : `Build ${String(build.status).replace(/_/g, " ")}`) : prep ? `Prep ${(prep.steps || []).filter((s) => s.done).length}/${(prep.steps || []).length || 15}` : c.status === "Lead" ? (c.scrape_summary ? "Scraped" : "Lead") : "Live";
      const reasons = [];
      const broken = (a.get(c.id) || []).map((x) => automationIssue(x, now)).filter((x) => x && ["failed", "overdue", "never"].includes(x.kind));
      if (broken.length) reasons.push(`${broken.length} automation${broken.length === 1 ? "" : "s"} failing or late`);
      if (myJobs.some((x) => x.status === "failed")) reasons.push("a Claude job failed");
      const oldReq = (r.get(c.id) || []).filter((x) => ["received", "needs_info"].includes(x.status) && now - Date.parse(x.created_date || now) > 3 * 864e5).length;
      if (oldReq) reasons.push(`${oldReq} request${oldReq === 1 ? "" : "s"} waiting 3d+`);
      if (weak && weak.tone === "red") reasons.push(`${weak.name} is red`);
      out[c.id] = { brainPct: brain ? Number(brain.completeness) || 0 : null, pillars, weak, buildStatus, attention: reasons, mrr: mrrOf(c) };
    }
    return out;
  }, [clients, brains.data, autos.data, gaps.data, reqs.data, work.data, preps.data, jobs.data]);
}
