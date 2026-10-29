import React from "react";
import { Check, Zap } from "lucide-react";
import PriorityBadge from "@/features/tasks/ui-kit/PriorityBadge";
import { dueLabel, dueTone } from "@/features/tasks/lib/format";
import { cn } from "@/lib/utils";

// Compact rail (Focus now / Next up) from the old Command Deck.
export default function TaskRail({ kicker, title, tasks = [], emptyHint, onComplete, onOpen }) {
  return (
    <section className="overflow-hidden rounded-md border border-hair bg-card">
      <header className="flex items-center justify-between border-b border-hair px-4 py-3">
        <div className="min-w-0">
          <p className="label-cross text-[10.5px] text-ink/60">({kicker})</p>
          <h3 className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-ink">{title}</h3>
        </div>
        <span className="mono-label text-[10px] text-ink/40">{tasks.length}</span>
      </header>

      <div className="p-3">
        {tasks.length ? (
          <ul className="space-y-1.5">
            {tasks.map((task) => (
              <li key={task.id} className="card-hover group flex items-center gap-3 rounded-sm border border-hair bg-canvas/50 px-3 py-2">
                <button
                  type="button"
                  onClick={() => onComplete && onComplete(task)}
                  title="Mark complete"
                  className="grid h-4 w-4 shrink-0 place-items-center rounded-sm border border-ink/25 text-transparent transition-colors hover:border-green-700 hover:text-green-700"
                >
                  <Check className="h-2.5 w-2.5" />
                </button>
                <button type="button" onClick={() => onOpen && onOpen(task)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[12.5px] text-ink">{task.title}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-ink/45">
                    <span className="truncate">{task.project_name || task.client_name || "Internal"}</span>
                    {task.is_focus ? (
                      <span className="flex items-center gap-1 text-[#ff3c00]">
                        <Zap className="h-2.5 w-2.5" />
                        focus
                      </span>
                    ) : null}
                  </div>
                </button>
                <span className={cn("hidden shrink-0 text-[10.5px] sm:inline", dueTone(task.due_date, task.status))}>{dueLabel(task.due_date, task.status)}</span>
                <PriorityBadge value={task.priority} compact />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 py-4 text-[12px] text-ink/45">{emptyHint}</p>
        )}
      </div>
    </section>
  );
}
