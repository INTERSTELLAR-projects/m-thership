import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";

/*
 * mediaStudio (Nov 25 2026): runs ONE pending MediaJob against ElevenLabs and returns the audio as base64.
 * Callers must present the job id and its one-time token (created by an admin in the MediaJob entity); a job runs
 * once, within 2 hours of creation. The ElevenLabs key stays in the app's Secrets (ELEVENLABS_API_KEY) and is never
 * returned. Nothing is stored except the job's status.
 */
const API = "https://api.elevenlabs.io";

function eq(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const b64 = (buf: ArrayBuffer) => {
  const u = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405 });
  let body: any = {};
  try { body = await req.json(); } catch { return Response.json({ error: "Bad JSON" }, { status: 400 }); }
  const { job_id, token } = body || {};
  if (!job_id || !token) return Response.json({ error: "Missing job" }, { status: 400 });

  const base44 = createClientFromRequest(req);
  const db = base44.asServiceRole.entities;
  const job = await db.MediaJob.get(job_id).catch(() => null);
  if (!job || !eq(String(job.token || ""), String(token))) return Response.json({ error: "Not found" }, { status: 404 });
  if (job.status !== "pending") return Response.json({ error: "Already run" }, { status: 409 });
  if (Date.now() - new Date(job.created_date).getTime() > 2 * 3600 * 1000) return Response.json({ error: "Expired" }, { status: 410 });

  const key = Deno.env.get("ELEVENLABS_API_KEY") || "";
  if (!key) return Response.json({ error: "ELEVENLABS_API_KEY is not set in Secrets" }, { status: 503 });
  await db.MediaJob.update(job.id, { status: "done", ran_at: new Date().toISOString() }); // one run only, even on failure below

  const input = job.input || {};
  const h = { "xi-api-key": key, "Content-Type": "application/json" };
  try {
    if (job.kind === "tts") {
      const voice = encodeURIComponent(input.voice_id || "");
      const r = await fetch(`${API}/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_192`, {
        method: "POST", headers: h,
        body: JSON.stringify({ text: input.text, model_id: input.model_id || "eleven_multilingual_v2", voice_settings: input.voice_settings || undefined }),
      });
      if (!r.ok) throw new Error(`tts ${r.status}: ${(await r.text()).slice(0, 300)}`);
      const j = await r.json();
      return Response.json({ ok: true, kind: "tts", audio_base64: j.audio_base64, alignment: j.alignment, normalized_alignment: j.normalized_alignment });
    }
    if (job.kind === "sfx") {
      const r = await fetch(`${API}/v1/sound-generation?output_format=mp3_44100_192`, {
        method: "POST", headers: h,
        body: JSON.stringify({ text: input.text, duration_seconds: input.duration_seconds ?? undefined, prompt_influence: input.prompt_influence ?? 0.5 }),
      });
      if (!r.ok) throw new Error(`sfx ${r.status}: ${(await r.text()).slice(0, 300)}`);
      return Response.json({ ok: true, kind: "sfx", audio_base64: b64(await r.arrayBuffer()) });
    }
    if (job.kind === "music") {
      const r = await fetch(`${API}/v1/music?output_format=mp3_44100_192`, {
        method: "POST", headers: h,
        body: JSON.stringify({ prompt: input.prompt, music_length_ms: input.music_length_ms || 60000, force_instrumental: true }),
      });
      if (!r.ok) throw new Error(`music ${r.status}: ${(await r.text()).slice(0, 300)}`);
      return Response.json({ ok: true, kind: "music", audio_base64: b64(await r.arrayBuffer()) });
    }
    throw new Error("Unknown kind");
  } catch (e: any) {
    await db.MediaJob.update(job.id, { status: "failed", error: String(e.message || e).slice(0, 500) }).catch(() => null);
    return Response.json({ ok: false, error: String(e.message || e) }, { status: 502 });
  }
});
