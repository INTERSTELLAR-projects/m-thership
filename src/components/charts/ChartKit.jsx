// Shared chart pieces so every chart in Møthership reads as one system:
// brand-gradient fills (#ff3c00 → #ff6a00 → #ffaa00), one tooltip, one axis style, KPI tiles with deltas.
import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export const FLAME = ["#ff3c00", "#ff6a00", "#ffaa00"];
// Categorical series colours: brand oranges first, then neutral inks that hold up in light and dark.
export const SERIES = ["#ff3c00", "#ff8a1f", "#1a1a1a", "#8a8580", "#c24100", "#ffaa00", "#5c5752", "#d9d4ce"];

export const axisProps = (dark = false) => ({
  tick: { fill: dark ? "rgba(255,255,255,0.45)" : "rgba(26,26,26,0.5)", fontSize: 10.5, fontFamily: "JetBrains Mono, ui-monospace, monospace" },
  tickLine: false,
  axisLine: false,
});
export const gridProps = (dark = false) => ({ stroke: dark ? "rgba(255,255,255,0.07)" : "rgba(26,26,26,0.07)", strokeDasharray: "3 4", vertical: false });
export const cursorProps = (dark = false) => ({ stroke: dark ? "rgba(255,170,0,0.45)" : "rgba(255,60,0,0.35)", strokeWidth: 1, strokeDasharray: "3 3" });
export const barCursor = (dark = false) => ({ fill: dark ? "rgba(255,255,255,0.04)" : "rgba(255,60,0,0.06)" });

// <defs> for a vertical area fill and a horizontal/vertical bar fill. Pass a unique id prefix per chart.
export function FlameDefs({ id, vertical = true, opacity = 0.42 }) {
  return (
    <defs>
      <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ff3c00" stopOpacity={opacity} />
        <stop offset="55%" stopColor="#ff6a00" stopOpacity={opacity * 0.35} />
        <stop offset="100%" stopColor="#ffaa00" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#ff3c00" />
        <stop offset="55%" stopColor="#ff6a00" />
        <stop offset="100%" stopColor="#ffaa00" />
      </linearGradient>
      <linearGradient id={`${id}-bar`} x1={vertical ? "0" : "0"} y1={vertical ? "0" : "0"} x2={vertical ? "0" : "1"} y2={vertical ? "1" : "0"}>
        <stop offset="0%" stopColor={vertical ? "#ff3c00" : "#ff3c00"} />
        <stop offset="60%" stopColor="#ff6a00" />
        <stop offset="100%" stopColor="#ffaa00" stopOpacity={vertical ? 0.85 : 1} />
      </linearGradient>
    </defs>
  );
}

// One tooltip for every chart. `format(value, name, entry)` formats each row.
export function ChartTooltip({ active, payload, label, format, labelFormat, dark = false, hideZero = false }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p && p.value != null && !(hideZero && Number(p.value) === 0));
  if (!rows.length) return null;
  const lbl = labelFormat ? labelFormat(label, payload) : label;
  return (
    <div className={`min-w-[140px] rounded-md border px-3 py-2 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.45)] backdrop-blur ${dark ? "border-white/10 bg-[#141414]/95 text-white" : "border-hair bg-card/95 text-ink"}`}>
      {lbl != null && lbl !== "" && <p className={`mono-label mb-1.5 text-[9px] ${dark ? "text-white/45" : "text-ink/50"}`}>{lbl}</p>}
      <div className="space-y-1">
        {rows.map((p, i) => (
          <div key={`${p.dataKey}-${i}`} className="flex items-center gap-2 text-[12px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color && !String(p.color).startsWith("url") ? p.color : p.payload?.fill && !String(p.payload.fill).startsWith("url") ? p.payload.fill : "#ff3c00" }} />
            <span className={`flex-1 truncate ${dark ? "text-white/65" : "text-ink/65"}`}>{p.name}</span>
            <span className="font-semibold tabular-nums">{format ? format(p.value, p.name, p) : typeof p.value === "number" ? p.value.toLocaleString() : p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Animated number. Respects reduced motion.
export function CountUp({ value, decimals = 0, duration = 700, format }) {
  const [shown, setShown] = useState(typeof value === "number" ? value : 0);
  const from = useRef(shown);
  useEffect(() => {
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShown(value); from.current = value; return undefined; }
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  if (typeof value !== "number" || !Number.isFinite(value)) return <>{value ?? "—"}</>;
  const v = Number(shown.toFixed(decimals));
  return <>{format ? format(v) : v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}

// KPI tile with optional delta vs a previous period. `goodWhen` = "up" | "down".
export function KpiTile({ label, value, display, sub, prev, goodWhen = "up", decimals = 0, format, spark, dark = false, accent = false }) {
  const num = typeof value === "number" && Number.isFinite(value) ? value : null;
  const delta = num != null && typeof prev === "number" && Number.isFinite(prev) && prev !== 0 ? ((num - prev) / Math.abs(prev)) * 100 : null;
  const flat = delta != null && Math.abs(delta) < 0.5;
  const good = delta == null || flat ? null : goodWhen === "down" ? delta < 0 : delta > 0;
  const Icon = flat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={`card-hover relative overflow-hidden rounded-md border p-4 ${dark ? "border-white/10 bg-white/[0.03] text-white" : "border-hair bg-card"}`}>
      {accent && <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] flame-bg" />}
      <p className={`mono-label text-[9.5px] ${dark ? "text-white/50" : "text-ink/55"}`}>{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className={`text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums ${accent ? "flame-text" : ""}`}>
          {display != null ? display : num != null ? <CountUp value={num} decimals={decimals} format={format} /> : "—"}
        </p>
        {spark}
      </div>
      <div className="mt-2 flex min-h-[16px] items-center gap-2">
        {delta != null && (
          <span className={`inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums ${flat ? (dark ? "bg-white/10 text-white/60" : "bg-ink/[0.06] text-ink/55") : good ? (dark ? "bg-emerald-400/[0.12] text-emerald-300" : "bg-green-600/[0.12] text-green-700") : (dark ? "bg-[#ff3c00]/15 text-[#ff8a5c]" : "bg-[#ff3c00]/[0.12] text-[#c24100]")}`}>
            <Icon className="h-3 w-3" />{flat ? "0%" : `${delta > 0 ? "+" : ""}${Math.round(delta)}%`}
          </span>
        )}
        {sub && <span className={`truncate text-[11px] ${dark ? "text-white/45" : "text-ink/50"}`}>{sub}</span>}
      </div>
    </div>
  );
}
