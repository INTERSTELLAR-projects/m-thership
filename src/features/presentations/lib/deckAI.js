// Every Presentation Creator AI call goes through the ai-gateway backend function (built-in InvokeLLM, no key
// needed), metered as Fuel (UsageLedger) against the client the deck is for, gated to HyperCare+ clients with the
// Presentations Studio switched on.
import { base44 } from "@/api/base44Client";

const unwrap = (r) => (r && r.data !== undefined ? r.data : r);

function friendly(e) {
  const d = (e && e.response && e.response.data) || {};
  if (d.code === "studios_locked") return "Presentations are included with HyperCare+.";
  if (d.code === "studio_off") return "The Presentations Studio isn't switched on for this account yet.";
  if (d.code && /fuel|cap|limit/i.test(String(d.code))) return d.error || "You're out of Fuel for this month. Refuel to keep building decks.";
  return d.error || (e && e.message) || "The AI request failed. Try again.";
}

/**
 * One structured call. Returns { json, meter, model }.
 * tier "long" = Sonnet (planning + writing), "routine" = Haiku (single-slide rewrites, repairs).
 */
export async function deckAI({ system, prompt, schema, tier = "long", feature, clientId, maxTokens }) {
  let data;
  try {
    data = unwrap(
      await base44.functions.invoke("ai-gateway", {
        action: "complete",
        system,
        prompt,
        response_json_schema: schema,
        tier,
        feature: feature || "presentations",
        studio: "presentations",
        client_id: clientId || undefined,
        max_tokens: maxTokens || (tier === "long" ? 12000 : 4000)
      })
    );
  } catch (e) {
    throw new Error(friendly(e));
  }
  if (!data || data.error) throw new Error((data && data.error) || "The AI request failed. Try again.");
  let json = data.json;
  if ((!json || typeof json !== "object") && typeof data.text === "string") {
    try { json = JSON.parse(data.text); } catch { json = null; }
  }
  if (!json || typeof json !== "object") throw new Error("The AI reply wasn't usable. Try again.");
  return { json, meter: data.meter || null, model: data.model || "" };
}
