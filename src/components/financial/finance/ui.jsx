import { useEffect, useId, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { money } from "./metrics";

// ---------- Animated number ----------
export function useCountUp(value, duration = 1100) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (value == null || !Number.isFinite(value)) return undefined;
    const from = fromRef.current;
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (value - from) * eased;
      setDisplay(v);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

export function CountUp({ value, format = (v) => money(v), className = "" }) {
  const v = useCountUp(value);
  if (value == null || !Number.isFinite(value)) return <span className={className}>—</span>;
  return <span className={`tabular-nums ${className}`}>{format(v)}</span>;
}

// ---------- Sparkline (pure SVG, draws itself in) ----------
export function Sparkline({ data, height = 34, color = "#ff3c00", className = "" }) {
  const id = useId().replace(/:/g, "");
  const pts = (data || []).map((v) => (v == null || !Number.isFinite(v) ? null : v));
  const vals = pts.filter((v) => v != null);
  if (vals.length < 2) return <div style={{ height }} className={`flex items-end ${className}`}><span className="mono-label text-[9px] text-ink/30">no history yet</span></div>;
  const w = 120;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const step = w / (pts.length - 1);
  const coords = pts.map((v, i) => (v == null ? null : [i * step, height - 3 - ((v - min) / span) * (height - 6)])).filter(Boolean);
  const line = coords.map((c, i) => `${i ? "L" : "M"}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${height} L${coords[0][0].toFixed(1)},${height} Z`;
  const last = coords[coords.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={`w-full overflow-visible ${className}`} style={{ height }}>
      <defs>
        <linearGradient id={`sf${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`sl${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff3c00" />
          <stop offset="55%" stopColor="#ff6a00" />
          <stop offset="100%" stopColor="#ffaa00" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sf${id})`} className="fin-fade-in" />
      <path d={line} fill="none" stroke={`url(#sl${id})`} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="fin-draw" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill="#ff3c00" className="fin-pulse-dot" />
    </svg>
  );
}

// ---------- Delta chip ----------
export function Delta({ value, suffix = "%", invert = false, label }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-[10px] text-ink/35">{label || "no prior period"}</span>;
  const up = value > 0.0001;
  const down = value < -0.0001;
  const good = invert ? down : up;
  const bad = invert ? up : down;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${good ? "bg-[#ff3c00]/10 text-[#d83300]" : bad ? "bg-ink/[0.06] text-ink/60" : "bg-ink/[0.04] text-ink/45"}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}{suffix}
      {label && <span className="ml-1 font-normal text-ink/40">{label}</span>}
    </span>
  );
}

export const deltaPct = (prev, cur) => (prev == null || cur == null || !Number.isFinite(prev) || prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100);

// ---------- KPI tile ----------
export function KpiTile({ icon: Icon, label, value, format, sub, delta, deltaLabel, invertDelta, spark, empty, emptyText, hero, index = 0 }) {
  return (
    <div
      className={`card-hover fin-rise group relative flex min-h-[148px] flex-col overflow-hidden rounded-md border p-4 ${hero ? "band-dark grain border-ink" : "border-hair bg-card"}`}
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`mono-label ${hero ? "text-white/55" : "text-ink/50"}`}>{label}</span>
        {Icon && <Icon className={`h-3.5 w-3.5 ${hero ? "text-[#ff6a00]" : "text-ink/30 group-hover:text-[#ff3c00]"} transition-colors`} />}
      </div>
      {empty ? (
        <div className="mt-3 flex-1">
          <p className={`text-2xl font-semibold tracking-tight ${hero ? "text-white/40" : "text-ink/25"}`}>—</p>
          <p className={`mt-1 text-[11px] leading-snug ${hero ? "text-white/45" : "text-ink/45"}`}>{emptyText}</p>
        </div>
      ) : (
        <>
          <p className={`mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em] ${hero ? "flame-text" : "text-ink"}`}>
            <CountUp value={value} format={format} />
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {delta !== undefined && <Delta value={delta} label={deltaLabel} invert={invertDelta} />}
            {sub && <span className={`text-[10.5px] ${hero ? "text-white/50" : "text-ink/45"}`}>{sub}</span>}
          </div>
          <div className="mt-auto pt-2">{spark && <Sparkline data={spark} />}</div>
        </>
      )}
    </div>
  );
}

// ---------- Panel / empty / badges ----------
export function Panel({ title, subtitle, right, children, className = "", dark }) {
  return (
    <section className={`fin-rise relative overflow-hidden rounded-md border p-5 ${dark ? "band-dark grain border-ink" : "border-hair bg-card"} ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className={`label-cross ${dark ? "!text-white/80" : ""}`}>{title}</h3>}
            {subtitle && <p className={`mt-1 text-[11px] ${dark ? "text-white/45" : "text-ink/45"}`}>{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ icon: Icon, title, body, action, compact }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-md border border-dashed border-hair text-center ${compact ? "px-4 py-8" : "px-6 py-14"}`}>
      {Icon && <Icon className="mb-3 h-6 w-6 text-ink/25" />}
      <p className="text-sm font-medium text-ink/70">{title}</p>
      {body && <p className="mt-1 max-w-sm text-xs text-ink/45">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LiveBadge({ updatedAt, refreshing, onRefresh }) {
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(id); }, []);
  const secs = updatedAt ? Math.max(0, Math.round((Date.now() - updatedAt.getTime()) / 1000)) : null;
  const ago = secs == null ? "…" : secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`;
  return (
    <button type="button" onClick={onRefresh} className="inline-flex items-center gap-2 rounded-full border border-hair bg-card px-3 py-1.5 text-[11px] text-ink/60 transition-colors hover:border-[#ff3c00]/50 hover:text-ink" title="Refresh now">
      <span className="relative flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full rounded-full bg-[#ff3c00] opacity-60 ${refreshing ? "animate-ping" : "fin-breathe"}`} />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff3c00]" />
      </span>
      <span className="mono-label !text-[9.5px]">Live</span>
      <span className="tabular-nums">{refreshing ? "syncing…" : `updated ${ago}`}</span>
    </button>
  );
}

export function EstimateTag({ children = "Estimate", dark }) {
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${dark ? "border-white/20 text-white/55" : "border-ink/20 text-ink/50"}`}>{children}</span>;
}

export function SourceNote({ children }) {
  return <p className="mt-3 font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink/35">{children}</p>;
}

export function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-hair bg-card px-3 py-2 shadow-[0_12px_30px_-18px_rgba(26,26,26,.5)]">
      {label != null && <p className="mono-label mb-1 !text-[9px] text-ink/50">{label}</p>}
      {payload.filter((p) => p.value != null).map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-xs tabular-nums text-ink/80">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color || p.stroke || p.fill }} />
          <span className="text-ink/50">{p.name}</span>
          <span className="ml-auto font-semibold">{money(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// Keyframes used by the finance views (scoped class names, injected once).
export function FinanceStyles() {
  return (
    <style>{`
      @keyframes fin-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      .fin-rise { animation: fin-rise .5s cubic-bezier(.22,1,.36,1) both; }
      @keyframes fin-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
      .fin-draw { stroke-dasharray: 1; animation: fin-draw 1.2s cubic-bezier(.22,1,.36,1) both; }
      @keyframes fin-fade { from { opacity: 0; } to { opacity: 1; } }
      .fin-fade-in { animation: fin-fade 1.2s ease both .3s; }
      @keyframes fin-breathe { 0%,100% { transform: scale(1); opacity: .55; } 50% { transform: scale(2.2); opacity: 0; } }
      .fin-breathe { animation: fin-breathe 2.4s ease-out infinite; }
      @keyframes fin-dot { 0%,100% { r: 2.6; } 50% { r: 3.6; } }
      .fin-pulse-dot { animation: fin-dot 2s ease-in-out infinite; }
      @keyframes fin-spin { to { transform: rotate(360deg); } }
      .fin-orbit { animation: fin-spin 14s linear infinite; transform-origin: 50% 50%; }
      @media (prefers-reduced-motion: reduce) { .fin-rise, .fin-draw, .fin-fade-in, .fin-breathe, .fin-pulse-dot, .fin-orbit { animation: none !important; } .fin-draw { stroke-dasharray: none; } }
    `}</style>
  );
}
