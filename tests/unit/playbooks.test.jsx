// Playbooks: pure helpers + a server render of every section with demo-shaped data (no network, no sign-in).
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

globalThis.React = React; // vitest uses the classic JSX transform here
vi.mock("@/api/base44Client", () => ({ base44: { entities: {}, functions: { invoke: vi.fn() } } }));

const { lineDiff, sweepPrompt, livePrompt, industryGroup, checkKindFor } = await import("@/features/playbooks/data");
const { default: AreaView } = await import("@/features/playbooks/AreaView");
const { default: StandardsMatrix } = await import("@/features/playbooks/StandardsMatrix");
const { default: ApproveQueue } = await import("@/features/playbooks/ApproveQueue");
const { BrainVisual, StatTiles, Ticker } = await import("@/features/playbooks/BrainHero");

const now = new Date().toISOString();
const area = { id: "a1", slug: "website-build", name: "Website build", icon: "Globe", order: 1, kind: "website", linked_packages: ["custom-website"], description: "Demo" };
const data = {
  areas: [area, { id: "a2", slug: "app-build", name: "App / Command System build", icon: "Cpu", order: 2, kind: "app", linked_packages: [] }],
  prompts: [
    { id: "p1", area_id: "a1", industry: "", version: 1, status: "retired", title: "v1", body: "line a\nline b", approved_at: "2026-11-01T00:00:00Z" },
    { id: "p2", area_id: "a1", industry: "", version: 2, status: "approved", title: "v2", body: "line a\nline c", changelog: "changed b", approved_at: now },
    { id: "p3", area_id: "a1", industry: "", version: 3, status: "draft", title: "v3", body: "line a\nline c\nline d", changelog: "add d", based_on_id: "p2", drafted_by: "prompt_agent", created_date: now },
  ],
  logs: [{ id: "l1", text: "demo request", area_id: "a1", phase: "build", client_name: "Demo Co", said_at: "2026-11-10T00:00:00Z", pattern_id: "pt1" }],
  patterns: [
    { id: "pt1", area_id: "a1", title: "Sharp buttons", rule: "One button system", count: 3, clients: ["Demo Co", "Demo Two"], status: "proposed", example_quotes: ["make it sharp"] },
    { id: "pt2", area_id: "a1", title: "Covered", rule: "x", count: 1, clients: ["Demo Co"], status: "watching", standard_id: "s1" },
  ],
  standards: [
    { id: "s1", area_id: "a1", kind: "website", title: "Footer credit", rule: "Credit line", how_to_check: "Look", order: 1, active: true, added_at: now },
    { id: "s2", area_id: "a2", kind: "app", title: "RLS", rule: "Every entity", order: 2, active: true },
  ],
  checks: [
    { id: "c1", client_id: "k1", client_name: "Demo Co", app_or_site: "app1", app_name: "Demo site", app_kind: "site", standard_id: "s1", status: "unknown" },
    { id: "c2", client_id: "k1", client_name: "Demo Co", app_or_site: "app2", app_name: "Demo app", app_kind: "app", standard_id: "s2", status: "fail", note: "two open" },
  ],
  profiles: [],
  clients: [{ id: "k1", business: "Demo Co", industry: "Home services · Demo" }],
  state: { last_run_at: now, last_summary: "demo" },
};
const wrap = (el) => renderToString(<MemoryRouter>{el}</MemoryRouter>);

describe("playbooks helpers", () => {
  it("diffs lines", () => {
    const d = lineDiff("a\nb", "a\nc");
    expect(d.map((x) => x.t)).toEqual(["same", "del", "add"]);
  });
  it("picks the live prompt and falls back to all industries", () => {
    expect(livePrompt(data.prompts, "a1", "Home services").id).toBe("p2");
  });
  it("maps industries and kinds", () => {
    expect(industryGroup("Home services · Luxury")).toBe("Home services");
    expect(checkKindFor("mappack")).toBe("site");
    expect(checkKindFor("brand")).toBe("business");
  });
  it("builds a sweep prompt with house rules", () => {
    const t = sweepPrompt({ target: data.checks[0], items: [{ s: data.standards[0], c: data.checks[0] }] });
    expect(t).toContain("Footer credit");
    expect(t).toContain("™");
    expect(t).not.toMatch(/base44/i);
  });
});

describe("playbooks sections render", () => {
  it("brain", () => {
    const html = wrap(<><BrainVisual areas={data.areas} prompts={data.prompts} pendingByArea={{ a1: 2 }} logs={data.logs} busy={false} onPickArea={() => {}} /><StatTiles {...data} /><Ticker logs={data.logs} areas={data.areas} /></>);
    expect(html).toContain("PROMPT AGENT");
  });
  it("area view", () => {
    const html = wrap(<AreaView area={area} data={data} onBack={() => {}} refresh={() => {}} />);
    expect(html).toContain("Copy prompt · v2");
    expect(html).toContain("Covered by");
  });
  it("standards matrix", () => {
    const html = wrap(<StandardsMatrix data={data} setData={() => {}} />);
    expect(html).toContain("Footer credit");
  });
  it("approve queue", () => {
    const html = wrap(<ApproveQueue data={data} refresh={() => {}} />);
    expect(html).toContain("Sharp buttons");
    expect(html).toContain("Approve · make live");
  });
});
