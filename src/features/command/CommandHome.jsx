import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Headphones, Brain, Orbit, LayoutDashboard, Undo2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import MissionBrief from "./MissionBrief";
import NeedsYou from "./NeedsYou";
import Constellation from "./Constellation";
import { Mono, scoreTone, PILLAR_COLOR } from "./ui";
import { PILLARS } from "./engine";
import { getBrief, interrupt, listActions, recentAudit, undo, errMsg } from "./api";

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Building your brief">
      <div className="band-dark h-[340px] animate-pulse motion-reduce:animate-none" />
      <div className="h-[260px] animate-pulse border border-hair bg-paper/60 motion-reduce:animate-none" />
    </div>
  );
}

function PillarStrip({ scores }) {
  if (!scores) return null;
  const list = PILLARS.map((p) => ({ ...p, ...(scores[p.id] || {}) }));
  const weakest = list.filter((p) => p.score != null).sort((a, b) => a.score - b.score)[0];
  return (
    <section className="border border-hair bg-paper/80" aria-label="Pillars">
      <div className="flex items-center justify-between gap-2 border-b border-hair px-4 py-3 md:px-6">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">The business, by pillar</h2>
        <Link to="/pillars" className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink/50 hover:text-[#ff3c00]">Why these scores →</Link>
      </div>
      <div className="grid items-center gap-2 p-4 md:grid-cols-[180px,1fr] md:gap-6 md:px-6">
        <Link to="/pillars" className="mx-auto block w-[150px] md:w-[170px]" aria-label="Open the pillars compass"><Constellation scores={scores} size={200} compact /></Link>
        <div>
          {weakest && <p className="mb-3 text-[13.5px] leading-snug text-ink/70"><span className="font-medium text-ink">Constraint: {weakest.name} ({weakest.score}).</span> {weakest.why}</p>}
          <div className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
            {list.map((p) => (
              <Link key={p.id} to={`/pillars?p=${p.id}`} className="group min-w-0">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="truncate text-[12px] text-ink/65 group-hover:text-ink">{p.name}</span>
                  <span className="font-mono text-[13px] font-semibold tabular-nums" style={{ color: scoreTone(p.score).color }}>{p.score == null ? "—" : p.score}</span>
                </div>
                <div className="mt-1 h-[3px] bg-ink/[0.07]"><div className="h-full" style={{ width: `${p.score || 0}%`, background: PILLAR_COLOR[p.id] }} /></div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AgentLog({ rows, onUndo }) {
  if (!rows?.length) return null;
  return (
    <details className="group border border-hair bg-paper/60">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 md:px-6">
        <span className="text-[13.5px] font-medium">What the agent did</span>
        <Mono className="text-ink/40 group-open:hidden">Show {rows.length}</Mono>
      </summary>
      <ul className="divide-y divide-hair/70 border-t border-hair">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-3 px-4 py-2.5 md:px-6">
            <span className="w-[54px] shrink-0 pt-0.5 font-mono text-[10.5px] text-ink/40">{r.at ? new Date(r.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}</span>
            <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-ink/75"><span className="mr-1.5 font-mono text-[10px] uppercase text-ink/40">{String(r.action).replace(/_/g, " ")}</span>{r.summary}</span>
            {r.undo && !r.undone_at && <button type="button" onClick={() => onUndo(r.id)} className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-ink/55 hover:text-[#ff3c00]"><Undo2 className="h-3 w-3" />Undo</button>}
            {r.undone_at && <span className="shrink-0 font-mono text-[10px] text-ink/35">undone</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function CommandHome() {
  const { user } = useAuth();
  const [brief, setBrief] = useState(null);
  const [state, setState] = useState({ loading: true, busy: false, stale: false, error: "" });
  const [actions, setActions] = useState([]);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [audit, setAudit] = useState([]);

  const loadActions = useCallback(async () => {
    try { setActions(await listActions()); } catch { /* keep the last list */ }
    setActionsLoading(false);
    recentAudit(12).then(setAudit).catch(() => {});
  }, []);

  const load = useCallback(async (force = false) => {
    setState((s) => ({ ...s, busy: force, loading: !force && !s.busy && !brief, error: "" }));
    try {
      const res = await getBrief(user, { force });
      setBrief(res.brief);
      setState({ loading: false, busy: false, stale: !!res.stale, error: res.error || "" });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, busy: false, error: errMsg(e) }));
    }
    loadActions();
  }, [user, loadActions, brief]);

  useEffect(() => { load(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    const refresh = () => load(false);
    const replan = () => load(true);
    const acts = () => loadActions();
    window.addEventListener("command:refresh", refresh);
    window.addEventListener("command:replan", replan);
    window.addEventListener("command:actions", acts);
    return () => { window.removeEventListener("command:refresh", refresh); window.removeEventListener("command:replan", replan); window.removeEventListener("command:actions", acts); };
  }, [load, loadActions]);

  const onInterrupt = async (text, minutes) => {
    setState((s) => ({ ...s, busy: true }));
    try { const r = await interrupt(user, text, minutes); setBrief(r.brief); setState({ loading: false, busy: false, stale: false, error: "" }); }
    catch (e) { setState((s) => ({ ...s, busy: false, error: errMsg(e) })); }
    loadActions();
  };
  const onUndo = async (id) => { try { await undo(id); } catch { /* shown in the log */ } loadActions(); };

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 pb-36 pt-4 md:px-8 md:pt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Mono className="text-ink/50">(Today) · Møthership Command</Mono>
        <nav className="flex flex-wrap gap-1.5" aria-label="Command modes">
          <Link to="/walk" className="inline-flex h-9 items-center gap-1.5 bg-ink px-3 text-[12.5px] text-white hover:bg-[#ff3c00]"><Headphones className="h-3.5 w-3.5" />Walk mode</Link>
          <Link to="/pillars" className="inline-flex h-9 items-center gap-1.5 border border-hair px-3 text-[12.5px] text-ink/75 hover:border-ink"><Orbit className="h-3.5 w-3.5" />Pillars</Link>
          <Link to="/brain" className="inline-flex h-9 items-center gap-1.5 border border-hair px-3 text-[12.5px] text-ink/75 hover:border-ink"><Brain className="h-3.5 w-3.5" />Teach the Brain</Link>
          <Link to="/classic" className="inline-flex h-9 items-center gap-1.5 px-2 text-[12.5px] text-ink/50 hover:text-ink"><LayoutDashboard className="h-3.5 w-3.5" />Classic</Link>
        </nav>
      </div>
      {state.loading && !brief ? <Skeleton /> : (
        <div className="space-y-4">
          {brief ? (
            <MissionBrief brief={brief} busy={state.busy} stale={state.stale} error={state.error} onReplan={() => load(true)} onInterrupt={onInterrupt} />
          ) : (
            <div className="border border-hair bg-paper p-6"><p className="text-[15px]">The brief couldn't load: {state.error}</p><button type="button" onClick={() => load(true)} className="mt-3 h-10 bg-ink px-4 text-[13px] text-white">Try again</button></div>
          )}
          <NeedsYou items={actions} loading={actionsLoading} onChanged={loadActions} />
          <PillarStrip scores={brief?.pillar_scores} />
          <AgentLog rows={audit} onUndo={onUndo} />
        </div>
      )}
    </div>
  );
}
