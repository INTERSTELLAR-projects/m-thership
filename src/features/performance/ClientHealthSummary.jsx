// Client-facing site health card. Takes the output of clientHealthSummary() (or the portal's
// `site_health`), which never carries a score below the client floor.
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ShieldCheck, Wrench, Activity } from "lucide-react";
import { ChartTooltip, FlameDefs, axisProps, cursorProps, CountUp } from "@/components/charts/ChartKit";
import { fmtDate } from "@/lib/useData";
import { ScoreRing } from "./ui";

export default function ClientHealthSummary({ health, businessName }) {
  if (!health || (health.score == null && !health.fixes_applied && !health.edits_made && !health.last_checked)) {
    return (
      <div className="band-dark grain rounded-lg p-6">
        <p className="mono-label text-[10px] text-white/50">Website health</p>
        <p className="mt-2 text-[16px] font-semibold tracking-[-0.02em]">Your first site health check is on the way.</p>
        <p className="mt-1 text-[12.5px] text-white/55">Once we&apos;ve run it, you&apos;ll see your score and every fix we make here.</p>
      </div>
    );
  }
  const trend = (health.trend || []).map((t) => ({ ...t, label: fmtDate(t.date) }));
  return (
    <div className="band-dark grain overflow-hidden rounded-lg">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] flame-bg" />
      <div className="grid gap-6 p-5 md:grid-cols-[auto_1fr] md:p-6">
        <div className="flex items-center gap-5">
          {health.score != null ? (
            <ScoreRing score={health.score} size={128} stroke={11} />
          ) : (
            <div className="flex h-[128px] w-[128px] flex-col items-center justify-center rounded-full border border-dashed border-white/20 text-center">
              <Activity className="h-6 w-6 text-[#ff6a00]" />
              <span className="mono-label mt-2 text-[9px] text-white/60">{health.band || "In progress"}</span>
            </div>
          )}
          <div className="md:hidden">
            <p className="mono-label text-[10px] text-white/50">Website health</p>
            <p className="mt-1 text-[18px] font-semibold tracking-[-0.03em]">{businessName || "Your site"}</p>
          </div>
        </div>
        <div className="min-w-0">
          <div className="hidden md:block">
            <p className="mono-label text-[10px] text-white/50">Website health{health.last_checked ? ` · checked ${fmtDate(health.last_checked)}` : ""}</p>
            <p className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.03em]">
              {health.score != null ? <>Your site scores <span className="flame-text">{health.score}</span> on speed, search and accessibility.</> : <>We&apos;re actively improving your site&apos;s speed and search health.</>}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
              <p className="flex items-center gap-1.5 text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums"><Wrench className="h-4 w-4 text-[#ff6a00]" /><CountUp value={health.fixes_applied || 0} /></p>
              <p className="mono-label mt-2 text-[9px] text-white/50">SEO fixes made</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
              <p className="flex items-center gap-1.5 text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums"><ShieldCheck className="h-4 w-4 text-[#ffaa00]" /><CountUp value={health.edits_made || 0} /></p>
              <p className="mono-label mt-2 text-[9px] text-white/50">Site &amp; search edits</p>
            </div>
          </div>
          {trend.length >= 2 && (
            <div className="mt-4 h-[110px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 6, right: 4, left: -28, bottom: 0 }}>
                  <FlameDefs id="client-health" />
                  <XAxis dataKey="label" {...axisProps(true)} minTickGap={24} />
                  <YAxis domain={[60, 100]} {...axisProps(true)} width={40} />
                  <Tooltip content={<ChartTooltip dark />} cursor={cursorProps(true)} />
                  <Area type="monotone" dataKey="score" name="Health" stroke="#ff3c00" strokeWidth={2.5} fill="url(#client-health-area)" dot={false} activeDot={{ r: 4, fill: "#ff6a00", stroke: "#fff", strokeWidth: 1.5 }} isAnimationActive />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
