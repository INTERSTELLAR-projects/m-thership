// Voice for Møthership Command: browser speech recognition (Chrome, Edge, Safari 14.5+), speech synthesis,
// a soft chime and the screen wake lock. Everything degrades to typing and reading when a browser lacks it.
import { useCallback, useEffect, useRef, useState } from "react";
import * as D from "./dictation";

const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const canListen = () => Boolean(SR);
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

const SPEAK_KEY = "ms_cmd_speak";
export function getSpeakPref() { try { return localStorage.getItem(SPEAK_KEY) === "1"; } catch { return false; } }
export function setSpeakPref(on) { try { localStorage.setItem(SPEAK_KEY, on ? "1" : "0"); } catch { /* private mode */ } }

let voiceCache = null;
function pickVoice() {
  if (!canSpeak()) return null;
  if (voiceCache) return voiceCache;
  const vs = window.speechSynthesis.getVoices() || [];
  voiceCache = vs.find((v) => /en-US/i.test(v.lang) && /Samantha|Google US English|Aria|Jenny|Natural/i.test(v.name)) || vs.find((v) => /^en/i.test(v.lang)) || null;
  return voiceCache;
}
export function speak(text, { onend, rate = 1.03 } = {}) {
  if (!canSpeak() || !text) { onend?.(); return () => {}; }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(String(text).replace(/[*_#`]/g, ""));
  const v = pickVoice();
  if (v) u.voice = v;
  u.rate = rate;
  u.onend = () => onend?.();
  u.onerror = () => onend?.();
  synth.speak(u);
  return () => synth.cancel();
}
export const stopSpeaking = () => { if (canSpeak()) window.speechSynthesis.cancel(); };

// Two soft sine notes (Web Audio). Needs a user gesture first on iOS.
let ctx = null;
export function chime() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    [[659.25, 0], [987.77, 0.16]].forEach(([f, t]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.12, now + t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.7);
      o.connect(g).connect(ctx.destination);
      o.start(now + t);
      o.stop(now + t + 0.75);
    });
  } catch { /* no audio */ }
}

// Listen once (or continuously). onFinal(text) gets each final phrase.
export function useListener({ onFinal, continuous = false, lang = "en-US" } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const rec = useRef(null);
  const finalCb = useRef(onFinal);
  finalCb.current = onFinal;
  const wantOn = useRef(false);

  const stop = useCallback(() => {
    wantOn.current = false;
    try { rec.current?.stop(); } catch { /* already stopped */ }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!SR) { setError("Voice isn't available in this browser. Type instead."); return false; }
    setError("");
    try { rec.current?.abort(); } catch { /* none */ }
    const r = new SR();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = continuous;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let fin = "", mid = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t; else mid += t;
      }
      setInterim(mid);
      if (fin.trim()) { setInterim(""); finalCb.current?.(fin.trim()); }
    };
    r.onerror = (e) => { if (e.error === "not-allowed") setError("Microphone access is blocked. Allow it in the browser, or type."); else if (e.error !== "no-speech" && e.error !== "aborted") setError("Didn't catch that. Try again or type."); };
    r.onend = () => {
      if (wantOn.current && continuous) { try { r.start(); return; } catch { /* fall through */ } }
      setListening(false);
    };
    try { r.start(); } catch { setError("Couldn't start the microphone."); return false; }
    rec.current = r;
    wantOn.current = true;
    setListening(true);
    return true;
  }, [continuous, lang]);

  useEffect(() => () => { wantOn.current = false; try { rec.current?.abort(); } catch { /* none */ } }, []);
  return { listening, interim, error, start, stop, supported: Boolean(SR) };
}

// Dictation like Claude's: tap once to start, it keeps listening through pauses (auto-restarts the browser session)
// until you tap stop. Never submits anything; the text stays for review. onStop(text) fires once when it stops.
export function useDictation({ initial = "", lang = "en-US", onStop } = {}) {
  const S = useRef(D.initialState(initial));
  const [, setV] = useState(0);
  const bump = () => setV((x) => x + 1);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const on = useRef(false);
  const rec = useRef(null);
  const started = useRef(0);
  const restarts = useRef([]);
  const stopCb = useRef(onStop);
  stopCb.current = onStop;
  const finishTimer = useRef(null);

  const finish = useCallback(() => {
    clearTimeout(finishTimer.current);
    if (!listeningRef.current) return;
    listeningRef.current = false;
    S.current = D.endSession(S.current);
    setListening(false);
    bump();
    stopCb.current?.(D.textOf(S.current));
  }, []);
  const listeningRef = useRef(false);

  const spawn = useCallback(() => {
    if (!SR) return;
    const r = new SR();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => { if (rec.current !== r) return; S.current = D.applyResults(S.current, e.results); bump(); };
    r.onerror = (e) => {
      if (D.FATAL.has(e.error)) { on.current = false; setError(D.ERROR_TEXT[e.error] || "The microphone stopped. Type instead."); }
    };
    r.onend = () => {
      if (rec.current !== r) return;
      S.current = D.endSession(S.current); // commit this session's words exactly once
      bump();
      if (on.current) {
        // Restart through pauses and blips; back off if the browser keeps ending immediately.
        const now = Date.now();
        restarts.current = restarts.current.filter((t) => now - t < 4000).concat(now);
        const wait = restarts.current.length > 6 ? 1200 : 120;
        setTimeout(() => { if (on.current) { try { spawn(); } catch { on.current = false; finish(); } } }, wait);
      } else finish();
    };
    rec.current = r;
    try { r.start(); } catch { /* already started; onend will follow */ }
  }, [lang, finish]);

  const start = useCallback(() => {
    if (!SR) { setError(D.ERROR_TEXT.unsupported); return false; }
    if (on.current) return true;
    setError("");
    stopSpeaking();
    on.current = true;
    listeningRef.current = true;
    started.current = Date.now();
    restarts.current = [];
    setElapsed(0);
    setListening(true);
    spawn();
    return true;
  }, [spawn]);

  const stop = useCallback(() => {
    if (!on.current && !listeningRef.current) return;
    on.current = false;
    try { rec.current?.stop(); } catch { /* not running */ }
    // If the browser never fires onend, finish anyway.
    finishTimer.current = setTimeout(finish, 1500);
  }, [finish]);

  const setText = useCallback((t) => { if (!on.current) { S.current = D.initialState(t); bump(); } }, []);
  useEffect(() => {
    if (!listening) return undefined;
    const t = setInterval(() => setElapsed((Date.now() - started.current) / 1000), 500);
    return () => clearInterval(t);
  }, [listening]);
  useEffect(() => () => { on.current = false; try { rec.current?.abort(); } catch { /* none */ } clearTimeout(finishTimer.current); }, []);

  return {
    text: D.textOf(S.current), committed: D.committedText(S.current), interim: S.current.interim,
    listening, error, elapsed, start, stop, toggle: () => (on.current ? stop() : start()), setText, supported: Boolean(SR),
  };
}

export function useWakeLock(active) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return undefined;
    let lock = null;
    let dead = false;
    const get = async () => { try { lock = await navigator.wakeLock.request("screen"); setHeld(true); lock.addEventListener?.("release", () => setHeld(false)); } catch { setHeld(false); } };
    get();
    const vis = () => { if (document.visibilityState === "visible" && !dead) get(); };
    document.addEventListener("visibilitychange", vis);
    return () => { dead = true; document.removeEventListener("visibilitychange", vis); try { lock?.release(); } catch { /* none */ } };
  }, [active]);
  return held;
}

// Spoken commands in Walk Mode.
export function parseSpoken(text) {
  const t = String(text || "").toLowerCase().trim();
  if (/^(yes|yeah|yep|approve|do it|confirm|sure|ok|okay)\b/.test(t)) return "yes";
  if (/^(no|nope|don't|do not|reject)\b/.test(t)) return "no";
  if (/^(skip|later|pass)\b/.test(t)) return "skip";
  if (/^(next|continue|go on)\b/.test(t)) return "next";
  if (/^(repeat|again|say that again|what)\b/.test(t)) return "repeat";
  if (/^(stop|exit|end|quit|that's all)\b/.test(t)) return "stop";
  if (/^(one|1|first)\b/.test(t)) return "1";
  if (/^(two|2|second)\b/.test(t)) return "2";
  if (/^(three|3|third)\b/.test(t)) return "3";
  return null;
}
