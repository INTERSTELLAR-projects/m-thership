import { useState } from "react";
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip, ReferenceLine, BarChart, Bar, Cell, YAxis } from "recharts";
import { RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Check, Shield, X, Pencil, ArrowUp, ArrowDown, TrendingUp } from "lucide-react";
import GameChartTooltip from "@/components/charts/GameChartTooltip";

const ROUTE_COLORS = ["#F47C20", "#FFC14D", "#FF9F1C", "#FFD27A"];
const BLENDED_COLOR = "#67B5FF";

function rowWinner(routes, key) {
  const candidates = routes.filter((r) => r[key] != null && r[key] !== 0 && !Number.isNaN(r[key]));
  if (candidates.length === 0) return null;
  // lower is better for: clients_needed_real, months_to_goal, delivery_hours_at_goal. higher better for rest.
  const lowerBetter = ["clients_needed_real", "months_to_goal", "delivery_hours_at_goal", "churn_drag"];
  return lowerBetter.includes(key)
    ? candidates.reduce((a, b) => (a[key] < b[key] ? a : b))
    : candidates.reduce((a, b) => (a[key] > b[key] ? a : b));
}

function fmt(n, prefix) {
  if (n === null || n === undefined) return "—";
  if (typeof n === "number") return prefix + Math.round(n).toLocaleString();
  return n;
}
function fmtMoney(n) {
  if (n === null || n === undefined) return "—";
  return "$" + Math.round(n).toLocaleString();
}
function fmtMonth(n) {
  if (n === null || n === undefined) return "Not reachable at these assumptions";
  return n + (n === 1 ? " month" : " months");
}

function FlagChip({ flag, label }) {
  if (!flag) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-red-500/10 text-red-400/80 border border-red-500/20">
      <AlertTriangle className="w-2.5 h-2.5" />{label}
    </span>
  );
}

function TableRow({ label, children }) {
  return (
    <div className="grid items-center py-1.5" style={{ gridTemplateColumns: "140px 1fr" }}>
      <span className="text-white/40 text-[10px] uppercase tracking-wider font-mono">{label}</span>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${children.length}, minmax(0,1fr))` }}>{children}</div>
    </div>
  );
}

function Cell2({ win, children }) {
  return (
    <div className={`text-[11px] font-mono px-2 py-1 rounded ${win ? "text-white border-l-2 border-orange-500 bg-orange-500/[0.05]" : "text-white/55"}`}>
      {children}
    </div>
  );
}

function ChecklistItem({ index, analysisId, planId, item }) {
  const key = `plan_check_${planId}_${analysisId}_${index}`;
  const [done, setDone] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key) || "false"); } catch { return false; }
  });
  const toggle = () => {
    const v = !done; setDone(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
  };
  return (
    <button onClick={toggle} className="flex items-start gap-2 text-left w-full group">
      <span className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${done ? "bg-green-500/20 border-green-500/40" : "border-white/15 group-hover:border-orange-500/40"}`}>
        {done && <Check className="w-2.5 h-2.5 text-green-400" />}
      </span>
      <span className={`text-xs ${done ? "text-white/30 line-through" : "text-white/70"}`}>{item}</span>
    </button>
  );
}

export default function PlanResults({ plan, analysis, running, onRerun, onEdit, relTime }) {
  const [open, setOpen] = useState(true);
  const c = analysis?.computed;
  const ai = analysis?.ai_summary;
  if (!c) return null;
  const allRoutes = [...(c.routes || []), c.blended].filter(Boolean);
  const labels = ["Monthly Price", "Clients Needed", "Time to Goal", "New MRR Added", "One-time Cash by Goal", "Total Cash at Goal", "Delivery hrs/mo", "Revenue / Del. Hour", "Risk Flags"];
  const wClients = rowWinner(allRoutes, "clients_needed_real");
  const wMonths = rowWinner(allRoutes, "months_to_goal");
  const wDH = rowWinner(allRoutes, "delivery_hours_at_goal");
  const wPrice = rowWinner(allRoutes, "total_cash_at_goal");
  const wRph = rowWinner(allRoutes, "revenue_per_delivery_hour");

  // Chart 1: projection to goal, 24 months
  const months24 = Array.from({ length: 24 }, (_, i) => {
    const m = i + 1;
    const point = { month: "M" + m };
    allRoutes.forEach((r) => {
      point[r.name] = r.series && r.series[m - 1] ? Math.round(r.series[m - 1].mrr) : null;
    });
    return point;
  });

  // Chart 2: time to goal
  const timeData = allRoutes.map((r) => ({ name: r.name, months: r.months_to_goal || 0, reached: !!r.reached }));
  const minMonths = Math.min(...timeData.map((t) => t.months).filter((m) => m > 0));

  // Chart 3: cash composition (winner or blended)
  const winner = (c.routes || []).concat(c.blended ? [c.blended] : []).find((r) => r.name === c.winner_name) || c.blended;
  const cashData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const s = winner?.series?.[m - 1];
    return {
      month: "M" + m,
      Recurring: s ? Math.max(0, Math.round(s.mrr - c.current_mrr)) : 0,
      "One-time": s ? Math.round(s.cumulative_one_time) : 0,
    };
  });

  const deltaUp = ai?.delta_since_last_run && !/dro|down|fell|lower|negative/i.test(JSON.stringify(ai.delta_since_last_run).toLowerCase());

  return (
    <div className="p-3.5 space-y-3">
      {/* a) Verdict bar */}
      <div className="flex items-start gap-2">
        <div className="flex-1">
          {ai ? (
            <p className="text-white text-[15px] font-medium leading-snug">
              {ai.verdict ? ai.verdict.replace(/\[winner\]/g, c.winner_name || "") : ""}
            </p>
          ) : (
            <p className="text-white/40 text-sm italic flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />Analysis unavailable — retry
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onEdit} title="Edit routes" className="p-1.5 rounded-md hover:bg-white/5 text-white/30 hover:text-orange-400 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onRerun} disabled={running} title="Re-run analysis" className="p-1.5 rounded-md hover:bg-white/5 text-white/30 hover:text-orange-400 transition-all disabled:opacity-40">
            {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
          <span className="text-white/25 text-[10px] font-mono">{relTime || ""}</span>
          <button onClick={() => setOpen(!open)} className="p-1 rounded-md hover:bg-white/5 text-white/30 transition-all">
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-3">
          {/* b) Comparison table */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3">
            <div className="grid items-center pb-2 mb-1 border-b border-white/[0.05]" style={{ gridTemplateColumns: "140px 1fr" }}>
              <span />
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${allRoutes.length}, minmax(0,1fr))` }}>
                {allRoutes.map((r, i) => (
                  <div key={i} className="text-center">
                    <span className="text-[11px] font-semibold" style={{ color: r.system_generated ? BLENDED_COLOR : ROUTE_COLORS[i % ROUTE_COLORS.length] }}>{r.name}</span>
                    {r.system_generated && <span className="block text-[8px] text-white/30 uppercase tracking-wider">auto</span>}
                  </div>
                ))}
              </div>
            </div>
            <TableRow label="Monthly Price">
              {allRoutes.map((r, i) => <Cell2 key={i}>{fmtMoney(r.monthly_price)}</Cell2>)}
            </TableRow>
            <TableRow label="Clients Needed">
              {allRoutes.map((r, i) => <Cell2 key={i} win={wClients && wClients.name === r.name}>{r.clients_needed_real != null ? r.clients_needed_real : "—"}</Cell2>)}
            </TableRow>
            <TableRow label="Time to Goal">
              {allRoutes.map((r, i) => <Cell2 key={i} win={wMonths && wMonths.name === r.name}>{r.reached ? `${fmtMonth(r.months_to_goal)} · ${r.goal_date}` : "Not reachable"}</Cell2>)}
            </TableRow>
            <TableRow label="New MRR Added">
              {allRoutes.map((r, i) => <Cell2 key={i}>{fmtMoney(r.reached ? c.goal_mrr - c.current_mrr : null)}</Cell2>)}
            </TableRow>
            <TableRow label="One-time Cash">
              {allRoutes.map((r, i) => <Cell2 key={i}>{r.has_addons ? fmtMoney(r.one_time_cash_at_goal) : "—"}</Cell2>)}
            </TableRow>
            <TableRow label="Total Cash at Goal">
              {allRoutes.map((r, i) => <Cell2 key={i} win={wPrice && wPrice.name === r.name}>{fmtMoney(r.total_cash_at_goal)}</Cell2>)}
            </TableRow>
            <TableRow label="Delivery hrs/mo">
              {allRoutes.map((r, i) => <Cell2 key={i} win={wDH && wDH.name === r.name}>{r.delivery_hours_at_goal != null ? r.delivery_hours_at_goal + "h" : "—"}</Cell2>)}
            </TableRow>
            <TableRow label="Rev / Del. Hour">
              {allRoutes.map((r, i) => <Cell2 key={i} win={wRph && wRph.name === r.name}>{fmtMoney(r.revenue_per_delivery_hour)}</Cell2>)}
            </TableRow>
            <TableRow label="Risk Flags">
              {allRoutes.map((r, i) => (
                <Cell2 key={i}>
                  <div className="flex flex-wrap gap-1">
                    <FlagChip flag={r.flags?.capacity_risk} label="Capacity" />
                    <FlagChip flag={r.flags?.churn_trap} label="Churn Trap" />
                    <FlagChip flag={r.flags?.never_reaches} label="Unreachable" />
                    <FlagChip flag={r.flags?.addon_dependency} label="Addon-heavy" />
                    {!r.flags?.capacity_risk && !r.flags?.churn_trap && !r.flags?.never_reaches && !r.flags?.addon_dependency && <span className="text-white/20 text-[9px]">—</span>}
                  </div>
                </Cell2>
              ))}
            </TableRow>
          </div>

          {/* c) Chart 1 projection */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3">
            <p className="text-white/40 text-[10px] uppercase tracking-widest font-mono mb-2">Projection to Goal</p>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={months24} margin={{ top: 5, right: 6, left: 6, bottom: 0 }}>
                  <defs>
                    {allRoutes.map((r, i) => {
                      const col = r.system_generated ? BLENDED_COLOR : ROUTE_COLORS[i % ROUTE_COLORS.length];
                      return (
                        <linearGradient key={i} id={`projGrad_${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={col} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={col} stopOpacity={0.02} />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9 }} axisLine={false} tickLine={false} interval={3} />
                  <YAxis hide />
                  <Tooltip content={<GameChartTooltip />} cursor={{ stroke: "rgba(255,170,0,0.2)", strokeWidth: 1 }} />
                  <ReferenceLine y={c.goal_mrr} stroke="#F47C20" strokeDasharray="5 4" strokeWidth={1.5} label={{ value: `GOAL $${Math.round(c.goal_mrr).toLocaleString()}`, fill: "#F47C20", fontSize: 9, position: "insideTopRight" }} />
                  {allRoutes.map((r, i) => (
                    <Area key={i} type="monotone" dataKey={r.name} stroke={r.system_generated ? BLENDED_COLOR : ROUTE_COLORS[i % ROUTE_COLORS.length]} strokeWidth={2} fill={`url(#projGrad_${i})`} style={{ filter: `drop-shadow(0 0 4px ${r.system_generated ? BLENDED_COLOR : ROUTE_COLORS[i % ROUTE_COLORS.length]}66)` }} dot={false} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* d & e) Time to goal + Cash composition */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3">
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-mono mb-2">Time to Goal</p>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeData} layout="vertical" margin={{ top: 2, right: 8, left: 8, bottom: 0 }}>
                    <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip content={<GameChartTooltip />} cursor={{ fill: "rgba(255,170,0,0.05)" }} />
                    <Bar dataKey="months" radius={[3, 3, 3, 3]}>
                      {timeData.map((t, i) => (
                        <Cell key={i} fill={t.reached && t.months === minMonths ? "url(#barWin)" : t.reached ? "rgba(255,143,0,0.35)" : "rgba(255,255,255,0.08)"} />
                      ))}
                    </Bar>
                    <defs>
                      <linearGradient id="barWin" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#F47C20" />
                        <stop offset="100%" stopColor="#FFC14D" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3">
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-mono mb-2">Cash Composition · {winner?.name || ""}</p>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashData} margin={{ top: 2, right: 6, left: 6, bottom: 0 }}>
                    <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip content={<GameChartTooltip />} cursor={{ fill: "rgba(255,170,0,0.05)" }} />
                    <Bar dataKey="Recurring" stackId="a" fill="#F47C20" fillOpacity={0.7} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="One-time" stackId="a" fill="#FFC14D" fillOpacity={0.55} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* f) AI insight block */}
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3 space-y-3">
            {ai ? (
              <>
                <div>
                  <p className="text-orange-400/70 text-[10px] uppercase tracking-widest font-mono mb-1.5">Why</p>
                  <ul className="space-y-1">
                    {(ai.reasoning || []).map((r, i) => <li key={i} className="text-white/70 text-xs flex gap-2"><span className="text-orange-500/60">·</span>{r}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-orange-400/70 text-[10px] uppercase tracking-widest font-mono mb-1.5">Watch For</p>
                  <p className="text-white/70 text-xs mb-1">{ai.hidden_insight}</p>
                  <p className="text-white/50 text-xs italic">{ai.switch_trigger}</p>
                </div>
                <div>
                  <p className="text-orange-400/70 text-[10px] uppercase tracking-widest font-mono mb-1.5">Next 30 Days</p>
                  <div className="space-y-1.5">
                    {(ai.next_30_days || []).map((a, i) => <ChecklistItem key={i} index={i} analysisId={analysis.id} planId={plan.id} item={a} />)}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-white/40 text-xs">
                <AlertTriangle className="w-3.5 h-3.5" />Analysis unavailable —<button onClick={onRerun} className="text-orange-400 underline">retry</button>
              </div>
            )}
          </div>

          {/* g) Delta strip */}
          {ai?.delta_since_last_run && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${deltaUp ? "border-green-500/20 bg-green-500/[0.05]" : "border-orange-500/20 bg-orange-500/[0.05]"}`}>
              {deltaUp ? <ArrowUp className="w-3.5 h-3.5 text-green-400" /> : <ArrowDown className="w-3.5 h-3.5 text-orange-400" />}
              <span className="text-white/70 text-xs">{ai.delta_since_last_run}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}