// Dictation core (pure, unit-tested in tests/unit/dictation.test.js).
// Browsers end a speech-recognition session after a pause, a network blip or ~60s. We restart it while the owner's
// session is "on" and stitch the pieces together without losing or repeating words:
//   base     = text from earlier sessions (and anything typed before the mic started)
//   finals   = this session's final results (rebuilt from the full result list on every event)
//   interim  = this session's not-yet-final words (shown live, committed if the session ends before they finalise)

const clean = (t) => String(t || "").replace(/\s+/g, " ").trim();
const norm = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

// Join b onto a, dropping words b repeats from a's tail (restarts and some phones re-send the last phrase).
export function mergeNoDup(a, b) {
  a = clean(a); b = clean(b);
  if (!b) return a;
  if (!a) return b;
  const aw = a.split(" "), bw = b.split(" ");
  const an = aw.map(norm), bn = bw.map(norm);
  // b already fully at the end of a
  if (bn.length <= an.length && bn.every((w, i) => w === an[an.length - bn.length + i])) return a;
  for (let k = Math.min(aw.length, bw.length); k >= 2; k--) {
    let ok = true;
    for (let i = 0; i < k; i++) if (an[an.length - k + i] !== bn[i]) { ok = false; break; }
    if (ok) return clean(`${a} ${bw.slice(k).join(" ")}`);
  }
  return `${a} ${b}`;
}

// Some engines (Android Chrome) send each final result as the whole phrase so far; keep the longest form.
export function joinFinals(list) {
  let out = "";
  for (const raw of list) {
    const t = clean(raw);
    if (!t) continue;
    if (out && norm(t.split(" ")[0]) && t.toLowerCase().startsWith(out.toLowerCase())) out = t;
    else out = mergeNoDup(out, t);
  }
  return out;
}

export const initialState = (text = "") => ({ base: clean(text), finals: [], interim: "" });

// results: the session's full result list (SpeechRecognitionResultList or [{ transcript, isFinal }]).
export function applyResults(st, results) {
  const finals = [];
  let interim = "";
  for (let i = 0; i < (results?.length || 0); i++) {
    const r = results[i];
    const t = r?.transcript ?? r?.[0]?.transcript ?? "";
    if (r?.isFinal) finals.push(t); else interim += ` ${t}`;
  }
  return { ...st, finals, interim: clean(interim) };
}

// The browser ended a session (pause, error, stop): commit what it heard, interim included, exactly once.
export function endSession(st) {
  return { base: mergeNoDup(st.base, mergeNoDup(joinFinals(st.finals), st.interim)), finals: [], interim: "" };
}

export const committedText = (st) => mergeNoDup(st.base, joinFinals(st.finals));
export const textOf = (st) => mergeNoDup(committedText(st), st.interim);

export const ERROR_TEXT = {
  "not-allowed": "Microphone access is blocked. Allow the mic for this site in your browser settings, or type instead.",
  "service-not-allowed": "This browser won't allow speech recognition here. Type instead, or try Chrome or Safari.",
  "audio-capture": "No microphone was found. Check it's connected, or type instead.",
  unsupported: "Voice typing isn't available in this browser. Type instead, or open Møthership in Chrome or Safari.",
};
// Errors that end the session for good. Anything else (no-speech, network, aborted) just restarts.
export const FATAL = new Set(["not-allowed", "service-not-allowed", "audio-capture"]);

export const fmtElapsed = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
