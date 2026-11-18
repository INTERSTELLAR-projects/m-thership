import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { emailKeys, loadSettings, loadTheme, stepLinks } from "../../shared/emailStudio.ts";
import { verifyToken, parseTrackPayload, extractLinks } from "../../shared/emailCore.ts";

// Public open / click tracking for client Email Studio (no login). The only thing in the URL is a signed, opaque
// token: campaign or automation step id + an opaque recipient id (contact id or keyed hash) + link index. No email,
// no name. Forged or edited tokens are ignored.
//   GET ?o=<token>  -> 1x1 transparent GIF, records an "open" (estimate: Apple Mail Privacy Protection and image
//                      proxies pre-load images, so opens are shown as estimates in the UI)
//   GET ?c=<token>  -> 302 to the stored link (only links saved on the campaign / step, never a URL from the request),
//                      records a "click" (and the contact's last_clicked_at)

const GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));
const gif = () => new Response(GIF, { headers: { "content-type": "image/gif", "cache-control": "no-store, no-cache, must-revalidate, private", "x-robots-tag": "noindex" } });
const SCANNER = /bot|crawler|spider|barracuda|mimecast|proofpoint|safelinks|urldefense|symantec|forcepoint|trendmicro|preview/i;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const o = url.searchParams.get("o");
  const c = url.searchParams.get("c");
  if (!o && !c) return new Response("not found", { status: 404 });
  try {
    const keys = await emailKeys();
    const payload = parseTrackPayload(await verifyToken(keys.track, "t", o || c || ""));
    if (!payload) return o ? gif() : new Response("This link has expired.", { status: 404, headers: { "content-type": "text/plain" } });
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    // The platform proxy rewrites user-agent; the reader's real one arrives as x-base44-caller-user-agent.
    const ua = String(req.headers.get("x-base44-caller-user-agent") || req.headers.get("user-agent") || "").slice(0, 160);
    const machine = SCANNER.test(ua) || !ua;

    let clientId = "", target = "", campaignId = "", automationId = "";
    if (payload.src === "c") {
      const camp = await db.EmailCampaign.get(payload.id).catch(() => null);
      if (!camp) return o ? gif() : new Response("This link has expired.", { status: 404 });
      clientId = camp.client_id; campaignId = camp.id;
      if (c) target = (Array.isArray(camp.links) ? camp.links : extractLinks(camp.html))[payload.link] || "";
    } else {
      const a = await db.EmailAutomation.get(payload.id).catch(() => null);
      if (!a) return o ? gif() : new Response("This link has expired.", { status: 404 });
      clientId = a.client_id; automationId = a.id;
      if (c) {
        const step = (a.steps || []).find((s: any) => s.id === payload.step);
        let links = Array.isArray(step?.links) ? step.links : null;
        if (!links && step) {
          const client = await db.CRMClient.get(a.client_id).catch(() => null);
          links = client ? stepLinks(step, await loadTheme(db, client, await loadSettings(db, client))) : [];
        }
        target = (links || [])[payload.link] || "";
      }
    }
    if (c && !/^https?:\/\//i.test(target)) return new Response("This link has expired.", { status: 404 });

    const at = new Date().toISOString();
    const contactId = payload.rid.startsWith("h") ? "" : payload.rid;
    const write = async () => {
      await db.EmailEvent.create({
        client_id: clientId, campaign_id: campaignId, automation_id: automationId, step_id: payload.step, rid: payload.rid, contact_id: contactId,
        type: c ? "click" : "open", url: c ? target.slice(0, 1000) : "", link_index: c ? payload.link : -1, machine, ua: ua.slice(0, 80), at,
      }).catch(() => null);
      if (contactId && !machine) {
        const ct = await db.EmailContact.get(contactId).catch(() => null);
        if (ct && ct.client_id === clientId) {
          await db.EmailContact.update(contactId, c
            ? { last_clicked_at: at, click_count: (Number(ct.click_count) || 0) + 1, ...(ct.last_opened_at ? {} : { last_opened_at: at }) }
            : { last_opened_at: at, open_count: (Number(ct.open_count) || 0) + 1 }).catch(() => null);
        }
      }
    };
    await write();
    if (o) return gif();
    return new Response(null, { status: 302, headers: { location: target, "cache-control": "no-store", "referrer-policy": "no-referrer" } });
  } catch (e) {
    console.error("email-track", (e as Error)?.message);
    return o ? gif() : new Response("Something went wrong.", { status: 500 });
  }
});
