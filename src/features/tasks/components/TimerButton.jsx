import React, { useEffect, useState } from "react";
import { Play, Square } from "lucide-react";
import { fmtClock, fmtMinutes, itemMinutes } from "@/features/tasks/lib/estimate";
import { startTimer, stopTimer, totalSeconds, TIMER_CHANGED } from "@/features/tasks/lib/timer";
import { cn } from "@/lib/utils";

/*
 * Start / stop clock on a task. Shows total time against the estimate:
 *   ▶  est 3h                — nothing logged yet
 *   ▶  1:12:40 / 3h          — logged, idle
 *   ■  1:12:41 / 3h (live)   — running; turns flame when past the estimate
 * onChange(patch) lets the parent keep its row in sync without a refetch.
 */
export default function TimerButton({ task, onChange, compact = false, className = "" }) {
  const running = Boolean(task.timer_started_at);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  // Another row started its timer: if it stopped this one, reflect that.
  useEffect(() => {
    const onTimer = (e) => {
      const d = (e && e.detail) || {};
      if (Array.isArray(d.stopped) && d.stopped.includes(task.id) && task.timer_started_at && onChange) {
        onChange({ timer_started_at: null });
      }
    };
    window.addEventListener(TIMER_CHANGED, onTimer);
    return () => window.removeEventListener(TIMER_CHANGED, onTimer);
  }, [task.id, task.timer_started_at, onChange]);

  const est = itemMinutes(task);
  const total = totalSeconds(task, now);
  const over = est > 0 && total > est * 60;

  const toggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const next = running ? await stopTimer(task) : await startTimer(task);
      if (onChange) onChange(next);
    } finally {
      setBusy(false);
    }
  };

  const label = total > 0 ? fmtClock(total) : null;
  const estLabel = est > 0 ? fmtMinutes(est) : null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={running ? "Stop the clock" : "Start the clock on this task"}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-sm border px-1.5 font-mono text-[10.5px] tabular-nums transition-colors",
        running
          ? over
            ? "border-[#ff3c00] bg-[#ff3c00] text-white"
            : "border-ink bg-ink text-white"
          : over
            ? "border-[#ff3c00]/50 text-[#ff3c00] hover:bg-[#ff3c00]/10"
            : "border-hair text-ink/60 hover:border-ink hover:text-ink",
        className
      )}
    >
      {running ? <Square className="h-2.5 w-2.5 fill-current" /> : <Play className="h-2.5 w-2.5 fill-current" />}
      {compact ? (
        label ? <span>{label}</span> : estLabel ? <span className="opacity-70">est {estLabel}</span> : null
      ) : (
        <span>
          {label || "0:00:00"}
          {estLabel ? <span className={running ? "opacity-70" : "opacity-50"}> / {estLabel}</span> : null}
        </span>
      )}
      {running ? <span className={cn("h-1.5 w-1.5 animate-pulse rounded-full", over ? "bg-white" : "bg-[#ff3c00]")} /> : null}
    </button>
  );
}
