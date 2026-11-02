// "The one thing" for today (priority rules), its optional AI polish (cached per day),
// and the short spoken script Core reads aloud. Facts only: every word comes from loadBriefing().
import { base44 } from "@/api/base44Client";
import { compactMoney, money } from "@/components/financial/finance/metrics";
import { dayKey, writeBriefingCache } from "./loadBriefing";

const timeOf = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const clientPart = (name) => (name ? ` (${name})` : "");

// Ordered rules: the first that fires is today's one thing.
export function pickOneThing(b) {
  const call = b.pipeline.callsToday[0];
  if (call) return { key: "call", text: `Strategy call with ${call.c.business || "a lead"} at ${timeOf(call.call.at)}. Prep before you dial.`, to: "/pipeline" };

  const urgent = b.requests.urgent[0];
  if (urgent) return { key: "urgent", text: `Urgent request from ${urgent.client_name || "a client"}: ${urgent.title}.`, to: urgent.client_id ? `/clients/${urgent.client_id}?tab=requests` : "/requests" };

  const legalLate = b.legal.overdue[0];
  if (legalLate) return { key: "legal", text: `Legal deadline passed: ${legalLate.item.task}. Handle it first.`, to: "/legal" };
  if (b.legal.next && b.legal.next.days <= 7) return { key: "legal-soon", text: `${b.legal.next.item.task} is due in ${plural(b.legal.next.days, "day")}.`, to: "/legal" };

  const hot = b.tasks.overdue.find((t) => (t.priority || 3) <= 2);
  if (hot) return { key: "task-late", text: `Clear the overdue ${hot.title}${clientPart(hot.client_name)}.`, to: hot.client_id ? `/clients/${hot.client_id}?tab=tasks` : "/tasks" };

  if (b.claude.waiting.length) return { key: "claude", text: `Approve ${plural(b.claude.waiting.length, "Claude job")} waiting on your OK.`, to: "/claude" };

  if (b.money.overdueBills.length) return { key: "bills", text: `Pay ${plural(b.money.overdueBills.length, "overdue bill")} (${money(b.money.overdueBillsTotal)}).`, to: "/financial?tab=overview" };

  const step = b.pipeline.overdueSteps[0];
  if (step) return { key: "followup", text: `Follow up with ${step.business || "a lead"}${step.next_step ? `: ${step.next_step}` : ""}.`, to: "/pipeline" };

  if (b.pipeline.newLeads.length) return { key: "leads", text: `Reach out to ${plural(b.pipeline.newLeads.length, "new lead")}.`, to: "/pipeline" };

  const late = b.tasks.overdue[0];
  if (late) return { key: "task-late2", text: `Clear the overdue ${late.title}${clientPart(late.client_name)}.`, to: late.client_id ? `/clients/${late.client_id}?tab=tasks` : "/tasks" };

  const focus = b.tasks.focus[0];
  if (focus) return { key: "focus", text: `Ship your focus task: ${focus.title}${clientPart(focus.client_name)}.`, to: "/tasks" };

  const site = b.sites.find((s) => s.critical.length);
  if (site) return { key: "site", text: `Fix ${site.name}'s critical site issue: ${site.critical[0]}.`, to: "/performance" };

  if (!b.goal.onPace && b.goal.clientsNeeded) return { key: "goal", text: `Close ${plural(b.goal.clientsNeeded, "more account")} to get on pace for ${b.goal.title}.`, to: "/financial?tab=goal" };

  return { key: "clear", text: "Clear runway. Pull the next task from Next up.", to: "/tasks" };
}

// ---------- Optional AI polish, cached per day ----------
const digits = (s) => (String(s).match(/\d+(?:[.,]\d+)?/g) || []).map((d) => d.replace(/,/g, ""));

// Polishes the rule line once per day (or when the rule line changes). Never adds a fact:
// output with any number not in the input, or longer than the input, is thrown away.
export async function polishOneThing(b, one) {
  const today = dayKey();
  const c = b.cache.data || {};
  if (c.one_date === today && c.one_raw === one.text) return c.one_polished || null;
  let line = null;
  try {
    const out = await base44.integrations.Core.InvokeLLM({
      prompt: [
        "Rewrite this one-line daily focus for a busy agency founder so it reads crisp and decisive.",
        "Rules: imperative voice, 16 words max, no emojis, no exclamation marks.",
        "Use ONLY the facts in the line. Do not add names, numbers, times, reasons or advice that are not in it.",
        "If it is already crisp, return it unchanged.",
        `Line: ${one.text}`,
      ].join("\n"),
      response_json_schema: { type: "object", properties: { line: { type: "string" } }, required: ["line"] },
    });
    const cand = String((out && out.line) || "").trim();
    const allowed = new Set(digits(one.text));
    const clean = cand && cand.split(/\s+/).length <= 18 && digits(cand).every((d) => allowed.has(d));
    line = clean ? cand : null;
  } catch {
    line = null;
  }
  await writeBriefingCache(b.cache, { one_date: today, one_raw: one.text, one_polished: line });
  return line;
}

// ---------- Spoken script (≤ ~60 seconds) ----------
const MAX_WORDS = 140;

export function spokenBriefing(b, oneLine, firstName) {
  const now = new Date();
  const hour = now.getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const date = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const lines = [`${hello}${firstName ? `, ${firstName}` : ""}. It's ${date}.`, `The one thing: ${oneLine}`];

  const t = b.tasks;
  if (t.due.length) lines.push(`Tasks: ${t.dueToday} due today${t.overdue.length ? `, ${t.overdue.length} overdue` : ""}.`);
  if (b.claude.waiting.length) lines.push(`Claude has ${plural(b.claude.waiting.length, "job")} waiting for approval.`);
  const p = b.pipeline;
  const pipe = [];
  if (p.callsToday.length) pipe.push(`${plural(p.callsToday.length, "call")} today`);
  else if (p.callsWeek.length) pipe.push(`${plural(p.callsWeek.length, "call")} this week`);
  if (p.newLeads.length) pipe.push(plural(p.newLeads.length, "new lead"));
  if (p.overdueSteps.length) pipe.push(`${plural(p.overdueSteps.length, "follow-up")} overdue`);
  if (pipe.length) lines.push(`Pipeline: ${pipe.join(", ")}.`);
  if (b.requests.open.length) lines.push(`${plural(b.requests.open.length, "client request")} open${b.requests.urgent.length ? `, ${b.requests.urgent.length} urgent` : ""}.`);
  const m = b.money;
  lines.push(`Money: ${money(m.mrr)} a month recurring${m.collectedThisMonth != null ? `, ${money(m.collectedThisMonth)} collected this month` : ""}${m.overdueBills.length ? `, ${plural(m.overdueBills.length, "bill")} overdue` : ""}.`);
  const g = b.goal;
  if (g.target) lines.push(`Goal: projected ${compactMoney(g.projected)} of ${compactMoney(g.target)}, ${g.onPace ? "on pace" : "behind pace"}.`);
  if (b.sites.length) lines.push(`${plural(b.sites.length, "site")} flagged in Performance.`);
  const newReviews = b.reviews.reduce((n, r) => n + r.fresh, 0);
  if (newReviews) lines.push(`${plural(newReviews, "new Google review")} this week.`);
  if (b.legal.next) lines.push(`Next legal deadline: ${b.legal.next.item.task}, in ${plural(b.legal.next.days, "day")}.`);
  if (b.outreach && b.outreach.waiting) lines.push(`${plural(b.outreach.waiting, "outreach draft")} to approve.`);
  lines.push("That's the brief.");

  // Keep it under a minute: drop middle lines until it fits (greeting, one thing and sign-off stay).
  const words = (arr) => arr.join(" ").split(/\s+/).length;
  while (words(lines) > MAX_WORDS && lines.length > 3) lines.splice(lines.length - 2, 1);
  return lines.join(" ");
}

// Core voice entry point: load, pick, use today's cached polish if any, return the script.
export async function briefingScript(firstName) {
  const { loadBriefing } = await import("./loadBriefing");
  const b = await loadBriefing();
  const one = pickOneThing(b);
  const c = b.cache.data || {};
  const line = c.one_date === dayKey() && c.one_raw === one.text && c.one_polished ? c.one_polished : one.text;
  return spokenBriefing(b, line, firstName);
}
