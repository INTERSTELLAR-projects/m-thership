// Guards the portal v2 navigation (src/features/portal/v2/portalMap.js): a short header, everything else one tap
// away in the Everything grid, every tile opens a real portal tab, no nested menus.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { HEADER_TABS, GROUPS, ALL_TILES, groupsFor, labelFor, STUDIO_KEYS, inPeriod } from "@/features/portal/v2/portalMap";

const app = fs.readFileSync(path.resolve(__dirname, "../../src/features/portal/PortalApp.jsx"), "utf8");
const tabsLine = app.match(/const TABS = (\[.*\]);/)[1];
const studiosSrc = fs.readFileSync(path.resolve(__dirname, "../../src/features/portal/PortalStudios.jsx"), "utf8");
const STUDIO_TABS = [...studiosSrc.matchAll(/tab: "(studio_[a-z]+)"/g)].map((m) => m[1]);
const PORTAL_TABS = new Set([...JSON.parse(tabsLine).map(([k]) => k), ...STUDIO_TABS]);

describe("portal v2 navigation", () => {
  it("keeps the header short (everything else is one tap away)", () => {
    expect(HEADER_TABS.length).toBeLessThanOrEqual(4);
    expect(GROUPS.length).toBeLessThanOrEqual(6);
    for (const g of GROUPS) expect(g.items.length, g.id).toBeLessThanOrEqual(8);
  });

  it("has four pages: Glance, Requests & self-serve, Brand & assets, Billing", () => {
    expect(HEADER_TABS.map((h) => h.k)).toEqual(["home", "requests", "assets", "billing"]);
    expect(GROUPS.map((g) => g.id)).toEqual(["glance", "requests", "brand", "account"]);
    expect(labelFor("home")).toBe("Glance");
  });

  it("every tile and header item opens a real portal tab", () => {
    for (const t of [...ALL_TILES, ...HEADER_TABS]) expect(PORTAL_TABS.has(t.k), t.k).toBe(true);
  });

  it("tile keys are unique and every tile has a label, a line of help and an icon", () => {
    const keys = ALL_TILES.map((t) => t.k);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of ALL_TILES) { expect(t.label).toBeTruthy(); expect(t.desc).toBeTruthy(); expect(t.icon).toBeTruthy(); }
  });

  it("covers everything in Justin's brief", () => {
    for (const k of ["playbook", "brain", "resources", "studio_hiring", "studio_training", "studio_social", "studio_email", "studio_presentations", "signatures", "qr", "studio_accounting", "studio_ads", "mentions", "files", "billing", "referrals"]) {
      expect(ALL_TILES.some((t) => t.k === k), k).toBe(true);
    }
    expect(STUDIO_KEYS.has("studio_ads")).toBe(true);
    expect(/key: "ads", tab: "studio_ads"[^\n]*comingSoon: true/.test(studiosSrc)).toBe(true);
  });

  it("only shows tiles for tabs this client has, with lock labels", () => {
    const g = groupsFor(["home", "requests", "studio_email", "studio_ads"], new Set(["studio_email", "studio_ads"]), "HyperCare+");
    const items = g.flatMap((x) => x.items);
    expect(items.map((i) => i.k).sort()).toEqual(["requests", "studio_ads", "studio_email"]);
    expect(items.find((i) => i.k === "studio_email").locked).toBe("HyperCare+");
    expect(items.find((i) => i.k === "studio_ads").locked).toBe("Soon");
    expect(labelFor("brain")).toBe("Your Brain");
  });

  it("work feed periods follow the Pacific calendar (weeks start Monday)", () => {
    const today = "2026-11-18"; // a Wednesday
    expect(inPeriod("2026-11-18", "today", today)).toBe(true);
    expect(inPeriod("2026-11-16", "week", today)).toBe(true);
    expect(inPeriod("2026-11-15", "week", today)).toBe(false);
    expect(inPeriod("2026-11-01", "month", today)).toBe(true);
    expect(inPeriod("2026-01-02", "year", today)).toBe(true);
    expect(inPeriod("2025-12-31", "year", today)).toBe(false);
    expect(inPeriod(null, "year", today)).toBe(false);
  });
});
