// Nøva tool: quick facts for the signed-in client only
// (review link, brand kit, playbook, QR codes, signatures, project milestones).
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { resolvePortalClient, quickFacts, json } from "../../shared/portalAssistant.ts";

const TOPICS = ["review_link", "brand_kit", "playbook", "qr_codes", "signatures", "milestones", "all"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const ctx = await resolvePortalClient(base44, body);
    if ("error" in ctx) return ctx.error;
    const topic = TOPICS.includes(String(body?.topic)) ? String(body.topic) : "all";
    return json({ ok: true, topic, facts: await quickFacts(ctx, topic) });
  } catch (_e) {
    return json({ error: "Couldn't load that right now." }, 500);
  }
});
