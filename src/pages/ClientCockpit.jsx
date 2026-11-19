import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Eye, Mail, Rocket, MoreHorizontal, Send, Pencil } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import StartServiceDialog from "@/features/tasks/StartServiceDialog";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useRecord, SERVICE_LABELS } from "@/lib/useData";
import { FormDialog, Tag } from "@/features/clients/ui";
import { OverviewTab, WorkTab, TasksTab, RequestsTab, AutomationsTab } from "@/features/clients/tabsWork";
import { PerformanceTab, GoalsTab, FilesTab, AuditTab, MessagesTab } from "@/features/clients/tabsGrowth";
import { ServicesTab, NotesTab, DocumentsTab } from "@/pages/CRM";
import ClientClaudeTab from "@/features/claude/ClientClaudeTab";
import ClientAgentsView from "@/features/clients/ClientAgentsView";
import BrainDossierTab from "@/features/clients/BrainDossierTab";
import BrandKitTab from "@/features/clients/BrandKitTab";
import PlaybookTab from "@/features/clients/PlaybookTab";
import SocialPlanTab from "@/features/clients/SocialPlanTab";
import ResourcesTab from "@/features/clients/ResourcesTab";
import SystemsTab from "@/features/clients/SystemsTab";
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
import ErrorBoundary from "@/components/ErrorBoundary";
import ClientCallsTab from "@/features/calls/ClientCallsTab";
import EngineChecklist from "@/features/launch/EngineChecklist";
import { PrepStrip } from "@/features/prep/PrepChecklist";
import { useBrands } from "@/features/brands/useHouseData";
import { brandFieldOptions } from "@/features/brands/graph";

// Five sections instead of 23 tabs. Every old tab still exists (as a sub-tab) and every old ?tab= link still opens it.
// Where each old tab now lives: Agents (agents, claude, automations) · Work (overview, tasks, requests, work, calls,
// messages) · Growth (performance, goals, gbp, mappack, citations, content, social) · Brain & brand (profile, dossier,
// brand, playbook, audit, files) · Setup & billing (billing, systems, resources).
const SECTIONS = [
  { key: "agents", label: "Agents", hint: "What is running for this client, wired to their Brain", tabs: [["agents", "Live view"], ["claude", "Claude jobs"], ["automations", "Automations"]] },
  { key: "work", label: "Work", hint: "Summary, tasks, requests and conversations", tabs: [["overview", "Summary"], ["tasks", "Tasks"], ["requests", "Requests"], ["work", "Work log"], ["calls", "Calls"], ["messages", "Messages"]] },
  { key: "growth", label: "Growth", hint: "Results, goals and the plans that drive them", tabs: [["performance", "Performance"], ["goals", "Goals & gaps"], ["gbp", "Google Business"], ["mappack", "Map pack"], ["citations", "Citations & PR"], ["content", "Content plan"], ["social", "Social plan"]] },
  { key: "brain", label: "Brain & brand", hint: "What we know about them, and their brand", tabs: [["profile", "Profile"], ["dossier", "Dossier"], ["brand", "Brand kit"], ["playbook", "Playbook"], ["audit", "Intake audit"], ["files", "Files"]] },
  { key: "setup", label: "Setup & billing", hint: "Services, notes, systems and portal resources", tabs: [["billing", "Billing & notes"], ["systems", "Systems"], ["resources", "Portal resources"]] },
];
const ALIAS = { constellations: "agents", "": "agents" };
const sectionOf = (t) => SECTIONS.find((x) => x.tabs.some(([k]) => k === t)) || SECTIONS[0];

const PROFILE_FIELDS = [
  { name: "business", label: "Business name", type: "text", required: true },
  { name: "status", label: "Status", type: "select", options: ["Active", "Inactive", "Lead"], required: true },
  { name: "contact", label: "Main contact", type: "text" },
  { name: "emails", label: "Emails", type: "list" },
  { name: "phones", label: "Phones", type: "list" },
  { name: "domain", label: "Primary domain", type: "text", placeholder: "example.com" },
  { name: "industry", label: "Industry", type: "text" },
  // House of Brands: options filled from the Brand records at render. Empty = Interstellar direct.
  { name: "brand_id", label: "Brand", type: "select", options: [], emptyLabel: "Interstellar direct", help: "Which brand this client was sold through. Its brain rolls up to that brand." },
  { name: "location", label: "Location", type: "text" },
  { name: "plan", label: "Plan", type: "text", placeholder: "ALPHA + HyperCare+ Local" },
  { name: "services_managed", label: "What we manage", type: "multi", options: Object.entries(SERVICE_LABELS).map(([value, label]) => ({ value, label })) },
  { name: "site_app_id", label: "Website — Base44 app id", type: "text" },
  { name: "ops_app_id", label: "System — Base44 app id", type: "text" },
  { name: "command_app_id", label: "Command app — Base44 app id (brain sync)", type: "text" },
  { name: "started_on", label: "Client since", type: "date" },
  { name: "portal_enabled", label: "Client portal", type: "checkbox", hint: "Let this client log in to their portal" },
  { name: "portal_emails", label: "Portal login emails", type: "list", help: "Each email gets portal access to this client once invited" },
];

export default function ClientCockpit() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") || "";
  const tab = ALIAS[raw] || (SECTIONS.some((x) => x.tabs.some(([k]) => k === raw)) ? raw : "agents");
  const section = sectionOf(tab);
  const go = (t) => setParams(t === "agents" ? {} : { tab: t }, { replace: true });
  const { data: client, isLoading } = useRecord("CRMClient", id);
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [starting, setStarting] = useState(false);
  const qc = useQueryClient();
  const industries = useOptionList("client_industries").labels;
  const { data: brands = [] } = useBrands();

  if (isLoading) return <div className="px-8 py-16 text-center text-ink/50">Loading…</div>;
  if (!client) return <div className="px-8 py-16 text-center text-ink/50">Client not found. <Link className="text-[#ff3c00]" to="/crm">Back to clients</Link></div>;

  const save = async (v) => {
    await base44.entities.CRMClient.update(client.id, v);
    qc.invalidateQueries({ queryKey: ["CRMClient"] });
    qc.invalidateQueries({ queryKey: ["house-of-brands"] });
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex h-10 w-10 items-center justify-center border border-hair bg-paper text-ink/65 transition-colors hover:border-[#ff3c00] hover:text-[#ff3c00]" style={{ borderRadius: 4 }} aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setEditing(true)}><Pencil className="mr-2 h-3.5 w-3.5" />Edit client</DropdownMenuItem>
                <DropdownMenuItem onClick={invite}><Send className="mr-2 h-3.5 w-3.5" />Invite to portal</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <nav className="no-scrollbar -mb-px mt-6 flex overflow-x-auto" aria-label="Client sections">
          {SECTIONS.map((x) => (
            <button key={x.key} type="button" aria-current={section.key === x.key ? "page" : undefined} onClick={() => go(x.tabs[0][0])} className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-[14px] font-medium transition-colors ${section.key === x.key ? "border-[#ff3c00] text-ink" : "border-transparent text-ink/50 hover:text-ink"}`}>{x.label}</button>
          ))}
        </nav>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 md:px-8">
        <div className="seg-ms no-scrollbar flex max-w-full overflow-x-auto" role="tablist" aria-label={`${section.label} views`}>
          {section.tabs.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => go(k)} className={tab === k ? "on" : ""}>{l}</button>
          ))}
        </div>
        <p className="hidden text-[12.5px] text-ink/45 lg:block">{section.hint}</p>
      </div>

      <div className="px-5 pt-4 md:px-8"><ErrorBoundary compact where="client prep"><PrepStrip client={client} /></ErrorBoundary></div>

      <div key={tab} className="page-enter px-5 pt-4 md:px-8">
        {tab === "agents" && <ErrorBoundary where="client agents"><ClientAgentsView client={client} go={go} /></ErrorBoundary>}
        {tab === "profile" && <ProfileMeter client={client} go={go} startOpen />}
        {tab === "dossier" && <ErrorBoundary where="dossier"><BrainDossierTab client={client} /></ErrorBoundary>}
        {tab === "overview" && <><ErrorBoundary compact where="engine checklist"><EngineChecklist client={client} /></ErrorBoundary><OverviewTab client={client} onEdit={() => setEditing(true)} go={go} /><ErrorBoundary compact where="recent emails"><ClientRecentEmails client={client} /></ErrorBoundary><ErrorBoundary compact where="usage card"><ClientUsageCard client={client} /></ErrorBoundary></>}
        {tab === "claude" && <ClientClaudeTab client={client} />}
        {tab === "calls" && <ErrorBoundary compact where="calls"><ClientCallsTab client={client} /></ErrorBoundary>}
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
        {tab === "systems" && <ErrorBoundary compact where="systems"><SystemsTab client={client} /></ErrorBoundary>}
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
      <FormDialog open={editing} title="Edit client" fields={PROFILE_FIELDS.map((f) => (f.name === "industry" ? { ...f, suggestions: industries, placeholder: "Category · detail" } : f.name === "brand_id" ? { ...f, options: brandFieldOptions(brands, client.brand_id) } : f))} initial={client} onClose={() => setEditing(false)} onSubmit={save} />
    </div>
  );
}
