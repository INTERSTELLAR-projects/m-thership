// Client-app Business Brain → Møthership (docs/client-brain-sync.md).
//   ingest { app_id, app_name?, client_id? | domain?, mode?: "delta"|"full", stats?: { total, answered, open, skipped },
//            facts: [{ source_fact_id, question_key?, question_id?, area?, question?, answer, source?, captured_by_name?,
//                      status?: active|superseded, answered_at?, test? }] }
//          Auth: header x-mothership-key = secret COMMAND_SYSTEM_SYNC_KEY (one key shared by every client command
//          system; MOTHERSHIP_INGEST_KEY is still accepted as a fallback until Justin sets the new one), or an admin.
//          Anti-spoofing (key calls): the push is accepted only when app_id is the CRMClient.command_app_id of the
//          client it writes to; a mismatch or an unregistered app is rejected with 403 and logged (AgentAuditLog
//          action client_brain_rejected). Admin calls may still resolve the client by client_id / ops app / domain.
//          Upserts the facts as client-tagged BrainFacts (source "client_app"; idempotent by app_id +
//          source_fact_id; one active answer per app_id + question key, older ones kept as superseded; "full" also
//          supersedes stored facts the app no longer has. Soft only: nothing is deleted). Records the app's counts on
//          ClientDossier.client_brain, re-blends the stored health score from the stored pillar scores (pillars.js
//          blendHealth) and refreshes the client's shared context block so agents use the answers right away.
//          Brand level (House of Brands): an app registered as a brand's template app (Brand.template_app_id) or one
//          of its brand_app_ids is accepted with the same key; its facts are stored as that BRAND's brain
//          (BrandBrainFact, source "brand_app") and its counts on Brand.brain_stats. Never as a client's brain.
//          Optional payload { target: "brand" | "client", brand_id } must match the registration (base44/shared/brandBrain.js).
//   features { app_id, features: [{ key, name?, state: enabled|added|removed|requested, usage_count?, last_used_at? }] }
//          Same key + command_app_id check as ingest. Upserts ClientAppFeature rows (source sync) for the client.
//   get    { client_id }   admin. What Møthership holds for that client (getClientBrain).
//   status {}              admin. Every client with a reporting app: counts and last sync.
// Records only: never sends, publishes or changes anything in the client's app.
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { planUpsert, factError, mergeClientBrain, getClientBrain, appAuthError, findClientForApp, SOURCE } from "../../shared/clientBrain.js";
import { brainComponent, blendHealth } from "../../shared/constellations.js";
import { buildClientContext } from "../../shared/clientContext.ts";
import { resolveIngestTarget, brandForApp, toBrandRow, featureError, planFeatureUpsert } from "../../shared/brandBrain.js";

const arr = (v: any) => (Array.isArray(v) ? v : (v && v.items) || []);
const s = (v: unknown) => (v == null ? "" : String(v).trim());
const bareDomain = (x = "") => x.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();

const loadBrands = async (db: any) => arr(await db.Brand.list("sort_order", 200).catch(() => []));

// Key-authenticated (machine) call: the target is the record the sending app is registered on. A brand template /
// brand app writes its brand's brain; a client command system writes its client's brain (a client_id in the payload
// must name that same client). Nothing else (domain, ops_app_id) can pick the target.
async function resolveForApp(db: any, b: any) {
  const appId = s(b.app_id);
  // command_app_id first (indexed filter); a second registered ops app lives in other_app_ids (array), so fall back
  // to a scan with the same rule the auth check uses (findClientForApp).
  let registered = appId ? arr(await db.CRMClient.filter({ command_app_id: appId }, "-updated_date", 2).catch(() => []))[0] || null : null;
  if (appId && !registered) registered = findClientForApp(arr(await db.CRMClient.list("business", 500).catch(() => [])), appId);
  const targetClient = s(b.client_id) ? await db.CRMClient.get(s(b.client_id)).catch(() => null) : null;
  const t = resolveIngestTarget({ appId, payload: b, brands: await loadBrands(db), registeredClient: registered, targetClient });
  if (t.kind === "brand") return { kind: "brand", brand: t.brand || null, client: null, error: t.error };
  return { kind: "client", brand: null, client: t.client || null, error: t.error || appAuthError(t.client, appId) };
}

async function logRejected(db: any, appId: string, recordId: string, reason: string, via: string, entity = "CRMClient") {
  console.error("client-brain rejected", JSON.stringify({ app_id: appId, record_id: recordId || null, reason, via }));
  await db.AgentAuditLog.create({ at: new Date().toISOString(), actor: `app:${appId}`.slice(0, 120), action: "client_brain_rejected", entity, record_id: recordId || "", summary: `Rejected a Business Brain push: ${reason}`.slice(0, 500), ok: false }).catch(() => null);
}

// Brand brain: the brand's own template / brand app. Same upsert rules as a client brain, stored in BrandBrainFact.
async function ingestBrand(db: any, b: any, brand: any, valid: any[], errors: any[], auth: { via: string }) {
  const appId = s(b.app_id);
  const now = new Date().toISOString();
  const mode = b.mode === "full" ? "full" : "delta";
  const appName = s(b.app_name).slice(0, 120);
  const ctx = { app_id: appId, app_name: appName, client_id: "", client_name: "", now };
  const existing = arr(await db.BrandBrainFact.filter({ source_app_id: appId, brand_id: brand.id }, "-created_date", 2000));
  const plan = planUpsert(existing, valid, ctx, mode);
  const creates = plan.creates.map((r: any) => toBrandRow(r, brand));
  for (let i = 0; i < creates.length; i += 100) await db.BrandBrainFact.bulkCreate(creates.slice(i, i + 100));
  for (const u of plan.updates) await db.BrandBrainFact.update(u.id, toBrandRow(u.patch, brand));
  const patched = new Map(plan.updates.map((u: any) => [u.id, u.patch]));
  const after = [...existing.map((r: any) => ({ ...r, ...(patched.get(r.id) || {}) })), ...creates];
  const live = after.filter((r: any) => r.status === "active" && !r.data?.test);
  const lastAnswer = live.map((r: any) => s(r.answered_at)).sort().pop() || "";
  const prevApp = brand.brain_stats?.apps?.[appId] || null;
  const stats = b.stats && typeof b.stats === "object" ? b.stats : prevApp || {};
  const brainStats = mergeClientBrain(brand.brain_stats, appId, appName, stats, { facts_active: live.length, last_answer_at: lastAnswer, synced_at: now });
  await db.Brand.update(brand.id, { brain_stats: brainStats });
  return {
    status: 200,
    body: {
      ok: true, level: "brand", brand_id: brand.id, brand_name: brand.name, app_id: appId, mode, auth: auth.via,
      created: plan.creates.length, updated: plan.updates.length, unchanged: plan.unchanged, superseded: plan.superseded,
      rejected: errors, facts_active: live.length,
      brain: { answered: brainStats.answered, total: brainStats.total, score: brainStats.total ? Math.round((100 * brainStats.answered) / brainStats.total) : null },
    },
  };
}

// Feature report from a client's own app (feature intelligence). Client apps only.
async function ingestFeatures(db: any, b: any, auth: { machine: boolean; via: string }) {
  const appId = s(b.app_id);
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(appId)) return { status: 400, body: { error: "app_id is required" } };
  let client: any = null;
  if (auth.machine) {
    const r = await resolveForApp(db, b);
    if (r.error) { await logRejected(db, appId, s(b.client_id) || r.client?.id || r.brand?.id || "", r.error, auth.via, r.kind === "brand" ? "Brand" : "CRMClient"); return { status: 403, body: { error: "This app is not registered for that client" } }; }
    if (r.kind === "brand") return { status: 400, body: { error: "Feature reports come from client apps; brand template features are kept in AppFeature" } };
    client = r.client;
  } else client = await resolveClient(db, b);
  if (!client) return { status: 404, body: { error: "No Møthership client matches this app" } };
  const list = Array.isArray(b.features) ? b.features.slice(0, 500) : [];
  const errors: any[] = [];
  const valid = list.filter((f: any, i: number) => { const e = featureError(f); if (e) errors.push({ index: i, key: s(f?.key), error: e }); return !e; });
  const now = new Date().toISOString();
  const existing = arr(await db.ClientAppFeature.filter({ client_id: client.id }, "-updated_date", 1000));
  const plan = planFeatureUpsert(existing, valid, { client_id: client.id, client_name: client.business, brand_id: s(client.brand_id), app_id: appId, now });
  for (let i = 0; i < plan.creates.length; i += 100) await db.ClientAppFeature.bulkCreate(plan.creates.slice(i, i + 100));
  for (const u of plan.updates) await db.ClientAppFeature.update(u.id, u.patch);
  return { status: 200, body: { ok: true, client_id: client.id, created: plan.creates.length, updated: plan.updates.length, unchanged: plan.unchanged, skipped_manual: plan.skippedManual, rejected: errors } };
}

// Admin call: client_id, else the client whose command / ops / site app is app_id, else the domain.
async function resolveClient(db: any, b: any) {
  if (s(b.client_id)) { const c = await db.CRMClient.get(s(b.client_id)).catch(() => null); if (c) return c; }
  const appId = s(b.app_id);
  if (appId) {
    for (const field of ["command_app_id", "ops_app_id", "site_app_id"]) {
      const hit = arr(await db.CRMClient.filter({ [field]: appId }, "-updated_date", 2).catch(() => []))[0];
      if (hit) return hit;
    }
    const other = findClientForApp(arr(await db.CRMClient.list("business", 500).catch(() => [])), appId);
    if (other) return other;
  }
  const dom = bareDomain(s(b.domain));
  if (dom) {
    const hit = arr(await db.CRMClient.filter({ domain: dom }, "-updated_date", 2).catch(() => []))[0];
    if (hit) return hit;
    const all = arr(await db.CRMClient.list("business", 500).catch(() => []));
    return all.find((c: any) => [c.domain, ...arr(c.websites)].some((w: any) => bareDomain(s(w)) === dom)) || null;
  }
  return null;
}

async function ingest(db: any, b: any, auth: { machine: boolean; via: string }) {
  const appId = s(b.app_id);
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(appId)) return { status: 400, body: { error: "app_id is required" } };
  const facts = Array.isArray(b.facts) ? b.facts.slice(0, 1000) : [];
  const errors: any[] = [];
  const valid = facts.filter((f: any, i: number) => { const e = factError(f); if (e) errors.push({ index: i, source_fact_id: s(f?.source_fact_id), error: e }); return !e; });
  let client: any = null;
  if (auth.machine) {
    const r = await resolveForApp(db, b);
    if (r.error) {
      await logRejected(db, appId, s(b.client_id) || s(b.brand_id) || r.client?.id || r.brand?.id || "", r.error, auth.via, r.kind === "brand" ? "Brand" : "CRMClient");
      return { status: 403, body: { error: r.kind === "brand" ? "This app is not the template or brand app registered for that brand" : "This app is not the command system registered for that client" } };
    }
    if (r.kind === "brand") return ingestBrand(db, b, r.brand, valid, errors, auth);
    client = r.client;
  } else {
    // Admin: brand_id / target "brand" picks a brand; otherwise a client; an app that only a brand owns is that brand.
    const brands = await loadBrands(db);
    const named = s(b.brand_id) ? brands.find((x: any) => x.id === s(b.brand_id)) || null : null;
    if (s(b.brand_id) || s(b.target) === "brand") {
      const brand = named || brandForApp(brands, appId);
      if (!brand) return { status: 404, body: { error: "No brand matches (send brand_id, or set Brand.template_app_id to the app id)" } };
      return ingestBrand(db, b, brand, valid, errors, auth);
    }
    client = await resolveClient(db, b);
    if (!client) { const brand = brandForApp(brands, appId); if (brand) return ingestBrand(db, b, brand, valid, errors, auth); }
  }
  if (!client) return { status: 404, body: { error: "No Møthership client matches this app (set the client's command_app_id to the app id, or send client_id)" } };
  const now = new Date().toISOString();
  const mode = b.mode === "full" ? "full" : "delta";
  const appName = s(b.app_name).slice(0, 120);
  const ctx = { app_id: appId, app_name: appName, client_id: client.id, client_name: client.business, now };

  const existing = arr(await db.BrainFact.filter({ source_app_id: appId, source: SOURCE }, "-created_date", 2000));
  const plan = planUpsert(existing, valid, ctx, mode);
  for (let i = 0; i < plan.creates.length; i += 100) await db.BrainFact.bulkCreate(plan.creates.slice(i, i + 100));
  for (const u of plan.updates) await db.BrainFact.update(u.id, u.patch);

  // Active count after the write (stored rows with their patches applied, plus the new rows).
  const patched = new Map(plan.updates.map((u: any) => [u.id, u.patch]));
  const after = [...existing.map((r: any) => ({ ...r, ...(patched.get(r.id) || {}) })), ...plan.creates];
  const live = after.filter((r: any) => r.status === "active" && !r.data?.test);
  const lastAnswer = live.map((r: any) => s(r.answered_at)).sort().pop() || "";

  const dossier = arr(await db.ClientDossier.filter({ client_id: client.id }, "-updated_date", 1).catch(() => []))[0] || null;
  const prevApp = dossier?.client_brain?.apps?.[appId] || null;
  const stats = b.stats && typeof b.stats === "object" ? b.stats : prevApp || {};
  const clientBrain = mergeClientBrain(dossier?.client_brain, appId, appName, stats, { facts_active: live.length, last_answer_at: lastAnswer, synced_at: now });
  const brain = brainComponent({ client_brain: clientBrain });
  const health = dossier ? blendHealth(dossier.pillar_scores, brain) : null;
  const patch: any = { client_brain: clientBrain, ...(health != null ? { health_score: health } : {}) };
  if (dossier) await db.ClientDossier.update(dossier.id, patch);
  else await db.ClientDossier.create({ client_id: client.id, client_name: client.business, ...patch });

  // Agents read the stored context block: rebuild it now so the new answers are used on the next draft.
  let context = "skipped";
  try {
    const bb = arr(await db.BusinessBrain.filter({ client_id: client.id }, "-updated_date", 1))[0];
    if (bb && (plan.creates.length || plan.updates.length)) { await db.BusinessBrain.update(bb.id, { context_md: await buildClientContext(db, client.id), context_at: now }); context = "refreshed"; }
    else context = bb ? "unchanged" : "no client brain yet";
  } catch (e) { context = `failed: ${(e as Error).message}`.slice(0, 200); }

  return {
    status: 200,
    body: {
      ok: true, client_id: client.id, client_name: client.business, app_id: appId, mode, auth: auth.via,
      created: plan.creates.length, updated: plan.updates.length, unchanged: plan.unchanged, superseded: plan.superseded,
      rejected: errors, facts_active: live.length,
      brain: brain ? { answered: brain.answered, total: brain.total, score: brain.score } : null,
      health_before: dossier?.health_score ?? null, health_after: health ?? dossier?.health_score ?? null, context,
    },
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const b = await req.json().catch(() => ({}));
    const action = s(b?.action) || "ingest";
    const db = base44.asServiceRole.entities;
    // One shared key for every client command system; the old ingest key still works until the new one is set.
    const sent = req.headers.get("x-mothership-key") || "";
    const syncKey = Deno.env.get("COMMAND_SYSTEM_SYNC_KEY") || "";
    const legacyKey = Deno.env.get("MOTHERSHIP_INGEST_KEY") || "";
    const via = sent && syncKey && sent === syncKey ? "command_system_key" : sent && legacyKey && sent === legacyKey ? "ingest_key_fallback" : "";
    const keyOk = !!via;
    const user = keyOk ? null : await base44.auth.me().catch(() => null);
    const isAdmin = user?.role === "admin";

    if (action === "ingest") {
      if (!keyOk && !isAdmin) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const r = await ingest(db, b, { machine: keyOk, via: via || "admin" });
      return Response.json(r.body, { status: r.status });
    }
    if (action === "features") {
      if (!keyOk && !isAdmin) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const r = await ingestFeatures(db, b, { machine: keyOk, via: via || "admin" });
      return Response.json(r.body, { status: r.status });
    }
    if (!isAdmin) return Response.json({ error: user ? "Forbidden" : "Unauthorized" }, { status: user ? 403 : 401 });
    if (action === "get") {
      if (!s(b.client_id)) return Response.json({ error: "client_id is required" }, { status: 400 });
      return Response.json(await getClientBrain(db, s(b.client_id), { limit: 300 }));
    }
    if (action === "status") {
      const ds = arr(await db.ClientDossier.list("-updated_date", 300));
      return Response.json({ clients: ds.filter((d: any) => d.client_brain?.total).map((d: any) => ({ client_id: d.client_id, client_name: d.client_name, health_score: d.health_score, ...d.client_brain })) });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("client-brain", (e as Error)?.message);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
