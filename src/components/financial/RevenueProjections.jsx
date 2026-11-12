import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, Trash2, Loader2, TrendingUp, DollarSign, Target, Rocket, CalendarClock, Check, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, LabelList } from "recharts";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMPTY = { clientName: "", serviceTitle: "", amount: "", expectedCloseDate: "", note: "", status: "Pending" };
const STATUS_STYLES = {
  Pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  Won: "bg-green-500/10 text-green-600 border-green-500/20",
  Lost: "bg-red-500/10 text-red-600 border-red-500/20",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_COLORS = ["#ff3c00", "#FF8515", "#FF9E33", "#FFB74D", "#FFC964", "#ffaa00", "#FBD94A", "#FDE047", "#FCE766", "#FDEE89", "#FEF3B8", "#FEF7D4"];
function monthLabel(d) { return `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`; }

import { fmtMoney, fmtDate } from "@/lib/format";
function daysUntil(d) { if (!d) return null; const diff = new Date(d + "T00:00:00") - new Date(new Date().toDateString()); return Math.round(diff / 86400000); }

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-orange-500/30 rounded-lg px-2.5 py-1.5">
      <p className="text-[9px] text-ink/[0.58] uppercase tracking-wider">{label}</p>
      <p className="text-orange-600 text-xs font-bold">{fmtMoney(payload[0].value)}</p>
    </div>
  );
}

export default function RevenueProjections() {
  const [projections, setProjections] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [currentMrr, setCurrentMrr] = useState(0);

  useEffect(() => {
    Promise.all([
      base44.entities.RevenueProjection.list("-expectedCloseDate", 500),
      base44.entities.CRMClient.list("business", 500),
    ]).then(([p, c]) => {
      setProjections(p);
      setClients(c);
      const mrr = c.filter((x) => x.status === "Active")
        .reduce((s, cl) => s + (cl.services || []).reduce((acc, sv) => acc + (sv.price || 0), 0), 0);
      setCurrentMrr(mrr);
      setLoading(false);
    });
  }, []);

  const recurring = useMemo(() => projections.filter((p) => (p.projectionType || "Recurring") === "Recurring"), [projections]);
  const pending = useMemo(() => recurring.filter((p) => p.status === "Pending"), [recurring]);

  const projectedMrr = pending.reduce((s, p) => s + (p.amount || 0), 0);
  const potentialMrr = currentMrr + projectedMrr;
  const pipelineCount = pending.length;

  // Upcoming windows
  const next14 = pending.filter((p) => { const d = daysUntil(p.expectedCloseDate); return d !== null && d >= 0 && d <= 14; });
  const next30 = pending.filter((p) => { const d = daysUntil(p.expectedCloseDate); return d !== null && d >= 0 && d <= 30; });
  const next14Total = next14.reduce((s, p) => s + (p.amount || 0), 0);
  const next30Total = next30.reduce((s, p) => s + (p.amount || 0), 0);

  // Monthly cumulative MRR ramp — buckets pending deals by close month, running total per month
  const rampData = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const dated = pending.filter((p) => p.expectedCloseDate);
    let endMonth = start;
    if (dated.length) {
      const maxD = new Date(Math.max(...dated.map((p) => new Date(p.expectedCloseDate + "T00:00:00").getTime())));
      endMonth = new Date(maxD.getFullYear(), maxD.getMonth(), 1);
    }
    const minEnd = new Date(start.getFullYear(), start.getMonth() + 5, 1);
    if (endMonth < minEnd) endMonth = minEnd;
    const cap = new Date(start.getFullYear(), start.getMonth() + 11, 1);
    if (endMonth > cap) endMonth = cap;

    const addByMonth = {};
    dated.forEach((p) => {
      const d = new Date(p.expectedCloseDate + "T00:00:00");
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      addByMonth[k] = (addByMonth[k] || 0) + (p.amount || 0);
    });

    const months = [];
    let cursor = new Date(start);
    let cum = currentMrr;
    while (cursor <= endMonth) {
      const k = `${cursor.getFullYear()}-${cursor.getMonth()}`;
      cum += addByMonth[k] || 0;
      months.push({ label: monthLabel(cursor), mrr: cum, added: addByMonth[k] || 0 });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return months;
  }, [pending, currentMrr]);

  // Per-client pipeline stacked by close month — total labeled at bar end, months color-coded
  const clientStacked = useMemo(() => {
    const monthKeys = new Set();
    pending.forEach((p) => {
      if (p.expectedCloseDate) {
        const d = new Date(p.expectedCloseDate + "T00:00:00");
        monthKeys.add(`${d.getFullYear()}-${d.getMonth()}`);
      }
    });
    const sortedKeys = [...monthKeys].sort();
    const mLabels = sortedKeys.map((k) => {
      const [y, m] = k.split("-");
      return monthLabel(new Date(+y, +m, 1));
    });

    const map = {};
    pending.forEach((p) => {
      if (!p.clientName) return;
      if (!map[p.clientName]) map[p.clientName] = { name: p.clientName, total: 0 };
      const mLabel = p.expectedCloseDate
        ? monthLabel(new Date(p.expectedCloseDate + "T00:00:00"))
        : "Undated";
      map[p.clientName][mLabel] = (map[p.clientName][mLabel] || 0) + (p.amount || 0);
      map[p.clientName].total += p.amount || 0;
    });

    const rows = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8);
    return { rows, monthLabels: mLabels };
  }, [pending]);

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY }); setModalOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ clientName: p.clientName, serviceTitle: p.serviceTitle || "", amount: String(p.amount ?? ""), expectedCloseDate: p.expectedCloseDate || "", note: p.note || "", status: p.status });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.clientName.trim() || !form.amount) return;
    const data = {
      clientName: form.clientName.trim(),
      serviceTitle: form.serviceTitle.trim(),
      amount: parseFloat(form.amount) || 0,
      expectedCloseDate: form.expectedCloseDate || "",
      note: form.note.trim(),
      status: form.status,
      projectionType: "Recurring",
    };
    if (editing) {
      await base44.entities.RevenueProjection.update(editing.id, data);
      setProjections((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...data } : p)));
    } else {
      const created = await base44.entities.RevenueProjection.create(data);
      setProjections((prev) => [created, ...prev]);
    }
    setModalOpen(false);
  };

  const remove = async (p) => {
    await base44.entities.RevenueProjection.delete(p.id);
    setProjections((prev) => prev.filter((x) => x.id !== p.id));
  };

  const setStatus = async (p, status) => {
    await base44.entities.RevenueProjection.update(p.id, { status });
    setProjections((prev) => prev.map((x) => (x.id === p.id ? { ...x, status } : x)));
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-ink/[0.38] animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Current MRR" value={fmtMoney(currentMrr)} sub="Active subscriptions" />
        <StatCard icon={TrendingUp} label="Projected Add" value={fmtMoney(projectedMrr)} sub={`${pipelineCount} pending deals`} highlight />
        <StatCard icon={Rocket} label="Potential MRR" value={fmtMoney(potentialMrr)} sub="If all pending close" accent />
        <StatCard icon={CalendarClock} label="Next 30 Days" value={fmtMoney(next30Total)} sub={`${next30.length} deals \u00b7 ${fmtMoney(next14Total)} in 14d`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="game-panel p-5">
          <p className="font-display text-[10px] tracking-[0.2em] uppercase mb-3 bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Projected MRR by Month</p>
          <div className="h-[210px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rampData} margin={{ top: 26, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="projRampBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff3c00" />
                    <stop offset="100%" stopColor="#ffaa00" stopOpacity="0.85" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,170,0,0.06)" }} />
                <Bar dataKey="mrr" radius={[6, 6, 0, 0]} fill="url(#projRampBar)" style={{ filter: "drop-shadow(0 0 6px rgba(255,170,0,0.2))" }} maxBarSize={64}>
                  <LabelList dataKey="mrr" position="top" formatter={fmtMoney} style={{ fill: "#ffaa00", fontSize: 11, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-ink/[0.48] text-[10px] mt-2">Cumulative MRR if pending deals close on their expected dates. Each bar is a month — no hovering needed.</p>
        </div>

        <div className="game-panel p-5">
          <p className="font-display text-[10px] tracking-[0.2em] uppercase mb-3 bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Pipeline by Client</p>
          <div className="space-y-2.5 pt-1">
            {clientStacked.rows.length === 0 ? (
              <p className="text-ink/[0.43] text-xs py-10 text-center">No pending deals yet.</p>
            ) : clientStacked.rows.map((row) => {
              const segments = clientStacked.monthLabels
                .map((m, i) => ({ m, i, amount: row[m] || 0 }))
                .filter((s) => s.amount > 0);
              return (
                <div key={row.name} className="flex items-center gap-2">
                  <span className="text-ink/55 text-[11px] w-28 truncate shrink-0" title={row.name}>{row.name}</span>
                  <div className="relative flex-1 h-6 rounded-md overflow-hidden bg-ink/[0.03] border border-ink/[0.13] flex">
                    {segments.map((s) => (
                      <div key={s.m} className="h-full flex items-center justify-center transition-all" style={{ width: `${(s.amount / row.total) * 100}%`, background: MONTH_COLORS[s.i % MONTH_COLORS.length] }} title={`${s.m}: ${fmtMoney(s.amount)}`}>
                        {s.amount / row.total > 0.2 && <span className="text-white/75 text-[9px] font-bold">{fmtMoney(s.amount)}</span>}
                      </div>
                    ))}
                  </div>
                  <span className="text-orange-600 text-xs font-bold w-16 text-right shrink-0 tabular-nums">{fmtMoney(row.total)}</span>
                </div>
              );
            })}
          </div>
          {clientStacked.monthLabels.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-3 border-t border-ink/[0.13]">
              {clientStacked.monthLabels.map((m, i) => (
                <span key={m} className="flex items-center gap-1 text-[10px] text-ink/[0.58]">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: MONTH_COLORS[i % MONTH_COLORS.length] }} />{m}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Projection list */}
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Pipeline Projections</h2>
        <Button onClick={openAdd} className="bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-semibold h-9 gap-2"><Plus className="w-4 h-4" />Add Projection</Button>
      </div>

      {recurring.length === 0 ? (
        <div className="game-panel p-10 text-center">
          <Target className="w-8 h-8 text-ink/[0.28] mx-auto mb-3" />
          <p className="text-ink/[0.48] text-sm">No recurring projections yet. Add a potential deal to track its impact on your MRR.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recurring.map((p) => {
            const d = daysUntil(p.expectedCloseDate);
            const overdue = d !== null && d < 0 && p.status === "Pending";
            return (
              <div key={p.id} className={`card-hover bg-card rounded-md border p-4 flex items-center gap-4 group ${p.status === "Lost" ? "border-ink/[0.13] opacity-50" : p.status === "Won" ? "border-green-500/20" : overdue ? "border-red-500/20" : "border-ink/[0.13]"}`}>
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/25 to-yellow-400/10 border border-orange-500/25 flex items-center justify-center text-orange-600 font-display font-extrabold text-xs shrink-0">{p.clientName?.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-ink/85 text-sm font-medium">{p.clientName}</span>
                    {p.serviceTitle && <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink/[0.04] text-ink/[0.58]">{p.serviceTitle}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-ink/[0.48]">
                    {p.expectedCloseDate && (
                      <span className={overdue ? "text-red-600/70" : ""}>
                        <CalendarClock className="w-3 h-3 inline mr-1" />{fmtDate(p.expectedCloseDate)}
                        {d !== null && p.status === "Pending" && <span className="ml-1">({d < 0 ? `${Math.abs(d)}d ago` : `in ${d}d`})</span>}
                      </span>
                    )}
                    {p.note && <span className="truncate italic text-ink/[0.43] max-w-[280px]">{p.note}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-display font-bold bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">{fmtMoney(p.amount)}<span className="text-ink/[0.43] text-[10px] font-normal">/mo</span></p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {p.status === "Pending" ? (
                    <>
                      <button onClick={() => setStatus(p, "Won")} title="Mark Won" className="p-1.5 rounded-md hover:bg-green-500/10 text-ink/[0.33] hover:text-green-600/70 transition-all"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setStatus(p, "Lost")} title="Mark Lost" className="p-1.5 rounded-md hover:bg-red-500/10 text-ink/[0.33] hover:text-red-600/60 transition-all"><X className="w-3.5 h-3.5" /></button>
                    </>
                  ) : (
                    <button onClick={() => setStatus(p, "Pending")} className="text-[10px] px-2 py-1 rounded border border-ink/[0.13] text-ink/[0.58] hover:text-ink/70">Reopen</button>
                  )}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${STATUS_STYLES[p.status]}`}>{p.status}</span>
                  <button onClick={() => openEdit(p)} className="p-1.5 text-ink/[0.33] hover:text-ink/50 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => remove(p)} className="p-1.5 text-ink/[0.33] hover:text-red-600/60 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-ink/[0.13] text-ink max-w-md">
          <DialogHeader><DialogTitle className="text-ink">{editing ? "Edit Projection" : "Add Projection"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-ink/[0.58] text-xs">Client *</Label>
              <Input list="crm-client-list" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} className="mt-1 bg-ink/[0.03] border-ink/[0.13] text-ink" placeholder="Select or type a client" />
              <datalist id="crm-client-list">
                {clients.map((c) => <option key={c.id} value={c.business} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-ink/[0.58] text-xs">Service Title</Label><Input value={form.serviceTitle} onChange={(e) => setForm({ ...form, serviceTitle: e.target.value })} className="mt-1 bg-ink/[0.03] border-ink/[0.13] text-ink" placeholder="e.g. HyperCare+ Base" /></div>
              <div><Label className="text-ink/[0.58] text-xs">Amount ($/mo) *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 bg-ink/[0.03] border-ink/[0.13] text-ink" placeholder="500" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-ink/[0.58] text-xs">Expected Close Date</Label><Input type="date" value={form.expectedCloseDate} onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })} className="mt-1 bg-ink/[0.03] border-ink/[0.13] text-ink" /></div>
              <div>
                <Label className="text-ink/[0.58] text-xs">Status</Label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full bg-ink/[0.03] border border-ink/[0.13] rounded-md px-3 py-2 text-ink text-sm outline-none">
                  {["Pending", "Won", "Lost"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div><Label className="text-ink/[0.58] text-xs">Note</Label><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-1 w-full bg-ink/[0.03] border border-ink/[0.13] rounded-md px-3 py-2 text-ink text-sm outline-none resize-none min-h-[60px]" placeholder="Context on the deal..." /></div>
            <Button onClick={save} className="w-full bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-semibold">{editing ? "Save Changes" : "Add Projection"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, highlight, accent }) {
  return (
    <div className={`game-panel p-4 ${highlight ? "border-orange-500/30" : accent ? "border-yellow-500/25" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-3.5 h-3.5 ${highlight ? "text-orange-500" : accent ? "text-yellow-600/70" : "text-ink/[0.38]"}`} />
        <span className="text-ink/[0.48] text-[10px] tracking-wider uppercase">{label}</span>
      </div>
      <p className={`text-xl font-display font-extrabold ${highlight ? "bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent" : accent ? "bg-gradient-to-r from-yellow-300 to-amber-200 bg-clip-text text-transparent" : "text-ink/80"}`}>{value}</p>
      {sub && <p className="text-ink/[0.43] text-[10px] mt-1">{sub}</p>}
    </div>
  );
}