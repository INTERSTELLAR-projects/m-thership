// Decks made from approved client documents (industry playbook, brand kit). Reuses the one deck
// schema: an in-app quick draft (deckSchema.quickDraft) or a Claude Queue `presentation` job
// (claudeDeckJob.queueDeckJob). Client-branded when an approved brand kit exists, else Interstellar.
import { base44 } from "@/api/base44Client";
import { buildBrief, clientFacts, quickDraft } from "@/features/presentations/lib/deckSchema";
import { queueDeckJob } from "@/features/presentations/lib/claudeDeckJob";
import { playbookToMarkdown } from "@/features/claude/playbook";

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const normHex = (h) => {
  const s = String(h || "").trim();
  const v = s.startsWith("#") ? s : `#${s}`;
  return HEX.test(v) ? v : "";
};
const lum = (hex) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// Deck brand {bg, fg, accent, mode, headingFont} from an approved BrandKit's kit JSON (null if no usable palette).
export function brandFromKit(kit) {
  const palette = (kit && Array.isArray(kit.palette) ? kit.palette : []).map((p) => ({ ...p, hex: normHex(p && p.hex) })).filter((p) => p.hex);
  if (!palette.length) return null;
  const role = (r) => palette.find((p) => String(p.role || "").toLowerCase().includes(r));
  const accentC = role("primary") || role("accent") || palette[0];
  const bgC = role("background") || palette.filter((p) => p !== accentC).sort((a, b) => lum(b.hex) - lum(a.hex))[0];
  const bg = bgC ? bgC.hex : "#FFFFFF";
  const light = lum(bg) > 0.45;
  const textC = role("text");
  const fg = textC && Math.abs(lum(textC.hex) - lum(bg)) > 0.3 ? textC.hex : light ? "#111111" : "#F7F4EF";
  const heading = String((kit.typography && kit.typography.headings && (kit.typography.headings.family || kit.typography.headings)) || "");
  const serif = /serif|playfair|merriweather|lora|garamond|baskerville|fraunces|dm serif|libre/i.test(heading) && !/sans/i.test(heading);
  return { bg, fg, accent: accentC.hex, mode: light ? "light" : "dark", headingFont: serif ? "serif" : "sans" };
}

async function approvedKit(clientId) {
  const rows = await base44.entities.BrandKit.filter({ client_id: clientId, status: "approved" }, "-version", 1).catch(() => []);
  return (rows || [])[0] || null;
}

function lookLines(brand) {
  return brand
    ? `Use theme "custom" with exactly this brand object (from the client's approved brand kit): ${JSON.stringify(brand)}.`
    : 'Use theme "interstellar" (Interstellar Strategies: brand gradient #ff3c00 → #ff6a00 → #ffaa00, never gold or yellow).';
}

export async function playbookDeckBrief(client, record) {
  const [facts, kit] = await Promise.all([clientFacts(client.id), approvedKit(client.id)]);
  const brand = kit ? brandFromKit(kit.kit) : null;
  const pb = record.playbook || {};
  const pillars = (pb.pillars || []).map((p) => p.name).join(", ");
  const content = (record.body_md && record.body_md.length > 400 ? record.body_md : playbookToMarkdown(pb, client.business)).slice(0, 12000);
  const extra = [
    "This deck presents the client's APPROVED industry playbook. Use only what is in the playbook below; do not add new numbers or claims.",
    "Any figure marked est. or is_estimate stays labelled \"est.\" on the slide. Unknown figures are never filled in.",
    "",
    "## Required slide order",
    "1. cover: the playbook headline, subtitle = their goal and by when.",
    "2. compare: \"Where you are\" vs \"Where you're going\" (goal summary).",
    "3. bullets: the 2027 industry snapshot for their trade (what's working).",
    `4. One section per pillar (${pillars || "each pillar"}): a section divider OR a bullets slide per pillar with current state → target, what Interstellar is doing, what they do. Use stats only with real figures from the KPIs.`,
    "5. timeline: 30 / 60 / 90-day milestones (steps: Day 30, Day 60, Day 90).",
    "6. list: quick wins this month.",
    "7. bullets: recommended next services (the soft upsell, from next_services) and what to ignore.",
    "8. closing: the one decisive next step.",
    "",
    "## Look",
    lookLines(brand),
    "",
    "## The approved playbook",
    content,
  ].join("\n");
  const brief = buildBrief({
    topic: `${client.business}: 2027 Industry Playbook`,
    audience: `${client.business} owner${client.contact ? ` (${client.contact})` : ""}`,
    goals: "Walk the owner through their goal, the plan pillar by pillar, the 30/60/90 milestones and what they should do this month.",
    slideCount: Math.min(16, 8 + (pb.pillars || []).length),
    tone: "Clear and confident",
    look: brand ? "client" : "interstellar",
    facts,
    extra,
  });
  return { brief, brand, title: `${client.business} — 2027 Industry Playbook` };
}

export async function brandKitDeckBrief(client, record) {
  const facts = await clientFacts(client.id);
  const brand = brandFromKit(record.kit);
  const content = (record.body_md && record.body_md.length > 400 ? record.body_md : JSON.stringify(record.kit || {}, null, 1)).slice(0, 12000);
  const extra = [
    "This deck presents the client's APPROVED brand kit as brand guidelines. Use only what is in the kit below.",
    "",
    "## Required slide order",
    "1. cover: brand name + the brand essence.",
    "2. bullets: brand overview (mission, positioning, personality, audience).",
    "3. bullets or split: logo usage (variations, clear space, minimum size, backgrounds, misuse).",
    "4. stats or bullets: color palette with each colour's name and hex code and its role.",
    "5. compare: typography (headings vs body: family, weights, use).",
    "6. compare: voice — \"We say\" vs \"We never say\".",
    "7. quote: the primary tagline (attribution: \"Brand tagline\"), then bullets for key messages.",
    "8. bullets: imagery and applications.",
    "9. compare: Do vs Don't.",
    "10. closing.",
    "",
    "## Look",
    lookLines(brand),
    "",
    "## The approved brand kit",
    content,
  ].join("\n");
  const brief = buildBrief({
    topic: `${client.business} brand guidelines`,
    audience: `${client.business} team and anyone creating for the brand`,
    goals: "Make the brand kit easy to present and share: how the brand looks and sounds.",
    slideCount: 11,
    tone: "Clear and confident",
    look: brand ? "client" : "interstellar",
    facts,
    extra,
  });
  return { brief, brand, title: `${client.business} — Brand guidelines` };
}

// Create the Presentation and return its id. mode "quick" drafts it now; mode "claude" queues it.
export async function createDeckFromBrief({ client, brief, brand, title, mode, source }) {
  const base = {
    client_id: client.id,
    client_name: client.business,
    audience: `${client.business} owner`,
    tone: "Clear and confident",
    brief: { source, look: brand ? "client" : "interstellar" },
  };
  if (mode === "quick") {
    const deck = await quickDraft(brief);
    const theme = brand ? "custom" : ["interstellar", "interstellar-dark"].includes(deck.theme) ? deck.theme : "interstellar";
    const created = await base44.entities.Presentation.create({
      ...base,
      title: deck.title || title,
      subtitle: deck.subtitle,
      summary: deck.summary,
      theme,
      brand: brand || null,
      slides: deck.slides,
      prompt: brief,
      generated_by: "quick_draft",
      generation_status: "ready",
    });
    return created.id;
  }
  const created = await base44.entities.Presentation.create({
    ...base,
    title,
    prompt: brief,
    theme: brand ? "custom" : "interstellar",
    brand: brand || null,
    slides: [],
    generation_status: "waiting_claude",
  });
  const queued = await queueDeckJob({ presentationId: created.id, brief, meta: { client_id: client.id, client_name: client.business, audience: base.audience, tone: base.tone }, title });
  await base44.entities.Presentation.update(created.id, { claude_job_id: queued.id });
  return created.id;
}
