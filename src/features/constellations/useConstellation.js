import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { scoreAll } from "./pillars";

const byClient = (entity, clientId, sort = "-created_date", limit = 500) => ({
  queryKey: [entity, "client", clientId, sort],
  queryFn: async () => (await base44.entities[entity].filter({ client_id: clientId }, sort, limit)) || [],
  enabled: !!clientId,
});

// Everything Constellations needs for one client, plus the computed scores.
export function useConstellation(client) {
  const qc = useQueryClient();
  const id = client?.id;
  const dossierQ = useQuery({
    queryKey: ["ClientDossier", "client", id],
    queryFn: async () => ((await base44.entities.ClientDossier.filter({ client_id: id }, "-updated_date", 1)) || [])[0] || null,
    enabled: !!id,
  });
  const gaps = useQuery(byClient("ClientGap", id));
  const work = useQuery(byClient("WorkLog", id, "-date"));
  const files = useQuery(byClient("ClientFile", id));
  const goals = useQuery(byClient("ClientGoal", id));
  const autos = useQuery(byClient("Automation", id));
  const forms = useQuery(byClient("RequestForm", id));
  const review = useQuery({
    queryKey: ["ReviewClient", "crm", id],
    queryFn: async () => ((await base44.entities.ReviewClient.filter({ crm_client_id: id }, "-updated_date", 1)) || [])[0] || null,
    enabled: !!id,
  });

  const d = dossierQ.data || { client_id: id };
  const ctx = useMemo(() => {
    const cache = review.data?.cache;
    return {
      client: client || {},
      d,
      gaps: gaps.data || [],
      work: work.data || [],
      files: files.data || [],
      goals: (goals.data || []).filter((g) => !g.year || g.year >= 2027),
      autos: autos.data || [],
      forms: forms.data || [],
      reviews: cache ? { rating: cache.rating ?? null, count: cache.total ?? 0 } : null,
    };
  }, [client, d, gaps.data, work.data, files.data, goals.data, autos.data, forms.data, review.data]);

  const result = useMemo(() => scoreAll(ctx), [ctx]);
  const loading = dossierQ.isLoading || gaps.isLoading || work.isLoading;

  // Create-or-update the one dossier for this client.
  const save = async (patch) => {
    const cur = dossierQ.data;
    const rec = cur
      ? await base44.entities.ClientDossier.update(cur.id, patch)
      : await base44.entities.ClientDossier.create({ client_id: id, client_name: client.business, ...patch });
    qc.invalidateQueries({ queryKey: ["ClientDossier"] });
    return rec;
  };

  const setItem = async (pillarId, itemId, status, note) => {
    const pillars = structuredClone(d.pillars || {});
    pillars[pillarId] = pillars[pillarId] || { items: {} };
    pillars[pillarId].items = pillars[pillarId].items || {};
    if (status === null) delete pillars[pillarId].items[itemId];
    else pillars[pillarId].items[itemId] = { ...(pillars[pillarId].items[itemId] || {}), status, ...(note !== undefined ? { note } : {}), by: "justin", updated_at: new Date().toISOString() };
    await save({ pillars });
  };

  // Store the score so lists, the dashboard and the portal can show it without recomputing.
  const persistScore = async () => {
    const pillar_scores = Object.fromEntries(Object.entries(result.by).map(([k, v]) => [k, v.score]));
    if (d.health_score === result.health && JSON.stringify(d.pillar_scores || {}) === JSON.stringify(pillar_scores)) return;
    await save({ health_score: result.health, pillar_scores, scored_at: new Date().toISOString() });
  };

  return { ctx, d, dossier: dossierQ.data, ...result, loading, save, setItem, persistScore };
}
