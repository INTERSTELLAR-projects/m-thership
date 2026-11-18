// Portal v2: "Ask or request anything" — Nøva front and center on Home.
// Type or talk (Web Speech API where the browser has it; typing always works). Sending opens Nøva with the message:
// questions are answered from the client's Business Brain and portal data, requests go into the normal request flow
// (Nøva's submit-request tool creates the ClientRequest our team works from).
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, Square } from "lucide-react";
import Martian from "@/features/agents/Martian";
import { KING } from "@/features/agents/kingPalette";

const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const CHIPS = [
  "What did you do for us this week?",
  "Request a website edit",
  "How are our Google reviews?",
  "Post our holiday hours",
];

export default function NovaBar({ onSend, business }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [voiceErr, setVoiceErr] = useState("");
  const rec = useRef(null);
  const box = useRef(null);

  useEffect(() => () => { try { rec.current?.abort(); } catch { /* already stopped */ } }, []);

  const send = (t = text) => {
    const v = String(t || "").trim();
    if (!v) return;
    if (listening) stop();
    setText(""); setInterim("");
    onSend(v);
  };

  const start = () => {
    if (!SR) return;
    setVoiceErr("");
    try {
      const r = new SR();
      r.lang = navigator.language || "en-US";
      r.interimResults = true;
      r.continuous = true;
      r.onresult = (e) => {
        let fin = "", mid = "";
        for (let i = e.resultIndex; i < e.results.length; i += 1) {
          const s = e.results[i][0]?.transcript || "";
          if (e.results[i].isFinal) fin += s; else mid += s;
        }
        if (fin) setText((v) => `${v ? `${v.trimEnd()} ` : ""}${fin.trim()}`);
        setInterim(mid);
      };
      r.onerror = (e) => {
        setVoiceErr(e?.error === "not-allowed" ? "Microphone access is blocked. Type instead, or allow the mic in your browser." : "Voice stopped. Type instead, or tap the mic again.");
        setListening(false);
      };
      r.onend = () => { setListening(false); setInterim(""); setTimeout(() => box.current?.focus(), 0); };
      rec.current = r;
      r.start();
      setListening(true);
    } catch {
      setVoiceErr("Voice isn't available in this browser. Type instead.");
    }
  };
  const stop = () => { try { rec.current?.stop(); } catch { /* ignore */ } setListening(false); };

  return (
    <section aria-label="Ask Nøva" className="band-dark pv2-grain overflow-hidden rounded-lg" data-nova-bar>
      <div className="pv2-sweep h-[3px]" aria-hidden="true" />
      <div className="px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full flame-bg shadow-[0_8px_24px_-8px_rgba(255,60,0,.8)]"><Martian palette={KING.palette} king size={30} active={listening} title="Nøva" /></span>
          <div className="min-w-0">
            <p className="text-[18px] font-semibold leading-tight tracking-[-0.03em] text-white sm:text-[21px]">Ask or request anything</p>
            <p className="truncate text-[12.5px] text-white/55">Nøva answers from what we know about {business || "your business"}, or sends it to our team.</p>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-4 flex items-stretch gap-2">
          <label htmlFor="nova-ask" className="sr-only">Ask or request anything</label>
          <input
            id="nova-ask" ref={box} value={listening && interim ? `${text}${text ? " " : ""}${interim}` : text}
            onChange={(e) => setText(e.target.value)} readOnly={listening}
            placeholder={listening ? "Listening… tap stop when you're done" : "e.g. Add our new service to the website"}
            autoComplete="off" enterKeyHint="send"
            className="min-h-[52px] min-w-0 flex-1 rounded-md border border-white/15 bg-white/[0.06] px-4 text-[15.5px] text-white outline-none placeholder:text-white/35 focus:border-[#ff6a00] focus:bg-white/[0.09]"
          />
          {SR && (
            <button
              type="button" onClick={listening ? stop : start}
              aria-label={listening ? "Stop listening" : "Talk instead of typing"} aria-pressed={listening}
              className={`relative flex w-[52px] shrink-0 items-center justify-center rounded-md border ${listening ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-white/15 bg-white/[0.06] text-white/80 hover:border-[#ff6a00] hover:text-white"}`}
            >
              {listening && <span className="pv2-live absolute inset-0 rounded-md ring-2 ring-[#ffaa00]/60" aria-hidden="true" />}
              {listening ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
            </button>
          )}
          <button type="submit" disabled={!text.trim()} aria-label="Send to Nøva" className="flex w-[52px] shrink-0 items-center justify-center rounded-md flame-bg text-white disabled:opacity-35">
            <ArrowUp className="h-5 w-5" />
          </button>
        </form>
        {voiceErr && <p role="status" className="mt-2 text-[12px] text-[#ffaa00]">{voiceErr}</p>}
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {CHIPS.map((c) => (
            <button key={c} type="button" onClick={() => send(c)} className="min-h-[38px] shrink-0 rounded-full border border-white/15 px-3.5 text-[12.5px] text-white/75 hover:border-[#ff6a00] hover:text-white">{c}</button>
          ))}
        </div>
      </div>
    </section>
  );
}
