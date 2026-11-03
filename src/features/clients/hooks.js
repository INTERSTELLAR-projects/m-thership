import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { loadContextsLite } from "./clientContext";
import { completenessPct } from "./criteria";

// { clientId: completeness % } for a list of clients (one list call per entity, not per client).
export function useCompletenessMap(clients) {
  const ids = (clients || []).map((c) => c.id).sort();
  return useQuery({
    queryKey: ["profileCompleteness", ids.join(",")],
    queryFn: async () => {
      const map = await loadContextsLite(clients);
      return Object.fromEntries([...map].map(([id, ctx]) => [id, completenessPct(ctx)]));
    },
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
}

export function CompletenessBadge({ pct }) {
  if (pct == null) return null;
  const tone = pct >= 80 ? "border-green-600/25 bg-green-600/[0.07] text-green-800" : pct >= 50 ? "border-[#ff6a00]/30 bg-[#ff6a00]/[0.08] text-[#c24100]" : "border-[#ff3c00]/30 bg-[#ff3c00]/[0.07] text-[#c23000]";
  return <span title="Client profile completeness (Client Criteria)" className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${tone}`}>{pct}% profile</span>;
}

// Records of one entity that belong to one client, plus create/update/remove that refresh the list.
export function useClientRecords(entity, clientId, { sort = "-created_date", limit = 500, clientField = "client_id" } = {}) {
  const qc = useQueryClient();
  const key = [entity, "client", clientId, sort];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => (await base44.entities[entity].filter({ [clientField]: clientId }, sort, limit)) || [],
    enabled: !!clientId,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: [entity] });
  return {
    ...q,
    rows: q.data || [],
    create: async (data) => { const r = await base44.entities[entity].create({ [clientField]: clientId, ...data }); refresh(); return r; },
    update: async (id, data) => { const r = await base44.entities[entity].update(id, data); refresh(); return r; },
    remove: async (id) => { await base44.entities[entity].delete(id); refresh(); },
    refresh,
  };
}
