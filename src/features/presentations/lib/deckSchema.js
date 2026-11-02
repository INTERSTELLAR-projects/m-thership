// The one JSON slide schema every generator speaks: the in-app quick draft (Core.InvokeLLM),
// the Claude Queue job (result_data.deck) and the deck chat. What comes back lands as an editable deck.
import { base44 } from "@/api/base44Client";
import { SLIDE_THEMES } from "@/features/presentations/lib/slideThemes";

export const LAYOUT_IDS = ["cover", "section", "bullets", "list", "compare", "split", "image", "stats", "bigstat", "quote", "timeline", "pricing", "closing"];
export const THEME_IDS = [...SLIDE_THEMES.map((t) => t.id), "custom"];
export const INTERSTELLAR_GRADIENT = ["#ff3c00", "#ff6a00", "#ffaa00"];

const str = { type: "string" };
export const SLIDE_JSON_SCHEMA = {
  type: "object",
  properties: {
    layout: { type: "string", enum: LAYOUT_IDS },
    eyebrow: str,
    title: str,
    subtitle: str,
    body: str,
    bullets: { type: "array", items: str },
    stats: { type: "array", items: { type: "object", properties: { value: str, label: str } } },
    steps: { type: "array", items: { type: "object", properties: { label: str, text: str } } },
    columns: { type: "array", items: { type: "object", properties: { heading: str, text: str } } },
    offers: {
      type: "array",
      items: { type: "object", properties: { name: str, price: str, period: str, description: str, features: { type: "array", items: str }, highlighted: { type: "boolean" } } }
    },
    attribution: str,
    image_prompt: str,
    image_url: str,
    needs_visual: { type: "boolean" },
    notes: str
  },
  required: ["layout", "title"]
};

export const DECK_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: str,
    subtitle: str,
    summary: str,
    theme: { type: "string", enum: THEME_IDS },
    brand: {
      type: "object",
      properties: { bg: str, fg: str, accent: str, mode: { type: "string", enum: ["light", "dark"] }, headingFont: { type: "string", enum: ["sans", "serif"] } }
    },
    slides: { type: "array", items: SLIDE_JSON_SCHEMA }
  },
  required: ["title", "slides"]
};

export const LAYOUT_GUIDE = [
  "cover: first slide only. title, subtitle (the outcome), eyebrow (context). needs_visual optional.",
  "section: a chapter divider. eyebrow like \"02 · Approach\", a big title, one-line subtitle.",
  "bullets: title + 3–4 bullets. The workhorse.",
  "list: 5–6 short bullets shown as a numbered index (agenda, topics).",
  "compare: exactly two columns [{heading, text}] where text is 2–3 lines separated by \\n (before/after, us vs them).",
  "split: image + text. title + 3–4 bullets, needs_visual true, image_prompt set.",
  "image: full-bleed visual with a short title + subtitle. needs_visual true. Use sparingly.",
  "stats: 2–4 figures in stats [{value, label}] like \"87%\", \"$4.2M\", \"3.1x\".",
  "bigstat: ONE huge figure in stats[0] {value, label}; subtitle gives the context or source.",
  "quote: body holds one line (max 22 words); attribution holds the source's ROLE, never an invented named person.",
  "timeline: 3–4 steps [{label, text}] (\"Week 1\", \"Phase 2\").",
  "pricing: 1–3 offers [{name, price, period, description, features[], highlighted}]; mark the recommended one highlighted. Use real prices only when the brief gives them.",
  "closing: one decisive statement in body; the next step in subtitle."
];

export const DECK_RULES = [
  "Titles 2–7 words, specific and confident. Never \"Overview\", \"Introduction\", \"Conclusion\" or \"Thank you\".",
  "Bullets: at most 4, each under 12 words, each a real claim or fact.",
  "No placeholder text, brackets, TBD or lorem ipsum. No em dashes in slide copy.",
  "Never invent numbers, prices, quotes or results. If a figure is not in the brief, do not use one (use a qualitative point instead).",
  "notes: one or two sentences the presenter would actually say on that slide.",
  "image_prompt: 15–30 words describing subject, medium, composition and palette. No text, logos, charts or real people in images. At most 4 slides with needs_visual true.",
  "Vary layouts across the deck. Slide 1 is cover; the last is closing.",
  "Theme: default \"interstellar\" (Interstellar Strategies: warm off-white, ink text, brand gradient #ff3c00 → #ff6a00 → #ffaa00, never gold or yellow) or \"interstellar-dark\". For a client-branded deck use theme \"custom\" with brand {bg, fg, accent, mode, headingFont} from the client's real colours."
];

/* ---------------- normalise ---------------- */

const t = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const l = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const newId = () => (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : "sl-" + Math.random().toString(36).slice(2, 10));

export function normalizeSlide(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const layout = LAYOUT_IDS.includes(s.layout) ? s.layout : s.layout === "two-column" ? "compare" : s.layout === "image-text" ? "split" : "bullets";
  return {
    id: t(s.id, 60) || newId(),
    layout,
    eyebrow: t(s.eyebrow, 80),
    title: t(s.title, 140),
    subtitle: t(s.subtitle, 260),
    body: t(s.body, 700),
    bullets: l(s.bullets, 8).map((b) => t(b, 200)).filter(Boolean),
    stats: l(s.stats, 4).map((x) => ({ value: t(x && x.value, 24), label: t(x && x.label, 120) })).filter((x) => x.value || x.label),
    steps: l(s.steps, 6).map((x) => ({ label: t(x && x.label, 40), text: t(x && x.text, 180) })).filter((x) => x.label || x.text),
    columns: l(s.columns, 2).map((x) => ({ heading: t(x && x.heading, 80), text: t(x && x.text, 460) })).filter((x) => x.heading || x.text),
    offers: l(s.offers, 3).map((x) => ({
      name: t(x && x.name, 60),
      price: t(x && x.price, 30),
      period: t(x && x.period, 30),
      description: t(x && x.description, 200),
      features: l(x && x.features, 8).map((f) => t(f, 120)).filter(Boolean),
      highlighted: Boolean(x && x.highlighted)
    })).filter((x) => x.name || x.price),
    attribution: t(s.attribution, 140),
    image_prompt: t(s.image_prompt, 400),
    image_url: /^https?:\/\//.test(t(s.image_url, 800)) ? t(s.image_url, 800) : "",
    needs_visual: s.needs_visual === true,
    notes: t(s.notes, 900)
  };
}

const hex = (v, fb) => (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v || "").trim()) ? String(v).trim() : fb);

export function normalizeDeck(raw) {
  let d = raw;
  if (typeof d === "string") {
    try { d = JSON.parse(d); } catch { d = null; }
  }
  if (d && d.deck && Array.isArray(d.deck.slides)) d = d.deck;
  if (!d || !Array.isArray(d.slides) || !d.slides.length) throw new Error("No slides came back.");
  const theme = THEME_IDS.includes(d.theme) ? d.theme : "interstellar";
  const b = d.brand && typeof d.brand === "object" ? d.brand : null;
  return {
    title: t(d.title, 160) || "Untitled deck",
    subtitle: t(d.subtitle, 260),
    summary: t(d.summary, 300),
    theme: theme === "custom" && !b ? "interstellar" : theme,
    brand: theme === "custom" && b ? { bg: hex(b.bg, "#111111"), fg: hex(b.fg, "#F7F4EF"), accent: hex(b.accent, "#ff3c00"), mode: b.mode === "light" ? "light" : "dark", headingFont: b.headingFont === "serif" ? "serif" : "sans" } : null,
    slides: d.slides.slice(0, 24).map(normalizeSlide)
  };
}

/* ---------------- brief ---------------- */

const safeList = (p) => Promise.resolve(p).then((r) => (Array.isArray(r) ? r : (r && r.items) || [])).catch(() => []);

// Everything Møthership knows about the client that a deck can use (real facts only).
export async function clientFacts(clientId) {
  if (!clientId) return null;
  const [client, dossiers, kits] = await Promise.all([
    base44.entities.CRMClient.get(clientId).catch(() => null),
    safeList(base44.entities.ClientDossier.filter({ client_id: clientId }, "-updated_date", 1)),
    safeList(base44.entities.BrandKit.filter({ client_id: clientId, status: "approved" }, "-created_date", 1))
  ]);
  if (!client) return null;
  const d = dossiers[0] || {};
  const kit = kits[0] || null;
  const bi = d.brand_identity || {};
  const palette = kit && kit.kit && Array.isArray(kit.kit.palette) ? kit.kit.palette.map((p) => (typeof p === "string" ? p : p && p.hex)).filter(Boolean) : [];
  return {
    id: client.id,
    business: client.business,
    lines: [
      ["Business", client.business],
      ["Industry", client.industry],
      ["Location", client.location],
      ["Website", client.domain || (client.websites || [])[0]],
      ["Plan with us", client.plan],
      ["Pitch", d.elevator_pitch],
      ["Why them", d.usp],
      ["Tagline", d.tagline],
      ["Services", (d.services || []).map((s) => s && s.name).filter(Boolean).slice(0, 12).join(", ")],
      ["Service area", d.service_area && (d.service_area.primary_city || d.service_area.radius)],
      ["Competitors", (d.competitors || []).map((c) => c && c.name).filter(Boolean).slice(0, 6).join(", ")],
      ["Brand colours", (bi.colors || palette).join(", ")],
      ["Brand fonts", bi.fonts],
      ["Logo", client.logo_url || bi.logo_url]
    ].filter(([, v]) => v),
    colors: bi.colors && bi.colors.length ? bi.colors : palette
  };
}

export const LOOKS = [
  { id: "interstellar", label: "Interstellar (light)" },
  { id: "interstellar-dark", label: "Interstellar (dark)" },
  { id: "client", label: "Client brand colours" },
  { id: "auto", label: "Let the writer choose" }
];

export function buildBrief({ topic, audience, goals, slideCount, tone, look, extra, facts, includePricing }) {
  const lines = [];
  lines.push("# Deck brief", "", "## Topic", topic || "(none)");
  if (audience) lines.push("", "## Audience", audience);
  if (goals) lines.push("", "## What this deck must achieve", goals);
  lines.push("", "## Shape", `About ${slideCount || 10} slides. Tone: ${tone || "Clear and confident"}.`);
  if (includePricing) lines.push("Include a pricing / offer slide (layout \"pricing\"). Use only prices given in this brief.");
  lines.push("", "## Look");
  if (look === "client" && facts && facts.colors && facts.colors.length) lines.push(`Client-branded: theme "custom" built from these real colours: ${facts.colors.join(", ")}.`);
  else if (look === "interstellar-dark") lines.push('Theme "interstellar-dark".');
  else if (look === "auto") lines.push("Pick the best-fitting theme; prefer interstellar.");
  else lines.push('Theme "interstellar" (Interstellar Strategies brand gradient #ff3c00 → #ff6a00 → #ffaa00, never gold).');
  if (facts) {
    lines.push("", "## Client facts (from Møthership CRM — use only these, invent nothing)");
    facts.lines.forEach(([k, v]) => lines.push(`- ${k}: ${v}`));
  }
  if (extra) lines.push("", "## Justin added", extra);
  return lines.join("\n");
}

export function generationPrompt(brief) {
  return [
    "You are Interstellar Strategies' presentation architect: a senior strategist and an award-winning slide designer. Write a polished, client-ready deck from the brief.",
    "",
    "## Layouts",
    ...LAYOUT_GUIDE.map((x) => "- " + x),
    "",
    "## Rules",
    ...DECK_RULES.map((x) => "- " + x),
    "",
    "Return JSON only, matching the schema: {title, subtitle, summary, theme, brand, slides:[{layout, eyebrow, title, subtitle, body, bullets, stats, steps, columns, offers, attribution, image_prompt, needs_visual, notes}]}.",
    "",
    brief
  ].join("\n");
}

// The ClaudeJob instructions: same brief + the schema the result must land in.
export function claudeDeckInstructions(brief, presentationId) {
  return [
    generationPrompt(brief),
    "",
    "## Where the result goes",
    `This job fills Møthership Presentation ${presentationId} (Base44 app 69d80bb06c5ad07a795df54e).`,
    "Do NOT write to the Presentation yourself. Put the whole deck in this ClaudeJob's result_data as:",
    "result_data = { \"deck\": { \"title\", \"subtitle\", \"summary\", \"theme\", \"brand\", \"slides\": [ ... ] } }",
    "Every slide object uses exactly these keys (empty string / empty array when unused):",
    "```json",
    JSON.stringify({ layout: "bullets", eyebrow: "", title: "", subtitle: "", body: "", bullets: [], stats: [{ value: "", label: "" }], steps: [{ label: "", text: "" }], columns: [{ heading: "", text: "" }], offers: [{ name: "", price: "", period: "", description: "", features: [], highlighted: false }], attribution: "", image_prompt: "", image_url: "", needs_visual: false, notes: "" }, null, 2),
    "```",
    `layout is one of: ${LAYOUT_IDS.join(", ")}. theme is one of: ${THEME_IDS.join(", ")}.`,
    "You may research the client's live site for real facts. Anything you could not confirm goes in needs_from_justin, not on a slide.",
    "When the deck is in result_data, write result_summary (one sentence), result_body (a short slide-by-slide outline in markdown), status = needs_approval, finished_at = now. Justin loads it into the editor from the deck page."
  ].join("\n");
}

/* ---------------- Claude Queue landing ---------------- */

export const isDeckJob = (job) => Boolean(job && job.context && job.context.target === "presentation" && job.context.presentation_id);
export const deckFromJob = (job) => {
  const rd = job && job.result_data;
  if (!rd) return null;
  try {
    return normalizeDeck(rd.deck || rd);
  } catch {
    return null;
  }
};

// Approving a deck job (from the queue or the deck page) lands it on its Presentation. A deck Justin
// already edited is never overwritten: the draft is only written while the deck is still waiting.
export async function saveApprovedDeck(job) {
  const deck = deckFromJob(job);
  if (!deck) return false;
  const id = job.context.presentation_id;
  const current = await base44.entities.Presentation.get(id).catch(() => null);
  if (!current) return false;
  const waiting = !(current.slides || []).length || current.generation_status === "waiting_claude";
  if (!waiting) return false;
  await base44.entities.Presentation.update(id, {
    title: deck.title,
    subtitle: deck.subtitle,
    summary: deck.summary,
    theme: deck.theme,
    brand: deck.brand,
    slides: deck.slides,
    generation_status: "ready",
    generated_by: "claude_queue"
  });
  return true;
}

// In-app quick draft through Core.InvokeLLM with the same schema.
export async function quickDraft(brief) {
  const out = await base44.integrations.Core.InvokeLLM({ prompt: generationPrompt(brief), response_json_schema: DECK_JSON_SCHEMA });
  return normalizeDeck(out);
}
