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

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-36 pt-4 md:px-8 md:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Mono className="text-ink/50">(Pillars) · scored from live records</Mono>
          <h1 className="mt-2 text-[30px] font-semibold leading-[1] tracking-[-0.04em] md:text-[40px]">The business <span className="text-[#ff3c00]">/compass</span></h1>
        </div>
        <button type="button" onClick={load} disabled={busy} className="inline-flex h-9 items-center gap-2 border border-hair px-3 text-[12.5px] text-ink/70 hover:border-ink disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin motion-reduce:animate-none" : ""}`} />Rescore</button>
      </div>
      {err && <p className="mt-3 text-[13px] text-[#c22a00]">{err}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,460px),minmax(0,1fr)]">
        <div className="band-dark grain p-3 md:p-5">
          <div className="relative z-10">
            {data ? <Constellation scores={scores} selected={focus} onSelect={pick} size={460} dark /> : <div className="aspect-square animate-pulse bg-white/5 motion-reduce:animate-none" />}
            <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Centre 0 · rim 100 · dashed = no data · tap a star</p>
          </div>
        </div>

        {P ? (
          <div className="min-w-0 space-y-4">
            <section className="border border-hair bg-paper/80 p-4 md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Mono className="text-ink/50"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: PILLAR_COLOR[focus] }} />{PILLAR_BY_ID[focus].hint}</Mono>
                  <h2 className="mt-1 text-[26px] font-semibold tracking-[-0.03em]">{P.name}</h2>
                </div>
                <div className="text-right">
                  <p className="text-[46px] font-semibold leading-none tabular-nums tracking-[-0.04em]" style={{ color: tone.color }}>{P.score == null ? "—" : P.score}</p>
                  <Mono className="mt-1 text-ink/45">{tone.label}</Mono>
                </div>
              </div>
              <p className="mt-3 text-[14px] leading-snug text-ink/75">{P.why}</p>
              <div className="mt-4">
                <div className="flex items-baseline justify-between"><Mono className="text-ink/50">How much the Brain knows here</Mono><span className="font-mono text-[12px] tabular-nums text-ink/60">{P.confidence}%</span></div>
                <Meter value={P.confidence} color="#1a1a1a" className="mt-1.5" />
                <p className="mt-1.5 text-[12px] text-ink/50">{P.facts || 0} Brain facts · {P.metrics.filter((m) => m.sub != null).length} of {P.metrics.length} inputs have data. <Link to={`/brain?pillar=${focus}`} className="inline-flex items-center gap-1 text-ink/70 underline-offset-2 hover:text-[#ff3c00] hover:underline"><Brain className="h-3 w-3" />Teach it about {P.name}</Link></p>
              </div>
            </section>

            <section className="border border-hair bg-paper/80">
              <div className="border-b border-hair px-4 py-3 md:px-6"><h3 className="text-[14px] font-semibold">Why this score</h3><p className="text-[12px] text-ink/50">Weighted average of the inputs that have data. Inputs without data are left out and lower the confidence instead.</p></div>
              <ul className="divide-y divide-hair/70">
                {P.metrics.map((m) => (
                  <li key={m.key} className="grid grid-cols-[1fr,auto] items-center gap-x-4 gap-y-1 px-4 py-2.5 md:px-6">
                    <div className="min-w-0"><p className="text-[13px] leading-snug text-ink/85">{m.label} <span className="font-mono text-[10px] text-ink/40">×{m.weight}</span></p><p className="text-[11.5px] text-ink/50">{m.value} · target {m.target}</p></div>
                    <div className="w-[88px] text-right">
                      <span className="font-mono text-[12px] tabular-nums" style={{ color: m.sub == null ? "#8a8580" : scoreTone(m.sub * 100).color }}>{m.sub == null ? "no data" : Math.round(m.sub * 100)}</span>
                      {m.sub != null && <Meter value={m.sub * 100} color={scoreTone(m.sub * 100).color} className="mt-1" />}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="border border-hair bg-paper/80">
              <div className="border-b border-hair px-4 py-3 md:px-6"><h3 className="text-[14px] font-semibold">To-dos in {P.name}</h3></div>
              {todos.length || pillarCards.length ? (
                <ul className="divide-y divide-hair/70">
                  {pillarCards.map((c) => (
                    <li key={c.id} className="flex items-start gap-3 px-4 py-2.5 md:px-6"><span className="mt-0.5 shrink-0 bg-[#ff3c00] px-1.5 py-px font-mono text-[9.5px] uppercase text-white">Needs you</span><span className="min-w-0 flex-1 text-[13px] leading-snug">{c.title}<span className="block text-[11.5px] text-ink/45">{KIND_LABEL[c.kind]}</span></span><Link to="/" className="shrink-0 text-ink/35 hover:text-[#ff3c00]" aria-label="Open in Needs you"><ArrowUpRight className="h-3.5 w-3.5" /></Link></li>
                  ))}
                  {todos.map((t, i) => (
                    <li key={i} className="flex items-start gap-3 px-4 py-2.5 md:px-6"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: PILLAR_COLOR[focus] }} /><span className="min-w-0 flex-1 text-[13px] leading-snug">{t.title}<span className="block text-[11.5px] text-ink/45">{t.why}</span></span>{t.ref?.path && <Link to={t.ref.path} className="shrink-0 text-ink/35 hover:text-[#ff3c00]" aria-label="Open record"><ArrowUpRight className="h-3.5 w-3.5" /></Link>}</li>
                  ))}
                </ul>
              ) : <p className="px-4 py-4 text-[13px] text-ink/50 md:px-6">Nothing open in this pillar right now.</p>}
            </section>
          </div>
        ) : <div className="h-64 animate-pulse border border-hair bg-paper/60 motion-reduce:animate-none" />}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PILLARS.map((p) => {
          const s = scores[p.id];
          return (
            <button key={p.id} type="button" onClick={() => pick(p.id)} aria-pressed={focus === p.id} className={`min-w-0 border px-3 py-2.5 text-left transition-colors ${focus === p.id ? "border-ink bg-ink text-white" : "border-hair bg-paper/70 hover:border-ink/50"}`}>
              <div className="flex items-baseline justify-between gap-2"><span className="truncate text-[12.5px]">{p.name}</span><span className="font-mono text-[14px] font-semibold tabular-nums" style={{ color: focus === p.id ? "#fff" : scoreTone(s?.score).color }}>{s?.score == null ? "—" : s.score}</span></div>
              <div className={`mt-1.5 h-[3px] ${focus === p.id ? "bg-white/15" : "bg-ink/[0.07]"}`}><div className="h-full" style={{ width: `${s?.confidence || 0}%`, background: focus === p.id ? "#ff6a00" : "#1a1a1a" }} /></div>
              <span className={`mt-1 block font-mono text-[9.5px] uppercase tracking-[0.1em] ${focus === p.id ? "text-white/50" : "text-ink/40"}`}>Confidence {s?.confidence ?? 0}%</span>
            </button>
          );
        })}
      </div>
      {data?.local && <p className="mt-4 text-[12px] text-ink/45">Scored in the browser from the same records (the scoring service was unreachable).</p>}
    </div>
  );
}
