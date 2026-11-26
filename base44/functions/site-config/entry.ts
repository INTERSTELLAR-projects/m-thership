import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { publicConfig, todayPacific } from "../../shared/siteExtras.js";

/*
 * Public, read-only: a client's website asks for its own season + live offers by its site_key (CRMClient.site_key,
 * a random non-secret key). Returns ONLY the public fields in shared/siteExtras.js publicConfig: banner text, accent,
 * featured section, offer titles/labels/end dates (and a discount code only once one was created after Justin's
 * approval). No ids, no client data, nothing writable. Unknown key → empty config.
 */
const EMPTY = { season: null, offers: [] };
const headers = { "content-type": "application/json", "cache-control": "public, max-age=60", "access-control-allow-origin": "*" };

export default async function (req: Request) {
  try {
    const url = new URL(req.url);
    let key = url.searchParams.get("key") || "";
    if (!key && req.method === "POST") key = String((await req.json().catch(() => ({})))?.key || "");
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(key)) return new Response(JSON.stringify(EMPTY), { headers });
    const db = createClientFromRequest(req).asServiceRole.entities;
    const client = ((await db.CRMClient.filter({ site_key: key }, "-updated_date", 1).catch(() => [])) || [])[0];
    if (!client || client.status === "Inactive") return new Response(JSON.stringify(EMPTY), { headers });
    const [seasons, offers] = await Promise.all([
      db.SiteSeason.filter({ client_id: client.id, active: true }, "-activated_at", 5).catch(() => []),
      db.SiteOffer.filter({ client_id: client.id, status: "live" }, "ends_on", 20).catch(() => []),
    ]);
    // Seasons follow the calendar for every client unless we switched automatic seasons off on the CRM record.
    return new Response(JSON.stringify(publicConfig(seasons || [], offers || [], todayPacific(), client.seasons_auto !== false)), { headers });
  } catch {
    return new Response(JSON.stringify(EMPTY), { headers });
  }
}
