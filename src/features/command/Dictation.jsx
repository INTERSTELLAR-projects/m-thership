import { useEffect, useState } from "react";
import { Mic, Square, Check, Pencil, Quote, Loader2 } from "lucide-react";
import { fmtElapsed } from "./dictation";
import { brain, errMsg } from "./api";
import { Mono, PillarChip } from "./ui";

// Tap-to-start / tap-to-stop mic used everywhere free text is dictated (Brain, Needs-you questions, Ask, Walk answers).
export function MicToggle({ dict, dark = false, size = 52, label = "Dictate" }) {
  const on = dict.listening;
  return (
    <button
      type="button"
      onClick={dict.toggle}
      aria-pressed={on}
      aria-label={on ? "Stop dictation" : label}
      title={on ? "Tap to stop" : "Tap to dictate"}
      className={`relative flex shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 motion-reduce:transition-none ${on ? "bg-[#ff3c00] text-white" : dark ? "bg-white text-ink" : "bg-ink text-white"}`}
      style={{ width: size, height: size }}
    >
      {on && <span className="absolute inset-0 animate-ping rounded-full bg-[#ff3c00]/35 motion-reduce:animate-none" />}
      {on ? <Square className="relative h-[36%] w-[36%] fill-current" /> : <Mic className="relative h-[42%] w-[42%]" strokeWidth={1.8} />}
    </button>
  );
}

export function ListeningStatus({ dict, dark = false }) {
  if (dict.listening) {
    return (
      <p className={`flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] ${dark ? "text-[#ff8a4d]" : "text-[#ff3c00]"}`} role="status" aria-live="polite">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff3c00] motion-reduce:animate-none" />
        Listening… tap to stop · {fmtElapsed(dict.elapsed)}
      </p>
    );
  }
  if (dict.error) return <p className={`text-[12.5px] ${dark ? "text-[#ffaa00]" : "text-[#c22a00]"}`} role="alert">{dict.error}</p>;
  if (!dict.supported) return <p className={`text-[12px] ${dark ? "text-white/50" : "text-ink/50"}`}>Voice typing isn't available in this browser, so type your answer.</p>;
  return null;
}

// Text box that shows the live transcript (committed words solid, the words still being heard faded).
export function DictationBox({ dict, placeholder, dark = false, rows = 4, onEnter, autoFocus = false, label = "Your answer", micSize = 56 }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        {dict.listening ? (
          <div className={`min-h-[104px] min-w-0 flex-1 whitespace-pre-wrap border p-3 text-[15px] leading-relaxed ${dark ? "border-[#ff6a00]/60 bg-white/[0.04] text-white" : "border-[#ff3c00]/50 bg-white text-ink"}`} aria-label={label} aria-live="polite">
            {dict.committed}{dict.interim ? <span className={dark ? "text-white/45" : "text-ink/40"}>{dict.committed ? " " : ""}{dict.interim}</span> : null}
            {!dict.committed && !dict.interim && <span className={dark ? "text-white/35" : "text-ink/35"}>Go ahead, I'm listening. Pauses are fine.</span>}
          </div>
        ) : (
          <textarea
            value={dict.text}
            onChange={(e) => dict.setText(e.target.value)}
            onKeyDown={(e) => { if (onEnter && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEnter(); } }}
            rows={rows}
            autoFocus={autoFocus}
            placeholder={placeholder}
            aria-label={label}
            className={`min-h-[104px] min-w-0 flex-1 border p-3 text-[15px] leading-relaxed outline-none ${dark ? "border-white/20 bg-white/[0.04] text-white placeholder:text-white/35 focus:border-[#ff6a00]" : "border-hair bg-white text-ink placeholder:text-ink/40 focus:border-ink"}`}
          />
        )}
        {dict.supported && <MicToggle dict={dict} dark={dark} size={micSize} />}
      </div>
      <div className="mt-2 min-h-[18px]"><ListeningStatus dict={dict} dark={dark} /></div>
    </div>
  );
}

// "Here's how I'll remember it": the cleaned-up version, editable, saved only on one explicit tap.
export function AnswerReview({ raw, question, questionKey, dark = false, onSave, onBack }) {
  const [state, setState] = useState({ loading: true, statements: [], source: "", about: "", pillar: "" });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    brain("clean", { text: raw, question, question_key: questionKey })
      .then((r) => { if (live) setState({ loading: false, statements: r.statements || [raw], source: r.source || "", about: r.about_client || "", pillar: r.pillar_hint || "" }); })
      .catch(() => { if (live) setState({ loading: false, statements: [raw], source: "raw", about: "", pillar: "" }); });
    return () => { live = false; };
  }, [raw, question, questionKey]);
  const save = async (statements, exact = false) => {
    setBusy(true); setErr("");
    try { await onSave(statements.map((x) => x.trim()).filter(Boolean), { exact, about: state.about }); } catch (e) { setErr(errMsg(e)); }
    setBusy(false);
  };
  const box = dark ? "border-white/20 bg-white/[0.05] text-white" : "border-hair bg-white text-ink";
  const muted = dark ? "text-white/55" : "text-ink/55";
  return (
    <div className="cmd-sheet" aria-label="Review before saving">
      <Mono className={dark ? "text-[#ff8a4d]" : "text-[#ff3c00]"}>Here's how I'll remember it</Mono>
      {state.loading ? (
        <p className={`mt-3 flex items-center gap-2 text-[14px] ${muted}`}><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Tidying it into clear sentences…</p>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            {state.statements.map((st, i) => editing ? (
              <textarea key={i} value={st} rows={Math.min(6, Math.max(2, Math.ceil(st.length / 60)))} onChange={(e) => setState((s) => ({ ...s, statements: s.statements.map((x, k) => (k === i ? e.target.value : x)) }))} className={`w-full border p-3 text-[15px] leading-relaxed outline-none focus:border-[#ff6a00] ${box}`} aria-label={`Fact ${i + 1}`} />
            ) : (
              <p key={i} className={`border p-3 text-[15px] leading-relaxed ${box}`}>{st}</p>
            ))}
          </div>
          <p className={`mt-2 text-[12px] ${muted}`}>
            {state.source === "llm" ? "Cleaned up from what you said: punctuation, capitals and filler words. Your meaning and numbers are unchanged." : state.source === "rules" ? "Basic clean-up only (the AI tidy-up wasn't available)." : "Saved as you said it."}
            {state.statements.length > 1 ? ` Split into ${state.statements.length} facts.` : ""}
            {state.about ? <> This sounds like it's about <strong>{state.about}</strong>; I'll tag it to them.</> : null}
          </p>
          {state.pillar ? <div className="mt-1"><PillarChip id={state.pillar} dark={dark} /></div> : null}
          <details className={`mt-2 text-[12px] ${muted}`}><summary className="cursor-pointer">What you said</summary><p className="mt-1 whitespace-pre-wrap">{raw}</p></details>
          {err && <p className="mt-2 text-[13px] text-[#c22a00]" role="alert">{err}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" autoFocus onClick={() => save(state.statements)} disabled={busy} className="inline-flex h-12 items-center gap-2 bg-[#ff3c00] px-5 text-[15px] font-medium text-white hover:bg-ink disabled:opacity-50"><Check className="h-4 w-4" />{busy ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setEditing((x) => !x)} disabled={busy} className={`inline-flex h-12 items-center gap-2 border px-4 text-[13px] ${dark ? "border-white/25 text-white/85" : "border-hair text-ink/75 hover:border-ink"}`}><Pencil className="h-3.5 w-3.5" />{editing ? "Done editing" : "Edit"}</button>
            <button type="button" onClick={() => save([raw], true)} disabled={busy} className={`inline-flex h-12 items-center gap-2 border px-4 text-[13px] ${dark ? "border-white/25 text-white/85" : "border-hair text-ink/75 hover:border-ink"}`}><Quote className="h-3.5 w-3.5" />Use my exact words</button>
            {onBack && <button type="button" onClick={onBack} disabled={busy} className={`h-12 px-3 text-[13px] ${muted}`}>Back</button>}
          </div>
        </>
      )}
    </div>
  );
}
