import React from "react";
import { Check } from "lucide-react";
import { ORB_STATES } from "@/features/packages/registry";
import { cn } from "@/lib/utils";

/*
 * A horizontal line of orbs, one per stage. Ink + flame only.
 *   done      solid ink, white check
 *   working   solid flame, breathing ring
 *   attention flame ring, flame "!" — the system stopped and needs you
 *   pending   hairline ink ring, hollow
 *   off       dashed ring
 * size: "sm" (rows in the all-in-one grid) · "lg" (client view)
 */
export function Orb({ orb, size = "sm", onClick, active = false }) {
  const s = ORB_STATES[orb.state] || ORB_STATES.pending;
  const d = size === "lg" ? 52 : 24;
  const styles = {
    done: { background: "#1a1a1a", border: "1.5px solid #1a1a1a" },
    working: { background: "#ff3c00", border: "1.5px solid #ff3c00", boxShadow: `0 0 0 ${size === "lg" ? 6 : 3}px rgba(255,60,0,.14)` },
    attention: { background: "#fff", border: "2px solid #ff3c00" },
    pending: { background: "transparent", border: "1.5px solid rgba(26,26,26,.4)" },
    off: { background: "transparent", border: "1.5px dashed rgba(26,26,26,.22)" }
  }[orb.state] || {};
  const core = (
    <span className={cn("relative grid shrink-0 place-items-center rounded-full transition-all duration-500", orb.state === "working" && "orb-breathe")} style={{ width: d, height: d, ...styles }}>
      {orb.state === "done" ? <Check className="text-white" style={{ width: d * 0.5, height: d * 0.5 }} strokeWidth={3} /> : null}
      {orb.state === "attention" ? <span className="font-mono font-bold leading-none text-[#ff3c00]" style={{ fontSize: d * 0.5 }}>!</span> : null}
      {orb.state === "working" ? <span className="rounded-full bg-white" style={{ width: d * 0.22, height: d * 0.22 }} /> : null}
      {orb.state === "working" ? <span className="orb-ring absolute inset-0 rounded-full border-2 border-[#ff3c00]" /> : null}
      {active ? <span className="absolute -inset-[5px] rounded-full border border-ink" /> : null}
    </span>
  );

  if (size === "lg") {
    return (
      <button type="button" onClick={onClick} className={cn("group flex min-w-0 flex-1 flex-col items-center gap-2.5 text-center", onClick && "cursor-pointer")}>
        {core}
        <span className="text-[12px] font-semibold tracking-[-0.01em] text-ink">{orb.full || orb.label}</span>
        <span className="mono-label text-[8.5px]" style={{ color: s.color }}>
          {s.label}
          {orb.total ? ` · ${orb.done}/${orb.total}` : ""}
        </span>
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
  return (
    <div className="flex w-full items-start">
      {orbs.map((orb, i) => (
        <React.Fragment key={orb.key}>
          <div className={cn("flex items-start", size === "lg" ? "min-w-0 flex-1 justify-center" : "")}>
            <Orb orb={orb} size={size} active={activeKey === orb.key} onClick={onSelect ? () => onSelect(orb) : undefined} />
          </div>
          {i < orbs.length - 1 ? (
            <span
              className={cn("shrink-0 self-start", size === "lg" ? "mt-[25px] h-px w-6 md:w-10" : "mt-[11px] h-px w-3 md:w-4")}
              style={{ background: orb.state === "done" ? "#1a1a1a" : orb.state === "working" ? "#ff3c00" : "rgba(26,26,26,.18)" }}
            />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}
