// Task Matrix: the priority ladder (Focus now, Next up, Blocked, Done today), the status board and swimlanes.
// Pure helpers over Task records; nothing here invents work.
import { daysUntil } from "./format";
import { categoryMeta } from "./constants";

export const BOARD = [
  { value: "inbox", label: "Inbox" },
  { value: "next", label: "Next up" },
  { value: "doing", label: "In flight" },
  { value: "blocked", label: "Blocked" },
];

const isOverdue = (t) => { const n = daysUntil(t.due_date); return n !== null && n < 0; };

// Most important first: focus flag, priority, overdue, due soonest (no date last).
export function rank(a, b) {
  const fa = a.is_focus ? 0 : 1;
  const fb = b.is_focus ? 0 : 1;
  if (fa !== fb) return fa - fb;
  const pa = Number(a.priority) || 3;
  const pb = Number(b.priority) || 3;
  if (pa !== pb) return pa - pb;
  const oa = isOverdue(a) ? 0 : 1;
  const ob = isOverdue(b) ? 0 : 1;
  if (oa !== ob) return oa - ob;
  const da = daysUntil(a.due_date);
  const db = daysUntil(b.due_date);
  if (da === db) return String(a.title || "").localeCompare(String(b.title || ""));
  if (da === null) return 1;
  if (db === null) return -1;
  return da - db;
}

const sameDay = (iso, now) => {
  if (!iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.toDateString() === now.toDateString();
};

// Who owns it and which agent (if any) is working it. Only what the record says.
export const ownerOf = (t) => t.owner_name || t.assignee_name || t.assigned_to || t.owner || "";
export const agentOf = (t) => t.agent_name || (t.source === "ai" ? "Claude" : t.source === "automation" ? "Automation" : t.source === "sop" ? "SOP" : "");
export const blockedReason = (t) => {
  const r = t.blocked_reason || t.blocker || "";
  if (r) return String(r);
  const note = String(t.notes || "").split("\n").map((s) => s.trim()).find(Boolean);
  return note || "No reason written down yet";
};

const isOpen = (t) => t && t.status !== "done";

export function ladder(open, done = [], { now = new Date(), size = 5 } = {}) {
  const sorted = open.filter(isOpen).sort(rank);
  const active = sorted.filter((t) => t.status !== "blocked");
  const focus = [...active.filter((t) => t.is_focus || t.status === "doing"), ...active.filter((t) => !t.is_focus && t.status !== "doing")].slice(0, size);
  const used = new Set(focus.map((t) => t.id));
  const next = sorted.filter((t) => !used.has(t.id) && (t.status === "next" || t.status === "inbox")).slice(0, size);
  const blocked = sorted.filter((t) => t.status === "blocked").slice(0, size);
  const doneToday = done.filter((t) => sameDay(t.completed_at || t.updated_date, now))
    .sort((a, b) => String(b.completed_at || "").localeCompare(String(a.completed_at || "")));
  return { focus, next, blocked, doneToday, counts: { blocked: sorted.filter((t) => t.status === "blocked").length, next: sorted.filter((t) => t.status === "next").length } };
}

export function board(open) {
  const by = Object.fromEntries(BOARD.map((s) => [s.value, []]));
  open.filter(isOpen).forEach((t) => { (by[t.status] || by.inbox).push(t); });
  Object.values(by).forEach((l) => l.sort(rank));
  return by;
}

// Swimlanes: one row per client (or per department), a count per status and the top task in each.
export function lanes(open, by = "client") {
  const m = new Map();
  open.filter(isOpen).forEach((t) => {
    const key = by === "department" ? t.category || "ops" : t.client_id || (t.client_name && t.client_name !== "Interstellar" ? `name:${t.client_name}` : "interstellar");
    const label = by === "department" ? categoryMeta(t.category).label : t.client_name || "Interstellar";
    if (!m.has(key)) m.set(key, { key, label, total: 0, hot: 0, cells: Object.fromEntries(BOARD.map((s) => [s.value, []])) });
    const row = m.get(key);
    row.total += 1;
    if (isOverdue(t) || Number(t.priority) <= 1 || t.status === "blocked") row.hot += 1;
    (row.cells[t.status] || row.cells.inbox).push(t);
  });
  const rows = [...m.values()];
  rows.forEach((r) => Object.values(r.cells).forEach((l) => l.sort(rank)));
  return rows.sort((a, b) => b.hot - a.hot || b.total - a.total || a.label.localeCompare(b.label));
}
