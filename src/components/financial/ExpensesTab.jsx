import { useMemo, useState } from "react";
import { useDeepLinkParam, useDeepLinkFocus } from "@/lib/deepLink";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CalendarClock, Check, Crown, Edit, Flame, Layers, Loader2, Percent, PieChart as PieIcon, Plus, Receipt, Search, Sparkles, Trash2, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { compactMoney, money, monthLabel } from "./finance/metrics";
import { EmptyState, EstimateTag, FinanceStyles, KpiTile, MoneyTooltip, Panel, SourceNote, CountUp } from "./finance/ui";
import {
  FREQUENCIES, DAY_MS, billedBreakdown, categoryTotals, daysUntil, enrichExpense, formatDueDate,
  occurrencesBetween, paidHistory, projectSpend, savingsWatch, startOfDay,
} from "./finance/expenses";

const AXIS = { fill: "rgba(26,26,26,0.42)", fontSize: 10 };
const GRID = "rgba(26,26,26,0.07)";
const CAT_COLORS = [
  ["#ff3c00", 1], ["#ff6a00", 1], ["#ffaa00", 1], ["#1a1a1a", 0.85],
  ["#ff3c00", 0.5], ["#ff6a00", 0.5], ["#ffaa00", 0.5], ["#1a1a1a", 0.4],
];
const catColor = (i) => CAT_COLORS[i % CAT_COLORS.length];
const money2 = (v) => money(v, 2);

export default function ExpensesTab({ expenses, categories, now, finance, onAdd, onUpdate, onDelete, onMarkPaid }) {
  // ?expense=<id> (from Command): focus that bill.
  const linkedExpense = useDeepLinkParam("expense");
  useDeepLinkFocus(linkedExpense, [expenses.length]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [paying, setPaying] = useState(() => new Set());

  const enriched = useMemo(() => expenses.map((e) => enrichExpense(e, now)), [expenses, now]);
  const today = useMemo(() => startOfDay(now), [now]);
  const horizon = useMemo(() => new Date(today.getTime() + 30 * DAY_MS), [today]);

  const burn = useMemo(() => enriched.reduce((s, e) => s + e.monthly, 0), [enriched]);
  const breakdown = useMemo(() => billedBreakdown(enriched), [enriched]);
  const cats = useMemo(() => categoryTotals(enriched), [enriched]);
  const history = useMemo(() => paidHistory(enriched, 12, now), [enriched, now]);
  const next30 = useMemo(() => occurrencesBetween(enriched, today, horizon, now), [enriched, today, horizon, now]);
  const due30 = next30.filter((o) => !o.paid);
  const due30Total = due30.reduce((s, o) => s + o.amount, 0);
  const overdue = enriched.filter((e) => e.status === "Overdue");
  const overdueTotal = overdue.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const upcoming = enriched.filter((e) => e.status !== "Paid").sort((a, b) => a.dueDate - b.dueDate);
  const watch = useMemo(() => savingsWatch(enriched), [enriched]);

  const f = finance?.finance;
  const mrrLoading = finance?.loading;
  const mrr = f?.mrr;
  const showMrrTile = mrrLoading || (mrr != null && mrr > 0);
  const biggest = cats[0];
  const hasHistory = history.some((h) => h.paid > 0);

  const markPaid = async (e) => {
    if (paying.has(e.id)) return;
    setPaying((p) => new Set(p).add(e.id));
    try { await onMarkPaid(e); } finally { setPaying((p) => { const n = new Set(p); n.delete(e.id); return n; }); }
  };

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (e) => { setEditing(e); setFormOpen(true); };

  return (
    <div className="space-y-5">
      <FinanceStyles />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="label-cross">(Expenses)</h2>
          <p className="mt-1 text-[11px] text-ink/45">{enriched.length} recurring bills · every figure normalized to a monthly equivalent</p>
        </div>
        <Button onClick={openAdd} className="h-9 gap-2 border-0 font-semibold text-white flame-bg hover:opacity-90"><Plus className="h-4 w-4" />Add Expense</Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiTile index={0} hero icon={Flame} label="Monthly burn" value={burn} format={money}
          spark={hasHistory ? history.map((h) => h.paid || null) : null}
          sub={`${enriched.length} bills · monthly + quarterly ÷ 3 + annual ÷ 12`} />
        <AnnualTile index={1} value={burn * 12} breakdown={breakdown} />
        <KpiTile index={2} icon={CalendarClock} label="Due next 30 days" value={due30Total} format={money}
          sub={due30.length ? `${due30.length} bill${due30.length === 1 ? "" : "s"} through ${formatDueDate(horizon)}` : "Nothing unpaid in the next 30 days"} />
        <KpiTile index={3} icon={AlertTriangle} label="Overdue / unpaid" value={overdueTotal} format={money}
          sub={overdue.length ? `${overdue.length} bill${overdue.length === 1 ? "" : "s"} past due this cycle` : "All caught up"} />
        {showMrrTile && (
          <KpiTile index={4} icon={Percent} label="Expenses as % of MRR" value={mrr > 0 ? (burn / mrr) * 100 : null}
            format={(v) => `${v.toFixed(1)}%`} empty={mrrLoading || !(mrr > 0)} emptyText="Loading MRR from CRM clients…"
            sub={mrr > 0 ? `${money(burn)} burn of ${money(mrr)} MRR (Dashboard MRR)` : undefined} />
        )}
        <KpiTile index={5} icon={Crown} label="Biggest category" value={biggest?.monthly} format={(v) => `${money(v)}/mo`}
          empty={!biggest} emptyText="Add an expense to see category spend."
          sub={biggest ? `${biggest.name} · ${burn > 0 ? ((biggest.monthly / burn) * 100).toFixed(0) : 0}% of burn · ${biggest.count} bill${biggest.count === 1 ? "" : "s"}` : undefined} />
      </div>

      {/* 30-day timeline */}
      <Timeline30 occurrences={next30} today={today} total={due30Total} count={due30.length} />

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SpendTrend className="lg:col-span-2" history={history} hasHistory={hasHistory} expenses={enriched} now={now} />
        <CategoryDonut cats={cats} burn={burn} />
      </div>

      {/* Upcoming + Savings watch */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <UpcomingPanel className="lg:col-span-2" items={upcoming} now={now} paying={paying} onMarkPaid={markPaid} />
        <SavingsWatch watch={watch} burn={burn} />
      </div>

      {/* All expenses */}
      <AllExpenses items={enriched} categories={categories} now={now} paying={paying}
        onMarkPaid={markPaid} onEdit={openEdit} onDelete={setToDelete} onAdd={openAdd} />

      <ExpenseFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} categories={categories}
        onSubmit={async (fields) => { if (editing) await onUpdate(editing.id, fields); else await onAdd(fields); }} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <AlertDialogContent className="border-hair bg-card text-ink">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.platform}?</AlertDialogTitle>
            <AlertDialogDescription className="text-ink/55">This removes the expense and its paid history. It can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-hair">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-[#1a1a1a] text-white hover:bg-[#ff3c00]" onClick={() => { const e = toDelete; setToDelete(null); if (e) onDelete(e.id); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------- KPI: annualized with billed breakdown ----------
function AnnualTile({ value, breakdown, index }) {
  const total = breakdown.Monthly + breakdown.Quarterly + breakdown.Annually;
  const parts = [["Monthly-billed", breakdown.Monthly, "#ff3c00"], ["Quarterly-billed", breakdown.Quarterly, "#ff6a00"], ["Annual-billed", breakdown.Annually, "#ffaa00"]];
  return (
    <div className="card-hover fin-rise group relative flex min-h-[148px] flex-col overflow-hidden rounded-md border border-hair bg-card p-4" style={{ animationDelay: `${index * 45}ms` }}>
      <div className="flex items-center justify-between gap-2">
        <span className="mono-label text-ink/50">Annualized spend</span>
        <TrendingUp className="h-3.5 w-3.5 text-ink/30 transition-colors group-hover:text-[#ff3c00]" />
      </div>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em] text-ink"><CountUp value={value} format={money} /></p>
      <span className="mt-2 text-[10.5px] text-ink/45">Monthly burn × 12</span>
      <div className="mt-auto pt-3">
        <div className="flex h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
          {total > 0 && parts.map(([n, v, c]) => <div key={n} style={{ width: `${(v / total) * 100}%`, background: c }} />)}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {parts.map(([n, v, c]) => (
            <span key={n} className="inline-flex items-center gap-1 text-[10px] tabular-nums text-ink/50"><span className="h-1.5 w-1.5 rounded-sm" style={{ background: c }} />{n} <b className="font-semibold text-ink/75">{money(v)}</b></span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- 30-day timeline strip ----------
function Timeline30({ occurrences, today, total, count }) {
  const days = Array.from({ length: 31 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
  const byDay = new Map();
  occurrences.forEach((o) => { const k = o.date.toDateString(); byDay.set(k, [...(byDay.get(k) || []), o]); });
  const max = Math.max(1, ...occurrences.map((o) => o.amount));
  return (
    <Panel dark title="(Next 30 days)" subtitle="Every bill coming due, day by day · hover a bill for details"
      right={<div className="text-right"><p className="text-xl font-semibold tracking-tight flame-text tabular-nums">{money(total)}</p><p className="mono-label !text-[9px] text-white/45">{count} unpaid bill{count === 1 ? "" : "s"}</p></div>}>
      {occurrences.length ? (
        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="grid min-w-[760px] px-1" style={{ gridTemplateColumns: "repeat(31, minmax(0, 1fr))" }}>
            {days.map((d, i) => {
              const items = byDay.get(d.toDateString()) || [];
              const isToday = i === 0;
              const monthStart = d.getDate() === 1;
              const sum = items.filter((o) => !o.paid).reduce((s, o) => s + o.amount, 0);
              return (
                <div key={d.toISOString()} className={`relative flex flex-col items-center gap-1 border-l px-0.5 pb-1 pt-1 ${monthStart ? "border-[#ff6a00]/50" : "border-white/[0.06]"} ${isToday ? "rounded-sm bg-white/[0.06]" : ""}`}>
                  <span className={`font-mono text-[8.5px] uppercase ${monthStart ? "text-[#ffaa00]" : "text-white/30"}`}>{monthStart ? d.toLocaleDateString("en-US", { month: "short" }) : d.toLocaleDateString("en-US", { weekday: "narrow" })}</span>
                  <span className={`text-[11px] tabular-nums ${isToday ? "font-semibold text-[#ff6a00]" : "text-white/60"}`}>{d.getDate()}</span>
                  <div className="flex min-h-[56px] flex-col items-center justify-end gap-1">
                    {items.map((o) => {
                      const size = 14 + Math.round((o.amount / max) * 12);
                      return (
                        <span key={o.expense.id + o.cycle} title={`${o.expense.platform} · ${money2(o.amount)}${o.paid ? " · paid" : ""}`}
                          className={`flex items-center justify-center rounded-full text-[8.5px] font-bold ${o.paid ? "border border-white/25 text-white/40" : "flame-bg text-white shadow-[0_0_12px_rgba(255,60,0,.45)]"}`}
                          style={{ width: size, height: size }}>
                          {o.expense.platform?.charAt(0)?.toUpperCase()}
                        </span>
                      );
                    })}
                  </div>
                  <span className="h-3 text-[8.5px] tabular-nums text-white/45">{sum > 0 ? compactMoney(sum) : ""}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="py-6 text-center text-xs text-white/45">No bills fall due in the next 30 days.</p>
      )}
    </Panel>
  );
}

// ---------- Monthly spend over time ----------
function SpendTrend({ history, hasHistory, expenses, now, className }) {
  const data = useMemo(() => {
    if (!hasHistory) return projectSpend(expenses, 12, now).map((p) => ({ label: monthLabel(p.key, true), Projected: p.projected }));
    const proj = projectSpend(expenses, 6, now);
    const rows = history.map((h) => ({ key: h.key, label: monthLabel(h.key, true), Paid: h.paid, Projected: null }));
    proj.forEach((p, i) => {
      if (i === 0) rows[rows.length - 1].Projected = p.projected;
      else rows.push({ key: p.key, label: monthLabel(p.key, true), Paid: null, Projected: p.projected });
    });
    return rows;
  }, [history, hasHistory, expenses, now]);
  const any = data.some((d) => d.Paid || d.Projected);
  return (
    <Panel className={className} title="(Monthly spend)"
      subtitle={hasHistory ? "Paid = bills marked paid (last 12 months) · Projected = what recurrence bills over the next 6 months" : "No paid history yet — projecting the next 12 months from each bill’s recurrence"}
      right={<EstimateTag>{hasHistory ? "Paid + projected" : "Projection"}</EstimateTag>}>
      {any ? (
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
              <defs>
                <linearGradient id="expPaid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff3c00" /><stop offset="55%" stopColor="#ff6a00" /><stop offset="100%" stopColor="#ffaa00" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} width={52} tickFormatter={compactMoney} />
              <Tooltip content={<MoneyTooltip />} cursor={{ fill: "rgba(255,60,0,.05)" }} />
              {hasHistory && <Bar dataKey="Paid" fill="url(#expPaid)" radius={[3, 3, 0, 0]} maxBarSize={26} animationDuration={1100} />}
              <Bar dataKey="Projected" fill={hasHistory ? "#1a1a1a" : "url(#expPaid)"} fillOpacity={hasHistory ? 0.22 : 1} stroke={hasHistory ? "#1a1a1a" : undefined} strokeOpacity={0.35} strokeDasharray={hasHistory ? "3 2" : undefined} radius={[3, 3, 0, 0]} maxBarSize={26} animationDuration={1300} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState icon={Receipt} title="Nothing to chart yet" body="Add expenses to see what you spend each month." compact />
      )}
      <ChartLegend items={hasHistory ? [["Paid", "#ff3c00"], ["Projected", "rgba(26,26,26,.3)"]] : [["Projected", "#ff6a00"]]} />
      <SourceNote>Spikes are annual and quarterly bills landing in their month.</SourceNote>
    </Panel>
  );
}

// ---------- Spend by category ----------
function CategoryDonut({ cats, burn }) {
  const data = cats.map((c) => ({ name: c.name, value: c.monthly }));
  return (
    <Panel title="(Spend by category)" subtitle="Monthly equivalent per category">
      {cats.length ? (
        <>
          <div className="relative mx-auto h-[180px] max-w-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<PieTip />} />
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={56} outerRadius={84} paddingAngle={1.5} stroke="none" animationDuration={1100}>
                  {data.map((d, i) => <Cell key={d.name} fill={catColor(i)[0]} fillOpacity={catColor(i)[1]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="mono-label !text-[9px] text-ink/45">Per month</span>
              <span className="text-lg font-semibold tracking-tight text-ink tabular-nums">{money(burn)}</span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {cats.map((c, i) => (
              <div key={c.name} className="flex items-center gap-2 text-[11.5px]">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: catColor(i)[0], opacity: catColor(i)[1] }} />
                <span className="min-w-0 flex-1 truncate text-ink/70">{c.name} <span className="text-ink/35">· {c.count}</span></span>
                <span className="shrink-0 font-semibold tabular-nums text-ink">{money(c.monthly)}</span>
                <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-ink/40">{burn > 0 ? ((c.monthly / burn) * 100).toFixed(0) : 0}%</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState icon={PieIcon} title="No categories yet" body="Expenses will group here by category." compact />
      )}
    </Panel>
  );
}

function PieTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-md border border-hair bg-card px-3 py-2 text-xs shadow-[0_12px_30px_-18px_rgba(26,26,26,.5)]">
      <span className="text-ink/55">{p.name}</span> <b className="ml-2 tabular-nums text-ink">{money2(p.value)}/mo</b>
    </div>
  );
}

// ---------- Upcoming ----------
function dueBadge(days) {
  if (days < 0) return { text: `Overdue ${Math.abs(days)}d`, cls: "bg-[#1a1a1a] text-white" };
  if (days === 0) return { text: "Due today", cls: "flame-bg text-white" };
  if (days === 1) return { text: "Tomorrow", cls: "bg-[#ff3c00]/12 text-[#d83300]" };
  if (days <= 7) return { text: `In ${days}d`, cls: "bg-[#ff6a00]/12 text-[#c75200]" };
  return { text: `In ${days}d`, cls: "bg-ink/[0.05] text-ink/55" };
}

function VendorMark({ name, size = "h-9 w-9" }) {
  return <div className={`${size} flex shrink-0 items-center justify-center rounded-md flame-bg font-display text-xs font-extrabold text-white shadow-[0_6px_16px_-8px_rgba(255,60,0,.8)]`}>{name?.charAt(0)?.toUpperCase() || "?"}</div>;
}

function UpcomingPanel({ items, now, paying, onMarkPaid, className }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 8);
  return (
    <Panel className={className} title="(Upcoming)" subtitle="Unpaid bills this cycle, soonest first"
      right={items.length > 8 ? <button onClick={() => setAll(!all)} className="text-[11px] font-medium text-ink/55 hover:text-[#ff3c00]">{all ? "Show less" : `Show all ${items.length}`}</button> : null}>
      {items.length ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {shown.map((e, i) => {
            const d = daysUntil(e.dueDate, now);
            const b = dueBadge(d);
            return (
              <div key={e.id} data-record-id={e.id} className={`card-hover fin-rise flex items-center gap-3 rounded-md border p-3 ${d < 0 ? "border-ink/40" : "border-hair"} bg-card`} style={{ animationDelay: `${i * 35}ms` }}>
                <VendorMark name={e.platform} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink/85">{e.platform}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold tabular-nums ${b.cls}`}>{b.text}</span>
                    <span className="truncate text-[10.5px] text-ink/40">{formatDueDate(e.dueDate)} · {e.category}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-semibold tabular-nums text-ink">{money2(Number(e.amount) || 0)}</span>
                  <MarkPaidButton busy={paying.has(e.id)} onClick={() => onMarkPaid(e)} compact />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={Check} title="Nothing unpaid" body="Every bill in the current cycle is marked paid." compact />
      )}
    </Panel>
  );
}

function MarkPaidButton({ busy, onClick, compact }) {
  return (
    <button type="button" onClick={onClick} disabled={busy}
      className={`inline-flex items-center gap-1 rounded-md border border-hair font-semibold text-ink/60 transition-all hover:border-[#ff3c00]/50 hover:bg-[#ff3c00]/[0.06] hover:text-[#d83300] disabled:opacity-50 ${compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"}`}>
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}Mark paid
    </button>
  );
}

// ---------- Savings watch ----------
function SavingsWatch({ watch, burn }) {
  const { nameFlags, crowded, top } = watch;
  const nothing = !nameFlags.length && !crowded.length && !top.length;
  return (
    <Panel title="(Savings watch)" subtitle="Suggestions to review — not estimates" right={<Sparkles className="h-3.5 w-3.5 text-[#ff6a00]" />}>
      {nothing ? (
        <EmptyState icon={Sparkles} title="Nothing to review" body="Add expenses and this card will flag overlaps and your biggest costs." compact />
      ) : (
        <div className="space-y-4">
          {top.length > 0 && (
            <div>
              <p className="mono-label mb-2 !text-[9.5px] text-ink/45">Top costs</p>
              <div className="space-y-1.5">
                {top.map((e, i) => (
                  <div key={e.id} className="flex items-center gap-2 text-[11.5px]">
                    <span className="w-4 shrink-0 font-mono text-[10px] text-[#ff3c00]">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-ink/75">{e.platform}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-ink">{money(e.monthly)}/mo</span>
                    <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-ink/40">{burn > 0 ? ((e.monthly / burn) * 100).toFixed(0) : 0}%</span>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[10.5px] text-ink/45">Worth confirming each still earns its spot.</p>
            </div>
          )}
          {nameFlags.length > 0 && (
            <div>
              <p className="mono-label mb-2 !text-[9.5px] text-ink/45">Similar names</p>
              <div className="space-y-1.5">
                {nameFlags.map((fl) => (
                  <p key={fl.items.map((x) => x.id).join("-")} className="text-[11.5px] leading-snug text-ink/70">
                    <b className="font-semibold text-ink">{fl.items[0].platform}</b> and <b className="font-semibold text-ink">{fl.items[1].platform}</b> — {fl.reason.toLowerCase()}. Check whether you need both.
                  </p>
                ))}
              </div>
            </div>
          )}
          {crowded.length > 0 && (
            <div>
              <p className="mono-label mb-2 !text-[9.5px] text-ink/45">Crowded categories</p>
              <div className="space-y-1.5">
                {crowded.map((c) => (
                  <p key={c.name} className="text-[11.5px] leading-snug text-ink/70">
                    <b className="font-semibold text-ink">{c.count} in {c.name}</b> ({money(c.monthly)}/mo): {c.items.map((x) => x.platform).join(", ")}. Review for overlap.
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

// ---------- All expenses ----------
function Segmented({ options, value, onChange, label }) {
  return (
    <div className="inline-flex shrink-0 items-center rounded-md border border-hair bg-ink/[0.02] p-0.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)}
          className={`rounded px-2.5 py-1 text-[11px] font-medium transition-all ${value === o ? "bg-[#1a1a1a] text-white shadow-sm" : "text-ink/50 hover:text-ink"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

const FREQ_CHIP = { Monthly: "bg-[#ff3c00]/10 text-[#d83300]", Quarterly: "bg-[#ffaa00]/15 text-[#a35d00]", Annually: "bg-ink/[0.07] text-ink/65" };

function StatusCell({ e, paying, onMarkPaid }) {
  if (e.status === "Paid") return <span className="inline-flex items-center gap-1 rounded-md border border-hair px-2.5 py-1 text-[11px] font-semibold text-ink/45"><Check className="h-3 w-3 text-[#ff3c00]" />Paid</span>;
  return <MarkPaidButton busy={paying.has(e.id)} onClick={() => onMarkPaid(e)} />;
}

function AllExpenses({ items, categories, now, paying, onMarkPaid, onEdit, onDelete, onAdd }) {
  const [q, setQ] = useState("");
  const [freq, setFreq] = useState("All");
  const [status, setStatus] = useState("All");
  const [cat, setCat] = useState("All");

  const catList = useMemo(() => {
    const present = new Set(items.map((e) => e.category).filter(Boolean));
    return [...categories.filter((c) => present.has(c)), ...[...present].filter((c) => !categories.includes(c))];
  }, [items, categories]);

  const rows = items
    .filter((e) => freq === "All" || e.frequency === freq)
    .filter((e) => status === "All" || e.status === status)
    .filter((e) => cat === "All" || e.category === cat)
    .filter((e) => !q.trim() || `${e.platform} ${e.category}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.dueDate - b.dueDate);
  const filteredTotal = rows.reduce((s, e) => s + e.monthly, 0);
  const filtersOn = q || freq !== "All" || status !== "All" || cat !== "All";

  return (
    <Panel title="(All expenses)" subtitle={`${rows.length} of ${items.length} shown · ${money(filteredTotal)}/mo equivalent`}
      right={filtersOn ? <button onClick={() => { setQ(""); setFreq("All"); setStatus("All"); setCat("All"); }} className="inline-flex items-center gap-1 text-[11px] text-ink/50 hover:text-[#ff3c00]"><X className="h-3 w-3" />Clear filters</button> : null}>
      <div className="space-y-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendor or category…" className="h-8 border-hair bg-ink/[0.02] pl-8 text-sm text-ink" />
          </div>
          <div className="flex max-w-full gap-2 overflow-x-auto pb-0.5">
            <Segmented label="Frequency" options={["All", ...FREQUENCIES]} value={freq} onChange={setFreq} />
            <Segmented label="Status" options={["All", "Upcoming", "Paid", "Overdue"]} value={status} onChange={setStatus} />
          </div>
        </div>
        {catList.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {["All", ...catList].map((c) => (
              <button key={c} type="button" onClick={() => setCat(c)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-all ${cat === c ? "border-transparent flame-bg font-semibold text-white" : "border-hair text-ink/55 hover:border-[#ff3c00]/40 hover:text-ink"}`}>
                {c}
              </button>
            ))}
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState icon={Receipt} title="No expenses yet" body="Track every subscription and bill to see your real burn." action={<Button onClick={onAdd} className="h-8 gap-1.5 border-0 text-white flame-bg"><Plus className="h-3.5 w-3.5" />Add Expense</Button>} compact />
        ) : rows.length === 0 ? (
          <EmptyState icon={Layers} title="No matches" body="Try a different search or filter." compact />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-md border border-hair md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hair bg-ink/[0.02] text-left">
                    {["Vendor", "Category", "Billing", "Due", "Per month", "Amount", "", ""].map((h, i) => (
                      <th key={i} className={`mono-label px-3 py-2 !text-[9.5px] font-normal text-ink/45 ${i >= 4 && i <= 5 ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => {
                    const d = daysUntil(e.dueDate, now);
                    const b = dueBadge(d);
                    return (
                      <tr key={e.id} data-record-id={e.id} className={`group border-b border-hair last:border-0 transition-colors hover:bg-[#ff3c00]/[0.025] ${e.status === "Paid" ? "opacity-60" : ""}`}>
                        <td className="px-3 py-2.5"><div className="flex items-center gap-2.5"><VendorMark name={e.platform} size="h-7 w-7" /><span className="font-medium text-ink/85">{e.platform}</span></div></td>
                        <td className="px-3 py-2.5"><span className="rounded-full border border-hair px-2 py-0.5 text-[10.5px] text-ink/60">{e.category || "—"}</span></td>
                        <td className="px-3 py-2.5"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${FREQ_CHIP[e.frequency] || FREQ_CHIP.Monthly}`}>{e.frequency}</span></td>
                        <td className="px-3 py-2.5"><div className="flex items-center gap-2"><span className="tabular-nums text-ink/70">{formatDueDate(e.dueDate)}</span>{e.status !== "Paid" && <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold ${b.cls}`}>{b.text}</span>}</div></td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-ink/55">{money2(e.monthly)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ink">{money2(Number(e.amount) || 0)}</td>
                        <td className="px-3 py-2.5 text-right"><StatusCell e={e} paying={paying} onMarkPaid={onMarkPaid} /></td>
                        <td className="w-[72px] px-2 py-2.5">
                          <div className="flex justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                            <IconBtn label="Edit" onClick={() => onEdit(e)}><Edit className="h-3.5 w-3.5" /></IconBtn>
                            <IconBtn label="Delete" danger onClick={() => onDelete(e)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {rows.map((e) => {
                const b = dueBadge(daysUntil(e.dueDate, now));
                return (
                  <div key={e.id} data-record-id={e.id} className={`rounded-md border border-hair bg-card p-3 ${e.status === "Paid" ? "opacity-60" : ""}`}>
                    <div className="flex items-start gap-3">
                      <VendorMark name={e.platform} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink/85">{e.platform}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold ${FREQ_CHIP[e.frequency] || FREQ_CHIP.Monthly}`}>{e.frequency}</span>
                          <span className="rounded-full border border-hair px-1.5 py-0.5 text-[9.5px] text-ink/55">{e.category || "—"}</span>
                          {e.status !== "Paid" && <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold ${b.cls}`}>{b.text}</span>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums text-ink">{money2(Number(e.amount) || 0)}</p>
                        <p className="text-[10px] tabular-nums text-ink/40">{money2(e.monthly)}/mo</p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-hair pt-2.5">
                      <span className="text-[11px] text-ink/45">Due {formatDueDate(e.dueDate)}</span>
                      <div className="flex items-center gap-1">
                        <IconBtn label="Edit" onClick={() => onEdit(e)}><Edit className="h-3.5 w-3.5" /></IconBtn>
                        <IconBtn label="Delete" danger onClick={() => onDelete(e)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                        <StatusCell e={e} paying={paying} onMarkPaid={onMarkPaid} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

function IconBtn({ children, onClick, label, danger }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className={`rounded-md p-1.5 text-ink/40 transition-all hover:bg-ink/[0.05] ${danger ? "hover:text-[#ff3c00]" : "hover:text-ink"}`}>
      {children}
    </button>
  );
}

// ---------- Add / edit dialog ----------
const blankForm = (categories) => ({ platform: "", amount: "", frequency: "Monthly", category: categories.includes("Operations") ? "Operations" : categories[0] || "", dueDay: "", dueMonth: "" });

function ExpenseFormDialog({ open, onOpenChange, initial, categories, onSubmit }) {
  const [form, setForm] = useState(() => blankForm(categories));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastKey, setLastKey] = useState(null);

  // Reset the form each time the dialog opens (for add) or targets a new expense (for edit).
  const key = open ? (initial?.id || "new") : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (open) {
      setError("");
      setForm(initial ? { platform: initial.platform || "", amount: String(initial.amount ?? ""), frequency: initial.frequency || "Monthly", category: initial.category || "", dueDay: String(initial.dueDay ?? ""), dueMonth: initial.dueMonth ? String(initial.dueMonth) : "" } : blankForm(categories));
    }
  }

  const catOptions = form.category && !categories.includes(form.category) ? [...categories, form.category] : categories;

  const submit = async () => {
    if (!form.platform.trim() || form.amount === "" || Number.isNaN(parseFloat(form.amount))) { setError("Platform and amount are required."); return; }
    const fields = {
      platform: form.platform.trim(),
      amount: parseFloat(form.amount),
      frequency: form.frequency,
      category: form.category,
      dueDay: parseInt(form.dueDay) || 1,
      dueMonth: form.frequency === "Annually" ? (parseInt(form.dueMonth) || 1) : (initial ? initial.dueMonth ?? null : null),
    };
    setSaving(true);
    try { await onSubmit(fields); onOpenChange(false); } catch { setError("Couldn’t save. Try again."); } finally { setSaving(false); }
  };

  const fld = "mt-1 border-hair bg-ink/[0.02] text-ink";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-hair bg-card text-ink">
        <DialogHeader><DialogTitle className="text-ink">{initial ? `Edit ${initial.platform}` : "Add new expense"}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div><Label className="text-xs text-ink/50">Platform</Label><Input autoFocus value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className={fld} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-ink/50">Amount ($)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={fld} /></div>
            <div><Label className="text-xs text-ink/50">Frequency</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                <SelectTrigger className={fld}><SelectValue /></SelectTrigger>
                <SelectContent className="border-hair bg-card">{FREQUENCIES.map((fq) => <SelectItem key={fq} value={fq} className="text-ink/70">{fq}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-ink/50">Due day (1-31)</Label><Input type="number" min="1" max="31" value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} className={fld} /></div>
            {form.frequency === "Annually" && <div><Label className="text-xs text-ink/50">Due month (1-12)</Label><Input type="number" min="1" max="12" value={form.dueMonth} onChange={(e) => setForm({ ...form, dueMonth: e.target.value })} className={fld} /></div>}
          </div>
          <div><Label className="text-xs text-ink/50">Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className={fld}><SelectValue placeholder="Pick a category" /></SelectTrigger>
              <SelectContent className="border-hair bg-card">{catOptions.map((c) => <SelectItem key={c} value={c} className="text-ink/70">{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {error && <p className="text-xs text-[#d83300]">{error}</p>}
          <Button onClick={submit} disabled={saving} className="w-full border-0 font-semibold text-white flame-bg hover:opacity-90">
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{initial ? "Save changes" : "Add Expense"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Same legend style as the Dashboard.
function ChartLegend({ items }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {items.map(([n, c]) => (
        <span key={n} className="inline-flex items-center gap-1.5 text-[10.5px] text-ink/50"><span className="h-2 w-2 rounded-sm" style={{ background: c }} />{n}</span>
      ))}
    </div>
  );
}
