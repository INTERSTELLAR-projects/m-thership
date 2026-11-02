import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PageHeader from "../components/PageHeader";
import { Clock, BarChart3, Loader2, Activity } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { ChartTooltip, FlameDefs, KpiTile, axisProps, gridProps, cursorProps, barCursor } from "@/components/charts/ChartKit";
import TimeIntelligence from "@/features/tasks/components/TimeIntelligence";
import { TASK_STATUSES, OPEN_STATUSES, TASK_TYPES, PROJECT_TYPES, PROJECT_STATUSES } from "@/features/tasks/lib/constants";
import { TIMER_CHANGED, totalSeconds } from "@/features/tasks/lib/timer";
import { TASKS_CHANGED } from "@/features/tasks/lib/clients";

// Output = one source of truth: the Task engine (Task), Projects (Project) and the task clock (TimeEntry).

// ─── helpers ────────────────────────────────────────────────────────────────
const DAY = 86400000;
const asArray = (r) => (Array.isArray(r) ? r : (r && r.items) || []);
const dayKey = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
const startOfWeek = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
};
const fmtH = (h) => (h >= 100 ? `${Math.round(h)}h` : `${(Math.round(h * 10) / 10).toFixed(h && h < 10 ? 1 : 0)}h`);

function last30() {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * DAY);
    return { key: dayKey(d), day: dayKey(d), completed: 0 };
  });
}
function last8Weeks() {
  const now = startOfWeek(new Date());
  return Array.from({ length: 8 }, (_, i) => {
    const s = new Date(now.getTime() - (7 - i) * 7 * DAY);
    return { start: s, week: s.toLocaleDateString("en-US", { month: "short", day: "numeric" }), hours: 0, completed: 0 };
  });
}
const weekIndex = (weeks, date) => {
  for (let i = weeks.length - 1; i >= 0; i--) if (date >= weeks[i].start) return i;
  return -1;
};

function useOutputData() {
  const [state, setState] = useState({ loading: true, tasks: [], projects: [], entries: [] });
  const load = useCallback(async () => {
    const [tasks, projects, entries] = await Promise.all([
      base44.entities.Task.list("-updated_date", 2000).catch(() => []),
      base44.entities.Project.list("-updated_date", 500).catch(() => []),
      base44.entities.TimeEntry.list("-ended_at", 2000).catch(() => []),
    ]);
    setState({ loading: false, tasks: asArray(tasks), projects: asArray(projects), entries: asArray(entries) });
  }, []);
  useEffect(() => {
    load();
    const reload = () => load();
    window.addEventListener(TIMER_CHANGED, reload);
    window.addEventListener(TASKS_CHANGED, reload);
    const unsubs = [base44.entities.Task, base44.entities.Project, base44.entities.TimeEntry].map((e) => {
      try {
        return e.subscribe(() => reload());
      } catch {
        return () => {};
      }
    });
    return () => {
      window.removeEventListener(TIMER_CHANGED, reload);
      window.removeEventListener(TASKS_CHANGED, reload);
      unsubs.forEach((u) => typeof u === "function" && u());
    };
  }, [load]);
  return state;
}

const H3 = ({ children, right }) => (
  <div className="mb-4 flex items-center justify-between gap-2">
    <h3 className="mono-label flex items-center gap-2 text-[10px] text-ink/60"><span className="h-3 w-[3px] rounded-full flame-bg" />{children}</h3>
    {right}
  </div>
);

const ChartPanel = ({ children, className = "" }) => (
  <div className={`card-hover relative overflow-hidden rounded-md border border-hair bg-card p-5 ${className}`}>{children}</div>
);

// Horizontal bar breakdown (count + share). Each row keeps its own semantic colour.
function Bars({ rows, total }) {
  const data = rows.map((s) => ({ ...s, pct: total ? Math.round((s.count / total) * 100) : 0 }));
  return (
    <div style={{ height: Math.max(80, data.length * 34) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide domain={[0, Math.max(1, ...data.map((d) => d.count))]} />
          <YAxis type="category" dataKey="label" width={96} {...axisProps()} tick={{ ...axisProps().tick, fontFamily: "inherit", fontSize: 11.5 }} />
          <Tooltip content={<ChartTooltip format={(v, n, p) => `${v} (${p.payload.pct}%)`} />} cursor={barCursor()} />
          <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]} background={{ fill: "rgba(26,26,26,0.04)", radius: 4 }} label={{ position: "right", fill: "rgba(26,26,26,0.6)", fontSize: 11, formatter: (v) => v }}>
            {data.map((d) => <Cell key={d.label} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const Loading = () => (
  <div className="flex justify-center py-20">
    <Loader2 className="w-6 h-6 text-ink/[0.38] animate-spin" />
  </div>
);

// ─── TASK OUTPUT ─────────────────────────────────────────────────────────────
function TasksAnalytics({ data }) {
  const m = useMemo(() => {
    const { tasks, entries } = data;
    const now = Date.now();
    const open = tasks.filter((t) => OPEN_STATUSES.includes(t.status || "inbox"));
    const done = tasks.filter((t) => t.status === "done");
    const doneAt = (t) => new Date(t.completed_at || t.updated_date || t.created_date);
    const weekStart = startOfWeek(new Date());
    const doneThisWeek = done.filter((t) => doneAt(t) >= weekStart).length;
    const lastWeekStart = new Date(weekStart.getTime() - 7 * DAY);
    const doneLastWeek = done.filter((t) => doneAt(t) >= lastWeekStart && doneAt(t) < weekStart).length;
    const done30 = done.filter((t) => now - doneAt(t).getTime() <= 30 * DAY).length;
    const overdue = open.filter((t) => t.due_date && new Date(t.due_date).getTime() < now - DAY).length;

    const days = last30();
    const byDay = Object.fromEntries(days.map((d) => [d.key, d]));
    done.forEach((t) => {
      const k = dayKey(doneAt(t));
      if (byDay[k] && now - doneAt(t).getTime() <= 30 * DAY) byDay[k].completed += 1;
    });

    const weeks = last8Weeks();
    entries.forEach((e) => {
      const i = weekIndex(weeks, new Date(e.ended_at || e.created_date));
      if (i >= 0) weeks[i].hours += (Number(e.seconds) || 0) / 3600;
    });
    // A clock that's running right now counts toward this week too.
    const running = tasks.filter((t) => t.timer_started_at);
    running.forEach((t) => {
      weeks[weeks.length - 1].hours += (totalSeconds(t) - (Number(t.logged_seconds) || 0)) / 3600;
    });
    weeks.forEach((w) => (w.hours = Math.round(w.hours * 10) / 10));
    const hours30 = entries.filter((e) => now - new Date(e.ended_at || e.created_date).getTime() <= 30 * DAY).reduce((s, e) => s + (Number(e.seconds) || 0) / 3600, 0);
    const hoursPrev30 = entries.filter((e) => { const a = now - new Date(e.ended_at || e.created_date).getTime(); return a > 30 * DAY && a <= 60 * DAY; }).reduce((s, e) => s + (Number(e.seconds) || 0) / 3600, 0);

    const statusRows = TASK_STATUSES.map((s) => ({ label: s.label, color: s.color, count: tasks.filter((t) => (t.status || "inbox") === s.value).length }));
    const typeRows = TASK_TYPES.map((s) => ({ label: s.label, color: s.color, count: tasks.filter((t) => (t.task_type || "billable") === s.value).length })).filter((r) => r.count);

    const byClient = new Map();
    tasks.forEach((t) => {
      const k = t.client_name || "Interstellar (internal)";
      const r = byClient.get(k) || { name: k, open: 0, done: 0, hours: 0 };
      if (t.status === "done") r.done += 1;
      else r.open += 1;
      r.hours += totalSeconds(t) / 3600;
      byClient.set(k, r);
    });
    const clients = [...byClient.values()].sort((a, b) => b.open + b.done - (a.open + a.done)).slice(0, 10);

    return {
      total: tasks.length,
      open: open.length,
      done: done.length,
      doneThisWeek,
      doneLastWeek,
      done30,
      overdue,
      rate: tasks.length ? Math.round((done.length / tasks.length) * 100) : 0,
      days,
      weeks,
      hours30,
      hoursPrev30,
      statusRows,
      typeRows,
      clients,
      running: running.length,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiTile label="Open tasks" value={m.open} sub={`${m.total} total`} />
        <KpiTile accent label="Done this week" value={m.doneThisWeek} prev={m.doneLastWeek} sub="vs last week" />
        <KpiTile label="Completion rate" value={m.rate} format={(v) => `${v}%`} sub={`${m.done} done all-time`} />
        <KpiTile label="Hours clocked · 30d" value={m.hours30} display={fmtH(m.hours30)} prev={m.hoursPrev30 || undefined} sub={m.running ? `${m.running} clock running now` : "vs previous 30 days"} />
        <KpiTile label="Overdue" value={m.overdue} goodWhen="down" sub="open with a past due date" />
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <ChartPanel>
          <H3 right={<span className="font-mono text-[11px] text-ink/50">{m.done30} in 30 days</span>}>Tasks completed — last 30 days</H3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={m.days} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <FlameDefs id="out-done" />
              <CartesianGrid {...gridProps()} />
              <XAxis dataKey="day" {...axisProps()} interval={6} />
              <YAxis allowDecimals={false} {...axisProps()} width={40} />
              <Tooltip content={<ChartTooltip />} cursor={cursorProps()} />
              <Area type="monotone" dataKey="completed" name="Completed" stroke="#ff3c00" fill="url(#out-done-area)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#ff3c00", stroke: "#fff", strokeWidth: 1.5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel>
          <H3 right={<span className="font-mono text-[11px] text-ink/50">{fmtH(m.weeks.reduce((s, w) => s + w.hours, 0))} in 8 weeks</span>}>Hours clocked — weekly</H3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={m.weeks} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <FlameDefs id="out-hours" />
              <CartesianGrid {...gridProps()} />
              <XAxis dataKey="week" {...axisProps()} />
              <YAxis {...axisProps()} width={40} />
              <Tooltip content={<ChartTooltip format={(v) => `${v}h`} />} cursor={barCursor()} />
              <Bar dataKey="hours" name="Hours" fill="url(#out-hours-bar)" radius={[5, 5, 0, 0]} maxBarSize={42} />
            </BarChart>
          </ResponsiveContainer>
          {!m.weeks.some((w) => w.hours) && (
            <p className="text-ink/[0.45] text-[11px] text-center mt-2">Start the clock on a task (Tasks or a project) and the hours show up here and in Time Intelligence.</p>
          )}
        </ChartPanel>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <ChartPanel>
          <H3>Status</H3>
          <Bars rows={m.statusRows} total={m.total} />
        </ChartPanel>
        <ChartPanel>
          <H3>Billable vs internal</H3>
          {m.typeRows.length ? <Bars rows={m.typeRows} total={m.total} /> : <p className="text-xs text-ink/50">No tasks yet.</p>}
        </ChartPanel>
        <ChartPanel>
          <H3>By client</H3>
          {m.clients.length ? (
            <div style={{ height: Math.max(90, m.clients.length * 30) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.clients.map((c) => ({ ...c, label: c.name.length > 18 ? `${c.name.slice(0, 17)}…` : c.name, hoursLabel: fmtH(c.hours) }))} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barCategoryGap={7}>
                  <FlameDefs id="out-client" vertical={false} />
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={110} {...axisProps()} tick={{ ...axisProps().tick, fontFamily: "inherit", fontSize: 11 }} />
                  <Tooltip
                    content={<ChartTooltip labelFormat={(l, p) => `${p?.[0]?.payload?.name || l}${p?.[0]?.payload?.hours >= 0.1 ? ` · ${p[0].payload.hoursLabel}` : ""}`} />}
                    cursor={barCursor()}
                  />
                  <Bar dataKey="done" name="Done" stackId="c" fill="url(#out-client-bar)" />
                  <Bar dataKey="open" name="Open" stackId="c" fill="rgba(26,26,26,0.18)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-ink/50">No tasks yet.</p>
          )}
          {m.clients.length > 0 && (
            <p className="mt-2 flex items-center gap-3 text-[10.5px] text-ink/50">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm flame-bg" />Done</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-ink/20" />Open</span>
            </p>
          )}
        </ChartPanel>
      </div>
    </div>
  );
}

// ─── PROJECT OUTPUT ──────────────────────────────────────────────────────────
const ACTIVE_PROJECT = ["planning", "in_progress", "review"];
const SHIPPED_PROJECT = ["launched", "done"];

function ProjectsAnalytics({ data }) {
  const m = useMemo(() => {
    const { tasks, projects, entries } = data;
    const now = Date.now();
    const per = new Map(projects.map((p) => [p.id, { total: 0, done: 0, sec: 0, estMin: 0 }]));
    tasks.forEach((t) => {
      const r = t.project_id && per.get(t.project_id);
      if (!r) return;
      r.total += 1;
      if (t.status === "done") r.done += 1;
      r.sec += totalSeconds(t);
      r.estMin += Number(t.estimated_minutes) || (Number(t.estimated_hours) || 0) * 60;
    });
    const rows = projects.map((p) => {
      const r = per.get(p.id);
      const progress = r.total ? Math.round((r.done / r.total) * 100) : Number(p.progress) || 0;
      const logged = Math.max(r.sec / 3600, Number(p.logged_hours) || 0);
      const est = Number(p.estimated_hours) || r.estMin / 60;
      const overdue = p.due_date && !SHIPPED_PROJECT.includes(p.status) && new Date(p.due_date).getTime() < now - DAY;
      return { ...p, progress, logged, est, tasksTotal: r.total, tasksDone: r.done, overdue };
    });
    const active = rows.filter((p) => ACTIVE_PROJECT.includes(p.status));
    const shipped = rows.filter((p) => SHIPPED_PROJECT.includes(p.status));
    const onHold = rows.filter((p) => p.status === "on_hold");
    const avgProgress = active.length ? Math.round(active.reduce((s, p) => s + p.progress, 0) / active.length) : 0;
    const logged = rows.reduce((s, p) => s + p.logged, 0);
    const est = rows.reduce((s, p) => s + p.est, 0);
    const statusRows = PROJECT_STATUSES.map((s) => ({ label: s.label, color: s.color || "#ff3c00", count: rows.filter((p) => p.status === s.value).length })).filter((r) => r.count);
    const typeRows = PROJECT_TYPES.map((s) => ({ label: s.label, color: s.color || "#ff3c00", count: rows.filter((p) => p.type === s.value).length })).filter((r) => r.count);
    const noTasks = active.filter((p) => !p.tasksTotal).length;
    const entriesNoProject = entries.filter((e) => !e.project_id).length;
    return { rows, active, shipped, onHold, avgProgress, logged, est, statusRows, typeRows, noTasks, entriesNoProject, overdue: rows.filter((p) => p.overdue).length };
  }, [data]);

  const list = [...m.rows].sort((a, b) => (ACTIVE_PROJECT.includes(b.status) ? 1 : 0) - (ACTIVE_PROJECT.includes(a.status) ? 1 : 0) || b.progress - a.progress);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiTile accent label="Active projects" value={m.active.length} sub={`${m.rows.length} total`} />
        <KpiTile label="Launched / done" value={m.shipped.length} />
        <KpiTile label="Avg progress (active)" value={m.avgProgress} format={(v) => `${v}%`} sub="done tasks ÷ all tasks" />
        <KpiTile label="Hours clocked" value={m.logged} display={fmtH(m.logged)} sub={m.est ? `of ${fmtH(m.est)} estimated` : "no estimates yet"} />
        <KpiTile label="Overdue" value={m.overdue} goodWhen="down" sub={`${m.onHold.length} on hold`} />
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <ChartPanel>
          <H3>Status</H3>
          {m.statusRows.length ? <Bars rows={m.statusRows} total={m.rows.length} /> : <p className="text-xs text-ink/50">No projects yet.</p>}
        </ChartPanel>
        <ChartPanel>
          <H3>By package type</H3>
          {m.typeRows.length ? <Bars rows={m.typeRows} total={m.rows.length} /> : <p className="text-xs text-ink/50">No projects yet.</p>}
        </ChartPanel>
      </div>

      <div className="overflow-x-auto rounded-md border border-hair bg-card p-0">
        <div className="p-5 pb-3">
          <H3>Every project</H3>
          {m.noTasks > 0 && <p className="text-[11px] text-ink/55 -mt-2">{m.noTasks} active project(s) have no tasks yet, so their progress can&apos;t move. Add tasks or run an SOP on them.</p>}
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-ink/45 border-b border-ink/10">
              <th className="px-5 py-2 font-medium">Project</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium w-40">Progress</th>
              <th className="px-3 py-2 font-medium">Tasks</th>
              <th className="px-3 py-2 font-medium">Hours</th>
              <th className="px-5 py-2 font-medium">Due</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const st = PROJECT_STATUSES.find((s) => s.value === p.status);
              return (
                <tr key={p.id} className="border-b border-ink/[0.06] hover:bg-ink/[0.02]">
                  <td className="px-5 py-2.5">
                    <Link to={`/projects/${p.id}`} className="text-ink/85 hover:text-[#ff3c00] font-medium">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-ink/60">{p.client_name || "Internal"}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-ink/70">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: st?.color || "#8a8580" }} />
                      {st?.label || p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-ink/[0.07] rounded-full overflow-hidden">
                        <div className="h-full flame-bg rounded-full" style={{ width: `${p.progress}%` }} />
                      </div>
                      <span className="text-ink/60 w-8 text-right">{p.progress}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-ink/60">
                    {p.tasksDone}/{p.tasksTotal}
                  </td>
                  <td className={`px-3 py-2.5 ${p.est && p.logged > p.est ? "text-[#ff3c00] font-semibold" : "text-ink/60"}`}>
                    {p.logged >= 0.05 ? fmtH(p.logged) : "—"}
                    {p.est ? <span className="text-ink/40"> / {fmtH(p.est)}</span> : null}
                  </td>
                  <td className={`px-5 py-2.5 ${p.overdue ? "text-red-600 font-semibold" : "text-ink/60"}`}>{p.due_date ? new Date(p.due_date).toLocaleDateString() : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!list.length && <p className="px-5 py-6 text-xs text-ink/50">No projects yet. Start one from a package or the Projects page.</p>}
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function OutputAnalytics() {
  const data = useOutputData();
  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Agency / Output" rightText="Real-Time Performance" />
      <div className="px-5 md:px-8 py-6">
        <Tabs defaultValue="time" className="w-full">
          <TabsList className="bg-card border border-ink/[0.13] mb-6">
            <TabsTrigger value="time" className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-500 text-ink/[0.58] gap-2">
              <Clock className="w-3.5 h-3.5" /> Time Intelligence
            </TabsTrigger>
            <TabsTrigger value="tasks" className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-500 text-ink/[0.58] gap-2">
              <BarChart3 className="w-3.5 h-3.5" /> Task Output
            </TabsTrigger>
            <TabsTrigger value="projects" className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-500 text-ink/[0.58] gap-2">
              <Activity className="w-3.5 h-3.5" /> Project Output
            </TabsTrigger>
          </TabsList>
          <TabsContent value="time">
            <TimeIntelligence />
          </TabsContent>
          <TabsContent value="tasks">{data.loading ? <Loading /> : <TasksAnalytics data={data} />}</TabsContent>
          <TabsContent value="projects">{data.loading ? <Loading /> : <ProjectsAnalytics data={data} />}</TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
