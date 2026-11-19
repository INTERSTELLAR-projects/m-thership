// Lead stage moves from the board go through the lead-stage backend function, so every move is logged
// (LeadStageMove: who, when, from → to, why) and can be undone. In QA/demo previews the move is written locally.
import { base44 } from "@/api/base44Client";
import { IS_QA } from "@/lib/qa";
import { STAGES } from "./pipeline";
import { logAction } from "@/lib/usageLog";

export const nextStageOf = (stage) => { const i = STAGES.findIndex((s) => s.key === stage); return i >= 0 && i < 4 ? STAGES[i + 1].key : null; };

export async function moveLead(c, to, { reason = "", source = "dropdown" } = {}) {
  logAction(`lead_move_${source}`);
  if (IS_QA) {
    const from = c.pipeline_stage || "new";
    await base44.entities.CRMClient.update(c.id, { pipeline_stage: to, stage_changed_at: new Date().toISOString(), pipeline_stage_logged: to, pipeline_stage_reason: reason });
    const m = await base44.entities.LeadStageMove?.create?.({ client_id: c.id, client_name: c.business, from_stage: from, to_stage: to, by: "you", source, reason, at: new Date().toISOString() }).catch?.(() => null);
    return { ok: true, from, to, move_id: m?.id || null };
  }
  const r = await base44.functions.invoke("lead-stage", { action: "move", client_id: c.id, to, reason, source });
  if (r.data?.error) throw new Error(r.data.error);
  return r.data;
}

export async function undoLeadMove(moveId, c, from) {
  if (IS_QA || !moveId) { if (c) await base44.entities.CRMClient.update(c.id, { pipeline_stage: from, pipeline_stage_logged: from }); return { ok: true }; }
  const r = await base44.functions.invoke("lead-stage", { action: "undo", move_id: moveId });
  if (r.data?.error) throw new Error(r.data.error);
  return r.data;
}

export const isAutoMove = (c) => /^(claude|assistant|automation:)/.test(String(c?.pipeline_stage_by || ""));
