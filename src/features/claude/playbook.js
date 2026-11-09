// "Industry Playbook": a client-specific 2027 playbook tied to the client's goals.
// Built exactly like the brand kit: a rich brief → a ClaudeJob (kind "playbook") or an in-app
// quick draft (Core.InvokeLLM with the same schema) → Justin approves → a versioned IndustryPlaybook.
import { base44 } from "@/api/base44Client";
import { STANDING_RULES } from "./jobs";
import { PACKAGES } from "@/features/packages/registry";
import { loadClientContext, contextToBrief } from "@/features/clients/clientContext";
import { loadAgencyKnowledge, agencyBlock } from "@/features/agency/knowledge";

export const PLAYBOOK_CONTEXT = "playbook";

export const PILLARS = [
  ["get_found", "Get Found", "SEO, Google Business Profile, map pack, AI search (AIO/GEO/AEO), listings"],
  ["convert", "Convert", "Website, booking/quote flow, offer, speed to lead"],
  ["reputation", "Reputation", "Google reviews, review requests, responses"],
  ["retention", "Retention & Referrals", "Repeat business, memberships, referral program, follow-up"],
  ["operations", "Operations & Automation", "CRM, scheduling, invoicing, automations, SOPs"],
  ["content_social", "Content & Social", "Blog, GBP posts, social, video, photos"],
  ["paid_ads", "Paid Ads", "Google LSA / Search, Meta — only when it fits their goals and capacity"],
];
export const PILLAR_IDS = PILLARS.map((p) => p[0]);
export const pillarLabel = (id) => (PILLARS.find((p) => p[0] === id) || [id, id])[1];

/* ---------------- schema ---------------- */

const str = { type: "string" };
const strList = { type: "array", items: str };
export const PLAYBOOK_JSON_SCHEMA = {
  type: "object",
  properties: {
    headline: str,
    summary: str,
    goal_summary: {
      type: "object",
      properties: {
        where_they_are: str,
        where_they_want_to_be: str,
        by_when: str,
        north_star: str,
        goals: {
          type: "array",
          items: {
            type: "object",
            properties: { title: str, metric: str, baseline: str, current: str, target: str, unit: str, by_when: str, source: str, is_estimate: { type: "boolean" } },
          },
        },
        unknowns: strList,
      },
    },
    industry_snapshot: {
      type: "object",
      properties: { trade: str, summary: str, whats_working: strList, customer_behavior: strList, shifts_2027: strList, sources: strList },
    },
    pillars: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", enum: PILLAR_IDS },
          name: str,
          priority: { type: "string", enum: ["high", "medium", "low"] },
          current_state: str,
          target: str,
          progress_pct: { type: "number" },
          progress_basis: str,
          interstellar_doing: strList,
          owner_actions: strList,
          next_services: { type: "array", items: { type: "object", properties: { name: str, why: str } } },
          kpis: {
            type: "array",
            items: { type: "object", properties: { name: str, current: str, target: str, direction: { type: "string", enum: ["up", "down"] }, source: str, is_estimate: { type: "boolean" } } },
          },
          milestones: { type: "object", properties: { d30: strList, d60: strList, d90: strList } },
        },
      },
    },
    quick_wins: { type: "array", items: { type: "object", properties: { title: str, owner: { type: "string", enum: ["client", "interstellar", "both"] }, why: str, pillar: str } } },
    ignore: { type: "array", items: { type: "object", properties: { item: str, why: str } } },
    risks: { type: "array", items: { type: "object", properties: { risk: str, severity: { type: "string", enum: ["high", "medium", "low"] }, mitigation: str } } },
    next_steps: strList,
    assumptions: strList,
  },
  required: ["goal_summary", "pillars"],
};

// The same shape, written out for Claude (the queue runner reads markdown, not a JSON schema).
export const PLAYBOOK_JSON_SHAPE = `{
  "headline": "one line: the plan in a sentence",
  "summary": "2-3 sentences for Justin and the owner",
  "goal_summary": {
    "where_they_are": "today, from the inputs only",
    "where_they_want_to_be": "their stated goal, in their words where possible",
    "by_when": "their stated timeline, or \\"unknown\\"",
    "north_star": "the one metric that matters most",
    "goals": [{ "title": "", "metric": "", "baseline": "real figure or \\"unknown\\"", "current": "real figure or \\"unknown\\"", "target": "their figure or \\"unknown\\"", "unit": "", "by_when": "", "source": "where the figure came from (intake, ClientGoal, GSC snapshot…)", "is_estimate": false }],
    "unknowns": ["facts we still need from the owner (e.g. current monthly leads)"]
  },
  "industry_snapshot": { "trade": "", "summary": "what is working in this trade in 2027", "whats_working": ["5-7"], "customer_behavior": ["3-5"], "shifts_2027": ["3-5 changes to plan for (AI answers, LSA, etc.)"], "sources": ["URLs if you researched"] },
  "pillars": [
    {
      "id": "${PILLAR_IDS.join(" | ")}",
      "name": "",
      "priority": "high | medium | low",
      "current_state": "from the inputs (site health, reviews, GBP, projects)",
      "target": "where this pillar should be, tied to their goal",
      "progress_pct": "0-100 ONLY when real current and target figures exist; otherwise omit",
      "progress_basis": "how progress_pct was worked out",
      "interstellar_doing": ["what we are actually doing for them now (from their plan, services, projects, tasks)"],
      "owner_actions": ["what THEY should do, specific and doable"],
      "next_services": [{ "name": "an Interstellar service from the catalog they do not have yet", "why": "tied to their goal" }],
      "kpis": [{ "name": "", "current": "real figure or \\"unknown\\"", "target": "", "direction": "up | down", "source": "", "is_estimate": false }],
      "milestones": { "d30": ["by day 30"], "d60": ["by day 60"], "d90": ["by day 90"] }
    }
  ],
  "quick_wins": [{ "title": "doable this month", "owner": "client | interstellar | both", "why": "", "pillar": "pillar id" }],
  "ignore": [{ "item": "what not to spend time or money on right now", "why": "" }],
  "risks": [{ "risk": "", "severity": "high | medium | low", "mitigation": "" }],
  "next_steps": ["3-5 ordered next steps"],
  "assumptions": ["anything you assumed"]
}`;

/* ---------------- normalise ---------------- */

const t = (v, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const l = (v, max = 12) => (Array.isArray(v) ? v.slice(0, max) : []);
const strs = (v, max = 12, len = 300) => l(v, max).map((x) => t(typeof x === "object" && x ? x.text || x.title || "" : x, len)).filter(Boolean);
const oneOf = (v, opts, fb) => (opts.includes(v) ? v : fb);

export function normalizePlaybook(raw) {
  let p = raw;
  if (typeof p === "string") {
    try { p = JSON.parse(p); } catch { p = null; }
  }
  if (p && p.playbook && typeof p.playbook === "object") p = p.playbook;
  if (!p || typeof p !== "object") return null;
  const g = p.goal_summary && typeof p.goal_summary === "object" ? p.goal_summary : {};
  const ind = p.industry_snapshot && typeof p.industry_snapshot === "object" ? p.industry_snapshot : {};
  const pillars = l(p.pillars, 8).filter((x) => x && typeof x === "object").map((x) => {
    const m = x.milestones && typeof x.milestones === "object" ? x.milestones : {};
    const pct = Number(x.progress_pct);
    return {
      id: oneOf(x.id, PILLAR_IDS, "get_found"),
      name: t(x.name, 60) || pillarLabel(x.id),
      priority: oneOf(x.priority, ["high", "medium", "low"], "medium"),
      current_state: t(x.current_state, 700),
      target: t(x.target, 500),
      progress_pct: Number.isFinite(pct) && x.progress_pct !== "" && x.progress_pct !== null ? Math.max(0, Math.min(100, Math.round(pct))) : null,
      progress_basis: t(x.progress_basis, 300),
      interstellar_doing: strs(x.interstellar_doing),
      owner_actions: strs(x.owner_actions),
      next_services: l(x.next_services, 4).map((s) => ({ name: t(s && s.name, 80), why: t(s && s.why, 300) })).filter((s) => s.name),
      kpis: l(x.kpis, 6).map((k) => ({
        name: t(k && k.name, 100), current: t(k && k.current, 60), target: t(k && k.target, 60),
        direction: k && k.direction === "down" ? "down" : "up", source: t(k && k.source, 140), is_estimate: Boolean(k && k.is_estimate),
      })).filter((k) => k.name),
      milestones: { d30: strs(m.d30, 5), d60: strs(m.d60, 5), d90: strs(m.d90, 5) },
    };
  });
  if (!pillars.length && !g.where_they_want_to_be) return null;
  return {
    headline: t(p.headline, 200),
    summary: t(p.summary, 800),
    goal_summary: {
      where_they_are: t(g.where_they_are, 800),
      where_they_want_to_be: t(g.where_they_want_to_be, 800),
      by_when: t(g.by_when, 120),
      north_star: t(g.north_star, 200),
      goals: l(g.goals, 8).map((x) => ({
        title: t(x && x.title, 160), metric: t(x && x.metric, 100), baseline: t(x && x.baseline, 60), current: t(x && x.current, 60),
        target: t(x && x.target, 60), unit: t(x && x.unit, 30), by_when: t(x && x.by_when, 60), source: t(x && x.source, 140), is_estimate: Boolean(x && x.is_estimate),
      })).filter((x) => x.title || x.metric),
      unknowns: strs(g.unknowns, 10),
    },
    industry_snapshot: {
      trade: t(ind.trade, 100), summary: t(ind.summary, 900), whats_working: strs(ind.whats_working, 8), customer_behavior: strs(ind.customer_behavior, 6),
      shifts_2027: strs(ind.shifts_2027, 6), sources: strs(ind.sources, 8, 400),
    },
    pillars,
    quick_wins: l(p.quick_wins, 10).map((q) => (typeof q === "string" ? { title: t(q, 200), owner: "both", why: "", pillar: "" } : {
      title: t(q && q.title, 200), owner: oneOf(q && q.owner, ["client", "interstellar", "both"], "both"), why: t(q && q.why, 300), pillar: t(q && q.pillar, 40),
    })).filter((q) => q.title),
    ignore: l(p.ignore, 8).map((x) => (typeof x === "string" ? { item: t(x, 200), why: "" } : { item: t(x && x.item, 200), why: t(x && x.why, 300) })).filter((x) => x.item),
    risks: l(p.risks, 8).map((x) => (typeof x === "string" ? { risk: t(x, 200), severity: "medium", mitigation: "" } : {
      risk: t(x && x.risk, 240), severity: oneOf(x && x.severity, ["high", "medium", "low"], "medium"), mitigation: t(x && x.mitigation, 300),
    })).filter((x) => x.risk),
    next_steps: strs(p.next_steps, 8),
    assumptions: strs(p.assumptions, 8),
  };
}

/* ---------------- progress (only from real figures) ---------------- */

const num = (v) => {
  const s = String(v || "").replace(/,/g, "").trim();
  if (!s || /unknown|n\/a|tbd/i.test(s)) return null;
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  let n = parseFloat(m[0]);
  if (/\d\s*k\b/i.test(s)) n *= 1000;
  if (/\d\s*m\b/i.test(s)) n *= 1000000;
  return n;
};

// Progress toward target from KPIs that have real current + target figures; else Claude's
// progress_pct (shown as an estimate); else null ("no baseline yet").
export function pillarProgress(pillar) {
  const ratios = (pillar.kpis || []).filter((k) => !k.is_estimate).map((k) => {
    const c = num(k.current);
    const tg = num(k.target);
    if (c == null || tg == null || tg === 0) return null;
    const r = k.direction === "down" ? (c <= 0 ? 1 : tg / c) : c / tg;
    return Math.max(0, Math.min(1, r));
  }).filter((r) => r != null);
  if (ratios.length) return { pct: Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100), basis: `${ratios.length} KPI${ratios.length > 1 ? "s" : ""} with real figures`, estimate: false };
  if (pillar.progress_pct != null) return { pct: pillar.progress_pct, basis: pillar.progress_basis || "Claude's estimate", estimate: true };
  return null;
}

/* ---------------- markdown ---------------- */

export function playbookToMarkdown(p, business = "") {
  if (!p) return "";
  const out = [];
  const g = p.goal_summary || {};
  out.push(`# ${business ? `${business} — ` : ""}2027 Industry Playbook`);
  if (p.headline) out.push("", `**${p.headline}**`);
  if (p.summary) out.push("", p.summary);
  out.push("", "## Goal", `- Where they are: ${g.where_they_are || "unknown"}`, `- Where they want to be: ${g.where_they_want_to_be || "unknown"}`, `- By when: ${g.by_when || "unknown"}`);
  if (g.north_star) out.push(`- North star: ${g.north_star}`);
  (g.goals || []).forEach((x) => out.push(`- ${x.title || x.metric}: ${x.current || x.baseline || "unknown"} → ${x.target || "unknown"} ${x.unit || ""}${x.by_when ? ` by ${x.by_when}` : ""}${x.is_estimate ? " (est.)" : ""}`));
  if ((g.unknowns || []).length) out.push("", "Unknowns: " + g.unknowns.join("; "));
  const ind = p.industry_snapshot || {};
  if (ind.summary || (ind.whats_working || []).length) {
    out.push("", "## Industry snapshot 2027", ind.summary || "");
    (ind.whats_working || []).forEach((x) => out.push(`- ${x}`));
  }
  (p.pillars || []).forEach((x) => {
    out.push("", `## ${x.name} (${x.priority})`, `- Now: ${x.current_state || "unknown"}`, `- Target: ${x.target || "unknown"}`);
    if (x.interstellar_doing.length) out.push("", "**Interstellar is doing**", ...x.interstellar_doing.map((s) => `- ${s}`));
    if (x.owner_actions.length) out.push("", "**You do**", ...x.owner_actions.map((s) => `- ${s}`));
    if (x.next_services.length) out.push("", "**Could add next**", ...x.next_services.map((s) => `- ${s.name}${s.why ? ` — ${s.why}` : ""}`));
    if (x.kpis.length) out.push("", "| KPI | Now | Target |", "| --- | --- | --- |", ...x.kpis.map((k) => `| ${k.name} | ${k.current || "unknown"} | ${k.target || "unknown"}${k.is_estimate ? " (est.)" : ""} |`));
    ["d30", "d60", "d90"].forEach((d) => x.milestones[d].length && out.push("", `**Day ${d.slice(1)}**`, ...x.milestones[d].map((s) => `- ${s}`)));
  });
  if ((p.quick_wins || []).length) out.push("", "## Quick wins this month", ...p.quick_wins.map((q) => `- [ ] ${q.title} (${q.owner})`));
  if ((p.ignore || []).length) out.push("", "## Ignore for now", ...p.ignore.map((x) => `- ${x.item}${x.why ? ` — ${x.why}` : ""}`));
  if ((p.risks || []).length) out.push("", "## Risks", ...p.risks.map((x) => `- (${x.severity}) ${x.risk}${x.mitigation ? ` — ${x.mitigation}` : ""}`));
  if ((p.next_steps || []).length) out.push("", "## Next steps", ...p.next_steps.map((s, i) => `${i + 1}. ${s}`));
  return out.join("\n");
}

/* ---------------- inputs (where the goals come from) ---------------- */

const show = (v) => (Array.isArray(v) ? v.map((x) => (typeof x === "object" && x ? x.name || x.term || x.title || JSON.stringify(x) : x)).join(", ") : typeof v === "object" && v ? JSON.stringify(v) : String(v ?? ""));
const rows = (list) => list.filter(([, v]) => v !== undefined && v !== null && v !== "" && (!Array.isArray(v) || v.length) && !(typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length)).map(([k, v]) => `- ${k}: ${show(v)}`).join("\n");

// Intake answers that carry goals / where they are, asked first.
const INTAKE_GOAL_KEYS = ["goal_12mo", "goal_3yr", "success_with_us", "timeline", "revenue_now", "revenue_goal", "capacity", "avg_ticket", "top_earners", "close_rate", "response_time", "lead_sources", "reviews", "review_process", "keywords", "competitors", "bottleneck", "seasons", "ideal_customer", "why_choose", "past_seo"];
const FLIGHT_GOAL_KEYS = ["goals", "primary_cta", "competitors", "keywords", "timeline", "processes", "software"];

// Inputs come from the shared client context (src/features/clients/clientContext.js).
export async function gatherPlaybookInputs(client) {
  const [ctx, agency] = await Promise.all([loadClientContext(client.id), loadAgencyKnowledge()]);
  return {
    goals: ctx.goals,
    intake: ctx.intake,
    flight: ctx.flight,
    dossier: ctx.dossier,
    audit: ctx.siteAudit,
    review: ctx.review,
    projects: ctx.projects.filter((p) => !["done"].includes(p.status)),
    tasks: ctx.tasks.filter((x) => x.status !== "done"),
    gaps: ctx.gaps.filter((g) => g.status !== "fixed"),
    snapshots: ctx.snapshots,
    work: ctx.work.slice(0, 20),
    automations: ctx.automations.filter((a) => a.status === "active"),
    kit: ctx.brandKit,
    requests: ctx.requests.slice(0, 15),
    current: ctx.playbook,
    ctx,
    agency,
  };
}

// One-line counts for the composer chips.
export function inputChips(d) {
  if (!d) return [];
  const goalAnswers = d.intake ? INTAKE_GOAL_KEYS.filter((k) => d.intake.answers && d.intake.answers[k]).length : 0;
  return [
    ["Goals", String(d.goals.length)],
    ["Intake goal answers", d.intake ? String(goalAnswers) : "none"],
    ["Onboarding answers", d.flight ? "on file" : "none"],
    ["Dossier", d.dossier ? "on file" : "none"],
    ["Site health", d.audit ? String(d.audit.health_score) : "no audit"],
    ["Reviews", d.review && d.review.cache && d.review.cache.rating != null ? `${d.review.cache.rating}★ · ${d.review.cache.total || 0}` : "not linked"],
    ["Open projects", String(d.projects.length)],
    ["Open tasks", String(d.tasks.length)],
    ["Brand kit", d.kit ? `v${d.kit.version || 1}` : "none"],
    ["Current playbook", d.current ? `v${d.current.version || 1}` : "none"],
  ];
}

function clientBlock(c) {
  const ld = c.lead_details || {};
  return rows([
    ["CRMClient id", c.id], ["Business", c.business], ["Contact", c.contact], ["Industry", c.industry], ["Location", c.location],
    ["Website", c.domain || (c.websites || [])[0]], ["Plan with Interstellar", c.plan], ["Services we manage", c.services_managed],
    ["Billing lines", (c.services || []).map((s) => (s && (s.name || s.label)) || "").filter(Boolean)], ["Client since", c.started_on],
    ["Annual revenue (lead form)", ld.annual_revenue], ["Biggest problem (lead form)", ld.biggest_problem], ["Timeline (lead form)", ld.timeline], ["Team size (lead form)", ld.team_size],
  ]);
}

function goalsBlock(goals) {
  if (!goals.length) return "No ClientGoal records yet.";
  return goals.map((g) => `- ${g.title}${g.metric ? ` [${g.metric}]` : ""}: baseline ${g.baseline_value ?? "unknown"}, current ${g.current_value ?? "unknown"}, target ${g.target_value ?? "unknown"} ${g.unit || ""} (year ${g.year || "?"}, status ${g.status || "not_started"})${(g.plan_steps || []).length ? ` — steps: ${g.plan_steps.map((s) => `${s.done ? "[x]" : "[ ]"} ${s.title}`).join("; ")}` : ""}`).join("\n");
}

function intakeBlock(intake) {
  if (!intake) return "No intake audit on file.";
  const a = intake.answers || {};
  const first = INTAKE_GOAL_KEYS.filter((k) => a[k] && (!Array.isArray(a[k]) || a[k].length)).map((k) => `- ${k}: ${show(a[k])}`);
  const rest = Object.entries(a).filter(([k, v]) => !INTAKE_GOAL_KEYS.includes(k) && (Array.isArray(v) ? v.length : v)).map(([k, v]) => `- ${k}: ${show(v).slice(0, 600)}`);
  return [`IntakeAudit ${intake.id} (status ${intake.status}).`, intake.summary ? `Summary: ${intake.summary}` : "", "Goals and where they are:", ...first, rest.length ? "Everything else they answered:" : "", ...rest].filter(Boolean).join("\n");
}

function flightBlock(flight) {
  if (!flight) return "No onboarding flight on file.";
  const a = flight.answers || {};
  return rows([
    ["Package sold", flight.sale_package || flight.package_key], ["Care plan", flight.care_plan], ["Start date", flight.start_date],
    ...FLIGHT_GOAL_KEYS.map((k) => [k, typeof a[k] === "object" && a[k] && !Array.isArray(a[k]) ? "" : a[k]]),
  ]) || "Onboarding flight has no goal answers yet.";
}

function dossierBlock(d) {
  if (!d) return "No Constellations dossier yet.";
  return rows([
    ["Dream outcome", d.dream_outcome], ["Elevator pitch", d.elevator_pitch], ["USP", d.usp], ["Services", d.services], ["Offers", d.offers],
    ["Service area", d.service_area], ["Audience", d.audience], ["Competitors", d.competitors], ["Lead sources", d.lead_sources],
    ["Keywords (top 15)", (d.keywords || []).slice(0, 15)], ["KPIs on file (real, with source)", d.kpis], ["Team size", d.team_size], ["Tools they use", d.tools],
    ["Business health score", d.health_score], ["Pillar scores", d.pillar_scores],
  ]) || "Dossier is empty.";
}

function healthBlock(audit, review, snapshots) {
  const lines = [];
  if (audit) {
    const s = audit.scores || {};
    lines.push(`- Site health ${audit.health_score}/100 (${audit.strategy || "mobile"}, ${String(audit.run_at || "").slice(0, 10)}, ${audit.url || ""}) — performance ${s.performance ?? "?"}, SEO ${s.seo ?? "?"}, accessibility ${s.accessibility ?? "?"}, best practices ${s.best_practices ?? "?"}`);
    const top = (audit.issues || []).slice(0, 6).map((i) => (typeof i === "string" ? i : i && (i.title || i.id))).filter(Boolean);
    if (top.length) lines.push(`- Top site issues: ${top.join("; ")}`);
  } else lines.push("- No SiteAudit yet (site health unknown).");
  const c = review && review.cache;
  if (c && c.rating != null) lines.push(`- Google rating (Stärboard): ${c.rating} from ${c.total || 0} reviews (cached ${String(review.cached_at || "").slice(0, 10)})`);
  else lines.push("- Google rating unknown (not linked in Stärboard).");
  snapshots.forEach((s) => lines.push(`- ${String(s.source).toUpperCase()} ${s.period_start || ""}→${s.period_end || ""}: ${JSON.stringify(s.metrics || {}).slice(0, 500)}`));
  return lines.join("\n");
}

function workBlock(d) {
  const lines = [];
  d.projects.forEach((p) => lines.push(`- Project: ${p.title} (${p.type || "?"}, ${p.status}${p.service_key ? `, ${p.service_key}` : ""}${p.progress != null ? `, ${p.progress}%` : ""}${p.due_date ? `, due ${p.due_date}` : ""})`));
  d.tasks.slice(0, 25).forEach((x) => lines.push(`- Open task: ${x.title}${x.project_name ? ` [${x.project_name}]` : ""} (${x.status}${x.due_date ? `, due ${x.due_date}` : ""})`));
  d.automations.forEach((a) => lines.push(`- Automation running: ${a.name}${a.schedule ? ` (${a.schedule})` : ""}`));
  d.work.slice(0, 15).forEach((w) => lines.push(`- Done ${w.date || ""}: ${w.title} (${w.kind})`));
  d.gaps.slice(0, 15).forEach((g) => lines.push(`- Open gap (${g.severity || "?"}, ${g.area || "?"}): ${g.title}${g.recommendation ? ` — ${g.recommendation}` : ""}`));
  return lines.join("\n") || "No projects, tasks or work logged yet.";
}

function requestsBlock(requests) {
  const withAnswers = (requests || []).filter((r) => (r.answers || []).length || r.details);
  if (!withAnswers.length) return "No form submissions on file.";
  return withAnswers.slice(0, 6).map((r) => [
    `### ${r.form_title || r.title} (${(r.created_date || "").slice(0, 10)})`,
    r.details ? `Details: ${String(r.details).slice(0, 600)}` : "",
    ...(r.answers || []).filter((x) => x && x.value !== undefined && x.value !== "").slice(0, 25).map((x) => `- ${x.label || x.id}: ${show(x.value).slice(0, 400)}`),
  ].filter(Boolean).join("\n")).join("\n\n");
}

function kitBlock(kit) {
  if (!kit) return "No approved brand kit.";
  const k = kit.kit || {};
  const palette = (k.palette || []).map((p) => (p && p.hex ? `${p.name || ""} ${p.hex}`.trim() : "")).filter(Boolean);
  return rows([["Version", kit.version], ["Summary", kit.summary], ["Essence", k.overview && k.overview.essence], ["Tagline", k.taglines && k.taglines.primary], ["Palette", palette], ["Voice", k.voice && k.voice.personality]]);
}

const catalogBlock = () => PACKAGES.map((p) => `- ${p.label}: ${p.tagline}`).join("\n");

function core(client, d, extra) {
  return `# Industry Playbook: ${client.business}

Write a client-specific 2027 industry playbook for ${client.business} (${client.industry || "industry unknown"}${client.location ? `, ${client.location}` : ""}). It is tied to THEIR goals: start from where they are today and where they say they want to be, then lay out, pillar by pillar, how they get there — what Interstellar Strategies is already doing for them, what the owner should do, and what we could add next.

## Client
${clientBlock(client)}

## Their goals (read these first — this is what the playbook serves)
### ClientGoal records (Goals & Gaps tab)
${goalsBlock(d.goals)}

### Intake audit answers (their own words)
${intakeBlock(d.intake)}

### Onboarding flight answers (goals, competitors, keywords)
${flightBlock(d.flight)}

### Constellations dossier
${dossierBlock(d.dossier)}

### Form submissions
${requestsBlock(d.requests)}

## Where they are now
${healthBlock(d.audit, d.review, d.snapshots)}

## What Interstellar is doing for them (projects, tasks, automations, recent work, open gaps)
${workBlock(d)}

## Approved brand kit
${kitBlock(d.kit)}
${d.current ? `\n## Current approved playbook (v${d.current.version || 1})\nThis is a revision. Keep what still holds, update with the inputs above and what Justin asks.\n${d.current.summary || ""}` : ""}

${d.ctx ? `${contextToBrief(d.ctx, { sections: ["profile"] })}\n` : ""}
## Interstellar service catalog (next_services must come from this list, only ones they do not already have)
${catalogBlock()}
${agencyBlock(d.agency, ["offers", "rules"])}
${extra ? `\n## Justin added\n${extra}` : ""}

## Pillars (use these ids; include paid_ads only if it genuinely fits their goals, capacity and budget)
${PILLARS.map(([id, name, what]) => `- ${id} — ${name}: ${what}`).join("\n")}

## Rules for this playbook
- NEVER invent the client's numbers (revenue, leads, rankings, reviews, traffic, close rate). Use only figures from the inputs above, with their source. Anything missing is "unknown" and goes in goal_summary.unknowns.
- A figure you estimate (an industry benchmark, a sensible target) sets is_estimate = true and is labelled "est." wherever it is shown. Never present an estimate as their result.
- progress_pct only when a real current and target figure exist; otherwise omit it.
- interstellar_doing lists only work that is real for this client (their plan, services, projects, tasks, automations, work log). Do not promise services they have not bought.
- owner_actions are specific and doable by a busy owner (who, what, how often).
- 30/60/90-day milestones are concrete and checkable.
- Quick wins: 4-8 things doable this month. "ignore": 3-5 distractions to skip for now. Risks: 3-5 with a mitigation each.
- Industry snapshot reflects what is working in their trade in 2027 (AI search answers, map pack, reviews, speed to lead, etc.) — practical, not generic.
- The Interstellar brand gradient is #ff3c00 → #ff6a00 → #ffaa00 (never gold or yellow).`;
}

export function playbookBrief(client, d, extra = "") {
  return `${core(client, d, extra)}

## What to produce
1. result_data = { "playbook": <the JSON below, every section filled> }
\`\`\`json
${PLAYBOOK_JSON_SHAPE}
\`\`\`
2. result_body = the same playbook as clean client-facing markdown (one H2 per section; KPIs as tables).
3. result_summary = two sentences: the goal and the plan's main bets.
4. needs_from_justin = the unknowns you could not confirm (and anything only the owner can tell us).
You may research their trade and their live site (${client.domain || (client.websites || [])[0] || "no site on file"}) for the industry snapshot and current state; cite URLs in industry_snapshot.sources.

## Rules for this job
- Do NOT create or update an IndustryPlaybook record and do not touch the CRMClient. Approval in Møthership saves the playbook to the client profile.
- Nothing is shown to the client until Justin approves it and turns it on for the portal.

## Rules
${STANDING_RULES.map((r) => `- ${r}`).join("\n")}

## When you finish
Write back to this ClaudeJob: result_data, result_body, result_summary, result_links (anything you made), needs_from_justin, status = needs_approval, finished_at = now.`;
}

function quickPrompt(client, d, extra) {
  return `You are Interstellar Strategies' senior growth strategist. ${core(client, d, extra)}

Return JSON only, matching the schema: {headline, summary, goal_summary, industry_snapshot, pillars[], quick_wins[], ignore[], risks[], next_steps[], assumptions[]}. Include 5-7 pillars.`;
}

function jobFields(client, d, extra) {
  return {
    title: `Industry playbook — ${client.business}`,
    kind: "playbook",
    instructions: playbookBrief(client, d, extra),
    extra,
    client_id: client.id,
    client_name: client.business,
    priority: 2,
    complete_task_on_approve: false,
    requested_at: new Date().toISOString(),
  };
}

export async function queuePlaybook(client, extra = "") {
  const d = await gatherPlaybookInputs(client);
  return base44.entities.ClaudeJob.create({
    ...jobFields(client, d, extra),
    status: "queued",
    context: { [PLAYBOOK_CONTEXT]: true, revision_of: d.current ? d.current.id : "" },
  });
}

// In-app quick draft: same brief + schema through Core.InvokeLLM. It lands as a ClaudeJob waiting for
// approval (so review, approve and "request changes → Claude" work exactly like a queued job).
export async function quickDraftPlaybook(client, extra = "", { web = false } = {}) {
  const d = await gatherPlaybookInputs(client);
  const out = await base44.integrations.Core.InvokeLLM({
    prompt: quickPrompt(client, d, extra),
    response_json_schema: PLAYBOOK_JSON_SCHEMA,
    add_context_from_internet: !!web,
  });
  const playbook = normalizePlaybook(out);
  if (!playbook) throw new Error("The draft came back empty. Try again or send it to Claude.");
  const now = new Date().toISOString();
  return base44.entities.ClaudeJob.create({
    ...jobFields(client, d, extra),
    title: `Industry playbook — ${client.business} (quick draft)`,
    status: "needs_approval",
    started_at: now,
    finished_at: now,
    result_data: { playbook },
    result_summary: playbook.summary || playbook.headline || "Quick draft from Møthership.",
    result_body: playbookToMarkdown(playbook, client.business),
    needs_from_justin: (playbook.goal_summary.unknowns || []).map((u) => `- ${u}`).join("\n"),
    context: { [PLAYBOOK_CONTEXT]: true, quick_draft: true, web: !!web, revision_of: d.current ? d.current.id : "" },
  });
}

export const isPlaybookJob = (job) => !!(job && job.kind === "playbook" && job.context && job.context[PLAYBOOK_CONTEXT]);
export const playbookFromJob = (job) => normalizePlaybook(job && job.result_data);

// Called from approveJob: archive the previous version, save the approved one.
export async function saveApprovedPlaybook(job) {
  if (!job.client_id) return null;
  const playbook = playbookFromJob(job);
  if (!playbook) return null;
  const existing = await base44.entities.IndustryPlaybook.filter({ client_id: job.client_id }, "-version", 50).catch(() => []);
  if ((existing || []).some((k) => k.source_job_id === job.id)) return null; // already saved
  const me = await base44.auth.me().catch(() => null);
  await Promise.all((existing || []).filter((k) => k.status === "approved").map((k) => base44.entities.IndustryPlaybook.update(k.id, { status: "archived", portal_visible: false })));
  const version = (existing || []).reduce((max, k) => Math.max(max, Number(k.version) || 0), 0) + 1;
  return base44.entities.IndustryPlaybook.create({
    client_id: job.client_id,
    client_name: job.client_name || "",
    status: "approved",
    version,
    summary: job.result_summary || playbook.summary || "",
    playbook,
    // Fallback text only (the view renders from `playbook`); long text fields are rejected by the entity API.
    body_md: ((s) => (s && s.length <= 8000 ? s : ""))(job.result_body || playbookToMarkdown(playbook, job.client_name || "")),
    source_job_id: job.id,
    generated_by: job.context && job.context.quick_draft ? "quick_draft" : "claude_queue",
    approved_at: new Date().toISOString(),
    approved_by: (me && me.email) || "",
    portal_visible: false,
    quick_wins_done: [],
  });
}
