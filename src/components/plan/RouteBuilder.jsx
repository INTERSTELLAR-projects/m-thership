import { useState, useMemo } from "react";
import { HelpCircle, Plus, X, Rocket } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { computeRoute, ROUTE_PRESETS } from "@/lib/planEngine.js";

function Field({ label, value, onChange, type, placeholder, tooltip }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <span className="text-ink/[0.63] text-[10px] tracking-wider uppercase">{label}</span>
        {tooltip && (
          <span title={tooltip} className="text-ink/[0.43] hover:text-orange-600 cursor-help">
            <HelpCircle className="w-3 h-3" />
          </span>
        )}
      </div>
      <input
        type={type || "number"}
        value={value ?? ""}
        onChange={(e) => onChange(type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
        placeholder={placeholder}
        className="w-full bg-ink/[0.03] border border-ink/[0.13] hover:border-orange-500/25 focus:border-orange-500/40 rounded-lg px-2.5 py-1.5 text-xs text-ink outline-none transition-colors font-mono"
      />
    </div>
  );
}

function RouteCard({ route, setRoute, idx, onRemove, canRemove }) {
  const applyPreset = (key) => {
    const p = ROUTE_PRESETS.find((r) => r.key === key);
    if (!p) return;
    setRoute({
      ...route,
      preset: key,
      name: p.name,
      monthly_price: p.monthly_price,
      has_addons: p.has_addons,
      addon_low: p.addon_low,
      addon_high: p.addon_high,
      addon_avg: p.addon_avg,
      addon_attach_rate: p.addon_attach_rate,
      clients_per_month: p.clients_per_month,
      monthly_churn_rate: p.monthly_churn_rate,
    });
  };
  const currentPreset = route.preset || ((route.name === "HyperCare+ Base" || route.name === "Ørbit SEO Base") ? "orbit_seo_base" : (route.name === "GravïtyCare App Maintenance" || route.name === "Starshïp App Maintenance") ? "starship_maintenance" : "custom");
  return (
    <div className="rounded-md border border-ink/[0.13] bg-ink/[0.01] p-3.5 space-y-3 relative">
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink/[0.48] text-[10px] uppercase tracking-widest font-mono">Route {String.fromCharCode(65 + idx)}</span>
        {canRemove && (
          <button onClick={onRemove} className="text-ink/[0.38] hover:text-red-600/70 transition-colors"><X className="w-3.5 h-3.5" /></button>
        )}
      </div>
      <input
        value={route.name}
        onChange={(e) => setRoute({ ...route, name: e.target.value })}
        placeholder="Route name"
        className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-orange-500/40"
      />
      <div className="flex gap-1">
        {ROUTE_PRESETS.map((p) => (
          <button key={p.key} onClick={() => applyPreset(p.key)}
            className={`flex-1 px-2 py-1 rounded-md text-[10px] font-semibold tracking-wide transition-all ${currentPreset === p.key ? "bg-gradient-to-r from-orange-500/25 to-amber-400/15 text-orange-600 border border-orange-500/30" : "bg-ink/[0.03] text-ink/[0.58] border border-ink/[0.13] hover:border-orange-500/20"}`}>
            {p.key === "orbit_seo_base" ? "HyperCare+" : p.key === "starship_maintenance" ? "GravïtyCare" : "Custom"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Monthly Price $" value={route.monthly_price} onChange={(v) => setRoute({ ...route, monthly_price: v })} tooltip="Recurring revenue per client per month." />
        <Field label="Clients / Month" value={route.clients_per_month} onChange={(v) => setRoute({ ...route, clients_per_month: v })} tooltip="Realistic acquisition velocity — the primary lever. The engine adds this many new clients each month." />
        <Field label="Churn / mo" value={route.monthly_churn_rate} onChange={(v) => setRoute({ ...route, monthly_churn_rate: v })} tooltip="Fraction of clients lost per month (0.03 = 3%). Applied to existing revenue before new adds." />
        <div className="flex items-end">
          <button onClick={() => setRoute({ ...route, has_addons: !route.has_addons })}
            className={`w-full px-2.5 py-1.5 rounded-md text-[10px] font-semibold tracking-wide transition-all ${route.has_addons ? "bg-orange-500/20 text-orange-600 border border-orange-500/30" : "bg-ink/[0.03] text-ink/[0.58] border border-ink/[0.13]"}`}>
            Add-ons {route.has_addons ? "ON" : "OFF"}
          </button>
        </div>
      </div>
      {route.has_addons && (
        <div className="grid grid-cols-4 gap-1.5">
          <Field label="Avg $" value={route.addon_avg} onChange={(v) => setRoute({ ...route, addon_avg: v })} tooltip="Default = midpoint of low/high. One-time cash per attached add-on." />
          <Field label="Low $" value={route.addon_low} onChange={(v) => setRoute({ ...route, addon_low: v })} />
          <Field label="High $" value={route.addon_high} onChange={(v) => setRoute({ ...route, addon_high: v })} />
          <Field label="Attach %" value={route.addon_attach_rate} onChange={(v) => setRoute({ ...route, addon_attach_rate: v })} tooltip="Fraction of new clients who buy an add-on. 0.5 = 50%." />
        </div>
      )}
    </div>
  );
}

export default function RouteBuilder({ open, initialGoal, currentMrr, onClose, onSave }) {
  const [title, setTitle] = useState(initialGoal?.title || "");
  const [goal, setGoal] = useState(initialGoal?.target_mrr || 10000);
  const [routes, setRoutes] = useState(
    initialGoal?.routes?.length
      ? JSON.parse(JSON.stringify(initialGoal.routes))
      : [
          { id: "r1", preset: "orbit_seo_base", name: "HyperCare+ Base", monthly_price: 500, has_addons: false, clients_per_month: 1, monthly_churn_rate: 0.03 },
          { id: "r2", preset: "starship_maintenance", name: "GravïtyCare App Maintenance", monthly_price: 150, has_addons: true, addon_low: 250, addon_high: 5000, addon_avg: 1200, addon_attach_rate: 0.5, clients_per_month: 2, monthly_churn_rate: 0.02 },
        ]
  );

  const preview = useMemo(() => {
    const g = Number(goal) || 0;
    return routes
      .filter((r) => r && (Number(r.clients_per_month) || 0) > 0 && (Number(r.monthly_price) || 0) > 0)
      .map((r) => {
        const res = computeRoute(r, currentMrr || 0, g);
        return { name: r.name, clients: res.clients_needed_real, months: res.months_to_goal };
      });
  }, [routes, goal, currentMrr]);

  const setRoute = (i, val) => setRoutes((prev) => prev.map((r, idx) => (idx === i ? val : r)));
  const addRoute = () => {
    if (routes.length >= 3) return;
    setRoutes([...routes, { id: "r" + (routes.length + 1), preset: "custom", name: "Custom Route", monthly_price: 0, has_addons: false, clients_per_month: 0, monthly_churn_rate: 0.03 }]);
  };
  const removeRoute = (i) => setRoutes((prev) => prev.filter((_, idx) => idx !== i));

  const valid = routes.length >= 2 && goal > 0 && routes.every((r) => (Number(r.monthly_price) || 0) >= 0 && (Number(r.clients_per_month) || 0) >= 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-ink/[0.13] text-ink max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-ink flex items-center gap-2"><Rocket className="w-4 h-4 text-orange-600" />{initialGoal ? "Edit Goal" : "Define a New Goal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <span className="text-ink/[0.63] text-[10px] tracking-wider uppercase block mb-1">Goal Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={"Path to $" + (goal || 0).toLocaleString()} className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-orange-500/40" />
            </div>
            <div className="w-40">
              <span className="text-ink/[0.63] text-[10px] tracking-wider uppercase block mb-1">Target MRR $</span>
              <input type="number" value={goal} onChange={(e) => setGoal(e.target.value === "" ? "" : Number(e.target.value))} className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-orange-500/40 font-mono" />
            </div>
          </div>

          <div className={`grid gap-3 ${routes.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {routes.map((r, i) => (
              <RouteCard key={r.id || i} route={r} setRoute={(v) => setRoute(i, v)} idx={i} onRemove={() => removeRoute(i)} canRemove={routes.length > 2} />
            ))}
          </div>

          {routes.length < 3 && (
            <button onClick={addRoute} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-ink/[0.13] hover:border-orange-500/30 text-ink/[0.58] hover:text-orange-600 text-xs transition-all">
              <Plus className="w-3.5 h-3.5" />Add a third route
            </button>
          )}

          <div className="rounded-lg border border-ink/[0.13] bg-ink/[0.02] px-3 py-2 flex items-center gap-3 text-[11px] font-mono flex-wrap">
            <span className="text-ink/[0.48] uppercase tracking-wider">Preview</span>
            {preview.length === 0 ? (
              <span className="text-ink/[0.48]">Set price & velocity to see projections…</span>
            ) : (
              preview.map((p, i) => (
                <span key={i} className="text-ink/60">
                  <span className="text-orange-600">{p.name}:</span>{" "}
                  {p.clients != null ? `${p.clients} clients` : "—"}{" · "}
                  {p.months != null ? `${p.months} months` : "not reachable"}
                  {i < preview.length - 1 && <span className="text-ink/[0.38] mx-1">|</span>}
                </span>
              ))
            )}
          </div>

          <button
            disabled={!valid}
            onClick={() => onSave({ title, target_mrr: Number(goal) || 0, routes })}
            className={`w-full py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all ${valid ? "bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white" : "bg-ink/[0.04] text-ink/[0.48] cursor-not-allowed"}`}
          >
            {initialGoal ? "Save & Re-run" : "Run Analysis"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}