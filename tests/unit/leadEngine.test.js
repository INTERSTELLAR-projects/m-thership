// Lead Engine (Nov 2026): templates, preview builder, follow-ups, routing and pay. Pure functions, made-up data only.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as L from "@/lib/leadEngine";

const NOW = Date.parse("2026-11-23T18:00:00Z");
const T = L.seedTemplates("2026-11-22T00:00:00Z");

describe("lead engine module", () => {
  it("lives twice, byte-identical (screens + functions)", () => {
    expect(readFileSync("base44/shared/leadEngine.js", "utf8")).toBe(readFileSync("src/lib/leadEngine.js", "utf8"));
  });
  it("never ships price floors to the browser", () => {
    const src = readFileSync("src/lib/leadEngine.js", "utf8");
    expect(src).not.toMatch(/DEFAULT_FLOORS|sales_floors/);
  });
});

describe("industry templates", () => {
  it("seeds 20+ unique industries with website + command templates", () => {
    expect(T.length).toBeGreaterThanOrEqual(20);
    expect(new Set(T.map((t) => t.industry_key)).size).toBe(T.length);
    for (const t of T) {
      expect(t.website_template.sections.length).toBeGreaterThan(5);
      expect(t.command_template.modules.length).toBeGreaterThan(3);
      expect(t.refinement_notes[0].kind).toBe("seed");
    }
  });
  it("links real builds where they exist", () => {
    expect(T.find((t) => t.industry_key === "tree_service").reference_builds[0].name).toMatch(/North Woods/);
    expect(T.find((t) => t.industry_key === "hardscaping").reference_builds[0].name).toMatch(/Palm Shore/);
  });
  it("matches by keyword, falls back by niche", () => {
    expect(L.matchTemplate(T, { text: "Stump grinding and tree removal" }).industry_key).toBe("tree_service");
    expect(L.matchTemplate(T, { text: "zzz", niche_key: "food_bev" }).industry_key).toBe("bakery_cafe");
  });
});

describe("preview builder", () => {
  const client = { id: "demo-1", business: "Sample Ridge Tree Care LLC", phones: ["(555) 010-0142"], scrape_summary: { services: ["Tree removal", "Stump grinding"], gbp: { rating: 4.7, reviews: 38, address: "1 Main St, Sampleton, OR 97000" }, colors: ["#1e4d2b", "#e8a33d"], images: ["https://example.com/a.jpg"] } };
  it("keeps every search title 25–55 and description 100–120, with or without a city", () => {
    for (const t of T) for (const c of [client, { id: "x", business: "Joe's" }, { ...client, business: "A Very Long Business Name Holdings Incorporated Services" }]) {
      for (const p of L.buildPreview({ client: c, template: t }).website_config.seo.pages) {
        expect(p.title_len, `${t.industry_key} ${p.title}`).toBeGreaterThanOrEqual(25);
        expect(p.title_len, `${t.industry_key} ${p.title}`).toBeLessThanOrEqual(55);
        expect(p.desc_len, `${t.industry_key} ${p.description}`).toBeGreaterThanOrEqual(100);
        expect(p.desc_len, `${t.industry_key} ${p.description}`).toBeLessThanOrEqual(120);
      }
    }
  });
  it("uses real facts only and labels sample data", () => {
    const b = L.buildPreview({ client, template: L.matchTemplate(T, { text: "tree" }) });
    expect(b.website_config.city).toBe("Sampleton");
    expect(b.website_config.rating).toBe(4.7);
    expect(b.website_config.hero.image).toBe("https://example.com/a.jpg");
    expect(b.command_config.label).toBe("Sample data");
    const none = L.buildPreview({ client: { id: "y", business: "Joe's" }, template: T[0] });
    expect(none.website_config.rating).toBe(null);
    expect(none.missing).toContain("Google rating");
    expect(JSON.stringify(none.website_config)).not.toMatch(/★ on Google/);
  });
  it("applies edits and light variation over a rebuild", () => {
    const b = L.buildPreview({ client, template: T[0] });
    const out = L.applyOverrides(b.website_config, { hero: { headline: "Custom line" }, theme: { primary: "#123456" }, sections: { faq: { enabled: false } } });
    expect(out.hero.headline).toBe("Custom line");
    expect(out.theme.primary).toBe("#123456");
    expect(out.sections.find((s) => s.key === "faq").enabled).toBe(false);
  });
});

describe("call sheet follow-ups", () => {
  it("retries a voicemail next business day at a different hour, up to the limit", () => {
    const t = L.followUpsFor({ client: { status: "Lead" }, preview: { status: "ready" }, calls: [{ outcome: "voicemail", at: "2026-11-20T18:00:00Z" }], now: NOW });
    expect(t[0].kind).toBe("retry_call");
    expect(new Date(t[0].due_at).getUTCDay()).toBe(1);
    const four = Array.from({ length: 4 }, () => ({ outcome: "no_answer", at: "2026-11-20T18:00:00Z" }));
    expect(L.followUpsFor({ client: { status: "Lead" }, preview: { status: "ready" }, calls: four, now: NOW })).toEqual([]);
  });
  it("flags unopened portals after 48h and asks for the owner when it went through staff", () => {
    const t = L.followUpsFor({ client: { status: "Lead", contact: "Sam" }, preview: { status: "sent", sent_at: "2026-11-20T18:00:00Z" }, calls: [{ outcome: "staff_portal", at: "2026-11-20T18:00:00Z" }], now: NOW });
    expect(t.find((x) => x.kind === "portal_reminder").reason).toMatch(/Sam/);
  });
  it("heats up on logins", () => {
    expect(L.heatOf({}, { engagement: { first_login_at: "x" } })).toBe("hot");
    expect(L.heatOf({}, { engagement: { first_login_at: "x", sessions: 2 } })).toBe("hottest");
    expect(L.followUpsFor({ client: { status: "Lead" }, preview: { status: "viewed", engagement: { first_login_at: "2026-11-23T17:00:00Z", sessions: 3 } }, now: NOW })[0].kind).toBe("hot_call");
  });
  it("never follows up on do-not-contact", () => {
    expect(L.followUpsFor({ client: { status: "Lead", do_not_contact: true }, preview: { status: "sent", sent_at: "2026-11-01T00:00:00Z" }, now: NOW })).toEqual([]);
  });
  it("computes caller rates", () => {
    const m = L.callerMetrics([{ outcome: "no_answer" }, { outcome: "sent_portal" }, { outcome: "staff_portal" }, { outcome: "booked" }], { logins: 1, deals: 1, revenue: 1000, cost: 400 });
    expect(m.dials).toBe(4); expect(m.connects).toBe(3); expect(m.owners).toBe(2); expect(m.portals).toBe(2);
    expect(m.revenue_per_dial).toBe(250); expect(m.cost_per_dial).toBe(100);
  });
});

describe("sales team", () => {
  const reps = [
    { id: "a", name: "A", status: "active", allowed_industries: ["tree_service"], assigned_total: 3, weight: 1 },
    { id: "b", name: "B", status: "active", allowed_industries: ["tree_service"], assigned_total: 1, weight: 1 },
    { id: "c", name: "C", status: "active", multi_industry_ready: true, allowed_industries: [], assigned_total: 0 },
    { id: "d", name: "D", status: "paused", allowed_industries: ["tree_service"], assigned_total: 0 },
  ];
  it("routes weighted round-robin inside allowed industries and capacity", () => {
    expect(L.routeLead({ industry_key: "tree_service" }, reps, {}).id).toBe("c");
    expect(L.routeLead({ industry_key: "tree_service" }, reps, { c: 99 }).id).toBe("b");
    expect(L.routeLead({ industry_key: "roofing" }, reps.slice(0, 2))).toBe(null);
  });
  it("keeps one-industry reps to their first industry", () => {
    expect(L.repAllows({ allowed_industries: ["tree_service", "roofing"] }, "roofing")).toBe(false);
  });
  it("gives the builder first right to present", () => {
    expect(L.presenterFor({ builder_rep_id: "b", assigned_rep_id: "a" }, [{ id: "a", status: "active" }, { id: "b", status: "active", mode: "both" }]).id).toBe("b");
    expect(L.presenterFor({ builder_rep_id: "b", assigned_rep_id: "a" }, [{ id: "a", status: "active" }, { id: "b", status: "active", mode: "builder" }]).id).toBe("a");
  });
  it("computes a monthly earnings statement", () => {
    const e = L.earningsFor({ id: "a", base_retainer: 5000 }, [{ rep_id: "a", status: "won", closed_at: "2026-11-03", contract_value: 10000, monthly_value: 750, products: [{ key: "seo", price: 750, billing: "monthly" }] }], { tiers: [{ from: 0, rate: 0.05 }, { from: 10000, rate: 0.08 }], seo_bonus_per_sub: 250, monthly_counts_months: 3 }, "2026-11");
    expect(e.revenue).toBe(12250); expect(e.commission).toBe(980); expect(e.seo_bonus).toBe(250); expect(e.total).toBe(6230);
  });
  it("flags dated homepages", () => {
    expect(L.datedSignals("<html><table width=600>© 2019</table></html>", "http://x.com", 2026).dated).toBe(true);
    expect(L.datedSignals('<meta name="viewport" content="width=device-width">© 2026', "https://x.com", 2026).dated).toBe(false);
  });
});
