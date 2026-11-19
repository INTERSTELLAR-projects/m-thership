// Task Matrix (src/features/tasks/lib/matrix.js): priority ladder, board and swimlanes.
import { describe, it, expect } from "vitest";
import { ladder, board, lanes, blockedReason, agentOf } from "@/features/tasks/lib/matrix";

const today = new Date().toISOString().slice(0, 10);
const T = [
  { id: "a", title: "A", status: "doing", priority: 2, client_id: "c1", client_name: "One", category: "content" },
  { id: "b", title: "B", status: "next", priority: 1, client_id: "c1", client_name: "One", category: "design", is_focus: true },
  { id: "c", title: "C", status: "blocked", priority: 1, client_id: "c2", client_name: "Two", blocked_reason: "Waiting on access" },
  { id: "d", title: "D", status: "inbox", priority: 3, due_date: today },
  { id: "e", title: "E", status: "done", completed_at: new Date().toISOString() },
];

describe("task matrix", () => {
  it("ladder: focus first, blocked apart, done today counted, done never open", () => {
    const l = ladder(T, [T[4]]);
    expect(l.focus[0].id).toBe("b");
    expect(l.focus.map((t) => t.id)).not.toContain("c");
    expect(l.blocked.map((t) => t.id)).toEqual(["c"]);
    expect(l.doneToday.map((t) => t.id)).toEqual(["e"]);
    expect(l.focus.concat(l.next).map((t) => t.id)).not.toContain("e");
  });
  it("board and lanes skip finished work", () => {
    const b = board(T);
    expect(b.doing.length + b.next.length + b.blocked.length + b.inbox.length).toBe(4);
    const byClient = lanes(T, "client");
    expect(byClient.find((r) => r.key === "c2").hot).toBe(1);
    expect(byClient.find((r) => r.key === "interstellar").total).toBe(1);
    expect(lanes(T, "department").map((r) => r.label)).toContain("Content");
  });
  it("blocked reasons and agents come from the record only", () => {
    expect(blockedReason(T[2])).toBe("Waiting on access");
    expect(blockedReason({ notes: "\n Client away " })).toBe("Client away");
    expect(blockedReason({})).toMatch(/No reason/);
    expect(agentOf({ source: "ai" })).toBe("Claude");
    expect(agentOf({})).toBe("");
  });
});
