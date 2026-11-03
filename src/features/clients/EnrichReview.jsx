// Review table for a "Auto-enrich with Claude" result: accept proposed fields one by one.
// Missing fields start ticked; a proposal that would replace a value already on file starts unticked
// and says so. Only ticked fields are written (approveJob(job, { accepted })).
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Check, Loader2, RotateCcw } from "lucide-react";
import { approveJob, requestChanges } from "@/features/claude/jobs";
import { criterionByKey, displayValue, evaluateCriteria } from "./criteria";
import { loadClientContext } from "./clientContext";
import { proposalsFromJob } from "./enrich";

const CONF = { high: "text-green-700", medium: "text-ink/60", low: "text-amber-700" };

export default function EnrichReview({ job, ctx: givenCtx, onDone }) {
  const qc = useQueryClient();
  const ctxQ = useQuery({ queryKey: ["clientContext", job.client_id], queryFn: () => loadClientContext(job.client_id), enabled: !givenCtx && !!job.client_id, staleTime: 30_000 });
  const ctx = givenCtx || ctxQ.data;
  const ev = useMemo(() => (ctx ? evaluateCriteria(ctx) : null), [ctx]);
  const proposals = useMemo(() => proposalsFromJob(job), [job]);
  const current = (key) => (ev ? ev.items.find((i) => i.key === key) : null);
  const [picked, setPicked] = useState(null);
  const sel = picked || new Set(proposals.filter((p) => { const c = current(p.key); return c && !c.filled; }).map((p) => p.key));
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [notes, setNotes] = useState("");

  const toggle = (k) => {
    const next = new Set(sel);
    if (next.has(k)) next.delete(k); else next.add(k);
    setPicked(next);
  };
  const refresh = () => ["ClaudeJob", "clientContext", "CRMClient", "ClientDossier", "OutreachProfile", "IntakeAudit", "OnboardingFlight", "profileCompleteness"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const approve = async () => {
    setBusy("ok"); setMsg("");
    try { await approveJob(job, { accepted: [...sel] }); refresh(); setMsg(`Saved ${sel.size} field${sel.size === 1 ? "" : "s"} to the profile.`); if (onDone) onDone(); } catch (e) { setMsg(String(e?.message || e)); } finally { setBusy(""); }
  };
  const sendBack = async () => {
    if (!notes.trim()) { setMsg("Write what Claude should change first."); return; }
    setBusy("redo"); setMsg("");
    try { await requestChanges(job, notes.trim()); refresh(); setMsg("Sent back to Claude."); } catch (e) { setMsg(String(e?.message || e)); } finally { setBusy(""); }
  };

  if (!ctx) return <div className="flex items-center gap-2 py-3 text-[12.5px] text-ink/50"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the profile…</div>;
  if (!proposals.length) return <p className="rounded-sm bg-ink/[0.04] px-3 py-2.5 text-[12.5px] text-ink/60">Claude returned no proposals with a source URL. Nothing to accept{job.needs_from_justin ? " — see what it could not find above" : ""}.</p>;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-sm border border-hair">
        <table className="w-full min-w-[640px] text-left text-[12.5px]">
          <thead className="bg-ink/[0.03] text-[10px] uppercase tracking-[0.08em] text-ink/45">
            <tr><th className="w-8 px-3 py-2" /><th className="px-3 py-2">Field</th><th className="px-3 py-2">On file now</th><th className="px-3 py-2">Proposed</th><th className="px-3 py-2">Source</th></tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {proposals.map((p) => {
              const f = criterionByKey(p.key);
              const cur = current(p.key);
              const replaces = cur && cur.filled;
              return (
                <tr key={p.key} className={sel.has(p.key) ? "bg-[#ff3c00]/[0.03]" : ""}>
                  <td className="px-3 py-2 align-top"><input type="checkbox" checked={sel.has(p.key)} onChange={() => toggle(p.key)} aria-label={`Accept ${f ? f.label : p.key}`} className="h-4 w-4 accent-[#ff3c00]" /></td>
                  <td className="px-3 py-2 align-top font-medium">{f ? f.label : p.key}<span className={`mt-0.5 block text-[10.5px] font-normal ${CONF[p.confidence]}`}>{p.confidence} confidence</span></td>
                  <td className="px-3 py-2 align-top text-ink/55">{replaces ? displayValue(cur.value, 160) : <span className="text-ink/35">missing</span>}</td>
                  <td className="px-3 py-2 align-top">{displayValue(p.value, 260)}{replaces && <span className="mt-1 block text-[11px] text-amber-700">Accepting replaces what is on file{f && f.write && f.write.list ? " (lists are merged)" : ""}.</span>}{p.note && <span className="mt-1 block text-[11px] text-ink/50">{p.note}</span>}</td>
                  <td className="px-3 py-2 align-top"><a href={p.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#d83300] hover:underline">{p.source_label || "Source"}<ArrowUpRight className="h-3 w-3" /></a></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {job.status === "needs_approval" && (
        <>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="What should Claude change? (for Send back)" className="w-full rounded-sm border border-hair bg-card px-3 py-2 text-[13px] outline-none focus:border-[#ff3c00]" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={!!busy} onClick={approve} className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2 text-[12.5px] font-medium text-white disabled:opacity-60">
              {busy === "ok" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save {sel.size} accepted field{sel.size === 1 ? "" : "s"} & approve
            </button>
            <button type="button" disabled={!!busy} onClick={sendBack} className="inline-flex items-center gap-1.5 rounded-sm border border-hair px-3 py-2 text-[12.5px] hover:border-[#ff3c00] disabled:opacity-40">
              {busy === "redo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Send back
            </button>
            {msg && <span className="text-[12px] text-ink/60">{msg}</span>}
          </div>
        </>
      )}
    </div>
  );
}
