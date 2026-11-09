import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// TEMPORARY (Claude, Nov 9 2026): writes one already-processed AutomationRun to prove the trigger condition
// skips it. Delete this function after use.
Deno.serve(async (req) => {
  const db = createClientFromRequest(req).asServiceRole.entities;
  const now = new Date().toISOString();
  const r = await db.AutomationRun.create({ automation_name: "Process automation runs: health check 3 (pre-processed)", kind: "other", status: "success", message: "Health check after the Nov 9 fix: created already processed, so the workflow trigger should skip it.", started_at: now, finished_at: now, processed: true });
  return Response.json({ id: r.id });
});
