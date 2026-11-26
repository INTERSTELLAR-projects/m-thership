import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { HOLIDAYS, holidayFor, todayPacific } from "../../shared/siteExtras.js";
import { HOLIDAY_TOUCHES_JS } from "../../shared/holidayTouchesScript.js";

/*
 * Public, read-only script for a client website: <script src=".../functions/holiday-touches?key=SITE_KEY" defer></script>
 * One include on any platform (Base44, Framer, Squarespace). Returns the holiday decor script only when this client
 * turned holiday touches on (CRMClient.holiday_touches) AND today falls in a holiday window; otherwise a tiny no-op.
 * Never returns client data. Decor: light snow + garland (Christmas), leaves (Thanksgiving), pumpkins + leaves
 * (Halloween), clovers (St. Patrick's), stars (Fourth of July).
 * ?preview=<holiday key> shows that holiday's decor regardless of date (still needs holiday touches on).
 */
const NOOP = "/* holiday touches: off */";
const headers = { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=900", "access-control-allow-origin": "*" };

export default async function (req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key") || "";
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(key)) return new Response(NOOP, { headers });
    const db = createClientFromRequest(req).asServiceRole.entities;
    const client = ((await db.CRMClient.filter({ site_key: key }, "-updated_date", 1).catch(() => [])) || [])[0];
    if (!client || client.status === "Inactive" || client.holiday_touches !== true) return new Response(NOOP, { headers });
    const previewKey = url.searchParams.get("preview") || "";
    const h = (previewKey && HOLIDAYS.find((x: { key: string }) => x.key === previewKey)) || holidayFor(todayPacific());
    if (!h) return new Response(NOOP, { headers });
    const decor = JSON.stringify({ effect: h.effect, trim: h.trim });
    return new Response(`window.__HOLIDAY_DECOR__=${decor};\n${HOLIDAY_TOUCHES_JS}`, { headers });
  } catch {
    return new Response(NOOP, { headers });
  }
}
