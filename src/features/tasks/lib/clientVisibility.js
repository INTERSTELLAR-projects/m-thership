// "Show to client": a client's tasks appear as to-dos in their portal. Default ON for client-facing work, OFF for
// internal tasks (no client, task type internal/personal, or money/admin chores). Justin can flip it per task.
const INTERNAL_TYPES = new Set(["internal", "personal"]);
const INTERNAL_CATEGORIES = new Set(["finance", "admin", "sales"]);

export function defaultPortalVisible(task) {
  const t = task || {};
  if (!t.client_id) return false;
  if (INTERNAL_TYPES.has(t.task_type)) return false;
  if (INTERNAL_CATEGORIES.has(t.category)) return false;
  return true;
}

// The value to save: an explicit choice wins, otherwise the default.
export const resolvePortalVisible = (task) => (typeof (task && task.portal_visible) === "boolean" ? task.portal_visible : defaultPortalVisible(task));

// Portal to-dos, split three ways: needed from the client, being worked on, up next. Open tasks only, by due date.
export function groupTodos(items = []) {
  const open = (Array.isArray(items) ? items : []).filter((t) => t && t.status !== "done");
  const byDue = (a, b) => String(a.due_date || "9999").localeCompare(String(b.due_date || "9999"));
  return {
    needs: open.filter((t) => t.client_action).sort(byDue),
    doing: open.filter((t) => !t.client_action && t.status === "doing").sort(byDue),
    next: open.filter((t) => !t.client_action && t.status !== "doing").sort(byDue),
  };
}
