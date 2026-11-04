import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Eye, Mail, Rocket } from "lucide-react";
import StartServiceDialog from "@/features/tasks/StartServiceDialog";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useRecord, SERVICE_LABELS } from "@/lib/useData";
import { FormDialog, Tag } from "@/features/clients/ui";
import { OverviewTab, WorkTab, TasksTab, RequestsTab, AutomationsTab } from "@/features/clients/tabsWork";
import { PerformanceTab, GoalsTab, FilesTab, AuditTab, MessagesTab } from "@/features/clients/tabsGrowth";
import { ServicesTab, NotesTab, DocumentsTab } from "@/pages/CRM";
import ClientClaudeTab from "@/features/claude/ClientClaudeTab";
import ConstellationsTab from "@/features/constellations/ConstellationsTab";
import BrandKitTab from "@/features/clients/BrandKitTab";
import PlaybookTab from "@/features/clients/PlaybookTab";
import SocialPlanTab from "@/features/clients/SocialPlanTab";
import ResourcesTab from "@/features/clients/ResourcesTab";
import ContentPlanTab from "@/features/clients/ContentPlanTab";
import MapPackTab from "@/features/clients/MapPackTab";
import { ClientGbpTab } from "@/features/gbp/GbpPanel";
import ClientAutomationsCard from "@/features/automations/ClientAutomationsCard";
import { useOptionList } from "@/hooks/useOptionList";
import ClientOutreachTab from "@/features/outreach/ClientOutreachTab";
import ProfileMeter from "@/features/clients/ProfileMeter";
import PortalInviteDialog from "@/features/clients/PortalInviteDialog";
import { ClientRecentEmails, emailClientPath } from "@/features/email/ClientEmails";
import { ClientUsageCard } from "@/features/usage/ClientUsagePage";
import EngineChecklist from "@/features/launch/EngineChecklist";

const TABS = [
  ["overview", "Overview"], ["constellations", "✧ Constellations"], ["claude", "✦ Claude"], ["work", "Work"], ["tasks", "Tasks"], ["requests", "Requests"], ["automations", "Automations"],
  ["performance", "Performance"], ["gbp", "Google Business"], ["mappack", "Map pack"], ["citations", "Citations & PR"], ["goals", "Goals & Gaps"], ["brand", "Brand kit"], ["playbook", "Playbook"], ["social", "Social plan"], ["content", "Content plan"], ["resources", "Portal resources"], ["files", "Files & Brand"], ["audit", "Intake Audit"], ["messages", "Messages"], ["billing", "Billing & Notes"],
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
  const industries = useOptionList("client_industries").labels;

  if (isLoading) return <div className="px-8 py-16 text-center text-ink/50">Loading…</div>;
  if (!client) return <div className="px-8 py-16 text-center text-ink/50">Client not found. <Link className="text-[#ff3c00]" to="/crm">Back to clients</Link></div>;

  const save = async (v) => {
    await base44.entities.CRMClient.update(client.id, v);
    qc.invalidateQueries({ queryKey: ["CRMClient"] });
  };
  // Opens the in-app invite dialog; the portal-invite function does the inviting and logging.
  const invite = () => setInviting(true);
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
            <Link to={emailClientPath(client.id)} className="btn-roll is-outline" title="Open Email Studio with this client as the recipient"><span className="roll"><span>Email client</span><span>Email client</span></span><span className="box"><Mail className="h-3.5 w-3.5" /></span></Link>
            <Link to={`/portal/${client.id}`} className="btn-roll is-ink"><span className="roll"><span>View their portal</span><span>View their portal</span></span><span className="box"><Eye className="h-3.5 w-3.5" /></span></Link>
            <button onClick={invite} className="btn-roll is-outline" title="Send a portal login its secure invite and turn the portal on">
              <span className="roll"><span>Invite to portal</span><span>Invite to portal</span></span>
            </button>
            <button onClick={() => setEditing(true)} className="btn-roll is-outline">
              <span className="roll"><span>Edit client</span><span>Edit client</span></span>
            </button>
          </div>
        </div>
        <ProfileMeter client={client} go={go} />
        <nav className="no-scrollbar -mb-px mt-6 flex overflow-x-auto">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => go(k)} className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors ${tab === k ? "border-[#ff3c00] text-ink" : "border-transparent text-ink/50 hover:text-ink"}`}>{l}</button>
          ))}
        </nav>
      </div>

      <div key={tab} className="page-enter px-5 pt-6 md:px-8">
        {tab === "overview" && <><EngineChecklist client={client} /><OverviewTab client={client} onEdit={() => setEditing(true)} go={go} /><ClientRecentEmails client={client} /><ClientUsageCard client={client} /></>}
        {tab === "constellations" && <ConstellationsTab client={client} />}
        {tab === "claude" && <ClientClaudeTab client={client} />}
        {tab === "work" && <WorkTab client={client} />}
        {tab === "tasks" && <TasksTab client={client} />}
        {tab === "requests" && <RequestsTab client={client} />}
        {tab === "automations" && <><ClientAutomationsCard client={client} /><AutomationsTab client={client} /></>}
        {tab === "performance" && <PerformanceTab client={client} />}
        {tab === "gbp" && <ClientGbpTab client={client} />}
        {tab === "mappack" && <MapPackTab client={client} />}
        {tab === "citations" && <ClientOutreachTab client={client} />}
        {tab === "goals" && <GoalsTab client={client} />}
        {tab === "brand" && <BrandKitTab client={client} />}
        {tab === "playbook" && <PlaybookTab client={client} />}
        {tab === "social" && <SocialPlanTab client={client} />}
        {tab === "resources" && <ResourcesTab client={client} go={go} />}
        {tab === "content" && <ContentPlanTab client={client} onEdit={() => setEditing(true)} />}
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
      <PortalInviteDialog open={inviting} client={client} onClose={() => setInviting(false)} onEditClient={() => setEditing(true)} />
      <FormDialog open={editing} title="Edit client" fields={PROFILE_FIELDS.map((f) => (f.name === "industry" ? { ...f, suggestions: industries, placeholder: "Category · detail" } : f))} initial={client} onClose={() => setEditing(false)} onSubmit={save} />
    </div>
  );
}
