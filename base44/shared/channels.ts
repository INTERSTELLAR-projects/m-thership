// Social Studio content engine: one Channel adapter per platform (publish, status, insights, limits).
// Used by base44/functions/social-channels. NOTHING here runs unless an admin approved the variant
// (SocialVariant.status "approved" + approved_at); the function enforces that before calling publish().
//
// Modes per account:
//   auto              a Base44 connector or a Base44 Secret is in place and the platform has a posting API
//   needs_connection  a posting API exists but the connector / secret / scope is missing (setup steps in the UI)
//   manual            no posting API (WhatsApp Channels, YouTube video upload, TikTok, GBP until Google approves),
//                     or a rule says a human should post (Reddit outside our own subreddit): copy, download, open,
//                     then "Mark posted" with the URL.
//
// Secrets: account.secret_ref names a Base44 Secret. Only names matching /^SOCIAL_[A-Z0-9_]+$/ are ever read,
// so an account record can never point the publisher at another secret (Stripe, Anthropic, SES...).

import {
  Any, FB_GRAPH, GraphError, IG_GRAPH, errText, fbPages, graph, graphRetry, igMe, publishSettings,
} from "./social.ts";

export const THREADS_GRAPH = "https://graph.threads.net/v1.0";
export const LI_VERSION = "202609"; // LinkedIn-Version header (YYYYMM). Bump yearly: LinkedIn sunsets versions after ~12 months.
const UA = "Mothership-SocialStudio/1.0 (by Interstellar Strategies)";
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Mode = "auto" | "needs_connection" | "manual";
export type Resolved = { mode: Mode; reason: string; missing?: string[] };
export type Published = { external_id: string; url: string; extra?: Record<string, unknown> };

/** Hard platform limits (characters / API caps). Daily posting limits are editable in the engine settings. */
export const LIMITS: Record<string, Any> = {
  instagram: { text: 2200, hashtags: 30, api_per_24h: "read live from content_publishing_limit", carousel_max: 10 },
  facebook: { text: 63206 },
  youtube: { title: 100, text: 5000 },
  linkedin: { text: 3000 },
  tiktok: { title: 90, text: 4000 },
  threads: { text: 500, api_per_24h: 250 },
  x: { text: 280 },
  pinterest: { title: 100, text: 500 },
  gbp: { text: 1500 },
  discord: { text: 2000 },
  telegram: { text: 4096, caption: 1024 },
  reddit: { title: 300, text: 40000 },
  whatsapp: { text: 1024 },
};

export function readSecret(name: unknown): string {
  const n = String(name || "").trim();
  if (!/^SOCIAL_[A-Z0-9_]{2,60}$/.test(n)) return "";
  return Deno.env.get(n) || "";
}

/** Connector tokens, cached per run. Never logged. */
export function makeCtx(base44: Any, db: Any) {
  const cache = new Map<string, Promise<string | null>>();
  const token = (type: string) => {
    if (!cache.has(type)) {
      cache.set(type, base44.asServiceRole.connectors.getConnection(type).then((c: Any) => c?.accessToken || null).catch(() => null));
    }
    return cache.get(type)!;
  };
  let fbScopes: Promise<string[]> | null = null;
  const facebookScopes = () => {
    if (!fbScopes) {
      fbScopes = token("facebook_pages").then(async (t) => {
        if (!t) return [];
        const r = await graph(FB_GRAPH, "me/permissions", t).catch(() => null);
        return ((r?.data || []) as Any[]).filter((p) => p.status === "granted").map((p) => String(p.permission));
      });
    }
    return fbScopes;
  };
  let pagesP: Promise<Any[]> | null = null;
  const pages = () => {
    if (!pagesP) pagesP = token("facebook_pages").then((t) => (t ? fbPages(t).catch(() => []) : []));
    return pagesP;
  };
  return { base44, db, token, facebookScopes, pages, settings: () => publishSettings(db) };
}
export type Ctx = ReturnType<typeof makeCtx>;

const isInterstellar = (a: Any) => !a?.client_id || a.client_id === "interstellar";
const textOf = (v: Any) => String(v?.text || "").trim();
const firstImage = (v: Any) => String((v?.image_urls && v.image_urls[0]) || v?.image_url || "");
const needsHttps = (u: string) => /^https:\/\//.test(u);

async function jfetch(url: string, init: RequestInit = {}) {
  let res: Response;
  try { res = await fetch(url, init); } catch (e) { throw new GraphError(`Network error: ${(e as Error).message}`, 0, null); }
  const text = await res.text();
  let body: Any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 300) }; }
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || body?.detail || body?.description || body?.title || body?.raw || `HTTP ${res.status}`;
    throw new GraphError(String(msg).slice(0, 400), res.status, body?.error || null);
  }
  return { body, headers: res.headers };
}

/* ─── Adapters ─────────────────────────────────────────────────────────── */

type Adapter = {
  resolve: (ctx: Ctx, a: Any) => Promise<Resolved>;
  publish?: (ctx: Ctx, a: Any, v: Any) => Promise<Published>;
  insights?: (ctx: Ctx, a: Any, v: Any) => Promise<Record<string, unknown> | null>;
  test?: (ctx: Ctx, a: Any) => Promise<Record<string, unknown>>;
};

/* Instagram ─ Interstellar: shared "instagram" connector (Instagram Login). Clients: their IG through the
   Facebook Pages connector (partner access) — needs instagram_content_publish on that connector. */
const instagram: Adapter = {
  async resolve(ctx, a) {
    if (isInterstellar(a)) {
      return (await ctx.token("instagram"))
        ? { mode: "auto", reason: "Instagram Business connector (shared)" }
        : { mode: "needs_connection", reason: "Connect the Instagram Business connector", missing: ["connector:instagram"] };
    }
    if (!a.ig_user_id) return { mode: "manual", reason: "Link the client's Instagram in Client Instagram first (partner access)", missing: ["ig_user_id"] };
    const scopes = await ctx.facebookScopes();
    if (!scopes.includes("instagram_content_publish")) {
      return { mode: "needs_connection", reason: "Facebook Pages connector is missing instagram_content_publish (+ instagram_basic)", missing: ["scope:instagram_content_publish"] };
    }
    return { mode: "auto", reason: "Client IG via Facebook partner access" };
  },
  async publish(ctx, a, v) {
    const caption = textOf(v);
    if (caption.length > LIMITS.instagram.text) throw new Error(`Caption is ${caption.length} characters; Instagram allows 2,200.`);
    let base = IG_GRAPH, token = "", igId = "";
    if (isInterstellar(a)) {
      token = (await ctx.token("instagram")) || "";
      if (!token) throw new Error("Instagram connector is not connected");
      igId = (await igMe(token)).ig_id;
    } else {
      base = FB_GRAPH;
      const page = (await ctx.pages()).find((p: Any) => p.instagram_business_account?.id === a.ig_user_id || String(p.id) === String(a.fb_page_id));
      token = page?.access_token || (await ctx.token("facebook_pages")) || "";
      igId = String(a.ig_user_id);
    }
    const urls: string[] = (v.image_urls?.length ? v.image_urls : [v.image_url]).filter(needsHttps);
    if (!urls.length) throw new Error("No rendered image. Approve the variant again so its image is rendered and uploaded.");
    const wait = async (id: string) => {
      for (let i = 0; i < 15; i++) {
        const r = await graphRetry(base, id, token, { params: { fields: "status_code" } });
        const st = String(r.status_code || "IN_PROGRESS");
        if (st === "FINISHED") return;
        if (st === "ERROR" || st === "EXPIRED") throw new Error(`Instagram could not process the media (${st}).`);
        await pause(i < 3 ? 2000 : 4000);
      }
      throw new Error("Instagram is still processing the media. It will retry on the next run.");
    };
    let creation = "";
    if (v.format === "story") {
      creation = String((await graphRetry(base, `${igId}/media`, token, { method: "POST", params: { image_url: urls[0], media_type: "STORIES" } })).id);
    } else if (v.format === "carousel" && urls.length > 1) {
      const kids: string[] = [];
      for (const u of urls.slice(0, LIMITS.instagram.carousel_max)) {
        kids.push(String((await graphRetry(base, `${igId}/media`, token, { method: "POST", params: { image_url: u, is_carousel_item: true } })).id));
      }
      for (const k of kids) await wait(k);
      creation = String((await graphRetry(base, `${igId}/media`, token, { method: "POST", params: { media_type: "CAROUSEL", children: kids.join(","), caption } })).id);
    } else {
      const params: Record<string, unknown> = { image_url: urls[0], caption };
      if (v.alt_text) params.alt_text = String(v.alt_text).slice(0, 1000);
      try {
        creation = String((await graphRetry(base, `${igId}/media`, token, { method: "POST", params })).id);
      } catch (e) {
        if (!/alt_text/i.test(errText(e))) throw e;
        creation = String((await graphRetry(base, `${igId}/media`, token, { method: "POST", params: { image_url: urls[0], caption } })).id);
      }
    }
    await wait(creation);
    // media_publish is not blindly retried: a lost response may still have posted.
    const r = await graph(base, `${igId}/media_publish`, token, { method: "POST", params: { creation_id: creation } });
    const id = String(r.id);
    const m = await graphRetry(base, id, token, { params: { fields: "permalink" } }).catch(() => null);
    return { external_id: id, url: m?.permalink || "", extra: { container_id: creation } };
  },
  async insights(ctx, a, v) {
    const base = isInterstellar(a) ? IG_GRAPH : FB_GRAPH;
    const token = isInterstellar(a) ? await ctx.token("instagram") : await ctx.token("facebook_pages");
    if (!token) return null;
    const out: Record<string, unknown> = {};
    const m = await graphRetry(base, v.external_id, token, { params: { fields: "like_count,comments_count" } }).catch(() => null);
    if (m) { out.likes = m.like_count ?? 0; out.comments = m.comments_count ?? 0; }
    const metric = v.format === "story" ? "reach,views,shares" : "reach,views,saved,shares";
    try {
      const r = await graph(base, `${v.external_id}/insights`, token, { params: { metric } });
      for (const row of r?.data || []) out[row.name === "saved" ? "saves" : row.name] = row.values?.[0]?.value ?? row.total_value?.value ?? null;
    } catch (e) { out.note = errText(e).slice(0, 200); }
    return out;
  },
};

/* Facebook Page ─ Interstellar: the Page chosen in Social connections. Clients: their Page through partner access. */
async function pageFor(ctx: Ctx, a: Any) {
  const id = isInterstellar(a) ? String((await ctx.settings()).facebook_page_id || a.target_id || "") : String(a.target_id || a.fb_page_id || "");
  if (!id) return null;
  return (await ctx.pages()).find((p: Any) => String(p.id) === id) || null;
}
const facebook: Adapter = {
  async resolve(ctx, a) {
    if (!(await ctx.token("facebook_pages"))) return { mode: "needs_connection", reason: "Connect the Facebook Pages connector", missing: ["connector:facebook_pages"] };
    const scopes = await ctx.facebookScopes();
    if (scopes.length && !scopes.includes("pages_manage_posts")) return { mode: "needs_connection", reason: "Facebook Pages connector lacks pages_manage_posts", missing: ["scope:pages_manage_posts"] };
    const page = await pageFor(ctx, a);
    if (!page?.access_token) return { mode: isInterstellar(a) ? "needs_connection" : "manual", reason: isInterstellar(a) ? "Pick the Interstellar Page in Social connections" : "The client's Page isn't shared with Interstellar (set Page ID + partner access)", missing: ["page"] };
    return { mode: "auto", reason: `Page: ${page.name}` };
  },
  async publish(ctx, a, v) {
    const page = await pageFor(ctx, a);
    if (!page?.access_token) throw new Error("The Facebook Page isn't available to the connected account");
    const msg = textOf(v);
    const urls: string[] = (v.image_urls?.length ? v.image_urls : [v.image_url]).filter(needsHttps);
    let postId = "";
    if (urls.length > 1) {
      const ids: string[] = [];
      for (const u of urls.slice(0, 10)) ids.push(String((await graphRetry(FB_GRAPH, `${page.id}/photos`, page.access_token, { method: "POST", params: { url: u, published: false } })).id));
      const params: Record<string, unknown> = { message: msg };
      ids.forEach((id, i) => { params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
      postId = String((await graphRetry(FB_GRAPH, `${page.id}/feed`, page.access_token, { method: "POST", params })).id);
    } else if (urls.length === 1) {
      const r = await graphRetry(FB_GRAPH, `${page.id}/photos`, page.access_token, { method: "POST", params: { url: urls[0], message: msg, published: true } });
      postId = String(r.post_id || r.id);
    } else {
      postId = String((await graphRetry(FB_GRAPH, `${page.id}/feed`, page.access_token, { method: "POST", params: { message: msg, link: v.link || undefined } })).id);
    }
    const p = await graphRetry(FB_GRAPH, postId, page.access_token, { params: { fields: "permalink_url" } }).catch(() => null);
    return { external_id: postId, url: p?.permalink_url || "", extra: { page_id: String(page.id) } };
  },
  async insights(ctx, a, v) {
    const page = await pageFor(ctx, a);
    if (!page?.access_token) return null;
    const f = await graph(FB_GRAPH, v.external_id, page.access_token, { params: { fields: "reactions.summary(true).limit(0),comments.summary(true).limit(0),shares" } }).catch(() => null);
    if (!f) return null;
    return { reactions: f.reactions?.summary?.total_count ?? 0, comments: f.comments?.summary?.total_count ?? 0, shares: f.shares?.count ?? 0 };
  },
};

/* LinkedIn ─ "linkedin" connector (shared, Interstellar). Personal profile: w_member_social. Company page:
   w_organization_social (+ r_organization_social for stats), which LinkedIn grants only to apps approved for the
   Community Management API. Clients: manual (or per-user connector later). */
const liHeaders = (t: string) => ({ Authorization: `Bearer ${t}`, "LinkedIn-Version": LI_VERSION, "X-Restli-Protocol-Version": "2.0.0" });
// LinkedIn "little text" format: escape reserved characters, but keep #hashtags working.
const liEscape = (s: string) => s.replace(/[\\|{}@[\]()<>*_~]/g, (c) => `\\${c}`);
async function liAuthor(t: string, a: Any) {
  if (a.account_kind === "company") {
    const id = String(a.target_id || "").replace(/^urn:li:organization:/, "");
    if (!/^\d+$/.test(id)) throw new Error("Set the company page's numeric organization ID on the account");
    return `urn:li:organization:${id}`;
  }
  const me = (await jfetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${t}` } })).body;
  if (!me?.sub) throw new Error("LinkedIn didn't return the member id (needs openid + profile scopes)");
  return `urn:li:person:${me.sub}`;
}
async function liUpload(t: string, kind: "images" | "documents", owner: string, srcUrl: string) {
  const init = (await jfetch(`https://api.linkedin.com/rest/${kind}?action=initializeUpload`, {
    method: "POST", headers: { ...liHeaders(t), "content-type": "application/json" },
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  })).body?.value;
  const bytes = new Uint8Array(await (await fetch(srcUrl)).arrayBuffer());
  const up = await fetch(init.uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${t}` }, body: bytes });
  if (!up.ok) throw new Error(`LinkedIn ${kind} upload failed (HTTP ${up.status})`);
  return String(init.image || init.document);
}
const linkedin: Adapter = {
  async resolve(ctx, a) {
    if (!isInterstellar(a)) return { mode: "manual", reason: "Client LinkedIn: copy + post by hand (a per-user connector can light this up later)" };
    if (!(await ctx.token("linkedin"))) return { mode: "needs_connection", reason: "Connect the LinkedIn connector", missing: ["connector:linkedin"] };
    if (a.account_kind === "company" && !/^\d+$/.test(String(a.target_id || "").replace(/^urn:li:organization:/, ""))) {
      return { mode: "needs_connection", reason: "Add the company page's organization ID", missing: ["target_id"] };
    }
    return { mode: "auto", reason: a.account_kind === "company" ? "LinkedIn company page (needs w_organization_social)" : "LinkedIn member (w_member_social)" };
  },
  async publish(ctx, a, v) {
    const t = await ctx.token("linkedin");
    if (!t) throw new Error("LinkedIn connector is not connected");
    const author = await liAuthor(t, a);
    const post: Any = {
      author, commentary: liEscape(textOf(v)).slice(0, LIMITS.linkedin.text), visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false,
    };
    const img = firstImage(v);
    if (v.format === "document" && needsHttps(String(v.document_url || ""))) {
      post.content = { media: { id: await liUpload(t, "documents", author, v.document_url), title: String(v.title || "Carousel").slice(0, 200) } };
    } else if (needsHttps(img)) {
      post.content = { media: { id: await liUpload(t, "images", author, img), altText: String(v.alt_text || "").slice(0, 300) } };
    }
    const r = await jfetch("https://api.linkedin.com/rest/posts", { method: "POST", headers: { ...liHeaders(t), "content-type": "application/json" }, body: JSON.stringify(post) });
    const urn = r.headers.get("x-restli-id") || r.headers.get("x-linkedin-id") || "";
    return { external_id: urn, url: urn ? `https://www.linkedin.com/feed/update/${urn}/` : "" };
  },
  async insights(ctx, a, v) {
    if (a.account_kind !== "company") return { note: "LinkedIn doesn't expose personal post stats to apps" };
    const t = await ctx.token("linkedin");
    if (!t) return null;
    const org = `urn:li:organization:${String(a.target_id).replace(/^urn:li:organization:/, "")}`;
    const key = String(v.external_id).startsWith("urn:li:ugcPost") ? "ugcPosts" : "shares";
    const q = `q=organizationalEntity&organizationalEntity=${encodeURIComponent(org)}&${key}=List(${encodeURIComponent(v.external_id)})`;
    const r = await jfetch(`https://api.linkedin.com/rest/organizationalEntityShareStatistics?${q}`, { headers: liHeaders(t) }).catch((e) => ({ body: { error: errText(e) } }));
    const s = (r.body as Any)?.elements?.[0]?.totalShareStatistics;
    if (!s) return { note: (r.body as Any)?.error ? `Needs r_organization_social: ${String((r.body as Any).error).slice(0, 120)}` : "No stats yet" };
    return { impressions: s.impressionCount, clicks: s.clickCount, likes: s.likeCount, comments: s.commentCount, shares: s.shareCount, engagement: s.engagement };
  },
  async test(ctx, a) {
    const t = await ctx.token("linkedin");
    if (!t) return { ok: false, error: "Not connected" };
    const me = (await jfetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${t}` } })).body;
    return { ok: true, member: me?.name || me?.sub, kind: a.account_kind || "personal" };
  },
};

/* X ─ "x" connector (shared_only; each API call uses Base44 integration credits). */
const x: Adapter = {
  async resolve(ctx, a) {
    if (!isInterstellar(a)) return { mode: "manual", reason: "The X connector is shared-only (one account: Interstellar). Clients post by hand." };
    return (await ctx.token("x")) ? { mode: "auto", reason: "X connector (shared, uses integration credits)" } : { mode: "needs_connection", reason: "Connect the X connector", missing: ["connector:x"] };
  },
  async publish(ctx, _a, v) {
    const t = await ctx.token("x");
    if (!t) throw new Error("X connector is not connected");
    const text = textOf(v);
    if ([...text].length > LIMITS.x.text) throw new Error(`Post is ${[...text].length} characters; X allows 280 on a standard account.`);
    const body: Any = { text };
    const img = firstImage(v);
    if (needsHttps(img)) {
      const blob = await (await fetch(img)).blob();
      const fd = new FormData();
      fd.append("media", blob, "image.jpg");
      fd.append("media_category", "tweet_image");
      const up = await jfetch("https://api.x.com/2/media/upload", { method: "POST", headers: { Authorization: `Bearer ${t}` }, body: fd });
      const mid = up.body?.data?.id || up.body?.media_id_string;
      if (mid) body.media = { media_ids: [String(mid)] };
    }
    const r = await jfetch("https://api.x.com/2/tweets", { method: "POST", headers: { Authorization: `Bearer ${t}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    const id = String(r.body?.data?.id || "");
    return { external_id: id, url: id ? `https://x.com/i/web/status/${id}` : "" };
  },
  async insights(ctx, _a, v) {
    const t = await ctx.token("x");
    if (!t) return null;
    const r = await jfetch(`https://api.x.com/2/tweets/${v.external_id}?tweet.fields=public_metrics`, { headers: { Authorization: `Bearer ${t}` } }).catch(() => null);
    const m = r?.body?.data?.public_metrics;
    return m ? { impressions: m.impression_count, likes: m.like_count, replies: m.reply_count, reposts: m.retweet_count, quotes: m.quote_count, bookmarks: m.bookmark_count } : null;
  },
};

/* Threads ─ Meta Threads API (separate from Instagram). Secret = long-lived Threads user token (60 days,
   refresh with th_refresh_token), target_id = Threads user id (or "me"). */
const threads: Adapter = {
  async resolve(_ctx, a) {
    const name = a.secret_ref || "SOCIAL_THREADS_TOKEN_<BRAND>";
    return readSecret(a.secret_ref)
      ? { mode: "auto", reason: "Threads API (secret token)" }
      : { mode: "needs_connection", reason: `Add the Base44 Secret ${name}`, missing: [`secret:${name}`] };
  },
  async publish(_ctx, a, v) {
    const t = readSecret(a.secret_ref);
    if (!t) throw new Error("Threads token secret is missing");
    const uid = String(a.target_id || "me");
    const text = textOf(v);
    if ([...text].length > LIMITS.threads.text) throw new Error(`Post is ${[...text].length} characters; Threads allows 500.`);
    const img = firstImage(v);
    const params: Record<string, unknown> = needsHttps(img) ? { media_type: "IMAGE", image_url: img, text } : { media_type: "TEXT", text };
    const c = await graphRetry(THREADS_GRAPH, `${uid}/threads`, t, { method: "POST", params });
    for (let i = 0; i < 10; i++) {
      const s = await graphRetry(THREADS_GRAPH, String(c.id), t, { params: { fields: "status,error_message" } }).catch(() => null);
      if (!s || s.status === "FINISHED") break;
      if (s.status === "ERROR" || s.status === "EXPIRED") throw new Error(`Threads could not process the post: ${s.error_message || s.status}`);
      await pause(3000);
    }
    const r = await graph(THREADS_GRAPH, `${uid}/threads_publish`, t, { method: "POST", params: { creation_id: c.id } });
    const id = String(r.id);
    const p = await graphRetry(THREADS_GRAPH, id, t, { params: { fields: "permalink" } }).catch(() => null);
    return { external_id: id, url: p?.permalink || "" };
  },
  async insights(_ctx, a, v) {
    const t = readSecret(a.secret_ref);
    if (!t) return null;
    const r = await graph(THREADS_GRAPH, `${v.external_id}/insights`, t, { params: { metric: "views,likes,replies,reposts,quotes,shares" } }).catch(() => null);
    if (!r) return null;
    return Object.fromEntries((r.data || []).map((row: Any) => [row.name, row.values?.[0]?.value ?? row.total_value?.value ?? null]));
  },
  async test(_ctx, a) {
    const t = readSecret(a.secret_ref);
    if (!t) return { ok: false, error: `Secret ${a.secret_ref || "(none)"} not set` };
    const me = await graph(THREADS_GRAPH, "me", t, { params: { fields: "id,username" } });
    return { ok: true, username: me.username, id: me.id };
  },
};

/* Pinterest ─ API v5 with a secret token (pins:write, boards:read, pins:read, user_accounts:read). Trial-tier apps
   create Sandbox pins only the creator can see; Standard access is needed for public pins. */
const pinterest: Adapter = {
  async resolve(_ctx, a) {
    const name = a.secret_ref || "SOCIAL_PINTEREST_TOKEN_<BRAND>";
    if (!readSecret(a.secret_ref)) return { mode: "needs_connection", reason: `Add the Base44 Secret ${name}`, missing: [`secret:${name}`] };
    if (!a.target_id) return { mode: "needs_connection", reason: "Add the board ID", missing: ["target_id"] };
    return { mode: "auto", reason: "Pinterest API v5 (secret token). Trial access = sandbox pins only you can see" };
  },
  async publish(_ctx, a, v) {
    const t = readSecret(a.secret_ref);
    const img = firstImage(v);
    if (!needsHttps(img)) throw new Error("A pin needs a rendered image");
    const r = await jfetch("https://api.pinterest.com/v5/pins", {
      method: "POST", headers: { Authorization: `Bearer ${t}`, "content-type": "application/json" },
      body: JSON.stringify({
        board_id: String(a.target_id), title: String(v.title || "").slice(0, 100), description: textOf(v).slice(0, 500),
        link: v.link || undefined, alt_text: String(v.alt_text || "").slice(0, 500) || undefined,
        media_source: { source_type: "image_url", url: img },
      }),
    });
    const id = String(r.body?.id || "");
    return { external_id: id, url: id ? `https://www.pinterest.com/pin/${id}/` : "" };
  },
  async insights(_ctx, a, v) {
    const t = readSecret(a.secret_ref);
    if (!t) return null;
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const r = await jfetch(`https://api.pinterest.com/v5/pins/${v.external_id}/analytics?start_date=${start}&end_date=${end}&metric_types=IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK`, { headers: { Authorization: `Bearer ${t}` } }).catch(() => null);
    const all = r?.body?.all?.lifetime_metrics || r?.body?.all?.summary_metrics;
    return all ? { impressions: all.IMPRESSION ?? null, saves: all.SAVE ?? null, clicks: all.PIN_CLICK ?? null, outbound_clicks: all.OUTBOUND_CLICK ?? null } : null;
  },
  async test(_ctx, a) {
    const t = readSecret(a.secret_ref);
    if (!t) return { ok: false, error: `Secret ${a.secret_ref || "(none)"} not set` };
    const me = (await jfetch("https://api.pinterest.com/v5/user_account", { headers: { Authorization: `Bearer ${t}` } })).body;
    return { ok: true, username: me.username, account_type: me.account_type };
  },
};

/* Discord ─ channel webhook URL in a secret (Server Settings → Integrations → Webhooks). */
const discord: Adapter = {
  async resolve(_ctx, a) {
    const u = readSecret(a.secret_ref);
    const name = a.secret_ref || "SOCIAL_DISCORD_WEBHOOK_<BRAND>";
    if (!u) return { mode: "needs_connection", reason: `Add the Base44 Secret ${name}`, missing: [`secret:${name}`] };
    if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(u)) return { mode: "needs_connection", reason: "The secret isn't a Discord webhook URL" };
    return { mode: "auto", reason: "Discord channel webhook" };
  },
  async publish(_ctx, a, v) {
    const u = readSecret(a.secret_ref);
    const content = textOf(v);
    if (content.length > LIMITS.discord.text) throw new Error(`Message is ${content.length} characters; Discord allows 2,000.`);
    const img = firstImage(v);
    const r = await jfetch(`${u}?wait=true`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] }, ...(needsHttps(img) ? { embeds: [{ image: { url: img } }] } : {}) }),
    });
    const msg = r.body || {};
    const hook = (await jfetch(u).catch(() => null))?.body || {};
    const url = hook.guild_id && msg.channel_id ? `https://discord.com/channels/${hook.guild_id}/${msg.channel_id}/${msg.id}` : "";
    return { external_id: String(msg.id || ""), url };
  },
  async test(_ctx, a) {
    const u = readSecret(a.secret_ref);
    if (!u) return { ok: false, error: `Secret ${a.secret_ref || "(none)"} not set` };
    const h = (await jfetch(u)).body; // GET = webhook info only; posts nothing
    return { ok: true, webhook: h.name, channel_id: h.channel_id, guild_id: h.guild_id };
  },
};

/* Telegram ─ one bot token (secret) for every brand; target_id = the channel (@username or -100… id). Add the bot
   as an admin of each channel with "Post messages". The Bot API has no view counts. */
const tg = (token: string, method: string, body: Any) =>
  jfetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => { if (r.body?.ok === false) throw new Error(r.body?.description || "Telegram error"); return r.body?.result; });
const telegram: Adapter = {
  async resolve(_ctx, a) {
    const name = a.secret_ref || "SOCIAL_TELEGRAM_BOT_TOKEN";
    if (!readSecret(name)) return { mode: "needs_connection", reason: `Add the Base44 Secret ${name}`, missing: [`secret:${name}`] };
    if (!a.target_id) return { mode: "needs_connection", reason: "Add the channel (@username or -100… id)", missing: ["target_id"] };
    return { mode: "auto", reason: "Telegram bot" };
  },
  async publish(_ctx, a, v) {
    const t = readSecret(a.secret_ref || "SOCIAL_TELEGRAM_BOT_TOKEN");
    const text = textOf(v);
    const img = firstImage(v);
    let res: Any;
    if (needsHttps(img) && text.length <= LIMITS.telegram.caption) res = await tg(t, "sendPhoto", { chat_id: a.target_id, photo: img, caption: text });
    else if (needsHttps(img)) { await tg(t, "sendPhoto", { chat_id: a.target_id, photo: img }); res = await tg(t, "sendMessage", { chat_id: a.target_id, text: text.slice(0, 4096) }); }
    else res = await tg(t, "sendMessage", { chat_id: a.target_id, text: text.slice(0, 4096) });
    const user = res?.chat?.username;
    return { external_id: String(res?.message_id || ""), url: user ? `https://t.me/${user}/${res.message_id}` : "" };
  },
  async test(_ctx, a) {
    const t = readSecret(a.secret_ref || "SOCIAL_TELEGRAM_BOT_TOKEN");
    if (!t) return { ok: false, error: "Bot token secret not set" };
    const me = await tg(t, "getMe", {});
    const chat = a.target_id ? await tg(t, "getChat", { chat_id: a.target_id }).catch((e: Error) => ({ error: e.message })) : null;
    return { ok: true, bot: me?.username, chat: chat?.title || chat?.error || null };
  },
};

/* Reddit ─ script app (client id/secret + username/password secrets). Reddit's Responsible Builder Policy (Nov 2025)
   requires manual approval for new API credentials, and most subreddits restrict self-promotion, so auto-posting
   is only allowed into a subreddit the brand owns (own_subreddit). Everything else is manual. */
async function redditToken(prefix: string) {
  const id = readSecret(`${prefix}_CLIENT_ID`), secret = readSecret(`${prefix}_CLIENT_SECRET`);
  const user = readSecret(`${prefix}_USERNAME`), pass = readSecret(`${prefix}_PASSWORD`);
  if (!id || !secret || !user || !pass) return null;
  const r = await jfetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST", headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "content-type": "application/x-www-form-urlencoded", "User-Agent": UA },
    body: new URLSearchParams({ grant_type: "password", username: user, password: pass }),
  });
  return (r.body?.access_token as string) || null;
}
const reddit: Adapter = {
  async resolve(_ctx, a) {
    const prefix = a.secret_ref || "SOCIAL_REDDIT";
    const keys = ["CLIENT_ID", "CLIENT_SECRET", "USERNAME", "PASSWORD"];
    const have = keys.filter((k) => readSecret(`${prefix}_${k}`));
    if (!a.own_subreddit) return { mode: "manual", reason: "Subreddit self-promotion rules: post by hand and follow that sub's rules" };
    if (have.length < 4) return { mode: "needs_connection", reason: `Add ${prefix}_CLIENT_ID / _CLIENT_SECRET / _USERNAME / _PASSWORD (approved Reddit app)`, missing: keys.filter((k) => !have.includes(k)).map((k) => `secret:${prefix}_${k}`) };
    if (!a.target_id) return { mode: "needs_connection", reason: "Add the subreddit name", missing: ["target_id"] };
    return { mode: "auto", reason: `Own subreddit r/${String(a.target_id).replace(/^r\//, "")}` };
  },
  async publish(_ctx, a, v) {
    const t = await redditToken(a.secret_ref || "SOCIAL_REDDIT");
    if (!t) throw new Error("Reddit credentials are missing");
    const sr = String(a.target_id).replace(/^\/?r\//, "");
    const img = firstImage(v);
    const form = new URLSearchParams({ sr, title: String(v.title || textOf(v).split("\n")[0]).slice(0, 300), api_type: "json", resubmit: "false" });
    if (v.link) { form.set("kind", "link"); form.set("url", v.link); } else { form.set("kind", "self"); form.set("text", textOf(v) + (needsHttps(img) ? `\n\n${img}` : "")); }
    const r = await jfetch("https://oauth.reddit.com/api/submit", { method: "POST", headers: { Authorization: `Bearer ${t}`, "User-Agent": UA, "content-type": "application/x-www-form-urlencoded" }, body: form });
    const errs = r.body?.json?.errors || [];
    if (errs.length) throw new Error(errs.map((e: Any[]) => e.join(": ")).join("; "));
    return { external_id: String(r.body?.json?.data?.name || ""), url: String(r.body?.json?.data?.url || "") };
  },
  async insights(_ctx, a, v) {
    const t = await redditToken(a.secret_ref || "SOCIAL_REDDIT");
    if (!t || !String(v.external_id).startsWith("t3_")) return null;
    const r = await jfetch(`https://oauth.reddit.com/api/info?id=${v.external_id}`, { headers: { Authorization: `Bearer ${t}`, "User-Agent": UA } }).catch(() => null);
    const d = r?.body?.data?.children?.[0]?.data;
    return d ? { score: d.score, upvote_ratio: d.upvote_ratio, comments: d.num_comments } : null;
  },
};

/* YouTube ─ video upload is manual (a real video file + YouTube Studio). With the "youtube" connector we read stats. */
const youtube: Adapter = {
  async resolve(ctx) {
    return (await ctx.token("youtube"))
      ? { mode: "manual", reason: "Upload in YouTube Studio; stats read through the YouTube connector" }
      : { mode: "manual", reason: "Upload in YouTube Studio. Connect YouTube to read views/likes back" };
  },
  async insights(ctx, _a, v) {
    const t = await ctx.token("youtube");
    if (!t || !v.external_id) return null;
    const r = await jfetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(v.external_id)}`, { headers: { Authorization: `Bearer ${t}` } }).catch(() => null);
    const s = r?.body?.items?.[0]?.statistics;
    return s ? { views: Number(s.viewCount || 0), likes: Number(s.likeCount || 0), comments: Number(s.commentCount || 0) } : null;
  },
};

/* TikTok ─ the Base44 connector reads profile/videos and can send videos to the creator's inbox; photo posts need a
   verified media domain and unaudited apps post privately. So publishing is manual; stats come back when connected. */
const tiktok: Adapter = {
  async resolve(ctx) {
    return { mode: "manual", reason: (await ctx.token("tiktok")) ? "Post in the TikTok app; stats read through the connector" : "Post in the TikTok app. Connect TikTok to read stats back" };
  },
  async insights(ctx, _a, v) {
    const t = await ctx.token("tiktok");
    if (!t || !v.external_id) return null;
    const r = await jfetch("https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count", {
      method: "POST", headers: { Authorization: `Bearer ${t}`, "content-type": "application/json" }, body: JSON.stringify({ filters: { video_ids: [String(v.external_id)] } }),
    }).catch(() => null);
    const d = r?.body?.data?.videos?.[0];
    return d ? { views: d.view_count, likes: d.like_count, comments: d.comment_count, shares: d.share_count } : null;
  },
};

const manualOnly = (reason: string): Adapter => ({ resolve: async () => ({ mode: "manual", reason }) });

export const ADAPTERS: Record<string, Adapter> = {
  instagram, facebook, linkedin, x, threads, pinterest, discord, telegram, reddit, youtube, tiktok,
  gbp: manualOnly("Google Business Profile API access is pending Google's approval. Post from the profile by hand."),
  whatsapp: manualOnly("WhatsApp Channels have no official posting API. Post from the WhatsApp app by hand."),
};

export async function resolveAccount(ctx: Ctx, a: Any): Promise<Resolved> {
  const ad = ADAPTERS[a?.platform];
  if (!ad) return { mode: "manual", reason: "Unknown platform" };
  if (a.enabled === false) return { mode: "manual", reason: "Account switched off" };
  const r = await ad.resolve(ctx, a).catch((e) => ({ mode: "needs_connection" as Mode, reason: errText(e) }));
  if (a.mode_override === "manual" && r.mode === "auto") return { mode: "manual", reason: "Set to manual on this account" };
  return r;
}

/** Pull an id out of a pasted post URL so insights can be read later where the API allows. */
export function idFromUrl(platform: string, url: string): string {
  const u = String(url || "");
  const m = (re: RegExp) => (u.match(re) || [])[1] || "";
  switch (platform) {
    case "youtube": return m(/[?&]v=([\w-]{6,})/) || m(/youtu\.be\/([\w-]{6,})/) || m(/shorts\/([\w-]{6,})/);
    case "tiktok": return m(/\/video\/(\d+)/) || m(/\/photo\/(\d+)/);
    case "x": return m(/\/status\/(\d+)/);
    case "pinterest": return m(/\/pin\/(\d+)/);
    case "reddit": { const id = m(/\/comments\/(\w+)/); return id ? `t3_${id}` : ""; }
    case "linkedin": return m(/(urn:li:(?:share|ugcPost|activity):\d+)/);
    default: return "";
  }
}
