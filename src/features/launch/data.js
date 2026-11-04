// Road to Dec 31: LaunchItem data, the launch math and the 9-week plan.
// The same summary math runs server-side in base44/functions/launch (summary) and in the Commander brief
// (functions/agents ceoContext), so the page, the API and the daily brief always agree.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export const LAUNCH_DATE = "2026-12-31";
export const LAUNCH_END = new Date("2026-12-31T23:59:59-08:00");

// Week 1 starts the day the plan was written (Wed Nov 4); weeks 2-9 run Monday to Sunday.
export const WEEKS = [
  { n: 1, from: "2026-11-04", to: "2026-11-08", label: "Nov 4–8", theme: "Unblock", note: "Answer the questions, add the Anthropic key, approve North Woods stage 1, card-number cleanup." },
  { n: 2, from: "2026-11-09", to: "2026-11-15", label: "Nov 9–15", theme: "Clean slate", note: "Claude QA pass on Møthership + portal; you clear the approvals inbox and publish Møthership." },
  { n: 3, from: "2026-11-16", to: "2026-11-22", label: "Nov 16–22", theme: "Portal live", note: "Invites go out; first engines start (Mow Masters, Palm Shore, Velocity, Arcane Ink); first two site moves ready." },
  { n: 4, from: "2026-11-23", to: "2026-11-29", label: "Nov 23–29", theme: "Thanksgiving week", note: "Light week for you: two cutovers (North Woods, PowerLift). Claude writes the Spanish site." },
  { n: 5, from: "2026-11-30", to: "2026-12-06", label: "Nov 30–Dec 6", theme: "Sites move", note: "Royalz + Chasing Gains cutovers; Palm Shore Ops published." },
  { n: 6, from: "2026-12-07", to: "2026-12-13", label: "Dec 7–13", theme: "Sites move", note: "Muscle Mentor, Redline, Bobablastic cutovers; North Woods app stages finish." },
  { n: 7, from: "2026-12-14", to: "2026-12-20", label: "Dec 14–20", theme: "Website launch", note: "interstellar-strategies.com cutover; North Woods app go-live; Rein, Bulba, SMPL cutovers." },
  { n: 8, from: "2026-12-21", to: "2026-12-27", label: "Dec 21–27", theme: "Christmas buffer", note: "Only retire the booking + QR apps. Claude sweeps every client for stragglers." },
  { n: 9, from: "2026-12-28", to: "2026-12-31", label: "Dec 28–31", theme: "Launch", note: "Final sweep, every engine running, 2027 lane handed over." },
];

export const WORKSTREAM_ORDER = ["Møthership", "Portal", "Website", "Automations & Agents", "Clients", "Client apps", "Billing & Accounts", "Security"];
export const streamOf = (i) => (String(i.workstream || "").startsWith("Client:") ? "Clients" : i.workstream || "Other");

export function daysLeft(now = new Date()) {
  return Math.max(0, Math.ceil((LAUNCH_END.getTime() - now.getTime()) / 86400000));
}
export function currentWeek(now = new Date()) {
  const d = now.toISOString().slice(0, 10);
  const w = WEEKS.find((x) => d >= x.from && d <= x.to);
  return w ? w.n : d < WEEKS[0].from ? 1 : 9;
}

const w = (i) => Math.max(0.5, Number(i.effort_hours) || 1);
const isDone = (i) => i.status === "done";
export const isLaunchGap = (i) => (i.lane || "launch") === "launch" && (i.kind || "gap") === "gap" && i.status !== "deferred";
export const pctOf = (rows) => {
  const t = rows.reduce((n, i) => n + w(i), 0);
  return t ? Math.round((rows.filter(isDone).reduce((n, i) => n + w(i), 0) / t) * 100) : 0;
};

export function summarize(items) {
  const live = items.filter(isLaunchGap);
  const byKey = Object.fromEntries(items.map((i) => [i.key, i]));
  const streams = WORKSTREAM_ORDER.map((name) => {
    const rows = live.filter((i) => streamOf(i) === name);
    return { name, rows, pct: pctOf(rows), open: rows.filter((i) => !isDone(i)).length, blocking: rows.filter((i) => !isDone(i) && i.blocking_launch).length };
  }).filter((s) => s.rows.length);
  const open = live.filter((i) => !isDone(i));
  const blockedBy = (i) => (i.depends_on || []).map((k) => byKey[k]).filter((d) => d && d.status !== "done" && !(d.kind === "question" && d.answer));
  const moves = open
    .filter((i) => i.owner === "justin")
    .sort((a, b) => (blockedBy(a).length ? 1 : 0) - (blockedBy(b).length ? 1 : 0) || (Number(b.unblocks) || 0) - (Number(a.unblocks) || 0) || (Number(a.priority) || 3) - (Number(b.priority) || 3) || (a.week || 9) - (b.week || 9));
  const questions = items.filter((i) => i.kind === "question" && i.status !== "deferred").sort((a, b) => (a.answer ? 1 : 0) - (b.answer ? 1 : 0) || (Number(b.unblocks) || 0) - (Number(a.unblocks) || 0));
  const claude = open.filter((i) => i.owner === "claude").sort((a, b) => (a.week || 9) - (b.week || 9) || (b.blocking_launch ? 1 : 0) - (a.blocking_launch ? 1 : 0));
  return {
    overall: pctOf(live), live, open, streams, moves, questions, claude, blockedBy,
    clientOwned: open.filter((i) => i.owner === "client"),
    blockingOpen: open.filter((i) => i.blocking_launch).length,
    later: items.filter((i) => i.lane === "2027"),
    byKey,
  };
}

export function useLaunchItems() {
  return useQuery({
    queryKey: ["LaunchItem", "all"],
    queryFn: async () => (await base44.entities.LaunchItem.list("priority", 1000)) || [],
    staleTime: 15_000,
  });
}

export function useLaunchMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["LaunchItem"] });
  return {
    refresh,
    setDone: async (item, done, by = "justin") => {
      await base44.entities.LaunchItem.update(item.id, done ? { status: "done", done_at: new Date().toISOString(), done_by: by } : { status: "todo", done_at: null, done_by: null });
      refresh();
    },
    answer: async (item, text) => {
      const t = String(text || "").trim();
      await base44.entities.LaunchItem.update(item.id, t ? { answer: t, answered_at: new Date().toISOString(), status: "done", done_at: new Date().toISOString(), done_by: "justin" } : { answer: "", answered_at: null, status: "todo" });
      refresh();
    },
  };
}

export const fmtHours = (h) => {
  const n = Number(h) || 0;
  if (n < 1) return `${Math.max(5, Math.round(n * 60 / 5) * 5)} min`;
  return `${Math.round(n * 10) / 10} h`;
};
