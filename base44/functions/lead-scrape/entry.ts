import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { runScrape } from "../../shared/leadScrape.ts";

/*
 * Build Engine step 2: "Scrape" a lead (logic in base44/shared/leadScrape.ts, also used by the admin assistant).
 *   { action: "scrape", client_id }  → { ok, summary, completeness, niche_key, filled, not_found }
 * Admin only. Never sends anything to anyone; only fills empty Brain sections.
 */
const s = (v: unknown) => (v == null ? "" : String(v));

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== "admin") return Response.json({ error: "Admins only" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const db = base44.asServiceRole.entities;
    const id = s(body?.client_id);
    if (body?.action !== "scrape" || !id) return Response.json({ error: "Send { action: 'scrape', client_id }" }, { status: 400 });
    const client = await db.CRMClient.get(id).catch(() => null);
    if (!client) return Response.json({ error: "Lead not found" }, { status: 404 });
    if (!s(client.websites?.[0] || client.domain) && !s(client.gbp_url) && !s(client.business)) return Response.json({ error: "Add a website or Google Business Profile link first" }, { status: 400 });
    const r = await runScrape(base44, client);
    if (r?.error) return Response.json({ error: r.error }, { status: r.status || 500 });
    return Response.json(r);
  } catch (error: any) {
    return Response.json({ error: s(error?.message).slice(0, 300) }, { status: 500 });
  }
}
