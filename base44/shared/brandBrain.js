// House of Brands: the brand level of the brain hierarchy (docs/client-brain-sync.md).
//
//   client app  ->  brand  ->  Møthership (Interstellar)
//
// A brand's own template / product app (Brand.template_app_id, or one of Brand.brand_app_ids) pushes to the same
// client-brain function with the same COMMAND_SYSTEM_SYNC_KEY as client command systems. Its facts are stored as that
// BRAND's brain (BrandBrainFact, source "brand_app"), never as a client's. Client apps keep writing client brains
// (BrainFact, source "client_app") and roll up to their brand through CRMClient.brand_id.
//
// Pure logic only (no Deno, no SDK): used by base44/functions/client-brain and tests/unit/brands.test.js.
import { appAuthError } from "./clientBrain.js";

export const BRAND_SOURCE = "brand_app";

const s = (v) => (v == null ? "" : String(v).trim());
const arr = (v) => (Array.isArray(v) ? v : []);

// The brand that owns this app id as its template app or one of its brand apps, or null.
export function brandForApp(brands, appId) {
  const id = s(appId);
  if (!id) return null;
  return arr(brands).find((b) => b && (s(b.template_app_id) === id || arr(b.brand_app_ids).map(s).includes(id))) || null;
}

// Who a key-authenticated push writes to. Anti-spoofing: the shared key proves nothing about WHICH brand or client is
// sending, so the target is always the record the app id is registered on.
//   registeredClient: the CRMClient whose command_app_id is appId (or null)
//   targetClient:     the CRMClient named by payload.client_id (or null)
//   brands:           every Brand
// Returns { kind: "brand", brand } | { kind: "client", client } | { kind, error } (error = reject with 403 + log).
export function resolveIngestTarget({ appId, payload = {}, brands = [], registeredClient = null, targetClient = null }) {
  const id = s(appId);
  if (!id) return { kind: "none", error: "app_id is required" };
  const brand = brandForApp(brands, id);
  const wantsBrand = s(payload.target) === "brand" || !!s(payload.brand_id);
  const wantsClient = s(payload.target) === "client" || !!s(payload.client_id);
  if (wantsBrand || (brand && !registeredClient && !wantsClient)) {
    if (!brand) return { kind: "brand", error: `app ${id} is not registered as a template or brand app on any brand (set Brand.template_app_id or brand_app_ids)` };
    if (s(payload.brand_id) && s(payload.brand_id) !== s(brand.id)) return { kind: "brand", brand, error: `app ${id} is not registered on brand ${s(payload.brand_id)}` };
    return { kind: "brand", brand, error: "" };
  }
  const client = s(payload.client_id) ? targetClient : registeredClient;
  const err = appAuthError(client, id);
  return { kind: "client", client, error: err && !client ? `${err} or as a brand app (Brand.template_app_id)` : err };
}

// A planned client-style fact row (clientBrain.planUpsert / mapFact) -> BrandBrainFact fields.
export function toBrandRow(rec, brand) {
  const { client_id, client_name, ...rest } = rec || {}; // eslint-disable-line no-unused-vars
  return { ...rest, source: BRAND_SOURCE, brand_id: s(brand && brand.id), brand_name: s(brand && brand.name).slice(0, 120) };
}

// ---------------------------------------------------------------- feature reports (action "features")
// Payload: { app_id, features: [{ key, name?, state: enabled|added|removed|requested, usage_count?, last_used_at? }] }
export const FEATURE_STATES = ["enabled", "added", "removed", "requested"];
export const featureKey = (v) => s(v).toLowerCase().replace(/[^a-z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);

export function featureError(f) {
  if (!f || typeof f !== "object") return "feature is not an object";
  if (!featureKey(f.key)) return "key is required";
  if (!FEATURE_STATES.includes(s(f.state))) return `state must be one of ${FEATURE_STATES.join(", ")}`;
  if (f.usage_count != null && !(Number(f.usage_count) >= 0)) return "usage_count must be a number >= 0";
  return "";
}

// Idempotent: one ClientAppFeature row per (client_id, feature_key). Manual rows are never overwritten by a sync.
//   existing: stored rows for this client; incoming: validated payload features; ctx: { client_id, client_name, brand_id, app_id, now }
export function planFeatureUpsert(existing, incoming, ctx) {
  const byKey = new Map(arr(existing).map((r) => [featureKey(r.feature_key), r]));
  const creates = [];
  const updates = [];
  let unchanged = 0;
  let skippedManual = 0;
  const seen = new Set();
  for (const f of arr(incoming)) {
    const key = featureKey(f.key);
    if (seen.has(key)) continue;
    seen.add(key);
    const rec = {
      client_id: s(ctx.client_id), client_name: s(ctx.client_name).slice(0, 120), brand_id: s(ctx.brand_id), feature_key: key,
      feature_name: s(f.name).slice(0, 120), state: s(f.state), source: "sync", source_app_id: s(ctx.app_id),
      ...(f.usage_count != null ? { usage_count: Math.floor(Number(f.usage_count)) } : {}),
      ...(s(f.last_used_at) && !Number.isNaN(Date.parse(s(f.last_used_at))) ? { last_used_at: new Date(s(f.last_used_at)).toISOString() } : {}),
    };
    const row = byKey.get(key);
    if (!row) { creates.push({ ...rec, synced_at: ctx.now }); continue; }
    if (row.source === "manual") { skippedManual++; continue; }
    const diff = ["state", "feature_name", "brand_id", "usage_count", "last_used_at", "client_name"].some((k) => s(row[k]) !== s(rec[k] ?? row[k]));
    if (diff) updates.push({ id: row.id, patch: { ...rec, synced_at: ctx.now } });
    else unchanged++;
  }
  return { creates, updates, unchanged, skippedManual };
}
