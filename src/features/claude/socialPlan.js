// "Social plan": a client-specific social media strategy + operating system.
// Built exactly like the industry playbook: a rich brief (profile, dossier, answers, approved brand kit,
// playbook and content plan, plus Justin's dictated direction) → a ClaudeJob (kind "social_plan") or an
// in-app quick draft (Core.InvokeLLM with the same schema) → Justin approves → a versioned SocialPlan.
import { base44 } from "@/api/base44Client";
import { STANDING_RULES } from "./jobs";
import { loadClientContext, contextToBrief } from "@/features/clients/clientContext";
import { loadAgencyKnowledge, agencyBlock } from "@/features/agency/knowledge";

export const SOCIAL_PLAN_CONTEXT = "social_plan";

export const PLATFORMS = [
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["tiktok", "TikTok"],
  ["youtube", "YouTube / Shorts"],
  ["linkedin", "LinkedIn"],
  ["gbp", "Google Business Profile"],
  ["nextdoor", "Nextdoor"],
  ["x", "X"],
];
export const PLATFORM_IDS = PLATFORMS.map((p) => p[0]);
export const platformLabel = (id) => (PLATFORMS.find((p) => p[0] === id) || [id, id])[1];

export const FORMATS = [
  ["photo", "Photos"],
  ["carousel", "Carousels"],
  ["reel", "Short-form video / Reels"],
  ["story", "Stories"],
  ["long_video", "Long-form video"],
  ["ugc", "UGC (customer content)"],
  ["bts", "Behind the scenes"],
  ["before_after", "Before / after"],
  ["testimonial", "Testimonials (real only)"],
  ["live", "Live"],
];
export const FORMAT_IDS = FORMATS.map((f) => f[0]);
export const formatLabel = (id) => (FORMATS.find((f) => f[0] === id) || [id, id])[1];

export const WORKFLOW_STEPS = [
  ["capture", "Capture"],
  ["edit", "Edit"],
  ["caption", "Caption"],
  ["schedule", "Schedule"],
  ["engage", "Engage"],
];
export const WORKFLOW_IDS = WORKFLOW_STEPS.map((s) => s[0]);

// Always part of the plan, whatever the model returns.
export const SOCIAL_COMPLIANCE = [
  "Never invent reviews, testimonials, results, numbers or customer quotes. Testimonials are real, used with the customer's permission.",
  "Google Business Profile posts never contain a phone number, a street address or a bare URL. Contact details live on the profile.",
  "The GBP \"Learn more\" button is the only link, and it is the plain page or blog URL with no UTM parameters.",
  "Get permission before showing customers, their homes, vehicles or faces.",
  "Posting days and times are starting points to test, not data. Adjust from the client's own insights after 4-6 weeks.",
];

// Social search (social SEO): every client plan is built to be FOUND in platform search and Google.
// Sourced playbook: AgencyKnowledge key "social_search" (Settings > Agency knowledge).
export const SOCIAL_SEARCH_RULES = [
  "Keyword map: 10-20 search phrases per main platform, written the way THIS client's customers type them (validate in each app's search suggestions / TikTok Creator Search Insights; never claim search volumes you don't have).",
  "Profile SEO fixes per platform: name field = Brand | main keyword (Instagram searches username and name), bio with keywords (+ location if local), links, highlights, the same brand name and handle everywhere, and the website's Organization schema sameAs listing every profile.",
  "Pillars are mapped to keywords: each pillar names the search phrases it targets.",
  "Every post has ONE primary search phrase: keyword-first hook line, 1-2 keywords used naturally in the caption, on-image/cover text that states the topic, alt text that describes the image with the keyword.",
  "Reels / Shorts / TikTok: say the keyword in the first 3 seconds, show it as on-screen text, burned-in captions on; Shorts title = the search phrase.",
  "Hashtags: 3-5 specific, relevant tags per post (Instagram caps at 5; Facebook recommends no more than 5). No generic walls.",
  "Original content only: no reposts, no third-party (TikTok/CapCut) watermarks; Instagram and Facebook stop recommending mostly-unoriginal accounts.",
  "Answer-style content people save and send: how-to, checklists, myth vs fact, what-to-expect.",
  "Public professional Instagram accounts are indexed by Google (since July 2025): keep the account public, professional, with Search engine indexing on.",
  "Measure search: profile visits, non-follower reach, search traffic source, saves, sends per reach, likes per reach, average watch time (Shorts: viewed vs swiped away), and GA4 social referrals.",
];

/* ---------------- schema ---------------- */

const str = { type: "string" };
const strList = { type: "array", items: str };
const bool = { type: "boolean" };
const num = { type: "number" };
const obj = (properties) => ({ type: "object", properties });
const arr = (properties) => ({ type: "array", items: obj(properties) });

export const SOCIAL_PLAN_JSON_SCHEMA = obj({
  headline: str,
  summary: str,
  goals_audience: obj({
    business_goals: strList,
    social_goals: strList,
    audience: str,
    where_they_scroll: strList,
    what_they_care_about: strList,
    voice_summary: str,
    unknowns: strList,
  }),
  platforms: arr({
    id: { type: "string", enum: PLATFORM_IDS },
    name: str,
    priority: { type: "string", enum: ["high", "medium", "low"] },
    role: str,
    cadence: str,
    best_formats: strList,
    posting_guidance: str,
    setup: strList,
  }),
  skipped_platforms: arr({ id: str, why: str }),
  pillars: arr({ name: str, share: str, description: str, example_posts: strList }),
  formats: arr({ id: { type: "string", enum: FORMAT_IDS }, name: str, use_for: str, how: strList, frequency: str }),
  calendar: arr({
    week: num,
    theme: str,
    posts: arr({ day: str, platform: str, format: str, pillar: str, idea: str, hook: str, keyword: str, on_screen_text: str, spoken_keywords: str }),
  }),
  workflow: obj({
    steps: arr({ id: { type: "string", enum: WORKFLOW_IDS }, title: str, who: str, how: strList, tools: strList, minutes_per_week: num }),
    weekly_time_budget: obj({ client_minutes: num, interstellar_minutes: num, notes: str }),
  }),
  editing: obj({ based_on_brand_kit: bool, colors: strList, fonts: strList, voice: strList, photo_style: str, video_style: str, templates: strList, dos: strList, donts: strList }),
  captions: obj({ structure: str, rules: strList, cta_examples: strList, hashtag_rules: strList, hashtag_sets: arr({ name: str, tags: strList }) }),
  engagement: obj({ daily: strList, weekly: strList, response_rules: strList, response_time: str }),
  consistency: obj({ batching_day: str, batching_plan: strList, templates: strList, content_bank: strList }),
  repurposing: arr({ from: str, to: strList, how: str }),
  kpis: arr({ name: str, platform: str, current: str, target: str, source: str, is_estimate: bool, how_to_track: str }),
  roles: obj({ interstellar: strList, client: strList, together: strList }),
  search: obj({
    keyword_map: arr({ platform: str, phrases: strList, notes: str }),
    profile_seo: arr({ platform: str, name_field: str, username: str, bio: str, links: strList, highlights: strList, other: strList }),
    pillar_keywords: arr({ pillar: str, keywords: strList }),
    caption_template: str,
    alt_text_template: str,
    video_rules: strList,
    sample_posts: arr({ platform: str, format: str, pillar: str, primary_keyword: str, hook: str, on_screen_text: str, spoken_keywords: str, caption: str, alt_text: str, hashtags: strList, needs_from_client: str }),
    measurement: arr({ metric: str, where: str, target: str }),
  }),
  collaborations: arr({ idea: str, format: str, how: str, disclosure: str }),
  compliance: strList,
  next_steps: strList,
  assumptions: strList,
});

// The same shape, written out for Claude (the queue runner reads markdown, not a JSON schema).
export const SOCIAL_PLAN_JSON_SHAPE = `{
  "headline": "one line: the social plan in a sentence",
  "summary": "2-3 sentences for Justin and the owner",
  "goals_audience": {
    "business_goals": ["what the business wants (from the inputs)"],
    "social_goals": ["what social should do for that: awareness, trust, leads, recruiting…"],
    "audience": "who we are talking to",
    "where_they_scroll": ["platforms / places, from the inputs or marked as an assumption"],
    "what_they_care_about": ["3-6"],
    "voice_summary": "how the brand sounds on social (from the approved brand kit when there is one)",
    "unknowns": ["facts we still need (current followers, handles, who films, budget for tools…)"]
  },
  "platforms": [
    { "id": "${PLATFORM_IDS.join(" | ")}", "name": "", "priority": "high | medium | low", "role": "the job this platform does for THIS business", "cadence": "e.g. 3 posts + 5 stories a week", "best_formats": ["reel", "carousel"], "posting_guidance": "days/times as a STARTING POINT to test, never as data", "setup": ["profile fixes: bio, link, highlights, categories"] }
  ],
  "skipped_platforms": [{ "id": "", "why": "why it doesn't fit right now" }],
  "pillars": [{ "name": "", "share": "e.g. 30% (a plan, not a measurement)", "description": "", "example_posts": ["3-5 specific post ideas for this business"] }],
  "formats": [{ "id": "${FORMAT_IDS.join(" | ")}", "name": "", "use_for": "", "how": ["practical tips"], "frequency": "" }],
  "calendar": [
    { "week": 1, "theme": "", "posts": [{ "day": "Mon", "platform": "instagram", "format": "reel", "pillar": "pillar name", "idea": "the post", "hook": "first line / first 2 seconds" }] }
  ],
  "workflow": {
    "steps": [{ "id": "${WORKFLOW_IDS.join(" | ")}", "title": "", "who": "client | Interstellar | both", "how": ["steps"], "tools": ["e.g. phone camera, CapCut, Canva, Meta Business Suite, Google Business Profile"], "minutes_per_week": 0 }],
    "weekly_time_budget": { "client_minutes": 0, "interstellar_minutes": 0, "notes": "an estimate to plan around" }
  },
  "editing": { "based_on_brand_kit": true, "colors": ["Name #HEX — use"], "fonts": ["Family — use"], "voice": ["voice rules"], "photo_style": "", "video_style": "", "templates": ["templates to build once"], "dos": [""], "donts": [""] },
  "captions": { "structure": "hook → value → CTA", "rules": [""], "cta_examples": [""], "hashtag_rules": [""], "hashtag_sets": [{ "name": "local", "tags": ["#…"] }] },
  "engagement": { "daily": ["10-minute routine"], "weekly": [""], "response_rules": ["how to answer comments, DMs and reviews"], "response_time": "target" },
  "consistency": { "batching_day": "", "batching_plan": [""], "templates": [""], "content_bank": ["evergreen ideas to fall back on"] },
  "repurposing": [{ "from": "blog post", "to": ["GBP post", "reel", "carousel"], "how": "" }],
  "kpis": [{ "name": "", "platform": "", "current": "real figure or \\"unknown\\"", "target": "", "source": "", "is_estimate": false, "how_to_track": "" }],
  "roles": { "interstellar": ["what Interstellar does (only services they actually have)"], "client": ["what the owner/team does"], "together": [""] },
  "search": {
    "keyword_map": [{ "platform": "instagram", "phrases": ["10-20 phrases customers type on this platform"], "notes": "how they were chosen / validate where" }],
    "profile_seo": [{ "platform": "instagram", "name_field": "Brand | main keyword", "username": "@handle (same everywhere)", "bio": "recommended bio text with keywords", "links": ["link + where it goes"], "highlights": ["highlight names"], "other": ["category, indexing on, sameAs, etc."] }],
    "pillar_keywords": [{ "pillar": "pillar name", "keywords": ["phrases this pillar targets"] }],
    "caption_template": "keyword-first hook → value → CTA → 3-5 hashtags",
    "alt_text_template": "what is in the image + topic keyword, under ~125 chars",
    "video_rules": ["keyword spoken in first 3s, on-screen text, captions on"],
    "sample_posts": [{ "platform": "", "format": "", "pillar": "", "primary_keyword": "", "hook": "", "on_screen_text": "", "spoken_keywords": "", "caption": "full caption", "alt_text": "", "hashtags": ["#…"], "needs_from_client": "real example / photo / fact we need" }],
    "measurement": [{ "metric": "", "where": "", "target": "unknown or est." }]
  },
  "collaborations": [{ "idea": "", "format": "Collab post / Remix / takeover", "how": "", "disclosure": "how any material connection is disclosed" }],
  "compliance": ["extra rules for this business (industry, permissions)"],
  "next_steps": ["3-5 ordered steps for the first two weeks"],
  "assumptions": ["anything you assumed"]
}`;

/* ---------------- normalise ---------------- */

const t = (v, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const l = (v, max = 12) => (Array.isArray(v) ? v.slice(0, max) : []);
const o = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const strs = (v, max = 12, len = 300) => l(v, max).map((x) => t(typeof x === "object" && x ? x.text || x.title || x.name || "" : x, len)).filter(Boolean);
const oneOf = (v, opts, fb) => (opts.includes(v) ? v : fb);
const mins = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };
const lc = (v) => String(v || "").toLowerCase().trim();

function platformId(v) {
  const s = lc(v);
  if (PLATFORM_IDS.includes(s)) return s;
  if (/insta|^ig$/.test(s)) return "instagram";
  if (/face|^fb$|meta/.test(s)) return "facebook";
  if (/tik/.test(s)) return "tiktok";
  if (/you|short/.test(s)) return "youtube";
  if (/linked/.test(s)) return "linkedin";
  if (/google|gbp|business profile/.test(s)) return "gbp";
  if (/next/.test(s)) return "nextdoor";
  if (/^x$|twitter/.test(s)) return "x";
  return "";
}

function formatId(v) {
  const s = lc(v);
  if (FORMAT_IDS.includes(s)) return s;
  if (/carousel/.test(s)) return "carousel";
  if (/reel|short|tiktok|short-form/.test(s)) return "reel";
  if (/stor/.test(s)) return "story";
  if (/long|youtube/.test(s)) return "long_video";
  if (/ugc|user/.test(s)) return "ugc";
  if (/behind|bts/.test(s)) return "bts";
  if (/before|after/.test(s)) return "before_after";
  if (/testi|review/.test(s)) return "testimonial";
  if (/live/.test(s)) return "live";
  if (/photo|image|pic/.test(s)) return "photo";
  return "";
}

export function normalizeSocialPlan(raw) {
  let p = raw;
  if (typeof p === "string") {
    try { p = JSON.parse(p); } catch { p = null; }
  }
  if (p && p.social_plan && typeof p.social_plan === "object") p = p.social_plan;
  if (p && p.plan && typeof p.plan === "object" && !p.platforms) p = p.plan;
  if (!p || typeof p !== "object") return null;
  const g = o(p.goals_audience);
  const platforms = l(p.platforms, 8).filter((x) => x && typeof x === "object").map((x) => {
    const id = platformId(x.id) || platformId(x.name);
    return {
      id: id || "instagram",
      name: t(x.name, 60) || platformLabel(id),
      priority: oneOf(x.priority, ["high", "medium", "low"], "medium"),
      role: t(x.role, 500),
      cadence: t(x.cadence, 200),
      best_formats: strs(x.best_formats, 6, 60),
      posting_guidance: t(x.posting_guidance, 400),
      setup: strs(x.setup, 6, 200),
    };
  }).filter((x, i, all) => all.findIndex((y) => y.id === x.id) === i);
  const wf = o(p.workflow);
  const budget = o(wf.weekly_time_budget);
  const steps = l(wf.steps, 8).filter((s) => s && typeof s === "object").map((s, i) => ({
    id: oneOf(lc(s.id), WORKFLOW_IDS, WORKFLOW_IDS[Math.min(i, WORKFLOW_IDS.length - 1)]),
    title: t(s.title, 80),
    who: t(s.who, 40),
    how: strs(s.how, 6, 240),
    tools: strs(s.tools, 6, 60),
    minutes_per_week: mins(s.minutes_per_week),
  }));
  const ed = o(p.editing);
  const cap = o(p.captions);
  const eng = o(p.engagement);
  const con = o(p.consistency);
  const roles = o(p.roles);
  const calendar = l(p.calendar, 4).filter((w) => w && typeof w === "object").map((w, i) => ({
    week: Math.max(1, Math.min(4, Math.round(Number(w.week) || i + 1))),
    theme: t(w.theme, 120),
    posts: l(w.posts, 14).filter((x) => x && typeof x === "object").map((x) => ({
      day: t(x.day, 12), platform: platformId(x.platform) || t(x.platform, 30), format: formatId(x.format) || t(x.format, 30),
      pillar: t(x.pillar, 60), idea: t(x.idea, 300), hook: t(x.hook, 200),
      keyword: t(x.keyword, 100), on_screen_text: t(x.on_screen_text, 140), spoken_keywords: t(x.spoken_keywords, 200),
    })).filter((x) => x.idea),
  }));
  if (!platforms.length && !calendar.length && !(g.social_goals || []).length) return null;
  return {
    headline: t(p.headline, 200),
    summary: t(p.summary, 800),
    goals_audience: {
      business_goals: strs(g.business_goals, 6),
      social_goals: strs(g.social_goals, 6),
      audience: t(g.audience, 600),
      where_they_scroll: strs(g.where_they_scroll, 8, 120),
      what_they_care_about: strs(g.what_they_care_about, 8),
      voice_summary: t(g.voice_summary, 500),
      unknowns: strs(g.unknowns, 10),
    },
    platforms,
    skipped_platforms: l(p.skipped_platforms, 8).map((x) => ({ id: platformId(x && x.id) || t(x && x.id, 30), why: t(x && x.why, 240) })).filter((x) => x.id),
    pillars: l(p.pillars, 6).filter((x) => x && typeof x === "object").map((x) => ({
      name: t(x.name, 60), share: t(x.share, 30), description: t(x.description, 400), example_posts: strs(x.example_posts, 6, 240),
    })).filter((x) => x.name),
    formats: l(p.formats, 10).filter((x) => x && typeof x === "object").map((x) => {
      const id = formatId(x.id) || formatId(x.name);
      return { id: id || "photo", name: t(x.name, 60) || formatLabel(id), use_for: t(x.use_for, 300), how: strs(x.how, 5, 240), frequency: t(x.frequency, 80) };
    }),
    calendar,
    workflow: {
      steps,
      weekly_time_budget: { client_minutes: mins(budget.client_minutes), interstellar_minutes: mins(budget.interstellar_minutes), notes: t(budget.notes, 300) },
    },
    editing: {
      based_on_brand_kit: Boolean(ed.based_on_brand_kit),
      colors: strs(ed.colors, 8, 120), fonts: strs(ed.fonts, 4, 120), voice: strs(ed.voice, 6, 200),
      photo_style: t(ed.photo_style, 400), video_style: t(ed.video_style, 400), templates: strs(ed.templates, 8, 160),
      dos: strs(ed.dos, 8, 200), donts: strs(ed.donts, 8, 200),
    },
    captions: {
      structure: t(cap.structure, 300), rules: strs(cap.rules, 8, 240), cta_examples: strs(cap.cta_examples, 6, 160),
      hashtag_rules: strs(cap.hashtag_rules, 6, 200),
      hashtag_sets: l(cap.hashtag_sets, 5).map((h) => ({ name: t(h && h.name, 40), tags: strs(h && h.tags, 15, 40) })).filter((h) => h.tags.length),
    },
    engagement: { daily: strs(eng.daily, 6, 200), weekly: strs(eng.weekly, 6, 200), response_rules: strs(eng.response_rules, 6, 240), response_time: t(eng.response_time, 80) },
    consistency: { batching_day: t(con.batching_day, 60), batching_plan: strs(con.batching_plan, 6, 200), templates: strs(con.templates, 8, 160), content_bank: strs(con.content_bank, 12, 200) },
    repurposing: l(p.repurposing, 6).map((r) => ({ from: t(r && r.from, 80), to: strs(r && r.to, 6, 60), how: t(r && r.how, 300) })).filter((r) => r.from),
    kpis: l(p.kpis, 10).map((k) => ({
      name: t(k && k.name, 100), platform: t(k && k.platform, 40), current: t(k && k.current, 60), target: t(k && k.target, 60),
      source: t(k && k.source, 140), is_estimate: Boolean(k && k.is_estimate), how_to_track: t(k && k.how_to_track, 200),
    })).filter((k) => k.name),
    roles: { interstellar: strs(roles.interstellar, 8), client: strs(roles.client, 8), together: strs(roles.together, 6) },
    search: normalizeSearch(p.search),
    collaborations: l(p.collaborations, 8).map((c) => ({ idea: t(c && c.idea, 300), format: t(c && c.format, 80), how: t(c && c.how, 400), disclosure: t(c && c.disclosure, 240) })).filter((c) => c.idea),
    compliance: strs(p.compliance, 8),
    next_steps: strs(p.next_steps, 8),
    assumptions: strs(p.assumptions, 8),
  };
}

function normalizeSearch(raw) {
  const s = o(raw);
  return {
    keyword_map: l(s.keyword_map, 8).filter((k) => k && typeof k === "object").map((k) => ({ platform: platformId(k.platform) || t(k.platform, 30), phrases: strs(k.phrases, 20, 100), notes: t(k.notes, 300) })).filter((k) => k.phrases.length),
    profile_seo: l(s.profile_seo, 8).filter((x) => x && typeof x === "object").map((x) => ({
      platform: platformId(x.platform) || t(x.platform, 30), name_field: t(x.name_field, 100), username: t(x.username, 60), bio: t(x.bio, 400),
      links: strs(x.links, 6, 200), highlights: strs(x.highlights, 10, 60), other: strs(x.other, 8, 240),
    })).filter((x) => x.platform),
    pillar_keywords: l(s.pillar_keywords, 8).map((x) => ({ pillar: t(x && x.pillar, 60), keywords: strs(x && x.keywords, 10, 100) })).filter((x) => x.pillar),
    caption_template: t(s.caption_template, 600),
    alt_text_template: t(s.alt_text_template, 300),
    video_rules: strs(s.video_rules, 8, 240),
    sample_posts: l(s.sample_posts, 10).filter((x) => x && typeof x === "object").map((x) => ({
      platform: platformId(x.platform) || t(x.platform, 40), format: formatId(x.format) || t(x.format, 30), pillar: t(x.pillar, 60),
      primary_keyword: t(x.primary_keyword, 100), hook: t(x.hook, 200), on_screen_text: t(x.on_screen_text, 200), spoken_keywords: t(x.spoken_keywords, 300),
      caption: t(x.caption, 2200), alt_text: t(x.alt_text, 300), hashtags: strs(x.hashtags, 5, 40), needs_from_client: t(x.needs_from_client, 300),
    })).filter((x) => x.caption || x.hook),
    measurement: l(s.measurement, 12).map((m) => ({ metric: t(m && m.metric, 100), where: t(m && m.where, 120), target: t(m && m.target, 80) })).filter((m) => m.metric),
  };
}

export const weeklyBudget = (p) => {
  const b = (p && p.workflow && p.workflow.weekly_time_budget) || {};
  const fromSteps = ((p && p.workflow && p.workflow.steps) || []).reduce((a, s) => a + (s.minutes_per_week || 0), 0);
  return { client: b.client_minutes, interstellar: b.interstellar_minutes, steps: fromSteps || null, notes: b.notes || "" };
};

export const fmtMinutes = (m) => (m == null ? "—" : m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);

/* ---------------- markdown ---------------- */

export function socialPlanToMarkdown(raw, business = "") {
  const p = normalizeSocialPlan(raw);
  if (!p) return "";
  const out = [];
  const g = p.goals_audience || {};
  const li = (xs) => (xs || []).map((x) => `- ${x}`);
  out.push(`# ${business ? `${business} — ` : ""}Social Media Plan`);
  if (p.headline) out.push("", `**${p.headline}**`);
  if (p.summary) out.push("", p.summary);
  out.push("", "## Goals & audience");
  if ((g.business_goals || []).length) out.push("**Business goals**", ...li(g.business_goals));
  if ((g.social_goals || []).length) out.push("", "**What social does for it**", ...li(g.social_goals));
  if (g.audience) out.push("", `**Audience:** ${g.audience}`);
  if (g.voice_summary) out.push("", `**Voice:** ${g.voice_summary}`);
  if ((g.unknowns || []).length) out.push("", "Unknowns: " + g.unknowns.join("; "));
  if ((p.platforms || []).length) {
    out.push("", "## Platform strategy", "_Posting days and times are starting points to test, not data._");
    p.platforms.forEach((x) => {
      out.push("", `### ${x.name} (${x.priority})`, `- Role: ${x.role || "—"}`, `- Cadence: ${x.cadence || "—"}`);
      if (x.best_formats.length) out.push(`- Best formats: ${x.best_formats.join(", ")}`);
      if (x.posting_guidance) out.push(`- When to post (starting point): ${x.posting_guidance}`);
      if (x.setup.length) out.push(`- Set up: ${x.setup.join("; ")}`);
    });
    if ((p.skipped_platforms || []).length) out.push("", "**Not now:** " + p.skipped_platforms.map((s) => `${platformLabel(s.id)}${s.why ? ` (${s.why})` : ""}`).join("; "));
  }
  if ((p.pillars || []).length) {
    out.push("", "## Content pillars");
    p.pillars.forEach((x) => out.push("", `### ${x.name}${x.share ? ` · ${x.share}` : ""}`, x.description || "", ...li(x.example_posts)));
  }
  if ((p.formats || []).length) {
    out.push("", "## Formats playbook");
    p.formats.forEach((f) => out.push(`- **${f.name}**${f.frequency ? ` (${f.frequency})` : ""}: ${f.use_for}${f.how.length ? ` — ${f.how.join("; ")}` : ""}`));
  }
  if ((p.calendar || []).length) {
    out.push("", "## 4-week starter calendar");
    p.calendar.forEach((w) => {
      out.push("", `### Week ${w.week}${w.theme ? ` — ${w.theme}` : ""}`, "| Day | Platform | Format | Post |", "| --- | --- | --- | --- |");
      w.posts.forEach((x) => out.push(`| ${x.day} | ${platformLabel(x.platform)} | ${formatLabel(x.format)} | ${x.idea}${x.hook ? ` — hook: "${x.hook}"` : ""}${x.keyword ? ` — keyword: ${x.keyword}` : ""}${x.on_screen_text ? ` — on-screen: "${x.on_screen_text}"` : ""} |`));
    });
  }
  const wf = p.workflow || {};
  if ((wf.steps || []).length) {
    out.push("", "## Creation workflow");
    wf.steps.forEach((s, i) => out.push(`${i + 1}. **${s.title || s.id}** (${s.who || "—"}${s.minutes_per_week ? `, ~${fmtMinutes(s.minutes_per_week)}/week` : ""}): ${s.how.join("; ")}${s.tools.length ? ` · Tools: ${s.tools.join(", ")}` : ""}`));
    const b = weeklyBudget(p);
    out.push("", `Weekly time budget (estimate): client ${fmtMinutes(b.client)}, Interstellar ${fmtMinutes(b.interstellar)}${b.notes ? ` — ${b.notes}` : ""}`);
  }
  const ed = p.editing || {};
  if ((ed.colors || []).length || ed.photo_style || (ed.dos || []).length) {
    out.push("", `## Editing guidelines${ed.based_on_brand_kit ? " (from the approved brand kit)" : ""}`);
    if (ed.colors.length) out.push(`- Colors: ${ed.colors.join(", ")}`);
    if (ed.fonts.length) out.push(`- Fonts: ${ed.fonts.join(", ")}`);
    if (ed.voice.length) out.push(`- Voice: ${ed.voice.join("; ")}`);
    if (ed.photo_style) out.push(`- Photo style: ${ed.photo_style}`);
    if (ed.video_style) out.push(`- Video style: ${ed.video_style}`);
    if (ed.dos.length) out.push("", "**Do**", ...li(ed.dos));
    if (ed.donts.length) out.push("", "**Don't**", ...li(ed.donts));
  }
  const cap = p.captions || {};
  if (cap.structure || (cap.rules || []).length) {
    out.push("", "## Captions & hashtags");
    if (cap.structure) out.push(`- Structure: ${cap.structure}`);
    out.push(...li(cap.rules), ...li(cap.hashtag_rules));
    (cap.hashtag_sets || []).forEach((h) => out.push(`- ${h.name || "Set"}: ${h.tags.join(" ")}`));
  }
  const eng = p.engagement || {};
  if ((eng.daily || []).length || (eng.response_rules || []).length) out.push("", "## Engagement routine", ...li(eng.daily), ...li(eng.weekly), ...li(eng.response_rules), eng.response_time ? `- Response time: ${eng.response_time}` : "");
  const con = p.consistency || {};
  if (con.batching_day || (con.batching_plan || []).length) out.push("", "## Consistency system", con.batching_day ? `- Batching day: ${con.batching_day}` : "", ...li(con.batching_plan), ...li(con.templates.map((x) => `Template: ${x}`)), ...li(con.content_bank.map((x) => `Content bank: ${x}`)));
  if ((p.repurposing || []).length) out.push("", "## Repurposing", ...p.repurposing.map((r) => `- ${r.from} → ${r.to.join(" → ")}${r.how ? ` — ${r.how}` : ""}`));
  if ((p.kpis || []).length) out.push("", "## KPIs", "| KPI | Platform | Now | Target |", "| --- | --- | --- | --- |", ...p.kpis.map((k) => `| ${k.name} | ${k.platform || "—"} | ${k.current || "unknown"} | ${k.target || "unknown"}${k.is_estimate ? " (est.)" : ""} |`));
  const r = p.roles || {};
  if ((r.interstellar || []).length || (r.client || []).length) out.push("", "## Who does what", "**Interstellar**", ...li(r.interstellar), "", "**You**", ...li(r.client), ...(r.together.length ? ["", "**Together**", ...li(r.together)] : []));
  const sm = socialSearchMarkdown(p, { heading: "##" });
  if (sm) out.push("", sm);
  out.push("", "## Rules", ...li([...SOCIAL_COMPLIANCE, ...(p.compliance || [])]));
  if ((p.next_steps || []).length) out.push("", "## Next steps", ...p.next_steps.map((s, i) => `${i + 1}. ${s}`));
  return out.filter((x) => x !== null && x !== undefined).join("\n");
}

// The search (social SEO) + collaborations part of a plan as markdown. Used by socialPlanToMarkdown and
// by the plan view (SocialPlanTab), so the structured sections are visible everywhere.
export function socialSearchMarkdown(plan, { heading = "##" } = {}) {
  const p = plan && plan.search !== undefined && plan.goals_audience ? plan : normalizeSocialPlan(plan);
  if (!p) return "";
  const out = [];
  const li = (xs) => (xs || []).map((x) => `- ${x}`);
  const h3 = `${heading}#`;
  const se = p.search || {};
  if ((se.keyword_map || []).length || (se.profile_seo || []).length || (se.sample_posts || []).length) {
    out.push(`${heading} Search optimization (social SEO)`);
    (se.keyword_map || []).forEach((k) => out.push("", `**Keywords — ${platformLabel(k.platform)}**${k.notes ? ` (${k.notes})` : ""}`, ...li(k.phrases)));
    if ((se.profile_seo || []).length) {
      out.push("", `${h3} Profile fixes`);
      se.profile_seo.forEach((x) => out.push("", `**${platformLabel(x.platform)}**`, x.name_field ? `- Name field: ${x.name_field}` : "", x.username ? `- Username: ${x.username}` : "", x.bio ? `- Bio: ${x.bio}` : "", x.links.length ? `- Links: ${x.links.join("; ")}` : "", x.highlights.length ? `- Highlights: ${x.highlights.join(", ")}` : "", ...li(x.other)));
    }
    if ((se.pillar_keywords || []).length) out.push("", `${h3} Pillars → keywords`, ...se.pillar_keywords.map((x) => `- **${x.pillar}:** ${x.keywords.join("; ")}`));
    if (se.caption_template) out.push("", `**Caption template:** ${se.caption_template}`);
    if (se.alt_text_template) out.push(`**Alt-text template:** ${se.alt_text_template}`);
    if ((se.video_rules || []).length) out.push("", "**Video (Reels/Shorts/TikTok)**", ...li(se.video_rules));
    if ((se.sample_posts || []).length) {
      out.push("", `${h3} Sample posts`);
      se.sample_posts.forEach((x, i) => out.push("", `**${i + 1}. ${platformLabel(x.platform)} · ${formatLabel(x.format)}${x.pillar ? ` · ${x.pillar}` : ""}** — keyword: ${x.primary_keyword || "—"}`, x.hook ? `- Hook: ${x.hook}` : "", x.on_screen_text ? `- On-screen: ${x.on_screen_text}` : "", x.spoken_keywords ? `- Spoken: ${x.spoken_keywords}` : "", x.caption ? `- Caption: ${x.caption.replace(/\n+/g, " / ")}` : "", x.alt_text ? `- Alt text: ${x.alt_text}` : "", x.hashtags.length ? `- Hashtags: ${x.hashtags.join(" ")}` : "", x.needs_from_client ? `- Needs: ${x.needs_from_client}` : ""));
    }
    if ((se.measurement || []).length) out.push("", `${h3} Search measurement`, "| Metric | Where | Target |", "| --- | --- | --- |", ...se.measurement.map((m) => `| ${m.metric} | ${m.where || "—"} | ${m.target || "unknown"} |`));
  }
  if ((p.collaborations || []).length) out.push("", `${heading} Collaborations`, ...p.collaborations.map((c) => `- **${c.idea}**${c.format ? ` (${c.format})` : ""}${c.how ? ` — ${c.how}` : ""}${c.disclosure ? ` Disclosure: ${c.disclosure}` : ""}`));
  return out.filter((x) => x !== null && x !== undefined).join("\n").trim();
}

/* ---------------- inputs ---------------- */

const show = (v) => (Array.isArray(v) ? v.map((x) => (typeof x === "object" && x ? x.name || x.term || x.title || x.city || JSON.stringify(x) : x)).join(", ") : typeof v === "object" && v ? JSON.stringify(v) : String(v ?? ""));
const rows = (list) => list.filter(([, v]) => v !== undefined && v !== null && v !== "" && (!Array.isArray(v) || v.length) && !(typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length)).map(([k, v]) => `- ${k}: ${show(v)}`).join("\n");

// Intake / onboarding answers that matter for social, asked first.
const INTAKE_SOCIAL_KEYS = ["socials", "lead_sources", "listings", "ideal_customer", "why_choose", "goal_12mo", "goal_3yr", "success_with_us", "capacity", "seasons", "competitors", "keywords", "bottleneck", "reviews", "review_process", "brand_words", "photos", "team_size"];
const FLIGHT_SOCIAL_KEYS = ["goals", "primary_cta", "competitors", "keywords", "socials", "brand", "timeline"];

// Inputs come from the shared client context (src/features/clients/clientContext.js).
export async function gatherSocialPlanInputs(client) {
  const [ctx, agency] = await Promise.all([loadClientContext(client.id), loadAgencyKnowledge()]);
  return {
    dossier: ctx.dossier,
    intake: ctx.intake,
    flight: ctx.flight,
    goals: ctx.goals,
    kit: ctx.brandKit,
    playbook: ctx.playbook,
    contentPlan: ctx.contentPlan,
    socialFiles: ctx.files.filter((x) => x.category === "social"),
    work: ctx.work.filter((w) => ["blog", "gbp_post", "social_post", "social"].includes(w.kind)),
    review: ctx.review,
    current: ctx.socialPlan,
    ctx,
    agency,
  };
}

export function inputChips(d) {
  if (!d) return [];
  const ia = (d.intake && d.intake.answers) || {};
  return [
    ["Dossier", d.dossier ? "on file" : "none"],
    ["Intake answers", d.intake ? String(INTAKE_SOCIAL_KEYS.filter((k) => ia[k]).length) : "none"],
    ["Onboarding answers", d.flight ? "on file" : "none"],
    ["Goals", String(d.goals.length)],
    ["Brand kit", d.kit ? `v${d.kit.version || 1}` : "none"],
    ["Playbook", d.playbook ? `v${d.playbook.version || 1}` : "none"],
    ["Content plan", d.contentPlan ? `v${d.contentPlan.version || 1}` : "none"],
    ["Social handles", ia.socials ? "on file" : "unknown"],
    ["Current social plan", d.current ? `v${d.current.version || 1}` : "none"],
  ];
}

function clientBlock(c) {
  const ld = c.lead_details || {};
  return rows([
    ["CRMClient id", c.id], ["Business", c.business], ["Contact", c.contact], ["Industry", c.industry], ["Location", c.location],
    ["Website", c.domain || (c.websites || [])[0]], ["Plan with Interstellar", c.plan], ["Services we manage", c.services_managed],
    ["Billing lines", (c.services || []).map((s) => (s && (s.name || s.label)) || "").filter(Boolean)], ["Client since", c.started_on],
    ["Team size (lead form)", ld.team_size], ["Biggest problem (lead form)", ld.biggest_problem],
  ]) || "Only the business name is on file.";
}

function dossierBlock(d) {
  if (!d) return "No Constellations dossier yet.";
  return rows([
    ["Dream outcome", d.dream_outcome], ["Elevator pitch", d.elevator_pitch], ["USP", d.usp], ["Differentiators", d.differentiators], ["Services", d.services], ["Offers", d.offers],
    ["Service area", d.service_area], ["Audience", d.audience], ["Competitors", d.competitors], ["Lead sources", d.lead_sources],
    ["Brand identity on file", d.brand_identity], ["Brand voice on file", d.brand_voice], ["Keywords (top 12)", (d.keywords || []).slice(0, 12)],
    ["Team size", d.team_size], ["Tools they use", d.tools],
  ]) || "Dossier is empty.";
}

function answersBlock(d) {
  const ia = (d.intake && d.intake.answers) || {};
  const fa = (d.flight && d.flight.answers) || {};
  const a = INTAKE_SOCIAL_KEYS.filter((k) => ia[k] && (!Array.isArray(ia[k]) || ia[k].length)).map((k) => `- ${k}: ${show(ia[k]).slice(0, 600)}`);
  const b = FLIGHT_SOCIAL_KEYS.filter((k) => fa[k] && typeof fa[k] !== "object").map((k) => `- onboarding ${k}: ${String(fa[k]).slice(0, 600)}`);
  return [...a, ...b].join("\n") || "No intake or onboarding answers about social yet.";
}

function goalsBlock(goals) {
  if (!goals.length) return "No ClientGoal records yet.";
  return goals.slice(0, 12).map((g) => `- ${g.title}${g.metric ? ` [${g.metric}]` : ""}: current ${g.current_value ?? "unknown"}, target ${g.target_value ?? "unknown"} ${g.unit || ""}`).join("\n");
}

function kitBlock(kit) {
  if (!kit) return "No approved brand kit. Keep editing guidelines general and say so (based_on_brand_kit = false).";
  const k = kit.kit || {};
  const ty = k.typography || {};
  const v = k.voice || {};
  const palette = (k.palette || []).map((p) => (p && p.hex ? `${p.name || ""} ${p.hex}${p.role ? ` (${p.role})` : ""}`.trim() : "")).filter(Boolean);
  const fam = (x) => (x && (x.family || (typeof x === "string" ? x : ""))) || "";
  return rows([
    ["Version", kit.version], ["Essence", k.overview && k.overview.essence], ["Palette", palette],
    ["Heading font", fam(ty.headings)], ["Body font", fam(ty.body)], ["Voice", v.personality], ["Tone", v.tone], ["We say", v.we_say], ["We never say", v.we_never_say],
    ["Photo style", k.imagery && k.imagery.photo_style], ["Show", k.imagery && k.imagery.subjects], ["Avoid", k.imagery && k.imagery.avoid],
    ["Social guidance in the kit", (v.by_channel || []).filter((c) => /social/i.test(c && c.channel)).map((c) => c.guidance)],
    ["Primary tagline", k.taglines && k.taglines.primary],
  ]);
}

function playbookBlock(pb) {
  if (!pb) return "No approved industry playbook.";
  const p = pb.playbook || {};
  const g = p.goal_summary || {};
  const content = (p.pillars || []).find((x) => x && x.id === "content_social");
  return [
    `Approved playbook v${pb.version || 1}: ${pb.summary || p.headline || ""}`,
    g.where_they_want_to_be ? `Goal: ${g.where_they_want_to_be}${g.by_when ? ` by ${g.by_when}` : ""}` : "",
    g.north_star ? `North star: ${g.north_star}` : "",
    content ? `Content & Social pillar: now ${content.current_state || "?"}; target ${content.target || "?"}; Interstellar doing: ${(content.interstellar_doing || []).join("; ") || "nothing listed"}; owner actions: ${(content.owner_actions || []).join("; ")}` : "",
  ].filter(Boolean).join("\n");
}

function contentPlanBlock(cp) {
  if (!cp) return "No approved content plan (blog / GBP cadence).";
  const b = cp.blog || {};
  const g = cp.gbp || {};
  return rows([
    ["Version", cp.version], ["Summary", cp.summary],
    ["Blog", b.enabled === false ? "off" : `${b.frequency || "?"} on ${(b.days || []).join(", ") || "?"}`], ["Blog pillars", (b.pillars || []).map((x) => x && x.name)],
    ["GBP posts", g.enabled === false ? "off" : `${g.frequency || "?"} on ${(g.days || []).join(", ") || "?"}${g.derived_from_blog ? " (from each blog post)" : ""}`], ["GBP themes", g.themes],
  ]);
}

function workBlock(d) {
  const lines = [];
  const rc = d.review && d.review.cache;
  lines.push(rc && rc.rating != null ? `- Google rating: ${rc.rating} from ${rc.total || 0} reviews (Stärboard cache)` : "- Google rating: unknown (not linked).");
  d.work.slice(0, 12).forEach((w) => lines.push(`- ${w.date || ""} ${w.kind}: ${w.title}`));
  d.socialFiles.slice(0, 10).forEach((f) => lines.push(`- Social file on profile: ${f.title}`));
  return lines.join("\n");
}

function core(client, d, extra) {
  return `# Social Media Plan: ${client.business}

Write a client-specific social media plan and operating system for ${client.business} (${client.industry || "industry unknown"}${client.location ? `, ${client.location}` : ""}). It covers which platforms to use and why, what to post (pillars, formats, a 4-week starter calendar), how content gets made every week (capture → edit → caption → schedule → engage) with a realistic time budget, how it stays on brand, and who does what.
${extra ? `\n## Justin's direction (follow this first — it overrides defaults below)\n${extra}\n` : ""}
## Client
${clientBlock(client)}

## Constellations dossier
${dossierBlock(d.dossier)}

## Intake + onboarding answers (their own words)
${answersBlock(d)}

## Goals on file
${goalsBlock(d.goals)}

## Approved brand kit (editing guidelines come from here)
${kitBlock(d.kit)}

## Approved industry playbook
${playbookBlock(d.playbook)}

## Approved content plan (blog + GBP cadence — the social plan repurposes this, never contradicts it)
${contentPlanBlock(d.contentPlan)}

## Recent content work and reputation
${workBlock(d)}

${d.ctx ? contextToBrief(d.ctx, { sections: ["profile", "services"] }) : ""}
${agencyBlock(d.agency, ["offers", "delivery"])}
${agencyBlock(d.agency, ["social_search"], { maxChars: 4500 })}
${d.current ? `\n## Current approved social plan (v${d.current.version || 1})\nThis is a revision. Keep what still holds; change what Justin asks.\n${d.current.summary || ""}` : ""}

## Platforms (use these ids; include ONLY the ones that fit this business, list the rest in skipped_platforms with why)
${PLATFORMS.map(([id, name]) => `- ${id} — ${name}`).join("\n")}

## Formats (use these ids)
${FORMATS.map(([id, name]) => `- ${id} — ${name}`).join("\n")}

## Rules for this plan
- NEVER invent the client's numbers (followers, reach, engagement, leads, reviews). Use only figures in the inputs above, with their source. Unknown is "unknown" and goes in goals_audience.unknowns.
- A target you set as a sensible benchmark sets is_estimate = true and is labelled "est.". Never present it as their result.
- Posting days and times are STARTING POINTS to test, labelled that way — never "data shows".
- Be realistic for a busy owner: the weekly time budget must fit their team size and capacity. Prefer batching.
- Calendar: exactly 4 weeks, each with 3-7 posts across the chosen platforms, every post specific to this business (no generic "share a tip").
- Repurposing must start from their real content engine: blog → GBP post → reel → carousel when a content plan exists.
- roles.interstellar lists only what Interstellar actually does for them (their plan, services, content plan). Do not promise services they have not bought.
- Testimonials and reviews: real only, with permission. Never write fake quotes.
- Google Business Profile posts: no phone number, no street address, no bare URL in the copy; the Learn more button is the only link and it is the plain URL with no UTM parameters.
- Editing guidelines use the approved brand kit's colors (hex), fonts and voice when one exists.
- The Interstellar brand gradient is #ff3c00 → #ff6a00 → #ffaa00 (never gold or yellow).

## Social search rules (every plan is built to be found — fill the "search" section completely)
${SOCIAL_SEARCH_RULES.map((r) => `- ${r}`).join("\n")}
- search.keyword_map: one entry per chosen platform, 10-20 phrases each. search.profile_seo: recommended name field, username, bio text, links and highlights per platform (current bio unknown → write the recommended one and say so in assumptions).
- search.sample_posts: at least 6 fully written posts (hook, on-screen text, spoken keywords for video, full caption, alt text, 3-5 hashtags). Where a real story, photo or result is needed write "[CLIENT: real example]" — never invent one.
- Every calendar post carries its keyword (and on_screen_text / spoken_keywords for video). captions.hashtag_sets: 3-5 tags per set.
- collaborations: partner / sister-brand / creator ideas with honest disclosure of any material connection (FTC Endorsement Guides).
- Health, supplement and fitness clients: no disease or medical claims, no guaranteed results, no invented before/afters; flag any claim that needs substantiation in compliance.`;
}

export function socialPlanBrief(client, d, extra = "") {
  return `${core(client, d, extra)}

## What to produce
1. result_data = { "social_plan": <the JSON below, every section filled> }
\`\`\`json
${SOCIAL_PLAN_JSON_SHAPE}
\`\`\`
2. result_body = the same plan as clean client-facing markdown (one H2 per section; the calendar and KPIs as tables).
3. result_summary = two sentences: the platforms chosen and the weekly rhythm.
4. needs_from_justin = the unknowns you could not confirm (handles, who films, current numbers).
You may look at their live site (${client.domain || (client.websites || [])[0] || "no site on file"}) and public social profiles for the current state; cite what you looked at in assumptions.

## Rules for this job
- Do NOT create or update a SocialPlan record and do not touch the CRMClient. Approval in Møthership saves the plan to the client profile.
- Do not post anything anywhere. Nothing is shown to the client until Justin approves it and turns it on for the portal.

## Rules
${STANDING_RULES.map((r) => `- ${r}`).join("\n")}

## When you finish
Write back to this ClaudeJob: result_data, result_body, result_summary, result_links (anything you made), needs_from_justin, status = needs_approval, finished_at = now.`;
}

function quickPrompt(client, d, extra) {
  return `You are Interstellar Strategies' senior social media strategist. ${core(client, d, extra)}

Return JSON only, matching the schema: {headline, summary, goals_audience, platforms[], skipped_platforms[], pillars[], formats[], calendar[4 weeks], workflow, editing, captions, engagement, consistency, repurposing[], kpis[], roles, search{keyword_map, profile_seo, pillar_keywords, caption_template, alt_text_template, video_rules, sample_posts, measurement}, collaborations[], compliance[], next_steps[], assumptions[]}. Include 3-5 pillars and only the platforms that fit.`;
}

function jobFields(client, d, extra) {
  return {
    title: `Social plan — ${client.business}`,
    kind: "social_plan",
    instructions: socialPlanBrief(client, d, extra),
    extra,
    client_id: client.id,
    client_name: client.business,
    priority: 2,
    complete_task_on_approve: false,
    requested_at: new Date().toISOString(),
  };
}

export async function queueSocialPlan(client, extra = "") {
  const d = await gatherSocialPlanInputs(client);
  return base44.entities.ClaudeJob.create({
    ...jobFields(client, d, extra),
    status: "queued",
    context: { [SOCIAL_PLAN_CONTEXT]: true, revision_of: d.current ? d.current.id : "" },
  });
}

// In-app quick draft: same brief + schema through Core.InvokeLLM. It lands as a ClaudeJob waiting for
// approval, so review, approve and "request changes → Claude" work exactly like a queued job.
export async function quickDraftSocialPlan(client, extra = "", { web = false } = {}) {
  const d = await gatherSocialPlanInputs(client);
  const out = await base44.integrations.Core.InvokeLLM({
    prompt: quickPrompt(client, d, extra),
    response_json_schema: SOCIAL_PLAN_JSON_SCHEMA,
    add_context_from_internet: !!web,
  });
  const plan = normalizeSocialPlan(out);
  if (!plan) throw new Error("The draft came back empty. Try again or send it to Claude.");
  const now = new Date().toISOString();
  return base44.entities.ClaudeJob.create({
    ...jobFields(client, d, extra),
    title: `Social plan — ${client.business} (quick draft)`,
    status: "needs_approval",
    started_at: now,
    finished_at: now,
    result_data: { social_plan: plan },
    result_summary: plan.summary || plan.headline || "Quick draft from Møthership.",
    result_body: socialPlanToMarkdown(plan, client.business),
    needs_from_justin: (plan.goals_audience.unknowns || []).map((u) => `- ${u}`).join("\n"),
    context: { [SOCIAL_PLAN_CONTEXT]: true, quick_draft: true, web: !!web, revision_of: d.current ? d.current.id : "" },
  });
}

export const isSocialPlanJob = (job) => !!(job && job.kind === "social_plan" && job.context && job.context[SOCIAL_PLAN_CONTEXT]);
export const socialPlanFromJob = (job) => normalizeSocialPlan(job && job.result_data);

// Called from approveJob: archive the previous version, save the approved one (hidden from the portal).
export async function saveApprovedSocialPlan(job) {
  if (!job.client_id) return null;
  const plan = socialPlanFromJob(job);
  if (!plan) return null;
  const existing = await base44.entities.SocialPlan.filter({ client_id: job.client_id }, "-version", 50).catch(() => []);
  if ((existing || []).some((k) => k.source_job_id === job.id)) return null; // already saved
  const me = await base44.auth.me().catch(() => null);
  await Promise.all((existing || []).filter((k) => k.status === "approved").map((k) => base44.entities.SocialPlan.update(k.id, { status: "archived", portal_visible: false })));
  const version = (existing || []).reduce((max, k) => Math.max(max, Number(k.version) || 0), 0) + 1;
  return base44.entities.SocialPlan.create({
    client_id: job.client_id,
    client_name: job.client_name || "",
    status: "approved",
    version,
    summary: job.result_summary || plan.summary || "",
    plan,
    body_md: job.result_body || socialPlanToMarkdown(plan, job.client_name || ""),
    direction: job.extra || "",
    source_job_id: job.id,
    generated_by: job.context && job.context.quick_draft ? "quick_draft" : "claude_queue",
    approved_at: new Date().toISOString(),
    approved_by: (me && me.email) || "",
    portal_visible: false,
  });
}
