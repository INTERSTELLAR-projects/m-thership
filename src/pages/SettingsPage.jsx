import { useState, useEffect, useCallback } from "react";
import {
  Search, ChevronDown, ChevronUp, Plus, Edit2, Trash2,
  ToggleLeft, ToggleRight, Save, X, Check, Loader2,
  Settings, Users, Globe, FileText, Zap, Puzzle, Palette, Lock, Code2, Bell,
  CreditCard, RefreshCw, ExternalLink, AlertCircle, Database
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";

// ─── Default settings shape ────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  key: "global",
  appName: "Interstellar Command",
  appSubtitle: "Enterprise Operations Terminal",
  appDescription: "Complete business operations & SEO intelligence platform",
  defaultTimezone: "America/Los_Angeles",
  defaultDateFormat: "MM/DD/YYYY",
  defaultCurrency: "USD",
  adminLandingPage: "/",
  clientLandingPage: "/client-projects",
  pageSettings: {
    dashboard: { visible: true, label: "Dashboard", access: "admin" },
    logins: { visible: true, label: "Logins", access: "admin" },
    documents: { visible: true, label: "Documents", access: "admin" },
    financial: { visible: true, label: "Financial", access: "admin" },
    legal: { visible: true, label: "Legal", access: "admin" },
    crm: { visible: true, label: "CRM", access: "admin" },
    "idea-vault": { visible: true, label: "Idea Vault", access: "admin" },
    todo: { visible: true, label: "To-Do", access: "admin" },
    comms: { visible: true, label: "Comms", access: "admin" },
    "output-analytics": { visible: true, label: "Output Analytics", access: "admin" },
    "client-projects": { visible: true, label: "Client Projects", access: "all" },
    requests: { visible: true, label: "Requests", access: "all" },
    "orbit-seo": { visible: true, label: "Ørbit SEO", access: "admin" },
    "web-ops": { visible: true, label: "Web Øps", access: "admin" },
    forge: { visible: true, label: "Førge", access: "admin" },
    performance: { visible: true, label: "Performance", access: "admin" },
    prestige: { visible: true, label: "Prestige", access: "admin" },
  },
  portalSettings: {
    showClientProjects: true,
    showRequests: true,
    showOrbitSeo: true,
    showWebOps: true,
    showForge: true,
    showPerformance: true,
    showPrestige: true,
    clientsCanSeeCompletedRequests: true,
    clientsCanViewProjectProgress: true,
    clientsCanUploadFiles: true,
    clientsCanMessage: true,
    clientsCanViewPerformance: true,
    showWelcomeWalkthrough: true,
    welcomeMessage: "Welcome to your Interstellar Command portal",
  },
  formSettings: {
    requireFileUpload: false,
    autoTagSubmissions: true,
    defaultPriority: "Normal",
    defaultStatus: "Submitted",
    notifyAdminOnSubmit: true,
    notifyClientOnUpdate: true,
    forms: {
      webops: { enabled: true, label: "Web Øps Website Update Request", visible: true, urgencyField: true, fileUpload: true, thankYou: "Your request has been submitted." },
      forge: { enabled: true, label: "Forge Project Request", visible: true, urgencyField: true, fileUpload: true, thankYou: "Your Forge request has been received." },
    },
  },
  commSettings: {
    adminNotifications: true,
    clientNotifications: true,
    senderEmail: "system@interstellar-strategies.com",
    internalMessaging: true,
    clientMessaging: true,
    allowAttachments: true,
    dueDateReminderDays: "3",
    sendOverdueReminders: true,
  },
  automationSettings: {
    autoRouteRequests: true,
    autoCreateTasksOnRequest: false,
    autoConvertToProject: false,
    trackStatusChanges: true,
    notifyOnStatusChange: true,
    autoCloseCompleted: false,
    autoGenerateRecurringTasks: true,
    autoBlogSync: true,
    autoGBPSync: true,
  },
  brandingSettings: {
    accentColor: "#ff3c00",
    theme: "dark",
    density: "normal",
    showClientLogo: true,
    customPortalColors: false,
  },
  securitySettings: {
    emailLogin: true,
    googleLogin: true,
    sessionTimeout: "30",
    requireStrongPasswords: true,
    adminDataVisible: true,
    clientDataIsolation: true,
  },
  advancedSettings: {
    enableApiAccess: false,
    enableWebhooks: false,
    enableDebugMode: false,
    experimentalFeatures: false,
  },
  requestStatuses: [
    { id: 1, label: "Submitted", color: "#ffffff40" },
    { id: 2, label: "Under Review", color: "#3b82f6" },
    { id: 3, label: "Approved", color: "#a855f7" },
    { id: 4, label: "In Progress", color: "#ff3c00" },
    { id: 5, label: "Completed", color: "#22c55e" },
  ],
  projectStatuses: [
    { id: 1, label: "Planning", color: "#3b82f6" },
    { id: 2, label: "Development", color: "#ff3c00" },
    { id: 3, label: "Testing", color: "#a855f7" },
    { id: 4, label: "Deployment", color: "#eab308" },
    { id: 5, label: "Completed", color: "#22c55e" },
    { id: 6, label: "On Hold", color: "#ffffff30" },
  ],
  clientStatuses: [
    { id: 1, label: "Active", color: "#22c55e" },
    { id: 2, label: "Inactive", color: "#ffffff30" },
    { id: 3, label: "Lead", color: "#3b82f6" },
  ],
  customTags: ["SEO", "Urgent", "Recurring", "New Client"],
  crmCustomFields: [],
};

const SECTIONS = [
  { id: "overview", label: "App Overview", icon: Settings },
  { id: "users", label: "User & Admin", icon: Users },
  { id: "portal", label: "Client Portal", icon: Globe },
  { id: "pages", label: "Page Settings", icon: FileText },
  { id: "forms", label: "Forms & Requests", icon: FileText },
  { id: "crm", label: "CRM & Data", icon: Database },
  { id: "comms", label: "Communication", icon: Bell },
  { id: "automation", label: "Automation", icon: Zap },
  { id: "integrations", label: "Integrations", icon: Puzzle },
  { id: "branding", label: "Branding & UI", icon: Palette },
  { id: "statuses", label: "Statuses & Tags", icon: CreditCard },
  { id: "security", label: "Security", icon: Lock },
  { id: "advanced", label: "Advanced", icon: Code2 },
];

// ─── Reusable UI ──────────────────────────────────────────────────────────
function SettingsCard({ title, description, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card rounded-md border border-ink/[0.13] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 hover:bg-ink/[0.02] transition-colors">
        <div className="text-left">
          <h3 className="font-display font-bold text-sm tracking-wide bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">{title}</h3>
          {description && <p className="text-ink/[0.58] text-xs mt-0.5">{description}</p>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-ink/[0.48] shrink-0" /> : <ChevronDown className="w-4 h-4 text-ink/[0.48] shrink-0" />}
      </button>
      {open && <div className="border-t border-ink/[0.13] p-5 space-y-4">{children}</div>}
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${value ? "bg-orange-500/15 border-orange-500/20" : "bg-ink/[0.03] border-ink/[0.13]"}`}>
      {value ? <ToggleRight className="w-4 h-4 text-orange-500" /> : <ToggleLeft className="w-4 h-4 text-ink/[0.48]" />}
      <span className={`text-xs font-medium ${value ? "text-orange-500" : "text-ink/[0.58]"}`}>{value ? "Enabled" : "Disabled"}</span>
    </button>
  );
}

function Field({ label, help, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-ink/60 text-xs font-medium block">{label}</label>
      {children}
      {help && <p className="text-ink/[0.43] text-[10px]">{help}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink/[0.38] outline-none focus:border-orange-500/30" />
  );
}

function SelectInput({ value, onChange, options }) {
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)}
      className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-orange-500/30">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function StatusPill({ label, color }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-lg border border-ink/[0.13]" style={{ color, borderColor: `${color}30`, background: `${color}15` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />{label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsId, setSettingsId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [newStatus, setNewStatus] = useState({ section: null, label: "", color: "#ff3c00" });
  const [newCrmField, setNewCrmField] = useState("");
  const [editingStatus, setEditingStatus] = useState(null);

  // Load settings on mount
  useEffect(() => {
    base44.entities.AppSettings.filter({ key: "global" }, "-created_date", 1).then((results) => {
      if (results.length > 0) {
        setSettingsId(results[0].id);
        setSettings({ ...DEFAULT_SETTINGS, ...results[0] });
      }
      setLoading(false);
    });
  }, []);

  // Load users when on users section
  useEffect(() => {
    if (activeSection === "users") {
      setUsersLoading(true);
      base44.entities.User.list("-created_date", 50).then((data) => {
        setUsers(data);
        setUsersLoading(false);
      });
    }
  }, [activeSection]);

  const update = useCallback((path, value) => {
    setSettings((prev) => {
      const parts = path.split(".");
      const next = { ...prev };
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] = { ...cur[parts[i]] };
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { id, created_date, updated_date, created_by, ...data } = settings;
    if (settingsId) {
      await base44.entities.AppSettings.update(settingsId, data);
    } else {
      const created = await base44.entities.AppSettings.create(data);
      setSettingsId(created.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Status management
  const addStatus = (section) => {
    if (!newStatus.label.trim()) return;
    const arr = [...(settings[section] || [])];
    arr.push({ id: Date.now(), label: newStatus.label, color: newStatus.color });
    update(section, arr);
    setNewStatus({ section: null, label: "", color: "#ff3c00" });
  };

  const removeStatus = (section, id) => {
    update(section, (settings[section] || []).filter((s) => s.id !== id));
  };

  const updateStatusLabel = (section, id, label) => {
    update(section, (settings[section] || []).map((s) => s.id === id ? { ...s, label } : s));
  };

  // Tag management
  const addTag = () => {
    if (!newTag.trim()) return;
    update("customTags", [...(settings.customTags || []), newTag.trim()]);
    setNewTag("");
  };

  const removeTag = (tag) => {
    update("customTags", (settings.customTags || []).filter((t) => t !== tag));
  };

  // CRM field management
  const addCrmField = () => {
    if (!newCrmField.trim()) return;
    update("crmCustomFields", [...(settings.crmCustomFields || []), { id: Date.now(), label: newCrmField.trim(), visible: true }]);
    setNewCrmField("");
  };

  const removeCrmField = (id) => {
    update("crmCustomFields", (settings.crmCustomFields || []).filter((f) => f.id !== id));
  };

  const toggleCrmFieldVisible = (id) => {
    update("crmCustomFields", (settings.crmCustomFields || []).map((f) => f.id === id ? { ...f, visible: !f.visible } : f));
  };

  const visibleSections = SECTIONS.filter((s) => !search || s.label.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-ink/[0.38] animate-spin" />
      </div>
    );
  }

  const ps = settings.pageSettings || {};
  const port = settings.portalSettings || {};
  const forms = settings.formSettings || {};
  const comm = settings.commSettings || {};
  const auto = settings.automationSettings || {};
  const brand = settings.brandingSettings || {};
  const sec = settings.securitySettings || {};
  const adv = settings.advancedSettings || {};

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="System / Settings" rightText="System Control Center" />

      <div className="flex h-[calc(100vh-57px)]">
        {/* SIDEBAR NAV */}
        <aside className="w-52 shrink-0 border-r border-ink/[0.13] overflow-y-auto p-3 space-y-0.5">
          {SECTIONS.map((sec) => {
            const Icon = typeof sec.icon === "string" ? null : sec.icon;
            return (
              <button key={sec.id} onClick={() => setActiveSection(sec.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${activeSection === sec.id ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white font-semibold border border-orange-500/40" : "text-ink/[0.58] hover:text-ink/70 hover:bg-ink/[0.04]"}`}>
                {Icon ? <Icon className="w-3.5 h-3.5 shrink-0" /> : <span className="text-sm shrink-0">{sec.icon}</span>}
                {sec.label}
              </button>
            );
          })}
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-8 py-6 space-y-5">

            {/* TOP BAR */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/[0.38]" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); }} placeholder="Search sections..."
                  className="w-full pl-10 pr-4 py-2 bg-card border border-ink/[0.13] rounded-lg text-sm text-ink placeholder:text-ink/[0.38] outline-none" />
              </div>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 disabled:opacity-60 text-white font-semibold text-xs rounded-lg transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved ? "Saved!" : saving ? "Saving..." : "Save Settings"}
              </button>
            </div>

            {/* ── 1. APP OVERVIEW ── */}
            {activeSection === "overview" && (
              <>
                <SettingsCard title="App Identity" description="Name, subtitle, and description" defaultOpen>
                  <Field label="App Name"><TextInput value={settings.appName} onChange={(v) => update("appName", v)} /></Field>
                  <Field label="App Subtitle"><TextInput value={settings.appSubtitle} onChange={(v) => update("appSubtitle", v)} /></Field>
                  <Field label="Internal Description"><TextInput value={settings.appDescription} onChange={(v) => update("appDescription", v)} /></Field>
                </SettingsCard>

                <SettingsCard title="Regional Defaults">
                  <Field label="Default Time Zone">
                    <SelectInput value={settings.defaultTimezone} onChange={(v) => update("defaultTimezone", v)} options={[
                      { value: "America/Los_Angeles", label: "Pacific (PST/PDT)" },
                      { value: "America/Denver", label: "Mountain (MST/MDT)" },
                      { value: "America/Chicago", label: "Central (CST/CDT)" },
                      { value: "America/New_York", label: "Eastern (EST/EDT)" },
                    ]} />
                  </Field>
                  <Field label="Date Format">
                    <SelectInput value={settings.defaultDateFormat} onChange={(v) => update("defaultDateFormat", v)} options={[
                      { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
                      { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
                      { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
                    ]} />
                  </Field>
                  <Field label="Currency">
                    <SelectInput value={settings.defaultCurrency} onChange={(v) => update("defaultCurrency", v)} options={[
                      { value: "USD", label: "USD ($)" },
                      { value: "EUR", label: "EUR (€)" },
                      { value: "GBP", label: "GBP (£)" },
                    ]} />
                  </Field>
                </SettingsCard>

                <SettingsCard title="Landing Pages">
                  <Field label="Admin Landing Page">
                    <SelectInput value={settings.adminLandingPage} onChange={(v) => update("adminLandingPage", v)} options={[
                      { value: "/", label: "Dashboard" },
                      { value: "/crm", label: "CRM" },
                      { value: "/todo", label: "To-Do" },
                    ]} />
                  </Field>
                  <Field label="Client Portal Landing Page">
                    <SelectInput value={settings.clientLandingPage} onChange={(v) => update("clientLandingPage", v)} options={[
                      { value: "/client-projects", label: "Client Projects" },
                      { value: "/requests", label: "Requests" },
                    ]} />
                  </Field>
                </SettingsCard>

                <SettingsCard title="System Information">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    {[["Platform", "Interstellar Command"], ["Version", "1.0.0"], ["Build", "Production"], ["Last Updated", "April 12, 2026"]].map(([k, v]) => (
                      <div key={k} className="bg-ink/[0.02] rounded-lg p-3 border border-ink/[0.13]">
                        <p className="text-ink/[0.48] mb-1">{k}</p>
                        <p className="text-ink/80 font-semibold">{v}</p>
                      </div>
                    ))}
                  </div>
                </SettingsCard>
              </>
            )}

            {/* ── 2. USERS ── */}
            {activeSection === "users" && (
              <>
                <SettingsCard title="Team Members" description="All registered users in the system" defaultOpen>
                  {usersLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-ink/[0.38] animate-spin" /></div>
                  ) : users.length === 0 ? (
                    <p className="text-ink/[0.48] text-sm text-center py-4">No users found.</p>
                  ) : (
                    <div className="space-y-3">
                      {users.map((u) => (
                        <div key={u.id} className="flex items-center gap-4 p-3 bg-ink/[0.02] rounded-lg border border-ink/[0.13]">
                          <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-[11px] font-bold text-orange-600 shrink-0">
                            {u.full_name?.charAt(0) || u.email?.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-ink/80 text-sm font-medium truncate">{u.full_name || "—"}</p>
                            <p className="text-ink/[0.48] text-xs truncate">{u.email}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded border ${u.role === "admin" ? "bg-orange-500/15 text-orange-600 border-orange-500/20" : "bg-ink/5 text-ink/[0.48] border-ink/[0.13]"}`}>
                            {u.role === "admin" ? "Admin" : "User"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </SettingsCard>

                <SettingsCard title="Invite New User">
                  <p className="text-ink/[0.58] text-xs mb-4">Use the platform's invite system to add new team members and assign roles.</p>
                  <div className="p-4 bg-orange-500/[0.06] rounded-lg border border-orange-500/15">
                    <p className="text-orange-600 text-xs font-medium">To invite users, go to the platform dashboard → Members → Invite.</p>
                    <p className="text-ink/[0.48] text-xs mt-1">Invited users must be registered before they appear here.</p>
                  </div>
                </SettingsCard>

                <SettingsCard title="Role Definitions">
                  <div className="space-y-2">
                    {[
                      { role: "Admin", desc: "Full access to all Command Center and Portal sections" },
                      { role: "User", desc: "Limited access based on page visibility settings" },
                    ].map(({ role, desc }) => (
                      <div key={role} className="flex items-center gap-3 p-3 bg-ink/[0.02] rounded-lg border border-ink/[0.13]">
                        <span className="text-orange-600 text-xs font-bold w-24 shrink-0">{role}</span>
                        <span className="text-ink/[0.58] text-xs">{desc}</span>
                      </div>
                    ))}
                  </div>
                </SettingsCard>
              </>
            )}

            {/* ── 3. PORTAL ── */}
            {activeSection === "portal" && (
              <>
                <SettingsCard title="Portal Navigation Visibility" description="Toggle which sections clients can see" defaultOpen>
                  {[
                    ["showClientProjects", "Client Projects"],
                    ["showRequests", "Requests"],
                    ["showOrbitSeo", "Ørbit SEO"],
                    ["showWebOps", "Web Øps"],
                    ["showForge", "Førge"],
                    ["showPerformance", "Performance"],
                    ["showPrestige", "Prestige"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-ink/[0.13] last:border-0">
                      <span className="text-ink/70 text-sm">{label}</span>
                      <Toggle value={port[key]} onChange={(v) => update(`portalSettings.${key}`, v)} />
                    </div>
                  ))}
                </SettingsCard>

                <SettingsCard title="Client Permissions">
                  {[
                    ["clientsCanSeeCompletedRequests", "Can see completed requests"],
                    ["clientsCanViewProjectProgress", "Can view project progress"],
                    ["clientsCanUploadFiles", "Can upload files"],
                    ["clientsCanMessage", "Can send messages"],
                    ["clientsCanViewPerformance", "Can view performance dashboards"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-ink/[0.13] last:border-0">
                      <span className="text-ink/70 text-sm">{label}</span>
                      <Toggle value={port[key]} onChange={(v) => update(`portalSettings.${key}`, v)} />
                    </div>
                  ))}
                </SettingsCard>

                <SettingsCard title="Onboarding & Welcome">
                  <Field label="Show welcome walkthrough">
                    <Toggle value={port.showWelcomeWalkthrough} onChange={(v) => update("portalSettings.showWelcomeWalkthrough", v)} />
                  </Field>
                  <Field label="Welcome message">
                    <TextInput value={port.welcomeMessage} onChange={(v) => update("portalSettings.welcomeMessage", v)} />
                  </Field>
                </SettingsCard>
              </>
            )}

            {/* ── 4. PAGE SETTINGS ── */}
            {activeSection === "pages" && (
              <>
                <SettingsCard title="Command Center Pages" defaultOpen>
                  <div className="space-y-2">
                    {["dashboard","logins","documents","financial","legal","crm","idea-vault","todo","comms","output-analytics"].map((pageId) => {
                      const p = ps[pageId] || {};
                      return (
                        <div key={pageId} className="flex items-center gap-4 p-3 bg-ink/[0.02] rounded-lg border border-ink/[0.13]">
                          <div className="flex-1">
                            <input value={p.label || ""} onChange={(e) => update(`pageSettings.${pageId}.label`, e.target.value)}
                              className="bg-transparent text-sm text-ink/80 font-medium outline-none w-full" />
                          </div>
                          <Toggle value={p.visible !== false} onChange={(v) => update(`pageSettings.${pageId}.visible`, v)} />
                        </div>
                      );
                    })}
                  </div>
                </SettingsCard>

                <SettingsCard title="Portal Pages">
                  <div className="space-y-2">
                    {["client-projects","requests","orbit-seo","web-ops","forge","performance","prestige"].map((pageId) => {
                      const p = ps[pageId] || {};
                      return (
                        <div key={pageId} className="flex items-center gap-4 p-3 bg-ink/[0.02] rounded-lg border border-ink/[0.13]">
                          <div className="flex-1">
                            <input value={p.label || ""} onChange={(e) => update(`pageSettings.${pageId}.label`, e.target.value)}
                              className="bg-transparent text-sm text-ink/80 font-medium outline-none w-full" />
                          </div>
                          <Toggle value={p.visible !== false} onChange={(v) => update(`pageSettings.${pageId}.visible`, v)} />
                        </div>
                      );
                    })}
                  </div>
                </SettingsCard>

                <SettingsCard title="Global Page Defaults">
                  <p className="text-ink/[0.58] text-xs mb-3">Applied to all pages unless overridden individually.</p>
                  {[
                    ["enableSearchGlobal", "Enable search globally"],
                    ["enableFiltersGlobal", "Enable filters globally"],
                    ["enableArchiveGlobal", "Enable archive section globally"],
                    ["enableMetricsGlobal", "Show metrics / summary cards globally"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-ink/[0.13] last:border-0">
                      <span className="text-ink/70 text-sm">{label}</span>
                      <Toggle value={settings[key] !== false} onChange={(v) => update(key, v)} />
                    </div>
                  ))}
                </SettingsCard>
              </>
            )}

            {/* ── 5. FORMS ── */}
            {activeSection === "forms" && (
              <>
                {Object.entries(forms.forms || {}).map(([fKey, f]) => (
                  <SettingsCard key={fKey} title={f.label} description="Form configuration" defaultOpen={fKey === "webops"}>
                    <Field label="Form Label">
                      <TextInput value={f.label} onChange={(v) => update(`formSettings.forms.${fKey}.label`, v)} />
                    </Field>
                    <Field label="Thank-you message">
                      <TextInput value={f.thankYou} onChange={(v) => update(`formSettings.forms.${fKey}.thankYou`, v)} />
                    </Field>
                    <div className="flex items-center justify-between py-2 border-b border-ink/[0.13]">
                      <span className="text-ink/70 text-sm">Form enabled</span>
                      <Toggle value={f.enabled} onChange={(v) => update(`formSettings.forms.${fKey}.enabled`, v)} />
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-ink/[0.13]">
                      <span className="text-ink/70 text-sm">Visible in portal</span>
                      <Toggle value={f.visible} onChange={(v) => update(`formSettings.forms.${fKey}.visible`, v)} />
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-ink/[0.13]">
                      <span className="text-ink/70 text-sm">Urgency field</span>
                      <Toggle value={f.urgencyField} onChange={(v) => update(`formSettings.forms.${fKey}.urgencyField`, v)} />
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-ink/70 text-sm">File upload</span>
                      <Toggle value={f.fileUpload} onChange={(v) => update(`formSettings.forms.${fKey}.fileUpload`, v)} />
                    </div>
                  </SettingsCard>
                ))}

                <SettingsCard title="Global Form Behavior">
                  <Field label="Default request priority">
                    <SelectInput value={forms.defaultPriority} onChange={(v) => update("formSettings.defaultPriority", v)} options={[
                      { value: "Normal", label: "Normal" }, { value: "High Priority", label: "High Priority" }
                    ]} />
                  </Field>
                  <Field label="Default request status on submission">
                    <SelectInput value={forms.defaultStatus} onChange={(v) => update("formSettings.defaultStatus", v)} options={[
                      { value: "Submitted", label: "Submitted" }, { value: "Under Review", label: "Under Review" }
                    ]} />
                  </Field>
                  {[
                    ["autoTagSubmissions", "Auto-tag submissions"],
                    ["requireFileUpload", "Require file upload"],
                    ["notifyAdminOnSubmit", "Notify admin on submission"],
                    ["notifyClientOnUpdate", "Notify client on update"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-ink/[0.13] last:border-0">
                      <span className="text-ink/70 text-sm">{label}</span>
                      <Toggle value={forms[key]} onChange={(v) => update(`formSettings.${key}`, v)} />
                    </div>
                  ))}
                </SettingsCard>
              </>
            )}

            {/* ── 6. CRM & DATA ── */}
            {activeSection === "crm" && (
              <>
                <SettingsCard title="Built-In CRM Fields" description="Core fields — always visible" defaultOpen>
                  {["Business Name", "Contact Name", "Email", "Phone", "Website", "Status", "Services", "Notes", "Documents", "Blog Schedule"].map((f) => (
                    <div key={f} className="flex items-center justify-between py-2 border-b border-ink/[0.13] last:border-0">
                      <span className="text-ink/70 text-sm">{f}</span>
                      <span className="text-[10px] text-green-600/70 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">Required</span>
                    </div>
                  ))}
                </SettingsCard>

                <SettingsCard title="Custom CRM Fields">
                  <div className="space-y-2 mb-4">
                    {(settings.crmCustomFields || []).length === 0 && (
                      <p className="text-ink/[0.43] text-xs">No custom fields yet.</p>
                    )}
                    {(settings.crmCustomFields || []).map((f) => (
                      <div key={f.id} className="flex items-center gap-3 p-3 bg-ink/[0.02] rounded-lg border border-ink/[0.13]">
                        <span className="flex-1 text-ink/70 text-sm">{f.label}</span>
                        <Toggle value={f.visible} onChange={() => toggleCrmFieldVisible(f.id)} />
                        <button onClick={() => removeCrmField(f.id)} className="p-1 text-ink/[0.38] hover:text-red-600/60 transition-colors"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={newCrmField} onChange={(e) => setNewCrmField(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCrmField()}
                      placeholder="New field name..." className="flex-1 bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink/[0.38] outline-none" />
                    <button onClick={addCrmField} className="px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-semibold border border-orange-500/40 rounded-lg text-xs font-medium hover:bg-orange-500/20 transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </SettingsCard>
              </>
            )}

            {/* ── 7. COMMUNICATION ── */}
            {activeSection === "comms" && (
              <>
                <SettingsCard title="Email & Notifications" defaultOpen>
                  <Field label="Default sender email">
                    <TextInput value={comm.senderEmail} onChange={(v) => update("commSettings.senderEmail", v)} />
                  </Field>
                  {[
                    ["adminNotifications", "Admin notifications"],
                    ["clientNotifications", "Client notifications"],
                    ["sendOverdueReminders", "Send overdue reminders"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-ink/[0.13] last:border-0">
                      <span className="text-ink/70 text-sm">{label}</span>
                      <Toggle value={comm[key]} onChange={(v) => update(`commSettings.${key}`, v)} />
                    </div>
                  ))}
                  <Field label="Days before due date to send reminder">
                    <SelectInput value={comm.dueDateReminderDays} onChange={(v) => update("commSettings.dueDateReminderDays", v)} options={[
                      { value: "1", label: "1 day" }, { value: "3", label: "3 days" }, { value: "7", label: "7 days" }
                    ]} />
                  </Field>
                </SettingsCard>

                <SettingsCard title="Messaging Settings">
                  {[
                    ["internalMessaging", "Enable internal messaging"],
                    ["clientMessaging", "Enable client messaging"],
                    ["allowAttachments", "Allow file attachments in messages"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-ink/[0.13] last:border-0">
                      <span className="text-ink/70 text-sm">{label}</span>
                      <Toggle value={comm[key]} onChange={(v) => update(`commSettings.${key}`, v)} />
                    </div>
                  ))}
                </SettingsCard>
              </>
            )}

            {/* ── 8. AUTOMATION ── */}
            {activeSection === "automation" && (
              <>
                <SettingsCard title="Request Automation" defaultOpen>
                  {[
                    ["autoRouteRequests", "Auto-route requests to destination pages"],
                    ["autoCreateTasksOnRequest", "Auto-create tasks on new request"],
                    ["autoConvertToProject", "Auto-convert approved requests to project"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-ink/[0.13] last:border-0">
                      <span className="text-ink/70 text-sm">{label}</span>
                      <Toggle value={auto[key]} onChange={(v) => update(`automationSettings.${key}`, v)} />
                    </div>
                  ))}
                </SettingsCard>

                <SettingsCard title="Status & Workflow">
                  {[
                    ["trackStatusChanges", "Track all status changes"],
                    ["notifyOnStatusChange", "Notify on status change"],
                    ["autoCloseCompleted", "Auto-archive completed items"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-ink/[0.13] last:border-0">
                      <span className="text-ink/70 text-sm">{label}</span>
                      <Toggle value={auto[key]} onChange={(v) => update(`automationSettings.${key}`, v)} />
                    </div>
                  ))}
                </SettingsCard>

                <SettingsCard title="Schedule Automation">
                  {[
                    ["autoGenerateRecurringTasks", "Auto-generate recurring tasks"],
                    ["autoBlogSync", "Auto-sync blog schedule"],
                    ["autoGBPSync", "Auto-sync GBP post schedule"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-ink/[0.13] last:border-0">
                      <span className="text-ink/70 text-sm">{label}</span>
                      <Toggle value={auto[key]} onChange={(v) => update(`automationSettings.${key}`, v)} />
                    </div>
                  ))}
                </SettingsCard>
              </>
            )}

            {/* ── 9. INTEGRATIONS ── */}
            {activeSection === "integrations" && (
              <>
                <SettingsCard title="Google Services" defaultOpen>
                  {["Google Analytics", "Google Search Console", "Google Business Profile", "Gmail / Google Workspace"].map((name) => (
                    <div key={name} className="flex items-center justify-between p-3 bg-ink/[0.02] rounded-lg border border-ink/[0.13]">
                      <div>
                        <p className="text-ink/70 text-sm font-medium">{name}</p>
                        <p className="text-ink/[0.43] text-xs mt-0.5">Not connected</p>
                      </div>
                      <button className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-orange-500 to-amber-400 text-white font-semibold border border-orange-500/40 rounded-lg hover:bg-orange-500/20 transition-colors">
                        Connect
                      </button>
                    </div>
                  ))}
                </SettingsCard>

                <SettingsCard title="Payments & Financial">
                  {["Stripe", "PayPal", "QuickBooks"].map((name) => (
                    <div key={name} className="flex items-center justify-between p-3 bg-ink/[0.02] rounded-lg border border-ink/[0.13]">
                      <div>
                        <p className="text-ink/70 text-sm font-medium">{name}</p>
                        <p className="text-ink/[0.43] text-xs mt-0.5">Not connected</p>
                      </div>
                      <button className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-orange-500 to-amber-400 text-white font-semibold border border-orange-500/40 rounded-lg hover:bg-orange-500/20 transition-colors">
                        Connect
                      </button>
                    </div>
                  ))}
                </SettingsCard>

                <SettingsCard title="Other Integrations">
                  {["Zapier", "Custom API Endpoint"].map((name) => (
                    <div key={name} className="flex items-center justify-between p-3 bg-ink/[0.02] rounded-lg border border-ink/[0.13]">
                      <div>
                        <p className="text-ink/70 text-sm font-medium">{name}</p>
                        <p className="text-ink/[0.43] text-xs mt-0.5">Not connected</p>
                      </div>
                      <button className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-orange-500 to-amber-400 text-white font-semibold border border-orange-500/40 rounded-lg hover:bg-orange-500/20 transition-colors">
                        Connect
                      </button>
                    </div>
                  ))}
                </SettingsCard>
              </>
            )}

            {/* ── 10. BRANDING ── */}
            {activeSection === "branding" && (
              <>
                <SettingsCard title="Visual Brand" defaultOpen>
                  <Field label="Accent Color" help="Applied globally across buttons, highlights, and active states">
                    <div className="flex items-center gap-3">
                      <input type="color" value={brand.accentColor || "#ff3c00"} onChange={(e) => update("brandingSettings.accentColor", e.target.value)}
                        className="h-9 w-16 rounded-lg bg-ink/[0.03] border border-ink/[0.13] cursor-pointer p-1" />
                      <TextInput value={brand.accentColor} onChange={(v) => update("brandingSettings.accentColor", v)} />
                    </div>
                  </Field>
                  <Field label="Theme">
                    <SelectInput value={brand.theme} onChange={(v) => update("brandingSettings.theme", v)} options={[
                      { value: "dark", label: "Dark (Current)" },
                      { value: "light", label: "Light (Coming Soon)" },
                    ]} />
                  </Field>
                  <Field label="Card Density">
                    <SelectInput value={brand.density} onChange={(v) => update("brandingSettings.density", v)} options={[
                      { value: "compact", label: "Compact" },
                      { value: "normal", label: "Normal" },
                      { value: "spacious", label: "Spacious" },
                    ]} />
                  </Field>
                </SettingsCard>

                <SettingsCard title="Portal Branding">
                  <div className="flex items-center justify-between py-2 border-b border-ink/[0.13]">
                    <span className="text-ink/70 text-sm">Show client logo in portal</span>
                    <Toggle value={brand.showClientLogo} onChange={(v) => update("brandingSettings.showClientLogo", v)} />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-ink/70 text-sm">Custom portal colors</span>
                    <Toggle value={brand.customPortalColors} onChange={(v) => update("brandingSettings.customPortalColors", v)} />
                  </div>
                </SettingsCard>
              </>
            )}

            {/* ── 11. STATUSES & TAGS ── */}
            {activeSection === "statuses" && (
              <>
                {[
                  ["requestStatuses", "Request Statuses"],
                  ["projectStatuses", "Project Statuses"],
                  ["clientStatuses", "Client Statuses"],
                ].map(([key, title]) => (
                  <SettingsCard key={key} title={title} defaultOpen={key === "requestStatuses"}>
                    <div className="space-y-2 mb-4">
                      {(settings[key] || []).map((s) => (
                        <div key={s.id} className="flex items-center gap-3 p-3 bg-ink/[0.02] rounded-lg border border-ink/[0.13]">
                          <input type="color" value={s.color} onChange={(e) => update(key, (settings[key] || []).map((x) => x.id === s.id ? { ...x, color: e.target.value } : x))}
                            className="h-6 w-8 rounded bg-transparent border-0 cursor-pointer p-0" />
                          {editingStatus === `${key}-${s.id}` ? (
                            <input autoFocus value={s.label} onChange={(e) => updateStatusLabel(key, s.id, e.target.value)}
                              onBlur={() => setEditingStatus(null)} onKeyDown={(e) => e.key === "Enter" && setEditingStatus(null)}
                              className="flex-1 bg-ink/[0.04] border border-orange-500/30 rounded px-2 py-1 text-sm text-ink outline-none" />
                          ) : (
                            <span className="flex-1 text-ink/70 text-sm font-medium">{s.label}</span>
                          )}
                          <StatusPill label={s.label} color={s.color} />
                          <button onClick={() => setEditingStatus(`${key}-${s.id}`)} className="p-1 text-ink/[0.38] hover:text-ink/60 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => removeStatus(key, s.id)} className="p-1 text-ink/[0.38] hover:text-red-600/60 transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                    {newStatus.section === key ? (
                      <div className="flex items-center gap-2">
                        <input type="color" value={newStatus.color} onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })}
                          className="h-9 w-10 rounded-lg bg-transparent border border-ink/[0.13] cursor-pointer p-1" />
                        <input autoFocus value={newStatus.label} onChange={(e) => setNewStatus({ ...newStatus, label: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") addStatus(key); if (e.key === "Escape") setNewStatus({ section: null, label: "", color: "#ff3c00" }); }}
                          placeholder="Status label..." className="flex-1 bg-ink/[0.03] border border-orange-500/30 rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink/[0.38] outline-none" />
                        <button onClick={() => addStatus(key)} className="p-2 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-semibold border border-orange-500/40 rounded-lg hover:bg-orange-500/20 transition-colors"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setNewStatus({ section: null, label: "", color: "#ff3c00" })} className="p-2 text-ink/[0.48] hover:text-ink/60 transition-colors"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <button onClick={() => setNewStatus({ section: key, label: "", color: "#ff3c00" })} className="w-full flex items-center justify-center gap-2 py-2 bg-ink/[0.02] hover:bg-ink/[0.04] text-ink/[0.58] text-xs font-medium rounded-lg border border-ink/[0.13] transition-colors">
                        <Plus className="w-3.5 h-3.5" />Add Status
                      </button>
                    )}
                  </SettingsCard>
                ))}

                <SettingsCard title="Custom Tags">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(settings.customTags || []).map((tag) => (
                      <span key={tag} className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-600 text-xs font-medium rounded-full">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="text-orange-600/80 hover:text-red-600/70 transition-colors"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                    {(settings.customTags || []).length === 0 && <p className="text-ink/[0.43] text-xs">No tags yet.</p>}
                  </div>
                  <div className="flex gap-2">
                    <input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()}
                      placeholder="New tag..." className="flex-1 bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink/[0.38] outline-none" />
                    <button onClick={addTag} className="px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-semibold border border-orange-500/40 rounded-lg text-xs font-medium hover:bg-orange-500/20 transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </SettingsCard>
              </>
            )}

            {/* ── 12. SECURITY ── */}
            {activeSection === "security" && (
              <>
                <SettingsCard title="Login Methods" defaultOpen>
                  {[
                    ["emailLogin", "Email login"],
                    ["googleLogin", "Google login"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-ink/[0.13] last:border-0">
                      <span className="text-ink/70 text-sm">{label}</span>
                      <Toggle value={sec[key]} onChange={(v) => update(`securitySettings.${key}`, v)} />
                    </div>
                  ))}
                  <Field label="Session timeout (minutes)">
                    <SelectInput value={sec.sessionTimeout} onChange={(v) => update("securitySettings.sessionTimeout", v)} options={[
                      { value: "15", label: "15 minutes" },
                      { value: "30", label: "30 minutes" },
                      { value: "60", label: "1 hour" },
                      { value: "0", label: "Never" },
                    ]} />
                  </Field>
                </SettingsCard>

                <SettingsCard title="Data Access Rules">
                  {[
                    ["requireStrongPasswords", "Require strong passwords"],
                    ["adminDataVisible", "Admin-only data visible to admins only"],
                    ["clientDataIsolation", "Enforce client data isolation"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-ink/[0.13] last:border-0">
                      <span className="text-ink/70 text-sm">{label}</span>
                      <Toggle value={sec[key]} onChange={(v) => update(`securitySettings.${key}`, v)} />
                    </div>
                  ))}
                </SettingsCard>

                <SettingsCard title="Audit Log (Placeholder)">
                  <div className="space-y-2">
                    {[
                      { action: "Settings saved", user: "justin@interstellar-strategies.com", time: "April 12, 2026 — 9:14 AM" },
                      { action: "User accessed CRM", user: "justin@interstellar-strategies.com", time: "April 12, 2026 — 8:50 AM" },
                    ].map((log, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-ink/[0.02] rounded-lg border border-ink/[0.13] text-xs">
                        <AlertCircle className="w-3.5 h-3.5 text-ink/[0.43] shrink-0" />
                        <span className="text-ink/60">{log.action}</span>
                        <span className="text-ink/[0.43] ml-auto">{log.time}</span>
                      </div>
                    ))}
                  </div>
                </SettingsCard>
              </>
            )}

            {/* ── 13. ADVANCED ── */}
            {activeSection === "advanced" && (
              <>
                <SettingsCard title="Developer Settings" defaultOpen>
                  {[
                    ["enableApiAccess", "Enable API access"],
                    ["enableWebhooks", "Enable webhooks"],
                    ["enableDebugMode", "Enable debug mode"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-ink/[0.13] last:border-0">
                      <span className="text-ink/70 text-sm">{label}</span>
                      <Toggle value={adv[key]} onChange={(v) => update(`advancedSettings.${key}`, v)} />
                    </div>
                  ))}
                </SettingsCard>

                <SettingsCard title="Beta Features">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-ink/70 text-sm">Enable experimental features</span>
                    <Toggle value={adv.experimentalFeatures} onChange={(v) => update("advancedSettings.experimentalFeatures", v)} />
                  </div>
                </SettingsCard>

                <SettingsCard title="Data Management">
                  <div className="grid grid-cols-2 gap-3">
                    <button className="flex items-center justify-center gap-2 p-3 bg-ink/[0.02] hover:bg-ink/[0.04] border border-ink/[0.13] rounded-lg text-ink/[0.58] text-xs font-medium transition-colors">
                      <FileText className="w-4 h-4" />Export All Data
                    </button>
                    <button className="flex items-center justify-center gap-2 p-3 bg-ink/[0.02] hover:bg-ink/[0.04] border border-ink/[0.13] rounded-lg text-ink/[0.58] text-xs font-medium transition-colors">
                      <RefreshCw className="w-4 h-4" />System Reset (Placeholder)
                    </button>
                  </div>
                </SettingsCard>
              </>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}