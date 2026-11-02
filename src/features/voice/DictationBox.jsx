import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { recorderSupported, startRecorder } from "@/features/tasks/lib/recorder";
import { coreVoiceStatus, createRecognizer, requestMicAccess, speechSupported, transcribeAudio } from "@/features/tasks/lib/speech";

// A "Direction for Claude" textarea with a mic. Same capture as Core voice: it records until Justin
// taps Stop (no cut-off on pauses; Chrome's recogniser is restarted when it ends), live captions as
// he talks, then the full recording is transcribed by the core-voice function when available
// (falling back to the live captions). The transcript is appended to the editable box.
const join = (a, b) => [String(a || "").trim(), String(b || "").trim()].filter(Boolean).join(" ");

export function useDictation({ onText }) {
  const [mode, setMode] = useState("idle"); // idle | listening | transcribing
  const [level, setLevel] = useState(0);
  const [live, setLive] = useState("");
  const [notice, setNotice] = useState("");
  const on = useRef(false);
  const rec = useRef(null);
  const recorder = useRef(null);
  const heard = useRef("");
  const interim = useRef("");
  const onTextRef = useRef(onText);
  useEffect(() => { onTextRef.current = onText; }, [onText]);

  const stopRecognition = () => {
    const r = rec.current;
    rec.current = null;
    if (r) { r.onend = null; try { r.stop(); } catch { /* already stopped */ } }
  };

  const begin = useCallback(() => {
    if (!on.current || rec.current || !speechSupported()) return;
    const r = createRecognizer({
      onInterim: (t) => { interim.current = t; setLive(join(heard.current, t)); },
      onFinal: (t) => { heard.current = join(heard.current, t); interim.current = ""; setLive(heard.current); },
      onEnd: () => {
        rec.current = null;
        if (interim.current) { heard.current = join(heard.current, interim.current); interim.current = ""; }
        if (on.current) window.setTimeout(() => begin(), 150); // keep listening until Stop
      },
      onError: (e) => {
        if (e && (e.error === "not-allowed" || e.error === "service-not-allowed") && !recorder.current) {
          on.current = false;
          setMode("idle");
          setNotice("The microphone is blocked. Allow it in your browser to dictate.");
        }
      },
    });
    if (!r) return;
    rec.current = r;
    try { r.start(); } catch { rec.current = null; }
  }, []);

  const stop = useCallback(async () => {
    if (!on.current) return;
    on.current = false;
    stopRecognition();
    let text = join(heard.current, interim.current);
    const session = recorder.current;
    recorder.current = null;
    if (session) {
      const blob = await session.stop();
      if (blob && blob.size > 2000) {
        const status = await coreVoiceStatus().catch(() => ({ available: false }));
        if (status.available) {
          setMode("transcribing");
          try {
            const t = await transcribeAudio(blob);
            if (t && t.trim()) text = t.trim();
          } catch {
            setNotice("Server transcription failed, so the live captions were used.");
          }
        }
      }
    }
    heard.current = "";
    interim.current = "";
    setLive("");
    setMode("idle");
    if (text) onTextRef.current && onTextRef.current(text);
    else setNotice((n) => n || "Nothing was picked up. Try again a little closer to the mic.");
  }, []);

  const start = useCallback(async () => {
    if (on.current) return;
    setNotice("");
    if (!recorderSupported() && !speechSupported()) {
      setNotice("Voice capture isn't available in this browser. Type the direction instead.");
      return;
    }
    heard.current = "";
    interim.current = "";
    setLive("");
    if (recorderSupported()) {
      try {
        recorder.current = await startRecorder({ onLevel: setLevel, onAutoStop: () => { setNotice("Ten minute limit reached, stopping."); stop(); } });
      } catch {
        recorder.current = null;
        if (!speechSupported()) { setNotice("Microphone permission was refused. Allow mic access to dictate."); return; }
      }
    } else if (!(await requestMicAccess())) {
      setNotice("Microphone permission was refused. Allow mic access to dictate.");
      return;
    }
    on.current = true;
    setMode("listening");
    begin();
  }, [begin, stop]);

  useEffect(() => () => {
    on.current = false;
    stopRecognition();
    if (recorder.current) recorder.current.cancel();
    recorder.current = null;
  }, []);

  return { mode, level, live, notice, start, stop, supported: recorderSupported() || speechSupported() };
}

export function DictateButton({ dictation, className = "" }) {
  const { mode, level, start, stop, supported } = dictation;
  if (!supported) return null;
  const listening = mode === "listening";
  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      disabled={mode === "transcribing"}
      title={listening ? "Stop and add what you said" : "Dictate (records until you tap stop)"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[11.5px] transition-colors disabled:opacity-60",
        listening ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-hair bg-card text-ink/65 hover:border-[#ff3c00] hover:text-ink",
        className,
      )}
    >
      {mode === "transcribing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : listening ? <Square className="h-3 w-3 fill-current" /> : <Mic className="h-3.5 w-3.5" />}
      {mode === "transcribing" ? "Transcribing…" : listening ? "Stop" : "Dictate"}
      {listening && (
        <span className="ml-0.5 inline-block h-1.5 w-8 overflow-hidden rounded-full bg-white/30" aria-hidden="true">
          <span className="block h-full bg-white" style={{ width: `${Math.max(8, Math.round(level * 100))}%` }} />
        </span>
      )}
    </button>
  );
}

// Labelled textarea + mic. The transcript is appended to whatever is already typed.
export default function DictationBox({ label, value, onChange, rows = 3, placeholder = "", disabled = false }) {
  const dictation = useDictation({ onText: (t) => onChange(join(value, t)) });
  const { mode, live, notice } = dictation;
  return (
    <div className="block">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {label ? <span className="mono-label text-[9.5px] text-ink/50">{label}</span> : <span />}
        <DictateButton dictation={dictation} />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        disabled={disabled || mode === "transcribing"}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-sm border border-hair bg-card px-3 py-2 text-[13px] outline-none focus:border-[#ff3c00] disabled:opacity-70"
      />
      {mode === "listening" && (
        <p className="mt-1 rounded-sm border border-dashed border-[#ff3c00]/40 bg-[#ff3c00]/[0.03] px-2.5 py-1.5 text-[12px] text-ink/70">
          <span className="mono-label mr-2 text-[8.5px] text-[#ff3c00]">recording · tap stop when you&apos;re done</span>
          {live || <span className="text-ink/40">Listening…</span>}
        </p>
      )}
      {notice && <p className="mt-1 text-[11.5px] text-amber-700">{notice}</p>}
    </div>
  );
}
