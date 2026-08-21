import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PageHeader from "../components/PageHeader";
import { CheckCircle2, Clock, Zap, TrendingUp, Target, BarChart3, Loader2, Activity } from "lucide-react";
// Clock is used in TasksAnalytics KPI row
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import GameChartTooltip from "../components/charts/GameChartTooltip";

// ─── helpers ────────────────────────────────────────────────────────────────
function dayKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function weekLabel(dateStr) {
  const d = new Date(dateStr);
  const week = Math.ceil(d.getDate() / 7);
  return `W${week} ${d.toLocaleString("default", { month: "short" })}`;
}
function last30Days() {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
}
function last8Weeks() {
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (7 * (7 - i)));
    return weekLabel(d.toISOString());
  });
}

const TOOLTIP_STYLE = {
  contentStyle: { background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "rgba(255,255,255,0.5)" },
  itemStyle: { color: "#ff6a00" },
};

function StatCard({ label, value, sub, icon: Icon, color = "text-orange-500" }) {
  return (
    <div className="game-panel p-5">
      <div className="flex items-center justify-between mb-3">
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-white/50 text-xs font-medium mt-1">{label}</p>
      {sub && <p className="text-white/25 text-[10px] mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── TASKS TAB ───────────────────────────────────────────────────────────────
function TasksAnalytics() {
  const [items, setItems] = useState([]);
  const [clientItems, setClientItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.ToDoItem.list("created_date", 500),
      base44.entities.ClientOperationItem.list("created_date", 500),
    ]).then(([todos, ops]) => {
      setItems(todos);
      setClientItems(ops);
      setLoading(false);
    });

    const unsub1 = base44.entities.ToDoItem.subscribe((e) => {
      setItems((prev) => {
        if (e.type === "create") return [...prev, e.data];
        if (e.type === "update") return prev.map((i) => i.id === e.id ? e.data : i);
        if (e.type === "delete") return prev.filter((i) => i.id !== e.id);
        return prev;
      });
    });
    const unsub2 = base44.entities.ClientOperationItem.subscribe((e) => {
      setClientItems((prev) => {
        if (e.type === "create") return [...prev, e.data];
        if (e.type === "update") return prev.map((i) => i.id === e.id ? e.data : i);
        if (e.type === "delete") return prev.filter((i) => i.id !== e.id);
        return prev;
      });
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-white/20 animate-spin" /></div>;

  const TO_HOURS = { Hours: 1, Days: 8, Weeks: 40, Months: 160 };
  const toHours = (amount, unit) => (parseFloat(amount) || 0) * (TO_HOURS[unit] || 1);
  const fmtHours = (h) => {
    if (h >= 160) return `${(h / 160).toFixed(1)}mo`;
    if (h >= 40) return `${(h / 40).toFixed(1)}wk`;
    if (h >= 8) return `${(h / 8).toFixed(1)}d`;
    return `${h.toFixed(1)}h`;
  };

  const allTasks = [...items, ...clientItems];
  const completed = allTasks.filter((t) => t.done || t.status === "Completed");
  const inProgress = allTasks.filter((t) => (t.status === "In Progress") && !t.done);
  const pending = allTasks.filter((t) => (!t.status || t.status === "Pending") && !t.done);

  // Actual vs estimated time (ToDoItems only — they store actualAmount)
  const todoCompleted = items.filter((t) => t.done || t.status === "Completed");
  const totalActualHours = todoCompleted.reduce((s, t) => s + toHours(t.actualAmount, t.actualUnit), 0);
  const totalEstHours = todoCompleted.reduce((s, t) => s + toHours(t.estimatedAmount, t.estimatedUnit), 0);
  const avgActualPerTask = todoCompleted.filter(t => t.actualAmount).length
    ? (totalActualHours / todoCompleted.filter(t => t.actualAmount).length).toFixed(1)
    : "—";

  // Completion rate
  const completionRate = allTasks.length ? Math.round((completed.length / allTasks.length) * 100) : 0;

  // Tasks completed per day (last 30 days) — use completedDate when available
  const days = last30Days();
  const completedByDay = {};
  days.forEach((d) => { completedByDay[d] = 0; });
  completed.forEach((t) => {
    const d = new Date(t.completedDate || t.updated_date || t.created_date);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    if (completedByDay[key] !== undefined) completedByDay[key]++;
  });
  const dailyData = days.map((d) => ({ day: d, completed: completedByDay[d] }));

  // Avg per day (last 30 days)
  const totalLast30 = dailyData.reduce((s, d) => s + d.completed, 0);
  const avgPerDay = (totalLast30 / 30).toFixed(1);

  // Pace — tasks per week
  const weeks = last8Weeks();
  const completedByWeek = {};
  weeks.forEach((w) => { completedByWeek[w] = 0; });
  completed.forEach((t) => {
    const d = new Date(t.completedDate || t.updated_date || t.created_date);
    const key = weekLabel(d.toISOString());
    if (completedByWeek[key] !== undefined) completedByWeek[key]++;
  });
  const weeklyData = weeks.map((w) => ({ week: w, completed: completedByWeek[w] }));

  // Actual hours per week (for time tracking chart)
  const actualByWeek = {};
  weeks.forEach((w) => { actualByWeek[w] = 0; });
  todoCompleted.filter(t => t.actualAmount).forEach((t) => {
    const d = new Date(t.completedDate || t.updated_date || t.created_date);
    const key = weekLabel(d.toISOString());
    if (actualByWeek[key] !== undefined) actualByWeek[key] += toHours(t.actualAmount, t.actualUnit);
  });
  const actualWeeklyData = weeks.map((w) => ({ week: w, hours: parseFloat(actualByWeek[w].toFixed(1)) }));

  // Priority vs client split
  const priorityDone = items.filter((t) => t.done || t.status === "Completed").length;
  const clientDone = clientItems.filter((t) => t.done || t.status === "Completed").length;

  // Status breakdown for bar chart
  const statusData = [
    { label: "Completed", count: completed.length, fill: "#22c55e" },
    { label: "In Progress", count: inProgress.length, fill: "#ff6a00" },
    { label: "Pending", count: pending.length, fill: "rgba(255,255,255,0.15)" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard label="Total Tasks" value={allTasks.length} icon={Target} color="text-white/70" />
        <StatCard label="Completed" value={completed.length} icon={CheckCircle2} color="text-green-400" />
        <StatCard label="In Progress" value={inProgress.length} icon={Activity} color="text-orange-400" />
        <StatCard label="Completion Rate" value={`${completionRate}%`} icon={TrendingUp} color="text-blue-400" />
        <StatCard label="Avg Time / Task" value={avgActualPerTask === "—" ? "—" : `${avgActualPerTask}h`} icon={Clock} color="text-purple-400" sub="actual hours logged" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-5">
        <div className="game-panel p-5">
          <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent mb-4">Tasks Completed — Last 30 Days</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="gc1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF6A00" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#FACC15" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} tickLine={false} interval={6} />
              <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<GameChartTooltip />} cursor={{ stroke: 'rgba(255,170,0,0.25)', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="completed" stroke="#FF8C00" fill="url(#gc1)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#FF8C00', stroke: '#FACC15', strokeWidth: 1 }} style={{ filter: 'drop-shadow(0 0 5px rgba(255,170,0,0.4))' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="game-panel p-5">
          <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent mb-4">Actual Hours Logged — Weekly</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={actualWeeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="week" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <defs><linearGradient id="oaBarPurple" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C084FC" /><stop offset="100%" stopColor="#7C3AED" stopOpacity="0.7" /></linearGradient></defs>
              <Tooltip content={<GameChartTooltip suffix="h" />} cursor={{ fill: 'rgba(168,85,247,0.08)' }} />
              <Bar dataKey="hours" fill="url(#oaBarPurple)" radius={[6, 6, 0, 0]} style={{ filter: 'drop-shadow(0 0 6px rgba(168,85,247,0.3))' }} />
            </BarChart>
          </ResponsiveContainer>
          {totalActualHours === 0 && (
            <p className="text-white/20 text-[10px] text-center mt-2">Log actual time when completing tasks to populate this chart.</p>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-2 gap-5">
        <div className="game-panel p-5">
          <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent mb-4">Status Breakdown</h3>
          <div className="space-y-3">
            {statusData.map((s) => {
              const pct = allTasks.length ? Math.round((s.count / allTasks.length) * 100) : 0;
              return (
                <div key={s.label}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-white/50 text-xs">{s.label}</span>
                    <span className="text-white/70 text-xs font-bold">{s.count} <span className="text-white/30 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: s.fill }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="game-panel p-5">
          <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent mb-4">Task Source & Time Breakdown</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1.5"><span className="text-white/50 text-xs">Interstellar To-Do</span><span className="text-purple-400 text-xs font-bold">{items.filter(t=>t.done||t.status==="Completed").length} / {items.length}</span></div>
              <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden"><div className="h-full rounded-full bg-purple-500/70 transition-all duration-700" style={{ width: `${items.length ? Math.round((items.filter(t=>t.done||t.status==="Completed").length/items.length)*100) : 0}%` }} /></div>
            </div>
            <div>
              <div className="flex justify-between mb-1.5"><span className="text-white/50 text-xs">Client Projects</span><span className="text-orange-400 text-xs font-bold">{clientItems.filter(t=>t.done||t.status==="Completed").length} / {clientItems.length}</span></div>
              <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden"><div className="h-full rounded-full bg-orange-500/70 transition-all duration-700" style={{ width: `${clientItems.length ? Math.round((clientItems.filter(t=>t.done||t.status==="Completed").length/clientItems.length)*100) : 0}%` }} /></div>
            </div>
            <div className="pt-3 border-t border-white/[0.05] grid grid-cols-2 gap-3">
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04] text-center">
                <p className="text-purple-400 text-lg font-bold">{totalActualHours > 0 ? fmtHours(totalActualHours) : "—"}</p>
                <p className="text-white/25 text-[10px] uppercase tracking-wider mt-0.5">Actual Time Total</p>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04] text-center">
                <p className="text-blue-400 text-lg font-bold">{totalEstHours > 0 ? fmtHours(totalEstHours) : "—"}</p>
                <p className="text-white/25 text-[10px] uppercase tracking-wider mt-0.5">Estimated Total</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PROJECTS TAB ─────────────────────────────────────────────────────────────
function ProjectsAnalytics() {
  const [webOps, setWebOps] = useState([]);
  const [forge, setForge] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.WebOpsProject.list("created_date", 200),
      base44.entities.ForgeProject.list("created_date", 200),
    ]).then(([w, f]) => {
      setWebOps(w);
      setForge(f);
      setLoading(false);
    });

    const u1 = base44.entities.WebOpsProject.subscribe((e) => {
      setWebOps((prev) => {
        if (e.type === "create") return [...prev, e.data];
        if (e.type === "update") return prev.map((i) => i.id === e.id ? e.data : i);
        if (e.type === "delete") return prev.filter((i) => i.id !== e.id);
        return prev;
      });
    });
    const u2 = base44.entities.ForgeProject.subscribe((e) => {
      setForge((prev) => {
        if (e.type === "create") return [...prev, e.data];
        if (e.type === "update") return prev.map((i) => i.id === e.id ? e.data : i);
        if (e.type === "delete") return prev.filter((i) => i.id !== e.id);
        return prev;
      });
    });
    return () => { u1(); u2(); };
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-white/20 animate-spin" /></div>;

  const all = [...webOps, ...forge];
  const completed = all.filter((p) => p.status === "Completed");
  const active = all.filter((p) => p.status !== "Completed" && p.status !== "On Hold");
  const onHold = all.filter((p) => p.status === "On Hold");
  const avgProgress = active.length ? Math.round(active.reduce((s, p) => s + (p.progress || 0), 0) / active.length) : 0;

  // Completion rate
  const completionRate = all.length ? Math.round((completed.length / all.length) * 100) : 0;

  // Status distribution for all projects
  const statusGroups = {};
  all.forEach((p) => { statusGroups[p.status || "Unknown"] = (statusGroups[p.status || "Unknown"] || 0) + 1; });
  const statusColors = {
    Completed: "#22c55e", Planning: "#3b82f6", Development: "#ff6a00",
    "In Progress": "#ff6a00", Testing: "#a855f7", Deployment: "#eab308",
    Review: "#a855f7", "On Hold": "rgba(255,255,255,0.2)", "Waiting on Client": "#eab308",
  };

  // WebOps vs Forge breakdown
  const webOpsCompleted = webOps.filter((p) => p.status === "Completed").length;
  const forgeCompleted = forge.filter((p) => p.status === "Completed").length;

  // Weekly project completions
  const weeks = last8Weeks();
  const compByWeek = {};
  weeks.forEach((w) => { compByWeek[w] = 0; });
  completed.forEach((p) => {
    const d = new Date(p.updated_date || p.created_date);
    const key = weekLabel(d.toISOString());
    if (compByWeek[key] !== undefined) compByWeek[key]++;
  });
  const weeklyData = weeks.map((w) => ({ week: w, completed: compByWeek[w] }));

  // Progress distribution of active projects
  const progressBuckets = [
    { label: "0–25%", count: active.filter(p => (p.progress||0) <= 25).length },
    { label: "26–50%", count: active.filter(p => (p.progress||0) > 25 && (p.progress||0) <= 50).length },
    { label: "51–75%", count: active.filter(p => (p.progress||0) > 50 && (p.progress||0) <= 75).length },
    { label: "76–99%", count: active.filter(p => (p.progress||0) > 75 && (p.progress||0) < 100).length },
  ];

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard label="Total Projects" value={all.length} icon={Target} color="text-white/70" />
        <StatCard label="Completed" value={completed.length} icon={CheckCircle2} color="text-green-400" />
        <StatCard label="Active" value={active.length} icon={Activity} color="text-orange-400" />
        <StatCard label="Completion Rate" value={`${completionRate}%`} icon={TrendingUp} color="text-blue-400" />
        <StatCard label="Avg Progress" value={`${avgProgress}%`} icon={Zap} color="text-purple-400" sub="across active projects" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-5">
        <div className="game-panel p-5">
          <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent mb-4">Projects Completed — Weekly Pace</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="week" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <defs><linearGradient id="oaBarGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ADE80" /><stop offset="100%" stopColor="#16A34A" stopOpacity="0.7" /></linearGradient></defs>
              <Tooltip content={<GameChartTooltip />} cursor={{ fill: 'rgba(34,197,94,0.08)' }} />
              <Bar dataKey="completed" fill="url(#oaBarGreen)" radius={[6, 6, 0, 0]} style={{ filter: 'drop-shadow(0 0 6px rgba(34,197,94,0.3))' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="game-panel p-5">
          <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent mb-4">Active Projects — Progress Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={progressBuckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <defs><linearGradient id="oaBarBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60A5FA" /><stop offset="100%" stopColor="#2563EB" stopOpacity="0.7" /></linearGradient></defs>
              <Tooltip content={<GameChartTooltip />} cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
              <Bar dataKey="count" fill="url(#oaBarBlue)" radius={[6, 6, 0, 0]} style={{ filter: 'drop-shadow(0 0 6px rgba(59,130,246,0.3))' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-2 gap-5">
        <div className="game-panel p-5">
          <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent mb-4">Status Breakdown</h3>
          <div className="space-y-3">
            {Object.entries(statusGroups).map(([status, count]) => {
              const pct = all.length ? Math.round((count / all.length) * 100) : 0;
              const color = statusColors[status] || "#ff6a00";
              return (
                <div key={status}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-white/50 text-xs">{status}</span>
                    <span className="text-white/70 text-xs font-bold">{count} <span className="text-white/30 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="game-panel p-5">
          <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent mb-4">Division Breakdown</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1.5"><span className="text-white/50 text-xs">Web Øps</span><span className="text-blue-400 text-xs font-bold">{webOpsCompleted} / {webOps.length} completed</span></div>
              <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden"><div className="h-full rounded-full bg-blue-500/70 transition-all duration-700" style={{ width: `${webOps.length ? Math.round((webOpsCompleted/webOps.length)*100) : 0}%` }} /></div>
            </div>
            <div>
              <div className="flex justify-between mb-1.5"><span className="text-white/50 text-xs">Førge</span><span className="text-orange-400 text-xs font-bold">{forgeCompleted} / {forge.length} completed</span></div>
              <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden"><div className="h-full rounded-full bg-orange-500/70 transition-all duration-700" style={{ width: `${forge.length ? Math.round((forgeCompleted/forge.length)*100) : 0}%` }} /></div>
            </div>
            <div className="pt-3 border-t border-white/[0.05] grid grid-cols-3 gap-3">
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04] text-center">
                <p className="text-green-400 text-lg font-bold">{completed.length}</p>
                <p className="text-white/25 text-[10px] uppercase tracking-wider mt-0.5">Done</p>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04] text-center">
                <p className="text-orange-400 text-lg font-bold">{active.length}</p>
                <p className="text-white/25 text-[10px] uppercase tracking-wider mt-0.5">Active</p>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04] text-center">
                <p className="text-white/40 text-lg font-bold">{onHold.length}</p>
                <p className="text-white/25 text-[10px] uppercase tracking-wider mt-0.5">On Hold</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function OutputAnalytics() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command Center / Output Analytics" rightText="Real-Time Performance" />
      <div className="px-8 py-6">
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="bg-card border border-white/[0.06] mb-6">
            <TabsTrigger value="tasks" className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-500 text-white/40 gap-2">
              <BarChart3 className="w-3.5 h-3.5" /> Task Output
            </TabsTrigger>
            <TabsTrigger value="projects" className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-500 text-white/40 gap-2">
              <TrendingUp className="w-3.5 h-3.5" /> Project Output
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tasks"><TasksAnalytics /></TabsContent>
          <TabsContent value="projects"><ProjectsAnalytics /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}