import { useState, useMemo, useRef } from "react";
import { RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Pencil, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { computePlan, presetFor, round2 } from "@/lib/planEngine.js";

const ROUTE_COLORS = ["#ff3c00", "#FFC14D", "#FF9F1C"];
const BLENDED_COLOR = "#67B5FF";

const stepRound = (n, step) => Math.round(n / step) * step;
const clampN = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const shortLabel = (name) => (name || "").split(" ")[0].slice(0, 9);

function fmtMoney(n) {
  if (n === null || n === undefined) return "—";
  return "$" + Math.round(n).toLocaleString();
}
function fmtMonth(n) {
  if (n === null || n === undefined) return "Not reachable";
  return n + (n === 1 ? " month" : " months");
}

function FlagChip({ flag, label }) {
  if (!flag) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-red-500/10 text-red-600/80 border border-red-500/20">
      <AlertTriangle className="w-2.5 h-2.5" />{label}
    </span>
  );
}

function MiniSlider({ value, min, max, step, onDrag, onCommit, fmt }) {
  const v = clampN(Number(value) || 0, min, max);
  const stepPlus = (dir) => {
    const n = clampN(stepRound(v + dir * step, step), min, max);
    onDrag(n);
    onCommit && onCommit();
  };
  return (
    <div className="space-y-1 w-full">
      <input
        type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => onDrag(Number(e.target.value))}
        onPointerUp={onCommit} onMouseUp={onCommit} onTouchEnd={onCommit} onKeyUp={onCommit}
        className="w-full h-1 accent-orange-500 cursor-pointer bg-ink/10 rounded-full"
      />
      <div className="flex items-center justify-between gap-1">
        <span className="text-ink/80 text-[10px] font-mono leading-none truncate">{fmt ? fmt(v) : v}</span>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => stepPlus(-1)} className="w-4 h-4 rounded bg-ink/[0.06] hover:bg-orange-500/25 text-ink/60 hover:text-ink text-[11px] leading-none flex items-center justify-center">−</button>
          <button onClick={() => stepPlus(1)} className="w-4 h-4 rounded bg-ink/[0.06] hover:bg-orange-500/25 text-ink/60 hover:text-ink text-[11px] leading-none flex items-center justify-center">+</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children, bold }) {
  return (
    <div className="grid items-center py-1.5" style={{ gridTemplateColumns: "128px minmax(0,1fr)" }}>
      <span className={`text-ink/[0.58] text-[10px] uppercase tracking-wider font-mono ${bold ? "text-orange-400/60" : ""}`}>{label}</span>
      <div className="grid gap-2 min-w-0" style={{ gridTemplateColumns: `repeat(${children.length}, minmax(0,1fr))` }}>{children}</div>
    </div>
  );
}
function Cell2({ children, className = "" }) {
  return <div className={`text-[11px] font-mono px-2 py-1 rounded text-ink/55 ${className}`}>{children}</div>;
}

function assumptionKey(routes, blendedVelocities) {
  const bv = (routes || []).slice(0, 2).map((r, j) =>
    round2(blendedVelocities && blendedVelocities[j] != null ? blendedVelocities[j] : (Number(r.clients_per_month) || 0))
  );
  return JSON.stringify({
    bv,
    routes: (routes || []).map((r) => ({
      price: round2(Number(r.monthly_price) || 0),
      cpm: round2(Number(r.clients_per_month) || 0),
    })),
  });
}

export default function PlanResults({ goal, analysis, mrr, running, onRerun, onEdit, onAssumptionsSave, onStaleReRun, relTime }) {
  const [open, setOpen] = useState(true);
  const baselineRef = useRef(JSON.parse(JSON.stringify(goal.routes || [])));
  const [routes, setRoutes] = useState(() => JSON.parse(JSON.stringify(goal.routes || [])));
  const [blendedVelocities, setBlendedVelocities] = useState(() => {
    const bv = goal.blended_velocities;
    return [bv && bv[0] != null ? Number(bv[0]) : null, bv && bv[1] != null ? Number(bv[1]) : null];
  });
  const lastSavedKey = useRef(assumptionKey(goal.routes || [], goal.blended_velocities || []));

  const c = useMemo(
    () => computePlan({ target_mrr: goal.target_mrr, baseline_mrr: goal.baseline_mrr || 0, routes, blended_velocities: blendedVelocities }, mrr || 0),
    [goal.target_mrr, goal.baseline_mrr, routes, blendedVelocities, mrr]
  );
  const ai = analysis?.ai_summary;
  const allRoutes = [...(c.routes || []), c.blended].filter(Boolean);

  const snapshot = analysis?.assumptions_snapshot;
  const stale = !!(snapshot?.routes && assumptionKey(routes, blendedVelocities) !== assumptionKey(snapshot.routes, snapshot.blended_velocities));

  const setBv = (j, v) => setBlendedVelocities((prev) => { const n = [...prev]; n[j] = v; return n; });
  const setRouteField = (i, patch) => setRoutes((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const effectiveBv = () => routes.slice(0, 2).map((r, j) => (blendedVelocities[j] != null ? blendedVelocities[j] : Number(r.clients_per_month) || 0));

  const onSliderCommit = () => {
    const key = assumptionKey(routes, blendedVelocities);
    if (key === lastSavedKey.current) return;
    lastSavedKey.current = key;
    onAssumptionsSave(routes, effectiveBv());
  };

  const resetRoute = (i) => {
    const r = routes[i];
    const preset = r.preset ? presetFor(r.preset) : null;
    const base = preset
      ? { ...r, clients_per_month: preset.clients_per_month, monthly_price: preset.monthly_price, has_addons: preset.has_addons, addon_low: preset.addon_low, addon_high: preset.addon_high, addon_avg: preset.addon_avg, addon_attach_rate: preset.addon_attach_rate }
      : { ...r, ...baselineRef.current[i] };
    setRoutes((prev) => prev.map((rr, idx) => (idx === i ? base : rr)));
    setTimeout(() => {
      const next = routes.map((rr, idx) => (idx === i ? base : rr));
      lastSavedKey.current = assumptionKey(next, blendedVelocities);
      onAssumptionsSave(next, next.slice(0, 2).map((rr, j) => (blendedVelocities[j] != null ? blendedVelocities[j] : Number(rr.clients_per_month) || 0)));
    }, 0);
  };

  const deltaUp = ai?.delta_since_last_run && !/dro|down|fell|lower|negative/i.test(JSON.stringify(ai.delta_since_last_run).toLowerCase());

  return (
    <div className="p-3.5 space-y-3">
      {/* verdict bar */}
      <div className="flex items-start gap-2">
        <div className="flex-1">
          {ai ? (
            <p className="text-ink text-[15px] font-medium leading-snug">{ai.verdict ? ai.verdict.replace(/\[winner\]/g, c.winner_name || "") : ""}</p>
          ) : (
            <p className="text-ink/[0.58] text-sm italic flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Analysis unavailable — retry</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onEdit} title="Edit goal" className="p-1.5 rounded-md hover:bg-ink/5 text-ink/[0.48] hover:text-orange-400 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onRerun} disabled={running} title="Re-run analysis" className="p-1.5 rounded-md hover:bg-ink/5 text-ink/[0.48] hover:text-orange-400 transition-all disabled:opacity-40">{running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}</button>
          <span className="text-ink/[0.43] text-[10px] font-mono">{relTime || ""}</span>
          <button onClick={() => setOpen(!open)} className="p-1 rounded-md hover:bg-ink/5 text-ink/[0.48] transition-all">{open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</button>
        </div>
      </div>

      {stale && (
        <button onClick={() => onStaleReRun(routes, effectiveBv())}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold tracking-wide uppercase hover:bg-amber-500/25 transition-all">
          <AlertTriangle className="w-3 h-3" />Assumptions changed — re-run analysis
        </button>
      )}

      {open && (
        <div className="space-y-3">
          {/* comparison table */}
          <div className="rounded-lg border border-ink/[0.13] bg-ink/[0.01] p-3 overflow-x-auto">
            <div className="min-w-[480px]">
              {/* header */}
              <div className="grid items-end pb-2 mb-1 border-b border-ink/[0.13]" style={{ gridTemplateColumns: "128px minmax(0,1fr)" }}>
                <span />
                <div className="grid gap-2 min-w-0" style={{ gridTemplateColumns: `repeat(${allRoutes.length}, minmax(0,1fr))` }}>
                  {allRoutes.map((r, i) => {
                    const col = r.system_generated ? BLENDED_COLOR : ROUTE_COLORS[i % ROUTE_COLORS.length];
                    return (
                      <div key={i} className="text-center">
                        <span className="text-[11px] font-semibold block leading-tight" style={{ color: col }}>{r.name}</span>
                        {r.system_generated ? (
                          <span className="text-[8px] text-ink/[0.48] uppercase tracking-wider">run both</span>
                        ) : (
                          <button onClick={() => resetRoute(i)} className="text-[8px] text-ink/[0.43] hover:text-orange-400 uppercase tracking-wider inline-flex items-center gap-0.5"><RotateCcw className="w-2 h-2" />reset</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Row label="Monthly price">
                {allRoutes.map((r, i) => <Cell2 key={i}>{fmtMoney(r.monthly_price)}</Cell2>)}
              </Row>

              {/* Clients/mo — live whole-number sliders (blended shows one per primary route) */}
              <Row label="Clients / mo">
                {allRoutes.map((r, i) =>
                  r.system_generated ? (
                    <div key={i} className="px-1 space-y-1.5">
                      {routes.slice(0, 2).map((rr, j) => {
                        const eff = blendedVelocities[j] != null ? blendedVelocities[j] : (Number(rr.clients_per_month) || 0);
                        return (
                          <div key={j}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[9px] text-ink/[0.63] font-mono truncate">{shortLabel(rr.name)}</span>
                              {blendedVelocities[j] == null && <span className="text-[7px] text-ink/[0.43] uppercase tracking-wider">auto</span>}
                            </div>
                            <MiniSlider value={eff} min={0} max={8} step={1}
                              onDrag={(v) => setBv(j, v)}
                              onCommit={onSliderCommit}
                              fmt={(v) => `${v} cli/mo`} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div key={i} className="px-1">
                      <MiniSlider value={routes[i].clients_per_month} min={0} max={8} step={1}
                        onDrag={(v) => setRouteField(i, { clients_per_month: v })}
                        onCommit={onSliderCommit}
                        fmt={(v) => `${v} cli/mo`} />
                    </div>
                  )
                )}
              </Row>

              <Row label="Clients needed">
                {allRoutes.map((r, i) => <Cell2 key={i}>{r.clients_needed_raw != null ? r.clients_needed_raw : "—"}</Cell2>)}
              </Row>

              <Row label="Time to goal" bold>
                {allRoutes.map((r, i) => (
                  <Cell2 key={i} className={r.reached ? "text-orange-400 text-[13px] font-bold" : "text-ink/[0.53]"}>
                    {r.reached ? `${fmtMonth(r.months_to_goal)} · ${r.goal_date}` : "Not reachable"}
                  </Cell2>
                ))}
              </Row>

              {/* New MRR added — route-specific, tied to current MRR (auto-updates as MRR changes) */}
              <Row label="New MRR added">
                {allRoutes.map((r, i) => <Cell2 key={i} className={r.reached ? "text-ink/80" : "text-ink/[0.53]"}>{r.reached ? fmtMoney(r.new_mrr_added) : "—"}</Cell2>)}
              </Row>

              {/* MRR Total at Goal — the MRR you actually land at the crossing month (e.g. $10,202) */}
              <Row label="MRR Total at Goal" bold>
                {allRoutes.map((r, i) => (
                  <Cell2 key={i} className={r.reached ? "text-orange-400/90 text-[12px] font-semibold" : "text-ink/[0.53]"}>{r.reached ? fmtMoney(r.mrr_total_at_goal) : "Not reachable"}</Cell2>
                ))}
              </Row>

              <Row label="Risk flags">
                {allRoutes.map((r, i) => (
                  <Cell2 key={i}>
                    <div className="flex flex-wrap gap-1">
                      <FlagChip flag={r.flags?.never_reaches} label="Unreachable" />
                      {!r.flags?.never_reaches && <span className="text-ink/[0.38] text-[9px]">—</span>}
                    </div>
                  </Cell2>
                ))}
              </Row>
            </div>
          </div>

          {/* delta strip */}
          {ai?.delta_since_last_run && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${deltaUp ? "border-green-500/20 bg-green-500/[0.05]" : "border-orange-500/20 bg-orange-500/[0.05]"}`}>
              {deltaUp ? <ArrowUp className="w-3.5 h-3.5 text-green-600" /> : <ArrowDown className="w-3.5 h-3.5 text-orange-400" />}
              <span className="text-ink/70 text-xs">{ai.delta_since_last_run}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}