// Constellation v2 graph builder: hierarchy from real records, edge directions, activity -> orb rate mapping, event paths.
import { describe, it, expect } from "vitest";
import { buildShip, orbRate, orbGlow, eventPath, eventsOf, freshEvents, litNodes, breadcrumb, activitiesFor, waitingFor, summaryLine, dayStart, ts, runMatchesAgent, hqDeptOf } from "@/features/agents/ship/graph";

const NOW = new Date("2026-11-12T20:00:00Z"); // 12:00 PT
const T = (h) => new Date(NOW.getTime() - h * 3600e3).toISOString();

const data = {
  registry: [
    { key: "commander", name: "Commander", scope: "interstellar", department: "command", status: "live", kind: "in_app_ai" },
    { key: "wf:social-publish", name: "Social publisher", scope: "interstellar", department: "marketing", status: "live", kind: "base44_workflow", last_run_at: T(1) },
    { key: "daily_intel", name: "Daily Search Intel", scope: "interstellar", department: "research", status: "live", kind: "claude_scheduled_task", last_run_at: T(2) },
    { key: "plan:x", name: "Planned thing", scope: "interstellar", department: "sales", status: "planned", kind: "manual_skill" },
    { key: "template:seo_blog", name: "Blog", scope: "template", department: "seo", status: "planned" },
    { key: "client_research:c1", template_key: "client_research", name: "Competitor & search research", scope: "client", client_id: "c1", department: "research", status: "live", kind: "claude_scheduled_task", last_run_at: T(3) },
    { key: "seo_blog:c1", template_key: "seo_blog", name: "Blog + GBP posts", scope: "client", client_id: "c1", department: "seo", status: "paused", kind: "claude_scheduled_task" },
    { key: "appwf:w1", name: "Lead follow-up", scope: "client", client_id: "c1", department: "ops", status: "live", kind: "client_app_workflow", external_id: "w1", owner_app: "Acme ops app", owner_app_id: "app1", last_run_at: T(0.5), synced_at: T(1) },
    { key: "nova:c2", template_key: "nova", name: "Nøva", scope: "client", client_id: "c2", department: "reporting", status: "planned", kind: "in_app_ai" },
  ],
  clients: [
    { id: "c1", business: "Acme Roofing", industry: "Home services", site_app_id: "site1", ops_app_id: "app1" },
    { id: "c2", business: "Beta Coffee" },
  ],
  runs: [
    { id: "r1", automation_name: "Social publisher", started_at: T(1), status: "success" },
    { id: "r2", automation_id: "w1", automation_name: "Lead follow-up", client_id: "c1", started_at: T(0.4), status: "success" },
    { id: "r3", automation_name: "Social publisher", started_at: T(48), status: "success" },
  ],
  work: [
    { id: "w-1", title: "Blog shipped", client_id: "c1", category: "seo", status: "done", completed_at: T(2) },
    { id: "w-2", title: "Needs OK", client_id: "c1", category: "website", status: "awaiting_approval", completed_at: T(5) },
  ],
  jobs: [{ id: "j1", title: "Audit", client_id: "c1", status: "needs_approval", finished_at: T(4) }],
  research: [
    { id: "n1", topic: "Competitor raised prices", client_id: "c1", client_name: "Acme Roofing", status: "new", created_at: T(6) },
    { id: "n2", topic: "Old", status: "applied", created_at: T(24 * 20) },
  ],
  intel: [{ id: "s1", title: "AI Overviews change", status: "proposed", brief_date: "2026-11-11" }],
  opps: [{ id: "o1", title: "Voice agents for trades", status: "new", created_at: T(30), why_now: "x" }],
  findings: [],
  ideas: [{ id: "i1", title: "Map pack bundle", status: "New", created_date: "2026-11-10T10:00:00" }],
  learnings: [],
  actions: [{ id: "a1", title: "Email Acme", status: "pending" }],
  facts: [{ id: "f1", statement: "Goal $1M", status: "active", created_date: T(10) }],
  brains: [{ scope: "interstellar", completeness: 64 }],
  usage: [{ kind: "ai_action", calls: 3, created_at: T(1) }],
  brief: { pillar_scores: { sales: { score: 30 } } },
};

describe("ship graph: hierarchy", () => {
  const ship = buildShip(data, { now: NOW });
  it("builds core, brain, lanes, departments, clients and client agent clusters", () => {
    expect(ship.nodes.claude.type).toBe("claude");
    expect(ship.nodes.brain.metrics.completeness).toBe(64);
    expect(ship.nodes["lane:research"].metrics.waiting).toBe(1);
    expect(ship.nodes["dept:marketing"].agents.map((a) => a.key)).toEqual(["wf:social-publish"]);
    expect(ship.nodes["client:c1"].metrics.agents).toBe(3);
    expect(ship.nodes["client:c1"].apps.map((a) => a.label)).toEqual(["Website", "Acme ops app"]);
    expect(ship.nodes["cagents:c1"]).toBeTruthy();
    expect(Object.keys(ship.nodes).some((k) => k.includes("template"))).toBe(false);
  });
  it("expanding a client replaces its cluster with one card per group / app", () => {
    const s = buildShip(data, { now: NOW, focus: "client:c1" });
    expect(s.nodes["cagents:c1"]).toBeUndefined();
    expect(s.nodes["cgroup:c1:mothership"].agents).toHaveLength(2);
    expect(s.nodes["cgroup:c1:app:app1"].agents.map((a) => a.key)).toEqual(["appwf:w1"]);
    expect(s.nodes["cgroup:c1:app:site1"].agents).toHaveLength(0); // app known, no agents read yet -> "connect"
    expect(s.nodes["cagents:c2"]).toBeTruthy(); // other clients stay collapsed
  });
  it("rolls client agents up to the commanding Møthership department", () => {
    expect(hqDeptOf({ scope: "client", department: "seo" })).toBe("marketing");
    expect(hqDeptOf({ scope: "client", department: "ops" })).toBe("delivery");
    expect(hqDeptOf({ scope: "interstellar", department: "sales" })).toBe("sales");
  });
  it("breadcrumbs follow the hierarchy", () => {
    expect(breadcrumb(ship, "agent:appwf:w1", data.registry).map((b) => b.label)).toEqual(["Whole ship", "Acme Roofing", "Acme ops app", "Lead follow-up"]);
    expect(breadcrumb(ship, "agent:wf:social-publish", data.registry).map((b) => b.label)).toEqual(["Whole ship", "Marketing", "Social publisher"]);
    expect(breadcrumb(ship, "cagents:c1", data.registry).map((b) => b.label)[1]).toBe("Acme Roofing");
  });
});

describe("ship graph: edges and directions", () => {
  const ship = buildShip(data, { now: NOW });
  const edge = (id) => ship.edges.find((e) => e.id === id);
  it("flows Claude -> brain -> departments -> clients -> client agents", () => {
    expect(edge("claude>brain")).toBeTruthy();
    expect(edge("brain>dept:marketing")).toBeTruthy();
    expect(edge("dept:research>client:c1")).toBeTruthy();
    expect(edge("dept:delivery>client:c1")).toBeTruthy(); // ops app workflow
    expect(edge("client:c1>cagents:c1")).toBeTruthy();
    for (const e of ship.edges) expect(e.to).not.toBe("claude"); // nothing points back into the core
  });
  it("research flows into the brain and ideas flow out", () => {
    expect(edge("lane:research>brain")).toBeTruthy();
    expect(edge("lane:search_intel>brain")).toBeTruthy();
    expect(edge("brain>ideas_out").fwd.count).toBe(ship.summary.ideasWaiting);
    expect(edge("dept:research>client:c1").idea.count).toBe(1);
  });
  it("skips department edges where every agent is only planned", () => {
    expect(edge("dept:success>client:c2")).toBeUndefined();
    expect(edge("dept:marketing>client:c1")).toBeTruthy(); // a paused agent still hangs off its department
  });
  it("carries results back on the reverse stream", () => {
    expect(edge("brain>dept:marketing").fwd.count).toBe(1); // social publisher ran today
    expect(edge("client:c1>cagents:c1").back.count).toBe(1); // blog shipped today
  });
});

describe("activity -> orb rate", () => {
  it("has a calm baseline and grows with the log of activity", () => {
    expect(orbRate(0)).toBeCloseTo(0.12);
    expect(orbRate(10)).toBeGreaterThan(orbRate(1));
    expect(orbRate(100000)).toBe(2.2);
    expect(orbRate(-5)).toBeCloseTo(0.12);
    expect(orbRate(0, { base: 0 })).toBe(0);
  });
  it("glow stays between 0.35 and 1", () => {
    expect(orbGlow(0)).toBeCloseTo(0.35);
    expect(orbGlow(40)).toBeCloseTo(1);
    expect(orbGlow(9999)).toBe(1);
    expect(orbGlow(5)).toBeGreaterThan(orbGlow(1));
  });
});

describe("live events", () => {
  const ship = buildShip(data, { now: NOW });
  it("lists records newest first and finds only new ones", () => {
    const ev = eventsOf(data);
    expect(ev[0].key).toBe("AutomationRun:r2");
    const seen = new Set(ev.slice(1).map((e) => e.key));
    expect(freshEvents(seen, ev).map((e) => e.key)).toEqual(["AutomationRun:r2"]);
  });
  it("a client app run travels Claude -> brain -> delivery -> client -> its agents", () => {
    const ev = eventsOf(data).find((e) => e.key === "AutomationRun:r2");
    const p = eventPath(ev, ship, data.registry);
    expect(p.nodes).toEqual(["claude", "brain", "dept:delivery", "client:c1", "cagents:c1"]);
    expect(p.hops.every((h) => h.forward)).toBe(true);
    expect(p.href).toBe("/automations");
  });
  it("finished work travels back home to the brain", () => {
    const ev = eventsOf(data).find((e) => e.key === "WorkEntry:w-1");
    const p = eventPath(ev, ship, data.registry);
    expect(p.dir).toBe("back");
    expect(p.nodes[p.nodes.length - 1]).toBe("brain");
    expect(p.hops.every((h) => !h.forward)).toBe(true);
    expect(p.href).toBe("/output-analytics?entry=w-1");
  });
  it("research for a client comes in through the research lane", () => {
    const ev = eventsOf(data).find((e) => e.key === "ResearchNote:n1");
    const p = eventPath(ev, ship, data.registry);
    expect(p.nodes.slice(0, 3)).toEqual(["lane:research", "brain", "dept:research"]);
    expect(p.href).toBe("/agents?note=n1");
  });
  it("matches client app runs by workflow id", () => {
    expect(runMatchesAgent({ automation_id: "w1" }, data.registry[7])).toBe(true);
    expect(runMatchesAgent({ automation_name: "Competitor & search research", client_id: "c2" }, data.registry[5])).toBe(false);
  });
});

describe("panel data and filters", () => {
  const ship = buildShip(data, { now: NOW });
  it("client panels only show that client's records", () => {
    const acts = activitiesFor("client:c1", ship, data, data.registry);
    expect(acts.length).toBeGreaterThan(0);
    expect(acts.every((a) => a.rec.client_id === "c1")).toBe(true);
    expect(activitiesFor("client:c2", ship, data, data.registry)).toEqual([]);
    expect(waitingFor("client:c1", ship, data, data.registry).map((w) => w.entity).sort()).toEqual(["ClaudeJob", "ResearchNote", "WorkEntry"]);
  });
  it("search lights matching branches and keeps the core lit", () => {
    const lit = litNodes(ship, data.registry, { q: "lead follow" });
    expect(lit.has("claude")).toBe(true);
    expect(lit.has("client:c1")).toBe(true);
    expect(lit.has("client:c2")).toBe(false);
    expect(lit.has("dept:delivery")).toBe(true);
    expect(litNodes(ship, data.registry, {})).toBe(null);
  });
  it("summarises the whole ship in one line", () => {
    expect(ship.summary.agentsLive).toBe(5);
    expect(ship.summary.clientsServed).toBe(1);
    expect(ship.summary.ideasWaiting).toBe(4);
    expect(summaryLine(ship.summary)).toMatch(/^5 agents running for 1 client · \d+ events today · 4 ideas from research waiting · 3 need you$/);
  });
});

describe("time helpers", () => {
  it("reads zone-less created_date as UTC", () => {
    expect(ts("2026-11-13T02:26:23.913000")).toBe(Date.parse("2026-11-13T02:26:23.913Z"));
  });
  it("today starts at Pacific midnight", () => {
    expect(new Date(dayStart(NOW)).toISOString()).toBe("2026-11-12T08:00:00.000Z");
  });
});
