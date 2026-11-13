// Data for Constellation v2. Two queries: the ship's structure (agents, clients, brains: every 5 min) and the
// live activity that drives the orbs (runs, work, jobs, research, approvals: every 30 s). All entities are admin-only.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const arr = (v) => (Array.isArray(v) ? v : (v && v.items) || []);
const safe = (p) => Promise.resolve(p).then(arr).catch(() => []);

export const SHIP_KEY = ["ship-structure"];
export const SHIP_LIVE_KEY = ["ship-live"];

async function loadStructure() {
  const E = base44.entities;
  const [registry, clients, brains, dossiers, facts, briefs, intel, findings, opps, ideas, learnings] = await Promise.all([
    safe(E.AgentRegistry.list("sort", 1500)),
    safe(E.CRMClient.filter({ status: "Active" }, "business", 200)),
    safe(E.BusinessBrain.list("-updated_date", 300)),
    safe(E.ClientDossier.list("-updated_date", 300)),
    safe(E.BrainFact.filter({ status: "active" }, "-created_date", 500)),
    safe(E.DailyBrief.list("-generated_at", 1)),
    safe(E.SeoIntel.list("-created_date", 120)),
    safe(E.OracleFinding.filter({ status: "active" }, "-created_date", 120)),
    safe(E.OracleOpportunity.list("-created_date", 60)),
    safe(E.Idea.list("-created_date", 120)),
    safe(E.AgentLearning.list("-created_date", 200)),
  ]);
  // Client dossiers carry a lot of text; keep only what the ship reads.
  const slim = dossiers.map((x) => ({ id: x.id, client_id: x.client_id, health_score: x.health_score }));
  return { registry, clients, brains, dossiers: slim, facts, brief: briefs[0] || null, intel, findings, opps, ideas, learnings };
}

async function loadLive() {
  const E = base44.entities;
  const from = new Date(Date.now() - 2 * 864e5).toISOString();
  const [runs, work, jobs, research, actions, usage] = await Promise.all([
    safe(E.AutomationRun.filter({ started_at: { $gte: from } }, "-started_at", 500)),
    safe(E.WorkEntry.list("-created_date", 250)),
    safe(E.ClaudeJob.list("-updated_date", 150)),
    safe(E.ResearchNote.list("-created_date", 200)),
    safe(E.ProposedAction.filter({ status: "pending" }, "-created_date", 100)),
    safe(E.UsageLedger.filter({ created_at: { $gte: from } }, "-created_at", 500)),
  ]);
  return { runs, work, jobs, research, actions, usage, at: Date.now() };
}

export function useShipData() {
  const s = useQuery({ queryKey: SHIP_KEY, queryFn: loadStructure, staleTime: 60_000, refetchInterval: 300_000 });
  const l = useQuery({ queryKey: SHIP_LIVE_KEY, queryFn: loadLive, staleTime: 10_000, refetchInterval: 30_000, refetchIntervalInBackground: false });
  const data = s.data && l.data ? { ...s.data, ...l.data } : null;
  return { data, isLoading: s.isLoading || l.isLoading, error: s.error || l.error, liveAt: l.data?.at || null, refetch: () => { s.refetch(); l.refetch(); } };
}

export function useRefreshShip() {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: SHIP_KEY }); qc.invalidateQueries({ queryKey: SHIP_LIVE_KEY }); };
}
