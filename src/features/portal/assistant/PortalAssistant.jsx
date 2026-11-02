import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { ArrowUp, Check, ChevronDown, Loader2, Maximize2, Mic, Plus, RefreshCw, Square, Volume2, VolumeX, X, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Martian from "@/components/comms/Martian";
import { KING } from "@/components/comms/martianColors";
import { useDictation, voiceInputSupported, readAloud, stopReading } from "./portalVoice";

// Interstellar Assistant: the client-facing Base44 agent (base44/agents/interstellar_assistant.jsonc)
// embedded in the client portal. The agent only reaches data through the assistant* backend functions,
// which resolve the client from the signed-in login. In admin preview the conversation carries
// metadata.preview_client_id so those functions know which client Justin is previewing.

const AGENT = "interstellar_assistant";
const READ_KEY = "mothership.portal.assistant.read";
const CHIPS = ["What did you do for me this month?", "Request a website edit", "Get my review link", "What's next on my project?"];
const TOOL_LABELS = {
  assistantBriefing: ["Pulling your briefing", "Briefing ready"],
  assistantQuickFacts: ["Looking that up", "Found it"],
  assistantMyRequests: ["Checking your requests", "Requests checked"],
  assistantSubmitRequest: ["Sending your request", "Request sent"],
  assistantEditRequest: ["Updating your request", "Request updated"],
  assistantHandoff: ["Messaging Justin", "Sent to Justin"],
};

const call = async (args) => (await base44.functions.invoke("portal-assistant", args)).data;
const readPref = () => { try { return localStorage.getItem(READ_KEY) === "1"; } catch { return false; } };
const writePref = (on) => { try { localStorage.setItem(READ_KEY, on ? "1" : "0"); } catch { /* storage blocked */ } };
const textOf = (c) => (typeof c === "string" ? c : c && typeof c === "object" ? String(c.text || c.content || "") : "");
const isRunning = (t) => ["pending", "running", "in_progress"].includes(String(t?.status));
const isFailed = (t) => {
  if (["failed", "error"].includes(String(t?.status))) return true;
  try { const r = typeof t?.results === "string" ? JSON.parse(t.results) : t?.results; return r && r.ok === false && !r.preview; } catch { return false; }
};
const listOf = (r) => (Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : []);

// ---------------- Conversation ----------------
function useConversation(previewId) {
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let off = false;
    (async () => {
      setLoading(true);
      try {
        const all = listOf(await base44.agents.listConversations({ q: { agent_name: AGENT }, sort: "-updated_date", limit: 20 }));
        const mine = all.find((c) => c.agent_name === AGENT && (c.metadata?.preview_client_id || null) === (previewId || null));
        if (mine && !off) {
          const full = await base44.agents.getConversation(mine.id);
          if (!off) { setConv(full); setMessages(full?.messages || []); }
        }
      } catch { /* start fresh */ }
      if (!off) setLoading(false);
    })();
    return () => { off = true; };
  }, [previewId]);

  useEffect(() => {
    if (!conv?.id) return undefined;
    const unsub = base44.agents.subscribeToConversation(conv.id, (data) => setMessages(data?.messages || []));
    return () => unsub && unsub();
  }, [conv?.id]);

  const send = useCallback(async (text) => {
    const content = String(text || "").trim();
    if (!content || sending) return false;
    setSending(true); setError("");
    const optimistic = { id: `local-${Date.now()}`, role: "user", content, local: true };
    setMessages((m) => [...m, optimistic]);
    try {
      let c = conv;
      if (!c) {
        c = await base44.agents.createConversation({
          agent_name: AGENT,
          metadata: { name: "Interstellar Assistant", source: "client_portal", ...(previewId ? { preview_client_id: previewId } : {}) },
        });
        setConv(c);
      }
      await base44.agents.addMessage(c, { role: "user", content });
      return true;
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setError(e?.response?.data?.message || e?.response?.data?.error || "The assistant couldn't be reached. Try again in a moment.");
      return false;
    } finally { setSending(false); }
  }, [conv, previewId, sending]);

  const reset = useCallback(() => { stopReading(); setConv(null); setMessages([]); setError(""); }, []);

  // Hide platform/system and hidden messages; drop the optimistic copy once the server has it.
  const shown = useMemo(() => {
    const real = messages.filter((m) => !m.local);
    const hasUser = (t) => real.some((m) => m.role === "user" && textOf(m.content) === t);
    return messages.filter((m) => !m.hidden && (m.role === "user" || m.role === "assistant") && !(m.local && hasUser(m.content)));
  }, [messages]);

  const last = shown[shown.length - 1];
  const thinking = sending || (last && (last.role === "user" || (last.role === "assistant" && (!textOf(last.content) || (last.tool_calls || []).some(isRunning)))));
  return { messages: shown, loading, thinking: !!thinking, error, send, reset, clearError: () => setError("") };
}

// ---------------- Briefing card ----------------
function BriefingCard({ previewId, onAsk }) {
  const qc = useQueryClient();
  const day = new Date().toISOString().slice(0, 10);
  const key = ["portal-assistant", previewId || "me", "briefing", day];
  const q = useQuery({ queryKey: key, queryFn: () => call({ action: "briefing_card", client_id: previewId }), staleTime: 6 * 3600 * 1000, retry: 1 });
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const c = q.data?.card;
  const refresh = async () => {
    setBusy(true);
    try { qc.setQueryData(key, await call({ action: "briefing_card", client_id: previewId, refresh: true })); } catch { /* keep the old card */ }
    setBusy(false);
  };
  const s = c?.stats || {};
  const stats = [
    s.work_done_30d != null && [s.work_done_30d, "Pieces of work, 30 days"],
    s.seo_fixes_30d ? [s.seo_fixes_30d, "SEO fixes, 30 days"] : null,
    s.site_health != null && [s.site_health, "Site health"],
    s.google_rating != null && [`${Number(s.google_rating).toFixed(1)}★`, s.google_reviews != null ? `${s.google_reviews} Google reviews` : "Google rating"],
    s.qr_scans_30d ? [s.qr_scans_30d, "QR scans, 30 days"] : null,
    s.open_requests ? [s.open_requests, "Open requests"] : null,
  ].filter(Boolean).slice(0, 4);

  return (
    <section className="overflow-hidden rounded-md border border-hair bg-card">
      <div className="h-[3px] flame-bg" />
      <header className="flex items-center gap-3 px-4 py-3">
        <span className="mono-label text-[9.5px] text-[#ff3c00]">Today&apos;s briefing</span>
        {previewId && c && (
          <button type="button" onClick={refresh} disabled={busy} title="Regenerate (admin preview)" className="ml-auto text-ink/40 hover:text-[#ff3c00] disabled:opacity-40">
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          </button>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} className={`${previewId && c ? "" : "ml-auto"} text-ink/40 hover:text-ink`} aria-label={open ? "Collapse briefing" : "Expand briefing"}>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </header>
      {open && (
        <div className="px-4 pb-4">
          {q.isLoading ? (
            <div className="space-y-2" aria-label="Loading briefing">
              <div className="h-5 w-3/4 animate-pulse bg-ink/[0.07]" />
              <div className="h-3.5 w-full animate-pulse bg-ink/[0.05]" />
              <div className="h-3.5 w-5/6 animate-pulse bg-ink/[0.05]" />
            </div>
          ) : !c ? (
            <p className="text-[12.5px] text-ink/55">Your briefing isn&apos;t available right now. Ask me what we did this month instead.</p>
          ) : (
            <>
              <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.03em]">{c.headline}</h3>
              {c.summary && <p className="mt-1.5 text-[13px] leading-relaxed text-ink/70">{c.summary}</p>}
              {stats.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden border border-hair bg-hair sm:grid-cols-4">
                  {stats.map(([v, l]) => (
                    <div key={l} className="bg-card px-3 py-2.5">
                      <p className="text-[20px] font-semibold leading-none tabular-nums tracking-[-0.04em]">{v}</p>
                      <p className="mt-1.5 text-[10.5px] leading-tight text-ink/50">{l}</p>
                    </div>
                  ))}
                </div>
              )}
              {(c.highlights || []).length > 0 && (
                <ul className="mt-3 space-y-1">
                  {c.highlights.map((h) => <li key={h} className="flex gap-2 text-[12.5px] text-ink/75"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff3c00]" />{h}</li>)}
                </ul>
              )}
              {(c.next_up || []).length > 0 && (
                <div className="mt-3">
                  <p className="mono-label text-[9px] text-ink/45">Next up</p>
                  <ul className="mt-1 space-y-1">{c.next_up.map((h) => <li key={h} className="text-[12.5px] text-ink/70">→ {h}</li>)}</ul>
                </div>
              )}
              {(c.waiting_on_you || []).length > 0 && (
                <div className="mt-3 border-l-2 border-[#ff6a00] bg-[#ff6a00]/[0.06] px-3 py-2">
                  <p className="mono-label text-[9px] text-[#ff3c00]">Waiting on you</p>
                  <ul className="mt-1 space-y-0.5">{c.waiting_on_you.map((h) => <li key={h} className="text-[12.5px] text-ink/75">{h}</li>)}</ul>
                </div>
              )}
              <button type="button" onClick={() => onAsk("Walk me through what you did for me this month.")} className="mt-3 text-[12px] font-medium text-[#ff3c00] hover:underline">
                Walk me through it →
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------- Messages ----------------
const mdComponents = {
  a: ({ node: _n, ...p }) => <a {...p} target="_blank" rel="noreferrer" className="font-medium text-[#ff3c00] underline underline-offset-2" />,
  p: ({ node: _n, ...p }) => <p {...p} className="my-1.5 first:mt-0 last:mb-0" />,
  ul: ({ node: _n, ...p }) => <ul {...p} className="my-1.5 list-disc space-y-0.5 pl-5" />,
  ol: ({ node: _n, ...p }) => <ol {...p} className="my-1.5 list-decimal space-y-0.5 pl-5" />,
  h1: ({ node: _n, ...p }) => <p {...p} className="mb-1 mt-2 font-semibold" />,
  h2: ({ node: _n, ...p }) => <p {...p} className="mb-1 mt-2 font-semibold" />,
  h3: ({ node: _n, ...p }) => <p {...p} className="mb-1 mt-2 font-semibold" />,
  code: ({ node: _n, ...p }) => <code {...p} className="bg-ink/[0.06] px-1 font-mono text-[12px]" />,
};

function ToolPill({ t }) {
  const [active, done] = TOOL_LABELS[t.name] || ["Working on it", "Done"];
  const running = isRunning(t);
  const failed = !running && isFailed(t);
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] ${failed ? "border-red-200 text-red-700" : "border-hair text-ink/55"}`}>
      {running ? <Loader2 className="h-3 w-3 animate-spin text-[#ff3c00]" /> : failed ? <AlertCircle className="h-3 w-3" /> : <Check className="h-3 w-3 text-[#ff3c00]" />}
      {running ? `${active}…` : failed ? "Couldn't finish that step" : done}
    </span>
  );
}

function Bubble({ m, speakingId, onSpeak }) {
  const text = textOf(m.content);
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap bg-ink px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white">{text}</p>
      </div>
    );
  }
  const tools = (m.tool_calls || []).filter((t) => t?.name);
  if (!text && !tools.length) return null;
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 shrink-0"><Martian palette={KING.palette} king size={26} title="Interstellar Assistant" /></div>
      <div className="min-w-0 max-w-[88%]">
        {tools.length > 0 && <div className="mb-1.5 flex flex-wrap gap-1.5">{tools.map((t, i) => <ToolPill key={t.id || i} t={t} />)}</div>}
        {text && (
          <div className="border border-hair bg-card px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink/85 [overflow-wrap:anywhere]">
            <ReactMarkdown components={mdComponents}>{text}</ReactMarkdown>
          </div>
        )}
        {text && (
          <button type="button" onClick={() => onSpeak(m)} className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink/40 hover:text-[#ff3c00]" aria-label={speakingId === m.id ? "Stop reading" : "Read aloud"}>
            {speakingId === m.id ? <><Square className="h-3 w-3" /> Stop</> : <><Volume2 className="h-3 w-3" /> Listen</>}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------- Panel ----------------
export default function PortalAssistant({ previewId, variant = "page", onClose, onExpand }) {
  const ctxQ = useQuery({ queryKey: ["portal-assistant", previewId || "me", "context"], queryFn: () => call({ action: "context", client_id: previewId }), staleTime: 3600 * 1000, retry: false });
  const serverVoice = !!ctxQ.data?.voice;
  const { messages, loading, thinking, error, send, reset, clearError } = useConversation(previewId);
  const [input, setInput] = useState("");
  const [autoRead, setAutoRead] = useState(readPref);
  const [speakingId, setSpeakingId] = useState(null);
  const scroller = useRef(null);
  const box = useRef(null);
  const spoken = useRef(new Set());
  const primed = useRef(false);

  const dict = useDictation({
    previewId, serverVoice,
    onText: (t) => { setInput((v) => (v ? `${v.trimEnd()} ${t}` : t)); setTimeout(() => box.current?.focus(), 0); },
  });

  const submit = async (text) => {
    const t = String(text ?? input).trim();
    if (!t || thinking) return;
    stopReading(); setSpeakingId(null);
    setInput("");
    const ok = await send(t);
    if (!ok) setInput(t);
  };

  const speakMsg = (m) => {
    if (speakingId === m.id) { stopReading(); setSpeakingId(null); return; }
    setSpeakingId(m.id);
    readAloud(textOf(m.content), { previewId, serverVoice, onEnd: () => setSpeakingId((id) => (id === m.id ? null : id)) });
  };

  // Scroll to the newest message.
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [messages, thinking]);

  // Messages already present when the panel opens are never auto-read.
  useEffect(() => {
    if (loading || primed.current) return;
    primed.current = true;
    messages.forEach((m) => spoken.current.add(m.id));
  }, [loading, messages]);

  // Auto read-aloud: once the newest reply has settled.
  useEffect(() => {
    if (!autoRead || thinking || !primed.current) return undefined;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || !textOf(last.content) || spoken.current.has(last.id)) return undefined;
    const t = setTimeout(() => { spoken.current.add(last.id); speakMsg(last); }, 900);
    return () => clearTimeout(t);
  }, [messages, thinking, autoRead]);

  useEffect(() => () => stopReading(), []);

  // Auto-grow the input.
  useEffect(() => { const el = box.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.min(160, el.scrollHeight)}px`; }, [input]);

  const toggleRead = () => { const on = !autoRead; setAutoRead(on); writePref(on); if (!on) { stopReading(); setSpeakingId(null); } };
  const empty = !loading && messages.length === 0;
  const recording = dict.state === "recording";
  const page = variant === "page";

  return (
    <div className={`flex min-h-0 flex-col bg-canvas ${page ? "h-[calc(100dvh-140px)] min-h-[520px] overflow-hidden rounded-md border border-hair" : "h-full"}`}>
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-hair bg-card px-4 py-3">
        <Martian palette={KING.palette} king size={34} active={thinking} title="Interstellar Assistant" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-semibold tracking-[-0.02em]">Interstellar Assistant</p>
          <p className="truncate text-[11px] text-ink/50">{previewId ? "Admin preview · acting as this client" : "The Future of Business · replies in seconds"}</p>
        </div>
        <button type="button" onClick={toggleRead} title={autoRead ? "Read replies aloud: on" : "Read replies aloud: off"} aria-pressed={autoRead} className={`p-1.5 ${autoRead ? "text-[#ff3c00]" : "text-ink/40 hover:text-ink"}`}>
          {autoRead ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <button type="button" onClick={reset} title="New chat" className="p-1.5 text-ink/40 hover:text-ink"><Plus className="h-4 w-4" /></button>
        {onExpand && <button type="button" onClick={onExpand} title="Open full view" className="hidden p-1.5 text-ink/40 hover:text-ink sm:block"><Maximize2 className="h-4 w-4" /></button>}
        {onClose && <button type="button" onClick={onClose} title="Close" className="p-1.5 text-ink/40 hover:text-ink"><X className="h-4 w-4" /></button>}
      </header>

      {/* Thread */}
      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <BriefingCard previewId={previewId} onAsk={submit} />
        {loading ? (
          <p className="py-6 text-center text-[12.5px] text-ink/45">Loading your conversation…</p>
        ) : empty ? (
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 shrink-0"><Martian palette={KING.palette} king size={26} /></div>
            <div className="border border-hair bg-card px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink/85">
              Hi{ctxQ.data?.first_name && !previewId ? ` ${ctxQ.data.first_name}` : ""}, I&apos;m your Interstellar Assistant. I can recap what we&apos;ve done for {ctxQ.data?.business || "you"}, send a request to the team, check on your requests, or get Justin for you.
            </div>
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} speakingId={speakingId} onSpeak={speakMsg} />)
        )}
        {thinking && !loading && (messages[messages.length - 1]?.role === "user" || messages.length === 0) && (
          <div className="flex items-center gap-2 pl-9 text-[12px] text-ink/45"><Loader2 className="h-3.5 w-3.5 animate-spin text-[#ff3c00]" /> Thinking…</div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-hair bg-card px-3 pb-3 pt-2.5">
        {empty && (
          <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
            {CHIPS.map((c) => (
              <button key={c} type="button" onClick={() => submit(c)} disabled={thinking} className="shrink-0 border border-hair bg-canvas px-2.5 py-1.5 text-[12px] text-ink/75 hover:border-[#ff3c00] hover:text-[#ff3c00] disabled:opacity-40">{c}</button>
            ))}
          </div>
        )}
        {(error || dict.error) && (
          <div className="mb-2 flex items-start gap-2 border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="flex-1">{error || dict.error}</span>
            <button type="button" onClick={() => { clearError(); dict.clearError(); }} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {recording && (
          <div className="mb-2 flex items-center gap-2 border border-[#ff3c00]/30 bg-[#ff3c00]/[0.05] px-3 py-2 text-[12px] text-ink/70">
            <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff3c00] opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ff3c00]" /></span>
            <span className="flex-1 truncate">{dict.interim || "Listening… take your time, I'll keep recording through pauses."}</span>
            <span className="h-1.5 w-16 overflow-hidden bg-ink/[0.08]"><span className="block h-full flame-bg transition-[width] duration-75" style={{ width: `${Math.round(dict.level * 100)}%` }} /></span>
            <button type="button" onClick={dict.cancel} className="text-ink/45 hover:text-ink" aria-label="Cancel recording"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {dict.state === "transcribing" && <p className="mb-2 flex items-center gap-2 text-[12px] text-ink/55"><Loader2 className="h-3.5 w-3.5 animate-spin text-[#ff3c00]" /> Turning your voice into text…</p>}
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex items-end gap-2">
          <textarea
            ref={box}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder={recording ? "Recording… press stop when you're done" : "Ask anything or tell me what you need…"}
            aria-label="Message the Interstellar Assistant"
            className="min-h-[42px] flex-1 resize-none border border-hair bg-canvas px-3 py-2.5 text-[13.5px] leading-snug outline-none focus:border-[#ff3c00]"
          />
          {voiceInputSupported() && (
            <button
              type="button"
              onClick={recording ? dict.stop : dict.start}
              disabled={dict.state === "transcribing"}
              title={recording ? "Stop and transcribe" : "Dictate"}
              aria-label={recording ? "Stop recording" : "Start dictation"}
              className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center border ${recording ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-hair bg-canvas text-ink/60 hover:border-[#ff3c00] hover:text-[#ff3c00]"} disabled:opacity-40`}
            >
              {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <button type="submit" disabled={!input.trim() || thinking} aria-label="Send" className="flex h-[42px] w-[42px] shrink-0 items-center justify-center flame-bg text-white disabled:opacity-35">
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-1.5 text-[10.5px] text-ink/40">The assistant can make mistakes. Anything it sends goes to Justin&apos;s team for review.</p>
      </div>
    </div>
  );
}

// Floating launcher + slide-over drawer (shown on every portal tab except the full Assistant tab).
export function AssistantLauncher({ previewId, onOpenFull }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open the Interstellar Assistant"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-ink py-1.5 pl-1.5 pr-4 text-white shadow-[0_10px_30px_-8px_rgba(255,60,0,.55)] transition-transform hover:-translate-y-0.5"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full flame-bg"><Martian palette={KING.palette} king size={26} /></span>
          <span className="text-[13px] font-medium">Ask Interstellar</span>
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" aria-label="Close assistant" className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
          <div role="dialog" aria-modal="true" aria-label="Interstellar Assistant" className="page-enter relative flex h-full w-full max-w-[440px] flex-col border-l border-hair bg-canvas shadow-2xl">
            <PortalAssistant previewId={previewId} variant="drawer" onClose={() => setOpen(false)} onExpand={onOpenFull ? () => { setOpen(false); onOpenFull(); } : undefined} />
          </div>
        </div>
      )}
    </>
  );
}
