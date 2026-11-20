// The Build section of every client page. Same layout for every client and lead:
//   lead card (scrape → send to build) · build checklist (Website + Command System tracks) · Brain meter with its
//   unlocks · launch grid · growth feed (blogs, GBP posts) · requests.
// The checklist is the client's real BuildChecklist (niche template, ticked by the runner); the Brain unlocks and the
// launch grid are real (ClientUnlock / LaunchListing).
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useList, timeAgo } from "@/lib/useData";
import LeadCard from "./LeadCard";
import BrainUnlocksPanel from "./BrainUnlocksPanel";
import LaunchGridPanel from "./LaunchGridPanel";
import SeasonsOffersPanel from "./SeasonsOffersPanel";
import BuildChecklistPanel from "./BuildChecklistPanel";
import ReadyToPublish from "./ReadyToPublish";

const Panel = ({ title, link, children, testid }) => (
  <section className="border border-hair bg-paper/80" data-testid={testid}>
    <header className="flex items-center justify-between gap-2 border-b border-hair px-4 py-2.5">
      <h3 className="text-[13.5px] font-semibold tracking-[-0.01em]">{title}</h3>
      {link ? <Link to={link.to} className="inline-flex items-center gap-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45 hover:text-[#ff3c00]">{link.label}<ArrowUpRight className="h-3 w-3" /></Link> : null}
    </header>
    {children}
  </section>
);

export default function ClientBuildPage({ client, go }) {
  const brainQ = useList("BusinessBrain", { filter: { client_id: client.id }, limit: 1, sort: "-updated_date" });
  const workQ = useList("WorkLog", { filter: { client_id: client.id }, limit: 40, sort: "-date" });
  const reqQ = useList("ClientRequest", { filter: { client_id: client.id }, limit: 20, sort: "-created_date" });
  const brain = (brainQ.data || [])[0];
  const pct = brain?.completeness ?? client.scrape_summary?.completeness ?? 0;
  // Client posts (projects / testimonials the client sent that went live) join the growth feed; Clients › Client
  // posts stays as the audit trail with Unpublish / Edit.
  const postsQ = useList("ContentSubmission", { filter: { client_id: client.id, status: "live" }, limit: 10, sort: "-published_at" });
  const fromPosts = (postsQ.data || []).filter((p) => !p.is_test).map((p) => ({ id: `cs-${p.id}`, work: p.work_entry_id, title: p.writer_output?.title || `${p.kind} post`, kind: `client ${p.kind}`, date: p.published_at, url: p.published_url }));
  const postWork = new Set(fromPosts.map((p) => p.work).filter(Boolean));
  const growth = [...fromPosts, ...(workQ.data || []).filter((w) => !postWork.has(w.id) && /blog|gbp|post|social/i.test(String(w.kind || w.title || "")))]
    .sort((a, b) => String(b.date || b.created_date || "").localeCompare(String(a.date || a.created_date || ""))).slice(0, 6);
  const jobsQ = useList("ClaudeJob", { filter: { client_id: client.id, kind: { $in: ["lead_build", "checklist_item", "command"] } }, limit: 20, sort: "-created_date" });
  const buildJobs = (jobsQ.data || []).filter((j) => j.kind === "lead_build" || j.build?.ready_to_publish || ["queued", "running", "needs_review"].includes(j.status)).slice(0, 5);
  const reqs = (reqQ.data || []).filter((r) => !["complete", "declined"].includes(r.status)).slice(0, 5);

  return (
    <div className="space-y-4" data-testid="client-build">
      {client.status === "Lead" || client.scrape_summary || client.scrape_status ? <LeadCard client={client} /> : null}

      {buildJobs.length ? (
        <Panel title="Build jobs" link={{ to: "/claude", label: "Claude" }} testid="build-jobs">
          <ul className="divide-y divide-hair">
            {buildJobs.map((j) => (
              <li key={j.id} className="space-y-2 px-4 py-2.5 text-[12.5px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/claude?job=${j.id}`} className="min-w-0 truncate font-medium hover:text-[#ff3c00]">{j.title}</Link>
                  <span className="shrink-0 font-mono text-[10.5px] text-ink/45">{String(j.status).replace(/_/g, " ")} · {timeAgo(j.updated_date || j.created_date)}</span>
                </div>
                {j.result_summary ? <p className="text-ink/60">{j.result_summary}</p> : null}
                {(j.build?.taste_defaults || []).length ? <p className="text-[11.5px] text-[#c24100]">Taste calls left as defaults for you: {j.build.taste_defaults.join("; ")}</p> : null}
                <ReadyToPublish job={j} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="Build checklist" testid="build-checklist">
        <BuildChecklistPanel client={client} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Brain unlocks" link={{ to: `/clients/${client.id}?tab=dossier`, label: "Open Brain" }} testid="brain-meter">
          <BrainUnlocksPanel client={client} pct={pct} />
        </Panel>
        <Panel title="Launch grid" testid="launch-grid">
          <LaunchGridPanel client={client} />
        </Panel>
      </div>

      <Panel title="Seasons & offers" testid="seasons-offers-panel">
        <SeasonsOffersPanel client={client} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Growth feed" link={{ to: `/clients/${client.id}?tab=content`, label: "Content plan" }} testid="growth-feed">
          {growth.length ? (
            <ul className="divide-y divide-hair">{growth.map((w) => <li key={w.id} className="flex items-center justify-between gap-3 px-4 py-2 text-[12.5px]"><span className="min-w-0 truncate">{w.title}</span><span className="shrink-0 font-mono text-[10.5px] text-ink/45">{w.kind} · {timeAgo(w.date || w.created_date)}</span></li>)}</ul>
          ) : <p className="px-4 py-4 text-[12.5px] text-ink/50">No blogs or GBP posts logged yet.</p>}
        </Panel>
        <Panel title="Requests" link={{ to: `/clients/${client.id}?tab=requests`, label: "All requests" }} testid="client-requests">
          {reqs.length ? (
            <ul className="divide-y divide-hair">{reqs.map((r) => <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2 text-[12.5px]"><button type="button" onClick={() => go("requests")} className="min-w-0 truncate text-left hover:text-[#ff3c00]">{r.title || r.form_title || r.category || "Request"}</button><span className="shrink-0 font-mono text-[10.5px] text-ink/45">{String(r.status || "").replace(/_/g, " ")}</span></li>)}</ul>
          ) : <p className="px-4 py-4 text-[12.5px] text-ink/50">No open requests.</p>}
        </Panel>
      </div>
    </div>
  );
}
