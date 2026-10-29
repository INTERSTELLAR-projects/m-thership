import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { processPendingRuns } from "../../shared/runs.ts";

// Runs whenever an AutomationRun is created (workflow) and on demand from Mission Control.
// Idempotent: only touches runs not yet processed.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const results = await processPendingRuns(base44.asServiceRole.entities);
    return Response.json({ processed: results.length, results });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
