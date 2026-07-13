import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from "recharts";
import { Pencil, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

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
  // Cap to last 12 months for readability
  return months.slice(-12);
}

function EditableField({ label, value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = () => {
    onSave(draft.trim());
    setEditing(false);
  };

  return (
    <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04] group">
      <p className="text-white/25 text-[10px] tracking-wider uppercase mb-1">{label}</p>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-white outline-none"
          />
          <button onClick={save} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => { setDraft(value); setEditing(false); }} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-white/70 text-xs font-medium">{value}</p>
          <button onClick={() => setEditing(true)} className="p-0.5 text-white/15 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-all shrink-0"><Pencil className="w-3 h-3" /></button>
        </div>
      )}
    </div>
  );
}

export default function FinancialPanel() {
  const [mrr, setMrr] = useState(0);
  const [clients, setClients] = useState([]);
  const [settingsId, setSettingsId] = useState(null);
  const [planToExecute, setPlanToExecute] = useState("14 more Ørbit SEO base level subs");
  const [marketing, setMarketing] = useState("Referral Program");
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
        if (rows[0].pageSettings?.marketing) setMarketing(rows[0].pageSettings.marketing);
      }
    });
  }, []);

  const savePageSetting = async (field, value) => {
    if (field === "planToExecute") setPlanToExecute(value);
    if (field === "marketing") setMarketing(value);

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

  // Real chart data derived from actual client signup activity, from app start to now
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

  return (
    <div className="bg-card rounded-xl border border-white/[0.06] p-6">
      <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase mb-5">Financial</h2>

      {/* Top Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <MetricCard label="MRR" value={`$${mrr.toLocaleString()}`} highlight />
        <MetricCard label="ARR" value={`$${(mrr * 12).toLocaleString()}`} />
        <MetricCard label="MRR Goal" value="$10,000" />
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-white/30">Progress to Goal</span>
          <span className="text-orange-500 font-semibold">{progress.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-white/25 text-[10px] tracking-wider uppercase mb-2">Monthly Revenue</p>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Bar dataKey="amount" fill="#FF6A00" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <p className="text-white/25 text-[10px] tracking-wider uppercase mb-2">Growth Trend</p>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Bar dataKey="amount" fill="#3B82F6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Plan & Marketing */}
      <div className="space-y-3">
        <EditableField label="Plan to Execute" value={planToExecute} onSave={(v) => savePageSetting("planToExecute", v)} />
        <EditableField label="Marketing" value={marketing} onSave={(v) => savePageSetting("marketing", v)} />
      </div>
    </div>
  );
}

function MetricCard({ label, value, highlight }) {
  return (
    <div className="text-center p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
      <p className="text-white/25 text-[10px] tracking-wider uppercase mb-1">{label}</p>
      <p className={`text-lg font-bold ${highlight ? "text-orange-500" : "text-white/80"}`}>{value}</p>
    </div>
  );
}