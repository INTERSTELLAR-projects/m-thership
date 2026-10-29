import React from "react";
import { Calendar, Repeat, Trash2, Zap } from "lucide-react";
import { categoryMeta } from "@/features/tasks/lib/constants";
import { cn } from "@/lib/utils";

const STATUS_STYLE = {
  suggested: { label: "Suggested", dot: "#b45309", text: "text-amber-700" },
  enabled: { label: "Enabled", dot: "#15803d", text: "text-green-700" },
  paused: { label: "Paused", dot: "#8a8580", text: "text-ink/45" }
};

export default function PatternRow({ pattern, onToggle, onCadence, onDelete }) {
  const meta = categoryMeta(pattern.category);
  const status = STATUS_STYLE[pattern.status] || STATUS_STYLE.suggested;

  return (
    <div className="card-hover rounded-md border border-hair bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color }} />
            <p className="truncate text-[13.5px] font-medium text-ink">{pattern.title}</p>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink/50">
            <span className="flex items-center gap-1">
              <Repeat className="h-3 w-3" />
              every {pattern.cadence_days}d
            </span>
            <span>seen × {pattern.occurrences}</span>
            {pattern.project_name ? <span className="truncate">{pattern.project_name}</span> : null}
            {pattern.client_name ? <span className="truncate">{pattern.client_name}</span> : null}
          </div>
        </div>
        <span className={cn("mono-label flex shrink-0 items-center gap-1.5 text-[9px]", status.text)}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.dot }} />
          {status.label}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onToggle(pattern)}
          className={cn(
            "rounded-sm border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
            pattern.status === "enabled" ? "border-green-700/30 bg-green-50 text-green-700" : "border-hair text-ink/60 hover:border-ink/40 hover:text-ink"
          )}
        >
          {pattern.status === "enabled" ? "Enabled" : pattern.status === "paused" ? "Resume" : "Enable"}
        </button>

        <label className="flex items-center gap-1.5 rounded-sm border border-hair px-2.5 py-1.5 text-[11px] text-ink/55">
          <Calendar className="h-3 w-3" />
          <input
            type="number"
            min="1"
            max="90"
            value={pattern.cadence_days}
            onChange={(event) => onCadence(pattern, Number(event.target.value))}
            className="w-10 bg-transparent text-ink focus:outline-none"
          />
          <span className="text-ink/40">d</span>
        </label>

        <button
          type="button"
          onClick={() => onDelete(pattern)}
          className="ml-auto rounded-sm border border-hair p-1.5 text-ink/40 transition-colors hover:border-red-600/40 hover:text-red-600"
          aria-label="Delete pattern"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {pattern.sample_titles && pattern.sample_titles.length > 1 ? (
        <p className="mt-2.5 text-[10.5px] leading-relaxed text-ink/40">
          <Zap className="mr-1 inline h-2.5 w-2.5 text-[#ff3c00]" />
          also seen as: {pattern.sample_titles.slice(1, 3).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
