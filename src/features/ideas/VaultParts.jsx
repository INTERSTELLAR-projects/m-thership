import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp, ArrowDown, Loader2, Rocket, ArrowUpRight, RefreshCw, Sparkles, Target, Clock, Hammer, DollarSign, GripVertical, Users, Swords, Layers, Coins, AlertTriangle, ExternalLink, Pin, X } from "lucide-react";
import { FACTORS, STAGES, TIERS, effectiveScore, tierOf, stageOf, valueEquation } from "@/features/ideas/scoring";
import { Micro } from "@/features/ideas/ActionPlan";

export const TIER_STYLE = {
  S: "bg-[#ff3c00] text-white",
  A: "bg-[#ff6a00]/15 text-[#c94a00] border border-[#ff6a00]/40",
  B: "bg-[#ffaa00]/15 text-[#9a5a00] border border-[#ffaa00]/45",
  C: "bg-ink/[0.06] text-ink/55 border border-ink/15",
};
const STAGE_STYLE = {
  idea: "text-ink/60 border-ink/15",
  validating: "text-[#c94a00] border-[#ff6a00]/40 bg-[#ff6a00]/[0.06]",
  building: "text-white border-transparent bg-ink",
  live: "text-white border-transparent flame-bg",
  parked: "text-ink/40 border-ink/10 bg-ink/[0.03]",
};

export function TierChip({ score, className = "" }) {
  const t = tierOf(score);
  if (!t) return <span className={`mono-label rounded px-1.5 py-0.5 text-[9.5px] text-ink/40 border border-dashed border-ink/20 ${className}`}>Unscored</span>;
  return <span title={TIERS.find((x) => x.key === t)?.label} className={`mono-label rounded px-1.5 py-0.5 text-[10px] font-bold ${TIER_STYLE[t]} ${className}`}>{t}</span>;
}

export function StageChip({ idea }) {
  const s = stageOf(idea);
  return <span className={`mono-label rounded border px-1.5 py-0.5 text-[9.5px] ${STAGE_STYLE[s]}`}>{STAGES.find((x) => x.key === s)?.label}</span>;
}

export function RankBadge({ rank, size = "md", dark = false }) {
  const big = size === "lg";
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-md font-semibold tabular-nums ${big ? "h-12 w-12 text-[22px]" : "h-8 w-8 text-[13px]"} ${rank <= 3 ? "flame-bg text-white" : dark ? "bg-white/10 text-white/80" : "bg-ink/[0.06] text-ink/70"}`}>
      {rank ? `#${rank}` : "—"}
    </span>
  );
}

export function MoveArrow({ idea }) {
  const { rank, prev_rank: prev, rank_changed_at: at } = idea;
  if (!prev || !rank || prev === rank) return null;
  if (at && Date.now() - new Date(at).getTime() > 14 * 864e5) return null;
  const up = rank < prev;
  return (
    <motion.span initial={{ opacity: 0, y: up ? 6 : -6 }} animate={{ opacity: 1, y: 0 }} title={`Was #${prev}`}
      className={`mono-label inline-flex items-center gap-0.5 text-[9.5px] font-bold ${up ? "text-emerald-600" : "text-red-600/80"}`}>
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{Math.abs(prev - rank)}
    </motion.span>
  );
}

export function ScoreDial({ score, size = 44, dark = false }) {
  const s = score ?? 0;
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={score === null ? "Not scored yet" : `Score ${score}/100`}>
      <svg width={size} height={size} className="-rotate-90">
        <defs><linearGradient id="dialg" x1="0" x2="1"><stop offset="0" stopColor="#ff3c00" /><stop offset=".55" stopColor="#ff6a00" /><stop offset="1" stopColor="#ffaa00" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={dark ? "rgba(255,255,255,.12)" : "rgba(26,26,26,.08)"} strokeWidth="4" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#dialg)" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (c * s) / 100 }} transition={{ duration: 0.9, ease: "easeOut" }} />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center font-semibold tabular-nums ${dark ? "text-white" : "text-ink"}`} style={{ fontSize: size * 0.3 }}>{score ?? "–"}</span>
    </div>
  );
}

const meta = (idea) => {
  const bd = idea.score_breakdown || {};
  return { effort: bd.effort_band, ttd: bd.time_to_dollar_label, rev: bd.revenue_band, next: bd.next_action || idea.plan?.do_first?.title };
};

/* ---------------- Build next hero ---------------- */
export function BuildNextHero({ ideas, busyId, onPlan, onOpen }) {
  if (!ideas.length) return null;
  return (
    <div className="relative overflow-hidden rounded-[var(--radius)] bg-[#0d0d0f] p-5 text-white md:p-6">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#ff3c00]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[#ffaa00]/10 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mono-label text-[10px] text-white/50">Ranked by the value equation</p>
          <h2 className="mt-1 text-[26px] font-semibold leading-none tracking-[-0.04em] md:text-[30px]">Build <span className="flame-text">/next</span></h2>
        </div>
        <p className="mono-label text-[9.5px] text-white/40">(dream × likelihood) ÷ (time × effort)</p>
      </div>
      <div className="relative mt-5 grid gap-3 lg:grid-cols-3">
        {ideas.map((idea, i) => {
          const m = meta(idea);
          return (
            <motion.div key={idea.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="flex flex-col rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
              <div className="flex items-start gap-3">
                <RankBadge rank={idea.rank || i + 1} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><TierChip score={effectiveScore(idea)} /><MoveArrow idea={idea} /></div>
                  <button onClick={() => onOpen(idea)} className="mt-1.5 line-clamp-2 text-left text-[16px] font-semibold leading-snug tracking-[-0.02em] hover:text-[#ffaa00]">{idea.title}</button>
                </div>
                <ScoreDial score={effectiveScore(idea)} dark />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {m.effort && <Meta dark icon={Hammer}>Effort {m.effort}</Meta>}
                {m.ttd && <Meta dark icon={Clock}>{m.ttd}</Meta>}
                {m.rev && <Meta dark icon={DollarSign}>{m.rev}</Meta>}
              </div>
              {m.next && (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <p className="mono-label text-[9px] text-[#ff6a00]">Next action</p>
                  <p className="mt-1 text-[13px] leading-snug text-white/85">{m.next}</p>
                </div>
              )}
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {idea.project_id ? (
                  <a href={`/projects/${idea.project_id}`} className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-[#ffaa00]">Open project<ArrowUpRight className="h-3.5 w-3.5" /></a>
                ) : (
                  <button onClick={() => onPlan(idea)} disabled={!!busyId} className="inline-flex items-center gap-1.5 rounded-md flame-bg px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
                    {busyId === idea.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                    {busyId === idea.id ? "Building plan + tasks…" : "Create action plan / tasks"}
                  </button>
                )}
                <button onClick={() => onOpen(idea)} className="rounded-md border border-white/15 px-3 py-2 text-xs text-white/70 hover:text-white">Details</button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Meta({ icon: Icon, children, dark }) {
  return <span className={`mono-label inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] ${dark ? "border-white/15 text-white/65" : "border-ink/12 text-ink/55"}`}><Icon className="h-2.5 w-2.5" />{children}</span>;
}

/* ---------------- Ranked row (list view) ---------------- */
export function RankedRow({ idea, onOpen, onStage, dragHandle, dragging }) {
  const m = meta(idea);
  const s = effectiveScore(idea);
  return (
    <div onClick={onOpen} className={`group flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-all hover:border-ink/35 ${dragging ? "border-[#ff6a00] shadow-lg" : "border-hair"}`}>
      <span {...dragHandle} onClick={(e) => e.stopPropagation()} title="Drag to re-rank" className="hidden cursor-grab text-ink/25 hover:text-ink/60 sm:block"><GripVertical className="h-4 w-4" /></span>
      <RankBadge rank={idea.rank} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-ink group-hover:text-[#ff3c00]">{idea.title}</p>
          <MoveArrow idea={idea} />
          {idea.override?.rank ? <Pin className="h-3 w-3 shrink-0 text-ink/35" title="Pinned by you" /> : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <StageChip idea={idea} />
          {m.effort && <Meta icon={Hammer}>Effort {m.effort}</Meta>}
          {m.ttd && <Meta icon={Clock}>{m.ttd}</Meta>}
          {m.rev && <span className="hidden md:inline-flex"><Meta icon={DollarSign}>{m.rev}</Meta></span>}
          {idea.category && <span className="mono-label hidden text-[9px] text-ink/35 lg:inline">{idea.category}</span>}
        </div>
      </div>
      <select value={stageOf(idea)} onClick={(e) => e.stopPropagation()} onChange={(e) => onStage(e.target.value)} className="hidden rounded border border-ink/12 bg-transparent px-1.5 py-1 text-[11px] text-ink/60 outline-none md:block">
        {STAGES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
      </select>
      <div className="flex items-center gap-2">
        {idea.override?.score !== undefined && idea.override?.score !== null && <span className="mono-label text-[8.5px] text-ink/40" title={`AI said ${idea.score}`}>override</span>}
        <ScoreDial score={s} size={38} />
      </div>
    </div>
  );
}

/* ---------------- Score panel (detail) ---------------- */
export function ScorePanel({ idea, scoring, onRescore, onOverride }) {
  const bd = idea.score_breakdown;
  const s = effectiveScore(idea);
  const [ov, setOv] = useState(idea.override?.score ?? "");
  const [note, setNote] = useState(idea.override?.note ?? "");
  const ve = bd ? valueEquation(bd) : null;
  return (
    <div className="game-panel p-5">
      <span className="pointer-events-none absolute left-0 top-0 h-[2px] w-full flame-bg" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <ScoreDial score={s} size={72} />
          <div>
            <div className="flex items-center gap-2"><TierChip score={s} /><Micro className="text-ink/60">Rank #{idea.rank || "—"} <MoveArrow idea={idea} /></Micro></div>
            <p className="mt-1 text-[13px] text-ink/60">{bd ? `AI score ${idea.score}${idea.override?.score != null && idea.override?.score !== "" ? ` · your override ${idea.override.score}` : ""}` : "Not scored yet"}</p>
            {idea.scored_at && <p className="mono-label mt-1 text-[9px] text-ink/35">Scored {new Date(idea.scored_at).toLocaleString()}</p>}
          </div>
        </div>
        <button onClick={onRescore} disabled={scoring} className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-card px-3 py-1.5 text-xs font-medium text-ink/70 hover:border-ink/30 disabled:opacity-60">
          {scoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : bd ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}{bd ? "Re-score with AI" : "Score with AI"}
        </button>
      </div>

      {bd && (
        <>
          <div className="mt-5 grid gap-x-6 gap-y-3 md:grid-cols-2">
            {FACTORS.map((fx) => {
              const v = bd.factors?.[fx.key];
              return (
                <div key={fx.key}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] font-semibold text-ink" title={fx.hint}>{fx.label}</span>
                    <span className="mono-label text-[10px] text-ink/55">{v?.score ?? "–"}/10</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
                    <motion.div className="h-full flame-bg" initial={{ width: 0 }} animate={{ width: `${(v?.score || 0) * 10}%` }} transition={{ duration: 0.6 }} />
                  </div>
                  {v?.why && <p className="mt-1 text-[12px] leading-snug text-ink/60">{v.why}</p>}
                </div>
              );
            })}
          </div>
          <div className="mt-5 rounded-md border border-hair bg-ink/[0.02] p-3">
            <Micro className="text-ink/55">How the score is computed</Micro>
            <p className="mt-1.5 font-mono text-[11.5px] leading-relaxed text-ink/70">
              dream {ve.dream} × likelihood {ve.likelihood} ÷ (time {ve.time} × effort {ve.effort}) = {ve.raw} → score {ve.score}
            </p>
            <p className="mt-1 text-[11px] text-ink/45">likelihood = mean(fit, assets, timing, risk) · time = 11 − speed · effort = 11 − ease · score = 100 × (log₁₀ raw + 2) ÷ 4</p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Fact icon={DollarSign} label="Revenue band (estimate)" value={bd.revenue_band} />
            <Fact icon={Clock} label="Time to first $ (estimate)" value={bd.time_to_dollar_label} />
            <Fact icon={Hammer} label="Effort band" value={bd.effort_band ? `${bd.effort_band} · ${{ S: "< 1 week", M: "1–4 weeks", L: "1–3 months", XL: "3+ months" }[bd.effort_band] || ""}` : null} />
          </div>
          {bd.sizing_note && <p className="mt-3 text-[12px] leading-snug text-ink/55"><span className="mono-label mr-2 text-[9px] text-ink/45">Sizing · estimate</span>{bd.sizing_note}</p>}
          {bd.next_action && <p className="mt-3 text-[13px] text-ink/80"><span className="mono-label mr-2 text-[9px] text-[#ff3c00]">Next action</span>{bd.next_action}</p>}
        </>
      )}

      <div className="mt-5 flex flex-wrap items-end gap-2 border-t border-hair pt-4">
        <label className="flex flex-col gap-1">
          <span className="mono-label text-[9px] text-ink/45">Override score (0–100)</span>
          <input type="number" min={0} max={100} value={ov} onChange={(e) => setOv(e.target.value)} className="w-24 rounded-md border border-ink/[0.13] bg-ink/[0.03] px-2 py-1.5 text-xs text-ink outline-none focus:border-[#ff6a00]/60" />
        </label>
        <label className="flex min-w-[180px] flex-1 flex-col gap-1">
          <span className="mono-label text-[9px] text-ink/45">Why (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Chase already asked for this" className="rounded-md border border-ink/[0.13] bg-ink/[0.03] px-2 py-1.5 text-xs text-ink outline-none focus:border-[#ff6a00]/60" />
        </label>
        <button onClick={() => onOverride({ score: ov === "" ? null : Math.max(0, Math.min(100, Number(ov))), note })} className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-[#ff3c00]">Save override</button>
        {(idea.override?.score != null || idea.override?.rank) && (
          <button onClick={() => { setOv(""); setNote(""); onOverride({ score: null, rank: null, note: "" }); }} className="inline-flex items-center gap-1 px-2 py-2 text-xs text-ink/50 hover:text-ink"><X className="h-3 w-3" />Clear overrides{idea.override?.rank ? " + pin" : ""}</button>
        )}
      </div>
    </div>
  );
}

function Fact({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md border border-hair p-3">
      <p className="mono-label flex items-center gap-1 text-[9px] text-ink/45"><Icon className="h-3 w-3" />{label}</p>
      <p className="mt-1 text-[13px] font-semibold text-ink">{value || "—"}</p>
    </div>
  );
}

/* ---------------- Concept brief (writeup) ---------------- */
export function ConceptBrief({ w }) {
  if (!w) return null;
  const phases = [...new Set((w.features || []).map((f) => f.phase || "Core"))];
  return (
    <div className="space-y-4">
      {w.pitch && (
        <div className="relative overflow-hidden rounded-[var(--radius)] bg-[#0d0d0f] p-6 text-white">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#ff3c00]/25 blur-3xl" />
          <p className="mono-label relative text-[10px] text-[#ff6a00]">Concept</p>
          <p className="relative mt-2 max-w-3xl text-[20px] font-semibold leading-snug tracking-[-0.025em] md:text-[24px]">{w.pitch}</p>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <BriefBox icon={Users} title="Who it's for">{w.who_for}</BriefBox>
        <BriefBox icon={AlertTriangle} title="The problem">{w.problem}</BriefBox>
        <BriefBox icon={Target} title="The wedge">{w.wedge}</BriefBox>
      </div>
      {w.features?.length > 0 && (
        <div className="game-panel p-5">
          <div className="mb-3 flex items-center gap-2"><Layers className="h-3.5 w-3.5 text-[#ff3c00]" /><Micro className="text-ink/60">Features</Micro></div>
          <div className="grid gap-5 md:grid-cols-3">
            {phases.map((ph) => (
              <div key={ph}>
                <p className="mono-label border-b border-hair pb-2 text-[10px] text-[#ff3c00]">{ph}</p>
                <ul className="mt-2 space-y-2">
                  {w.features.filter((f) => (f.phase || "Core") === ph).map((f) => (
                    <li key={f.name}><p className="text-[13px] font-semibold text-ink">{f.name}</p><p className="text-[12px] leading-snug text-ink/60">{f.detail}</p></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {w.mvp?.length > 0 && (
          <BriefBox icon={Hammer} title="MVP scope">
            <ol className="space-y-1.5">{w.mvp.map((m, i) => <li key={i} className="flex gap-2"><span className="flame-text w-5 shrink-0 font-bold tabular-nums">{i + 1}</span><span>{m}</span></li>)}</ol>
          </BriefBox>
        )}
        <BriefBox icon={Coins} title="Monetization">{w.monetization}</BriefBox>
      </div>
      {w.competitors?.length > 0 && (
        <div className="game-panel p-5">
          <div className="mb-3 flex items-center gap-2"><Swords className="h-3.5 w-3.5 text-[#ff3c00]" /><Micro className="text-ink/60">Competitors · verified by web search</Micro></div>
          <div className="grid gap-2 md:grid-cols-2">
            {w.competitors.map((c) => (
              <a key={c.name} href={c.url} target="_blank" rel="noreferrer" className="group rounded-md border border-hair p-3 hover:border-ink/30">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink group-hover:text-[#ff3c00]">{c.name}<ExternalLink className="h-3 w-3 text-ink/35" /></p>
                <p className="mt-0.5 text-[12px] leading-snug text-ink/60">{c.note}</p>
              </a>
            ))}
          </div>
        </div>
      )}
      {w.risks?.length > 0 && <BriefBox icon={AlertTriangle} title="Risks">{<ul className="space-y-1">{w.risks.map((r, i) => <li key={i}>— {r}</li>)}</ul>}</BriefBox>}
      {w.sources?.length > 0 && (
        <p className="text-[11px] text-ink/45">Sources: {w.sources.map((s, i) => <a key={i} href={s.url} target="_blank" rel="noreferrer" className="mr-2 underline hover:text-[#ff3c00]">{s.title}</a>)}</p>
      )}
    </div>
  );
}

function BriefBox({ icon: Icon, title, children }) {
  if (!children) return null;
  return (
    <div className="game-panel p-5">
      <div className="mb-2 flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-[#ff3c00]" /><Micro className="text-ink/60">{title}</Micro></div>
      <div className="text-[13px] leading-relaxed text-ink/75">{children}</div>
    </div>
  );
}
