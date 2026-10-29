import React from "react";
import { Check, CornerDownRight, Pencil, Plus } from "lucide-react";
import PriorityBadge from "@/features/tasks/ui-kit/PriorityBadge";
import EmptyState from "@/features/tasks/ui-kit/EmptyState";
import { categoryMeta } from "@/features/tasks/lib/constants";
import { dueLabel, dueTone, days } from "@/features/tasks/lib/format";
import { btnSmallFlame } from "@/features/tasks/lib/ui";
import { cn } from "@/lib/utils";

function Row({ task, onToggle, onEdit, onAddSubtask, child = false }) {
  const category = categoryMeta(task.category);
  return (
    <div className={cn("group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-[#ff3c00]/[0.035]", child && "pl-10")}>
      <button
        type="button"
        onClick={() => onToggle(task)}
        className={cn(
          "mt-0.5 grid shrink-0 place-items-center rounded-sm border transition-colors",
          task.status === "done" ? "border-green-700 bg-green-700 text-white" : "border-ink/25 text-transparent hover:border-[#ff3c00]"
        )}
        style={{ height: 18, width: 18 }}
        aria-label={task.status === "done" ? "Reopen task" : "Complete task"}
      >
        <Check className="h-3 w-3" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {child ? <CornerDownRight className="h-3 w-3 shrink-0 text-ink/30" /> : null}
          <p className={cn("truncate text-[13px]", task.status === "done" ? "text-ink/40 line-through" : "text-ink")}>{task.title}</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-ink/45">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: category.color }} />
            {category.label}
          </span>
          {task.estimated_days ? <span>est {days(task.estimated_days)}</span> : null}
          <span className={dueTone(task.due_date, task.status)}>{dueLabel(task.due_date, task.status)}</span>
          {task.source && task.source !== "manual" ? <span className="mono-label text-[8.5px] text-[#ff3c00]">{task.source}</span> : null}
        </div>
      </div>

      <PriorityBadge value={task.priority} compact />

      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button type="button" onClick={() => onAddSubtask(task)} className="rounded-sm p-1.5 text-ink/45 hover:text-ink" title="Add subtask">
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => onEdit(task)} className="rounded-sm p-1.5 text-ink/45 hover:text-ink" title="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function ProjectTaskList({ tasks = [], onToggle, onEdit, onAddSubtask, onAdd }) {
  const ids = new Set(tasks.map((task) => task.id));
  const roots = tasks.filter((task) => !task.parent_task_id || !ids.has(task.parent_task_id));
  const childrenOf = (id) => tasks.filter((task) => task.parent_task_id === id);

  if (!tasks.length) {
    return (
      <EmptyState
        title="No steps yet"
        hint="Run an SOP on this project, ask the core to draft one, or add the first task by hand."
        action={
          <button type="button" onClick={onAdd} className={btnSmallFlame}>
            <Plus className="h-3.5 w-3.5" />
            Add first task
          </button>
        }
      />
    );
  }

  return (
    <div className="divide-y divide-hair">
      {roots.map((task) => (
        <div key={task.id}>
          <Row task={task} onToggle={onToggle} onEdit={onEdit} onAddSubtask={onAddSubtask} />
          {childrenOf(task.id).map((child) => (
            <Row key={child.id} task={child} onToggle={onToggle} onEdit={onEdit} onAddSubtask={onAddSubtask} child />
          ))}
        </div>
      ))}
    </div>
  );
}
