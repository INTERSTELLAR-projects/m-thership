// Small mic for one field (an answer box). Appends what's heard to the value; tap again to stop.
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export default function MicButton({ value, onChange, onDone, title = "Dictate" }) {
  const [on, setOn] = useState(false);
  const rec = useRef(null);
  const want = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => () => { want.current = false; try { rec.current?.stop(); } catch { /* stopped */ } }, []);
  if (!SR) return null;
  const start = () => {
    const r = new SR();
    r.continuous = true; r.interimResults = false; r.lang = "en-US";
    r.onresult = (e) => {
      let fin = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) fin += e.results[i][0].transcript;
      if (fin.trim()) { const cur = valueRef.current || ""; onChange(`${cur}${cur && !/\s$/.test(cur) ? " " : ""}${fin.trim()}`); }
    };
    r.onerror = (e) => { if (e?.error === "not-allowed") { want.current = false; setOn(false); } };
    r.onend = () => { if (want.current) { try { r.start(); } catch { setOn(false); } } else { setOn(false); onDone?.(); } };
    try { r.start(); rec.current = r; want.current = true; setOn(true); } catch { setOn(false); }
  };
  const stop = () => { want.current = false; try { rec.current?.stop(); } catch { /* ignore */ } };
  return (
    <button type="button" onClick={on ? stop : start} title={on ? "Stop" : title} aria-label={on ? "Stop dictating" : title}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition ${on ? "border-[#ff6a00] bg-[rgba(255,60,0,.25)] text-white" : "border-[var(--hair-d2)] text-[var(--ink-m)] hover:border-[#ff6a00] hover:text-white"}`}>
      {on ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
    </button>
  );
}
