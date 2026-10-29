import PageHeader from "../components/PageHeader";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Area, AreaChart } from "recharts";

const trafficData = [
  { month: "Oct", desktop: 1200, mobile: 800 },
  { month: "Nov", desktop: 1500, mobile: 1100 },
  { month: "Dec", desktop: 1800, mobile: 1300 },
  { month: "Jan", desktop: 2200, mobile: 1600 },
  { month: "Feb", desktop: 2500, mobile: 1900 },
  { month: "Mar", desktop: 2800, mobile: 2200 },
];

const conversionData = [
  { month: "Oct", rate: 2.1 },
  { month: "Nov", rate: 2.8 },
  { month: "Dec", rate: 3.2 },
  { month: "Jan", rate: 3.5 },
  { month: "Feb", rate: 4.1 },
  { month: "Mar", rate: 4.6 },
];

export default function Analytics() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command Center / Analytics" rightText="Performance Overview" />

      <div className="px-8 py-6 space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard label="Total Visits" value="12,450" change="+18%" />
          <MetricCard label="Avg Session" value="3m 24s" change="+7%" />
          <MetricCard label="Bounce Rate" value="38.2%" change="-4%" positive />
          <MetricCard label="Conversions" value="286" change="+22%" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-6">
          <div className="game-panel p-5">
            <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent mb-4">Traffic Overview</h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trafficData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.15)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Bar dataKey="desktop" fill="#ff3c00" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="mobile" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-ink/[0.43] text-xs">Desktop</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-ink/[0.43] text-xs">Mobile</span>
              </div>
            </div>
          </div>

          <div className="game-panel p-5">
            <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent mb-4">Conversion Rate</h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={conversionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.15)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Area type="monotone" dataKey="rate" stroke="#ff3c00" fill="#ff3c00" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, change, positive }) {
  const isPositive = change.startsWith("+") || positive;
  return (
    <div className="game-panel p-5">
      <p className="text-ink/[0.43] text-xs mb-2">{label}</p>
      <p className="text-xl font-display font-extrabold bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">{value}</p>
      <p className={`text-xs mt-1 font-medium ${isPositive ? "text-green-600/60" : "text-red-600/60"}`}>{change} vs last month</p>
    </div>
  );
}