// Client-app Business Brain → Møthership (docs/client-brain-sync.md).
//   ingest { app_id, app_name?, client_id? | domain?, mode?: "delta"|"full", stats?: { total, answered, open, skipped },
//            facts: [{ source_fact_id, question_key?, question_id?, area?, question?, answer, source?, captured_by_name?,
//                      status?: active|superseded, answered_at?, test? }] }
//          Header x-mothership-key = MOTHERSHIP_INGEST_KEY (client apps, same key as log-activity / work-ledger log), or
//          an admin. Upserts the facts as client-tagged BrainFacts (source "client_app"; idempotent by app_id +
//          source_fact_id; one active answer per app_id + question key, older ones kept as superseded; "full" also
//          supersedes stored facts the app no longer has. Soft only: nothing is deleted). Records the app's counts on
//          ClientDossier.client_brain, re-blends the stored health score from the stored pillar scores (pillars.js
//          blendHealth) and refreshes the client's shared context block so agents use the answers right away.
//   get    { client_id }   admin. What Møthership holds for that client (getClientBrain).
//   status {}              admin. Every client with a reporting app: counts and last sync.
// Records only: never sends, publishes or changes anything in the client's app.
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { getSecret } from "../../shared/portalClient.ts";
import { planUpsert, factError, mergeClientBrain, getClientBrain, SOURCE } from "../../shared/clientBrain.js";
import { brainComponent, blendHealth } from "../../shared/constellations.js";
import { buildClientContext } from "../../shared/clientContext.ts";

const arr = (v: any) => (Array.isArray(v) ? v : (v && v.items) || []);
const s = (v: unknown) => (v == null ? "" : String(v).trim());
const bareDomain = (x = "") => x.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();

async function resolveClient(db: any, b: any) {
  if (s(b.client_id)) { const c = await db.CRMClient.get(s(b.client_id)).catch(() => null); if (c) return c; }
  const appId = s(b.app_id);
  if (appId) {
    for (const field of ["ops_app_id", "site_app_id"]) {
      const hit = arr(await db.CRMClient.filter({ [field]: appId }, "-updated_date", 2).catch(() => []))[0];
      if (hit) return hit;
    }
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

async function ingest(db: any, b: any) {
  const appId = s(b.app_id);
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(appId)) return { status: 400, body: { error: "app_id is required" } };
  const facts = Array.isArray(b.facts) ? b.facts.slice(0, 1000) : [];
  const errors: any[] = [];
  const valid = facts.filter((f: any, i: number) => { const e = factError(f); if (e) errors.push({ index: i, source_fact_id: s(f?.source_fact_id), error: e }); return !e; });
  const client = await resolveClient(db, b);
  if (!client) return { status: 404, body: { error: "No Møthership client matches this app (set the client's ops_app_id or site_app_id to the app id, or send client_id / domain)" } };
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
      ok: true, client_id: client.id, client_name: client.business, app_id: appId, mode,
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
    const key = getSecret("MOTHERSHIP_INGEST_KEY");
    const keyOk = !!key && req.headers.get("x-mothership-key") === key;
    const user = keyOk ? null : await base44.auth.me().catch(() => null);
    const isAdmin = user?.role === "admin";

    if (action === "ingest") {
      if (!keyOk && !isAdmin) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const r = await ingest(db, b);
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
