import { useRef } from "react";
import { Mic, Square } from "lucide-react";
import { PILLAR_BY_ID } from "./engine";

export const PILLAR_COLOR = {
  sales: "#ff3c00", marketing: "#ff6a00", delivery: "#e09100", finance: "#1f8a5b",
  clients: "#2f6fd0", team: "#7c4dff", systems: "#0e8f9b", owner: "#1a1a1a",
};
export function scoreTone(score) {
  if (score == null) return { color: "#8a8580", label: "No data" };
  if (score >= 85) return { color: "#1f8a5b", label: "Strong" };
  if (score >= 70) return { color: "#2f6fd0", label: "Stable" };
  if (score >= 50) return { color: "#e09100", label: "Watch" };
  if (score >= 30) return { color: "#ff6a00", label: "Weak" };
  return { color: "#ff3c00", label: "Critical" };
}

export function PillarChip({ id, dark = false, className = "" }) {
  const p = PILLAR_BY_ID[id];
  if (!p) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] ${dark ? "text-white/70" : "text-ink/60"} ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: PILLAR_COLOR[id] }} />
      {p.name}
    </span>
  );
}

export function Mono({ children, className = "" }) {
  return <p className={`font-mono text-[10.5px] uppercase tracking-[0.14em] ${className}`}>{children}</p>;
}

export function Meter({ value, color = "#ff3c00", dark = false, className = "" }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={`h-1.5 w-full overflow-hidden ${dark ? "bg-white/10" : "bg-ink/[0.08]"} ${className}`} role="meter" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${v}%`, background: color }} />
    </div>
  );
}

// The big round mic. Press and hold to talk (release sends), or tap to start and tap again to stop.
export function MicOrb({ listening, onPressStart, onPressEnd, size = 52, dark = false, label = "Talk", disabled = false }) {
  const down = (e) => { e.preventDefault(); if (!disabled) onPressStart?.(e); };
  const up = (e) => { e.preventDefault(); if (!disabled) onPressEnd?.(e); };
  return (
    <button
      type="button"
      aria-label={listening ? "Stop listening" : label}
      aria-pressed={listening}
      disabled={disabled}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onPressStart?.(e); } }}
      onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onPressEnd?.(e); } }}
      className={`relative flex shrink-0 select-none items-center justify-center rounded-full transition-transform duration-200 active:scale-95 disabled:opacity-40 motion-reduce:transition-none ${listening ? "bg-[#ff3c00] text-white" : dark ? "bg-white text-ink" : "bg-ink text-white"}`}
      style={{ width: size, height: size, touchAction: "none" }}
    >
      {listening && <span className="absolute inset-0 animate-ping rounded-full bg-[#ff3c00]/40 motion-reduce:animate-none" />}
      {listening ? <Square className="relative h-[38%] w-[38%] fill-current" /> : <Mic className="relative h-[42%] w-[42%]" strokeWidth={1.8} />}
    </button>
  );
}

// Press-vs-tap logic for MicOrb: a press longer than 350ms is push-to-talk; a short tap toggles.
export function useMicGesture({ listening, start, stop, onRelease }) {
  const t0 = useRef(0);
  return {
    onPressStart: () => {
      if (listening) { stop(); onRelease?.(); t0.current = 0; return; }
      t0.current = Date.now();
      start();
    },
    onPressEnd: () => {
      if (!t0.current) return;
      if (Date.now() - t0.current > 350) { stop(); onRelease?.(); }
      t0.current = 0;
    },
  };
}
