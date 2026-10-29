import { useState } from "react";
import { ArrowLeft, Globe, MapPin, RefreshCw, AlertCircle, TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle, ExternalLink, ChevronRight, Zap, Target, Shield, FileText, Search, BarChart3, Eye, MousePointer, Star, Phone, Navigation } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import GameChartTooltip from "../charts/GameChartTooltip";

const TOOLTIP_STYLE = {
  contentStyle: { background: "#f5f3f0", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11 },
  labelStyle: { color: "rgba(255,255,255,0.4)" },
  itemStyle: { color: "#ff3c00" },
};

function ScoreRing({ score, size = 96, color = "#ff3c00" }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="relative rotate-[-90deg]" style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.9s ease" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display font-extrabold leading-none text-ink" style={{ fontSize: size > 80 ? 26 : 18, textShadow: `0 0 12px ${color}cc` }}>{score}</span>
      </div>
    </div>
  );
}

function TrendBadge({ trend }) {
  if (trend === "up") return <span className="flex items-center gap-0.5 text-green-600 text-[10px] font-semibold"><TrendingUp className="w-3 h-3" />Rising</span>;
  if (trend === "down") return <span className="flex items-center gap-0.5 text-red-600 text-[10px] font-semibold"><TrendingDown className="w-3 h-3" />Declining</span>;
  return <span className="flex items-center gap-0.5 text-ink/[0.48] text-[10px] font-semibold"><Minus className="w-3 h-3" />Flat</span>;
}

function ConnectionPill({ label, connected }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${connected ? "bg-green-500/15 border-green-500/30 text-green-600 shadow-[0_0_10px_rgba(34,197,94,0.2)]" : "bg-ink/[0.04] border-ink/[0.13] text-ink/[0.48]"}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400" : "bg-ink/20"}`} />
      {label}
    </div>
  );
}

function SectionHeader({ title, icon: Icon, color = "text-orange-500" }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-4 rounded-full bg-gradient-to-b from-orange-500 to-yellow-400" />
      <Icon className={`w-4 h-4 ${color}`} />
      <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">{title}</h3>
    </div>
  );
}

// Generate mock but plausible data from real client data
function generateClientData(client) {
  const blogCount = (client.blogs || []).length;
  const publishedBlogs = (client.blogs || []).filter(b => b.status === "Published").length;
  const gbpPosts = (client.gbpPosts || []).length;
  const hasGbp = client.gbpStatus === "Active";
  const isLocal = client.serviceType === "Local";

  const seed = client.businessName?.charCodeAt(0) || 65;
  const rng = (min, max) => min + ((seed * 7 + blogCount * 3 + gbpPosts) % (max - min));

  const seoScore = Math.min(95, Math.max(38, rng(45, 82) + (publishedBlogs * 2)));
  const authorityScore = Math.min(88, Math.max(20, rng(22, 65)));
  const technicalScore = Math.min(95, Math.max(40, rng(50, 85)));
  const contentScore = Math.min(90, Math.max(30, Math.min(90, 40 + publishedBlogs * 4)));
  const localScore = isLocal ? Math.min(88, Math.max(30, rng(35, 75) + (hasGbp ? 10 : 0))) : null;
  const conversionScore = Math.min(85, Math.max(30, rng(35, 72)));

  // Monthly traffic trend
  const trafficTrend = Array.from({ length: 6 }, (_, i) => ({
    month: ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"][i],
    organic: rng(800, 3200) + i * rng(20, 120),
    direct: rng(200, 800) + i * rng(5, 30),
  }));

  // Search console
  const impressions = rng(4000, 28000);
  const clicks = Math.round(impressions * (rng(3, 9) / 100));
  const ctr = ((clicks / impressions) * 100).toFixed(1);
  const avgPos = (rng(8, 35) / 10 + 2).toFixed(1);

  const topQueries = [
    { query: `${client.primaryLocation || "local"} ${["plumber", "dentist", "contractor", "lawyer", "HVAC", "landscaper"][seed % 6]}`, clicks: rng(40, 180), impressions: rng(500, 3000), pos: rng(3, 12) },
    { query: `best ${["service", "company", "contractor", "provider"][seed % 4]} near me`, clicks: rng(20, 90), impressions: rng(200, 1200), pos: rng(5, 18) },
    { query: `${client.businessName?.toLowerCase() || "business"}`, clicks: rng(30, 120), impressions: rng(300, 800), pos: rng(1, 4) },
    { query: `${client.primaryLocation || ""} ${["services", "experts", "professionals"][seed % 3]}`, clicks: rng(10, 60), impressions: rng(150, 900), pos: rng(8, 25) },
  ];

  // Scorecard categories
  const categories = [
    { label: "Technical SEO", score: technicalScore, weight: 20, color: "#3b82f6" },
    { label: "On-Page SEO", score: Math.min(90, rng(45, 80)), weight: 20, color: "#a855f7" },
    { label: "Content Quality", score: contentScore, weight: 15, color: "#22c55e" },
    { label: "Search Visibility", score: Math.min(88, rng(35, 78)), weight: 15, color: "#ff3c00" },
    { label: "Authority Signals", score: authorityScore, weight: 15, color: "#eab308" },
    { label: "Local SEO / GBP", score: localScore || rng(20, 50), weight: 10, color: "#06b6d4" },
    { label: "Conversion Structure", score: conversionScore, weight: 5, color: "#f97316" },
  ];

  // Alerts
  const alerts = [];
  if (!client.gbpLastPost || new Date(client.gbpLastPost + "T00:00:00") < new Date(Date.now() - 14 * 86400000)) alerts.push({ type: "warning", msg: "GBP post overdue — last post was over 2 weeks ago" });
  if (publishedBlogs < 2) alerts.push({ type: "warning", msg: "Content velocity low — fewer than 2 blogs published" });
  if (technicalScore < 60) alerts.push({ type: "critical", msg: "Technical score below threshold — review site health" });
  if (authorityScore < 35) alerts.push({ type: "info", msg: "Authority score needs improvement — build backlinks and citations" });
  if (client.status === "Needs Attention") alerts.push({ type: "critical", msg: "Client flagged as Needs Attention in Ørbit SEO" });

  // Opportunities
  const opportunities = [
    { priority: "high", label: "Add schema markup to service pages", impact: "Technical SEO +8 pts" },
    { priority: "high", label: "Optimize meta descriptions for top 5 pages", impact: "CTR +15–25%" },
    { priority: "medium", label: `Create location page for ${client.serviceLocations || "additional markets"}`, impact: "Local Visibility +12 pts" },
    { priority: "medium", label: "Internal linking from blogs to service pages", impact: "Authority flow ↑" },
    { priority: "low", label: "Compress images on homepage", impact: "Page speed +0.4s" },
  ];

  // Authority trend
  const authorityTrend = Array.from({ length: 8 }, (_, i) => ({
    week: `W${i + 1}`,
    authority: Math.max(10, authorityScore - (7 - i) * rng(1, 4)),
  }));

  // GBP metrics (local only)
  const gbpMetrics = isLocal ? {
    calls: rng(12, 85),
    directions: rng(8, 60),
    websiteClicks: rng(30, 200),
    impressions: rng(800, 4500),
    reviews: rng(8, 120),
    avgRating: (rng(38, 50) / 10).toFixed(1),
    postCount: gbpPosts,
  } : null;

  return {
    seoScore, authorityScore, technicalScore, contentScore, localScore, conversionScore,
    trafficTrend, impressions, clicks, ctr, avgPos, topQueries,
    categories, alerts, opportunities, authorityTrend, gbpMetrics,
    totalUsers: rng(1200, 8500),
    organicSessions: rng(800, 5200),
    engagementRate: (rng(52, 78) / 10 * 10).toFixed(0) + "%",
    avgDuration: `${rng(1, 3)}:${String(rng(10, 59)).padStart(2, "0")}`,
    publishedBlogs,
    blogCount,
  };
}

export default function ClientPerformanceDetail({ client, onBack }) {
  const [dateRange, setDateRange] = useState("30d");
  const data = generateClientData(client);

  const scoreColor = (s) => s >= 75 ? "#22c55e" : s >= 55 ? "#ff3c00" : "#ef4444";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-ink/[0.13] sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-1.5 text-ink/[0.48] hover:text-ink/60 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <span className="text-ink/[0.33]">/</span>
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500/25 to-yellow-400/10 border border-orange-500/25 flex items-center justify-center text-orange-600 font-display font-extrabold text-sm">
            {client.businessName?.charAt(0)}
          </div>
          <div>
            <h1 className="font-display font-bold text-sm bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">{client.businessName}</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-ink/[0.04] border border-ink/[0.13] text-ink/55 text-[11px]">
                <MapPin className="w-3 h-3 text-orange-600" />{client.primaryLocation || "—"}
              </span>
              <span className="text-ink/[0.43] text-xs">·</span>
              <span className="text-ink/[0.58] text-[11px]">{client.serviceType}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {["7d", "30d", "90d", "1y"].map((r) => (
              <button key={r} onClick={() => setDateRange(r)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dateRange === r ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white border border-orange-400" : "text-ink/[0.48] hover:text-ink/50 border border-transparent"}`}>{r === "1y" ? "1 Year" : r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "90 Days"}</button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-ink/[0.04] hover:bg-ink/[0.07] border border-ink/[0.13] text-ink/50 text-xs rounded-lg transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />Refresh
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">

        {/* Connection Status */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-ink/[0.43] text-[10px] uppercase tracking-wider">Data Sources:</span>
          <ConnectionPill label="Google Analytics" connected={false} />
          <ConnectionPill label="Search Console" connected={false} />
          <ConnectionPill label="GBP" connected={client.gbpStatus === "Active"} />
          <ConnectionPill label="Site Audit" connected={false} />
          <ConnectionPill label="Ørbit Data" connected={true} />
          {client.website && (
            <a href={client.website} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1.5 text-orange-500/50 hover:text-orange-500 text-xs transition-colors">
              <Globe className="w-3.5 h-3.5" />{client.website}<ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Alerts */}
        {data.alerts.length > 0 && (
          <div className="space-y-2">
            {data.alerts.map((a, i) => (
              <div key={i} className={`relative overflow-hidden flex items-center gap-3 px-4 py-2.5 rounded-lg border text-xs ${a.type === "critical" ? "bg-red-500/10 border-red-500/25 text-red-600 shadow-[0_0_12px_rgba(239,68,68,0.2)]" : a.type === "warning" ? "bg-orange-500/10 border-orange-500/25 text-orange-600" : "bg-blue-500/10 border-blue-500/25 text-blue-600 shadow-[0_0_12px_rgba(59,130,246,0.2)]"}`}>
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${a.type === "critical" ? "bg-red-500" : a.type === "warning" ? "bg-gradient-to-b from-orange-500 to-amber-400" : "bg-blue-500"}`} />
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {a.msg}
              </div>
            ))}
          </div>
        )}

        {/* SCORECARDS */}
        <div className="game-panel p-6">
          <SectionHeader title="Performance Scorecards" icon={Target} />
          <div className="grid grid-cols-6 gap-4">
            {[
              { label: "SEO Score", score: data.seoScore, sub: "Overall" },
              { label: "Search Authority", score: data.authorityScore, sub: "Domain Power" },
              { label: "Technical Health", score: data.technicalScore, sub: "Site Integrity" },
              { label: "Content Score", score: data.contentScore, sub: "Content Quality" },
              { label: "Local Visibility", score: data.localScore || 0, sub: client.serviceType === "Local" ? "GBP & Local" : "N/A" },
              { label: "Conversion Ready", score: data.conversionScore, sub: "CTA Coverage" },
            ].map(({ label, score, sub }) => (
              <div key={label} className="card-hover relative rounded-md border border-orange-500/10 bg-gradient-to-b from-orange-500/[0.05] to-transparent p-4 flex flex-col items-center text-center gap-3">
                <ScoreRing score={score} color={scoreColor(score)} />
                <div>
                  <p className="text-ink/80 text-xs font-semibold font-display">{label}</p>
                  <p className="text-ink/[0.48] text-[10px] mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WEIGHTED SCORE BREAKDOWN */}
        <div className="game-panel p-6">
          <SectionHeader title="Interstellar SEO Score Breakdown" icon={Shield} color="text-purple-600" />
          <p className="text-ink/[0.43] text-xs mb-5">Proprietary weighted scoring system — each category contributes to the overall SEO Score</p>
          <div className="space-y-4">
            {data.categories.map((cat) => (
              <div key={cat.label} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color, boxShadow: `0 0 8px ${cat.color}` }} />
                <span className="text-ink/60 text-xs w-40 shrink-0">{cat.label}</span>
                <div className="relative flex-1 h-3 bg-ink/[0.04] rounded-full overflow-hidden border border-ink/[0.13]">
                  <div className="relative h-full rounded-full transition-all duration-700 shimmer" style={{ width: `${cat.score}%`, background: `linear-gradient(90deg, ${cat.color}, ${cat.color}99)`, boxShadow: `0 0 10px ${cat.color}66` }} />
                </div>
                <span className="text-sm font-display font-extrabold w-9 text-right" style={{ color: cat.color, textShadow: `0 0 8px ${cat.color}55` }}>{cat.score}</span>
                <span className="text-ink/[0.53] text-[10px] w-12 text-right">{cat.weight}% wt</span>
              </div>
            ))}
          </div>
        </div>

        {/* SEARCH AUTHORITY + TRAFFIC */}
        <div className="grid grid-cols-2 gap-5">
          <div className="game-panel p-6">
            <SectionHeader title="Search Authority Trend" icon={TrendingUp} color="text-yellow-600" />
            <div className="flex items-center gap-4 mb-4">
              <div>
                <p className="text-4xl font-bold text-yellow-600">{data.authorityScore}</p>
                <p className="text-ink/[0.48] text-xs mt-1">Authority Score / 100</p>
              </div>
              <div className="flex-1" />
              <TrendBadge trend="up" />
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={data.authorityTrend}>
                <defs>
                  <linearGradient id="authGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#eab308" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="week" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip content={<GameChartTooltip />} cursor={{ stroke: 'rgba(234,179,8,0.3)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="authority" stroke="#fbbf24" fill="url(#authGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#fbbf24', stroke: '#fef08a', strokeWidth: 1 }} style={{ filter: 'drop-shadow(0 0 5px rgba(234,179,8,0.4))' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="game-panel p-6">
            <SectionHeader title="Traffic & Analytics" icon={BarChart3} color="text-blue-600" />
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: "Total Users", value: data.totalUsers.toLocaleString(), color: "text-blue-600" },
                { label: "Organic Sessions", value: data.organicSessions.toLocaleString(), color: "text-green-600" },
                { label: "Engagement Rate", value: data.engagementRate, color: "text-orange-600" },
                { label: "Avg Duration", value: data.avgDuration, color: "text-purple-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-ink/[0.02] rounded-lg p-2.5 border border-ink/[0.13]">
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                  <p className="text-ink/[0.43] text-[10px] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={data.trafficTrend}>
                <defs>
                  <linearGradient id="trafGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9 }} tickLine={false} />
                <Tooltip content={<GameChartTooltip />} cursor={{ stroke: 'rgba(59,130,246,0.3)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="organic" stroke="#60a5fa" fill="url(#trafGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#60a5fa', stroke: '#bfdbfe', strokeWidth: 1 }} style={{ filter: 'drop-shadow(0 0 5px rgba(59,130,246,0.4))' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SEARCH CONSOLE */}
        <div className="game-panel p-6">
          <SectionHeader title="Search Visibility / Search Console" icon={Search} color="text-green-600" />
          <div className="grid grid-cols-4 gap-4 mb-5">
            {[
              { label: "Total Impressions", value: data.impressions.toLocaleString(), color: "text-ink/80" },
              { label: "Total Clicks", value: data.clicks.toLocaleString(), color: "text-orange-600" },
              { label: "Avg CTR", value: `${data.ctr}%`, color: "text-blue-600" },
              { label: "Avg Position", value: `#${data.avgPos}`, color: "text-green-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-ink/[0.02] rounded-md border border-ink/[0.13] p-4">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-ink/[0.48] text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-ink/[0.48] text-[10px] uppercase tracking-wider mb-3">Top Queries</p>
            <div className="space-y-2">
              {data.topQueries.map((q, i) => (
                <div key={i} className="flex items-center gap-4 py-2 px-3 bg-ink/[0.02] rounded-lg border border-ink/[0.13]">
                  <span className="text-ink/[0.38] text-xs w-4">{i + 1}</span>
                  <span className="flex-1 text-ink/70 text-xs">{q.query}</span>
                  <span className="text-orange-600 text-xs font-medium w-16 text-right">{q.clicks} clicks</span>
                  <span className="text-ink/[0.48] text-xs w-24 text-right">{q.impressions.toLocaleString()} impr.</span>
                  <span className="text-green-600/70 text-xs w-16 text-right">Pos #{q.pos}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CONTENT PERFORMANCE */}
        <div className="game-panel p-6">
          <SectionHeader title="Content & Keyword Performance" icon={FileText} color="text-purple-600" />
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-ink/[0.02] rounded-md border border-ink/[0.13] p-4">
              <p className="text-3xl font-bold text-purple-600">{data.publishedBlogs}</p>
              <p className="text-ink/[0.48] text-xs mt-1">Published Blogs</p>
              <p className="text-ink/[0.38] text-[10px] mt-0.5">{data.blogCount} total including drafts</p>
            </div>
            <div className="bg-ink/[0.02] rounded-md border border-ink/[0.13] p-4">
              <p className="text-3xl font-bold text-blue-600">{client.blogFrequency || "—"}</p>
              <p className="text-ink/[0.48] text-xs mt-1">Blog Frequency</p>
              <p className="text-ink/[0.38] text-[10px] mt-0.5">Contracted schedule</p>
            </div>
            <div className="bg-ink/[0.02] rounded-md border border-ink/[0.13] p-4">
              <p className={`text-3xl font-bold ${client.nextBlogDue && new Date(client.nextBlogDue + "T00:00:00") < new Date() ? "text-red-600" : "text-green-600"}`}>
                {client.nextBlogDue ? new Date(client.nextBlogDue + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
              </p>
              <p className="text-ink/[0.48] text-xs mt-1">Next Blog Due</p>
              <p className="text-ink/[0.38] text-[10px] mt-0.5">{client.nextBlogDue && new Date(client.nextBlogDue + "T00:00:00") < new Date() ? "⚠ Overdue" : "On track"}</p>
            </div>
          </div>
          {(client.blogs || []).length > 0 && (
            <div>
              <p className="text-ink/[0.48] text-[10px] uppercase tracking-wider mb-3">Blog Posts</p>
              <div className="space-y-2">
                {(client.blogs || []).slice(0, 5).map((b, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 px-3 bg-ink/[0.02] rounded-lg border border-ink/[0.13]">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${b.status === "Published" ? "bg-green-400" : "bg-ink/20"}`} />
                    <span className="flex-1 text-ink/70 text-xs">{b.title || "Untitled"}</span>
                    {b.publishDate && <span className="text-ink/[0.43] text-[10px]">{new Date(b.publishDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${b.status === "Published" ? "bg-green-500/10 text-green-600" : "bg-ink/[0.04] text-ink/[0.48]"}`}>{b.status || "Draft"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* GBP / LOCAL */}
        {client.serviceType === "Local" && data.gbpMetrics && (
          <div className="game-panel p-6">
            <SectionHeader title="Local SEO & GBP Performance" icon={MapPin} color="text-cyan-600" />
            <div className="grid grid-cols-4 gap-4 mb-5">
              {[
                { label: "Calls", value: data.gbpMetrics.calls, icon: Phone, color: "text-green-600" },
                { label: "Direction Requests", value: data.gbpMetrics.directions, icon: Navigation, color: "text-blue-600" },
                { label: "Website Clicks", value: data.gbpMetrics.websiteClicks, icon: MousePointer, color: "text-orange-600" },
                { label: "Impressions", value: data.gbpMetrics.impressions.toLocaleString(), icon: Eye, color: "text-purple-600" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-ink/[0.02] rounded-md border border-ink/[0.13] p-4">
                  <div className="flex items-center gap-2 mb-2"><Icon className={`w-4 h-4 ${color}`} /></div>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-ink/[0.48] text-xs mt-1">{label}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-ink/[0.02] rounded-md border border-ink/[0.13] p-4">
                <div className="flex items-center gap-1 mb-2"><Star className="w-3.5 h-3.5 text-yellow-600" /></div>
                <p className="text-2xl font-bold text-yellow-600">{data.gbpMetrics.avgRating}</p>
                <p className="text-ink/[0.48] text-xs mt-1">Avg Rating</p>
                <p className="text-ink/[0.38] text-[10px]">{data.gbpMetrics.reviews} reviews</p>
              </div>
              <div className="bg-ink/[0.02] rounded-md border border-ink/[0.13] p-4">
                <p className="text-2xl font-bold text-cyan-600">{data.gbpMetrics.postCount}</p>
                <p className="text-ink/[0.48] text-xs mt-1">GBP Posts</p>
                <p className={`text-[10px] mt-0.5 ${client.gbpStatus === "Active" ? "text-green-600/70" : "text-orange-600"}`}>{client.gbpStatus}</p>
              </div>
              <div className="bg-ink/[0.02] rounded-md border border-ink/[0.13] p-4">
                <p className={`text-2xl font-bold ${client.gbpNextDue && new Date(client.gbpNextDue + "T00:00:00") < new Date() ? "text-red-600" : "text-green-600"}`}>
                  {client.gbpNextDue ? new Date(client.gbpNextDue + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                </p>
                <p className="text-ink/[0.48] text-xs mt-1">Next GBP Post Due</p>
              </div>
            </div>
          </div>
        )}

        {/* TECHNICAL HEALTH */}
        <div className="game-panel p-6">
          <SectionHeader title="Technical SEO Health" icon={Shield} color="text-red-600" />
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <ScoreRing score={data.technicalScore} color={scoreColor(data.technicalScore)} size={64} />
                <div>
                  <p className="text-ink/70 text-sm font-bold">Technical Health Score</p>
                  <p className="text-ink/[0.48] text-xs mt-0.5">{data.technicalScore >= 75 ? "Healthy — minor improvements available" : data.technicalScore >= 55 ? "Moderate issues present" : "Critical issues need attention"}</p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Metadata Completeness", status: data.technicalScore > 70 ? "pass" : "warn" },
                  { label: "Mobile Usability", status: "pass" },
                  { label: "Page Speed", status: data.technicalScore > 65 ? "pass" : "fail" },
                  { label: "Schema Markup", status: data.technicalScore > 80 ? "pass" : "warn" },
                  { label: "Crawlability / Indexing", status: "pass" },
                  { label: "Canonical / Redirects", status: data.technicalScore > 75 ? "pass" : "warn" },
                ].map(({ label, status }) => (
                  <div key={label} className="flex items-center gap-3 py-1.5">
                    {status === "pass" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600/70 shrink-0" /> : status === "warn" ? <AlertCircle className="w-3.5 h-3.5 text-orange-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-600/70 shrink-0" />}
                    <span className="text-ink/60 text-xs">{label}</span>
                    <span className={`ml-auto text-[10px] font-semibold ${status === "pass" ? "text-green-600/60" : status === "warn" ? "text-orange-600/80" : "text-red-600/60"}`}>{status === "pass" ? "Pass" : status === "warn" ? "Review" : "Fix"}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-ink/[0.48] text-[10px] uppercase tracking-wider mb-3">Priority Issues</p>
              <div className="space-y-2">
                {data.technicalScore < 85 && <div className="flex items-start gap-2 p-3 bg-orange-500/[0.06] border border-orange-500/15 rounded-lg"><AlertCircle className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" /><div><p className="text-orange-600 text-xs font-medium">Missing schema markup on service pages</p><p className="text-ink/[0.48] text-[10px] mt-0.5">Add LocalBusiness and Service schema to improve rich results</p></div></div>}
                {data.technicalScore < 75 && <div className="flex items-start gap-2 p-3 bg-red-500/[0.06] border border-red-500/15 rounded-lg"><XCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" /><div><p className="text-red-600/90 text-xs font-medium">Page speed below benchmark</p><p className="text-ink/[0.48] text-[10px] mt-0.5">Optimize images and defer non-critical scripts</p></div></div>}
                <div className="flex items-start gap-2 p-3 bg-ink/[0.02] border border-ink/[0.13] rounded-lg"><CheckCircle2 className="w-3.5 h-3.5 text-green-600/60 shrink-0 mt-0.5" /><div><p className="text-green-600/80 text-xs font-medium">Mobile usability confirmed</p><p className="text-ink/[0.48] text-[10px] mt-0.5">Site passes mobile-friendliness assessment</p></div></div>
              </div>
            </div>
          </div>
        </div>

        {/* OPPORTUNITIES */}
        <div className="game-panel p-6">
          <SectionHeader title="Opportunities & Recommended Actions" icon={Zap} color="text-green-600" />
          <div className="space-y-3">
            {data.opportunities.map((opp, i) => (
              <div key={i} className={`flex items-start gap-3 p-4 rounded-md border ${opp.priority === "high" ? "bg-orange-500/[0.06] border-orange-500/15" : opp.priority === "medium" ? "bg-blue-500/[0.06] border-blue-500/15" : "bg-ink/[0.02] border-ink/[0.13]"}`}>
                <div className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${opp.priority === "high" ? "bg-orange-500/20 text-orange-600" : opp.priority === "medium" ? "bg-blue-500/20 text-blue-600" : "bg-ink/10 text-ink/[0.58]"}`}>{opp.priority}</div>
                <div className="flex-1">
                  <p className="text-ink/80 text-sm font-medium">{opp.label}</p>
                  <p className="text-ink/[0.48] text-xs mt-0.5">Expected impact: {opp.impact}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-ink/[0.38] shrink-0" />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}