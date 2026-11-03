// Nøva tool: update one of the signed-in client's own requests.
// Only title, details (replace or append), priority and due date; only while status is received or needs_info.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { resolvePortalClient, requestOut, CLIENT_EDITABLE, REQUEST_KINDS, today, json } from "../../shared/portalAssistant.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const ctx = await resolvePortalClient(base44, body, req);
    if ("error" in ctx) return ctx.error;
    const r = body?.request_id ? await ctx.db.ClientRequest.get(String(body.request_id)).catch(() => null) : null;
    if (!r || r.client_id !== ctx.cid) return json({ ok: false, error: "Request not found" }, 404);
    if (!CLIENT_EDITABLE.includes(String(r.status))) {
      return json({ ok: false, error: `This request is ${String(r.status).replace("_", " ")}, so it can't be changed here. Offer to pass the change to Justin (handoff) instead.` }, 409);
    }
    if (body?.confirmed !== true) return json({ ok: false, error: "Not saved: confirm the exact change with the client first, then call again with confirmed: true." }, 400);

    const upd: Record<string, unknown> = {};
    if (typeof body.title === "string" && body.title.trim()) upd.title = body.title.trim().slice(0, 160);
    if (typeof body.details === "string" && body.details.trim()) upd.details = body.details.trim().slice(0, 8000);
    if (typeof body.add_details === "string" && body.add_details.trim()) {
      const stamp = new Date().toISOString().slice(0, 10);
      upd.details = `${String(upd.details ?? r.details ?? "").trim()}\n\nUpdate from client (${stamp}): ${body.add_details.trim().slice(0, 4000)}`.trim().slice(0, 8000);
    }
    if (body.priority) {
      const p = String(body.priority).toLowerCase();
      if (["low", "normal", "high", "urgent"].includes(p)) upd.priority = p;
    }
    if (body.due_date !== undefined && !REQUEST_KINDS[String(r.kind)]?.noDue) {
      const d = String(body.due_date || "");
      if (d === "" || d === "none") upd.due_date = null;
      else if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today()) upd.due_date = d;
      else return json({ ok: false, error: "Due date must be today or later, as YYYY-MM-DD." }, 400);
    }
    if (!Object.keys(upd).length) return json({ ok: false, error: "Nothing to change." }, 400);
    const saved = await ctx.db.ClientRequest.update(r.id, upd);
    return json({ ok: true, request: requestOut({ ...r, ...saved }) });
  } catch (_e) {
    return json({ error: "Couldn't update the request right now." }, 500);
  }
});
