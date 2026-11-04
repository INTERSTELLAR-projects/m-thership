import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { Any, GraphError, errText } from "../../shared/social.ts";
import { ADAPTERS, LIMITS, idFromUrl, makeCtx, readSecret, resolveAccount } from "../../shared/channels.ts";

// Social Studio content engine: one idea -> every platform. Publishes SocialVariant rows through the Channel
// adapters in shared/channels.ts. NOTHING publishes unless an admin approved that variant (status "approved"
// + approved_at); manual-mode variants are never published here, they wait for "Mark posted".
//
//   status           (admin) every account's mode (auto / needs_connection / manual) + connector + secret presence
//   test_account     (admin) read-only check of one account (Discord GET webhook, Telegram getMe, Threads me...)
//   run_due          (schedule/admin) publish approved auto-mode variants whose scheduled_at <= now
//   publish_now      (admin) publish ONE approved variant now
//   mark_posted      (admin) manual variant posted by hand: { variant_id, url }
//   refresh_insights (schedule/admin) read engagement back for posted variants where the API allows
//   digest           (schedule/admin) weekly per-platform numbers -> SocialDigest (numbers only; no AI, no invention)
//   fetch_source     (admin) title/author/thumbnail of a pasted video link (YouTube oEmbed / page meta). No transcripts.
//
// Client accounts are operated by Justin (admin). Portal users get 403: the portal Social Studio stays a locked preview.

const MAX_PER_RUN = 8;
const STALE_LOCK_MS = 15 * 60 * 1000;
const now = () => new Date().toISOString();
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SETTINGS_KEY = "social_studio";
const DEFAULT_LIMITS: Record<string, number> = {
  instagram: 2, facebook: 2, youtube: 1, linkedin: 1, tiktok: 1, threads: 3, x: 3, pinterest: 3, gbp: 1, discord: 2, telegram: 2, reddit: 1, whatsapp: 1,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status");
    const user = await base44.auth.me().catch(() => null);
    const isAdmin = user?.role === "admin";
    const db = base44.asServiceRole.entities;
    const ctx = makeCtx(base44, db);

    if (["run_due", "refresh_insights", "digest"].includes(action)) {
      if (user && !isAdmin) return Response.json({ error: "Admins only" }, { status: 403 });
      if (action === "run_due") return Response.json(await runDue(ctx, db, { actor: user?.email || "schedule" }));
      if (action === "refresh_insights") return Response.json(await refreshInsights(ctx, db, body?.variant_id ? String(body.variant_id) : null));
      return Response.json(await digest(db, body?.brand_key ? String(body.brand_key) : null, body?.week_start ? String(body.week_start) : null));
    }
    if (!isAdmin) return Response.json({ error: "Admins only. The portal Social Studio is a preview for now." }, { status: 403 });

    if (action === "status") return Response.json(await status(ctx, db, body?.brand_key ? String(body.brand_key) : null));

    if (action === "test_account") {
      const a = await db.SocialAccount.get(String(body?.account_id || "")).catch(() => null);
      if (!a) return Response.json({ error: "Account not found" }, { status: 404 });
      const ad = ADAPTERS[a.platform];
      const mode = await resolveAccount(ctx, a);
      const test = ad?.test ? await ad.test(ctx, a).catch((e) => ({ ok: false, error: errText(e) })) : { ok: mode.mode === "auto", note: "No read-only test for this platform; mode check only." };
      return Response.json({ mode, test, note: "Read-only check. Nothing was posted." });
    }

    if (action === "publish_now") {
      const id = String(body?.variant_id || "");
      const v = id ? await db.SocialVariant.get(id).catch(() => null) : null;
      if (!v) return Response.json({ error: "Variant not found" }, { status: 404 });
      if (!["approved", "failed"].includes(v.status) || !v.approved_at) return Response.json({ error: "Approve it first. Nothing posts without your approval." }, { status: 400 });
      if (v.status === "failed") await db.SocialVariant.update(id, { status: "approved", publish_error: "" });
      return Response.json(await runDue(ctx, db, { actor: user.email, onlyId: id }));
    }

    if (action === "mark_posted") {
      const id = String(body?.variant_id || "");
      const v = id ? await db.SocialVariant.get(id).catch(() => null) : null;
      if (!v) return Response.json({ error: "Variant not found" }, { status: 404 });
      if (!v.approved_at) return Response.json({ error: "Approve it before marking it posted." }, { status: 400 });
      const url = String(body?.url || "").trim().slice(0, 600);
      if (url && !/^https?:\/\//.test(url)) return Response.json({ error: "Paste the full post URL (https://…)" }, { status: 400 });
      const saved = await db.SocialVariant.update(id, {
        status: "posted", posted_url: url, external_id: v.external_id || idFromUrl(v.platform, url), published_at: now(), posted_by: user.email, publish_error: "",
      });
      return Response.json({ ok: true, variant: saved });
    }

    if (action === "fetch_source") return Response.json(await fetchSource(String(body?.url || "")));

    return Response.json({ error: `Unknown action ${action}` }, { status: 400 });
  } catch (e) {
    return Response.json({ error: errText(e) }, { status: 500 });
  }
});

async function engineSettings(db: Any) {
  const rows = (await db.AppSettings.filter({ key: SETTINGS_KEY }, "-created_date", 1).catch(() => [])) || [];
  const ps = rows[0]?.pageSettings || {};
  return { engine: ps.engine || {}, publish: ps.publish || {} };
}

/* ─── Status ───────────────────────────────────────────────────────────── */
async function status(ctx: Any, db: Any, brandKey: string | null) {
  const q: Record<string, unknown> = {};
  if (brandKey) q.client_id = brandKey;
  const accounts = ((await db.SocialAccount.filter(q, "-updated_date", 400).catch(() => [])) || []).filter((a: Any) => a.platform && ADAPTERS[a.platform]);
  const out = [];
  for (const a of accounts) out.push({ id: a.id, client_id: a.client_id, platform: a.platform, ...(await resolveAccount(ctx, a)) });
  const connectors: Record<string, boolean> = {};
  for (const t of ["instagram", "facebook_pages", "linkedin", "x", "youtube", "tiktok"]) connectors[t] = !!(await ctx.token(t));
  const fbScopes = connectors.facebook_pages ? await ctx.facebookScopes() : [];
  const names = new Set<string>(["SOCIAL_TELEGRAM_BOT_TOKEN"]);
  accounts.forEach((a: Any) => {
    if (!a.secret_ref) return;
    if (a.platform === "reddit") ["CLIENT_ID", "CLIENT_SECRET", "USERNAME", "PASSWORD"].forEach((k) => names.add(`${a.secret_ref}_${k}`));
    else names.add(String(a.secret_ref));
  });
  const secrets = Object.fromEntries([...names].filter((n) => /^SOCIAL_[A-Z0-9_]+$/.test(n)).map((n) => [n, !!readSecret(n)]));
  return { connectors, facebook_scopes: fbScopes, secrets, accounts: out, limits: LIMITS };
}

/* ─── Publisher ────────────────────────────────────────────────────────── */
async function runDue(ctx: Any, db: Any, { actor, onlyId }: { actor: string; onlyId?: string }) {
  const started = now();
  const results: Any[] = [];
  const { engine, publish } = await engineSettings(db);

  const stuck = ((await db.SocialVariant.filter({ status: "publishing" }, "publishing_started_at", 30).catch(() => [])) || [])
    .filter((v: Any) => Date.now() - Date.parse(v.publishing_started_at || v.updated_date || 0) > STALE_LOCK_MS);
  for (const v of stuck) {
    await db.SocialVariant.update(v.id, v.external_id
      ? { status: "posted", publish_lock: "", published_at: v.published_at || now() }
      : { status: "failed", publish_lock: "", publish_error: "Publishing was interrupted. Check the platform before retrying so it doesn't post twice." });
    results.push({ id: v.id, platform: v.platform, result: v.external_id ? "posted (recovered)" : "failed (interrupted)" });
  }
  if ((publish.paused || engine.paused) && !onlyId) return finish(db, started, results, "Publishing is paused", false);

  let due: Any[];
  if (onlyId) {
    const v = await db.SocialVariant.get(onlyId).catch(() => null);
    due = v && v.status === "approved" ? [v] : [];
  } else {
    due = ((await db.SocialVariant.filter({ status: "approved" }, "scheduled_at", 200).catch(() => [])) || [])
      .filter((v: Any) => v.approved_at && v.scheduled_at && Date.parse(v.scheduled_at) <= Date.now());
  }
  const accounts = new Map<string, Any>();
  const accountOf = async (v: Any) => {
    if (!v.account_id) return null;
    if (!accounts.has(v.account_id)) accounts.set(v.account_id, await db.SocialAccount.get(v.account_id).catch(() => null));
    return accounts.get(v.account_id);
  };
  const dayKey = new Date().toISOString().slice(0, 10);
  const postedToday = new Map<string, number>();
  let n = 0;
  for (const v of due) {
    if (n >= MAX_PER_RUN) break;
    const a = await accountOf(v);
    if (!a) { if (onlyId) results.push({ id: v.id, result: "not posted (no account: post by hand)" }); continue; }
    const mode = await resolveAccount(ctx, a);
    if (mode.mode !== "auto") {
      if (onlyId) results.push({ id: v.id, platform: v.platform, result: `not posted (${mode.mode}: ${mode.reason})` });
      if (v.mode !== mode.mode) await db.SocialVariant.update(v.id, { mode: mode.mode });
      continue; // manual / needs_connection: stays approved; the queue shows "post by hand"
    }
    const limit = Number(a.daily_limit || engine.limits?.[v.platform] || DEFAULT_LIMITS[v.platform] || 2);
    if (!postedToday.has(a.id)) {
      const rows = (await db.SocialVariant.filter({ account_id: a.id, status: "posted" }, "-published_at", 50).catch(() => [])) || [];
      postedToday.set(a.id, rows.filter((r: Any) => String(r.published_at || "").slice(0, 10) === dayKey).length);
    }
    if (!onlyId && postedToday.get(a.id)! >= limit) {
      results.push({ id: v.id, platform: v.platform, result: `waiting (daily limit ${limit} reached)` });
      await db.SocialVariant.update(v.id, { publish_error: `Waiting: today's limit of ${limit} for this account is reached. It posts on a later run.` });
      continue;
    }
    n++;
    const r = await publishOne(ctx, db, v, a, actor);
    if (String(r.result).startsWith("posted")) postedToday.set(a.id, postedToday.get(a.id)! + 1);
    results.push({ id: v.id, platform: v.platform, ...r });
  }
  return finish(db, started, results, null, false);
}

async function finish(db: Any, started: string, results: Any[], note: string | null, failed: boolean) {
  if (results.length || failed) {
    const bad = results.filter((r) => String(r.result).startsWith("failed")).length;
    const ok = results.filter((r) => String(r.result).startsWith("posted")).length;
    await db.AutomationRun.create({
      automation_name: "Social Studio · multi-platform publisher", kind: "social_post", started_at: started, finished_at: now(),
      status: failed || bad ? "failed" : ok ? "success" : "skipped",
      title: `${ok} posted · ${bad} failed`,
      message: [note, ...results.map((r) => `${r.platform || ""} ${r.id}: ${r.result}${r.error ? ` (${r.error})` : ""}`)].filter(Boolean).join("\n").slice(0, 2000),
      output_url: results.find((r) => r.url)?.url || "",
    }).catch(() => null);
  }
  return { ok: !failed, note, results };
}

async function publishOne(ctx: Any, db: Any, v: Any, a: Any, actor: string): Promise<Any> {
  const fail = async (msg: string) => {
    await db.SocialVariant.update(v.id, { status: "failed", publish_error: msg, publish_lock: "" });
    return { result: "failed", error: msg };
  };
  if (!v.approved_at) return fail("Not approved. Nothing posts without approval.");
  const ad = ADAPTERS[v.platform];
  if (!ad?.publish) return fail("This platform has no posting API: post by hand and Mark posted.");
  if (v.needs_image !== false && !(v.image_url || v.image_urls?.length) && !["discord", "telegram", "reddit", "x", "threads", "linkedin", "facebook"].includes(v.platform)) {
    return fail("No rendered image. Approve it again so the image is rendered and uploaded.");
  }

  const lock = crypto.randomUUID();
  await db.SocialVariant.update(v.id, { status: "publishing", publish_lock: lock, publishing_started_at: now(), publish_attempts: (Number(v.publish_attempts) || 0) + 1, publish_error: "" });
  await pause(400);
  const fresh = await db.SocialVariant.get(v.id).catch(() => null);
  if (!fresh || fresh.publish_lock !== lock) return { result: "skipped (another run has it)" };
  if (fresh.external_id) {
    await db.SocialVariant.update(v.id, { status: "posted", publish_lock: "", published_at: fresh.published_at || now() });
    return { result: "posted (already live)" };
  }
  try {
    const p = await ad.publish(ctx, a, fresh);
    await db.SocialVariant.update(v.id, {
      status: "posted", external_id: p.external_id, posted_url: p.url, published_at: now(), posted_by: `${actor} (auto)`,
      publish_lock: "", publish_error: "", publish_meta: p.extra || {},
    });
    return { result: "posted", url: p.url };
  } catch (e) {
    const msg = errText(e);
    const transient = e instanceof GraphError && e.transient;
    if (transient && (Number(fresh.publish_attempts) || 0) < 2) {
      await db.SocialVariant.update(v.id, { status: "approved", publish_lock: "", publish_error: `Temporary error, retrying next run: ${msg}` });
      return { result: "retrying", error: msg };
    }
    return fail(msg);
  }
}

/* ─── Insights ─────────────────────────────────────────────────────────── */
async function refreshInsights(ctx: Any, db: Any, onlyId: string | null) {
  const since = Date.now() - 45 * 86400000;
  const list = onlyId
    ? [await db.SocialVariant.get(onlyId).catch(() => null)].filter(Boolean)
    : ((await db.SocialVariant.filter({ status: "posted" }, "-published_at", 200).catch(() => [])) || [])
      .filter((v: Any) => v.external_id && Date.parse(v.published_at || 0) > since);
  let updated = 0;
  const notes: string[] = [];
  for (const v of list) {
    const ad = ADAPTERS[v.platform];
    if (!ad?.insights || !v.external_id || !v.account_id) continue;
    const a = await db.SocialAccount.get(v.account_id).catch(() => null);
    if (!a) continue;
    const ins = await ad.insights(ctx, a, v).catch((e: Error) => ({ note: errText(e).slice(0, 200) }));
    if (!ins) continue;
    await db.SocialVariant.update(v.id, { insights: { ...(v.insights || {}), ...ins, updated_at: now() } });
    if ((ins as Any).note) notes.push(`${v.platform}: ${(ins as Any).note}`);
    updated++;
  }
  if (!onlyId && updated) {
    await db.AutomationRun.create({
      automation_name: "Social Studio · multi-platform insights", kind: "social_insights", started_at: now(), finished_at: now(),
      status: "success", title: `Refreshed ${updated} posted variant${updated === 1 ? "" : "s"}`, message: notes.join("\n").slice(0, 1500),
    }).catch(() => null);
  }
  return { ok: true, updated, notes };
}

/* ─── Weekly digest: real numbers only ─────────────────────────────────── */
const METRICS = ["views", "reach", "impressions", "likes", "reactions", "comments", "replies", "saves", "shares", "reposts", "quotes", "clicks", "outbound_clicks", "score"];
function mondayOf(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}
async function digest(db: Any, brandKey: string | null, weekStart: string | null) {
  const start = weekStart || mondayOf(new Date(Date.now() - 7 * 86400000));
  const end = new Date(Date.parse(`${start}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  const inWeek = (d: string) => d.slice(0, 10) >= start && d.slice(0, 10) < end;
  const posted = ((await db.SocialVariant.filter({ status: "posted" }, "-published_at", 500).catch(() => [])) || [])
    .filter((v: Any) => inWeek(String(v.published_at || "")));
  // Legacy Instagram/Facebook studio posts (SocialPost) belong to Interstellar.
  const legacy = ((await db.SocialPost.filter({ status: "posted" }, "-published_at", 200).catch(() => [])) || [])
    .filter((p: Any) => inWeek(String(p.published_at || p.posted_at || "")))
    .map((p: Any) => ({ id: p.id, brand_key: "interstellar", platform: "instagram", title: p.title, text: p.caption, posted_url: p.ig_permalink || p.posted_url, insights: { likes: p.insights?.likes, comments: p.insights?.comments, reach: p.insights?.reach, views: p.insights?.views, saves: p.insights?.saved, shares: p.insights?.shares } }));
  const all = [...posted, ...legacy];
  const brands = brandKey ? [brandKey] : [...new Set(all.map((v: Any) => v.brand_key || "interstellar"))];
  const saved: Any[] = [];
  for (const b of brands) {
    const mine = all.filter((v: Any) => (v.brand_key || "interstellar") === b);
    const per: Record<string, Any> = {};
    for (const v of mine) {
      const p = (per[v.platform] ||= { posts: 0, with_data: 0, totals: {}, top: null });
      p.posts++;
      const ins = v.insights || {};
      const has = METRICS.some((m) => typeof ins[m] === "number");
      if (has) p.with_data++;
      for (const m of METRICS) if (typeof ins[m] === "number") p.totals[m] = (p.totals[m] || 0) + ins[m];
      // Ranking only (not shown as a metric): saves and shares weigh most, then comments, likes, views/reach.
      const score = (Number(ins.saves) || 0) * 8 + (Number(ins.shares) || 0) * 8 + (Number(ins.comments) || 0) * 4 + (Number(ins.likes) || 0) + ((Number(ins.views) || 0) + (Number(ins.reach) || 0)) * 0.02;
      if (has && (!p.top || score > p.top.rank)) p.top = { id: v.id, title: v.title || String(v.text || "").split("\n")[0].slice(0, 90), url: v.posted_url || "", rank: score, insights: ins };
    }
    const rows = (await db.SocialDigest.filter({ brand_key: b, week_start: start }, "-created_date", 1).catch(() => [])) || [];
    const data = { brand_key: b, client_id: b === "interstellar" ? "" : b, week_start: start, week_end: end, per_platform: per, posts_count: mine.length, data_points: Object.values(per).reduce((s: number, p: Any) => s + p.with_data, 0), computed_at: now() };
    saved.push(rows[0] ? await db.SocialDigest.update(rows[0].id, data) : await db.SocialDigest.create(data));
  }
  return { ok: true, week_start: start, digests: saved.length, items: saved };
}

/* ─── Source metadata for a pasted link ───────────────────────────────── */
async function fetchSource(url: string) {
  if (!/^https:\/\//.test(url)) return { error: "Paste a full https:// link" };
  if (/(?:youtube\.com|youtu\.be)\//.test(url)) {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`).catch(() => null);
    const j = r && r.ok ? await r.json().catch(() => null) : null;
    if (j) return { kind: "youtube", title: j.title, author: j.author_name, thumbnail: j.thumbnail_url, note: "YouTube only shares captions with the channel owner through the API: paste or upload the transcript for timestamps." };
  }
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Mothership link preview)" }, redirect: "follow" }).catch(() => null);
  if (!r || !r.ok) return { kind: "link", title: "", note: "Couldn't read that page (private or blocked). Add notes or a transcript." };
  const html = (await r.text().catch(() => "")).slice(0, 300000);
  const meta = (p: string) => (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)`, "i")) || [])[1] || "";
  const title = meta("og:title") || (html.match(/<title[^>]*>([^<]+)/i) || [])[1] || "";
  return { kind: /instagram\.com/.test(url) ? "instagram" : "link", title: title.trim().slice(0, 200), description: meta("og:description").slice(0, 600), thumbnail: meta("og:image"), note: "Only the page title/description could be read. Paste the transcript or your notes for the full idea." };
}
