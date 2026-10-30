import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import ClientPerformanceDetail from "../components/performance/ClientPerformanceDetail";
import { Search, Users, TrendingUp, AlertCircle, Globe, BarChart3, Loader2, FileText, Star } from "lucide-react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import GameChartTooltip from "../components/charts/GameChartTooltip";

const TOOLTIP_STYLE = {
  contentStyle: { background: "#f5f3f0", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11 },
  labelStyle: { color: "rgba(255,255,255,0.4)" },
  itemStyle: { color: "#ff3c00" },
};

function getClientScore(client) {
  const blogs = (client.blogs || []).filter(b => b.status === "Published").length;
  const gbpActive = client.gbpStatus === "Active" ? 1 : 0;
  const hasWebsite = client.website ? 1 : 0;
  const hasLocation = client.primaryLocation ? 1 : 0;
  const seed = (client.businessName?.charCodeAt(0) || 65);
  const base = 38 + (seed % 30) + blogs * 3 + gbpActive * 8 + hasWebsite * 5 + hasLocation * 3;
  return Math.min(94, base);
}

function getPerformanceStatus(score) {
  if (score >= 80) return { label: "Strong", color: "text-green-600", bg: "bg-green-500/10 border-green-500/20" };
  if (score >= 65) return { label: "Growing", color: "text-blue-600", bg: "bg-blue-500/10 border-blue-500/20" };
  if (score >= 50) return { label: "Flat", color: "text-ink/50", bg: "bg-ink/5 border-ink/[0.13]" };
  if (score >= 35) return { label: "Needs Attention", color: "text-orange-600", bg: "bg-orange-500/10 border-orange-500/20" };
  return { label: "Critical", color: "text-red-600", bg: "bg-red-500/10 border-red-500/20" };
}

function StatCard({ label, value, icon: Icon, color = "text-orange-500", sub }) {
  return (
    <div className="game-panel p-5">
      <div className="flex items-center justify-between mb-3">
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-3xl font-bold font-display ${color}`}>{value}</p>
      <p className="text-ink/50 text-xs font-medium mt-1">{label}</p>
      {sub && <p className="text-ink/[0.43] text-[10px] mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Performance() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

  useEffect(() => {
    base44.entities.OrbitSEOClient.list("-created_date", 200).then((data) => {
      setClients(data);
      setLoading(false);
    });

    const unsub = base44.entities.OrbitSEOClient.subscribe((e) => {
      setClients((prev) => {
        if (e.type === "create") return [...prev, e.data];
        if (e.type === "update") return prev.map((c) => c.id === e.id ? e.data : c);
        if (e.type === "delete") return prev.filter((c) => c.id !== e.id);
        return prev;
      });
    });
    return unsub;
  }, []);

  if (selectedClient) {
    return <ClientPerformanceDetail client={selectedClient} onBack={() => setSelectedClient(null)} />;
  }

  // Aggregate stats
  const allBlogs = clients.flatMap(c => c.blogs || []);
  const allGbpPosts = clients.flatMap(c => c.gbpPosts || []);
  const now = new Date();
  const publishedThisMonth = allBlogs.filter(b => {
    if (b.status !== "Published" || !b.publishDate) return false;
    const d = new Date(b.publishDate + "T00:00:00");
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const gbpThisMonth = allGbpPosts.filter(p => {
    if (!p.date) return false;
    const d = new Date(p.date + "T00:00:00");
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const scores = clients.map(c => getClientScore(c));
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const improving = clients.filter(c => getClientScore(c) >= 65).length;
  const needsAttention = clients.filter(c => c.status === "Needs Attention" || getClientScore(c) < 50).length;

  // Trend chart mock data
  const trendData = Array.from({ length: 6 }, (_, i) => ({
    month: ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"][i],
    avgScore: Math.round(avgScore - (5 - i) * (Math.random() * 2 + 1)),
    blogs: Math.round(publishedThisMonth * (0.5 + i * 0.1)),
  }));

  const filtered = clients.filter(c => {
    const matchSearch = !search || c.businessName?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "All" || c.serviceType === filterType;
    const score = getClientScore(c);
    const status = getPerformanceStatus(score).label;
    const matchStatus = filterStatus === "All" || status === filterStatus || (filterStatus === "Needs Attention" && (status === "Needs Attention" || status === "Critical"));
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command / Performance" rightText="HyperCare+ Intelligence Center" />

      <div className="px-8 py-6 space-y-6">

        {/* TOP OVERVIEW */}
        <div className="grid grid-cols-8 gap-3">
          <StatCard label="SEO Clients Tracked" value={clients.length} icon={Users} color="text-orange-500" />
          <StatCard label="Avg SEO Score" value={avgScore || "—"} icon={Star} color="text-yellow-600" sub="across all clients" />
          <StatCard label="Clients Improving" value={improving} icon={TrendingUp} color="text-green-600" />
          <StatCard label="Needs Attention" value={needsAttention} icon={AlertCircle} color={needsAttention > 0 ? "text-orange-600" : "text-ink/[0.48]"} />
          <StatCard label="Blogs This Month" value={publishedThisMonth} icon={FileText} color="text-purple-600" />
          <StatCard label="GBP Posts This Month" value={gbpThisMonth} icon={Globe} color="text-cyan-600" />
          <div className="col-span-2 game-panel p-4">
            <p className="text-ink/[0.48] text-[10px] uppercase tracking-wider mb-2">Avg Score Trend</p>
            <ResponsiveContainer width="100%" height={70}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="ovGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff3c00" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#ffaa00" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }} tickLine={false} />
                <Tooltip content={<GameChartTooltip />} cursor={{ stroke: 'rgba(255,170,0,0.25)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="avgScore" stroke="#ff3c00" fill="url(#ovGrad)" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: '#ff3c00', stroke: '#ffaa00', strokeWidth: 1 }} style={{ filter: 'drop-shadow(0 0 5px rgba(255,170,0,0.4))' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* FILTERS */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/[0.38]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients..." className="w-full pl-10 pr-4 py-2 bg-card border border-ink/[0.13] rounded-lg text-sm text-ink placeholder:text-ink/[0.38] outline-none" />
          </div>
          <div className="flex gap-1.5">
            {["All", "Local", "National", "International"].map((t) => (
              <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterType === t ? "bg-gradient-to-r from-orange-500/20 to-amber-400/10 text-orange-600 border border-orange-500/30" : "text-ink/[0.48] hover:text-ink/50 border border-transparent"}`}>{t}</button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {["All", "Strong", "Growing", "Flat", "Needs Attention"].map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === s ? "bg-gradient-to-r from-orange-500/20 to-amber-400/10 text-orange-600 border border-orange-500/30" : "text-ink/[0.48] hover:text-ink/50 border border-transparent"}`}>{s}</button>
            ))}
          </div>
          <span className="ml-auto text-ink/[0.43] text-xs">{filtered.length} clients</span>
        </div>

        {/* CLIENT LIST */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-ink/[0.38] animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="game-panel p-12 text-center">
            <BarChart3 className="w-8 h-8 text-ink/[0.28] mx-auto mb-3" />
            <p className="text-ink/[0.48] text-sm">{clients.length === 0 ? "No HyperCare+ clients yet. Add clients in the HyperCare+ section." : "No clients match your filters."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-4 px-4 pb-2">
              <span className="col-span-3 text-ink/[0.43] text-[10px] uppercase tracking-wider">Client</span>
              <span className="col-span-1 text-ink/[0.43] text-[10px] uppercase tracking-wider text-center">SEO Score</span>
              <span className="col-span-1 text-ink/[0.43] text-[10px] uppercase tracking-wider text-center">Authority</span>
              <span className="col-span-2 text-ink/[0.43] text-[10px] uppercase tracking-wider">Type</span>
              <span className="col-span-2 text-ink/[0.43] text-[10px] uppercase tracking-wider">GBP Status</span>
              <span className="col-span-1 text-ink/[0.43] text-[10px] uppercase tracking-wider text-center">Blogs</span>
              <span className="col-span-2 text-ink/[0.43] text-[10px] uppercase tracking-wider text-right">Status</span>
            </div>
            {filtered.map((client) => {
              const score = getClientScore(client);
              const authority = Math.max(18, score - 12 - ((client.businessName?.charCodeAt(1) || 66) % 15));
              const perf = getPerformanceStatus(score);
              const publishedBlogs = (client.blogs || []).filter(b => b.status === "Published").length;
              const scoreColor = score >= 75 ? "text-[#34D399]" : score >= 55 ? "text-[#ff3c00]" : "text-red-600";
              const authorityColor = authority >= 60 ? "text-[#34D399]" : authority >= 40 ? "text-[#ff3c00]" : "text-red-600";

              return (
                <button key={client.id} onClick={() => setSelectedClient(client)} className="card-hover w-full game-panel p-4 grid grid-cols-12 gap-4 items-center text-left group">
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500/25 to-yellow-400/10 border border-orange-500/25 flex items-center justify-center text-orange-600 font-display font-extrabold text-sm shrink-0">
                      {client.businessName?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-ink/85 text-sm font-medium truncate">{client.businessName}</p>
                      <p className="text-ink/[0.48] text-xs truncate">{client.primaryLocation || "—"}</p>
                    </div>
                  </div>
                  <div className="col-span-1 text-center">
                    <span className={`text-lg font-bold font-display ${scoreColor}`}>{score}</span>
                    <p className="text-ink/[0.38] text-[10px] font-display">/100</p>
                  </div>
                  <div className="col-span-1 text-center">
                    <span className={`text-lg font-bold font-display ${authorityColor}`}>{authority}</span>
                    <p className="text-ink/[0.38] text-[10px] font-display">/100</p>
                  </div>
                  <div className="col-span-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                      client.serviceType === "Local" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                      client.serviceType === "National" ? "bg-purple-500/10 text-purple-600 border-purple-500/20" :
                      "bg-orange-500/10 text-orange-600 border-orange-500/20"
                    }`}>{client.serviceType}</span>
                  </div>
                  <div className="col-span-2">
                    <span className={`text-xs font-medium ${client.gbpStatus === "Active" ? "text-green-600/70" : client.gbpStatus === "Needs Attention" ? "text-orange-600" : "text-ink/[0.48]"}`}>
                      {client.gbpStatus || "—"}
                    </span>
                  </div>
                  <div className="col-span-1 text-center">
                    <span className="text-ink/70 text-sm font-semibold font-display">{publishedBlogs}</span>
                    <p className="text-ink/[0.38] text-[10px]">published</p>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border ${perf.bg} ${perf.color}`}>{perf.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}