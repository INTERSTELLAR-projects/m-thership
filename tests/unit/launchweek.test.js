import { describe, it, expect } from "vitest";
import fs from "node:fs";
import * as L from "../../base44/shared/launchWeek.js";

// Minimal entities store with the SDK's shape (filter / get / create / update / list).
function fakeDb() {
  const store = {};
  let n = 0;
  const rows = (name) => (store[name] = store[name] || []);
  const match = (r, q = {}) => Object.entries(q).every(([k, v]) => r[k] === v);
  const api = (name) => ({
    list: async () => [...rows(name)],
    filter: async (q) => rows(name).filter((r) => match(r, q)),
    get: async (id) => rows(name).find((r) => r.id === id) || null,
    create: async (d) => { const r = { id: `${name}_${++n}`, ...d }; rows(name).push(r); return r; },
    update: async (id, d) => { const r = rows(name).find((x) => x.id === id); if (r) Object.assign(r, d); return r; },
  });
  return { store, db: new Proxy({}, { get: (_, name) => api(String(name)) }) };
}

const FILE = {
  client_name: "PowerLift Doors of Oregon", app_id: "6a88eef3dc9768005ce14d52", preview_url: "https://preview.test", launch_readiness_pct: 78,
  status_summary: "Almost there.", done: ["Home page"], blocking: ["Form routing"], screenshots: ["/mnt/user-data/outputs/x.png"],
  questions: [
    { id: "q1", question: "Where should the quote form go?", default_answer: "Email Tyler", options: ["Email", "CRM"], blocks_launch: true, category: "forms", apply_to: "Contact" },
    { id: "q2", question: "Which hero photo?", default_answer: "Door install", options: [], blocks_launch: true, category: "design", apply_to: "Home hero" },
    { id: "q3", question: "Add financing banner?", default_answer: "No", options: ["Yes", "No"], blocks_launch: false, category: "offers", apply_to: "Home" },
  ],
};
const CRM = [{ id: "6a6c13548653b2e1e6c3de46", business: "PowerLift Doors of Oregon", site_app_id: "6a88eef3dc9768005ce14d52", logo_url: "https://logo.test/p.png" }];

describe("Launch Week importer", () => {
  it("upserts by question_id and never duplicates", async () => {
    const { db, store } = fakeDb();
    const r1 = await L.lwImport(db, FILE, "powerlift", { clients: CRM });
    expect(r1).toMatchObject({ created: 3, updated: 0, total: 3, client_name: "PowerLift Doors of Oregon" });
    expect(store.LaunchQuestion.map((q) => q.question_id)).toEqual(["powerlift:q1", "powerlift:q2", "powerlift:q3"]);
    expect(store.LaunchQuestion[0]).toMatchObject({ client_id: "6a6c13548653b2e1e6c3de46", status: "open", blocks_launch: true });
    expect(store.LaunchClientStatus).toHaveLength(1);
    expect(store.LaunchClientStatus[0]).toMatchObject({ launch_readiness_pct: 78, logo_url: "https://logo.test/p.png", screenshots: [] });

    // Answer one, then re-import with a reworded question: no duplicates, the answer survives.
    await L.lwAnswer(db, store.LaunchQuestion[0].id, { statements: ["Email Tyler"], mode: "default" });
    const again = { ...FILE, launch_readiness_pct: 80, questions: [{ ...FILE.questions[0], question: "Where should quote-form submissions go?" }, ...FILE.questions.slice(1)] };
    const r2 = await L.lwImport(db, again, "powerlift", { clients: CRM, screenshots: ["https://cdn.test/s1.png"] });
    expect(r2).toMatchObject({ created: 0, updated: 1 });
    expect(store.LaunchQuestion).toHaveLength(3);
    expect(store.LaunchQuestion[0]).toMatchObject({ question: "Where should quote-form submissions go?", status: "answered", answer: "Email Tyler" });
    expect(store.LaunchClientStatus).toHaveLength(1);
    expect(store.LaunchClientStatus[0]).toMatchObject({ launch_readiness_pct: 80, screenshots: ["https://cdn.test/s1.png"] });
    const r3 = await L.lwImport(db, again, "powerlift", { clients: CRM });
    expect(r3).toMatchObject({ created: 0, updated: 0 });
    expect(store.LaunchClientStatus[0].screenshots).toEqual(["https://cdn.test/s1.png"]);
  });

  it("rejects unknown slugs and drops duplicate ids inside one file", async () => {
    const { db } = fakeDb();
    await expect(L.lwImport(db, FILE, "nope")).rejects.toThrow(/Unknown/);
    const dup = L.lwNormalize({ questions: [{ id: "a", question: "One?" }, { id: "a", question: "Two?" }, { question: "No id?" }] }, "redline", { client_id: "x", client_name: "Redline Visuals" });
    expect(dup.questions.map((q) => q.question_id)).toEqual(["redline:a", "redline:q3"]);
  });
});

describe("Launch Week answers", () => {
  it("saves a client-tagged BrainFact and supersedes it when re-answered", async () => {
    const { db, store } = fakeDb();
    await L.lwImport(db, FILE, "powerlift", { clients: CRM });
    const q = store.LaunchQuestion[2];
    const r = await L.lwAnswer(db, q.id, { statements: ["Yes"], mode: "option", today: "2026-11-16" });
    expect(r.question).toMatchObject({ status: "answered", answer: "Yes", answer_mode: "option" });
    expect(store.BrainFact).toHaveLength(1);
    expect(store.BrainFact[0]).toMatchObject({ client_name: "PowerLift Doors of Oregon", pillar: "sales", status: "active", question_key: "launchweek.powerlift:q3", source: "interview", date: "2026-11-16" });
    expect(store.BrainFact[0].statement).toMatch(/PowerLift Doors of Oregon website launch: Add financing banner\? Yes/);

    // Dictated answer: the reviewed sentences are stored as they are, raw text kept.
    await L.lwAnswer(db, q.id, { statements: ["Yes, add a financing banner under the hero.", "Mention 0% for 12 months."], raw_text: "uh yes add a financing banner under the hero and mention zero percent for twelve months", mode: "voice" });
    expect(store.BrainFact.filter((f) => f.status === "active").map((f) => f.statement)).toEqual(["Yes, add a financing banner under the hero.", "Mention 0% for 12 months."]);
    expect(store.BrainFact[0].status).toBe("superseded");
    expect(store.LaunchQuestion[2].raw_text).toMatch(/^uh yes/);
    expect(store.LaunchQuestion[2].brain_fact_ids).toHaveLength(2);
  });

  it("refuses credentials", async () => {
    const { db, store } = fakeDb();
    await L.lwImport(db, FILE, "powerlift", { clients: CRM });
    await expect(L.lwAnswer(db, store.LaunchQuestion[0].id, { statements: ["The password: hunter2 1234"], raw_text: "password: 1234", mode: "typed" })).rejects.toThrow(/password/i);
  });
});

describe("Launch Week job", () => {
  it("queues one ClaudeJob when every blocking question is answered, with the answers bundled", async () => {
    const { db, store } = fakeDb();
    await L.lwImport(db, FILE, "powerlift", { clients: CRM });
    const [q1, q2, q3] = store.LaunchQuestion;
    await L.lwSetStatus(db, q3.id, "ask_client");
    let r = await L.lwAnswer(db, q1.id, { statements: ["Email Tyler"], mode: "default" });
    expect(r.job).toBeNull();
    expect(store.ClaudeJob || []).toHaveLength(0);
    r = await L.lwAnswer(db, q2.id, { statements: ["Use the black door install photo."], raw_text: "black door install photo", mode: "voice" });
    expect(r.job).toMatchObject({ created: true, status: "queued" });
    expect(store.ClaudeJob).toHaveLength(1);
    const job = store.ClaudeJob[0];
    expect(job).toMatchObject({ title: "Apply launch answers to PowerLift Doors of Oregon site", kind: "build_website", client_id: "6a6c13548653b2e1e6c3de46", status: "queued", priority: 1 });
    expect(job.instructions).toMatch(/Email Tyler/);
    expect(job.instructions).toMatch(/Use the black door install photo\./);
    expect(job.instructions).toMatch(/\[Ask client\] Add financing banner\?/);
    expect(job.instructions).toMatch(/Do NOT publish/);
    expect(job.context.answers).toHaveLength(2);
    expect(store.LaunchClientStatus[0].job_id).toBe(job.id);

    // A later answer refreshes the still-queued job instead of creating a second one.
    r = await L.lwAnswer(db, q3.id, { statements: ["No"], mode: "option" });
    expect(r.job).toMatchObject({ id: job.id, refreshed: true });
    expect(store.ClaudeJob).toHaveLength(1);
    expect(store.ClaudeJob[0].context.answers).toHaveLength(3);
    // Once the runner picked it up, it is left alone.
    store.ClaudeJob[0].status = "running";
    r = await L.lwAnswer(db, q3.id, { statements: ["Yes"], mode: "option" });
    expect(r.job).toMatchObject({ refreshed: false });
    expect(store.ClaudeJob).toHaveLength(1);
  });

  it("ready rules and progress", () => {
    const q = (blocks_launch, status) => ({ blocks_launch, status });
    expect(L.lwReadyForJob([q(true, "answered"), q(false, "open")])).toBe(true);
    expect(L.lwReadyForJob([q(true, "answered"), q(true, "ask_client")])).toBe(false);
    expect(L.lwReadyForJob([q(false, "answered"), q(false, "skipped")])).toBe(true);
    expect(L.lwReadyForJob([q(false, "answered"), q(false, "open")])).toBe(false);
    expect(L.lwReadyForJob([q(false, "skipped")])).toBe(false);
    expect(L.lwProgress([q(true, "answered"), q(true, "ask_client"), q(false, "open")])).toMatchObject({ total: 3, answered: 1, ask_client: 1, open: 1, blocking_total: 2, blocking_answered: 1 });
  });

  it("builds the Ask client text", () => {
    const t = L.lwAskClientText("Redline Visuals", [{ status: "ask_client", question: "Which logo?", options: ["Red", "Black"] }, { status: "open", question: "x" }], "Jacob");
    expect(t).toMatch(/^Hi Jacob! A few quick questions so we can finish the new Redline Visuals website:/);
    expect(t).toMatch(/1\. Which logo\? \(Red \/ Black\)/);
    expect(t).not.toMatch(/\bx\b/);
  });
});

describe("Launch Week cross-client questions", () => {
  const pack = (name, appId, ga4) => ({ client_name: name, app_id: appId, preview_url: "https://p.test", launch_readiness_pct: 50,
    questions: [{ id: "x-q1", question: "Hours?", default_answer: "9-5", blocks_launch: true, category: "hours" }, { id: "x-q2", question: ga4, default_answer: "Yes", options: ["Yes", "Skip"], blocks_launch: false, category: "seo", apply_to: `gtag on ${name}` }] });
  it("stores the GA4 question once, applies the answer to every site and rides along in each job", async () => {
    const { db, store } = fakeDb();
    await L.lwImport(db, pack("PowerLift Doors of Oregon", "a1", "No GA4 tag on the site. Set up a GA4 property?"), "powerlift");
    await L.lwImport(db, pack("Redline Visuals", "a2", "Set up an Interstellar-owned GA4 property?"), "redline");
    await L.lwImport(db, pack("Redline Visuals", "a2", "Set up an Interstellar-owned GA4 property?"), "redline"); // re-import: no duplicates
    const all = store.LaunchQuestion.filter((q) => q.slug === "all");
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ question_id: "all:ga4", scope: "all", client_name: "All 2 sites", blocks_launch: false });
    expect(all[0].covers.map((c) => [c.slug, c.question_id, c.apply_to])).toEqual([["powerlift", "powerlift:x-q2", "gtag on PowerLift Doors of Oregon"], ["redline", "redline:x-q2", "gtag on Redline Visuals"]]);
    expect(store.LaunchQuestion.filter((q) => q.slug === "powerlift").map((q) => q.question_id)).toEqual(["powerlift:x-q1"]);
    // "powerlift-q1" style ids are normalised, never double-prefixed
    expect(L.lwQuestionId("powerlift", "powerlift-q1")).toBe("powerlift:q1");

    const r = await L.lwAnswer(db, all[0].id, { statements: ["Yes, Interstellar-owned GA4 on all of them"], mode: "option" });
    expect(r.question.status).toBe("answered");
    expect(store.BrainFact.map((f) => f.client_name)).toEqual(["PowerLift Doors of Oregon", "Redline Visuals"]);
    expect(store.BrainFact[0].statement).toMatch(/same answer for all 2 launch sites/);
    expect(r.jobs).toHaveLength(0); // the blocking questions are still open
    const pl = store.LaunchQuestion.find((q) => q.question_id === "powerlift:x-q1");
    const j = await L.lwAnswer(db, pl.id, { statements: ["9-5"], mode: "default" });
    expect(j.job).toMatchObject({ created: true });
    const job = store.ClaudeJob[0];
    expect(job.instructions).toMatch(/one answer for every launch site/);
    expect(job.instructions).toMatch(/Apply to: gtag on PowerLift Doors of Oregon/);
    expect(job.context.answers.find((a) => a.all_sites)).toMatchObject({ answer: "Yes, Interstellar-owned GA4 on all of them" });
  });
});

describe("Launch Week core copy", () => {
  it("the browser copy matches the backend copy", () => {
    const MARK = "// ---- shared body below (keep identical) ----";
    const a = fs.readFileSync(new URL("../../base44/shared/launchWeek.js", import.meta.url), "utf8").split(MARK)[1];
    const b = fs.readFileSync(new URL("../../src/features/launchweek/core.js", import.meta.url), "utf8").split(MARK)[1];
    expect(b).toBe(a);
  });
});
