import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { Any, FB_GRAPH, errText, graph, graphRetry } from "../../shared/social.ts";

// Client Instagram reports via the agency/partner model. Clients give Interstellar (Justin's Facebook
// profile, or the Interstellar business portfolio with Justin assigned) access to their Facebook Page and
// its linked Instagram professional account. No client passwords. The shared "facebook_pages" connector
// token then reads the client's IG account with Facebook Login permissions (instagram_basic +
// instagram_manage_insights). Read-only: nothing here posts, comments or messages.
//
//   reachable (admin)        IG accounts the Facebook login can see, with which client each is linked to
//   link      (admin)        { client_id, ig_user_id } -> SocialAccount mapping (source facebook_partner)
//   unlink    (admin)        { client_id }
//   sync      (schedule/admin, optional client_id) profile, 30-day insights, recent media; monthly
//                            PerformanceSnapshot (source "instagram") so reports and the portal pick it up

const NEEDED = ["instagram_basic", "instagram_manage_insights"];
const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "reachable");
    const user = await base44.auth.me().catch(() => null);
    const isAdmin = user?.role === "admin";
    const db = base44.asServiceRole.entities;

    if (action === "sync") {
      if (user && !isAdmin) return Response.json({ error: "Admins only" }, { status: 403 });
      return Response.json(await syncAll(base44, db, body?.client_id ? String(body.client_id) : null));
    }
    if (!isAdmin) return Response.json({ error: "Admins only" }, { status: 403 });

    if (action === "reachable") return Response.json(await reachable(base44, db));

    if (action === "link") {
      const clientId = String(body?.client_id || "");
      const igId = String(body?.ig_user_id || "");
      const client = clientId ? await db.CRMClient.get(clientId).catch(() => null) : null;
      if (!client) return Response.json({ error: "Client not found" }, { status: 404 });
      const r = await reachable(base44, db);
      const acct = (r.accounts as Any[]).find((a) => a.ig_user_id === igId);
      if (!acct) return Response.json({ error: "That Instagram account isn't reachable through the Facebook connection." }, { status: 400 });
      const rows = (await db.SocialAccount.filter({ client_id: clientId, platform: "instagram" }, "-updated_date", 1).catch(() => [])) || [];
      const data = {
        client_id: clientId, client_name: client.business, platform: "instagram", source: "facebook_partner",
        ig_user_id: igId, handle: acct.username, profile_picture_url: acct.profile_picture_url || "", followers_count: acct.followers_count ?? null,
        fb_page_id: acct.page_id, fb_page_name: acct.page_name, linked_by: user.email, linked_at: new Date().toISOString(), sync_error: "",
      };
      const saved = rows[0] ? await db.SocialAccount.update(rows[0].id, data) : await db.SocialAccount.create({ ...data, portal_visible: true });
      const synced = await syncAll(base44, db, clientId);
      return Response.json({ ok: true, account: saved, sync: synced });
    }

    if (action === "unlink") {
      const rows = (await db.SocialAccount.filter({ client_id: String(body?.client_id || ""), platform: "instagram" }, "-updated_date", 1).catch(() => [])) || [];
      if (rows[0]) await db.SocialAccount.update(rows[0].id, { source: "manual", ig_user_id: "", fb_page_id: "", fb_page_name: "" });
      return Response.json({ ok: true });
    }

    return Response.json({ error: `Unknown action ${action}` }, { status: 400 });
  } catch (e) {
    return Response.json({ error: errText(e) }, { status: 500 });
  }
});

async function fbToken(base44: Any): Promise<string> {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection("facebook_pages");
  if (!accessToken) throw new Error("Facebook Pages connector has no token");
  return accessToken as string;
}

/** Pages the login can use (own + assigned through a business portfolio) with their linked IG accounts. */
async function pagesWithIg(token: string) {
  const fields = "id,name,access_token,instagram_business_account{id,username,profile_picture_url,followers_count}";
  const pages = new Map<string, Any>();
  const add = (list: Any[], via: string) => list.forEach((p) => { if (!pages.has(p.id)) pages.set(p.id, { ...p, via }); });
  add((await graphRetry(FB_GRAPH, "me/accounts", token, { params: { fields, limit: 100 } }))?.data || [], "page_access");
  // Pages shared with a business portfolio Justin belongs to (partner access). Best effort.
  const biz = (await graph(FB_GRAPH, "me/businesses", token, { params: { fields: "id,name", limit: 25 } }).catch(() => null))?.data || [];
  for (const b of biz) {
    for (const edge of ["client_pages", "owned_pages"]) {
      const r = await graph(FB_GRAPH, `${b.id}/${edge}`, token, { params: { fields: "id,name,instagram_business_account{id,username,profile_picture_url,followers_count}", limit: 100 } }).catch(() => null);
      add(r?.data || [], `business:${b.name}`);
    }
  }
  return Array.from(pages.values());
}

async function grantedScopes(token: string) {
  const r = await graph(FB_GRAPH, "me/permissions", token).catch(() => null);
  return ((r?.data || []) as Any[]).filter((p) => p.status === "granted").map((p) => String(p.permission));
}

async function reachable(base44: Any, db: Any) {
  let token: string;
  try { token = await fbToken(base44); } catch (e) {
    return { connected: false, error: errText(e), accounts: [], pages: [], missing_scopes: NEEDED };
  }
  const granted = await grantedScopes(token);
  const missing = NEEDED.filter((s) => !granted.includes(s));
  const pages = await pagesWithIg(token);
  const links = ((await db.SocialAccount.filter({ platform: "instagram" }, "-updated_date", 300).catch(() => [])) || []) as Any[];
  const accounts = pages.filter((p) => p.instagram_business_account?.id).map((p) => {
    const ig = p.instagram_business_account;
    const link = links.find((l) => l.ig_user_id === ig.id && l.source === "facebook_partner");
    return {
      ig_user_id: String(ig.id), username: ig.username || "", profile_picture_url: ig.profile_picture_url || "", followers_count: ig.followers_count ?? null,
      page_id: String(p.id), page_name: p.name, via: p.via, linked_client_id: link?.client_id || null, linked_client_name: link?.client_name || null,
    };
  });
  return {
    connected: true, granted_scopes: granted, missing_scopes: missing,
    pages: pages.map((p) => ({ id: p.id, name: p.name, via: p.via, has_instagram: !!p.instagram_business_account?.id })),
    accounts,
  };
}

/** Reads one IG account; tries the user token, then the Page token (some partner setups only work with it). */
async function readIg(userToken: string, pageToken: string | null, igId: string) {
  const call = async (path: string, params: Record<string, unknown>) => {
    try { return await graphRetry(FB_GRAPH, path, userToken, { params }); } catch (e) {
      if (!pageToken) throw e;
      return await graphRetry(FB_GRAPH, path, pageToken, { params });
    }
  };
  const profile = await call(igId, { fields: "username,profile_picture_url,followers_count,follows_count,media_count" });

  // Account insights, last 30 days and month to date (total_value; max 30-day windows). impressions is
  // deprecated (v22+); views replaces it. profile_views is requested separately because Meta has been
  // retiring it and it must not sink the whole request.
  const now = new Date();
  const until = Math.floor(now.getTime() / 1000);
  const since30 = Math.floor((now.getTime() - 29 * DAY) / 1000);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const sinceMonth = Math.floor(monthStart.getTime() / 1000);
  const totals = async (since: number) => {
    const out: Record<string, number> = {};
    const notes: string[] = [];
    for (const metric of ["reach,views,accounts_engaged,total_interactions,likes,comments,saves,shares", "profile_views"]) {
      try {
        const r = await call(`${igId}/insights`, { metric, period: "day", metric_type: "total_value", since, until });
        for (const row of r?.data || []) out[row.name] = row.total_value?.value ?? 0;
      } catch (e) { notes.push(`${metric.split(",")[0]}: ${errText(e)}`); }
    }
    return { out, notes };
  };
  const last30 = await totals(since30);
  const mtd = now.getUTCDate() > 1 ? await totals(sinceMonth) : { out: {}, notes: [] };

  const media = await call(`${igId}/media`, { fields: "id,caption,permalink,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count", limit: 12 }).catch(() => ({ data: [] }));
  const recent: Any[] = [];
  for (const m of (media?.data || []).slice(0, 12)) {
    let reach: number | null = null;
    try {
      const r = await call(`${m.id}/insights`, { metric: "reach" });
      reach = r?.data?.[0]?.values?.[0]?.value ?? r?.data?.[0]?.total_value?.value ?? null;
    } catch { /* older media or missing scope */ }
    recent.push({
      id: m.id, caption: String(m.caption || "").slice(0, 280), permalink: m.permalink, media_type: m.media_type,
      image_url: m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url, timestamp: m.timestamp,
      like_count: m.like_count ?? 0, comments_count: m.comments_count ?? 0, reach,
    });
  }
  return { profile, last30, mtd, recent, monthStart, now };
}

async function syncAll(base44: Any, db: Any, onlyClient: string | null) {
  const started = new Date().toISOString();
  const q: Record<string, unknown> = { platform: "instagram", source: "facebook_partner" };
  if (onlyClient) q.client_id = onlyClient;
  const rows = (((await db.SocialAccount.filter(q, "-updated_date", 200).catch(() => [])) || []) as Any[]).filter((r) => r.ig_user_id);
  if (!rows.length) return { ok: true, synced: 0 };
  let token: string;
  try { token = await fbToken(base44); } catch (e) { return { ok: false, error: errText(e) }; }
  const pageTokens = new Map<string, string>();
  ((await graph(FB_GRAPH, "me/accounts", token, { params: { fields: "id,access_token", limit: 100 } }).catch(() => null))?.data || [])
    .forEach((p: Any) => pageTokens.set(String(p.id), p.access_token));

  const results: Any[] = [];
  for (const row of rows) {
    try {
      const r = await readIg(token, pageTokens.get(String(row.fb_page_id)) || null, row.ig_user_id);
      const recent = r.recent;
      const totals = recent.reduce((t: Any, m: Any) => ({ likes: t.likes + (m.like_count || 0), comments: t.comments + (m.comments_count || 0), reach: t.reach + (m.reach || 0), posts: t.posts + 1 }), { likes: 0, comments: 0, reach: 0, posts: 0 });
      const ins = { ...r.last30.out, since: iso(new Date(r.now.getTime() - 29 * DAY)), until: iso(r.now), note: r.last30.notes.join(" · ").slice(0, 400) || undefined };
      await db.SocialAccount.update(row.id, {
        handle: r.profile.username || row.handle, profile_picture_url: r.profile.profile_picture_url || "",
        followers_count: r.profile.followers_count ?? null, follows_count: r.profile.follows_count ?? null, media_count: r.profile.media_count ?? null,
        recent_media: recent, totals, insights_30d: ins, synced_at: new Date().toISOString(), sync_error: "",
      });

      // Month-to-date snapshot (one per client per month) for the client Performance tab, the portal
      // Results tab and monthly reports.
      if (row.client_id && r.now.getUTCDate() > 1) {
        const periodStart = iso(r.monthStart);
        const periodEnd = iso(new Date(r.now.getTime() - DAY));
        const posted = recent.filter((m: Any) => String(m.timestamp || "") >= periodStart);
        const metrics = {
          followers: r.profile.followers_count ?? null,
          reach: r.mtd.out.reach ?? null, views: r.mtd.out.views ?? null, accounts_engaged: r.mtd.out.accounts_engaged ?? null,
          total_interactions: r.mtd.out.total_interactions ?? null, profile_views: r.mtd.out.profile_views ?? null,
          posts: posted.length, likes: r.mtd.out.likes ?? null, comments: r.mtd.out.comments ?? null,
        };
        const existing = ((await db.PerformanceSnapshot.filter({ client_id: row.client_id, source: "instagram", period_start: periodStart }, "-captured_at", 1).catch(() => [])) || [])[0];
        const snap = { client_id: row.client_id, source: "instagram", period_start: periodStart, period_end: periodEnd, metrics, captured_at: new Date().toISOString() };
        if (existing) await db.PerformanceSnapshot.update(existing.id, snap); else await db.PerformanceSnapshot.create(snap);
      }
      results.push({ client: row.client_name, handle: r.profile.username, ok: true, note: ins.note });
    } catch (e) {
      const msg = errText(e);
      await db.SocialAccount.update(row.id, { sync_error: /permission|\(#10\)|\(#200\)|scope/i.test(msg) ? `Missing access: ${msg}. Check the client still gives Interstellar access, and that the Facebook connector has instagram_basic + instagram_manage_insights.` : msg });
      results.push({ client: row.client_name, ok: false, error: msg });
    }
  }
  const bad = results.filter((r) => !r.ok).length;
  await db.AutomationRun.create({
    automation_name: "Social Studio · client Instagram sync", kind: "social_insights", started_at: started, finished_at: new Date().toISOString(),
    status: bad ? "failed" : "success", title: `Synced ${results.length - bad} of ${results.length} client Instagram account${results.length === 1 ? "" : "s"}`,
    message: results.map((r) => `${r.client}: ${r.ok ? `@${r.handle}${r.note ? ` (${r.note})` : ""}` : r.error}`).join("\n").slice(0, 2000),
  }).catch(() => null);
  return { ok: !bad, synced: results.length - bad, results };
}
