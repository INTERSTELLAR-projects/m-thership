import { useState } from "react";
import { Search, ChevronDown, ChevronUp, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Save, X, AlertCircle, CheckCircle2, Settings, Users, CreditCard, FileText, Zap, Puzzle, Palette, Lock, Code2, Bell } from "lucide-react";
import PageHeader from "../components/PageHeader";

const SECTIONS = [
  { id: "overview", label: "App Overview & System", icon: Settings },
  { id: "users", label: "User & Admin Settings", icon: Users },
  { id: "portal", label: "Client Portal Settings", icon: FileText },
  { id: "pages", label: "Page Settings", icon: "📄" },
  { id: "forms", label: "Forms & Requests", icon: FileText },
  { id: "crm", label: "CRM & Data", icon: CreditCard },
  { id: "comms", label: "Communication", icon: Bell },
  { id: "automation", label: "Automation & Workflow", icon: Zap },
  { id: "integrations", label: "Integrations", icon: Puzzle },
  { id: "branding", label: "Branding & UI", icon: Palette },
  { id: "statuses", label: "Statuses & Tags", icon: "🏷️" },
  { id: "security", label: "Security & Access", icon: Lock },
  { id: "advanced", label: "Advanced Settings", icon: Code2 },
];

function SettingsCard({ title, description, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card rounded-xl border border-white/[0.06] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors">
        <div className="text-left">
          <h3 className="text-white font-bold text-sm">{title}</h3>
          {description && <p className="text-white/40 text-xs mt-1">{description}</p>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
      </button>
      {open && <div className="border-t border-white/[0.06] p-5 space-y-4">{children}</div>}
    </div>
  );
}

function SettingField({ label, type = "text", value, onChange, options, disabled = false, help }) {
  return (
    <div className="space-y-1.5">
      <label className="text-white/60 text-xs font-medium block">{label}</label>
      {type === "text" && <input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none disabled:opacity-50" />}
      {type === "select" && (
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none disabled:opacity-50">
          {options?.map((o) => <option key={o.value}>{o.label}</option>)}
        </select>
      )}
      {type === "toggle" && (
        <button onClick={() => onChange(!value)} disabled={disabled} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${value ? "bg-orange-500/15 border-orange-500/20" : "bg-white/[0.02] border-white/[0.06]"}`}>
          {value ? <ToggleRight className="w-4 h-4 text-orange-500" /> : <ToggleLeft className="w-4 h-4 text-white/30" />}
          <span className={value ? "text-orange-500" : "text-white/40"}>{value ? "Enabled" : "Disabled"}</span>
        </button>
      )}
      {help && <p className="text-white/25 text-[10px] mt-1">{help}</p>}
    </div>
  );
}

function PageSettingRow({ page, onToggle, onEdit }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
      <div className="flex items-center gap-3 flex-1">
        <button onClick={() => onToggle(page.id)} className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${page.visible ? "bg-orange-500/15 text-orange-500 border border-orange-500/20" : "bg-white/[0.05] text-white/30 border border-white/[0.08]"}`}>
          {page.visible ? "Visible" : "Hidden"}
        </button>
        <div>
          <p className="text-white/80 text-sm font-medium">{page.label}</p>
          <p className="text-white/30 text-xs">{page.description}</p>
        </div>
      </div>
      <button onClick={() => onEdit(page.id)} className="p-1.5 text-white/20 hover:text-white/60 transition-colors">
        <Edit2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function UserRow({ user, onEdit, onRemove }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
      <div>
        <p className="text-white/80 text-sm font-medium">{user.name}</p>
        <p className="text-white/30 text-xs">{user.email}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-[10px] font-semibold px-2 py-1 rounded ${user.role === "Super Admin" ? "bg-red-500/15 text-red-400 border border-red-500/20" : "bg-orange-500/15 text-orange-400 border border-orange-500/20"}`}>{user.role}</span>
        <button onClick={() => onEdit(user.id)} className="p-1.5 text-white/20 hover:text-white/60 transition-colors"><Edit2 className="w-4 h-4" /></button>
        <button onClick={() => onRemove(user.id)} className="p-1.5 text-white/20 hover:text-red-400/60 transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function IntegrationCard({ name, status, lastSync, onConnect, onDisconnect }) {
  const isConnected = status === "connected";
  return (
    <div className={`rounded-xl border p-4 flex items-center justify-between ${isConnected ? "bg-green-500/[0.06] border-green-500/15" : "bg-white/[0.02] border-white/[0.06]"}`}>
      <div>
        <p className={`text-sm font-medium ${isConnected ? "text-green-400" : "text-white/70"}`}>{name}</p>
        {lastSync && <p className="text-white/25 text-xs mt-0.5">Last sync: {lastSync}</p>}
      </div>
      {isConnected ? (
        <button onClick={onDisconnect} className="px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/15 transition-colors">
          Disconnect
        </button>
      ) : (
        <button onClick={onConnect} className="px-3 py-1.5 text-xs font-medium bg-orange-500/15 text-orange-500 border border-orange-500/20 rounded-lg hover:bg-orange-500/20 transition-colors">
          Connect
        </button>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [search, setSearch] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [pages, setPages] = useState([
    { id: "dashboard", label: "Dashboard", description: "Main command center", visible: true },
    { id: "logins", label: "Logins", description: "Credential manager", visible: true },
    { id: "documents", label: "Documents", description: "Document library", visible: true },
    { id: "crm", label: "CRM", description: "Client management", visible: true },
    { id: "orbit-seo", label: "Ørbit SEO", description: "SEO clients", visible: true },
    { id: "web-ops", label: "Web Øps", description: "Website operations", visible: true },
    { id: "forge", label: "Førge", description: "Project builds", visible: true },
    { id: "performance", label: "Performance", description: "Analytics & intelligence", visible: true },
  ]);
  const [users, setUsers] = useState([
    { id: 1, name: "Justin", email: "justin@interstellar-strategies.com", role: "Super Admin" },
  ]);

  const handlePageToggle = (id) => {
    setPages(pages.map((p) => p.id === id ? { ...p, visible: !p.visible } : p));
    setHasChanges(true);
  };

  const handleSave = () => {
    setHasChanges(false);
    // TODO: Persist changes to backend
  };

  const visibleSections = SECTIONS.filter((s) => !search || s.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Settings" rightText="System Control Center" />

      <div className="px-8 py-6 space-y-6">

        {/* SEARCH BAR */}
        <div className="sticky top-16 z-10 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search settings..." className="w-full pl-10 pr-4 py-2 bg-card border border-white/[0.06] rounded-lg text-sm text-white placeholder:text-white/20 outline-none" />
          </div>
          {hasChanges && (
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors">
              <Save className="w-4 h-4" />Save Changes
            </button>
          )}
        </div>

        {/* SECTION NAVIGATION */}
        <div className="flex gap-2 flex-wrap">
          {visibleSections.map((sec) => (
            <button key={sec.id} onClick={() => setActiveSection(sec.id)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${activeSection === sec.id ? "bg-orange-500/15 text-orange-500 border border-orange-500/20" : "text-white/30 hover:text-white/50 border border-transparent"}`}>
              {sec.label}
            </button>
          ))}
        </div>

        {/* SECTIONS */}
        <div className="space-y-4">

          {/* 1. APP OVERVIEW */}
          {activeSection === "overview" && (
            <>
              <SettingsCard title="App Identity" description="Core app configuration">
                <SettingField label="App Name" value="Interstellar Command" />
                <SettingField label="App Subtitle" value="Enterprise Operations Terminal" />
                <SettingField label="Internal Description" value="Complete business operations & SEO intelligence platform" />
              </SettingsCard>
              <SettingsCard title="Defaults">
                <SettingField label="Default Time Zone" options={[{ value: "pst", label: "Pacific (PST)" }, { value: "est", label: "Eastern (EST)" }]} type="select" value="pst" />
                <SettingField label="Default Date Format" options={[{ value: "mdy", label: "MM/DD/YYYY" }, { value: "dmy", label: "DD/MM/YYYY" }]} type="select" value="mdy" />
                <SettingField label="Default Currency" options={[{ value: "usd", label: "USD ($)" }, { value: "eur", label: "EUR (€)" }]} type="select" value="usd" />
              </SettingsCard>
              <SettingsCard title="Landing Pages">
                <SettingField label="Admin Landing Page" options={[{ value: "dashboard", label: "Dashboard" }]} type="select" value="dashboard" />
                <SettingField label="Client Portal Landing Page" options={[{ value: "projects", label: "Client Projects" }]} type="select" value="projects" />
              </SettingsCard>
              <SettingsCard title="System Info">
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between"><span className="text-white/40">Version:</span><span className="text-white/70">1.0.0</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Last Updated:</span><span className="text-white/70">April 11, 2026</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Build:</span><span className="text-white/70">Production</span></div>
                </div>
              </SettingsCard>
            </>
          )}

          {/* 2. USER & ADMIN SETTINGS */}
          {activeSection === "users" && (
            <>
              <SettingsCard title="Admin Users" defaultOpen={true}>
                <div className="space-y-3 mb-4">{users.map((u) => <UserRow key={u.id} user={u} onEdit={() => {}} onRemove={() => {}} />)}</div>
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500/15 hover:bg-orange-500/20 text-orange-500 text-xs font-medium rounded-lg border border-orange-500/20 transition-colors">
                  <Plus className="w-3.5 h-3.5" />Invite User
                </button>
              </SettingsCard>
              <SettingsCard title="Role Definitions">
                {["Super Admin", "Admin", "Internal Team", "Read Only", "Client"].map((role) => (
                  <div key={role} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                    <span className="text-white/70 text-sm">{role}</span>
                    <button className="text-white/20 hover:text-white/60 transition-colors"><Edit2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </SettingsCard>
              <SettingsCard title="Permissions">
                <SettingField label="Super Admins can override all settings" type="toggle" value={true} />
                <SettingField label="Admins can manage users" type="toggle" value={true} />
                <SettingField label="Internal team can view client data" type="toggle" value={true} />
              </SettingsCard>
            </>
          )}

          {/* 3. CLIENT PORTAL SETTINGS */}
          {activeSection === "portal" && (
            <>
              <SettingsCard title="Portal Navigation" defaultOpen={true}>
                {["Client Projects", "Requests", "Ørbit SEO", "Web Øps", "Førge", "Performance", "Prestige"].map((item) => (
                  <div key={item} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                    <span className="text-white/70 text-sm">{item}</span>
                    <ToggleRight className="w-5 h-5 text-orange-500" />
                  </div>
                ))}
              </SettingsCard>
              <SettingsCard title="Client Permissions">
                <SettingField label="Clients can see completed requests" type="toggle" value={true} help="Show archived requests in client view" />
                <SettingField label="Clients can view project progress" type="toggle" value={true} />
                <SettingField label="Clients can upload files" type="toggle" value={true} />
                <SettingField label="Clients can message" type="toggle" value={true} />
                <SettingField label="Clients can view performance dashboards" type="toggle" value={true} />
              </SettingsCard>
              <SettingsCard title="Onboarding">
                <SettingField label="Show welcome walkthrough" type="toggle" value={true} />
                <SettingField label="Default welcome message" type="text" value="Welcome to your Interstellar Command portal" />
              </SettingsCard>
            </>
          )}

          {/* 4. PAGE SETTINGS */}
          {activeSection === "pages" && (
            <>
              <SettingsCard title="Page Visibility & Configuration" defaultOpen={true}>
                <div className="space-y-3 mb-4">{pages.map((page) => <PageSettingRow key={page.id} page={page} onToggle={handlePageToggle} onEdit={() => {}} />)}</div>
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500/15 hover:bg-orange-500/20 text-orange-500 text-xs font-medium rounded-lg border border-orange-500/20 transition-colors">
                  <Plus className="w-3.5 h-3.5" />Add Custom Page
                </button>
              </SettingsCard>
              <SettingsCard title="Default Page Behaviors">
                <SettingField label="Enable search on all pages" type="toggle" value={true} />
                <SettingField label="Enable filters on all pages" type="toggle" value={true} />
                <SettingField label="Enable archive sections" type="toggle" value={true} />
                <SettingField label="Show metrics / summary cards" type="toggle" value={true} />
              </SettingsCard>
            </>
          )}

          {/* 5. FORMS & REQUEST SETTINGS */}
          {activeSection === "forms" && (
            <>
              <SettingsCard title="Active Forms" defaultOpen={true}>
                {["Web Øps Website Update Request", "Forge Project Request"].map((form) => (
                  <div key={form} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                    <div>
                      <p className="text-white/70 text-sm font-medium">{form}</p>
                      <p className="text-white/25 text-xs">Visible in portal</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-2 py-1 text-xs font-medium text-orange-500/70 hover:text-orange-500 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button className="px-2 py-1 text-xs font-medium text-white/30 hover:text-white/60 transition-colors"><ToggleRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </SettingsCard>
              <SettingsCard title="Form Behavior">
                <SettingField label="Require file upload on requests" type="toggle" value={false} />
                <SettingField label="Auto-tag submissions" type="toggle" value={true} />
                <SettingField label="Default request priority" options={[{ value: "normal", label: "Normal" }, { value: "high", label: "High" }]} type="select" value="normal" />
                <SettingField label="Default request status" options={[{ value: "pending", label: "Pending" }, { value: "review", label: "Under Review" }]} type="select" value="pending" />
              </SettingsCard>
              <SettingsCard title="Notifications">
                <SettingField label="Notify admin on request submission" type="toggle" value={true} />
                <SettingField label="Notify client on request update" type="toggle" value={true} />
              </SettingsCard>
            </>
          )}

          {/* 6. CRM & DATA SETTINGS */}
          {activeSection === "crm" && (
            <>
              <SettingsCard title="CRM Fields" defaultOpen={true}>
                <div className="space-y-2 mb-4">
                  {["Business Name", "Contact", "Email", "Phone", "Status", "Services", "Notes"].map((field) => (
                    <div key={field} className="flex items-center justify-between p-2 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                      <span className="text-white/70 text-sm">{field}</span>
                      <ToggleRight className="w-4 h-4 text-orange-500" />
                    </div>
                  ))}
                </div>
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500/15 hover:bg-orange-500/20 text-orange-500 text-xs font-medium rounded-lg border border-orange-500/20 transition-colors">
                  <Plus className="w-3.5 h-3.5" />Add Custom Field
                </button>
              </SettingsCard>
              <SettingsCard title="Client Status Options">
                {["Active", "Inactive", "Lead"].map((status) => (
                  <div key={status} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                    <span className="text-white/70 text-sm">{status}</span>
                    <button className="text-white/20 hover:text-white/60 transition-colors"><Edit2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/[0.03] hover:bg-white/[0.05] text-white/40 text-xs font-medium rounded-lg border border-white/[0.06] transition-colors">
                  <Plus className="w-3.5 h-3.5" />Add Status
                </button>
              </SettingsCard>
            </>
          )}

          {/* 7. COMMUNICATION SETTINGS */}
          {activeSection === "comms" && (
            <>
              <SettingsCard title="Email Notifications" defaultOpen={true}>
                <SettingField label="Enable admin notifications" type="toggle" value={true} />
                <SettingField label="Enable client notifications" type="toggle" value={true} />
                <SettingField label="Default sender email" type="text" value="system@interstellar-strategies.com" />
              </SettingsCard>
              <SettingsCard title="Message Behavior">
                <SettingField label="Enable internal messaging" type="toggle" value={true} />
                <SettingField label="Enable client messaging" type="toggle" value={true} />
                <SettingField label="Allow message attachments" type="toggle" value={true} />
              </SettingsCard>
              <SettingsCard title="Reminders">
                <SettingField label="Days before due date to remind" options={[{ value: "3", label: "3 days" }, { value: "7", label: "7 days" }]} type="select" value="3" />
                <SettingField label="Send overdue reminders" type="toggle" value={true} />
              </SettingsCard>
            </>
          )}

          {/* 8. AUTOMATION & WORKFLOW SETTINGS */}
          {activeSection === "automation" && (
            <>
              <SettingsCard title="Request Automation" defaultOpen={true}>
                <SettingField label="Auto-route requests to pages" type="toggle" value={true} />
                <SettingField label="Auto-create tasks on request" type="toggle" value={false} />
                <SettingField label="Auto-convert to project" type="toggle" value={false} />
              </SettingsCard>
              <SettingsCard title="Status Workflows">
                <SettingField label="Track status changes" type="toggle" value={true} />
                <SettingField label="Notify on status change" type="toggle" value={true} />
                <SettingField label="Auto-close completed requests" type="toggle" value={false} />
              </SettingsCard>
              <SettingsCard title="Task Automation">
                <SettingField label="Auto-generate recurring tasks" type="toggle" value={true} />
                <SettingField label="Auto-sync blog schedule" type="toggle" value={true} />
                <SettingField label="Auto-sync GBP posts" type="toggle" value={true} />
              </SettingsCard>
            </>
          )}

          {/* 9. INTEGRATIONS */}
          {activeSection === "integrations" && (
            <>
              <SettingsCard title="Connected Services" defaultOpen={true}>
                <div className="space-y-3">
                  <IntegrationCard name="Google Analytics" status="pending" onConnect={() => {}} />
                  <IntegrationCard name="Google Search Console" status="pending" onConnect={() => {}} />
                  <IntegrationCard name="Google Business Profile" status="pending" onConnect={() => {}} />
                  <IntegrationCard name="Gmail / Workspace" status="pending" onConnect={() => {}} />
                  <IntegrationCard name="Stripe" status="pending" onConnect={() => {}} />
                  <IntegrationCard name="Zapier" status="pending" onConnect={() => {}} />
                </div>
              </SettingsCard>
              <SettingsCard title="Sync Settings">
                <SettingField label="Auto-sync data" type="toggle" value={true} />
                <SettingField label="Sync interval" options={[{ value: "15", label: "Every 15 minutes" }, { value: "60", label: "Hourly" }]} type="select" value="60" />
              </SettingsCard>
            </>
          )}

          {/* 10. BRANDING & UI */}
          {activeSection === "branding" && (
            <>
              <SettingsCard title="App Branding" defaultOpen={true}>
                <div className="space-y-4">
                  <div>
                    <p className="text-white/60 text-xs font-medium mb-2">App Logo</p>
                    <button className="px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/40 text-xs font-medium hover:bg-white/[0.05] transition-colors">Upload Logo</button>
                  </div>
                  <SettingField label="Accent Color" type="text" value="#FF6A00" />
                </div>
              </SettingsCard>
              <SettingsCard title="Interface Preferences">
                <SettingField label="Theme" options={[{ value: "dark", label: "Dark (Current)" }, { value: "light", label: "Light (Beta)" }]} type="select" value="dark" />
                <SettingField label="Card style density" options={[{ value: "compact", label: "Compact" }, { value: "normal", label: "Normal (Current)" }]} type="select" value="normal" />
              </SettingsCard>
              <SettingsCard title="Portal Branding">
                <SettingField label="Show client logo" type="toggle" value={true} />
                <SettingField label="Custom portal colors" type="toggle" value={false} />
              </SettingsCard>
            </>
          )}

          {/* 11. STATUSES & TAGS */}
          {activeSection === "statuses" && (
            <>
              <SettingsCard title="Request Statuses" defaultOpen={true}>
                {["Submitted", "Under Review", "Approved", "In Progress", "Completed"].map((status) => (
                  <div key={status} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                    <span className="text-white/70 text-sm">{status}</span>
                    <button className="text-white/20 hover:text-white/60 transition-colors"><Edit2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/[0.03] hover:bg-white/[0.05] text-white/40 text-xs font-medium rounded-lg border border-white/[0.06] transition-colors">
                  <Plus className="w-3.5 h-3.5" />Add Status
                </button>
              </SettingsCard>
              <SettingsCard title="Tags & Categories">
                <SettingField label="Enable custom tags" type="toggle" value={true} />
                <SettingField label="Enable service categories" type="toggle" value={true} />
              </SettingsCard>
            </>
          )}

          {/* 12. SECURITY */}
          {activeSection === "security" && (
            <>
              <SettingsCard title="Login Methods" defaultOpen={true}>
                <SettingField label="Email login enabled" type="toggle" value={true} />
                <SettingField label="Google login enabled" type="toggle" value={true} />
                <SettingField label="Session timeout (minutes)" type="text" value="30" />
              </SettingsCard>
              <SettingsCard title="Access Control">
                <SettingField label="Require strong passwords" type="toggle" value={true} />
                <SettingField label="Admin-only data visible to admins only" type="toggle" value={true} />
                <SettingField label="Client data isolation" type="toggle" value={true} />
              </SettingsCard>
              <SettingsCard title="Audit & Compliance">
                <div className="text-xs text-white/40">
                  <p>Last admin action: April 11, 2026 at 2:45 PM</p>
                  <p>Security level: Standard</p>
                </div>
              </SettingsCard>
            </>
          )}

          {/* 13. ADVANCED */}
          {activeSection === "advanced" && (
            <>
              <SettingsCard title="Developer Settings">
                <SettingField label="Enable API access" type="toggle" value={false} />
                <SettingField label="Enable webhooks" type="toggle" value={false} />
                <SettingField label="Enable debug mode" type="toggle" value={false} />
              </SettingsCard>
              <SettingsCard title="Data Management">
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/40 text-xs font-medium hover:bg-white/[0.05] transition-colors">
                  <FileText className="w-3.5 h-3.5" />Export Data
                </button>
              </SettingsCard>
              <SettingsCard title="Beta Features">
                <SettingField label="Enable experimental features" type="toggle" value={false} />
              </SettingsCard>
            </>
          )}

        </div>

      </div>
    </div>
  );
}