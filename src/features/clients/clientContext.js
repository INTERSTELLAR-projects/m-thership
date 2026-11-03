// One client profile for every generator. loadClientContext(clientId) gathers everything Møthership
// knows about a client in one pass; contextToBrief(ctx, { sections }) turns it into the same markdown
// brief everywhere (brand kit, playbook, content plan, social plan, Fix with AI, enrichment).
// The criteria (what a complete profile holds, where each fact lives) are in ./criteria.js.
// Nothing here invents a fact: a missing source is null / [] and shows as "not on file".
import { base44 } from "@/api/base44Client";
import { CRITERIA, GROUPS, evaluateCriteria, displayValue, outputLabel } from "./criteria";

const list = (p) => Promise.resolve(p).then((r) => (Array.isArray(r) ? r : (r && r.items) || [])).catch(() => []);
const approvedOf = (rows) => (rows || []).filter((x) => x.status === "approved").sort((a, b) => (Number(b.version) || 0) - (Number(a.version) || 0))[0] || null;
const pickFlight = (flights) => (flights || []).find((x) => x.status !== "archived") || (flights || [])[0] || null;
const scoredAudit = (audits) => (audits || []).filter((a) => typeof a.health_score === "number" && a.strategy !== "desktop")[0] || (audits || []).find((a) => typeof a.health_score === "number") || null;

// Shape raw rows into a context (shared by the single loader and the bulk loader used by /crm).
export function buildContext(client, raw = {}) {
  const snaps = [];
  const seen = new Set();
  (raw.snapshots || []).forEach((s) => { if (!seen.has(s.source)) { seen.add(s.source); snaps.push(s); } });
  return {
    client: client || {},
    dossier: (raw.dossiers || [])[0] || null,
    flights: raw.flights || [],
    flight: pickFlight(raw.flights),
    intake: (raw.intakes || [])[0] || null,
    requests: raw.requests || [],
    goals: raw.goals || [],
    gaps: raw.gaps || [],
    outreach: (raw.outreach || [])[0] || null,
    brandKits: raw.kits || [],
    brandKit: approvedOf(raw.kits),
    playbooks: raw.playbooks || [],
    playbook: approvedOf(raw.playbooks),
    contentPlans: raw.contentPlans || [],
    contentPlan: approvedOf(raw.contentPlans),
    socialPlans: raw.socialPlans || [],
    socialPlan: approvedOf(raw.socialPlans),
    review: (raw.reviews || []).find((r) => r.active !== false) || (raw.reviews || [])[0] || null,
    audits: raw.audits || [],
    siteAudit: scoredAudit(raw.audits),
    files: raw.files || [],
    work: raw.work || [],
    automations: raw.automations || [],
    projects: raw.projects || [],
    tasks: raw.tasks || [],
    snapshots: snaps,
    packages: {
      plan: (client && client.plan) || "",
      services_managed: (client && client.services_managed) || [],
      billing: ((client && client.services) || []).filter((s) => s && !s.discontinued).map((s) => ({ name: s.name || s.label || "", price: Number(s.price) || 0 })).filter((s) => s.name),
      sold: (raw.flights || []).filter((f) => f.status !== "archived").map((f) => ({ sale: f.sale_package, care: f.care_plan || "", status: f.status })),
    },
    loaded_at: new Date().toISOString(),
  };
}

// Everything about one client. Accepts an id or a CRMClient record.
export async function loadClientContext(clientOrId) {
  const id = typeof clientOrId === "string" ? clientOrId : clientOrId && clientOrId.id;
  if (!id) throw new Error("loadClientContext needs a client id");
  const f = (entity, sort, limit, q = { client_id: id }) => list(base44.entities[entity].filter(q, sort, limit));
  const [client, dossiers, flights, intakes, requests, goals, gaps, outreach, kits, playbooks, contentPlans, socialPlans, reviews, audits, files, work, automations, projects, tasks, snapshots] = await Promise.all([
    typeof clientOrId === "object" && clientOrId.business ? clientOrId : base44.entities.CRMClient.get(id).catch(() => null),
    f("ClientDossier", "-updated_date", 1),
    f("OnboardingFlight", "-created_date", 5),
    f("IntakeAudit", "-created_date", 1),
    f("ClientRequest", "-created_date", 20),
    f("ClientGoal", "sort", 50),
    f("ClientGap", "-created_date", 100),
    f("OutreachProfile", "-updated_date", 1),
    f("BrandKit", "-version", 5),
    f("IndustryPlaybook", "-version", 5),
    f("ContentPlan", "-version", 10),
    f("SocialPlan", "-version", 5),
    f("ReviewClient", "-updated_date", 3, { crm_client_id: id }),
    f("SiteAudit", "-run_at", 10),
    f("ClientFile", "-created_date", 200),
    f("WorkLog", "-date", 60),
    f("Automation", "-created_date", 50),
    f("Project", "-created_date", 50),
    f("Task", "due_date", 300),
    f("PerformanceSnapshot", "-period_end", 12),
  ]);
  return buildContext(client || { id }, { dossiers, flights, intakes, requests, goals, gaps, outreach, kits, playbooks, contentPlans, socialPlans, reviews, audits, files, work, automations, projects, tasks, snapshots });
}

// Light contexts for many clients at once (only what the criteria read): one list call per entity.
export async function loadContextsLite(clients) {
  const ids = new Set((clients || []).map((c) => c.id));
  const all = (entity, sort, limit = 1000) => list(base44.entities[entity].list(sort, limit));
  const [dossiers, flights, intakes, goals, outreach, kits, reviews, files] = await Promise.all([
    all("ClientDossier", "-updated_date"), all("OnboardingFlight", "-created_date"), all("IntakeAudit", "-created_date"),
    all("ClientGoal", "sort"), all("OutreachProfile", "-updated_date"), all("BrandKit", "-version"), all("ReviewClient", "-updated_date"),
    all("ClientFile", "-created_date", 2000),
  ]);
  const by = (rows, key = "client_id") => {
    const m = new Map();
    rows.forEach((r) => { const k = r[key]; if (!ids.has(k)) return; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    return m;
  };
  const m = { dossiers: by(dossiers), flights: by(flights), intakes: by(intakes), goals: by(goals), outreach: by(outreach), kits: by(kits), reviews: by(reviews, "crm_client_id"), files: by(files) };
  const out = new Map();
  (clients || []).forEach((c) => {
    out.set(c.id, buildContext(c, Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.get(c.id) || []]))));
  });
  return out;
}

/* ---------------- brief ---------------- */

const show = (v, max = 600) => {
  if (v === undefined || v === null) return "";
  const s = Array.isArray(v) ? v.map((x) => (typeof x === "object" && x ? x.name || x.term || x.title || x.city || JSON.stringify(x) : x)).join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

function profileSection(ctx) {
  const ev = evaluateCriteria(ctx);
  const lines = [`Profile completeness: ${ev.pct}%. Values below are the client's facts on file (first source that has them).`];
  GROUPS.forEach((g) => {
    const items = ev.items.filter((i) => i.group === g.key);
    lines.push("", `**${g.label}**`);
    items.forEach((i) => lines.push(`- ${i.label}: ${i.filled ? displayValue(i.value, 400) : "NOT ON FILE"}`));
  });
  if (ev.missing.length) lines.push("", `Not on file — do NOT invent these; list any you need under needs_from_justin: ${ev.missing.map((i) => i.label).join("; ")}.`);
  const blocked = ev.outputs.filter((o) => !o.ready);
  if (blocked.length) lines.push(`Outputs still blocked by missing fields: ${blocked.map((o) => `${o.label} (${o.blockers.map((b) => b.label).join(", ")})`).join("; ")}.`);
  return lines.join("\n");
}

function outputsSection(ctx) {
  const k = ctx.brandKit;
  const kk = (k && k.kit) || {};
  const palette = (kk.palette || []).map((p) => (p && p.hex ? `${p.name || ""} ${p.hex}`.trim() : "")).filter(Boolean);
  const pb = ctx.playbook;
  const g = (pb && pb.playbook && pb.playbook.goal_summary) || {};
  const cp = ctx.contentPlan;
  const sp = ctx.socialPlan;
  return [
    k ? `- Brand kit v${k.version || 1}: ${show(k.summary, 300)}${palette.length ? ` · palette ${palette.join(", ")}` : ""}${kk.voice && kk.voice.personality ? ` · voice: ${show(kk.voice.personality, 200)}` : ""}` : "- Brand kit: none approved",
    pb ? `- Industry playbook v${pb.version || 1}: ${show(pb.summary, 300)}${g.where_they_want_to_be ? ` · goal: ${show(g.where_they_want_to_be, 200)}` : ""}${g.north_star ? ` · north star: ${g.north_star}` : ""}` : "- Industry playbook: none approved",
    cp ? `- Content plan v${cp.version || 1}: ${show(cp.summary, 300)}${cp.blog && cp.blog.frequency ? ` · blog ${cp.blog.frequency}` : ""}${cp.gbp && cp.gbp.frequency ? ` · GBP ${cp.gbp.frequency}` : ""}` : "- Content plan: none approved",
    sp ? `- Social plan v${sp.version || 1}: ${show(sp.summary, 300)}` : "- Social plan: none approved",
  ].join("\n");
}

function servicesSection(ctx) {
  const p = ctx.packages || {};
  return [
    p.plan ? `- Plan with Interstellar: ${p.plan}` : "",
    (p.services_managed || []).length ? `- Services we manage: ${p.services_managed.join(", ")}` : "",
    (p.billing || []).length ? `- Billing lines: ${p.billing.map((b) => b.name).join(", ")}` : "",
    ...(p.sold || []).map((s) => `- Onboarding flight: ${s.sale || "?"}${s.care ? ` + ${s.care}` : ""} (${s.status || "?"})`),
  ].filter(Boolean).join("\n") || "- No plan or services on file.";
}

function goalsSection(ctx) {
  const lines = (ctx.goals || []).map((g) => `- Goal: ${g.title}${g.metric ? ` [${g.metric}]` : ""}: baseline ${g.baseline_value ?? "unknown"}, current ${g.current_value ?? "unknown"}, target ${g.target_value ?? "unknown"} ${g.unit || ""} (${g.status || "not_started"})`);
  (ctx.gaps || []).filter((g) => g.status !== "fixed").slice(0, 12).forEach((g) => lines.push(`- Open gap (${g.severity || "?"}, ${g.area || "?"}): ${g.title}`));
  return lines.join("\n") || "- No goals or open gaps on file.";
}

function healthSection(ctx) {
  const a = ctx.siteAudit;
  const s = (a && a.scores) || {};
  const rc = ctx.review && ctx.review.cache;
  return [
    a ? `- Site health ${a.health_score}/100 (${a.strategy || "mobile"}, ${String(a.run_at || "").slice(0, 10)}) — performance ${s.performance ?? "?"}, SEO ${s.seo ?? "?"}, accessibility ${s.accessibility ?? "?"}, best practices ${s.best_practices ?? "?"}` : "- No site audit yet.",
    rc && rc.rating != null ? `- Google rating ${rc.rating} from ${rc.total || 0} reviews (Stärboard cache ${String(ctx.review.cached_at || "").slice(0, 10)})` : "- Google rating: not linked in Stärboard.",
  ].join("\n");
}

function intakeSection(ctx) {
  const i = ctx.intake;
  if (!i) return "- No intake answers on file.";
  const rows = Object.entries(i.answers || {}).filter(([, v]) => (Array.isArray(v) ? v.length : v && typeof v !== "object")).map(([k, v]) => `- ${k}: ${show(v, 500)}`);
  return [`IntakeAudit ${i.id} (${i.status || "?"})`, i.summary ? `Summary: ${show(i.summary, 600)}` : "", ...rows].filter(Boolean).join("\n");
}

function requestsSection(ctx) {
  const withAnswers = (ctx.requests || []).filter((r) => (r.answers || []).length || r.details).slice(0, 6);
  if (!withAnswers.length) return "- No form submissions on file.";
  return withAnswers.map((r) => [
    `### ${r.form_title || r.title} (${String(r.created_date || "").slice(0, 10)})`,
    r.details ? `Details: ${show(r.details, 500)}` : "",
    ...(r.answers || []).filter((x) => x && x.value !== undefined && x.value !== "").slice(0, 20).map((x) => `- ${x.label || x.id}: ${show(x.value, 300)}`),
  ].filter(Boolean).join("\n")).join("\n\n");
}

const SECTIONS = {
  profile: ["Client profile (Client Criteria)", profileSection],
  services: ["What they have with Interstellar", servicesSection],
  outputs: ["Approved outputs on the profile", outputsSection],
  goals: ["Goals & open gaps", goalsSection],
  health: ["Site health & reputation", healthSection],
  intake: ["Intake answers (their own words)", intakeSection],
  requests: ["Form submissions", requestsSection],
};

export function contextToBrief(ctx, { sections = ["profile", "services", "outputs"], level = 2 } = {}) {
  if (!ctx) return "";
  const h = "#".repeat(level);
  return sections.filter((s) => SECTIONS[s]).map((s) => `${h} ${SECTIONS[s][0]}\n${SECTIONS[s][1](ctx)}`).join("\n\n");
}

export { CRITERIA, evaluateCriteria, outputLabel };
