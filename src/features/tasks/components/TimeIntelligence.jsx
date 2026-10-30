import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock, Gauge, Loader2, RefreshCw, Target, Timer, Wand2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Panel from "@/features/tasks/ui-kit/Panel";
import StatCard from "@/features/tasks/ui-kit/StatCard";
import CategoryChip from "@/features/tasks/ui-kit/CategoryChip";
import { CATEGORIES, PROJECT_TYPES } from "@/features/tasks/lib/constants";
import { itemsOf } from "@/features/tasks/lib/clients";
import { fmtMinutes, itemMinutes, splitMinutes, withEstimate } from "@/features/tasks/lib/estimate";
import { TIMER_CHANGED } from "@/features/tasks/lib/timer";
import { btnGhost } from "@/features/tasks/lib/ui";
import { cn } from "@/lib/utils";

/*
 * Time Intelligence — what work actually costs you, from the task clock.
 *   · actual vs estimate by category
 *   · actual per project, grouped by package (website / app / branding …)
 *   · actual per SOP step, with one click to write the median back into the SOP
 */

const median = (arr) => {
  const a = arr.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);

function Delta({ actual, est }) {
  if (!est || !actual) return <span className="text-ink/35">—</span>;
  const p = Math.round(((actual - est) / est) * 100);
  const over = p > 10, under = p < -10;
  return (
    <span className={cn("font-mono text-[11px] tabular-nums", over ? "text-[#ff3c00]" : under ? "text-green-700" : "text-ink/60")}>
      {p > 0 ? "+" : ""}
      {p}%
    </span>
  );
}

function Bars({ rows, max }) {
  // rows: [{ key, label, color, actual, est, n }]
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="mb-1 flex items-center justify-between gap-3 text-[11.5px]">
            <span className="flex items-center gap-2 text-ink/80">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: r.color }} />
              {r.label}
              <span className="text-ink/40">· {r.n} {r.n === 1 ? "task" : "tasks"}</span>
            </span>
            <span className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
              <span className="text-ink">{fmtMinutes(r.actual)}</span>
              <span className="text-ink/40">est {fmtMinutes(r.est)}</span>
              <Delta actual={r.actual} est={r.est} />
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-sm bg-ink/[0.06]">
            <div className="absolute inset-y-0 left-0 rounded-sm opacity-30" style={{ width: Math.min(100, (r.est / max) * 100) + "%", background: r.color }} />
            <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: Math.min(100, (r.actual / max) * 100) + "%", background: r.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TimeIntelligence() {
  const [tasks, setTasks] = useState([]);
  const [entries, setEntries] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState("");
  const [applied, setApplied] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, e, tpl] = await Promise.all([
        base44.entities.Task.filter({ logged_seconds: { $gt: 0 } }, { sort: "-updated_date", limit: 500 }),
        base44.entities.TimeEntry.list({ sort: "-ended_at", limit: 500 }),
        base44.entities.TaskTemplate.list({ sort: "-times_applied", limit: 50 })
      ]);
      setTasks(itemsOf(t));
      setEntries(itemsOf(e));
      setTemplates(itemsOf(tpl));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const onTimer = () => load();
    window.addEventListener(TIMER_CHANGED, onTimer);
    return () => window.removeEventListener(TIMER_CHANGED, onTimer);
  }, [load]);

  const model = useMemo(() => {
    const actualMin = (t) => (Number(t.logged_seconds) || 0) / 60;
    const timed = tasks.filter((t) => actualMin(t) >= 1);
    const withEst = timed.filter((t) => itemMinutes(t) > 0);

    // Headline
    const totalActual = sum(timed, actualMin);
    const totalEst = sum(withEst, itemMinutes);
    const totalActualEst = sum(withEst, actualMin);
    const accuracy = pct(totalActualEst, totalEst);
    const ratios = withEst.map((t) => actualMin(t) / itemMinutes(t));
    const medianRatio = median(ratios);

    // By category
    const byCat = CATEGORIES.map((c) => {
      const rows = timed.filter((t) => (t.category || "ops") === c.value);
      return { key: c.value, label: c.label, color: c.color, n: rows.length, actual: sum(rows, actualMin), est: sum(rows, itemMinutes) };
    }).filter((r) => r.n);

    // By package: actual per project, averaged within type
    const byProject = new Map();
    timed.forEach((t) => {
      if (!t.project_id) return;
      const p = byProject.get(t.project_id) || { id: t.project_id, name: t.project_name || "Project", type: t.project_type || "other", actual: 0, est: 0, n: 0 };
      p.actual += actualMin(t);
      p.est += itemMinutes(t);
      p.n += 1;
      if (!p.type || p.type === "other") p.type = t.project_type || p.type;
      byProject.set(t.project_id, p);
    });
    const projects = [...byProject.values()];
    const byType = PROJECT_TYPES.map((pt) => {
      const rows = projects.filter((p) => p.type === pt.value);
      if (!rows.length) return null;
      return {
        key: pt.value,
        label: pt.label,
        color: pt.color,
        n: rows.length,
        projects: rows.sort((a, b) => b.actual - a.actual),
        avgActual: sum(rows, (p) => p.actual) / rows.length,
        avgEst: sum(rows, (p) => p.est) / rows.length,
        total: sum(rows, (p) => p.actual)
      };
    }).filter(Boolean);
    const unassigned = timed.filter((t) => !t.project_id);

    // By SOP step: median actual per (sop_name, sop_step)
    const steps = new Map();
    timed.forEach((t) => {
      if (!t.sop_name || !t.sop_step) return;
      const k = t.sop_name + "::" + t.sop_step;
      const s = steps.get(k) || { key: k, sop: t.sop_name, step: t.sop_step, category: t.category, actuals: [], est: itemMinutes(t) };
      s.actuals.push(actualMin(t));
      steps.set(k, s);
    });
    const sopSteps = [...steps.values()].map((s) => {
      const tpl = templates.find((x) => x.name === s.sop);
      const item = tpl && Array.isArray(tpl.items) ? tpl.items.find((i) => i.title === s.step) : null;
      const sopEst = item ? itemMinutes(item) : s.est;
      return { ...s, tpl, item, sopEst, median: median(s.actuals), n: s.actuals.length };
    });
    const bySop = new Map();
    sopSteps.forEach((s) => {
      const g = bySop.get(s.sop) || { sop: s.sop, tpl: s.tpl, steps: [] };
      g.steps.push(s);
      bySop.set(s.sop, g);
    });
    const sops = [...bySop.values()].map((g) => ({ ...g, steps: g.steps.sort((a, b) => Math.abs(b.median - b.sopEst) - Math.abs(a.median - a.sopEst)) }));

    // Last 8 weeks of clocked time from entries
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - d.getDay() - 7 * (7 - i));
      return { start: d, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), minutes: 0 };
    });
    entries.forEach((e) => {
      const d = new Date(e.ended_at || e.created_date);
      for (let i = weeks.length - 1; i >= 0; i--) {
        if (d >= weeks[i].start) {
          weeks[i].minutes += (Number(e.seconds) || 0) / 60;
          break;
        }
      }
    });
    const weekMax = Math.max(1, ...weeks.map((w) => w.minutes));

    return { timed, withEst, totalActual, totalEst, accuracy, medianRatio, byCat, byType, unassigned, sops, weeks, weekMax };
  }, [tasks, entries, templates]);

  const applyToSop = async (step) => {
    if (!step.tpl || !step.item) return;
    setApplying(step.key);
    try {
      const { amount, unit } = splitMinutes(Math.max(5, Math.round(step.median)));
      const items = step.tpl.items.map((i) => (i.title === step.step ? withEstimate({ ...i }, amount, unit) : i));
      await base44.entities.TaskTemplate.update(step.tpl.id, { items });
      setTemplates((prev) => prev.map((t) => (t.id === step.tpl.id ? { ...t, items } : t)));
      setApplied((p) => ({ ...p, [step.key]: true }));
    } finally {
      setApplying("");
    }
  };

  if (loading && !tasks.length) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-ink/40" />
      </div>
    );
  }

  const m = model;
  const catMax = Math.max(1, ...m.byCat.flatMap((r) => [r.actual, r.est]));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="max-w-2xl text-[13px] leading-relaxed text-ink/60">
          Every task clock you run lands here. Estimates come from the SOP; actuals come from the clock. When a step keeps running over, push the real number back into the SOP and the next project is planned on truth.
        </p>
        <button type="button" onClick={load} className={btnGhost}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Timer} label="Clocked, all time" value={fmtMinutes(m.totalActual)} hint={m.timed.length + " tasks timed"} accent="#1a1a1a" />
        <StatCard icon={Target} label="Estimated for those" value={fmtMinutes(m.totalEst)} hint={m.withEst.length + " of them carried an estimate"} accent="#57534e" />
        <StatCard
          icon={Gauge}
          label="Actual vs estimate"
          value={m.accuracy === null ? "—" : m.accuracy + "%"}
          hint={m.accuracy === null ? "time a task that has an estimate" : m.accuracy > 110 ? "running over — estimates are light" : m.accuracy < 90 ? "running under — estimates are heavy" : "estimates are honest"}
          accent={m.accuracy === null ? "#8a8580" : m.accuracy > 110 ? "#ff3c00" : "#15803d"}
        />
        <StatCard icon={Clock} label="Typical task" value={m.medianRatio ? Math.round(m.medianRatio * 100) + "% of est" : "—"} hint="median across timed tasks" accent="#b45309" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel kicker="By category" title="Where the hours go">
          {m.byCat.length ? (
            <Bars rows={m.byCat} max={catMax} />
          ) : (
            <p className="text-[12.5px] text-ink/50">Start the clock on a task and this fills in. Solid bar = clocked, faint bar = estimated.</p>
          )}
          <p className="mt-3 text-[10.5px] text-ink/45">Solid bar = clocked · faint bar = estimated.</p>
        </Panel>

        <Panel kicker="Last 8 weeks" title="Clocked time per week">
          <div className="flex h-40 items-end gap-2">
            {m.weeks.map((w) => (
              <div key={w.label} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="font-mono text-[9.5px] tabular-nums text-ink/60">{w.minutes ? fmtMinutes(w.minutes) : ""}</span>
                <div className="w-full rounded-sm bg-[#ff3c00]" style={{ height: Math.max(2, (w.minutes / m.weekMax) * 120) + "px", opacity: w.minutes ? 1 : 0.15 }} />
                <span className="mono-label text-[8px] text-ink/40">{w.label}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel kicker="By package" title="How long each kind of project really takes" bodyClassName="p-0">
        {m.byType.length ? (
          <div className="divide-y divide-hair">
            {m.byType.map((pt) => (
              <div key={pt.key} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: pt.color }} />
                    <p className="text-[14px] font-semibold tracking-[-0.02em]">{pt.label}</p>
                    <span className="text-[11px] text-ink/45">
                      {pt.n} {pt.n === 1 ? "project" : "projects"} timed
                    </span>
                  </div>
                  <div className="flex items-center gap-5 font-mono text-[11px] tabular-nums">
                    <span>
                      <span className="text-ink/40">avg clocked </span>
                      <span className="text-[14px] font-semibold text-ink">{fmtMinutes(pt.avgActual)}</span>
                    </span>
                    <span>
                      <span className="text-ink/40">avg estimated </span>
                      <span className="text-ink/70">{fmtMinutes(pt.avgEst)}</span>
                    </span>
                    <Delta actual={pt.avgActual} est={pt.avgEst} />
                  </div>
                </div>
                <div className="mt-2.5 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {pt.projects.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 rounded-sm border border-hair bg-canvas/50 px-2.5 py-1.5 text-[11.5px]">
                      <span className="truncate text-ink/80">{p.name}</span>
                      <span className="flex shrink-0 items-center gap-2 font-mono text-[10.5px] tabular-nums">
                        <span className="text-ink">{fmtMinutes(p.actual)}</span>
                        <span className="text-ink/40">/ {fmtMinutes(p.est)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {m.unassigned.length ? (
              <p className="px-5 py-3 text-[11px] text-ink/45">
                + {fmtMinutes(sum(m.unassigned, (t) => (Number(t.logged_seconds) || 0) / 60))} clocked on {m.unassigned.length} tasks with no project.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="px-5 py-6 text-[12.5px] text-ink/50">Clock tasks inside projects and each package (website, app, branding, SEO…) gets a real average here.</p>
        )}
      </Panel>

      <Panel kicker="By SOP step" title="Fix the estimates that lie" bodyClassName="p-0">
        {m.sops.length ? (
          <div className="divide-y divide-hair">
            {m.sops.map((g) => (
              <div key={g.sop}>
                <div className="flex items-center justify-between bg-ink/[0.03] px-5 py-2">
                  <p className="text-[12.5px] font-semibold tracking-[-0.01em]">{g.sop}</p>
                  <span className="text-[10.5px] text-ink/45">{g.steps.length} steps timed{g.tpl ? "" : " · SOP no longer in library"}</span>
                </div>
                <div className="hidden grid-cols-[minmax(0,1fr)_110px_60px_90px_90px_70px_130px] items-center gap-3 px-5 py-1.5 lg:grid">
                  {["Step", "Category", "Runs", "Real (median)", "SOP says", "Drift", ""].map((h, i) => (
                    <p key={h + i} className="mono-label text-[8.5px] text-ink/40">
                      {h}
                    </p>
                  ))}
                </div>
                <div className="divide-y divide-hair">
                  {g.steps.map((s) => {
                    const drift = s.sopEst ? (s.median - s.sopEst) / s.sopEst : 0;
                    const worth = s.item && Math.abs(drift) >= 0.15 && !applied[s.key];
                    return (
                      <div key={s.key} className="grid grid-cols-1 items-center gap-2 px-5 py-2 lg:grid-cols-[minmax(0,1fr)_110px_60px_90px_90px_70px_130px] lg:gap-3">
                        <p className="truncate text-[12.5px] text-ink">{s.step}</p>
                        <CategoryChip value={s.category} />
                        <span className="font-mono text-[11px] tabular-nums text-ink/60">{s.n}×</span>
                        <span className="font-mono text-[12px] font-semibold tabular-nums text-ink">{fmtMinutes(s.median)}</span>
                        <span className="font-mono text-[11px] tabular-nums text-ink/60">{s.sopEst ? fmtMinutes(s.sopEst) : "—"}</span>
                        <Delta actual={s.median} est={s.sopEst} />
                        <div className="flex justify-end">
                          {applied[s.key] ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-green-700">
                              <Check className="h-3 w-3" /> SOP updated
                            </span>
                          ) : worth ? (
                            <button type="button" onClick={() => applyToSop(s)} disabled={applying === s.key} className={btnGhost + " h-7 px-2 text-[11px]"}>
                              <Wand2 className="h-3 w-3 text-[#ff3c00]" />
                              {applying === s.key ? "Saving..." : "Set SOP to " + fmtMinutes(s.median)}
                            </button>
                          ) : s.item ? (
                            <span className="text-[10.5px] text-ink/35">within 15%</span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-5 py-6 text-[12.5px] text-ink/50">Run an SOP on a project, clock its steps, and each step's real median shows up next to what the SOP promised — with a one-click fix.</p>
        )}
      </Panel>
    </div>
  );
}
