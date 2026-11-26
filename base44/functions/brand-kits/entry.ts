import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { BRAND_KIT_TEMPLATE, BRAND_KIT_V2_CONTEXT, brandKitV2Brief } from "../../shared/brandKitV2.ts";

/*
 * Brand kits v2: the website launch is the trigger.
 *   { action: "sweep" }               Workflow "Brand kits — launch sweep" (daily) or admin: every Active client whose
 *                                     website is live on its domain (website_live_at) and has no Interstellar v2 kit
 *                                     yet gets ONE queued ClaudeJob to build it from the website + Command System.
 *   { action: "queue", client_id }    admin: the same for one client now.
 * Only writes ClaudeJob rows. Never shows anything to a client: Justin approves the kit in Møthership first.
 */
const arr = (r: any) => (Array.isArray(r) ? r : (r && r.items) || []);

async function queueFor(db: any, c: any) {
  const kits = arr(await db.BrandKit.filter({ client_id: c.id }, "-version", 50).catch(() => []));
  if (kits.some((k: any) => k.status === "approved" && k.kit?.template === BRAND_KIT_TEMPLATE)) return { client: c.business, skipped: "has kit" };
  const jobs = arr(await db.ClaudeJob.filter({ client_id: c.id, kind: "brand" }, "-created_date", 50).catch(() => []));
  if (jobs.some((j: any) => j.context?.[BRAND_KIT_V2_CONTEXT] && !["rejected", "cancelled", "archived"].includes(String(j.status)))) return { client: c.business, skipped: "job exists" };
  const job = await db.ClaudeJob.create({
    title: `Brand kit — ${c.business} (website launched)`,
    kind: "brand",
    instructions: brandKitV2Brief(c),
    client_id: c.id,
    client_name: c.business,
    status: "queued",
    priority: 2,
    complete_task_on_approve: false,
    requested_at: new Date().toISOString(),
    context: { brand_kit: true, [BRAND_KIT_V2_CONTEXT]: true, trigger: "website_launched" },
  });
  return { client: c.business, queued: job.id };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "sweep");
    const user = await base44.auth.me().catch(() => null);
    // The sweep may run from the scheduled workflow (no user); single-client queueing is admin only.
    if (action !== "sweep" && user?.role !== "admin") return Response.json({ error: "Admins only" }, { status: 403 });
    if (user && user.role !== "admin") return Response.json({ error: "Admins only" }, { status: 403 });
    const db = base44.asServiceRole.entities;
    if (action === "queue") {
      const c = body.client_id ? await db.CRMClient.get(String(body.client_id)).catch(() => null) : null;
      if (!c) return Response.json({ error: "Client not found" }, { status: 404 });
      return Response.json(await queueFor(db, c));
    }
    const clients = arr(await db.CRMClient.filter({ status: "Active" }, "business", 500).catch(() => []));
    const out = [];
    for (const c of clients.filter((x: any) => x.website_live_at)) out.push(await queueFor(db, c));
    return Response.json({ ok: true, results: out });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
