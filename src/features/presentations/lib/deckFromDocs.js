// Decks made from approved client documents (industry playbook, brand kit). Reuses the one deck
// schema: an in-app quick draft (deckSchema.quickDraft) or a Claude Queue `presentation` job
// (claudeDeckJob.queueDeckJob). Client-branded when an approved brand kit exists, else Interstellar.
import { base44 } from "@/api/base44Client";
import { buildBrief, clientFacts, generateDeck } from "@/features/presentations/lib/deckSchema";
import { queueDeckJob } from "@/features/presentations/lib/claudeDeckJob";
import { clientBrand, brandFromKit } from "@/features/presentations/lib/clientBrand";
import { playbookToMarkdown } from "@/features/claude/playbook";
import { socialPlanToMarkdown } from "@/features/claude/socialPlan";

// Kept for callers that import it from here. The v1 version matched palette roles on `role` only, so kits that
// name their colours ("Background", "Rein Gold") got a near-black accent on a pale background.
export { brandFromKit };

// The client's deck brand: approved brand kit first, then the Business Brain brand section, then the profile.
async function approvedBrand(clientId) {
  const { brand } = await clientBrand(clientId).catch(() => ({ brand: null }));
  return brand;
}

// The look is applied by the studio (client brand kit or Interstellar), so the writer never picks colours.
function lookLines() {
  return "The studio applies the brand colours, fonts and logo automatically. Do not describe colours or fonts on slides unless the deck is about the brand itself.";
}

export async function playbookDeckBrief(client, record) {
  const [facts, brand] = await Promise.all([clientFacts(client.id), approvedBrand(client.id)]);
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
    "<document>",
    content,
    "</document>",
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

export async function socialPlanDeckBrief(client, record) {
  const [facts, brand] = await Promise.all([clientFacts(client.id), approvedBrand(client.id)]);
  const plan = record.plan || {};
  const platforms = (plan.platforms || []).map((p) => p.name || p.id).join(", ");
  const content = (record.body_md && record.body_md.length > 400 ? record.body_md : socialPlanToMarkdown(plan, client.business)).slice(0, 12000);
  const extra = [
    "This deck presents the client's APPROVED social media plan. Use only what is in the plan below; do not add new numbers, results or claims.",
    "Any figure marked est. stays labelled \"est.\". Unknown figures are never filled in. Posting days and times are shown as starting points to test, not data.",
    "",
    "## Required slide order",
    "1. cover: the plan headline, subtitle = the platforms and weekly rhythm.",
    "2. bullets: goals and audience (what social does for the business).",
    `3. One slide per platform (${platforms || "each platform"}): role, cadence, best formats, starting-point posting times.`,
    "4. bullets: content pillars with one example post each.",
    "5. timeline: the creation workflow (steps: Capture, Edit, Caption, Schedule, Engage) with the weekly time budget.",
    "6. list or table: the 4-week starter calendar (one slide per week or a compact overview).",
    "7. bullets: editing guidelines from the brand kit, caption and hashtag rules.",
    "8. bullets: repurposing (blog → GBP post → reel → carousel) and the consistency system.",
    "9. compare: what Interstellar does vs what you do.",
    "10. bullets: KPIs to track (real figures only).",
    "11. closing: the first step this week.",
    "",
    "## Look",
    lookLines(brand),
    "",
    "## The approved social plan",
    "<document>",
    content,
    "</document>",
  ].join("\n");
  const brief = buildBrief({
    topic: `${client.business}: Social Media Plan`,
    audience: `${client.business} owner${client.contact ? ` (${client.contact})` : ""} and whoever creates their content`,
    goals: "Walk the owner through which platforms, what to post, how content gets made every week, and who does what.",
    slideCount: Math.min(18, 10 + (plan.platforms || []).length),
    tone: "Clear and confident",
    look: brand ? "client" : "interstellar",
    facts,
    extra,
  });
  return { brief, brand, title: `${client.business} — Social Media Plan` };
}

export async function brandKitDeckBrief(client, record) {
  const facts = await clientFacts(client.id);
  const brand = brandFromKit(record.kit, client.business) || (await approvedBrand(client.id));
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
    "7. quote: the primary tagline copied word for word from the kit (quote_source \"input\", attribution: \"Brand tagline\"), then cards for key messages.",
    "8. bullets: imagery and applications.",
    "9. compare: Do vs Don't.",
    "10. closing.",
    "",
    "## Look",
    lookLines(brand),
    "",
    "## The approved brand kit",
    "<document>",
    content,
    "</document>",
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
    const m = String(brief).match(/Slides:\s*(\d+)/);
    const { deck, outline } = await generateDeck({ brief, slideCount: m ? Number(m[1]) : 10, clientId: client.id });
    const created = await base44.entities.Presentation.create({
      ...base,
      title: deck.title || title,
      subtitle: deck.subtitle,
      summary: deck.summary,
      theme: brand ? "custom" : "interstellar",
      brand: brand || null,
      brand_source: brand ? "Client brand" : "",
      slides: deck.slides.map(({ chart, ...s }) => (chart ? { ...s, chart } : s)),
      outline,
      needs: deck.needs || [],
      prompt: brief,
      generated_by: "pipeline_v2",
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
