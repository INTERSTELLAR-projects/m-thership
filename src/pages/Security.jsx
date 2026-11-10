import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, AlertTriangle, ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useList } from "@/lib/useData";
import { cn } from "@/lib/utils";
import { buildRows, AUDIT_VERSION } from "@/features/security/auditData";

const SYNC_FIELDS = ["client_id", "client_name", "app_name", "app_kind", "check_label", "group", "status", "severity", "finding", "fix", "checkpoint", "checked_at"];

// Upsert the audit file into SecurityCheck (match on app_id + check_key). Admin-only entity, so this only
// succeeds for Justin; anyone else simply sees nothing.
async function syncAudit(existing) {
  const byKey = new Map(existing.map((r) => [`${r.app_id}|${r.check_key}`, r]));
  const toCreate = [];
  const toUpdate = [];
  for (const r of buildRows()) {
    const cur = byKey.get(`${r.app_id}|${r.check_key}`);
    if (!cur) { toCreate.push(r); continue; }
    if (SYNC_FIELDS.some((k) => (cur[k] ?? "") !== (r[k] ?? ""))) toUpdate.push([cur.id, r]);
  }
  for (let i = 0; i < toCreate.length; i += 50) await base44.entities.SecurityCheck.bulkCreate(toCreate.slice(i, i + 50));
  for (const [id, r] of toUpdate) await base44.entities.SecurityCheck.update(id, r);
  return toCreate.length + toUpdate.length;
}

// Security scoreboard: one SecurityCheck row per app per check (written by the Nov 2026 hardening pass).
// Fixes live in each app's Base44 checkpoints; nothing here is published until Justin publishes the app.

const STATUS = {
  needs_justin: { label: "Needs you", tone: "bg-amber-100 text-amber-900", order: 0 },
  fail: { label: "Open", tone: "bg-red-100 text-red-800", order: 1 },
  fixed: { label: "Fixed", tone: "bg-[#ff6a00]/15 text-[#c24100]", order: 2 },
  pass: { label: "Pass", tone: "bg-emerald-100 text-emerald-800", order: 3 },
  n_a: { label: "N/A", tone: "bg-ink/[0.06] text-ink/50", order: 4 },
};
const SEVERITY = { critical: 0, high: 1, medium: 2, low: 3 };
const SEV_TONE = { critical: "text-red-700", high: "text-[#c24100]", medium: "text-amber-700", low: "text-ink/45" };
const GROUP_LABEL = { prelaunch: "Pre-launch", attack: "Attack vectors", rate_limit: "Rate limits", privacy: "Privacy", testing: "Testing" };
const KIND_LABEL = { website: "Website", system: "Command system", portal: "Portal", internal: "Internal" };

function Chip({ status }) {
  const s = STATUS[status] || STATUS.n_a;
  return <span className={cn("mono-label shrink-0 rounded-sm px-1.5 py-0.5 text-[9px]", s.tone)}>{s.label}</span>;
}

function countsOf(rows) {
  const c = { pass: 0, fixed: 0, fail: 0, needs_justin: 0, n_a: 0, total: rows.length };
  for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
  c.done = c.pass + c.fixed + c.n_a;
  c.score = c.total ? Math.round((c.done / c.total) * 100) : 0;
  return c;
}

function ProgressBar({ c }) {
  const pct = (n) => (c.total ? `${(n / c.total) * 100}%` : "0%");
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.07]" aria-label={`${c.score}% passing or fixed`}>
      <div className="bg-emerald-500" style={{ width: pct(c.pass + c.n_a) }} />
      <div className="bg-[#ff6a00]" style={{ width: pct(c.fixed) }} />
      <div className="bg-amber-400" style={{ width: pct(c.needs_justin) }} />
      <div className="bg-red-500" style={{ width: pct(c.fail) }} />
    </div>
  );
}

function CheckRow({ r }) {
  const [open, setOpen] = useState(r.status === "fail" || r.status === "needs_justin");
  const hasBody = r.finding || r.fix || r.checkpoint;
  return (
    <li className="border-t border-hair first:border-t-0">
      <button type="button" onClick={() => hasBody && setOpen((v) => !v)} className="flex w-full items-start gap-2 px-4 py-2.5 text-left hover:bg-ink/[0.02]">
        <Chip status={r.status} />
        <span className="min-w-0 flex-1 text-[13px]">{r.check_label || r.check_key}</span>
        {r.severity && r.status !== "pass" && r.status !== "n_a" && <span className={cn("mono-label shrink-0 text-[9px]", SEV_TONE[r.severity])}>{r.severity}</span>}
        <span className="mono-label hidden shrink-0 text-[9px] text-ink/35 sm:inline">{GROUP_LABEL[r.group] || r.group}</span>
      </button>
      {open && hasBody && (
        <div className="space-y-1.5 px-4 pb-3 pl-[4.25rem] text-[12.5px] leading-relaxed">
          {r.finding && <p className="text-ink/75"><span className="mono-label mr-1.5 text-[9px] text-ink/40">Finding</span>{r.finding}</p>}
          {r.fix && <p className="text-ink/75"><span className="mono-label mr-1.5 text-[9px] text-ink/40">Fix</span>{r.fix}</p>}
          {r.checkpoint && <p className="text-ink/50"><span className="mono-label mr-1.5 text-[9px] text-ink/40">Checkpoint</span>{r.checkpoint}</p>}
        </div>
      )}
    </li>
  );
}

function AppCard({ app }) {
  const [open, setOpen] = useState(false);
  const c = countsOf(app.rows);
  const rows = [...app.rows].sort((a, b) => (STATUS[a.status]?.order ?? 9) - (STATUS[b.status]?.order ?? 9) || (SEVERITY[a.severity] ?? 9) - (SEVERITY[b.severity] ?? 9));
  return (
    <div className="overflow-hidden rounded-md border border-hair bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full px-4 py-3.5 text-left hover:bg-ink/[0.02]">
        <div className="flex items-start gap-2">
          {open ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-semibold tracking-[-0.01em]">{app.app_name}</p>
            <p className="mono-label mt-0.5 text-[9px] text-ink/45">{KIND_LABEL[app.app_kind] || app.app_kind} · {app.client_name}</p>
          </div>
          <span className="font-mono text-[18px] font-semibold tabular-nums">{c.score}<span className="text-[11px] text-ink/40">%</span></span>
        </div>
        <div className="mt-3 pl-6"><ProgressBar c={c} /></div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 pl-6 font-mono text-[11px] text-ink/55">
          <span>{c.pass} pass</span><span className="text-[#c24100]">{c.fixed} fixed</span>
          {c.needs_justin > 0 && <span className="text-amber-700">{c.needs_justin} need you</span>}
          {c.fail > 0 && <span className="text-red-700">{c.fail} open</span>}
          {c.n_a > 0 && <span className="text-ink/40">{c.n_a} n/a</span>}
        </div>
      </button>
      {open && <ul className="border-t border-hair">{rows.map((r) => <CheckRow key={r.id} r={r} />)}</ul>}
    </div>
  );
}

export default function Security() {
  const { data: all = [], isLoading, isFetched } = useList("SecurityCheck", { sort: "app_name", limit: 2000 });
  const [client, setClient] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const synced = useRef(false);
  const qc = useQueryClient();
  const runSync = async () => {
    setSyncing(true);
    try { const n = await syncAudit(all); if (n) qc.invalidateQueries({ queryKey: ["SecurityCheck"] }); } catch (e) { console.warn("security sync", e?.message); } finally { setSyncing(false); }
  };
  useEffect(() => {
    if (!isFetched || synced.current) return;
    synced.current = true;
    runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFetched]);

  const clients = useMemo(() => {
    const m = new Map();
    for (const r of all) if (!m.has(r.client_id)) m.set(r.client_id, r.client_name || r.client_id);
    return [...m.entries()].sort((a, b) => (a[0] === "agency" ? -1 : b[0] === "agency" ? 1 : String(a[1]).localeCompare(String(b[1]))));
  }, [all]);

  const rows = useMemo(() => (client === "all" ? all : all.filter((r) => r.client_id === client)), [all, client]);
  const apps = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.app_id)) m.set(r.app_id, { app_id: r.app_id, app_name: r.app_name, app_kind: r.app_kind, client_id: r.client_id, client_name: r.client_name, rows: [] });
      m.get(r.app_id).rows.push(r);
    }
    return [...m.values()].sort((a, b) => {
      const ca = countsOf(a.rows), cb = countsOf(b.rows);
      return (cb.fail + cb.needs_justin) - (ca.fail + ca.needs_justin) || ca.score - cb.score || String(a.app_name).localeCompare(String(b.app_name));
    });
  }, [rows]);
  const needs = useMemo(() => rows.filter((r) => r.status === "needs_justin").sort((a, b) => (SEVERITY[a.severity] ?? 9) - (SEVERITY[b.severity] ?? 9)), [rows]);
  const total = countsOf(rows);
  const lastChecked = rows.reduce((m, r) => (r.checked_at && r.checked_at > m ? r.checked_at : m), "");

  return (
    <div className="px-5 pb-10 pt-6 md:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-cross">(Security)</p>
          <h1 className="mt-1 flex items-center gap-2 text-[26px] font-semibold tracking-[-0.03em]"><ShieldCheck className="h-6 w-6 text-[#ff3c00]" /> Security</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-ink/55">
            Every Base44 app checked against the pre-launch 20, the 20 common attacks, rate limits and font privacy. Fixes sit in each app&apos;s checkpoints and go live when you publish that app.
            {lastChecked ? ` Last checked ${lastChecked}.` : ""}
          </p>
        </div>
        <div className="min-w-[220px] flex-1 sm:max-w-xs">
          <div className="flex items-baseline justify-between font-mono text-[11px] text-ink/55">
            <span>{apps.length} apps · {total.total} checks</span><span className="text-[15px] font-semibold text-ink">{total.score}%</span>
          </div>
          <div className="mt-1.5"><ProgressBar c={total} /></div>
          <button type="button" onClick={runSync} disabled={syncing} className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10.5px] text-ink/45 hover:text-[#ff3c00] disabled:opacity-60">
            <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} /> {syncing ? "Syncing audit…" : `Audit ${AUDIT_VERSION}`}
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-[13px] text-ink/55"><Loader2 className="h-4 w-4 animate-spin" /> Loading checks…</p>
      ) : !all.length ? (
        <p className="flex items-center gap-2 rounded-sm bg-ink/[0.04] px-3 py-2.5 text-[13px] text-ink/60">{syncing && <Loader2 className="h-4 w-4 animate-spin" />}{syncing ? "Loading the latest audit into Security checks…" : "No security checks recorded yet."}</p>
      ) : (
        <>
          {needs.length > 0 && (
            <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="mono-label flex items-center gap-1.5 text-[9.5px] text-amber-800"><AlertTriangle className="h-3 w-3" /> Needs you ({needs.length})</p>
              <ol className="mt-2 space-y-1.5">
                {needs.map((r) => (
                  <li key={r.id} className="text-[13px] text-amber-950">
                    <span className="font-semibold">{r.app_name}</span>
                    <span className={cn("mono-label ml-1.5 text-[9px]", SEV_TONE[r.severity])}>{r.severity}</span>
                    <span className="text-amber-900/80"> · {r.check_label}: </span>{r.fix || r.finding}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter by client">
            {[["all", "All clients"], ...clients].map(([id, name]) => (
              <button key={id} type="button" onClick={() => setClient(id)}
                className={cn("rounded-sm border px-2.5 py-1 text-[12px]", client === id ? "border-[#ff3c00] bg-[#ff3c00]/10 text-[#c24100]" : "border-hair text-ink/65 hover:border-ink/30")}>
                {id === "agency" ? "Interstellar" : name}
              </button>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {apps.map((a) => <AppCard key={a.app_id} app={a} />)}
          </div>
          <p className="mt-6 text-[12px] text-ink/45">
            Open the client in <Link to="/crm" className="hover:text-[#ff3c00]">CRM</Link> for context. Green = pass, orange = fixed in a checkpoint, amber = needs you, red = still open.
          </p>
        </>
      )}
    </div>
  );
}
