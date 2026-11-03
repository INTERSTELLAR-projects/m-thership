// Map pack plan: footprint, service areas, GBP categories, keywords and rank-tracking grids for a
// client's Google map pack. One MapPackPlan per client. Drafts come from the enrich run, from a
// map_pack_plan ClaudeJob ("Draft with Claude") or from edits on the Map pack tab; Justin approves.
// Never invents: the brief carries the client context and tells Claude to cite every fact.
import { base44 } from "@/api/base44Client";
import { loadClientContext, contextToBrief } from "@/features/clients/clientContext";
import { STANDING_RULES } from "./jobs";

export const MAP_PACK_CONTEXT = "map_pack_plan";

export const FOOTPRINTS = [
  { key: "local", label: "Local", help: "One town or a storefront radius. The map pack is the main search channel: one tight grid (3-5 mi) on the GBP address." },
  { key: "regional", label: "Regional", help: "Several cities or counties served from one base (service-area business). One wider grid (10-20 mi) on the base, plus small grids on the biggest cities." },
  { key: "national", label: "National", help: "Customers anywhere in the country. The map pack only matters around the real office: one small grid there. National reach comes from organic and AI search, not the map pack." },
  { key: "global", label: "Global", help: "Several countries. Same as national: a map pack grid only on each real office with a verified GBP." },
];
export const footprintOf = (k) => FOOTPRINTS.find((f) => f.key === k) || FOOTPRINTS[0];

export const AREA_TYPES = ["city", "county", "state", "country"];
export const PRIORITIES = ["high", "medium", "low"];
export const INTENTS = ["local", "near_me", "service", "brand"];

/* ---------------- grid geometry ---------------- */

// n x n points spread evenly across a square of side 2r miles centred on (lat, lng).
export function gridPoints(center, radiusMiles, size) {
  const lat = Number(center && center.lat);
  const lng = Number(center && center.lng);
  const r = Number(radiusMiles) || 0;
  const n = Math.max(1, Math.min(21, Math.round(Number(size) || 0)));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !r) return [];
  const step = n > 1 ? (2 * r) / (n - 1) : 0;
  const dLat = 1 / 69;
  const dLng = 1 / (69 * Math.cos((lat * Math.PI) / 180));
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const y = n > 1 ? r - i * step : 0;
      const x = n > 1 ? -r + j * step : 0;
      pts.push({ lat: lat + y * dLat, lng: lng + x * dLng, row: i, col: j });
    }
  }
  return pts;
}
export const gridSpacing = (radiusMiles, size) => (Number(size) > 1 ? (2 * Number(radiusMiles)) / (Number(size) - 1) : 0);

/* ---------------- normalize ---------------- */

const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const num = (v) => (v === "" || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));

export function normalizeMapPack(raw) {
  const p = (raw && (raw.map_pack_plan || raw.map_pack || raw)) || {};
  if (!p || typeof p !== "object") return null;
  const fp = FOOTPRINTS.some((f) => f.key === p.footprint) ? p.footprint : "local";
  const loc = p.primary_location || {};
  const cats = p.gbp_categories || {};
  return {
    footprint: fp,
    primary_location: { address: str(loc.address), lat: num(loc.lat), lng: num(loc.lng) },
    service_areas: (Array.isArray(p.service_areas) ? p.service_areas : []).map((a) => (typeof a === "string" ? { name: a } : a || {}))
      .map((a) => ({ name: str(a.name), type: AREA_TYPES.includes(a.type) ? a.type : "city", priority: str(a.priority), source: str(a.source || a.source_url) }))
      .filter((a) => a.name),
    gbp_categories: {
      primary: str(cats.primary),
      secondary: (Array.isArray(cats.secondary) ? cats.secondary : []).map(str).filter(Boolean),
      note: str(cats.note || cats.status),
    },
    keywords: (Array.isArray(p.keywords) ? p.keywords : []).map((k) => (typeof k === "string" ? { term: k } : k || {}))
      .map((k) => ({ term: str(k.term), priority: PRIORITIES.includes(k.priority) ? k.priority : "medium", intent: INTENTS.includes(k.intent) ? k.intent : "local" }))
      .filter((k) => k.term),
    rank_grids: (Array.isArray(p.rank_grids) ? p.rank_grids : []).map((g) => ({
      label: str(g.label) || "Grid",
      center: { lat: num(g.center && g.center.lat), lng: num(g.center && g.center.lng) },
      radius_miles: num(g.radius_miles) || 5,
      grid_size: num(g.grid_size) || 7,
    })),
    notes: str(p.notes),
    sources: (Array.isArray(p.sources) ? p.sources : []).map((s) => (typeof s === "string" ? { label: s, url: s } : s || {})).filter((s) => s.url || s.label),
  };
}

/* ---------------- brief + job ---------------- */

const SHAPE = `{
  "map_pack_plan": {
    "footprint": "local | regional | national | global",
    "primary_location": { "address": "exactly as on the GBP", "lat": 0, "lng": 0 },
    "service_areas": [{ "name": "Bluffton, SC", "type": "city | county | state | country", "priority": "core | growth | later", "source": "URL you read it on" }],
    "gbp_categories": { "primary": "", "secondary": [""], "note": "what to check in the GBP dashboard" },
    "keywords": [{ "term": "", "priority": "high | medium | low", "intent": "local | near_me | service | brand" }],
    "rank_grids": [{ "label": "Main grid", "center": { "lat": 0, "lng": 0 }, "radius_miles": 5, "grid_size": 7 }],
    "notes": "",
    "sources": [{ "label": "", "url": "" }]
  }
}`;

export function mapPackBrief(client, ctx, current, extra = "") {
  const site = client.domain || (client.websites || [])[0] || "no site on file";
  return `# Map pack plan: ${client.business}

Draft the Google map pack plan for this client: footprint, primary location, service areas, GBP categories, map pack keywords and rank-tracking grids.

${ctx ? contextToBrief(ctx, { sections: ["profile", "services", "goals"] }) : ""}
${current ? `\n## Current plan on file (${current.status || "draft"})\n\`\`\`json\n${JSON.stringify(normalizeMapPack(current), null, 2)}\n\`\`\`\nImprove it; keep anything still correct and its source.\n` : ""}
${extra ? `\n## Justin added\n${extra}\n` : ""}
## How to decide
- Footprint: local (one town / storefront radius), regional (several cities or counties from one base), national (customers nationwide; the map pack only matters around the real office), global (several countries).
- primary_location is the address on the Google Business Profile. The GBP is the source of truth for NAP (name, address, phone). Geocode it (US Census geocoder is fine) and cite it.
- Rank grid: local 3-5 mi 7x7 on the GBP address; regional 10-20 mi 9x9 on the base plus optional small grids on the biggest cities; national/global one small grid on each real office only.
- GBP categories: recommend from Google's category list; say what to check in the dashboard (current categories are not public).
- Keywords: 8-12 map pack terms (service + city, and "near me"); mark the 3-5 most valuable as high.

## What to produce
1. result_data = the JSON below, every field filled from sources you actually read:
\`\`\`json
${SHAPE}
\`\`\`
2. result_body = the plan as short markdown (footprint and why, grid, categories, keywords table, service areas with sources).
3. result_summary = one or two sentences.
4. needs_from_justin = anything you could not confirm (current GBP categories, service areas set on the GBP).
You may read their site (${site}) and public listings. Cite every source.

## Rules for this job
- Do NOT create or update MapPackPlan, CRMClient or OrbitSEOClient. Approving the job in Møthership saves the plan to the client's Map pack tab.
- Never invent rankings, rank positions, search volumes or review numbers. No Google rating numbers anywhere.

## Rules
${STANDING_RULES.map((r) => `- ${r}`).join("\n")}

## When you finish
Write back to this ClaudeJob: result_data, result_body, result_summary, result_links, needs_from_justin, status = needs_approval, finished_at = now.`;
}

export async function queueMapPackPlan(client, current, extra = "") {
  const ctx = await loadClientContext(client).catch(() => null);
  return base44.entities.ClaudeJob.create({
    title: `Map pack plan — ${client.business}`,
    kind: "map_pack_plan",
    instructions: mapPackBrief(client, ctx, current, extra),
    extra,
    client_id: client.id,
    client_name: client.business,
    status: "queued",
    priority: 2,
    complete_task_on_approve: false,
    requested_at: new Date().toISOString(),
    context: { [MAP_PACK_CONTEXT]: true, revision_of: current ? current.id : "" },
  });
}

export const isMapPackJob = (job) => !!(job && job.kind === "map_pack_plan");
export const mapPackFromJob = (job) => normalizeMapPack(job && job.result_data);

// Called from approveJob: the approved draft becomes the client's plan (status approved).
export async function saveApprovedMapPack(job) {
  const plan = mapPackFromJob(job);
  if (!plan) throw new Error("This job has no map pack plan in result_data.");
  const now = new Date().toISOString();
  const rows = (await base44.entities.MapPackPlan.filter({ client_id: job.client_id }, "-updated_date", 1).catch(() => [])) || [];
  const data = { ...plan, client_id: job.client_id, client_name: job.client_name || "", status: "approved", approved_at: now, updated_at: now, source_job_id: job.id };
  if (rows[0]) await base44.entities.MapPackPlan.update(rows[0].id, data);
  else await base44.entities.MapPackPlan.create(data);
}
