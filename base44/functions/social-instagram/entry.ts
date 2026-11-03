import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { requireSecondFactor } from "../../shared/twoFactor.ts";
import { Any, IG_GRAPH, errText, graph, graphRetry, publishSettings } from "../../shared/social.ts";

// Client-portal Instagram panel (Results tab). A client's OWN Instagram, never the agency account:
//   portal       -> what the Results panel shows for the signed-in client (or ?client_id preview for admins):
//                   { visible, account, can_connect, connected }. Hidden (visible:false) until data exists
//                   or admin turned on "invite to connect" for that client.
//   portal_sync  -> uses the signed-in app user's OWN Instagram connection (app-user connector, id from
//                   Social connections > ig_app_user_connector_id) to pull profile + recent posts, then
//                   stores them on that client's SocialAccount row. Never uses the shared agency token.
// Admins populate SocialAccount rows by hand in Social Studio > Connections when a client hasn't connected.

const pick = (o: Any, keys: string[]) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));
const PUBLIC = ["handle", "profile_picture_url", "followers_count", "follows_count", "media_count", "recent_media", "totals", "insights_30d", "synced_at", "source"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
    const gate = await requireSecondFactor(base44, req, user);
    if (gate) return gate;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "portal");
    const db = base44.asServiceRole.entities;

    // Resolve the client this login may see (same rule as the portal function).
    let client: Any = null;
    if (user.role === "admin" && body?.client_id) {
      client = await db.CRMClient.get(String(body.client_id)).catch(() => null);
    } else {
      const email = String(user.email || "").toLowerCase();
      const all = await db.CRMClient.filter({ portal_enabled: true }, "business", 500);
      client = (all || []).find((c: Any) => ((c.portal_emails as string[]) || []).some((e) => String(e).toLowerCase() === email)) || null;
    }
    if (!client) return Response.json({ error: "No portal is set up for this login yet.", code: "no_client" }, { status: 403 });

    const settings = await publishSettings(db);
    const connectorId = String(settings.ig_app_user_connector_id || "");
    const rows = (await db.SocialAccount.filter({ client_id: client.id, platform: "instagram" }, "-updated_date", 1).catch(() => [])) || [];
    const row = rows[0] || null;

    if (action === "portal") {
      const hasData = !!row && row.portal_visible !== false && (row.synced_at || row.followers_count != null || (row.recent_media || []).length > 0);
      const canConnect = !!connectorId && !!row?.invite_connect;
      return Response.json({
        visible: hasData || canConnect,
        account: hasData ? pick(row, PUBLIC) : null,
        can_connect: canConnect,
        connector_id: canConnect ? connectorId : null,
      });
    }

    if (action === "portal_sync") {
      if (!connectorId) return Response.json({ error: "Instagram connect isn't switched on yet." }, { status: 400 });
      if (user.role === "admin" && body?.client_id) return Response.json({ error: "Preview mode: the client has to connect from their own login." }, { status: 400 });
      let accessToken = "";
      try {
        ({ accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId));
      } catch {
        return Response.json({ connected: false, error: "not_connected" }, { status: 409 });
      }
      const data = await pullAccount(accessToken);
      const patch = { ...data, client_id: client.id, client_name: client.business, platform: "instagram", source: "app_user_connector", connected_by_email: String(user.email || "").toLowerCase(), synced_at: new Date().toISOString(), sync_error: "" };
      const saved = row ? await db.SocialAccount.update(row.id, patch) : await db.SocialAccount.create({ ...patch, portal_visible: true, invite_connect: true });
      return Response.json({ connected: true, account: pick({ ...row, ...saved, ...patch }, PUBLIC) });
    }

    return Response.json({ error: `Unknown action ${action}` }, { status: 400 });
  } catch (e) {
    return Response.json({ error: errText(e) }, { status: 500 });
  }
});

async function pullAccount(token: string) {
  const me = await graphRetry(IG_GRAPH, "me", token, { params: { fields: "user_id,username,profile_picture_url,followers_count,follows_count,media_count" } });
  const igId = String(me.user_id || me.id);
  const media = await graphRetry(IG_GRAPH, `${igId}/media`, token, { params: { fields: "id,caption,permalink,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count", limit: 12 } }).catch(() => ({ data: [] }));
  const recent: Any[] = [];
  for (const m of (media?.data || []).slice(0, 12)) {
    let reach: number | null = null;
    try {
      const r = await graph(IG_GRAPH, `${m.id}/insights`, token, { params: { metric: "reach" } });
      reach = r?.data?.[0]?.values?.[0]?.value ?? null;
    } catch { /* insights scope not granted: likes/comments still show */ }
    recent.push({
      id: m.id, caption: String(m.caption || "").slice(0, 280), permalink: m.permalink, media_type: m.media_type,
      image_url: m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url, timestamp: m.timestamp,
      like_count: m.like_count ?? 0, comments_count: m.comments_count ?? 0, reach,
    });
  }
  const totals = recent.reduce((t, m) => ({ likes: t.likes + (m.like_count || 0), comments: t.comments + (m.comments_count || 0), reach: t.reach + (m.reach || 0), posts: t.posts + 1 }), { likes: 0, comments: 0, reach: 0, posts: 0 });
  return {
    handle: me.username, ig_user_id: igId, profile_picture_url: me.profile_picture_url || "",
    followers_count: me.followers_count ?? null, follows_count: me.follows_count ?? null, media_count: me.media_count ?? null,
    recent_media: recent, totals,
  };
}
