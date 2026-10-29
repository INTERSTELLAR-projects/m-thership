import { useState, useEffect } from "react";
import { Loader2, TrendingUp, DollarSign, Rocket, CalendarClock } from "lucide-react";
import { base44 } from "@/api/base44Client";

function fmtMoney(n) { return `$${Math.round(n).toLocaleString()}`; }
function daysUntil(d) { if (!d) return null; const diff = new Date(d + "T00:00:00") - new Date(new Date().toDateString()); return Math.round(diff / 86400000); }

export default function ProjectionWidget() {
  const [projections, setProjections] = useState([]);
  const [currentMrr, setCurrentMrr] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.RevenueProjection.list("-expectedCloseDate", 500),
      base44.entities.CRMClient.list("business", 200),
    ]).then(([p, c]) => {
      setProjections(p);
      const mrr = c.filter((x) => x.status === "Active")
        .reduce((s, cl) => s + (cl.services || []).reduce((acc, sv) => acc + (sv.price || 0), 0), 0);
      setCurrentMrr(mrr);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="relative overflow-hidden bg-card rounded-md border border-ink/[0.13] p-6 flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-orange-500/40 animate-spin relative" />
      </div>
    );
  }

  const pending = projections.filter((p) => p.status === "Pending");
  const projected = pending.reduce((s, p) => s + (p.amount || 0), 0);
  const potential = currentMrr + projected;

  // Next 30 days upcoming closes
  const upcoming = pending
    .filter((p) => { const d = daysUntil(p.expectedCloseDate); return d !== null && d >= 0 && d <= 30; })
    .sort((a, b) => new Date(a.expectedCloseDate) - new Date(b.expectedCloseDate))
    .slice(0, 4);

  const next30Total = pending.filter((p) => { const d = daysUntil(p.expectedCloseDate); return d !== null && d >= 0 && d <= 30; }).reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="relative overflow-hidden bg-card rounded-md border border-ink/[0.13] p-5">

      <div className="relative flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-orange-500 to-yellow-400" />
          <h2 className="font-display text-ink/85 font-bold text-xs tracking-[0.22em] uppercase">Revenue Projections</h2>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-ink/[0.48]">{pending.length} pending</span>
      </div>

      {/* MRR stack */}
      <div className="relative grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-md border border-ink/[0.13] bg-ink/[0.02] p-3">
          <div className="flex items-center gap-1 text-ink/[0.58] text-[10px] uppercase tracking-wider mb-1"><DollarSign className="w-3 h-3" /> Current</div>
          <div className="font-display text-lg font-extrabold text-ink/85">{fmtMoney(currentMrr)}</div>
        </div>
        <div className="rounded-md border border-orange-500/25 bg-gradient-to-b from-orange-500/10 to-transparent p-3">
          <div className="flex items-center gap-1 text-orange-600 text-[10px] uppercase tracking-wider mb-1"><TrendingUp className="w-3 h-3" /> Projected</div>
          <div className="font-display text-lg font-extrabold bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">+{fmtMoney(projected)}</div>
        </div>
        <div className="rounded-md border border-yellow-500/20 bg-gradient-to-b from-yellow-400/8 to-transparent p-3 shadow-[0_0_12px_rgba(250,204,21,0.14)]">
          <div className="flex items-center gap-1 text-yellow-600/70 text-[10px] uppercase tracking-wider mb-1"><Rocket className="w-3 h-3" /> Potential</div>
          <div className="font-display text-lg font-extrabold bg-gradient-to-r from-yellow-300 to-amber-200 bg-clip-text text-transparent">{fmtMoney(potential)}</div>
        </div>
      </div>

      {/* Upcoming closes */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-ink/[0.58] text-[10px] uppercase tracking-widest flex items-center gap-1.5"><CalendarClock className="w-3 h-3 text-orange-600" /> Next 30 Days</span>
          <span className="font-display text-sm font-bold bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">+{fmtMoney(next30Total)}/mo</span>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-ink/[0.43] text-xs py-3 text-center">No deals expected in the next 30 days.</p>
        ) : (
          <div className="space-y-1.5">
            {upcoming.map((p) => {
              const d = daysUntil(p.expectedCloseDate);
              return (
                <div key={p.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-ink/[0.03] transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md border border-orange-500/25 bg-gradient-to-b from-orange-500 to-amber-400 opacity-80 flex items-center justify-center text-[9px] font-bold text-white/70 shrink-0">{p.clientName?.charAt(0)}</span>
                    <div className="min-w-0">
                      <span className="text-ink/60 text-xs truncate block">{p.clientName}</span>
                      <span className="text-ink/[0.43] text-[10px]">{p.serviceTitle || "Service"} · in {d}d</span>
                    </div>
                  </div>
                  <span className="text-ink/75 text-xs font-semibold">+{fmtMoney(p.amount)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}