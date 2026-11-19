import React, { useState } from "react";
import { Check, Zap, Bot, User, Ban, CircleCheckBig, Rows3, LayoutGrid } from "lucide-react";
import PriorityBadge from "@/features/tasks/ui-kit/PriorityBadge";
import { dueLabel, dueTone } from "@/features/tasks/lib/format";
import { BOARD, ownerOf, agentOf, blockedReason } from "@/features/tasks/lib/matrix";
import { categoryMeta } from "@/features/tasks/lib/constants";
import { cn } from "@/lib/utils";

const STATUS_TONE = { inbox: "#8a8580", next: "#ff3c00", doing: "#b45309", blocked: "#b91c1c", done: "#15803d" };

function Meta({ task, showClient = true }) {
  const owner = ownerOf(task);
  const agent = agentOf(task);
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px] text-ink/50">
      {showClient ? <span className="max-w-[160px] truncate">{task.client_name || "Interstellar"}</span> : null}
      {owner ? <span className="flex items-center gap-1"><User className="h-2.5 w-2.5" />{owner}</span> : null}
      {agent ? <span className="flex items-center gap-1 text-[#c2410c]"><Bot className="h-2.5 w-2.5" />{agent}</span> : null}
      <span className={dueTone(task.due_date, task.status)}>{dueLabel(task.due_date, task.status)}</span>
    </div>
  );
}

function Column({ kicker, title, icon: Icon, tone, tasks, empty, onOpen, onComplete, render, count }) {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-md border border-hair bg-card" data-testid={`ladder-${kicker.toLowerCase().replace(/\s+/g, "-")}`}>
      <header className="flex items-center justify-between gap-2 border-b border-hair px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="label-cross text-[10px] text-ink/55">({kicker})</p>
          <h3 className="mt-0.5 flex items-center gap-1.5 text-[14.5px] font-semibold tracking-[-0.02em] text-ink"><Icon className="h-3.5 w-3.5" style={{ color: tone }} />{title}</h3>
        </div>
        <span className="mono-label text-[11px] tabular-nums text-ink/45">{count ?? tasks.length}</span>
      </header>
      <ul className="flex-1 space-y-1.5 p-2.5">
        {tasks.length ? tasks.map((t) => (
          <li key={t.id} className="card-hover group flex items-start gap-2.5 rounded-sm border border-hair bg-canvas/50 px-2.5 py-2">
            {onComplete ? (
              <button type="button" onClick={() => onComplete(t)} title="Mark complete" aria-label={`Mark ${t.title} complete`}
                className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm border border-ink/25 text-transparent transition-colors hover:border-green-700 hover:text-green-700"><Check className="h-2.5 w-2.5" /></button>
            ) : <CircleCheckBig className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />}
            <button type="button" onClick={() => onOpen && onOpen(t)} className="min-w-0 flex-1 text-left">
              <p className="line-clamp-2 text-[12.5px] leading-snug text-ink">{t.is_focus ? <Zap className="mr-1 inline h-3 w-3 text-[#ff3c00]" /> : null}{t.title}</p>
              {render ? render(t) : <Meta task={t} />}
            </button>
            {t.status !== "done" ? <PriorityBadge value={t.priority} compact /> : null}
          </li>
        )) : <li className="px-1 py-3 text-[12px] leading-snug text-ink/45">{empty}</li>}
      </ul>
    </section>
  );
}

// The priority ladder: what to do now, what is next, what is stuck and why, what got done today.
export function PriorityLadder({ ladder, scope, onOpen, onComplete }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Column kicker="Do now" title="Focus now" icon={Zap} tone="#ff3c00" tasks={ladder.focus} onOpen={onOpen} onComplete={onComplete}
        empty={`Nothing open for ${scope}. Flag a task with the bolt and it rides here.`} />
      <Column kicker="Queued" title="Next up" icon={Rows3} tone="#57534e" tasks={ladder.next} count={ladder.counts.next} onOpen={onOpen} onComplete={onComplete}
        empty={`Nothing queued for ${scope}.`} />
      <Column kicker="Stuck" title="Blocked" icon={Ban} tone="#b91c1c" tasks={ladder.blocked} count={ladder.counts.blocked} onOpen={onOpen} onComplete={onComplete}
        render={(t) => (<><p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-red-700/80">Why: {blockedReason(t)}</p><Meta task={t} /></>)}
        empty={`Nothing blocked for ${scope}.`} />
      <Column kicker="Shipped" title="Done today" icon={CircleCheckBig} tone="#15803d" tasks={ladder.doneToday.slice(0, 5)} count={ladder.doneToday.length} onOpen={onOpen}
        render={(t) => <div className="mt-0.5 flex flex-wrap gap-x-2.5 text-[10.5px] text-ink/50"><span className="truncate">{t.client_name || "Interstellar"}</span>{agentOf(t) ? <span className="text-[#c2410c]">{agentOf(t)}</span> : null}{ownerOf(t) ? <span>{ownerOf(t)}</span> : null}</div>}
        empty="Nothing finished yet today." />
    </div>
  );
}

// Compact board by status, or swimlanes by client / department.
export function BoardAndLanes({ board, lanes, laneBy, setLaneBy, onOpen, onPickClient }) {
  const [view, setView] = useState("lanes");
  const [all, setAll] = useState(false);
  const shown = all ? lanes : lanes.slice(0, 8);
  return (
    <section className="rounded-md border border-hair bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hair px-3.5 py-2.5">
        <p className="label-cross text-[10.5px] text-ink/60">({view === "board" ? "Board by status" : `Swimlanes by ${laneBy}`})</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-sm border border-hair p-0.5" role="tablist" aria-label="Board view">
            {[["lanes", "Swimlanes", Rows3], ["board", "Board", LayoutGrid]].map(([v, l, I]) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={cn("flex items-center gap-1 rounded-[3px] px-2 py-1 text-[11.5px]", view === v ? "bg-ink text-white" : "text-ink/60 hover:text-ink")}><I className="h-3 w-3" />{l}</button>
            ))}
          </div>
          {view === "lanes" ? (
            <div className="flex rounded-sm border border-hair p-0.5" role="tablist" aria-label="Group lanes by">
              {[["client", "Client"], ["department", "Department"]].map(([v, l]) => (
                <button key={v} type="button" role="tab" aria-selected={laneBy === v} onClick={() => setLaneBy(v)}
                  className={cn("rounded-[3px] px-2 py-1 text-[11.5px]", laneBy === v ? "bg-[#ff3c00] text-white" : "text-ink/60 hover:text-ink")}>{l}</button>
              ))}
            </div>
          ) : null}
        </div>
      </header>
      {view === "board" ? (
        <div className="grid gap-2.5 p-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {BOARD.map((s) => (
            <div key={s.value} className="min-w-0 rounded-sm border border-hair bg-canvas/40">
              <p className="flex items-center justify-between border-b border-hair px-2.5 py-1.5 text-[11.5px] font-medium text-ink">
                <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_TONE[s.value] }} />{s.label}</span>
                <span className="mono-label text-[10px] text-ink/45">{board[s.value].length}</span>
              </p>
              <ul className="space-y-1 p-1.5">
                {board[s.value].slice(0, 6).map((t) => (
                  <li key={t.id}><button type="button" onClick={() => onOpen(t)} className="w-full rounded-sm bg-card px-2 py-1.5 text-left hover:bg-[#ff3c00]/[0.06]">
                    <p className="truncate text-[12px] text-ink">{t.title}</p>
                    <p className="truncate text-[10.5px] text-ink/45">{t.client_name || "Interstellar"} · {categoryMeta(t.category).label}</p>
                  </button></li>
                ))}
                {board[s.value].length > 6 ? <li className="px-2 py-1 text-[10.5px] text-ink/45">+{board[s.value].length - 6} more in the list below</li> : null}
                {!board[s.value].length ? <li className="px-2 py-2 text-[11px] text-ink/40">Empty</li> : null}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed text-left text-[12px]">
            <colgroup><col className="w-[200px]" />{BOARD.map((s) => <col key={s.value} />)}</colgroup>
            <thead>
              <tr className="mono-label text-[9.5px] text-ink/45">
                <th className="px-3.5 py-2 font-normal">{laneBy === "client" ? "Client" : "Department"}</th>
                {BOARD.map((s) => <th key={s.value} className="px-2 py-2 font-normal">{s.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key} className="border-t border-hair align-top">
                  <td className="px-3.5 py-2">
                    <button type="button" className="flex max-w-[220px] items-center gap-1.5 text-left font-medium text-ink hover:text-[#ff3c00]" onClick={() => laneBy === "client" && onPickClient(r.key)} disabled={laneBy !== "client"}>
                      {r.hot ? <i className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff3c00]" /> : null}<span className="truncate">{r.label}</span>
                    </button>
                    <span className="mono-label text-[9.5px] text-ink/40">{r.total} open</span>
                  </td>
                  {BOARD.map((s) => {
                    const cell = r.cells[s.value];
                    return (
                      <td key={s.value} className="px-2 py-2">
                        {cell.length ? (
                          <button type="button" onClick={() => onOpen(cell[0])} className="block w-full min-w-0 rounded-sm border border-hair bg-canvas/50 px-2 py-1 text-left hover:border-[#ff3c00]/50">
                            <span className="flex min-w-0 items-center gap-1.5"><b className="mono-label shrink-0 text-[10.5px]" style={{ color: STATUS_TONE[s.value] }}>{cell.length}</b><span className="truncate text-[11.5px] text-ink">{cell[0].title}</span></span>
                          </button>
                        ) : <span className="text-[11px] text-ink/25">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!lanes.length ? <tr><td colSpan={5} className="px-3.5 py-4 text-[12px] text-ink/45">No open work to lay out.</td></tr> : null}
            </tbody>
          </table>
          {lanes.length > 8 ? <button type="button" onClick={() => setAll((v) => !v)} className="w-full border-t border-hair py-2 text-[12px] text-[#c2410c] hover:bg-[#ff3c00]/[0.04]">{all ? "Show fewer" : `Show all ${lanes.length} lanes`}</button> : null}
        </div>
      )}
    </section>
  );
}
