// Universe (src/features/universe): the tree model, gap finder, search and the tidy-tree layout.
import { describe, it, expect } from "vitest";
import { buildUniverse, pathTo, searchIndex, searchUniverse, agentNow, clientWires, clientGaps, kindLabel } from "@/features/universe/model";
import { layoutTree, subtreeBox } from "@/features/universe/layout";
import { demo } from "@/lib/demoData";

const D = () => {
  const E = demo().E;
  return { brands: E.Brand, clients: E.CRMClient, dossiers: E.ClientDossier, brandFacts: [], brains: E.BusinessBrain, profiles: E.ClientAppProfile, registry: E.AgentRegistry, jobs: E.ClaudeJob, runs: E.AutomationRun, work: E.WorkLog, snapshots: E.PerformanceSnapshot };
};

describe("universe model", () => {
  it("builds Claude -> Møthership -> brands -> clients -> departments", () => {
    const u = buildUniverse(D());
    expect(u.nodes.claude.children).toEqual(["hub"]);
    const brands = u.nodes.hub.children.filter((k) => u.nodes[k].type === "brand");
    expect(brands[0]).toBe("brand:b_root");
    expect(brands.length).toBe(4);
    expect(u.nodes.hub.children.at(-1)).toBe("addbrand");
    expect(u.nodes["brand:b_root"].children[0]).toBe("hq");
    // Interstellar has 150+ clients, so they are grouped by industry; the sister brands list theirs directly.
    expect(u.nodes["brand:b_root"].children.slice(1).every((k) => u.nodes[k].type === "group")).toBe(true);
    expect(u.nodes["brand:b_podium"].children.every((k) => u.nodes[k].type === "client")).toBe(true);
    expect(u.nodes["brand:b_hearth"].clients).toBe(0);
    const c = u.nodes["client:pc1"];
    expect(c.children.some((k) => k.startsWith("dept:pc1:"))).toBe(true);
    expect(c.children.at(-1)).toBe("out:pc1");
    expect(pathTo(u.nodes, "client:pc1")).toEqual(["claude", "hub", "brand:b_podium", "client:pc1"]);
  });

  it("finds the honest problems: broken agents, missing site, missing billing", () => {
    const u = buildUniverse(D());
    const keys = u.gaps.map((g) => g.key);
    expect(keys.some((k) => k.startsWith("agent:social_posts:pc3"))).toBe(true);
    expect(u.nodes["client:pc3"].status).toBe("bad");
    expect(u.nodes["client:pc6"].gaps.some((g) => g.key === "site")).toBe(true);
    expect(u.gaps[0].sev).toBe("bad");
    u.gaps.forEach((g) => expect(g.to.startsWith("/")).toBe(true));
  });

  it("never shows a vendor name for agent kinds", () => {
    expect(kindLabel("base44_workflow")).toBe("App workflow");
    expect(kindLabel("base44_thing")).not.toMatch(/base44/i);
  });

  it("says what an agent is doing from its record, and nothing it is not", () => {
    expect(agentNow({ status: "broken", last_error: "Token expired" }).text).toBe("Token expired");
    expect(agentNow({ status: "planned" }).tone).toBe("idle");
    expect(agentNow({ status: "live" }).text).toMatch(/no runs logged yet/);
    expect(agentNow({ status: "live" }, { job: { title: "Blog", status: "running" } }).text).toBe("Working on: Blog");
  });

  it("wires and gaps come from real fields", () => {
    const c = { id: "x", business: "X", portal_enabled: false, services: [] };
    const w = clientWires(c);
    expect(w.map((x) => x.state)).toEqual(["off", "off", "off", "off", "off"]);
    const g = clientGaps(c, { wires: w, brainPct: null, profile: null, agents: [] });
    expect(g.filter((x) => x.sev === "bad").map((x) => x.key).sort()).toEqual(["billing", "brain", "site"]);
  });

  it("works with no brand records at all (Interstellar owns every client)", () => {
    const u = buildUniverse({ clients: [{ id: "a", business: "A", status: "Active" }] });
    expect(u.nodes["brand:interstellar"].clients).toBe(1);
  });

  it("search finds clients and agents", () => {
    const u = buildUniverse(D());
    const idx = searchIndex(u.nodes);
    expect(searchUniverse(idx, "black lantern")[0].node).toBe("client:nk1");
    expect(searchUniverse(idx, "nøva").some((r) => r.type === "agent")).toBe(true);
    expect(searchUniverse(idx, "")).toEqual([]);
  });
});

describe("universe layout", () => {
  it("lays out only what is open and shelves many closed clients", () => {
    const u = buildUniverse(D());
    const closed = layoutTree(u.nodes, "claude", new Set(["claude", "hub"]));
    expect(Object.keys(closed.pos)).toContain("brand:b_podium");
    expect(Object.keys(closed.pos)).not.toContain("client:pc1");
    const open = layoutTree(u.nodes, "claude", new Set(["claude", "hub", "brand:b_podium"]));
    expect(open.shelves.length).toBe(1);
    expect(open.pos["client:pc1"].shelf).toBe("shelf:brand:b_podium");
    // No two laid-out cards overlap.
    const ps = Object.values(open.pos);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i]; const b = ps[j];
      expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true);
    }
    const box = subtreeBox(u.nodes, open, "brand:b_podium");
    expect(box.w).toBeGreaterThan(u.nodes["brand:b_podium"].w);
  });

  it("an opened client lays its departments out in lanes (two rows at most)", () => {
    const u = buildUniverse(D());
    const lay = layoutTree(u.nodes, "claude", new Set(["claude", "hub", "brand:b_podium", "client:pc1"]));
    const depts = u.nodes["client:pc1"].children.map((k) => lay.pos[k]);
    expect(depts.every(Boolean)).toBe(true);
    expect(new Set(depts.map((p) => p.y)).size).toBeLessThanOrEqual(3);
    expect(lay.pos["client:pc1"].shelf).toBeUndefined();
  });
});
