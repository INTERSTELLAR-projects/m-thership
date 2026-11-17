// Big mic + live transcript. Uses the browser's speech recognition (Chrome, Edge, Safari); where it isn't available
// the textarea alone is shown. Final words are appended to the text; the words still being heard show in grey.
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export default function VoiceBox({ value, onChange, placeholder, rows = 7, label = "Tap and talk" }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [err, setErr] = useState("");
  const rec = useRef(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const wantOn = useRef(false);

  useEffect(() => () => { wantOn.current = false; try { rec.current?.stop(); } catch { /* already stopped */ } }, []);

  const start = () => {
    if (!SR) return;
    setErr("");
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      let fin = ""; let mid = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t; else mid += t;
      }
      if (fin) {
        const cur = valueRef.current || "";
        onChange(`${cur}${cur && !/\s$/.test(cur) ? " " : ""}${fin.trim()}`);
      }
      setInterim(mid);
    };
    r.onerror = (e) => { if (e?.error === "not-allowed") { setErr("Microphone permission was blocked. Allow it in the browser, or type instead."); wantOn.current = false; } };
    // Browsers stop after a pause; keep listening until Justin taps stop.
    r.onend = () => { setInterim(""); if (wantOn.current) { try { r.start(); } catch { setListening(false); } } else setListening(false); };
    try { r.start(); rec.current = r; wantOn.current = true; setListening(true); } catch (x) { setErr(x?.message || "Could not start the microphone"); }
  };
  const stop = () => { wantOn.current = false; try { rec.current?.stop(); } catch { /* ignore */ } setListening(false); setInterim(""); };

  return (
    <div className="space-y-2">
      {SR ? (
        <div className="flex items-center gap-3">
          <button type="button" onClick={listening ? stop : start} className={`mic ${listening ? "on" : ""}`} aria-label={listening ? "Stop listening" : "Start voice input"}>
            <span className="ring" /><span className="ring r2" />
            {listening ? <Square className="relative h-5 w-5" /> : <Mic className="relative h-6 w-6" />}
          </button>
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium text-white">{listening ? "Listening… tap to stop" : label}</p>
            <p className="text-[11.5px] text-[var(--ink-s)]">{listening ? "Talk naturally; it keeps going through pauses." : "Or type below. You can edit everything after."}</p>
          </div>
        </div>
      ) : (
        <p className="text-[11.5px] text-[var(--ink-s)]">Voice input isn't available in this browser; type below.</p>
      )}
      <div className="relative">
        <textarea className="inp" rows={rows} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        {interim ? <p className="pointer-events-none mt-1 text-[12.5px] italic text-[var(--ink-s)]">{interim}</p> : null}
      </div>
      {err ? <p className="text-[11.5px] text-[#ff8a7f]">{err}</p> : null}
    </div>
  );
}
