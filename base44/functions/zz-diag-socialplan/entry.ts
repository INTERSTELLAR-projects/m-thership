import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// TEMPORARY diagnostic (Claude, Nov 9 2026): tries a SocialPlan write the size of the approval-policy one, then deletes it.
// Writes no real data. Delete this function after use.
Deno.serve(async (req) => {
  const db = createClientFromRequest(req).asServiceRole.entities;
  const out: Record<string, unknown> = {};
  const job = await db.ClaudeJob.get("6aeb76e24e13ab200e7479c0");
  const plan = job?.result_data?.social_plan || {};
  for (const [label, body] of [["small", "x"], ["31k", "# plan\n".repeat(4400)]] as const) {
    try {
      const r = await db.SocialPlan.create({ client_id: "zz-claude-diagnostic-delete-me", client_name: "DIAGNOSTIC", status: "archived", version: 0, plan, body_md: body, source_job_id: "diag", portal_visible: false });
      out[label] = "ok";
      await db.SocialPlan.delete(r.id).catch((e: Error) => { out[label + "_del"] = e.message; });
    } catch (e) { out[label] = (e as Error).message + " | " + JSON.stringify((e as any)?.response?.data || (e as any)?.data || "").slice(0, 600); }
  }
  return Response.json(out);
});
