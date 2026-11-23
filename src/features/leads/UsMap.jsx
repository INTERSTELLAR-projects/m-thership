// Inline SVG map of the 50 states (no map library). Click or keyboard-select a state. Alaska and Hawaii sit inset
// bottom-left as in the Albers USA projection.
import { useState } from "react";
import { US_STATES, US_VIEWBOX } from "./usStates";

const SMALL = new Set(["RI", "DE", "CT", "NJ", "MD", "MA", "NH", "VT", "DC"]);

export default function UsMap({ value, onPick, counts = {} }) {
  const [hover, setHover] = useState("");
  const h = US_STATES.find((s) => s.abbr === hover);
  return (
    <div className="relative">
      <svg viewBox={US_VIEWBOX} className="block h-auto w-full" role="group" aria-label="United States map: pick a state">
        <defs>
          <linearGradient id="us-flame" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#ff3c00" /><stop offset="0.55" stopColor="#ff6a00" /><stop offset="1" stopColor="#ffaa00" /></linearGradient>
        </defs>
        {US_STATES.map((s) => {
          const on = value === s.abbr;
          const n = counts[s.abbr] || 0;
          return (
            <path key={s.abbr} d={s.d} role="button" tabIndex={0} aria-label={`${s.name}${n ? `, ${n} leads` : ""}`} aria-pressed={on}
              onClick={() => onPick(s.abbr)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(s.abbr); } }}
              onMouseEnter={() => setHover(s.abbr)} onMouseLeave={() => setHover("")} onFocus={() => setHover(s.abbr)} onBlur={() => setHover("")}
              className="cursor-pointer outline-none transition-[fill] duration-200"
              fill={on ? "url(#us-flame)" : hover === s.abbr ? "#1a1a1a" : n ? "#d9cfc6" : "#f5f3f0"} stroke={on ? "#8a2e00" : "#b9b5af"} strokeWidth={on ? 1.4 : 0.7} strokeLinejoin="round" />
          );
        })}
        {US_STATES.filter((s) => !SMALL.has(s.abbr)).map((s) => (
          <text key={`t${s.abbr}`} x={s.cx} y={s.cy} textAnchor="middle" dominantBaseline="central" pointerEvents="none"
            className="select-none font-mono" fontSize="11" letterSpacing="0.5" fill={value === s.abbr || hover === s.abbr ? "#ffffff" : "rgba(26,26,26,.55)"}>{s.abbr}</text>
        ))}
      </svg>
      <div className="pointer-events-none absolute right-2 top-2 border border-hair bg-paper/95 px-2.5 py-1.5 font-mono text-[11px]" aria-live="polite">
        {h ? <>{h.name}{counts[h.abbr] ? <span className="text-[#ff3c00]"> · {counts[h.abbr]} leads</span> : null}</> : value ? US_STATES.find((s) => s.abbr === value)?.name : "Pick a state"}
      </div>
    </div>
  );
}
