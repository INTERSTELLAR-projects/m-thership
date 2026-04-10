import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from "recharts";
import { base44 } from "@/api/base44Client";

const revenueData = [
  { month: "Oct", amount: 2100 },
  { month: "Nov", amount: 2400 },
  { month: "Dec", amount: 2800 },
  { month: "Jan", amount: 3100 },
  { month: "Feb", amount: 3200 },
  { month: "Mar", amount: 3400 },
];

const growthData = [
  { month: "Oct", amount: 8 },
  { month: "Nov", amount: 14 },
  { month: "Dec", amount: 17 },
  { month: "Jan", amount: 21 },
  { month: "Feb", amount: 24 },
  { month: "Mar", amount: 28 },
];

export default function FinancialPanel() {
  const [mrr, setMrr] = useState(3471);
  const mrrGoal = 10000;

  useEffect(() => {
    base44.entities.CRMClient.list("-created_date", 200).then((clients) => {
      const revenue = clients
        .filter((c) => c.status === "Active")
        .reduce((sum, c) => sum + (c.services || []).reduce((s, sv) => s + (sv.price || 0), 0), 0);
      if (revenue > 0) setMrr(revenue);
    });
  }, []);

  const progress = (mrr / mrrGoal) * 100;

  return (
    <div className="bg-card rounded-xl border border-white/[0.06] p-4 sm:p-6">
      <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase mb-5">Financial</h2>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <MetricCard label="MRR" value={`$${mrr.toLocaleString()}`} highlight />
        <MetricCard label="ARR" value={`$${(mrr * 12).toLocaleString()}`} />
        <MetricCard label="MRR Goal" value="$10,000" />
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-white/30">Progress to Goal</span>
          <span className="text-orange-500 font-semibold">{progress.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
        <div>
          <p className="text-white/25 text-[10px] tracking-wider uppercase mb-2">Monthly Revenue</p>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Bar dataKey="amount" fill="#FF6A00" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <p className="text-white/25 text-[10px] tracking-wider uppercase mb-2">Growth Trend</p>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Bar dataKey="amount" fill="#3B82F6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Plan & Marketing */}
      <div className="space-y-3">
        <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
          <p className="text-white/25 text-[10px] tracking-wider uppercase mb-1">Plan to Execute</p>
          <p className="text-white/70 text-xs font-medium">14 more Ørbit SEO base level subs</p>
        </div>
        <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
          <p className="text-white/25 text-[10px] tracking-wider uppercase mb-1">Marketing</p>
          <p className="text-white/70 text-xs font-medium">Referral Program</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, highlight }) {
  return (
    <div className="text-center p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
      <p className="text-white/25 text-[10px] tracking-wider uppercase mb-1">{label}</p>
      <p className={`text-lg font-bold ${highlight ? "text-orange-500" : "text-white/80"}`}>{value}</p>
    </div>
  );
}