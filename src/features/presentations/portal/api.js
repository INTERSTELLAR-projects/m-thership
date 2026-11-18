// Client portal Presentation Creator: storage + brand/facts through the deck-client function (Presentation and the
// brand records are admin-only entities). The AI pipeline is the shared one in lib/deckSchema.js (ai-gateway,
// Base44 InvokeLLM, Fuel-metered).
import { base44 } from "@/api/base44Client";
import { factsFromRecords, buildBrief } from "@/features/presentations/lib/deckSchema";
import { brandFromRecords } from "@/features/presentations/lib/clientBrand";

export const deckCall = async (scopeId, action, args = {}) => (await base44.functions.invoke("deck-client", { action, client_id: scopeId, ...args })).data;
export const errText = (e) => e?.response?.data?.error || e?.message || "Something went wrong. Try again.";

// { facts, brand, source, business } for this client.
export async function loadDeckContext(scopeId) {
  const ctx = await deckCall(scopeId, "context");
  const records = { client: ctx.client, kit: ctx.kit, dossier: ctx.dossier, brain: ctx.brain };
  const facts = factsFromRecords(records);
  const { brand, source } = brandFromRecords(records);
  return { facts, brand, source, business: ctx.client?.business || "" };
}

// The one-prompt brief. Audience / tone are optional; everything else comes from the prompt and the client's facts.
export function portalBrief({ prompt, audience, slideCount, tone, extraFacts, facts }) {
  const extra = [prompt, extraFacts ? `\nFacts the presenter added:\n${extraFacts}` : ""].join("").trim();
  return buildBrief({ topic: prompt.split(/[.\n]/)[0].slice(0, 160), audience, goals: "", slideCount, tone: tone || "Clear and confident", extra, facts });
}

export const EXAMPLES = [
  "A 10-slide pitch for a new HOA client",
  "Our services overview for a commercial property manager",
  "New hire onboarding: how a job day works",
  "Year in review for our team, with next year's plan",
];
