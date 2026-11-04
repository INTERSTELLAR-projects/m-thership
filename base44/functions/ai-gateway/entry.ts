import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { requireSecondFactor } from "../../shared/twoFactor.ts";
import { resolveClient, getSecret } from "../../shared/portalClient.ts";
import { callClaude, AnthropicError } from "../../shared/anthropic.ts";
import { AI_MODELS, estimateAiCost, anyStudioOn, studiosOf, monthKey, planUnlocksStudios, type AiTier } from "../../shared/usagePlans.ts";
import { check, record } from "../../shared/meter.ts";
import { loadFuelConfig, weightFor } from "../../shared/fuel.ts";

// AI gateway for Studios. Client AI runs on our own Anthropic key (ANTHROPIC_API_KEY), never Base44 InvokeLLM credits.
//   { action: "complete", prompt | messages, system?, tier?: "routine"|"long", feature?, studio?,
//     response_json_schema?, max_tokens?, client_id? }
//     -> { text, json?, model, input_tokens, output_tokens, est_cost_usd, meter: { used, cap, remaining, pct } }
//   { action: "status", client_id? } -> { configured, models } (no secret values, presence only)
//
// Portal users: always act for their own client (client_id ignored), only when at least one Studio is switched on
// for that client (and, when `studio` is given, that Studio), and within the plan's monthly AI-action cap.
// Admin (Justin): never capped; recorded against client_id when given (by_admin, not counted toward the cap).
// No key: client calls get 503 { code: "ai_not_configured" }; admin calls fall back to Base44 InvokeLLM.
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
    const key = getSecret("ANTHROPIC_API_KEY");

    if (action === "status") {
      return Response.json({ configured: !!key, models: { routine: AI_MODELS.routine.id, long: AI_MODELS.long.id } });
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
    const system = clean(body?.system, 40_000);
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

    if (!key) {
      if (!isAdmin) return Response.json({ error: "AI isn't configured yet. Interstellar has been notified.", code: "ai_not_configured" }, { status: 503 });
      // Justin's own usage only: fall back to Base44 InvokeLLM so admin Studios keep working without the key.
      const fullPrompt = [system, messages ? messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n") : prompt].filter(Boolean).join("\n\n");
      const out = await base44.integrations.Core.InvokeLLM({ prompt: fullPrompt, ...(schema ? { response_json_schema: schema } : {}) });
      const json = schema ? (typeof out === "string" ? JSON.parse(out) : out) : null;
      const text = schema ? JSON.stringify(json) : (typeof out === "string" ? out : JSON.stringify(out));
      if (client) await record(db, client, "ai_action", 1, { admin: true, model: "base44-invokellm", feature, user_email: user.email, calls: 1 });
      return Response.json({ text, json, model: "base44-invokellm", fallback: true, input_tokens: 0, output_tokens: 0, est_cost_usd: 0, meter });
    }

    const out = await callClaude({ key, tier, system: system || undefined, prompt, messages: messages || undefined, schema, max_tokens: body?.max_tokens });
    const est = estimateAiCost(out.model, out.input_tokens, out.output_tokens);
    const units = weightFor(out.model, out.input_tokens, feature, fuelCfg);
    if (client) {
      await record(db, client, "ai_action", units, { admin: isAdmin, model: out.model, est_cost_usd: est, feature, user_email: user.email, input_tokens: out.input_tokens, output_tokens: out.output_tokens, calls: 1 });
    } else {
      // Agency-level admin usage (no client): still recorded so the Anthropic bill is explainable.
      await db.UsageLedger.create({ client_id: "agency", client_name: "Interstellar (admin)", month: monthKey(), kind: "ai_action", units, calls: 1, model: out.model, est_cost_usd: est, feature, user_email: user.email, by_admin: true, input_tokens: out.input_tokens, output_tokens: out.output_tokens, created_at: new Date().toISOString() }).catch(() => null);
    }
    const used = meter ? meter.used + (isAdmin ? 0 : units) : null;
    return Response.json({
      text: out.text, json: out.json, model: out.model, strict_json: out.strict, stop_reason: out.stop_reason,
      input_tokens: out.input_tokens, output_tokens: out.output_tokens, est_cost_usd: est,
      units,
      meter: meter ? { used, cap: meter.cap, remaining: meter.cap == null ? null : Math.max(0, meter.cap - (used || 0)), pct: meter.cap ? (used || 0) / meter.cap : null, plan: meter.plan_label, wallet: meter.wallet } : null,
    });
  } catch (e) {
    if (e instanceof AnthropicError) {
      console.error("ai-gateway anthropic", e.status, e.type);
      const status = e.status === 429 || e.status === 529 ? 503 : e.status === 401 || e.status === 403 ? 503 : 502;
      const msg = e.status === 401 || e.status === 403 ? "AI isn't configured correctly yet." : e.status === 429 || e.status === 529 ? "The AI is busy right now. Try again in a minute." : e.message;
      return Response.json({ error: msg, code: e.status === 401 || e.status === 403 ? "ai_not_configured" : "ai_error" }, { status });
    }
    console.error("ai-gateway", (e as Error)?.message);
    return Response.json({ error: (e as Error)?.message || "AI request failed" }, { status: 500 });
  }
});
