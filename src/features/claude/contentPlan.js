// "Content plan": a client's visible plan of attack for the blog, GBP posts and project pages.
// Built like the playbook: a rich brief → a ClaudeJob (kind "content_plan") or an in-app quick
// draft (Core.InvokeLLM with the same schema) → Justin approves → a versioned ContentPlan.
import { base44 } from "@/api/base44Client";
import { STANDING_RULES } from "./jobs";

export const CONTENT_PLAN_CONTEXT = "content_plan";

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const GBP_POST_TYPES = ["update", "offer", "event", "product"];
export const QUEUE_STATUSES = ["planned", "written", "published"];

// Justin's standing GBP rules (Google removed posts that broke them). Every plan carries them.
export const GBP_COMPLIANCE = [
  "Never put a phone number, street address or bare URL in the post body. Contact details live on the profile.",
  "The Learn more button is the only link: the plain blog post URL, no UTM parameters.",
];

// How any client's portal submission becomes a page on their website (shown on every project card).
export const PROJECT_PIPELINE_STEPS = [
  ["Submit", "The client (or their crew) adds a finished job in their ops portal: photos, location, service, a few notes. It saves as a submission record."],
  ["Mark ready", "When the photos and details are complete, the submission is set to \"ready\". Nothing is published before that."],
  ["Daily run", "A scheduled Claude task reads the ready submissions, writes the case-study copy (no invented facts, figures or client names) and adds the page to the website app."],
  ["Publish + index", "The page goes live at the site's project URL pattern, is added to the sitemap, and the submission is marked published with its URL."],
  ["Reuse", "The new project can feed a GBP post and is linked from related service, city and blog pages."],
];

/* ---------------- schema ---------------- */

const str = { type: "string" };
const strList = { type: "array", items: str };
const obj = (properties) => ({ type: "object", properties });

export const CONTENT_PLAN_JSON_SCHEMA = obj({
  summary: str,
  blog: obj({
    enabled: { type: "boolean" },
    frequency: str,
    days: strList,
    cadence_notes: str,
    url_pattern: str,
    category_rotation: strList,
    pillars: { type: "array", items: obj({ name: str, description: str, categories: strList }) },
    keyword_targets: { type: "array", items: obj({ keyword: str, intent: str, priority: str, target_page: str, city: str }) },
    geo_plan: { type: "array", items: obj({ ring: str, label: str, cities: strList, notes: str }) },
    editorial_queue: { type: "array", items: obj({ order: { type: "number" }, category: str, title: str, slug: str, primary_keyword: str, city: str, ring: str }) },
    internal_linking: strList,
    format_rules: strList,
    cover_image_rules: strList,
  }),
  gbp: obj({
    enabled: { type: "boolean" },
    frequency: str,
    days: strList,
    cadence_notes: str,
    derived_from_blog: { type: "boolean" },
    post_types: strList,
    themes: strList,
    keyword_angles: strList,
    photo_rules: strList,
    sample_posts: { type: "array", items: obj({ type: str, title: str, body: str, cta: str }) },
  }),
  projects: obj({ enabled: { type: "boolean" }, publish_url_pattern: str, cadence: str, notes: str }),
  kpis: { type: "array", items: obj({ name: str, target: str, current: str, source: str }) },
  unknowns: strList,
});

export const CONTENT_PLAN_JSON_SHAPE = `{
  "summary": "2-3 sentences: what we publish, how often, and why",
  "blog": {
    "enabled": true,
    "frequency": "e.g. 2 per week",
    "days": ["Tue", "Thu"],
    "cadence_notes": "anything about timing, seasonality, pauses",
    "url_pattern": "/blog/<slug> (from the live site if you can see it)",
    "category_rotation": ["6-8 categories in the order they rotate; never the same category twice in a row"],
    "pillars": [{ "name": "topic cluster", "description": "", "categories": ["which rotation categories feed it"] }],
    "keyword_targets": [{ "keyword": "", "intent": "service | emergency | cost | comparison | informational | brand", "priority": "primary | secondary | long_tail", "target_page": "the existing page URL it supports", "city": "" }],
    "geo_plan": [{ "ring": "R0", "label": "home base", "cities": ["only cities they actually serve"], "notes": "" }],
    "editorial_queue": [{ "order": 1, "category": "", "title": "", "slug": "", "primary_keyword": "", "city": "", "ring": "R0" }],
    "internal_linking": ["rules: which pages every post links to, how older posts link to the new one"],
    "format_rules": ["AEO/GEO format: direct answer up top, question H2s, FAQ, schema, word count"],
    "cover_image_rules": ["where covers come from, uniqueness, alt text"]
  },
  "gbp": {
    "enabled": true,
    "frequency": "",
    "days": ["Tue"],
    "cadence_notes": "",
    "derived_from_blog": true,
    "post_types": ["update | offer | event | product, in rotation order; offer/event only if the client has real ones"],
    "themes": [""],
    "keyword_angles": [""],
    "photo_rules": [""],
    "sample_posts": [{ "type": "update", "title": "", "body": "<= 1,500 chars, no phone, no address, no URL", "cta": "Learn more" }]
  },
  "projects": { "enabled": false, "publish_url_pattern": "/projects/<slug>", "cadence": "daily", "notes": "" },
  "kpis": [{ "name": "", "target": "", "current": "real figure or \\"unknown\\"", "source": "" }],
  "unknowns": ["facts we still need from Justin or the owner"]
}`;

/* ---------------- normalise ---------------- */

const t = (v, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const l = (v, max = 40) => (Array.isArray(v) ? v.slice(0, max) : []);
const strs = (v, max = 20, len = 300) => l(v, max).map((x) => t(typeof x === "object" && x ? x.text || x.name || x.title || "" : x, len)).filter(Boolean);
const o = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

export function normalizeDay(d) {
  const s = String(d || "").trim().slice(0, 3).toLowerCase();
  return WEEKDAYS.find((w) => w.toLowerCase() === s) || "";
}

export function slugify(s) {
  return String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

export function normalizeQueueRow(r, i) {
  const x = o(r);
  return {
    order: Number.isFinite(Number(x.order)) ? Number(x.order) : i + 1,
    category: t(x.category, 60),
    title: t(x.title, 220),
    slug: t(x.slug, 120) || slugify(x.title),
    primary_keyword: t(x.primary_keyword, 120),
    city: t(x.city, 120),
    ring: t(x.ring, 20),
    status: QUEUE_STATUSES.includes(x.status) ? x.status : "planned",
    published_url: t(x.published_url, 300),
    published_at: t(x.published_at, 30),
  };
}

export function normalizeContentPlan(raw) {
  let p = raw;
  if (typeof p === "string") {
    try { p = JSON.parse(p); } catch { p = null; }
  }
  if (p && p.content_plan && typeof p.content_plan === "object") p = p.content_plan;
  if (!p || typeof p !== "object") return null;
  const b = o(p.blog);
  const g = o(p.gbp);
  const pr = o(p.projects);
  const blog = {
    enabled: b.enabled !== false,
    frequency: t(b.frequency, 80),
    days: l(b.days, 7).map(normalizeDay).filter(Boolean),
    cadence_notes: t(b.cadence_notes, 600),
    url_pattern: t(b.url_pattern, 120),
    automation_status: t(b.automation_status, 30),
    category_rotation: strs(b.category_rotation, 12, 60),
    pillars: l(b.pillars, 10).map((x) => ({ name: t(o(x).name, 80), description: t(o(x).description, 300), categories: strs(o(x).categories, 8, 60) })).filter((x) => x.name),
    keyword_targets: l(b.keyword_targets, 60).map((x) => ({
      keyword: t(o(x).keyword || o(x).term, 140), intent: t(o(x).intent, 30), priority: t(o(x).priority, 20), target_page: t(o(x).target_page || o(x).page_url, 300), city: t(o(x).city, 80),
    })).filter((x) => x.keyword),
    geo_plan: l(b.geo_plan, 8).map((x) => ({ ring: t(o(x).ring, 12), label: t(o(x).label, 80), cities: strs(o(x).cities, 20, 60), notes: t(o(x).notes, 300) })).filter((x) => x.ring || x.cities.length),
    editorial_queue: l(b.editorial_queue, 60).map(normalizeQueueRow).filter((x) => x.title).sort((a, z) => a.order - z.order),
    published_log: l(b.published_log, 100).map((x) => ({ slug: t(o(x).slug, 120), title: t(o(x).title, 220), category: t(o(x).category, 60), date: t(o(x).date, 20), url: t(o(x).url, 300) })).filter((x) => x.slug || x.title),
    internal_linking: strs(b.internal_linking, 12, 400),
    format_rules: strs(b.format_rules, 16, 400),
    cover_image_rules: strs(b.cover_image_rules, 8, 400),
  };
  const gbp = {
    enabled: g.enabled !== false,
    frequency: t(g.frequency, 80),
    days: l(g.days, 7).map(normalizeDay).filter(Boolean),
    cadence_notes: t(g.cadence_notes, 600),
    derived_from_blog: g.derived_from_blog !== false,
    post_types: l(g.post_types, 8).map((x) => String(x || "").toLowerCase().trim()).filter((x) => GBP_POST_TYPES.includes(x)),
    themes: strs(g.themes, 12, 120),
    keyword_angles: strs(g.keyword_angles, 12, 140),
    photo_rules: strs(g.photo_rules, 8, 300),
    compliance_rules: [...GBP_COMPLIANCE, ...strs(g.compliance_rules, 8, 300).filter((r) => !GBP_COMPLIANCE.includes(r))],
    sample_posts: l(g.sample_posts, 2).map((x) => ({ type: t(o(x).type, 20) || "update", title: t(o(x).title, 120), body: t(o(x).body, 1500), cta: t(o(x).cta, 40) || "Learn more" })).filter((x) => x.body),
  };
  if (!gbp.post_types.length) gbp.post_types = ["update"];
  const projects = {
    enabled: !!pr.enabled,
    source_app_id: t(pr.source_app_id, 60),
    source_entity: t(pr.source_entity, 60),
    source_status: t(pr.source_status, 30),
    publish_url_pattern: t(pr.publish_url_pattern, 160),
    cadence: t(pr.cadence, 80),
    automation_name: t(pr.automation_name, 160),
    published_count: Number.isFinite(Number(pr.published_count)) && pr.published_count !== "" && pr.published_count !== null ? Number(pr.published_count) : null,
    notes: t(pr.notes, 600),
  };
  if (!blog.editorial_queue.length && !blog.category_rotation.length && !gbp.themes.length) return null;
  return {
    summary: t(p.summary, 800),
    blog,
    gbp,
    projects,
    kpis: l(p.kpis, 10).map((x) => ({ name: t(o(x).name, 100), target: t(o(x).target, 80), current: t(o(x).current, 80), source: t(o(x).source, 140) })).filter((x) => x.name),
    unknowns: strs(p.unknowns, 12),
  };
}

/* ---------------- schedule ---------------- */

// Next `count` dates, starting today, that fall on `days`.
export function upcomingDates(days, count, from = new Date()) {
  const idx = (days || []).map((d) => WEEKDAYS.indexOf(normalizeDay(d))).filter((i) => i >= 0);
  if (!idx.length) return [];
  const out = [];
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  for (let i = 0; i < 400 && out.length < count; i++) {
    if (idx.includes(d.getDay())) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export const isoDay = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "");
export const fmtDay = (d) => (d ? d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "—");

// The next N unpublished queue rows with the slot each would run in.
export function nextBlogSlots(plan, n = 6) {
  const blog = (plan && plan.blog) || {};
  const rows = (blog.editorial_queue || []).map(normalizeQueueRow).filter((r) => r.status !== "published").sort((a, z) => a.order - z.order).slice(0, n);
  const dates = upcomingDates(blog.days, rows.length);
  return rows.map((r, i) => ({ ...r, due: dates[i] || null }));
}

// GBP calendar: every GBP day in the next `weeks` weeks, with its post type (rotation) and the blog it draws on.
export function gbpCalendar(plan, weeks = 4) {
  const gbp = (plan && plan.gbp) || {};
  const blog = (plan && plan.blog) || {};
  if (!gbp.enabled) return [];
  const days = (gbp.days || []).length ? gbp.days : gbp.derived_from_blog ? blog.days || [] : [];
  const end = new Date();
  end.setDate(end.getDate() + weeks * 7);
  const dates = upcomingDates(days, 40).filter((d) => d <= end);
  const blogs = gbp.derived_from_blog ? nextBlogSlots(plan, 60) : [];
  const types = (gbp.post_types || []).length ? gbp.post_types : ["update"];
  return dates.map((d, i) => {
    const b = blogs.find((x) => x.due && isoDay(x.due) === isoDay(d)) || null;
    return {
      date: d,
      type: types[i % types.length],
      theme: b ? b.category : (gbp.themes || [])[i % Math.max(1, (gbp.themes || []).length)] || "",
      blog: b,
    };
  });
}

export function nextPostDue(plan) {
  const s = nextBlogSlots(plan, 1)[0];
  return s && s.due ? s : null;
}

/* ---------------- inputs + readiness ---------------- */

const show = (v) => (Array.isArray(v) ? v.map((x) => (typeof x === "object" && x ? x.name || x.term || x.city || x.title || JSON.stringify(x) : x)).join(", ") : typeof v === "object" && v ? JSON.stringify(v) : String(v ?? ""));
const has = (v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== "");

export async function gatherContentPlanInputs(client) {
  const safe = (p) => Promise.resolve(p).then((r) => (Array.isArray(r) ? r : [])).catch(() => []);
  const f = (entity, sort, limit, q = { client_id: client.id }) => safe(base44.entities[entity].filter(q, sort, limit));
  const [dossiers, intakes, flights, goals, books, kits, autos, work, plans] = await Promise.all([
    f("ClientDossier", "-updated_date", 1),
    f("IntakeAudit", "-created_date", 1),
    f("OnboardingFlight", "-created_date", 3),
    f("ClientGoal", "sort", 50),
    f("IndustryPlaybook", "-version", 5),
    f("BrandKit", "-version", 5),
    f("Automation", "-created_date", 50),
    f("WorkLog", "-date", 60),
    f("ContentPlan", "-version", 10),
  ]);
  return {
    dossier: dossiers[0] || null,
    intake: intakes[0] || null,
    flight: flights.find((x) => x.status !== "archived") || flights[0] || null,
    goals,
    playbook: books.find((x) => x.status === "approved") || null,
    kit: kits.find((k) => k.status === "approved") || null,
    automations: autos,
    posts: work.filter((w) => w.kind === "blog"),
    gbpPosts: work.filter((w) => w.kind === "gbp_post"),
    current: plans.find((x) => x.status === "approved") || null,
  };
}

// What has to be on file before a plan can be generated. Each miss says where to fix it.
export function contentPlanCriteria(client, d) {
  const dos = (d && d.dossier) || {};
  const ia = (d && d.intake && d.intake.answers) || {};
  const fa = (d && d.flight && d.flight.answers) || {};
  const cities = ((dos.service_area || {}).cities || []).filter((c) => c && c.city);
  const keywordsOk = (dos.keywords || []).length > 0 || has(ia.keywords) || has(fa.keywords);
  const goalsOk = ((d && d.goals) || []).length > 0 || has(ia.goal_12mo) || has(fa.goals) || has(dos.dream_outcome);
  return [
    { key: "industry", label: "Industry", ok: has(client.industry), detail: client.industry || "Not set on the client profile", fix: "edit" },
    { key: "website", label: "Website", ok: has(client.domain) || has(client.websites), detail: client.domain || (client.websites || [])[0] || "No domain on the client profile", fix: "edit" },
    { key: "services", label: "Services", ok: (dos.services || []).length > 0, detail: (dos.services || []).length ? `${dos.services.length} in the dossier` : "No services in the Constellations dossier", fix: "constellations" },
    { key: "service_area", label: "Service area / cities", ok: cities.length > 0 || has((dos.service_area || {}).primary_city), detail: cities.length ? `${cities.length} cities in the dossier` : (dos.service_area || {}).primary_city || "No service area in the dossier", fix: "constellations" },
    { key: "keywords", label: "Target keywords", ok: keywordsOk, detail: (dos.keywords || []).length ? `${dos.keywords.length} keywords (keyword steward)` : keywordsOk ? "From intake / onboarding answers" : "No keywords in the dossier or intake answers", fix: "constellations" },
    { key: "goals", label: "Goals", ok: goalsOk, detail: ((d && d.goals) || []).length ? `${d.goals.length} goals on file` : goalsOk ? "From intake / onboarding / dossier" : "No goals on file", fix: "goals" },
  ];
}

export function inputChips(d) {
  if (!d) return [];
  return [
    ["Keywords", String(((d.dossier || {}).keywords || []).length)],
    ["Cities", String((((d.dossier || {}).service_area || {}).cities || []).length)],
    ["Services", String(((d.dossier || {}).services || []).length)],
    ["Playbook", d.playbook ? `v${d.playbook.version || 1}` : "none"],
    ["Brand voice", d.kit ? `kit v${d.kit.version || 1}` : (d.dossier || {}).brand_voice ? "dossier" : "none"],
    ["Blog posts logged", String(d.posts.length)],
    ["Automations", String(d.automations.length)],
    ["Current plan", d.current ? `v${d.current.version || 1}` : "none"],
  ];
}

function clientBlock(c) {
  return [
    ["CRMClient id", c.id], ["Business", c.business], ["Industry", c.industry], ["Location", c.location],
    ["Website", c.domain || (c.websites || [])[0]], ["Website Base44 app id", c.site_app_id], ["Ops / portal Base44 app id", c.ops_app_id],
    ["Plan with Interstellar", c.plan], ["Contracted content (CRM blogSchedule)", (c.blogSchedule || []).map((s) => `${s.count} ${s.type} ${s.frequency}`).join("; ")],
  ].filter(([, v]) => has(v)).map(([k, v]) => `- ${k}: ${v}`).join("\n");
}

function dossierBlock(d) {
  if (!d) return "No Constellations dossier yet.";
  const sa = d.service_area || {};
  const lines = [
    `- Service model: ${sa.model || "unknown"}; primary city: ${sa.primary_city || "unknown"}`,
    `- Cities (priority / status / page): ${(sa.cities || []).map((c) => `${c.city}${c.state ? `, ${c.state}` : ""} [${c.priority || "?"} / ${c.status || "?"}${c.page_url ? ` / ${c.page_url}` : ""}]`).join("; ") || "none"}`,
    `- Services: ${(d.services || []).map((s) => `${s.name}${s.priority ? ` (${s.priority})` : ""}${s.page_url ? ` ${s.page_url}` : ""}`).join("; ") || "none"}`,
    "- Keywords (term | intent | priority | city | page | status):",
    ...(d.keywords || []).slice(0, 60).map((k) => `  - ${k.term} | ${k.intent || "?"} | ${k.priority || "?"} | ${k.city || ""} | ${k.page_url || ""} | ${k.status || ""}`),
  ];
  if ((d.keyword_log || []).length) lines.push(`- Keyword log (latest): ${(d.keyword_log || []).slice(-5).map((x) => `${x.date}: ${x.change}`).join("; ")}`);
  if (d.audience && Object.keys(d.audience).length) lines.push(`- Audience: ${show(d.audience).slice(0, 800)}`);
  if (d.brand_voice && Object.keys(d.brand_voice).length) lines.push(`- Brand voice: ${show(d.brand_voice).slice(0, 800)}`);
  if (has(d.differentiators)) lines.push(`- Differentiators: ${show(d.differentiators)}`);
  if (has(d.dream_outcome)) lines.push(`- Dream outcome: ${d.dream_outcome}`);
  return lines.join("\n");
}

function answersBlock(d) {
  const ia = (d.intake && d.intake.answers) || {};
  const fa = (d.flight && d.flight.answers) || {};
  const keys = ["goal_12mo", "goal_3yr", "keywords", "competitors", "seasons", "ideal_customer", "why_choose", "past_seo", "top_earners"];
  const lines = keys.filter((k) => has(ia[k])).map((k) => `- intake.${k}: ${show(ia[k]).slice(0, 500)}`);
  ["goals", "keywords", "competitors", "primary_cta"].filter((k) => has(fa[k]) && typeof fa[k] !== "object").forEach((k) => lines.push(`- onboarding.${k}: ${String(fa[k]).slice(0, 500)}`));
  (d.goals || []).forEach((g) => lines.push(`- ClientGoal: ${g.title}${g.target_value != null ? ` → ${g.target_value} ${g.unit || ""}` : ""}`));
  return lines.join("\n") || "No goal or keyword answers on file.";
}

function playbookBlock(pb) {
  if (!pb) return "No approved industry playbook.";
  const p = pb.playbook || {};
  const content = (p.pillars || []).find((x) => x.id === "content_social" || x.id === "get_found");
  return [`Approved playbook v${pb.version || 1}: ${pb.summary || p.headline || ""}`, content ? `Relevant pillar (${content.name}): target ${content.target || "?"}; doing: ${(content.interstellar_doing || []).join("; ")}` : ""].filter(Boolean).join("\n");
}

function kitBlock(kit) {
  if (!kit) return "No approved brand kit.";
  const k = kit.kit || {};
  return `Brand kit v${kit.version || 1}. Voice: ${(k.voice && (k.voice.personality || show(k.voice))) || "?"}`.slice(0, 900);
}

function existingBlock(d, client) {
  const lines = [];
  d.posts.slice(0, 30).forEach((w) => lines.push(`- Blog ${w.date || ""}: ${w.title}${w.url ? ` (${w.url})` : ""}`));
  d.automations.forEach((a) => lines.push(`- Automation: ${a.name} [${a.kind}, ${a.status}${a.schedule ? `, ${a.schedule}` : ""}]`));
  if (d.current) {
    const b = (d.current.blog || {});
    lines.push(`- Current plan v${d.current.version || 1}: rotation ${(b.category_rotation || []).join(" → ")}; ${(b.editorial_queue || []).length} queued; ${(b.published_log || []).length} published logged`);
  }
  if (client.site_app_id) lines.push(`- Website Base44 app ${client.site_app_id}: read its blog posts file READ-ONLY (e.g. src/lib/posts.json) to list existing posts and avoid repeats.`);
  return lines.join("\n") || "No existing blog posts or automations logged.";
}

function core(client, d, extra) {
  return `# Content plan: ${client.business}

Write ${client.business}'s content plan of attack: the BLOG plan, the Google Business Profile POSTING plan, and the PROJECT SUBMISSION → website page pipeline. It must be specific to this client's services, cities and keywords below.

## Client
${clientBlock(client)}

## Constellations dossier (services, service area, keywords from the monthly keyword steward)
${dossierBlock(d.dossier)}

## Goals and keyword answers
${answersBlock(d)}

## Industry playbook
${playbookBlock(d.playbook)}

## Brand voice
${kitBlock(d.kit)}

## Existing content and automations
${existingBlock(d, client)}
${d.current ? "\nThis is a revision. Keep queue rows already written or published and their order; change what Justin asks." : ""}
${extra ? `\n## Justin added\n${extra}` : ""}

## Rules for this plan
- NEVER invent client facts (clients' names, prices, stats, certifications, cities they do not serve, offers or events they do not run). Keyword targets map to pages that already exist in the dossier where possible.
- Category rotation: 6-8 categories; consecutive posts never share a category. Editorial queue: 8-12 rows in rotation order, each with a unique slug, a primary keyword from the dossier where one fits, and a ring/city.
- Geo plan: rings expand outward from the home city, using only cities in the service area.
- AEO/GEO format rules: a 45-70 word direct answer under the title, question-style H2s, an FAQ block with self-contained answers, BlogPosting + FAQPage schema, local landmarks named.
- GBP: post types rotate only through types the client really has (no offer or event posts without a real offer or event). Sample posts: two, each under 1,500 characters.
${GBP_COMPLIANCE.map((r) => `- GBP: ${r}`).join("\n")}
- Project pipeline: enabled only if the client has an ops/portal app where they submit jobs. Otherwise set enabled = false and say what is missing in notes.
- KPIs: real current figures only, with source; otherwise "unknown".`;
}

export function contentPlanBrief(client, d, extra = "") {
  return `${core(client, d, extra)}

## What to produce
1. result_data = { "content_plan": <the JSON below, every section filled> }
\`\`\`json
${CONTENT_PLAN_JSON_SHAPE}
\`\`\`
2. result_body = the plan as clean markdown (blog cadence, rotation, queue table, keyword map, rings, GBP calendar rules, project pipeline).
3. result_summary = two sentences.
4. needs_from_justin = the unknowns.

## Rules for this job
- Do NOT create or update a ContentPlan record and do not change the client's site or scheduled tasks. Approval in Møthership saves the plan to the client profile.

## Rules
${STANDING_RULES.map((r) => `- ${r}`).join("\n")}

## When you finish
Write back to this ClaudeJob: result_data, result_body, result_summary, needs_from_justin, status = needs_approval, finished_at = now.`;
}

function quickPrompt(client, d, extra) {
  return `You are Interstellar Strategies' senior content strategist. ${core(client, d, extra)}

Return JSON only, matching the schema: {summary, blog, gbp, projects, kpis[], unknowns[]}.`;
}

/* ---------------- markdown ---------------- */

export function contentPlanToMarkdown(p, business = "") {
  if (!p) return "";
  const b = p.blog || {};
  const g = p.gbp || {};
  const pr = p.projects || {};
  const out = [`# ${business ? `${business} — ` : ""}Content plan`];
  if (p.summary) out.push("", p.summary);
  out.push("", "## Blog", `- Cadence: ${b.frequency || "?"}${(b.days || []).length ? ` (${b.days.join(" + ")})` : ""}`);
  if (b.cadence_notes) out.push(`- Notes: ${b.cadence_notes}`);
  if ((b.category_rotation || []).length) out.push(`- Rotation: ${b.category_rotation.join(" → ")}`);
  if ((b.geo_plan || []).length) out.push("", "### Geo rings", ...b.geo_plan.map((r) => `- ${r.ring}${r.label ? ` (${r.label})` : ""}: ${r.cities.join(", ")}`));
  if ((b.editorial_queue || []).length) {
    out.push("", "### Editorial queue", "| # | Category | Title | Slug | Ring | Keyword | Status |", "| --- | --- | --- | --- | --- | --- | --- |");
    b.editorial_queue.forEach((r) => out.push(`| ${r.order} | ${r.category} | ${r.title} | ${r.slug} | ${r.ring || r.city} | ${r.primary_keyword} | ${r.status} |`));
  }
  if ((b.keyword_targets || []).length) out.push("", "### Keyword map", "| Keyword | Priority | Target page |", "| --- | --- | --- |", ...b.keyword_targets.map((k) => `| ${k.keyword} | ${k.priority} | ${k.target_page} |`));
  [["Internal linking", b.internal_linking], ["Format (AEO/GEO)", b.format_rules], ["Cover images", b.cover_image_rules]].forEach(([h, list]) => (list || []).length && out.push("", `### ${h}`, ...list.map((x) => `- ${x}`)));
  out.push("", "## Google Business Profile", `- Cadence: ${g.frequency || "?"}${(g.days || []).length ? ` (${g.days.join(" + ")})` : ""}${g.derived_from_blog ? " · derived from each blog post" : ""}`, `- Post types: ${(g.post_types || []).join(" → ")}`);
  (g.compliance_rules || GBP_COMPLIANCE).forEach((r) => out.push(`- ${r}`));
  (g.sample_posts || []).forEach((s, i) => out.push("", `**Sample ${i + 1} (${s.type})${s.title ? ` — ${s.title}` : ""}**`, s.body));
  out.push("", "## Project pages", pr.enabled ? `- ${pr.source_entity || "Submissions"} (${pr.source_status || "ready"}) → ${pr.publish_url_pattern || "?"} · ${pr.cadence || "?"}` : "- No submission pipeline yet.");
  if (pr.notes) out.push(`- ${pr.notes}`);
  return out.join("\n");
}

/* ---------------- jobs ---------------- */

function jobFields(client, d, extra) {
  return {
    title: `Content plan — ${client.business}`,
    kind: "content_plan",
    instructions: contentPlanBrief(client, d, extra),
    extra,
    client_id: client.id,
    client_name: client.business,
    priority: 2,
    complete_task_on_approve: false,
    requested_at: new Date().toISOString(),
  };
}

export async function queueContentPlan(client, extra = "") {
  const d = await gatherContentPlanInputs(client);
  return base44.entities.ClaudeJob.create({
    ...jobFields(client, d, extra),
    status: "queued",
    context: { [CONTENT_PLAN_CONTEXT]: true, revision_of: d.current ? d.current.id : "" },
  });
}

export async function quickDraftContentPlan(client, extra = "") {
  const d = await gatherContentPlanInputs(client);
  const out = await base44.integrations.Core.InvokeLLM({ prompt: quickPrompt(client, d, extra), response_json_schema: CONTENT_PLAN_JSON_SCHEMA });
  const plan = normalizeContentPlan(out);
  if (!plan) throw new Error("The draft came back empty. Try again or send it to Claude.");
  const now = new Date().toISOString();
  return base44.entities.ClaudeJob.create({
    ...jobFields(client, d, extra),
    title: `Content plan — ${client.business} (quick draft)`,
    status: "needs_approval",
    started_at: now,
    finished_at: now,
    result_data: { content_plan: plan },
    result_summary: plan.summary || "Quick draft from Møthership.",
    result_body: contentPlanToMarkdown(plan, client.business),
    needs_from_justin: (plan.unknowns || []).map((u) => `- ${u}`).join("\n"),
    context: { [CONTENT_PLAN_CONTEXT]: true, quick_draft: true, revision_of: d.current ? d.current.id : "" },
  });
}

export const isContentPlanJob = (job) => !!(job && job.kind === "content_plan" && job.context && job.context[CONTENT_PLAN_CONTEXT]);
export const contentPlanFromJob = (job) => normalizeContentPlan(job && job.result_data);

// Called from approveJob: archive the previous approved version, save the new one. Rows already
// written or published in the previous version keep their status when the slug matches.
export async function saveApprovedContentPlan(job) {
  if (!job.client_id) return null;
  const plan = contentPlanFromJob(job);
  if (!plan) return null;
  const existing = (await base44.entities.ContentPlan.filter({ client_id: job.client_id }, "-version", 50).catch(() => [])) || [];
  if (existing.some((k) => k.source_job_id === job.id)) return null;
  const prev = existing.find((k) => k.status === "approved");
  if (prev) {
    const done = new Map(((prev.blog || {}).editorial_queue || []).filter((r) => r.status !== "planned").map((r) => [r.slug, r]));
    plan.blog.editorial_queue = plan.blog.editorial_queue.map((r) => (done.has(r.slug) ? { ...r, status: done.get(r.slug).status, published_url: done.get(r.slug).published_url || "", published_at: done.get(r.slug).published_at || "" } : r));
    if (!plan.blog.published_log.length) plan.blog.published_log = (prev.blog || {}).published_log || [];
    if (!plan.projects.source_app_id && prev.projects) plan.projects = { ...prev.projects, ...Object.fromEntries(Object.entries(plan.projects).filter(([, v]) => has(v) && v !== false)) };
  }
  const me = await base44.auth.me().catch(() => null);
  await Promise.all(existing.filter((k) => k.status === "approved").map((k) => base44.entities.ContentPlan.update(k.id, { status: "archived" })));
  const version = existing.reduce((max, k) => Math.max(max, Number(k.version) || 0), 0) + 1;
  const { unknowns, ...rest } = plan; // eslint-disable-line no-unused-vars
  return base44.entities.ContentPlan.create({
    client_id: job.client_id,
    client_name: job.client_name || "",
    status: "approved",
    version,
    ...rest,
    automation_name: (prev && prev.automation_name) || "",
    automation_status: (prev && prev.automation_status) || "not_set_up",
    body_md: job.result_body || contentPlanToMarkdown(plan, job.client_name || ""),
    source_job_id: job.id,
    generated_by: job.context && job.context.quick_draft ? "quick_draft" : "claude_queue",
    approved_at: new Date().toISOString(),
    approved_by: (me && me.email) || "",
  });
}
