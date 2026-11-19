import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { moveStage, undoMove, observe, runTriggers, nextStage, stageOf, STAGES } from "../../shared/leadStage.ts";

/*
 * Move a lead between pipeline stages (entity CRMClient, field pipeline_stage). Every move is logged to
 * LeadStageMove. Never emails or texts anyone.
 *   { action: "move", client_id, to, reason?, source? }   admin (board, assistant, Claude jobs)
 *   { action: "next", client_id, reason? }                admin: one stage forward
 *   { action: "undo", move_id }                           admin
 *   { action: "observe", client_id }                      workflow "Leads — log stage changes" (direct edits)
 *   { action: "triggers" }                                workflow "Leads — stage triggers" (calls, proposals)
 * Claude can also set pipeline_stage directly on the CRMClient record, together with pipeline_stage_by ("claude")
 * and pipeline_stage_reason: the observe workflow logs it as "Moved by Claude: <reason>".
 */
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const db = base44.asServiceRole.entities;
    // Background paths: they only read stored records and log/move from them; nothing comes from the caller but an id.
    if (action === "observe") return Response.json(await observe(db, String(body?.client_id || "")));
    if (action === "triggers") { const r = await runTriggers(db); return Response.json({ ok: true, moved: r.filter((x: any) => x && x.ok && !x.unchanged).length, errors: r.filter((x: any) => x?.error).length }); }

    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== "admin") return Response.json({ error: "Admins only" }, { status: 403 });
    const by = user.email || "justin";
    if (action === "undo") return Response.json(await undoMove(db, String(body?.move_id || ""), by));
    const c = await db.CRMClient.get(String(body?.client_id || "")).catch(() => null);
    if (!c) return Response.json({ error: "Lead not found" }, { status: 404 });
    if (action === "next") {
      const to = nextStage(stageOf(c));
      if (!to) return Response.json({ error: "No next stage from here" }, { status: 400 });
      return Response.json(await moveStage(db, c, to, { by, reason: body?.reason, source: "next" }));
    }
    if (action === "move") {
      const to = String(body?.to || "");
      if (!STAGES.includes(to)) return Response.json({ error: `Stage must be one of ${STAGES.join(", ")}` }, { status: 400 });
      const src = ["drag", "dropdown", "dialog", "assistant", "claude"].includes(body?.source) ? body.source : "dropdown";
      const auto = src === "assistant" || src === "claude";
      return Response.json(await moveStage(db, c, to, { by: auto ? src : by, reason: body?.reason, source: src, auto }));
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: String(error?.message || error).slice(0, 300) }, { status: 500 });
  }
}
