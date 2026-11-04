import { invokeAI } from "@/lib/aiGateway";
import { brandBrief, HOOKS, hookBrief, SEARCH } from "../brand";
import { PLATFORM, formatOf } from "./platforms";
import { fmtTs } from "./transcript";

// Claude for the content engine. Client brands go through the ai-gateway with client_id + studio "social", so the
// call is metered against that client (admin calls are recorded, never capped). Interstellar uses the same helper,
// which falls back to Base44 InvokeLLM for Justin's own work when the gateway has no key.

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{FE0F}]/gu;
const clean = (s, { emoji = false } = {}) => {
  let t = String(s || "").replace(/®/g, "™");
  if (!emoji) t = t.replace(EMOJI, "");
  return t.replace(/[ \t]{2,}/g, " ").trim();
};
const call = (brand, prompt, schema, { tier = "routine", feature }) =>
  invokeAI({ prompt, response_json_schema: schema, tier, feature, ...(brand.isInterstellar ? {} : { client_id: brand.key, studio: "social" }) });

function guideBlock(brand, knowledge) {
  const g = brand.guide || {};
  const list = (a) => (Array.isArray(a) && a.length ? a.join(", ") : "(none given)");
  return [
    brand.isInterstellar ? brandBrief() : `Brand: ${brand.name}${g.website ? ` (${g.website})` : ""}. Audience: ${g.audience || "(not given)"}.`,
    `## Voice Guide for ${brand.name}`,
    `Tone: ${g.tone || "(not set: write plainly and specifically)"}`,
    `Words to use: ${list(g.words_use)}`,
    `Words to avoid: ${list(g.words_avoid)}`,
    g.examples?.length ? `Example lines in this voice:\n- ${g.examples.join("\n- ")}` : "",
    `Default CTA: ${g.cta_default || "(choose one fitting CTA)"}`,
    `Emoji: ${g.emoji_ok ? "allowed sparingly" : "none"}`,
    g.keywords?.length ? `Search phrases for this brand: ${g.keywords.join("; ")}` : "",
    // brandBrief() already carries the Triple Hook rules for Interstellar; the Agency knowledge version wins when loaded.
    brand.isInterstellar && !knowledge?.hooks ? "" : hookBrief(knowledge?.hooks),
    knowledge?.social_search?.data?.rules ? `Social search playbook (Agency knowledge):\n- ${knowledge.social_search.data.rules.join("\n- ")}` : `Social search rules:\n- ${SEARCH.rules.join("\n- ")}`,
    "Hard rules: never invent results, statistics, testimonials, reviews, client names or numbers; a number you don't have becomes [REAL NUMBER NEEDED]. The trademark sign is ™, never ®.",
  ].filter(Boolean).join("\n\n");
}

const tripleHook = { type: "object", properties: { context: { type: "string" }, lean: { type: "string" }, snapback: { type: "string" }, full: { type: "string" } } };

/** Step 1: CAPTURE → hook bank, 3 Triple Hooks, quotes, carousel outline, clip cut list, the one visual. */
export async function extractIdea({ brand, idea, knowledge }) {
  const segs = Array.isArray(idea.transcript_segments) ? idea.transcript_segments : [];
  const transcript = segs.length
    ? segs.map((s) => `[${fmtTs(s.start)}–${fmtTs(s.end)}] ${s.text}`).join("\n").slice(0, 60000)
    : String(idea.source_text || "").slice(0, 40000);
  const res = await call(brand, [
    `You turn ONE idea into a content batch for ${brand.name}. You only draft; a human approves everything.`,
    guideBlock(brand, knowledge),
    `## Source (${idea.source_type})`,
    idea.source_url ? `Link: ${idea.source_url}${idea.source_meta?.title ? ` · "${idea.source_meta.title}"${idea.source_meta.author ? ` by ${idea.source_meta.author}` : ""}` : ""}` : "",
    transcript ? `${segs.length ? "Timestamped transcript" : "Notes / text"}:\n${transcript}` : "(No transcript or notes: work only from the link title above and say so in summary.)",
    "## Return",
    "summary (2 sentences), primary_keyword (the phrase people would search), secondary_keyword,",
    "hooks: 10 one-line hooks (keyword-first, no clickbait, no invented numbers),",
    `triple_hooks: EXACTLY 3 Triple Hook variants (${HOOKS.name}): context = line 1 that states the topic and contains the primary_keyword; lean = the curiosity line; snapback = the contrarian turn; full = the three joined as they'd be said/written,`,
    "quotes: up to 8 quotable lines taken from the source (verbatim when a transcript exists),",
    "carousel: { title, slides: 5-8 × { heading (≤8 words), body (≤30 words) } } where slide 1 is the hook and the last slide is the CTA,",
    segs.length
      ? "clips: 3-6 short-clip cuts ONLY from the transcript above: start and end as m:ss copied from the transcript timestamps (15-60 seconds each), label, hook (on-screen text), why it works."
      : "clips: 0-3 clip ideas WITHOUT timestamps (start and end empty) because there is no timestamped transcript.",
    "visual: { eyebrow (2-4 words), headline (the search phrase or a direct answer, ≤12 words), accent_word (2-3 words from the headline), subhead (≤18 words), cta }",
    "ideas_next: 3 follow-up post ideas.",
  ].filter(Boolean).join("\n\n"), {
    type: "object",
    properties: {
      summary: { type: "string" }, primary_keyword: { type: "string" }, secondary_keyword: { type: "string" },
      hooks: { type: "array", items: { type: "string" } },
      triple_hooks: { type: "array", items: tripleHook },
      quotes: { type: "array", items: { type: "string" } },
      carousel: { type: "object", properties: { title: { type: "string" }, slides: { type: "array", items: { type: "object", properties: { heading: { type: "string" }, body: { type: "string" } } } } } },
      clips: { type: "array", items: { type: "object", properties: { start: { type: "string" }, end: { type: "string" }, label: { type: "string" }, hook: { type: "string" }, why: { type: "string" } } } },
      visual: { type: "object", properties: { eyebrow: { type: "string" }, headline: { type: "string" }, accent_word: { type: "string" }, subhead: { type: "string" }, cta: { type: "string" } } },
      ideas_next: { type: "array", items: { type: "string" } },
    },
    required: ["hooks", "triple_hooks", "visual"],
  }, { tier: transcript.length > 12000 ? "long" : "routine", feature: "social_capture" });

  const emoji = !!brand.guide?.emoji_ok;
  const c = (s) => clean(s, { emoji });
  // Timestamps must exist in the transcript; anything outside it is dropped rather than shown as fact.
  const maxT = segs.length ? Math.max(...segs.map((s) => Number(s.end) || 0)) : 0;
  const toSec = (t) => { const p = String(t || "").split(":").map(Number); return !t || p.some(isNaN) ? NaN : p.reduce((a, n) => a * 60 + n, 0); };
  const clips = (res?.clips || []).slice(0, 6).map((k) => ({ ...k, label: c(k.label), hook: c(k.hook), why: c(k.why) })).map((k) => {
    if (!segs.length) return { ...k, start: "", end: "" };
    const s = toSec(k.start), e = toSec(k.end);
    return Number.isFinite(s) && Number.isFinite(e) && s >= 0 && e > s && e <= maxT + 1 ? k : { ...k, start: "", end: "", note: "timestamp not in transcript" };
  });
  return {
    summary: c(res?.summary), primary_keyword: c(res?.primary_keyword), secondary_keyword: c(res?.secondary_keyword),
    hooks: (res?.hooks || []).map(c).filter(Boolean).slice(0, 12),
    triple_hooks: (res?.triple_hooks || []).slice(0, 3).map((h) => ({ context: c(h.context), lean: c(h.lean), snapback: c(h.snapback), full: c(h.full || [h.context, h.lean, h.snapback].join(" ")) })),
    quotes: (res?.quotes || []).map(c).filter(Boolean).slice(0, 8),
    carousel: { title: c(res?.carousel?.title), slides: (res?.carousel?.slides || []).slice(0, 10).map((s) => ({ heading: c(s.heading), body: c(s.body) })) },
    clips,
    visual: Object.fromEntries(Object.entries(res?.visual || {}).map(([k, v]) => [k, c(v)])),
    ideas_next: (res?.ideas_next || []).map(c).filter(Boolean).slice(0, 5),
  };
}

const GBP_PHONE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
const STREET = /\b\d{2,6}\s+[A-Z][\w.]*(\s+[A-Z][\w.]*)*\s+(St|Street|Ave|Avenue|Rd|Road|Blvd|Dr|Drive|Ln|Lane|Hwy|Highway|Way|Ct|Court)\b/;
const URLISH = /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+\.(com|net|org|co|io|biz|us)(\/\S*)?\b/gi;

/** Enforce per-platform rules on generated text. Returns { text, warnings }. */
export function enforce(platform, text, { emoji = false } = {}) {
  let t = clean(text, { emoji });
  const warnings = [];
  if (platform === "gbp") {
    if (t.match(GBP_PHONE)) { t = t.replace(GBP_PHONE, "").trim(); warnings.push("Removed a phone number (GBP posts never carry one)."); }
    if (t.match(URLISH)) { t = t.replace(URLISH, "").trim(); warnings.push("Removed a URL (the Learn more button is the only link)."); }
    if (STREET.test(t)) warnings.push("Looks like a street address: GBP post copy never carries one. Remove it.");
  }
  const max = PLATFORM[platform]?.text_max;
  const len = platform === "x" || platform === "threads" ? [...t].length : t.length;
  if (max && len > max) warnings.push(`${len} characters; ${PLATFORM[platform].label} allows ${max}.`);
  const tags = (t.match(/#[\p{L}\p{N}_]+/gu) || []).length;
  const maxTags = (PLATFORM[platform]?.hashtags || [0, 5])[1];
  if (tags > maxTags) warnings.push(`${tags} hashtags; aim for ${maxTags || "none"} on ${PLATFORM[platform].label}.`);
  return { text: t, warnings };
}

/** Step 2: VOICE → one draft per platform/format in that platform's register. */
export async function draftVariants({ brand, idea, targets, knowledge }) {
  const ex = idea.extraction || {};
  const g = brand.guide || {};
  const lines = targets.map((t) => {
    const p = PLATFORM[t.platform];
    const f = formatOf(t.platform, t.format);
    return `- id "${t.id}": ${p.label}${t.account_label ? ` (${t.account_label})` : ""} · ${f.label}. Register: ${g.registers?.[t.platform] || p.register} Search: ${p.search} Max ${p.text_max} characters${p.title_max ? `, title ≤ ${p.title_max}` : ""}. Hashtags ${p.hashtags[0]}-${p.hashtags[1]}.${f.video ? " Include a spoken script (hook line in the first 3 seconds = the Triple Hook context line, then lean, snapback, payoff, CTA) with [ON-SCREEN] cues." : ""}${t.platform === "gbp" ? " No phone number, no street address, no URL in the text." : ""}${t.platform === "reddit" ? " Title as a question; no marketing tone; disclose who is posting." : ""}`;
  });
  const res = await call(brand, [
    `Write the platform posts for ONE idea for ${brand.name}. Same idea everywhere, adapted to each platform's register and limits. Drafts only.`,
    guideBlock(brand, knowledge),
    `## The idea\n${ex.summary || idea.title || ""}\nPrimary search phrase: ${ex.primary_keyword || "(pick one)"}${ex.secondary_keyword ? ` · secondary: ${ex.secondary_keyword}` : ""}`,
    ex.triple_hooks?.length ? `Triple Hooks to open with (use one per post, adapted; line 1 must state the topic with the search phrase):\n- ${ex.triple_hooks.map((h) => h.full).join("\n- ")}` : "",
    ex.quotes?.length ? `Quotable lines:\n- ${ex.quotes.slice(0, 5).join("\n- ")}` : "",
    ex.carousel?.slides?.length ? `Carousel outline: ${ex.carousel.slides.map((s, i) => `${i + 1}. ${s.heading}`).join(" / ")}` : "",
    g.website ? `Link for posts that take one: ${g.website}` : "",
    `## Targets (return one post per id)\n${lines.join("\n")}`,
    "Each post: id, title (YouTube/Pinterest/Reddit/TikTok only), text (the full post including the hook first and hashtags at the end where used), hashtags (array), alt_text (≤125 characters: what's in the image + the keyword), script (video formats only).",
  ].filter(Boolean).join("\n\n"), {
    type: "object",
    properties: {
      posts: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, text: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, alt_text: { type: "string" }, script: { type: "string" } } } },
    },
    required: ["posts"],
    // Fuel routing (2026-11-04): per-platform captions + hashtags are short rewrites of an already-extracted idea, so
    // they run on Haiku however many platforms are picked (was Sonnet above 6 targets). A big batch (7+) that also
    // needs spoken video scripts stays on Sonnet, as before.
  }, { tier: targets.length > 6 && targets.some((t) => formatOf(t.platform, t.format)?.video) ? "long" : "routine", feature: "social_variants" });
  const emoji = !!g.emoji_ok;
  return (res?.posts || []).map((p) => {
    const t = targets.find((x) => x.id === p.id);
    if (!t) return null;
    const e = enforce(t.platform, p.text, { emoji });
    return { id: p.id, title: clean(p.title, { emoji }).slice(0, PLATFORM[t.platform]?.title_max || 200), text: e.text, warnings: e.warnings, hashtags: (p.hashtags || []).map((h) => clean(h)).slice(0, 6), alt_text: clean(p.alt_text).slice(0, 300), script: String(p.script || "").replace(/®/g, "™").trim() };
  }).filter(Boolean);
}

/** Step 6: LEARN → takeaways + idea bank from REAL numbers only. Returns null when there is no data. */
export async function digestTakeaways({ brand, digest, knowledge }) {
  if (!digest?.data_points) return null;
  const res = await call(brand, [
    `Weekly social digest for ${brand.name}, week of ${digest.week_start}. Use ONLY the numbers below; do not estimate, extrapolate or invent any figure. If a platform has too little data, say so.`,
    `Per platform (posts, posts with data, totals, top post):\n${JSON.stringify(digest.per_platform).slice(0, 12000)}`,
    guideBlock(brand, knowledge),
    "Return summary (3 sentences max), double_down (3-5 specific moves, each naming the platform and the post/format it's based on), ideas (5 new post ideas: title, why (tied to what worked), platforms[] using these ids: instagram, facebook, youtube, linkedin, tiktok, threads, x, pinterest, gbp, discord, telegram, reddit, whatsapp).",
  ].join("\n\n"), {
    type: "object",
    properties: {
      summary: { type: "string" },
      double_down: { type: "array", items: { type: "string" } },
      ideas: { type: "array", items: { type: "object", properties: { title: { type: "string" }, why: { type: "string" }, platforms: { type: "array", items: { type: "string" } } } } },
    },
  }, { tier: "routine", feature: "social_digest" });
  return { summary: clean(res?.summary), double_down: (res?.double_down || []).map((s) => clean(s)).slice(0, 5), ideas: (res?.ideas || []).slice(0, 6).map((i) => ({ title: clean(i.title), why: clean(i.why), platforms: (i.platforms || []).filter((k) => PLATFORM[k]) })) };
}

/** Triple Hook hint for the review queue: does line 1 state the topic (contain the search phrase)? */
export function hookHints(text, keyword) {
  const first = String(text || "").split("\n").find((l) => l.trim()) || "";
  const kw = String(keyword || "").toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const hits = kw.filter((w) => first.toLowerCase().includes(w)).length;
  return { first, context_likely: kw.length ? hits / kw.length >= 0.5 : null };
}
