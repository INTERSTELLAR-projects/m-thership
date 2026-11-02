import { Link } from "react-router-dom";
import { Loader2, RefreshCw, Sparkles, Zap, Target, AlertTriangle, Ban, Wrench, Rocket, Check, ArrowUpRight, Gauge } from "lucide-react";

const TAG_STYLE = {
  GO: "bg-[#ff3c00] text-white",
  "TEST SMALL": "bg-[#ffaa00]/20 text-[#b35f00] border border-[#ffaa00]/50",
  PARK: "bg-ink/[0.06] text-ink/60 border border-ink/15",
  KILL: "bg-red-600/10 text-red-700 border border-red-600/30",
};
const OWNER_STYLE = {
  Justin: "border-ink/25 text-ink/75",
  Claude: "border-[#ff6a00]/40 text-[#d14800] bg-[#ff6a00]/[0.06]",
  Client: "border-sky-600/30 text-sky-700 bg-sky-600/[0.05]",
};

export function Micro({ children, className = "" }) {
  return <p className={`mono-label text-[10px] text-ink/50 ${className}`}>{children}</p>;
}

function Effort({ value }) {
  if (!value) return null;
  return <span title="Rough effort estimate: S < 2h · M half-day to 2 days · L 3+ days" className="mono-label shrink-0 rounded border border-ink/15 px-1.5 py-0.5 text-[9.5px] text-ink/55">~{value}</span>;
}

function Section({ icon: Icon, title, children, className = "" }) {
  return (
    <div className={`game-panel p-5 ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-[#ff3c00]" />}
        <Micro className="text-ink/60">{title}</Micro>
      </div>
      {children}
    </div>
  );
}

function List({ items, mark = "—" }) {
  if (!items?.length) return <p className="text-xs text-ink/40">Nothing listed.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2 text-[13px] leading-snug text-ink/75"><span className="shrink-0 text-ink/30">{mark}</span><span>{t}</span></li>
      ))}
    </ul>
  );
}

export default function ActionPlan({ idea, generating, onGenerate, onToggleStep, onCreateProject, creating }) {
  const plan = idea.plan;
  const progress = idea.plan_progress || {};

  if (!plan) {
    return (
      <div className="game-panel relative p-8 text-center">
        <span className="pointer-events-none absolute left-0 top-0 h-[2px] w-full flame-bg" />
        <Sparkles className="mx-auto h-6 w-6 text-[#ff3c00]" />
        <p className="mt-3 text-lg font-semibold tracking-tight text-ink">No action plan yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink/55">Get the 60-minute first move, the 80/20 work, a 3-phase plan, kill criteria and the offer angle — grounded in your current clients and projects.</p>
        <button onClick={onGenerate} disabled={generating} className="mt-5 inline-flex items-center gap-2 rounded-md flame-bg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {generating ? "Building your plan…" : "Generate action plan"}
        </button>
      </div>
    );
  }

  const allSteps = (plan.phases || []).flatMap((ph, pi) => (ph.steps || []).map((_, si) => `p${pi}-${si}`));
  const doneCount = allSteps.filter((k) => progress[k]).length;
  const pct = allSteps.length ? Math.round((doneCount / allSteps.length) * 100) : 0;
  const h = plan.hormozi_angle;

  return (
    <div className="space-y-4">
      {/* Verdict bar */}
      <div className="flex flex-wrap items-center gap-3">
        {plan.verdict_tag && <span className={`mono-label rounded px-2 py-1 text-[10px] font-bold ${TAG_STYLE[plan.verdict_tag] || TAG_STYLE.PARK}`}>{plan.verdict_tag}</span>}
        <p className="min-w-0 flex-1 text-[15px] font-medium leading-snug text-ink">{plan.verdict}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onGenerate} disabled={generating} className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-card px-3 py-1.5 text-xs font-medium text-ink/70 hover:border-ink/30 disabled:opacity-60">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Regenerate
          </button>
          {idea.project_id ? (
            <Link to={`/projects/${idea.project_id}`} className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#ff3c00]">
              Open project<ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <button onClick={onCreateProject} disabled={creating} className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#ff3c00] disabled:opacity-60">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}Turn into project
            </button>
          )}
        </div>
      </div>

      {/* Do this first */}
      {plan.do_first && (
        <div className="relative overflow-hidden rounded-[var(--radius)] border border-[#ff3c00]/40 bg-card">
          <span className="pointer-events-none absolute left-0 top-0 h-full w-[3px] flame-bg" />
          <div className="grid gap-5 p-6 md:grid-cols-[1.1fr_1fr] md:p-7">
            <div>
              <Micro className="text-[#ff3c00]">Do this first · next 60 minutes</Micro>
              <p className="mt-3 text-[24px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink md:text-[30px]">{plan.do_first.title}</p>
              {plan.do_first.done_when && (
                <p className="mt-4 text-[13px] text-ink/60"><span className="mono-label mr-2 text-[9.5px] text-ink/45">Done when</span>{plan.do_first.done_when}</p>
              )}
            </div>
            <ol className="space-y-2 md:border-l md:border-hair md:pl-5">
              {(plan.do_first.steps || []).map((s, i) => (
                <li key={i} className="flex gap-3 text-[13.5px] leading-snug text-ink/80">
                  <span className="mono-label mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#ff3c00]/40 text-[9.5px] text-[#ff3c00]">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        {/* 80/20 */}
        <Section icon={Target} title="The 20% that drives 80% of the result">
          <ol className="divide-y divide-hair">
            {(plan.pareto || []).map((p, i) => (
              <li key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flame-text w-6 shrink-0 text-xl font-bold leading-none tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{p.title}</p>
                    <Effort value={p.effort} />
                  </div>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-ink/60">{p.why}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[10.5px] text-ink/40">Effort labels are rough estimates.</p>
        </Section>

        <div className="space-y-4">
          {plan.first_metric && (
            <Section icon={Gauge} title="First metric to track">
              <p className="text-lg font-semibold tracking-tight text-ink">{plan.first_metric.name}</p>
              <p className="mt-1 text-sm"><span className="mono-label mr-2 text-[9.5px] text-ink/45">Target</span><span className="font-semibold text-[#ff3c00]">{plan.first_metric.target}</span></p>
              {plan.first_metric.why && <p className="mt-2 text-[12.5px] text-ink/60">{plan.first_metric.why}</p>}
            </Section>
          )}
          <Section icon={Ban} title="Ignore for now"><List items={plan.ignore} mark="×" /></Section>
        </div>
      </div>

      {/* Phases */}
      <div className="game-panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Micro className="text-ink/60">Phased plan · {doneCount}/{allSteps.length} steps</Micro>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-ink/[0.07]"><div className="h-full flame-bg transition-all" style={{ width: `${pct}%` }} /></div>
            <span className="mono-label text-[10px] text-ink/55">{pct}%</span>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {(plan.phases || []).map((ph, pi) => (
            <div key={pi} className="relative">
              <div className="mb-3 flex items-baseline gap-2 border-b border-hair pb-2">
                <span className="mono-label text-[10px] text-[#ff3c00]">Phase {pi + 1}</span>
                {ph.timeframe && <span className="mono-label text-[9.5px] text-ink/40">· {ph.timeframe}</span>}
              </div>
              <p className="text-sm font-semibold text-ink">{ph.name}</p>
              {ph.goal && <p className="mt-0.5 text-[12px] text-ink/55">{ph.goal}</p>}
              <ul className="mt-3 space-y-1.5">
                {(ph.steps || []).map((st, si) => {
                  const k = `p${pi}-${si}`;
                  const done = !!progress[k];
                  return (
                    <li key={k}>
                      <button onClick={() => onToggleStep(k)} className={`group flex w-full items-start gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors ${done ? "border-transparent bg-ink/[0.03]" : "border-hair bg-card hover:border-ink/25"}`}>
                        <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border ${done ? "border-[#ff3c00] bg-[#ff3c00]" : "border-ink/30 group-hover:border-[#ff3c00]"}`}>
                          {done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[12.5px] leading-snug ${done ? "text-ink/40 line-through" : "text-ink/85"}`}>{st.title}</span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            <span className={`mono-label rounded border px-1.5 py-px text-[9px] ${OWNER_STYLE[st.owner] || OWNER_STYLE.Justin}`}>{st.owner || "Justin"}</span>
                            {st.category && <span className="mono-label rounded border border-ink/10 px-1.5 py-px text-[9px] text-ink/45">{st.category}</span>}
                            {st.effort && <span className="mono-label rounded border border-ink/10 px-1.5 py-px text-[9px] text-ink/45">~{st.effort}</span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section icon={AlertTriangle} title="Risks"><List items={plan.risks} /></Section>
        <Section icon={Ban} title="Kill criteria"><List items={plan.kill_criteria} mark="■" /></Section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {h?.relevant !== false && (h?.offer || h?.dream_outcome) && (
          <Section icon={Zap} title="Hormozi angle · value equation">
            {h.offer && <p className="text-[14px] font-semibold leading-snug text-ink">{h.offer}</p>}
            <dl className="mt-3 grid gap-2 text-[12.5px]">
              {[["Dream outcome ↑", h.dream_outcome], ["Likelihood ↑", h.likelihood], ["Time delay ↓", h.time_delay], ["Effort & sacrifice ↓", h.effort_sacrifice]].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[120px_1fr] gap-2"><dt className="mono-label pt-0.5 text-[9.5px] text-ink/45">{k}</dt><dd className="text-ink/70">{v}</dd></div>
              ))}
            </dl>
          </Section>
        )}
        <Section icon={Wrench} title="Resources & tools"><List items={plan.resources} mark="+" /></Section>
      </div>

      {idea.plan_generated_at && <p className="mono-label text-[9.5px] text-ink/35">Plan generated {new Date(idea.plan_generated_at).toLocaleString()}</p>}
    </div>
  );
}
