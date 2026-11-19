// The Build section of every client page. Same layout for every client and lead:
//   lead card (scrape → send to build) · build checklist (Website + Command System tracks) · Brain meter with its
//   unlocks · launch grid · growth feed (blogs, GBP posts) · requests.
// Checklist items and the launch grid are placeholders until Build Engine step 3 wires them.
import { Link } from "react-router-dom";
import { Check, Lock, ArrowUpRight } from "lucide-react";
import { useList, timeAgo } from "@/lib/useData";
import LeadCard from "./LeadCard";
import { TRACKS, LAUNCH_GRID, unlockState } from "./engine";

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
  const reqs = (reqQ.data || []).filter((r) => !["complete", "declined"].includes(r.status)).slice(0, 5);

  return (
    <div className="space-y-4" data-testid="client-build">
      {client.status === "Lead" || client.scrape_summary || client.scrape_status ? <LeadCard client={client} /> : null}

      <Panel title="Build checklist" testid="build-checklist">
        <div className="grid md:grid-cols-2">
          {TRACKS.map((tr, i) => (
            <div key={tr.key} className={i ? "border-t border-hair md:border-l md:border-t-0" : ""}>
              <p className="flex items-center justify-between px-4 pt-3 text-[12.5px] font-medium">{tr.label}<span className="font-mono text-[10px] text-ink/40">0/{tr.items.length}</span></p>
              <ol className="px-4 pb-3 pt-1">
                {tr.items.map((it, k) => (
                  <li key={it} className="flex items-center gap-2 py-1 text-[12.5px] text-ink/60">
                    <span className="grid h-4 w-4 shrink-0 place-items-center border border-ink/25 text-[9px] text-ink/40">{k + 1}</span>{it}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
        <p className="border-t border-hair px-4 py-2 text-[11.5px] text-ink/45">Placeholder tracks. The build agent (step 3) ticks these as it works; you only see the taste calls and the publish/DNS taps.</p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Brain" link={{ to: `/clients/${client.id}?tab=dossier`, label: "Open Brain" }} testid="brain-meter">
          <div className="px-4 py-3">
            <div className="flex items-baseline justify-between"><span className="text-[12.5px] text-ink/60">What we know</span><span className="font-mono text-[22px] font-semibold tabular-nums">{pct}%</span></div>
            <div className="mt-2 h-2 bg-ink/[0.08]"><div className="h-full bg-[#ff3c00]" style={{ width: `${pct}%` }} /></div>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {unlockState(pct).map((u) => (
                <li key={u.label} className={`flex items-start gap-2 border px-2.5 py-2 text-[12px] ${u.on ? "border-[#ff3c00]/40 bg-[#ff3c00]/[0.05]" : "border-hair text-ink/50"}`}>
                  {u.on ? <Check className="mt-0.5 h-3.5 w-3.5 text-[#ff3c00]" /> : <Lock className="mt-0.5 h-3.5 w-3.5" />}
                  <span><b className="font-medium">{u.label}</b> <span className="font-mono text-[10px]">{u.at}%</span><span className="block text-[11px] leading-snug text-ink/50">{u.hint}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
        <Panel title="Launch grid" testid="launch-grid">
          <ul className="grid grid-cols-2 gap-px bg-hair p-px sm:grid-cols-5">
            {LAUNCH_GRID.map((x) => <li key={x} className="bg-paper px-2.5 py-3 text-center text-[11.5px] text-ink/55"><span className="mx-auto mb-1.5 block h-2 w-2 rounded-full bg-ink/15" />{x}</li>)}
          </ul>
          <p className="border-t border-hair px-4 py-2 text-[11.5px] text-ink/45">Placeholder. Each square turns live as the listing or profile is verified.</p>
        </Panel>
      </div>

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
