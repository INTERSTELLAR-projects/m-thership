import { PILLARS } from "./engine";
import { PILLAR_COLOR, scoreTone } from "./ui";

// The 8 pillars as a compass constellation: each pillar is a spoke, its star sits at its score (0 centre, 100 rim),
// and the stars are joined into the business's current shape. A star with no data sits dashed on the inner ring.
export default function Constellation({ scores = {}, selected, onSelect, size = 420, compact = false, dark = false }) {
  const c = size / 2;
  const R = c - (compact ? 22 : 64);
  const pts = PILLARS.map((p, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / PILLARS.length;
    const sc = scores[p.id]?.score;
    const r = sc == null ? R * 0.12 : R * Math.max(0.06, sc / 100);
    return { p, a, sc, x: c + r * Math.cos(a), y: c + r * Math.sin(a), lx: c + (R + (compact ? 12 : 30)) * Math.cos(a), ly: c + (R + (compact ? 12 : 30)) * Math.sin(a), ex: c + R * Math.cos(a), ey: c + R * Math.sin(a) };
  });
  const poly = pts.map((t) => `${t.x.toFixed(1)},${t.y.toFixed(1)}`).join(" ");
  const ink = dark ? "rgba(255,255,255," : "rgba(26,26,26,";
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full max-w-full" role="img" aria-label="Business pillars constellation">
      <defs>
        <radialGradient id={`cg-${compact ? "s" : "l"}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff3c00" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ff3c00" stopOpacity="0" />
        </radialGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <circle key={k} cx={c} cy={c} r={R * k} fill="none" stroke={`${ink}${k === 1 ? 0.22 : 0.09})`} strokeDasharray={k === 1 ? "" : "2 5"} />
      ))}
      {pts.map((t) => <line key={t.p.id} x1={c} y1={c} x2={t.ex} y2={t.ey} stroke={`${ink}0.08)`} />)}
      <polygon points={poly} fill={`url(#cg-${compact ? "s" : "l"})`} stroke="#ff3c00" strokeOpacity="0.55" strokeWidth={compact ? 1 : 1.4} className="cmd-shape" />
      {pts.map((t) => {
        const tone = scoreTone(t.sc);
        const sel = selected === t.p.id;
        const rStar = compact ? 3.5 : sel ? 8 : 6;
        return (
          <g key={t.p.id} onClick={onSelect ? () => onSelect(t.p.id) : undefined} style={{ cursor: onSelect ? "pointer" : "default" }} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={`${t.p.name}: ${t.sc == null ? "no data" : t.sc}`} onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(t.p.id); } } : undefined}>
            <circle cx={t.x} cy={t.y} r={rStar * 2.6} fill={tone.color} opacity={sel ? 0.22 : 0.1} />
            <circle cx={t.x} cy={t.y} r={rStar} fill={t.sc == null ? "transparent" : tone.color} stroke={t.sc == null ? `${ink}0.45)` : sel ? (dark ? "#fff" : "#1a1a1a") : "none"} strokeDasharray={t.sc == null ? "2 2" : ""} strokeWidth={sel ? 2 : 1} />
            {!compact && (
              <>
                <text x={t.lx} y={t.ly - 6} textAnchor="middle" className="font-mono" fontSize="10" letterSpacing="1.2" fill={dark ? "rgba(255,255,255,0.6)" : "rgba(26,26,26,0.55)"}>{t.p.short}</text>
                <text x={t.lx} y={t.ly + 12} textAnchor="middle" fontSize="17" fontWeight="600" fill={t.sc == null ? `${ink}0.4)` : PILLAR_COLOR[t.p.id] === "#1a1a1a" && dark ? "#fff" : tone.color}>{t.sc == null ? "—" : t.sc}</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
