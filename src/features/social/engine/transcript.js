// Transcript parsing for the Capture step: .srt / .vtt / "[0:12] text" / plain text. Timestamps come only from
// the file, so the clip cut list never invents a time.

const toSec = (t) => {
  const m = String(t).trim().replace(",", ".").match(/^(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)$/);
  if (!m) return NaN;
  return (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]);
};
export const fmtTs = (sec) => {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};

/** Returns [{ start, end, text }] in seconds, or [] when the text carries no timestamps. */
export function parseTranscript(raw) {
  const text = String(raw || "").replace(/\r/g, "");
  const cue = /(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}|\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}|\d{1,2}:\d{2}[.,]\d{1,3})[^\n]*\n([\s\S]*?)(?=\n\s*\n|$)/g;
  const out = [];
  let m;
  while ((m = cue.exec(text))) {
    const body = m[3].replace(/<[^>]+>/g, "").split("\n").filter((l) => l.trim() && !/^\d+$/.test(l.trim())).join(" ").trim();
    if (body) out.push({ start: toSec(m[1]), end: toSec(m[2]), text: body });
  }
  if (out.length) return dedupe(out);
  // "[0:12] text" or "0:12 text" lines (YouTube "Show transcript" copy)
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const stamped = [];
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i].match(/^\[?(\d{1,2}(?::\d{2}){1,2})\]?\s*(.*)$/);
    if (s) {
      const t = toSec(s[1]);
      let body = s[2];
      if (!body && lines[i + 1] && !/^\[?\d{1,2}(?::\d{2}){1,2}\]?/.test(lines[i + 1])) { body = lines[i + 1]; i++; }
      if (Number.isFinite(t) && body) stamped.push({ start: t, end: t, text: body });
    }
  }
  if (stamped.length >= 2) {
    for (let i = 0; i < stamped.length; i++) stamped[i].end = stamped[i + 1]?.start ?? stamped[i].start + 5;
    return stamped;
  }
  return [];
}
function dedupe(list) {
  // Auto-generated VTT repeats rolling lines; keep the first time each text appears.
  const seen = new Set();
  return list.filter((c) => { const k = c.text.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}
export const plainText = (segs) => segs.map((s) => s.text).join(" ");
