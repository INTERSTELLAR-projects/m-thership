// Engine readiness card on the client dashboard (Overview tab). Four lights; when all are green a
// "Start engine" button appears (and Claude presses it on its own: approval policy "notify"). Starting queues
// month 1: the Topic Calendar, outreach, social plan and review requests (see engine.js). GBP posts show
// "Waiting on Google API" until the Business Profile API is approved.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Rocket, X, ArrowUpRight, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { loadClientContext } from "@/features/clients/clientContext";
import { engineChecklist, loadFacts, startEngine, cadenceOf, STREAMS } from "./engine";
import { loadHold } from "./engineHold";

export default function EngineChecklist({ client }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const q = useQuery({
    queryKey: ["engineReadiness", client.id, client.portal_enabled],
    queryFn: async () => {
      const [ctx, facts, starts] = await Promise.all([
        loadClientContext(client),
        loadFacts(),
        base44.entities.EngineStart.filter({ client_id: client.id }, "-started_at", 3).catch(() => []),
      ]);
      return { list: engineChecklist(ctx, facts), starts: starts || [] };
    },
    staleTime: 30_000,
  });
  const holdQ = useQuery({ queryKey: ["enginesHold"], queryFn: loadHold, staleTime: 30_000 });
  const held = holdQ.data ? holdQ.data.on : true;
  const list = q.data?.list || [];
  const started = (q.data?.starts || [])[0];
  const green = list.length > 0 && list.every((c) => c.ok);
  const cad = cadenceOf(client);

  const go = async () => {
    setBusy(true); setErr("");
    try {
      const me = await base44.auth.me().catch(() => null);
      await startEngine(client, list, me?.email || "justin");
      setConfirm(false);
      qc.invalidateQueries({ queryKey: ["engineReadiness", client.id] });
      qc.invalidateQueries({ queryKey: ["ClaudeJob"] });
    } catch (e) {
      setErr(e?.message || "Could not start the engine.");
    } finally { setBusy(false); }
  };

  return (
    <section className="mb-6 border border-hair bg-card" aria-label="Engine readiness">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair px-4 py-3">
        <div>
          <p className="mono-label text-[10px] text-ink/50">Engine readiness</p>
          <h3 className="text-[17px] font-semibold tracking-[-0.03em]">Recurring work <span className="text-[#ff3c00]">/engine</span></h3>
        </div>
        {started ? (
          <span className="inline-flex items-center gap-2 bg-ink px-3 py-1.5 text-[12px] font-medium text-white"><Rocket className="h-3.5 w-3.5 text-[#ffaa00]" /> Engine started {String(started.started_at || "").slice(0, 10)} · {(started.queued || []).length} jobs queued</span>
        ) : held ? (
          <Link to="/launch" className="inline-flex items-center gap-2 border border-[#ff3c00]/40 bg-[#ff3c00]/[0.06] px-3 py-1.5 text-[12px] font-medium text-[#c24100] hover:border-[#ff3c00]"><Clock className="h-3.5 w-3.5" /> Engines on hold until all clients are launched</Link>
        ) : green ? (
          <button type="button" onClick={() => setConfirm(true)} className="btn-roll is-flame">
            <span className="roll"><span>Start engine</span><span>Start engine</span></span><span className="box"><Rocket className="h-3.5 w-3.5" /></span>
          </button>
        ) : (
          <span className="mono-label text-[10px] text-ink/45">{list.filter((c) => c.ok).length}/4 green · button appears when all four are green</span>
        )}
      </div>
      {q.isLoading ? (
        <p className="px-4 py-4 text-[13px] text-ink/50">Checking readiness…</p>
      ) : (
        <ul className="grid gap-px bg-hair sm:grid-cols-2">
          {list.map((c) => (
            <li key={c.key} className="flex gap-3 bg-card px-4 py-3">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center ${c.ok ? "bg-[#ff3c00] text-white" : "border border-ink/25 text-ink/35"}`}>{c.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3 w-3" />}</span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-snug">{c.label}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-ink/55">{c.detail}</p>
                {!c.ok && <p className="mt-1 text-[11.5px] text-[#c23000]">{c.fix}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-hair px-4 py-2.5 text-[11.5px]">
        {STREAMS.map((s) => (
          <li key={s.key} className={`inline-flex items-center gap-1.5 ${s.state === "on" ? "text-ink/60" : "text-[#c24100]"}`}>
            {s.state === "on" ? <Check className="h-3 w-3 text-[#ff3c00]" /> : <Clock className="h-3 w-3" />}
            {s.label}{s.state !== "on" && <span className="font-medium"> · {s.waiting}</span>}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hair px-4 py-2.5 text-[11.5px] text-ink/50">
        <span>Cadence: {cad.blogs_per_month} blogs a month ({cad.source}). You approve the month's Topic Calendar once; posts then publish on their own and count only once verified live.</span>
        <Link to="/launch" className="inline-flex items-center gap-1 hover:text-[#ff3c00]">Road to Dec 31 <ArrowUpRight className="h-3 w-3" /></Link>
      </div>

      {confirm && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-ink/45 p-4 pt-[10vh]" onMouseDown={() => !busy && setConfirm(false)}>
          <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-lg border border-hair bg-canvas shadow-2xl">
            <div className="px-5 py-4">
              <h3 className="text-[17px] font-semibold tracking-[-0.03em]">Start {client.business}'s <span className="text-[#ff3c00]">/engine</span></h3>
              <p className="mt-2 text-[13px] text-ink/65">This queues month 1 for the Claude queue runner. You approve the Topic Calendar once; outreach emails and anything public still come to you.</p>
              <ul className="mt-3 space-y-2">
                {STREAMS.map((s) => (
                  <li key={s.key} className="border border-hair bg-card px-3 py-2">
                    <p className="text-[13px] font-medium">{s.label}{s.key === "calendar" ? ` · ${cad.blogs_per_month} posts` : ""}{s.state !== "on" && <span className="ml-1 text-[#c24100]">· {s.waiting}</span>}</p>
                    <p className="text-[11.5px] text-ink/55">{s.how}</p>
                  </li>
                ))}
              </ul>
              {err && <p className="mt-2 text-[12px] text-red-700">{err}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-hair px-5 py-3">
              <button type="button" onClick={() => setConfirm(false)} disabled={busy} className="h-9 px-4 text-[13px] text-ink/60 hover:text-ink">Cancel</button>
              <button type="button" onClick={go} disabled={busy} className="h-9 bg-[#ff3c00] px-5 text-[13px] font-medium text-white hover:bg-ink disabled:opacity-50">{busy ? "Queuing…" : "Start engine"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
