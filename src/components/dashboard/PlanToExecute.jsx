import { useState, useEffect, useRef } from "react";
import { Plus, RefreshCw, Loader2, CheckCircle2, Target, Sparkles, Pencil, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import RouteBuilder from "../plan/RouteBuilder";
import PlanResults from "../plan/PlanResults";

export default function PlanToExecute({ mrr }) {
  const [plan, setPlan] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [updatedStamp, setUpdatedStamp] = useState(null);
  const knownAnalysisId = useRef(null);

  const load = async () => {
    try {
      const plans = await base44.entities.ExecutionPlan.filter({ status: "active" }, "-created_date", 1);
      const p = (plans || [])[0] || null;
      setPlan(p);
      if (p) {
        const an = await base44.entities.PlanAnalysis.filter({ plan_id: p.id }, "-created_date", 1);
        const latest = (an || [])[0] || null;
        setAnalysis(latest);
        knownAnalysisId.current = latest?.id || null;
        setUpdatedStamp(latest ? new Date(latest.created_date) : null);
      } else {
        setAnalysis(null);
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const unsub = base44.entities.PlanAnalysis.subscribe((ev) => {
      if (plan && ev.data?.plan_id === plan.id && ev.type === "create" && ev.data.id !== knownAnalysisId.current) {
        knownAnalysisId.current = ev.data.id;
        setAnalysis(ev.data);
        setPulse(true);
        setUpdatedStamp(new Date(ev.data.created_date));
        setTimeout(() => setPulse(false), 2600);
      }
    });
    return unsub;
  }, [plan]);

  const runAnalysis = async () => {
    if (!plan || running) return;
    setRunning(true);
    try {
      await base44.functions.invoke("recalculatePlan", { planId: plan.id, trigger: "manual" });
      await load();
    } catch (e) {}
    setRunning(false);
  };

  const savePlan = async (data) => {
    // Archive any prior active plans so only one is live.
    try {
      const existing = await base44.entities.ExecutionPlan.filter({ status: "active" }, "-created_date", 20);
      await Promise.all((existing || []).map((e) => base44.entities.ExecutionPlan.update(e.id, { status: "archived" })));
    } catch (e) {}
    const created = await base44.entities.ExecutionPlan.create({
      title: data.title || "Path to $" + (data.goal_mrr || 0).toLocaleString(),
      goal_mrr: Number(data.goal_mrr) || 0,
      baseline_mrr: mrr || 0,
      status: "active",
      routes: data.routes,
    });
    setPlan(created);
    setBuilderOpen(false);
    setRunning(true);
    try {
      await base44.functions.invoke("recalculatePlan", { planId: created.id, trigger: "manual" });
    } catch (e) {}
    setRunning(false);
    await load();
  };

  const achieved = analysis?.computed?.achieved;

  const relTime = (d) => {
    if (!d) return "";
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return s + "s ago";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  };

  return (
    <div>
      {/* Label */}
      <div className="flex items-center gap-1.5 mb-2">
        <Target className="w-3 h-3 text-orange-400/60" />
        <span className="text-white/40 text-[11px] uppercase tracking-[0.1em] font-mono">Plan to Execute · Syncs to Daily Briefing</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 text-white/20 animate-spin" />
        </div>
      ) : achieved ? (
        <div className="rounded-xl border border-green-500/30 bg-green-500/[0.06] p-4 text-center">
          <CheckCircle2 className="w-5 h-5 text-green-400 mx-auto mb-2" />
          <p className="text-white/80 text-sm font-semibold mb-3">Goal achieved — MRR reached your target.</p>
          <button onClick={() => setBuilderOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-black text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />Set next goal
          </button>
        </div>
      ) : analysis && plan ? (
        <div className={`relative rounded-xl border transition-all ${pulse ? "border-orange-500/60 shadow-[0_0_18px_rgba(255,106,0,0.35)]" : "border-white/[0.06]"}`}>
          {pulse && (
            <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-orange-500 text-black text-[9px] font-bold tracking-wider animate-pulse">UPDATED</span>
          )}
          <PlanResults
            plan={plan}
            analysis={analysis}
            running={running}
            onRerun={runAnalysis}
            onEdit={() => setBuilderOpen(true)}
            relTime={relTime(updatedStamp)}
          />
        </div>
      ) : (
        /* Empty state */
        <button
          onClick={() => setBuilderOpen(true)}
          className="w-full rounded-xl border border-dashed border-orange-500/25 hover:border-orange-500/50 hover:bg-orange-500/[0.04] transition-all p-4 flex items-center justify-center gap-2 text-white/50 hover:text-orange-400 group"
        >
          <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-semibold tracking-wider uppercase font-mono">Define Your Routes</span>
        </button>
      )}

      {builderOpen && (
        <RouteBuilder
          open={builderOpen}
          initialPlan={plan}
          currentMrr={mrr}
          onClose={() => setBuilderOpen(false)}
          onSave={savePlan}
        />
      )}
    </div>
  );
}