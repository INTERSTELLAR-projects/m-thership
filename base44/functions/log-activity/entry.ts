import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { processPendingRuns } from "../../shared/runs.ts";

// Public ingest for automations that run outside Møthership (client-site workflows, scripts).
// POST with header `x-mothership-key: <MOTHERSHIP_INGEST_KEY>` and JSON:
// { client_id? | domain?, automation_id? | automation_name?, kind, status: success|failed|skipped, title?, output_url?, message? }
Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405 });
    const key = Deno.env.get("MOTHERSHIP_INGEST_KEY");
    if (!key || req.headers.get("x-mothership-key") !== key) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const b = await req.json().catch(() => ({}));
    const status = ["success", "failed", "skipped", "running"].includes(b.status) ? b.status : "success";
    if (!b.client_id && !b.domain && !b.automation_id) return Response.json({ error: "Need client_id, domain or automation_id" }, { status: 400 });
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const clip = (v: unknown, n: number) => (v == null ? "" : String(v).slice(0, n));
    const run = await db.AutomationRun.create({
      client_id: clip(b.client_id, 64), domain: clip(b.domain, 200), automation_id: clip(b.automation_id, 64), automation_name: clip(b.automation_name, 120),
      kind: clip(b.kind, 40), status, title: clip(b.title, 300), output_url: clip(b.output_url, 1000), message: clip(b.message, 1000),
      started_at: new Date().toISOString(), processed: false,
    });
    const results = await processPendingRuns(db, 10);
    return Response.json({ ok: true, run_id: run.id, result: results.find((r) => r.id === run.id) || null });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
