// One-off generator for the House of Brands entities (removed after use).
const fs = require("fs");
const rls = { create: { user_condition: { role: "admin" } }, read: { user_condition: { role: "admin" } }, update: { user_condition: { role: "admin" } }, delete: { user_condition: { role: "admin" } } };
const S = (d) => ({ type: "string", ...(d ? { description: d } : {}) });
const brand = { name: "Brand", description: "House of Brands: Interstellar Strategies (the root, parent_brand_id empty) and its niche brands (DIALD first). Each niche brand sells the same 45-day business rebuild (website + custom command system + SEO) into one industry; each of its clients gets their own app built from the brand template app. Brain flow: client app -> brand -> Møthership. See docs/client-brain-sync.md. Admin only.", type: "object", properties: {
  name: S("Brand name, e.g. DIALD"),
  slug: S("URL key (/brands/<slug>), lowercase a-z 0-9 and dashes, unique"),
  tagline: S(),
  niche: S("The one industry this brand sells into; the root takes any industry"),
  parent_brand_id: S("Brand id of the parent. Empty = this is the Interstellar root"),
  status: { type: "string", enum: ["active", "building", "planned", "paused"], default: "planned" },
  website_url: S(),
  template_app_id: S("App id of the brand product / template app. Accepted by client-brain ingest (COMMAND_SYSTEM_SYNC_KEY) as this BRAND brain, never a client one"),
  brand_app_ids: { type: "array", items: { type: "string" }, description: "Other apps owned by the brand itself (not client apps). Also accepted as the brand brain" },
  colors: { type: "object", properties: { primary: S("hex"), accent: S("hex"), background: S("hex") }, additionalProperties: true },
  logo_url: S(),
  logo_dark_url: S("Logo for dark backgrounds, if different"),
  offer_summary: S("What the brand sells, in plain words. Real offer only"),
  sort_order: { type: "number", default: 0 },
  notes: S(),
  brain_stats: { type: "object", additionalProperties: true, description: "Set by client-brain ingest from the brand app(s): { total, answered, open, skipped, facts_active, synced_at, apps: { <app_id>: {...} } }" },
}, required: ["name", "slug"], rls };
const fact = { name: "BrandBrainFact", description: "A brand-level Business Brain fact pushed by a brand template / brand app (client-brain ingest, source brand_app). Kept apart from BrainFact so the Interstellar brain and the client brains never mix with brand facts. Business facts only: never athlete / end-customer records. Admin only.", type: "object", properties: {
  brand_id: S("Brand id"), brand_name: S(),
  pillar: { type: "string", enum: ["sales", "marketing", "delivery", "finance", "clients", "team", "systems", "owner"] },
  statement: S(), raw_text: S(), question: S(), question_key: S("Namespaced client:<app_id>:<key> (same scheme as client facts)"),
  source: S("brand_app"), confidence: { type: "string", enum: ["high", "medium", "low"], default: "high" }, date: { type: "string", format: "date" },
  status: { type: "string", enum: ["active", "superseded"], default: "active" },
  data: { type: "object", additionalProperties: true },
  source_app_id: S(), source_app_name: S(), source_fact_id: S("Upsert key with source_app_id"), source_question_key: S(), area: S(), capture_source: S(), captured_by_name: S(),
  answered_at: { type: "string", format: "date-time" }, synced_at: { type: "string", format: "date-time" },
}, required: ["brand_id", "pillar", "statement"], rls };
const feat = { name: "AppFeature", description: "A feature in a brand template app (feature intelligence). in_template = ships in the brand template every client app starts from. Seeded from the template app routes; never invented. Admin only.", type: "object", properties: {
  key: S("Stable feature key, unique per brand, e.g. peak_week"), name: S(), category: S("e.g. coaching, nutrition, training, contest, comms, sales, command, athlete_app, integrations"),
  brand_id: S("Brand id"), in_template: { type: "boolean", default: true }, description: S(), route: S("Where it lives in the template app (internal)"), sort_order: { type: "number", default: 0 },
}, required: ["key", "name", "brand_id"], rls };
const caf = { name: "ClientAppFeature", description: "Per-client state of one feature in that client's own app (feature intelligence): what each client keeps, adds, removes, requests and uses, so the brand template improves. Written by hand or by the client-brain function (action features, same COMMAND_SYSTEM_SYNC_KEY + command_app_id check). Real data only. Admin only.", type: "object", properties: {
  client_id: S("CRMClient id"), client_name: S(), brand_id: S("Brand id (empty = Interstellar direct)"), feature_key: S("AppFeature.key"), feature_name: S("Name as the client app reports it, for features not in the template"),
  state: { type: "string", enum: ["enabled", "added", "removed", "requested"] },
  usage_count: { type: "number", description: "Optional: uses in the reporting window, as reported by the app" }, last_used_at: { type: "string", format: "date-time" },
  source: { type: "string", enum: ["manual", "sync"], default: "manual" }, source_app_id: S(), synced_at: { type: "string", format: "date-time" }, notes: S(),
}, required: ["client_id", "feature_key", "state"], rls };
for (const e of [brand, fact, feat, caf]) fs.writeFileSync(`base44/entities/${e.name}.jsonc`, JSON.stringify(e, null, 2));
const c = JSON.parse(fs.readFileSync("base44/entities/CRMClient.jsonc", "utf8"));
const props = {};
for (const [k, v] of Object.entries(c.properties)) {
  props[k] = v;
  if (k === "command_app_id") props.brand_id = { type: "string", description: "Brand id (House of Brands) this client was sold through. Empty = Interstellar direct. See /brands" };
}
c.properties = props;
fs.writeFileSync("base44/entities/CRMClient.jsonc", JSON.stringify(c, null, 2));
