// Dark dashboard primitives for site performance: score rings, vitals, panels, severity chips.
import { useEffect, useId, useState } from "react";
import { CountUp } from "@/components/charts/ChartKit";
import { band, SEVERITY, vitalTone } from "./policy";

export function DarkPanel({ label, title, action, children, className = "", bodyClass = "" }) {
  return (
    <section className={`relative overflow-hidden rounded-lg border border-white/10 bg-[#161514] ${className}`}>
      {(label || title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-3 md:px-5">
          <div className="min-w-0">
            {label && <p className="mono-label text-[9.5px] text-white/40">{label}</p>}
            {title && <h3 className="truncate text-[15px] font-semibold tracking-[-0.02em] text-white">{title}</h3>}
          </div>
          {action}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function DarkEmpty({ children, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {Icon && <Icon className="h-6 w-6 text-white/25" />}
      <p className="max-w-sm text-[13px] leading-relaxed text-white/50">{children}</p>
    </div>
  );
}

// Animated ring with the brand gradient. score = null shows an empty dashed ring.
export function ScoreRing({ score, size = 120, stroke = 10, label, sub, animate = true }) {
  const gid = useId().replace(/:/g, "");
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [shown, setShown] = useState(animate ? 0 : score ?? 0);
  useEffect(() => {
    const t = setTimeout(() => setShown(score ?? 0), 40);
    return () => clearTimeout(t);
  }, [score]);
  const b = band(score);
  const dash = (Math.max(0, Math.min(100, shown)) / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <defs>
            <linearGradient id={`ring-${gid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff3c00" />
              <stop offset="55%" stopColor="#ff6a00" />
              <stop offset="100%" stopColor="#ffaa00" />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} strokeDasharray={score == null ? "2 6" : undefined} />
          {score != null && (
            <circle
              cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#ring-${gid})`} strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              style={{ transition: "stroke-dasharray 1.1s cubic-bezier(.22,1,.36,1)", filter: "drop-shadow(0 0 8px rgba(255,106,0,0.35))" }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-semibold leading-none tracking-[-0.05em] text-white tabular-nums" style={{ fontSize: Math.round(size * 0.3) }}>
            {score == null ? "—" : <CountUp value={score} duration={1000} />}
          </span>
          {size >= 100 && <span className="mono-label mt-1 text-[8.5px]" style={{ color: b.color }}>{b.label}</span>}
        </div>
      </div>
      {label && <p className="mt-2 text-[12px] font-medium text-white/80">{label}</p>}
      {sub && <p className="text-[10.5px] text-white/40">{sub}</p>}
    </div>
  );
}

const TONE = {
  good: { text: "text-emerald-300", bar: "bg-emerald-400", label: "Good" },
  warn: { text: "text-[#ffaa00]", bar: "bg-[#ffaa00]", label: "Needs work" },
  bad: { text: "text-[#ff6a3d]", bar: "bg-[#ff3c00]", label: "Poor" },
  muted: { text: "text-white/40", bar: "bg-white/20", label: "No data" },
};

export function VitalTile({ def, value, fieldValue }) {
  const tone = vitalTone(value, def.good, def.poor);
  const t = TONE[tone];
  const fTone = fieldValue != null ? vitalTone(fieldValue, def.fieldGood ?? def.good, def.fieldPoor ?? def.poor) : null;
  const pct = value == null ? 0 : Math.min(100, (value / (def.poor * 1.25)) * 100);
  return (
    <div className="rounded-md border border-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="flex items-center justify-between">
        <span className="mono-label text-[9.5px] text-white/50" title={def.name}>{def.label}</span>
        <span className={`text-[9.5px] font-semibold ${t.text}`}>{t.label}</span>
      </div>
      <p className={`mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums ${value == null ? "text-white/35" : "text-white"}`}>
        {value == null ? "—" : def.fmt(value)}<span className="ml-0.5 text-[11px] font-normal text-white/40">{value == null ? "" : def.unit}</span>
      </p>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${pct}%`, transition: "width .9s cubic-bezier(.22,1,.36,1)" }} />
      </div>
      {fieldValue != null && (
        <p className="mt-2 text-[10.5px] text-white/45">
          Real users{def.fieldLabel ? ` (${def.fieldLabel})` : ""}: <span className={TONE[fTone].text}>{def.fmt(fieldValue)}{def.unit}</span>
        </p>
      )}
    </div>
  );
}

export function SeverityChip({ severity }) {
  const s = SEVERITY[severity] || SEVERITY.low;
  return <span className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.chip}`}><span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}</span>;
}

export function MiniBar({ value }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
      {value != null && <div className="h-full rounded-full flame-bg" style={{ width: `${Math.max(2, Math.min(100, value))}%`, transition: "width .9s cubic-bezier(.22,1,.36,1)" }} />}
    </div>
  );
}

export function DarkButton({ children, onClick, disabled, variant = "ghost", className = "", type = "button", title }) {
  const v = {
    flame: "bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] text-white hover:brightness-110 shadow-[0_8px_24px_-12px_rgba(255,60,0,0.7)]",
    ghost: "border border-white/15 text-white/80 hover:border-[#ff6a00]/60 hover:text-white",
    subtle: "text-white/60 hover:text-white",
  }[variant];
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`}>
      {children}
    </button>
  );
}
