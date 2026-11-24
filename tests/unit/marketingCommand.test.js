// Marketing Command (docs/marketing-command.md): seasons, holiday windows, week + pace math, deal mix, generator
// output validation, and the client-ready data shape.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PILLAR_KEYS, seasonFor, seasonRange, holidaysBetween, weekOf, weekActual, pace, revenueTargets, dealMixTotal,
  EXAMPLE_DEAL_MIX, cleanTargets, planPrompt, STATED_PRICING,
} from "../../base44/shared/marketingCommand.js";

const ROOT = join(__dirname, "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

describe("seasons and windows", () => {
  it("maps months to seasons and gives full date ranges (winter crosses the year)", () => {
    expect(["2026-01-10", "2026-04-01", "2026-07-04", "2026-11-23", "2026-12-01"].map(seasonFor)).toEqual(["winter", "spring", "summer", "fall", "winter"]);
    expect(seasonRange("fall", 2026)).toEqual({ start: "2026-09-01", end: "2026-11-30" });
    expect(seasonRange("winter", 2026)).toEqual({ start: "2026-12-01", end: "2027-02-28" });
  });
  it("finds the holiday windows inside a season, across a year boundary", () => {
    const keys = holidaysBetween("2026-12-01", "2027-02-28").map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining(["bfcm", "holidays", "new_year", "valentines", "tax_season"]));
    expect(holidaysBetween("2026-06-01", "2026-08-31").map((h) => h.key)).toContain("july_4");
  });
});

describe("week, pace and revenue", () => {
  it("weeks run Monday to Sunday with Mon–Fri work days", () => {
    expect(weekOf("2026-11-23")).toEqual({ start: "2026-11-23", end: "2026-11-29", workdaysElapsed: 1 }); // Monday
    expect(weekOf("2026-11-29").workdaysElapsed).toBe(5); // Sunday counts as a full week
  });
  it("sums only this pillar's logs inside the week", () => {
    const wk = weekOf("2026-11-25");
    const logs = [{ pillar: "calls", date: "2026-11-23", actual: 40 }, { pillar: "calls", date: "2026-11-25", actual: 35 }, { pillar: "calls", date: "2026-11-20", actual: 99 }, { pillar: "posts", date: "2026-11-24", actual: 3 }];
    expect(weekActual(logs, "calls", wk)).toBe(75);
  });
  it("pace: ahead / on pace / behind / done / no target", () => {
    expect(pace({ target: 500, actual: 300, workdaysElapsed: 3 }).state).toBe("ahead");
    expect(pace({ target: 500, actual: 270, workdaysElapsed: 3 }).state).toBe("on_pace");
    expect(pace({ target: 500, actual: 100, workdaysElapsed: 3 })).toMatchObject({ state: "behind", expected: 300, pct: 20, remaining: 400 });
    expect(pace({ target: 10, actual: 12, workdaysElapsed: 2 }).state).toBe("done");
    expect(pace({ target: 0, actual: 3, workdaysElapsed: 2 }).state).toBe("no_target");
  });
  it("revenue line: $3,000 x 5 = $15,000/week; the example mix is shown as-is with its gap", () => {
    expect(revenueTargets({ daily_target: 3000, days_per_week: 5 })).toEqual({ daily: 3000, days: 5, weekly: 15000 });
    expect(dealMixTotal(EXAMPLE_DEAL_MIX)).toBe(9000);
    expect(dealMixTotal([{ count: "2", amount: "1500" }, { count: null, amount: 10 }])).toBe(3000);
  });
});

describe("generator output", () => {
  it("keeps one row per known pillar, drops junk, caps and rounds numbers, lists what is missing", () => {
    const out = cleanTargets({ summary: "Fall push", targets: [
      { pillar: "calls", weekly_target: 499.6, reasoning: "x" }, { pillar: "calls", weekly_target: 1 }, { pillar: "tiktok", weekly_target: 5 },
      { pillar: "posts", weekly_target: -3 }, { pillar: "ad_spend", weekly_target: 1e9, unit: "USD" }, { pillar: "outreach", weekly_target: "abc" },
    ] });
    expect(out.targets.map((t) => [t.pillar, t.weekly_target])).toEqual([["calls", 500], ["ad_spend", 25000]]);
    expect(out.missing).toEqual(["posts", "content", "outreach", "in_person"]);
    expect(cleanTargets(null).targets).toEqual([]);
  });
  it("the prompt carries the season, windows, offers, Justin's stated pricing and the no-invented-results rule", () => {
    const p = planPrompt({ season: "winter", start: "2026-12-01", end: "2027-02-28", holidays: holidaysBetween("2026-12-01", "2027-02-28"), offers: [{ name: "Mission ALPHA", price_display: "$11,997" }], brain: "We build websites.", revenue: { daily_target: 3000, days_per_week: 5 } });
    for (const x of ["winter", "Black Friday", "Mission ALPHA", "$15000/week", "We build websites.", "do not invent", ...STATED_PRICING]) expect(p).toContain(x);
    for (const k of PILLAR_KEYS) expect(p).toContain(k);
  });
});

describe("data shape", () => {
  it("all three entities are admin-only and carry scope + client_id + portal_visible for the client side later", () => {
    for (const e of ["MarketingPlan", "PillarTarget", "PillarLog"]) {
      const j = JSON.parse(read(`base44/entities/${e}.jsonc`));
      expect(j.rls.read, e).toEqual({ user_condition: { role: "admin" } });
      for (const f of ["scope", "client_id", "portal_visible"]) expect(j.properties[f], `${e}.${f}`).toBeTruthy();
    }
    expect(JSON.parse(read("base44/entities/PillarTarget.jsonc")).properties.pillar.enum.sort()).toEqual([...PILLAR_KEYS].sort());
  });
  it("src/lib/marketingCommand.js is identical to the shared module", () => {
    expect(read("src/lib/marketingCommand.js").split("\n").slice(2).join("\n")).toBe(read("base44/shared/marketingCommand.js"));
  });
});
