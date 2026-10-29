import React from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Target } from "lucide-react";
import { projectStatusMeta, projectTypeMeta } from "@/features/tasks/lib/constants";
import { money, percent, shortDate } from "@/features/tasks/lib/format";

export default function ProjectCard({ project, done = 0, total = 0, clientName }) {
  const type = projectTypeMeta(project.type);
  const status = projectStatusMeta(project.status);
  const progress = percent(done, total);

  return (
    <Link to={"/projects/" + project.id} className="card-hover group relative block overflow-hidden rounded-md border border-hair bg-card p-4">
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="mono-label flex items-center gap-1.5 text-[9px] text-ink/55">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: type.color }} />
            {type.label}
          </p>
          <h3 className="mt-1 truncate text-[16px] font-semibold tracking-[-0.02em] text-ink">{project.title}</h3>
          <p className="truncate text-[11.5px] text-ink/50">{clientName || project.client_name || "Internal"}</p>
        </div>
        <span
          className="mono-label shrink-0 rounded-sm border px-2 py-[3px] text-[9px]"
          style={{ borderColor: status.color + "40", color: status.color, background: status.color + "10" }}
        >
          {status.label}
        </span>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="mono-label text-[9px] text-ink/40">Value</p>
          <p className="text-[18px] font-semibold tracking-[-0.03em] text-ink">{money(project.contract_value)}</p>
        </div>
        <div>
          <p className="mono-label text-[9px] text-ink/40">Time</p>
          <p className="text-[18px] font-semibold tracking-[-0.03em] text-ink">
            {Math.round(Number(project.logged_hours) || 0)}
            <span className="text-[12px] text-ink/40">/{Math.round(Number(project.estimated_hours) || 0)}h</span>
          </p>
        </div>
      </div>

      <div className="relative mt-4">
        <div className="flex items-center justify-between">
          <p className="mono-label text-[9px] text-ink/40">
            {done}/{total} tasks
          </p>
          <p className="text-[11px] text-ink/55">{progress}%</p>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink/[0.07]">
          <div className="flame-bg h-full rounded-full transition-all duration-700" style={{ width: progress + "%" }} />
        </div>
      </div>

      <div className="relative mt-3 flex items-center justify-between text-[11px] text-ink/45">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-3 w-3" />
          {shortDate(project.due_date)}
        </span>
        {project.is_focus ? (
          <span className="flex items-center gap-1 text-[#ff3c00]">
            <Target className="h-3 w-3" />
            focus
          </span>
        ) : null}
      </div>
    </Link>
  );
}
