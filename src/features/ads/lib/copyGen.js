import { base44 } from "@/api/base44Client";
import { agencyBlock, loadAgencyKnowledge, offerByKey, offerPriceLabel } from "@/features/agency/knowledge";
import { VOICE } from "@/features/social/brand";

// AI ad-copy variants. Facts and prices come only from Agency Knowledge; the voice rules come from the
// Social Studio brand file; the policy rules below mirror the hard rules in base44/shared/adsPolicy.ts.
// Every variant still goes through the policy check before anything can be pushed.

const SCHEMA = {
  type: "object",
  properties: {
    variants: {
      type: "array",
      items: {
        type: "object",
        properties: {
          angle: { type: "string", description: "2-4 word label for the angle (e.g. 'Pain → fix', 'Process proof')" },
          headline: { type: "string" },
          primary_text: { type: "string" },
          description: { type: "string" },
          cta: { type: "string", enum: ["LEARN_MORE", "CONTACT_US", "GET_QUOTE", "SIGN_UP", "BOOK_NOW", "SCHEDULE", "GET_OFFER", "MESSAGE_PAGE"] },
          why: { type: "string", description: "One line on why this angle could work" },
        },
        required: ["angle", "headline", "primary_text", "cta"],
      },
    },
  },
  required: ["variants"],
};

export async function generateAdCopy({ creative, count = 3, platform = "meta", learnings = [] }) {
  const sections = await loadAgencyKnowledge();
  const offer = creative.offer_key ? offerByKey(creative.offer_key, sections) : null;
  const spec = creative.spec || {};
  const prompt = `Write ${count} ${platform === "google" ? "Google Ads" : "Meta (Facebook + Instagram) feed"} ad copy variants for Interstellar Strategies.
${agencyBlock(sections, ["about", "offers", "rules", "voice"], { maxChars: 4000 })}
${offer ? `\nThis ad is about: ${offer.name} — ${offerPriceLabel(offer)}${offer.terms ? ` (${offer.terms})` : ""}.` : "\nNo specific offer: do not mention any price."}
The creative image says: ${[spec.eyebrow, spec.headline, spec.subhead, spec.body, spec.cta].filter(Boolean).join(" / ") || "(no image copy)"}
Destination: ${creative.destination_url || "(not set)"}
${learnings.length ? `What has worked in past ads (learnings log):\n- ${learnings.slice(0, 10).map((l) => l.insight).join("\n- ")}` : ""}

Voice: ${VOICE.tone.join(" ")}
Hard rules (an ad that breaks one is rejected before it reaches Meta):
- Prices ONLY exactly as listed in Agency Knowledge above; if no offer is given, no prices at all.
- Never assert or imply the reader's personal attributes. No "Are you a business owner struggling…", "Tired of being broke…", "You're losing money…". Describe the service and who it's for ("for home-service businesses") instead.
- No guarantees (rankings, leads, revenue, ROI), no invented statistics, testimonials or client results, no superlatives like "#1" or "best".
- No fake urgency or scarcity (no "only N spots", "ends tonight", "act now", "limited time").
- No credit/financing, hiring or housing wording.
- No ALL-CAPS words, no repeated punctuation, no emoji strings. Banned words: ${VOICE.banned_words.join(", ")}.
- Name the business (Interstellar Strategies) at least once in primary text.
- Interstellar and Møthership are not registered trademarks: never use ® (use ™ only if a mark is needed at all).
- Headline ≤ 40 characters${platform === "google" ? " (≤ 30 for Google)" : ""}; primary text ideally ≤ 125 characters before "See more", max 300; description ≤ 30 characters.
Give each variant a genuinely different angle (pain → fix, process proof, offer clarity, founder voice…).`;
  const out = await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: SCHEMA });
  return (out?.variants || []).slice(0, count).map((v, i) => ({ id: `${Date.now()}-${i}`, ...v, generated_at: new Date().toISOString() }));
}
