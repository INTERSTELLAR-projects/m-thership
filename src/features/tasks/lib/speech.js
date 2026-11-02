export const speechSupported = () =>
  typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

export const synthesisSupported = () => typeof window !== "undefined" && !!window.speechSynthesis;

// The core speaks with a warm, feminine voice.
const VOICE_HINTS = [
  "google us english",
  "microsoft aria",
  "microsoft jenny",
  "microsoft zira",
  "microsoft michelle",
  "microsoft emma",
  "samantha",
  "ava",
  "allison",
  "serena",
  "karen",
  "moira",
  "tessa",
  "victoria",
  "susan"
];

const MALE = /male|guy|david|mark|james|george|daniel|arthur|oliver|alex|fred|ralph/i;

function pickNarratorVoice() {
  if (!synthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;
  const english = voices.filter((v) => /^en/i.test(v.lang || ""));
  const pool = (english.length ? english : voices).filter((v) => !MALE.test(v.name || ""));
  if (!pool.length) return null;
  for (const hint of VOICE_HINTS) {
    const hit = pool.find((v) => (v.name || "").toLowerCase().includes(hint));
    if (hit) return hit;
  }
  const us = pool.find((v) => /^en[-_]us/i.test(v.lang || ""));
  return us || pool[0];
}

export function warmVoices(callback) {
  if (!synthesisSupported()) return;
  const ready = () => callback && callback();
  if (window.speechSynthesis.getVoices().length) ready();
  else window.speechSynthesis.onvoiceschanged = ready;
}

export function speak(text, handlers = {}) {
  if (!text || !synthesisSupported()) {
    if (handlers.onEnd) handlers.onEnd();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 700));
  utterance.pitch = 1.12;
  utterance.rate = 1;
  utterance.volume = 1;
  const voice = pickNarratorVoice();
  if (voice) utterance.voice = voice;
  utterance.onstart = () => handlers.onStart && handlers.onStart();
  utterance.onend = () => handlers.onEnd && handlers.onEnd();
  utterance.onerror = () => handlers.onEnd && handlers.onEnd();
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (synthesisSupported()) window.speechSynthesis.cancel();
}

export async function requestMicAccess() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (error) {
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