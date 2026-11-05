// Work ledger (WorkEntry): loading, labels and the numbers on Output, the Commander brief and the sidebar.
// The backend (functions/work-ledger + base44/shared/workLedger.ts) owns the baselines and the sync; DEFAULT_BASELINES
// below mirrors base44/shared/workLedger.ts and is only a fallback while the config call loads.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export const DONE_BY = {
  agent: { label: "Agents", short: "Agent", color: "#ff3c00" },
  scheduled_task: { label: "Scheduled tasks", short: "Scheduled", color: "#ff8a1f" },
  claude_session: { label: "Claude sessions", short: "Claude", color: "#ffaa00" },
  team: { label: "Team", short: "Team", color: "#8a8580" },
  justin_manual: { label: "Justin by hand", short: "Justin", color: "#1a1a1a" },
};
export const DONE_BY_ORDER = ["agent", "scheduled_task", "claude_session", "team", "justin_manual"];

export const CATEGORIES = {
  website: "Website", seo: "SEO", content: "Content", gbp: "Google Business", citations: "Citations", app_build: "App / build", brand: "Brand",
  social: "Social", email: "Email", ads: "Ads", ops: "Ops", research: "Research", security: "Security", billing: "Billing",
};

export { DEFAULT_BASELINES, DEFAULT_RATE } from "./baselines";
import { DEFAULT_BASELINES, DEFAULT_RATE } from "./baselines";

const asArray = (r) => (Array.isArray(r) ? r : (r && r.items) || []);

async function loadAll() {
  const out = [];
  for (let skip = 0; skip < 10000; skip += 500) {
    const page = asArray(await base44.entities.WorkEntry.list("-completed_at", 500, skip).catch(() => []));
    out.push(...page);
    if (page.length < 500) break;
  }
  return out;
}

export function useLedger() {
  return useQuery({ queryKey: ["WorkEntry", "all"], queryFn: loadAll, staleTime: 30_000 });
}

export function useLedgerConfig() {
  return useQuery({
    queryKey: ["work-ledger", "config"],
    queryFn: async () => {
      const r = (await base44.functions.invoke("work-ledger", { action: "config" }))?.data || {};
      return { rows: r.rows?.length ? r.rows : DEFAULT_BASELINES, hourly_rate: Number(r.hourly_rate) > 0 ? Number(r.hourly_rate) : DEFAULT_RATE, updated_at: r.updated_at || null };
    },
    staleTime: 5 * 60_000,
    placeholderData: { rows: DEFAULT_BASELINES, hourly_rate: DEFAULT_RATE, updated_at: null },
  });
}

export function useLedgerRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["WorkEntry"] });
}

export const savedMin = (e) => (e.done_by === "justin_manual" ? 0 : Number.isFinite(Number(e.minutes_saved_estimate)) && e.minutes_saved_estimate !== null && e.minutes_saved_estimate !== undefined
  ? Number(e.minutes_saved_estimate)
  : Math.max(0, (Number(e.minutes_baseline) || 0) - (Number(e.manual_minutes) || 0)));
export const manualMin = (e) => (e.done_by === "justin_manual" ? Number(e.manual_minutes) || Number(e.minutes_baseline) || 0 : Number(e.manual_minutes) || 0);
export const counted = (e) => e.status === "done";
export const fmtHours = (h) => (h >= 100 ? `${Math.round(h).toLocaleString()}h` : `${(Math.round(h * 10) / 10).toFixed(h > 0 && h < 10 ? 1 : 0)}h`);
export const fmtUsd = (n) => `$${Math.round(n).toLocaleString()}`;

// Pacific calendar boundaries (Monday-start weeks), returned as real instants.
function pacificStarts(now = new Date()) {
  const la = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const off = now.getTime() - la.getTime();
  const w = new Date(la); w.setHours(0, 0, 0, 0); w.setDate(w.getDate() - ((w.getDay() + 6) % 7));
  const m = new Date(la.getFullYear(), la.getMonth(), 1);
  return { week: w.getTime() + off, month: m.getTime() + off, off, la };
}
const at = (e) => (e.completed_at ? new Date(e.completed_at).getTime() : null);

export function totals(rows, rate) {
  const done = rows.filter(counted);
  const saved = done.reduce((s, e) => s + savedMin(e), 0) / 60;
  const manual = done.filter((e) => e.done_by === "justin_manual").reduce((s, e) => s + manualMin(e), 0) / 60;
  const split = Object.fromEntries(DONE_BY_ORDER.map((k) => [k, { tasks: 0, hours: 0 }]));
  for (const e of done) { const k = split[e.done_by] ? e.done_by : "claude_session"; split[k].tasks += 1; split[k].hours += (e.done_by === "justin_manual" ? manualMin(e) : savedMin(e)) / 60; }
  return { tasks: done.length, hours: saved, value: saved * rate, manualHours: manual, split };
}

export function windows(rows, now = new Date()) {
  const s = pacificStarts(now);
  const done = rows.filter(counted);
  const prevWeek = s.week - 7 * 864e5;
  return {
    week: done.filter((e) => at(e) >= s.week),
    lastWeek: done.filter((e) => at(e) >= prevWeek && at(e) < s.week),
    month: done.filter((e) => at(e) >= s.month),
    all: done,
  };
}

export function weeklyTrend(rows, weeks = 12, now = new Date()) {
  const s = pacificStarts(now);
  const out = Array.from({ length: weeks }, (_, i) => {
    const start = s.week - (weeks - 1 - i) * 7 * 864e5;
    const d = new Date(start - s.off);
    return { start, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), tasks: 0, hours: 0, manual: 0 };
  });
  for (const e of rows.filter(counted)) {
    const t = at(e);
    if (t == null) continue;
    for (let i = out.length - 1; i >= 0; i--) if (t >= out[i].start) { out[i].tasks += 1; out[i].hours += savedMin(e) / 60; out[i].manual += e.done_by === "justin_manual" ? manualMin(e) / 60 : 0; break; }
  }
  return out.map((w) => ({ ...w, hours: Math.round(w.hours * 10) / 10, manual: Math.round(w.manual * 10) / 10 }));
}

export function byClient(rows, rate) {
  const m = new Map();
  for (const e of rows.filter(counted)) {
    const k = e.client_id || "agency";
    const r = m.get(k) || { id: k, name: k === "agency" ? "Interstellar (internal)" : e.client_name || "Client", tasks: 0, hours: 0, visible: 0, manual: 0 };
    r.tasks += 1; r.hours += savedMin(e) / 60; r.manual += e.done_by === "justin_manual" ? manualMin(e) / 60 : 0;
    if (e.visibility === "client" && e.client_title) r.visible += 1;
    m.set(k, r);
  }
  return [...m.values()].map((r) => ({ ...r, value: r.hours * rate })).sort((a, b) => b.hours - a.hours || b.tasks - a.tasks);
}

export function byAgent(rows, rate) {
  const m = new Map();
  for (const e of rows.filter(counted)) {
    if (!["agent", "scheduled_task"].includes(e.done_by) && !e.agent_key) continue;
    const k = e.agent_key || e.agent_name || e.done_by;
    const r = m.get(k) || { key: e.agent_key || "", name: e.agent_name || e.agent_key || DONE_BY[e.done_by]?.label || "Agent", done_by: e.done_by, tasks: 0, hours: 0, clients: new Set() };
    r.tasks += 1; r.hours += savedMin(e) / 60; if (e.client_id && e.client_id !== "agency") r.clients.add(e.client_id);
    m.set(k, r);
  }
  return [...m.values()].map((r) => ({ ...r, clients: r.clients.size, value: r.hours * rate })).sort((a, b) => b.hours - a.hours || b.tasks - a.tasks);
}

// One-line numbers for the Commander brief / dashboard.
export function ledgerHeadline(rows, rate) {
  const w = windows(rows);
  const t = totals(w.week, rate);
  const all = totals(w.all, rate);
  return { week: t, all, lastWeek: totals(w.lastWeek, rate) };
}
