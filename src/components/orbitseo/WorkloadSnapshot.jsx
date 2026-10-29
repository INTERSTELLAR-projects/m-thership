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

  // Blogs/week = sum of how many days per week each client posts (directly from blogDays)
  const totalBlogsPerWeek = activeClients.reduce((sum, c) => sum + (c.blogDays || []).length, 0);

  // Blogs/month = sum of declared monthly frequency per client
  const totalBlogsPerMonth = activeClients.reduce((sum, c) => sum + parseFrequencyCount(c.blogFrequency), 0);

  // GBP posts: same counts but only non-international clients
  const gbpActiveClients = clients.filter(
    (c) => c.status === "Active" && c.serviceType !== "International" && (c.blogDays || []).length > 0
  );
  const totalGBPPerWeek = gbpActiveClients.reduce((sum, c) => sum + (c.blogDays || []).length, 0);
  const totalGBPPerMonth = gbpActiveClients.reduce((sum, c) => sum + parseFrequencyCount(c.blogFrequency), 0);

  // Combined totals
  const totalContentPerWeek = totalBlogsPerWeek + totalGBPPerWeek;
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
    <div className="game-panel">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-ink/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-orange-500 to-yellow-400" />
          <h2 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Workload Snapshot</h2>
          <span className="text-ink/[0.43] text-[10px]">Active client content obligations</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-ink/[0.43]" /> : <ChevronDown className="w-4 h-4 text-ink/[0.43]" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-ink/[0.13]">

          {/* Top KPIs */}
          <div className="grid grid-cols-6 gap-3 pt-4">
            <KPI label="Blogs / Week" value={totalBlogsPerWeek} color="text-blue-600" />
            <KPI label="Blogs / Month" value={totalBlogsPerMonth} color="text-blue-600" />
            <KPI label="GBP Posts / Week" value={totalGBPPerWeek} color="text-purple-600" />
            <KPI label="GBP Posts / Month" value={totalGBPPerMonth} color="text-purple-600" />
            <KPI label="Total Content / Week" value={totalContentPerWeek} color="text-orange-600" />
            <KPI label="Total Content / Month" value={totalContentPerMonth} color="text-orange-600" />
          </div>

          {/* Per-day breakdown */}
          <div>
            <p className="font-display text-[10px] tracking-[0.2em] uppercase mb-3 bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Content Due by Day of Week</p>
            {dayBreakdown.length === 0 ? (
              <p className="text-ink/[0.38] text-xs">No clients have blog days scheduled yet.</p>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {WEEKDAYS.map((wd) => {
                  const d = dayBreakdown.find((x) => x.num === wd.num);
                  const isEmpty = !d;
                  return (
                    <div
                      key={wd.num}
                      className={`rounded-lg border p-3 text-center ${isEmpty ? "border-ink/[0.13] bg-ink/[0.01] opacity-40" : "border-orange-500/20 bg-orange-500/[0.04]"}`}
                    >
                      <p className="text-ink/[0.58] text-[10px] font-semibold uppercase tracking-wider mb-2">{wd.label}</p>
                      {isEmpty ? (
                        <p className="text-ink/[0.33] text-xs">—</p>
                      ) : (
                        <>
                          <div className="flex items-center justify-center gap-1.5 mb-1.5">
                            <FileText className="w-3 h-3 text-blue-600/70" />
                            <span className="text-blue-600 font-bold text-sm">{d.blogs}</span>
                          </div>
                          <div className="flex items-center justify-center gap-1.5 mb-2">
                            <MapPin className="w-3 h-3 text-purple-600/70" />
                            <span className="text-purple-600 font-bold text-sm">{d.gbp}</span>
                          </div>
                          <div className="text-[10px] font-bold text-orange-600 bg-gradient-to-r from-orange-500/15 to-amber-400/10 border border-orange-500/25 rounded px-1.5 py-0.5">
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
          <div className="flex items-center gap-6 pt-1 border-t border-ink/[0.13]">
            {busiestDay && (
              <div className="flex items-center gap-2">
                <span className="text-ink/[0.48] text-xs">Busiest day:</span>
                <span className="text-orange-600 text-xs font-semibold">{busiestDay.label} ({busiestDay.total} pieces)</span>
              </div>
            )}
            {unscheduledCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-ink/[0.48] text-xs">No schedule set:</span>
                <span className="text-orange-600 text-xs font-semibold">{unscheduledCount} client{unscheduledCount > 1 ? "s" : ""}</span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-4">
              <div className="flex items-center gap-1.5"><FileText className="w-3 h-3 text-blue-600/70" /><span className="text-ink/[0.48] text-[10px]">Blog</span></div>
              <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-purple-600/70" /><span className="text-ink/[0.48] text-[10px]">GBP Post</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, color }) {
  return (
    <div className="relative overflow-hidden bg-ink/[0.02] rounded-lg border border-orange-500/10 p-3 text-center">
      <p className={`relative text-xl font-display font-extrabold ${color}`}>{value}</p>
      <p className="relative text-ink/[0.48] text-[10px] uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}