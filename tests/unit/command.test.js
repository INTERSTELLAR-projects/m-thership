// Møthership Command engine (base44/shared/command.js, mirrored in src/features/command/engine.js).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as BE from "../../base44/shared/command.js";
import * as FE from "@/features/command/engine";

const MARK = "// ---- shared body below (keep identical) ----";
const body = (p) => { const t = fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8"); return t.slice(t.indexOf(MARK)); };

const NOW = new Date("2026-11-12T16:10:00Z"); // Thu 8:10am PT
const src = () => ({
  clients: [
    { id: "c1", business: "Palm Shore", contact: "Miguel Gallegos", status: "Active", emails: ["miguel@x.test"], services: [{ interval: "month", price: 700 }] },
    { id: "c2", business: "Lead Co", contact: "Dana Reyes", status: "Lead", pipeline_stage: "contacted", next_step: "Send audit", next_step_at: "2026-11-10", emails: ["dana@x.test"], created_date: "2026-11-01T00:00:00Z" },
    { id: "c3", business: "Call Co", status: "Lead", pipeline_stage: "call_booked", booked_call_at: "2026-11-12T18:30:00Z" },
    { id: "c4", business: "Gone", status: "Inactive", pipeline_stage: "lost" },
  ],
  tasks: [
    { id: "t1", title: "Monthly books close", status: "next", priority: 2, due_date: "2026-11-05", category: "finance" },
    { id: "t2", title: "Get 100 reviews", status: "inbox", priority: 1, due_date: "2026-11-12", category: "marketing", is_focus: true },
    { id: "t3", title: "Finish App", status: "next", priority: 3, client_id: "c1", client_name: "Palm Shore", category: "development", is_focus: true },
    { id: "t4", title: "Already done", status: "done", due_date: "2026-11-01" },
  ],
  tasksDone: [],
  financing: [{ id: "f1", client_id: "c1", client_name: "Palm Shore", title: "Website build", payment_amount: 500, num_payments: 6, first_due_date: "2026-09-01", frequency: "monthly", payments: [{ date: "2026-09-02", amount: 500 }], status: "active" }],
  expenses: [
    { id: "e1", platform: "GB Gmail", amount: 1.99, frequency: "Monthly", dueDay: 9, paidCycles: ["2026-9"] },
    { id: "e2", platform: "Claude", amount: 200, frequency: "Monthly", dueDay: 27, paidCycles: [] },
    { id: "e3", platform: "Domain", amount: 42, frequency: "Annually", dueDay: 1, dueMonth: 11, paidCycles: ["2027"] },
  ],
  ledgerWaiting: [{ id: "w1", title: "Arcane site", client_name: "Arcane Ink", visibility: "client" }],
  ledgerRecent: [{ id: "w1", title: "Arcane site", client_id: "c1", created_date: "2026-11-12T10:00:00Z" }],
  launch: [
    { id: "l1", key: "q:x", title: "PowerLift quote rules?", owner: "justin", status: "todo", week: 2, kind: "question", workstream: "Client: PowerLift", lane: "launch" },
    { id: "l2", key: "m:publish", title: "Publish Møthership", owner: "justin", status: "todo", week: 1, blocking_launch: true, workstream: "Møthership", lane: "launch" },
    { id: "l3", key: "later", title: "2027 thing", owner: "justin", status: "todo", week: 1, workstream: "Website", lane: "2027" },
  ],
  projects: [], claudeJobs: [{ id: "j1", created_date: "2026-11-01T00:00:00Z" }], requests: [],
  research: [{ id: "r1", topic: "AI Mode books pros", department: "delivery", relevance: "high", status: "new", created_at: "2026-11-11T19:00:00Z" }],
  brains: [{ constellation: { pillar_scores: { command: 0, signal: 17, beacon: 0, shield: 0, insignia: 55, orbit: 25, engine: 4 } } }],
  goals: [{ title: "$1M in 2027", target_amount: 1000000, is_primary: true }],
  automations: [], hiring: [], training: [], facts: [], actions: [], ceo: [], errors: [],
});

describe("command engine", () => {
  it("frontend copy stays identical to base44/shared/command.js", () => {
    expect(body("src/features/command/engine.js")).toBe(body("base44/shared/command.js"));
    expect(Object.keys(FE).sort()).toEqual(Object.keys(BE).sort());
  });

  it("reads the owner's day in Pacific time", () => {
    const p = BE.zonedParts(NOW, "America/Los_Angeles");
    expect(p.date).toBe("2026-11-12");
    expect(p.hour * 60 + p.minute).toBe(8 * 60 + 10);
    expect(BE.addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("matches the Financial page's bill rules (0-based monthly cycle, annual roll-over)", () => {
    expect(BE.expenseState({ frequency: "Monthly", dueDay: 9, paidCycles: ["2026-9"] }, "2026-11-12")).toMatchObject({ status: "overdue", cycle: "2026-10" });
    expect(BE.expenseState({ frequency: "Monthly", dueDay: 9, paidCycles: ["2026-10"] }, "2026-11-12").status).toBe("paid");
    expect(BE.expenseState({ frequency: "Annually", dueDay: 1, dueMonth: 11, paidCycles: ["2027"] }, "2026-11-12")).toMatchObject({ status: "paid", due: "2027-11-01" });
  });

  it("finds late payment plans", () => {
    const st = BE.financingState(src().financing[0], "2026-11-12");
    expect(st.health).toBe("late");
    expect(st.late).toBe(2);
    expect(st.behind).toBe(1000);
  });

  it("scores every pillar from data, null where there is none, with transparent inputs", () => {
    const { scores } = BE.computeAll(src(), NOW, {});
    for (const p of BE.PILLARS) {
      const sc = scores[p.id];
      expect(sc.metrics.length).toBeGreaterThan(1);
      expect(sc.confidence).toBeGreaterThanOrEqual(0);
      expect(sc.confidence).toBeLessThanOrEqual(100);
      if (sc.score != null) { expect(sc.score).toBeGreaterThanOrEqual(0); expect(sc.score).toBeLessThanOrEqual(100); }
    }
    expect(scores.finance.metrics.find((m) => m.key === "financing").sub).toBe(0);
    const noPlans = BE.computeAll({ ...src(), financing: [] }, NOW, {}).scores.finance.metrics.find((m) => m.key === "financing");
    expect(noPlans.sub).toBe(null);
  });

  it("builds a day plan with buffers, keeps the booked call, never double-books", () => {
    const { rule } = BE.computeAll(src(), NOW, { name: "Justin Cowell" });
    expect(rule.greeting).toMatch(/^Good morning, Justin\./);
    expect(rule.outcomes).toHaveLength(3);
    expect(new Set(rule.outcomes.map((o) => o.pillar)).size).toBe(3);
    const blocks = rule.plan_today;
    expect(blocks.some((b) => b.kind === "meeting" && b.start === "10:30")).toBe(true);
    for (let i = 1; i < blocks.length; i++) expect(BE.toMin(blocks[i].start)).toBeGreaterThanOrEqual(BE.toMin(blocks[i - 1].end));
    expect(BE.bufferShare(blocks)).toBeGreaterThanOrEqual(0.2);
    expect(BE.toMin(blocks[0].start)).toBeGreaterThanOrEqual(BE.toMin("08:10"));
    expect(blocks[blocks.length - 1].end).toBe("17:30");
  });

  it("re-plans around an interruption", () => {
    const it2 = { date: "2026-11-12", start: "09:00", minutes: 120, text: "Tree emergency" };
    const { rule } = BE.computeAll(src(), NOW, { interruptions: [it2] });
    const block = rule.plan_today.find((b) => b.kind === "interruption");
    expect(block).toMatchObject({ start: "09:00", end: "11:00" });
    const fixedKinds = ["meeting", "interruption", "break"];
    expect(rule.plan_today.filter((b) => !fixedKinds.includes(b.kind) && BE.toMin(b.start) < 660 && BE.toMin(b.end) > 540)).toHaveLength(0);
    const call = rule.plan_today.find((b) => b.kind === "meeting");
    expect(call.conflict).toBe(true);
    expect(call.title).toMatch(/clashes with/);
  });

  it("uses the owner's hours from the Brain", () => {
    expect(BE.parseHours("7:30 to 4")).toEqual({ start: "07:30", end: "16:00" });
    expect(BE.parseHours("9am-6pm weekdays")).toEqual({ start: "09:00", end: "18:00" });
    const facts = [{ question_key: "owner.hours", statement: "9 to 5", status: "active", pillar: "owner" }];
    const { rule } = BE.computeAll({ ...src(), facts }, NOW, {});
    expect(rule.plan_today[rule.plan_today.length - 1].end).toBe("17:00");
  });

  it("only accepts LLM output that references real candidates and keeps fixed blocks", () => {
    const { s, rule } = BE.computeAll(src(), NOW, {});
    const bad = BE.mergeLlmBrief(rule, { greeting: "Hi", outcomes: [{ candidate_id: "made-up", title: "X", why: "Y" }], plan_today: [{ start: "09:00", end: "10:00", title: "x", kind: "focus" }] }, s);
    expect(bad.rejected).toEqual(expect.arrayContaining(["outcomes", "plan_today"]));
    expect(bad.brief.outcomes).toEqual(rule.outcomes);
    const good = BE.mergeLlmBrief(rule, { greeting: "Morning.", outcomes: rule.cands.slice(0, 3).map((c) => ({ candidate_id: c.id, title: c.title + " done", why: c.why })), plan_today: rule.plan_today.map((b) => ({ ...b, candidate_id: b.cand })) }, s);
    expect(good.source).toBe("llm");
    expect(good.brief.greeting).toBe(rule.greeting);
    expect(good.brief.focus).toBe("Morning.");
    expect(good.brief.outcomes[0].ref).toEqual(rule.cands[0].ref);
    const invented = BE.mergeLlmBrief(rule, { greeting: "x", outcomes: [], plan_today: [], since_yesterday: ["We closed 99 deals."] }, s);
    expect(invented.rejected).toContain("since_yesterday");
  });

  it("proposes only safe cards: external sends are drafts, money is a record, no deletes", () => {
    const { s, scores } = BE.computeAll(src(), NOW, {});
    const props = BE.ruleProposals(s, scores);
    const keys = props.map((p) => p.dedupe_key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of props) {
      expect(p.status).toBe("pending");
      if (p.kind === "send_email") { expect(p.risk).toBe("external"); expect(p.payload.to).toMatch(/@/); }
      if (p.kind === "record_change") for (const ch of p.payload.changes) expect(["Task", "Expense", "WorkEntry", "CRMClient", "LaunchItem"]).toContain(ch.entity);
      expect(JSON.stringify(p)).not.toMatch(/delete/i);
    }
    expect(props.some((p) => p.kind === "send_email" && p.payload.to === "miguel@x.test")).toBe(true); // late plan reminder
    expect(props.some((p) => p.kind === "send_email" && p.payload.to === "dana@x.test")).toBe(true); // overdue lead
    expect(props.some((p) => p.kind === "record_change" && p.payload.changes[0].entity === "Expense")).toBe(true);
    expect(props.filter((p) => p.source === "brain")).toHaveLength(1);
  });

  it("asks the Brain's questions in order and never twice", () => {
    expect(BE.nextQuestion([], null).key).toBe("owner.hours");
    const after = BE.nextQuestion([{ question_key: "owner.hours", status: "active" }], null);
    expect(after.key).not.toBe("owner.hours");
    const covered = BE.nextQuestion([{ question_key: "owner.hours" }, { question_key: "x", data: { covers: BE.BRAIN_QUESTIONS.map((q) => q.key) } }], null);
    expect(covered).toBe(null);
  });

  it("parses spoken and typed orders without the LLM", () => {
    expect(BE.fallbackIntent("Something came up, need 2 hours")).toMatchObject({ type: "interruption", minutes: 120 });
    expect(BE.fallbackIntent("remind me to call Tyler")).toMatchObject({ type: "create_task", title: "call Tyler" });
    expect(BE.fallbackIntent("Remember: Fridays are off")).toMatchObject({ type: "brain_fact" });
    expect(BE.fallbackIntent("how is money")).toMatchObject({ type: "answer" });
  });

  it("uses the Brain's hours, work days and fixed life blocks (Mon-Fri 9-6, gym/food 7:30-9)", () => {
    const facts = [
      { question_key: "owner.hours", statement: "I work Monday to Friday, 9am to 6pm, with weekends off.", status: "active", pillar: "owner", data: BE.factData("owner.hours", "i work Monday-Friday 9am-6pm and weekends off", "") },
      { question_key: "owner.fixed_life", statement: "Gym and food happen from 7:30am-9am.", status: "active", pillar: "owner" },
    ];
    expect(facts[0].data).toEqual({ start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] });
    const thu = BE.computeAll({ ...src(), facts }, new Date("2026-11-12T15:00:00Z"), {}); // Thu 7:00am PT
    const plan = thu.rule.plan_today;
    expect(plan[0]).toMatchObject({ start: "07:30", end: "09:00", title: "Gym and food", kind: "life" });
    expect(plan[plan.length - 1].end).toBe("18:00");
    expect(plan.filter((b) => b.kind === "focus").every((b) => BE.toMin(b.start) >= 540)).toBe(true);
    expect(thu.rule.gaps.join(" ")).not.toMatch(/default/);
    expect(thu.rule.day_after).toMatchObject({ off: true }); // Saturday
    const sat = BE.computeAll({ ...src(), facts }, new Date("2026-11-14T18:00:00Z"), {}); // Sat 10am PT
    expect(sat.s.dayOff).toBe(true);
    expect(sat.rule.plan_today).toHaveLength(1);
    expect(sat.rule.plan_today[0].title).toMatch(/Day off/);
  });

  it("cleans dictated answers by rule when the AI is unavailable, and only trusts faithful AI clean-ups", () => {
    expect(BE.ruleClean("i work Monday-Friday 9am-6pm and weekends off")).toBe("I work Monday-Friday 9am-6pm and weekends off.");
    expect(BE.ruleClean("um they should use ebay and tcg   to check prices")).toBe("They should use eBay and TCG to check prices.");
    expect(BE.ruleClean("the mothership is great. i'm happy")).toBe("The Møthership is great. I'm happy.");
    expect(BE.cleanIsFaithful("i work 9am-6pm", ["I work 9am to 6pm."])).toBe(true);
    expect(BE.cleanIsFaithful("i work 9am-6pm", ["I work 10am to 6pm."])).toBe(false); // changed a number
    expect(BE.cleanIsFaithful("a typical client pays 2500 for a site and 500 a month for care and maintenance work", ["Clients pay."])).toBe(false); // summarised away
    expect(BE.parseLifeBlocks("School run 3pm-3:45pm and gym 6-7am")).toEqual([{ start: "15:00", end: "15:45", title: "School run" }, { start: "06:00", end: "07:00", title: "And gym" }]);
  });
});
