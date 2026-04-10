import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, LineChart, Line, Tooltip } from "recharts";
import { TrendingUp, DollarSign, Percent, Target, ArrowUpRight, Loader2 } from "lucide-react";

const MRR_GOAL = 10000;

// Static historical trend (last 6 months leading to current)
const HISTORY = [
  { month: "Oct", revenue: 2100 },
  { month: "Nov", revenue: 2400 },
  { month: "Dec", revenue: 2800 },
  { month: "Jan", revenue: 3100 },
  { month: "Feb", revenue: 3200 },
  { month: "Mar", revenue: 3471 },
];

export default function FinancialAnalytics({ totalMonthlyExpenses }) {
  const [mrr, setMrr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.CRMClient.list("-created_date", 200).then((clients) => {
      const revenue = clients
        .filter((c) => c.status === "Active")
        .reduce((sum, c) => sum + (c.services || []).reduce((s, sv) => s + (sv.price || 0), 0), 0);
      setMrr(revenue || 3471);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
    </div>
  );

  const arr = mrr * 12;
  const monthlyExpenses = totalMonthlyExpenses || 563.98;
  const grossProfit = mrr - monthlyExpenses;
  const grossMargin = (grossProfit / mrr) * 100;
  const netProfit = grossProfit; // same since no COGS beyond expenses
  const netMargin = (netProfit / mrr) * 100;
  const annualExpenses = monthlyExpenses * 12;
  const annualProfit = arr - annualExpenses;
  const mrrProgress = (mrr / MRR_GOAL) * 100;

  // Month-over-month from history
  const lastTwo = HISTORY.slice(-2);
  const mom = lastTwo.length === 2 ? ((lastTwo[1].revenue - lastTwo[0].revenue) / lastTwo[0].revenue) * 100 : 0;

  // Year-over-year (compare current month vs same month last year — estimate from history start)
  const yoy = ((HISTORY[HISTORY.length - 1].revenue - HISTORY[0].revenue) / HISTORY[0].revenue) * 100;

  // Chart data with current live MRR replacing last entry
  const chartData = [
    ...HISTORY.slice(0, -1),
    { month: "Now", revenue: mrr },
  ];

  // Expense vs revenue for bar chart
  const expVsRev = [
    { label: "Revenue", value: mrr, fill: "#FF6A00" },
    { label: "Expenses", value: monthlyExpenses, fill: "#3B82F6" },
    { label: "Profit", value: grossProfit, fill: "#22C55E" },
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="MRR" value={`$${mrr.toLocaleString()}`} sub="Monthly Recurring Revenue" highlight icon={DollarSign} />
        <MetricCard label="ARR" value={`$${arr.toLocaleString()}`} sub="Annual Recurring Revenue" icon={TrendingUp} />
        <MetricCard label="Gross Margin" value={`${grossMargin.toFixed(1)}%`} sub={`$${grossProfit.toFixed(2)} / mo profit`} icon={Percent} good={grossMargin > 60} />
        <MetricCard label="Net Margin" value={`${netMargin.toFixed(1)}%`} sub={`$${netProfit.toFixed(2)} / mo net`} icon={Percent} good={netMargin > 50} />
      </div>

      {/* Growth Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="MoM Growth" value={`+${mom.toFixed(1)}%`} sub="vs last month" icon={ArrowUpRight} good />
        <MetricCard label="YoY Growth" value={`+${yoy.toFixed(1)}%`} sub="vs 6 months ago" icon={ArrowUpRight} good />
        <MetricCard label="Annual Profit" value={`$${annualProfit.toLocaleString("en-US", { maximumFractionDigits: 0 })}`} sub="Revenue - Expenses" icon={DollarSign} good />
        <MetricCard label="Annual Expenses" value={`$${annualExpenses.toLocaleString("en-US", { maximumFractionDigits: 0 })}`} sub="Total yearly spend" icon={DollarSign} />
      </div>

      {/* MRR Goal Progress */}
      <div className="bg-card rounded-xl border border-white/[0.06] p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-white font-bold text-xs tracking-[0.15em] uppercase">MRR Goal Progress</h3>
            <p className="text-white/25 text-xs mt-0.5">Target: ${MRR_GOAL.toLocaleString()}/mo</p>
          </div>
          <div className="text-right">
            <p className="text-orange-500 font-bold text-lg">{mrrProgress.toFixed(0)}%</p>
            <p className="text-white/25 text-xs">${(MRR_GOAL - mrr).toLocaleString()} to go</p>
          </div>
        </div>
        <div className="h-3 bg-white/[0.05] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-700" style={{ width: `${Math.min(mrrProgress, 100)}%` }} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-white/[0.06] p-5">
          <p className="text-white/30 text-[10px] tracking-wider uppercase mb-3">Revenue Trend</p>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff', fontSize: 11 }} formatter={(v) => [`$${v.toLocaleString()}`, "Revenue"]} />
                <Line type="monotone" dataKey="revenue" stroke="#FF6A00" strokeWidth={2} dot={{ fill: '#FF6A00', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-white/[0.06] p-5">
          <p className="text-white/30 text-[10px] tracking-wider uppercase mb-3">Revenue vs Expenses (Monthly)</p>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expVsRev} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff', fontSize: 11 }} formatter={(v) => [`$${v.toLocaleString()}`, ""]} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#FF6A00" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="bg-card rounded-xl border border-white/[0.06] p-5">
        <h3 className="text-white font-bold text-xs tracking-[0.15em] uppercase mb-4">P&amp;L Summary</h3>
        <div className="space-y-2">
          {[
            { label: "Monthly Revenue (MRR)", value: `$${mrr.toLocaleString()}`, color: "text-orange-500" },
            { label: "Monthly Expenses", value: `-$${monthlyExpenses.toFixed(2)}`, color: "text-red-400/70" },
            { label: "Monthly Net Profit", value: `$${grossProfit.toFixed(2)}`, color: "text-green-400" },
            { label: "", value: "" },
            { label: "Annual Revenue (ARR)", value: `$${arr.toLocaleString()}`, color: "text-orange-500" },
            { label: "Annual Expenses", value: `-$${annualExpenses.toFixed(2)}`, color: "text-red-400/70" },
            { label: "Annual Net Profit", value: `$${annualProfit.toFixed(2)}`, color: "text-green-400" },
            { label: "", value: "" },
            { label: "Gross Profit Margin", value: `${grossMargin.toFixed(2)}%`, color: "text-blue-400" },
            { label: "Net Profit Margin", value: `${netMargin.toFixed(2)}%`, color: "text-blue-400" },
            { label: "Expense Ratio", value: `${((monthlyExpenses / mrr) * 100).toFixed(2)}%`, color: "text-white/50" },
          ].map((row, i) =>
            row.label ? (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                <span className="text-white/45 text-sm">{row.label}</span>
                <span className={`text-sm font-semibold ${row.color}`}>{row.value}</span>
              </div>
            ) : <div key={i} className="py-1" />
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, icon: Icon, highlight, good }) {
  return (
    <div className="bg-card rounded-xl border border-white/[0.06] p-4">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className={`w-3.5 h-3.5 ${highlight ? "text-orange-500" : good ? "text-green-400/60" : "text-white/20"}`} />}
        <span className="text-white/30 text-[10px] tracking-wider uppercase">{label}</span>
      </div>
      <p className={`text-xl font-bold ${highlight ? "text-orange-500" : good ? "text-green-400" : "text-white/80"}`}>{value}</p>
      {sub && <p className="text-white/25 text-[10px] mt-1">{sub}</p>}
    </div>
  );
}