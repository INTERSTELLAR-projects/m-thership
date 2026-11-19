import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { ArrowUp, Volume2, VolumeX, X, Check, Inbox, Lightbulb } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { tipFor, hiddenTips, hideTip, hideAllTips } from "./tips";
import { useAuth } from "@/lib/AuthContext";
import { Mono } from "./ui";
import { MicToggle, ListeningStatus } from "./Dictation";
import { ask, errMsg } from "./api";
import { useDictation, speak, stopSpeaking, canSpeak, getSpeakPref, setSpeakPref } from "./voice";

// The Ask bar: on every admin page. Hold the mic and talk (release sends) or tap to start/stop; type otherwise.
// Questions get answers from the live records; orders become tasks, facts or re-plans right away, and anything
// that leaves the business or changes a record becomes a Needs-you card.
const isTyping = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

export default function AskBar() {
  const { user } = useAuth();
  const loc = useLocation();
  const [text, setText] = useState("");
  const [turns, setTurns] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [voiceOn, setVoiceOn] = useState(getSpeakPref());
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const clientId = (loc.pathname.match(/^\/clients\/([^/]+)/) || [])[1] || "";
  const clientQ = useQuery({ queryKey: ["CRMClient", "get", clientId], enabled: false });
  const [hidden, setHidden] = useState(hiddenTips);

  const submit = useCallback(async (raw) => {
    const q = String(raw ?? text).trim();
    if (!q || busy) return;
    setText("");
    setOpen(true);
    setTurns((t) => [...t.slice(-8), { who: "you", text: q }]);
    setBusy(true);
    try {
      const r = await ask(user, q);
      setTurns((t) => [...t, { who: "agent", text: r.reply, done: r.done || [], proposed: r.proposed || [], offline: r.offline }]);
      if (voiceOn) speak(r.speak || r.reply);
      if (r.replanned) window.dispatchEvent(new Event("command:refresh"));
      if ((r.proposed || []).length || (r.done || []).length) window.dispatchEvent(new Event("command:actions"));
    } catch (e) {
      setTurns((t) => [...t, { who: "agent", text: `I couldn't do that: ${errMsg(e)}`, error: true }]);
    }
    setBusy(false);
  }, [text, busy, user, voiceOn]);

  // Tap the mic to start, tap again to stop. What you said stays in the box for you to check and send.
  const dict = useDictation({ onStop: (t) => { setText(t); setTimeout(() => inputRef.current?.focus(), 30); } });
  const toggleMic = () => { if (!dict.listening) { dict.setText(text); stopSpeaking(); } dict.toggle(); };
  useEffect(() => {
    const h = (e) => {
      if (e.key === "/" && !isTyping(document.activeElement) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === "Escape" && open) setOpen(false);
    };
    const fromPalette = (e) => { const d = e.detail || {}; if (d.send && d.text) submit(d.text); else { setText(d.text || ""); setTimeout(() => inputRef.current?.focus(), 30); } };
    window.addEventListener("keydown", h);
    window.addEventListener("command:ask", fromPalette);
    return () => { window.removeEventListener("keydown", h); window.removeEventListener("command:ask", fromPalette); };
  }, [open, submit]);
  useEffect(() => { listRef.current?.scrollTo({ top: 1e6 }); }, [turns, busy]);

  if (loc.pathname === "/walk") return null;
  // Contextual tip: one per page, dismissible (remembered in this browser), "Try it" fills the bar.
  const baseTip = tipFor(loc.pathname);
  const clientName = clientId ? clientQ.data?.business || "this client" : "";
  const tip = baseTip && !hidden.includes("*") && !hidden.includes(String(baseTip.match)) ? { ...baseTip, ask: (baseTip.ask || "").replace("{client}", clientName) } : null;
  const showTip = tip && !open && !text && !dict.listening && !busy;
  const toggleVoice = () => { const on = !voiceOn; setVoiceOn(on); setSpeakPref(on); if (!on) stopSpeaking(); };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))] md:px-6" data-askbar>
      <div className="pointer-events-auto w-full max-w-[640px]">
        {open && turns.length > 0 && (
          <div className="cmd-sheet mb-2 border border-hair bg-paper/95 shadow-[0_20px_50px_-20px_rgba(26,26,26,0.45)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-hair px-4 py-2">
              <Mono className="text-ink/45">Ask Møthership</Mono>
              <button type="button" onClick={() => setOpen(false)} className="p-1 text-ink/45 hover:text-ink" aria-label="Close answers"><X className="h-4 w-4" /></button>
            </div>
            <div ref={listRef} className="max-h-[46vh] space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
              {turns.map((t, k) => (
                <div key={k} className={t.who === "you" ? "text-right" : ""}>
                  <p className={`inline-block max-w-[92%] px-3 py-2 text-left text-[14px] leading-snug ${t.who === "you" ? "bg-ink text-white" : t.error ? "bg-[#ff3c00]/10 text-ink" : "bg-white text-ink"}`}>{t.text}</p>
                  {t.done?.map((d, j) => <p key={`d${j}`} className="mt-1 flex items-center gap-1.5 text-[12px] text-[#1f8a5b]"><Check className="h-3 w-3" />{d.label}</p>)}
                  {t.proposed?.length > 0 && <Link to="/" className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-[#ff3c00]"><Inbox className="h-3 w-3" />{t.proposed.length} waiting for your OK in Needs you</Link>}
                  {t.offline && <p className="mt-1 text-[11px] text-ink/40">Answered offline from the records (AI unavailable).</p>}
                </div>
              ))}
              {busy && <p className="text-[13px] text-ink/45">Thinking…</p>}
            </div>
          </div>
        )}
        {showTip && (
          <div className="mb-1.5 flex items-center gap-2 border border-hair bg-paper/95 px-3 py-1.5 text-[12px] text-ink/70 shadow-[0_10px_24px_-18px_rgba(26,26,26,0.5)] backdrop-blur" role="note" data-ask-tip>
            <Lightbulb className="h-3.5 w-3.5 shrink-0 text-[#ff3c00]" aria-hidden="true" />
            <span className="min-w-0 flex-1 leading-snug"><span className="mr-1 font-mono text-[9.5px] uppercase tracking-[.14em] text-[#ff3c00]">Tip</span>{tip.text}</span>
            {tip.ask ? <button type="button" onClick={() => { setText(tip.ask); setTimeout(() => inputRef.current?.focus(), 20); }} className="hidden shrink-0 whitespace-nowrap font-medium text-[#ff3c00] hover:text-ink sm:inline">Try “{tip.ask.trim()}”</button> : null}
            <button type="button" onClick={() => { hideTip(String(tip.match)); setHidden(hiddenTips()); }} className="shrink-0 p-0.5 text-ink/40 hover:text-ink" aria-label="Dismiss tip" title="Dismiss (Shift-click hides all tips)" onMouseDown={(e) => { if (e.shiftKey) { hideAllTips(); setHidden(hiddenTips()); } }}><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {(dict.listening || dict.error) && <div className="mb-1.5 bg-paper/95 px-3 py-1.5 backdrop-blur"><ListeningStatus dict={dict} /></div>}
        <form onSubmit={(e) => { e.preventDefault(); if (dict.listening) dict.stop(); else submit(); }} className="flex items-center gap-2 border border-ink/15 bg-paper/95 p-1.5 pl-2 shadow-[0_14px_40px_-18px_rgba(26,26,26,0.55)] backdrop-blur">
          {dict.supported ? <MicToggle dict={{ ...dict, toggle: toggleMic }} size={46} label="Dictate to Møthership" /> : null}
          <input
            ref={inputRef}
            value={dict.listening ? dict.text : text}
            readOnly={dict.listening}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => turns.length && setOpen(true)}
            placeholder={dict.listening ? "Listening… tap the mic to stop" : "Ask, tell, or say “something came up”"}
            className="h-11 min-w-0 flex-1 bg-transparent px-1 text-[15px] text-ink outline-none placeholder:text-ink/40"
            aria-label="Ask Møthership"
            enterKeyHint="send"
          />
          {canSpeak() && <button type="button" onClick={toggleVoice} className="hidden p-2 text-ink/45 hover:text-ink sm:block" aria-label={voiceOn ? "Turn spoken replies off" : "Turn spoken replies on"} title={voiceOn ? "Spoken replies on" : "Spoken replies off"}>{voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>}
          <button type="submit" disabled={busy || (!text.trim() && !dict.listening)} className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#ff3c00] text-white transition-colors hover:bg-ink disabled:bg-ink/15" aria-label="Send"><ArrowUp className="h-4 w-4" /></button>
        </form>
      </div>
    </div>
  );
}
