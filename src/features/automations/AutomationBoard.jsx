// Automations in plain words: "Needs attention" first (failed, off, late for its schedule, never ran, or ran with no
// went-live confirmation), each with a one-line reason and a fix; then groups by job (Content · Website & reviews ·
// Billing · System plumbing, collapsed). The technical type is only a muted tag. Used on /automations and on a client's
// Automations tab (clientId = that client: its own automations plus every-client ones).
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronDown, ChevronRight, RotateCw, Send, ArrowUpRight, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { queueCustom } from "@/features/claude/jobs";
import { useAutomationHub, appliesToClient } from "./useAutomationHub";
import { SOURCE_META, fmtWhen, relTime } from "./meta";
import { JOB_GROUPS, jobGroupOf, rowIssue, lastResultWords, scopeMatch, waitingForDomain, awaitingDomainIds } from "./board";
import { useList } from "@/lib/useData";

const ISSUE_TONE = { failed: "bg-red-600", off: "bg-ink/40", overdue: "bg-[#ff6a00]", never: "bg-[#ff6a00]", unverified: "bg-amber-500" };

function Tag({ source }) {
  return <span className="rounded border border-hair px-1.5 py-0.5 text-[10px] text-ink/40">{SOURCE_META[source]?.short || source}</span>;
}

function PlainRow({ row, open, onToggle, waiting }) {
  const on = row.enabled !== false && row.status !== "paused";
  return (
    <li className="border-b border-hair last:border-0">
      <button type="button" onClick={onToggle} className="grid w-full grid-cols-[16px_1fr] gap-3 px-3 py-2.5 text-left hover:bg-ink/[0.02] md:grid-cols-[16px_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_56px]">
        <span className="pt-0.5 text-ink/35">{open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2"><span className="truncate text-[13.5px] font-medium">{row.name}</span><Tag source={row.source} /></span>
          <span className="line-clamp-1 block text-[12px] text-ink/55">{row.description}</span>
        </span>
        <span className="hidden text-[12px] text-ink/65 md:block">{waiting ? <span className="text-[#c24100]">{waiting}</span> : row.nextAt ? <>Next {fmtWhen(row.nextAt)}<span className="block text-[10.5px] text-ink/40">{relTime(row.nextAt)}</span></> : <span className="text-ink/40">{row.schedule}</span>}</span>
        <span className={`hidden text-[12px] md:block ${row.lastStatus === "failed" ? "text-red-700" : "text-ink/65"}`}>{lastResultWords(row)}{row.lastAt ? <span className="block text-[10.5px] text-ink/40">{relTime(row.lastAt)}</span> : null}</span>
        <span className="hidden md:block"><span className={`inline-flex h-5 w-9 items-center rounded-full px-0.5 ${on ? "justify-end bg-[#ff3c00]" : "justify-start bg-ink/15"}`} aria-label={on ? "On" : "Off"}><span className="h-4 w-4 rounded-full bg-white" /></span></span>
      </button>
      {open ? (
        <div className="space-y-1.5 border-t border-dashed border-hair bg-ink/[0.015] px-3 py-3 pl-[40px] text-[12px] text-ink/70">
          <p>{row.how || row.description}</p>
          {waiting ? <p className="text-[#c24100]">{waiting}. It switches on by itself when the domain verifies.</p> : null}
          <p className="text-ink/50">Schedule: {row.schedule} · Last result: {lastResultWords(row)}{row.lastAt ? ` (${fmtWhen(row.lastAt)})` : ""} · {on ? "On" : "Off"}</p>
          {row.scope === "client" && row.clientIds.length ? <p>{row.clientIds.map((id, i) => <Link key={id} to={`/clients/${id}?tab=automations`} className="mr-2 text-[#d83300] hover:underline">{row.clientNames[i] || "Client"}</Link>)}</p> : null}
        </div>
      ) : null}
    </li>
  );
}

export default function AutomationBoard({ clientId = null, client = null, rowsOverride = null }) {
  const hub = useAutomationHub();
  const { toast } = useToast();
  const [scope, setScope] = useState("all");
  const [openKey, setOpenKey] = useState(null);
  const [shut, setShut] = useState(() => Object.fromEntries(JOB_GROUPS.map((g) => [g.id, !!g.collapsed])));
  const [sent, setSent] = useState({});

  const checklists = useList("BuildChecklist", { limit: 300 });
  const clientsById = useMemo(() => new Map((hub.clients || []).map((c) => [c.id, c])), [hub.clients]);
  const awaiting = useMemo(() => awaitingDomainIds(hub.clients, new Set((checklists.data || []).map((x) => x.client_id))), [hub.clients, checklists.data]);
  const waitOf = (r) => waitingForDomain(r, awaiting, clientsById);
  const rows = useMemo(() => (rowsOverride || hub.rows).filter((r) => (!clientId || appliesToClient(r, clientId)) && scopeMatch(r, scope)), [rowsOverride, hub.rows, clientId, scope]);
  const issues = useMemo(() => rows.map((r) => ({ row: r, issue: waitingForDomain(r, awaiting, clientsById) ? null : rowIssue(r) })).filter((x) => x.issue).sort((a, b) => ["failed", "overdue", "never", "unverified", "off"].indexOf(a.issue.kind) - ["failed", "overdue", "never", "unverified", "off"].indexOf(b.issue.kind)), [rows, awaiting, clientsById]);
  const grouped = useMemo(() => JOB_GROUPS.map((g) => ({ ...g, rows: rows.filter((r) => jobGroupOf(r) === g.id) })), [rows]);

  const clientFor = (row) => client || (row.clientIds?.[0] ? { id: row.clientIds[0], business: row.clientNames?.[0] || "" } : null);
  const fix = async (row, issue, how) => {
    const c = clientFor(row);
    const instructions = how === "rerun"
      ? `Re-run the automation "${row.name}" now${c?.business ? ` for ${c.business}` : ""}. Reason: ${issue.reason}. Schedule: ${row.schedule}. Confirm the result went live and log an AutomationRun. Do not publish a site, change DNS, delete data, touch billing or send any email or text; if a step needs that, stop and ask Justin.`
      : `Find out why the automation "${row.name}" needs attention and fix it${c?.business ? ` for ${c.business}` : ""}. Problem: ${issue.reason}. How it works: ${row.how || row.description}. Do not publish a site, change DNS, delete data, touch billing or send any email or text; if the fix needs that, stop and ask Justin.`;
    try {
      await queueCustom({ title: `${how === "rerun" ? "Re-run" : "Fix"}: ${row.name}`, kind: "task", instructions, client: c });
      setSent((s) => ({ ...s, [row.key]: how }));
      toast({ title: "Sent to Claude", description: `${row.name} · the queue runner picks it up within the hour (7 AM–9 PM PT).` });
    } catch (e) {
      toast({ title: "Couldn't send", description: String(e?.message || e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4" data-testid="automation-board">
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Which automations">
        {[["all", "All"], ["client", clientId ? "Just this client" : "Client-specific"], ["every", "Every client"], ...(clientId ? [] : [["agency", "Agency & personal"]])].map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={scope === k} onClick={() => setScope(k)} className={`h-8 rounded-full px-3 text-[12px] ${scope === k ? "bg-ink text-white" : "border border-hair bg-card text-ink/65 hover:border-ink/30"}`}>{l}</button>
        ))}
      </div>

      <section className="overflow-hidden rounded-md border border-hair bg-card" data-testid="automations-attention">
        <header className="flex items-center gap-2 border-b border-hair px-4 py-3">
          <AlertTriangle className={`h-4 w-4 ${issues.length ? "text-[#ff3c00]" : "text-ink/30"}`} />
          <h3 className="text-[15px] font-semibold tracking-[-0.02em]">Needs attention</h3>
          <span className="font-mono text-[11px] text-ink/45">{hub.isLoading ? "…" : issues.length}</span>
        </header>
        {!hub.isLoading && !issues.length ? (
          <p className="flex items-center gap-2 px-4 py-4 text-[12.5px] text-ink/55"><Check className="h-4 w-4 text-green-700" />Everything is running on schedule.</p>
        ) : (
          <ul className="divide-y divide-hair">
            {issues.map(({ row, issue }) => (
              <li key={row.key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${ISSUE_TONE[issue.kind]}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{row.name}{!clientId && row.scope === "client" && row.clientNames[0] ? <span className="text-ink/45"> · {row.clientNames[0]}</span> : null}</span>
                  <span className="block text-[12px] text-ink/60">{issue.reason}</span>
                </span>
                {sent[row.key] ? <span className="text-[11.5px] text-ink/50">Sent to Claude</span> : (
                  <span className="flex shrink-0 gap-1.5">
                    {issue.fix === "rerun" ? <button type="button" onClick={() => fix(row, issue, "rerun")} className="inline-flex h-8 items-center gap-1 rounded-md border border-hair px-2.5 text-[12px] hover:border-ink/40"><RotateCw className="h-3.5 w-3.5" />Re-run</button> : null}
                    <button type="button" onClick={() => fix(row, issue, "claude")} className="inline-flex h-8 items-center gap-1 rounded-md border border-hair px-2.5 text-[12px] hover:border-ink/40"><Send className="h-3.5 w-3.5" />Send to Claude</button>
                    {row.scope === "client" && row.clientIds[0] && !clientId
                      ? <Link to={`/clients/${row.clientIds[0]}?tab=automations`} className="inline-flex h-8 items-center gap-1 rounded-md border border-hair px-2.5 text-[12px] hover:border-ink/40">Open<ArrowUpRight className="h-3.5 w-3.5" /></Link>
                      : <button type="button" onClick={() => setOpenKey(row.key)} className="inline-flex h-8 items-center gap-1 rounded-md border border-hair px-2.5 text-[12px] hover:border-ink/40">Open</button>}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {grouped.map((g) => (
        <section key={g.id} className="overflow-hidden rounded-md border border-hair bg-card" data-group={g.id}>
          <button type="button" onClick={() => setShut((s) => ({ ...s, [g.id]: !s[g.id] }))} aria-expanded={!shut[g.id]} className="flex w-full items-center gap-2 px-4 py-3 text-left">
            {shut[g.id] ? <ChevronRight className="h-4 w-4 text-ink/40" /> : <ChevronDown className="h-4 w-4 text-ink/40" />}
            <span className="text-[14.5px] font-semibold">{g.label}</span>
            <span className="font-mono text-[11px] text-ink/45">{g.rows.length}</span>
            <span className="hidden text-[12px] text-ink/45 sm:inline">· {g.hint}</span>
          </button>
          {!shut[g.id] ? (g.rows.length ? (
            <ul className="border-t border-hair">
              {g.rows.map((r) => <PlainRow key={r.key} row={r} waiting={waitOf(r)} open={openKey === r.key} onToggle={() => setOpenKey(openKey === r.key ? null : r.key)} />)}
            </ul>
          ) : <p className="border-t border-hair px-4 py-3 text-[12px] text-ink/45">Nothing here.</p>) : null}
        </section>
      ))}
    </div>
  );
}
