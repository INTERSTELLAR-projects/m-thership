// Digital footprint: brain_connected is computed from real BrainFacts pushed by the client's own apps.
import { describe, it, expect } from "vitest";
import { clientAppIds, appBrainFacts, brainConnected, syncStatus, connectionSummary } from "@/features/clients/systems";
import { buildHouse } from "@/features/brands/graph";

const palm = { id: "c1", business: "Palm Shore", status: "Active", command_app_id: "appPalm", site_app_id: "appSite" };
const cakes = { id: "c2", business: "Smallcakes", status: "Active", command_app_id: "appCmd", other_app_ids: ["appOnb"] };
const fact = (over) => ({ id: Math.random().toString(36).slice(2), source: "client_app", client_id: "c1", source_app_id: "appPalm", status: "active", ...over });

describe("clientAppIds", () => {
  it("collects command, other, site and ops ids without duplicates", () => {
    expect(clientAppIds(cakes)).toEqual(["appCmd", "appOnb"]);
    expect(clientAppIds({ ...palm, ops_app_id: "appPalm" })).toEqual(["appPalm", "appSite"]);
    expect(clientAppIds(null)).toEqual([]);
  });
});

describe("brain_connected", () => {
  it("is false with no facts and never inferred from config alone", () => {
    expect(brainConnected(palm, [])).toBe(false);
    expect(brainConnected(palm, undefined)).toBe(false);
  });
  it("is true once client_app facts arrive from a registered app (any status)", () => {
    expect(brainConnected(palm, [fact({ status: "superseded" })])).toBe(true);
    expect(brainConnected(cakes, [fact({ client_id: "c2", source_app_id: "appOnb" })])).toBe(true);
  });
  it("ignores facts from other sources, other clients and unregistered apps", () => {
    expect(brainConnected(palm, [fact({ source: "interview" })])).toBe(false);
    expect(brainConnected(palm, [fact({ client_id: "c2" })])).toBe(false);
    expect(brainConnected(palm, [fact({ source_app_id: "someoneElse" })])).toBe(false);
    expect(appBrainFacts(palm, [fact(), fact({ client_id: "c9" })])).toHaveLength(1);
  });
});

describe("sync status and summary", () => {
  it("takes the best has_sync across profiles", () => {
    expect(syncStatus([{ has_sync: "no" }, { has_sync: "partial" }])).toBe("partial");
    expect(syncStatus([{ has_sync: "partial" }, { has_sync: "yes" }])).toBe("yes");
    expect(syncStatus([])).toBe("no");
  });
  it("only counts the client's own profiles", () => {
    const profiles = [{ client_id: "c1", has_sync: "yes" }, { client_id: "c2", has_sync: "partial" }];
    expect(connectionSummary(palm, [fact()], profiles)).toEqual({ brain: true, sync: "yes", apps: 1 });
    expect(connectionSummary(cakes, [fact()], profiles)).toEqual({ brain: false, sync: "partial", apps: 1 });
  });
});

describe("constellation client nodes", () => {
  it("carry the connected summary from app facts and profiles", () => {
    const g = buildHouse({ brands: [], clients: [palm, cakes], appFacts: [fact()], profiles: [{ client_id: "c1", has_sync: "yes" }] });
    expect(g.nodes["client:c1"].connected).toEqual({ brain: true, sync: "yes", apps: 1 });
    expect(g.nodes["client:c2"].connected).toEqual({ brain: false, sync: "no", apps: 0 });
    expect(g.nodes["client:c2"].hasApp).toBe(true);
  });
});
