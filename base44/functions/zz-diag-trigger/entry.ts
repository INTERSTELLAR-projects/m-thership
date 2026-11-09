import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// TEMPORARY (Claude, Nov 9 2026): writes one harmless unprocessed AutomationRun (no client) to prove the
// "Process automation runs" trigger fires for service-role writes. Delete this function after use.
Deno.serve(async (req) => {
  const db = createClientFromRequest(req).asServiceRole.entities;
  const now = new Date().toISOString();
  const r = await db.AutomationRun.create({ automation_name: "Process automation runs: health check 2", kind: "other", status: "success", message: "Health check after the Nov 9 fix (service-role write, no client, nothing to log).", started_at: now, finished_at: now, processed: false });
  return Response.json({ id: r.id });
});
