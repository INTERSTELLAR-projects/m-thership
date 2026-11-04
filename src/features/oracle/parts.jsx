import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, ArrowRight, Shuffle, ExternalLink } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { REALITY, HORIZONS } from "@/features/oracle/topics";
import { host } from "@/features/oracle/oracleData";

// Dark "war room" surface tokens for the Intelligence page.
export const panel = "rounded-xl border border-white/[0.08] bg-white/[0.03]";
export const mono = "font-mono uppercase tracking-[0.14em]";

export function Label({ children, className = "" }) {
  return <p className={`${mono} text-[10px] text-white/45 ${className}`}>{children}</p>;
}

export function Title({ lead, accent, className = "" }) {
  return <h2 className={`text-[22px] font-semibold leading-none tracking-[-0.04em] text-white md:text-[26px] ${className}`}>{lead} <span className="flame-text">/{accent}</span></h2>;
}

const TREND = {
  up: { Icon: ArrowUpRight, cls: "text-emerald-400", label: "Rising" },
  down: { Icon: ArrowDownRight, cls: "text-red-400", label: "Falling" },
  flat: { Icon: ArrowRight, cls: "text-white/50", label: "Flat" },
  mixed: { Icon: Shuffle, cls: "text-[#ffaa00]", label: "Mixed" },
};
export function Trend({ t, withLabel = false }) {
  const x = TREND[t];
  if (!x) return null;
  return <span title={x.label} className={`inline-flex items-center gap-1 ${x.cls}`}><x.Icon className="h-4 w-4" />{withLabel && <span className={`${mono} text-[9.5px]`}>{x.label}</span>}</span>;
}

export function Horizon({ h }) {
  if (!h) return null;
  return <span className={`${mono} rounded border border-white/15 px-1.5 py-0.5 text-[9px] text-white/55`}>{HORIZONS[h] || h}</span>;
}

export function Confidence({ c }) {
  if (!c) return null;
  const cls = c === "high" ? "text-emerald-400 border-emerald-400/30" : c === "medium" ? "text-[#ffaa00] border-[#ffaa00]/30" : "text-white/50 border-white/15";
  return <span className={`${mono} rounded border px-1.5 py-0.5 text-[9px] ${cls}`}>{c} conf.</span>;
}

export function Sources({ sources, max = 4, className = "" }) {
  const list = (sources || []).filter((s) => s?.url);
  if (!list.length) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {list.slice(0, max).map((s, i) => (
        <a key={i} href={s.url} target="_blank" rel="noreferrer" title={s.title} onClick={(e) => e.stopPropagation()}
          className="inline-flex max-w-[220px] items-center gap-1 truncate rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10.5px] text-white/60 hover:border-[#ff6a00]/50 hover:text-white">
          <ExternalLink className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{s.publisher || host(s.url)}</span>{s.published_date && <span className="shrink-0 text-white/35">· {s.published_date}</span>}
        </a>
      ))}
      {list.length > max && <span className="text-[10.5px] text-white/35">+{list.length - max}</span>}
    </div>
  );
}

export function Stat({ s, big = false }) {
  if (!s) return null;
  return (
    <a href={s.source_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={`${s.source_title || host(s.source_url)} · ${s.date}`} className="group block">
      <span className={`block font-semibold tabular-nums tracking-[-0.03em] text-white ${big ? "text-[30px] leading-none" : "text-[17px]"}`}>{s.display || `${s.value}${s.unit ? ` ${s.unit}` : ""}`}</span>
      <span className="mt-1 block text-[11px] leading-snug text-white/55 group-hover:text-white/80">{s.label} <span className="text-white/35">· {s.date} · {host(s.source_url)}</span></span>
    </a>
  );
}

export function RealityMeter({ stage, compact = false }) {
  const idx = Math.max(0, REALITY.findIndex((r) => r.key === stage));
  return (
    <div>
      <div className="flex gap-1">
        {REALITY.map((r, i) => (
          <motion.span key={r.key} initial={{ opacity: 0.2 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }}
            className={`h-1.5 flex-1 rounded-full ${i <= idx ? "flame-bg" : "bg-white/10"}`} style={i <= idx ? { opacity: 0.55 + (i / 3) * 0.45 } : undefined} />
        ))}
      </div>
      {!compact && (
        <div className="mt-1.5 flex justify-between">
          {REALITY.map((r, i) => <span key={r.key} className={`${mono} text-[8.5px] ${i === idx ? "text-[#ff6a00]" : "text-white/30"}`}>{r.label}</span>)}
        </div>
      )}
    </div>
  );
}

export function SeriesChart({ series }) {
  const data = series.points.map((p) => ({ ...p, v: p.value }));
  return (
    <div className={`${panel} p-4`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold text-white">{series.label}</p>
        <Label>{series.unit || ""}</Label>
      </div>
      <div className="mt-3 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
            <defs><linearGradient id={`g-${series.metric}`} x1="0" x2="1"><stop offset="0" stopColor="#ff3c00" /><stop offset="1" stopColor="#ffaa00" /></linearGradient></defs>
            <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,.45)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,.45)", fontSize: 10 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#141416", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, fontSize: 12, color: "#fff" }}
              formatter={(v, _n, p) => [p?.payload?.display || v, series.label]} labelStyle={{ color: "rgba(255,255,255,.6)" }} />
            <Line type="monotone" dataKey="v" stroke={`url(#g-${series.metric})`} strokeWidth={2.5} dot={{ r: 3, fill: "#ff6a00", strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {series.points.map((p) => (
          <a key={p.date} href={p.source_url} target="_blank" rel="noreferrer" className="text-[10px] text-white/40 underline-offset-2 hover:text-white/80 hover:underline">{p.date}: {host(p.source_url)}</a>
        ))}
      </div>
    </div>
  );
}

export function FindingCard({ f, topicName }) {
  return (
    <div className={`${panel} p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        {topicName && <Label className="text-[#ff6a00]">{topicName}</Label>}
        <Trend t={f.trend} />
        <Horizon h={f.horizon} />
        <Confidence c={f.confidence} />
        <span className="ml-auto text-[10.5px] text-white/35">{f.date}</span>
      </div>
      <p className="mt-2 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-white">{f.headline}</p>
      {f.whats_happening && <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">{f.whats_happening}</p>}
      {f.key_stats?.length > 0 && (
        <div className="mt-3 grid gap-3 border-t border-white/[0.06] pt-3 sm:grid-cols-2">
          {f.key_stats.slice(0, 4).map((s, i) => <Stat key={i} s={s} />)}
        </div>
      )}
      {(f.impact || f.opportunity) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {f.impact && <p className="text-[12px] leading-snug text-white/60"><span className={`${mono} mr-1.5 text-[9px] text-white/40`}>For you</span>{f.impact}</p>}
          {f.opportunity && <p className="text-[12px] leading-snug text-white/60"><span className={`${mono} mr-1.5 text-[9px] text-[#ff6a00]`}>Opportunity</span>{f.opportunity}</p>}
        </div>
      )}
      <Sources sources={f.sources} className="mt-3" />
    </div>
  );
}

export function ProbBar({ p }) {
  const pct = Math.round((p || 0) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full flame-bg" initial={{ width: 0 }} animate={{ width: `${pct}%` }} /></div>
      <span className="text-[12px] font-semibold tabular-nums text-white">{pct}%</span>
    </div>
  );
}

export function Outcome({ o }) {
  const m = { right: "bg-emerald-500/15 text-emerald-300", wrong: "bg-red-500/15 text-red-300", partial: "bg-[#ffaa00]/15 text-[#ffcf80]", pending: "bg-white/[0.06] text-white/55" };
  return <span className={`${mono} rounded px-1.5 py-0.5 text-[9px] ${m[o || "pending"]}`}>{o || "pending"}</span>;
}
