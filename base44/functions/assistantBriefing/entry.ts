// Nøva tool: the signed-in portal client's briefing facts (their client only).
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { resolvePortalClient, gatherBriefing, json } from "../../shared/portalAssistant.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const ctx = await resolvePortalClient(base44, body);
    if ("error" in ctx) return ctx.error;
    const briefing = await gatherBriefing(ctx, Number(body?.days) || 30);
    return json({ ok: true, briefing, rules: "Only state facts present here. If site_health.score is null, never give a number." });
  } catch (_e) {
    return json({ error: "Couldn't load the briefing right now." }, 500);
  }
});
