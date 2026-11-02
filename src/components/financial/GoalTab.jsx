import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Line, Area, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Crown, Flag, Gauge, Loader2, Pencil, RefreshCw, Route, Sparkles, Target, TrendingUp, Users, X, Zap, History } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { compactMoney, computeGoal, money, monthLabel, addMonths } from "./finance/metrics";
import { CountUp, EmptyState, EstimateTag, FinanceStyles, MoneyTooltip, Panel, Sparkline, SourceNote } from "./finance/ui";
import useRevenueGoal from "./finance/useRevenueGoal";
import { generateRoutes } from "./finance/ai";

const AXIS = { fill: "rgba(26,26,26,0.42)", fontSize: 10 };

export default function GoalTab({ data }) {
  const { finance: f, loading } = data;
  const { goal, loading: goalLoading, save } = useRevenueGoal(true);
  const [editing, setEditing] = useState(false);
  const [plans, setPlans] = useState([]);
  const [planIdx, setPlanIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  useEffect(() => {
    if (!goal?.id) return;
    base44.entities.GoalRoutePlan.filter({ goal_id: goal.id }, "-generated_at", 20).then((p) => { setPlans(p || []); setPlanIdx(0); }).catch(() => setPlans([]));
  }, [goal?.id]);

  const g = useMemo(() => (goal && f ? computeGoal(goal, f) : null), [goal, f]);

  const chartData = useMemo(() => {
    if (!g || !f) return [];
    const past = f.series.filter((s) => s.mrr != null).map((s) => ({ key: s.key, label: monthLabel(s.key, true), Actual: s.mrr }));
    const last = past[past.length - 1];
    const future = g.trajectory.map((t) => ({ key: t.key, label: monthLabel(t.key, true), Required: t.required, "Current run-rate": t.runRate }));
    if (last) { last.Required = f.mrr; last["Current run-rate"] = f.mrr; }
    return [...past, ...future];
  }, [g, f]);

  if (loading || goalLoading || !f || !goal || !g) {
    return <div className="flex items-center justify-center gap-2 py-24 text-ink/40"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-xs">Loading goal…</span></div>;
  }

  const plan = plans[planIdx] || null;
  const startKey = String(goal.start_date || "").slice(0, 7);
  const endKey = String(goal.deadline || "").slice(0, 7);
  const firstLabel = chartData.find((d) => d.key >= startKey)?.label;
  const lastLabel = [...chartData].reverse().find((d) => d.key <= endKey)?.label;
  const ringValue = g.metric === "run_rate" ? g.progress : (g.realizedKnown ? g.progress : 0);

  const regenerate = async () => {
    setGenerating(true); setGenError("");
    try {
      const created = await generateRoutes(goal, g, f);
      setPlans((p) => [created, ...p]); setPlanIdx(0);
    } catch (e) {
      setGenError(e?.message || "Generation failed — try again.");
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-5">
      <FinanceStyles />

      {/* HERO */}
      <section className="band-dark grain fin-rise relative overflow-hidden rounded-md border border-ink p-5 md:p-7">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: "radial-gradient(circle, #ff3c00, transparent 70%)" }} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mono-label text-white/50">(The goal)</p>
            <h2 className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.04em] text-white md:text-[42px]">
              {goal.title || compactMoney(goal.target_amount)}
            </h2>
            <p className="mt-2 text-xs text-white/55">
              {g.metric === "run_rate" ? "ARR run-rate (MRR × 12) by" : "Revenue collected"} {goal.metric === "run_rate" ? fmtDate(goal.deadline) : `${fmtDate(goal.start_date)} → ${fmtDate(goal.deadline)}`}
            </p>
          </div>
          <button type="button" onClick={() => setEditing((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[11px] text-white/70 transition-colors hover:border-[#ff6a00] hover:text-white">
            {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}{editing ? "Close" : "Edit goal"}
          </button>
        </div>

        {editing && <GoalEditor goal={goal} onSave={async (fields) => { await save(fields); setEditing(false); }} />}

        <div className="relative mt-6 grid grid-cols-1 items-center gap-8 md:grid-cols-[auto,1fr]">
          <ProgressRing value={ringValue} pace={g.metric === "annual_revenue" ? g.paceRatio : null} label={g.metric === "run_rate" ? "of target run-rate" : "collected"} />
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-3">
              <HeroStat label={g.metric === "run_rate" ? "Current run-rate" : "Collected in window"} value={g.metric === "annual_revenue" && !g.realizedKnown ? null : g.current} sub={g.metric === "annual_revenue" && !g.realizedKnown ? "Needs Stripe" : g.metric === "annual_revenue" && g.monthsUntilStart ? "Window not started" : `of ${compactMoney(g.target)}`} />
              <HeroStat label="Projected at today's MRR" value={g.projected} sub={`${((g.metric === "run_rate" ? g.progress : g.paceRatio) * 100).toFixed(1)}% of goal`} />
              <HeroStat label="Gap" value={g.gap} sub={g.onPace ? "On pace" : "At current run-rate"} flame />
              <HeroStat label="Required monthly growth" value={g.requiredGrowth != null ? g.requiredGrowth * 100 : null} format={(v) => `${v.toFixed(1)}%`} sub={g.requiredGrowth != null ? "compounding, every month from now" : "add MRR first"} />
              <HeroStat label={g.metric === "run_rate" ? "MRR needed by deadline" : "Avg MRR needed"} value={g.neededMrr} sub={g.metric === "run_rate" ? `${money(g.mrrGap)}/mo short` : `over ${g.monthsLeft} in-window months`} />
              <HeroStat label="Accounts needed" value={g.clientsNeeded} format={(v) => `+${Math.round(v)}`} sub={f.avgPerAccount ? `at today's avg ${money(f.avgPerAccount)}/mo` : "no avg price yet"} />
            </div>
            <Countdown deadline={g.deadlineDate} />
          </div>
        </div>
      </section>

      {/* TRAJECTORY */}
      <Panel title="(Trajectory)" subtitle="Actual MRR vs the compounding curve required to hit the goal by the deadline, and where today's run-rate goes if nothing changes" right={<EstimateTag>Required curve is math, not a forecast</EstimateTag>}>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="goalReqFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff3c00" stopOpacity="0.22" /><stop offset="100%" stopColor="#ffaa00" stopOpacity="0" /></linearGradient>
                <linearGradient id="goalReqStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#ff3c00" /><stop offset="55%" stopColor="#ff6a00" /><stop offset="100%" stopColor="#ffaa00" /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,26,26,0.07)" vertical={false} />
              {firstLabel && lastLabel && <ReferenceArea x1={firstLabel} x2={lastLabel} fill="#ff6a00" fillOpacity={0.05} />}
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} width={52} tickFormatter={compactMoney} />
              <Tooltip content={<MoneyTooltip />} />
              {g.metric === "run_rate" && <ReferenceLine y={g.targetMrr} stroke="#ff3c00" strokeDasharray="5 4" label={{ value: `Target ${compactMoney(g.targetMrr)}/mo`, fill: "#ff3c00", fontSize: 10, position: "insideTopLeft" }} />}
              <Area type="monotone" dataKey="Required" stroke="url(#goalReqStroke)" strokeWidth={2.4} fill="url(#goalReqFill)" connectNulls animationDuration={1500} />
              <Line type="monotone" dataKey="Current run-rate" stroke="#1a1a1a" strokeOpacity={0.5} strokeDasharray="4 4" dot={false} strokeWidth={1.5} connectNulls />
              <Line type="monotone" dataKey="Actual" stroke="#1a1a1a" strokeWidth={2.2} dot={{ r: 2.5, fill: "#1a1a1a" }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <SourceNote>Actual = {f.historySource === "stripe" ? "Stripe subscription history" : f.historySource === "snapshots" ? "daily finance snapshots" : "today's CRM MRR only (history builds daily)"} · shaded = goal window</SourceNote>
      </Panel>

      {/* ROUTES */}
      <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <p className="label-cross">(Routes)</p>
          <p className="mt-1 text-xs text-ink/50">AI-generated paths from your real numbers. Every projected figure is an estimate.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {plans.length > 1 && (
            <label className="inline-flex items-center gap-1.5 text-[11px] text-ink/55">
              <History className="h-3.5 w-3.5" />
              <select value={planIdx} onChange={(e) => setPlanIdx(Number(e.target.value))} className="rounded-md border border-hair bg-card px-2 py-1 text-[11px] text-ink outline-none">
                {plans.map((p, i) => <option key={p.id} value={i}>{i === 0 ? "Latest · " : ""}{fmtDateTime(p.generated_at)}</option>)}
              </select>
            </label>
          )}
          <button type="button" disabled={generating} onClick={regenerate} className="btn-roll is-flame rounded-md disabled:opacity-60">
            <span className="roll"><span>{generating ? "Generating…" : plan ? "Regenerate routes" : "Generate routes"}</span><span>{generating ? "Generating…" : plan ? "Regenerate routes" : "Generate routes"}</span></span>
            <span className="box rounded">{generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}</span>
          </button>
        </div>
      </div>
      {genError && <p className="rounded-md border border-[#ff3c00]/30 bg-[#ff3c00]/5 px-3 py-2 text-xs text-[#c22e00]">{genError}</p>}

      {!plan ? (
        <EmptyState icon={Route} title="No routes generated yet" body="Generate routes to get a pinned Hormozi flagship plus 3–4 alternatives, each with monthly milestones and first actions, built from today's numbers." />
      ) : (
        <>
          {plan.headline && <p className="fin-rise text-[15px] font-medium leading-snug tracking-tight text-ink/85">{plan.headline}</p>}
          <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink/40">Generated {fmtDateTime(plan.generated_at)} from MRR {money(plan.snapshot?.mrr)} · {plan.snapshot?.paying_accounts} accounts</p>
          <Flagship route={plan.flagship || {}} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(plan.routes || []).map((r, i) => <RouteCard key={`${r.name}-${i}`} route={r} index={i} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- pieces ----------

function GoalEditor({ goal, onSave }) {
  const [form, setForm] = useState({
    title: goal.title || "",
    target_amount: String(goal.target_amount ?? 1000000),
    metric: goal.metric || "annual_revenue",
    start_date: goal.start_date || "",
    deadline: goal.deadline || "",
  });
  const [busy, setBusy] = useState(false);
  const field = "mt-1 w-full rounded-md border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none focus:border-[#ff6a00]";
  return (
    <div className="relative mt-5 grid grid-cols-1 gap-3 rounded-md border border-white/15 bg-white/[0.03] p-4 sm:grid-cols-2 lg:grid-cols-5">
      <label className="text-[11px] text-white/55">Name<input className={field} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <label className="text-[11px] text-white/55">Target ($)<input type="number" min="0" className={field} value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} /></label>
      <label className="text-[11px] text-white/55">Metric
        <select className={field} value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}>
          <option value="annual_revenue" className="text-ink">Revenue collected in window</option>
          <option value="run_rate" className="text-ink">ARR run-rate by deadline</option>
        </select>
      </label>
      <label className="text-[11px] text-white/55">Window start<input type="date" className={field} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></label>
      <label className="text-[11px] text-white/55">Deadline<input type="date" className={field} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></label>
      <div className="sm:col-span-2 lg:col-span-5 flex justify-end">
        <button type="button" disabled={busy || !form.deadline || !(Number(form.target_amount) > 0)} onClick={async () => { setBusy(true); await onSave({ ...form, target_amount: Number(form.target_amount) }); setBusy(false); }} className="rounded-md px-4 py-2 text-xs font-semibold text-white flame-bg disabled:opacity-50">
          {busy ? "Saving…" : "Save goal"}
        </button>
      </div>
    </div>
  );
}

function ProgressRing({ value, pace, label }) {
  const size = 210, stroke = 14, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = setTimeout(() => setShown(Math.min(1, Math.max(0, value || 0))), 80); return () => clearTimeout(t); }, [value]);
  const paceClamped = pace != null ? Math.min(1, Math.max(0, pace)) : null;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="goalRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ff3c00" /><stop offset="55%" stopColor="#ff6a00" /><stop offset="100%" stopColor="#ffaa00" /></linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        {paceClamped != null && (
          <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,170,0,0.28)" strokeWidth={stroke} fill="none" strokeDasharray={`${c * paceClamped} ${c}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 1.4s cubic-bezier(.22,1,.36,1)" }} />
        )}
        <circle cx={size / 2} cy={size / 2} r={r} stroke="url(#goalRing)" strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${Math.max(0.001, c * shown)} ${c}`} style={{ transition: "stroke-dasharray 1.6s cubic-bezier(.22,1,.36,1)", filter: "drop-shadow(0 0 8px rgba(255,90,0,.55))" }} />
      </svg>
      <svg width={size} height={size} className="fin-orbit pointer-events-none absolute inset-0">
        <circle cx={size / 2} cy={stroke / 2} r="3" fill="#ffaa00" opacity="0.9" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[40px] font-semibold leading-none tracking-[-0.04em] text-white"><CountUp value={(value || 0) * 100} format={(v) => `${v.toFixed(v < 10 ? 1 : 0)}%`} /></span>
        <span className="mt-1 mono-label !text-[9px] text-white/50">{label}</span>
        {pace != null && <span className="mt-2 text-[10.5px] text-[#ffaa00]">pace {(pace * 100).toFixed(0)}%</span>}
      </div>
    </div>
  );
}

function HeroStat({ label, value, sub, format, flame }) {
  return (
    <div>
      <p className="mono-label !text-[9.5px] text-white/45">{label}</p>
      <p className={`mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.03em] ${flame ? "flame-text" : "text-white"}`}>
        {value == null ? <span className="text-white/30">—</span> : <CountUp value={value} format={format || compactMoney} />}
      </p>
      {sub && <p className="mt-1 text-[10.5px] text-white/45">{sub}</p>}
    </div>
  );
}

function Countdown({ deadline }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  if (!deadline) return null;
  const ms = Math.max(0, deadline.getTime() - now);
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  const cells = [[d, "days"], [h, "hrs"], [m, "min"], [s, "sec"]];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Flag className="h-3.5 w-3.5 text-[#ff6a00]" />
      <span className="mono-label !text-[9.5px] text-white/45 mr-1">Deadline in</span>
      {cells.map(([v, l]) => (
        <span key={l} className="rounded border border-white/12 bg-white/[0.04] px-2 py-1 text-center">
          <span className="block text-sm font-semibold tabular-nums text-white">{String(v).padStart(l === "days" ? 1 : 2, "0")}</span>
          <span className="block text-[8.5px] uppercase tracking-wider text-white/40">{l}</span>
        </span>
      ))}
    </div>
  );
}

function Milestones({ items, dark }) {
  const list = items || [];
  if (!list.length) return null;
  return (
    <div>
      <Sparkline data={list.map((m) => Number(m.target_mrr) || null)} height={38} />
      <details className="mt-2 group">
        <summary className={`cursor-pointer list-none text-[11px] ${dark ? "text-white/55 hover:text-white" : "text-ink/55 hover:text-ink"}`}>
          Monthly milestones ({list.length}) · ends at {money(list[list.length - 1]?.target_mrr)}/mo <span className="ml-1"><EstimateTag dark={dark} /></span>
        </summary>
        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
          {list.map((m, i) => (
            <div key={`${m.month}-${i}`} className={`grid grid-cols-[64px,72px,1fr] gap-2 border-b py-1 text-[11px] last:border-0 ${dark ? "border-white/10 text-white/70" : "border-hair text-ink/70"}`}>
              <span className="font-mono">{/^\d{4}-\d{2}$/.test(m.month) ? monthLabel(m.month, true) : m.month}</span>
              <span className="tabular-nums font-semibold">{money(m.target_mrr)}</span>
              <span className="truncate" title={m.focus}>{m.focus}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function Actions({ items, dark }) {
  return (
    <ol className="space-y-1.5">
      {(items || []).slice(0, 3).map((a, i) => (
        <li key={i} className={`flex gap-2 text-[12px] leading-snug ${dark ? "text-white/80" : "text-ink/80"}`}>
          <span className="mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-[9px] font-bold text-white flame-bg">{i + 1}</span>{a}
        </li>
      ))}
    </ol>
  );
}

function Flagship({ route }) {
  const gso = route.grand_slam_offer || {};
  const rows = [["Price move", route.price_move], ["Lead magnet", route.lead_magnet], ["Referrals / affiliates", route.referral_engine], ["Core offer to scale", route.core_offer_focus]].filter(([, v]) => v);
  return (
    <section className="band-dark grain fin-rise relative overflow-hidden rounded-md border border-ink p-5 md:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] flame-bg" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-[#ffaa00]" />
          <span className="mono-label text-[#ffaa00]">Pinned flagship</span>
        </div>
        <div className="flex gap-2">
          {route.est_end_mrr != null && <span className="text-[11px] text-white/60">End MRR <b className="text-white">{money(route.est_end_mrr)}</b></span>}
          {route.est_period_revenue != null && <span className="text-[11px] text-white/60">Window revenue <b className="text-white">{compactMoney(route.est_period_revenue)}</b></span>}
          <EstimateTag dark />
        </div>
      </div>
      <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">{route.title || "What Alex Hormozi would do"}</h3>
      {route.thesis && <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-white/70">{route.thesis}</p>}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-md border border-white/12 bg-white/[0.03] p-4 lg:col-span-1">
          <p className="mono-label !text-[9.5px] text-white/45">Grand Slam Offer</p>
          <p className="mt-1.5 text-[15px] font-semibold text-white">{gso.name || "—"}</p>
          {gso.price && <p className="mt-1 flame-text text-lg font-semibold">{gso.price}</p>}
          {gso.dream_outcome && <p className="mt-2 text-[12px] text-white/65"><b className="text-white/80">Dream outcome:</b> {gso.dream_outcome}</p>}
          {gso.guarantee && <p className="mt-1.5 text-[12px] text-white/65"><b className="text-white/80">Guarantee:</b> {gso.guarantee}</p>}
          {gso.bonuses?.length > 0 && <ul className="mt-2 space-y-0.5 text-[11.5px] text-white/60">{gso.bonuses.map((b, i) => <li key={i}>+ {b}</li>)}</ul>}
        </div>
        <div className="space-y-3 lg:col-span-1">
          {rows.map(([k, v]) => (
            <div key={k}><p className="mono-label !text-[9.5px] text-white/45">{k}</p><p className="mt-0.5 text-[12.5px] leading-snug text-white/80">{v}</p></div>
          ))}
          {route.what_to_stop?.length > 0 && (
            <div><p className="mono-label !text-[9.5px] text-white/45">Stop doing</p><ul className="mt-0.5 space-y-0.5 text-[12px] text-white/70">{route.what_to_stop.map((x, i) => <li key={i}>— {x}</li>)}</ul></div>
          )}
        </div>
        <div className="space-y-4 lg:col-span-1">
          <div><p className="mono-label mb-2 !text-[9.5px] text-white/45">First 3 actions</p><Actions items={route.first_actions} dark /></div>
          <Milestones items={route.milestones} dark />
          {route.risks && <p className="text-[11px] text-white/45"><Zap className="mr-1 inline h-3 w-3 text-[#ff6a00]" />{route.risks}</p>}
        </div>
      </div>
    </section>
  );
}

const ROUTE_ICONS = [TrendingUp, Users, Gauge, Sparkles, Target];

function RouteCard({ route, index }) {
  const Icon = ROUTE_ICONS[index % ROUTE_ICONS.length];
  return (
    <section className="card-hover fin-rise flex flex-col rounded-md border border-hair bg-card p-5" style={{ animationDelay: `${index * 70}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#ff3c00]/10"><Icon className="h-3.5 w-3.5 text-[#ff3c00]" /></span>
          <span className="mono-label text-ink/45">Route {index + 1}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {route.confidence && <span className="rounded border border-hair px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink/55">{route.confidence} confidence</span>}
          <EstimateTag />
        </div>
      </div>
      <h4 className="mt-3 text-lg font-semibold tracking-[-0.02em] text-ink">{route.name}</h4>
      {route.thesis && <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/65">{route.thesis}</p>}
      {route.levers?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{route.levers.map((l, i) => <span key={i} className="rounded-full border border-hair px-2 py-0.5 text-[10.5px] text-ink/60">{l}</span>)}</div>}
      <div className="mt-4 flex gap-6">
        {route.est_end_mrr != null && <div><p className="mono-label !text-[9px] text-ink/40">End MRR</p><p className="text-base font-semibold text-ink">{money(route.est_end_mrr)}</p></div>}
        {route.est_period_revenue != null && <div><p className="mono-label !text-[9px] text-ink/40">Window revenue</p><p className="text-base font-semibold flame-text">{compactMoney(route.est_period_revenue)}</p></div>}
      </div>
      <div className="mt-4"><Milestones items={route.milestones} /></div>
      <div className="mt-4 border-t border-hair pt-4"><p className="mono-label mb-2 !text-[9.5px] text-ink/45">First 3 actions</p><Actions items={route.first_actions} /></div>
      {route.risks && <p className="mt-3 text-[11px] text-ink/45"><Zap className="mr-1 inline h-3 w-3 text-[#ff3c00]" />{route.risks}</p>}
    </section>
  );
}

function fmtDate(d) { return d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"; }
function fmtDateTime(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"; }
// keep addMonths referenced for future window math helpers
void addMonths;
