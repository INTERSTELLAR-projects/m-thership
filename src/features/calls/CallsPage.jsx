// Calls (/calls): every structured client call, split into upcoming, ready, drafts and done.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Mic, Plus } from "lucide-react";
import { Spinner } from "@/features/agents/ui";
import { Shell, GlideTabs } from "./ui";
import { E, bucket, fmtWhen, totalMinutes } from "./api";

const TABS = [["upcoming", "Upcoming"], ["ready", "Ready"], ["draft", "Drafts"], ["done", "Done"], ["all", "All"]];

export function CallCard({ cp, i = 0 }) {
  const b = bucket(cp);
  const open = (cp.action_items || []).filter((a) => !a.done).length;
  const pending = (cp.brain_facts_proposed || []).filter((f) => f.status === "proposed").length;
  return (
    <Link to={`/calls/${cp.id}`} className="card rise block p-4" style={{ animationDelay: `${Math.min(i, 16) * 30}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mono text-[10px] uppercase tracking-[.14em] text-[var(--ink-s)]">{cp.client_name || "Client"}</p>
          <p className="mt-1 truncate text-[15px] font-medium text-white">{cp.title || "Untitled call"}</p>
          {cp.goal ? <p className="mt-1 line-clamp-2 text-[12.5px] text-[var(--ink-m)]">{cp.goal}</p> : <p className="mt-1 line-clamp-2 text-[12.5px] text-[var(--ink-s)]">{cp.raw_notes || "No notes yet"}</p>}
        </div>
        <span className={`mono shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[.12em] ${b === "done" ? "border-[var(--hair-d2)] text-[var(--ink-s)]" : b === "draft" ? "border-[var(--hair-d2)] text-[var(--ink-m)]" : "border-[rgba(255,106,0,.6)] text-[#ffb27a]"}`}>{b}</span>
      </div>
      <p className="mono mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-[var(--ink-s)]">
        {cp.scheduled_for ? <span>{fmtWhen(cp.scheduled_for)}</span> : null}
        {(cp.agenda || []).length ? <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{totalMinutes(cp.agenda)} min · {(cp.agenda || []).length} items</span> : null}
        {open ? <span className="text-[#ffb27a]">{open} open action{open === 1 ? "" : "s"}</span> : null}
        {pending ? <span className="text-[#ffb27a]">{pending} fact{pending === 1 ? "" : "s"} to review</span> : null}
      </p>
    </Link>
  );
}

export default function CallsPage() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("upcoming");
  useEffect(() => { E.CallPrep.list("-created_date", 300).then(setRows).catch((e) => { setErr(e?.message || "Could not load"); setRows([]); }); }, []);
  const counts = useMemo(() => {
    const c = { upcoming: 0, ready: 0, draft: 0, done: 0, all: (rows || []).length };
    (rows || []).forEach((r) => { c[bucket(r)] += 1; });
    return c;
  }, [rows]);
  useEffect(() => { if (rows && tab === "upcoming" && !counts.upcoming) setTab(counts.ready ? "ready" : counts.draft ? "draft" : "all"); }, [rows, counts, tab]);
  const list = (rows || []).filter((r) => tab === "all" || bucket(r) === tab)
    .sort((a, b) => (tab === "upcoming" ? new Date(a.scheduled_for) - new Date(b.scheduled_for) : 0));

  return (
    <Shell title="Structure" accent="Calls" sub="Say what a client call needs to cover. Get back a tight, timeboxed plan, run the call from it, then dictate what happened so it feeds the client's brain."
      right={<Link to="/calls/new" className="btn-f"><Mic className="h-3.5 w-3.5" />Structure a call</Link>}>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-5">
        <GlideTabs value={tab} onChange={setTab} label="Call lists" options={TABS.map(([k, l]) => [k, l, null, counts[k] || 0])} />
      </div>
      {rows === null ? (
        <div className="grid min-h-[40vh] place-items-center"><Spinner size={18} /></div>
      ) : err ? (
        <p className="pt-6 text-[13px] text-[#ff8a7f]">{err}</p>
      ) : !list.length ? (
        <div className="card mt-5 grid place-items-center gap-3 px-6 py-14 text-center">
          <p className="max-w-md text-[13px] text-[var(--ink-m)]">Nothing here yet. Structure a call before you dial: two minutes of talking turns into a plan that keeps the call short.</p>
          <Link to="/calls/new" className="btn-f"><Plus className="h-3.5 w-3.5" />Structure a call</Link>
        </div>
      ) : (
        <div className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((cp, i) => <CallCard key={cp.id} cp={cp} i={i} />)}</div>
      )}
    </Shell>
  );
}
