import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Banknote, CircleDollarSign, Clock, Loader2, PlugZap, Receipt, Repeat, TrendingUp, Users, Wallet, BarChart3 } from "lucide-react";
import { compactMoney, money, monthLabel } from "./finance/metrics";
import { deltaPct, EmptyState, FinanceStyles, KpiTile, LiveBadge, MoneyTooltip, Panel, SourceNote } from "./finance/ui";

const AXIS = { fill: "rgba(26,26,26,0.42)", fontSize: 10 };
const GRID = "rgba(26,26,26,0.07)";

export default function FinanceDashboard({ data }) {
  const { finance: f, loading, refreshing, updatedAt, reload } = data;

  const s = f?.series || [];
  const last = s[s.length - 1];
  const prev = s[s.length - 2];

  const revenueData = useMemo(() => s.map((m) => ({ label: monthLabel(m.key, true), Collected: m.collected, "Net to bank": m.stripeNet, MRR: m.mrr })), [s]);
  const cashData = useMemo(() => s.map((m) => ({ label: monthLabel(m.key, true), "Cash in": m.collected, "Cash out": m.cashOut ? -m.cashOut : 0, Net: m.net })), [s]);
  const moveData = useMemo(() => (f?.movement || []).map((m) => ({ label: monthLabel(m.key, true), New: m.new, Expansion: m.expansion, Churn: m.churn, Net: m.net })), [f]);

  if (loading || !f) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-ink/40">
        <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-xs">Pulling CRM, expenses and Stripe…</span>
      </div>
    );
  }

  const mrrSpark = s.map((m) => m.mrr);
  const anyRevenue = revenueData.some((r) => r.Collected != null || r.MRR != null);
  const runRateNet = f.mrr - f.expensesMonthly;
  const maxAccount = Math.max(1, ...f.accounts.map((a) => a.mrr));

  return (
    <div className="space-y-5">
      <FinanceStyles />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SourceChip ok label="CRM clients" />
          <SourceChip ok label="Expenses" />
          <SourceChip ok={f.stripeOk} label={f.stripeOk ? "Stripe payments" : "Stripe not connected"} />
          <SourceChip ok={f.subsOk} label={f.subsOk ? "Stripe subscriptions" : "No subscription history"} />
        </div>
        <LiveBadge updatedAt={updatedAt} refreshing={refreshing} onRefresh={reload} />
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile index={0} hero icon={Repeat} label="MRR" value={f.mrr} spark={mrrSpark}
          delta={deltaPct(prev?.mrr, f.mrr)} deltaLabel="vs last mo" sub={`${f.accounts.length} paying accounts`} />
        <KpiTile index={1} icon={TrendingUp} label="ARR run-rate" value={f.arr} format={compactMoney} spark={mrrSpark.map((v) => (v == null ? null : v * 12))}
          delta={deltaPct(prev?.mrr, f.mrr)} deltaLabel="vs last mo" sub="MRR × 12" />
        <KpiTile index={2} icon={CircleDollarSign} label="Collected this month" value={f.collectedThisMonth} empty={!f.stripeOk}
          emptyText="Connect Stripe (Stripe tab) to see real collections." spark={s.map((m) => m.collected)}
          delta={deltaPct(prev?.collected, last?.collected)} deltaLabel="vs last mo (partial)" />
        <KpiTile index={3} icon={Clock} label="Outstanding" value={f.outstanding} empty={f.outstanding == null}
          emptyText="Needs Stripe subscription data." invertDelta
          sub={`Stripe-billed MRR not paid yet this month${f.offStripeMrr > 0 ? ` · ${money(f.offStripeMrr)}/mo billed outside Stripe not tracked` : ""}`} />
        <KpiTile index={4} icon={Receipt} label="Expenses / mo" value={f.expensesMonthly} format={(v) => money(v)} invertDelta
          spark={s.map((m) => m.cashOut || null)} sub={`${money(last?.expensesPaid || 0)} marked paid this month`} />
        <KpiTile index={5} icon={Wallet} label={f.stripeOk ? "Net this month" : "Net run-rate"} value={f.stripeOk ? f.netThisMonth : runRateNet}
          spark={f.stripeOk ? s.map((m) => m.net) : null}
          sub={f.stripeOk ? "Collected − expenses paid − Stripe fees" : "MRR − monthly expenses"} />
        <KpiTile index={6} icon={Users} label="Clients" value={f.accounts.length} format={(v) => Math.round(v).toString()}
          spark={s.map((m) => m.clients)} sub={`${f.activeClients} active CRM clients · bundles count once`} />
        <KpiTile index={7} icon={BarChart3} label="Avg revenue / account" value={f.avgPerAccount} empty={f.avgPerAccount == null}
          emptyText="No paying accounts yet." spark={s.map((m) => (m.mrr != null && m.clients ? m.mrr / m.clients : null))} sub="MRR ÷ paying accounts" />
      </div>

      {/* Revenue over time + by client */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="(Revenue over time)" subtitle="Collected and net-to-bank from Stripe, MRR from subscription history — last 12 months">
          {anyRevenue ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="finRevFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff3c00" stopOpacity="0.38" />
                      <stop offset="100%" stopColor="#ffaa00" stopOpacity="0.02" />
                    </linearGradient>
                    <linearGradient id="finRevStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ff3c00" /><stop offset="55%" stopColor="#ff6a00" /><stop offset="100%" stopColor="#ffaa00" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} width={52} tickFormatter={compactMoney} />
                  <Tooltip content={<MoneyTooltip />} cursor={{ stroke: "rgba(255,60,0,.3)" }} />
                  <Area type="monotone" dataKey="Collected" stroke="url(#finRevStroke)" strokeWidth={2.4} fill="url(#finRevFill)" connectNulls animationDuration={1200} />
                  <Area type="monotone" dataKey="Net to bank" stroke="#1a1a1a" strokeOpacity={0.55} strokeWidth={1.4} fill="transparent" strokeDasharray="4 3" connectNulls animationDuration={1400} />
                  <Area type="stepAfter" dataKey="MRR" stroke="#ffaa00" strokeWidth={1.8} fill="transparent" connectNulls animationDuration={1600} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={PlugZap} title="No revenue history yet" body="Collections appear once Stripe is connected. MRR history also builds from the daily snapshot this page saves." compact />
          )}
          <Legend items={[["Collected", "#ff3c00"], ["Net to bank", "#1a1a1a"], ["MRR", "#ffaa00"]]} />
        </Panel>

        <Panel title="(Revenue by client)" subtitle="Current MRR per account (bundled clients combined)">
          {f.accounts.length ? (
            <div className="space-y-2.5">
              {f.accounts.map((a, i) => (
                <div key={a.key} className="group">
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-[11.5px]">
                    <span className="truncate text-ink/75" title={a.label}>{a.label}</span>
                    <span className="shrink-0 tabular-nums font-semibold text-ink">{money(a.mrr)}<span className="ml-1 text-[10px] font-normal text-ink/40">{((a.mrr / f.mrr) * 100).toFixed(0)}%</span></span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
                    <div className="fin-bar h-full rounded-full flame-bg" style={{ width: `${(a.mrr / maxAccount) * 100}%`, animationDelay: `${i * 60}ms` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Users} title="No paying clients" body="Add services with prices to active CRM clients." compact />
          )}
          <style>{`@keyframes fin-bar { from { transform: scaleX(0); } to { transform: scaleX(1); } } .fin-bar { transform-origin: left; animation: fin-bar .9s cubic-bezier(.22,1,.36,1) both; }`}</style>
        </Panel>
      </div>

      {/* MRR movement + cash in/out */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="(MRR movement)" subtitle={f.movementSource === "stripe" ? "New, expansion and churn from Stripe subscription start/end dates" : f.movementSource === "snapshots" ? "From daily finance snapshots (month-end vs prior month-end)" : "New vs expansion vs churn"}>
          {moveData.length ? (
            <div className="h-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={moveData} stackOffset="sign" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48} tickFormatter={compactMoney} />
                  <Tooltip content={<MoneyTooltip />} cursor={{ fill: "rgba(255,60,0,.05)" }} />
                  <ReferenceLine y={0} stroke="rgba(26,26,26,.25)" />
                  <Bar dataKey="New" stackId="m" fill="#ff3c00" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Expansion" stackId="m" fill="#ffaa00" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Churn" stackId="m" fill="#1a1a1a" fillOpacity={0.75} radius={[0, 0, 3, 3]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={Activity} title="Not derivable yet" body="Needs Stripe subscription history, or at least two months of the daily snapshots this page now records." compact />
          )}
          <Legend items={[["New", "#ff3c00"], ["Expansion", "#ffaa00"], ["Churn", "#1a1a1a"]]} />
        </Panel>

        <Panel title="(Cash in vs out)" subtitle="In = Stripe collected · Out = expenses marked paid + Stripe fees/Capital">
          {cashData.some((c) => c["Cash in"] != null || c["Cash out"]) ? (
            <div className="h-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cashData} stackOffset="sign" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48} tickFormatter={compactMoney} />
                  <Tooltip content={<MoneyTooltip />} cursor={{ fill: "rgba(255,60,0,.05)" }} />
                  <ReferenceLine y={0} stroke="rgba(26,26,26,.25)" />
                  <Bar dataKey="Cash in" stackId="c" fill="#ff6a00" radius={[3, 3, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="Cash out" stackId="c" fill="#1a1a1a" fillOpacity={0.7} radius={[0, 0, 3, 3]} maxBarSize={26} />
                  <Line type="monotone" dataKey="Net" stroke="#ff3c00" strokeWidth={2} dot={{ r: 2.5, fill: "#ff3c00" }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={Banknote} title="No cash movements recorded" body="Mark bills paid on the Expenses tab and connect Stripe to see cash flow." compact />
          )}
          <Legend items={[["Cash in", "#ff6a00"], ["Cash out", "#1a1a1a"], ["Net", "#ff3c00"]]} />
          {!f.stripeOk && <SourceNote>Cash in needs Stripe — out-only until connected.</SourceNote>}
        </Panel>
      </div>

      {/* Pipeline strip */}
      <Panel title="(Pipeline)" subtitle="Pending recurring deals from Projections">
        {f.pipeline.length ? (
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <Stat label="Pending MRR" value={money(f.pipelineMrr)} />
            <Stat label="Deals" value={String(f.pipeline.length)} />
            <Stat label="MRR if all close" value={money(f.mrr + f.pipelineMrr)} accent />
            <div className="flex min-w-[220px] flex-1 flex-wrap gap-1.5">
              {f.pipeline.slice(0, 8).map((p) => (
                <span key={p.id} className="rounded-full border border-hair px-2.5 py-1 text-[11px] text-ink/65">{p.clientName} · <b className="font-semibold text-ink">{money(p.amount)}</b></span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink/45">No pending recurring deals. Add them on the Projections tab.</p>
        )}
      </Panel>
    </div>
  );
}

function SourceChip({ ok, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] ${ok ? "border-hair text-ink/60" : "border-dashed border-ink/25 text-ink/40"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-[#ff3c00]" : "bg-ink/25"}`} />{label}
    </span>
  );
}

function Legend({ items }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {items.map(([n, c]) => (
        <span key={n} className="inline-flex items-center gap-1.5 text-[10.5px] text-ink/50"><span className="h-2 w-2 rounded-sm" style={{ background: c }} />{n}</span>
      ))}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div>
      <p className="mono-label text-ink/45">{label}</p>
      <p className={`mt-1 text-xl font-semibold tracking-tight ${accent ? "flame-text" : "text-ink"}`}>{value}</p>
    </div>
  );
}
