import { Play, Lock } from "lucide-react";
import PrestigeEmblem from "./PrestigeEmblem";
import { money } from "@/lib/prestige";

// One rung of the Prestige ladder. `state`: "unlocked" | "next" | "locked".
// `pct` = progress toward this rung (for the "next" rung). `holders` = names at this rank.
export default function TierLadderCard({ tier, index, state = "locked", pct = 0, holders = [], onPreview, isDefault }) {
  const unlocked = state === "unlocked";
  const next = state === "next";
  return (
    <div className={`group relative flex min-w-[220px] flex-col overflow-hidden rounded-md border bg-card p-4 transition-all md:min-w-0 ${unlocked ? "border-[#ff3c00]/45 shadow-[0_18px_40px_-28px_rgba(255,60,0,.9)]" : next ? "border-[#ff6a00]/35" : "border-hair"}`}>
      {unlocked && <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px] flame-bg" />}
      <div className="flex items-start justify-between gap-2">
        <PrestigeEmblem tier={index} size={54} locked={!unlocked} />
        <div className="text-right">
          <p className="mono-label text-[9.5px] text-ink/45">{tier.threshold} signed</p>
          {unlocked ? <p className="mono-label mt-1 text-[9.5px] text-[#ff3c00]">Unlocked</p> : next ? <p className="mono-label mt-1 text-[9.5px] text-[#ff6a00]">Up next</p> : <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-ink/35"><Lock className="h-3 w-3" />Locked</p>}
        </div>
      </div>
      <p className="mt-3 text-[17px] font-semibold tracking-[-0.03em]">{tier.name}</p>
      <p className="text-[13px] font-medium text-[#ff3c00]">{tier.unlock || "—"}</p>
      {tier.detail && <p className="mt-1 text-[12px] leading-snug text-ink/55">{tier.detail}</p>}
      <div className="mt-auto pt-3">
        {tier.value ? (
          <p className="font-mono text-[11px] text-ink/60">
            {money(tier.value)} value{isDefault && <span className="ml-1 text-ink/35">(default)</span>}
          </p>
        ) : null}
        {next && (
          <div className="mt-2 h-1.5 overflow-hidden bg-ink/[0.07]">
            <div className="h-full flame-bg transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
        )}
        {holders.length > 0 && (
          <p className="mt-2 truncate text-[11.5px] text-ink/55" title={holders.join(", ")}>
            <span className="font-semibold text-ink/75">{holders.length}</span> at this rank · {holders.slice(0, 3).join(", ")}{holders.length > 3 ? "…" : ""}
          </p>
        )}
        {onPreview && (
          <button type="button" onClick={onPreview} className="mt-3 inline-flex h-8 items-center gap-1.5 border border-hair px-2.5 text-[11.5px] font-medium text-ink/70 transition-colors hover:border-[#ff3c00] hover:text-[#ff3c00]">
            <Play className="h-3 w-3" /> Preview unlock
          </button>
        )}
      </div>
    </div>
  );
}
