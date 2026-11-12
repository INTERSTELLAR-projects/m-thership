import { useState, useEffect } from "react";
import { Plus, Search, Globe, MapPin, Loader2, BarChart3, Calendar, AlertCircle, Users, X, Check, RefreshCw, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import ClientDetail from "../components/orbitseo/ClientDetail";
import WorkloadSnapshot from "../components/orbitseo/WorkloadSnapshot";

const SERVICE_TYPE_COLORS = {
  Local: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  National: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  International: "bg-orange-500/10 text-orange-600 border-orange-500/20",
};

const GBP_COLORS = {
  Active: "text-green-600",
  "Needs Attention": "text-orange-600",
  "Not Applicable": "text-ink/[0.43]",
  Paused: "text-ink/[0.43]",
};

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr + "T00:00:00") < new Date();
}

function isDueThisWeek(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const week = new Date();
  week.setDate(now.getDate() + 7);
  return d >= now && d <= week;
}

export default function OrbitSEO() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [newClient, setNewClient] = useState({ businessName: "", serviceType: "Local", status: "Active" });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    base44.entities.OrbitSEOClient.list("-created_date", 200).then((data) => {
      setClients(data);
      setLoading(false);
    });
  }, []);

  const syncFromCRM = async () => {
    setSyncing(true);
    setSyncResult(null);
    const crmClients = await base44.entities.CRMClient.list("business", 200);
    const orbitClients = await base44.entities.OrbitSEOClient.list("businessName", 200);
    const existingNames = new Set(orbitClients.map((c) => c.businessName?.toLowerCase()));

    // Filter CRM clients that have an HyperCare+ related service OR import all active ones
    const toImport = crmClients.filter((c) => {
      const hasOrbitService = (c.services || []).some((s) =>
        s.name?.toLowerCase().includes("orbit") ||
        s.name?.toLowerCase().includes("seo") ||
        s.name?.toLowerCase().includes("ørbit")
      );
      return hasOrbitService && !existingNames.has(c.business?.toLowerCase());
    });

    let added = 0;
    for (const c of toImport) {
      const created = await base44.entities.OrbitSEOClient.create({
        businessName: c.business,
        website: (c.websites || [])[0] || "",
        primaryLocation: "",
        serviceType: "Local",
        status: "Active",
        blogFrequency: (c.blogSchedule || []).map((b) => `${b.count}x ${b.frequency}`).join(", ") || "",
        blogs: [],
        gbpPosts: [],
        tasks: [],
        notes: "",
      });
      setClients((prev) => [...prev, created]);
      added++;
    }
    setSyncing(false);
    setSyncResult(added === 0 ? "No new clients found (already imported or no SEO service tagged in CRM)." : `${added} client${added > 1 ? "s" : ""} imported from CRM.`);
    setTimeout(() => setSyncResult(null), 5000);
  };

  const addClient = async () => {
    if (!newClient.businessName.trim()) return;
    const created = await base44.entities.OrbitSEOClient.create({
      ...newClient,
      blogs: [],
      gbpPosts: [],
      tasks: [],
    });
    setClients([...clients, created]);
    setNewClient({ businessName: "", serviceType: "Local", status: "Active" });
    setAddOpen(false);
  };

  const updateClient = (updated) => {
    setClients((prev) => prev.map((c) => c.id === updated.id ? updated : c));
  };

  const deleteClient = async (id) => {
    if (!window.confirm("Delete this client? This cannot be undone.")) return;
    await base44.entities.OrbitSEOClient.delete(id);
    setClients((prev) => prev.filter((c) => c.id !== id));
  };

  const filtered = clients.filter((c) => {
    const matchSearch = !search || c.businessName?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "All" || c.serviceType === filterType;
    const matchStatus = filterStatus === "All" || c.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  // Stats
  const totalClients = clients.length;
  const allBlogs = clients.flatMap((c) => c.blogs || []);
  const publishedThisMonth = allBlogs.filter((b) => {
    if (b.status !== "Published" || !b.publishDate) return false;
    const d = new Date(b.publishDate + "T00:00:00");
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const upcomingBlogs = allBlogs.filter((b) => b.status !== "Published" && isDueThisWeek(b.publishDate)).length;
  const gbpDueThisWeek = clients.filter((c) => isDueThisWeek(c.gbpNextDue)).length;
  const needsAttention = clients.filter((c) => c.status === "Needs Attention").length;
  const byType = { Local: 0, National: 0, International: 0 };
  clients.forEach((c) => { if (byType[c.serviceType] !== undefined) byType[c.serviceType]++; });

  const selectedClient = clients.find((c) => c.id === selectedId);

  if (selectedClient) {
    return <ClientDetail client={selectedClient} onBack={() => setSelectedId(null)} onUpdate={updateClient} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command / HyperCare+" rightText="HyperCare+ strategy editor" />

      <div className="px-8 py-6 space-y-6">

        {/* OVERVIEW STATS */}
        <div className="grid grid-cols-6 gap-3">
          <StatCard label="SEO Clients" value={totalClients} icon={Users} color="text-orange-500" />
          <StatCard label="Published This Month" value={publishedThisMonth} icon={BarChart3} color="text-green-600" />
          <StatCard label="Blogs Due This Week" value={upcomingBlogs} icon={Calendar} color="text-blue-600" />
          <StatCard label="GBP Due This Week" value={gbpDueThisWeek} icon={Globe} color="text-purple-600" />
          <StatCard label="Needs Attention" value={needsAttention} icon={AlertCircle} color={needsAttention > 0 ? "text-orange-600" : "text-ink/[0.43]"} />
          <div className="game-panel p-4">
            <p className="text-ink/[0.48] text-[10px] uppercase tracking-wider mb-2">Client Breakdown</p>
            <div className="space-y-1">
              {Object.entries(byType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-ink/[0.58] text-xs">{type}</span>
                  <span className="text-ink/70 text-xs font-bold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* WORKLOAD SNAPSHOT */}
        {!loading && <WorkloadSnapshot clients={clients} />}

        {/* FILTERS + ADD */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/[0.38]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="w-full pl-10 pr-4 py-2 bg-card border border-ink/[0.13] rounded-lg text-sm text-ink placeholder:text-ink/[0.38] outline-none"
            />
          </div>
          <div className="flex gap-1.5">
            {["All", "Local", "National", "International"].map((t) => (
              <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterType === t ? "bg-gradient-to-r from-orange-500/20 to-amber-400/10 text-orange-600 border border-orange-500/30" : "text-ink/[0.48] hover:text-ink/50 border border-transparent"}`}>{t}</button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {["All", "Active", "Needs Attention", "Paused"].map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === s ? "bg-gradient-to-r from-orange-500/20 to-amber-400/10 text-orange-600 border border-orange-500/30" : "text-ink/[0.48] hover:text-ink/50 border border-transparent"}`}>{s}</button>
            ))}
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-semibold text-xs font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />Add Client
          </button>
          <button
            onClick={syncFromCRM}
            disabled={syncing}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-ink/5 hover:bg-ink/[0.08] border border-ink/[0.13] text-ink/60 hover:text-ink/80 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Syncing..." : "Sync from CRM"}
          </button>
        </div>
        {syncResult && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 text-xs">
            <Check className="w-3.5 h-3.5 shrink-0" />{syncResult}
          </div>
        )}

        {/* CLIENT GRID */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-ink/[0.38] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="game-panel p-12 text-center">
            <Globe className="w-8 h-8 text-ink/[0.28] mx-auto mb-3" />
            <p className="text-ink/[0.48] text-sm">{clients.length === 0 ? "No SEO clients yet. Add your first one." : "No clients match your filters."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((client) => (
              <ClientCard key={client.id} client={client} onClick={() => setSelectedId(client.id)} onDelete={() => deleteClient(client.id)} />
            ))}
          </div>
        )}
      </div>

      {/* ADD MODAL */}
      {addOpen && (
        <div className="fixed inset-0 z-50 bg-ink/60 flex items-center justify-center">
          <div className="bg-card border border-ink/[0.13] rounded-md p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-sm tracking-wide bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Add HyperCare+ Client</h3>
              <button onClick={() => setAddOpen(false)} className="text-ink/[0.48] hover:text-ink/60"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-ink/[0.58] text-xs block mb-1">Business Name</label>
                <input
                  autoFocus
                  value={newClient.businessName}
                  onChange={(e) => setNewClient({ ...newClient, businessName: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addClient()}
                  className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink outline-none"
                />
              </div>
              <div>
                <label className="text-ink/[0.58] text-xs block mb-1">Service Type</label>
                <select value={newClient.serviceType} onChange={(e) => setNewClient({ ...newClient, serviceType: e.target.value })} className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink outline-none">
                  {["Local", "National", "International"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <button onClick={addClient} className="w-full py-2 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-semibold text-sm font-semibold rounded-lg transition-colors">Add Client</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="game-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-2xl font-bold font-display ${color}`}>{value}</p>
      <p className="text-ink/[0.48] text-[10px] uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

function ClientCard({ client, onClick, onDelete }) {
  const overdueBlogs = (client.blogs || []).filter((b) => b.status !== "Published" && isOverdue(b.publishDate)).length;
  const gbpOverdue = isOverdue(client.gbpNextDue);

  return (
    // A div acting as a button: the card holds its own delete button, and a <button> inside a <button> is invalid HTML.
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }}
      className="card-hover text-left game-panel p-5 space-y-4 w-full cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/25 to-yellow-400/10 border border-orange-500/25 flex items-center justify-center text-orange-600 font-display font-extrabold shrink-0">
            {client.businessName?.charAt(0)}
          </div>
          <div>
            <p className="text-ink/90 font-semibold text-sm">{client.businessName}</p>
            {client.primaryLocation && (
              <p className="text-ink/[0.48] text-xs flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{client.primaryLocation}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${SERVICE_TYPE_COLORS[client.serviceType] || "bg-ink/5 text-ink/[0.48] border-ink/[0.13]"}`}>
            {client.serviceType}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
            client.status === "Active" ? "bg-green-500/10 text-green-600" :
            client.status === "Paused" ? "bg-ink/5 text-ink/[0.48]" :
            "bg-orange-500/10 text-orange-600"
          }`}>{client.status}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 text-ink/[0.33] hover:text-red-600/70 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Blog frequency + posting days */}
        <div>
          <p className="text-ink/[0.43] text-[10px] uppercase tracking-wider mb-1">Blog Frequency</p>
          <p className="text-xs font-semibold text-ink/70">{client.blogFrequency || "—"}</p>
          {(client.blogDays || []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
                .map((lbl, idx) => ({ lbl, num: idx }))
                .filter(({ num }) => (client.blogDays || []).includes(num))
                .map(({ lbl, num }) => (
                  <span key={num} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/15">{lbl}</span>
                ))}
            </div>
          )}
        </div>

        {/* GBP status + Google Shop */}
        <div className="space-y-2">
          <div>
            <p className="text-ink/[0.43] text-[10px] uppercase tracking-wider mb-1">GBP</p>
            <p className={`text-xs font-semibold ${GBP_COLORS[client.gbpStatus] || "text-ink/[0.48]"}`}>{client.gbpStatus || "—"}</p>
          </div>
          <div>
            <p className="text-ink/[0.43] text-[10px] uppercase tracking-wider mb-1">Google Shop</p>
            <p className={`text-xs font-semibold ${GBP_COLORS[client.googleShopStatus] || "text-ink/[0.48]"}`}>{client.googleShopStatus || "—"}</p>
          </div>
        </div>
      </div>

      {(overdueBlogs > 0 || gbpOverdue) && (
        <div className="flex items-center gap-2 pt-1 border-t border-ink/[0.13]">
          <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
          <p className="text-orange-600 text-xs">
            {overdueBlogs > 0 && `${overdueBlogs} overdue blog${overdueBlogs > 1 ? "s" : ""}`}
            {overdueBlogs > 0 && gbpOverdue && " · "}
            {gbpOverdue && "GBP post overdue"}
          </p>
        </div>
      )}

      {client.nextBlogDue && (
        <div className="flex items-center justify-between pt-1 border-t border-ink/[0.13]">
          <span className="text-ink/[0.43] text-[10px]">Next blog due</span>
          <span className={`text-xs font-medium ${isOverdue(client.nextBlogDue) ? "text-orange-600" : "text-ink/50"}`}>
            {new Date(client.nextBlogDue + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, small }) {
  return (
    <div>
      <p className="text-ink/[0.43] text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-semibold text-ink/70 ${small ? "text-xs" : "text-sm"}`}>{value}</p>
    </div>
  );
}