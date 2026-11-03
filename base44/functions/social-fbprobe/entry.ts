import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { FB_GRAPH, errText, graph } from "../../shared/social.ts";

// TEMPORARY read-only probe (deleted right after use). Reads permissions and page/IG links. Writes nothing.
Deno.serve(async (req) => {
  const out: Record<string, unknown> = {};
  try {
    const base44 = createClientFromRequest(req);
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("facebook_pages");
    const t = accessToken as string;
    try { out.permissions = (await graph(FB_GRAPH, "me/permissions", t))?.data; } catch (e) { out.permissions_error = errText(e); }
    try { out.me = await graph(FB_GRAPH, "me", t, { params: { fields: "id,name" } }); } catch (e) { out.me_error = errText(e); }
    let pages: Record<string, unknown>[] = [];
    try {
      pages = (await graph(FB_GRAPH, "me/accounts", t, { params: { fields: "id,name,tasks,access_token,instagram_business_account,connected_instagram_account", limit: 50 } }))?.data || [];
      out.pages = pages.map((p) => ({ id: p.id, name: p.name, tasks: p.tasks, ig: p.instagram_business_account, connected_ig: p.connected_instagram_account }));
    } catch (e) { out.pages_error = errText(e); }
    try { out.businesses = (await graph(FB_GRAPH, "me/businesses", t, { params: { fields: "id,name" } }))?.data; } catch (e) { out.businesses_error = errText(e); }
    const p = pages.find((x) => (x as Record<string, Record<string, unknown>>).instagram_business_account) as Record<string, unknown> | undefined;
    if (p) {
      const ig = String((p.instagram_business_account as Record<string, unknown>).id);
      for (const [label, tok] of [["user", t], ["page", String(p.access_token)]]) {
        try { out[`ig_profile_${label}`] = await graph(FB_GRAPH, ig, tok, { params: { fields: "username,followers_count,media_count,profile_picture_url" } }); } catch (e) { out[`ig_profile_${label}_error`] = errText(e); }
        try { out[`ig_insights_${label}`] = await graph(FB_GRAPH, `${ig}/insights`, tok, { params: { metric: "reach,profile_views,accounts_engaged,total_interactions", period: "day", metric_type: "total_value" } }); } catch (e) { out[`ig_insights_${label}_error`] = errText(e); }
        try { out[`ig_media_${label}`] = (await graph(FB_GRAPH, `${ig}/media`, tok, { params: { fields: "id,like_count,comments_count,permalink", limit: 2 } }))?.data?.length; } catch (e) { out[`ig_media_${label}_error`] = errText(e); }
      }
    }
    return Response.json(out);
  } catch (e) {
    return Response.json({ ...out, error: errText(e) }, { status: 500 });
  }
});
