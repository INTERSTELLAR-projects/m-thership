// House of Brands: the brand graph builder (src/features/brands/graph.js) and the brand level of the brain sync
// (base44/shared/brandBrain.js).
import { describe, it, expect } from "vitest";
import {
  buildHouse, orientEdges, featureStats, brandErrors, slugify, rootOf, childBrands, brandIdOfClient, clientsOfBrand,
  brandFieldOptions, brandTheme, clientBrainStats, brandOwnBrain, rollupClients, ROOT_ID, TEMPLATE_COLOR,
} from "@/features/brands/graph";
import { resolveIngestTarget, brandForApp, toBrandRow, featureError, planFeatureUpsert, featureKey, BRAND_SOURCE } from "../../base44/shared/brandBrain.js";
import { mapFact, planUpsert } from "../../base44/shared/clientBrain.js";

const ROOT = { id: "b0", name: "Interstellar Strategies", slug: "interstellar", parent_brand_id: "", status: "active", sort_order: 0, colors: { primary: "#ff3c00", accent: "#ffaa00", background: "#07080d" } };
const DIALD = { id: "b1", name: "DIALD", slug: "diald", parent_brand_id: "b0", status: "building", niche: "Competition bodybuilding coaches", template_app_id: "tplDIALD01", sort_order: 1, colors: { primary: "#00bfff", accent: "#0a6fd6", background: "#0a0a0a" } };
const brands = [DIALD, ROOT];
const clients = [
  { id: "c1", business: "Palm Shore", status: "Active", command_app_id: "appPalm01" },
  { id: "c2", business: "Coach One", status: "Active", brand_id: "b1" },
  { id: "c3", business: "Old Client", status: "Inactive" },
  { id: "c4", business: "Coach Lead", status: "Lead", brand_id: "b1", lead_value: 5000 },
  { id: "c5", business: "Root tagged", status: "Active", brand_id: "b0" },
  { id: "c6", business: "Ghost brand", status: "Active", brand_id: "gone" },
];
const dossiers = [{ client_id: "c1", client_brain: { total: 46, answered: 23, facts_active: 23, synced_at: "2026-11-16T22:00:00Z" } }];

describe("brand tree", () => {
  it("finds the root (no parent) and its child brands", () => {
    expect(rootOf(brands).id).toBe("b0");
    expect(childBrands(brands, ROOT).map((b) => b.id)).toEqual(["b1"]);
  });
  it("puts clients with no brand, the root id or an unknown brand under Interstellar direct", () => {
    expect(brandIdOfClient(clients[0], brands, ROOT)).toBe(null);
    expect(brandIdOfClient(clients[1], brands, ROOT)).toBe("b1");
    expect(brandIdOfClient(clients[4], brands, ROOT)).toBe(null);
    expect(brandIdOfClient(clients[5], brands, ROOT)).toBe(null);
    expect(clientsOfBrand(clients, brands, DIALD).map((c) => c.id)).toEqual(["c2", "c4"]);
    expect(clientsOfBrand(clients, brands, ROOT).map((c) => c.id)).toEqual(["c1", "c3", "c5", "c6"]);
  });
});

describe("buildHouse", () => {
  const h = buildHouse({ brands, clients, dossiers, brandFacts: [], facts: [{ id: "f1", status: "active", source: "interview" }, { id: "f2", status: "active", source: "client_app", client_id: "c1" }], brains: [{ scope: "interstellar", completeness: 61.4 }], features: [{ key: "peak_week", name: "Peak week", brand_id: "b1", in_template: true }], clientFeatures: [] });

  it("builds root, brand and active-client nodes only", () => {
    expect(h.rootNode.id).toBe(ROOT_ID);
    expect(Object.keys(h.nodes).sort()).toEqual(["brand:b1", "client:c1", "client:c2", "client:c5", "client:c6", "root"].sort());
    expect(h.nodes["client:c2"].parent).toBe("brand:b1");
    expect(h.nodes["client:c1"].parent).toBe(ROOT_ID);
  });
  it("counts only real records (no invented numbers)", () => {
    expect(h.summary).toMatchObject({ brands: 1, clients: 4, direct: 3, leads: 1, reporting: 1, brandsReporting: 0 });
    expect(h.rootNode.brain).toEqual({ factsActive: 1, completeness: 61 }); // client_app facts are not Interstellar's own
    const d = h.nodes["brand:b1"];
    expect(d.metrics).toMatchObject({ clients: 1, leads: 1, templateFeatures: 1, brainScore: null });
    expect(d.own.reporting).toBe(false);
    expect(h.nodes["client:c1"].brain).toMatchObject({ answered: 23, total: 46, score: 50 });
    expect(h.nodes["client:c2"].brain).toBe(null);
  });
  it("links child -> parent with brains flowing up", () => {
    const ids = h.edges.map((e) => e.id).sort();
    expect(ids).toEqual(["brand:b1>root", "client:c1>root", "client:c2>brand:b1", "client:c5>root", "client:c6>root"].sort());
    const e = h.edges.find((x) => x.id === "client:c1>root");
    expect(e.up.count).toBe(23);
    expect(e.up.rate).toBeGreaterThan(h.edges.find((x) => x.id === "client:c5>root").up.rate);
    expect(h.edges.find((x) => x.id === "brand:b1>root").down.count).toBe(1); // template features
  });
  it("uses brand colors, falling back to the Interstellar flame", () => {
    expect(h.nodes["brand:b1"].color).toBe("#00bfff");
    expect(brandTheme({ name: "X", parent_brand_id: "b0", colors: { primary: "nope" } }).primary).toBe("#ff6a00");
    expect(brandTheme(ROOT)).toEqual({ primary: "#ff3c00", accent: "#ffaa00", background: "#07080d" });
  });
  it("handles an empty house", () => {
    const e = buildHouse({});
    expect(e.summary).toMatchObject({ brands: 0, clients: 0 });
    expect(e.edges).toEqual([]);
    expect(e.rootNode.label).toBe("Interstellar Strategies");
  });
});

describe("orientEdges (FlowCanvas draws left -> right / top -> bottom)", () => {
  const edges = [{ id: "client:c1>root", child: "client:c1", parent: "root", kind: "client", up: { count: 3, rate: 1 }, down: { count: 0, rate: 0.05 }, color: "#ff3c00" },
    { id: "brand:b1>root", child: "brand:b1", parent: "root", kind: "brand", up: { count: 1, rate: 0.5 }, down: { count: 9, rate: 0.4 }, color: "#00bfff" }];
  const anchors = { root: { x: 400, y: 100, w: 300, h: 300 }, "client:c1": { x: 0, y: 50, w: 250, h: 40 }, "brand:b1": { x: 800, y: 60, w: 260, h: 70 } };
  it("a child left of its parent flows forward; a child right of it flows back", () => {
    const [a, b] = orientEdges(edges, anchors, "cols");
    expect(a).toMatchObject({ from: "client:c1", to: "root", fwd: { count: 3 }, fwdColor: "#ff3c00", backColor: TEMPLATE_COLOR });
    expect(b).toMatchObject({ from: "root", to: "brand:b1", back: { count: 1 }, backColor: "#00bfff", fwdColor: TEMPLATE_COLOR });
  });
  it("stack mode orients by vertical position and skips edges with no anchors", () => {
    const stack = { root: { x: 0, y: 0, w: 390, h: 300 }, "brand:b1": { x: 0, y: 400, w: 390, h: 70 } };
    const out = orientEdges(edges, stack, "stack");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ from: "root", to: "brand:b1" });
    expect(orientEdges(edges, null)).toEqual([]);
  });
});

describe("brain roll-ups", () => {
  it("reads client brain counts only when an app reports", () => {
    expect(clientBrainStats({ client_brain: null })).toBe(null);
    expect(clientBrainStats({ client_brain: { total: 10, answered: 12 } })).toMatchObject({ answered: 10, score: 100 });
  });
  it("a brand's own brain = its stats + active, non-test facts", () => {
    const own = brandOwnBrain({ id: "b1", brain_stats: { total: 20, answered: 5, apps: { tplDIALD01: { app_name: "DIALD (Base44)", answered: 5, total: 20 } } } }, [
      { id: "x", brand_id: "b1", status: "active", statement: "a", answered_at: "2026-11-16" },
      { id: "y", brand_id: "b1", status: "superseded", statement: "b" },
      { id: "z", brand_id: "b1", status: "active", statement: "c", data: { test: true } },
      { id: "w", brand_id: "b2", status: "active", statement: "d" },
    ]);
    expect(own).toMatchObject({ answered: 5, total: 20, score: 25, factsActive: 1, reporting: true });
    expect(own.apps[0].name).toBe("DIALD"); // the build platform never shows
  });
  it("rolls up a set of clients", () => {
    const r = rollupClients(clients.slice(0, 2), { c1: dossiers[0] });
    expect(r).toMatchObject({ clients: 2, reporting: 1, answered: 23, total: 46, score: 50, avgScore: 50 });
  });
});

describe("feature intelligence", () => {
  const features = [{ key: "peak_week", name: "Peak week", brand_id: "b1", in_template: true }, { key: "leads", name: "Leads", brand_id: "b1", in_template: true }, { key: "blog", name: "Blog", brand_id: "b9", in_template: true }];
  it("shows an empty state until client apps report", () => {
    const st = featureStats(features, [], "b1");
    expect(st).toMatchObject({ templateFeatures: 2, clientsReporting: 0, hasData: false, added: [], removed: [], requested: [], used: [] });
  });
  it("ranks added / removed / requested / used per brand and across the root", () => {
    const rows = [
      { client_id: "c2", brand_id: "b1", feature_key: "leads", state: "removed" },
      { client_id: "c7", brand_id: "b1", feature_key: "leads", state: "removed" },
      { client_id: "c2", brand_id: "b1", feature_key: "posing", feature_name: "Posing log", state: "added" },
      { client_id: "c2", brand_id: "b1", feature_key: "peak_week", state: "enabled", usage_count: 40 },
      { client_id: "c7", brand_id: "b1", feature_key: "peak_week", state: "enabled", usage_count: 2 },
      { client_id: "c9", brand_id: "b9", feature_key: "blog", state: "requested" },
    ];
    const st = featureStats(features, rows, "b1");
    expect(st.removed).toEqual([{ key: "leads", name: "Leads", value: 2, clients: 2 }]);
    expect(st.added[0]).toMatchObject({ key: "posing", name: "Posing log" });
    expect(st.used[0]).toMatchObject({ key: "peak_week", value: 42, clients: 2 });
    expect(st.requested).toEqual([]);
    expect(st.clientsReporting).toBe(2);
    expect(featureStats(features, rows, null).requested[0]).toMatchObject({ key: "blog" });
  });
});

describe("Add brand validation", () => {
  it("slugifies names", () => {
    expect(slugify("Ink & Iron Studio™")).toBe("ink-iron-studio");
    expect(slugify("Møthership")).toBe("mothership");
  });
  it("requires a name and a unique, valid slug, hex colors and a fresh template app", () => {
    expect(brandErrors({ name: "", slug: "" })).toMatchObject({ name: expect.any(String), slug: expect.any(String) });
    expect(brandErrors({ name: "X", slug: "Bad Slug" }).slug).toMatch(/Lowercase/);
    expect(brandErrors({ name: "X", slug: "diald" }, brands).slug).toMatch(/already/);
    expect(brandErrors({ name: "dialD", slug: "d2" }, brands).name).toMatch(/already/);
    expect(brandErrors({ name: "X", slug: "x", colors: { primary: "blue" } })["colors.primary"]).toMatch(/hex/);
    expect(brandErrors({ name: "X", slug: "x", template_app_id: "tplDIALD01" }, brands).template_app_id).toMatch(/Another brand/);
    expect(brandErrors({ name: "Ink", slug: "ink", colors: { primary: "#112233" } }, brands)).toEqual({});
  });
  it("client form options: niche brands only (empty = Interstellar direct), unknown ids kept", () => {
    expect(brandFieldOptions(brands)).toEqual([{ value: "b1", label: "DIALD · Competition bodybuilding coaches" }]);
    expect(brandFieldOptions(brands, "gone").map((o) => o.value)).toEqual(["b1", "gone"]);
    expect(brandFieldOptions(brands, "b0").map((o) => o.value)).toEqual(["b1"]);
  });
});

describe("brain sync: brand level (client app -> brand -> Møthership)", () => {
  const palm = { id: "c1", command_app_id: "appPalm01" };
  it("accepts a brand template app as that brand's brain", () => {
    expect(brandForApp(brands, "tplDIALD01").id).toBe("b1");
    expect(brandForApp([{ ...DIALD, template_app_id: "", brand_app_ids: ["extra0001"] }], "extra0001").id).toBe("b1");
    expect(resolveIngestTarget({ appId: "tplDIALD01", brands })).toMatchObject({ kind: "brand", brand: { id: "b1" }, error: "" });
    expect(resolveIngestTarget({ appId: "tplDIALD01", brands, payload: { brand_id: "b1" } }).error).toBe("");
  });
  it("keeps client apps on their client", () => {
    expect(resolveIngestTarget({ appId: "appPalm01", brands, registeredClient: palm })).toMatchObject({ kind: "client", client: { id: "c1" }, error: "" });
  });
  it("rejects spoofing: unknown apps, wrong brand ids, brand claims from client apps, client claims from brand apps", () => {
    expect(resolveIngestTarget({ appId: "unknown01", brands }).error).toMatch(/not registered/);
    expect(resolveIngestTarget({ appId: "tplDIALD01", brands, payload: { brand_id: "b0" } }).error).toMatch(/not registered on brand b0/);
    expect(resolveIngestTarget({ appId: "appPalm01", brands, registeredClient: palm, payload: { target: "brand" } }).error).toMatch(/not registered as a template/);
    expect(resolveIngestTarget({ appId: "tplDIALD01", brands, payload: { client_id: "c1" }, targetClient: palm }).error).toMatch(/not the command system/);
    expect(resolveIngestTarget({ appId: "", brands }).error).toMatch(/app_id is required/);
  });
  it("stores brand facts as BrandBrainFact rows with the client upsert rules", () => {
    const ctx = { app_id: "tplDIALD01", app_name: "DIALD", client_id: "", client_name: "", now: "2026-11-16T23:00:00.000Z" };
    const f = { source_fact_id: "k1", question_key: "pricing", area: "pricing", question: "How do you price coaching?", answer: "Monthly packages.", answered_at: "2026-11-16T20:00:00Z" };
    const plan = planUpsert([], [f], ctx, "full");
    const row = toBrandRow(plan.creates[0], DIALD);
    expect(row).toMatchObject({ brand_id: "b1", brand_name: "DIALD", source: BRAND_SOURCE, pillar: "finance", statement: "Monthly packages.", source_app_id: "tplDIALD01" });
    expect(row).not.toHaveProperty("client_id");
    expect(row).not.toHaveProperty("client_name");
    // A second identical push changes nothing (stored rows carry no client fields).
    const again = planUpsert([{ id: "r1", ...row }], [f], ctx, "full");
    expect(again).toMatchObject({ creates: [], updates: [], unchanged: 1 });
    expect(mapFact(f, ctx).client_id).toBe("");
  });
});

describe("feature reports (action features)", () => {
  const ctx = { client_id: "c2", client_name: "Coach One", brand_id: "b1", app_id: "appCoach1", now: "2026-11-16T23:00:00.000Z" };
  it("validates", () => {
    expect(featureError({ key: "peak_week", state: "enabled" })).toBe("");
    expect(featureError({ key: "", state: "enabled" })).toMatch(/key/);
    expect(featureError({ key: "x", state: "deleted" })).toMatch(/state/);
    expect(featureError({ key: "x", state: "added", usage_count: -1 })).toMatch(/usage_count/);
    expect(featureKey("Peak Week!")).toBe("peak_week");
  });
  it("upserts one row per client + feature and never overwrites manual rows", () => {
    const existing = [{ id: "r1", client_id: "c2", feature_key: "leads", state: "enabled", source: "sync" }, { id: "r2", client_id: "c2", feature_key: "shows", state: "removed", source: "manual" }];
    const plan = planFeatureUpsert(existing, [{ key: "leads", state: "removed" }, { key: "shows", state: "enabled" }, { key: "posing", name: "Posing log", state: "added", usage_count: 3 }, { key: "posing", state: "removed" }], ctx);
    expect(plan.creates).toHaveLength(1);
    expect(plan.creates[0]).toMatchObject({ feature_key: "posing", state: "added", usage_count: 3, brand_id: "b1", source: "sync" });
    expect(plan.updates).toEqual([{ id: "r1", patch: expect.objectContaining({ state: "removed" }) }]);
    expect(plan.skippedManual).toBe(1);
    const same = planFeatureUpsert([{ id: "r1", client_id: "c2", client_name: "Coach One", brand_id: "b1", feature_key: "leads", state: "removed", source: "sync" }], [{ key: "leads", state: "removed" }], ctx);
    expect(same).toMatchObject({ creates: [], updates: [], unchanged: 1 });
  });
});
