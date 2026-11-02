import { base44 } from "@/api/base44Client";
import { TASKS_CHANGED } from "@/features/tasks/lib/clients";
import { itemMinutes } from "@/features/tasks/lib/estimate";

export const TIMER_CHANGED = "mothership:timer-changed";
const announce = (detail) => {
  try {
    window.dispatchEvent(new CustomEvent(TIMER_CHANGED, { detail }));
    window.dispatchEvent(new CustomEvent(TASKS_CHANGED));
  } catch {}
};

// Seconds the running timer has accrued so far (0 when stopped).
export const runningSeconds = (task, now = Date.now()) =>
  task && task.timer_started_at ? Math.max(0, Math.floor((now - new Date(task.timer_started_at).getTime()) / 1000)) : 0;

// Everything logged on the task, including the run in progress.
export const totalSeconds = (task, now = Date.now()) => (Number(task && task.logged_seconds) || 0) + runningSeconds(task, now);

export async function runningTimers() {
  try {
    const page = await base44.entities.Task.filter({ timer_started_at: { $ne: null } }, { limit: 10 });
    const rows = Array.isArray(page) ? page : (page && page.items) || [];
    return rows.filter((t) => t.timer_started_at);
  } catch {
    return [];
  }
}

// Close out one run: write a TimeEntry, roll the seconds into the task and its project.
async function closeRun(task, endedAt = new Date()) {
  if (!task.timer_started_at) return task;
  const started = new Date(task.timer_started_at);
  const seconds = Math.max(0, Math.floor((endedAt.getTime() - started.getTime()) / 1000));
  const logged_seconds = (Number(task.logged_seconds) || 0) + seconds;
  const patch = {
    timer_started_at: null,
    logged_seconds,
    logged_hours: Math.round((logged_seconds / 3600) * 100) / 100,
    status: task.status === "doing" ? "next" : task.status
  };
  if (seconds >= 15) {
    await base44.entities.TimeEntry.create({
      task_id: task.id,
      task_title: task.title,
      category: task.category || "ops",
      project_id: task.project_id || null,
      project_name: task.project_name || null,
      project_type: task.project_type || null,
      client_id: task.client_id || null,
      client_name: task.client_name || null,
      sop_name: task.sop_name || null,
      sop_step: task.sop_step || null,
      started_at: started.toISOString(),
      ended_at: endedAt.toISOString(),
      seconds,
      estimated_minutes: itemMinutes(task)
    });
    if (task.project_id) {
      base44.entities.Project.get(task.project_id)
        .then((p) => p && base44.entities.Project.update(p.id, { logged_hours: Math.round(((Number(p.logged_hours) || 0) + seconds / 3600) * 100) / 100 }))
        .catch(() => {});
    }
  }
  await base44.entities.Task.update(task.id, patch);
  return { ...task, ...patch };
}

// Start timing a task. Any other running timer is stopped first so the clock is never double-counted.
export async function startTimer(task) {
  const others = (await runningTimers()).filter((t) => t.id !== task.id);
  for (const other of others) await closeRun(other);
  const patch = { timer_started_at: new Date().toISOString(), status: task.status === "done" ? "done" : "doing" };
  if (!task.project_type && task.project_id) {
    try {
      const p = await base44.entities.Project.get(task.project_id);
      if (p && p.type) patch.project_type = p.type;
    } catch {}
  }
  await base44.entities.Task.update(task.id, patch);
  const next = { ...task, ...patch };
  announce({ running: next, stopped: others.map((o) => o.id) });
  return next;
}

export async function stopTimer(task) {
  const next = await closeRun(task);
  announce({ running: null, stopped: [task.id] });
  return next;
}

// Call before marking a task done (or deleting it): if its clock is running, the run is
// closed out first so the time lands in TimeEntry, the task and its project instead of
// being lost. Reads the task fresh, because list rows can be stale.
export async function settleTimer(taskOrId) {
  try {
    const id = typeof taskOrId === "string" ? taskOrId : taskOrId && taskOrId.id;
    if (!id) return null;
    const fresh = await base44.entities.Task.get(id);
    if (!fresh || !fresh.timer_started_at) return fresh;
    const next = await closeRun(fresh);
    announce({ running: null, stopped: [id] });
    return next;
  } catch {
    return null;
  }
}
