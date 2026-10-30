import React from "react";
import { Check, AlertTriangle } from "lucide-react";
import { ORB_STATES } from "@/features/packages/registry";
import { cn } from "@/lib/utils";

/*
 * A horizontal line of orbs. One orb per stage.
 *   done      solid green core, soft glow
 *   working   flame core with a breathing ring
 *   attention red core with a warning mark
 *   pending   ink outline, hollow
 *   off       dashed grey outline
 * size: "sm" (rows in the all-in-one grid) · "lg" (client view)
 */
export function Orb({ orb, size = "sm", onClick, active = false }) {
  const s = ORB_STATES[orb.state] || ORB_STATES.pending;
  const d = size === "lg" ? 54 : 26;
  const core = (
    <span
      className={cn("relative grid shrink-0 place-items-center rounded-full transition-all duration-500", orb.state === "working" && "orb-breathe")}
      style={{
        width: d,
        height: d,
        background:
          orb.state === "done" ? "radial-gradient(circle at 35% 30%, #4ade80, #15803d 70%)"
          : orb.state === "working" ? "radial-gradient(circle at 35% 30%, #ffaa00, #ff3c00 65%)"
          : orb.state === "attention" ? "radial-gradient(circle at 35% 30%, #f87171, #b91c1c 70%)"
          : "transparent",
        border: orb.state === "pending" ? "1.5px solid rgba(26,26,26,.45)" : orb.state === "off" ? "1.5px dashed rgba(26,26,26,.25)" : "none",
        boxShadow:
          orb.state === "done" ? `0 0 ${size === "lg" ? 26 : 12}px rgba(21,128,61,.45)`
          : orb.state === "working" ? `0 0 ${size === "lg" ? 34 : 16}px rgba(255,60,0,.55)`
          : orb.state === "attention" ? `0 0 ${size === "lg" ? 26 : 12}px rgba(185,28,28,.45)`
          : "none"
      }}
    >
      {orb.state === "done" ? <Check className="text-white" style={{ width: d * 0.46, height: d * 0.46 }} strokeWidth={3} /> : null}
      {orb.state === "attention" ? <AlertTriangle className="text-white" style={{ width: d * 0.42, height: d * 0.42 }} strokeWidth={2.5} /> : null}
      {orb.state === "working" ? <span className="rounded-full bg-white/90" style={{ width: d * 0.22, height: d * 0.22 }} /> : null}
      {orb.state === "working" ? <span className="orb-ring absolute inset-0 rounded-full border-2 border-[#ff3c00]" /> : null}
      {active ? <span className="absolute -inset-1.5 rounded-full border-2 border-ink/70" /> : null}
    </span>
  );

  if (size === "lg") {
    return (
      <button type="button" onClick={onClick} className={cn("group flex min-w-0 flex-1 flex-col items-center gap-2.5 text-center", onClick && "cursor-pointer")}>
        {core}
        <span className="text-[12px] font-semibold tracking-[-0.01em] text-ink">{orb.full || orb.label}</span>
        <span className="mono-label text-[8.5px]" style={{ color: s.color }}>{s.label}{orb.total ? ` · ${orb.done}/${orb.total}` : ""}</span>
        {orb.detail ? <span className="line-clamp-2 max-w-[150px] text-[10.5px] leading-snug text-ink/55">{orb.detail}</span> : null}
      </button>
    );
  }
  return (
    <span className="group relative flex flex-col items-center gap-1" title={`${orb.full || orb.label} — ${s.label}${orb.detail ? "\n" + orb.detail : ""}`}>
      {core}
      <span className="mono-label text-[7.5px] text-ink/45">{orb.label}</span>
    </span>
  );
}

export default function OrbRail({ orbs = [], size = "sm", activeKey = null, onSelect }) {
  if (!orbs.length) return <span className="text-[11px] text-ink/40">No stages defined</span>;
  const gap = size === "lg" ? "gap-0" : "gap-0";
  return (
    <div className={cn("flex w-full items-start", gap)}>
      {orbs.map((orb, i) => (
        <React.Fragment key={orb.key}>
          <div className={cn("flex items-start", size === "lg" ? "min-w-0 flex-1 justify-center" : "")}>
            <Orb orb={orb} size={size} active={activeKey === orb.key} onClick={onSelect ? () => onSelect(orb) : undefined} />
          </div>
          {i < orbs.length - 1 ? (
            <span
              className={cn("shrink-0 self-start", size === "lg" ? "mt-[26px] h-[2px] w-6 md:w-10" : "mt-[12px] h-[2px] w-3 md:w-4")}
              style={{
                background:
                  orb.state === "done" ? "linear-gradient(90deg,#15803d,rgba(21,128,61,.25))"
                  : orb.state === "working" ? "linear-gradient(90deg,#ff3c00,rgba(255,60,0,.2))"
                  : "rgba(26,26,26,.12)"
              }}
            />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}
