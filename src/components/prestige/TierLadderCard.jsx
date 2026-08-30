import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";

// A single tier card on the Prestige ladder. Visual hierarchy (top→bottom):
//   tier name (small, mono, muted) · $ amount (largest) · "IN INTERSTELLAR CREDIT"
//   referral requirement + lifetime total · progress indicator (per-tier denominator)
//   description · "SEE WHAT IT BUILDS" disclosure → example builds
//   members placed under achieved tier (existing) · unlocked credit chip · credit terms
//
// `state` is "locked" | "in-progress" | "unlocked" driven by the program leader.
export default function TierLadderCard({ tier, info, state, within, pct, group }) {
  const [showBuilds, setShowBuilds] = useState(false);
  const locked = state === "locked";
  const inProgress = state === "in-progress";
  const unlocked = state === "unlocked";
  const TierIcon = info.icon;

  const pill =
    state === "unlocked" ? "Unlocked"
    : state === "in-progress" ? "In progress"
    : "Locked";

  return (
    <div className={`relative flex flex-col overflow-hidden rounded-2xl border ${info.border} bg-gradient-to-b ${info.grad} bg-card p-4 card-hover ${unlocked ? info.glow : ""} ${inProgress ? "border-l-2 border-l-orange-500" : ""} ${locked ? "opacity-55" : "opacity-100"}`}>
      <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-3xl opacity-40 pointer-events-none" style={{ background: tier === "Prestige I" ? "#FF6A00" : tier === "Prestige II" ? "#38BDF8" : tier === "Prestige III" ? "#A855F7" : "#FACC15" }} />

      {/* tier name + icon */}
      <div className="relative flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-white/40">// {tier}</span>
          {unlocked && <Check className="w-3.5 h-3.5 text-emerald-400" />}
        </div>
        <div className={`w-8 h-8 rounded-lg ${info.bg} border ${info.border} flex items-center justify-center ${info.color}`}>
          <TierIcon className="w-4 h-4" />
        </div>
      </div>

      {/* $ amount — largest element */}
      <div className={`relative text-[40px] leading-none font-bold font-mono tracking-tight tabular-nums ${locked ? "text-white/40" : "text-white"}`}>{info.credit}</div>
      <div className="relative text-[11px] font-mono uppercase tracking-[0.14em] text-white/40 mt-1">In Interstellar Credit</div>

      {/* referral requirement + lifetime total */}
      <div className="relative mt-3">
        <div className="text-[13px] font-mono font-bold uppercase tracking-[0.08em] text-white/85">{info.perTier} Referrals to Unlock</div>
        <div className="text-[11px] font-mono text-white/35 mt-0.5">{info.lifetime} total lifetime</div>
      </div>

      {/* progress indicator (per-tier denominator) */}
      <div className="relative mt-2.5">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className={`font-mono font-semibold ${inProgress ? "text-orange-400" : locked ? "text-white/30" : "text-white/50"}`}>{locked ? 0 : within} / {info.perTier}</span>
          <span className="text-white/25 font-mono">{pill}</span>
        </div>
        <div className="h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${locked ? "bg-white/10" : "bg-gradient-to-r from-orange-500 to-amber-300"} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* description */}
      <p className="relative mt-3 text-[13px] leading-[1.6] text-white/60 line-clamp-3">{info.description}</p>

      {/* example builds disclosure */}
      <button onClick={() => setShowBuilds(!showBuilds)} className="relative mt-2.5 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.1em] text-orange-400/70 hover:text-orange-400 transition-colors">
        <ChevronDown className={`w-3 h-3 transition-transform ${showBuilds ? "rotate-180" : ""}`} />See what it builds
      </button>
      {showBuilds && (
        <ul className="relative mt-2 space-y-1.5">
          {info.builds.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-white/45">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#F47C20" }} />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {/* members placed under achieved tier (existing component retained) */}
      <div className="relative mt-4 pt-3 border-t border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-lg font-bold ${info.color}`}>{group.length}</span>
          <span className="text-[9px] text-white/30 tracking-widest uppercase">members</span>
        </div>
        {group.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {group.slice(0, 6).map((m) => (
              <div key={m.id} title={m.name} className={`w-7 h-7 rounded-full ${info.bg} border ${info.border} flex items-center justify-center text-[11px] font-bold ${info.color} ring-1 ${info.ring}`}>
                {m.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {group.length > 6 && (
              <div className="w-7 h-7 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-[10px] text-white/40">+{group.length - 6}</div>
            )}
          </div>
        ) : (
          <p className="text-white/20 text-[10px]">No members ranked here yet.</p>
        )}
      </div>

      {/* unlocked credit chip */}
      {unlocked && (
        <div className="relative mt-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/30">
            <span className="text-[9px] font-mono uppercase tracking-wider text-orange-400">Credit Available: {info.credit}</span>
          </span>
        </div>
      )}

      {/* credit terms fine print */}
      <p className="relative mt-auto pt-3 text-[10px] text-white/30 leading-snug">Credit applies to any Interstellar build or service. Stackable across tiers. Valid 12 months from unlock.</p>
    </div>
  );
}