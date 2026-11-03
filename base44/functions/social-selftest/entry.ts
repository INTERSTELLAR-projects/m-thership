import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { IG_GRAPH, errText, fbUserToken, graph, graphRetry, igMe, igToken } from "../../shared/social.ts";

// TEMPORARY self-test (deleted after verification). Creates an Instagram media CONTAINER for a fixed
// placeholder JPEG and checks its status. It NEVER calls media_publish, so nothing is posted;
// Instagram discards unpublished containers after 24h.
Deno.serve(async (req) => {
  const out: Record<string, unknown> = {};
  try {
    const base44 = createClientFromRequest(req);
    const token = await igToken(base44);
    const me = await igMe(token);
    out.account = { username: me.username, ig_id: me.ig_id, account_type: me.account_type, followers: me.followers_count, media: me.media_count };
    try {
      const q = await graph(IG_GRAPH, `${me.ig_id}/content_publishing_limit`, token, { params: { fields: "quota_usage,config" } });
      out.quota = q?.data?.[0] || q;
    } catch (e) { out.quota_error = errText(e); }
    const params: Record<string, unknown> = {
      image_url: "https://dummyimage.com/1080x1080/ebe8e4/1a1a1a.jpg&text=dry+run",
      caption: "Dry run container. Never published.",
      alt_text: "Plain test image",
    };
    try {
      const c = await graphRetry(IG_GRAPH, `${me.ig_id}/media`, token, { method: "POST", params });
      out.container_id = c.id;
      out.alt_text_accepted = true;
    } catch (e) {
      out.with_alt_error = errText(e);
      delete params.alt_text;
      const c = await graphRetry(IG_GRAPH, `${me.ig_id}/media`, token, { method: "POST", params });
      out.container_id = c.id;
      out.alt_text_accepted = false;
    }
    for (let i = 0; i < 8; i++) {
      const s = await graph(IG_GRAPH, String(out.container_id), token, { params: { fields: "status_code,status" } });
      out.status = s;
      if (s.status_code !== "IN_PROGRESS") break;
      await new Promise((r) => setTimeout(r, 2500));
    }
    try {
      const m = await graph(IG_GRAPH, `${me.ig_id}/media`, token, { params: { fields: "id,like_count,comments_count,permalink", limit: 1 } });
      const first = m?.data?.[0];
      out.latest_media = first ? { has_like_count: first.like_count !== undefined, has_permalink: !!first.permalink } : null;
      if (first) {
        try {
          await graph(IG_GRAPH, `${first.id}/insights`, token, { params: { metric: "reach,views,saved,shares" } });
          out.insights = "ok";
        } catch (e) { out.insights = errText(e); }
      }
    } catch (e) { out.media_error = errText(e); }
    out.facebook_connected = !!(await fbUserToken(base44));
    out.media_publish_called = false;
    return Response.json(out);
  } catch (e) {
    return Response.json({ ...out, error: errText(e) }, { status: 500 });
  }
});
