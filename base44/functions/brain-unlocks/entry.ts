import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { evaluateCriteria } from "../../shared/criteria.js";
import { evaluateUnlocks, isNational, seoSteps, DEFAULT_BLOG_FREQUENCY } from "../../shared/unlocks.js";
import { directoriesFor } from "../../shared/launchGrid.js";

/*
 * Brain unlocks (Build Engine, Nov 19 2026: Mission ALPHA running itself).
 *   { action: "scan", offset, limit } every client that isn't Inactive: recompute its four unlocks from real Brain
 *                                    completeness and keep one ClientUnlock row per unlock current (missing list +
 *                                    portal line). Workflow "Brain unlocks — daily scan" runs it.
 *   { action: "client", client_id }  admin: the same for one client, returns the rows.
 * When an unlock turns on for the first time it PREPARES its work, once (prepared_at), and only for Build Engine
 * clients (they have a BuildChecklist) or clients with unlocks_auto true:
 *   basics       → the launch grid rows for the niche (all "missing" until checked). No submissions.
 *   brand        → the client's Social Studio voice guide (SocialBrand) if missing, five email signature options in the
 *                  portal (SignatureTemplate, folder "Brand options"), and one queued job for first social drafts in
 *                  their style (drafts only; nothing is approved, scheduled or posted).
 *   growth       → the foundational SEO step list, blog_frequency (default 2 per month) and one internal content-plan
 *                  job. Blog, GBP and citation POSTING stays OFF (Justin's rule): plans and drafts only.
 *   transmission → one queued job for the Transmission videos; finished videos go to the client's portal files
 *                  after Justin's taste look.
 * Never sends, publishes, deletes, charges or touches a domain.
 */
const s = (v: unknown) => (v == null ? "" : String(v));
const arr = (r: any) => (Array.isArray(r) ? r : (r && r.items) || []);
const nowIso = () => new Date().toISOString();

async function contextFor(db: any, client: any) {
  const f = (entity: string, sort: string, limit: number, q: any = { client_id: client.id }) => db[entity].filter(q, sort, limit).then(arr).catch(() => []);
  const [dossiers, flights, intakes, goals, outreach, kits, reviews, files] = await Promise.all([
    f("ClientDossier", "-updated_date", 1), f("OnboardingFlight", "-created_date", 5), f("IntakeAudit", "-created_date", 1),
    f("ClientGoal", "sort", 50), f("OutreachProfile", "-updated_date", 1), f("BrandKit", "-version", 5),
    f("ReviewClient", "-updated_date", 3, { crm_client_id: client.id }), f("ClientFile", "-created_date", 200),
  ]);
  const approvedKit = kits.filter((k: any) => k.status === "approved").sort((a: any, b: any) => (Number(b.version) || 0) - (Number(a.version) || 0))[0] || null;
  return {
    client, dossier: dossiers[0] || null, flights, flight: flights.find((x: any) => x.status !== "archived") || flights[0] || null,
    intake: intakes[0] || null, goals, outreach: outreach[0] || null, brandKits: kits, brandKit: approvedKit,
    review: reviews.find((r: any) => r.active !== false) || reviews[0] || null, files,
  };
}

async function factsFor(db: any, client: any, ctx: any, checklist: any) {
  const autos = await db.Automation.filter({ client_id: client.id }, "-created_date", 50).then(arr).catch(() => []);
  const cmd = ((checklist && checklist.tracks) || []).find((t: any) => t.key === "command");
  const autoItem = cmd ? (cmd.items || []).find((i: any) => i.key === "automations") : null;
  return {
    website_live: !!client.website_live_at,
    command_live: !!client.command_live_at,
    processes_set: !!(autoItem && autoItem.done) || autos.some((a: any) => a.status === "active"),
    brand_kit_delivered: !!ctx.brandKit,
  };
}

const SIG_TEMPLATES = [["t5_rail", "Halo"], ["t1_classic", "Split"], ["t4_centered", "Stack"], ["t2_minimal", "Minimal"], ["t3_compact", "Compact"]];
const isHex = (c: unknown) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c.trim());

async function prepare(db: any, key: string, client: any, ctx: any, national: boolean) {
  const prepared: Record<string, unknown> = {};
  const d = ctx.dossier || {};
  const bi = d.brand_identity || {};
  const colors = (Array.isArray(bi.colors) ? bi.colors : []).map((c: any) => (typeof c === "string" ? c : c && c.hex)).filter(isHex);
  const logo = s(client.logo_url || bi.logo_url || (ctx.brandKit && ctx.brandKit.kit && ctx.brandKit.kit.logo && ctx.brandKit.kit.logo.primary_url));
  const site = s(client.domain || (client.websites || [])[0]);
  const jobExists = async (unlock: string) => (await db.ClaudeJob.filter({ client_id: client.id, "context.unlock": unlock }, "-created_date", 1).then(arr).catch(() => [])).length > 0;
  const queue = (unlock: string, kind: string, title: string, instructions: string) => db.ClaudeJob.create({
    title, kind, status: "queued", client_id: client.id, client_name: client.business, brand: client.brand_id || "interstellar",
    instruction: title, instructions, priority: 3, requested_at: nowIso(), complete_task_on_approve: false,
    context: { unlock, source: "brain-unlocks" },
  });

  if (key === "basics") {
    const have = new Set((await db.LaunchListing.filter({ client_id: client.id }, "name", 200).then(arr).catch(() => [])).map((r: any) => r.directory_key));
    let n = 0;
    for (const dir of directoriesFor(client.niche_key || "other", national)) {
      if (have.has(dir.key)) continue;
      await db.LaunchListing.create({ client_id: client.id, client_name: client.business, directory_key: dir.key, name: dir.name, group: dir.group, check: dir.check, status: "missing", set_by: "seed" });
      n++;
    }
    prepared.listings_created = n;
  }

  if (key === "brand") {
    const sb = await db.SocialBrand.filter({ brand_key: client.id }, "-updated_date", 1).then(arr).catch(() => []);
    if (!sb.length) {
      const voice = d.brand_voice || {};
      await db.SocialBrand.create({
        brand_key: client.id, client_id: client.id, name: client.business,
        tone: s(voice.personality || voice.tone).slice(0, 600), audience: s((d.audience || {}).ideal_customer).slice(0, 600),
        colors, logo_url: logo, website: site,
      }).catch(() => null);
      prepared.social_brand = "created";
    } else prepared.social_brand = "existing";
    const tpls = await db.SignatureTemplate.filter({ client_id: client.id, scope: "client", folder: "Brand options" }, "-created_date", 10).then(arr).catch(() => []);
    if (!tpls.length) {
      const accent = colors.find((c: string) => !/^#(f{6}|0{6})$/i.test(c)) || "";
      const accent2 = colors.find((c: string) => c !== accent && !/^#(f{6}|0{6})$/i.test(c)) || accent;
      for (const [tid, name] of SIG_TEMPLATES) {
        await db.SignatureTemplate.create({
          name: `${name} — ${client.business}`, description: "Made from your brand. Pick one, then add each person's details.",
          folder: "Brand options", scope: "client", client_id: client.id, client_name: client.business, is_default: false, portal_visible: true,
          template_id: tid,
          fields: { company_name: client.business, logo_url: logo, website: site, website_show: !!site, slogan: s(d.tagline).slice(0, 120) },
          theme: accent ? { accent_color: accent, accent_color_2: accent2 } : {},
        });
      }
      prepared.signature_options = SIG_TEMPLATES.length;
    }
    if (!(await jobExists("brand"))) {
      const job = await queue("brand", "task", `Social engine: first drafts in ${client.business}'s style`, [
        `Brand unlock for ${client.business} (CRMClient ${client.id}). Use the Social Studio content engine for this client: its voice guide is SocialBrand brand_key "${client.id}" (tone, words, colors, logo).`,
        "Write 6 first post ideas from the Brain (services, proof, differentiators) as SocialIdea records and draft their platform variants as SocialVariant records with status \"draft\", in the client's brand style.",
        "Drafts only: never approve, schedule or publish anything, and never post to any account. Facts come from the Brain only; unknowns are [OWNER: …].",
        "Write back result_summary (how many drafts, which platforms) and list them in result_body for Justin's taste look.",
      ].join("\n"));
      prepared.social_job = job.id;
    }
  }

  if (key === "growth") {
    if (!client.blog_frequency) await db.CRMClient.update(client.id, { blog_frequency: DEFAULT_BLOG_FREQUENCY }).catch(() => null);
    prepared.blog_frequency = client.blog_frequency || DEFAULT_BLOG_FREQUENCY;
    prepared.seo_steps = seoSteps(national).length;
    if (!(await jobExists("growth"))) {
      const job = await queue("growth", "content_plan", `Search plan + blog engine set-up: ${client.business}`, [
        `Growth unlock for ${client.business} (CRMClient ${client.id}; ${national ? "national/global: topics" : "local: services x service areas"}).`,
        `Prepare the content plan for a blog cadence of ${String(prepared.blog_frequency).replace(/_/g, " ")} from the Brain's keywords${national ? "/topics" : ", services, competitors and locations"}, and work through the foundational SEO step list on the client's ClientUnlock "growth" row as a plan (what to do per step, per page).`,
        "PLAN AND DRAFTS ONLY. Blog, GBP and citation posting stays OFF by Justin's rule: do not publish, schedule or queue any post, and do not create a Topic Calendar or engine job.",
      ].join("\n"));
      prepared.content_plan_job = job.id;
    }
  }

  if (key === "transmission") {
    if (!(await jobExists("transmission"))) {
      const job = await queue("transmission", "task", `Transmission videos: ${client.business}`, [
        `Transmission unlock for ${client.business} (CRMClient ${client.id}): the website and Command System are live, processes are set and the brand kit is delivered.`,
        "Queue the Transmission video set: write the scripts and shot lists from the Brain and brand kit (brand story, how we work, the Command System walkthrough) in result_body for Justin's taste look.",
        "Finished videos are stored as ClientFile {client_id, category \"transmission\", title, file_url, portal_visible false} so they appear in the client's Interstellar portal once Justin approves them. Never send anything to the client.",
      ].join("\n"));
      prepared.transmission_job = job.id;
    }
  }
  return prepared;
}

async function runClient(db: any, client: any) {
  const ctx = await contextFor(db, client);
  const checklist = (await db.BuildChecklist.filter({ client_id: client.id }, "-updated_date", 1).then(arr).catch(() => []))[0] || null;
  const facts = await factsFor(db, client, ctx, checklist);
  const national = isNational(client);
  const ev = evaluateCriteria(ctx);
  const results = evaluateUnlocks(ev.items, facts, national);
  const rows = await db.ClientUnlock.filter({ client_id: client.id }, "key", 10).then(arr).catch(() => []);
  const byKey = new Map(rows.map((r: any) => [r.key, r]));
  const auto = !!checklist || client.unlocks_auto === true;
  const out: any[] = [];
  for (const u of results) {
    const prev: any = byKey.get(u.key);
    const patch: Record<string, unknown> = {
      client_id: client.id, client_name: client.business, key: u.key, label: u.label, on: u.on, done: u.done, total: u.total,
      missing: u.missing, portal: u.portal, checked_at: nowIso(),
    };
    if (u.on && !(prev && prev.unlocked_at)) patch.unlocked_at = nowIso();
    if (u.key === "growth" && !(prev && (prev.steps || []).length)) patch.steps = seoSteps(national);
    if (u.on && auto && !(prev && prev.prepared_at)) {
      patch.prepared = await prepare(db, u.key, client, ctx, national);
      patch.prepared_at = nowIso();
    }
    const row = prev ? await db.ClientUnlock.update(prev.id, patch) : await db.ClientUnlock.create(patch);
    out.push(row);
  }
  return { client_id: client.id, pct: ev.pct, national, auto, unlocks: out.map((r: any) => ({ key: r.key, on: r.on, missing: (r.missing || []).map((m: any) => m.label), prepared: r.prepared || null })) };
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    if (body?.action === "scan") {
      // Batches (offset/limit) so no call hits the time limit; the daily workflow runs several steps.
      const offset = Math.max(0, Number(body.offset) || 0), limit = Math.min(40, Math.max(1, Number(body.limit) || 25));
      const clients = (await db.CRMClient.list("business", 500).then(arr).catch(() => [])).slice(offset, offset + limit);
      const done: any[] = [];
      const t0 = Date.now();
      for (const c of clients) {
        if (c.status === "Inactive") continue;
        if (Date.now() - t0 > 50000) break;
        done.push(await runClient(db, c).catch((e) => ({ client_id: c.id, error: s((e as Error)?.message).slice(0, 200) })));
      }
      return Response.json({ ok: true, clients: done.length, on: done.reduce((n, r) => n + ((r.unlocks || []).filter((u: any) => u.on).length), 0) });
    }
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== "admin") return Response.json({ error: "Admins only" }, { status: 403 });
    if (body?.action === "client") {
      const c = await db.CRMClient.get(s(body.client_id)).catch(() => null);
      if (!c) return Response.json({ error: "Client not found" }, { status: 404 });
      return Response.json({ ok: true, ...(await runClient(db, c)) });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: s((e as Error)?.message).slice(0, 300) }, { status: 500 });
  }
}
