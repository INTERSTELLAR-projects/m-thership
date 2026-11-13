import { useEffect, useRef, useState } from "react";
import { Download, SkipForward, Check, Volume2, VolumeX } from "lucide-react";
import { Mono, Meter, PillarChip, MicOrb, useMicGesture, PILLAR_COLOR } from "./ui";
import { PILLARS } from "./engine";
import { brain, errMsg } from "./api";
import { useListener, speak, stopSpeaking, canSpeak, getSpeakPref, setSpeakPref } from "./voice";

// Teach the Brain: one question at a time, by voice or text. Answers become BrainFacts the planner uses.
export default function BrainView() {
  const [st, setSt] = useState(null);
  const [answer, setAnswer] = useState("");
  const [skip, setSkip] = useState([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState("");
  const [voiceOn, setVoiceOn] = useState(getSpeakPref());
  const lastSpoken = useRef("");
  const voice = useListener({ onFinal: (t) => setAnswer((x) => (x ? x + " " : "") + t) });
  const mic = useMicGesture({ listening: voice.listening, start: voice.start, stop: voice.stop });

  const load = async (action = "next", args = {}) => {
    setErr("");
    try { const r = await brain(action, { skip, ...args }); setSt(r); return r; } catch (e) { setErr(errMsg(e)); return null; }
  };
  useEffect(() => { load(); return () => stopSpeaking(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const q = st?.question;
  useEffect(() => {
    if (voiceOn && q?.q && lastSpoken.current !== q.key) { lastSpoken.current = q.key; speak(q.q); }
  }, [q, voiceOn]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!q || !answer.trim() || busy) return;
    voice.stop();
    setBusy("save");
    const r = await load("answer", { question_key: q.key, question: q.q, pillar: q.pillar, text: answer.trim() });
    if (r?.saved) { setSaved(r.saved.statement); setAnswer(""); }
    setBusy("");
  };
  const doSkip = async () => {
    if (!q) return;
    const next = [...skip, q.key];
    setSkip(next);
    setAnswer("");
    await load("next", { skip: next });
  };
  const seed = async () => { setBusy("seed"); const r = await load("seed"); if (r) setSaved(r.seeded ? `Imported ${r.seeded} facts Møthership already had.` : r.note || ""); setBusy(""); };
  const toggleVoice = () => { const on = !voiceOn; setVoiceOn(on); setSpeakPref(on); if (!on) stopSpeaking(); else if (q) speak(q.q); };
  const seeded = (st?.facts || []).some((f) => String(f.source || "").startsWith("seed:"));

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 pb-36 pt-4 md:px-8 md:pt-8">
      <Mono className="text-ink/50">(Teach the Brain) · one question at a time</Mono>
      <h1 className="mt-2 text-[30px] font-semibold leading-[1] tracking-[-0.04em] md:text-[40px]">Business <span className="text-[#ff3c00]">/Brain</span></h1>
      <p className="mt-2 max-w-[60ch] text-[14px] leading-snug text-ink/60">The agent asks where it knows least and where it matters most. Every answer becomes a fact the daily plan and Ask use. Never say passwords: say where they live.</p>

      <section className="band-dark grain mt-6 p-5 md:p-8" aria-label="Current question">
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3">
            {q ? <PillarChip id={q.pillar} dark /> : <span />}
            <div className="flex items-center gap-3">
              {st && <Mono className="text-white/45">{st.answered} of {st.total_questions} answered</Mono>}
              {canSpeak() && <button type="button" onClick={toggleVoice} className="p-1.5 text-white/60 hover:text-white" aria-label={voiceOn ? "Stop reading questions aloud" : "Read questions aloud"} title={voiceOn ? "Voice on" : "Voice off"}>{voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>}
            </div>
          </div>
          {!st ? <div className="mt-4 h-24 animate-pulse bg-white/5 motion-reduce:animate-none" /> : q ? (
            <form onSubmit={submit} className="mt-4">
              <h2 className="text-[22px] font-semibold leading-snug tracking-[-0.02em] text-white md:text-[28px]">{q.q}</h2>
              <p className="mt-2 text-[13px] text-white/55">Why I'm asking: {q.why}</p>
              <div className="mt-5 flex items-start gap-3">
                <textarea value={voice.interim ? `${answer} ${voice.interim}` : answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} rows={3} placeholder={voice.supported ? "Hold the mic and talk, or type. Enter saves." : "Type your answer. Enter saves."} className="min-h-[96px] min-w-0 flex-1 border border-white/20 bg-white/[0.04] p-3 text-[15px] leading-relaxed text-white outline-none placeholder:text-white/35 focus:border-[#ff6a00]" aria-label="Your answer" />
                {voice.supported && <MicOrb size={64} dark listening={voice.listening} {...mic} label="Answer by voice" />}
              </div>
              {voice.error && <p className="mt-2 text-[12.5px] text-[#ffaa00]">{voice.error}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="submit" disabled={!answer.trim() || !!busy} className="inline-flex h-12 items-center gap-2 bg-[#ff3c00] px-5 text-[15px] font-medium text-white hover:bg-white hover:text-ink disabled:opacity-40"><Check className="h-4 w-4" />{busy === "save" ? "Saving…" : "Save answer"}</button>
                <button type="button" onClick={doSkip} className="inline-flex h-12 items-center gap-2 border border-white/25 px-4 text-[13px] text-white/80 hover:border-white"><SkipForward className="h-4 w-4" />Ask me later</button>
              </div>
            </form>
          ) : <p className="mt-4 text-[18px] text-white">That's every question in the bank. The Brain will ask again as the business changes.</p>}
          {saved && <p className="mt-4 border-l-2 border-[#1f8a5b] pl-3 text-[13px] text-white/75" role="status">Learned: {saved}</p>}
          {err && <p className="mt-3 text-[13px] text-[#ffaa00]" role="alert">{err}</p>}
        </div>
      </section>

      {!seeded && st && (
        <button type="button" onClick={seed} disabled={!!busy} className="mt-4 flex w-full items-center justify-between gap-3 border border-dashed border-hair px-4 py-3 text-left hover:border-ink disabled:opacity-50">
          <span><span className="block text-[14px] font-medium">Import what Møthership already knows</span><span className="block text-[12.5px] text-ink/55">Agency knowledge (offers, pricing, delivery rules, voice), the Interstellar brain and the revenue goal, so the Brain never asks twice.</span></span>
          <Download className="h-4 w-4 shrink-0 text-ink/50" />
        </button>
      )}

      <section className="mt-6 border border-hair bg-paper/80" aria-label="What the Brain knows">
        <div className="border-b border-hair px-4 py-3 md:px-6"><h2 className="text-[15px] font-semibold">What the Brain knows, by pillar</h2></div>
        <div className="grid gap-px bg-hair sm:grid-cols-2">
          {PILLARS.map((p) => {
            const c = st?.coverage?.[p.id];
            const facts = (st?.facts || []).filter((f) => f.pillar === p.id);
            return (
              <details key={p.id} className="group bg-paper px-4 py-3">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-baseline justify-between gap-2"><span className="text-[13.5px] font-medium">{p.name}</span><span className="font-mono text-[11px] tabular-nums text-ink/50">{c?.facts ?? 0} facts · {c?.confidence ?? 0}%</span></div>
                  <Meter value={c?.confidence || 0} color={PILLAR_COLOR[p.id]} className="mt-1.5" />
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {facts.length ? facts.slice(0, 12).map((f) => <li key={f.id || f.statement} className="text-[12.5px] leading-snug text-ink/70">{f.statement}<span className="ml-1.5 font-mono text-[9.5px] uppercase text-ink/35">{String(f.source || "").replace("seed:", "from ")}</span></li>) : <li className="text-[12.5px] text-ink/45">Nothing yet.</li>}
                </ul>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
