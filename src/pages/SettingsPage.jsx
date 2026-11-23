import { useSearchParams } from "react-router-dom";
import { BookOpen, Building2, Globe, ListChecks, Plug, Users, Zap, ShieldCheck } from "lucide-react";
import SecurityTab from "@/features/settings/SecurityTab";
import PageHeader from "@/components/PageHeader";
import { FinanceStyles } from "@/components/financial/finance/ui";
import { GeneralTab, TeamTab, PortalTab, IntegrationsTab } from "@/features/settings/tabs";
import ListsTab from "@/features/settings/ListsTab";
import AgencyKnowledgeTab from "@/features/settings/AgencyKnowledgeTab";
import AutomationsHub from "@/features/automations/AutomationsHub";
import EstimatesTab from "@/features/output/EstimatesTab";
import { Timer, Camera } from "lucide-react";
import { lazy, Suspense } from "react";
const FieldInboxSettings = lazy(() => import("@/features/field/FieldInboxSettings"));

// Settings = only things the app actually reads. Feature-owned settings stay on their feature page
// (General lists where). Tabs are addressable: /settings?tab=lists, /settings?tab=automations …
const TABS = [
  { id: "general", label: "General", icon: Building2, blurb: "Agency profile, brand and where each setting lives" },
  { id: "knowledge", label: "Agency knowledge", icon: BookOpen, blurb: "Offers, prices, rules and voice: the one source every generator and Claude task reads" },
  { id: "team", label: "Team & access", icon: Users, blurb: "Admins, client portal logins, invites" },
  { id: "portal", label: "Portal", icon: Globe, blurb: "Which clients have a portal and what it shows" },
  { id: "security", label: "Security", icon: ShieldCheck, blurb: "Sign-in protection for admin and client portal logins" },
  { id: "integrations", label: "Integrations", icon: Plug, blurb: "Secrets and connectors (configured or not)" },
  { id: "field", label: "Field inbox", icon: Camera, blurb: "WhatsApp from the glasses: secrets (names only), the webhook URL for Meta and the numbers allowed to file things" },
  { id: "lists", label: "Lists & fields", icon: ListChecks, blurb: "Edit dropdown options without code" },
  { id: "automations", label: "Automations", icon: Zap, blurb: "Every automation and notification" },
  { id: "estimates", label: "Time-saved estimates", icon: Timer, blurb: "Manual minutes per task type and your hourly rate: the estimates behind hours saved and $ value on Output" },
];

export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "general";
  const go = (id) => setParams(id === "general" ? {} : { tab: id }, { replace: true });
  const current = TABS.find((t) => t.id === tab);

  return (
    <div className="pb-16">
      <FinanceStyles />
      <PageHeader breadcrumb="System / Settings" title="Mission /Settings" rightText={current.label} />
      <div className="border-b border-hair px-4 md:px-8">
        <nav className="no-scrollbar -mb-px flex overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = t.id === tab;
            return (
              <button key={t.id} type="button" onClick={() => go(t.id)} className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors ${on ? "border-[#ff3c00] text-ink" : "border-transparent text-ink/50 hover:text-ink"}`}>
                <Icon className={`h-3.5 w-3.5 ${on ? "text-[#ff3c00]" : ""}`} />{t.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div key={tab} className="page-enter space-y-5 px-4 pt-6 md:px-8">
        <p className="text-[12.5px] text-ink/55">{current.blurb}</p>
        {tab === "general" && <GeneralTab />}
        {tab === "knowledge" && <AgencyKnowledgeTab />}
        {tab === "team" && <TeamTab />}
        {tab === "portal" && <PortalTab />}
        {tab === "security" && <SecurityTab />}
        {tab === "integrations" && <IntegrationsTab />}
        {tab === "field" && <Suspense fallback={<p className="text-[12.5px] text-ink/45">Loading…</p>}><FieldInboxSettings /></Suspense>}
        {tab === "lists" && <ListsTab />}
        {tab === "automations" && <AutomationsHub />}
        {tab === "estimates" && <EstimatesTab />}
      </div>
    </div>
  );
}
