import { Pencil, CalendarDays, Clock } from "lucide-react";
import { TASK_STATUSES, STATUS_STYLES } from "@/lib/tasks";

export default function PriorityTaskCard({ item, glow, glowYellow, glowBlue, onEdit, setStatus }) {
  const currentStatus = item.status || "Pending";

  return (
    <div
      className={`card-hover bg-card rounded-xl p-3 flex items-start gap-3 group transition-all ${
        glow ? "border border-orange-500/40 shadow-orange-glow" : glowYellow ? "border border-yellow-400/40 shadow-[0_0_16px_rgba(250,204,21,0.25)]" : glowBlue ? "border border-blue-500/45 shadow-[0_0_16px_rgba(59,130,246,0.30)]" : "border border-white/[0.06]"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-relaxed text-white/80">{item.title}</p>

        {item.description && (
          <p className="text-white/30 text-[11px] mt-1 leading-relaxed">{item.description}</p>
        )}

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {item.taskType && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/15 text-white/55">
              {item.taskType}
            </span>
          )}
          {item.assignedTo && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400/80">
              {item.assignedTo}
            </span>
          )}
          {item.dueDate && (
            <span className="flex items-center gap-1 text-orange-500/50 text-[10px] font-medium">
              <CalendarDays className="w-3 h-3" />
              {new Date(item.dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
          {item.estimatedAmount && item.estimatedUnit && (
            <span className="flex items-center gap-1 text-white/30 text-[10px]">
              <Clock className="w-3 h-3" />{item.estimatedAmount} {item.estimatedUnit}
            </span>
          )}
        </div>

        <div className="flex gap-1 mt-2">
          {TASK_STATUSES.map((s) => (
            <button key={s} onClick={() => setStatus(item, s)} className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
              currentStatus === s ? STATUS_STYLES[s] : "text-white/20 border-transparent hover:text-white/40"
            }`}>{s}</button>
          ))}
        </div>
      </div>

      <button onClick={() => onEdit(item)} className="p-1 text-white/15 hover:text-orange-400 opacity-0 group-hover:opacity-100 transition-all shrink-0" title="Edit task">
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}