import React, { useMemo } from "react";
import { PROJECT_STATUSES, PROJECT_TYPES } from "@/features/tasks/lib/constants";
import { money, moneyFull } from "@/features/tasks/lib/format";
import { cn } from "@/lib/utils";

// Projects hero: portfolio totals, status chips and one tile per project type.
// Every number comes from live Project + Task rows; clicks drive the page's existing filters.

const ACTIVE = ["planning", "in_progress", "review"];
const SHIPPED = ["launched", "done"];
const PIPELINE = ["proposed", "backlog"];

const num = (v) => Number(v) || 0;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const fmtH = (h) => {
  const v = num(h);
  if (v >= 100) return Math.round(v) + "h";
  return (Math.round(v * 10) / 10).toString() + "h";
};

// Per-project time: take the larger of the project's own fields and the sum of its tasks,
// so time tracked on tasks and time typed onto the project never double count.
export function projectTime(project, taskTime) {
  const t = taskTime[project.id] || { seconds: 0, estMinutes: 0 };
  return {
    logged: Math.max(num(project.logged_hours), t.seconds / 3600),
    estimated: Math.max(num(project.estimated_hours), t.estMinutes / 60)
  };
}

function StatusBar({ rows, total, height = "h-1.5" }) {
  if (!total) return <div className={cn(height, "w-full rounded-full bg-ink/[0.06]")} />;
  return (
    <div className={cn(height, "flex w-full overflow-hidden rounded-full bg-ink/[0.06]")}>
      {rows.map((r) =>
        r.count ? <div key={r.value} title={r.label + ": " + r.count} style={{ width: (r.count / total) * 100 + "%", background: r.color }} /> : null
      )}
    </div>
  );
}

function Metric({ label, value, sub, children, accent }) {
  return (
    <div className="min-w-0 border-hair p-4 md:p-5">
      <p className="mono-label text-[9px] text-ink/45">{label}</p>
      <p className={cn("mt-1.5 truncate text-[26px] font-semibold leading-none tracking-[-0.04em] md:text-[30px]", accent ? "text-[#ff3c00]" : "text-ink")}>{value}</p>
      {sub ? <p className="mt-1.5 truncate text-[11px] text-ink/50">{sub}</p> : null}
      {children}
    </div>
  );
}

export default function ProjectsHero({ projects, taskTime, counts, doneCounts, type, status, onType, onStatus, all }) {
  const m = useMemo(() => {
    const byStatus = (list) => PROJECT_STATUSES.map((s) => ({ ...s, count: list.filter((p) => p.status === s.value).length }));
    const tasksDone = (list) => list.reduce((sum, p) => sum + num(doneCounts[p.id]), 0);
    const tasksAll = (list) => list.reduce((sum, p) => sum + num(counts[p.id]), 0);

    let logged = 0;
    let estimated = 0;
    let monthly = 0;
    let oneTime = 0;
    let hourly = 0;
    projects.forEach((p) => {
      const t = projectTime(p, taskTime);
      logged += t.logged;
      estimated += t.estimated;
      const v = num(p.contract_value);
      if (p.billing === "retainer") monthly += v;
      else if (p.billing === "hourly") hourly += v;
      else if (p.billing !== "unpaid") oneTime += v;
    });

    const types = PROJECT_TYPES.map((t) => {
      const list = projects.filter((p) => (p.type || "website") === t.value);
      const done = tasksDone(list);
      const total = tasksAll(list);
      return {
        ...t,
        count: list.length,
        statuses: byStatus(list),
        active: list.filter((p) => ACTIVE.includes(p.status)).length,
        // Contract total for the type. Kept off `value`, which is the type key the tile filters by.
        amount: list.reduce((sum, p) => sum + num(p.contract_value), 0),
        done,
        total,
        progress: pct(done, total)
      };
    });

    const done = tasksDone(projects);
    const total = tasksAll(projects);
    return {
      count: projects.length,
      statuses: byStatus(projects),
      active: projects.filter((p) => ACTIVE.includes(p.status)).length,
      shipped: projects.filter((p) => SHIPPED.includes(p.status)).length,
      onHold: projects.filter((p) => p.status === "on_hold").length,
      pipeline: projects.filter((p) => PIPELINE.includes(p.status)).length,
      value: monthly + oneTime + hourly,
      monthly,
      oneTime,
      hourly,
      logged,
      estimated,
      done,
      total,
      progress: pct(done, total),
      types: types.sort((a, b) => b.count - a.count)
    };
  }, [projects, taskTime, counts, doneCounts]);

  const valueSub = [
    m.monthly ? money(m.monthly) + "/mo retainer" : null,
    m.oneTime ? money(m.oneTime) + " one-time" : null,
    m.hourly ? money(m.hourly) + " hourly" : null
  ]
    .filter(Boolean)
    .join(" · ");
  const timePct = pct(m.logged, m.estimated);

  return (
    <section className="space-y-4">
      {/* Headline metrics */}
      <div className="overflow-hidden rounded-md border border-hair bg-card">
        <div className="flame-bg h-[3px] w-full" />
        <div className="-mr-px grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 [&>*]:border-b [&>*]:border-r">
          <Metric label="Total projects" value={m.count} sub={m.pipeline ? m.pipeline + " in pipeline" : "Nothing proposed yet"} accent />
          <Metric label="Active" value={m.active} sub="Planning · in flight · review" />
          <Metric label="Launched / closed" value={m.shipped} sub={pct(m.shipped, m.count) + "% of portfolio"} />
          <Metric label="On hold" value={m.onHold} sub={m.onHold ? "Needs a decision" : "Nothing stalled"} />
          <Metric label="Contract value" value={moneyFull(m.value)} sub={valueSub || "No values entered"} />
          <Metric label="Hours clocked" value={fmtH(m.logged)} sub={m.estimated ? "of " + fmtH(m.estimated) + " estimated · " + timePct + "%" : "No estimates yet"}>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink/[0.07]">
              <div
                className={cn("h-full rounded-full", timePct > 100 ? "bg-red-600" : "flame-bg")}
                style={{ width: Math.min(timePct, 100) + "%" }}
              />
            </div>
          </Metric>
          <Metric label="Overall progress" value={m.progress + "%"} sub={m.total ? m.done + " of " + m.total + " tasks done" : "No tasks yet"}>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink/[0.07]">
              <div className="flame-bg h-full rounded-full" style={{ width: m.progress + "%" }} />
            </div>
          </Metric>
        </div>

        {/* Status breakdown */}
        <div className="space-y-3 p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="mono-label text-[9px] text-ink/45">By status</p>
            {status !== all ? (
              <button type="button" onClick={() => onStatus(all)} className="mono-label text-[9px] text-[#ff3c00] hover:underline">
                Clear status
              </button>
            ) : null}
          </div>
          <StatusBar rows={m.statuses} total={m.count} height="h-2" />
          <div className="flex flex-wrap gap-1.5">
            {m.statuses.map((s) => {
              const on = status === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => onStatus(on ? all : s.value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[11px] transition-colors",
                    on ? "border-ink bg-ink text-white" : "border-hair bg-card text-ink/70 hover:border-ink/40",
                    !s.count && !on && "opacity-45"
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                  <span className={cn("font-mono text-[10.5px] font-semibold", on ? "text-white" : "text-ink")}>{s.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Type grid */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="mono-label text-[9px] text-ink/45">By type</p>
          {type !== all ? (
            <button type="button" onClick={() => onType(all)} className="mono-label text-[9px] text-[#ff3c00] hover:underline">
              Clear type
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9">
          {m.types.map((t) => {
            const on = type === t.value;
            const empty = !t.count;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => onType(on ? all : t.value)}
                className={cn(
                  "group relative overflow-hidden rounded-md border bg-card p-3 text-left transition-all",
                  on ? "border-ink shadow-[0_0_0_1px_#1a1a1a]" : "border-hair hover:border-ink/40",
                  empty && !on && "bg-transparent"
                )}
              >
                <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: empty ? "transparent" : t.color }} />
                <div className="flex items-center justify-between gap-2">
                  <p className="mono-label flex min-w-0 items-center gap-1.5 truncate text-[9px] text-ink/55">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: t.color }} />
                    {t.label}
                  </p>
                  {on ? <span className="mono-label text-[8.5px] text-[#ff3c00]">Filtered</span> : null}
                </div>
                <p className={cn("mt-1.5 text-[24px] font-semibold leading-none tracking-[-0.04em]", empty ? "text-ink/25" : "text-ink")}>{t.count}</p>
                <p className="mt-1 truncate text-[10.5px] text-ink/45">
                  {empty ? "No projects yet" : t.active + " active" + (t.amount ? " · " + money(t.amount) : "")}
                </p>
                <div className="mt-2.5">
                  <StatusBar rows={t.statuses} total={t.count} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="mono-label text-[8.5px] text-ink/40">{t.total ? t.done + "/" + t.total + " tasks" : "No tasks"}</span>
                  <span className={cn("font-mono font-semibold", t.total ? "text-ink/70" : "text-ink/25")}>{t.progress}%</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink/[0.07]">
                  <div className="flame-bg h-full rounded-full transition-all duration-700" style={{ width: t.progress + "%" }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
