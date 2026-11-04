import { base44 } from "@/api/base44Client";
import { brandBrief } from "../brand";
import { CONVERSATION_KINDS, LINKS, SERIES, VOICES } from "./channels";

// Claude drafts for the manual channels (Core.InvokeLLM). Drafts only: nothing is posted or sent.

const stripEmoji = (s) => String(s || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{FE0F}]/gu, "").replace(/[ \t]{2,}/g, " ").trim();
const ask = (prompt, schema) => base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema });

/** A LinkedIn (company or personal) post, or a YouTube Shorts caption. */
export async function draftChannelPost({ channel, topic, pillar, sourceText, existing }) {
  const res = await ask([
    "You write social posts for Interstellar Strategies. You only draft; Justin reviews and posts by hand.",
    brandBrief(),
    `Voice for this channel: ${VOICES[channel]}`,
    pillar ? `Pillar: ${pillar}` : "",
    topic ? `Topic / direction from Justin: ${topic}` : "",
    sourceText ? `Repurpose this existing post (same idea, rewritten for this channel, not copied):\n${sourceText}` : "",
    existing ? `Current draft to improve:\n${existing}` : "",
    "Rules: no emoji, never invent client results, statistics, testimonials or reviews; prices only from the offers above; the trademark sign is ™ (never ®).",
    "Return hook (the first line / Shorts title), body (the full post text including the hook as the first line and hashtags at the end) and hashtags (array).",
  ].filter(Boolean).join("\n\n"), {
    type: "object",
    properties: { hook: { type: "string" }, body: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } },
    required: ["body"],
  });
  return { hook: stripEmoji(res?.hook), body: stripEmoji(res?.body), hashtags: (res?.hashtags || []).map(stripEmoji).slice(0, 6) };
}

/** A LinkedIn connection note / follow-up / reply. Uses only what Justin typed. */
export async function draftConversation({ account, kind, person, context, goal }) {
  const k = CONVERSATION_KINDS.find((x) => x.key === kind) || CONVERSATION_KINDS[0];
  const res = await ask([
    `Draft a LinkedIn ${k.label.toLowerCase()} for Justin to copy and send himself. Do not invent facts about the other person beyond what is given.`,
    account === "linkedin_company"
      ? "Sender: the Interstellar Business OS company page (\"we\"), friendly and professional."
      : "Sender: Justin Cowell personally (\"I\"), founder of Interstellar Strategies. Warm, direct, human, no sales pitch in a first message.",
    `Who: ${person || "(not given)"}`,
    `Context Justin gave: ${context || "(none)"}`,
    goal ? `Goal: ${goal}` : "",
    `Hard limit: ${k.limit} characters. No emoji, no flattery clichés ("I came across your impressive profile"), no fake familiarity. One clear, low-pressure ask at most.`,
    "Return the message text only in draft, and up to 2 shorter alternatives.",
  ].filter(Boolean).join("\n\n"), {
    type: "object",
    properties: { draft: { type: "string" }, alternatives: { type: "array", items: { type: "string" } } },
    required: ["draft"],
  });
  const cut = (s) => stripEmoji(s).slice(0, k.limit);
  return { draft: cut(res?.draft), alternatives: (res?.alternatives || []).map(cut).slice(0, 2) };
}

async function searchContext() {
  const intel = await base44.entities.SeoIntel.list("-brief_date", 8).catch(() => []);
  const ak = await base44.entities.AgencyKnowledge.list("sort", 40).catch(() => []);
  const intelText = (intel || []).map((i) => `- ${i.title}: ${String(i.summary || "").slice(0, 220)}${i.for_us ? ` (for us: ${String(i.for_us).slice(0, 160)})` : ""}`).join("\n");
  const akText = (ak || []).filter((s) => ["voice", "delivery_rules", "services", "offers"].includes(s.key)).map((s) => `${s.title}: ${JSON.stringify(s.data || s.body || "").slice(0, 600)}`).join("\n");
  return { intelText, akText };
}

/** Title options, thumbnail ideas, script, chapters for a YouTube video. */
export async function draftVideo({ video, part = "all" }) {
  const { intelText, akText } = await searchContext();
  const series = SERIES.find((s) => s.key === video.series)?.label || "";
  const res = await ask([
    "You are planning a YouTube video for the Interstellar™ | Business OS channel (Interstellar Strategies). The audience is owners of small and mid-size service businesses. Practical, plain, specific; no hype.",
    brandBrief(),
    intelText ? `Recent search intel (AI search, local SEO, Google changes):\n${intelText}` : "",
    akText ? `Agency knowledge:\n${akText}` : "",
    `Video: "${video.title}"${series ? ` · series ${series}` : ""}${video.format === "trailer" ? " · channel trailer, under 60 seconds" : " · 8-14 minutes"}`,
    video.angle ? `Angle: ${video.angle}` : "",
    video.guardrails ? `Guardrails (must respect): ${video.guardrails}` : "",
    "Never invent client results, statistics or testimonials. If the video needs a real number, write [REAL NUMBER NEEDED] instead of making one up. ™ not ®. No emoji.",
    part === "titles" ? "Return only title_options (10) and thumbnail_ideas (4)." : "Return title_options (10, under 70 characters, curiosity without clickbait), thumbnail_ideas (4, each: big text + visual), hook (the first 15 seconds, spoken), script (spoken script with [B-ROLL] / [SCREEN] cues), chapters (timestamped, first is 0:00), and shorts (3-5 clip ideas: title, hook, which part of the script).",
  ].filter(Boolean).join("\n\n"), {
    type: "object",
    properties: {
      title_options: { type: "array", items: { type: "string" } },
      thumbnail_ideas: { type: "array", items: { type: "string" } },
      hook: { type: "string" },
      script: { type: "string" },
      chapters: { type: "array", items: { type: "object", properties: { t: { type: "string" }, label: { type: "string" } } } },
      shorts: { type: "array", items: { type: "object", properties: { title: { type: "string" }, hook: { type: "string" }, timestamp: { type: "string" } } } },
    },
  });
  return {
    title_options: (res?.title_options || []).map(stripEmoji).slice(0, 10),
    thumbnail_ideas: (res?.thumbnail_ideas || []).map(stripEmoji).slice(0, 6),
    hook: stripEmoji(res?.hook),
    script: String(res?.script || "").trim(),
    chapters: (res?.chapters || []).slice(0, 20),
    shorts: (res?.shorts || []).slice(0, 5).map((s) => ({ ...s, title: stripEmoji(s.title), status: "idea" })),
  };
}

export const LINKEDIN_POST_URLS = { linkedin_company: LINKS.linkedin_company_admin, linkedin_personal: LINKS.linkedin_personal_feed };
