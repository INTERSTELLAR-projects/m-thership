import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { timeAgo } from "@/lib/useData";
import useOutreach from "./useOutreach";
import ApprovalInbox from "./ApprovalInbox";
import { KpiTiles, PerClientTable, PipelineBoard, ManualQueue, ActivityFeed } from "./Views";
import { CriteriaPanel, AddTarget, CsvImport, RulesEditor } from "./Setup";
import { HUMAN_METHODS, inputCls } from "./lib";

// Backlinks & Citations: live dashboard over what Claude's outreach tasks read and write.
// Approving here only flips status; sending happens in the scheduled SEND task (docs/outreach-agent.md).
export default function OutreachPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "inbox";
  const clientId = params.get("client") || "";
  const setQ = (patch) => {
    const next = { tab, client: clientId, ...patch };
    const clean = Object.fromEntries(Object.entries(next).filter(([k, v]) => v && !(k === "tab" && v === "inbox")));
    setParams(clean, { replace: true });
  };

  const d = useOutreach();
  const targets = useMemo(() => (clientId ? d.targets.filter((t) => t.client_id === clientId) : d.targets), [d.targets, clientId]);
  const messages = useMemo(() => (clientId ? d.messages.filter((m) => m.client_id === clientId) : d.messages), [d.messages, clientId]);
  const runs = useMemo(() => (clientId ? d.runs.filter((r) => !r.client_id || r.client_id === clientId) : d.runs), [d.runs, clientId]);
  const clientsShown = clientId ? d.clients.filter((c) => c.id === clientId) : d.clients;

  const awaiting = messages.filter((m) => m.status === "needs_approval" || m.status === "rewrite_requested").length;
  const manual = targets.filter((t) => HUMAN_METHODS.includes(t.submission_method) && ["qualified", "drafted", "approved"].includes(t.status)).length;
  const notReady = clientsShown.filter((c) => d.criteria[c.id]?.profile?.enabled && !d.criteria[c.id]?.ready).length;

  const TABS = [
    ["inbox", `Approval inbox${awaiting ? ` · ${awaiting}` : ""}`],
    ["pipeline", "Pipeline"],
    ["manual", `Needs you${manual ? ` · ${manual}` : ""}`],
    ["activity", "Activity"],
    ["criteria", `Client criteria${notReady ? ` · ${notReady}` : ""}`],
    ["add", "Add / import"],
    ["rules", "Outreach rules"],
  ];

  return (
    <div className="pb-16">
      <PageHeader breadcrumb="Signals / Backlinks & Citations" title="Backlinks & Citations" rightText={d.updatedAt ? `Live · synced ${timeAgo(d.updatedAt.toISOString())}` : "Connecting…"}>
        <select className={`${inputCls} h-10 w-[220px]`} value={clientId} onChange={(e) => setQ({ client: e.target.value })}>
          <option value="">All clients</option>
          {d.clients.map((c) => <option key={c.id} value={c.id}>{c.business}</option>)}
        </select>
      </PageHeader>

      <div className="space-y-4 px-5 pt-6 md:px-8">
        {d.loading ? <p className="text-[13px] text-ink/50">Loading…</p> : <KpiTiles targets={targets} messages={messages} />}
        {!clientId && !d.loading && <PerClientTable clients={d.clients} targets={d.targets} messages={d.messages} criteria={d.criteria} onPick={(id) => setQ({ client: id })} />}
      </div>

      <nav className="no-scrollbar mt-6 flex overflow-x-auto border-b border-hair px-5 md:px-8">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setQ({ tab: k })} className={`-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors ${tab === k ? "border-[#ff3c00] text-ink" : "border-transparent text-ink/50 hover:text-ink"}`}>{l}</button>
        ))}
      </nav>

      <div key={tab} className="page-enter px-5 pt-5 md:px-8">
        {tab === "inbox" && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <ApprovalInbox messages={messages} targets={d.targets} rules={d.rules} onPatch={d.patch} />
            <div className="space-y-2">
              <p className="label-cross">Recent agent activity</p>
              <ActivityFeed runs={runs} targets={targets} messages={messages} limit={12} />
            </div>
          </div>
        )}
        {tab === "pipeline" && <PipelineBoard targets={targets} onPatch={d.patch} showClient={!clientId} />}
        {tab === "manual" && <ManualQueue targets={targets} criteria={d.criteria} onPatch={d.patch} />}
        {tab === "activity" && <ActivityFeed runs={runs} targets={targets} messages={messages} limit={60} />}
        {tab === "criteria" && <CriteriaPanel clients={clientsShown} criteria={d.criteria} single={!!clientId} />}
        {tab === "add" && (
          <div className="grid gap-5 xl:grid-cols-2">
            <AddTarget clients={d.clients} defaultClientId={clientId} />
            <CsvImport clients={d.clients} targets={d.targets} defaultClientId={clientId} />
          </div>
        )}
        {tab === "rules" && (
          <div className="max-w-3xl">
            {d.loading ? <p className="text-[13px] text-ink/50">Loading…</p> : <RulesEditor rules={d.rules} rulesId={d.rulesId} />}
          </div>
        )}
      </div>
    </div>
  );
}
