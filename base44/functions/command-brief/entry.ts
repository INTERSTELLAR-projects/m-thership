import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import * as C from "../../shared/command.js";
import { requireAdmin, generateBrief, readCalendar } from "../../shared/commandServer.ts";

// Møthership Command: the Mission Brief.
//   { action: "get" }                       -> today's DailyBrief (built on first call of the day)
//   { action: "generate" }                  -> re-plan now (rules + LLM), keeps blocks already lived
//   { action: "interrupt", text, minutes? } -> log "something came up" and re-plan fast (rules only)
//   { action: "scores" }                    -> live pillar scores + candidates, no LLM, nothing saved
// Admin only. Reads real records; never invents. If the LLM fails the rule brief is saved with llm_error.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user, denied } = await requireAdmin(base44);
    if (denied) return denied;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "get");
    const tz = typeof body?.tz === "string" && body.tz.length < 60 ? body.tz : C.TZ_DEFAULT;
    const db = base44.asServiceRole.entities;

    if (action === "get") {
      const today = C.zonedParts(new Date(), tz).date;
      const rows = await db.DailyBrief.filter({ date: today }, "-updated_date", 1).catch(() => []);
      const row = (Array.isArray(rows) ? rows : [])[0];
      if (row && !body?.force) return Response.json({ brief: row, cached: true });
      const out = await generateBrief(base44, user, { tz, reason: "first open" });
      return Response.json({ ...out, cached: false });
    }
    if (action === "generate") {
      const out = await generateBrief(base44, user, { tz, reason: "re-plan", useLlm: body?.llm !== false });
      return Response.json(out);
    }
    if (action === "interrupt") {
      const text = String(body?.text || "").trim().slice(0, 200);
      if (!text) return Response.json({ error: "Say what came up" }, { status: 400 });
      const out = await generateBrief(base44, user, { tz, reason: "something came up", interruption: { text, minutes: body?.minutes }, useLlm: false });
      return Response.json(out);
    }
    if (action === "scores") {
      const now = new Date();
      const [src, events] = await Promise.all([C.loadSources(db), readCalendar(base44, now, tz)]);
      const { s, scores, rule } = C.computeAll(src, now, { tz, events, name: user.full_name });
      const todos = Object.fromEntries(C.PILLAR_IDS.map((id: string) => [id, rule.cands.filter((c: any) => c.pillar === id).slice(0, 6).map((c: any) => ({ title: c.title, why: c.why, ref: c.ref }))]));
      return Response.json({ scores, todos, facts: C.factsSummary(s), errors: s.errors, at: now.toISOString() });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("command-brief", (e as Error)?.message);
    return Response.json({ error: (e as Error)?.message || "Brief failed" }, { status: 500 });
  }
});
