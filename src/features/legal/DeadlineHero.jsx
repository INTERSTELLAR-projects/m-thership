import { AlertTriangle, CalendarClock, CalendarPlus, Pencil, Repeat } from "lucide-react";
import { categoryOf, fmtDate, spanText } from "./legalDates";

export const URGENCY = {
  overdue: { label: "Overdue", color: "#dc2626", text: "text-red-600", chip: "bg-red-600/10 text-red-700 border-red-600/25", border: "border-red-600/40" },
  soon: { label: "≤ 30 days", color: "#ff3c00", text: "text-[#ff3c00]", chip: "bg-[#ff3c00]/10 text-[#e03500] border-[#ff3c00]/25", border: "border-[#ff3c00]/40" },
  near: { label: "≤ 90 days", color: "#d97706", text: "text-amber-600", chip: "bg-amber-500/10 text-amber-700 border-amber-500/25", border: "border-hair" },
  later: { label: "Later", color: "#1a1a1a", text: "text-ink", chip: "bg-ink/[0.05] text-ink/60 border-ink/15", border: "border-hair" },
};

function Ring({ value, color, size = 64 }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a1a1a" strokeOpacity="0.08" strokeWidth="5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} style={{ transition: "stroke-dashoffset .7s ease" }} />
    </svg>
  );
}

function CountdownCard({ d, onEdit }) {
  const u = URGENCY[d.urgency];
  const n = Math.abs(d.days);
  return (
    <div className={`game-panel card-hover group flex flex-col p-5 ${u.border}`}>
      {d.urgency === "soon" && <span className="pointer-events-none absolute left-0 top-0 h-[3px] w-full flame-bg" />}
      {d.urgency === "overdue" && <span className="pointer-events-none absolute left-0 top-0 h-[3px] w-full bg-red-600" />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`mono-label rounded border px-1.5 py-0.5 text-[9.5px] ${u.chip}`}>{u.label}</span>
            <span className="mono-label text-[9.5px] text-ink/45">{categoryOf(d.item)}</span>
          </div>
          <h3 className="mt-2 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink">{d.item.task || "Untitled"}</h3>
        </div>
        <button onClick={() => onEdit(d.item.id)} className="rounded p-1.5 text-ink/35 transition-colors hover:bg-ink/[0.05] hover:text-[#ff3c00]" title="Edit date">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[44px] font-semibold leading-none tracking-[-0.05em] tabular-nums ${u.text}`}>
            {d.days === 0 ? "Today" : n}
            {d.days !== 0 && <span className="ml-1.5 text-base font-medium tracking-normal text-ink/50">{n === 1 ? "day" : "days"}{d.overdue ? " overdue" : ""}</span>}
          </p>
          <p className="mt-1.5 font-mono text-[11px] text-ink/55">≈ {spanText(d.span)}{d.overdue ? " late" : ""}</p>
        </div>
        {d.progress !== null && (
          <div className="relative" title={`${Math.round(d.progress * 100)}% of the yearly cycle elapsed`}>
            <Ring value={d.progress} color={u.color} />
            <span className="absolute inset-0 flex items-center justify-center font-mono text-[10.5px] font-semibold text-ink/70">{Math.round(d.progress * 100)}%</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-hair pt-3">
        <span className="font-mono text-[11px] text-ink/70">{fmtDate(d.due)}</span>
        {d.recurring ? (
          <span className="mono-label inline-flex items-center gap-1 text-[9.5px] text-ink/45"><Repeat className="h-3 w-3" />Every year</span>
        ) : (
          <span className="mono-label text-[9.5px] text-ink/40">One-time</span>
        )}
      </div>
    </div>
  );
}

function Summary({ label, value, sub, tone }) {
  return (
    <div className="min-w-0 bg-card px-4 py-3 md:px-5">
      <p className="mono-label text-[9.5px] text-ink/50">{label}</p>
      <p className={`mt-1 truncate text-2xl font-semibold tracking-[-0.03em] tabular-nums ${tone || "text-ink"}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate font-mono text-[10.5px] text-ink/50">{sub}</p>}
    </div>
  );
}

export default function DeadlineHero({ dated, undated, onEdit, onAdd }) {
  const overdue = dated.filter((d) => d.overdue).length;
  const in30 = dated.filter((d) => !d.overdue && d.days <= 30).length;
  const in90 = dated.filter((d) => !d.overdue && d.days <= 90).length;
  const next = dated.find((d) => !d.overdue);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-cross text-ink/60">(Countdown)</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-ink md:text-[28px]">
            Legal at a <span className="flame-text">glance</span>
          </h2>
        </div>
        <button onClick={onAdd} className="mono-label inline-flex items-center gap-1.5 rounded-md border border-hair bg-paper px-3 py-2 text-[10px] text-ink/70 transition-colors hover:border-[#ff3c00]/50 hover:text-[#ff3c00]">
          <CalendarPlus className="h-3.5 w-3.5" />Add date
        </button>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-hair bg-hair md:grid-cols-4">
        <Summary label="Overdue" value={overdue} tone={overdue ? "text-red-600" : "text-ink/40"} sub={overdue ? "needs action" : "all clear"} />
        <Summary label="Due ≤ 30 days" value={in30} tone={in30 ? "text-[#ff3c00]" : "text-ink/40"} />
        <Summary label="Due ≤ 90 days" value={in90} tone={in90 ? "text-amber-600" : "text-ink/40"} />
        <Summary label="Next deadline" value={next ? (next.days === 0 ? "Today" : `${next.days}d`) : "—"} sub={next ? next.item.task : "nothing upcoming"} />
      </div>

      {dated.length === 0 ? (
        <div className="game-panel flex flex-col items-center px-6 py-12 text-center">
          <CalendarClock className="h-8 w-8 text-ink/25" />
          <p className="mt-3 text-base font-semibold text-ink">No dated legal items yet</p>
          <p className="mt-1 max-w-md text-sm text-ink/55">
            Add a renewal, annual report, filing or contract date below. Tick “Repeats every year” for anything that comes back annually and the countdown rolls over on its own.
          </p>
          <button onClick={onAdd} className="mt-5 inline-flex items-center gap-1.5 rounded-md flame-bg px-4 py-2 text-xs font-semibold text-white">
            <CalendarPlus className="h-3.5 w-3.5" />Add your first date
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {dated.map((d) => <CountdownCard key={d.item.id} d={d} onEdit={onEdit} />)}
        </div>
      )}

      {undated.length > 0 && (
        <div className="game-panel flex flex-col gap-3 border-dashed p-4 md:flex-row md:items-center">
          <span className="mono-label inline-flex shrink-0 items-center gap-1.5 text-[10px] text-amber-700"><AlertTriangle className="h-3.5 w-3.5" />Missing a date</span>
          <div className="flex flex-wrap gap-2">
            {undated.map((d) => (
              <button key={d.item.id} onClick={() => onEdit(d.item.id)} className="inline-flex items-center gap-1.5 rounded-md border border-hair bg-paper px-2.5 py-1.5 text-xs text-ink/75 transition-colors hover:border-[#ff3c00]/50 hover:text-[#ff3c00]">
                {d.item.task || "Untitled"}
                {d.parsed.raw && <span className="font-mono text-[10px] text-ink/40">“{d.parsed.raw}”</span>}
                <span className="mono-label text-[9px] text-[#ff3c00]">Add a date →</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
