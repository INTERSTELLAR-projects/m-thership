// Output > My time: where Justin's own minutes go, per client, per day and per week, straight from the work ledger.
// "Justin's time" = manual_minutes on each WorkEntry (duplicate and cancelled rows never count). Pacific time throughout.
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Loader2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useLedger, useLedgerConfig, DONE_BY } from "./ledger";
import {
  AGENCY, RANGES, rangeFor, prepare, inRange, summarize, byClientTime, byDay, needsMinutes, isEstimated, minutesPatch, confirmPatch,
  fmtHM, summaryLine, dayLabel, timeLabel, dayKey,
} from "./myTime";

const H3 = ({ children, right }) => (
  <div className="mb-3 flex items-center justify-between gap-2">
    <h3 className="mono-label flex items-center gap-2 text-[10px] text-ink/60"><span className="h-3 w-[3px] rounded-full flame-bg" />{children}</h3>
    {right}
  </div>
);
const Card = ({ children, className = "" }) => <section className={`relative min-w-0 overflow-hidden rounded-md border border-hair bg-card ${className}`}>{children}</section>;

// Client colours for the stacked bars: Interstellar is always ink, clients take the brand oranges then neutrals.
const INK = "#1a1a1a";
const CLIENT_COLORS = ["#ff3c00", "#ff8a1f", "#ffaa00", "#c24100", "#8a8580", "#5c5752"];
const OTHER = "#d9d4ce";
function colorMap(rows) {
  const m = new Map([[AGENCY, INK]]);
  let i = 0;
  for (const r of rows) if (r.key !== AGENCY) { m.set(r.key, i < CLIENT_COLORS.length ? CLIENT_COLORS[i] : OTHER); i += 1; }
  return m;
}
const STATUS = { in_progress: "in progress", awaiting_approval: "awaiting approval", failed: "failed" };

function Tile({ label, sub, s, accent }) {
  const pct = s.minutes ? (s.clientMinutes / s.minutes) * 100 : 0;
  const dim = accent ? "text-white/50" : "text-ink/50";
  return (
    <div className={`relative min-w-0 border-b border-r border-hair px-4 py-4 md:px-5 ${accent ? "bg-ink text-white" : ""}`}>
      {accent && <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" />}
      <p className={`mono-label text-[9.5px] ${accent ? "text-white/55" : "text-ink/55"}`}>{label}</p>
      <p className={`mt-0.5 font-mono text-[10px] ${accent ? "text-white/35" : "text-ink/40"}`}>{sub}</p>
      <p className={`mt-3 text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums md:text-[30px] ${accent ? "text-[#ff6a00]" : ""}`}>{fmtHM(s.minutes)}</p>
      <p className={`mt-1.5 text-[11.5px] ${dim}`}>your time · <b className={`font-semibold ${accent ? "text-white" : "text-ink/80"}`}>{s.done}</b> finished</p>
      <div className={`mt-3 flex h-1.5 w-full overflow-hidden rounded-sm ${accent ? "bg-white/10" : "bg-ink/[0.06]"}`} role="img" aria-label={`Clients ${fmtHM(s.clientMinutes)}, Interstellar ${fmtHM(s.agencyMinutes)}`}>
        {s.minutes > 0 && <span className="flame-bg" style={{ width: `${pct}%` }} />}
        {s.minutes > 0 && <span style={{ width: `${100 - pct}%`, background: accent ? "rgba(255,255,255,0.45)" : INK }} />}
      </div>
      <p className={`mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] ${dim}`}>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm flame-bg" />Clients {fmtHM(s.clientMinutes)} · {s.clientDone}</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: accent ? "rgba(255,255,255,0.45)" : INK }} />Interstellar {fmtHM(s.agencyMinutes)} · {s.agencyDone}</span>
      </p>
    </div>
  );
}

function StackBar({ segments, total, max, colors }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-sm bg-ink/[0.06]" role="img" aria-label={segments.map((s) => `${s.name} ${fmtHM(s.minutes)}`).join(", ") || "No time logged"}>
      <div className="flex h-full" style={{ width: `${max ? Math.max(total ? 3 : 0, (total / max) * 100) : 0}%` }}>
        {segments.map((s) => <span key={s.key} title={`${s.name}: ${fmtHM(s.minutes)}`} style={{ width: `${(s.minutes / total) * 100}%`, background: colors.get(s.key) || OTHER }} />)}
      </div>
    </div>
  );
}

function NeedsRow({ e, baselines, onDone }) {
  const [val, setVal] = useState(Number(e.manual_minutes) > 0 ? String(Math.round(Number(e.manual_minutes))) : "");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const est = isEstimated(e) && Number(e.manual_minutes) > 0;
  const run = async (kind) => {
    setBusy(kind); setErr("");
    try {
      await base44.entities.WorkEntry.update(e.id, kind === "save" ? minutesPatch(e, val, baselines) : confirmPatch(e));
      onDone(e.id);
    } catch (x) { setErr(x?.message || "Couldn't save"); setBusy(""); }
  };
  const valid = val !== "" && Number(val) >= 0 && Number.isFinite(Number(val));
  return (
    <li className="flex flex-col gap-2.5 px-4 py-3 md:flex-row md:items-center md:gap-4 md:px-5">
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium leading-snug">{e.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink/45">
          <span>{e._client}</span><span>·</span><span>{dayLabel(e._day)}</span><span>·</span><span>{(DONE_BY[e.done_by] || DONE_BY.claude_session).short}</span>
          <span className={`rounded-sm px-1.5 py-px ${est ? "bg-[#ff3c00]/[0.1] text-[#c24100]" : "bg-ink/[0.06] text-ink/60"}`}>{est ? `estimated ${fmtHM(e.manual_minutes)}` : "no minutes yet"}</span>
        </p>
        {err && <p className="mt-1 text-[12px] text-[#c24100]">{err}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <label className="flex items-center gap-1.5 text-[12px] text-ink/50">
          <input type="number" min="0" inputMode="numeric" value={val} onChange={(ev) => setVal(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter" && valid && !busy) run("save"); }} placeholder="0" aria-label={`Your minutes on ${e.title}`} className="h-9 w-[68px] border border-hair bg-paper px-2 text-right text-[13px] tabular-nums text-ink outline-none focus:border-ink/40" />min
        </label>
        <button type="button" onClick={() => run("save")} disabled={!valid || !!busy} className="h-9 bg-[#ff3c00] px-3.5 text-[12.5px] font-medium text-white hover:bg-ink disabled:opacity-40">{busy === "save" ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => run("ok")} disabled={!!busy} className="inline-flex h-9 items-center gap-1.5 border border-hair px-3 text-[12.5px] text-ink/65 hover:border-ink/30 hover:text-ink disabled:opacity-40"><Check className="h-3.5 w-3.5" />{busy === "ok" ? "Saving…" : est ? "Looks right" : "0 is right"}</button>
      </div>
    </li>
  );
}

export default function MyTime() {
  const q = useLedger();
  const cfg = useLedgerConfig();
  const qc = useQueryClient();
  const [range, setRange] = useState("week");
  const [custom, setCustom] = useState(() => { const r = rangeFor("week"); return { from: r.from, to: dayKey(new Date()) }; });
  const [client, setClient] = useState("");
  const [cleared, setCleared] = useState(() => new Set());
  const [needLimit, setNeedLimit] = useState(6);
  const [dayLimit, setDayLimit] = useState(7);

  const baselines = useMemo(() => cfg.data?.rows || [], [cfg.data]);
  const all = useMemo(() => prepare(q.data || []), [q.data]);
  const now = useMemo(() => new Date(), [q.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const tiles = useMemo(() => {
    const r = (id) => rangeFor(id, now);
    const span = ({ from, to }) => (from === to ? dayLabel(from) : `${dayLabel(from, { month: "short", day: "numeric" })} – ${dayLabel(to, { month: "short", day: "numeric" })}`);
    return ["today", "yesterday", "week", "last_week"].map((id) => ({ id, sub: span(r(id)), s: summarize(inRange(all, r(id))) }));
  }, [all, now]);

  const view = useMemo(() => {
    const r = rangeFor(range, now, custom);
    const rows = inRange(all, r);
    const map = new Map(baselines.map((b) => [b.key, b.minutes]));
    const baselineOf = (e) => (e.minutes_baseline != null ? Number(e.minutes_baseline) : map.get(e.task_type) || 0);
    const table = byClientTime(rows, baselineOf);
    const picked = client && table.rows.some((x) => x.key === client) ? client : "";
    const days = byDay(picked ? rows.filter((e) => e._key === picked) : rows);
    return { r, table, days, picked, colors: colorMap(table.rows), maxDay: Math.max(0, ...days.map((d) => d.minutes)) };
  }, [all, range, custom, client, baselines, now]);

  const needs = useMemo(() => needsMinutes(all, now).filter((e) => !cleared.has(e.id)), [all, now, cleared]);
  const onDone = (id) => { setCleared((s) => new Set(s).add(id)); qc.invalidateQueries({ queryKey: ["WorkEntry"] }); };

  if (q.isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-ink/40" /></div>;

  const week = tiles[2].s;
  const rangeLabel = RANGES.find((x) => x.id === range)?.label || "Range";
  const pickedName = view.table.rows.find((x) => x.key === view.picked)?.name;
  const sel = "h-9 min-w-0 border border-hair bg-paper px-2.5 text-[12.5px] text-ink/75 outline-none focus:border-ink/40";
  const empty = !(q.data || []).length;

  return (
    <div className="space-y-5" data-my-time>
      {/* Today / Yesterday / This week / Last week */}
      <Card>
        <div className="-mb-px -mr-px grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4">
          <Tile label="Today" sub={tiles[0].sub} s={tiles[0].s} accent />
          <Tile label="Yesterday" sub={tiles[1].sub} s={tiles[1].s} />
          <Tile label="This week" sub={tiles[2].sub} s={tiles[2].s} />
          <Tile label="Last week" sub={tiles[3].sub} s={tiles[3].s} />
        </div>
        <p className="border-t border-hair px-4 py-3 text-[13.5px] leading-relaxed text-ink/75 md:px-5" data-week-line>
          <Clock className="mr-1.5 inline h-3.5 w-3.5 -translate-y-px text-[#ff3c00]" />{summaryLine("This week", week)}
          {tiles[3].s.minutes > 0 && <span className="text-ink/45"> Last week: {fmtHM(tiles[3].s.minutes)}.</span>}
        </p>
      </Card>

      {empty ? (
        <Card className="px-5 py-12 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#ff3c00]/10"><Clock className="h-5 w-5 text-[#ff3c00]" /></span>
          <p className="mt-3 text-[15px] font-semibold tracking-[-0.02em]">No work logged yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-ink/55">As work gets logged to the ledger with your minutes on it, this page shows where your time went by client, by day and by week.</p>
        </Card>
      ) : (
        <>
          {/* Needs your minutes */}
          {needs.length > 0 && (
            <Card>
              <div className="px-4 pt-4 md:px-5">
                <H3 right={<span className="font-mono text-[11px] text-ink/50">{needs.length} in the last 14 days</span>}>Needs your minutes</H3>
                <p className="-mt-1 pb-3 text-[12.5px] leading-relaxed text-ink/55">Work you were part of where your time is missing or only estimated. Type the real minutes and save, or confirm the number that&apos;s there.</p>
              </div>
              <ul className="divide-y divide-hair border-t border-hair">
                {needs.slice(0, needLimit).map((e) => <NeedsRow key={e.id} e={e} baselines={baselines} onDone={onDone} />)}
              </ul>
              {needs.length > needLimit && <button type="button" onClick={() => setNeedLimit((n) => n + 20)} className="w-full border-t border-hair py-2.5 text-[12.5px] text-ink/60 hover:text-ink">Show more ({needs.length - needLimit})</button>}
            </Card>
          )}

          {/* Where my time went */}
          <Card>
            <div className="space-y-3 px-4 pt-4 md:px-5">
              <H3 right={<span className="font-mono text-[11px] text-ink/50">{view.r.from === view.r.to ? dayLabel(view.r.from) : `${dayLabel(view.r.from, { month: "short", day: "numeric" })} – ${dayLabel(view.r.to, { month: "short", day: "numeric" })}`}</span>}>Where my time went</H3>
              <div className="flex flex-wrap items-center gap-2 pb-3">
                <div className="no-scrollbar -mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1" role="group" aria-label="Range">
                  {RANGES.map((x) => (
                    <button key={x.id} type="button" onClick={() => { setRange(x.id); setDayLimit(7); }} aria-pressed={range === x.id} className={`h-9 shrink-0 border px-3 text-[12.5px] ${range === x.id ? "border-ink bg-ink text-white" : "border-hair text-ink/65 hover:border-ink/30"}`}>{x.label}</button>
                  ))}
                </div>
                {range === "custom" && (
                  <div className="flex items-center gap-2 text-[12px] text-ink/50">
                    <input type="date" aria-label="From" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className={sel} />
                    <span>to</span>
                    <input type="date" aria-label="To" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className={sel} />
                  </div>
                )}
              </div>
            </div>
            {view.table.rows.length ? (
              <div className="overflow-x-auto border-t border-hair">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-hair text-left text-[11px] text-ink/50">
                      <th className="px-4 py-2 font-medium md:px-5">Client</th>
                      <th className="px-3 py-2 text-right font-medium">Your time</th>
                      <th className="hidden w-[30%] px-3 py-2 font-medium sm:table-cell">Share</th>
                      <th className="px-3 py-2 text-right font-medium">Finished</th>
                      <th className="hidden px-4 py-2 text-right font-medium md:table-cell md:px-5">Hands-on est.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.table.rows.map((r) => {
                      const on = view.picked === r.key;
                      const pct = Math.round(r.share * 100);
                      return (
                        <tr key={r.key} onClick={() => setClient(on ? "" : r.key)} className={`cursor-pointer border-b border-hair ${on ? "bg-[#ff3c00]/[0.06]" : "hover:bg-ink/[0.02]"}`}>
                          <td className="px-4 py-2.5 md:px-5">
                            <button type="button" aria-pressed={on} onClick={(ev) => { ev.stopPropagation(); setClient(on ? "" : r.key); }} className="flex max-w-full items-center gap-2 text-left font-medium hover:text-[#ff3c00]">
                              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: view.colors.get(r.key) || OTHER }} /><span className="min-w-0 break-words">{r.name}</span>
                            </button>
                            <div className="mt-1.5 flex items-center gap-2 sm:hidden"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.07]"><div className="h-full rounded-full flame-bg" style={{ width: `${pct}%` }} /></div><span className="w-8 text-right text-[11px] tabular-nums text-ink/50">{pct}%</span></div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums">{fmtHM(r.minutes)}</td>
                          <td className="hidden px-3 py-2.5 sm:table-cell"><div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.07]"><div className="h-full rounded-full flame-bg" style={{ width: `${pct}%` }} /></div><span className="w-9 text-right text-[12px] tabular-nums text-ink/60">{pct}%</span></div></td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-ink/70">{r.done}{r.open ? <span className="text-[11px] text-ink/40"> +{r.open} open</span> : null}</td>
                          <td className="hidden whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-ink/60 md:table-cell md:px-5">{r.baselineMinutes ? fmtHM(r.baselineMinutes) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-ink/[0.025] text-[13px] font-semibold">
                      <td className="px-4 py-2.5 md:px-5">Total</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-[#ff3c00]">{fmtHM(view.table.total.minutes)}</td>
                      <td className="hidden px-3 py-2.5 text-[12px] font-normal text-ink/45 sm:table-cell">{view.table.rows.length} {view.table.rows.length === 1 ? "row" : "rows"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{view.table.total.done}{view.table.total.open ? <span className="text-[11px] font-normal text-ink/40"> +{view.table.total.open} open</span> : null}</td>
                      <td className="hidden whitespace-nowrap px-4 py-2.5 text-right tabular-nums md:table-cell md:px-5">{view.table.total.baselineMinutes ? fmtHM(view.table.total.baselineMinutes) : "—"}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="border-t border-hair px-5 py-10 text-center">
                <p className="text-[14px] font-semibold">Nothing logged for {rangeLabel.toLowerCase()}.</p>
                <p className="mx-auto mt-1 max-w-md text-[12.5px] text-ink/55">Pick a wider range, or check back once work for this period is on the ledger.</p>
              </div>
            )}
            {view.table.rows.length > 0 && <p className="border-t border-hair px-4 py-2 text-[10.5px] leading-relaxed text-ink/40 md:px-5">Your time is the minutes logged on each piece of work. Hands-on est. is what the finished work would take by hand (an estimate). Click a row to filter the days below.</p>}
          </Card>

          {/* Day by day */}
          {view.table.rows.length > 0 && (
            <Card>
              <div className="px-4 pt-4 md:px-5">
                <H3 right={view.picked ? (
                  <button type="button" onClick={() => setClient("")} className="inline-flex items-center gap-1 rounded-sm bg-ink px-2 py-1 text-[11px] text-white hover:bg-[#ff3c00]">{pickedName}<X className="h-3 w-3" /></button>
                ) : <span className="font-mono text-[11px] text-ink/50">{view.days.length} {view.days.length === 1 ? "day" : "days"}</span>}>Day by day</H3>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 pb-3 text-[11px] text-ink/55">
                  {view.table.rows.filter((r) => r.minutes > 0).slice(0, 8).map((r) => <li key={r.key} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: view.colors.get(r.key) || OTHER }} />{r.name}</li>)}
                </ul>
              </div>
              {view.days.slice(0, dayLimit).map((d) => (
                <div key={d.day} className="border-t border-hair">
                  <div className="bg-ink/[0.025] px-4 py-3 md:px-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[13.5px] font-semibold tracking-[-0.01em]">{dayLabel(d.day, { weekday: "long", month: "short", day: "numeric" })}</p>
                      <p className="shrink-0 text-[12px] text-ink/55"><b className="text-[13.5px] font-semibold tabular-nums text-ink">{fmtHM(d.minutes)}</b> · {d.done} finished</p>
                    </div>
                    <div className="mt-2"><StackBar segments={d.segments} total={d.minutes} max={view.maxDay} colors={view.colors} /></div>
                  </div>
                  <ul className="divide-y divide-hair border-t border-hair">
                    {d.entries.map((e) => (
                      <li key={e.id} className="flex items-start gap-3 px-4 py-2.5 md:px-5">
                        <span className="w-[58px] shrink-0 pt-0.5 font-mono text-[10.5px] text-ink/45">{timeLabel(e._at)}</span>
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-sm" style={{ background: view.colors.get(e._key) || OTHER }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium leading-snug">{e.title}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink/45">
                            <span>{e._client}</span><span>·</span><span>{(DONE_BY[e.done_by] || DONE_BY.claude_session).short}</span>
                            {e.status !== "done" && <span className="rounded-sm bg-ink/[0.06] px-1.5 py-px text-ink/60">{STATUS[e.status] || String(e.status || "").replace(/_/g, " ")}</span>}
                          </p>
                        </div>
                        <span className={`shrink-0 pt-0.5 text-right text-[12.5px] tabular-nums ${e._min ? "font-semibold text-ink" : "text-ink/35"}`}>{e._min ? fmtHM(e._min) : "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {view.days.length > dayLimit && <button type="button" onClick={() => setDayLimit((n) => n + 14)} className="w-full border-t border-hair py-2.5 text-[12.5px] text-ink/60 hover:text-ink">Show earlier days ({view.days.length - dayLimit})</button>}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
