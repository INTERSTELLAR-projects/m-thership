// Gorgon tool: submit a request for the signed-in client (same record shape as the
// portal's create_request). Refuses unless the client confirmed the summary (confirmed: true).
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { resolvePortalClient, buildRequest, requestOut, kindLabel, json } from "../../shared/portalAssistant.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const ctx = await resolvePortalClient(base44, body);
    if ("error" in ctx) return ctx.error;
    if (body?.confirmed !== true) {
      return json({ ok: false, error: "Not submitted: show the client the full summary and get a clear yes first, then call again with confirmed: true." }, 400);
    }
    const r = buildRequest(body);
    if (!r.title || (!r.details && !Object.keys(r.fields).length)) return json({ ok: false, error: "Add a title and the details of what's needed." }, 400);
    // Light duplicate guard: same title submitted by this client in the last 10 minutes.
    const recent = await ctx.by("ClientRequest", "-created_date", 10);
    const tenMin = new Date(Date.now() - 10 * 60000).toISOString();
    const dupe = recent.find((x) => x.title === r.title && String(x.created_date || "") >= tenMin);
    if (dupe) return json({ ok: true, duplicate: true, request: requestOut(dupe), note: "This request was already submitted a moment ago." });

    const created = await ctx.db.ClientRequest.create({
      client_id: ctx.cid, client_name: ctx.client.business, kind: r.kind, title: r.title, details: r.details,
      attachments: [], fields: r.fields, answers: r.answers,
      form_id: null, form_title: `${kindLabel(r.kind)} (via Gorgon)`,
      source: "portal", contact_email: ctx.user.email, submitted_by: ctx.user.email,
      status: "received", priority: r.priority, ...(r.due_date ? { due_date: r.due_date } : {}),
      page_status: "none",
    });
    return json({ ok: true, request: requestOut(created), next: "Justin's team replies within 1 business day. It shows under Requests in the portal." });
  } catch (_e) {
    return json({ error: "Couldn't submit the request right now. Suggest the Requests tab or messaging Justin." }, 500);
  }
});
