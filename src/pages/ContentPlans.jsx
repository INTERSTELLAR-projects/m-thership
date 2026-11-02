import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, CircleAlert, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useList } from "@/lib/useData";
import { cn } from "@/lib/utils";
import { isContentPlanJob, nextPostDue, fmtDay, normalizeContentPlan } from "@/features/claude/contentPlan";
import { PipelineSteps } from "@/features/clients/ContentPlanTab";

const STATUS_TONE = { approved: "bg-green-100 text-green-800", draft: "bg-[#ff6a00]/15 text-[#c24100]", none: "bg-ink/[0.06] text-ink/50" };
const AUTO_TONE = { active: "text-green-700", paused: "text-amber-700", not_set_up: "text-ink/40" };
const AUTO_LABEL = { active: "running", paused: "paused", not_set_up: "not set up" };

const cadence = (part) => {
  if (!part || part.enabled === false) return "";
  const days = (part.days || []).filter(Boolean);
  return days.length ? days.join(" + ") : part.frequency || "";
};
const contracted = (client, type) => {
  const s = (client.blogSchedule || []).find((x) => new RegExp(type, "i").test(x.type || ""));
  return s ? `${s.count} ${s.frequency || ""}`.trim() : "";
};

export default function ContentPlans() {
  const clients = useList("CRMClient", { sort: "business", limit: 300 });
  const plans = useList("ContentPlan", { sort: "-version", limit: 500 });
  const jobs = useList("ClaudeJob", { sort: "-created_date", limit: 300, filter: { kind: "content_plan" } });
  const autos = useList("Automation", { sort: "-created_date", limit: 500 });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("active");

  const rows = useMemo(() => (clients.data || [])
    .filter((c) => (filter === "all" ? c.status !== "Lead" : c.status === "Active"))
    .filter((c) => !q || c.business.toLowerCase().includes(q.toLowerCase()))
    .map((c) => {
      const mine = (plans.data || []).filter((p) => p.client_id === c.id);
      const approved = mine.find((p) => p.status === "approved");
      const pendingJob = (jobs.data || []).find((j) => j.client_id === c.id && isContentPlanJob(j) && ["queued", "running", "needs_approval", "changes_requested"].includes(j.status));
      const status = approved ? "approved" : mine.some((p) => p.status === "draft") || pendingJob ? "draft" : "none";
      const plan = approved ? normalizeContentPlan(approved) : null;
      const a = (autos.data || []).filter((x) => x.client_id === c.id);
      // Only submission-driven page tasks count (a city-page batch task is not a submission pipeline).
      const projectAuto = a.find((x) => x.kind === "project_page" && /submission|job|project/i.test(x.name || ""));
      const projectsOn = !!(approved && approved.projects && approved.projects.enabled) || projectAuto?.status === "active";
      const projectsSetup = !projectsOn && projectAuto?.status === "setup";
      const contentAutos = a.filter((x) => x.kind === "blog" || x.kind === "gbp_post").map((x) => x.name);
      return {
        client: c,
        status,
        approved,
        blog: plan ? cadence(plan.blog) : "",
        gbp: plan ? cadence(plan.gbp) : "",
        blogContracted: contracted(c, "blog"),
        gbpContracted: contracted(c, "gbp"),
        next: plan ? nextPostDue(plan) : null,
        projectsOn,
        projectsSetup,
        projectNote: approved?.projects?.publish_url_pattern || projectAuto?.name || "",
        automation: approved?.automation_name || contentAutos.join(" · "),
        automationStatus: approved?.automation_status || "",
      };
    }), [clients.data, plans.data, jobs.data, autos.data, q, filter]);

  const loading = clients.isLoading || plans.isLoading;
  const counts = { approved: rows.filter((r) => r.status === "approved").length, draft: rows.filter((r) => r.status === "draft").length, none: rows.filter((r) => r.status === "none").length };
  const noPipeline = rows.filter((r) => !r.projectsOn);

  return (
    <div className="pb-16">
      <PageHeader breadcrumb="Signals / Content Plans" rightText={`${rows.length} clients`} />
      <div className="space-y-6 px-5 pt-6 md:px-8">
        <div className="grid gap-3 sm:grid-cols-4">
          {[["Approved plans", counts.approved, "text-green-700"], ["Drafts in review", counts.draft, "text-[#c24100]"], ["No plan yet", counts.none, "text-ink/60"], ["No project pipeline", noPipeline.length, "text-amber-700"]].map(([l, v, tone]) => (
            <div key={l} className="rounded-md border border-hair bg-card p-3">
              <p className="mono-label text-[8.5px] text-ink/45">{l}</p>
              <p className={cn("mt-1 text-[26px] font-semibold tabular-nums tracking-[-0.04em]", tone)}>{loading ? "…" : v}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 rounded-sm border border-hair bg-card px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-ink/40" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a client" className="w-48 bg-transparent text-[13px] outline-none" />
          </label>
          <div className="flex rounded-sm border border-hair text-[12px]">
            {[["active", "Active clients"], ["all", "All clients"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setFilter(k)} className={cn("px-3 py-1.5", filter === k ? "bg-ink text-white" : "text-ink/60")}>{l}</button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border border-hair bg-card">
          <table className="w-full min-w-[980px] text-left">
            <thead className="mono-label border-b border-hair text-[8.5px] text-ink/45">
              <tr>
                <th className="px-4 py-2">Client</th><th className="px-3">Plan</th><th className="px-3">Blog</th><th className="px-3">GBP</th><th className="px-3">Next post due</th><th className="px-3">Project pages</th><th className="px-3">Runs on</th><th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-[13px] text-ink/45">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-[13px] text-ink/45">No clients match.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.client.id} className="border-t border-hair align-top text-[12.5px] hover:bg-ink/[0.02]">
                  <td className="px-4 py-2.5">
                    <Link to={`/clients/${r.client.id}?tab=content`} className="font-medium hover:text-[#ff3c00]">{r.client.business}</Link>
                    <p className="text-[11px] text-ink/45">{r.client.domain || (r.client.websites || [])[0] || "no website"}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn("mono-label rounded-sm px-1.5 py-0.5 text-[8.5px]", STATUS_TONE[r.status])}>{r.status === "approved" ? `approved v${r.approved.version || 1}` : r.status}</span>
                  </td>
                  <td className="px-3 py-2.5">{r.blog || <span className="text-ink/35">—</span>}{r.blogContracted && <p className="text-[10.5px] text-ink/40">contracted {r.blogContracted}</p>}</td>
                  <td className="px-3 py-2.5">{r.gbp || <span className="text-ink/35">—</span>}{r.gbpContracted && <p className="text-[10.5px] text-ink/40">contracted {r.gbpContracted}</p>}</td>
                  <td className="px-3 py-2.5">
                    {r.next ? <><span className="font-medium">{fmtDay(r.next.due)}</span><p className="max-w-[220px] truncate text-[11px] text-ink/50" title={r.next.title}>{r.next.title}</p></> : <span className="text-ink/35">—</span>}
                    {r.next && r.automationStatus === "paused" && <p className="text-[10.5px] text-amber-700">task paused</p>}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.projectsOn ? <span className="text-green-700">on</span> : r.projectsSetup ? <span className="text-[#c24100]">being set up</span> : <span className="inline-flex items-center gap-1 text-amber-700"><CircleAlert className="h-3 w-3" /> no pipeline</span>}
                    {r.projectNote && <p className="max-w-[180px] truncate font-mono text-[10.5px] text-ink/45">{r.projectNote}</p>}
                  </td>
                  <td className="max-w-[260px] px-3 py-2.5">
                    {r.automation ? <p className="text-[12px] text-ink/75">{r.automation}</p> : <span className="text-ink/35">—</span>}
                    {r.automationStatus && <p className={cn("mono-label text-[8.5px]", AUTO_TONE[r.automationStatus])}>{AUTO_LABEL[r.automationStatus]}</p>}
                  </td>
                  <td className="px-3 py-2.5"><Link to={`/clients/${r.client.id}?tab=content`} className="text-ink/30 hover:text-[#ff3c00]" aria-label="Open content plan"><ArrowUpRight className="h-4 w-4" /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-md border border-hair bg-card p-4">
            <div className="mb-3 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#ff3c00]" strokeWidth={1.75} /><h3 className="text-[14px] font-semibold tracking-[-0.02em]">Project submissions → website pages</h3></div>
            <PipelineSteps />
          </section>
          <section className="rounded-md border border-amber-200 bg-amber-50/50 p-4">
            <p className="mono-label mb-2 text-[8.5px] text-amber-800">clients with no submission → page pipeline yet</p>
            {noPipeline.length ? (
              <ul className="space-y-1">
                {noPipeline.map((r) => (
                  <li key={r.client.id} className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                    <Link to={`/clients/${r.client.id}?tab=content`} className="hover:text-[#ff3c00]">{r.client.business}</Link>
                    <span className="text-[11px] text-ink/50">{r.projectsSetup ? "publishing task being set up" : r.client.ops_app_id ? "has an ops app, no publishing task" : "no ops / portal app"}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[12.5px] text-ink/60">Every client listed has one.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
