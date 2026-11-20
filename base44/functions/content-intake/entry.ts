// Content pipeline intake (docs/content-pipeline.md): a client's Command System sends a project or testimonial here.
// Auth: header x-mothership-key = secret COMMAND_SYSTEM_SYNC_KEY, and body.app_id must be the CRMClient.command_app_id
// (or other_app_ids) of the client it belongs to — the same anti-spoofing rule as client-brain. A mismatch is 403 and
// logged (AgentAuditLog content_intake_rejected). Admins may also call it (for tests from Møthership).
// Actions:
//   submit     { app_id, entity, record_id, kind: "project"|"testimonial", submitted_by, is_test?, record: {...} }
//              Upserts the ContentSubmission (app_id + record_id). A resubmit of a live post updates the same page
//              and keeps its URL. Queues it and starts the writer. Returns { id, status }.
//   unpublish  { app_id, record_id }  takes the post down (soft: published false, nothing deleted)
//   republish  { app_id, record_id }
//   status     { app_id, record_ids?: [] }  status, plain-words detail and live link for the app's submissions
//              ("manual" rows, which Justin builds by hand, read as "queued" to the client)
//   app_request { app_id, record_id, request_type: "feature"|"change"|"automation", title, details, priority?,
//              submitted_by, contact_name?, contact_email?, is_test? }  "Request an app change" from a Command System →
//              a ClientRequest (kind app_edit, source client_app) on the client's record + an email to Justin.
//              Same key + app_id rule. Re-sending the same record_id returns the existing request.
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { appAuthError, findClientForApp } from "../../shared/clientBrain.js";
import { arr, s, clip, now, pushHistory, dedupeHash, normalizeProject, normalizeTestimonial, audit, notifyJustin } from "../../shared/contentPipeline.ts";
import { setPublished, ACTIVE } from "../../shared/contentProcessor.ts";

const safeEqual = (a: string, b: string) => {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};
const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const publicView = (x: any) => ({
  id: x.id, record_id: x.source_record_id, kind: x.kind, status: x.status === "manual" ? "queued" : x.status, detail: x.status_detail || "",
  url: x.status === "live" ? x.published_url || "" : "", published_at: x.published_at || null, unpublished_at: x.unpublished_at || null, version: x.version || 1,
});

async function kickWriter(base44: any) {
  // Start the writer now; the hourly drain and the on-create workflow are the safety nets.
  try { await Promise.race([base44.asServiceRole.functions.invoke("content-writer", { action: "drain" }), new Promise((r) => setTimeout(r, 2500))]); } catch { /* the workflow will pick it up */ }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405 });
    const raw = await req.text();
    if (raw.length > 300_000) return Response.json({ error: "Body too large" }, { status: 413 });
    let b: any; try { b = JSON.parse(raw || "{}"); } catch { return Response.json({ error: "Body must be JSON" }, { status: 400 }); }
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const syncKey = Deno.env.get("COMMAND_SYSTEM_SYNC_KEY") || "";
    const keyOk = safeEqual(req.headers.get("x-mothership-key") || "", syncKey);
    const user = keyOk ? null : await base44.auth.me().catch(() => null);
    if (!keyOk && user?.role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });

    const appId = s(b.app_id);
    if (!ID_RE.test(appId)) return Response.json({ error: "app_id is required" }, { status: 400 });
    const clients = arr(await db.CRMClient.list("business", 500).catch(() => []));
    const client = findClientForApp(clients, appId);
    const authErr = appAuthError(client, appId);
    if (authErr) {
      await db.AgentAuditLog.create({ at: now(), actor: `app:${appId}`.slice(0, 120), action: "content_intake_rejected", entity: "CRMClient", record_id: client?.id || "", summary: `Rejected a content submission: ${authErr}`.slice(0, 500), ok: false }).catch(() => null);
      return Response.json({ error: "This app is not the command system registered for a client" }, { status: 403 });
    }
    const action = s(b.action) || "submit";
    const recordId = s(b.record_id);

    if (action === "app_request") {
      if (!ID_RE.test(recordId)) return Response.json({ error: "record_id is required" }, { status: 400 });
      const title = clip(b.title, 160);
      const details = clip(b.details, 6000);
      if (title.length < 3 || details.length < 10) return Response.json({ error: "Add a short title and describe what you need" }, { status: 400 });
      const type = ["feature", "change", "automation"].includes(s(b.request_type)) ? s(b.request_type) : "change";
      const prior = arr(await db.ClientRequest.filter({ client_id: client.id, kind: "app_edit", source: "client_app" }, "-created_date", 100).catch(() => []))
        .find((x: any) => x?.fields?.source_app_id === appId && x?.fields?.source_record_id === recordId);
      if (prior) return Response.json({ ok: true, request_id: prior.id, status: prior.status, duplicate: true });
      const isTest = b.is_test === true;
      const label = ({ feature: "New feature", change: "Change", automation: "Automation" } as Record<string, string>)[type];
      const priority = ["low", "high", "urgent"].includes(s(b.priority)) ? s(b.priority) : "normal";
      const by = clip(b.submitted_by, 120) || "client app";
      const row = await db.ClientRequest.create({
        client_id: client.id, client_name: client.business, kind: "app_edit", title: `${isTest ? "[TEST] " : ""}${label}: ${title}`, details,
        fields: { request_type: type, source_app_id: appId, source_record_id: recordId, is_test: isTest },
        status: "received", priority, submitted_by: by, source: "client_app",
        contact_name: clip(b.contact_name, 120), contact_email: clip(b.contact_email, 200),
        answers: [{ id: "request_type", label: "Type", type: "short_text", value: label }, { id: "details", label: "What they need", type: "long_text", value: details }],
      });
      await audit(db, "app_request_received", row.id, `${client.business}: ${label} — ${title}${isTest ? " [test]" : ""}`, true, `app:${appId}`);
      await notifyJustin(base44, `${isTest ? "[TEST] " : ""}App request from ${client.business}: ${title}`, [`${by} asked for a ${label.toLowerCase()} in their Command System.`, `${title}`, details, "It's on their client record as a request (kind: app edit)."]);
      return Response.json({ ok: true, request_id: row.id, status: "received" }, { status: 201 });
    }

    if (action === "status") {
      const ids = arr(b.record_ids).map(s).filter((x: string) => ID_RE.test(x)).slice(0, 200);
      const rows = arr(await db.ContentSubmission.filter({ source_app_id: appId }, "-updated_date", 200).catch(() => []));
      return Response.json({ ok: true, items: rows.filter((x: any) => !ids.length || ids.includes(x.source_record_id)).map(publicView) });
    }

    if (!ID_RE.test(recordId)) return Response.json({ error: "record_id is required" }, { status: 400 });
    const existing = arr(await db.ContentSubmission.filter({ source_app_id: appId, source_record_id: recordId }, "-created_date", 1).catch(() => []))[0] || null;
    const by = clip(b.submitted_by || (user ? user.email : ""), 120);

    if (action === "unpublish" || action === "republish") {
      if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
      const r = await setPublished(base44, existing, action === "republish", `client:${by || appId}`);
      return Response.json({ ...r, item: publicView({ ...existing, status: r.ok ? r.status : existing.status }) }, { status: r.ok ? 200 : 409 });
    }
    if (action !== "submit") return Response.json({ error: "Unknown action" }, { status: 400 });

    const kind = s(b.kind);
    if (!["project", "testimonial"].includes(kind)) return Response.json({ error: "kind must be project or testimonial" }, { status: 400 });
    if (!by) return Response.json({ error: "submitted_by is required (the signed-in owner or staff member)" }, { status: 400 });
    const record = b.record && typeof b.record === "object" ? b.record : null;
    if (!record) return Response.json({ error: "record is required" }, { status: 400 });
    if (record.is_demo === true || record.is_sample === true) b.is_test = true;
    if (existing && ACTIVE.includes(existing.status) && existing.locked_at) return Response.json({ ok: true, queued: true, item: publicView(existing), note: "Already being processed" }, { status: 202 });

    const n = kind === "project" ? normalizeProject(record) : normalizeTestimonial(record);
    const hash = await dedupeHash(client.id, kind, n);
    const base: any = {
      client_id: client.id, client_name: client.business, source_app_id: appId, source_record_id: recordId, source_entity: clip(b.entity, 60),
      kind, submitted_by: by, raw: record, photos: kind === "project" ? [(n as any).cover, ...(n as any).photos].filter(Boolean).slice(0, 200) : (n as any).photo ? [(n as any).photo] : [],
      is_test: b.is_test === true, status: "queued", status_detail: "Received. Checking it now.", dedupe_hash: hash, received_at: now(),
      gate_results: [], images: [], image_notes: [], image_cursor: 0, attempts: 0, locked_at: null, error: "", target_site_app_id: s(client.site_app_id),
    };
    let row: any;
    if (existing) {
      // Resubmit / client edit: same page, same URL. Photos already prepared for the last version are reused.
      row = { ...existing, ...base, version: (Number(existing.version) || 1) + 1, prior_images: arr(existing.images).length ? existing.images : arr(existing.prior_images), history: pushHistory(existing.history, { action: "resubmitted", by, raw: record }) };
      delete row.id;
      await db.ContentSubmission.update(existing.id, row);
      row.id = existing.id;
    } else {
      row = await db.ContentSubmission.create({ ...base, channel: "command_system", version: 1, history: [{ at: now(), action: "received", by }] });
      // Same landing place as the portal Submit intake: a request on Justin's Command screen.
      const label = kind === "project" ? "Job / project" : "Testimonial";
      const req = await db.ClientRequest.create({
        client_id: client.id, client_name: client.business, kind: "project_submission",
        title: `${base.is_test ? "[TEST] " : ""}New submission from ${client.business}: ${label}`,
        details: `${label} sent from their Command System by ${by}. It goes through the content pipeline (Clients › Client posts).`,
        attachments: base.photos.map((p: any) => p?.url).filter(Boolean).slice(0, 30), fields: { submission_id: row.id, submission_kind: kind, channel: "command_system" },
        source: "client_app", submitted_by: by, status: "received", priority: "normal", page_status: "none",
      }).catch(() => null);
      if (req) await db.ContentSubmission.update(row.id, { request_id: req.id }).catch(() => null);
    }
    await audit(db, "content_received", row.id, `${client.business}: ${kind} from ${appId} (${existing ? "resubmit" : "new"})${base.is_test ? " [test]" : ""}`, true, `app:${appId}`);
    await kickWriter(base44);
    const fresh = await db.ContentSubmission.get(row.id).catch(() => row);
    return Response.json({ ok: true, item: publicView(fresh) }, { status: 202 });
  } catch (e) {
    console.error("content-intake", (e as Error)?.message);
    return Response.json({ error: "Could not take the submission. Try again." }, { status: 500 });
  }
});
