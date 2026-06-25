import { useState } from "react";
import { FileText, MapPin, ChevronDown, ChevronUp } from "lucide-react";

const WEEKDAYS = [
  { num: 1, label: "Mon" },
  { num: 2, label: "Tue" },
  { num: 3, label: "Wed" },
  { num: 4, label: "Thu" },
  { num: 5, label: "Fri" },
  { num: 6, label: "Sat" },
  { num: 0, label: "Sun" },
];

// Parse "4x per month" → 4, "2x per month" → 2, etc.
function parseFrequencyCount(freq) {
  if (!freq) return 0;
  const match = freq.match(/^(\d+)x/);
  return match ? parseInt(match[1]) : 0;
}

export default function WorkloadSnapshot({ clients }) {
  const [expanded, setExpanded] = useState(true);

  const activeClients = clients.filter((c) => c.status === "Active" && (c.blogDays || []).length > 0);

  // Total blogs per month across all clients (sum of frequencies)
  const totalBlogsPerMonth = activeClients.reduce((sum, c) => sum + parseFrequencyCount(c.blogFrequency), 0);

  // Total blogs per week = monthly / ~4.33
  const totalBlogsPerWeek = Math.round(totalBlogsPerMonth / 4.33 * 10) / 10;

  // GBP posts per month (non-international clients with blog days)
  const gbpActiveClients = clients.filter(
    (c) => c.status === "Active" && c.serviceType !== "International" && (c.blogDays || []).length > 0
  );
  const totalGBPPerMonth = gbpActiveClients.reduce((sum, c) => sum + parseFrequencyCount(c.blogFrequency), 0);
  const totalGBPPerWeek = Math.round(totalGBPPerMonth / 4.33 * 10) / 10;

  // Combined content pieces per week (blog + GBP)
  const totalContentPerWeek = Math.round((totalBlogsPerWeek + totalGBPPerWeek) * 10) / 10;
  const totalContentPerMonth = totalBlogsPerMonth + totalGBPPerMonth;

  // Per-day breakdown: count how many clients post on each day
  const dayBreakdown = WEEKDAYS.map((day) => {
    const blogClients = activeClients.filter((c) => (c.blogDays || []).includes(day.num));
    const gbpClients = gbpActiveClients.filter((c) => (c.blogDays || []).includes(day.num));
    return {
      ...day,
      blogs: blogClients.length,
      gbp: gbpClients.length,
      total: blogClients.length + gbpClients.length,
      clientNames: blogClients.map((c) => c.businessName),
    };
  }).filter((d) => d.total > 0);

  // Busiest day
  const busiestDay = dayBreakdown.reduce((max, d) => d.total > (max?.total || 0) ? d : max, null);

  // Clients without a schedule set
  const unscheduledCount = clients.filter((c) => c.status === "Active" && (c.blogDays || []).length === 0).length;

  return (
    <div className="bg-card rounded-xl border border-white/[0.06] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-4 rounded-full bg-orange-500/60" />
          <h2 className="text-white font-bold text-xs tracking-[0.18em] uppercase">Workload Snapshot</h2>
          <span className="text-white/25 text-[10px]">Active client content obligations</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-white/25" /> : <ChevronDown className="w-4 h-4 text-white/25" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-white/[0.04]">

          {/* Top KPIs */}
          <div className="grid grid-cols-6 gap-3 pt-4">
            <KPI label="Blogs / Week" value={totalBlogsPerWeek} color="text-blue-400" />
            <KPI label="Blogs / Month" value={totalBlogsPerMonth} color="text-blue-400" />
            <KPI label="GBP Posts / Week" value={totalGBPPerWeek} color="text-purple-400" />
            <KPI label="GBP Posts / Month" value={totalGBPPerMonth} color="text-purple-400" />
            <KPI label="Total Content / Week" value={totalContentPerWeek} color="text-orange-400" />
            <KPI label="Total Content / Month" value={totalContentPerMonth} color="text-orange-400" />
          </div>

          {/* Per-day breakdown */}
          <div>
            <p className="text-white/30 text-[10px] uppercase tracking-wider mb-3">Content Due by Day of Week</p>
            {dayBreakdown.length === 0 ? (
              <p className="text-white/20 text-xs">No clients have blog days scheduled yet.</p>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {WEEKDAYS.map((wd) => {
                  const d = dayBreakdown.find((x) => x.num === wd.num);
                  const isEmpty = !d;
                  return (
                    <div
                      key={wd.num}
                      className={`rounded-lg border p-3 text-center ${isEmpty ? "border-white/[0.03] bg-white/[0.01] opacity-40" : "border-white/[0.07] bg-white/[0.03]"}`}
                    >
                      <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mb-2">{wd.label}</p>
                      {isEmpty ? (
                        <p className="text-white/15 text-xs">—</p>
                      ) : (
                        <>
                          <div className="flex items-center justify-center gap-1.5 mb-1.5">
                            <FileText className="w-3 h-3 text-blue-400/70" />
                            <span className="text-blue-400 font-bold text-sm">{d.blogs}</span>
                          </div>
                          <div className="flex items-center justify-center gap-1.5 mb-2">
                            <MapPin className="w-3 h-3 text-purple-400/70" />
                            <span className="text-purple-400 font-bold text-sm">{d.gbp}</span>
                          </div>
                          <div className="text-[10px] font-bold text-orange-400/80 bg-orange-500/10 rounded px-1.5 py-0.5">
                            {d.total} total
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom row: busiest day + unscheduled + legend */}
          <div className="flex items-center gap-6 pt-1 border-t border-white/[0.04]">
            {busiestDay && (
              <div className="flex items-center gap-2">
                <span className="text-white/30 text-xs">Busiest day:</span>
                <span className="text-orange-400 text-xs font-semibold">{busiestDay.label} ({busiestDay.total} pieces)</span>
              </div>
            )}
            {unscheduledCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-white/30 text-xs">No schedule set:</span>
                <span className="text-orange-400/70 text-xs font-semibold">{unscheduledCount} client{unscheduledCount > 1 ? "s" : ""}</span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-4">
              <div className="flex items-center gap-1.5"><FileText className="w-3 h-3 text-blue-400/70" /><span className="text-white/30 text-[10px]">Blog</span></div>
              <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-purple-400/70" /><span className="text-white/30 text-[10px]">GBP Post</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, color }) {
  return (
    <div className="bg-white/[0.02] rounded-lg border border-white/[0.05] p-3 text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-white/30 text-[10px] uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}