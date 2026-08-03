import { Pencil, Check, X, CalendarDays, Clock } from "lucide-react";

const STATUS_STYLES = {
  Pending: "bg-white/5 text-white/35 border-white/10",
  "In Progress": "bg-orange-500/15 text-orange-400 border-orange-500/25",
  Completed: "bg-green-500/15 text-green-400 border-green-500/25",
};

const TASK_STATUSES = ["Pending", "In Progress", "Completed"];

export default function PriorityTaskCard({ item, glow, editId, editTitle, setEditTitle, setEditId, saveEdit, setStatus }) {
  const currentStatus = item.status || "Pending";

  return (
    <div
      className={`card-hover bg-card rounded-xl p-3 flex items-start gap-3 group transition-all ${
        glow ? "border border-orange-500/40 shadow-orange-glow" : "border border-white/[0.06]"
      }`}
    >
      <div className="flex-1 min-w-0">
        {editId === item.id ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(item.id); if (e.key === "Escape") setEditId(null); }}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-xs text-white outline-none"
            />
            <button onClick={() => saveEdit(item.id)} className="p-0.5 text-green-400/70 hover:text-green-400"><Check className="w-3 h-3" /></button>
            <button onClick={() => setEditId(null)} className="p-0.5 text-white/30 hover:text-white/60"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <p className="text-xs font-medium leading-relaxed text-white/80">{item.title}</p>
        )}

        {item.description && (
          <p className="text-white/30 text-[11px] mt-1 leading-relaxed">{item.description}</p>
        )}

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
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

      {editId !== item.id && (
        <button onClick={() => { setEditId(item.id); setEditTitle(item.title); }} className="p-1 text-white/15 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-all shrink-0">
          <Pencil className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}