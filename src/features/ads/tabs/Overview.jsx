import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Loader2 } from "lucide-react";
import { ChartTooltip, FlameDefs, KpiTile, axisProps, cursorProps, gridProps } from "@/components/charts/ChartKit";
import { KEYS, inScope, listMetrics, loadSettings } from "../lib/adsApi";
import { groupBy, int, money, monthToDate, pct, projectMonth, ratio, series, sum, windows } from "../lib/metrics";
import { Btn, Empty, Notice, Panel, Pill } from "../ui";

const RANGES = [7, 30, 90];

export default function Overview({ clientId = "", onGo }) {
  const [days, setDays] = useState(30);
  const [level, setLevel] = useState("campaign");
  const mQ = useQuery({ queryKey: KEYS.metrics(days), queryFn: () => listMetrics(days) });
  const sQ = useQuery({ queryKey: KEYS.settings, queryFn: () => loadSettings() });
  const rows = useMemo(() => (mQ.data || []).filter(inScope(clientId)), [mQ.data, clientId]);
  const s = sQ.data || {};

  const camp = rows.filter((r) => r.level === "campaign");
  const { cur, prev } = windows(camp, days);
  const a = sum(cur);
  const b = sum(prev);
  const trend = series(cur, days);
  const mtd = monthToDate(rows);
  const proj = projectMonth(mtd);
  const cap = Number(s.monthly_budget_cap) || 0;
  const capPct = cap ? (mtd / cap) * 100 : 0;
  const breakdown = groupBy(windows(rows.filter((r) => r.level === level), days).cur, (r) => `${r.platform}|${r.external_id}`).sort((x, y) => y.spend - x.spend);
  const noRevenue = a.spend > 0 && !a.revenue;

  if (mQ.isLoading) return <p className="py-20 text-center text-[13px] text-ink/50"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading performance…</p>;

  if (!rows.length) {
    return (
      <Empty icon={BarChart3} title="No ad data yet" action={<Btn variant="flame" onClick={() => onGo("connections")}>Open Connections</Btn>}>
        Numbers appear here only after a real sync from Meta Ads or a Google Ads CSV import. Nothing is estimated or filled in.
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex border border-hair bg-card">
          {RANGES.map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} className={`h-8 px-3 text-[12px] ${days === d ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}>{d}d</button>
          ))}
        </div>
        <span className="mono-label text-[9.5px] text-ink/45">vs previous {days} days · all platforms · campaign level</span>
      </div>

      {cap > 0 && (
        <Panel label="Monthly budget cap" title={`${money(mtd)} of ${money(cap)} spent this month`} right={<Pill tone={capPct >= 100 ? "fail" : capPct >= 80 ? "warn" : "ok"}>{Math.round(capPct)}%</Pill>} bodyClass="p-3.5">
          <div className="h-2 w-full bg-ink/[0.07]"><div className="h-2 flame-bg" style={{ width: `${Math.min(100, capPct)}%` }} /></div>
          <p className="mt-2 text-[12px] text-ink/60">Projected month at the current pace: {money(proj)}.{" "}
            {capPct >= 100 ? <strong className="text-[#d83300]">Cap reached — budget increases and launches are blocked until next month or until you raise the cap.</strong>
              : proj > cap ? <strong className="text-[#c44a00]">On pace to pass the cap; increases will be blocked once it is reached.</strong> : "Within the cap."}
          </p>
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiTile label="Spend" value={a.spend} prev={b.spend} format={(v) => money(v)} goodWhen="down" accent />
        <KpiTile label="ROAS" value={a.roas ?? undefined} display={a.roas == null ? "—" : undefined} prev={b.roas ?? undefined} decimals={2} format={(v) => ratio(v)} sub={noRevenue ? "no revenue tracked" : s.target_roas ? `target ${ratio(s.target_roas)}` : ""} />
        <KpiTile label="CPA" value={a.cpa ?? undefined} display={a.cpa == null ? "—" : undefined} prev={b.cpa ?? undefined} format={(v) => money(v)} goodWhen="down" sub={s.target_cpa ? `target ${money(s.target_cpa)}` : ""} />
        <KpiTile label="Conversions" value={a.conversions} prev={b.conversions} decimals={0} />
        <KpiTile label="CTR" value={a.ctr ?? undefined} display={a.ctr == null ? "—" : undefined} prev={b.ctr ?? undefined} decimals={2} format={(v) => pct(v)} />
      </div>

      <Panel label="Trend" title="Spend, revenue and conversions" bodyClass="h-[280px] p-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <FlameDefs id="adsTrend" />
            <CartesianGrid {...gridProps()} />
            <XAxis dataKey="label" {...axisProps()} interval="preserveStartEnd" minTickGap={24} />
            <YAxis yAxisId="m" {...axisProps()} width={48} tickFormatter={(v) => `$${v}`} />
            <YAxis yAxisId="c" orientation="right" {...axisProps()} width={32} allowDecimals={false} />
            <Tooltip cursor={cursorProps()} content={<ChartTooltip format={(v, name) => (name === "Conversions" ? int(v) : money(v))} />} />
            <Area yAxisId="m" type="monotone" dataKey="spend" name="Spend" stroke="url(#adsTrend-stroke)" strokeWidth={2} fill="url(#adsTrend-area)" />
            <Line yAxisId="m" type="monotone" dataKey="revenue" name="Revenue" stroke="#1a1a1a" strokeWidth={1.5} dot={false} />
            <Line yAxisId="c" type="monotone" dataKey="conversions" name="Conversions" stroke="#8a8580" strokeDasharray="4 3" strokeWidth={1.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      {noRevenue && <Notice tone="warn">Spend is tracked but no conversion value is: ROAS shows "—". Pass a value with your Meta pixel events (or include Conv. value in the Google CSV) to unlock ROAS-based recommendations and the auto-pause rule.</Notice>}

      <Panel
        label="Breakdown"
        title={`By ${level === "campaign" ? "campaign" : level === "adset" ? "ad set / ad group" : "creative (ad)"} · last ${days} days`}
        right={
          <div className="flex border border-hair">
            {[["campaign", "Campaign"], ["adset", "Ad set"], ["ad", "Creative"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setLevel(k)} className={`h-7 px-2.5 text-[11.5px] ${level === k ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}>{l}</button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[12.5px]">
            <thead>
              <tr className="mono-label border-b border-hair text-left text-[9px] text-ink/45">
                <th className="px-3.5 py-2 font-normal">Name</th><th className="px-2 py-2 text-right font-normal">Spend</th><th className="px-2 py-2 text-right font-normal">Impr.</th><th className="px-2 py-2 text-right font-normal">CTR</th><th className="px-2 py-2 text-right font-normal">Conv.</th><th className="px-2 py-2 text-right font-normal">CPA</th><th className="px-2 py-2 text-right font-normal">ROAS</th><th className="px-3.5 py-2 text-right font-normal">Freq.</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((g) => (
                <tr key={g.key} className="border-b border-hair/60 last:border-0 hover:bg-paper">
                  <td className="max-w-[280px] truncate px-3.5 py-2"><Pill tone="info" className="mr-2">{g.platform}</Pill>{g.name}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{money(g.spend)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{int(g.impressions)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{pct(g.ctr)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{int(g.conversions)}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${s.target_cpa && g.cpa > s.target_cpa ? "text-[#d83300]" : ""}`}>{money(g.cpa)}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${s.target_roas && g.roas != null && g.roas < s.target_roas ? "text-[#d83300]" : ""}`}>{ratio(g.roas)}</td>
                  <td className="px-3.5 py-2 text-right tabular-nums">{g.frequency == null || !g.frequency ? "—" : g.frequency.toFixed(2)}</td>
                </tr>
              ))}
              {!breakdown.length && <tr><td colSpan={8} className="px-3.5 py-8 text-center text-ink/45">No {level} rows in this range.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
