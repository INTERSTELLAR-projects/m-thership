import { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { startRecorder, recorderSupported } from "@/features/tasks/lib/recorder";
import { createRecognizer, speechSupported, speak as speakWithBrowser, stopSpeaking as stopBrowserSpeech } from "@/features/tasks/lib/speech";

// Voice for the portal assistant. Reuses Core voice's recorder (records until stop, no silence
// cut-off) and speech helpers. Transcription + natural read-aloud go through the portal-assistant
// function (portal users can't call the admin-only core-voice function). While recording, the
// browser recognizer also runs (auto-restarted on pauses) as a backup transcript.

const invoke = async (args) => (await base44.functions.invoke("portal-assistant", args)).data;

const toDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result || ""));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

export const voiceInputSupported = () => recorderSupported() || speechSupported();

// state: idle | recording | transcribing
export function useDictation({ previewId, serverVoice, onText }) {
  const [state, setState] = useState("idle");
  const [level, setLevel] = useState(0);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const rec = useRef(null);
  const recog = useRef(null);
  const finals = useRef([]);
  const live = useRef(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const stopRef = useRef(null);

  const stopRecognizer = () => {
    live.current = false;
    try { recog.current?.stop(); } catch { /* already stopped */ }
    recog.current = null;
  };

  const startRecognizer = () => {
    if (!speechSupported()) return;
    const r = createRecognizer({
      onInterim: (t) => setInterim(t),
      onFinal: (t) => { finals.current.push(t); setInterim(""); },
      // Browsers end recognition after a pause: restart until the user presses stop.
      onEnd: () => { if (live.current) { try { r.start(); } catch { /* restarting */ } } },
      onError: (e) => { if (e?.error === "not-allowed") { live.current = false; setError("Microphone access was blocked."); } },
    });
    if (!r) return;
    recog.current = r;
    live.current = true;
    try { r.start(); } catch { /* already started */ }
  };

  const start = useCallback(async () => {
    if (state !== "idle") return;
    setError(""); setInterim(""); finals.current = [];
    try {
      if (serverVoice && recorderSupported()) {
        rec.current = await startRecorder({ onLevel: setLevel, onAutoStop: () => stopRef.current?.() });
      } else if (!speechSupported()) {
        setError("Voice input isn't supported in this browser.");
        return;
      }
      startRecognizer();
      setState("recording");
    } catch {
      setError("Couldn't reach the microphone. Check your browser's mic permission.");
      rec.current = null;
      stopRecognizer();
    }
  }, [state, serverVoice]);

  const stop = useCallback(async () => {
    if (state !== "recording") return;
    stopRecognizer();
    const backup = [...finals.current, interim].filter(Boolean).join(" ").trim();
    setInterim("");
    const r = rec.current;
    rec.current = null;
    if (!r) { if (backup) onTextRef.current?.(backup); setState("idle"); return; }
    setState("transcribing");
    try {
      const blob = await r.stop();
      let text = "";
      if (blob && blob.size > 1200) {
        const res = await invoke({ action: "transcribe", client_id: previewId, audio: await toDataUrl(blob), mime: blob.type || "audio/webm" }).catch(() => null);
        text = String(res?.text || "").trim();
      }
      const out = text || backup;
      if (out) onTextRef.current?.(out);
      else setError("Didn't catch that. Try again a little closer to the mic.");
    } finally {
      setLevel(0);
      setState("idle");
    }
  }, [state, interim, previewId]);

  stopRef.current = stop;

  const cancel = useCallback(() => {
    stopRecognizer();
    rec.current?.cancel();
    rec.current = null;
    setLevel(0); setInterim(""); setState("idle");
  }, []);

  useEffect(() => () => { live.current = false; try { recog.current?.stop(); } catch { /* noop */ } rec.current?.cancel(); }, []);

  return { state, level, interim, error, start, stop, cancel, clearError: () => setError("") };
}

// ---- Read-aloud ----
let audio = null;
let token = 0;

export const plainText = (md) => String(md || "")
  .replace(/```[\s\S]*?```/g, " ")
  .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
  .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1")
  .replace(/https?:\/\/\S+/g, "the link")
  .replace(/[*_#>`|~-]{1,3}/g, " ")
  .replace(/\s+/g, " ")
  .trim();

export function stopReading() {
  token += 1;
  if (audio) { try { audio.pause(); } catch { /* stopped */ } audio = null; }
  stopBrowserSpeech();
}

export async function readAloud(text, { previewId, serverVoice, onStart, onEnd } = {}) {
  stopReading();
  const my = ++token;
  const say = plainText(text).slice(0, 1800);
  if (!say) { onEnd?.(); return; }
  const browser = () => speakWithBrowser(say, { onStart, onEnd }, { engine: "browser", muted: false });
  if (!serverVoice) { browser(); return; }
  try {
    const res = await invoke({ action: "speak", client_id: previewId, text: say });
    if (my !== token) return;
    if (!res?.audio) throw new Error("no audio");
    const a = new Audio(`data:${res.mime || "audio/mpeg"};base64,${res.audio}`);
    audio = a;
    a.onplay = () => my === token && onStart?.();
    a.onended = () => { if (audio === a) audio = null; if (my === token) onEnd?.(); };
    a.onerror = a.onended;
    await a.play();
  } catch {
    if (my === token) browser();
  }
}
