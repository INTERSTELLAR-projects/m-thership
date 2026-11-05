// Monthly blog Topic Calendar (Justin's launch decision, Nov 4, 2026): once a client's engine runs, Justin approves
// ONE topic calendar per client per month. Approving it schedules every post as a ClaudeJob (not_before = its
// publish date) that the queue runner drafts AND publishes into the client's Base44 site blog on its own, then
// verifies on the live blog index. Nothing is recorded as published until it is verified live.
import { base44 } from "@/api/base44Client";
import { blogSiteOf, publishSteps } from "./blogSites";
import { assertEnginesReleased } from "./engineHold";

export const isTopicCalendarJob = (job) => !!(job && job.kind === "topic_calendar");

const pad = (n) => String(n).padStart(2, "0");
export const monthKeyLA = (d = new Date()) => {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit" }).formatToParts(d);
  return `${p.find((x) => x.type === "year").value}-${p.find((x) => x.type === "month").value}`;
};
export const todayLA = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
export const monthLabel = (key) => {
  const [y, m] = String(key).split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, 15)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
};

// n publish dates spread across the month (from today when it is the current month), weekdays only.
export function spreadDates(monthKey, n) {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const today = todayLA();
  const first = today.startsWith(monthKey) ? Math.min(last, Number(today.slice(8, 10)) + 1) : 1;
  const days = [];
  for (let d = first; d <= last; d++) {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(d);
  }
  if (!days.length || n <= 0) return [];
  return Array.from({ length: n }, (_, i) => `${monthKey}-${pad(days[Math.min(days.length - 1, Math.floor((i * days.length) / n))])}`);
}

export function topicCalendarBrief(client, monthKey, n, rules = []) {
  return [
    `# Topic Calendar · ${client.business} · ${monthLabel(monthKey)}`,
    "",
    `Propose ${n} long-form blog topics for ${client.business} for ${monthLabel(monthKey)}. Justin approves this calendar once; after that every post drafts and publishes on its own, so get the topics right.`,
    "Use the client's ClientDossier keywords and service areas, the approved ContentPlan if one exists, its BusinessBrain, recent ResearchNotes for this client and the existing posts on its live blog (never repeat or near-duplicate a title, slug or angle).",
    "Each topic answers a real question buyers in their service area ask, down to the city, and supports SEO + AI answers (AIO/GEO/AEO).",
    "",
    "Write back:",
    `- result_data.topics = [{ title, slug, primary_keyword, intent (informational|commercial|local|comparison), city, angle (one sentence), why (one sentence: the search gap it fills), publish_on (YYYY-MM-DD in ${monthKey}, weekdays, spread evenly) }] — exactly ${n} items.`,
    "- result_data.month = \"" + monthKey + "\"",
    "- result_body = a markdown table of the topics (date, title, keyword, city) and one line on the month's theme.",
    "- result_summary = one sentence.",
    "Then status needs_approval. Do not draft or publish any post in this job.",
    "",
    "Standing rules:",
    ...rules.map((r) => `- ${r}`),
  ].join("\n");
}

export function topicsFromJob(job) {
  const raw = (job && job.result_data && job.result_data.topics) || [];
  const monthKey = (job && job.context && job.context.month_key) || (job && job.result_data && job.result_data.month) || monthKeyLA();
  const list = (Array.isArray(raw) ? raw : []).filter((t) => t && t.title).map((t) => ({
    title: String(t.title).trim(),
    slug: String(t.slug || t.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90),
    primary_keyword: t.primary_keyword || t.keyword || "",
    intent: t.intent || "",
    city: t.city || "",
    angle: t.angle || "",
    why: t.why || "",
    publish_on: /^\d{4}-\d{2}-\d{2}$/.test(String(t.publish_on || "")) ? t.publish_on : "",
  }));
  const fill = spreadDates(monthKey, list.length);
  return list.map((t, i) => ({ ...t, publish_on: t.publish_on || fill[i] || todayLA(), state: "planned" }));
}

function blogBrief(client, cal, topic, i, n, site, rules) {
  return [
    `# Blog ${i} of ${n} · ${client.business} · ${monthLabel(cal.month)}`,
    "",
    `Write and publish this approved post (Topic Calendar ${cal.id}, approved by Justin ${String(cal.approved_at || "").slice(0, 10)}). The calendar approval is the only approval this post needs.`,
    `- Title: ${topic.title}`,
    `- Slug: ${topic.slug}`,
    `- Primary keyword: ${topic.primary_keyword || "(from the dossier)"} · intent: ${topic.intent || "—"} · city: ${topic.city || "—"}`,
    `- Angle: ${topic.angle || "—"}`,
    `- Scheduled for: ${topic.publish_on}`,
    "",
    "Write it: 1,200-1,800 words, a 45-70 word direct answer up top, H2s phrased as the questions buyers search, 5-8 self-contained FAQs, local landmarks/cities named naturally, internal links to the site's own service and city pages, a meta title (≤60 chars) and meta description (150-160 chars). Use only facts from the client's dossier, brain, website and verifiable public sources; never invent numbers, reviews, prices, credentials or quotes. Cover image: an existing image from the client's site that fits (never a stock photo of another business), with descriptive alt text.",
    "Put the full post in result_data.post and a readable copy in result_body.",
    "",
    "Publish it:",
    ...publishSteps(site).map((s) => `- ${s}`),
    "",
    "Finish: result_summary (title + live URL or 'published, not yet visible on the index'), status needs_approval (the approval policy clears it automatically and logs it). No Google Business Profile post (GBP posting is off until the Google API is approved).",
    "",
    "Standing rules:",
    ...rules.map((r) => `- ${r}`),
  ].join("\n");
}

// Approval of a topic_calendar job: save the calendar, then schedule one blog job per topic.
export async function saveApprovedTopicCalendar(job, rules = []) {
  await assertEnginesReleased(); // no blog schedule starts while engines are on hold
  if (!job.client_id) return null;
  const topics = topicsFromJob(job);
  if (!topics.length) throw new Error("This calendar has no topics yet. Ask Claude for changes instead.");
  const monthKey = (job.context && job.context.month_key) || (job.result_data && job.result_data.month) || monthKeyLA();
  const existing = (await base44.entities.TopicCalendar.filter({ client_id: job.client_id, month: monthKey }, "-created_date", 10).catch(() => [])) || [];
  if (existing.some((c) => c.source_job_id === job.id)) return null; // already saved
  const [client, factsRow, me] = await Promise.all([
    base44.entities.CRMClient.get(job.client_id).catch(() => ({ id: job.client_id, business: job.client_name })),
    base44.entities.AppSettings.filter({ key: "launch_facts" }, "-updated_date", 1).catch(() => []),
    base44.auth.me().catch(() => null),
  ]);
  const facts = (factsRow && factsRow[0] && factsRow[0].pageSettings && factsRow[0].pageSettings.sites) || {};
  const site = blogSiteOf(job.client_id, facts) || {};
  await Promise.all(existing.filter((c) => c.status === "approved").map((c) => base44.entities.TopicCalendar.update(c.id, { status: "superseded" })));
  const now = new Date().toISOString();
  const cal = await base44.entities.TopicCalendar.create({
    client_id: job.client_id, client_name: job.client_name || client.business || "", month: monthKey, status: "approved",
    topics, site: { app_id: site.app_id || "", mode: site.mode || "", entity: site.entity || "", domain: site.domain || "", blog_index: site.blog_index || "", live: !!site.live },
    summary: job.result_summary || "", source_job_id: job.id, engine_start_id: (job.context && job.context.engine_start_id) || "",
    approved_at: now, approved_by: (me && me.email) || "justin",
  });
  const out = [];
  for (let i = 0; i < topics.length; i++) {
    const t = topics[i];
    const j = await base44.entities.ClaudeJob.create({
      title: `Blog · ${client.business || job.client_name} · ${t.title}`,
      kind: "blog", client_id: job.client_id, client_name: job.client_name || client.business || "",
      instructions: blogBrief(client, { ...cal, approved_at: now }, t, i + 1, topics.length, site.live ? site : null, rules),
      status: "queued", priority: 3, requested_at: now, not_before: t.publish_on, complete_task_on_approve: false,
      context: { calendar_id: cal.id, topic_index: i, month_key: monthKey, publish_authorized: !!site.live, publish_state: site.live ? "scheduled" : "draft_only", engine_start_id: cal.engine_start_id, site_app_id: site.app_id || "" },
    });
    out.push({ ...t, job_id: j.id, state: "queued" });
  }
  await base44.entities.TopicCalendar.update(cal.id, { topics: out });
  return cal;
}

export async function queueTopicCalendar(client, { monthKey = monthKeyLA(), n = 4, engineStartId = "", rules = [] } = {}) {
  await assertEnginesReleased();
  const open = (await base44.entities.ClaudeJob.filter({ client_id: client.id, kind: "topic_calendar" }, "-created_date", 10).catch(() => [])) || [];
  const dupe = open.find((j) => j.context && j.context.month_key === monthKey && j.status !== "cancelled" && j.status !== "failed");
  if (dupe) return dupe;
  return base44.entities.ClaudeJob.create({
    title: `Topic Calendar · ${client.business} · ${monthLabel(monthKey)}`,
    kind: "topic_calendar", client_id: client.id, client_name: client.business,
    instructions: topicCalendarBrief(client, monthKey, n, rules),
    status: "queued", priority: 2, requested_at: new Date().toISOString(), complete_task_on_approve: false,
    context: { month_key: monthKey, engine_start_id: engineStartId, stream: "topic_calendar", n },
  });
}
