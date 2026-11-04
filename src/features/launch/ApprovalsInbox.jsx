// One inbox for everything waiting on Justin, grouped by gate, with "Approve all in group" where the
// existing approval path can run without a per-item choice. Approving here runs the same code as the
// gate's own page (approveJob for Claude jobs), so side effects are identical.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, ChevronDown, ChevronRight, CheckCheck } from "lucide-react";
import { GATES, loadWaiting, approveRow, rowTitle, MODES, loadPolicy, gateMode } from "./gates";
import TopicCalendarCards from "./TopicCalendarCards";

export function useWaiting() {
  return useQuery({ queryKey: ["launchWaiting"], queryFn: loadWaiting, staleTime: 20_000 });
}

export function waitingTotal(data) {
  return Object.values(data || {}).reduce((n, rows) => n + (rows || []).length, 0);
}

function GroupConfirm({ group, rows, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [errs, setErrs] = useState([]);
  const go = async () => {
    setBusy(true);
    const e = [];
    for (const r of rows) {
      try { await approveRow(group, r); setDone((n) => n + 1); } catch (x) { e.push(`${rowTitle(group, r)}: ${x?.message || x}`); }
    }
    setErrs(e); setBusy(false);
    if (!e.length) { onDone(); onClose(); } else onDone();
  };
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] flex items-start justify-center bg-ink/45 p-4 pt-[14vh]" onMouseDown={() => !busy && onClose()}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-md border border-hair bg-canvas shadow-2xl">
        <div className="px-5 py-4">
          <h3 className="text-[17px] font-semibold tracking-[-0.03em]">Approve all <span className="text-[#ff3c00]">/{rows.length}</span></h3>
          <p className="mt-2 text-[13px] leading-relaxed text-ink/65">{group.label}. {group.why}</p>
          {busy && <p className="mt-2 font-mono text-[12px] text-ink/60">{done}/{rows.length} approved…</p>}
          {errs.length > 0 && <ul className="mt-2 space-y-1 text-[12px] text-red-700">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
        </div>
        <div className="flex justify-end gap-2 border-t border-hair px-5 py-3">
          <button type="button" onClick={onClose} disabled={busy} className="h-9 px-4 text-[13px] text-ink/60 hover:text-ink">Cancel</button>
          <button type="button" onClick={go} disabled={busy} className="h-9 bg-[#ff3c00] px-5 text-[13px] font-medium text-white hover:bg-ink disabled:opacity-50">{busy ? "Approving…" : `Approve ${rows.length}`}</button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalsInbox() {
  const qc = useQueryClient();
  const q = useWaiting();
  const [open, setOpen] = useState({});
  const [confirm, setConfirm] = useState(null);
  const pol = useQuery({ queryKey: ["approvalPolicy"], queryFn: loadPolicy, staleTime: 60_000 });
  // Topic calendars have their own cards above; everything else groups by gate.
  const groups = useMemo(() => GATES.filter((g) => g.key !== "claude.topic_calendar").map((g) => ({ g, rows: (q.data || {})[g.key] || [] })).filter((x) => x.rows.length), [q.data]);
  const total = waitingTotal(q.data);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["launchWaiting"] }); qc.invalidateQueries({ queryKey: ["ClaudeJob"] }); };

  if (q.isLoading) return <p className="py-8 text-[13px] text-ink/50">Gathering everything that's waiting…</p>;
  return (
    <div>
      <TopicCalendarCards />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-[13px] leading-relaxed text-ink/60">{total.toLocaleString()} items wait across {groups.length} gates. Groups that can be approved in one go show <b>Approve all</b>; the rest open where they live, because each one needs a per-item choice or a visual check.</p>
        <button type="button" onClick={refresh} className="h-8 border border-hair px-3 text-[12px] text-ink/60 hover:border-ink/30 hover:text-ink">Refresh</button>
      </div>
      {groups.length === 0 && <p className="border border-dashed border-hair px-4 py-8 text-center text-[13px] text-ink/50">Nothing is waiting on you.</p>}
      <div className="space-y-2">
        {groups.map(({ g, rows }) => {
          const isOpen = !!open[g.key];
          const link = g.link || "";
          return (
            <div key={g.key} className="border border-hair bg-card">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <button type="button" onClick={() => setOpen((o) => ({ ...o, [g.key]: !isOpen }))} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={isOpen}>
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-ink/40" /> : <ChevronRight className="h-4 w-4 shrink-0 text-ink/40" />}
                  <span className="font-mono text-[18px] font-semibold tabular-nums text-[#ff3c00]">{rows.length.toLocaleString()}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium">{g.label}</span>
                    <span className="mono-label text-[9.5px] text-ink/45">{g.family} · policy: {MODES[gateMode(pol.data, g.key)].label}{gateMode(pol.data, g.key) !== "approve" ? (g.autoIf ? " (only matching items clear; the rest wait)" : " (clears automatically)") : ""}</span>
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  {link && <Link to={link} className="inline-flex h-8 items-center gap-1 border border-hair px-3 text-[12px] text-ink/60 hover:border-ink/30 hover:text-ink">Open <ArrowUpRight className="h-3 w-3" /></Link>}
                  {g.bulk && <button type="button" onClick={() => setConfirm({ g, rows })} className="inline-flex h-8 items-center gap-1.5 bg-ink px-3 text-[12px] font-medium text-white hover:bg-[#ff3c00]"><CheckCheck className="h-3.5 w-3.5" /> Approve all</button>}
                </div>
              </div>
              {isOpen && (
                <div className="border-t border-hair px-4 py-3">
                  <p className="mb-2 text-[12px] text-ink/55">{g.why}{g.note ? ` ${g.note}` : ""}</p>
                  <ul className="max-h-80 space-y-1 overflow-y-auto">
                    {rows.slice(0, 60).map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3 border-b border-hair/60 py-1.5 text-[12.5px] last:border-0">
                        <span className="min-w-0 truncate">{rowTitle(g, r)}{r.client_name && !String(rowTitle(g, r)).includes(r.client_name) ? <span className="text-ink/45"> · {r.client_name}</span> : null}</span>
                        <Link to={g.linkFor ? g.linkFor(r) : g.entity === "ClaudeJob" ? `/claude?job=${r.id}` : link || "/"} className="shrink-0 text-[11.5px] text-ink/50 hover:text-[#ff3c00]">Review</Link>
                      </li>
                    ))}
                    {rows.length > 60 && <li className="py-1.5 text-[12px] text-ink/45">+{(rows.length - 60).toLocaleString()} more where they live.</li>}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {confirm && <GroupConfirm group={confirm.g} rows={confirm.rows} onClose={() => setConfirm(null)} onDone={refresh} />}
    </div>
  );
}
