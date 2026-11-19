import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Activity, AlertTriangle, CalendarClock, Check, ChevronDown, ChevronRight, Copy, PauseCircle, RefreshCw, Search, Zap,
} from "lucide-react";
import { KpiTile, Panel, EmptyState, FinanceStyles, SourceNote } from "@/components/financial/finance/ui";
import { useAutomationHub, appliesToClient } from "./useAutomationHub";
import { SOURCE_META, CHANNEL_META, SCOPE_LABEL, STATUS_META, fmtWhen, relTime, REFRESH_PROMPT } from "./meta";

const count = (v) => String(Math.round(v));
const selCls = "h-9 rounded-md border border-hair bg-card px-2.5 text-[12.5px] text-ink outline-none focus:border-[#ff3c00]";

function GradientBar() {
  return <div className="h-[3px] w-full rounded-full" style={{ background: "linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" }} />;
}

export function SourceChip({ source }) {
  const m = SOURCE_META[source] || { short: source, color: "#57534e" };
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-hair bg-card px-1.5 py-0.5 text-[10.5px] text-ink/70">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />{m.short}
    </span>
  );
}

export function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.on;
  return <span className={`mono-label inline-flex items-center rounded px-1.5 py-0.5 text-[9px] ${m.cls}`}>{m.label}</span>;
}

function LastRun({ row }) {
  if (!row.lastAt) return <span className="text-ink/35">{row.lastStatus === "never" ? "Never ran" : "Not tracked"}</span>;
  const bad = row.lastStatus === "failed";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${bad ? "bg-red-600" : row.lastStatus === "skipped" ? "bg-ink/30" : "bg-[#ff3c00]"}`} />
      <span className="tabular-nums">{relTime(row.lastAt)}</span>
      <span className="text-ink/40">{bad ? "failed" : row.lastStatus === "unknown" ? "" : row.lastStatus}</span>
    </span>
  );
}

function Row({ row, open, onToggle }) {
  const clients = row.scope === "client" ? row.clientNames : [SCOPE_LABEL[row.scope] || row.scope];
  return (
    <div className="border-b border-hair last:border-0">
      <button type="button" onClick={onToggle} className="grid w-full grid-cols-[18px_1fr] gap-3 px-3 py-3 text-left transition-colors hover:bg-ink/[0.025] md:grid-cols-[18px_minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_70px]">
        <span className="pt-0.5 text-ink/35">{open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[13.5px] font-semibold tracking-[-0.01em]">{row.name}</span>
            <SourceChip source={row.source} />
          </span>
          <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-ink/55">{row.description}</span>
          <span className="mt-1.5 flex flex-wrap gap-1 md:hidden">
            {clients.slice(0, 3).map((c) => <span key={c} className="rounded bg-ink/[0.05] px-1.5 py-0.5 text-[10.5px] text-ink/60">{c}</span>)}
          </span>
        </span>
        <span className="hidden min-w-0 md:block">
          <span className="block truncate text-[12px] text-ink/75">{row.schedule}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            {clients.slice(0, 2).map((c) => <span key={c} className="max-w-full truncate rounded bg-ink/[0.05] px-1.5 py-0.5 text-[10.5px] text-ink/60">{c}</span>)}
            {clients.length > 2 && <span className="rounded bg-ink/[0.05] px-1.5 py-0.5 text-[10.5px] text-ink/50">+{clients.length - 2}</span>}
          </span>
        </span>
        <span className="hidden text-[12px] text-ink/70 md:block"><LastRun row={row} /></span>
        <span className="hidden text-[12px] tabular-nums text-ink/70 md:block">{row.nextAt ? <>{fmtWhen(row.nextAt)}<span className="block text-[10.5px] text-ink/40">{relTime(row.nextAt)}</span></> : <span className="text-ink/35">{row.enabled ? "On event / manual" : "—"}</span>}</span>
        <span className="hidden md:block"><StatusPill status={row.status} /></span>
      </button>
      {open && (
        <div className="grid gap-4 border-t border-dashed border-hair bg-ink/[0.015] px-3 py-4 pl-[42px] text-[12.5px] md:grid-cols-[2fr_1fr]">
          <div className="space-y-3">
            <div>
              <p className="mono-label mb-1 text-[9px] text-ink/45">How it works</p>
              <p className="leading-relaxed text-ink/75">{row.how || "—"}</p>
            </div>
            {row.notes && (
              <div className="rounded-md border border-[#ff6a00]/30 bg-[#ff6a00]/[0.06] px-3 py-2 text-[12px] text-ink/75">{row.notes}</div>
            )}
          </div>
          <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 text-[12px]">
            <dt className="text-ink/45">Source</dt><dd>{SOURCE_META[row.source]?.label || row.source}</dd>
            <dt className="text-ink/45">Status</dt><dd className="flex items-center gap-2"><StatusPill status={row.status} /><span className="md:hidden"><LastRun row={row} /></span></dd>
            <dt className="text-ink/45">Affects</dt>
            <dd>{row.scope === "client" ? row.clientIds.map((id, i) => <Link key={id} to={`/clients/${id}?tab=automations`} className="mr-2 text-[#d83300] hover:underline">{row.clientNames[i] || "Client"}</Link>) : SCOPE_LABEL[row.scope]}</dd>
            <dt className="text-ink/45">Channels</dt><dd>{row.channels.map((c) => CHANNEL_META[c] || c).join(", ") || "—"}</dd>
            <dt className="text-ink/45">Last run</dt><dd>{row.lastAt ? `${fmtWhen(row.lastAt)} · ${row.lastStatus}` : row.lastStatus === "never" ? "Never" : "Not tracked here"}</dd>
            <dt className="text-ink/45">Next run</dt><dd>{row.nextAt ? fmtWhen(row.nextAt) : row.enabled ? "When triggered" : "Paused"}</dd>
            {row.cron && <><dt className="text-ink/45">Cron</dt><dd className="font-mono text-[11px] text-ink/60">{row.cron}</dd></>}
            {row.externalId && <><dt className="text-ink/45">ID</dt><dd className="truncate font-mono text-[11px] text-ink/50">{row.externalId}</dd></>}
            {row.liveRuns != null && <><dt className="text-ink/45">Runs logged</dt><dd>{row.liveRuns}</dd></>}
          </dl>
        </div>
      )}
    </div>
  );
}

function RefreshNote({ meta }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(REFRESH_PROMPT); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="rounded-md border border-hair bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-[12.5px] text-ink/70">
          <RefreshCw className="h-3.5 w-3.5 text-[#ff3c00]" />
          Catalog updated <b className="font-semibold text-ink">{meta?.updated_at ? `${fmtWhen(meta.updated_at)} (${relTime(meta.updated_at)})` : "never"}</b>
          {meta?.updated_by ? <span className="text-ink/45">by {meta.updated_by}</span> : null}
        </span>
        <span className="text-[11.5px] text-[#d83300]">{open ? "Hide" : "How to refresh"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-hair px-4 py-4 text-[12.5px] leading-relaxed text-ink/70">
          <p>Claude scheduled tasks live in your Claude account, not in Møthership, so their rows here are a <b>snapshot</b>. Last-run times for anything that logs an AutomationRun (keyword steward, Send to Claude, client automations) update live; schedules, pauses and new tasks need a refresh.</p>
          <p>To refresh, paste this into Claude (any chat with the Base44 and scheduled-task tools). It only reads your tasks and writes the catalog through the <code className="rounded bg-ink/[0.05] px-1 font-mono text-[11px]">automation-catalog</code> backend function.</p>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-hair bg-paper p-3 font-mono text-[11px] text-ink/70">{REFRESH_PROMPT}</pre>
          <button type="button" onClick={copy} className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium text-white" style={{ background: "linear-gradient(90deg,#ff3c00,#ff6a00)" }}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy refresh prompt"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Every automation and notification in one place.
 * clientId: lock the hub to one client (client-specific + all-client automations).
 */
export default function AutomationsHub({ clientId = null }) {
  const { rows, runs, clients, meta, isLoading, error, refetch } = useAutomationHub();
  const [q, setQ] = useState("");
  const [params] = useSearchParams();
  const [client, setClient] = useState(clientId || params.get("client") || "all");
  const [source, setSource] = useState("all");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState("list");
  const [openKey, setOpenKey] = useState(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (client === "agency" && !(r.scope === "agency" || r.scope === "personal")) return false;
      if (client !== "all" && client !== "agency" && !appliesToClient(r, client)) return false;
      if (source !== "all" && r.source !== source) return false;
      if (channel !== "all" && !r.channels.includes(channel)) return false;
      if (status !== "all" && r.status !== status) return false;
      if (needle && ![r.name, r.description, r.how, r.schedule, ...r.clientNames].join(" ").toLowerCase().includes(needle)) return false;
      return true;
    }).sort((a, b) => {
      const rank = { failing: 0, on: 1, setup: 2, paused: 3 };
      return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || (a.nextAt ? a.nextAt.getTime() : Infinity) - (b.nextAt ? b.nextAt.getTime() : Infinity) || a.name.localeCompare(b.name);
    });
  }, [rows, q, client, source, channel, status]);

  const kpi = useMemo(() => {
    const on = filtered.filter((r) => r.status === "on").length;
    const paused = filtered.filter((r) => r.status === "paused" || r.status === "setup").length;
    const failing = filtered.filter((r) => r.status === "failing").length;
    const next = filtered.filter((r) => r.nextAt).sort((a, b) => a.nextAt - b.nextAt)[0];
    const ranDay = filtered.filter((r) => r.lastAt && Date.now() - new Date(r.lastAt).getTime() < 86400000).length;
    return { total: filtered.length, on, paused, failing, next, ranDay };
  }, [filtered]);

  const groups = useMemo(() => {
    if (view !== "client") return null;
    const out = [];
    const byClient = new Map();
    filtered.forEach((r) => {
      if (r.scope === "client") r.clientIds.forEach((id, i) => { if (!byClient.has(id)) byClient.set(id, { name: r.clientNames[i] || "Client", rows: [] }); byClient.get(id).rows.push(r); });
    });
    [...byClient.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name)).forEach(([id, g]) => out.push({ id, ...g }));
    const all = filtered.filter((r) => r.scope === "all_clients");
    const agency = filtered.filter((r) => r.scope === "agency" || r.scope === "personal");
    if (all.length) out.push({ id: "_all", name: "Every client", rows: all });
    if (agency.length) out.push({ id: "_agency", name: "Agency & personal", rows: agency });
    return out;
  }, [filtered, view]);

  const sources = [...new Set(rows.map((r) => r.source))];
  const channels = [...new Set(rows.flatMap((r) => r.channels))];
  const recentRuns = runs.filter((r) => !clientId || r.client_id === clientId).slice(0, 8);

  const header = (
    <div className="hidden grid-cols-[18px_minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_70px] gap-3 border-b border-hair px-3 py-2 md:grid">
      {["", "Automation", "Schedule · affects", "Last run", "Next run", "Status"].map((h) => <span key={h} className="mono-label text-[9px] text-ink/45">{h}</span>)}
    </div>
  );

  return (
    <div className="space-y-5">
      <FinanceStyles />
      <GradientBar />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiTile hero index={0} icon={Zap} label="Automations" value={kpi.total} format={count} sub={clientId ? "for this client" : "across every system"} />
        <KpiTile index={1} icon={Activity} label="Running" value={kpi.on} format={count} sub={`${kpi.ranDay} ran in the last 24h`} />
        <KpiTile index={2} icon={PauseCircle} label="Paused / setting up" value={kpi.paused} format={count} sub="not running on schedule" />
        <KpiTile index={3} icon={AlertTriangle} label="Need attention" value={kpi.failing} format={count} sub={kpi.failing ? "last run failed" : "nothing failing"} />
        <KpiTile index={4} icon={CalendarClock} label="Next up" value={kpi.next ? 1 : 0} format={() => (kpi.next ? relTime(kpi.next.nextAt).replace("in ", "") : "—")} sub={kpi.next ? kpi.next.name : "nothing scheduled"} />
      </div>

      {!clientId && <RefreshNote meta={meta} />}

      <Panel
        title={clientId ? "Automations for this client" : "Every automation & notification"}
        subtitle="Claude scheduled tasks, app workflows and functions, Stripe, public endpoints and per-client automation records. Click a row for how it works."
        right={(
          <div className="flex items-center gap-1 rounded-md border border-hair bg-paper p-0.5">
            {[["list", "List"], ...(clientId ? [] : [["client", "By client"]])].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setView(k)} className={`rounded px-2.5 py-1 text-[11.5px] ${view === k ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}>{l}</button>
            ))}
            <button type="button" onClick={refetch} title="Reload" className="rounded px-2 py-1 text-ink/50 hover:text-[#ff3c00]"><RefreshCw className="h-3.5 w-3.5" /></button>
          </div>
        )}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, client, what it does…" className={`${selCls} w-full pl-8`} />
          </div>
          {!clientId && (
            <select value={client} onChange={(e) => setClient(e.target.value)} className={selCls} aria-label="Client">
              <option value="all">All clients + agency</option>
              <option value="agency">Agency & personal only</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.business}</option>)}
            </select>
          )}
          <select value={source} onChange={(e) => setSource(e.target.value)} className={selCls} aria-label="Source">
            <option value="all">Every source</option>
            {sources.map((s) => <option key={s} value={s}>{SOURCE_META[s]?.label || s}</option>)}
          </select>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={selCls} aria-label="Channel">
            <option value="all">Every channel</option>
            {channels.map((c) => <option key={c} value={c}>{CHANNEL_META[c] || c}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selCls} aria-label="Status">
            <option value="all">Any status</option>
            {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </div>

        {error ? (
          <EmptyState icon={AlertTriangle} title="Couldn't load the catalog" body={String(error.message || error)} compact />
        ) : isLoading ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-md bg-ink/[0.04]" />)}</div>
        ) : !filtered.length ? (
          <EmptyState icon={Zap} title="No automations match" body="Clear a filter, or refresh the catalog if you just added a scheduled task." compact />
        ) : groups ? (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.id}>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="label-cross">{g.name}</p>
                  {!g.id.startsWith("_") && <Link to={`/clients/${g.id}?tab=automations`} className="text-[11.5px] text-[#d83300] hover:underline">Open client</Link>}
                </div>
                <div className="overflow-hidden rounded-md border border-hair">{header}{g.rows.map((r) => <Row key={`${g.id}-${r.key}`} row={r} open={openKey === `${g.id}-${r.key}`} onToggle={() => setOpenKey(openKey === `${g.id}-${r.key}` ? null : `${g.id}-${r.key}`)} />)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-hair">{header}{filtered.map((r) => <Row key={r.key} row={r} open={openKey === r.key} onToggle={() => setOpenKey(openKey === r.key ? null : r.key)} />)}</div>
        )}
        <SourceNote>Next runs are worked out from each schedule · last runs from the catalog snapshot and the live AutomationRun log</SourceNote>
      </Panel>

      <Panel title="Latest reported runs" subtitle="What automations told Møthership they did (AutomationRun), newest first.">
        {!recentRuns.length ? (
          <EmptyState icon={Activity} title="No runs reported yet" compact />
        ) : (
          <ul className="divide-y divide-hair">
            {recentRuns.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5 text-[12.5px]">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${r.status === "failed" ? "bg-red-600" : r.status === "skipped" ? "bg-ink/30" : "bg-[#ff3c00]"}`} />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{r.automation_name || r.kind || "Automation"}</span>
                  {r.client_name ? <span className="text-ink/50"> · {r.client_name}</span> : null}
                  {r.message ? <span className="mt-0.5 line-clamp-2 block text-[11.5px] text-ink/50">{r.message}</span> : null}
                </span>
                <span className="shrink-0 tabular-nums text-[11.5px] text-ink/45">{fmtWhen(r.finished_at || r.started_at || r.created_date)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
