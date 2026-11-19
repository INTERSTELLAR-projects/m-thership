// Build Engine round (Nov 19): approval lanes, pillars, deal value, usage summary, automations board, brand filter.
// Pure functions only, with made-up demo records (never real client data).
import { describe, it, expect } from "vitest";
import { laneForText, laneForJob, laneForPost, laneForLedger, AUTO_NOTE } from "@/lib/approvalLanes";
import { scorePillars, weakestPillar, automationIssue, expectedGapDays, portalPillars, CLIENT_PILLARS } from "@/lib/clientPillars";
import { dealLabel, pipelineValueOf, monthlyOf } from "@/features/pipeline/deal";
import { summarize } from "@/lib/usageSummary";
import { cleanPath } from "@/lib/usageSummary";
import { jobGroupOf, rowIssue, gapOf, scopeMatch } from "@/features/automations/board";
import { matchesBrand } from "@/features/brands/brandFilter";
import { PROCESSES } from "@/features/flight/serviceProcesses";

const DAY = 86400000;
const NOW = Date.parse("2026-11-19T18:00:00Z");

describe("taste approval rule lanes", () => {
  it("sends publish, DNS, money, deletes and client emails to the hard gate", () => {
    for (const t of ["Publish the site", "Point the DNS at the new host", "Delete old records", "Send the invoice", "Email the client the recap"]) expect(laneForText(t), t).toBe("gate");
  });
  it("treats look-and-feel as taste and research as logic", () => {
    expect(laneForText("Pick the homepage hero design")).toBe("taste");
    expect(laneForText("Research competitor keywords")).toBe("logic");
    expect(laneForJob({ kind: "audit", title: "Site audit" })).toBe("logic");
    expect(laneForPost()).toBe("taste");
    expect(laneForLedger()).toBe("gate");
    expect(AUTO_NOTE).toMatch(/Justin's rule, Nov 19/);
  });
});

describe("client pillars", () => {
  it("has the Brain's eight pillars and never invents a score without data", () => {
    expect(CLIENT_PILLARS.length).toBe(8);
    const p = scorePillars({ brain: null, automations: [], gaps: [], requests: [], work: [], now: NOW });
    expect(p.length).toBe(8);
    expect(p.every((x) => x.score == null || Number.isFinite(x.score))).toBe(true);
    expect(portalPillars(p).every((x) => typeof x.line === "string")).toBe(true);
    expect(weakestPillar(p) === null || typeof weakestPillar(p) === "object").toBe(true);
  });
  it("flags a twice-weekly blog that is 23 days late", () => {
    expect(expectedGapDays("Tue + Thu 9am PT")).toBe(3.5);
    const i = automationIssue({ name: "Blog drop", kind: "blog", status: "active", schedule: "Tue + Thu 9am PT", last_run_at: new Date(NOW - 26 * DAY).toISOString() }, NOW);
    expect(i.kind).toBe("overdue");
  });
});

describe("deal value in two parts", () => {
  const demo = { deal_one_time: { amount: 2500, status: "quoted" }, deal_monthly: { plan: "hypercare", amount: 500, start: "now" } };
  it("labels the card and counts 12 months of monthly in pipeline value", () => {
    expect(dealLabel(demo)).toBe("$2,500 + $500/mo HyperCare+");
    expect(pipelineValueOf(demo)).toBe(2500 + 12 * 500);
    expect(monthlyOf({ deal_monthly: { plan: "none", amount: 900 } })).toBe(0);
  });
});

describe("usage tracking", () => {
  it("strips record ids and summarizes pages, paths and slow steps", () => {
    expect(cleanPath({ pathname: "/clients/6aebc2933e7ada5fece300d8", search: "?tab=brain&x=1" })).toBe("/clients/:id?tab=brain");
    const ev = [
      { kind: "page_view", path: "/", session_id: "s1" },
      { kind: "page_view", path: "/crm", prev_path: "/", ms_since_prev: 4000, session_id: "s1" },
      { kind: "page_view", path: "/", prev_path: "/crm", ms_since_prev: 9000, session_id: "s1" },
      { kind: "page_view", path: "/crm", prev_path: "/", ms_since_prev: 6000, session_id: "s2" },
      { kind: "action", label: "Add lead", session_id: "s2" },
    ];
    const s = summarize(ev);
    expect(s.views).toBe(4);
    expect(s.sessions).toBe(2);
    expect(s.paths[0][0]).toBe("/ → /crm");
    expect(s.slow[0][0]).toBe("/");
    expect(s.actions[0]).toEqual(["Add lead", 1]);
  });
});

describe("automations board", () => {
  const base = { key: "k", name: "Demo blog · Tuesday", description: "Weekly blog package", source: "claude_task", enabled: true, status: "on", channels: [], scope: "client", clientIds: ["c1"], clientNames: ["Demo Co"] };
  it("groups by job in plain words", () => {
    expect(jobGroupOf(base)).toBe("content");
    expect(jobGroupOf({ ...base, name: "Stripe billing sync", source: "stripe_webhook", description: "" })).toBe("billing");
    expect(jobGroupOf({ ...base, name: "Send to Claude queue runner", description: "Works the queue" })).toBe("plumbing");
  });
  it("explains lateness against the schedule and suggests a fix", () => {
    const row = { ...base, cron: "CRON_TZ=America/Los_Angeles 0 6 * * 2,4", lastAt: new Date(NOW - 26 * DAY).toISOString() };
    expect(gapOf(row)).toBe(3.5);
    const i = rowIssue(row, NOW);
    expect(i.kind).toBe("overdue");
    expect(i.reason).toMatch(/twice-weekly/);
    expect(i.fix).toBe("rerun");
    expect(rowIssue({ ...row, lastAt: new Date(NOW - DAY).toISOString() }, NOW)).toBeNull();
    expect(rowIssue({ ...base, status: "failing", notes: "timeout" }, NOW).kind).toBe("failed");
    expect(rowIssue({ ...base, cron: "0 6 * * 2", lastAt: new Date(NOW - DAY).toISOString(), lastRun: { status: "success", processed: true, verified_live: false, output_url: "https://example.com/x" } }, NOW).kind).toBe("unverified");
  });
  it("filters client-specific vs every client", () => {
    expect(scopeMatch(base, "client")).toBe(true);
    expect(scopeMatch(base, "every")).toBe(false);
    expect(scopeMatch({ ...base, scope: "all_clients" }, "every")).toBe(true);
  });
});

describe("brand filter and service process", () => {
  it("treats an empty brand or the root brand as Interstellar direct", () => {
    expect(matchesBrand({ brand_id: "" }, "root", "root")).toBe(true);
    expect(matchesBrand({ brand_id: "diald" }, "root", "root")).toBe(false);
    expect(matchesBrand({ brand_id: "diald" }, "diald", "root")).toBe(true);
    expect(matchesBrand({ brand_id: "x" }, "all", "root")).toBe(true);
  });
  it("has one process per offer, every step with an owner, auto/manual and a place", () => {
    expect(PROCESSES.map((p) => p.label)).toEqual(["Mission ALPHA", "Website", "Command System", "HyperCare+", "GravïtyCare", "Add-ons"]);
    for (const p of PROCESSES) for (const s of p.steps) { expect(s.owner).toBeTruthy(); expect(["auto", "manual"]).toContain(s.mode); expect(s.where).toBeTruthy(); expect(s.to.startsWith("/")).toBe(true); }
  });
});
