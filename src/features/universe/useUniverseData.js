// Universe data: the house of brands, every agent, live work and each client's foundation checks. Admin-only entities.
// In Presentation mode the entity layer is the in-memory sample dataset (src/lib/qa.js), so nothing real loads here.
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { loadContextsLite } from "@/features/clients/clientContext";
import { evaluateCriteria } from "@/features/clients/criteria";

const arr = (v) => (Array.isArray(v) ? v : (v && v.items) || []);
const safe = (p) => Promise.resolve(p).then(arr).catch(() => []);

export const UNIVERSE_KEY = ["universe"];

async function load() {
  const E = base44.entities;
  const from = new Date(Date.now() - 2 * 864e5).toISOString();
  const [brands, clients, dossiers, brandFacts, brains, profiles, registry, jobs, runs, work, snapshots] = await Promise.all([
    safe(E.Brand.list("sort_order", 100)),
    safe(E.CRMClient.filter({ status: "Active" }, "business", 1000)),
    safe(E.ClientDossier.list("-updated_date", 1000)),
    safe(E.BrandBrainFact.filter({ status: "active" }, "-answered_at", 500)),
    safe(E.BusinessBrain.list("-updated_date", 1000)),
    safe(E.ClientAppProfile.list("client_name", 1000)),
    safe(E.AgentRegistry.list("sort", 3000)),
    safe(E.ClaudeJob.list("-updated_date", 200)),
    safe(E.AutomationRun.filter({ started_at: { $gte: from } }, "-started_at", 1000)),
    safe(E.WorkLog.list("-date", 2000)),
    safe(E.PerformanceSnapshot.list("-period_end", 2000)),
  ]);
  let evals = new Map();
  try {
    const ctx = await loadContextsLite(clients);
    ctx.forEach((c, id) => { try { evals.set(id, evaluateCriteria(c)); } catch { /* skip one client */ } });
  } catch { evals = new Map(); }
  // Keep only what the view reads.
  const slimD = dossiers.map((x) => ({ id: x.id, client_id: x.client_id, health_score: x.health_score, client_brain: x.client_brain || null }));
  const slimS = snapshots.map((x) => ({ client_id: x.client_id, source: x.source, period_end: x.period_end }));
  const slimB = brains.map((b) => ({ id: b.id, scope: b.scope, client_id: b.client_id, completeness: b.completeness }));
  return { brands, clients, dossiers: slimD, brandFacts, brains: slimB, profiles, registry, jobs, runs, work, snapshots: slimS, evals, at: Date.now() };
}

export function useUniverseData() {
  return useQuery({ queryKey: UNIVERSE_KEY, queryFn: load, staleTime: 30_000, refetchInterval: 60_000, refetchIntervalInBackground: false });
}
