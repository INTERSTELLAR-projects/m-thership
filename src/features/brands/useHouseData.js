// Data for the House of Brands (/brands, /brands/:slug, the header brand switcher). All entities are admin-only.
// Nothing here reads a brand's or a client's own app: only what those apps pushed to Møthership (client-brain ingest).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const arr = (v) => (Array.isArray(v) ? v : (v && v.items) || []);
const safe = (p) => Promise.resolve(p).then(arr).catch(() => []);

export const HOUSE_KEY = ["house-of-brands"];
export const BRANDS_KEY = ["Brand", "house"];

async function loadBrands() {
  return safe(base44.entities.Brand.list("sort_order", 200));
}

async function loadHouse() {
  const E = base44.entities;
  const [brands, clients, dossiers, brandFacts, facts, brains, features, clientFeatures, profiles, appFacts] = await Promise.all([
    loadBrands(),
    safe(E.CRMClient.list("business", 500)),
    safe(E.ClientDossier.list("-updated_date", 300)),
    safe(E.BrandBrainFact.filter({ status: "active" }, "-answered_at", 500)),
    safe(E.BrainFact.filter({ status: "active" }, "-created_date", 500)),
    safe(E.BusinessBrain.list("-updated_date", 300)),
    safe(E.AppFeature.list("sort_order", 1000)),
    safe(E.ClientAppFeature.list("-updated_date", 2000)),
    safe(E.ClientAppProfile.list("client_name", 300)),
    // Any status: brain_connected means facts have arrived from the app at least once.
    safe(E.BrainFact.filter({ source: "client_app" }, "-created_date", 1000)),
  ]);
  // Keep only what the house reads (dossiers and brains carry long text).
  const slimDossiers = dossiers.map((x) => ({ id: x.id, client_id: x.client_id, health_score: x.health_score, client_brain: x.client_brain || null }));
  const slimBrains = brains.map((b) => ({ id: b.id, scope: b.scope, client_id: b.client_id, completeness: b.completeness }));
  const slimFacts = facts.map((f) => ({ id: f.id, status: f.status, source: f.source, client_id: f.client_id, source_app_id: f.source_app_id }));
  const slimAppFacts = appFacts.map((f) => ({ id: f.id, status: f.status, source: f.source, client_id: f.client_id, source_app_id: f.source_app_id }));
  const slimProfiles = profiles.map((p) => ({ id: p.id, client_id: p.client_id, app_id: p.app_id, kind: p.kind, has_brain: p.has_brain, has_sync: p.has_sync }));
  return { brands, clients, dossiers: slimDossiers, brandFacts, facts: slimFacts, appFacts: slimAppFacts, profiles: slimProfiles, brains: slimBrains, features, clientFeatures, at: Date.now() };
}

export function useHouseData() {
  return useQuery({ queryKey: HOUSE_KEY, queryFn: loadHouse, staleTime: 30_000, refetchInterval: 120_000, refetchIntervalInBackground: false });
}

// Just the brands (header switcher, client form brand selector).
export function useBrands() {
  return useQuery({ queryKey: BRANDS_KEY, queryFn: loadBrands, staleTime: 60_000 });
}

export function useRefreshHouse() {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: HOUSE_KEY }); qc.invalidateQueries({ queryKey: ["Brand"] }); };
}
