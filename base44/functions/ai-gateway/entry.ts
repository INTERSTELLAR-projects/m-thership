import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { requireSecondFactor } from "../../shared/twoFactor.ts";
import { resolveClient } from "../../shared/portalClient.ts";
import { invokeBase44, AnthropicError } from "../../shared/anthropic.ts";
import { AI_MODELS, anyStudioOn, studiosOf, planUnlocksStudios, type AiTier } from "../../shared/usagePlans.ts";
import { check, record } from "../../shared/meter.ts";
import { loadFuelConfig, weightFor } from "../../shared/fuel.ts";
import { getClientContext, CONTEXT_MARKER } from "../../shared/clientContext.ts";

// AI gateway for Studios (Presentation Creator, Email Studio drafts, Training, ...). Runs on the built-in InvokeLLM ONLY.
// Justin's rule (Nov 17 2026, portal v2 cleanup): no Anthropic API key path, even if an ANTHROPIC_API_KEY secret exists.
//   { action: "complete", prompt | messages, system?, tier?: "routine"|"long", feature?, studio?,
//     response_json_schema?, max_tokens?, client_id? }
//     -> { text, json?, model, input_tokens, output_tokens, est_cost_usd, meter: { used, cap, remaining, pct } }
//   { action: "status", client_id? } -> { configured, models } (no secret values, presence only)
//
// Portal users: always act for their own client (client_id ignored), only when at least one Studio is switched on
// for that client (and, when `studio` is given, that Studio), and within the plan's monthly AI-action cap.
// Admin (Justin): never capped; recorded against client_id when given (by_admin, not counted toward the cap).
// No key (the normal case): every call, admin or client, runs on the built-in InvokeLLM. The key is optional, never required.
// AI actions are weighted by model (Fuel economics settings, pending Justin's approval): Haiku call = 1, Sonnet call
// = 3, agent / brain run with a large context = 5. tier "routine" = Haiku drafts, "long" = Sonnet long work.
// Studios (and so this gateway, for portal users) are HyperCare+ only; other plans get 403 studios_locked.
// Real token counts from every call are logged on the UsageLedger row (input_tokens / output_tokens).

const MAX_PROMPT_CHARS = 200_000;
const clean = (s: unknown, n: number) => String(s ?? "").slice(0, n);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
    const gate = await requireSecondFactor(base44, req, user);
    if (gate) return gate;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "complete");
    const db = base44.asServiceRole.entities;
    const isAdmin = user.role === "admin";
    if (action === "status") {
      // configured = an external key is in use. Always false: every call runs on the built-in InvokeLLM.
      return Response.json({ configured: false, models: { routine: AI_MODELS.routine.id, long: AI_MODELS.long.id } });
    }
    if (action !== "complete") return Response.json({ error: "Unknown action" }, { status: 400 });

    const client = await resolveClient(db, user, body?.client_id);
    if (!isAdmin) {
      if (!client) return Response.json({ error: "No portal is set up for this login yet.", code: "no_client" }, { status: 403 });
      const studio = String(body?.studio || "");
      if (!planUnlocksStudios(client)) {
        return Response.json({ error: "Studios are included with HyperCare+. Ask us about upgrading from your portal.", code: "studios_locked" }, { status: 403 });
      }
      if (!anyStudioOn(client) || (studio && !(studiosOf(client) as Record<string, boolean>)[studio])) {
        return Response.json({ error: "Studios aren't switched on for your account yet.", code: "studio_off" }, { status: 403 });
      }
    }

    const tier: AiTier = body?.tier === "long" ? "long" : "routine";
    const feature = clean(body?.feature || "ai", 80);
    let system = clean(body?.system, 40_000);
    // Grounding: every client-scoped call carries the client's shared context block (goals, offers, audience, voice,
    // SEO footprint; business-facing facts only, no billing or logins). Skipped when the caller already included it,
    // passes ground: false, or is translating. The block's tokens are not charged to the client's AI-action meter.
    let groundTokens = 0;
    if (client?.id && body?.ground !== false && !/translat/i.test(feature) && !system.includes(CONTEXT_MARKER) && !String(body?.prompt || "").includes(CONTEXT_MARKER)) {
      let block = await getClientContext(db, String(client.id), { maxChars: 10000 }).catch(() => "");
      // Portal users: internal research (competitor notes, raw numbers on file) stays out.
      if (block && !isAdmin) block = block.split("\n").filter((l) => !/^- (Competitors|Numbers on file)/.test(l)).join("\n");
      if (block) { system = `${block}\n\n${system}`.trim(); groundTokens = Math.ceil(block.length / 4); }
    }
    const messages = Array.isArray(body?.messages)
      ? body.messages.slice(-40).map((m: any) => ({ role: m?.role === "assistant" ? "assistant" : "user", content: clean(m?.content, MAX_PROMPT_CHARS) })).filter((m: any) => m.content)
      : null;
    const prompt = clean(body?.prompt, MAX_PROMPT_CHARS);
    if (!prompt && !messages?.length) return Response.json({ error: "Nothing to send: add a prompt" }, { status: 400 });
    const schema = body?.response_json_schema && typeof body.response_json_schema === "object" ? body.response_json_schema : null;

    // Cap check before spending anything (admin is never capped). Expected weight by tier; the row records the
    // real weight once the model and token counts are known.
    const fuelCfg = await loadFuelConfig(db);
    const expected = weightFor(tier === "long" ? AI_MODELS.long.id : AI_MODELS.routine.id, 0, feature, fuelCfg);
    let meter = null as null | Awaited<ReturnType<typeof check>>;
    if (client) {
      meter = await check(db, client, "ai_action", expected, { admin: isAdmin, feature });
      if (!meter.ok) return Response.json({ error: meter.reason, code: meter.code, meter }, { status: 429 });
    }

    {
      // The only path: everyone (admin and portal clients) runs on the built-in InvokeLLM integration, with the house
      // rules, grounding, caps and meter. (Grounding tokens aren't charged: InvokeLLM reports no token counts.)
      void groundTokens;
      const out = await invokeBase44(base44, { system: system || undefined, prompt, messages: messages || undefined, schema, service: !isAdmin });
      const units = expected;
      if (client) await record(db, client, "ai_action", units, { admin: isAdmin, model: out.model, est_cost_usd: 0, feature, user_email: user.email, calls: 1 });
      const used = meter ? meter.used + (isAdmin ? 0 : units) : null;
      return Response.json({
        text: out.text, json: out.json, model: out.model, fallback: true, strict_json: false, stop_reason: null,
        input_tokens: 0, output_tokens: 0, est_cost_usd: 0, units,
        meter: meter ? { used, cap: meter.cap, remaining: meter.cap == null ? null : Math.max(0, meter.cap - (used || 0)), pct: meter.cap ? (used || 0) / meter.cap : null, plan: meter.plan_label, wallet: meter.wallet } : null,
      });
    }
  } catch (e) {
    if (e instanceof AnthropicError) {
      console.error("ai-gateway anthropic", e.status, e.type);
      const status = e.status === 429 || e.status === 529 ? 503 : e.status === 401 || e.status === 403 ? 503 : 502;
      const msg = e.status === 401 || e.status === 403 || e.status === 429 || e.status === 529 ? "The AI is busy right now. Try again in a minute." : e.message;
      return Response.json({ error: msg, code: "ai_error" }, { status });
    }
    console.error("ai-gateway", (e as Error)?.message);
    return Response.json({ error: (e as Error)?.message || "AI request failed" }, { status: 500 });
  }
});
// Terms gate (Nov 23 2026): portal logins resolve only after accepting the active Terms of Service (docs/portal-terms.md).
