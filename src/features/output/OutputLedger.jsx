// Output: the work ledger at a glance. Every finished piece of work (agents, scheduled tasks, Claude sessions,
// Justin by hand), what it saved against the time-saved estimates, by client and by agent, plus the live feed where
// Justin can hide or edit anything before a client sees it.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Eye, EyeOff, Pencil, RefreshCw, Search, Sparkles, X, ArrowUpRight, Loader2, Settings2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ChartTooltip, axisProps, gridProps, barCursor } from "@/components/charts/ChartKit";
import {
  useLedger, useLedgerConfig, DONE_BY, DONE_BY_ORDER, CATEGORIES, totals, windows, weeklyTrend, byClient, byAgent,
  savedMin, manualMin, fmtHours, fmtUsd, counted,
} from "./ledger";

const H3 = ({ children, right }) => (
  <div className="mb-3 flex items-center justify-between gap-2">
    <h3 className="mono-label flex items-center gap-2 text-[10px] text-ink/60"><span className="h-3 w-[3px] rounded-full flame-bg" />{children}</h3>
    {right}
  </div>
);
const Card = ({ children, className = "" }) => <section className={`relative min-w-0 overflow-hidden rounded-md border border-hair bg-card p-4 md:p-5 ${className}`}>{children}</section>;
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—");

function Period({ label, t, prev, accent }) {
  const delta = prev && prev.tasks ? Math.round(((t.tasks - prev.tasks) / prev.tasks) * 100) : null;
  return (
    <div className={`relative min-w-0 border-b border-hair px-4 py-4 sm:border-b-0 sm:border-r sm:last:border-r-0 md:px-5 ${accent ? "bg-ink text-white" : ""}`}>
      {accent && <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" />}
      <p className={`mono-label text-[9.5px] ${accent ? "text-white/55" : "text-ink/55"}`}>{label}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div><p className="text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums md:text-[30px]">{t.tasks}</p><p className={`mt-1.5 text-[11px] ${accent ? "text-white/50" : "text-ink/50"}`}>tasks done</p></div>
        <div><p className={`text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums md:text-[30px] ${accent ? "text-[#ff6a00]" : "text-[#ff3c00]"}`}>{fmtHours(t.hours)}</p><p className={`mt-1.5 text-[11px] ${accent ? "text-white/50" : "text-ink/50"}`}>hours saved</p></div>
        <div><p className="text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums md:text-[30px]">{fmtUsd(t.value)}</p><p className={`mt-1.5 text-[11px] ${accent ? "text-white/50" : "text-ink/50"}`}>value</p></div>
      </div>
      {delta != null && <p className={`mt-2 text-[11px] ${accent ? "text-white/50" : "text-ink/45"}`}>{delta >= 0 ? "+" : ""}{delta}% tasks vs last week</p>}
    </div>
  );
}

function SplitBar({ t }) {
  const total = DONE_BY_ORDER.reduce((s, k) => s + t.split[k].tasks, 0) || 1;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-sm bg-ink/[0.06]" role="img" aria-label="Who did the work">
        {DONE_BY_ORDER.map((k) => t.split[k].tasks ? <span key={k} style={{ width: `${(t.split[k].tasks / total) * 100}%`, background: DONE_BY[k].color }} title={`${DONE_BY[k].label}: ${t.split[k].tasks}`} /> : null)}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
        {DONE_BY_ORDER.map((k) => (
          <li key={k} className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11.5px] text-ink/60"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: DONE_BY[k].color }} />{DONE_BY[k].label}</p>
            <p className="mt-0.5 text-[15px] font-semibold tabular-nums tracking-[-0.02em]">{t.split[k].tasks} <span className="text-[11.5px] font-normal text-ink/45">· {fmtHours(t.split[k].hours)}{k === "justin_manual" ? " by hand" : " saved"}</span></p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditPanel({ e, onClose, onSaved, baselines }) {
  const [f, setF] = useState({
    client_title: e.client_title || "", client_summary: e.client_summary || "", visibility: e.visibility || "internal",
    task_type: e.task_type || "other", done_by: e.done_by || "claude_session", manual_minutes: e.manual_minutes ?? 0, status: e.status || "done",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (ev) => setF((x) => ({ ...x, [k]: ev.target.value }));
  const save = async () => {
    setBusy(true); setErr("");
    try {
      const b = baselines.find((r) => r.key === f.task_type);
      const minutes_baseline = e.baseline_override ? Number(e.minutes_baseline) || 0 : b ? b.minutes : Number(e.minutes_baseline) || 0;
      const manual = Math.max(0, Number(f.manual_minutes) || 0);
      const patch = {
        ...f, manual_minutes: manual, minutes_baseline, locked: true,
        minutes_saved_estimate: f.done_by === "justin_manual" ? 0 : Math.max(0, minutes_baseline - manual),
        visibility_locked: f.visibility !== e.visibility || e.visibility_locked || false,
        ...(f.visibility !== e.visibility ? { visibility_reason: "Set by Justin" } : {}),
        ...(f.client_title !== (e.client_title || "") || f.client_summary !== (e.client_summary || "") ? { client_copy_status: "edited" } : {}),
      };
      await base44.entities.WorkEntry.update(e.id, patch);
      onSaved();
      onClose();
    } catch (x) { setErr(x?.message || "Couldn't save"); } finally { setBusy(false); }
  };
  const regen = async () => {
    setBusy(true); setErr("");
    try {
      const r = (await base44.functions.invoke("work-ledger", { action: "copy", ids: [e.id] }))?.data;
      const fresh = await base44.entities.WorkEntry.get(e.id);
      if (fresh) setF((x) => ({ ...x, client_title: fresh.client_title || "", client_summary: fresh.client_summary || "", visibility: fresh.visibility || x.visibility }));
      if (r && !r.copy_generated) setErr("The writer held this one back (it read as internal). Write it yourself or keep it internal.");
      onSaved();
    } catch (x) { setErr(x?.message || "Couldn't write copy"); } finally { setBusy(false); }
  };
  const input = "w-full border border-hair bg-paper px-3 py-2 text-[13px] outline-none focus:border-ink/40";
  return (
    <div role="dialog" aria-modal="true" aria-label="Edit work entry" className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 p-0 sm:items-start sm:p-4 sm:pt-[8vh]" onMouseDown={onClose}>
      <div onMouseDown={(ev) => ev.stopPropagation()} className="max-h-[92vh] w-full max-w-lg overflow-y-auto border border-hair bg-canvas shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-hair px-5 py-4">
          <div className="min-w-0">
            <p className="mono-label text-[9.5px] text-ink/50">{e.client_name || "Interstellar"} · internal title</p>
            <p className="mt-1 text-[14px] font-semibold leading-snug">{e.title}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-ink/50 hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {["client", "internal"].map((v) => (
              <button key={v} type="button" onClick={() => setF((x) => ({ ...x, visibility: v }))} className={`flex h-9 items-center gap-1.5 border px-3 text-[12.5px] ${f.visibility === v ? "border-ink bg-ink text-white" : "border-hair text-ink/65 hover:border-ink/30"}`}>
                {v === "client" ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}{v === "client" ? "Show in client portal" : "Internal only"}
              </button>
            ))}
          </div>
          <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Client title (team voice)</span><input value={f.client_title} onChange={set("client_title")} maxLength={90} className={`${input} mt-1`} placeholder="We fixed…" /></label>
          <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Client summary</span><textarea value={f.client_summary} onChange={set("client_summary")} maxLength={320} rows={3} className={`${input} mt-1`} /></label>
          <button type="button" onClick={regen} disabled={busy} className="inline-flex items-center gap-1.5 text-[12.5px] text-[#ff3c00] hover:underline disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" />Rewrite client copy</button>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Task type (estimate)</span>
              <select value={f.task_type} onChange={set("task_type")} className={`${input} mt-1`}>{baselines.map((b) => <option key={b.key} value={b.key}>{b.label} · {b.minutes}m</option>)}</select></label>
            <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Done by</span>
              <select value={f.done_by} onChange={set("done_by")} className={`${input} mt-1`}>{DONE_BY_ORDER.map((k) => <option key={k} value={k}>{DONE_BY[k].label}</option>)}</select></label>
            <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Justin&apos;s minutes on it</span><input type="number" min="0" value={f.manual_minutes} onChange={set("manual_minutes")} className={`${input} mt-1`} /></label>
            <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Status</span>
              <select value={f.status} onChange={set("status")} className={`${input} mt-1`}>{["done", "in_progress", "awaiting_approval", "duplicate", "cancelled", "failed"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></label>
          </div>
          {e.evidence && <p className="break-words text-[11.5px] text-ink/50">Evidence: {e.evidence}</p>}
          {err && <p className="text-[12px] text-[#c24100]">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-hair px-5 py-3">
          <button type="button" onClick={onClose} className="h-9 px-4 text-[13px] text-ink/60 hover:text-ink">Cancel</button>
          <button type="button" onClick={save} disabled={busy} className="h-9 bg-[#ff3c00] px-5 text-[13px] font-medium text-white hover:bg-ink disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

export default function OutputLedger() {
  const q = useLedger();
  const cfg = useLedgerConfig();
  const qc = useQueryClient();
  const rate = cfg.data?.hourly_rate || 75;
  const baselines = cfg.data?.rows || [];
  const [filters, setFilters] = useState({ client: "", by: "", cat: "", vis: "", q: "", range: "all" });
  const [editing, setEditing] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState("");
  const rows = useMemo(() => q.data || [], [q.data]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["WorkEntry"] });

  const m = useMemo(() => {
    const w = windows(rows);
    return {
      week: totals(w.week, rate), lastWeek: totals(w.lastWeek, rate), month: totals(w.month, rate), all: totals(w.all, rate),
      trend: weeklyTrend(rows, 12), clients: byClient(rows, rate), agents: byAgent(rows, rate),
    };
  }, [rows, rate]);

  const clientOpts = useMemo(() => m.clients.map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)), [m.clients]);
  const feed = useMemo(() => {
    const w = windows(rows);
    const base = filters.range === "week" ? new Set(w.week.map((e) => e.id)) : filters.range === "month" ? new Set(w.month.map((e) => e.id)) : null;
    const s = filters.q.trim().toLowerCase();
    return rows.filter((e) => (!base || base.has(e.id))
      && (!filters.client || (e.client_id || "agency") === filters.client)
      && (!filters.by || e.done_by === filters.by)
      && (!filters.cat || e.category === filters.cat)
      && (!filters.vis || e.visibility === filters.vis)
      && (!s || `${e.title} ${e.client_title || ""} ${e.client_name || ""}`.toLowerCase().includes(s)))
      .filter((e) => filters.range === "all" || counted(e));
  }, [rows, filters]);
  const [limit, setLimit] = useState(40);

  const sync = async () => {
    setSyncing(true); setNote("");
    try {
      const r = (await base44.functions.invoke("work-ledger", { action: "sync" }))?.data || {};
      setNote(`Synced: ${r.created || 0} new, ${r.updated || 0} updated${r.processed?.copy_generated ? `, ${r.processed.copy_generated} client lines written` : ""}.`);
      refresh();
    } catch (x) { setNote(x?.response?.data?.error || x?.message || "Sync failed"); } finally { setSyncing(false); }
  };
  const toggleVis = async (e) => {
    const next = e.visibility === "client" ? "internal" : "client";
    await base44.entities.WorkEntry.update(e.id, { visibility: next, visibility_locked: true, visibility_reason: "Set by Justin" });
    refresh();
  };

  if (q.isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-ink/40" /></div>;
  const sel = "h-9 min-w-0 border border-hair bg-paper px-2.5 text-[12.5px] text-ink/75 outline-none focus:border-ink/40";

  return (
    <div className="space-y-5" data-output-ledger>
      {/* Totals */}
      <div className="overflow-hidden rounded-md border border-hair bg-card">
        <div className="grid sm:grid-cols-3">
          <Period label="This week" t={m.week} prev={m.lastWeek} accent />
          <Period label="This month" t={m.month} />
          <Period label="All time" t={m.all} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hair px-4 py-2.5 text-[11.5px] text-ink/50 md:px-5">
          <span>Hours saved and value are <b className="font-semibold text-ink/70">estimates</b>: the manual minutes for each task type, minus Justin&apos;s own time, at {fmtUsd(rate)}/h.</span>
          <Link to="/settings?tab=estimates" className="inline-flex items-center gap-1 text-[#ff3c00] hover:underline"><Settings2 className="h-3 w-3" />Edit estimates</Link>
          <button type="button" onClick={sync} disabled={syncing} className="ml-auto inline-flex items-center gap-1.5 text-ink/60 hover:text-ink disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />Sync now</button>
        </div>
        {note && <p className="border-t border-hair px-5 py-2 text-[12px] text-ink/60">{note}</p>}
      </div>

      {/* Who did it + trend */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.25fr]">
        <Card>
          <H3 right={<span className="font-mono text-[11px] text-ink/50">this month</span>}>Who did the work</H3>
          <SplitBar t={m.month.tasks ? m.month : m.all} />
          <div className="mt-4 border-t border-hair pt-3">
            <p className="text-[13px] leading-relaxed text-ink/70">
              You did <b className="font-semibold text-ink">{fmtHours(m.month.manualHours)}</b> by hand this month ({m.month.split.justin_manual.tasks} {m.month.split.justin_manual.tasks === 1 ? "task" : "tasks"}).
              Everything else, {m.month.tasks - m.month.split.justin_manual.tasks} tasks, ran without you and saved about <b className="font-semibold text-[#ff3c00]">{fmtHours(m.month.hours)}</b>.
            </p>
          </div>
        </Card>
        <Card>
          <H3 right={<span className="font-mono text-[11px] text-ink/50">12 weeks</span>}>Tasks and hours saved</H3>
          <div className="h-[210px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={m.trend} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid {...gridProps()} />
                <XAxis dataKey="label" {...axisProps()} interval="preserveStartEnd" minTickGap={18} />
                <YAxis yAxisId="t" allowDecimals={false} {...axisProps()} width={36} />
                <YAxis yAxisId="h" orientation="right" {...axisProps()} width={36} />
                <Tooltip content={<ChartTooltip format={(v, n) => (n === "Hours saved" ? `${v}h` : v)} />} cursor={barCursor()} />
                <Bar yAxisId="t" dataKey="tasks" name="Tasks" fill="#ff6a00" radius={[4, 4, 0, 0]} maxBarSize={34} />
                <Line yAxisId="h" type="monotone" dataKey="hours" name="Hours saved" stroke="#1a1a1a" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Leaderboards */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-0 md:p-0">
          <div className="px-4 pt-4 md:px-5"><H3 right={<span className="font-mono text-[11px] text-ink/50">all time</span>}>By client</H3></div>
          {m.clients.length ? (
            <ol className="divide-y divide-hair border-t border-hair">
              {m.clients.slice(0, 12).map((c, i) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 md:px-5">
                  <span className="w-5 shrink-0 font-mono text-[11px] text-ink/40">{i + 1}</span>
                  <button type="button" onClick={() => setFilters((f) => ({ ...f, client: c.id }))} className="min-w-0 flex-1 truncate text-left text-[13.5px] font-medium hover:text-[#ff3c00]">{c.name}</button>
                  <span className="hidden text-[11.5px] text-ink/45 sm:inline">{c.visible} in portal</span>
                  <span className="w-12 text-right text-[12.5px] tabular-nums text-ink/60">{c.tasks}</span>
                  <span className="w-14 text-right text-[13px] font-semibold tabular-nums text-[#ff3c00]">{fmtHours(c.hours)}</span>
                  {c.id !== "agency" ? <Link to={`/clients/${c.id}`} className="text-ink/35 hover:text-[#ff3c00]" aria-label={`Open ${c.name}`}><ArrowUpRight className="h-3.5 w-3.5" /></Link> : <span className="w-3.5" />}
                </li>
              ))}
            </ol>
          ) : <p className="px-5 pb-5 text-[12.5px] text-ink/50">No work logged yet.</p>}
          <p className="border-t border-hair px-4 py-2 text-[10.5px] text-ink/40 md:px-5">tasks · hours saved</p>
        </Card>
        <Card className="p-0 md:p-0">
          <div className="px-4 pt-4 md:px-5"><H3 right={<Link to="/agents" className="text-[11.5px] text-[#ff3c00] hover:underline">Agent Constellation →</Link>}>By agent</H3></div>
          {m.agents.length ? (
            <ol className="divide-y divide-hair border-t border-hair">
              {m.agents.slice(0, 12).map((a) => (
                <li key={a.key || a.name} className="flex items-center gap-3 px-4 py-2.5 md:px-5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: DONE_BY[a.done_by]?.color || "#ff3c00" }} />
                  {a.key ? <Link to={`/agents?agent=${encodeURIComponent(a.key)}`} className="min-w-0 flex-1 truncate text-[13.5px] font-medium hover:text-[#ff3c00]">{a.name}</Link> : <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{a.name}</span>}
                  <span className="hidden text-[11.5px] text-ink/45 sm:inline">{a.clients ? `${a.clients} clients` : "agency"}</span>
                  <span className="w-12 text-right text-[12.5px] tabular-nums text-ink/60">{a.tasks}</span>
                  <span className="w-14 text-right text-[13px] font-semibold tabular-nums text-[#ff3c00]">{fmtHours(a.hours)}</span>
                </li>
              ))}
            </ol>
          ) : <p className="px-5 pb-5 text-[12.5px] text-ink/50">Agent and scheduled-task runs show here as they finish work.</p>}
          <p className="border-t border-hair px-4 py-2 text-[10.5px] text-ink/40 md:px-5">tasks · hours saved</p>
        </Card>
      </div>

      {/* Live feed */}
      <Card className="p-0 md:p-0">
        <div className="space-y-3 px-4 pt-4 md:px-5">
          <H3 right={<span className="font-mono text-[11px] text-ink/50">{feed.length} entries</span>}>Live feed</H3>
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
            <label className="relative col-span-2 md:w-56"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink/40" /><input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Search work…" className={`${sel} w-full pl-8`} /></label>
            <select aria-label="Period" value={filters.range} onChange={(e) => setFilters((f) => ({ ...f, range: e.target.value }))} className={sel}><option value="all">All time</option><option value="month">This month</option><option value="week">This week</option></select>
            <select aria-label="Client" value={filters.client} onChange={(e) => setFilters((f) => ({ ...f, client: e.target.value }))} className={sel}><option value="">Every client</option>{clientOpts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select aria-label="Done by" value={filters.by} onChange={(e) => setFilters((f) => ({ ...f, by: e.target.value }))} className={sel}><option value="">Anyone</option>{DONE_BY_ORDER.map((k) => <option key={k} value={k}>{DONE_BY[k].label}</option>)}</select>
            <select aria-label="Category" value={filters.cat} onChange={(e) => setFilters((f) => ({ ...f, cat: e.target.value }))} className={sel}><option value="">Every category</option>{Object.entries(CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <select aria-label="Visibility" value={filters.vis} onChange={(e) => setFilters((f) => ({ ...f, vis: e.target.value }))} className={sel}><option value="">Portal + internal</option><option value="client">In client portal</option><option value="internal">Internal only</option></select>
            {(filters.client || filters.by || filters.cat || filters.vis || filters.q || filters.range !== "all") && <button type="button" onClick={() => setFilters({ client: "", by: "", cat: "", vis: "", q: "", range: "all" })} className="h-9 px-2 text-[12px] text-ink/55 hover:text-ink">Clear</button>}
          </div>
        </div>
        {feed.length ? (
          <ul className="mt-3 divide-y divide-hair border-t border-hair">
            {feed.slice(0, limit).map((e) => {
              const who = DONE_BY[e.done_by] || DONE_BY.claude_session;
              const mins = e.done_by === "justin_manual" ? manualMin(e) : savedMin(e);
              const off = !counted(e);
              return (
                <li key={e.id} className={`flex items-start gap-3 px-4 py-3 md:px-5 ${off ? "opacity-55" : ""}`}>
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: who.color }} title={who.label} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium leading-snug">{e.title}</p>
                    {e.visibility === "client" && e.client_title ? <p className="mt-0.5 text-[12.5px] text-ink/55"><span className="text-[#ff3c00]">Portal:</span> {e.client_title}</p> : null}
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink/45">
                      <span>{e.client_name || "Interstellar"}</span><span>·</span><span>{who.short}{e.agent_name && e.done_by !== "claude_session" ? ` · ${e.agent_name}` : ""}</span><span>·</span>
                      <span>{CATEGORIES[e.category] || e.category}</span><span>·</span><span>{fmtDay(e.completed_at)}</span>
                      {off && <span className="rounded-sm bg-ink/[0.06] px-1.5 py-px text-ink/60">{String(e.status).replace("_", " ")}</span>}
                    </p>
                  </div>
                  <span className={`shrink-0 pt-0.5 text-right text-[12px] tabular-nums ${e.done_by === "justin_manual" ? "text-ink/60" : "font-semibold text-[#ff3c00]"}`}>{mins >= 60 ? fmtHours(mins / 60) : `${Math.round(mins)}m`}<span className="block text-[10px] font-normal text-ink/40">{e.done_by === "justin_manual" ? "by hand" : "saved"}</span></span>
                  <div className="flex shrink-0 items-center">
                    <button type="button" onClick={() => toggleVis(e)} className={`p-1.5 ${e.visibility === "client" ? "text-[#ff3c00]" : "text-ink/35"} hover:text-ink`} title={e.visibility === "client" ? "Shown in the client portal (click to hide)" : "Internal only (click to show in portal)"} aria-label="Toggle portal visibility">
                      {e.visibility === "client" ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button type="button" onClick={() => setEditing(e)} className="p-1.5 text-ink/40 hover:text-ink" aria-label="Edit entry"><Pencil className="h-3.5 w-3.5" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-3 border-t border-hair px-5 py-10 text-center">
            <p className="text-[14px] font-semibold">{rows.length ? "Nothing matches these filters." : "The ledger is empty."}</p>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] text-ink/55">{rows.length ? "Clear a filter to see more." : "Finished launch items, agent runs, Claude jobs and published work land here every hour. Press Sync now to pull them in."}</p>
          </div>
        )}
        {feed.length > limit && <button type="button" onClick={() => setLimit((n) => n + 60)} className="w-full border-t border-hair py-2.5 text-[12.5px] text-ink/60 hover:text-ink">Show more ({feed.length - limit})</button>}
      </Card>

      {editing && <EditPanel e={editing} baselines={baselines} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
}
