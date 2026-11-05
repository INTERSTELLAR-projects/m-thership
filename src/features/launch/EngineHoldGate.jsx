// Road to Dec 31: the one gate in front of every recurring engine. ON until Justin releases it; the condition is
// all client sites cut over + every profile complete (from the c:<client>:cutover / :profile LaunchItems).
// Only Justin's login sees the release control; it is a two-step inline confirm (no browser dialogs).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Unlock, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { loadHold, setHold, holdProgress, HOLD_OWNER, HOLD_CONDITION } from "./engineHold";

export default function EngineHoldGate({ items = [] }) {
  const qc = useQueryClient();
  const hold = useQuery({ queryKey: ["enginesHold"], queryFn: loadHold, staleTime: 30_000 });
  const me = useQuery({ queryKey: ["me", "hold"], queryFn: () => base44.auth.me().catch(() => null), staleTime: 300_000 });
  const [arm, setArm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const on = hold.data ? hold.data.on : true;
  const p = holdProgress(items);
  const isJustin = String(me.data?.email || "").toLowerCase() === HOLD_OWNER;

  const flip = async (next) => {
    setBusy(true); setErr("");
    try { await setHold(next, me.data); setArm(false); qc.invalidateQueries({ queryKey: ["enginesHold"] }); }
    catch (e) { setErr(e?.message || "Could not change the hold."); } finally { setBusy(false); }
  };

  return (
    <section aria-label="Engines gate" className={`mb-6 border ${on ? "border-[#ff3c00]/35 bg-[#ff3c00]/[0.04]" : "border-hair bg-card"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          <p className="mono-label text-[10px] text-[#c24100]">Gate · recurring work</p>
          <h3 className="mt-1 flex items-center gap-2 text-[18px] font-semibold tracking-[-0.03em]">
            {on ? <Lock className="h-4 w-4 text-[#ff3c00]" /> : <Unlock className="h-4 w-4 text-[#ff3c00]" />}
            {on ? "Engines on hold until all clients are launched" : "Engines released"}
          </h3>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink/60">
            {on
              ? "No client blog schedule, Topic Calendar, Start engine (manual or Claude's auto-press) or monthly re-queue runs while this is on. Only Justin turns it off."
              : `Released${hold.data?.changed_by ? ` by ${hold.data.changed_by}` : ""}${hold.data?.changed_at ? ` on ${String(hold.data.changed_at).slice(0, 10)}` : ""}. Engines start as each client's checklist turns green.`}
          </p>
        </div>
        <span className={`shrink-0 px-2.5 py-1 font-mono text-[11px] ${p.met ? "bg-[#ff3c00] text-white" : "bg-ink/[0.07] text-ink/60"}`}>{p.met ? "Condition met" : "Condition not met"}</span>
      </div>
      <div className="grid gap-px border-t border-hair bg-hair sm:grid-cols-2">
        {[["Client sites cut over", p.cutover], ["Client profiles complete", p.profile]].map(([label, c]) => (
          <div key={label} className="bg-canvas px-4 py-3">
            <p className="text-[12px] text-ink/55">{label}</p>
            <p className="mt-0.5 font-mono text-[18px] font-semibold tabular-nums">{c.done}<span className="text-ink/40">/{c.total}</span></p>
            <div className="mt-2 h-1 bg-ink/[0.08]"><div className="h-full bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" style={{ width: `${c.total ? Math.round((c.done / c.total) * 100) : 0}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hair px-4 py-3 text-[12px] text-ink/55">
        <span>Condition: {HOLD_CONDITION}.{!p.met && p.open.length ? ` ${p.open.length} item${p.open.length === 1 ? "" : "s"} still open.` : ""}</span>
        {on && isJustin && (
          arm ? (
            <span className="flex items-center gap-2">
              <span className="text-ink/70">{p.met ? "Release every engine?" : "The condition isn't met yet. Release anyway?"}</span>
              <button type="button" onClick={() => setArm(false)} disabled={busy} className="h-8 px-3 text-ink/60 hover:text-ink">Cancel</button>
              <button type="button" onClick={() => flip(false)} disabled={busy} className="inline-flex h-8 items-center gap-1.5 bg-[#ff3c00] px-3 font-medium text-white hover:bg-ink disabled:opacity-50"><Check className="h-3.5 w-3.5" />{busy ? "Releasing…" : "Yes, release"}</button>
            </span>
          ) : (
            <button type="button" onClick={() => setArm(true)} className="h-8 border border-ink/25 px-3 text-ink/70 hover:bg-ink hover:text-white">Release engines</button>
          )
        )}
        {on && !isJustin && <span className="font-mono text-[11px] text-ink/45">Only Justin can release</span>}
        {!on && isJustin && <button type="button" onClick={() => flip(true)} disabled={busy} className="h-8 border border-ink/25 px-3 text-ink/70 hover:bg-ink hover:text-white disabled:opacity-50">Put back on hold</button>}
      </div>
      {err && <p className="px-4 pb-3 text-[12px] text-red-700">{err}</p>}
    </section>
  );
}
