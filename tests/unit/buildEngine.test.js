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

import { ALL_TEMPLATES, NICHE_KEYS, templateFor, instantiate, tick, progress, portalView } from "@/lib/buildTemplates";
import * as serverTemplates from "../../base44/shared/buildTemplates.js";
import { canPublish } from "@/features/build/publishRules";

describe("build checklist templates (step 4)", () => {
  it("has one template per niche, each with a Website and a Command System track", () => {
    expect(ALL_TEMPLATES.map((t) => t.niche_key)).toEqual(NICHE_KEYS);
    for (const t of ALL_TEMPLATES) {
      expect(t.tracks.map((r) => r.key)).toEqual(["website", "command"]);
      const groups = new Set(t.tracks[0].items.map((i) => i.group));
      for (const g of ["pages", "content", "nap_schema", "forms", "seo", "speed", "security", "analytics", "launch"]) expect(groups.has(g), `${t.niche_key} website ${g}`).toBe(true);
      const cg = new Set(t.tracks[1].items.map((i) => i.group));
      for (const g of ["modules", "data", "logins", "connections", "automations", "launch"]) expect(cg.has(g), `${t.niche_key} command ${g}`).toBe(true);
      for (const r of t.tracks) for (const i of r.items) { expect(typeof i.auto).toBe("boolean"); expect(new Set(r.items.map((x) => x.key)).size).toBe(r.items.length); }
      // Publishing is always a manual gate, never auto.
      for (const r of t.tracks) for (const i of r.items.filter((x) => x.gate === "publish")) expect(i.auto).toBe(false);
    }
    expect(templateFor("nope").niche_key).toBe("other");
    expect(JSON.stringify(serverTemplates.ALL_TEMPLATES)).toBe(JSON.stringify(ALL_TEMPLATES));
  });
  it("instantiates, ticks and shows only client-friendly items in the portal", () => {
    const c = instantiate(templateFor("home_service"), { id: "c1", business: "[TEST] Demo Co", niche_key: "home_service" });
    const p0 = progress(c);
    expect(p0.done).toBe(0);
    const c2 = tick(c, "website", "page_home", { done: true, note: "built" });
    expect(progress(c2).done).toBe(1);
    const v = portalView(c2);
    expect(v.done).toBe(1);
    const labels = v.tracks.flatMap((t) => t.items.map((i) => i.label));
    expect(labels).toContain("Your homepage");
    expect(labels).not.toContain("");
    expect(v.tracks.flatMap((t) => t.items).length).toBeLessThan(p0.total);
  });
  it("offers Ready to publish only for finished build jobs with checkpoints", () => {
    const job = { status: "needs_review", build: { ready_to_publish: true, checkpoints: [{ app_id: "a", kind: "website", checkpoint: "x" }] } };
    expect(canPublish(job)).toBe(true);
    expect(canPublish({ ...job, status: "running" })).toBe(false);
    expect(canPublish({ ...job, publish: { status: "requested" } })).toBe(false);
    expect(canPublish({ ...job, build: { ready_to_publish: false, checkpoints: [] } })).toBe(false);
  });
});

import { submitTypesFor, checkSubmission, SUBMIT_BY_NICHE, SUBMIT_TYPES, RECEIVED_TEXT, statusLabel } from "@/lib/submitTypes";
import * as serverSubmit from "../../base44/shared/submitTypes.js";

describe("portal Submit intake", () => {
  it("offers niche-specific types, each with photos and the right fields", () => {
    expect(submitTypesFor("home_service").map((t) => t.key)).toEqual(["project", "transformation", "testimonial", "event"]);
    expect(submitTypesFor("retail_streetwear").map((t) => t.key)).toContain("drop");
    expect(submitTypesFor("unknown").map((t) => t.key)).toEqual(SUBMIT_BY_NICHE.other);
    expect(SUBMIT_TYPES.project.fields.some((f) => f.key === "location" && f.tag)).toBe(true);
    expect(SUBMIT_TYPES.drop.fields.map((f) => f.key)).toEqual(expect.arrayContaining(["product_name", "price"]));
    expect(SUBMIT_TYPES.transformation.consent && SUBMIT_TYPES.testimonial.consent).toBe(true);
    expect(JSON.stringify(serverSubmit.SUBMIT_TYPES)).toBe(JSON.stringify(SUBMIT_TYPES));
    expect(RECEIVED_TEXT).toBe("Received. We'll take it from here.");
  });
  it("validates: type allowed for the niche, required fields, at least one https photo, consent where people are featured", () => {
    const photo = ["https://example.com/a.jpg"];
    expect(checkSubmission("retail_streetwear", { kind: "project", fields: { title: "x", location: "y" }, photos: photo }).error).toBeTruthy();
    expect(checkSubmission("home_service", { kind: "project", fields: { title: "[TEST] Patio" }, photos: photo }).error).toMatch(/Town/);
    expect(checkSubmission("home_service", { kind: "project", fields: { title: "[TEST] Patio", location: "[TEST] Ridgeview" }, photos: [] }).error).toMatch(/photo/);
    expect(checkSubmission("home_service", { kind: "project", fields: { title: "[TEST] Patio", location: "[TEST] Ridgeview" }, photos: ["http://insecure/x.jpg"] }).error).toMatch(/photo/);
    expect(checkSubmission("home_service", { kind: "transformation", fields: { title: "[TEST] Yard" }, photos: photo }).error).toMatch(/agreed/);
    const ok = checkSubmission("home_service", { kind: "project", fields: { title: "[TEST] Patio", location: "[TEST] Ridgeview", junk: "x" }, photos: photo });
    expect(ok.error).toBeUndefined();
    expect(ok.fields).toEqual({ title: "[TEST] Patio", location: "[TEST] Ridgeview" });
    expect(ok.title).toBe("[TEST] Patio");
    expect(statusLabel("received")).toBe("Received");
    expect(statusLabel("live")).toBe("Live");
  });
});

import { domainOf, isLiveSiteAutomation, startsWhenText, isLaunched, TEMPLATE_VERSION } from "@/lib/buildTemplates";
import { waitingForDomain, awaitingDomainIds } from "@/features/automations/board";

describe("domain is the last step and makes the site live", () => {
  it("ends every Website track with Connect <domain>, a DNS hard gate filled with the client's domain", () => {
    expect(TEMPLATE_VERSION).toBe(3);
    for (const t of ALL_TEMPLATES) {
      const w = t.tracks.find((r) => r.key === "website").items;
      const last = w[w.length - 1];
      expect(last.key).toBe("connect_domain");
      expect(last.gate).toBe("dns");
      expect(last.auto).toBe(false);
      expect(last.client_label).toBe("Your website is live");
    }
    const c = instantiate(templateFor("food_bev"), { id: "c", business: "[TEST] Cafe", websites: ["https://www.test-cafe.example/"] });
    expect(c.tracks[0].items.at(-1).label).toMatch(/^Connect test-cafe\.example /);
    expect(domainOf({})).toBe("");
  });
  it("holds live-site automations until the domain verifies, without flagging them", () => {
    expect(isLiveSiteAutomation({ kind: "search_console" })).toBe(true);
    expect(isLiveSiteAutomation({ kind: "blog", name: "Blog drop" })).toBe(false);
    expect(isLiveSiteAutomation({ kind: "other", name: "IndexNow ping" })).toBe(true);
    const lead = { id: "L", status: "Lead", domain: "test-co.example" };
    const live = { id: "A", status: "Active", website_live_at: "2026-11-20T00:00:00Z" };
    const legacy = { id: "B", status: "Active" };
    const awaiting = awaitingDomainIds([lead, live, legacy], new Set());
    expect([...awaiting]).toEqual(["L"]);
    const byId = new Map([[lead.id, lead]]);
    expect(waitingForDomain({ kind: "search_console", name: "GSC", clientIds: ["L"] }, awaiting, byId)).toBe("Starts when test-co.example is connected");
    expect(waitingForDomain({ kind: "search_console", name: "GSC", clientIds: ["B"] }, awaiting, byId)).toBe("");
    expect(startsWhenText({})).toBe("Starts when the domain is connected");
    expect(isLaunched(live) && !isLaunched(lead)).toBe(true);
    expect(automationIssue({ name: "Search Console check", kind: "search_console", status: "setup", schedule: "weekly" }, NOW)).toBeNull();
  });
});

import { missingItems } from "@/lib/buildTemplates";

describe("linked apps (v3): website forms -> Command System, approved photos -> website drafts", () => {
  it("every template has both links as items Claude does itself, with no gate", () => {
    for (const t of ALL_TEMPLATES) {
      const w = t.tracks.find((r) => r.key === "website").items;
      const c = t.tracks.find((r) => r.key === "command").items;
      for (const [items, keys] of [[w, ["link_forms", "link_gallery"]], [c, ["link_website_intake", "link_photo_feed"]]]) {
        for (const k of keys) {
          const it = items.find((i) => i.key === k);
          expect(it, `${t.niche_key} ${k}`).toBeTruthy();
          expect(it.auto).toBe(true);
          expect(it.gate).toBe("");
        }
      }
      expect(w.find((i) => i.key === "link_gallery").label).toMatch(/DRAFTS/);
      expect(w.find((i) => i.key === "link_gallery").label).toMatch(/auto-publish off/);
      expect(w.at(-1).key).toBe("connect_domain");
    }
  });
  it("appends missing items to an older checklist, keeps ticks and keeps Connect <domain> last", () => {
    const client = { id: "c", business: "[TEST] Summit Ridge", websites: ["https://summit-ridge.example"] };
    const v2 = instantiate(templateFor("home_service"), client);
    v2.template_version = 2;
    v2.tracks = v2.tracks.map((tr) => ({ ...tr, items: tr.items.filter((i) => !i.key.startsWith("link_")).map((i) => (i.key === "page_home" ? { ...i, done: true } : i)) }));
    const up = missingItems(v2, templateFor("home_service"), client);
    expect(up.added).toBe(4);
    expect(up.template_version).toBe(3);
    const w = up.tracks.find((r) => r.key === "website").items;
    expect(w.at(-1).key).toBe("connect_domain");
    expect(w.find((i) => i.key === "page_home").done).toBe(true);
    expect(w.find((i) => i.key === "link_forms").done).toBe(false);
    expect(missingItems({ ...v2, tracks: up.tracks }, templateFor("home_service"), client)).toBeNull();
  });
});
