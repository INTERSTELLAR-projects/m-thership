import React from "react";
import { Check, CornerDownRight, Eye, Pencil, Search, Trash2, Zap } from "lucide-react";
import PriorityBadge from "@/features/tasks/ui-kit/PriorityBadge";
import CategoryChip from "@/features/tasks/ui-kit/CategoryChip";
import TimerButton from "@/features/tasks/components/TimerButton";
import SendToClaudeButton from "@/features/claude/SendToClaudeButton";
import EmptyState from "@/features/tasks/ui-kit/EmptyState";
import { TASK_STATUSES } from "@/features/tasks/lib/constants";
import { dueLabel, dueTone } from "@/features/tasks/lib/format";
import { fmtMinutes, itemMinutes } from "@/features/tasks/lib/estimate";
import { cn } from "@/lib/utils";

const COLS = "lg:grid-cols-[28px_minmax(0,1fr)_150px_104px_64px_118px_92px_150px_120px]";

export default function TaskTable({ tasks = [], onEdit, onStatus, onFocus, onDelete, onPatch, onComplete, emptyHint }) {
  if (!tasks.length) {
    return <EmptyState icon={Search} title="Nothing in this slice" hint={emptyHint || "Adjust the filters or speak a new task into the core."} />;
  }

  return (
    <div className="overflow-hidden rounded-md border border-hair bg-card">
      <div className={cn("hidden items-center gap-3 border-b border-hair px-4 py-2.5 lg:grid", COLS)}>
        {["", "Task", "Project", "Category", "Priority", "Status", "Due", "Clock", ""].map((head, i) => (
          <p key={head + i} className="mono-label text-[9px] text-ink/40">
            {head}
          </p>
        ))}
      </div>

      <div className="divide-y divide-hair">
        {tasks.map((task) => {
          return (
            <div
              key={task.id}
              data-record-id={task.id}
              className={cn("group grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 px-4 py-3 transition-colors hover:bg-[#ff3c00]/[0.035] lg:items-center", COLS)}
            >
              <button
                type="button"
                onClick={() => onFocus && onFocus(task)}
                title={task.is_focus ? "Remove from Focus now" : "Push into Focus now"}
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-sm border transition-colors",
                  task.is_focus ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-hair text-ink/25 hover:border-[#ff3c00] hover:text-[#ff3c00]"
                )}
              >
                <Zap className="h-3 w-3" />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {onComplete && task.status !== "done" ? (
                    <button type="button" onClick={() => onComplete(task)} title="Complete in one click" aria-label={`Complete ${task.title}`}
                      className="grid h-4 w-4 shrink-0 place-items-center rounded-sm border border-ink/25 text-transparent transition-colors hover:border-green-700 hover:text-green-700"><Check className="h-2.5 w-2.5" /></button>
                  ) : null}
                  {task.parent_task_id ? <CornerDownRight className="h-3 w-3 shrink-0 text-ink/30" /> : null}
                  <p className={cn("truncate text-[13px]", task.status === "done" ? "text-ink/40 line-through" : "text-ink")}>{task.title}</p>
                  {task.portal_visible ? <span title="Shown to the client in their portal" className="shrink-0 text-ink/35"><Eye className="h-3 w-3" /></span> : null}
                  {task.client_action && task.status !== "done" ? <span className="shrink-0 rounded-sm bg-[#ff3c00]/10 px-1.5 py-[1px] text-[9.5px] font-medium text-[#c2410c]">Needs client</span> : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 lg:hidden">
                  <CategoryChip value={task.category} />
                  <PriorityBadge value={task.priority} compact />
                  <span className={cn("text-[10px]", dueTone(task.due_date, task.status))}>{dueLabel(task.due_date, task.status)}</span>
                  <TimerButton task={task} compact onChange={(patch) => onPatch && onPatch(task, patch)} />
                </div>
                {Array.isArray(task.labels) && task.labels.length ? (
                  <div className="mt-1 hidden flex-wrap gap-1.5 lg:flex">
                    {task.labels.slice(0, 3).map((label) => (
                      <span key={label} className="rounded-sm bg-ink/[0.05] px-1.5 py-[1px] text-[9.5px] text-ink/50">
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="col-start-2 min-w-0 lg:col-start-auto">
                <p className="truncate text-[11.5px] text-ink/70">{task.project_name || "Internal"}</p>
                <p className="truncate text-[10.5px] text-ink/40">{task.client_name || "No client"}</p>
              </div>

              <span className="hidden lg:flex">
                <CategoryChip value={task.category} />
              </span>

              <div className="hidden lg:block">
                <PriorityBadge value={task.priority} compact />
              </div>

              <div className="col-start-2 lg:col-start-auto">
                <select
                  value={task.status}
                  onChange={(e) => onStatus && onStatus(task, e.target.value)}
                  className="w-full rounded-sm border border-hair bg-canvas/60 px-2 py-1.5 text-[11px] text-ink outline-none focus:border-[#ff3c00]"
                >
                  {TASK_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="hidden flex-col lg:flex">
                <span className={cn("text-[11px]", dueTone(task.due_date, task.status))}>{dueLabel(task.due_date, task.status)}</span>
                {itemMinutes(task) ? <span className="text-[10px] text-ink/40">est {fmtMinutes(itemMinutes(task))}</span> : null}
              </div>

              <div className="hidden lg:block">
                <TimerButton task={task} onChange={(patch) => onPatch && onPatch(task, patch)} />
              </div>

              <div className="col-start-2 flex items-center gap-1 lg:col-start-auto lg:justify-end">
                <SendToClaudeButton task={task} compact />
                <span className="flex items-center gap-1 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100">
                <button type="button" onClick={() => onEdit && onEdit(task)} className="rounded-sm p-1.5 text-ink/45 transition-colors hover:text-ink" aria-label="Edit task">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onDelete && onDelete(task)} className="rounded-sm p-1.5 text-ink/45 transition-colors hover:text-red-600" aria-label="Delete task">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
