import { useState, useEffect } from "react";
import { Plus, Search, Globe, MapPin, Loader2, BarChart3, Calendar, AlertCircle, Users, X, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import ClientDetail from "../components/orbitseo/ClientDetail";

const SERVICE_TYPE_COLORS = {
  Local: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  National: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  International: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const GBP_COLORS = {
  Active: "text-green-400",
  "Needs Attention": "text-orange-400",
  "Not Applicable": "text-white/25",
  Paused: "text-white/25",
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

  useEffect(() => {
    base44.entities.OrbitSEOClient.list("-created_date", 200).then((data) => {
      setClients(data);
      setLoading(false);
    });
  }, []);

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
      <PageHeader breadcrumb="Portal / Ørbit SEO" rightText="SEO Command Center" />

      <div className="px-8 py-6 space-y-6">

        {/* OVERVIEW STATS */}
        <div className="grid grid-cols-6 gap-3">
          <StatCard label="SEO Clients" value={totalClients} icon={Users} color="text-orange-500" />
          <StatCard label="Published This Month" value={publishedThisMonth} icon={BarChart3} color="text-green-400" />
          <StatCard label="Blogs Due This Week" value={upcomingBlogs} icon={Calendar} color="text-blue-400" />
          <StatCard label="GBP Due This Week" value={gbpDueThisWeek} icon={Globe} color="text-purple-400" />
          <StatCard label="Needs Attention" value={needsAttention} icon={AlertCircle} color={needsAttention > 0 ? "text-orange-400" : "text-white/25"} />
          <div className="bg-card rounded-xl border border-white/[0.06] p-4">
            <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2">Client Breakdown</p>
            <div className="space-y-1">
              {Object.entries(byType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-white/40 text-xs">{type}</span>
                  <span className="text-white/70 text-xs font-bold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FILTERS + ADD */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="w-full pl-10 pr-4 py-2 bg-card border border-white/[0.06] rounded-lg text-sm text-white placeholder:text-white/20 outline-none"
            />
          </div>
          <div className="flex gap-1.5">
            {["All", "Local", "National", "International"].map((t) => (
              <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterType === t ? "bg-orange-500/15 text-orange-500 border border-orange-500/20" : "text-white/30 hover:text-white/50 border border-transparent"}`}>{t}</button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {["All", "Active", "Needs Attention", "Paused"].map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === s ? "bg-orange-500/15 text-orange-500 border border-orange-500/20" : "text-white/30 hover:text-white/50 border border-transparent"}`}>{s}</button>
            ))}
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />Add Client
          </button>
        </div>

        {/* CLIENT GRID */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-xl border border-white/[0.06] p-12 text-center">
            <Globe className="w-8 h-8 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">{clients.length === 0 ? "No SEO clients yet. Add your first one." : "No clients match your filters."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((client) => (
              <ClientCard key={client.id} client={client} onClick={() => setSelectedId(client.id)} />
            ))}
          </div>
        )}
      </div>

      {/* ADD MODAL */}
      {addOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-card border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-sm">Add Ørbit SEO Client</h3>
              <button onClick={() => setAddOpen(false)} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-white/40 text-xs block mb-1">Business Name</label>
                <input
                  autoFocus
                  value={newClient.businessName}
                  onChange={(e) => setNewClient({ ...newClient, businessName: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addClient()}
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none"
                />
              </div>
              <div>
                <label className="text-white/40 text-xs block mb-1">Service Type</label>
                <select value={newClient.serviceType} onChange={(e) => setNewClient({ ...newClient, serviceType: e.target.value })} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none">
                  {["Local", "National", "International"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <button onClick={addClient} className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">Add Client</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-card rounded-xl border border-white/[0.06] p-4">
      <div className="flex items-center justify-between mb-3">
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-white/30 text-[10px] uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

function ClientCard({ client, onClick }) {
  const overdueBlogs = (client.blogs || []).filter((b) => b.status !== "Published" && isOverdue(b.publishDate)).length;
  const publishedBlogs = (client.blogs || []).filter((b) => b.status === "Published").length;
  const plannedBlogs = (client.blogs || []).filter((b) => b.status !== "Published").length;
  const gbpOverdue = isOverdue(client.gbpNextDue);

  return (
    <button
      onClick={onClick}
      className="card-hover text-left bg-card rounded-xl border border-white/[0.06] p-5 space-y-4 w-full"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/15 flex items-center justify-center text-orange-500/60 font-bold shrink-0">
            {client.businessName?.charAt(0)}
          </div>
          <div>
            <p className="text-white/90 font-semibold text-sm">{client.businessName}</p>
            {client.primaryLocation && (
              <p className="text-white/30 text-xs flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{client.primaryLocation}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${SERVICE_TYPE_COLORS[client.serviceType] || "bg-white/5 text-white/30 border-white/10"}`}>
            {client.serviceType}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
            client.status === "Active" ? "bg-green-500/10 text-green-400" :
            client.status === "Paused" ? "bg-white/5 text-white/30" :
            "bg-orange-500/10 text-orange-400"
          }`}>{client.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <MiniStat label="Blogs Live" value={publishedBlogs} />
        <MiniStat label="Planned" value={plannedBlogs} />
        <MiniStat label="Blog Freq" value={client.blogFrequency || "—"} small />
        <div>
          <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">GBP</p>
          <p className={`text-xs font-semibold ${GBP_COLORS[client.gbpStatus] || "text-white/30"}`}>{client.gbpStatus || "—"}</p>
        </div>
      </div>

      {(overdueBlogs > 0 || gbpOverdue) && (
        <div className="flex items-center gap-2 pt-1 border-t border-white/[0.04]">
          <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
          <p className="text-orange-400 text-xs">
            {overdueBlogs > 0 && `${overdueBlogs} overdue blog${overdueBlogs > 1 ? "s" : ""}`}
            {overdueBlogs > 0 && gbpOverdue && " · "}
            {gbpOverdue && "GBP post overdue"}
          </p>
        </div>
      )}

      {client.nextBlogDue && (
        <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
          <span className="text-white/25 text-[10px]">Next blog due</span>
          <span className={`text-xs font-medium ${isOverdue(client.nextBlogDue) ? "text-orange-400" : "text-white/50"}`}>
            {new Date(client.nextBlogDue + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>
      )}
    </button>
  );
}

function MiniStat({ label, value, small }) {
  return (
    <div>
      <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-semibold text-white/70 ${small ? "text-xs" : "text-sm"}`}>{value}</p>
    </div>
  );
}