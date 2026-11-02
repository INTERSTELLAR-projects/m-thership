import { useId } from "react";
import { ROMAN } from "@/lib/prestige";

// Prestige rank emblem. Shield + chevrons that stack with the tier; a star from tier 4,
// wings from tier 5 up. `tier` is 1-based (0 = recruit / locked look).
export default function PrestigeEmblem({ tier = 1, size = 64, locked = false, showNumeral = true, className = "" }) {
  const uid = useId().replace(/:/g, "");
  const g = `pe-g-${uid}`;
  const gs = `pe-gs-${uid}`;
  const chevrons = Math.max(1, Math.min(3, tier || 1));
  const star = tier >= 4;
  const wings = tier >= 5;
  const stroke = locked ? "rgba(26,26,26,.28)" : `url(#${g})`;
  const fill = locked ? "rgba(26,26,26,.04)" : "#1a1a1a";
  const chevY = [40, 58, 76].slice(0, chevrons);
  // keep chevrons visually centered
  const shift = (3 - chevrons) * 9;

  return (
    <svg viewBox="0 0 160 150" width={size} height={(size * 150) / 160} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffaa00" />
          <stop offset=".5" stopColor="#ff6a00" />
          <stop offset="1" stopColor="#ff3c00" />
        </linearGradient>
        <radialGradient id={gs} cx=".5" cy=".35" r=".7">
          <stop offset="0" stopColor="#3a2418" />
          <stop offset="1" stopColor="#1a1a1a" />
        </radialGradient>
      </defs>
      {wings && (
        <g fill={locked ? "rgba(26,26,26,.12)" : `url(#${g})`} opacity={locked ? 1 : 0.95}>
          <path d="M28 48 C14 52 4 64 2 80 C12 72 20 70 28 72 C18 78 12 88 12 100 C20 92 28 88 34 88 Z" />
          <path d="M132 48 C146 52 156 64 158 80 C148 72 140 70 132 72 C142 78 148 88 148 100 C140 92 132 88 126 88 Z" />
        </g>
      )}
      <path
        d="M80 8 L128 28 L128 76 C128 106 106 126 80 140 C54 126 32 106 32 76 L32 28 Z"
        fill={locked ? fill : `url(#${gs})`}
        stroke={stroke}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M80 18 L119 34 L119 76 C119 100 102 117 80 129 C58 117 41 100 41 76 L41 34 Z" fill="none" stroke={locked ? "rgba(26,26,26,.12)" : "rgba(255,170,0,.25)"} strokeWidth="1.5" />
      {star && (
        <path
          d="M80 22 l3.6 7.4 8.1 1.2 -5.9 5.7 1.4 8.1 -7.2 -3.8 -7.2 3.8 1.4 -8.1 -5.9 -5.7 8.1 -1.2 Z"
          fill={locked ? "rgba(26,26,26,.25)" : "#ffaa00"}
          transform={`translate(0 ${shift ? -2 : -4})`}
        />
      )}
      <g transform={`translate(0 ${shift + (star ? 6 : 0)})`}>
        {chevY.map((y) => (
          <polyline key={y} points={`54,${y} 80,${y + 16} 106,${y}`} fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </g>
      {showNumeral && tier > 0 && (
        <text x="80" y="124" textAnchor="middle" fontFamily="JetBrains Mono, ui-monospace, monospace" fontWeight="700" fontSize="17" letterSpacing="2" fill={locked ? "rgba(26,26,26,.35)" : "#ffaa00"}>
          {ROMAN[tier] || tier}
        </text>
      )}
    </svg>
  );
}
