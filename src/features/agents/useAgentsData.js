// Data for the Agent Constellation: one query per entity, all admin-only by RLS.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const arr = (v) => (Array.isArray(v) ? v : (v && v.items) || []);
const safe = (p) => Promise.resolve(p).then(arr).catch(() => []);

export const AGENTS_KEY = ["agents-constellation"];

async function loadAll() {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const E = base44.entities;
  const [registry, learnings, notes, briefs, brains, clients, runs, prefs] = await Promise.all([
    safe(E.AgentRegistry.list("sort", 1500)),
    safe(E.AgentLearning.list("-created_date", 300)),
    safe(E.ResearchNote.list("-created_date", 300)),
    safe(E.CeoBrief.list("-generated_at", 40)),
    safe(E.BusinessBrain.list("-updated_date", 300)),
    safe(E.CRMClient.filter({ status: "Active" }, "business", 200)),
    safe(E.AutomationRun.filter({ started_at: { $gte: since } }, "-started_at", 600)),
    safe(E.AppSettings.filter({ key: "agents_prefs" }, "-updated_date", 1)),
  ]);
  return { registry, learnings, notes, briefs, brains, clients, runs, prefs: prefs[0] || null };
}

export function useAgentsData() {
  return useQuery({ queryKey: AGENTS_KEY, queryFn: loadAll, staleTime: 30_000, refetchInterval: 120_000 });
}

export function useRefreshAgents() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: AGENTS_KEY });
}

// Backend calls (admin path of the agents function).
export async function agentsCall(action, args = {}) {
  try {
    const res = await base44.functions.invoke("agents", { action, ...args });
    const d = res?.data || {};
    if (d.error) throw new Error(d.error);
    return d;
  } catch (e) {
    throw new Error(e?.response?.data?.error || e?.message || "Request failed");
  }
}

export async function savePrefs(row, patch) {
  const pageSettings = { ...((row && row.pageSettings) || {}), ...patch };
  if (row?.id) return base44.entities.AppSettings.update(row.id, { pageSettings });
  return base44.entities.AppSettings.create({ key: "agents_prefs", pageSettings });
}
