import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import {
  Any, FB_GRAPH, GraphError, IG_GRAPH, errText, fbPages, fbUserToken, graph, graphRetry, igMe, igToken,
  publishSettings, savePublishSettings, specHash,
} from "../../shared/social.ts";

// Social Studio publisher. NOTHING is published unless Justin approved the post in Møthership
// (status "approved" + approved_at, set only by an admin; SocialPost is admin-only by RLS).
//
//   run_due          (schedule every 15 min / admin) publish approved posts whose scheduled_at <= now
//   refresh_insights (schedule daily / admin)        pull likes/comments/reach for posted items
//   status           (admin)  Instagram + Facebook connection state, quota, settings
//   save_settings    (admin)  default times, auto cross-post, Facebook Page, portal connector id
//   publish_now      (admin)  publish ONE approved (or failed, to retry) post right now
//   dry_run          (admin)  create + check an Instagram container for a post, never media_publish
//
// Instagram flow: POST /{ig}/media (image_url, caption, alt_text) -> poll status_code -> POST /{ig}/media_publish
// -> GET permalink. Facebook: POST /{page}/photos (url, message) with the Page token.

const MAX_PER_RUN = 5;
const STALE_LOCK_MS = 15 * 60 * 1000;
const AUTOMATION = "Social Studio · Instagram publisher";
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status");
    const user = await base44.auth.me().catch(() => null);
    const isAdmin = user?.role === "admin";
    const db = base44.asServiceRole.entities;

    // Scheduler entry points: safe without a user because they only act on posts Justin approved.
    if (action === "run_due") {
      if (user && !isAdmin) return Response.json({ error: "Admins only" }, { status: 403 });
      return Response.json(await runDue(base44, db, { actor: user?.email || "schedule" }));
    }
    if (action === "refresh_insights") {
      if (user && !isAdmin) return Response.json({ error: "Admins only" }, { status: 403 });
      return Response.json(await refreshInsights(base44, db, body?.post_id ? String(body.post_id) : null));
    }

    if (!isAdmin) return Response.json({ error: "Admins only" }, { status: 403 });

    if (action === "status") return Response.json(await status(base44, db));

    if (action === "save_settings") {
      const patch = { ...(body?.settings || {}) };
      if (patch.facebook_page_id !== undefined) {
        const tok = await fbUserToken(base44);
        const pages = tok ? await fbPages(tok).catch(() => []) : [];
        const page = pages.find((p: Any) => String(p.id) === String(patch.facebook_page_id));
        patch.facebook_page_name = page?.name || "";
        if (!page) patch.facebook_page_id = "";
      }
      return Response.json({ settings: await savePublishSettings(db, patch) });
    }

    if (action === "publish_now") {
      const id = String(body?.post_id || "");
      const post = id ? await db.SocialPost.get(id).catch(() => null) : null;
      if (!post) return Response.json({ error: "Post not found" }, { status: 404 });
      if (!["approved", "failed"].includes(post.status) || !post.approved_at) {
        return Response.json({ error: "Approve the post first. Nothing publishes without your approval." }, { status: 400 });
      }
      if (post.status === "failed") await db.SocialPost.update(id, { status: "approved", publish_error: "" });
      const res = await runDue(base44, db, { actor: user.email, onlyId: id });
      return Response.json(res);
    }

    if (action === "dry_run") {
      const id = String(body?.post_id || "");
      const post = id ? await db.SocialPost.get(id).catch(() => null) : null;
      const imageUrl = String(post?.image_url || body?.image_url || "");
      if (!/^https:\/\//.test(imageUrl)) return Response.json({ error: "Needs a post with an uploaded image (approve it first) or an https image_url" }, { status: 400 });
      const token = await igToken(base44);
      const me = await igMe(token);
      const container = await createContainer(token, me.ig_id, imageUrl, String(post?.caption || "Dry run: never published"), String(post?.alt_text || ""));
      const st = await waitForContainer(token, container);
      return Response.json({ ok: true, dry_run: true, account: me.username, container_id: container, status_code: st, note: "Container created and checked. media_publish was NOT called, so nothing was posted; Instagram discards unpublished containers after 24h." });
    }

    return Response.json({ error: `Unknown action ${action}` }, { status: 400 });
  } catch (e) {
    return Response.json({ error: errText(e) }, { status: 500 });
  }
});

/* ─── Status ─────────────────────────────────────────────────────────── */
async function status(base44: Any, db: Any) {
  const settings = await publishSettings(db);
  const out: Any = { settings, instagram: { connected: false }, facebook: { connected: false, pages: [] } };
  try {
    const token = await igToken(base44);
    const me = await igMe(token);
    out.instagram = {
      connected: true, username: me.username, name: me.name, ig_id: me.ig_id, account_type: me.account_type,
      profile_picture_url: me.profile_picture_url, followers_count: me.followers_count, follows_count: me.follows_count, media_count: me.media_count,
    };
    try {
      const q = await graph(IG_GRAPH, `${me.ig_id}/content_publishing_limit`, token, { params: { fields: "quota_usage,config" } });
      const row = q?.data?.[0] || {};
      out.instagram.quota = { usage: row.quota_usage ?? null, total: row.config?.quota_total ?? 25, window_hours: Math.round((row.config?.quota_duration ?? 86400) / 3600) };
    } catch (e) {
      out.instagram.quota_error = errText(e);
    }
    // Account-level last 30 days (needs instagram_business_manage_insights). impressions is deprecated; views replaces it.
    try {
      const until = Math.floor(Date.now() / 1000);
      const r = await graph(IG_GRAPH, `${me.ig_id}/insights`, token, { params: { metric: "reach,views,accounts_engaged,total_interactions", period: "day", metric_type: "total_value", since: until - 29 * 86400, until } });
      out.instagram.insights_30d = Object.fromEntries((r?.data || []).map((row: Any) => [row.name, row.total_value?.value ?? 0]));
    } catch (e) {
      out.instagram.insights_error = errText(e);
    }
  } catch (e) {
    out.instagram.error = errText(e);
  }
  const fbTok = await fbUserToken(base44);
  if (fbTok) {
    out.facebook.connected = true;
    try {
      out.facebook.pages = (await fbPages(fbTok)).map((p: Any) => ({ id: p.id, name: p.name, category: p.category, instagram: p.instagram_business_account?.username || null }));
    } catch (e) {
      out.facebook.error = errText(e);
    }
  }
  return out;
}

/* ─── Publisher ──────────────────────────────────────────────────────── */
async function runDue(base44: Any, db: Any, { actor, onlyId }: { actor: string; onlyId?: string }) {
  const started = now();
  const settings = await publishSettings(db);
  const results: Any[] = [];

  // Recover posts stuck in "publishing" (function crashed mid-run). Never auto-retry them blindly:
  // if Instagram already has the media it is marked posted, otherwise failed for Justin to check.
  const stuck = ((await db.SocialPost.filter({ status: "publishing" }, "publishing_started_at", 20).catch(() => [])) || [])
    .filter((p: Any) => Date.now() - Date.parse(p.publishing_started_at || p.updated_date || 0) > STALE_LOCK_MS);
  for (const p of stuck) {
    await db.SocialPost.update(p.id, p.ig_media_id
      ? { status: "posted", publish_lock: "", published_at: p.published_at || now(), posted_at: p.posted_at || now() }
      : { status: "failed", publish_lock: "", publish_error: "Publishing was interrupted. Check Instagram before retrying so it doesn't post twice." });
    results.push({ id: p.id, title: p.title, result: p.ig_media_id ? "posted (recovered)" : "failed (interrupted)" });
  }

  if (settings.paused && !onlyId) return finish(db, started, results, "Publishing is paused in Social connections");

  let due: Any[];
  if (onlyId) {
    const p = await db.SocialPost.get(onlyId).catch(() => null);
    due = p && p.status === "approved" ? [p] : [];
  } else {
    due = ((await db.SocialPost.filter({ status: "approved" }, "scheduled_at", 100).catch(() => [])) || [])
      .filter((p: Any) => p.scheduled_at && Date.parse(p.scheduled_at) <= Date.now())
      .slice(0, MAX_PER_RUN);
  }
  if (!due.length) return finish(db, started, results, null);

  // Instagram quota (25 API-published posts per rolling 24h).
  let token: string | null = null;
  let me: Any = null;
  let quotaLeft = 25;
  const needsIg = due.some((p) => p.publish_targets?.instagram !== false);
  if (needsIg) {
    try {
      token = await igToken(base44);
      me = await igMe(token);
      const q = await graph(IG_GRAPH, `${me.ig_id}/content_publishing_limit`, token, { params: { fields: "quota_usage,config" } }).catch(() => null);
      const row = q?.data?.[0];
      if (row) quotaLeft = Math.max(0, (row.config?.quota_total ?? 25) - (row.quota_usage ?? 0));
    } catch (e) {
      // Leave the posts approved; the next run tries again. Logged as a failed run.
      return finish(db, started, results, `Instagram connector unavailable: ${errText(e)}`, true);
    }
  }

  for (const post of due) {
    if (post.publish_targets?.instagram !== false && quotaLeft <= 0) {
      results.push({ id: post.id, title: post.title, result: "waiting (Instagram 24h publishing limit reached)" });
      await db.SocialPost.update(post.id, { publish_error: "Waiting: Instagram's 24-hour publishing limit is reached. It will post on a later run." });
      continue;
    }
    const r = await publishOne(base44, db, post, { token, me, settings, actor });
    if (r.ig) quotaLeft -= 1;
    results.push({ id: post.id, title: post.title, ...r });
  }
  return finish(db, started, results, null);
}

async function finish(db: Any, started: string, results: Any[], note: string | null, failed = false) {
  // One AutomationRun per run that did something (or hit a problem); empty 15-minute ticks are not logged.
  if (results.length || failed) {
    const bad = results.filter((r) => String(r.result).startsWith("failed")).length;
    const ok = results.filter((r) => String(r.result).startsWith("posted")).length;
    const first = results.find((r) => r.permalink);
    await db.AutomationRun.create({
      automation_name: AUTOMATION, kind: "social_post", started_at: started, finished_at: now(),
      status: failed || bad ? "failed" : ok ? "success" : "skipped",
      title: results.map((r) => r.title).filter(Boolean).join(" · ").slice(0, 300) || "Social publish run",
      message: [note, ...results.map((r) => `${r.title || r.id}: ${r.result}${r.error ? ` (${r.error})` : ""}`)].filter(Boolean).join("\n").slice(0, 2000),
      output_url: first?.permalink || "",
    }).catch(() => null);
  }
  return { ok: !failed, note, results };
}

async function publishOne(base44: Any, db: Any, post: Any, ctx: { token: string | null; me: Any; settings: Any; actor: string }): Promise<Any> {
  const id = post.id;
  const targets = { instagram: post.publish_targets?.instagram !== false, facebook: post.publish_targets?.facebook === true };
  const fail = async (msg: string, extra: Any = {}) => {
    await db.SocialPost.update(id, { status: "failed", publish_error: msg, publish_lock: "", ...extra });
    return { result: "failed", error: msg };
  };

  // Guards: approval, image, design not edited since the image was rendered, caption limits.
  if (!post.approved_at) return fail("Not approved. Nothing publishes without approval.");
  if (!targets.instagram && !targets.facebook) return fail("No destination selected (Instagram and Facebook are both off).");
  if (!/^https:\/\//.test(String(post.image_url || ""))) return fail("No public image. Open the post and approve it again so the image is rendered and uploaded.");
  if (post.image_spec_hash && post.image_spec_hash !== specHash(post.template, post.spec)) {
    return fail("The design was edited after the image was rendered. Open the post so it re-renders, then reschedule.");
  }
  const caption = String(post.caption || "");
  if (caption.length > 2200) return fail(`Caption is ${caption.length} characters; Instagram allows 2,200.`);
  if ((caption.match(/#[\p{L}\p{N}_]+/gu) || []).length > 30) return fail("Caption has more than 30 hashtags; Instagram allows 30.");

  // Idempotent lock: claim it, then re-read to make sure this run owns it.
  const lock = crypto.randomUUID();
  await db.SocialPost.update(id, { status: "publishing", publish_lock: lock, publishing_started_at: now(), publish_attempts: (Number(post.publish_attempts) || 0) + 1, publish_error: "" });
  await pause(400);
  const fresh = await db.SocialPost.get(id).catch(() => null);
  if (!fresh || fresh.publish_lock !== lock) return { result: "skipped (another run has it)" };

  let igDone = !!fresh.ig_media_id;
  let permalink = fresh.ig_permalink || "";
  try {
    // Instagram
    if (targets.instagram && !igDone) {
      const token = ctx.token || await igToken(base44);
      const me = ctx.me || await igMe(token);
      const container = await createContainer(token, me.ig_id, fresh.image_url, caption, String(fresh.alt_text || ""));
      await db.SocialPost.update(id, { ig_container_id: container });
      const st = await waitForContainer(token, container);
      if (st !== "FINISHED") throw new Error(`Instagram could not process the image (container ${st}).`);
      const mediaId = await mediaPublish(token, me.ig_id, container, caption);
      igDone = true;
      await db.SocialPost.update(id, { ig_media_id: mediaId });
      const m = await graphRetry(IG_GRAPH, mediaId, token, { params: { fields: "permalink,timestamp" } }).catch(() => null);
      permalink = m?.permalink || "";
      await db.SocialPost.update(id, { ig_permalink: permalink });
    }

    // Facebook Page (optional cross-post). A Facebook problem never undoes an Instagram post.
    let fb: Any = {};
    if (targets.facebook) {
      fb = await postToFacebook(base44, ctx.settings, fresh.image_url, caption).catch((e) => ({ fb_error: errText(e) }));
      if (fb.fb_error && !targets.instagram) throw new Error(`Facebook: ${fb.fb_error}`);
    }

    const at = now();
    await db.SocialPost.update(id, {
      status: "posted", published_at: at, posted_at: at, posted_url: permalink || fb.fb_permalink || "",
      publish_lock: "", publish_error: "", fb_error: fb.fb_error || "", ...pickFb(fb),
    });
    return { result: "posted", ig: targets.instagram, permalink: permalink || fb.fb_permalink || "", fb_error: fb.fb_error || undefined };
  } catch (e) {
    const msg = errText(e);
    if (igDone) {
      // Instagram is live; record it as posted and keep the error for the rest.
      const at = now();
      await db.SocialPost.update(id, { status: "posted", published_at: at, posted_at: at, posted_url: permalink, publish_lock: "", fb_error: msg });
      return { result: "posted", ig: true, permalink, error: msg };
    }
    // One more try on the next run for transient errors; otherwise failed.
    const transient = e instanceof GraphError && e.transient;
    if (transient && (Number(fresh.publish_attempts) || 0) < 2) {
      await db.SocialPost.update(id, { status: "approved", publish_lock: "", publish_error: `Temporary Instagram error, retrying on the next run: ${msg}` });
      return { result: "retrying", error: msg };
    }
    return fail(msg);
  }
}

const pickFb = (fb: Any) => Object.fromEntries(["fb_page_id", "fb_post_id", "fb_permalink"].filter((k) => fb[k]).map((k) => [k, fb[k]]));

async function createContainer(token: string, igId: string, imageUrl: string, caption: string, altText: string) {
  const params: Record<string, unknown> = { image_url: imageUrl, caption };
  if (altText) params.alt_text = altText.slice(0, 1000);
  try {
    const r = await graphRetry(IG_GRAPH, `${igId}/media`, token, { method: "POST", params });
    return String(r.id);
  } catch (e) {
    // Older API versions reject alt_text; fall back to posting without it rather than failing.
    if (altText && /alt_text/i.test(errText(e))) {
      const r = await graphRetry(IG_GRAPH, `${igId}/media`, token, { method: "POST", params: { image_url: imageUrl, caption } });
      return String(r.id);
    }
    throw e;
  }
}

async function waitForContainer(token: string, container: string) {
  let st = "IN_PROGRESS";
  for (let i = 0; i < 12; i++) {
    const r = await graphRetry(IG_GRAPH, container, token, { params: { fields: "status_code,status" } });
    st = String(r.status_code || "IN_PROGRESS");
    if (st !== "IN_PROGRESS") return st;
    await pause(i < 3 ? 2000 : 4000);
  }
  return st;
}

/** media_publish is NOT blindly retried: a lost response could still have posted. Check first. */
async function mediaPublish(token: string, igId: string, container: string, caption: string) {
  try {
    const r = await graph(IG_GRAPH, `${igId}/media_publish`, token, { method: "POST", params: { creation_id: container } });
    return String(r.id);
  } catch (e) {
    if (!(e instanceof GraphError && e.transient)) throw e;
    await pause(3000);
    const c = await graph(IG_GRAPH, container, token, { params: { fields: "status_code" } }).catch(() => null);
    if (c?.status_code === "PUBLISHED") {
      const recent = await graph(IG_GRAPH, `${igId}/media`, token, { params: { fields: "id,caption,timestamp", limit: 5 } }).catch(() => null);
      const hit = (recent?.data || []).find((m: Any) => String(m.caption || "").trim() === caption.trim()) || recent?.data?.[0];
      if (hit) return String(hit.id);
    }
    const r = await graph(IG_GRAPH, `${igId}/media_publish`, token, { method: "POST", params: { creation_id: container } });
    return String(r.id);
  }
}

async function postToFacebook(base44: Any, settings: Any, imageUrl: string, caption: string) {
  if (!settings.facebook_page_id) throw new Error("No Facebook Page chosen in Social connections");
  const userTok = await fbUserToken(base44);
  if (!userTok) throw new Error("Facebook Pages connector is not connected");
  const page = (await fbPages(userTok)).find((p: Any) => String(p.id) === String(settings.facebook_page_id));
  if (!page?.access_token) throw new Error("The chosen Facebook Page is not available to the connected account");
  const r = await graphRetry(FB_GRAPH, `${page.id}/photos`, page.access_token, { method: "POST", params: { url: imageUrl, message: caption, published: true } });
  const postId = String(r.post_id || r.id);
  const p = await graphRetry(FB_GRAPH, postId, page.access_token, { params: { fields: "permalink_url" } }).catch(() => null);
  return { fb_page_id: String(page.id), fb_post_id: postId, fb_permalink: p?.permalink_url || "" };
}

/* ─── Insights ───────────────────────────────────────────────────────── */
async function refreshInsights(base44: Any, db: Any, onlyId: string | null) {
  const started = now();
  const since = Date.now() - 90 * 86400000;
  const posts = onlyId
    ? [await db.SocialPost.get(onlyId).catch(() => null)].filter(Boolean)
    : ((await db.SocialPost.filter({ status: "posted" }, "-published_at", 100).catch(() => [])) || [])
      .filter((p: Any) => (p.ig_media_id || p.fb_post_id) && Date.parse(p.published_at || p.posted_at || 0) > since);
  if (!posts.length) return { ok: true, updated: 0 };

  let token: string | null = null;
  try { token = await igToken(base44); } catch { token = null; }
  const settings = await publishSettings(db);
  let pageTok: string | null = null;
  if (posts.some((p: Any) => p.fb_post_id)) {
    const userTok = await fbUserToken(base44);
    if (userTok) {
      const pages = await fbPages(userTok).catch(() => []);
      pageTok = pages.find((p: Any) => String(p.id) === String(settings.facebook_page_id))?.access_token || pages[0]?.access_token || null;
    }
  }

  let updated = 0;
  let scopeNote = "";
  for (const p of posts) {
    const ins: Any = { ...(p.insights || {}) };
    if (token && p.ig_media_id) {
      const m = await graphRetry(IG_GRAPH, p.ig_media_id, token, { params: { fields: "like_count,comments_count,permalink" } }).catch(() => null);
      if (m) { ins.likes = m.like_count ?? ins.likes ?? 0; ins.comments = m.comments_count ?? ins.comments ?? 0; }
      try {
        const r = await graph(IG_GRAPH, `${p.ig_media_id}/insights`, token, { params: { metric: "reach,views,saved,shares" } });
        for (const row of r?.data || []) ins[row.name] = row.values?.[0]?.value ?? row.total_value?.value ?? ins[row.name];
        delete ins.note;
      } catch (e) {
        scopeNote = /Application does not have permission/i.test(errText(e))
          ? "Instagram refused insights for the connector's Meta app (reach/views). Likes and comments still update."
          : /permission|scope|\(#10\)|\(#200\)/i.test(errText(e))
            ? "Reach and views need the instagram_business_manage_insights scope on the Instagram connector."
            : errText(e);
        ins.note = scopeNote;
      }
    }
    if (pageTok && p.fb_post_id) {
      const f = await graph(FB_GRAPH, p.fb_post_id, pageTok, { params: { fields: "reactions.summary(true).limit(0),comments.summary(true).limit(0)" } }).catch(() => null);
      if (f) { ins.fb_reactions = f.reactions?.summary?.total_count ?? 0; ins.fb_comments = f.comments?.summary?.total_count ?? 0; }
    }
    ins.updated_at = now();
    await db.SocialPost.update(p.id, { insights: ins });
    updated++;
  }
  if (!onlyId) {
    await db.AutomationRun.create({
      automation_name: "Social Studio · insights refresh", kind: "social_insights", started_at: started, finished_at: now(),
      status: token ? "success" : "failed", title: `Refreshed ${updated} posted item${updated === 1 ? "" : "s"}`,
      message: token ? (scopeNote || "Likes, comments, reach and views updated") : "Instagram connector unavailable",
    }).catch(() => null);
  }
  return { ok: true, updated, note: scopeNote || null };
}
