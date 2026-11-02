import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp, Camera, CameraOff, Loader2, Mic, Settings2, Square, Volume2, VolumeX, X } from "lucide-react";
import AssistantCore from "@/features/tasks/assistant/AssistantCore";
import WebcamOrb from "@/features/tasks/assistant/WebcamOrb";
import { AssistantProvider, useAssistant } from "@/features/tasks/assistant/AssistantContext";
import { DEFAULT_VOICE_SETTINGS, femaleVoices, readVoiceSettings, speak, stopSpeaking, synthesisSupported, warmVoices, writeVoiceSettings } from "@/features/tasks/lib/speech";
import { cn } from "@/lib/utils";

// Keyframes used by the dock (scoped tk-* names so nothing leaks into index.css).
const DOCK_CSS = `
@keyframes tk-spin { to { transform: rotate(360deg); } }
.tk-spin-slow { animation: tk-spin 28s linear infinite; }
@keyframes tk-dash { to { stroke-dashoffset: -40; } }
.tk-dash-flow { stroke-dasharray: 4 6; animation: tk-dash 3.2s linear infinite; }
@keyframes tk-breathe { 0%,100% { opacity: .25; } 50% { opacity: .95; } }
.tk-breathe { animation: tk-breathe 3.6s ease-in-out infinite; }
@keyframes tk-pulse { 0%,100% { opacity: .45; transform: scale(1); } 50% { opacity: 1; transform: scale(1.06); } }
.tk-pulse { animation: tk-pulse 2.4s ease-in-out infinite; }
@keyframes tk-wave { 0%,100% { transform: scaleY(.35); } 50% { transform: scaleY(1); } }
@keyframes tk-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.tk-rise { animation: tk-rise .4s cubic-bezier(.22,1,.36,1) both; }
`;

const BAR_SHAPE = [0.35, 0.55, 0.8, 1, 0.9, 0.7, 1, 0.85, 0.6, 0.45, 0.75, 0.5, 0.3];

// Live mic level while recording; a gentle animated wave while the core speaks.
function LevelMeter({ level, recording, speaking }) {
  return (
    <div className="flex h-6 items-center gap-[3px]" aria-hidden>
      {BAR_SHAPE.map((shape, i) => {
        const h = recording ? Math.max(3, Math.round(24 * Math.min(1, level * shape * 1.4 + 0.06))) : speaking ? 18 : 4;
        return (
          <span
            key={i}
            className={cn("w-[3px] rounded-full", recording ? "bg-[#ff3c00]" : speaking ? "bg-[#ff6a00]" : "bg-[#f5f3f0]/20")}
            style={{
              height: h,
              animation: speaking ? "tk-wave 900ms ease-in-out infinite" : undefined,
              animationDelay: i * 70 + "ms",
              transition: "height 80ms linear"
            }}
          />
        );
      })}
    </div>
  );
}

const SERVER_VOICES = [
  ["nova", "Nova — warm, confident"],
  ["shimmer", "Shimmer — soft, clear"],
  ["sage", "Sage — calm, measured"],
  ["coral", "Coral — bright, assured"]
];

function VoiceSettings({ voiceServer, onClose }) {
  const [s, setS] = useState(readVoiceSettings);
  const [voices, setVoices] = useState([]);
  const [testing, setTesting] = useState(false);

  useEffect(() => warmVoices(() => setVoices(femaleVoices())), []);

  const update = (patch) => {
    const next = { ...s, ...patch };
    setS(next);
    writeVoiceSettings(next);
  };

  const test = () => {
    setTesting(true);
    speak("Good morning, Justin. Three tasks are due today, and the Palm Shore build is ready for your review.", { onEnd: () => setTesting(false) }, { ...s, muted: false });
  };

  const field = "w-full rounded-md border border-[#f5f3f0]/15 bg-black/30 px-2 py-1.5 text-[11.5px] text-[#f5f3f0] focus:border-[#ff6a00] focus:outline-none";
  const usingServer = voiceServer && s.engine !== "browser";

  return (
    <div className="space-y-3 border-t border-[#f5f3f0]/10 px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="mono-label text-[9px] text-[#f5f3f0]/60">Core voice</p>
        <button type="button" onClick={onClose} className="mono-label text-[9px] text-[#f5f3f0]/40 hover:text-[#f5f3f0]">
          done
        </button>
      </div>

      <label className="block">
        <span className="mono-label text-[8.5px] text-[#f5f3f0]/40">Engine</span>
        <select className={field} value={s.engine} onChange={(e) => update({ engine: e.target.value })}>
          <option value="auto">Auto (natural voice when available)</option>
          <option value="openai">Natural voice (OpenAI)</option>
          <option value="browser">Browser voice</option>
        </select>
      </label>
      {!voiceServer ? (
        <p className="text-[10.5px] leading-relaxed text-[#ffaa00]/80">
          Natural voice and Whisper transcription are off. Add an OPENAI_API_KEY secret in Base44 to turn them on. Using the best browser voice for now.
        </p>
      ) : null}

      {usingServer ? (
        <div className="grid grid-cols-[1fr_96px] gap-2">
          <label className="block">
            <span className="mono-label text-[8.5px] text-[#f5f3f0]/40">Voice</span>
            <select className={field} value={s.serverVoice} onChange={(e) => update({ serverVoice: e.target.value })}>
              {SERVER_VOICES.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mono-label text-[8.5px] text-[#f5f3f0]/40">Speed {Number(s.serverSpeed).toFixed(2)}</span>
            <input type="range" min="0.8" max="1.1" step="0.02" value={s.serverSpeed} onChange={(e) => update({ serverSpeed: Number(e.target.value) })} className="mt-2 w-full accent-[#ff3c00]" />
          </label>
        </div>
      ) : (
        <>
          <label className="block">
            <span className="mono-label text-[8.5px] text-[#f5f3f0]/40">Browser voice</span>
            <select className={field} value={s.browserVoice} onChange={(e) => update({ browserVoice: e.target.value })} disabled={!synthesisSupported()}>
              <option value="">Best available{voices[0] ? ` (${voices[0].name})` : ""}</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} · {v.lang}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mono-label text-[8.5px] text-[#f5f3f0]/40">Rate {Number(s.rate).toFixed(2)}</span>
              <input type="range" min="0.75" max="1.15" step="0.01" value={s.rate} onChange={(e) => update({ rate: Number(e.target.value) })} className="mt-2 w-full accent-[#ff3c00]" />
            </label>
            <label className="block">
              <span className="mono-label text-[8.5px] text-[#f5f3f0]/40">Pitch {Number(s.pitch).toFixed(2)}</span>
              <input type="range" min="0.8" max="1.2" step="0.01" value={s.pitch} onChange={(e) => update({ pitch: Number(e.target.value) })} className="mt-2 w-full accent-[#ff3c00]" />
            </label>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={testing ? () => { stopSpeaking(); setTesting(false); } : test}
          className="flex items-center gap-1.5 rounded-md bg-[#ff3c00] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#ff6a00]"
        >
          {testing ? <Square className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
          {testing ? "Stop" : "Test voice"}
        </button>
        <button
          type="button"
          onClick={() => update({ muted: !s.muted })}
          className={cn("flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px]", s.muted ? "border-[#ffaa00]/60 text-[#ffaa00]" : "border-[#f5f3f0]/15 text-[#f5f3f0]/60")}
        >
          {s.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
          {s.muted ? "Replies muted" : "Speak replies"}
        </button>
        <button type="button" onClick={() => { setS({ ...DEFAULT_VOICE_SETTINGS }); writeVoiceSettings({ ...DEFAULT_VOICE_SETTINGS }); }} className="mono-label text-[8.5px] text-[#f5f3f0]/40 hover:text-[#f5f3f0]">
          reset
        </button>
      </div>
    </div>
  );
}

function DockPanel() {
  const {
    open,
    setOpen,
    mode,
    capturing,
    turns,
    notice,
    alwaysOn,
    supported,
    voiceServer,
    level,
    dictating,
    speaking,
    webcamStream,
    webcamOn,
    toggleWebcam,
    startListening,
    stopListening,
    finishDictation,
    cancelDictation,
    toggleAlwaysOn,
    interrupt,
    draft,
    setDraft,
    sendDraft,
    clear
  } = useAssistant();
  const [showSettings, setShowSettings] = useState(false);
  const feedRef = useRef(null);
  const boxRef = useRef(null);
  const transcribing = mode === "transcribing";
  const processing = mode === "processing";

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [turns.length, notice]);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [capturing]);

  if (!open) {
    return (
      <>
        <style>{DOCK_CSS}</style>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group fixed bottom-6 right-5 z-40 flex items-center gap-3 rounded-md border border-ink bg-ink px-4 py-3 text-[#f5f3f0] transition-colors duration-300 hover:bg-[#ff3c00] hover:border-[#ff3c00] sm:right-8"
        >
          <span className="relative grid h-6 w-6 place-items-center">
            <span className="tk-pulse absolute inset-0 rounded-full border border-[#ff3c00]/70 group-hover:border-white/70" />
            <span className="h-2 w-2 rounded-full bg-[#ff3c00] group-hover:bg-white" />
          </span>
          <span className="mono-label text-[10px]">Command</span>
        </button>
      </>
    );
  }

  const hint = alwaysOn
    ? "hands free · wake word: interstellar"
    : dictating
      ? "recording · pauses are fine · tap stop when done"
      : transcribing
        ? voiceServer ? "transcribing with whisper" : "finishing"
        : supported
          ? "tap talk · review · then send"
          : "type below";

  return (
    <section className="fixed bottom-4 right-3 z-40 w-[min(94vw,432px)] sm:bottom-6 sm:right-6">
      <style>{DOCK_CSS}</style>
      <div className="tk-rise band-dark overflow-hidden rounded-md border border-ink">
        <span className="pointer-events-none absolute left-0 top-0 h-[2px] w-full flame-bg" />
        <div className="flex items-center justify-between border-b border-[#f5f3f0]/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={cn("h-1.5 w-1.5 rounded-full", voiceServer ? "bg-[#ffaa00]" : "bg-[#f5f3f0]/30")} title={voiceServer ? "Whisper + natural voice on" : "Browser speech"} />
            <p className="mono-label text-[9.5px] text-[#f5f3f0]/70">Interstellar Voice Core</p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={clear} className="mono-label px-2 py-1 text-[9px] text-[#f5f3f0]/40 transition-colors hover:text-[#f5f3f0]">
              clear
            </button>
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className={cn("rounded-md p-1.5 transition-colors", showSettings ? "text-[#ffaa00]" : "text-[#f5f3f0]/50 hover:text-[#f5f3f0]")}
              aria-label="Voice settings"
              title="Voice settings"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (dictating) cancelDictation();
                stopListening();
                setOpen(false);
              }}
              className="rounded-md p-1.5 text-[#f5f3f0]/50 transition-colors hover:text-[#f5f3f0]"
              aria-label="Close voice dock"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 px-4 py-4">
          <div className="relative">
            <AssistantCore state={transcribing ? "processing" : mode} size={112} />
            <WebcamOrb stream={webcamStream} size={112} />
          </div>
          <div className="min-w-0 flex-1">
            <LevelMeter level={level} recording={dictating} speaking={speaking} />
            <p className="mono-label mt-2 text-[8.5px] text-[#f5f3f0]/40">{hint}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {dictating ? (
                <button
                  type="button"
                  onClick={finishDictation}
                  className="flex items-center gap-2 rounded-md border border-red-500/50 bg-red-500/15 px-3 py-2 text-[11.5px] font-medium text-red-300"
                >
                  <Square className="h-3 w-3 fill-current" />
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startListening}
                  disabled={transcribing || processing || alwaysOn}
                  className="flex items-center gap-2 rounded-md bg-[#ff3c00] px-3 py-2 text-[11.5px] font-medium text-white transition-colors hover:bg-[#ff6a00] disabled:opacity-40"
                >
                  {transcribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
                  {transcribing ? "Transcribing" : "Talk"}
                </button>
              )}
              {speaking ? (
                <button
                  type="button"
                  onClick={interrupt}
                  className="flex items-center gap-2 rounded-md border border-[#ffaa00]/60 bg-[#ffaa00]/15 px-3 py-2 text-[11.5px] font-medium text-[#ffaa00]"
                >
                  <VolumeX className="h-3.5 w-3.5" />
                  Stop voice
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => toggleAlwaysOn(!alwaysOn)}
                disabled={dictating}
                className={cn(
                  "rounded-md border px-3 py-2 text-[11.5px] transition-colors disabled:opacity-40",
                  alwaysOn ? "border-[#ffaa00]/60 bg-[#ffaa00]/15 text-[#ffaa00]" : "border-[#f5f3f0]/15 text-[#f5f3f0]/60 hover:text-[#f5f3f0]"
                )}
                title="Wake word mode: say Interstellar, then a command (sends on its own)"
              >
                {alwaysOn ? "Hands free on" : "Hands free"}
              </button>
              <button
                type="button"
                onClick={toggleWebcam}
                className={cn(
                  "rounded-md border px-3 py-2 text-[11.5px] transition-colors",
                  webcamOn ? "border-[#ffaa00]/60 bg-[#ffaa00]/15 text-[#ffaa00]" : "border-[#f5f3f0]/15 text-[#f5f3f0]/60 hover:text-[#f5f3f0]"
                )}
                title={webcamOn ? "Turn camera off" : "Connect your camera to the core"}
              >
                {webcamOn ? <CameraOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {showSettings ? <VoiceSettings voiceServer={voiceServer} onClose={() => setShowSettings(false)} /> : null}

        <div ref={feedRef} className="no-scrollbar max-h-[170px] overflow-y-auto border-t border-[#f5f3f0]/10 px-4 py-3">
          {turns.length === 0 ? (
            <p className="text-[11.5px] leading-relaxed text-[#f5f3f0]/40">
              Try: &quot;Add a website build for Meridian, forty five hundred dollars, due in three weeks.&quot;
            </p>
          ) : null}
          {turns.map((turn) => (
            <p key={turn.at + turn.role} className={cn("mb-2 text-[11.5px] leading-relaxed", turn.role === "you" ? "text-[#f5f3f0]/55" : "text-[#f5f3f0]")}>
              <span className="mono-label mr-2 text-[8.5px] text-[#ff6a00]">{turn.role === "you" ? "you" : "core"}</span>
              {turn.text}
            </p>
          ))}
        </div>

        {notice ? (
          <div className="border-t border-[#f5f3f0]/10 px-4 py-2.5">
            <p className="text-[11px] leading-relaxed text-[#ffaa00]">{notice}</p>
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendDraft();
          }}
          className="border-t border-[#f5f3f0]/10 bg-black/25 px-3 py-3"
        >
          <textarea
            ref={boxRef}
            value={dictating ? capturing : draft}
            readOnly={dictating || transcribing}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                sendDraft();
              }
            }}
            rows={3}
            placeholder={dictating ? "Listening..." : processing ? "Core is working..." : "Your words land here to review. Or type a command."}
            className={cn(
              "no-scrollbar max-h-40 min-h-[64px] w-full resize-y bg-transparent text-[12.5px] leading-relaxed text-[#f5f3f0] placeholder:text-[#f5f3f0]/30 focus:outline-none",
              dictating && "italic text-[#ffaa00]"
            )}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="mono-label text-[8.5px] text-[#f5f3f0]/30">{dictating ? "edit after you stop" : "ctrl/⌘ + enter to send"}</span>
            <div className="flex items-center gap-2">
              {draft && !dictating ? (
                <button type="button" onClick={() => setDraft("")} className="mono-label px-2 text-[9px] text-[#f5f3f0]/40 hover:text-[#f5f3f0]">
                  discard
                </button>
              ) : null}
              <button
                type="submit"
                disabled={!draft.trim() || dictating || transcribing || processing}
                className="flex h-8 items-center gap-1.5 rounded-md bg-[#ff3c00] px-3 text-[11.5px] font-medium text-white transition-colors hover:bg-[#ff6a00] disabled:opacity-40"
                aria-label="Send command"
              >
                {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
                Send
              </button>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-between border-t border-[#f5f3f0]/10 px-4 py-2">
          <span className="mono-label text-[8.5px] text-[#f5f3f0]/35">Nothing is filed without your say</span>
          <Link to="/tasks/inbox" className="mono-label text-[8.5px] text-[#ff6a00] hover:text-[#ffaa00]">
            open inbox
          </Link>
        </div>
      </div>
    </section>
  );
}

// Self-sufficient: uses an AssistantProvider above it when one exists, otherwise brings its own.
// Mount once (TaskBoard today; can be moved into the global Layout later).
export default function AssistantDock() {
  const ctx = useAssistant();
  if (ctx) return <DockPanel />;
  return (
    <AssistantProvider>
      <DockPanel />
    </AssistantProvider>
  );
}
