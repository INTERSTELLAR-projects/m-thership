// Approval policy settings: one row per gate with its old behavior, the recommendation and Justin's choice.
// Every gate reads gateMode(); the policy sweep (policySweep.js) applies auto/notify in the background and logs
// each clear to Live Ops. "Run now" applies it immediately.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { GATES, MODES, loadPolicy, savePolicy } from "./gates";
import { runPolicySweep } from "./policySweep";
import { useWaiting } from "./ApprovalsInbox";

const ORDER = ["auto", "notify", "approve"];

export default function ApprovalPolicy() {
  const qc = useQueryClient();
  const pol = useQuery({ queryKey: ["approvalPolicy"], queryFn: loadPolicy });
  const waiting = useWaiting();
  const [modes, setModes] = useState({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const sweep = async () => {
    setSweeping(true); setMsg("");
    try {
      const me = await base44.auth.me().catch(() => null);
      const r = await runPolicySweep({ by: me?.email || "justin", force: true });
      ["approvalPolicy", "launchWaiting", "ClaudeJob", "EngineStart"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setMsg(r?.note || `Cleared ${(r?.cleared || []).length} item${(r?.cleared || []).length === 1 ? "" : "s"}${(r?.engines || []).length ? ` · started ${r.engines.join(", ")}` : ""}${(r?.skipped || []).length ? ` · ${r.skipped.length} left for you` : ""}${(r?.errors || []).length ? ` · ${r.errors.length} errors (see Live Ops)` : ""}.`);
    } catch (e) { setMsg(e?.message || "Could not run the policy."); } finally { setSweeping(false); }
  };
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
      setMsg("Saved. Auto and notify gates clear in the background and log to Live Ops.");
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
        <span>Live. Auto and notify gates clear on their own (logged in Live Ops; notify also shows in your digest). Approve gates wait for you. Rule of thumb: anything Claude knows the answer to, or can settle with one question, doesn&apos;t need you; anything public, client-facing, live-site, money or pricing does.{pol.data?.pageSettings?.last_sweep?.at ? ` Last run ${new Date(pol.data.pageSettings.last_sweep.at).toLocaleString()}: ${pol.data.pageSettings.last_sweep.cleared} cleared.` : ""}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setModes(Object.fromEntries(GATES.map((g) => [g.key, g.recommended])))} className="h-8 border border-ink/25 px-3 text-[12px] hover:bg-ink hover:text-white">Use recommended</button>
          <button type="button" onClick={sweep} disabled={sweeping} className="h-8 bg-ink px-3 text-[12px] text-white hover:bg-[#ff3c00] disabled:opacity-50">{sweeping ? "Running…" : "Run now"}</button>
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
                    <p className="mono-label mt-0.5 text-[9.5px] text-ink/40">before Nov 4: {MODES[g.current].label} · recommended: {MODES[g.recommended].label}</p>
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
        <span className="text-[12.5px] text-ink/60">{changed} of {GATES.length} gates differ from before Nov 4.{pol.data?.pageSettings?.saved_at ? ` Last saved ${String(pol.data.pageSettings.saved_at).slice(0, 10)}.` : " Not saved yet."} {msg}</span>
        <button type="button" onClick={save} disabled={busy} className="h-9 bg-[#ff3c00] px-5 text-[13px] font-medium text-white hover:bg-ink disabled:opacity-50">{busy ? "Saving…" : "Save policy"}</button>
      </div>
    </div>
  );
}
