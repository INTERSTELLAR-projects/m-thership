// Core voice: Whisper-style transcription and natural text-to-speech for the Voice Core.
// Uses OpenAI when the OPENAI_API_KEY secret is set; otherwise reports { available: false }
// and the browser falls back to Web Speech. The key is never returned or logged.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { requireAdmin } from "../../shared/assistant.ts";

const OPENAI = "https://api.openai.com/v1";
const FEMALE_VOICES = ["nova", "shimmer", "sage", "coral", "alloy"];
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

const CORE_STYLE =
  "Speak as a calm, confident female assistant: soft and warm in tone, but clear and self-assured, " +
  "like a trusted chief of staff giving a briefing. Measured pace, no rush, low and steady pitch, no upspeak.";

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

async function transcribe(key: string, body: any) {
  const raw = String(body.audio || "").replace(/^data:[^,]*,/, "");
  if (!raw) return Response.json({ error: "audio is required" }, { status: 400 });
  const bytes = b64ToBytes(raw);
  if (bytes.length > MAX_AUDIO_BYTES) return Response.json({ error: "Recording is too long" }, { status: 413 });
  const mime = String(body.mime || "audio/webm").split(";")[0];
  const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm";

  const attempt = async (model: string) => {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mime }), "dictation." + ext);
    form.append("model", model);
    form.append("language", "en");
    form.append("response_format", "json");
    if (body.prompt) form.append("prompt", String(body.prompt).slice(0, 800));
    return fetch(OPENAI + "/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + key }, body: form });
  };

  let res = await attempt("gpt-4o-transcribe");
  if (!res.ok) res = await attempt("whisper-1");
  if (!res.ok) return Response.json({ error: "Transcription failed (" + res.status + ")" }, { status: 502 });
  const data = await res.json().catch(() => ({}));
  return Response.json({ text: String((data && data.text) || "").trim() });
}

async function speak(key: string, body: any) {
  const input = String(body.text || "").trim().slice(0, 3800);
  if (!input) return Response.json({ error: "text is required" }, { status: 400 });
  const voice = FEMALE_VOICES.includes(body.voice) ? body.voice : "nova";
  const speed = Math.min(1.2, Math.max(0.75, Number(body.speed) || 0.94));

  let res = await fetch(OPENAI + "/audio/speech", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini-tts", voice, input, instructions: CORE_STYLE, speed, response_format: "mp3" })
  });
  if (!res.ok) {
    res = await fetch(OPENAI + "/audio/speech", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "tts-1-hd", voice: voice === "sage" || voice === "coral" ? "nova" : voice, input, speed, response_format: "mp3" })
    });
  }
  if (!res.ok) return Response.json({ error: "Speech failed (" + res.status + ")" }, { status: 502 });
  const bytes = new Uint8Array(await res.arrayBuffer());
  return Response.json({ audio: bytesToB64(bytes), mime: "audio/mpeg" });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { denied } = await requireAdmin(base44);
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    const action = String((body && body.action) || "status");
    const key = Deno.env.get("OPENAI_API_KEY") || "";

    if (action === "status") return Response.json({ available: !!key, voices: FEMALE_VOICES });
    if (!key) return Response.json({ available: false, error: "OPENAI_API_KEY is not set" }, { status: 501 });
    if (action === "transcribe") return await transcribe(key, body);
    if (action === "speak") return await speak(key, body);
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (_error) {
    return Response.json({ error: "Core voice error" }, { status: 500 });
  }
});
