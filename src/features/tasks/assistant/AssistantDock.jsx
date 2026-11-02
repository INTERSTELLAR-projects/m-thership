import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp, Camera, CameraOff, Loader2, Mic, MicOff, Sparkles, X } from "lucide-react";
import AssistantCore from "@/features/tasks/assistant/AssistantCore";
import WebcamOrb from "@/features/tasks/assistant/WebcamOrb";
import { AssistantProvider, useAssistant } from "@/features/tasks/assistant/AssistantContext";
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

function WaveBars({ active }) {
  return (
    <div className="flex h-4 items-end gap-[3px]">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((bar) => (
        <span
          key={bar}
          className={cn("w-[2px] origin-bottom rounded-full", active ? "bg-[#ff3c00]" : "bg-[#f5f3f0]/20")}
          style={{
            height: active ? 16 : 4,
            animation: active ? "tk-wave 900ms ease-in-out infinite" : undefined,
            animationDelay: bar * 90 + "ms",
            transition: "height 300ms ease"
          }}
        />
      ))}
    </div>
  );
}

function DockPanel() {
  const {
    open,
    setOpen,
    mode,
    interim,
    capturing,
    turns,
    notice,
    alwaysOn,
    supported,
    busy,
    webcamStream,
    webcamOn,
    toggleWebcam,
    startListening,
    stopListening,
    sendNow,
    toggleAlwaysOn,
    runCommand,
    clear
  } = useAssistant();
  const [draft, setDraft] = useState("");
  const feedRef = useRef(null);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [turns.length, interim, notice]);

  if (!open) {
    return (
      <>
        <style>{DOCK_CSS}</style>
        <button
          type="button"
          onClick={startListening}
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

  return (
    <section className="fixed bottom-4 right-3 z-40 w-[min(94vw,412px)] sm:bottom-6 sm:right-6">
      <style>{DOCK_CSS}</style>
      <div className="tk-rise band-dark overflow-hidden rounded-md border border-ink">
        <span className="pointer-events-none absolute left-0 top-0 h-[2px] w-full flame-bg" />
        <div className="flex items-center justify-between border-b border-[#f5f3f0]/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#ff3c00]" />
            <p className="mono-label text-[9.5px] text-[#f5f3f0]/70">Interstellar Voice Core</p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={clear} className="mono-label px-2 py-1 text-[9px] text-[#f5f3f0]/40 transition-colors hover:text-[#f5f3f0]">
              clear
            </button>
            <button
              type="button"
              onClick={() => {
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
            <AssistantCore state={mode} size={124} />
            <WebcamOrb stream={webcamStream} size={124} />
          </div>
          <div className="min-w-0 flex-1">
            <WaveBars active={mode === "listening" || mode === "speaking"} />
            <p className="mono-label mt-3 text-[8.5px] text-[#f5f3f0]/40">
              {alwaysOn
                ? "hands free · wake word: interstellar"
                : mode === "listening"
                  ? "keep talking · sends when you pause"
                  : supported
                    ? "press the mic to talk"
                    : "chrome only"}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {mode === "listening" ? (
                <button
                  type="button"
                  onClick={stopListening}
                  className="flex items-center gap-2 rounded-md border border-red-500/50 bg-red-500/15 px-3 py-2 text-[11.5px] font-medium text-red-300"
                >
                  <MicOff className="h-3.5 w-3.5" />
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startListening}
                  className="flex items-center gap-2 rounded-md bg-[#ff3c00] px-3 py-2 text-[11.5px] font-medium text-white transition-colors hover:bg-[#ff6a00]"
                >
                  <Mic className="h-3.5 w-3.5" />
                  Talk
                </button>
              )}
              {mode === "listening" && capturing ? (
                <button
                  type="button"
                  onClick={sendNow}
                  className="flex items-center gap-2 rounded-md border border-[#ffaa00]/60 bg-[#ffaa00]/15 px-3 py-2 text-[11.5px] font-medium text-[#ffaa00]"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                  Send now
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => toggleAlwaysOn(!alwaysOn)}
                className={cn(
                  "rounded-md border px-3 py-2 text-[11.5px] transition-colors",
                  alwaysOn ? "border-[#ffaa00]/60 bg-[#ffaa00]/15 text-[#ffaa00]" : "border-[#f5f3f0]/15 text-[#f5f3f0]/60 hover:text-[#f5f3f0]"
                )}
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

        <div ref={feedRef} className="no-scrollbar max-h-[190px] overflow-y-auto border-t border-[#f5f3f0]/10 px-4 py-3">
          {turns.length === 0 && !interim ? (
            <p className="text-[11.5px] leading-relaxed text-[#f5f3f0]/40">
              Try: &quot;Interstellar, add a website build for Meridian, forty five hundred dollars, due in three weeks.&quot;
            </p>
          ) : null}
          {turns.map((turn) => (
            <p key={turn.at + turn.role} className={cn("mb-2 text-[11.5px] leading-relaxed", turn.role === "you" ? "text-[#f5f3f0]/55" : "text-[#f5f3f0]")}>
              <span className="mono-label mr-2 text-[8.5px] text-[#ff6a00]">{turn.role === "you" ? "you" : "core"}</span>
              {turn.text}
            </p>
          ))}
          {capturing ? <p className="text-[11.5px] italic leading-relaxed text-[#ffaa00]">{capturing}...</p> : null}
        </div>

        {notice ? (
          <div className="border-t border-[#f5f3f0]/10 px-4 py-2.5">
            <p className="text-[11px] leading-relaxed text-[#ffaa00]">{notice}</p>
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const text = draft.trim();
            if (!text) return;
            setDraft("");
            runCommand(text);
          }}
          className="flex items-center gap-2 border-t border-[#f5f3f0]/10 bg-black/25 px-3 py-3"
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={busy ? "Core is working..." : "Type a command instead"}
            className="min-w-0 flex-1 bg-transparent text-[12px] text-[#f5f3f0] placeholder:text-[#f5f3f0]/30 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="grid h-8 w-8 place-items-center rounded-md bg-[#ff3c00] text-white transition-colors hover:bg-[#ff6a00] disabled:opacity-40"
            aria-label="Send command"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
          </button>
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