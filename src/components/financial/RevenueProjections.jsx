import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, Trash2, Loader2, TrendingUp, DollarSign, Target, Rocket, CalendarClock, Check, X } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, BarChart, Bar, Cell } from "recharts";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GameChartTooltip from "../charts/GameChartTooltip";

const EMPTY = { clientName: "", serviceTitle: "", amount: "", expectedCloseDate: "", note: "", status: "Pending" };
const STATUS_STYLES = {
  Pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  Won: "bg-green-500/10 text-green-400 border-green-500/20",
  Lost: "bg-red-500/10 text-red-400 border-red-500/20",
};

function fmtMoney(n) { return `$${Math.round(n).toLocaleString()}`; }
function fmtDate(d) { return d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "\u2014"; }
function daysUntil(d) { if (!d) return null; const diff = new Date(d + "T00:00:00") - new Date(new Date().toDateString()); return Math.round(diff / 86400000); }

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-orange-500/30 rounded-lg px-2.5 py-1.5 shadow-[0_0_12px_rgba(255,170,0,0.25)]">
      <p className="text-[9px] text-white/40 uppercase tracking-wider">{label}</p>
      <p className="text-orange-400 text-xs font-bold">{fmtMoney(payload[0].value)}</p>
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

  // Active pipeline = everything not Lost (Pending deals you're working + Won deals not yet in CRM).
  const pending = useMemo(() => projections.filter((p) => p.status !== "Lost"), [projections]);

  const projectedMrr = pending.reduce((s, p) => s + (p.amount || 0), 0);
  const potentialMrr = currentMrr + projectedMrr;
  const pipelineCount = pending.length;

  // Upcoming windows
  const next14 = pending.filter((p) => { const d = daysUntil(p.expectedCloseDate); return d !== null && d >= 0 && d <= 14; });
  const next30 = pending.filter((p) => { const d = daysUntil(p.expectedCloseDate); return d !== null && d >= 0 && d <= 30; });
  const next14Total = next14.reduce((s, p) => s + (p.amount || 0), 0);
  const next30Total = next30.reduce((s, p) => s + (p.amount || 0), 0);

  // Cumulative MRR ramp chart — start at current MRR, step up at each pending close date
  const rampData = useMemo(() => {
    const sorted = [...pending].filter((p) => p.expectedCloseDate).sort((a, b) => new Date(a.expectedCloseDate) - new Date(b.expectedCloseDate));
    const points = [{ label: "Now", mrr: currentMrr }];
    let cum = currentMrr;
    sorted.forEach((p, i) => {
      cum += p.amount || 0;
      const d = new Date(p.expectedCloseDate + "T00:00:00");
      points.push({ label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), mrr: cum });
    });
    if (points.length === 1) points.push({ label: "No dates", mrr: currentMrr });
    return points;
  }, [pending, currentMrr]);

  // Per-client pipeline bar
  const clientBars = useMemo(() => {
    const map = {};
    pending.forEach((p) => { map[p.clientName] = (map[p.clientName] || 0) + (p.amount || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
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

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-white/20 animate-spin" /></div>;

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
          <p className="font-display text-[10px] tracking-[0.2em] uppercase mb-3 bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Projected MRR Ramp</p>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rampData} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="projRamp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF6A00" stopOpacity="0.65" />
                    <stop offset="100%" stopColor="#FACC15" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,170,0,0.25)", strokeWidth: 1 }} />
                <Area type="stepAfter" dataKey="mrr" stroke="#FF8C00" strokeWidth={2} fill="url(#projRamp)" dot={{ r: 3, fill: "#FF8C00", stroke: "#FACC15", strokeWidth: 1 }} activeDot={{ r: 5 }} style={{ filter: "drop-shadow(0 0 5px rgba(255,170,0,0.4))" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-white/30 text-[10px] mt-2">Starts at current MRR and steps up at each expected close date.</p>
        </div>

        <div className="game-panel p-5">
          <p className="font-display text-[10px] tracking-[0.2em] uppercase mb-3 bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Pipeline by Client</p>
          <div className="h-[180px]">
            {clientBars.length === 0 ? (
              <div className="h-full flex items-center justify-center text-white/25 text-xs">No pending deals yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clientBars} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="projBar" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#FF8C00" /><stop offset="100%" stopColor="#FACC15" stopOpacity="0.85" /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<GameChartTooltip prefix="$" />} cursor={{ fill: "rgba(255,170,0,0.06)" }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="url(#projBar)" style={{ filter: "drop-shadow(0 0 6px rgba(255,170,0,0.2))" }} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Projection list */}
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Pipeline Projections</h2>
        <Button onClick={openAdd} className="bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-black font-semibold shadow-[0_0_14px_rgba(255,106,0,0.25)] h-9 gap-2"><Plus className="w-4 h-4" />Add Projection</Button>
      </div>

      {projections.length === 0 ? (
        <div className="game-panel p-10 text-center">
          <Target className="w-8 h-8 text-white/10 mx-auto mb-3" />
          <p className="text-white/30 text-sm">No projections yet. Add a potential deal to track its impact on your MRR.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {projections.map((p) => {
            const d = daysUntil(p.expectedCloseDate);
            const overdue = d !== null && d < 0 && p.status === "Pending";
            return (
              <div key={p.id} className={`card-hover bg-card rounded-xl border p-4 flex items-center gap-4 group ${p.status === "Lost" ? "border-white/[0.04] opacity-50" : p.status === "Won" ? "border-green-500/20" : overdue ? "border-red-500/20" : "border-white/[0.06]"}`}>
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/25 to-yellow-400/10 border border-orange-500/25 flex items-center justify-center text-orange-300 font-display font-extrabold text-xs shrink-0">{p.clientName?.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white/85 text-sm font-medium">{p.clientName}</span>
                    {p.serviceTitle && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40">{p.serviceTitle}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-white/30">
                    {p.expectedCloseDate && (
                      <span className={overdue ? "text-red-400/70" : ""}>
                        <CalendarClock className="w-3 h-3 inline mr-1" />{fmtDate(p.expectedCloseDate)}
                        {d !== null && p.status === "Pending" && <span className="ml-1">({d < 0 ? `${Math.abs(d)}d ago` : `in ${d}d`})</span>}
                      </span>
                    )}
                    {p.note && <span className="truncate italic text-white/25 max-w-[280px]">{p.note}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-display font-bold bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">{fmtMoney(p.amount)}<span className="text-white/25 text-[10px] font-normal">/mo</span></p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {p.status === "Pending" ? (
                    <>
                      <button onClick={() => setStatus(p, "Won")} title="Mark Won" className="p-1.5 rounded-md hover:bg-green-500/10 text-white/15 hover:text-green-400/70 transition-all"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setStatus(p, "Lost")} title="Mark Lost" className="p-1.5 rounded-md hover:bg-red-500/10 text-white/15 hover:text-red-400/60 transition-all"><X className="w-3.5 h-3.5" /></button>
                    </>
                  ) : (
                    <button onClick={() => setStatus(p, "Pending")} className="text-[10px] px-2 py-1 rounded border border-white/10 text-white/40 hover:text-white/70">Reopen</button>
                  )}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${STATUS_STYLES[p.status]}`}>{p.status}</span>
                  <button onClick={() => openEdit(p)} className="p-1.5 text-white/15 hover:text-white/50 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => remove(p)} className="p-1.5 text-white/15 hover:text-red-400/60 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-white/[0.08] text-white max-w-md">
          <DialogHeader><DialogTitle className="text-white">{editing ? "Edit Projection" : "Add Projection"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-white/40 text-xs">Client *</Label>
              <Input list="crm-client-list" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white" placeholder="Select or type a client" />
              <datalist id="crm-client-list">
                {clients.map((c) => <option key={c.id} value={c.business} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-white/40 text-xs">Service Title</Label><Input value={form.serviceTitle} onChange={(e) => setForm({ ...form, serviceTitle: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white" placeholder="e.g. Orbit SEO Base" /></div>
              <div><Label className="text-white/40 text-xs">Amount ($/mo) *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white" placeholder="500" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-white/40 text-xs">Expected Close Date</Label><Input type="date" value={form.expectedCloseDate} onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white" /></div>
              <div>
                <Label className="text-white/40 text-xs">Status</Label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full bg-white/[0.03] border border-white/[0.06] rounded-md px-3 py-2 text-white text-sm outline-none">
                  {["Pending", "Won", "Lost"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div><Label className="text-white/40 text-xs">Note</Label><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-1 w-full bg-white/[0.03] border border-white/[0.06] rounded-md px-3 py-2 text-white text-sm outline-none resize-none min-h-[60px]" placeholder="Context on the deal..." /></div>
            <Button onClick={save} className="w-full bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-black font-semibold shadow-[0_0_14px_rgba(255,106,0,0.25)]">{editing ? "Save Changes" : "Add Projection"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, highlight, accent }) {
  return (
    <div className={`game-panel p-4 ${highlight ? "border-orange-500/30" : accent ? "border-yellow-400/25" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-3.5 h-3.5 ${highlight ? "text-orange-500" : accent ? "text-yellow-400/70" : "text-white/20"}`} />
        <span className="text-white/30 text-[10px] tracking-wider uppercase">{label}</span>
      </div>
      <p className={`text-xl font-display font-extrabold ${highlight ? "bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent" : accent ? "bg-gradient-to-r from-yellow-300 to-amber-200 bg-clip-text text-transparent" : "text-white/80"}`}>{value}</p>
      {sub && <p className="text-white/25 text-[10px] mt-1">{sub}</p>}
    </div>
  );
}