import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Circle, Sparkles, FolderKanban, Timer, Loader2, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { settleTimer, runningTimers, runningSeconds, TIMER_CHANGED } from "@/features/tasks/lib/timer";
import { TASKS_CHANGED } from "@/features/tasks/lib/clients";
import { OPEN_STATUSES } from "@/features/tasks/lib/constants";
import { fmtDate, timeAgo } from "@/lib/useData";
import { Tile, TileEmpty, TileLoading, TileError, Bar, asArray, todayKey } from "./shell";

const DAY = 86400000;
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / DAY);

// Refetch task-engine queries whenever a clock starts/stops or tasks change elsewhere.
function useTaskEvents(keys) {
  const qc = useQueryClient();
  useEffect(() => {
    const fire = () => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    window.addEventListener(TIMER_CHANGED, fire);
    window.addEventListener(TASKS_CHANGED, fire);
    return () => {
      window.removeEventListener(TIMER_CHANGED, fire);
      window.removeEventListener(TASKS_CHANGED, fire);
    };
  }, [qc, keys]);
}

/* ─── Today: due today + overdue, every client ─────────────────────────── */
const TASK_KEYS = ["Task"];
export function TodayWidget() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(null);
  useTaskEvents(TASK_KEYS);
  const today = todayKey();
  const q = useQuery({
    queryKey: ["Task", "mission-today", today],
    queryFn: async () => {
      const rows = asArray(await base44.entities.Task.filter({ status: { $in: OPEN_STATUSES } }, "due_date", 500));
      return rows.filter((t) => t.due_date && t.due_date.slice(0, 10) <= today).sort((a, b) => a.due_date.localeCompare(b.due_date) || (a.priority || 3) - (b.priority || 3));
    },
  });
  const rows = q.data || [];
  const overdue = rows.filter((t) => t.due_date.slice(0, 10) < today).length;

  const complete = async (task) => {
    setBusy(task.id);
    try {
      await settleTimer(task);
      await base44.entities.Task.update(task.id, { status: "done", completed_at: new Date().toISOString(), is_focus: false });
      qc.invalidateQueries({ queryKey: ["Task"] });
      qc.invalidateQueries({ queryKey: ["TimeEntry"] });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Tile kicker={overdue ? `${overdue} overdue` : "Due today"} title="Today" icon={CalendarCheck} to="/tasks" linkLabel="Matrix" stat={q.isLoading ? null : rows.length}>
      {q.isLoading ? <TileLoading /> : q.isError ? <TileError /> : rows.length === 0 ? (
        <TileEmpty>Nothing due today and nothing overdue. Clear runway — pull something from Next up.</TileEmpty>
      ) : (
        <ul className="divide-y divide-hair">
          {rows.slice(0, 12).map((t) => {
            const late = daysBetween(t.due_date.slice(0, 10), today);
            return (
              <li key={t.id} className="flex items-start gap-3 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => complete(t)}
                  disabled={busy === t.id}
                  title={t.timer_started_at ? "Complete (stops the running clock)" : "Mark done"}
                  className="mt-0.5 text-ink/35 transition-colors hover:text-[#ff3c00]"
                >
                  {busy === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Circle className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{t.title}</p>
                  <p className="truncate text-[11.5px] text-ink/55">
                    {t.client_id ? <Link to={`/clients/${t.client_id}?tab=tasks`} className="hover:text-[#ff3c00]">{t.client_name || "Client"}</Link> : t.client_name || "Interstellar"}
                    {t.project_name ? ` · ${t.project_name}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`mono-label text-[8.5px] ${late > 0 ? "text-[#ff3c00]" : "text-ink/45"}`}>{late > 0 ? `${late}d late` : "today"}</span>
                  {t.timer_started_at && <span className="mono-label inline-flex items-center gap-1 text-[8.5px] text-[#ff3c00]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff3c00]" />clock</span>}
                </div>
              </li>
            );
          })}
          {rows.length > 12 && <li className="px-4 py-2 text-[11px] text-ink/45"><Link to="/tasks" className="hover:text-[#ff3c00]">+{rows.length - 12} more on the matrix →</Link></li>}
        </ul>
      )}
    </Tile>
  );
}

/* ─── Claude Queue: waiting on Justin's OK ─────────────────────────────── */
export function ClaudeQueueWidget() {
  const q = useQuery({
    queryKey: ["ClaudeJob", "mission-queue"],
    queryFn: async () => {
      const [waiting, moving] = await Promise.all([
        base44.entities.ClaudeJob.filter({ status: "needs_approval" }, "-finished_at", 25),
        base44.entities.ClaudeJob.filter({ status: { $in: ["queued", "running", "changes_requested"] } }, "-created_date", 50),
      ]);
      return { waiting: asArray(waiting), moving: asArray(moving) };
    },
    refetchInterval: 60000,
  });
  const waiting = q.data?.waiting || [];
  const moving = q.data?.moving || [];
  const running = moving.filter((j) => j.status === "running").length;
  return (
    <Tile kicker={`${running} running · ${moving.length - running} queued`} title="Claude queue" icon={Sparkles} to="/claude" linkLabel="Queue" stat={q.isLoading ? null : waiting.length}>
      {q.isLoading ? <TileLoading /> : q.isError ? <TileError /> : waiting.length === 0 ? (
        <TileEmpty>Nothing waiting on your OK. Finished Claude work lands here for approval.</TileEmpty>
      ) : (
        <ul className="divide-y divide-hair">
          {waiting.slice(0, 8).map((j) => (
            <li key={j.id}>
              <Link to={`/claude?job=${j.id}`} className="block px-4 py-2.5 hover:bg-ink/[0.03]">
                <div className="flex items-center gap-2">
                  <span className="mono-label bg-[#ff3c00] px-1.5 py-0.5 text-[8.5px] text-white">Review</span>
                  <span className="mono-label text-[8.5px] text-ink/45">{j.kind?.replace("_", " ")}{j.stage > 1 ? ` · stage ${j.stage}` : ""}</span>
                  <span className="ml-auto font-mono text-[10px] text-ink/40">{timeAgo(j.finished_at || j.updated_date)}</span>
                </div>
                <p className="mt-1 truncate text-[13px] font-medium">{j.title}</p>
                <p className="truncate text-[11.5px] text-ink/55">{j.client_name || "Interstellar"}{j.result_summary ? ` · ${j.result_summary}` : ""}</p>
                {j.needs_from_justin && (
                  <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-[#ff3c00]"><AlertTriangle className="h-3 w-3 shrink-0" />{j.needs_from_justin}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}

/* ─── Projects in flight ───────────────────────────────────────────────── */
const ACTIVE_PROJECT = ["planning", "in_progress", "review"];
const PROJECT_KEYS = ["Project", "Task"];
export function ProjectsWidget() {
  const q = useQuery({
    queryKey: ["Project", "mission-flight"],
    queryFn: async () => {
      const projects = asArray(await base44.entities.Project.filter({ status: { $in: ACTIVE_PROJECT } }, "due_date", 60));
      const ids = projects.map((p) => p.id);
      const tasks = ids.length ? asArray(await base44.entities.Task.filter({ project_id: { $in: ids } }, "-updated_date", 3000)) : [];
      const counts = {};
      tasks.forEach((t) => {
        const c = (counts[t.project_id] ||= { done: 0, total: 0 });
        c.total += 1;
        if (t.status === "done") c.done += 1;
      });
      return projects
        .map((p) => ({ ...p, done: counts[p.id]?.done || 0, total: counts[p.id]?.total || 0 }))
        .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
    },
  });
  useTaskEvents(PROJECT_KEYS);
  const today = todayKey();
  const rows = q.data || [];
  return (
    <Tile kicker="Planning · building · review" title="Projects in flight" icon={FolderKanban} to="/projects" linkLabel="Projects" stat={q.isLoading ? null : rows.length}>
      {q.isLoading ? <TileLoading /> : q.isError ? <TileError /> : rows.length === 0 ? (
        <TileEmpty>No projects in flight. Start a service from the catalog and its SOP project shows up here.</TileEmpty>
      ) : (
        <ul className="divide-y divide-hair">
          {rows.slice(0, 8).map((p) => {
            const late = p.due_date && p.due_date.slice(0, 10) < today;
            const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
            return (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`} className="block px-4 py-2.5 hover:bg-ink/[0.03]">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[13px] font-medium">{p.title}</p>
                    <span className={`shrink-0 font-mono text-[10.5px] ${late ? "text-[#ff3c00]" : "text-ink/45"}`}>{p.due_date ? `${late ? "was due " : "due "}${fmtDate(p.due_date)}` : "no date"}</span>
                  </div>
                  <p className="mb-1.5 truncate text-[11.5px] text-ink/55">{p.client_name || "Interstellar"} · {p.status.replace("_", " ")}</p>
                  <div className="flex items-center gap-2">
                    <Bar value={p.done} max={p.total || 1} />
                    <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-ink/55">{p.total ? `${p.done}/${p.total} · ${pct}%` : "no tasks"}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Tile>
  );
}

/* ─── Time this week ───────────────────────────────────────────────────── */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};
const fmtClock = (s) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const TIME_KEYS = ["TimeEntry", "Task"];

export function TimeWeekWidget() {
  useTaskEvents(TIME_KEYS);
  const start = weekStart();
  const q = useQuery({
    queryKey: ["TimeEntry", "mission-week", start.toISOString()],
    queryFn: async () => {
      const [entries, running] = await Promise.all([base44.entities.TimeEntry.list("-started_at", 600), runningTimers()]);
      return { entries: asArray(entries).filter((e) => e.started_at && new Date(e.started_at) >= start), running };
    },
  });
  const run = q.data?.running?.[0] || null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!run) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [run]);

  const { byDay, total, topClients } = useMemo(() => {
    const days = DAYS.map(() => 0);
    const clients = {};
    (q.data?.entries || []).forEach((e) => {
      const i = (new Date(e.started_at).getDay() + 6) % 7;
      const s = Number(e.seconds) || 0;
      days[i] += s;
      const k = e.client_name || "Interstellar";
      clients[k] = (clients[k] || 0) + s;
    });
    const t = days.reduce((a, b) => a + b, 0);
    return { byDay: days, total: t, topClients: Object.entries(clients).sort((a, b) => b[1] - a[1]).slice(0, 3) };
  }, [q.data]);

  const live = run ? runningSeconds(run, now) : 0;
  const todayIdx = (new Date().getDay() + 6) % 7;
  const days = byDay.map((s, i) => s + (i === todayIdx ? live : 0));
  const max = Math.max(3600, ...days);
  const hours = (s) => (s / 3600).toFixed(1);

  return (
    <Tile kicker={`Week of ${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`} title="Time this week" icon={Timer} to="/output-analytics" linkLabel="Output" stat={q.isLoading ? null : `${hours(total + live)}h`}>
      {q.isLoading ? <TileLoading /> : q.isError ? <TileError /> : (
        <div className="flex h-full flex-col gap-4 px-4 py-3.5">
          {run ? (
            <Link to="/tasks" className="flex items-center gap-3 rounded-sm border border-[#ff3c00]/30 bg-[#ff3c00]/[0.05] px-3 py-2 hover:border-[#ff3c00]/60">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#ff3c00]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium">{run.title}</p>
                <p className="truncate text-[11px] text-ink/55">{run.client_name || "Interstellar"}</p>
              </div>
              <span className="font-mono text-[13px] tabular-nums text-[#ff3c00]">{fmtClock(live)}</span>
            </Link>
          ) : (
            <p className="mono-label text-[9px] text-ink/40">No clock running</p>
          )}
          {total + live === 0 ? (
            <TileEmpty>No time logged this week yet. Start a clock on any task and the hours stack up here by day.</TileEmpty>
          ) : (
            <>
              <div className="grid h-[96px] grid-cols-7 items-end gap-1.5">
                {days.map((s, i) => (
                  <div key={DAYS[i]} className="flex h-full flex-col items-center justify-end gap-1" title={`${DAYS[i]}: ${hours(s)}h`}>
                    <span className="font-mono text-[9px] tabular-nums text-ink/45">{s ? hours(s) : ""}</span>
                    <div
                      className="w-full rounded-t-[2px]"
                      style={{ height: `${Math.max(s ? 4 : 1, (s / max) * 70)}px`, background: i === todayIdx ? "linear-gradient(180deg,#ffaa00,#ff3c00)" : s ? "#1a1a1a" : "rgba(26,26,26,.1)" }}
                    />
                    <span className={`mono-label text-[8px] ${i === todayIdx ? "text-[#ff3c00]" : "text-ink/45"}`}>{DAYS[i]}</span>
                  </div>
                ))}
              </div>
              {topClients.length > 0 && (
                <div className="space-y-1 border-t border-hair pt-3">
                  {topClients.map(([name, s]) => (
                    <div key={name} className="flex items-center justify-between text-[11.5px]">
                      <span className="truncate text-ink/70">{name}</span>
                      <span className="font-mono tabular-nums text-ink/55">{hours(s)}h</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Tile>
  );
}

