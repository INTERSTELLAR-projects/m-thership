// Portal UI support for Nøva: the daily briefing card (cached per client per day)
// and voice (dictation + read-aloud) for portal users. Scoped exactly like the `portal` function:
// the client comes from the caller's login; admins preview with client_id.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { resolvePortalClient, gatherBriefing, json, today } from "../../shared/portalAssistant.ts";

const OPENAI = "https://api.openai.com/v1";
const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // ~8 min of opus at 32 kbps
const VOICE_STYLE = "Warm, confident and upbeat, like a sharp agency account lead giving a quick update. Clear, measured pace, no upspeak.";

const CARD_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    highlights: { type: "array", items: { type: "string" } },
    next_up: { type: "array", items: { type: "string" } },
  },
  required: ["headline", "summary", "highlights", "next_up"],
};

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const ctx = await resolvePortalClient(base44, body);
    if ("error" in ctx) return ctx.error;
    const action = String(body?.action || "context");
    const key = Deno.env.get("OPENAI_API_KEY") || "";

    if (action === "context") {
      return json({ business: ctx.client.business, first_name: String(ctx.user.full_name || "").split(" ")[0] || "", is_admin_preview: ctx.preview, voice: !!key });
    }

    if (action === "briefing_card") {
      const date = today();
      const cached = ((await ctx.db.AssistantBriefing.filter({ client_id: ctx.cid, date }, "-created_date", 1).catch(() => [])) || [])[0];
      // Clients always get today's cached card; only an admin preview may force a regenerate.
      if (cached && !(body?.refresh === true && ctx.preview)) return json({ card: cached, cached: true });

      const facts = await gatherBriefing(ctx, 30);
      const stats = {
        work_done_30d: facts.work_done.total,
        seo_fixes_30d: facts.work_done.seo_fixes_applied,
        open_requests: facts.requests.open.length,
        site_health: facts.results.site_health.score, // null below 70
        google_rating: facts.results.google_profile[0]?.rating ?? null,
        google_reviews: facts.results.google_profile[0]?.review_count ?? null,
        qr_scans_30d: facts.results.qr_scans_last_30_days,
      };
      let card = { headline: `Here's your month with Interstellar, ${ctx.client.business}.`, summary: "", highlights: [] as string[], next_up: [] as string[] };
      try {
        const out: any = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: [
            "You are Nøva, Interstellar's assistant for Interstellar Strategies (tagline: The Future of Business), writing a short daily briefing card for a client in their portal.",
            "Voice: friendly, confident, concise, upbeat, plain English. No emoji, no hype words, no exclamation marks.",
            "STRICT RULES: use ONLY the facts in the JSON. Never invent work, numbers, dates or results. Never mention a site health number when site_health.score is null.",
            "Never mention prices, billing, internal notes or other clients. Never promise dates.",
            "Plan names: the only Interstellar plans are HyperCare+ and GravïtyCare. Never say Orbit, Ørbit, Orbit SEO, Starship Care, Manage+ or AppCare.",
            "headline: max 12 words. summary: 2 sentences on what Interstellar did for them in the last 30 days and how things look.",
            "highlights: 2-4 short bullets of concrete work or results (with counts where given). next_up: 0-3 short bullets from projects/milestones/open requests.",
            "If there is little data, say the work feed fills up as work is published and keep it short.",
            "FACTS JSON:",
            JSON.stringify(facts).slice(0, 14000),
          ].join("\n"),
          response_json_schema: CARD_SCHEMA,
        });
        if (out && typeof out === "object") {
          card = {
            headline: String(out.headline || card.headline).slice(0, 140),
            summary: String(out.summary || "").slice(0, 600),
            highlights: (Array.isArray(out.highlights) ? out.highlights : []).slice(0, 4).map((s: unknown) => String(s).slice(0, 200)),
            next_up: (Array.isArray(out.next_up) ? out.next_up : []).slice(0, 3).map((s: unknown) => String(s).slice(0, 200)),
          };
        }
      } catch { /* fall back to the plain card */ }
      if (!card.summary) card.summary = facts.work_done.total ? `${facts.work_done.total} pieces of work logged for you in the last 30 days.` : "Your work feed fills up as we publish for you.";
      const row = {
        client_id: ctx.cid, date, ...card, stats,
        waiting_on_you: facts.waiting_on_you.map((w) => w.what).slice(0, 5),
        generated_at: new Date().toISOString(),
      };
      const saved = cached ? await ctx.db.AssistantBriefing.update(cached.id, row) : await ctx.db.AssistantBriefing.create(row);
      return json({ card: saved || row, cached: false });
    }

    if (action === "transcribe") {
      if (!key) return json({ available: false, error: "Voice transcription isn't set up" }, 501);
      const raw = String(body.audio || "").replace(/^data:[^,]*,/, "");
      if (!raw) return json({ error: "audio is required" }, 400);
      const bytes = b64ToBytes(raw);
      if (bytes.length > MAX_AUDIO_BYTES) return json({ error: "Recording is too long" }, 413);
      const mime = String(body.mime || "audio/webm").split(";")[0];
      const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm";
      const attempt = (model: string) => {
        const form = new FormData();
        form.append("file", new Blob([bytes], { type: mime }), "dictation." + ext);
        form.append("model", model);
        form.append("language", "en");
        form.append("response_format", "json");
        form.append("prompt", `${ctx.client.business}, Interstellar Strategies, Google Business Profile, SEO, website.`);
        return fetch(OPENAI + "/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + key }, body: form });
      };
      let res = await attempt("gpt-4o-transcribe");
      if (!res.ok) res = await attempt("whisper-1");
      if (!res.ok) return json({ error: "Transcription failed" }, 502);
      const data = await res.json().catch(() => ({}));
      return json({ text: String(data?.text || "").trim() });
    }

    if (action === "speak") {
      if (!key) return json({ available: false, error: "Server voice isn't set up" }, 501);
      const input = String(body.text || "").trim().slice(0, 1800);
      if (!input) return json({ error: "text is required" }, 400);
      let res = await fetch(OPENAI + "/audio/speech", {
        method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "nova", input, instructions: VOICE_STYLE, speed: 1, response_format: "mp3" }),
      });
      if (!res.ok) {
        res = await fetch(OPENAI + "/audio/speech", {
          method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "tts-1", voice: "nova", input, response_format: "mp3" }),
        });
      }
      if (!res.ok) return json({ error: "Speech failed" }, 502);
      return json({ audio: bytesToB64(new Uint8Array(await res.arrayBuffer())), mime: "audio/mpeg" });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (_e) {
    return json({ error: "Assistant error" }, 500);
  }
});
