import { useMemo } from "react";
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, CalendarPlus, Layers, Repeat, Sparkles, UserMinus, UserPlus, Users, X } from "lucide-react";
import { accountRows, clientRows, compactMoney, money, serviceMonthly } from "@/components/financial/finance/metrics";
import { CountUp, EmptyState, FinanceStyles, Panel, SourceNote } from "@/components/financial/finance/ui";

// Analytics hero for the Clients page. MRR math is the Financial dashboard's own
// (metrics.js: clientRows / accountRows / serviceMonthly) so both pages agree.

const AXIS = { fill: "rgba(26,26,26,0.55)", fontSize: 10.5 };
const RAMP = ["#ff3c00", "#ff6a00", "#ffaa00", "#1a1a1a", "rgba(26,26,26,0.55)", "rgba(26,26,26,0.32)", "rgba(26,26,26,0.18)"];
const int = (v) => Math.round(v).toLocaleString("en-US");

// A service line that still counts (not discontinued / cancelled).
const isLive = (sv) => {
  if (!sv || sv.discontinued) return false;
  const st = String(sv.status || "").toLowerCase();
  return st !== "canceled" && st !== "cancelled" && st !== "incomplete_expired";
};

export function serviceLabel(sv) {
  const raw = sv?.short || String(sv?.name || "").replace(/interstellar\s*[®™]?/i, "").replace(/\([^)]*included[^)]*\)/i, "");
  return raw.replace(/\s+/g, " ").trim() || "Unnamed service";
}
export const serviceKey = (sv) => serviceLabel(sv).toLowerCase();

const parseDate = (s) => {
  if (!s) return null;
  const str = String(s);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(`${str}T00:00:00`) : new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function computeClientAnalytics(clients, now = new Date()) {
  const all = clients || [];
  const active = all.filter((c) => c.status === "Active");
  const leads = all.filter((c) => c.status === "Lead");
  const inactive = all.filter((c) => c.status === "Inactive");

  const rows = clientRows(all); // active clients with MRR (same as finance)
  const paying = rows.filter((r) => r.mrr > 0);
  const accounts = accountRows(paying); // bundles count once
  const mrr = rows.reduce((s, r) => s + r.mrr, 0);
  const avgPerAccount = accounts.length ? mrr / accounts.length : null;

  // Per-service roll-up across active clients
  const map = new Map();
  let subscriptions = 0;
  active.forEach((c) => {
    (c.services || []).forEach((sv) => {
      if (!isLive(sv)) return;
      const key = serviceKey(sv);
      const cur = map.get(key) || { key, label: serviceLabel(sv), mrr: 0, subs: 0, billed: new Set(), included: new Set() };
      const m = serviceMonthly(sv);
      if (m > 0) {
        cur.mrr += m;
        cur.subs += 1;
        cur.billed.add(c.id);
        subscriptions += 1;
      } else {
        cur.included.add(c.id);
      }
      map.set(key, cur);
    });
  });
  const services = [...map.values()].map((s) => {
    const included = [...s.included].filter((id) => !s.billed.has(id)).length;
    return { key: s.key, label: s.label, mrr: s.mrr, subs: s.subs, clients: s.billed.size, included, reach: s.billed.size + included };
  });
  const byRevenue = services.filter((s) => s.mrr > 0).sort((a, b) => b.mrr - a.mrr);
  const byReach = [...services].sort((a, b) => b.reach - a.reach || b.mrr - a.mrr);

  // New clients (active) by start date, falling back to the date the record was added
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const startOf = (c) => parseDate(c.started_on) || parseDate(c.created_date);
  const newThisMonth = active.filter((c) => { const d = startOf(c); return d && d >= monthStart; });
  const newThisQuarter = active.filter((c) => { const d = startOf(c); return d && d >= quarterStart; });
  const datedByStart = active.filter((c) => parseDate(c.started_on)).length;

  const top = accounts.slice(0, 5);
  const top3 = accounts.slice(0, 3).reduce((s, a) => s + a.mrr, 0);
  const top3Share = mrr > 0 ? top3 / mrr : null;

  return {
    active, leads, inactive, rows, paying, accounts, mrr, arr: mrr * 12, avgPerAccount, subscriptions,
    services, byRevenue, byReach, newThisMonth, newThisQuarter, datedByStart, top, top3Share,
    quarterLabel: `Q${Math.floor(now.getMonth() / 3) + 1}`,
  };
}

function MiniTile({ icon: Icon, label, value, format = int, sub, index = 0, empty, emptyText }) {
  return (
    <div className="card-hover fin-rise group relative flex min-h-[104px] flex-col overflow-hidden rounded-md border border-hair bg-card p-3 sm:min-h-[124px] sm:p-4" style={{ animationDelay: `${index * 45}ms` }}>
      <div className="flex items-center justify-between gap-2">
        <span className="mono-label truncate !text-[9.5px] text-ink/50 sm:!text-[10.5px]">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-ink/30 transition-colors group-hover:text-[#ff3c00]" />}
      </div>
      {empty ? (
        <div className="mt-2 flex-1">
          <p className="text-xl font-semibold tracking-tight text-ink/25 sm:text-2xl">—</p>
          <p className="mt-1 text-[10.5px] leading-snug text-ink/45">{emptyText}</p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-[22px] font-semibold leading-none tracking-[-0.03em] text-ink sm:text-[26px]">
            <CountUp value={value} format={format} />
          </p>
          {sub && <p className="mt-auto pt-2 text-[10px] leading-snug text-ink/45 sm:text-[10.5px]">{sub}</p>}
        </>
      )}
    </div>
  );
}

function ServiceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <div className="rounded-md border border-hair bg-card px-3 py-2 shadow-[0_12px_30px_-18px_rgba(26,26,26,.5)]">
      <p className="mono-label mb-1 !text-[9px] text-ink/50">{s.label}</p>
      <p className="text-xs tabular-nums text-ink/80"><b className="font-semibold">{money(s.mrr)}</b>/mo</p>
      <p className="text-[11px] text-ink/55">{s.clients} billed {s.clients === 1 ? "client" : "clients"} · {s.subs} {s.subs === 1 ? "subscription" : "subscriptions"}{s.included ? ` · +${s.included} included in a package` : ""}</p>
      <p className="mt-1 text-[10px] text-[#d83300]">Click to filter the list</p>
    </div>
  );
}

export default function ClientAnalytics({ clients, serviceFilter, onServiceFilter }) {
  const a = useMemo(() => computeClientAnalytics(clients), [clients]);
  const toggle = (key) => onServiceFilter?.(serviceFilter === key ? null : key);
  const filterLabel = serviceFilter ? a.services.find((s) => s.key === serviceFilter)?.label || serviceFilter : null;
  const maxTop = Math.max(1, ...a.top.map((t) => t.mrr));
  const barHeight = Math.max(150, a.byRevenue.length * 40 + 16);
  const reachTotal = a.byReach.reduce((s, x) => s + x.reach, 0);
  const bundled = a.active.length !== a.accounts.length;

  return (
    <div className="space-y-4">
      <FinanceStyles />

      {/* Hero band + KPI tiles */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <section className="fin-rise band-dark grain relative flex flex-col overflow-hidden rounded-md border border-ink p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="mono-label text-white/55">Monthly recurring revenue</span>
            <Repeat className="h-3.5 w-3.5 text-[#ff6a00]" />
          </div>
          <p className="mt-3 text-[40px] font-semibold leading-none tracking-[-0.04em] flame-text sm:text-[46px]">
            <CountUp value={a.mrr} />
          </p>
          <p className="mt-2 text-[11px] text-white/55">
            {compactMoney(a.arr)} ARR run-rate · {a.accounts.length} paying {a.accounts.length === 1 ? "account" : "accounts"}
          </p>
          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="mono-label !text-[9.5px] text-white/50">Top-3 concentration</span>
              <span className="text-sm font-semibold tabular-nums text-white">{a.top3Share == null ? "—" : `${Math.round(a.top3Share * 100)}%`}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="cl-bar flame-bg h-full rounded-full" style={{ width: `${Math.round((a.top3Share || 0) * 100)}%` }} />
            </div>
            <p className="mt-2 text-[10.5px] leading-snug text-white/45">
              {a.top3Share == null
                ? "No paying accounts yet."
                : `${a.top.slice(0, 3).map((t) => t.name).join(", ")} bring in ${Math.round(a.top3Share * 100)}% of MRR${a.top3Share >= 0.5 ? " — heavy reliance on a few accounts." : "."}`}
            </p>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-2">
          <MiniTile index={0} icon={Users} label="Active clients" value={a.active.length}
            sub={bundled ? `${a.active.length} businesses · ${a.accounts.length} paying accounts (packages count once)` : `${a.accounts.length} paying accounts`} />
          <MiniTile index={1} icon={Layers} label="Paying accounts" value={a.accounts.length} sub="Billed accounts · bundles = 1" />
          <MiniTile index={2} icon={BarChart3} label="Avg / account" value={a.avgPerAccount} format={(v) => money(v)} empty={a.avgPerAccount == null} emptyText="No paying accounts yet." sub="MRR ÷ paying accounts" />
          <MiniTile index={3} icon={Repeat} label="Subscriptions" value={a.subscriptions} sub="Billable service lines on active clients" />
          <MiniTile index={4} icon={Sparkles} label="Leads" value={a.leads.length} sub={a.leads.length ? a.leads.slice(0, 3).map((c) => c.business).join(", ") : "No open leads"} />
          <MiniTile index={5} icon={UserMinus} label="Inactive" value={a.inactive.length} sub="Past or paused clients" />
          <MiniTile index={6} icon={UserPlus} label="New this month" value={a.newThisMonth.length} sub={a.newThisMonth.length ? a.newThisMonth.map((c) => c.business).join(", ") : "None yet this month"} />
          <MiniTile index={7} icon={CalendarPlus} label={`New in ${a.quarterLabel}`} value={a.newThisQuarter.length} sub={a.newThisQuarter.length ? a.newThisQuarter.map((c) => c.business).join(", ") : "None yet this quarter"} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="(Revenue by service)" subtitle="Monthly revenue per service across active clients · tap a bar to filter the list"
          right={filterLabel && (
            <button type="button" onClick={() => onServiceFilter?.(null)} className="inline-flex items-center gap-1 rounded-full border border-[#ff3c00]/40 bg-[#ff3c00]/[0.06] px-2.5 py-1 text-[10.5px] text-[#d83300]">
              {filterLabel} <X className="h-3 w-3" />
            </button>
          )}>
          {a.byRevenue.length ? (
            <div style={{ height: barHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={a.byRevenue} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }} barCategoryGap={8}>
                  <defs>
                    <linearGradient id="clSvcFill" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ff3c00" /><stop offset="55%" stopColor="#ff6a00" /><stop offset="100%" stopColor="#ffaa00" />
                    </linearGradient>
                  </defs>
                  <XAxis type="number" hide domain={[0, "dataMax"]} />
                  <YAxis type="category" dataKey="label" tick={AXIS} axisLine={false} tickLine={false} width={96} />
                  <Tooltip content={<ServiceTooltip />} cursor={{ fill: "rgba(255,60,0,.05)" }} />
                  <Bar dataKey="mrr" fill="url(#clSvcFill)" radius={[0, 4, 4, 0]} maxBarSize={26} animationDuration={1100} className="cursor-pointer"
                    onClick={(d) => d?.key && toggle(d.key)}>
                    {a.byRevenue.map((s) => (
                      <Cell key={s.key} fillOpacity={serviceFilter && serviceFilter !== s.key ? 0.25 : 1} />
                    ))}
                    <LabelList dataKey="mrr" position="right" formatter={(v) => money(v)} style={{ fill: "#1a1a1a", fontSize: 11, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={BarChart3} title="No billed services yet" body="Add priced services to active clients to see which ones earn the most." compact />
          )}
          {a.byRevenue.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {a.byRevenue.map((s) => (
                <button key={s.key} type="button" onClick={() => toggle(s.key)}
                  className={`rounded-full border px-2.5 py-1 text-[10.5px] transition-colors ${serviceFilter === s.key ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-hair text-ink/60 hover:border-[#ff3c00]/50"}`}>
                  {s.label} · {s.clients} {s.clients === 1 ? "client" : "clients"}{s.included ? ` +${s.included} incl.` : ""}
                </button>
              ))}
            </div>
          )}
          <SourceNote>Same MRR math as Financial · yearly ÷ 12 · discontinued and cancelled lines skipped</SourceNote>
        </Panel>

        <Panel title="(Subscriptions)" subtitle="Active clients on each service (incl. package-included)">
          {a.byReach.length ? (
            <>
              <div className="relative mx-auto h-[170px] max-w-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={a.byReach} dataKey="reach" nameKey="label" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none" animationDuration={1100}
                      onClick={(d) => d?.key && toggle(d.key)} className="cursor-pointer">
                      {a.byReach.map((s, i) => (
                        <Cell key={s.key} fill={RAMP[i % RAMP.length]} fillOpacity={serviceFilter && serviceFilter !== s.key ? 0.25 : 1} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} ${v === 1 ? "client" : "clients"}`, n]} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-semibold tabular-nums text-ink"><CountUp value={reachTotal} format={int} /></span>
                  <span className="mono-label !text-[8.5px] text-ink/45">client-services</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {a.byReach.map((s, i) => (
                  <button key={s.key} type="button" onClick={() => toggle(s.key)} className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11.5px] transition-colors hover:bg-ink/[0.04] ${serviceFilter === s.key ? "bg-[#ff3c00]/[0.07]" : ""}`}>
                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: RAMP[i % RAMP.length] }} />
                    <span className="truncate text-ink/75">{s.label}</span>
                    <span className="ml-auto shrink-0 tabular-nums text-ink/55">{s.reach}{s.included ? <span className="text-ink/35"> ({s.included} incl.)</span> : null}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon={Layers} title="No services yet" body="Services added to active clients show up here." compact />
          )}
        </Panel>
      </div>

      {/* Top clients */}
      <Panel title="(Top clients by MRR)" subtitle="Packages billed together are combined, matching Financial">
        {a.top.length ? (
          <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 md:grid-cols-2">
            {a.top.map((t, i) => (
              <div key={t.key}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-[11.5px]">
                  <span className="truncate text-ink/75" title={t.label}><span className="mr-1.5 font-mono text-[10px] text-ink/35">{String(i + 1).padStart(2, "0")}</span>{t.label}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-ink">{money(t.mrr)}<span className="ml-1 text-[10px] font-normal text-ink/40">{a.mrr ? `${((t.mrr / a.mrr) * 100).toFixed(0)}%` : ""}</span></span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
                  <div className="cl-bar flame-bg h-full rounded-full" style={{ width: `${(t.mrr / maxTop) * 100}%`, animationDelay: `${i * 60}ms` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={Users} title="No paying clients" body="Add priced services to active clients." compact />
        )}
        {a.datedByStart < a.active.length && (
          <SourceNote>New-client counts use the start date, or the date the client was added when no start date is set ({a.active.length - a.datedByStart} of {a.active.length} active)</SourceNote>
        )}
      </Panel>
      <style>{`@keyframes cl-bar { from { transform: scaleX(0); } to { transform: scaleX(1); } } .cl-bar { transform-origin: left; animation: cl-bar .9s cubic-bezier(.22,1,.36,1) both; } @media (prefers-reduced-motion: reduce) { .cl-bar { animation: none; } }`}</style>
    </div>
  );
}
