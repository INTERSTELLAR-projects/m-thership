import { useEffect, useRef, useState } from "react";
import { Send, Rocket } from "lucide-react";
import Martian from "./Martian";

// Shared chat surface for admin Comms and the client portal.
// messages: [{ id, content, at, mine, pending?, sender: { key, name, logo, palette, king } }]

const CSS = `
@keyframes chat-pop { 0% { opacity: 0; transform: translateY(8px) scale(.94) } 60% { opacity: 1; transform: translateY(-2px) scale(1.01) } 100% { transform: none } }
@keyframes chat-beam { 0% { opacity: 0; transform: translateY(0) scaleY(.2) } 20% { opacity: 1 } 100% { opacity: 0; transform: translateY(-220px) scaleY(1) } }
@keyframes chat-spark { 0% { opacity: 1; transform: translate(0,0) scale(1) } 100% { opacity: 0; transform: translate(var(--dx), -60px) scale(.3) } }
.chat-pop { animation: chat-pop .38s cubic-bezier(.2,.9,.3,1.2) both; }
.chat-beam { animation: chat-beam .7s ease-out forwards; transform-origin: bottom; }
.chat-spark { animation: chat-spark .7s ease-out forwards; }
@media (prefers-reduced-motion: reduce) { .chat-pop, .chat-beam, .chat-spark { animation: none !important; opacity: 0 } .chat-pop { opacity: 1 } }
`;

let injected = false;
function useChatStyles() {
  useEffect(() => {
    if (injected || typeof document === "undefined" || document.getElementById("chat-styles")) { injected = true; return; }
    const el = document.createElement("style");
    el.id = "chat-styles";
    el.textContent = CSS;
    document.head.appendChild(el);
    injected = true;
  }, []);
}

const clock = (d) => {
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? "" : t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};
const dayLabel = (d) => {
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return "";
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (t.toDateString() === today.toDateString()) return "Today";
  if (t.toDateString() === y.toDateString()) return "Yesterday";
  return t.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

export function SenderLogo({ src, name, size = 16 }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return null;
  return <img src={src} alt={`${name} logo`} width={size} height={size} onError={() => setBad(true)} className="shrink-0 rounded-[4px] bg-white object-contain ring-1 ring-black/5" style={{ width: size, height: size }} />;
}

function Bubble({ m }) {
  const s = m.sender || {};
  const pal = s.palette || {};
  return (
    <div className={`chat-pop flex items-end gap-2 ${m.mine ? "flex-row-reverse" : ""}`}>
      <Martian palette={s.palette} king={s.king} size="sm" title={s.name} />
      <div className={`flex min-w-0 max-w-[82%] flex-col sm:max-w-[70%] ${m.mine ? "items-end" : "items-start"}`}>
        <div className={`mb-1 flex items-center gap-1.5 px-1 ${m.mine ? "flex-row-reverse" : ""}`}>
          <SenderLogo src={s.logo} name={s.name} />
          <span className="truncate text-[11.5px] font-semibold text-ink/75">{s.name}</span>
          {s.king && <span className="text-[10px]" aria-hidden>👑</span>}
          <span className="font-mono text-[10px] text-ink/40">{m.pending ? "beaming…" : clock(m.at)}</span>
        </div>
        <div
          className={`whitespace-pre-wrap break-words px-3.5 py-2 text-[13.5px] leading-relaxed shadow-sm ${m.mine ? "rounded-2xl rounded-br-md text-white" : "rounded-2xl rounded-bl-md border border-hair bg-card text-ink"} ${m.pending ? "opacity-70" : ""}`}
          style={m.mine ? { background: s.king ? "linear-gradient(135deg,#ff3c00,#ff6a00 55%,#ffaa00)" : `linear-gradient(135deg, ${pal.shade || "#1d1b2b"}, ${pal.body || "#1d1b2b"})` } : { borderLeft: `3px solid ${pal.body || "transparent"}` }}
        >
          {m.content}
        </div>
      </div>
    </div>
  );
}

export default function ChatRoom({ messages, onSend, me, placeholder = "Transmit a message…", emptyText = "No transmissions yet. Say hi!", header, className = "" }) {
  useChatStyles();
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [beams, setBeams] = useState([]);
  const [pending, setPending] = useState([]);
  const [err, setErr] = useState("");
  const end = useRef(null);
  const typingTimer = useRef(null);
  const ta = useRef(null);

  const all = [...messages, ...pending.filter((p) => !messages.some((m) => m.content === p.content && m.mine && new Date(m.at) >= new Date(p.at) - 60000))];

  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [all.length]);
  useEffect(() => () => clearTimeout(typingTimer.current), []);
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(140, el.scrollHeight)}px`;
  }, [text]);

  const onChange = (e) => {
    setText(e.target.value);
    setTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 1200);
  };

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText(""); setTyping(false); setErr("");
    const id = `p-${Date.now()}`;
    setBeams((b) => [...b, id]);
    setTimeout(() => setBeams((b) => b.filter((x) => x !== id)), 800);
    setPending((p) => [...p, { id, content: t, at: new Date().toISOString(), mine: true, pending: true, sender: me }]);
    try {
      await onSend(t);
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || "Message didn't send. Try again.");
      setText(t);
    } finally {
      setPending((p) => p.filter((x) => x.id !== id));
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
  };

  let lastDay = "";
  return (
    <div className={`flex h-[64vh] min-h-[420px] flex-col overflow-hidden rounded-xl border border-hair bg-paper ${className}`}>
      {header}
      <div className="relative flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5" style={{ backgroundImage: "radial-gradient(rgba(255,106,0,.07) 1px, transparent 1px)", backgroundSize: "18px 18px" }}>
        {all.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Martian palette={me?.palette} king={me?.king} size="xl" />
            <p className="text-[13px] text-ink/50">{emptyText}</p>
          </div>
        )}
        {all.map((m) => {
          const d = dayLabel(m.at);
          const sep = d && d !== lastDay;
          lastDay = d || lastDay;
          return (
            <div key={m.id}>
              {sep && (
                <div className="my-3 flex items-center gap-3">
                  <span className="h-px flex-1 bg-hair" />
                  <span className="mono-label text-[9.5px] text-ink/40">{d}</span>
                  <span className="h-px flex-1 bg-hair" />
                </div>
              )}
              <Bubble m={m} />
            </div>
          );
        })}
        <div ref={end} />
      </div>

      <div className="relative border-t border-hair bg-card p-2.5 sm:p-3">
        {beams.map((b) => (
          <span key={b} className="pointer-events-none absolute bottom-full right-8 h-1 w-1" aria-hidden>
            <span className="chat-beam absolute bottom-0 left-1/2 block h-40 w-1.5 -translate-x-1/2 rounded-full" style={{ background: "linear-gradient(to top, #ff3c00, #ff6a00, #ffaa00, transparent)" }} />
            {[-18, -6, 8, 20].map((dx) => (
              <span key={dx} className="chat-spark absolute bottom-0 block h-1.5 w-1.5 rounded-full bg-[#ffaa00]" style={{ "--dx": `${dx}px` }} />
            ))}
          </span>
        ))}
        {err && <p className="mb-2 px-1 text-[12px] text-[#ff3c00]">{err}</p>}
        <div className="flex items-end gap-2">
          {me && <div className="hidden pb-0.5 sm:block"><Martian palette={me.palette} king={me.king} size="sm" active={typing} title={me.name} /></div>}
          <textarea
            ref={ta}
            rows={1}
            value={text}
            onChange={onChange}
            onKeyDown={onKey}
            placeholder={placeholder}
            className="min-h-[40px] flex-1 resize-none rounded-lg border border-hair bg-paper px-3 py-2.5 text-[13.5px] leading-snug outline-none transition-colors focus:border-[#ff6a00]"
          />
          <button
            type="button"
            onClick={send}
            disabled={!text.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
            style={{ background: "linear-gradient(135deg,#ff3c00,#ff6a00 55%,#ffaa00)" }}
            aria-label="Send"
            title="Beam it (Enter)"
          >
            {text.trim() ? <Rocket className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1 hidden px-1 text-[10px] text-ink/35 sm:block">Enter to beam · Shift+Enter for a new line</p>
      </div>
    </div>
  );
}
