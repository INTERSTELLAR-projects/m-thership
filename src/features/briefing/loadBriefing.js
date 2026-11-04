// Command Briefing: every fact on Mission Control's briefing, read from the CURRENT entities.
// Nothing is invented. A missing source becomes null / [] and its section collapses.
// Money uses the exact Financial math (fetchFinanceRaw + computeFinance + computeGoal).
import { base44 } from "@/api/base44Client";
import { fetchFinanceRaw } from "@/components/financial/finance/useFinanceData";
import { computeFinance, computeGoal, goalDefaults } from "@/components/financial/finance/metrics";
import { enrichExpense } from "@/components/financial/finance/expenses";
import { computeDeadline } from "@/features/legal/legalDates";
import { OPEN_STAGES, bookedCallOf, isLeadish, isOverdue, stageOf } from "@/features/pipeline/pipeline";
import { OPEN_STATUSES } from "@/features/tasks/lib/constants";
import { loadAgentsBriefing } from "@/features/agents/briefing";

const DAY = 86400000;
const OPEN_REQ = ["received", "in_progress", "needs_info"];
const SETTINGS_KEY = "command_briefing";

const arr = (p) => Promise.resolve(p).then((r) => (Array.isArray(r) ? r : (r && r.items) || [])).catch(() => []);
const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// ---------- Briefing cache (AppSettings key = command_briefing) ----------
export async function readBriefingCache() {
  const rows = await arr(base44.entities.AppSettings.filter({ key: SETTINGS_KEY }, "-updated_date", 1));
  const row = rows[0] || null;
  return { id: row ? row.id : null, data: (row && row.pageSettings) || {} };
}

export async function writeBriefingCache(cache, patch) {
  const pageSettings = { ...(cache.data || {}), ...patch };
  try {
    if (cache.id) await base44.entities.AppSettings.update(cache.id, { pageSettings });
    else {
      const row = await base44.entities.AppSettings.create({ key: SETTINGS_KEY, pageSettings });
      cache.id = row && row.id;
    }
    cache.data = pageSettings;
  } catch {
    /* cache is a convenience; the briefing still renders */
  }
  return cache;
}

// ---------- Sections ----------
function tasksSection(tasks, focus, today) {
  const due = tasks
    .filter((t) => t.due_date && t.due_date.slice(0, 10) <= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || (a.priority || 3) - (b.priority || 3));
  const overdue = due.filter((t) => t.due_date.slice(0, 10) < today);
  return {
    due,
    overdue,
    dueToday: due.length - overdue.length,
    focus: focus.filter((t) => t.status !== "done"),
  };
}

function pipelineSection(clients, now) {
  const today = dayKey(now);
  const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - ((now.getDay() + 6) % 7)));
  const open = clients.filter((c) => isLeadish(c) && OPEN_STAGES.includes(stageOf(c)));
  const calls = open
    .map((c) => ({ c, call: bookedCallOf(c) }))
    .filter((x) => x.call && x.call.at && dayKey(x.call.at) >= today && x.call.at < endOfWeek)
    .sort((a, b) => a.call.at - b.call.at);
  const newLeads = open.filter((c) => stageOf(c) === "new").sort((a, b) => String(b.created_date).localeCompare(String(a.created_date)));
  return {
    open: open.length,
    newLeads,
    fresh: newLeads.filter((c) => now - new Date(c.created_date) < DAY).length,
    callsToday: calls.filter((x) => dayKey(x.call.at) === today),
    callsWeek: calls,
    overdueSteps: open.filter(isOverdue).sort((a, b) => String(a.next_step_at).localeCompare(String(b.next_step_at))),
  };
}

function sitesSection(audits, clients, now) {
  const byClient = new Map();
  audits
    .filter((a) => (a.strategy || "mobile") === "mobile" && a.status !== "failed" && a.run_at)
    .sort((a, b) => String(b.run_at).localeCompare(String(a.run_at)))
    .forEach((a) => {
      const list = byClient.get(a.client_id) || [];
      if (list.length < 2) list.push(a);
      byClient.set(a.client_id, list);
    });
  const name = (id, fallback) => (clients.find((c) => c.id === id) || {}).business || fallback || "Client";
  const flags = [];
  byClient.forEach(([latest, prev], clientId) => {
    if (!latest || now - new Date(latest.run_at) > 7 * DAY) return;
    const prevKeys = new Set(((prev && prev.issues) || []).map((i) => i.key));
    const newCritical = (latest.issues || []).filter((i) => i.severity === "critical" && (!prev || !prevKeys.has(i.key)));
    const drop = prev && typeof prev.health_score === "number" && typeof latest.health_score === "number" ? Math.round(prev.health_score - latest.health_score) : 0;
    if (newCritical.length || drop >= 5) {
      flags.push({ clientId, name: name(clientId, latest.client_name), score: latest.health_score, drop: drop >= 5 ? drop : 0, critical: newCritical.map((i) => i.title) });
    }
  });
  return flags.sort((a, b) => b.critical.length - a.critical.length || b.drop - a.drop);
}

function reviewsSection(reviewClients, prevRatings, now) {
  const rows = reviewClients.filter((r) => r.active !== false);
  const week = now.getTime() - 7 * DAY;
  return rows
    .map((r) => {
      const cache = r.cache || {};
      const fresh = (cache.reviews || []).filter((x) => x.time && new Date(x.time).getTime() >= week);
      const prev = prevRatings ? prevRatings[r.id] : null;
      const rating = typeof cache.rating === "number" ? cache.rating : null;
      const total = typeof cache.total === "number" ? cache.total : null;
      const ratingDelta = prev && rating != null && typeof prev.rating === "number" ? Math.round((rating - prev.rating) * 100) / 100 : 0;
      const totalDelta = prev && total != null && typeof prev.total === "number" ? total - prev.total : 0;
      return { id: r.id, clientId: r.crm_client_id || null, name: r.name, rating, total, fresh: fresh.length, ratingDelta, totalDelta, error: r.last_error || "" };
    })
    .filter((r) => r.fresh || r.ratingDelta || r.totalDelta || r.error);
}

function legalSection(items) {
  const open = items.filter((i) => !i.done).map((i) => computeDeadline(i)).filter((d) => d.dated);
  const overdue = open.filter((d) => d.overdue).sort((a, b) => a.due - b.due);
  const next = open.filter((d) => !d.overdue).sort((a, b) => a.due - b.due)[0] || null;
  return { overdue, next };
}

function intelSection(intel) {
  if (!intel.length) return null;
  const latestDate = intel.map((i) => i.brief_date).filter(Boolean).sort().pop() || null;
  const latest = intel.filter((i) => i.brief_date === latestDate);
  const updates = latest.filter((i) => (i.kind || "update") === "update");
  const top = updates.find((i) => i.impact === "high") || updates[0] || null;
  const proposed = intel.filter((i) => i.kind === "action" && i.status === "proposed");
  const approved = intel.filter((i) => i.kind === "action" && i.status === "approved");
  return { date: latestDate, top, proposed: proposed.length, approved: approved.length };
}

async function outreachSection() {
  if (!base44.entities.OutreachMessage) return null;
  try {
    const rows = await base44.entities.OutreachMessage.filter({ status: "needs_approval" }, "-updated_date", 100);
    const list = Array.isArray(rows) ? rows : [];
    return { waiting: list.length, clients: [...new Set(list.map((m) => m.client_name).filter(Boolean))] };
  } catch {
    return null;
  }
}

// ---------- Main loader ----------
export async function loadBriefing() {
  const now = new Date();
  const today = dayKey(now);
  const [raw, tasks, focus, waiting, moving, requests, audits, reviewClients, legal, intel, goals, outreach, cache] = await Promise.all([
    fetchFinanceRaw(),
    arr(base44.entities.Task.filter({ status: { $in: OPEN_STATUSES } }, "due_date", 500)),
    arr(base44.entities.Task.filter({ is_focus: true, status: { $ne: "done" } }, "priority", 6)),
    arr(base44.entities.ClaudeJob.filter({ status: "needs_approval" }, "-finished_at", 50)),
    arr(base44.entities.ClaudeJob.filter({ status: { $in: ["queued", "running"] } }, "-created_date", 50)),
    arr(base44.entities.ClientRequest.filter({ status: { $in: OPEN_REQ } }, "-created_date", 100)),
    arr(base44.entities.SiteAudit.list("-run_at", 300)),
    arr(base44.entities.ReviewClient.list("name", 100)),
    arr(base44.entities.LegalItem.list("-created_date", 200)),
    arr(base44.entities.SeoIntel.list("-brief_date", 120)),
    arr(base44.entities.RevenueGoal.list("-created_date", 20)),
    outreachSection(),
    loadAgentsBriefing().catch(() => null),
    readBriefingCache().catch(() => ({ id: null, data: {} })),
  ]);

  const f = computeFinance(raw);
  const goal = goals.find((g) => g.is_primary) || goals[0] || goalDefaults();
  const g = computeGoal(goal, f, now);
  const overdueBills = (raw.expenses || []).map((e) => enrichExpense(e, now)).filter((e) => e.status === "Overdue");

  // Stärboard baseline: ratings as they stood on the previous briefing day.
  const currentRatings = {};
  reviewClients.forEach((r) => {
    if (r.cache && typeof r.cache.rating === "number") currentRatings[r.id] = { rating: r.cache.rating, total: r.cache.total ?? null };
  });
  let prevRatings = cache.data.ratings_prev || null;
  if (cache.data.ratings_date !== today) {
    prevRatings = cache.data.ratings_now || null;
    await writeBriefingCache(cache, { ratings_date: today, ratings_now: currentRatings, ratings_prev: prevRatings });
  }

  const reqs = [...requests].sort((a, b) => (b.priority === "urgent") - (a.priority === "urgent") || String(b.created_date).localeCompare(String(a.created_date)));

  return {
    at: now.toISOString(),
    today,
    tasks: tasksSection(tasks, focus, today),
    claude: { waiting, running: moving.filter((j) => j.status === "running").length, queued: moving.filter((j) => j.status === "queued").length },
    pipeline: pipelineSection(raw.clients || [], now),
    requests: { open: reqs, urgent: reqs.filter((r) => r.priority === "urgent") },
    money: {
      mrr: f.mrr,
      accounts: f.accounts.length,
      stripeOk: f.stripeOk,
      collectedThisMonth: f.collectedThisMonth,
      outstanding: f.outstanding,
      overdueBills,
      overdueBillsTotal: overdueBills.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    },
    goal: { title: goal.title || "$1M goal", target: g.target, metric: g.metric, projected: g.projected, pace: g.metric === "run_rate" ? g.progress : g.paceRatio, onPace: g.onPace, gap: g.gap, mrrGap: g.mrrGap, neededMrr: g.neededMrr, clientsNeeded: g.clientsNeeded, monthsLeft: g.monthsLeft, monthsUntilStart: g.monthsUntilStart || 0 },
    sites: sitesSection(audits, raw.clients || [], now),
    reviews: reviewsSection(reviewClients, prevRatings, now),
    legal: legalSection(legal),
    intel: intelSection(intel),
    outreach,
    agents,
    cache,
  };
}
