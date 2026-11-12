import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, Trash2, Loader2, DollarSign, Target, Rocket, CalendarClock, Check, X, Briefcase } from "lucide-react";
import { BarChart, Bar, Cell, XAxis, ResponsiveContainer, CartesianGrid, Tooltip, LabelList } from "recharts";
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
const BAR_COLORS = ["#A855F7", "#C084FC", "#D8B4FE", "#E9D5FF"];

function monthLabel(d) { return `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`; }
import { fmtMoney, fmtDate } from "@/lib/format";
function daysUntil(d) { if (!d) return null; const diff = new Date(d + "T00:00:00") - new Date(new Date().toDateString()); return Math.round(diff / 86400000); }

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-purple-500/30 rounded-lg px-2.5 py-1.5 shadow-[0_0_12px_rgba(168,85,247,0.25)]">
      <p className="text-[9px] text-ink/[0.58] uppercase tracking-wider">{label}</p>
      <p className="text-purple-600 text-xs font-bold">{fmtMoney(payload[0].value)}</p>
    </div>
  );
}

export default function ProjectProjections() {
  const [projections, setProjections] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });

  useEffect(() => {
    Promise.all([
      base44.entities.RevenueProjection.list("-expectedCloseDate", 500),
      base44.entities.CRMClient.list("business", 500),
    ]).then(([p, c]) => {
      setProjections(p.filter((x) => x.projectionType === "One-Time"));
      setClients(c);
      setLoading(false);
    });
  }, []);

  const pending = useMemo(() => projections.filter((p) => p.status === "Pending"), [projections]);
  const won = useMemo(() => projections.filter((p) => p.status === "Won"), [projections]);

  const pendingTotal = pending.reduce((s, p) => s + (p.amount || 0), 0);
  const wonTotal = won.reduce((s, p) => s + (p.amount || 0), 0);

  const next30 = pending.filter((p) => { const d = daysUntil(p.expectedCloseDate); return d !== null && d >= 0 && d <= 30; });
  const next30Total = next30.reduce((s, p) => s + (p.amount || 0), 0);

  // One-time revenue by close month (pending only)
  const monthData = useMemo(() => {
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

    const byMonth = {};
    dated.forEach((p) => {
      const d = new Date(p.expectedCloseDate + "T00:00:00");
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      byMonth[k] = (byMonth[k] || 0) + (p.amount || 0);
    });

    const months = [];
    let cursor = new Date(start);
    let i = 0;
    while (cursor <= endMonth) {
      const k = `${cursor.getFullYear()}-${cursor.getMonth()}`;
      const amount = byMonth[k] || 0;
      months.push({ label: monthLabel(cursor), amount, idx: i });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      i++;
    }
    return months;
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
      projectionType: "One-Time",
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
    <div className="space-y-6 pt-8 border-t border-ink/[0.13]">
      <div className="flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-purple-600" />
        <h2 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-purple-400 to-fuchsia-300 bg-clip-text text-transparent">Project Projections</h2>
        <span className="text-ink/[0.43] text-[10px] ml-1">(one-time payments)</span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Pending Total" value={fmtMoney(pendingTotal)} sub={`${pending.length} project deals`} highlight />
        <StatCard icon={Check} label="Won Total" value={fmtMoney(wonTotal)} sub={`${won.length} closed`} accent />
        <StatCard icon={CalendarClock} label="Next 30 Days" value={fmtMoney(next30Total)} sub={`${next30.length} closing`} />
        <StatCard icon={Rocket} label="Total Pipeline" value={fmtMoney(pendingTotal + wonTotal)} sub="Pending + Won" />
      </div>

      {/* Monthly chart */}
      <div className="game-panel p-5">
        <p className="font-display text-[10px] tracking-[0.2em] uppercase mb-3 bg-gradient-to-r from-purple-400 to-fuchsia-300 bg-clip-text text-transparent">One-Time Revenue by Close Month</p>
        <div className="h-[210px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthData} margin={{ top: 26, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(168,85,247,0.06)" }} />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={64} style={{ filter: "drop-shadow(0 0 6px rgba(168,85,247,0.25))" }}>
                {monthData.map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={BAR_COLORS[entry.idx % BAR_COLORS.length]} />
                ))}
                <LabelList dataKey="amount" position="top" formatter={(v) => v > 0 ? fmtMoney(v) : ""} style={{ fill: "#C084FC", fontSize: 11, fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-ink/[0.48] text-[10px] mt-2">Sum of pending one-time project payments expected to close each month.</p>
      </div>

      {/* List */}
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-[11px] tracking-[0.2em] uppercase text-ink/60">Project Pipeline</h3>
        <Button onClick={openAdd} className="bg-gradient-to-r from-purple-500 to-fuchsia-400 hover:from-purple-400 hover:to-fuchsia-300 text-ink font-semibold shadow-[0_0_14px_rgba(168,85,247,0.25)] h-9 gap-2"><Plus className="w-4 h-4" />Add Project</Button>
      </div>

      {projections.length === 0 ? (
        <div className="game-panel p-10 text-center">
          <Target className="w-8 h-8 text-ink/[0.28] mx-auto mb-3" />
          <p className="text-ink/[0.48] text-sm">No project projections yet. Add a one-time project deal to track its revenue.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {projections.map((p) => {
            const d = daysUntil(p.expectedCloseDate);
            const overdue = d !== null && d < 0 && p.status === "Pending";
            return (
              <div key={p.id} className={`card-hover bg-card rounded-md border p-4 flex items-center gap-4 group ${p.status === "Lost" ? "border-ink/[0.13] opacity-50" : p.status === "Won" ? "border-green-500/20" : overdue ? "border-red-500/20" : "border-ink/[0.13]"}`}>
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/25 to-fuchsia-400/10 border border-purple-500/25 flex items-center justify-center text-purple-600 font-display font-extrabold text-xs shrink-0">{p.clientName?.charAt(0)}</div>
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
                  <p className="text-sm font-display font-bold bg-gradient-to-r from-purple-400 to-fuchsia-300 bg-clip-text text-transparent">{fmtMoney(p.amount)}</p>
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
          <DialogHeader><DialogTitle className="text-ink">{editing ? "Edit Project" : "Add Project Projection"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-ink/[0.58] text-xs">Client *</Label>
              <Input list="proj-client-list" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} className="mt-1 bg-ink/[0.03] border-ink/[0.13] text-ink" placeholder="Select or type a client" />
              <datalist id="proj-client-list">
                {clients.map((c) => <option key={c.id} value={c.business} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-ink/[0.58] text-xs">Project Title</Label><Input value={form.serviceTitle} onChange={(e) => setForm({ ...form, serviceTitle: e.target.value })} className="mt-1 bg-ink/[0.03] border-ink/[0.13] text-ink" placeholder="e.g. Website Build" /></div>
              <div><Label className="text-ink/[0.58] text-xs">Amount ($ total) *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 bg-ink/[0.03] border-ink/[0.13] text-ink" placeholder="3500" /></div>
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
            <div><Label className="text-ink/[0.58] text-xs">Note</Label><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-1 w-full bg-ink/[0.03] border-ink/[0.13] rounded-md px-3 py-2 text-ink text-sm outline-none resize-none min-h-[60px]" placeholder="Context on the project..." /></div>
            <Button onClick={save} className="w-full bg-gradient-to-r from-purple-500 to-fuchsia-400 hover:from-purple-400 hover:to-fuchsia-300 text-ink font-semibold shadow-[0_0_14px_rgba(168,85,247,0.25)]">{editing ? "Save Changes" : "Add Project"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, highlight, accent }) {
  return (
    <div className={`game-panel p-4 ${highlight ? "border-purple-500/30" : accent ? "border-green-500/25" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-3.5 h-3.5 ${highlight ? "text-purple-600" : accent ? "text-green-600/70" : "text-ink/[0.38]"}`} />
        <span className="text-ink/[0.48] text-[10px] tracking-wider uppercase">{label}</span>
      </div>
      <p className={`text-xl font-display font-extrabold ${highlight ? "bg-gradient-to-r from-purple-400 to-fuchsia-300 bg-clip-text text-transparent" : accent ? "bg-gradient-to-r from-green-300 to-emerald-200 bg-clip-text text-transparent" : "text-ink/80"}`}>{value}</p>
      {sub && <p className="text-ink/[0.43] text-[10px] mt-1">{sub}</p>}
    </div>
  );
}