// Client-app Business Brain → Møthership: payload mapping, idempotent upsert, superseded handling, health formula.
import { describe, it, expect } from "vitest";
import { mapFact, planUpsert, factError, normalizeStats, mergeClientBrain, pillarFor, nsKey, clientBrainLines, appAuthError, registeredAppIds, findClientForApp } from "../../base44/shared/clientBrain.js";
import { brainComponent, blendHealth, scoreAll } from "@/features/constellations/pillars";
import * as backendPillars from "../../base44/shared/constellations.js";
import { clientBrainOf } from "@/features/agents/ship/graph";

const NOW = "2026-11-16T23:00:00.000Z";
const ctx = { app_id: "app1", app_name: "Palm Shore Ops", client_id: "c1", client_name: "Palm Shore Hardscapes & Design", now: NOW };
const fact = (over = {}) => ({ source_fact_id: "f1", question_key: "suppliers", question_id: "q1", area: "materials", question: "Who are your suppliers?", answer: "TPS for stone, Lowcountry for pavers.", source: "owner call", captured_by_name: "Justin Cowell", status: "active", answered_at: "2026-11-16T22:02:17.759Z", ...over });
// What Møthership stored after a previous ingest of `f`.
const stored = (f, id = `m_${f.source_fact_id}`) => ({ id, ...mapFact(f, ctx), synced_at: NOW });

describe("payload mapping", () => {
  it("maps a client-app fact to a client-tagged Møthership BrainFact", () => {
    const r = mapFact(fact(), ctx);
    expect(r).toMatchObject({
      pillar: "delivery", statement: "TPS for stone, Lowcountry for pavers.", raw_text: "TPS for stone, Lowcountry for pavers.", question: "Who are your suppliers?",
      question_key: "client:app1:suppliers", source: "client_app", confidence: "high", status: "active", date: "2026-11-16",
      client_id: "c1", client_name: "Palm Shore Hardscapes & Design", source_app_id: "app1", source_app_name: "Palm Shore Ops", source_fact_id: "f1",
      source_question_key: "suppliers", area: "materials", capture_source: "owner call", captured_by_name: "Justin Cowell", answered_at: "2026-11-16T22:02:17.759Z",
    });
    expect(r.data).toEqual({ question_id: "q1" });
  });
  it("maps every area to a valid Brain pillar", () => {
    const PILLARS = ["sales", "marketing", "delivery", "finance", "clients", "team", "systems", "owner"];
    for (const a of ["materials", "pricing", "labor", "terms", "wording", "builders", "leads", "scheduling", "comms", "approvals", "other", "", "unknown"]) expect(PILLARS).toContain(pillarFor(a));
    expect(pillarFor("pricing")).toBe("finance");
    expect(pillarFor("leads")).toBe("sales");
  });
  it("namespaces keys (never collides with Teach-the-Brain keys) and keys free-form facts by id", () => {
    expect(nsKey("app1", { question_key: "owner.hours" })).toBe("client:app1:owner.hours");
    expect(mapFact(fact({ question_key: "", source_fact_id: "free9" }), ctx).question_key).toBe("client:app1:fact.free9");
  });
  it("scrubs credentials and ® from answers, keeps test flag, falls back to now for a bad date", () => {
    const r = mapFact(fact({ answer: "Supplier portal password: hunter2. Brand® pavers", answered_at: "not a date", test: true }), ctx);
    expect(r.statement).not.toContain("hunter2");
    expect(r.statement).toContain("[removed]");
    expect(r.statement).toContain("Brand™");
    expect(r.answered_at).toBe(NOW);
    expect(r.data.test).toBe(true);
  });
  it("validates the contract", () => {
    expect(factError(fact())).toBe("");
    expect(factError(fact({ source_fact_id: "" }))).toMatch(/source_fact_id/);
    expect(factError(fact({ answer: "  " }))).toMatch(/answer/);
    expect(factError(fact({ status: "deleted" }))).toMatch(/status/);
  });
});

describe("anti-spoofing (shared key)", () => {
  const palm = { id: "c1", command_app_id: "app1" };
  it("accepts only the app registered on the target client", () => {
    expect(appAuthError(palm, "app1")).toBe("");
    expect(appAuthError(palm, "app2")).toMatch(/not the command system registered for client c1/);
  });
  it("rejects unregistered apps, clients with no registered app and a missing app id", () => {
    expect(appAuthError(null, "app9")).toMatch(/not registered/);
    expect(appAuthError({ id: "c2" }, "app1")).toMatch(/no command_app_id/);
    expect(appAuthError(palm, "")).toMatch(/app_id is required/);
  });
});

describe("registered apps (command_app_id + other_app_ids)", () => {
  const smallcakes = { id: "c3", command_app_id: "cmdA", other_app_ids: ["onbB", "cmdA", ""] };
  const smpl = { id: "c4", command_app_id: "projC" };
  const bare = { id: "c5", other_app_ids: ["lonely"] };
  const clients = [smallcakes, smpl, bare];
  it("lists the command app first, then the extra apps, without blanks or duplicates", () => {
    expect(registeredAppIds(smallcakes)).toEqual(["cmdA", "onbB"]);
    expect(registeredAppIds(smpl)).toEqual(["projC"]);
    expect(registeredAppIds(null)).toEqual([]);
  });
  it("resolves every registered app id to its client", () => {
    expect(findClientForApp(clients, "cmdA")).toBe(smallcakes);
    expect(findClientForApp(clients, "onbB")).toBe(smallcakes);
    expect(findClientForApp(clients, "projC")).toBe(smpl);
    expect(findClientForApp(clients, "lonely")).toBe(bare);
    expect(findClientForApp(clients, "nope")).toBeNull();
    expect(findClientForApp(clients, "")).toBeNull();
  });
  it("prefers a command_app_id match over an other_app_ids match", () => {
    const dupe = { id: "c6", other_app_ids: ["projC"] };
    expect(findClientForApp([dupe, smpl], "projC")).toBe(smpl);
  });
  it("accepts pushes from any registered app of the client and still rejects others", () => {
    expect(appAuthError(smallcakes, "onbB")).toBe("");
    expect(appAuthError(smallcakes, "cmdA")).toBe("");
    expect(appAuthError(smallcakes, "projC")).toMatch(/not the command system registered for client c3/);
    expect(appAuthError(bare, "lonely")).toBe("");
  });
});

describe("idempotent upsert", () => {
  it("creates new facts once, then does nothing on a replay", () => {
    const f = [fact(), fact({ source_fact_id: "f2", question_key: "product_tiers", answer: "Lowcountry default" })];
    const first = planUpsert([], f, ctx);
    expect(first.creates).toHaveLength(2);
    expect(first.updates).toHaveLength(0);
    const again = planUpsert(first.creates.map((c, i) => ({ id: `m${i}`, ...c })), f, ctx);
    expect(again).toMatchObject({ creates: [], updates: [], unchanged: 2 });
  });
  it("updates in place when the answer text is edited", () => {
    const p = planUpsert([stored(fact())], [fact({ answer: "TPS, Lowcountry and Tremron." })], ctx);
    expect(p.creates).toHaveLength(0);
    expect(p.updates).toEqual([{ id: "m_f1", patch: expect.objectContaining({ statement: "TPS, Lowcountry and Tremron.", status: "active", synced_at: NOW }) }]);
  });
  it("a repeated source_fact_id in one payload is stored once", () => {
    expect(planUpsert([], [fact(), fact({ answer: "second copy" })], ctx).creates).toHaveLength(1);
  });
});

describe("superseded handling", () => {
  it("a new answer to the same question supersedes the stored one and keeps it as history", () => {
    const old = stored(fact());
    const p = planUpsert([old], [fact({ source_fact_id: "f9", answer: "New answer", answered_at: "2026-11-17T10:00:00Z" })], ctx);
    expect(p.creates).toHaveLength(1);
    expect(p.creates[0].status).toBe("active");
    expect(p.updates).toEqual([{ id: "m_f1", patch: { status: "superseded", synced_at: NOW } }]);
  });
  it("the app superseding its old fact flows through as superseded (soft, never deleted)", () => {
    const p = planUpsert([stored(fact())], [fact({ status: "superseded" }), fact({ source_fact_id: "f9", answer: "New", answered_at: "2026-11-17T10:00:00Z" })], ctx);
    expect(p.updates.find((u) => u.id === "m_f1").patch.status).toBe("superseded");
    expect(p.creates[0]).toMatchObject({ source_fact_id: "f9", status: "active" });
    expect(p.superseded).toBe(1);
  });
  it("an older answer arriving late does not displace a newer stored one", () => {
    const newer = stored(fact({ source_fact_id: "f9", answer: "New", answered_at: "2026-11-17T10:00:00Z" }));
    const p = planUpsert([newer], [fact({ answered_at: "2026-11-16T10:00:00Z" })], ctx);
    expect(p.creates[0].status).toBe("superseded");
    expect(p.updates).toHaveLength(0);
  });
  it("two active answers to one question in one payload: newest wins", () => {
    const p = planUpsert([], [fact(), fact({ source_fact_id: "f2", answered_at: "2026-11-18T00:00:00Z" })], ctx);
    expect(p.creates.find((c) => c.source_fact_id === "f2").status).toBe("active");
    expect(p.creates.find((c) => c.source_fact_id === "f1").status).toBe("superseded");
  });
  it("full sync supersedes stored facts the app no longer has; delta leaves them alone", () => {
    const gone = stored(fact({ source_fact_id: "gone", question_key: "warranty" }));
    expect(planUpsert([gone], [fact()], ctx, "delta").updates).toHaveLength(0);
    expect(planUpsert([gone], [fact()], ctx, "full").updates).toEqual([{ id: "m_gone", patch: { status: "superseded", synced_at: NOW } }]);
  });
  it("free-form facts never supersede each other", () => {
    const p = planUpsert([], [fact({ question_key: "", source_fact_id: "a" }), fact({ question_key: "", source_fact_id: "b" })], ctx);
    expect(p.creates.every((c) => c.status === "active")).toBe(true);
  });
});

describe("app counts", () => {
  it("normalizes stats (skipped are out of the total)", () => {
    expect(normalizeStats({ total: 44, answered: 2, open: 42, skipped: 1 })).toEqual({ total: 44, answered: 2, open: 42, skipped: 1 });
    expect(normalizeStats({ answered: 3, open: 7 })).toEqual({ total: 10, answered: 3, open: 7, skipped: 0 });
    expect(normalizeStats({ total: 2, answered: 5 })).toMatchObject({ total: 5, answered: 5 });
  });
  it("sums counts across a client's apps", () => {
    let cb = mergeClientBrain(null, "app1", "Ops", { total: 45, answered: 1, open: 44 }, { facts_active: 2, synced_at: NOW });
    cb = mergeClientBrain(cb, "app2", "Site", { total: 5, answered: 4, open: 1 }, { facts_active: 4, synced_at: NOW });
    expect(cb).toMatchObject({ total: 50, answered: 5, open: 45, facts_active: 6, synced_at: NOW });
    cb = mergeClientBrain(cb, "app1", "", { total: 45, answered: 3, open: 42 }, { facts_active: 3, synced_at: NOW });
    expect(cb).toMatchObject({ total: 50, answered: 7 });
    expect(cb.apps.app1.app_name).toBe("Ops");
  });
});

describe("health formula", () => {
  const palm = { command: 41, payload: 50, insignia: 70, signal: 46, beacon: 17, shield: 18, intercept: 35, engine: 16, orbit: 0 };
  it("without a client-app brain it is the plain pillar mean (unchanged)", () => {
    expect(blendHealth(palm, null)).toBe(33);
    expect(brainComponent({})).toBeNull();
    expect(brainComponent({ client_brain: { total: 0, answered: 0 } })).toBeNull();
  });
  it("Brain completeness is one more equal-weight component and answering raises health", () => {
    const b1 = brainComponent({ client_brain: { total: 45, answered: 1 } });
    expect(b1).toEqual({ score: 2, answered: 1, total: 45 });
    expect(blendHealth(palm, b1)).toBe(30); // (293 + 2) / 10 = 29.5
    expect(blendHealth(palm, brainComponent({ client_brain: { total: 45, answered: 23 } }))).toBe(34); // (293 + 51) / 10 = 34.4
    expect(blendHealth(palm, brainComponent({ client_brain: { total: 45, answered: 45 } }))).toBe(39); // (293 + 100) / 10
    const series = [0, 10, 20, 30, 40, 45].map((n) => blendHealth(palm, brainComponent({ client_brain: { total: 45, answered: n } })));
    expect([...series].sort((a, b) => a - b)).toEqual(series);
  });
  it("never scores a client on the brain alone; ignores unscored pillars; clamps bad counts", () => {
    expect(blendHealth({}, { score: 80 })).toBeNull();
    expect(blendHealth({ a: 50, b: null }, { score: 100 })).toBe(75);
    expect(brainComponent({ client_brain: { total: 10, answered: 99 } })).toEqual({ score: 100, answered: 10, total: 10 });
  });
  it("scoreAll uses the same formula and the backend copy matches the web", () => {
    const base = { client: {}, gaps: [], work: [], files: [], goals: [], autos: [], forms: [], reviews: null };
    const a = scoreAll({ ...base, d: {} });
    const b = scoreAll({ ...base, d: { client_brain: { total: 4, answered: 4 } } });
    const ps = Object.fromEntries(Object.entries(a.by).map(([k, v]) => [k, v.score]));
    expect(a.brain).toBeNull();
    expect(b.brain).toEqual({ score: 100, answered: 4, total: 4 });
    expect(b.health).toBe(blendHealth(ps, b.brain));
    expect(b.health).toBeGreaterThan(a.health);
    expect(backendPillars.scoreAll({ ...base, d: { client_brain: { total: 4, answered: 4 } } }).health).toBe(b.health);
  });
});

describe("reading it back", () => {
  it("ship node: counts from the dossier, latest active non-test answers", () => {
    const facts = [
      { id: "1", source: "client_app", client_id: "c1", status: "active", statement: "A", answered_at: "2026-11-16T01:00:00Z" },
      { id: "2", source: "client_app", client_id: "c1", status: "superseded", statement: "old" },
      { id: "3", source: "client_app", client_id: "c1", status: "active", statement: "T", data: { test: true } },
      { id: "4", source: "interview", client_id: "c1", status: "active", statement: "agency fact" },
      { id: "5", source: "client_app", client_id: "c1", status: "active", statement: "B", answered_at: "2026-11-16T02:00:00Z" },
    ];
    const r = clientBrainOf({ client_brain: { total: 45, answered: 1, apps: { app1: { app_name: "Palm Shore Ops (Base44)", total: 45, answered: 1 } } } }, facts, "c1");
    expect(r).toMatchObject({ answered: 1, total: 45, score: 2, factsActive: 2 });
    expect(r.latest.map((f) => f.id)).toEqual(["5", "1"]);
    expect(r.apps[0].name).toBe("Palm Shore Ops");
    expect(clientBrainOf(null, [], "c1")).toBeNull();
  });
  it("context block lines for agents", () => {
    const L = clientBrainLines({ stats: { total: 45, answered: 1, synced_at: NOW }, facts: [{ area: "materials", question: "Suppliers?", statement: "TPS" }] });
    expect(L.join("\n")).toContain("1/45 questions answered");
    expect(L.join("\n")).toContain("Suppliers? → TPS");
    expect(clientBrainLines({ stats: null, facts: [] })).toEqual([]);
  });
});
