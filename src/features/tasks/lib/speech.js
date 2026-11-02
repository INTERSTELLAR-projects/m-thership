import { base44 } from "@/api/base44Client";

export const speechSupported = () =>
  typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

export const synthesisSupported = () => typeof window !== "undefined" && !!window.speechSynthesis;

/* ---------------- Voice settings (per browser) ---------------- */

const SETTINGS_KEY = "mothership.core.voice";

// Soft but confident: a touch slower and a touch lower than the browser default.
export const DEFAULT_VOICE_SETTINGS = {
  engine: "auto", // auto = natural server voice when available, else the browser voice
  serverVoice: "nova",
  serverSpeed: 0.94,
  browserVoice: "", // voiceURI; empty = best match from the preference list
  rate: 0.94,
  pitch: 0.96,
  muted: false
};

export function readVoiceSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return { ...DEFAULT_VOICE_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS };
  }
}

export function writeVoiceSettings(next) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked */
  }
}

// Best natural-sounding female voices first (Edge "Online (Natural)", Google, Apple premium).
const VOICE_PREFERENCE = [
  "microsoft aria online",
  "microsoft jenny online",
  "microsoft ava online",
  "microsoft emma online",
  "microsoft michelle online",
  "microsoft sonia online",
  "microsoft libby online",
  "google uk english female",
  "samantha (premium)",
  "ava (premium)",
  "zoe (premium)",
  "allison (enhanced)",
  "samantha (enhanced)",
  "ava (enhanced)",
  "google us english",
  "samantha",
  "ava",
  "zoe",
  "allison",
  "serena",
  "karen",
  "moira",
  "tessa",
  "microsoft aria",
  "microsoft jenny",
  "microsoft zira",
  "victoria",
  "susan"
];

const MALE = /\bmale\b(?!.*female)|guy|david|mark|james|george|daniel|arthur|oliver|alex\b|fred|ralph|ryan|thomas|eric|christopher|andrew|brian|roger|steffan|aaron|tom\b|reed|rocko|grandpa/i;

function voiceScore(voice) {
  const name = (voice.name || "").toLowerCase();
  const idx = VOICE_PREFERENCE.findIndex((hint) => name.includes(hint));
  return idx === -1 ? VOICE_PREFERENCE.length + (/^en[-_]us/i.test(voice.lang || "") ? 0 : 1) : idx;
}

// English, non-male voices, best first.
export function femaleVoices() {
  if (!synthesisSupported()) return [];
  const voices = window.speechSynthesis.getVoices() || [];
  const english = voices.filter((v) => /^en/i.test(v.lang || ""));
  const pool = (english.length ? english : voices).filter((v) => !MALE.test(v.name || "") || /female/i.test(v.name || ""));
  return [...pool].sort((a, b) => voiceScore(a) - voiceScore(b));
}

function pickBrowserVoice(settings) {
  const ranked = femaleVoices();
  if (settings && settings.browserVoice) {
    const all = window.speechSynthesis.getVoices() || [];
    const chosen = all.find((v) => v.voiceURI === settings.browserVoice);
    if (chosen) return chosen;
  }
  return ranked[0] || null;
}

export function warmVoices(callback) {
  if (!synthesisSupported()) return () => {};
  const ready = () => callback && callback();
  if (window.speechSynthesis.getVoices().length) ready();
  window.speechSynthesis.addEventListener("voiceschanged", ready);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", ready);
}

/* ---------------- Server voice (OpenAI via the core-voice function) ---------------- */

let serverStatus = null;
let serverStatusPromise = null;

// Resolves { available, voices } once per page load.
export function coreVoiceStatus() {
  if (serverStatus) return Promise.resolve(serverStatus);
  if (!serverStatusPromise) {
    serverStatusPromise = base44.functions
      .invoke("core-voice", { action: "status" })
      .then((res) => {
        const data = (res && res.data) || {};
        serverStatus = { available: !!data.available, voices: data.voices || [] };
        return serverStatus;
      })
      .catch(() => {
        serverStatus = { available: false, voices: [] };
        return serverStatus;
      });
  }
  return serverStatusPromise;
}

export async function transcribeAudio(blob) {
  const status = await coreVoiceStatus();
  if (!status.available || !blob || !blob.size) return null;
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const res = await base44.functions.invoke("core-voice", { action: "transcribe", audio: dataUrl, mime: blob.type || "audio/webm" });
  const data = (res && res.data) || {};
  return typeof data.text === "string" ? data.text : null;
}

/* ---------------- Speaking ---------------- */

let currentAudio = null;
let speakToken = 0;

function speakBrowser(text, settings, handlers, token) {
  if (!synthesisSupported()) {
    if (handlers.onEnd) handlers.onEnd();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 1200));
  utterance.rate = Number(settings.rate) || DEFAULT_VOICE_SETTINGS.rate;
  utterance.pitch = Number(settings.pitch) || DEFAULT_VOICE_SETTINGS.pitch;
  utterance.volume = 1;
  const voice = pickBrowserVoice(settings);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  utterance.onstart = () => token === speakToken && handlers.onStart && handlers.onStart();
  utterance.onend = () => token === speakToken && handlers.onEnd && handlers.onEnd();
  utterance.onerror = () => token === speakToken && handlers.onEnd && handlers.onEnd();
  window.speechSynthesis.speak(utterance);
}

async function speakServer(text, settings, handlers, token) {
  const res = await base44.functions.invoke("core-voice", {
    action: "speak",
    text,
    voice: settings.serverVoice,
    speed: settings.serverSpeed
  });
  const data = (res && res.data) || {};
  if (!data.audio) throw new Error("no audio");
  if (token !== speakToken) return;
  const audio = new Audio("data:" + (data.mime || "audio/mpeg") + ";base64," + data.audio);
  currentAudio = audio;
  audio.onplay = () => token === speakToken && handlers.onStart && handlers.onStart();
  audio.onended = () => {
    if (currentAudio === audio) currentAudio = null;
    if (token === speakToken && handlers.onEnd) handlers.onEnd();
  };
  audio.onerror = audio.onended;
  await audio.play();
}

// settings: optional override (used by the Test button); otherwise the saved settings.
export function speak(text, handlers = {}, override) {
  stopSpeaking();
  const token = ++speakToken;
  const settings = { ...readVoiceSettings(), ...(override || {}) };
  if (!text || (settings.muted && !override)) {
    if (handlers.onEnd) handlers.onEnd();
    return;
  }
  const useServer = settings.engine === "openai" || settings.engine === "auto";
  if (!useServer) {
    speakBrowser(text, settings, handlers, token);
    return;
  }
  coreVoiceStatus().then((status) => {
    if (token !== speakToken) return;
    if (!status.available) {
      speakBrowser(text, settings, handlers, token);
      return;
    }
    speakServer(text, settings, handlers, token).catch(() => {
      if (token === speakToken) speakBrowser(text, settings, handlers, token);
    });
  });
}

export function stopSpeaking() {
  speakToken += 1;
  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {
      /* already stopped */
    }
    currentAudio = null;
  }
  if (synthesisSupported()) window.speechSynthesis.cancel();
}

/* ---------------- Listening ---------------- */

export async function requestMicAccess() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

export function createRecognizer({ onInterim, onFinal, onEnd, onError }) {
  if (!speechSupported()) return null;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const transcript = result[0] && result[0].transcript ? result[0].transcript : "";
      if (result.isFinal) {
        const text = transcript.trim();
        if (text && onFinal) onFinal(text);
      } else {
        interim += transcript;
      }
    }
    if (onInterim) onInterim(interim.trim());
  };

  recognition.onerror = (event) => onError && onError(event);
  recognition.onend = () => onEnd && onEnd();
  return recognition;
}
