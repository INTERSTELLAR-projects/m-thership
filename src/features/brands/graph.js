// House of Brands: pure functions only (tests/unit/brandsGraph.test.js).
//
//   Interstellar Strategies (root brand, any industry)  <-  niche brands (DIALD first)  <-  each brand's clients
//   Interstellar direct clients (CRMClient.brand_id empty or the root id) hang straight off the root.
//
// Brains flow UP: client app Business Brain -> brand brain -> Møthership. Template improvements flow DOWN.
// Every number here comes from real records (Brand, CRMClient, ClientDossier.client_brain, BrandBrainFact, BrainFact,
// BusinessBrain, AppFeature, ClientAppFeature). No record -> null / 0 and the UI shows an honest empty state.
import { orbRate, orbGlow, appName } from "@/features/agents/ship/graph";

export const ROOT_ID = "root";
export const INTERSTELLAR_COLORS = { primary: "#ff3c00", accent: "#ffaa00", background: "#07080d" };
export const BRAIN_COLOR = "#b18cff";
export const TEMPLATE_COLOR = "#2ee6c5";
export const STATUS_LABEL = { active: "Active", building: "Building", planned: "Planned", paused: "Paused" };

const arr = (v) => (Array.isArray(v) ? v : []);
const s = (v) => (v == null ? "" : String(v).trim());
const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v, fallback) => (HEX.test(s(v)) ? s(v) : fallback);

export function slugify(name) {
  return s(name).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ø/g, "o").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

// Validate a new brand (Add brand dialog). Returns { field: message } (empty object = ok).
export function brandErrors(b, existing = []) {
  const e = {};
  const name = s(b && b.name);
  const slug = s(b && b.slug);
  if (!name) e.name = "Give the brand a name.";
  if (!slug) e.slug = "Pick a URL key.";
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) e.slug = "Lowercase letters, numbers and dashes only.";
  else if (arr(existing).some((x) => s(x.slug) === slug)) e.slug = "Another brand already uses this URL key.";
  else if (["new", "add"].includes(slug)) e.slug = "That URL key is reserved.";
  if (arr(existing).some((x) => s(x.name).toLowerCase() === name.toLowerCase() && name)) e.name = "A brand with this name already exists.";
  for (const k of ["primary", "accent", "background"]) {
    const v = s(b && b.colors && b.colors[k]);
    if (v && !HEX.test(v)) e[`colors.${k}`] = "Use a 6-digit hex color like #00bfff.";
  }
  const tpl = s(b && b.template_app_id);
  if (tpl && !/^[A-Za-z0-9_-]{6,64}$/.test(tpl)) e.template_app_id = "That doesn't look like an app id.";
  if (tpl && arr(existing).some((x) => s(x.template_app_id) === tpl)) e.template_app_id = "Another brand already uses this template app.";
  return e;
}

// The root (Interstellar): the brand with no parent, lowest sort_order first.
export function rootOf(brands) {
  const list = arr(brands).filter((b) => !s(b.parent_brand_id)).sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
  return list[0] || null;
}
export const childBrands = (brands, root) => arr(brands).filter((b) => b && (!root || b.id !== root.id)).sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || s(a.name).localeCompare(s(b.name)));

// Which brand a client belongs to: its brand_id when that brand exists (and is not the root), else Interstellar direct (null).
export function brandIdOfClient(client, brands, root) {
  const id = s(client && client.brand_id);
  if (!id || (root && id === root.id)) return null;
  return arr(brands).some((b) => b.id === id) ? id : null;
}

export function brandTheme(brand) {
  const c = (brand && brand.colors) || {};
  const isRoot = brand && !s(brand.parent_brand_id);
  const fb = isRoot || !brand ? INTERSTELLAR_COLORS : { primary: "#ff6a00", accent: "#ffaa00", background: "#07080d" };
  return { primary: hex(c.primary, fb.primary), accent: hex(c.accent, fb.accent), background: hex(c.background, fb.background) };
}
export const themeVars = (brand) => { const t = brandTheme(brand); return { "--bp": t.primary, "--ba": t.accent, "--bb": t.background }; };

// ---------------------------------------------------------------- brains
const pct = (a, t) => (t > 0 ? Math.round((100 * Math.min(a, t)) / t) : null);

// A client's own-app Business Brain counts (ClientDossier.client_brain, written by client-brain ingest).
export function clientBrainStats(dossier) {
  const st = dossier && dossier.client_brain;
  if (!st || !(Number(st.total) > 0 || Number(st.facts_active) > 0)) return null;
  const total = Number(st.total) || 0;
  const answered = Math.min(total, Number(st.answered) || 0);
  return { answered, total, score: pct(answered, total), factsActive: Number(st.facts_active) || 0, syncedAt: st.synced_at || null };
}

// A brand's own brain: counts reported by its template / brand app (Brand.brain_stats) + its active BrandBrainFacts.
export function brandOwnBrain(brand, brandFacts) {
  const facts = arr(brandFacts).filter((f) => f.brand_id === (brand && brand.id) && f.status !== "superseded" && !(f.data && f.data.test))
    .sort((a, b) => s(b.answered_at || b.created_date).localeCompare(s(a.answered_at || a.created_date)));
  const st = (brand && brand.brain_stats) || null;
  const total = Number(st && st.total) || 0;
  const answered = Math.min(total, Number(st && st.answered) || 0);
  const apps = Object.entries((st && st.apps) || {}).map(([id, a]) => ({ id, name: appName(a.app_name), answered: Number(a.answered) || 0, total: Number(a.total) || 0, syncedAt: a.synced_at || null }));
  return { answered, total, score: pct(answered, total), factsActive: facts.length, latest: facts.slice(0, 8), apps, syncedAt: (st && st.synced_at) || null, reporting: !!(total || facts.length) };
}

// Roll-up of a set of clients' brains: how many report, answered / total summed, average completeness.
export function rollupClients(clients, dossierBy) {
  const list = arr(clients);
  const rows = list.map((c) => ({ client: c, brain: clientBrainStats(dossierBy[c.id]) }));
  const reporting = rows.filter((r) => r.brain);
  const answered = reporting.reduce((t, r) => t + r.brain.answered, 0);
  const total = reporting.reduce((t, r) => t + r.brain.total, 0);
  const scored = reporting.filter((r) => r.brain.score != null);
  return {
    clients: list.length, reporting: reporting.length, answered, total, score: pct(answered, total),
    avgScore: scored.length ? Math.round(scored.reduce((t, r) => t + r.brain.score, 0) / scored.length) : null,
    factsActive: reporting.reduce((t, r) => t + r.brain.factsActive, 0), rows,
  };
}

// ---------------------------------------------------------------- the house
// data: { brands, clients, dossiers, brandFacts, facts, brains, features, clientFeatures }
export function buildHouse(data) {
  const d = data || {};
  const brands = arr(d.brands);
  const root = rootOf(brands);
  const kids = childBrands(brands, root);
  const dossierBy = Object.fromEntries(arr(d.dossiers).map((x) => [x.client_id, x]));
  const allClients = arr(d.clients);
  const active = allClients.filter((c) => (c.status || "Active") === "Active");
  const leads = allClients.filter((c) => c.status === "Lead");
  const groupOf = (c) => brandIdOfClient(c, brands, root) || ROOT_ID;
  const byGroup = {};
  active.forEach((c) => { (byGroup[groupOf(c)] ||= []).push(c); });
  const leadsBy = {};
  leads.forEach((c) => { (leadsBy[groupOf(c)] ||= []).push(c); });
  const featuresBy = {};
  arr(d.features).forEach((f) => { (featuresBy[f.brand_id] ||= []).push(f); });
  const cfBy = {};
  arr(d.clientFeatures).forEach((f) => { (cfBy[f.client_id] ||= []).push(f); });

  const nodes = {};
  const edges = [];
  const stream = (count, opts) => ({ count: Math.max(0, Number(count) || 0), rate: orbRate(count, opts), glow: orbGlow(count) });
  const link = (child, parent, kind, upCount, downCount, color) =>
    edges.push({ id: `${child}>${parent}`, child, parent, kind, up: stream(upCount, { base: 0.16 }), down: stream(downCount, { base: 0.05, k: 0.18, max: 0.9 }), color });

  const clientNode = (c, parentId, color) => {
    const brain = clientBrainStats(dossierBy[c.id]);
    const enabled = arr(cfBy[c.id]).filter((f) => f.state !== "removed" && f.state !== "requested").length;
    const n = { id: `client:${c.id}`, type: "client", clientId: c.id, parent: parentId, label: c.business || "Client", sub: c.industry || c.domain || "", color: hex(c.accent, color), logo: c.logo_url || null, brain, hasApp: !!(c.command_app_id || c.ops_app_id), metrics: { features: enabled } };
    nodes[n.id] = n;
    link(n.id, parentId, "client", brain ? brain.factsActive || brain.answered : 0, enabled, color);
    return n;
  };

  // Root.
  const rootTheme = brandTheme(root);
  const ownFacts = arr(d.facts).filter((f) => f.status !== "superseded" && f.source !== "client_app").length;
  const hqBrain = arr(d.brains).find((b) => b.scope === "interstellar") || null;
  const direct = byGroup[ROOT_ID] || [];
  const directRoll = rollupClients(direct, dossierBy);
  const allRoll = rollupClients(active, dossierBy);
  nodes[ROOT_ID] = {
    id: ROOT_ID, type: "root", brand: root, label: (root && root.name) || "Interstellar Strategies", sub: (root && root.niche) || "Any industry", color: rootTheme.primary, theme: rootTheme,
    brain: { factsActive: ownFacts, completeness: hqBrain && Number.isFinite(Number(hqBrain.completeness)) ? Math.round(Number(hqBrain.completeness)) : null },
    rollup: allRoll, direct: directRoll,
    metrics: { brands: kids.length, clients: active.length, direct: direct.length, leads: leads.length },
  };
  direct.forEach((c) => clientNode(c, ROOT_ID, rootTheme.primary));

  // Brands, then their clients.
  const brandBrains = [];
  kids.forEach((b) => {
    const t = brandTheme(b);
    const mine = byGroup[b.id] || [];
    const own = brandOwnBrain(b, d.brandFacts);
    const roll = rollupClients(mine, dossierBy);
    const tpl = arr(featuresBy[b.id]).filter((f) => f.in_template !== false);
    brandBrains.push(own);
    const n = {
      id: `brand:${b.id}`, type: "brand", brandId: b.id, brand: b, slug: b.slug, label: b.name, sub: b.niche || "", tagline: b.tagline || "", status: b.status || "planned",
      color: t.primary, theme: t, logo: b.logo_url || null, own, rollup: roll,
      metrics: { clients: mine.length, leads: arr(leadsBy[b.id]).length, templateFeatures: tpl.length, brainScore: own.score, clientsBrainScore: roll.score },
    };
    nodes[n.id] = n;
    link(n.id, ROOT_ID, "brand", own.factsActive + roll.factsActive + roll.answered, tpl.length, t.primary);
    mine.forEach((c) => clientNode(c, n.id, t.primary));
  });

  const brandAnswered = brandBrains.reduce((t, x) => t + x.answered, 0);
  const brandTotal = brandBrains.reduce((t, x) => t + x.total, 0);
  nodes[ROOT_ID].brandsBrain = { reporting: brandBrains.filter((x) => x.reporting).length, answered: brandAnswered, total: brandTotal, score: pct(brandAnswered, brandTotal), factsActive: brandBrains.reduce((t, x) => t + x.factsActive, 0) };
  const summary = { brands: kids.length, clients: active.length, direct: direct.length, leads: leads.length, reporting: allRoll.reporting, brandsReporting: nodes[ROOT_ID].brandsBrain.reporting };
  return { root, rootNode: nodes[ROOT_ID], brands: kids, nodes, edges, summary };
}

// Clients of one brand (root = Interstellar direct), any status.
export function clientsOfBrand(clients, brands, brand) {
  const root = rootOf(brands);
  const isRoot = !brand || (root && brand.id === root.id) || !s(brand.parent_brand_id);
  return arr(clients).filter((c) => { const id = brandIdOfClient(c, brands, root); return isRoot ? !id : id === brand.id; });
}

// FlowCanvas edges for the current layout. Brains always flow child -> parent; FlowCanvas draws horizontal curves
// left -> right, so an edge's from/to follow screen position and the up / down streams swap sides to match.
export function orientEdges(edges, anchors, mode = "cols") {
  if (!anchors) return [];
  const out = [];
  arr(edges).forEach((e) => {
    const c = anchors[e.child];
    const p = anchors[e.parent];
    if (!c || !p) return;
    const childFirst = mode === "stack" ? c.y + c.h / 2 < p.y + p.h / 2 : c.x + c.w / 2 < p.x + p.w / 2;
    const base = { id: e.id, kind: e.kind, color: e.color };
    if (childFirst) out.push({ ...base, from: e.child, to: e.parent, fwd: e.up, back: e.down, fwdColor: e.color, backColor: TEMPLATE_COLOR });
    else out.push({ ...base, from: e.parent, to: e.child, fwd: e.down, back: e.up, fwdColor: TEMPLATE_COLOR, backColor: e.color });
  });
  return out;
}

// ---------------------------------------------------------------- feature intelligence
// brandId: one brand's features and clients; null / "" = root: everything across every brand.
export function featureStats(features, clientFeatures, brandId = null) {
  const scope = (x) => !brandId || x.brand_id === brandId;
  const feats = arr(features).filter(scope);
  const rows = arr(clientFeatures).filter(scope);
  const nameOf = {};
  feats.forEach((f) => { nameOf[f.key] = f.name; });
  rows.forEach((r) => { if (!nameOf[r.feature_key] && r.feature_name) nameOf[r.feature_key] = r.feature_name; });
  const rank = (list, val) => {
    const m = new Map();
    list.forEach((r) => {
      const cur = m.get(r.feature_key) || { key: r.feature_key, name: nameOf[r.feature_key] || r.feature_key, value: 0, clients: new Set() };
      cur.value += val(r);
      cur.clients.add(r.client_id);
      m.set(r.feature_key, cur);
    });
    return [...m.values()].filter((x) => x.value > 0).map((x) => ({ key: x.key, name: x.name, value: x.value, clients: x.clients.size })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  };
  const added = rank(rows.filter((r) => r.state === "added"), () => 1);
  const removed = rank(rows.filter((r) => r.state === "removed"), () => 1);
  const requested = rank(rows.filter((r) => r.state === "requested"), () => 1);
  const used = rank(rows.filter((r) => Number(r.usage_count) > 0), (r) => Number(r.usage_count) || 0);
  const clientsReporting = new Set(rows.map((r) => r.client_id)).size;
  return { templateFeatures: feats.filter((f) => f.in_template !== false).length, clientsReporting, added, removed, requested, used, hasData: rows.length > 0 };
}
