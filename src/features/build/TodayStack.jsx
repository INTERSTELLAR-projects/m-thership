// Command, below the quick-add bar: only what needs Justin today, then every build in progress.
//   Needs you · taste calls, hard gates, client requests, builds waiting on him, anything broken or failing.
//   Logic items never show here: the taste rule decides them (see "Decided for you").
//   Builds · every client build in progress as a progress bar (lead builds + new-client prep).
import { Link } from "react-router-dom";
import { Palette, ShieldAlert, ClipboardList, Hammer, AlertTriangle, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { useList } from "@/lib/useData";
import { laneForJob, laneForLaunchItem } from "@/lib/approvalLanes";
import { PrepBoard } from "@/features/prep/PrepChecklist";
import ErrorBoundary from "@/components/ErrorBoundary";
import { isHeld } from "./engine";

const BUILD_KINDS = new Set(["lead_build", "checklist_item", "build_website", "build_app"]);

function Row({ icon: Icon, label, n, hint, to, tone }) {
  if (!n) return null;
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#ff3c00]/[0.04]">
        <Icon className={`h-4 w-4 shrink-0 ${tone || "text-ink/55"}`} />
        <span className="min-w-0 flex-1"><span className="text-[13.5px] font-medium">{label}</span><span className="block truncate text-[11.5px] text-ink/50">{hint}</span></span>
        <span className="font-mono text-[15px] font-semibold tabular-nums">{n}</span>
        <ArrowUpRight className="h-3.5 w-3.5 text-ink/30" />
      </Link>
    </li>
  );
}

export function NeedsToday() {
  const jobsQ = useList("ClaudeJob", { sort: "-created_date", limit: 300 });
  const launchQ = useList("LaunchItem", { filter: { owner: "justin", status: { $in: ["todo", "in_progress", "waiting"] } }, limit: 300 });
  const postsQ = useList("SocialPost", { filter: { status: "draft" }, limit: 100 });
  const reqQ = useList("ClientRequest", { filter: { status: { $in: ["received", "needs_info"] } }, limit: 200 });
  const autoQ = useList("Automation", { filter: { status: "error" }, limit: 200 });
  const jobs = jobsQ.data || [];
  const review = jobs.filter((j) => ["needs_approval", "needs_review"].includes(j.status));
  const taste = review.filter((j) => laneForJob(j) === "taste" && !BUILD_KINDS.has(j.kind)).length + (launchQ.data || []).filter((i) => laneForLaunchItem(i) === "taste").length + (postsQ.data || []).length;
  const gates = review.filter((j) => laneForJob(j) === "gate").length + (launchQ.data || []).filter((i) => laneForLaunchItem(i) === "gate").length;
  const builds = review.filter((j) => BUILD_KINDS.has(j.kind)).length;
  const failed = jobs.filter((j) => j.status === "failed").length + (autoQ.data || []).length;
  const reqs = (reqQ.data || []).length;
  const loading = jobsQ.isLoading || launchQ.isLoading;
  const none = !loading && !taste && !gates && !builds && !failed && !reqs;
  return (
    <section className="border border-hair bg-paper/80" aria-label="Needs you today" data-testid="needs-today">
      <header className="flex items-center justify-between border-b border-hair px-4 py-2.5">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Needs you today</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/40">Taste + hard gates only</span>
      </header>
      {loading ? <p className="px-4 py-4 text-[12.5px] text-ink/45">Loading…</p> : none ? (
        <p className="flex items-center gap-2 px-4 py-4 text-[13px] text-ink/60"><CheckCircle2 className="h-4 w-4 text-green-700" />Nothing needs you right now.</p>
      ) : (
        <ul className="divide-y divide-hair">
          <Row icon={Palette} label="Taste calls" n={taste} hint="Look, feel, brand tone: designs, posts, brand kits" to="/launch?tab=approvals" tone="text-[#ff3c00]" />
          <Row icon={ShieldAlert} label="Hard gates" n={gates} hint="Publish, DNS, delete, money, client sends, your logins" to="/launch" tone="text-amber-700" />
          <Row icon={ClipboardList} label="Client requests" n={reqs} hint="New or waiting on info" to="/requests" />
          <Row icon={Hammer} label="Builds waiting on you" n={builds} hint="Build stages ready for your look" to="/claude" />
          <Row icon={AlertTriangle} label="Broken or failing" n={failed} hint="Failed Claude jobs and automations in error" to="/automations" tone="text-red-700" />
        </ul>
      )}
    </section>
  );
}

export function BuildsInProgress() {
  const jobsQ = useList("ClaudeJob", { filter: { kind: { $in: ["lead_build", "build_website", "build_app"] } }, sort: "-created_date", limit: 60 });
  const live = (jobsQ.data || []).filter((j) => !["approved", "done", "cancelled"].includes(j.status));
  const pctOf = (j) => (j.status === "queued" ? 5 : j.status === "running" ? 40 : ["needs_approval", "needs_review"].includes(j.status) ? 80 : 0);
  return (
    <section className="space-y-3" aria-label="Builds in progress" data-testid="builds-in-progress">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Builds in progress</h2>
      {live.length ? (
        <ul className="divide-y divide-hair border border-hair bg-paper/80">
          {live.map((j) => (
            <li key={j.id} className="px-4 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <Link to={j.client_id ? `/clients/${j.client_id}` : `/claude?job=${j.id}`} className="truncate text-[13.5px] font-medium hover:text-[#ff3c00]">{j.client_name || j.title}</Link>
                <span className="shrink-0 font-mono text-[10.5px] text-ink/45">{isHeld(j) ? "queued · waits for step 3" : String(j.status).replace(/_/g, " ")}</span>
              </div>
              <div className="mt-1.5 h-1.5 bg-ink/[0.08]"><div className="h-full bg-[#ff3c00]" style={{ width: `${pctOf(j)}%` }} /></div>
            </li>
          ))}
        </ul>
      ) : null}
      <ErrorBoundary compact where="client prep"><PrepBoard /></ErrorBoundary>
    </section>
  );
}
