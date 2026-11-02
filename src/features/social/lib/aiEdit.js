import { base44 } from "@/api/base44Client";
import { brandBrief } from "../brand";
import { getTemplate, TEMPLATE_SCHEMA } from "../templates";

// "Edit with AI" and "Generate variations": Core.InvokeLLM gets the brand rules, the template's
// schema and the current spec, and returns a modified spec. The spec comes back as a JSON
// string (spec_json) so template-specific mock shapes survive strict structured output.

function templateBrief(key) {
  const t = getTemplate(key);
  return JSON.stringify({ key: t.key, label: t.label, description: t.description, spec_common: TEMPLATE_SCHEMA.spec_common, mock: t.mock }, null, 1);
}

function parseSpec(raw) {
  if (raw && typeof raw === "object") return raw;
  const text = String(raw || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  return JSON.parse(text);
}

const stripEmoji = (s) => String(s).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{FE0F}]/gu, "").replace(/\s{2,}/g, " ").trim();

function cleanSpec(next, prev) {
  const out = { ...prev, ...next, mock: { ...(prev?.mock || {}), ...(next?.mock || {}) } };
  for (const k of ["eyebrow", "headline", "accent_word", "subhead", "body", "cta"]) if (typeof out[k] === "string") out[k] = stripEmoji(out[k]);
  if (!["light", "dark"].includes(out.theme)) out.theme = prev?.theme || "light";
  if (!["interstellar", "mothership", "none"].includes(out.lockup)) out.lockup = prev?.lockup || "interstellar";
  return out;
}

export async function editSpecWithAi({ template, spec, instruction }) {
  const prompt = [
    "You edit structured specs for 1080x1080 social posts that are rendered by a fixed React template. You never design images; you only change text and data fields in the spec.",
    brandBrief(),
    `Template schema:\n${templateBrief(template)}`,
    `Current spec (JSON):\n${JSON.stringify(spec, null, 1)}`,
    `Instruction from Justin: "${instruction}"`,
    [
      "Rules:",
      "- Change only what the instruction asks for. Keep every other field exactly as it is.",
      "- Respect the max lengths in the schema; the layout breaks if text is too long.",
      "- accent_word must appear verbatim inside headline (or be an empty string).",
      "- Keep fictional businesses fictional. No emoji. No invented results or testimonials; numbers that are not real must stay labeled as sample or hypothetical.",
      "- Return the COMPLETE updated spec as a JSON string in spec_json, plus a one-sentence summary of what changed in note.",
    ].join("\n"),
  ].join("\n\n");
  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: { type: "object", properties: { spec_json: { type: "string" }, note: { type: "string" } }, required: ["spec_json"] },
  });
  const next = parseSpec(res?.spec_json);
  return { spec: cleanSpec(next, spec), note: res?.note || "" };
}

export async function generateVariations({ template, spec, count = 3 }) {
  const prompt = [
    "Write alternative hooks for a 1080x1080 social post. Same idea and audience, different angle each time.",
    brandBrief(),
    `Template: ${getTemplate(template).label}. Headline max 72 chars, accent_word max 24 chars and must appear verbatim in the headline, subhead max 140 chars.`,
    `Current: headline "${spec?.headline || ""}", accent "${spec?.accent_word || ""}", subhead "${spec?.subhead || ""}".`,
    `Return exactly ${count} variations. No emoji.`,
  ].join("\n\n");
  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        variations: {
          type: "array",
          items: { type: "object", properties: { headline: { type: "string" }, accent_word: { type: "string" }, subhead: { type: "string" }, angle: { type: "string" } }, required: ["headline"] },
        },
      },
      required: ["variations"],
    },
  });
  return (res?.variations || []).slice(0, count).map((v) => ({
    headline: stripEmoji(v.headline || ""),
    accent_word: v.accent_word && String(v.headline || "").toLowerCase().includes(String(v.accent_word).toLowerCase()) ? stripEmoji(v.accent_word) : "",
    subhead: stripEmoji(v.subhead || ""),
    angle: v.angle || "",
  }));
}

export async function writeCaptions({ template, spec, pillar }) {
  const prompt = [
    "Write social captions for this post image.",
    brandBrief(),
    `Pillar: ${pillar || "unspecified"}. Template: ${getTemplate(template).label}.`,
    `Post spec:\n${JSON.stringify(spec, null, 1)}`,
    "caption: for Instagram/Facebook/X/TikTok. Hook line, 2-4 short lines, a clear CTA, then 3-6 relevant hashtags on the last line. Under 600 characters.",
    "caption_linkedin: same idea, slightly longer and more reflective, 3-5 hashtags at the end, under 1200 characters.",
    "alt_text: plain description of the image for screen readers, under 250 characters.",
    "No emoji anywhere.",
  ].join("\n\n");
  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: { type: "object", properties: { caption: { type: "string" }, caption_linkedin: { type: "string" }, alt_text: { type: "string" } }, required: ["caption", "caption_linkedin", "alt_text"] },
  });
  return { caption: stripEmoji(res?.caption || ""), caption_linkedin: stripEmoji(res?.caption_linkedin || ""), alt_text: stripEmoji(res?.alt_text || "") };
}

/* ─── diff ──────────────────────────────────────────────────────────── */
function flatten(obj, prefix = "", out = {}) {
  if (Array.isArray(obj)) {
    if (obj.every((v) => v === null || typeof v !== "object")) out[prefix] = obj.join(" · ");
    else obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else out[prefix] = obj;
  return out;
}

/** [{ path, before, after }] for every changed leaf. */
export function specDiff(before, after) {
  const a = flatten(before || {});
  const b = flatten(after || {});
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  return keys
    .filter((k) => String(a[k] ?? "") !== String(b[k] ?? ""))
    .map((k) => ({ path: k, before: a[k], after: b[k] }));
}
