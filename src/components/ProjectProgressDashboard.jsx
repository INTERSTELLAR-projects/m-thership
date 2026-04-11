import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, Circle, Layers, Loader2 } from "lucide-react";

const CLIENT_OPS_CARDS = ["Website Updates", "GBP Updates", "New Website Builds", "Presentations"];

function ProgressBar({ value, max, color = "bg-orange-500" }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-white/40 text-xs w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function ProjectProgressDashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.ClientOperationItem.list("created_date", 500).then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  const relevantItems = items.filter((i) => CLIENT_OPS_CARDS.includes(i.card) || i.card === "other-tasks");
  const totalAll = relevantItems.length;
  const doneAll = relevantItems.filter((i) => i.done).length;

  const sections = [
    { label: "Website Updates", items: items.filter((i) => i.card === "Website Updates"), color: "bg-orange-500" },
    { label: "GBP Updates", items: items.filter((i) => i.card === "GBP Updates"), color: "bg-blue-500" },
    { label: "New Builds", items: items.filter((i) => i.card === "New Website Builds"), color: "bg-purple-500" },
    { label: "Presentations", items: items.filter((i) => i.card === "Presentations"), color: "bg-yellow-500" },
    { label: "Other Tasks", items: items.filter((i) => i.card === "other-tasks"), color: "bg-green-500" },
  ];

  if (loading) {
    return (
      <div className="px-8 pt-6">
        <div className="bg-card rounded-xl border border-white/[0.06] p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-white/20 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 pt-6">
      <div className="bg-card rounded-xl border border-white/[0.06] p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-orange-500/60" />
            <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase">Project Progress</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400/70" />
              <span className="text-green-400/70 text-xs font-semibold">{doneAll} done</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Circle className="w-3.5 h-3.5 text-white/20" />
              <span className="text-white/30 text-xs font-semibold">{totalAll - doneAll} remaining</span>
            </div>
          </div>
        </div>

        {/* Overall bar */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-white/50 text-xs">Overall Completion</span>
            <span className="text-orange-500 text-sm font-bold">{doneAll} / {totalAll}</span>
          </div>
          <ProgressBar value={doneAll} max={totalAll} color="bg-orange-500" />
        </div>

        {/* Per-section */}
        <div className="grid grid-cols-5 gap-4 pt-2 border-t border-white/[0.05]">
          {sections.map(({ label, items: sItems, color }) => {
            const done = sItems.filter((i) => i.done).length;
            return (
              <div key={label}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white/40 text-[10px] uppercase tracking-wider">{label}</span>
                  <span className="text-white/50 text-xs font-semibold">{done}/{sItems.length}</span>
                </div>
                <ProgressBar value={done} max={sItems.length} color={color} />
              </div>
            );
          })}
        </div>

        {totalAll === 0 && (
          <p className="text-white/20 text-xs text-center py-1">No tasks yet — add items below to start tracking progress.</p>
        )}
      </div>
    </div>
  );
}