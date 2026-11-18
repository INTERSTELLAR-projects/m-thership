// Content pipeline admin (Møthership → Clients → Client posts). Admin only.
//   overview {}                     keys configured?, each site's endpoint state, counts by status
//   list { tab, client_id? }        tab: queue | live | problems | unpublished | tests | all
//   get { id }                      one submission with its post
//   unpublish { id } / republish { id }   soft only, nothing is deleted
//   edit { id, fields }             change written fields (only those sent) and update the live page
//   retry { id }                    put a failed / needs_info / rejected row back in the queue and run it
//   test { client_id }              queue a TEST submission built from the client's latest real Command submission
//                                   data already in Møthership (never published; ends at test_passed)
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { CONTENT_SITES } from "../../shared/contentSites.ts";
import { arr, s, clip, now, pushHistory, siteStatus, publishKeyConfigured, audit } from "../../shared/contentPipeline.ts";
import { setPublished, editPost, processSubmission, ACTIVE, EDITABLE } from "../../shared/contentProcessor.ts";

const TABS: Record<string, string[] | null> = {
  queue: ["received", "queued", "processing_images", "writing", "publishing"],
  live: ["live"],
  problems: ["needs_info", "rejected", "failed"],
  unpublished: ["unpublished"],
  tests: ["test_passed"],
  all: null,
};
const slim = (x: any) => ({
  id: x.id, client_id: x.client_id, client_name: x.client_name, kind: x.kind, status: x.status, status_detail: x.status_detail, is_test: !!x.is_test,
  title: s(x.writer_output?.title || x.writer_output?.name || x.raw?.shoot_title || x.raw?.title || x.raw?.customer_name || x.raw?.name),
  published_url: x.published_url || "", received_at: x.received_at, published_at: x.published_at || null, unpublished_at: x.unpublished_at || null,
  submitted_by: x.submitted_by, version: x.version || 1, photos: arr(x.photos).length, images_done: arr(x.images).length, error: x.error || "",
  failed_checks: arr(x.gate_results).filter((g: any) => !g.ok).map((g: any) => g.check),
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user?.role !== "admin") return Response.json({ error: user ? "Forbidden" : "Unauthorized" }, { status: user ? 403 : 401 });
    const db = base44.asServiceRole.entities;
    const b = await req.json().catch(() => ({}));
    const action = s(b.action) || "overview";
    const by = `admin:${user.email}`;
    const getSub = async () => (s(b.id) ? await db.ContentSubmission.get(s(b.id)).catch(() => null) : null);

    if (action === "overview") {
      const rows = arr(await db.ContentSubmission.list("-updated_date", 500).catch(() => []));
      const counts: Record<string, number> = {};
      for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
      const clients = arr(await db.CRMClient.list("business", 500).catch(() => []));
      const sites = await Promise.all(Object.values(CONTENT_SITES).map(async (site) => {
        const c = clients.find((x: any) => s(x.site_app_id) === site.app_id);
        return { app_id: site.app_id, name: site.name, origin: site.origin, enabled: site.enabled, key_secret: site.key_secret, key_configured: publishKeyConfigured(site), client_id: c?.id || "", command_app_id: s(c?.command_app_id), indexnow: !!site.indexnow, ...(await siteStatus(site)) };
      }));
      return Response.json({ ok: true, key_configured: Object.values(CONTENT_SITES).some((x) => publishKeyConfigured(x)), sync_key_configured: !!Deno.env.get("COMMAND_SYSTEM_SYNC_KEY"), sites, counts, editable: EDITABLE });
    }
    if (action === "list") {
      const statuses = TABS[s(b.tab)] ?? TABS.queue;
      const q: any = statuses ? { status: { $in: statuses } } : {};
      if (s(b.client_id)) q.client_id = s(b.client_id);
      const rows = arr(await db.ContentSubmission.filter(q, "-updated_date", 200).catch(() => []));
      return Response.json({ ok: true, items: rows.map(slim) });
    }
    const sub = await getSub();
    if (action === "test") {
      const client = await db.CRMClient.get(s(b.client_id)).catch(() => null);
      if (!client) return Response.json({ error: "Client not found" }, { status: 404 });
      const record = b.record && typeof b.record === "object" ? b.record : null;
      if (!record) return Response.json({ error: "Send record (the test payload)" }, { status: 400 });
      const row = await db.ContentSubmission.create({
        client_id: client.id, client_name: client.business, source_app_id: s(client.command_app_id), source_record_id: `test-${Date.now().toString(36)}`,
        source_entity: "Test", kind: s(b.kind) === "testimonial" ? "testimonial" : "project", submitted_by: by, raw: { ...record, feature_ok: true, consent: true },
        photos: [], is_test: true, status: "queued", status_detail: "Test queued", received_at: now(), target_site_app_id: s(client.site_app_id), version: 1,
        history: [{ at: now(), action: "test_created", by }],
      });
      await audit(db, "content_test_created", row.id, `${client.business}: test submission`, true, by);
      return Response.json({ ok: true, id: row.id });
    }
    if (!sub) return Response.json({ error: "Not found" }, { status: 404 });
    if (action === "get") {
      const post = sub.content_post_id ? await db.ContentPost.get(sub.content_post_id).catch(() => null) : null;
      return Response.json({ ok: true, item: { ...sub, raw: sub.raw }, post });
    }
    if (action === "unpublish" || action === "republish") {
      const r = await setPublished(base44, sub, action === "republish", by);
      return Response.json(r, { status: r.ok ? 200 : 409 });
    }
    if (action === "edit") {
      const r = await editPost(base44, sub, b.fields || {}, by);
      return Response.json(r, { status: r.ok ? 200 : 409 });
    }
    if (action === "retry") {
      if (ACTIVE.includes(sub.status) && sub.locked_at && Date.now() - new Date(sub.locked_at).getTime() < 4 * 60 * 1000) return Response.json({ ok: false, error: "It's being processed right now" }, { status: 409 });
      // A post that got as far as being written keeps its words; everything else starts over from the checks.
      const restart = sub.writer_output && sub.status === "failed" ? "publishing" : "queued";
      await db.ContentSubmission.update(sub.id, { status: restart, status_detail: "Retrying", attempts: 0, locked_at: null, error: "", ...(restart === "queued" ? { image_cursor: 0, images: [], prior_images: arr(sub.images).length ? sub.images : arr(sub.prior_images) } : {}), history: pushHistory(sub.history, { action: "retry", by }) });
      const deadline = Date.now() + 100_000;
      let r: any = { status: restart };
      for (let i = 0; i < 6 && ACTIVE.includes(r.status) && Date.now() < deadline - 20000; i++) {
        r = await processSubmission(base44, { id: sub.id }, deadline);
        if (r.skipped) break;
      }
      return Response.json({ ok: true, result: r });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("content-admin", (e as Error)?.message);
    return Response.json({ error: clip((e as Error).message, 300) }, { status: 500 });
  }
});
