import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { evaluateUnlocks, isNational, seoSteps, UNLOCKS } from "@/lib/unlocks";
import { directoriesFor, napMatch, napChecklist, tileCounts, SUBMISSION_SERVICES } from "@/lib/launchGrid";

const body = (p) => readFileSync(p, "utf8").split("\n").slice(1).join("\n");

describe("shared copies stay identical", () => {
  it("unlocks, launch grid and criteria match their backend copies", () => {
    expect(body("base44/shared/unlocks.js")).toBe(readFileSync("src/lib/unlocks.js", "utf8"));
    expect(body("base44/shared/launchGrid.js")).toBe(readFileSync("src/lib/launchGrid.js", "utf8"));
    expect(body("base44/shared/criteria.js")).toBe(readFileSync("src/features/clients/criteria.js", "utf8"));
  });
});

const item = (key, filled, label = key) => ({ key, label, filled });

describe("Brain unlocks", () => {
  it("lists exactly what is missing and writes a client-facing line", () => {
    const items = [item("public_name", true), item("nap_address", true), item("nap_phone", true), item("hours", false, "Business hours"), item("services", true), item("service_areas", true), item("logo", true), item("colors", false, "Brand colors"), item("fonts", true), item("voice", true)];
    const u = evaluateUnlocks(items, {}, false);
    const basics = u.find((x) => x.key === "basics");
    expect(basics.on).toBe(false);
    expect(basics.missing.map((m) => m.key)).toEqual(["hours"]);
    expect(basics.portal).toBe("Your launch grid starts when we have your hours.");
    const brand = u.find((x) => x.key === "brand");
    expect(brand.portal).toBe("Your social engine unlocks when we have your brand colors.");
    expect(brand.done).toBe(3);
    expect(brand.total).toBe(4);
  });
  it("turns on when everything is there; transmission needs the four live facts", () => {
    const keys = ["public_name", "nap_address", "nap_phone", "hours", "services", "service_areas", "logo", "colors", "fonts", "voice", "keywords", "competitors"];
    const items = keys.map((k) => item(k, true));
    const off = evaluateUnlocks(items, { website_live: true, command_live: true, processes_set: false, brand_kit_delivered: true });
    expect(off.filter((x) => x.on).map((x) => x.key)).toEqual(["basics", "brand", "growth"]);
    expect(off.find((x) => x.key === "transmission").portal).toBe("Your Transmission videos start when your processes are set.");
    const all = evaluateUnlocks(items, { website_live: true, command_live: true, processes_set: true, brand_kit_delivered: true });
    expect(all.every((x) => x.on)).toBe(true);
  });
  it("national clients need topics, not a street address or service area", () => {
    const items = [item("public_name", true), item("nap_phone", true), item("services", true), item("keywords", true), item("competitors", true), item("nap_address", false), item("service_areas", false), item("hours", false)];
    const u = evaluateUnlocks(items, {}, true);
    expect(u.find((x) => x.key === "basics").on).toBe(true);
    expect(u.find((x) => x.key === "growth").on).toBe(true);
    expect(isNational({ market_scope: "national" })).toBe(true);
    expect(isNational({ scrape_summary: { market: "Nationwide e-commerce" } })).toBe(true);
    expect(isNational({ scrape_summary: { market: "Molalla, OR" } })).toBe(false);
    expect(seoSteps(true)[0].label).toMatch(/Topic clusters/);
    expect(seoSteps(false).at(-1).label).toMatch(/posting stays off/);
  });
  it("growth never promises posting", () => {
    expect(UNLOCKS.find((u) => u.key === "growth").gives).toMatch(/Posting blogs, GBP and citations stays off/);
  });
});

describe("Launch grid", () => {
  it("has the local core plus niche extras, and national lists instead", () => {
    const hs = directoriesFor("home_service", false).map((d) => d.key);
    for (const k of ["gbp", "apple", "bing", "yelp", "angi", "nextdoor", "facebook", "bbb", "thumbtack", "houzz", "porch", "homeadvisor"]) expect(hs).toContain(k);
    const fit = directoriesFor("fitness_coach", false).map((d) => d.key);
    expect(fit).toContain("mindbody");
    expect(fit).toContain("classpass");
    const nat = directoriesFor("retail_streetwear", true).map((d) => d.key);
    expect(nat).toContain("google_merchant");
    expect(nat).toContain("trustpilot");
    expect(nat).not.toContain("gbp");
    expect(new Set(nat).size).toBe(nat.length);
  });
  it("checks NAP read-only from the page text", () => {
    const nap = { name: "[TEST] Summit Ridge Landscaping", phone: "(208) 555-0142", address: "4120 Ridge Rd, Ridgeview" };
    expect(napMatch("<h1>Summit Ridge Landscaping</h1><p>Call 208.555.0142 · 4120 Ridge Rd</p>", nap).ok).toBe(true);
    expect(napMatch("<h1>Summit Ridge Landscaping</h1><p>Call 208.555.9999</p>", nap).ok).toBe(false);
    expect(napMatch("<h1>Someone else</h1>", nap, "url").ok).toBe(true);
    const text = napChecklist({ business: "[TEST] Summit Ridge" }, nap, directoriesFor("home_service", false).slice(0, 2));
    expect(text).toMatch(/Phone: \(208\) 555-0142/);
    expect(text).toMatch(/1\. Google Business Profile/);
    expect(tileCounts([{ status: "live" }, { status: "pending" }, { status: "missing" }, { status: "missing" }])).toEqual({ live: 1, pending: 1, missing: 2, total: 4 });
    expect(SUBMISSION_SERVICES).toEqual(["brightlocal", "whitespark", "yext", "manual"]);
  });
});

import { cleanSeason, cleanOffer, publicConfig, offerLive, offerLabel, SEASON_PRESETS } from "@/lib/siteExtras";

describe("Seasons + offers", () => {
  it("shared copy matches", () => {
    expect(body("base44/shared/siteExtras.js")).toBe(readFileSync("src/lib/siteExtras.js", "utf8"));
  });
  it("cleans what a client may set", () => {
    expect(cleanSeason({ key: "nope" }).error).toBeTruthy();
    const s = cleanSeason({ key: "holiday", accent: "javascript:alert(1)", banner_text: "" });
    expect(s.accent).toBe(SEASON_PRESETS[0].accent);
    expect(s.banner_text).toBe(SEASON_PRESETS[0].banner);
    expect(cleanOffer({ title: "x", kind: "percent", value: 95, starts_on: "2026-12-01", ends_on: "2026-12-31" }).error).toMatch(/90/);
    expect(cleanOffer({ title: "x", kind: "amount", value: 50, starts_on: "2026-12-31", ends_on: "2026-12-01" }).error).toMatch(/before/);
    const o = cleanOffer({ title: "[TEST] Spring cleanup", kind: "amount", value: "50", starts_on: "2026-11-01", ends_on: "2026-12-31" });
    expect(o.value).toBe(50);
    expect(offerLabel(o)).toBe("$50 off");
  });
  it("public config shows only the active season and offers running today, never a code before it exists", () => {
    const seasons = [{ key: "fall", label: "Fall", active: false, banner_text: "x" }, { key: "holiday", label: "Holiday season", active: true, banner_text: "Happy holidays", accent: "#b3261e", activated_at: "2026-11-19T00:00:00Z", client_id: "secret-id" }];
    const offers = [
      { title: "A", kind: "percent", value: 15, starts_on: "2026-11-01", ends_on: "2026-11-30", status: "live", discount_status: "awaiting_approval", discount_code: "SHOULDNOTSHOW" },
      { title: "B", kind: "percent", value: 10, starts_on: "2026-12-01", ends_on: "2026-12-31", status: "live" },
      { title: "C", kind: "percent", value: 10, starts_on: "2026-11-01", ends_on: "2026-11-30", status: "ended" },
    ];
    const c = publicConfig(seasons, offers, "2026-11-19");
    expect(c.season).toEqual({ key: "holiday", label: "Holiday season", banner: "Happy holidays", accent: "#b3261e", featured: null });
    expect(c.offers).toEqual([{ title: "A", description: "", label: "15% off", ends_on: "2026-11-30", code: "" }]);
    expect(JSON.stringify(c)).not.toMatch(/secret-id|SHOULDNOTSHOW/);
    expect(offerLive(offers[1], "2026-11-19")).toBe(false);
    expect(publicConfig([], [], "2026-11-19")).toEqual({ season: null, offers: [] });
  });
});
