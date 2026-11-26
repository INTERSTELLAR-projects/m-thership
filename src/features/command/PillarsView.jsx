import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Brain, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import Constellation from "./Constellation";
import { Mono, Meter, scoreTone, PILLAR_COLOR } from "./ui";
import { PILLARS, PILLAR_BY_ID } from "./engine";
import { liveScores, listActions, errMsg } from "./api";
import { KIND_LABEL } from "./NeedsYou";

export default function PillarsView() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [cards, setCards] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const sel = PILLAR_BY_ID[params.get("p")] ? params.get("p") : null;

  const load = async () => {
    setBusy(true); setErr("");
    try { setData(await liveScores(user)); } catch (e) { setErr(errMsg(e)); }
    listActions().then(setCards).catch(() => {});
    setBusy(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const scores = data?.scores || {};
  const ranked = useMemo(() => PILLARS.map((p) => scores[p.id]).filter(Boolean).filter((x) => x.score != null).sort((a, b) => a.score - b.score), [scores]);
  const focus = sel || ranked[0]?.id || "sales";
  const P = scores[focus];
  const tone = scoreTone(P?.score);
  const todos = data?.todos?.[focus] || [];
  const pillarCards = cards.filter((c) => c.pillar === focus);
  const pick = (id) => setParams(id ? { p: id } : {}, { replace: true });

  const scored = PILLARS.map((p) => scores[p.id]).filter((x) => x && x.score != null);
  const overall = scored.length ? Math.round(scored.reduce((a, x) => a + x.score, 0) / scored.length) : null;
  const overallTone = scoreTone(overall);

  // Pillars, Nov 25 2026: same language as the site and Workspace. Strip of eight pillars on top, the compass in a
  // compact dark band that stays in view (sticky, never stretched), the selected pillar's story on the right.
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-36 pt-6 md:px-8 md:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="ms-kicker">Pillars <span className="text-ink/40">· scored from live records</span></p>
          <h1 className="mt-3 text-[34px] font-semibold leading-[0.95] tracking-[-0.045em] md:text-[52px]">The business <span className="text-[#ff3c00]">/compass</span></h1>
        </div>
        <div className="flex items-end gap-5">
          <div className="text-right">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/45">Overall</p>
            <p className="text-[44px] font-semibold leading-none tabular-nums tracking-[-0.04em]" style={{ color: overallTone.color }}>{overall ?? "—"}</p>
          </div>
          <button type="button" onClick={load} disabled={busy} className="inline-flex h-10 items-center gap-2 border border-hair bg-card px-3.5 text-[12.5px] text-ink/70 hover:border-ink disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin motion-reduce:animate-none" : ""}`} />Rescore</button>
        </div>
      </div>
      {err && <p className="mt-3 text-[13px] text-[#c22a00]">{err}</p>}

      <div className="mt-7 grid grid-cols-2 gap-px border border-hair bg-hair sm:grid-cols-4 lg:grid-cols-8">
        {PILLARS.map((p) => {
          const s = scores[p.id];
          const on = focus === p.id;
          const tn = scoreTone(s?.score);
          return (
            <button key={p.id} type="button" onClick={() => pick(p.id)} aria-pressed={on} className={`relative min-w-0 px-3 pb-3 pt-3.5 text-left transition-colors ${on ? "bg-ink text-white" : "bg-canvas hover:bg-card"}`}>
              <span className={`absolute inset-x-0 top-0 h-[3px] ${on ? "flame-bg" : ""}`} style={on ? undefined : { background: tn.color, opacity: 0.35 }} aria-hidden="true" />
              <span className={`block truncate font-mono text-[10px] uppercase tracking-[0.12em] ${on ? "text-white/55" : "text-ink/45"}`}>{p.name}</span>
              <span className="mt-1.5 block text-[28px] font-semibold leading-none tabular-nums tracking-[-0.04em]" style={{ color: on ? "#fff" : tn.color }}>{s?.score == null ? "—" : s.score}</span>
              <span className={`mt-1.5 block font-mono text-[9.5px] uppercase tracking-[0.1em] ${on ? "text-[#ffaa00]" : "text-ink/40"}`}>{tn.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,420px),minmax(0,1fr)]">
        <div className="band-dark relative p-4 md:p-6 lg:sticky lg:top-24">
          <span className="absolute inset-x-0 top-0 h-[3px] flame-bg" aria-hidden="true" />
          <div className="relative z-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Compass</p>
            {data ? <Constellation scores={scores} selected={focus} onSelect={pick} size={420} dark /> : <div className="aspect-square animate-pulse bg-white/5 motion-reduce:animate-none" />}
            <p className="mt-1 text-center font-mono text-[9.5px] uppercase tracking-[0.14em] text-white/40">Centre 0 · rim 100 · dashed = no data · tap a star</p>
          </div>
        </div>

        {P ? (
          <div className="min-w-0 space-y-4">
            <section className="relative border border-hair bg-card p-5 md:p-7">
              <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: PILLAR_COLOR[focus] }} aria-hidden="true" />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="ms-kicker">{PILLAR_BY_ID[focus].hint}</p>
                  <h2 className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.04em] md:text-[40px]">{P.name}</h2>
                </div>
                <div className="text-right">
                  <p className="text-[56px] font-semibold leading-none tabular-nums tracking-[-0.05em]" style={{ color: tone.color }}>{P.score == null ? "—" : P.score}</p>
                  <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: tone.color }}>{tone.label}</p>
                </div>
              </div>
              <p className="mt-4 max-w-[62ch] text-[15px] leading-[1.5] text-ink/75">{P.why}</p>
              <div className="mt-5 border-t border-hair pt-4">
                <div className="flex items-baseline justify-between"><Mono className="text-ink/50">How much the Brain knows here</Mono><span className="font-mono text-[12px] tabular-nums text-ink/60">{P.confidence}%</span></div>
                <div className="mt-2 h-1.5 bg-ink/[0.08]"><div className="h-full flame-bg transition-[width] duration-700" style={{ width: `${P.confidence || 0}%` }} /></div>
                <p className="mt-2 text-[12px] text-ink/50">{P.facts || 0} Brain facts · {P.metrics.filter((m) => m.sub != null).length} of {P.metrics.length} inputs have data · <Link to={`/brain?pillar=${focus}`} className="inline-flex items-center gap-1 text-ink/70 underline-offset-2 hover:text-[#ff3c00] hover:underline"><Brain className="h-3 w-3" />Teach it about {P.name}</Link></p>
              </div>
            </section>

            <section className="border border-hair bg-card">
              <div className="border-b border-hair px-5 py-4 md:px-7"><p className="ms-kicker">Why this score</p><p className="mt-1.5 text-[12.5px] text-ink/50">Weighted average of the inputs that have data. Missing inputs lower the confidence, not the score.</p></div>
              <ul className="divide-y divide-hair/70">
                {P.metrics.map((m) => {
                  const mt = scoreTone(m.sub == null ? null : m.sub * 100);
                  return (
                    <li key={m.key} className="grid grid-cols-[1fr,120px] items-center gap-x-5 px-5 py-3 md:px-7">
                      <div className="min-w-0"><p className="text-[13.5px] leading-snug text-ink/85">{m.label} <span className="font-mono text-[10px] text-ink/40">×{m.weight}</span></p><p className="text-[11.5px] text-ink/50">{m.value} · target {m.target}</p></div>
                      <div>
                        <div className="flex items-baseline justify-between"><span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink/40">{mt.label}</span><span className="font-mono text-[13px] font-semibold tabular-nums" style={{ color: mt.color }}>{m.sub == null ? "—" : Math.round(m.sub * 100)}</span></div>
                        <Meter value={m.sub == null ? 0 : m.sub * 100} color={mt.color} className="mt-1" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="border border-hair bg-card">
              <div className="flex items-baseline justify-between border-b border-hair px-5 py-4 md:px-7"><p className="ms-kicker">To-dos in {P.name}</p><span className="font-mono text-[11px] tabular-nums text-ink/45">{todos.length + pillarCards.length}</span></div>
              {todos.length || pillarCards.length ? (
                <ul className="divide-y divide-hair/70">
                  {pillarCards.map((c) => (
                    <li key={c.id} className="flex items-start gap-3 px-5 py-3 md:px-7"><span className="mt-0.5 shrink-0 bg-[#ff3c00] px-1.5 py-px font-mono text-[9.5px] uppercase text-white">Needs you</span><span className="min-w-0 flex-1 text-[13.5px] leading-snug">{c.title}<span className="block text-[11.5px] text-ink/45">{KIND_LABEL[c.kind]}</span></span><Link to={`/?card=${c.id}`} className="shrink-0 text-ink/35 hover:text-[#ff3c00]" aria-label="Open in Needs you"><ArrowUpRight className="h-3.5 w-3.5" /></Link></li>
                  ))}
                  {todos.map((t, i) => (
                    <li key={i} className="flex items-start gap-3 px-5 py-3 md:px-7"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: PILLAR_COLOR[focus] }} /><span className="min-w-0 flex-1 text-[13.5px] leading-snug">{t.title}<span className="block text-[11.5px] text-ink/45">{t.why}</span></span>{t.ref?.path && <Link to={t.ref.path} className="shrink-0 text-ink/35 hover:text-[#ff3c00]" aria-label="Open record"><ArrowUpRight className="h-3.5 w-3.5" /></Link>}</li>
                  ))}
                </ul>
              ) : <p className="px-5 py-5 text-[13px] text-ink/50 md:px-7">Nothing open in this pillar right now.</p>}
            </section>
          </div>
        ) : <div className="h-64 animate-pulse border border-hair bg-paper/60 motion-reduce:animate-none" />}
      </div>
      {data?.local && <p className="mt-4 text-[12px] text-ink/45">Scored in the browser from the same records (the scoring service was unreachable).</p>}
    </div>
  );
}
