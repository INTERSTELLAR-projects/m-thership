import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// TEMPORARY (Claude, Nov 9 2026): removes the one diagnostic SocialPlan row. Delete this function after use.
Deno.serve(async (req) => {
  const db = createClientFromRequest(req).asServiceRole.entities;
  const rows = (await db.SocialPlan.filter({ client_id: "zz-claude-diagnostic-delete-me" }, "-created_date", 10)) || [];
  for (const r of rows) await db.SocialPlan.delete(r.id);
  return Response.json({ deleted: rows.length });
});
