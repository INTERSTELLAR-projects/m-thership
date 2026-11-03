// Growth > Hiring plan: derives monthly Mission ALPHA + care-plan signings from existing records,
// evaluates the hiring trigger and joins Interstellar's own ad spend (Ads Studio). Never invents numbers:
// when nothing is on file, counts are 0 and the UI says so.
import { base44 } from "@/api/base44Client";
import { offerByKey, offerPrice, loadAgencyKnowledge } from "@/features/agency/knowledge";
import { DEFAULT_SETTINGS, SEED_BLOCKS, SEED_CHECKLIST, SEED_DECISIONS, SEED_VERSION } from "./content";

const arr = (r) => (Array.isArray(r) ? r : (r && r.items) || []);
const safe = (p) => p.then(arr).catch(() => []);

export const CARE_KEYS = ["orbit_local", "orbit_national", "orbit_global", "starship_care"];
const CARE_RE = /hypercare|gravïtycare|gravitycare/i;
const ALPHA_RE = /mission\s*alpha/i;

export const monthKey = (d) => String(d || "").slice(0, 7);
export function lastMonths(n, now = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
export const monthLabel = (k) => {
  const [y, m] = String(k).split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

/* ─── HiringPlan record ─────────────────────────────────────────────────── */
export const settingsOf = (plan) => ({ ...DEFAULT_SETTINGS, ...((plan && plan.settings) || {}) });

export async function readPlan() {
  const rows = await safe(base44.entities.HiringPlan.filter({ key: "primary" }, "-updated_date", 1));
  return rows[0] || null;
}

let seeding = null;
// Admin page only: create the plan from the drafts, or add any draft blocks/decisions/checks it is missing.
export async function ensurePlan() {
  const cur = await readPlan();
  if (!cur) {
    if (!seeding) {
      seeding = base44.entities.HiringPlan.create({
        key: "primary",
        settings: { ...DEFAULT_SETTINGS },
        manual_counts: {},
        blocks: SEED_BLOCKS.map((b) => ({ ...b })),
        decisions: SEED_DECISIONS.map((d) => ({ ...d })),
        checklist: SEED_CHECKLIST.map((c) => ({ ...c, done: false })),
        seed_version: SEED_VERSION,
      }).finally(() => { seeding = null; });
    }
    return seeding;
  }
  if ((cur.seed_version || 0) >= SEED_VERSION) return cur;
  const has = (list, key) => (list || []).some((x) => x.key === key);
  const patch = {
    blocks: [...(cur.blocks || []), ...SEED_BLOCKS.filter((b) => !has(cur.blocks, b.key))],
    decisions: [...(cur.decisions || []), ...SEED_DECISIONS.filter((d) => !has(cur.decisions, d.key))],
    checklist: [...(cur.checklist || []), ...SEED_CHECKLIST.filter((c) => !has(cur.checklist, c.key)).map((c) => ({ ...c, done: false }))],
    seed_version: SEED_VERSION,
  };
  return base44.entities.HiringPlan.update(cur.id, patch);
}

/* ─── Signings: Mission ALPHA + a care plan ─────────────────────────────── */
// Sources, in order: OnboardingFlight (sale_package mission_alpha, written by Flight Plan) and Project
// (service_key mission_alpha, written by start-service). One signing per client, dated by its start date.
// It counts only when the same client also has HyperCare+ or GravïtyCare: the flight's care plan, a care
// project from start-service, or an active HyperCare+/GravïtyCare billing line synced from Stripe.
export function deriveSignings({ flights = [], projects = [], clients = [] }) {
  const byClient = new Map(clients.map((c) => [c.id, c]));
  const sales = new Map();
  const add = (s) => {
    const id = s.client_id || `name:${String(s.client_name || "").toLowerCase()}`;
    const prev = sales.get(id);
    if (!prev || (s.date && (!prev.date || s.date < prev.date))) sales.set(id, { ...prev, ...s, careFrom: s.careFrom || prev?.careFrom || null, sources: [...(prev?.sources || []), s.source] });
    else prev.sources.push(s.source);
  };
  flights.filter((f) => f.sale_package === "mission_alpha" && f.status !== "archived").forEach((f) => add({
    client_id: f.client_id, client_name: f.client_name, date: f.start_date || f.created_date, source: "Flight Plan",
    careFrom: CARE_KEYS.includes(f.care_plan) ? "care plan on the flight" : null,
  }));
  projects.filter((p) => p.service_key === "mission_alpha").forEach((p) => add({
    client_id: p.client_id, client_name: p.client_name, date: p.start_date || p.created_date, source: "start-service project",
  }));

  const careProjects = new Set(projects.filter((p) => CARE_KEYS.includes(p.service_key) && p.status !== "cancelled").map((p) => p.client_id));
  const list = [...sales.values()].map((s) => {
    const c = byClient.get(s.client_id);
    const line = c && (c.services || []).find((l) => CARE_RE.test(String(l.name || l.short || "")) && l.status !== "canceled");
    const care = s.careFrom || (careProjects.has(s.client_id) ? "care plan project" : null) || (line ? `${line.short || line.name} billing line` : null);
    return { ...s, client_name: s.client_name || c?.business || "Client", month: monthKey(s.date), care };
  });

  const counted = new Set(list.map((s) => s.client_id).filter(Boolean));
  const undated = clients.filter((c) => ALPHA_RE.test(String(c.plan || "")) && !counted.has(c.id)).map((c) => ({ id: c.id, business: c.business, plan: c.plan }));
  return { signings: list.filter((s) => s.care), withoutCare: list.filter((s) => !s.care), undated };
}

/* ─── Trigger ───────────────────────────────────────────────────────────── */
// rows: [{ key, count }] oldest → newest; the last row is the current month (in progress).
export function evaluateTrigger(rows, settings) {
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const counts = rows.map((r) => Number(r.count) || 0);
  const cur = counts[counts.length - 1] || 0;
  const prev = counts[counts.length - 2] || 0;
  const n = Math.max(1, Number(s.streak_months) || 2);
  const streakEnding = (end) => end - n + 1 >= 0 && counts.slice(end - n + 1, end + 1).every((c) => c >= s.streak_min);
  const last = counts.length - 1;
  if (cur >= s.any_month_min || prev >= s.any_month_min) {
    return { state: "start", label: "Start hiring now", reason: `${cur >= s.any_month_min ? "This month" : "Last month"} hit ${Math.max(cur, prev)} signings (rule: any month at ${s.any_month_min}+).` };
  }
  if (streakEnding(last) || streakEnding(last - 1)) {
    return { state: "start", label: "Start hiring now", reason: `${n} months in a row at ${s.streak_min}+ signings.` };
  }
  if (cur >= s.ready_min || prev >= s.ready_min) {
    return { state: "ready", label: "Get ready", reason: `${Math.max(cur, prev)} signings in a month. Finish the decisions and the launch checklist so the posts can go live the day the trigger hits.` };
  }
  return { state: "idle", label: "Not yet", reason: `Hiring starts at ${n} months in a row at ${s.streak_min}+ or any month at ${s.any_month_min}+. You can run ${s.justin_per_month} a month yourself.` };
}

/* ─── Ad spend (Ads Studio) ─────────────────────────────────────────────── */
// Interstellar's own ads only (client_id empty), campaign-level rows (same as Ads Studio's month total).
// Campaigns tagged Special Ad Category EMPLOYMENT are hiring ads and are kept apart from sales spend.
export function spendByMonth(metrics = [], campaigns = []) {
  const hiringIds = new Set();
  campaigns.filter((c) => (c.special_ad_categories || []).some((x) => /employ/i.test(String(x)))).forEach((c) => {
    hiringIds.add(c.id);
    if (c.external_id) hiringIds.add(String(c.external_id));
  });
  const out = {};
  metrics.filter((r) => r.level === "campaign" && !r.client_id).forEach((r) => {
    const k = monthKey(r.date);
    const m = out[k] || (out[k] = { sales: 0, hiring: 0, rows: 0 });
    const hiring = hiringIds.has(r.ref_id) || hiringIds.has(String(r.external_id || r.campaign_external_id || ""));
    m[hiring ? "hiring" : "sales"] += Number(r.spend) || 0;
    m.rows += 1;
  });
  return out;
}

/* ─── Everything the page and the dashboard card need ───────────────────── */
export async function loadHiring({ months = 6 } = {}) {
  const keys = lastMonths(months);
  const since = `${keys[0]}-01`;
  const [plan, flights, projects, clients, metrics, campaigns, sections] = await Promise.all([
    readPlan().catch(() => null),
    safe(base44.entities.OnboardingFlight.list("-created_date", 500)),
    safe(base44.entities.Project.list("-created_date", 1000)),
    safe(base44.entities.CRMClient.list("business", 500)),
    safe(base44.entities.AdMetricDaily.filter({ level: "campaign" }, "-date", 5000)),
    safe(base44.entities.AdCampaign.list("-created_date", 500)),
    loadAgencyKnowledge().catch(() => []),
  ]);
  const settings = settingsOf(plan);
  const derived = deriveSignings({ flights, projects, clients });
  const spend = spendByMonth(metrics.filter((r) => String(r.date || "") >= since), campaigns);
  const manual = (plan && plan.manual_counts) || {};
  const rows = keys.map((k) => {
    const d = derived.signings.filter((s) => s.month === k);
    const m = manual[k];
    const hasManual = m !== undefined && m !== null && m !== "";
    const count = hasManual ? Number(m) || 0 : d.length;
    const sp = spend[k] || null;
    return { key: k, derived: d.length, deals: d, manual: hasManual ? Number(m) : null, count, spend: sp ? sp.sales : null, hiringSpend: sp ? sp.hiring : null, costPerDeal: sp && sp.sales > 0 && count > 0 ? sp.sales / count : null };
  });
  const trigger = evaluateTrigger(rows, settings);
  return { plan, settings, rows, current: rows[rows.length - 1], trigger, derived, hasAdData: metrics.some((r) => !r.client_id), offers: offersModel(sections) };
}

/* ─── Capacity model inputs (Agency Knowledge prices) ───────────────────── */
export function offersModel(sections) {
  const alpha = offerByKey("mission_alpha", sections);
  const price = offerPrice("mission_alpha", 8997, sections);
  const t = String(alpha?.terms || "");
  const m = t.match(/\$([\d,]+)\s*down\s*\+\s*(\d+)\s*[×x]\s*\$([\d,]+)/i);
  const num = (s) => Number(String(s).replace(/,/g, ""));
  return {
    alphaPrice: price,
    down: m ? num(m[1]) : 1997,
    installments: m ? num(m[2]) : 7,
    installment: m ? num(m[3]) : 1000,
    careLow: offerPrice("starship_care", 197, sections),
    careHigh: offerPrice("orbit_local", 750, sections),
    fromKnowledge: !!alpha,
  };
}
