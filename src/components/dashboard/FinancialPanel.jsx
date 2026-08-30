import { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip } from "recharts";
import { Pencil, Check, X, Flame, Target, Rocket, TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import MarketingIdeas from "./MarketingIdeas";
import PlanToExecute from "./PlanToExecute";

const SETTINGS_KEY = "financial_panel";
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function buildMonthRange(clients) {
  const validDates = clients.map((c) => new Date(c.created_date)).filter((d) => !isNaN(d));
  const now = new Date();
  let start = validDates.length > 0 ? new Date(Math.min(...validDates)) : now;
  start = new Date(start.getFullYear(), start.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const months = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months.slice(-12);
}

function EditableField({ label, value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const save = () => { onSave(draft.trim()); setEditing(false); };
  return (
    <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04] group hover:border-orange-500/20 transition-colors">
      <p className="text-white/25 text-[10px] tracking-wider uppercase mb-1">{label}</p>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
            className="flex-1 bg-white/[0.04] border border-orange-500/20 rounded px-2 py-1 text-xs text-white outline-none focus:border-orange-500/40"
          />
          <button onClick={save} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => { setDraft(value); setEditing(false); }} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-white/70 text-xs font-medium">{value}</p>
          <button onClick={() => setEditing(true)} className="p-0.5 text-orange-400/40 hover:text-orange-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"><Pencil className="w-3 h-3" /></button>
        </div>
      )}
    </div>
  );
}

function ChartTooltip({ active, payload, label, prefix }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-orange-500/30 rounded-lg px-2.5 py-1.5 shadow-[0_0_12px_rgba(255,170,0,0.25)]">
      <p className="text-[9px] text-white/40 uppercase tracking-wider">{label}</p>
      <p className="text-orange-400 text-xs font-bold">{prefix}{payload[0].value.toLocaleString()}</p>
    </div>
  );
}

export default function FinancialPanel() {
  const [mrr, setMrr] = useState(0);
  const [clients, setClients] = useState([]);
  const [settingsId, setSettingsId] = useState(null);
  const [planToExecute, setPlanToExecute] = useState("14 more Ørbit SEO base level subs");
  const [marketingItems, setMarketingItems] = useState(["Referral Program"]);
  const mrrGoal = 10000;

  useEffect(() => {
    base44.entities.CRMClient.list("-created_date", 200).then((data) => {
      setClients(data);
      const revenue = data
        .filter((c) => c.status === "Active")
        .reduce((sum, c) => sum + (c.services || []).reduce((s, sv) => s + (sv.price || 0), 0), 0);
      setMrr(revenue);
    });
    base44.entities.AppSettings.filter({ key: SETTINGS_KEY }, "-created_date", 1).then((rows) => {
      if (rows.length > 0) {
        setSettingsId(rows[0].id);
        if (rows[0].pageSettings?.planToExecute) setPlanToExecute(rows[0].pageSettings.planToExecute);
        if (Array.isArray(rows[0].pageSettings?.marketingItems)) setMarketingItems(rows[0].pageSettings.marketingItems);
      }
    });
  }, []);

  const savePageSetting = async (field, value) => {
    if (field === "planToExecute") setPlanToExecute(value);
    if (field === "marketingItems") setMarketingItems(value);
    if (settingsId) {
      const current = await base44.entities.AppSettings.get(settingsId);
      await base44.entities.AppSettings.update(settingsId, {
        pageSettings: { ...(current.pageSettings || {}), [field]: value },
      });
    } else {
      const created = await base44.entities.AppSettings.create({
        key: SETTINGS_KEY,
        pageSettings: { [field]: value },
      });
      setSettingsId(created.id);
    }
  };

  const { revenueData, growthData } = useMemo(() => {
    const months = buildMonthRange(clients);
    let cumulativeClients = 0;
    const revData = [];
    const growData = [];
    months.forEach(({ year, month }) => {
      const monthEnd = new Date(year, month + 1, 0);
      const clientsByThen = clients.filter((c) => new Date(c.created_date) <= monthEnd);
      const activeByThen = clientsByThen.filter((c) => c.status === "Active");
      const revenue = activeByThen.reduce((sum, c) => sum + (c.services || []).reduce((s, sv) => s + (sv.price || 0), 0), 0);
      cumulativeClients = clientsByThen.length;
      revData.push({ month: MONTH_LABELS[month], amount: revenue });
      growData.push({ month: MONTH_LABELS[month], amount: cumulativeClients });
    });
    return { revenueData: revData, growthData: growData };
  }, [clients]);

  const progress = mrrGoal > 0 ? (mrr / mrrGoal) * 100 : 0;
  const capped = Math.min(progress, 100);
  const remaining = Math.max(0, mrrGoal - mrr);
  const atGoal = remaining === 0;

  return (
    <div className="relative overflow-hidden bg-card rounded-2xl border border-white/[0.07] p-5">
      <div className="absolute -top-20 -right-16 w-44 h-44 rounded-full bg-orange-500/[0.08] blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-12 w-40 h-40 rounded-full bg-yellow-400/[0.05] blur-3xl pointer-events-none" />

      <div className="relative flex items-center gap-2.5 mb-5">
        <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-orange-500 to-yellow-400 shadow-[0_0_10px_rgba(255,170,0,0.5)]" />
        <h2 className="font-display text-white/85 font-bold text-xs tracking-[0.22em] uppercase">Financial</h2>
      </div>

      {/* Metric cards */}
      <div className="relative grid grid-cols-3 gap-3 mb-5">
        <div className="relative overflow-hidden rounded-xl border border-orange-500/25 bg-gradient-to-b from-orange-500/10 to-transparent p-3 shadow-[0_0_14px_rgba(255,106,0,0.18)]">
          <div className="absolute -top-8 -right-6 w-16 h-16 rounded-full bg-orange-500/20 blur-2xl" />
          <div className="relative flex items-center gap-1 text-orange-400/70 text-[10px] uppercase tracking-wider mb-1"><Flame className="w-3 h-3" /> MRR</div>
          <div className="relative font-display text-xl font-extrabold bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(255,170,0,0.4)]">
            ${mrr.toLocaleString()}
          </div>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-yellow-400/20 bg-gradient-to-b from-yellow-400/8 to-transparent p-3 shadow-[0_0_12px_rgba(250,204,21,0.14)]">
          <div className="relative flex items-center gap-1 text-yellow-400/70 text-[10px] uppercase tracking-wider mb-1"><TrendingUp className="w-3 h-3" /> ARR</div>
          <div className="relative font-display text-xl font-extrabold text-white/90">${(mrr * 12).toLocaleString()}</div>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <div className="relative flex items-center gap-1 text-white/40 text-[10px] uppercase tracking-wider mb-1"><Target className="w-3 h-3" /> Goal</div>
          <div className="relative font-display text-xl font-extrabold text-white/80">${mrrGoal.toLocaleString()}</div>
        </div>
      </div>

      {/* Progress to goal */}
      <div className="relative mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/40 text-[10px] uppercase tracking-widest flex items-center gap-1.5">
            <Rocket className="w-3 h-3 text-orange-400" /> Progress to Goal
          </span>
          <span className={`font-display text-lg font-extrabold ${atGoal ? "text-green-400" : "bg-gradient-to-r from-orange-400 to-yellow-300 bg-clip-text text-transparent"}`}>
            {capped.toFixed(0)}%
          </span>
        </div>
        <div className="relative h-3 w-full bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.04]">
          <div
            className="relative h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 shadow-[0_0_12px_rgba(255,170,0,0.55)] transition-all duration-1000"
            style={{ width: `${capped}%` }}
          >
            <div className="absolute inset-0 shimmer rounded-full" />
          </div>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-[10px] ${atGoal ? "text-green-400 font-semibold" : "text-orange-400/70"}`}>
            {atGoal ? "Goal achieved!" : `$${remaining.toLocaleString()} to go`}
          </span>
          <span className="text-white/30 text-[10px]">Target ${mrrGoal.toLocaleString()}/mo</span>
        </div>
      </div>

      {/* Charts */}
      <div className="relative grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-orange-500/15 bg-white/[0.015] p-3">
          <p className="text-orange-400/70 text-[10px] tracking-widest uppercase mb-2 flex items-center gap-1.5"><Flame className="w-3 h-3" /> Monthly Revenue</p>
          <div className="h-[110px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 5, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF6A00" stopOpacity="0.65" />
                    <stop offset="100%" stopColor="#FACC15" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip prefix="$" />} cursor={{ stroke: 'rgba(255,170,0,0.25)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="amount" stroke="#FF8C00" strokeWidth={2} fill="url(#revGrad)" style={{ filter: 'drop-shadow(0 0 5px rgba(255,170,0,0.4))' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-yellow-400/15 bg-white/[0.015] p-3">
          <p className="text-yellow-400/70 text-[10px] tracking-widest uppercase mb-2 flex items-center gap-1.5"><TrendingUp className="w-3 h-3" /> Growth Trend</p>
          <div className="h-[110px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 5, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="growGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FACC15" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.04" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip prefix="" />} cursor={{ stroke: 'rgba(250,204,21,0.25)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="amount" stroke="#FACC15" strokeWidth={2} fill="url(#growGrad)" style={{ filter: 'drop-shadow(0 0 5px rgba(250,204,21,0.35))' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Plan & Marketing */}
      <div className="relative space-y-3">
        <PlanToExecute mrr={mrr} />
        <MarketingIdeas items={marketingItems} onChange={(v) => savePageSetting("marketingItems", v)} />
      </div>
    </div>
  );
}