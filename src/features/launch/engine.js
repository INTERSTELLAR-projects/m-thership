// Engine readiness + "Start engine" for one client.
// Ready = profile ≥ the completeness meter's green threshold (80%) with every blog-critical field filled,
// the new site live on Base44 with a blog collection, a GBP connection or link on file, and the portal on.
// Starting creates one EngineStart record and queues month 1 as ClaudeJobs the hourly queue runner picks up.
// Every job ends in needs_approval: nothing is published, posted or sent by starting an engine.
import { base44 } from "@/api/base44Client";
import { evaluateCriteria, has } from "@/features/clients/criteria";
import { STANDING_RULES } from "@/features/claude/jobs";

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

// How each stream executes today, and the step that is still undecided (asked as a LaunchItem question).
export const STREAMS = [
  { key: "blog", kind: "blog", label: "Long-form blog drafts", how: "Queue runner (hourly Claude task) writes each post into result_body for approval. Publishing into the client's Base44 blog is a separate approved step.", iffy: "q:blog-publish-path — may Claude publish an approved post straight into the blog collection, or do you press publish?" },
  { key: "gbp", kind: "gbp_post", label: "Paired GBP post drafts", how: "One GBP draft per blog (no phone, address or bare URL; Learn more = plain blog URL, no UTM).", iffy: "q:gbp-poster — GBP API approval is pending, so who pastes approved posts: you or Claude in your browser?" },
  { key: "outreach", kind: "research", label: "Backlink + citation research and outreach drafts", how: "Research lands in Citations & PR (OutreachTarget); outreach emails stay drafts.", iffy: "q:outreach-identity — which address sends outreach, and is it ever sent automatically?" },
  { key: "social", kind: "social_plan", label: "Social plan for the month", how: "Social-search plan saved hidden from the portal; posts then flow through Social Studio approval.", iffy: "Client social accounts are mostly not connected in Social Studio, so posts are drafts you or the client post." },
  { key: "reviews", kind: "task", label: "Review requests", how: "Claude prepares the request list + message drafts from finished jobs and the review link.", iffy: "q:review-sender — sent by the client's own Command System, or from Møthership on their behalf? Which clients have SMS?" },
];

const monthName = (d) => d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "America/Los_Angeles" });

function brief(client, stream, n, i, cadence, month) {
  const head = {
    blog: `Write long-form blog draft ${i} of ${n} for ${client.business} (${month}). Use the approved content plan if one exists, else the keyword list in the ClientDossier; answer a real question people in their service area ask, down to the city. Draft only: put title, slug, meta description, body (markdown), internal links and image notes in result_body; put the structured post in result_data.post. Do not publish.`,
    gbp: `Write the Google Business Profile post that pairs with blog draft ${i} of ${n} for ${client.business} (${month}). Under 1,500 characters, no phone number, no street address, no bare URL. CTA "Learn more" with the plain blog URL once the post is live (no UTM). Draft only; never post.`,
    outreach: `Backlink and citation research for ${client.business} (${month}): find 10-20 qualified targets (directories, local news, associations, resource pages) matching their industry and service area, add them as OutreachTarget records (status discovered/qualified) and write outreach drafts as OutreachMessage status draft. Never send.`,
    social: `Build ${client.business}'s social plan for ${month} as a social-search strategist (posts found by each platform's search). Save as the result for approval; it is saved hidden from the portal.`,
    reviews: `Prepare ${client.business}'s review requests for ${month}: list recent finished jobs or customers you can verify from their Command System or records, and draft the short request message (SMS + email) with their Google review link. Never send; never invent customers.`,
  }[stream.key];
  return [head, "", `Cadence: ${cadence.blogs_per_month} blogs + ${cadence.gbp_per_month} GBP posts per month (${cadence.source}).`, `How this executes today: ${stream.how}`, "", "Standing rules:", ...STANDING_RULES.map((r) => `- ${r}`)].join("\n");
}

export async function startEngine(client, checklist, by = "justin") {
  const now = new Date();
  const month = monthName(now);
  const cadence = cadenceOf(client);
  const next = new Date(now); next.setMonth(next.getMonth() + 1);
  const start = await base44.entities.EngineStart.create({
    client_id: client.id, client_name: client.business, status: "queued", started_at: now.toISOString(), started_by: by,
    checklist: checklist.map(({ key, label, ok, detail }) => ({ key, label, ok, detail })), cadence, next_cycle_at: next.toISOString().slice(0, 10),
    notes: "Month 1 queued. Month 2+ needs the monthly re-queue (LaunchItem a:engine-recur).",
  });
  const plan = [];
  STREAMS.forEach((s) => {
    const n = s.key === "blog" ? cadence.blogs_per_month : s.key === "gbp" ? cadence.gbp_per_month : 1;
    for (let i = 1; i <= n; i++) plan.push({ s, i, n });
  });
  const queued = [];
  for (const { s, i, n } of plan) {
    const title = `Engine · ${client.business} · ${s.label}${n > 1 ? ` ${i}/${n}` : ""} · ${month}`;
    const job = await base44.entities.ClaudeJob.create({
      title, kind: s.kind, instructions: brief(client, s, n, i, cadence, month), client_id: client.id, client_name: client.business,
      status: "queued", priority: 3, requested_at: now.toISOString(), complete_task_on_approve: false,
      context: { engine_start_id: start.id, stream: s.key, month, index: i, of: n },
    });
    queued.push({ stream: s.key, title, job_id: job.id, how_it_executes: s.how, iffy: s.iffy });
  }
  await base44.entities.EngineStart.update(start.id, { queued, queued_job_ids: queued.map((q) => q.job_id) });
  return { ...start, queued };
}

export const readyCount = (list) => list.filter((c) => c.ok).length;
export { has };
