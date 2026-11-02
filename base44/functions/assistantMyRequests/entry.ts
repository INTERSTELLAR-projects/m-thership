// Interstellar Assistant tool: list the signed-in client's own requests (or one by id).
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { resolvePortalClient, requestOut, OPEN_STATUSES, json } from "../../shared/portalAssistant.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const ctx = await resolvePortalClient(base44, body);
    if ("error" in ctx) return ctx.error;
    if (body?.request_id) {
      const r = await ctx.db.ClientRequest.get(String(body.request_id)).catch(() => null);
      if (!r || r.client_id !== ctx.cid) return json({ error: "Request not found" }, 404);
      return json({ ok: true, request: requestOut(r) });
    }
    const all = await ctx.by("ClientRequest", "-created_date", 200);
    const scope = String(body?.status || "open");
    const list = scope === "all" ? all : scope === "complete" ? all.filter((r) => r.status === "complete") : all.filter((r) => OPEN_STATUSES.includes(String(r.status)));
    return json({ ok: true, count: list.length, requests: list.slice(0, 25).map(requestOut) });
  } catch (_e) {
    return json({ error: "Couldn't load requests right now." }, 500);
  }
});
