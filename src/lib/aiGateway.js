// Frontend helper for the ai-gateway backend function (built-in InvokeLLM, no key needed; metered in UsageLedger).
// Drop-in for base44.integrations.Core.InvokeLLM({ prompt, response_json_schema }) in Justin's admin Studios:
// returns the parsed JSON when a schema is given, else the text. For admin callers, any gateway failure (no key,
// API error, unparseable JSON) falls back to InvokeLLM, so existing admin flows never break.
import { base44 } from "@/api/base44Client";

export async function invokeAI({ prompt, response_json_schema, system, tier = "routine", feature = "admin", client_id, fallback = true }) {
  try {
    const res = await base44.functions.invoke("ai-gateway", { action: "complete", prompt, system, tier, feature, client_id, response_json_schema });
    const d = res?.data || {};
    if (response_json_schema) {
      if (d.json && typeof d.json === "object") return d.json;
      throw new Error("No JSON from gateway");
    }
    if (typeof d.text === "string") return d.text;
    throw new Error("No text from gateway");
  } catch (e) {
    if (!fallback) throw new Error(e?.response?.data?.error || e?.message || "AI request failed");
    const full = system ? `${system}\n\n${prompt}` : prompt;
    return base44.integrations.Core.InvokeLLM({ prompt: full, ...(response_json_schema ? { response_json_schema } : {}) });
  }
}
