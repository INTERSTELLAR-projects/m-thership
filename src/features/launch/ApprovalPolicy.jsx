// Approval policy settings: one row per gate with today's behavior, the recommendation and Justin's choice.
// Saving records the choice only. Gates keep their current behavior until Claude wires each one to gateMode().
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { GATES, MODES, loadPolicy, savePolicy } from "./gates";
import { useWaiting } from "./ApprovalsInbox";

const ORDER = ["auto", "notify", "approve"];

export default function ApprovalPolicy() {
  const qc = useQueryClient();
  const pol = useQuery({ queryKey: ["approvalPolicy"], queryFn: loadPolicy });
  const waiting = useWaiting();
  const [modes, setModes] = useState({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setModes(pol.data?.pageSettings?.modes || Object.fromEntries(GATES.map((g) => [g.key, g.current]))); }, [pol.data]);
  const families = useMemo(() => [...new Set(GATES.map((g) => g.family))], []);
  const changed = GATES.filter((g) => modes[g.key] && modes[g.key] !== g.current).length;

  const save = async () => {
    setBusy(true); setMsg("");
    try {
      const me = await base44.auth.me().catch(() => null);
      await savePolicy(pol.data, modes, me?.email);
      const q = ((await base44.entities.LaunchItem.filter({ key: "q:approval-policy" }, "-updated_date", 1).catch(() => [])) || [])[0];
      if (q) await base44.entities.LaunchItem.update(q.id, { answer: `Saved in Road to Dec 31 → Policy (${changed} gates changed from today).`, answered_at: new Date().toISOString(), status: "done", done_at: new Date().toISOString(), done_by: me?.email || "justin" });
      qc.invalidateQueries({ queryKey: ["approvalPolicy"] }); qc.invalidateQueries({ queryKey: ["LaunchItem"] });
      setMsg("Saved. Nothing changes yet: Claude wires each gate next and logs it on the Road to Dec 31.");
    } catch (e) { setMsg(e?.message || "Could not save."); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {ORDER.map((m) => (
          <div key={m} className="border border-hair bg-card px-4 py-3">
            <p className="mono-label text-[10px] text-[#ff3c00]">{MODES[m].label}</p>
            <p className="mt-1 text-[12.5px] text-ink/65">{MODES[m].hint}</p>
          </div>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-[#ff3c00]/30 bg-[#ff3c00]/[0.05] px-4 py-3 text-[12.5px] text-ink/70">
        <span>Every gate keeps its <b>current</b> behavior until you save and Claude wires it. Recommended: auto for internal research, records, enrichment and plans; approve for anything public, client-facing, live-site, money or pricing.</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setModes(Object.fromEntries(GATES.map((g) => [g.key, g.recommended])))} className="h-8 border border-ink/25 px-3 text-[12px] hover:bg-ink hover:text-white">Use recommended</button>
          <button type="button" onClick={() => setModes(Object.fromEntries(GATES.map((g) => [g.key, g.current])))} className="h-8 px-3 text-[12px] text-ink/55 hover:text-ink">Reset to today</button>
        </div>
      </div>
      {families.map((f) => (
        <div key={f} className="mb-4">
          <p className="label-cross mb-2 text-ink/60">({f})</p>
          <div className="border border-hair bg-card">
            {GATES.filter((g) => g.family === f).map((g) => {
              const n = ((waiting.data || {})[g.key] || []).length;
              return (
                <div key={g.key} className="flex flex-col gap-2 border-b border-hair px-4 py-3 last:border-0 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium">{g.label} {n > 0 && <span className="ml-1 font-mono text-[11px] text-[#ff3c00]">{n.toLocaleString()} waiting</span>}</p>
                    <p className="text-[12px] text-ink/55">{g.why}</p>
                    <p className="mono-label mt-0.5 text-[9.5px] text-ink/40">today: {MODES[g.current].label} · recommended: {MODES[g.recommended].label}</p>
                  </div>
                  <div className="flex shrink-0 border border-hair" role="radiogroup" aria-label={g.label}>
                    {ORDER.map((m) => (
                      <button key={m} type="button" role="radio" aria-checked={modes[g.key] === m} onClick={() => setModes((x) => ({ ...x, [g.key]: m }))} className={`h-8 px-3 text-[12px] ${modes[g.key] === m ? "bg-ink text-white" : "text-ink/55 hover:text-ink"} ${g.recommended === m && modes[g.key] !== m ? "underline decoration-[#ff3c00] underline-offset-4" : ""}`}>{MODES[m].label}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-hair bg-canvas/95 py-3 backdrop-blur">
        <span className="text-[12.5px] text-ink/60">{changed} of {GATES.length} gates differ from today.{pol.data?.pageSettings?.saved_at ? ` Last saved ${String(pol.data.pageSettings.saved_at).slice(0, 10)}.` : " Not saved yet."} {msg}</span>
        <button type="button" onClick={save} disabled={busy} className="h-9 bg-[#ff3c00] px-5 text-[13px] font-medium text-white hover:bg-ink disabled:opacity-50">{busy ? "Saving…" : "Save policy"}</button>
      </div>
    </div>
  );
}
