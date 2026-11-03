import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { IG_GRAPH, errText, graph, igMe, igToken } from "../../shared/social.ts";

// TEMPORARY read-only probe (deleted right after use).
Deno.serve(async (req) => {
  const out: Record<string, unknown> = {};
  const base44 = createClientFromRequest(req);
  const t = await igToken(base44);
  const me = await igMe(t);
  const until = Math.floor(Date.now() / 1000);
  const tries: [string, string, Record<string, unknown>][] = [
    ["reach_ts", `${me.ig_id}/insights`, { metric: "reach", period: "day" }],
    ["reach_tv", `${me.ig_id}/insights`, { metric: "reach", period: "day", metric_type: "total_value" }],
    ["me_reach_tv", "me/insights", { metric: "reach", period: "day", metric_type: "total_value" }],
    ["views_tv_range", `${me.ig_id}/insights`, { metric: "views", period: "day", metric_type: "total_value", since: until - 7 * 86400, until }],
    ["follower_count", `${me.ig_id}/insights`, { metric: "follower_count", period: "day" }],
  ];
  for (const [k, p, params] of tries) {
    try { const r = await graph(IG_GRAPH, p, t, { params }); out[k] = JSON.stringify(r).slice(0, 200); } catch (e) { out[k] = `ERR ${errText(e)}`; }
  }
  try { const r = await graph(IG_GRAPH, "me", t, { params: { fields: "user_id,username" } }); out.me = r; } catch (e) { out.me = errText(e); }
  return Response.json(out);
});
