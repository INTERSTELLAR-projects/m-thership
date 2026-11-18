// Content pipeline: the step machine that takes one ContentSubmission from "queued" to "live" (docs/content-pipeline.md).
//   queued → (safety checks + moderation) → processing_images → writing (writer + claim check) → publishing
//   (signed upsert → live check as Googlebot → sitemap → IndexNow → ContentPost + WorkEntry + notification) → live
// Any failed check stops it at needs_info / rejected with a plain-words reason for the client; nothing is published.
// is_test rows run every step except the publish and end at test_passed.
// Manual fallback (Justin, Nov 17): when the site's auto_publish is off, the site isn't set up for automatic posting,
// or a publish fails (key, endpoint, refusal, live check), the row goes to status "manual" instead of failing and Justin
// is emailed. Client posts → "Build page manually" has every field, the AI draft and the photos; "Mark as posted
// manually" with the live URL finishes it (status live, posted_manually true, ContentPost + WorkEntry as usual).
// Work is time-boxed: a call does as much as fits in its budget, saves progress, and the next drain picks it up.
// deno-lint-ignore-file no-explicit-any
import { siteFor, type SiteConfig } from "./contentSites.ts";
import {
  arr, s, clip, now, pushHistory, targetSite, runGates, moderate, normalizeProject, normalizeTestimonial, photoPlan, processPhoto,
  siteCatalog, writerPrompt, PROJECT_SCHEMA, claimCheck, numberProblems, buildAlbumRecord, normQuote, siteCall, verifyLive,
  pingIndexNow, logWork, notify, audit, publishKeyConfigured,
  normalizeDoorProject, doorFacts, DOOR_SCHEMA, doorWriterPrompt, buildDoorRecord, autoPublishFor, notifyJustin,
} from "./contentPipeline.ts";
import { callAI } from "./anthropic.ts";

export const ACTIVE = ["queued", "processing_images", "writing", "publishing"];
const LOCK_MS = 4 * 60 * 1000;
export const sourceKey = (sub: any) => `${s(sub.source_app_id)}:${s(sub.source_record_id)}`.slice(0, 120);

async function save(db: any, sub: any, patch: any) {
  Object.assign(sub, patch);
  await db.ContentSubmission.update(sub.id, patch);
  return sub;
}

async function stop(base44: any, db: any, sub: any, client: any, status: "needs_info" | "rejected" | "failed", detail: string, extra: any = {}) {
  await save(db, sub, { status, status_detail: clip(detail, 900), locked_at: null, history: pushHistory(sub.history, { action: status, by: "agent", note: clip(detail, 300) }), ...extra });
  await audit(db, `content_${status}`, sub.id, `${sub.client_name}: ${detail}`, status !== "failed");
  if (!sub.is_test) {
    const lines = status === "failed"
      ? [`A ${sub.kind} submission for ${sub.client_name} could not be posted.`, detail, "Open Møthership → Clients → Client posts to retry."]
      : [`Your ${sub.kind === "project" ? "project" : "testimonial"} "${clip(sub.raw?.shoot_title || sub.raw?.title || sub.raw?.customer_name || sub.raw?.name, 80)}" wasn't posted yet.`, `What to fix: ${detail}`, "Edit it in your Command System and send it again."];
    await notify(base44, client, status === "failed" ? `Client post failed: ${sub.client_name}` : `Action needed on your website post`, lines);
  }
  return { id: sub.id, status };
}

// Into the manual queue: nothing is published; Justin builds the page by hand from Client posts.
export async function toManual(base44: any, db: any, sub: any, reason: string, extra: any = {}) {
  await save(db, sub, { status: "manual", manual_reason: clip(reason, 500), manual_at: now(), status_detail: "Received. Interstellar is building the page.", locked_at: null, history: pushHistory(sub.history, { action: "to_manual", by: "agent", note: clip(reason, 300) }), ...extra });
  await audit(db, "content_to_manual", sub.id, `${sub.client_name}: ${reason}`, true);
  if (!sub.is_test) {
    const title = clip(sub.writer_output?.title || sub.raw?.shoot_title || sub.raw?.title || sub.raw?.customer_name || sub.raw?.name, 100);
    await notifyJustin(base44, `Build by hand: ${sub.client_name} ${sub.kind}${title ? ` "${title}"` : ""}`, [
      `A ${sub.kind} from ${sub.client_name} is waiting in the manual queue.`, `Why: ${reason}`,
      "Open Møthership → Clients → Client posts → Build manually. The Build page manually view has every field, the AI draft, copy buttons and a download-all for the photos. When the page is up, use Mark as posted manually with its live URL.",
    ]);
  }
  return { id: sub.id, status: "manual" };
}

async function brainFor(db: any, clientId: string) {
  const bb = arr(await db.BusinessBrain.filter({ client_id: clientId }, "-updated_date", 1).catch(() => []))[0];
  return clip(bb?.context_md, 8000);
}

// ---------------------------------------------------------------- one step pass
export async function processSubmission(base44: any, sub: any, deadline: number): Promise<any> {
  const db = base44.asServiceRole.entities;
  const fresh = await db.ContentSubmission.get(sub.id).catch(() => null);
  if (!fresh || !ACTIVE.includes(fresh.status)) return { id: sub.id, status: fresh?.status || "missing", skipped: true };
  if (fresh.locked_at && Date.now() - new Date(fresh.locked_at).getTime() < LOCK_MS) return { id: sub.id, status: fresh.status, skipped: true, locked: true };
  sub = fresh;
  await save(db, sub, { locked_at: now(), attempts: (Number(sub.attempts) || 0) + 1 });
  const client = await db.CRMClient.get(sub.client_id).catch(() => null);
  const { site, error: siteError } = targetSite(client);
  try {
    // 1. Safety checks (no photos or AI needed), then moderation.
    if (sub.status === "queued") {
      // No site set up for automatic posting: run the checks, then hand it to Justin to build by hand.
      const manualOnly = !site && !!client;
      const g = await runGates(db, sub, client, site, siteError, { manualOnly });
      const text = sub.kind === "project" ? [normalizeProject(sub.raw).title, normalizeProject(sub.raw).overview].join("\n") : normalizeTestimonial(sub.raw).quote;
      let mod = { safe: true, spam: false, reason: "" };
      if (!g.fatal) {
        mod = await moderate(base44, text);
        g.results.push({ check: "Content screen (abuse, spam)", ok: mod.safe && !mod.spam, note: mod.safe && !mod.spam ? "" : "This can't be posted as written" });
      }
      await save(db, sub, { gate_results: g.results });
      if (g.fatal) return stop(base44, db, sub, client, g.fatal as any, g.detail);
      if (!mod.safe || mod.spam) return stop(base44, db, sub, client, "rejected", `This can't be posted as written. ${mod.reason}`.trim());
      if (manualOnly) return toManual(base44, db, sub, `${siteError || "No website set up for automatic posting"}. Checks passed; build the page by hand.`);
      await save(db, sub, { status: "processing_images", status_detail: "Checking and preparing photos", image_cursor: 0, images: [], history: pushHistory(sub.history, { action: "checks_passed", by: "agent" }) });
    }
    // 2. Photos: type and size checks, compression, metadata removal, rehosting. Reuses photos already done for an
    //    earlier version of the same submission.
    if (sub.status === "processing_images") {
      const plan = sub.kind === "project" ? photoPlan(normalizeProject(sub.raw)) : (normalizeTestimonial(sub.raw).photo ? [{ ...normalizeTestimonial(sub.raw).photo, role: "cover" }] : []);
      const prior = new Map(arr(sub.prior_images || []).map((im: any) => [im.source_url, im]));
      const images = arr(sub.images);
      const notes = arr(sub.image_notes || []);
      let i = Number(sub.image_cursor) || 0;
      while (i < plan.length && Date.now() < deadline - 15000) {
        const p = plan[i];
        const reuse: any = prior.get(p.url) || prior.get(String(p.url).replace(/^https:\/\/base44\.app\/api\/apps\/([a-z0-9]+)\/files\/(?:mp\/)?public\/[a-z0-9]+\//, "https://media.base44.com/images/public/$1/"));
        const r: any = reuse ? { ok: true, image: { ...reuse, role: p.role } } : await processPhoto(base44, p, sub.source_app_id, p.role);
        if (r.ok) images.push(r.image);
        else {
          notes.push(r.note);
          if (p.role === "cover") return stop(base44, db, sub, client, "needs_info", `Cover photo problem: ${r.note}`, { images, image_cursor: i + 1 });
        }
        i++;
      }
      await save(db, sub, { images, image_notes: notes.slice(-60), image_cursor: i, status_detail: `Preparing photos (${i} of ${plan.length})` });
      if (i < plan.length) { await save(db, sub, { locked_at: null }); return { id: sub.id, status: sub.status, more: true }; }
      const kind = site?.kinds?.[sub.kind];
      const usable = images.filter((im: any) => im.role !== "cover").length || images.length;
      if (sub.kind === "project" && usable < (kind?.min_photos || 3) - 1 && images.length < (kind?.min_photos || 3)) {
        return stop(base44, db, sub, client, "needs_info", `Only ${images.length} photos could be used. ${notes.slice(0, 3).join("; ")}`);
      }
      await save(db, sub, { status: "writing", status_detail: notes.length ? `Photos ready (${notes.length} skipped)` : "Photos ready", history: pushHistory(sub.history, { action: "photos_ready", by: "agent", note: clip(notes.join("; "), 300) }) });
    }
    // 3. Writer + claim check (projects). Testimonials keep the customer's exact words: no AI rewriting at all.
    if (sub.status === "writing") {
      if (!site) return stop(base44, db, sub, client, "rejected", siteError);
      let output: any, claim: any;
      if (sub.kind === "project" && site.profile === "door_project") {
        // PowerLift door projects: size, system, cladding, place, date and testimonial are copied, never written.
        const n = normalizeDoorProject(sub.raw);
        const [catalog, brain] = await Promise.all([siteCatalog(site), brainFor(db, sub.client_id)]);
        const facts: any = doorFacts(n);
        const source = [Object.entries(facts).filter(([, v]) => s(v)).map(([k, v]) => `${k}: ${v}`).join("\n"), brain].join("\n\n");
        let feedback = "";
        for (let attempt = 1; attempt <= 2; attempt++) {
          const p = doorWriterPrompt(site, n, brain, catalog, feedback);
          const w = (await callAI(base44, { system: p.system, prompt: p.prompt, schema: DOOR_SCHEMA })).json || {};
          const body = arr(w.sections).flatMap((x: any) => [s(x?.h), ...arr(x?.p).map(s)]);
          const draft = [w.title, w.summary, ...body, w.seo_title, w.seo_description].map(s).join("\n");
          claim = { ...(await claimCheck(base44, draft, `${source}\n${site.name}`)), attempts: attempt };
          output = buildDoorRecord(site, n, w, arr(sub.images), !!sub.is_test);
          if (claim.ok && output.title && output.summary) break;
          feedback = claim.unsupported.map((x: string) => `- ${x}`).join("\n");
        }
        if (!claim?.ok || !output?.title || !output?.summary) {
          const own = s(n.overview).replace(/\s+/g, " ");
          output = buildDoorRecord(site, n, {
            title: n.title, slug: n.title, summary: own.length <= 900 ? own : `${own.slice(0, 897).replace(/\s+\S*$/, "")}…`, sections: [{ h: "About this project", p: [own] }],
            seo_title: n.title, seo_description: own.length <= 155 ? own : `${own.slice(0, 152).replace(/\s+\S*$/, "")}…`,
          }, arr(sub.images), !!sub.is_test);
          claim = { ...(claim || {}), ok: true, fallback: "client_words", note: `Writer drafts had unconfirmed claims (${(claim?.unsupported || []).slice(0, 3).join("; ")}), so the team's own story was used` };
        }
        if (!output?.title || !output?.summary) return stop(base44, db, sub, client, "needs_info", "Add a title and the story of the job.");
        output.catalog_from = catalog.from;
      } else if (sub.kind === "project") {
        const n = normalizeProject(sub.raw);
        const [catalog, brain] = await Promise.all([siteCatalog(site), brainFor(db, sub.client_id)]);
        const facts = { title: n.title, description: n.overview, client: n.client, location: n.location, month: n.month, year: n.year, when: [n.month, n.year].filter(Boolean).join(" "), camera: n.camera, lenses: n.lenses, other_equipment: n.other_equipment };
        const source = [Object.entries(facts).filter(([, v]) => s(v)).map(([k, v]) => `${k}: ${v}`).join("\n"), brain].join("\n\n");
        let feedback = "";
        for (let attempt = 1; attempt <= 2; attempt++) {
          const p = writerPrompt(site, n, brain, catalog, feedback);
          const w = (await callAI(base44, { system: p.system, prompt: p.prompt, schema: PROJECT_SCHEMA })).json || {};
          const draft = [w.title, w.overview, w.seo_title, w.seo_description].map(s).join("\n");
          claim = { ...(await claimCheck(base44, draft, `${source}\n${site.name}`)), attempts: attempt };
          output = buildAlbumRecord(site, n, w, arr(sub.images), catalog, !!sub.is_test);
          if (claim.ok) break;
          feedback = claim.unsupported.map((x: string) => `- ${x}`).join("\n");
        }
        // Two drafts that still carry an unconfirmed claim: post the client's own words instead (never invented), with
        // search fields built from them. The writer's category / type / service picks are kept (validated lists).
        if (!claim?.ok || !output?.title || !output?.overview) {
          const own = s(n.overview).replace(/\s+/g, " ");
          const brand = ` | ${site.name}`;
          output = buildAlbumRecord(site, n, {
            ...(output || {}), title: n.title, slug: n.title, overview: own,
            seo_title: `${n.title}${brand}`.length <= 60 ? `${n.title}${brand}` : n.title,
            seo_description: own.length <= 155 ? own : `${own.slice(0, 152).replace(/\s+\S*$/, "")}…`,
          }, arr(sub.images), catalog, !!sub.is_test);
          claim = { ...(claim || {}), ok: true, fallback: "client_words", note: `Writer drafts had unconfirmed claims (${(claim?.unsupported || []).slice(0, 3).join("; ")}), so the client's own description was used` };
        }
        if (!output?.title || !output?.overview) return stop(base44, db, sub, client, "needs_info", "Add a title and a description of the shoot.");
        output.catalog_from = catalog.from;
      } else {
        const t = normalizeTestimonial(sub.raw);
        const cover = arr(sub.images)[0];
        output = { name: t.name, role: t.role, quote: normQuote(t.quote), rating: t.rating || undefined, source: t.source, review_date: t.review_date || undefined, ...(cover ? { image: cover.src, image_alt: `${t.name}` } : {}), is_test: !!sub.is_test, unlisted: !!sub.is_test };
        const same = normQuote(output.quote) === normQuote(t.quote);
        claim = { ok: same, unsupported: same ? [] : ["the quote changed"], attempts: 1, checked_at: now(), note: "Testimonials are posted in the customer's exact words (whitespace and quote marks normalized only)" };
        if (!same) return stop(base44, db, sub, client, "failed", "Quote integrity check failed", { claim_check: claim });
      }
      await save(db, sub, { writer_output: output, claim_check: claim, slug: sub.slug || output.slug || "", status: "publishing", status_detail: "Written and fact-checked", history: pushHistory(sub.history, { action: "written", by: "agent", output }) });
    }
    // 4. Publish (or, for a test row, stop here) → live check → IndexNow → log → ledger → notify.
    if (sub.status === "publishing") {
      if (!site) return stop(base44, db, sub, client, "rejected", siteError);
      if (sub.is_test) {
        const ping = publishKeyConfigured(site) ? await siteCall(site, "ping") : { ok: false, not_configured: true, status: 0 };
        await save(db, sub, { status: "test_passed", locked_at: null, status_detail: `Test passed every check and was written, and was not published (test record). Publishing key: ${ping.not_configured ? "not configured yet" : ping.ok ? "working (signed ping OK)" : `ping failed (${ping.status})`}.`, history: pushHistory(sub.history, { action: "test_passed", by: "agent" }) });
        await audit(db, "content_test_passed", sub.id, `${sub.client_name}: test submission passed`);
        return { id: sub.id, status: "test_passed" };
      }
      if (!(await autoPublishFor(db, site))) return toManual(base44, db, sub, "Automatic posting is switched off for this website");
      return await publish(base44, sub, client, site, "publish");
    }
    await save(db, sub, { locked_at: null });
    return { id: sub.id, status: sub.status };
  } catch (e) {
    const msg = clip((e as Error)?.message || String(e), 400);
    await save(db, sub, { locked_at: null, error: msg });
    if ((Number(sub.attempts) || 0) >= 4) return stop(base44, db, sub, client, "failed", `Stopped after repeated errors: ${msg}`);
    return { id: sub.id, status: sub.status, error: msg };
  }
}

// Signed upsert + checks + logging. Used by the first publish, a client resubmit, Justin's edit and a retry.
export async function publish(base44: any, sub: any, client: any, site: SiteConfig, why: "publish" | "edit"): Promise<any> {
  const db = base44.asServiceRole.entities;
  const kind = site.kinds[sub.kind];
  const record = { ...sub.writer_output };
  delete record.catalog_from;
  delete record.verify_title;
  const r = await siteCall(site, "upsert", { kind: sub.kind, source_record_id: sourceKey(sub), submission_id: sub.id, record });
  if (!r.ok) {
    const detail = r.not_configured ? `Publishing is not configured yet (${site?.key_secret || "the site's key"} in Møthership or CONTENT_PUBLISH_KEY on the website is missing)` : `The website refused the post (${r.status}: ${clip(r.body?.error, 200)})`;
    // A first publish that can't reach the site falls to the manual queue (Justin is emailed). An edit of a page
    // that is already live stays live as it was and reports the failure.
    if (why === "publish" && !sub.published_url) return toManual(base44, db, sub, `Automatic publish failed: ${detail}`, { error: r.not_configured ? "not_configured" : clip(r.body?.error, 300) });
    return stop(base44, db, sub, client, "failed", detail, { error: r.not_configured ? "not_configured" : clip(r.body?.error, 300) });
  }
  const url = s(r.body.url);
  const firstTime = !sub.published_url;
  const title = s(sub.writer_output?.title || sub.writer_output?.name);
  const verify = await verifyLive(site, url, sub.kind === "project" ? { title: s(sub.writer_output?.verify_title) || title, ld: kind.verify_ld } : { text: sub.writer_output?.quote }, { inSitemap: sub.kind === "project", tries: firstTime ? 6 : 2 });
  // A brand-new project URL that bots can't see is rolled back. Edits and testimonials can lag behind the bot render
  // cache, so they are kept live and flagged instead.
  if (!verify.ok && firstTime && sub.kind === "project" && (verify.http_status !== 200 || !verify.title_ok || verify.sitemap_ok === false)) {
    await siteCall(site, "unpublish", { kind: sub.kind, source_record_id: sourceKey(sub), submission_id: sub.id });
    await notify(base44, client, `Client post rolled back: ${sub.client_name}`, [`"${title}" was written to the website but the live check failed, so it was unpublished again.`, `Status ${verify.http_status}, title found: ${verify.title_ok}, in sitemap: ${verify.sitemap_ok}.`]);
    return toManual(base44, db, sub, `Posted, but the live check failed (status ${verify.http_status}, title found: ${verify.title_ok}, in sitemap: ${verify.sitemap_ok}), so it was taken down again. Retry after the site is published, or build it by hand`, { target_record_id: s(r.body.id), slug: s(r.body.slug), error: "live_check_failed" });
  }
  const indexnow = sub.kind === "project" ? await pingIndexNow(site, [url]) : { status: "skipped", note: "Testimonials share the /reviews page", at: now() };
  const event = { at: now(), action: why === "edit" ? "edited" : firstTime ? "published" : "republished_update", by: "agent", ok: true, note: verify.ok ? "Live check passed" : "Live, check pending (bot render cache)" };
  let post = sub.content_post_id ? await db.ContentPost.get(sub.content_post_id).catch(() => null) : null;
  const postPatch = {
    client_id: sub.client_id, client_name: sub.client_name, submission_id: sub.id, site_app_id: site.app_id, kind: sub.kind,
    target_entity: kind.entity, target_record_id: s(r.body.id), slug: s(r.body.slug), url, title: clip(title, 200), status: "live",
    published_at: post?.published_at || now(), last_action_at: now(), verify, indexnow,
  };
  if (post) {
    const events = [...arr(post.events), event].slice(-60);
    await db.ContentPost.update(post.id, { ...postPatch, events });
    post = { ...post, ...postPatch, events };
  } else {
    post = await db.ContentPost.create({ ...postPatch, events: [event] });
  }
  const workId = sub.work_entry_id || (await logWork(db, sub, post, site));
  if (!post.work_entry_id) await db.ContentPost.update(post.id, { work_entry_id: workId });
  await save(db, sub, {
    status: "live", status_detail: verify.ok ? "Live on your website" : "Live on your website (search engines may show the update a little later)",
    target_site_app_id: site.app_id, target_entity: kind.entity, target_record_id: s(r.body.id), slug: s(r.body.slug), published_url: url,
    published_at: sub.published_at || now(), content_post_id: post.id, work_entry_id: workId, locked_at: null, error: "",
    history: pushHistory(sub.history, { action: event.action, by: "agent", note: url }),
  });
  await audit(db, why === "edit" ? "content_edited" : "content_published", sub.id, `${sub.client_name}: ${title} → ${url}`);
  if (why === "publish") await notify(base44, client, `New on your website: ${clip(title, 80)}`, [
    sub.kind === "project" ? `Your project "${title}" is now live on your website.` : `${title}'s testimonial is now on your website, in their own words.`,
    url, "Want to change or remove it? Open it in your Command System and use Edit or Unpublish.",
  ]);
  return { id: sub.id, status: "live", url, verify: verify.ok };
}

export async function setPublished(base44: any, sub: any, publishFlag: boolean, by: string) {
  const db = base44.asServiceRole.entities;
  const site = siteFor(sub.target_site_app_id);
  if (sub.posted_manually) return { ok: false, error: "This page was built by hand. Take it down (or put it back) on the website itself, then use Mark as posted manually to record a new link" };
  if (!site || !sub.published_url) return { ok: false, error: "This post isn't on a website yet" };
  const r = await siteCall(site, publishFlag ? "republish" : "unpublish", { kind: sub.kind, source_record_id: sourceKey(sub), submission_id: sub.id });
  if (!r.ok) return { ok: false, error: r.not_configured ? "Publishing is not configured yet" : clip(r.body?.error || `Website returned ${r.status}`, 200) };
  const status = publishFlag ? "live" : "unpublished";
  await save(db, sub, { status, status_detail: publishFlag ? "Live on your website" : "Removed from your website (kept on file, nothing deleted)", ...(publishFlag ? {} : { unpublished_at: now() }), history: pushHistory(sub.history, { action: status, by }) });
  if (sub.content_post_id) {
    const post = await db.ContentPost.get(sub.content_post_id).catch(() => null);
    if (post) await db.ContentPost.update(post.id, { status, last_action_at: now(), ...(publishFlag ? {} : { unpublished_at: now() }), events: [...arr(post.events), { at: now(), action: status, by, ok: true }].slice(-60) });
  }
  await audit(db, publishFlag ? "content_republished" : "content_unpublished", sub.id, `${sub.client_name}: ${sub.published_url} by ${by}`, true, by);
  return { ok: true, status, note: publishFlag ? "" : "Visitors stop seeing it right away; search engine bots can see the old copy for up to about 15 minutes." };
}

// Justin's edit from the Content page: only the fields he changed, deterministic checks only (he is the reviewer).
export const EDITABLE = { project: ["title", "overview", "seo_title", "seo_description", "category", "project_type", "services", "client", "location", "year"], testimonial: ["name", "role", "rating"] } as Record<string, string[]>;
export async function editPost(base44: any, sub: any, fields: any, by: string) {
  const db = base44.asServiceRole.entities;
  const site = siteFor(sub.target_site_app_id || "");
  const client = await db.CRMClient.get(sub.client_id).catch(() => null);
  if (!site || !sub.writer_output) return { ok: false, error: "Nothing written yet to edit" };
  const allowed = EDITABLE[sub.kind] || [];
  const patch: any = {};
  for (const k of allowed) if (fields && k in fields) patch[k] = k === "services" ? arr(fields[k]).map(s).slice(0, 3) : k === "rating" ? Number(fields[k]) || undefined : clip(fields[k], k === "overview" ? 1200 : 200);
  if (!Object.keys(patch).length) return { ok: false, error: "No editable fields sent" };
  const text = Object.values(patch).filter((v) => typeof v === "string").join("\n");
  const problems = numberProblems(text, `${JSON.stringify(sub.raw)}\n${JSON.stringify(sub.writer_output)}`).filter((p) => !/number/.test(p));
  if (problems.length) return { ok: false, error: problems.join("; ") };
  const output = { ...sub.writer_output, ...patch };
  await save(db, sub, { writer_output: output, version: (Number(sub.version) || 1) + 1, history: pushHistory(sub.history, { action: "edited", by, note: Object.keys(patch).join(", "), output: patch }) });
  if (!sub.published_url) return { ok: true, status: sub.status, note: "Saved. It will be used when the post goes live." };
  const r = await publish(base44, sub, client, site, "edit");
  return { ok: r.status === "live", ...r };
}
