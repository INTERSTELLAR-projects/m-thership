// Engine readiness + "Start engine" for one client.
// Ready = profile ≥ the completeness meter's green threshold (80%) with every blog-critical field filled,
// the new site live on Base44 with a blog collection, a GBP connection or link on file, and the portal on.
// Starting creates one EngineStart record and queues month 1 as ClaudeJobs the hourly queue runner picks up:
// the month's Topic Calendar (Justin approves it once; posts then publish on their own), outreach research +
// drafts, the social plan and review-request drafts. Claude may press Start engine itself when all four lights are
// green (approval policy: notify). Months 2+ are queued by the "Engines — monthly re-queue" workflow.
import { base44 } from "@/api/base44Client";
import { evaluateCriteria, has } from "@/features/clients/criteria";
import { STANDING_RULES } from "@/features/claude/jobs";
import { queueTopicCalendar, monthKeyLA, monthLabel } from "./topicCalendar";

export const COMPLETE_AT = 80; // same threshold the profile meter and the % badge turn green at
export const BLOG_CRITICAL = ["services", "service_areas", "keywords", "voice", "photos", "reviews_link"];

// Where each active client's site actually lives (custom-domain API + site app code, audited Nov 4, 2026).
// Claude refreshes this; an AppSettings row key "launch_facts" (pageSettings.sites[clientId]) overrides it.
export const SITE_FACTS = {
  "6a7e0ed45a3ed5aeb6868401": { live: true, domain: "palmshorehardscapes.com", blog: "BlogPost entity" },
  "6a6c13fd03bab4ff324fce0a": { live: true, domain: "govelocity.com", blog: "BlogPost entity" },
  "69d884d3501897bd1df0794c": { live: true, domain: "mowmastersofascension.com", blog: "posts.json (file)" },
  "69d884d3aa7b854da8a12614": { live: true, domain: "arcaneinkriverside.com", blog: "Post entity" },
  "69d884d38fe4bacbc82853ac": { live: false, domain: "nwtreeremoval.com", old: "Squarespace", blog: "file-based" },
  "6a6c13548653b2e1e6c3de46": { live: false, domain: "oregonpowerlift.com", old: "Framer", blog: "file-based" },
  "6a39ca29c61bf8a49ef76324": { live: false, domain: "royalzbarbers.com", old: "Framer", blog: "BlogPost entity" },
  "69d884d3dd31b39b6a77c7cd": { live: false, domain: "chasinggains.net", old: "Framer", blog: "BlogPost entity" },
  "6a39e2026c54d9a15b5caf25": { live: false, domain: "takerein.com", old: "Squarespace", blog: "Post entity" },
  "69d884d3049d808969e477d1": { live: false, domain: "musclementorcoaching.com", old: "Framer", blog: "file-based" },
  "69d884d30f93ad2e14bbbeb3": { live: false, domain: "redline-visuals.com", old: "Framer", blog: "BlogPost entity" },
  "6a3c9320b05f612c08347d74": { live: false, domain: "thebulbabros.com", old: "unknown", blog: "" },
  "6a28bfea1bde8e3ea488f04d": { live: false, domain: "bobablasticmolalla.com", old: "unknown", blog: "file-based" },
  "69d884d4293101b78d2939cf": { live: false, domain: "smplsocial.io", old: "Framer", blog: "" },
};
// Client apps that must be finished by Dec 31 (KB launch plan) and the LaunchItem keys that close them.
export const APP_SCOPE = {
  "69d884d38fe4bacbc82853ac": { name: "North Woods Command System", keys: ["ca:nw-stage1", "ca:nw-stages", "ca:nw-golive"] },
  "6a7e0ed45a3ed5aeb6868401": { name: "Palm Shore Operations", keys: ["ca:ps-qa", "ca:ps-finish", "ca:ps-publish"] },
  "6a6c13fd03bab4ff324fce0a": { name: "Velocity work (scope open)", keys: ["ca:vel-scope"] },
};

export async function loadFacts() {
  const row = ((await base44.entities.AppSettings.filter({ key: "launch_facts" }, "-updated_date", 1).catch(() => [])) || [])[0];
  return { ...SITE_FACTS, ...((row && row.pageSettings && row.pageSettings.sites) || {}) };
}

function gbpOf(ctx) {
  const item = (k) => evaluateCriteria(ctx).items.find((i) => i.key === k);
  const access = item("access_gbp");
  const r = ctx.review || null;
  const link = r && (r.place_id || (r.cache && (r.cache.mapsUrl || r.cache.url)));
  return { ok: !!(access && access.filled) || !!link, detail: access && access.filled ? "Access on file" : link ? "Google profile linked in Stärboard" : "No GBP access or link on file" };
}

// checklist for one client: [{ key, label, ok, detail, fix }]
export function engineChecklist(ctx, facts) {
  const client = ctx.client || {};
  const ev = evaluateCriteria(ctx);
  const missing = BLOG_CRITICAL.filter((k) => { const i = ev.items.find((x) => x.key === k); return !i || !i.filled; });
  const label = (k) => (ev.items.find((x) => x.key === k) || { label: k }).label;
  const site = (facts || SITE_FACTS)[client.id] || {};
  const gbp = gbpOf(ctx);
  return [
    { key: "profile", label: `Profile ≥ ${COMPLETE_AT}% with every blog-critical field`, ok: ev.pct >= COMPLETE_AT && missing.length === 0, detail: `${ev.pct}% complete${missing.length ? ` · missing: ${missing.map(label).join(", ")}` : " · services, areas, keywords, voice, photos and review link on file"}`, fix: "Profile meter above → Auto-enrich with Claude, or send the client the intake for missing fields." },
    { key: "site", label: "New website live on Base44 with a blog collection", ok: !!site.live && !!site.blog, detail: site.live ? `${site.domain} is on Base44 · blog: ${site.blog || "none yet"}` : `${site.domain || client.domain || "domain"} still on ${site.old || "the old platform"}`, fix: "Road to Dec 31 → this client's site move (Claude prepares, you publish + DNS)." },
    { key: "gbp", label: "Google Business Profile connected or linked", ok: gbp.ok, detail: gbp.detail, fix: "Add the place in Stärboard, or record GBP access in the profile's Access card." },
    { key: "portal", label: "Client portal on", ok: !!client.portal_enabled, detail: client.portal_enabled ? `On · ${(client.portal_emails || []).join(", ")}` : "Off: invite the client from the header (Invite to portal).", fix: "Invite to portal (top of this page)." },
  ];
}

// Blog + GBP cadence from the client's plan (CRMClient.blogSchedule). Bundled clients (Chase) keep a row per
// business, e.g. "Website Blogs (Rein Nutrition)": only rows naming this business (or no business) count.
export function cadenceOf(client) {
  const rows = Array.isArray(client.blogSchedule) ? client.blogSchedule : [];
  const mine = rows.filter((r) => { const m = String(r.type || "").match(/\(([^)]+)\)/); return !m || m[1].trim().toLowerCase() === String(client.business || "").trim().toLowerCase(); });
  const perMonth = (r) => { const n = Number(r.count) || 0; const f = String(r.frequency || "per month").toLowerCase(); return f.includes("week") ? Math.round(n * 4.33) : n; };
  const blogs = mine.filter((r) => /blog/i.test(r.type || "")).reduce((n, r) => n + perMonth(r), 0);
  const gbp = mine.filter((r) => /gbp|google/i.test(r.type || "")).reduce((n, r) => n + perMonth(r), 0);
  if (blogs || gbp) return { blogs_per_month: blogs, gbp_per_month: gbp || blogs, source: "blogSchedule" };
  return { blogs_per_month: 4, gbp_per_month: 4, source: "default (HyperCare+ weekly blog + GBP post; confirm)" };
}

// GBP posting is OFF for every client until the Google Business Profile API is approved for auto-posting
// (Justin, Nov 4, 2026). Engines skip the stream and show "Waiting on Google API". Flip GBP_API_APPROVED when it is.
export const GBP_API_APPROVED = false;
export const OUTREACH_SENDER = { email: "justin@interstellar-strategies.com", name: "Justin Cowell", tone: "personal, first person, on the client's behalf" };

// Every recurring stream an engine runs each month. state: "on" queues work; "waiting" shows why it doesn't.
export const STREAMS = [
  { key: "calendar", kind: "topic_calendar", label: "Monthly blog Topic Calendar", how: "Claude proposes the month's topics; you approve the calendar once. Each post then drafts and publishes into the client's Base44 blog on its date and is verified on the live blog index before it counts as published.", state: "on" },
  { key: "gbp", kind: "gbp_post", label: "Google Business Profile posts", how: "Off for every client until the Google Business Profile API is approved for auto-posting.", state: GBP_API_APPROVED ? "on" : "waiting", waiting: "Waiting on Google API" },
  { key: "outreach", kind: "research", label: "Backlink + citation research and outreach drafts", how: `Targets land in Citations & PR and qualify automatically; outreach emails are drafted from ${OUTREACH_SENDER.email} (personal tone, on the client's behalf) and each one waits for your approval. Nothing is sent automatically.`, state: "on" },
  { key: "social", kind: "social_plan", label: "Social plan for the month", how: "Social-search plan saved hidden from the portal (auto-approved by policy); individual posts still need your approval.", state: "on" },
  { key: "reviews", kind: "task", label: "Review requests", how: "Claude prepares the request list and message drafts from verified finished jobs and the review link. Sending waits for your approval.", state: "on" },
];

const monthName = (d) => d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "America/Los_Angeles" });

function brief(client, stream, cadence, month) {
  const head = {
    outreach: `Backlink and citation research for ${client.business} (${month}): find 10-20 qualified targets (directories, local news, associations, resource pages) matching their industry and service area and add them as OutreachTarget records (status discovered). Then write outreach drafts as OutreachMessage status draft, from ${OUTREACH_SENDER.name} <${OUTREACH_SENDER.email}>: first person, ${OUTREACH_SENDER.tone}, short, specific to the target, signed with the outreach_rules signature. Each draft waits for Justin's approval. Never send.`,
    social: `Build ${client.business}'s social plan for ${month} as a social-search strategist (posts found by each platform's search). Save as the result; it is saved hidden from the portal.`,
    reviews: `Prepare ${client.business}'s review requests for ${month}: list recent finished jobs or customers you can verify from their Command System or records, and draft the short request message (SMS + email) with their Google review link. Never send; never invent customers.`,
  }[stream.key];
  return [head, "", `Cadence: ${cadence.blogs_per_month} blogs a month (${cadence.source}). GBP posts: off until the Google Business Profile API is approved.`, `How this executes: ${stream.how}`, "", "Standing rules:", ...STANDING_RULES.map((r) => `- ${r}`)].join("\n");
}

const firstOfNextMonth = (now) => {
  const k = monthKeyLA(now);
  const [y, m] = k.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
};

// Queues one month of an engine: the Topic Calendar + outreach + social + reviews. GBP is recorded as waiting.
export async function queueMonth(client, startId, { monthKey = monthKeyLA() } = {}) {
  const cadence = cadenceOf(client);
  const month = monthLabel(monthKey);
  const queued = [];
  const cal = await queueTopicCalendar(client, { monthKey, n: Math.max(1, cadence.blogs_per_month), engineStartId: startId, rules: STANDING_RULES });
  queued.push({ stream: "calendar", title: cal.title, job_id: cal.id, how_it_executes: STREAMS[0].how, month_key: monthKey });
  for (const s of STREAMS.filter((x) => x.key !== "calendar")) {
    if (s.state !== "on") { queued.push({ stream: s.key, title: `${s.label} · ${month}`, job_id: "", state: "waiting", how_it_executes: s.how, month_key: monthKey }); continue; }
    const title = `Engine · ${client.business} · ${s.label} · ${month}`;
    const job = await base44.entities.ClaudeJob.create({
      title, kind: s.kind, instructions: brief(client, s, cadence, month), client_id: client.id, client_name: client.business,
      status: "queued", priority: 3, requested_at: new Date().toISOString(), complete_task_on_approve: false,
      context: { engine_start_id: startId, stream: s.key, month, month_key: monthKey },
    });
    queued.push({ stream: s.key, title, job_id: job.id, how_it_executes: s.how, month_key: monthKey });
  }
  return { queued, cadence };
}

// by: who pressed it. auto = Claude pressed it because the checklist was green (policy: notify, don't ask).
export async function startEngine(client, checklist, by = "justin", { auto = false } = {}) {
  const now = new Date();
  const cadence = cadenceOf(client);
  const start = await base44.entities.EngineStart.create({
    client_id: client.id, client_name: client.business, status: "running", started_at: now.toISOString(), started_by: auto ? `claude (auto, checklist green) for ${by}` : by,
    checklist: checklist.map(({ key, label, ok, detail }) => ({ key, label, ok, detail })), cadence, next_cycle_at: firstOfNextMonth(now),
    notes: `Month 1 (${monthName(now)}) queued. The "Engines — monthly re-queue" workflow queues each next month on next_cycle_at. GBP posts: waiting on Google API.`,
  });
  const { queued } = await queueMonth(client, start.id);
  await base44.entities.EngineStart.update(start.id, { queued, queued_job_ids: queued.map((q) => q.job_id).filter(Boolean) });
  await base44.entities.AutomationRun.create({
    automation_name: "Start engine", kind: "other", client_id: client.id, client_name: client.business, status: "success",
    started_at: now.toISOString(), finished_at: new Date().toISOString(), processed: true,
    message: `${auto ? "Auto-started (checklist green; notify policy)" : "Started"}: Topic Calendar for ${monthName(now)} + outreach, social and review-request jobs queued. GBP posts waiting on Google API.`,
  }).catch(() => null);
  return { ...start, queued };
}

export const readyCount = (list) => list.filter((c) => c.ok).length;
export { has };
