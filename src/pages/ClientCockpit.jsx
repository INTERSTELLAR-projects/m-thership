import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Eye, Rocket } from "lucide-react";
import StartServiceDialog from "@/features/tasks/StartServiceDialog";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useRecord, SERVICE_LABELS } from "@/lib/useData";
import { FormDialog, Tag } from "@/features/clients/ui";
import { OverviewTab, WorkTab, TasksTab, RequestsTab, AutomationsTab } from "@/features/clients/tabsWork";
import { PerformanceTab, GoalsTab, FilesTab, AuditTab, MessagesTab } from "@/features/clients/tabsGrowth";
import { ServicesTab, NotesTab, DocumentsTab } from "@/pages/CRM";
import ClientClaudeTab from "@/features/claude/ClientClaudeTab";

const TABS = [
  ["overview", "Overview"], ["claude", "✦ Claude"], ["work", "Work"], ["tasks", "Tasks"], ["requests", "Requests"], ["automations", "Automations"],
  ["performance", "Performance"], ["goals", "Goals & Gaps"], ["files", "Files & Brand"], ["audit", "Intake Audit"], ["messages", "Messages"], ["billing", "Billing & Notes"],
];

const PROFILE_FIELDS = [
  { name: "business", label: "Business name", type: "text", required: true },
  { name: "status", label: "Status", type: "select", options: ["Active", "Inactive", "Lead"], required: true },
  { name: "contact", label: "Main contact", type: "text" },
  { name: "emails", label: "Emails", type: "list" },
  { name: "phones", label: "Phones", type: "list" },
  { name: "domain", label: "Primary domain", type: "text", placeholder: "example.com" },
  { name: "industry", label: "Industry", type: "text" },
  { name: "location", label: "Location", type: "text" },
  { name: "plan", label: "Plan", type: "text", placeholder: "ALPHA + HyperCare+ Local" },
  { name: "services_managed", label: "What we manage", type: "multi", options: Object.entries(SERVICE_LABELS).map(([value, label]) => ({ value, label })) },
  { name: "site_app_id", label: "Website — Base44 app id", type: "text" },
  { name: "ops_app_id", label: "System — Base44 app id", type: "text" },
  { name: "started_on", label: "Client since", type: "date" },
  { name: "portal_enabled", label: "Client portal", type: "checkbox", hint: "Let this client log in to their portal" },
  { name: "portal_emails", label: "Portal login emails", type: "list", help: "Each email gets portal access to this client once invited" },
];

export default function ClientCockpit() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const go = (t) => setParams(t === "overview" ? {} : { tab: t }, { replace: true });
  const { data: client, isLoading } = useRecord("CRMClient", id);
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [starting, setStarting] = useState(false);
  const qc = useQueryClient();

  if (isLoading) return <div className="px-8 py-16 text-center text-ink/50">Loading…</div>;
  if (!client) return <div className="px-8 py-16 text-center text-ink/50">Client not found. <Link className="text-[#ff3c00]" to="/crm">Back to clients</Link></div>;

  const save = async (v) => {
    await base44.entities.CRMClient.update(client.id, v);
    qc.invalidateQueries({ queryKey: ["CRMClient"] });
  };
  const invite = async () => {
    const emails = (client.portal_emails || []).length ? client.portal_emails : (client.emails || []).slice(0, 1);
    if (!emails.length) { setEditing(true); return; }
    if (!window.confirm(`Send a portal invite to ${emails.join(", ")}?`)) return;
    setInviting(true);
    try {
      for (const e of emails) await base44.users.inviteUser(e, "user");
      await save({ portal_enabled: true, portal_emails: emails });
      window.alert("Invites sent. They'll only ever see their own portal.");
    } catch (err) {
      window.alert(`Invite failed: ${err?.message || err}`);
    } finally { setInviting(false); }
  };
  // The original CRM tabs pass the whole client object back.
  const legacyUpdate = async (updated) => {
    const { id: _id, created_date, updated_date, created_by, created_by_id, is_sample, ...fields } = updated; // eslint-disable-line no-unused-vars
    await save(fields);
  };
  const words = client.business.split(" ");
  const last = words.length > 1 ? words.pop() : null;

  return (
    <div className="pb-16">
      <div className="relative border-b border-hair px-5 pb-0 pt-6 md:px-8">
        <Link to="/crm" className="mono-label inline-flex items-center gap-1.5 text-[10px] text-ink/50 hover:text-[#ff3c00]"><ArrowLeft className="h-3 w-3" /> Clients</Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone={client.status === "Active" ? "green" : client.status === "Lead" ? "flame" : "muted"}>{client.status}</Tag>
              {(client.services_managed || []).map((s) => <Tag key={s} tone="ink">{SERVICE_LABELS[s] || s}</Tag>)}
            </div>
            <h1 className="mt-3 text-[34px] font-semibold leading-[0.95] tracking-[-0.045em] md:text-[46px]">
              {last ? <>{words.join(" ")} <span className="text-[#ff3c00]">/{last}</span></> : client.business}
            </h1>
            {(client.domain || client.websites?.[0]) && (
              <a href={`https://${(client.domain || client.websites[0]).replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[13px] text-ink/55 hover:text-[#ff3c00]">
                {client.domain || client.websites[0]} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setStarting(true)} className="btn-roll is-flame" title="Client bought a service: create its project and SOP to-do list">
              <span className="roll"><span>Start a service</span><span>Start a service</span></span><span className="box"><Rocket className="h-3.5 w-3.5" /></span>
            </button>
            <Link to={`/portal/${client.id}`} className="btn-roll is-ink"><span className="roll"><span>View their portal</span><span>View their portal</span></span><span className="box"><Eye className="h-3.5 w-3.5" /></span></Link>
            <button onClick={invite} disabled={inviting} className="btn-roll is-outline" title="Email each portal login an invite and turn the portal on">
              <span className="roll"><span>{inviting ? "Inviting…" : "Invite to portal"}</span><span>{inviting ? "Inviting…" : "Invite to portal"}</span></span>
            </button>
            <button onClick={() => setEditing(true)} className="btn-roll is-outline">
              <span className="roll"><span>Edit client</span><span>Edit client</span></span>
            </button>
          </div>
        </div>
        <nav className="no-scrollbar -mb-px mt-6 flex overflow-x-auto">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => go(k)} className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors ${tab === k ? "border-[#ff3c00] text-ink" : "border-transparent text-ink/50 hover:text-ink"}`}>{l}</button>
          ))}
        </nav>
      </div>

      <div key={tab} className="page-enter px-5 pt-6 md:px-8">
        {tab === "overview" && <OverviewTab client={client} onEdit={() => setEditing(true)} go={go} />}
        {tab === "claude" && <ClientClaudeTab client={client} />}
        {tab === "work" && <WorkTab client={client} />}
        {tab === "tasks" && <TasksTab client={client} />}
        {tab === "requests" && <RequestsTab client={client} />}
        {tab === "automations" && <AutomationsTab client={client} />}
        {tab === "performance" && <PerformanceTab client={client} />}
        {tab === "goals" && <GoalsTab client={client} />}
        {tab === "files" && <FilesTab client={client} />}
        {tab === "audit" && <AuditTab client={client} />}
        {tab === "messages" && <MessagesTab client={client} />}
        {tab === "billing" && (
          <div className="grid gap-6 xl:grid-cols-2">
            <div><p className="label-cross mb-3">(Services & billing)</p><ServicesTab client={client} update={legacyUpdate} /></div>
            <div className="space-y-6">
              <div><p className="label-cross mb-3">(Notes)</p><NotesTab client={client} update={legacyUpdate} /></div>
              <div><p className="label-cross mb-3">(Documents)</p><DocumentsTab client={client} update={legacyUpdate} /></div>
            </div>
          </div>
        )}
      </div>

      <StartServiceDialog open={starting} client={client} onClose={() => setStarting(false)} />
      <FormDialog open={editing} title="Edit client" fields={PROFILE_FIELDS} initial={client} onClose={() => setEditing(false)} onSubmit={save} />
    </div>
  );
}
