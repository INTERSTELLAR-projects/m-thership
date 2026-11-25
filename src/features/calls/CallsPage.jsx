// Calls (/calls): every structured client call, split into upcoming, ready, drafts and done.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Clock, Mic, Plus, Wand2 } from "lucide-react";
import VoiceBox from "./VoiceBox";
import { Spinner } from "@/features/agents/ui";
import { Shell, GlideTabs } from "./ui";
import { E, agent, bucket, fmtWhen, totalMinutes, typeLabel, whoOf } from "./api";
import PitchView from "./PitchView";

const TABS = [["upcoming", "Upcoming"], ["ready", "Ready"], ["draft", "Drafts"], ["done", "Done"], ["all", "All"], ["pitch", "Pitch"]];

export function CallCard({ cp, i = 0 }) {
  const b = bucket(cp);
  const open = (cp.action_items || []).filter((a) => !a.done).length;
  const pending = (cp.brain_facts_proposed || []).filter((f) => f.status === "proposed").length;
  return (
    <Link to={`/calls/${cp.id}`} className="card rise block p-4" style={{ animationDelay: `${Math.min(i, 16) * 30}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mono text-[10px] uppercase tracking-[.14em] text-[var(--ink-s)]">{whoOf(cp)}{cp.call_type && cp.call_type !== "client" ? ` · ${typeLabel(cp.call_type)}` : ""}</p>
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

function QuickPrep() {
  const nav = useNavigate();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    setBusy(true); setErr("");
    const r = await agent({ mode: "quick", raw_notes: text });
    setBusy(false);
    if (r?.ok && r.call_prep?.id) nav(`/calls/${r.call_prep.id}`);
    else setErr(r?.error || "Could not prep the call");
  };
  return (
    <section className="card rise mt-5 border-[rgba(255,106,0,.4)] p-4 md:p-5">
      <p className="eyebrow mb-3">Prep a call</p>
      <VoiceBox value={text} onChange={setText} rows={4} label="Tap and say who it's with and what you need to cover"
        placeholder="e.g. I need to prep for a call with Cami at Smallcakes. Show her the site, get the last answers we need to finish it and the system…" />
      {err ? <p className="mt-2 text-[12.5px] text-[#ff8a7f]">{err}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-f" onClick={go} disabled={busy || text.trim().length < 8}>{busy ? <><Spinner />Reading the brain and prepping…</> : <><Wand2 className="h-3.5 w-3.5" />Prep it</>}</button>
        <span className="text-[11.5px] text-[var(--ink-s)]">It works out the client, reads their brain, launch to-dos and past calls, and saves the prep here.</span>
      </div>
    </section>
  );
}

export default function CallsPage() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get("view")) ? params.get("view") : "upcoming";
  const setTab = (k) => setParams(k === "upcoming" ? {} : { view: k }, { replace: true });
  useEffect(() => { E.CallPrep.list("-created_date", 300).then(setRows).catch((e) => { setErr(e?.message || "Could not load"); setRows([]); }); }, []);
  const counts = useMemo(() => {
    const c = { upcoming: 0, ready: 0, draft: 0, done: 0, all: (rows || []).length };
    (rows || []).forEach((r) => { c[bucket(r)] += 1; });
    return c;
  }, [rows]);
  const [autoPicked, setAutoPicked] = useState(false);
  useEffect(() => {
    if (!rows || autoPicked) return;
    setAutoPicked(true);
    if (!params.get("view") && !counts.upcoming) setParams({ view: counts.ready ? "ready" : counts.draft ? "draft" : "all" }, { replace: true });
  }, [rows, counts, autoPicked, params, setParams]);
  const list = (rows || []).filter((r) => tab === "all" || bucket(r) === tab)
    .sort((a, b) => (tab === "upcoming" ? new Date(a.scheduled_for) - new Date(b.scheduled_for) : 0));

  return (
    <Shell title="Prep" accent="Calls" sub="Say who the call is with and what you need. Get a cheat sheet (no script) with your questions and room for their answers. After the call, say what happened and it feeds the client's brain. Every prep and PDF is kept."
      right={<Link to="/calls/new" className="btn-d"><Mic className="h-3.5 w-3.5" />Prep with details</Link>}>
      <QuickPrep />
      <div className="flex flex-wrap items-center justify-between gap-3 pt-5">
        <GlideTabs value={tab} onChange={setTab} label="Call lists" options={TABS.map(([k, l]) => [k, l, null, k === "pitch" ? 0 : counts[k] || 0])} />
      </div>
      {tab === "pitch" ? <PitchView /> : rows === null ? (
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
