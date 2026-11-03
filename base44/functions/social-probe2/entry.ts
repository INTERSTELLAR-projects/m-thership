import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { FB_GRAPH, IG_GRAPH, errText, graph, igMe, igToken } from "../../shared/social.ts";

// TEMPORARY read-only probe (deleted right after use).
Deno.serve(async (req) => {
  const out: Record<string, unknown> = {};
  const base44 = createClientFromRequest(req);
  try {
    const t = await igToken(base44);
    const me = await igMe(t);
    const until = Math.floor(Date.now() / 1000);
    try {
      const r = await graph(IG_GRAPH, `${me.ig_id}/insights`, t, { params: { metric: "reach,views,accounts_engaged,total_interactions", period: "day", metric_type: "total_value", since: until - 29 * 86400, until } });
      out.ig_account_insights = Object.fromEntries((r?.data || []).map((x: Record<string, Record<string, unknown>>) => [x.name, x.total_value?.value]));
    } catch (e) { out.ig_account_insights_error = errText(e); }
    try {
      await graph(IG_GRAPH, `${me.ig_id}/insights`, t, { params: { metric: "profile_views", period: "day", metric_type: "total_value", since: until - 29 * 86400, until } });
      out.profile_views = "ok";
    } catch (e) { out.profile_views_error = errText(e); }
  } catch (e) { out.ig_error = errText(e); }
  try {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("facebook_pages");
    for (const edge of ["client_pages", "owned_pages"]) {
      try { out[edge] = ((await graph(FB_GRAPH, `1006341388054003/${edge}`, accessToken, { params: { fields: "id,name" } }))?.data || []).length; } catch (e) { out[`${edge}_error`] = errText(e); }
    }
    try { out.page_ig_field = (await graph(FB_GRAPH, "1416732304855816", accessToken, { params: { fields: "instagram_business_account" } })); } catch (e) { out.page_ig_error = errText(e); }
  } catch (e) { out.fb_error = errText(e); }
  return Response.json(out);
});
