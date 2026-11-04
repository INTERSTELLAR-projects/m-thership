import { base44 } from "@/api/base44Client";
import { addDays, todayIn, weekdayOf } from "../lib/publish";

// Interstellar's own channels. Cadences are starting assumptions Justin can change in the Channel plan
// (stored in AppSettings key social_studio -> pageSettings.channels). Instagram + Facebook publish
// through the approval flow; LinkedIn and YouTube are planned here and posted by hand.

export const LINKS = {
  instagram: "https://www.instagram.com/interstellarstrategies/",
  facebook: "https://www.facebook.com/interstellar.strategies",
  youtube: "https://www.youtube.com/@interstellarstrategies",
  youtube_studio: "https://studio.youtube.com/",
  linkedin_company: "https://www.linkedin.com/company/interstellar-business-os/",
  linkedin_company_admin: "https://www.linkedin.com/company/interstellar-business-os/admin/page-posts/published/",
  linkedin_personal_feed: "https://www.linkedin.com/feed/",
  website: "https://interstellar-strategies.com",
  email: "hello@interstellar-strategies.com",
};
export const YT_PLAN_DOC = "https://claude.ai/artifact/VabGYQ6oQbAb1VQ1aj3GpW";

export const CHANNELS = [
  {
    key: "instagram", label: "Instagram", handle: "@interstellarstrategies", link: LINKS.instagram, mode: "auto",
    cadence: 5, unit: "posts / week", pillars: ["pain_point", "product_showcase", "proof_of_process", "education", "offer", "founder_story"],
    how: "Weekly Claude batch → you approve → Møthership publishes at the scheduled time.",
  },
  {
    key: "facebook", label: "Facebook", handle: "facebook.com/interstellar.strategies", link: LINKS.facebook, mode: "auto",
    cadence: 5, unit: "posts / week", pillars: ["pain_point", "product_showcase", "proof_of_process", "education", "offer", "founder_story"],
    how: "Cross-posts the approved Instagram post when the Facebook target is on.",
  },
  {
    key: "youtube_long", label: "YouTube · long-form", handle: "Interstellar™ | Business OS", link: LINKS.youtube, mode: "manual",
    cadence: 1, unit: "video / week", pillars: ["AI Search Brief", "Command System Walkthrough", "Teardown", "Business OS Q&A"],
    how: "Mon topic + titles · Tue script · Wed record · Thu edit + clip Shorts · Fri publish.",
    doc: YT_PLAN_DOC,
  },
  {
    key: "youtube_short", label: "YouTube · Shorts", handle: "@interstellarstrategies", link: LINKS.youtube, mode: "manual",
    cadence: 4, unit: "Shorts / week", pillars: ["Clips from the long-form video", "Reused Instagram/Facebook posts"],
    how: "Reuse IG/FB posts and long-form clips. Upload by hand.",
    flags: [
      "Export clean masters: no TikTok/Instagram watermarks or UI on the video.",
      "Set each Short's Related video to the long-form source it came from.",
      "Vertical 9:16, under 60 seconds, captions burned in.",
    ],
  },
  {
    key: "linkedin_company", label: "LinkedIn · Company page", handle: "Interstellar Business OS", link: LINKS.linkedin_company, mode: "manual",
    cadence: 3, cadenceNote: "2–3 / week (starting assumption)", unit: "posts / week", pillars: ["education", "product_showcase", "proof_of_process", "pain_point", "offer"],
    voice: "Brand voice, “we”. Educational, practical, same pillars as Instagram.",
    how: "Claude drafts into the LinkedIn queue → you approve → Copy text, post from the company admin, paste the URL.",
    postUrl: LINKS.linkedin_company_admin,
  },
  {
    key: "linkedin_personal", label: "LinkedIn · Justin", handle: "Justin Cowell", link: LINKS.linkedin_personal_feed, mode: "manual",
    cadence: 4, cadenceNote: "3–5 / week (starting assumption)", unit: "posts / week", pillars: ["founder_story", "lessons", "behind_the_build", "opinion"],
    voice: "First person. Founder story, lessons, behind-the-build, opinions. Points people to the company page.",
    how: "Claude drafts into your personal queue → you approve and edit → Copy text, post from your feed, paste the URL.",
    postUrl: LINKS.linkedin_personal_feed,
  },
];
export const channelByKey = (k) => CHANNELS.find((c) => c.key === k);

export const VOICES = {
  linkedin_company: [
    "Write as Interstellar Strategies (\"we\"), the company page Interstellar Business OS.",
    "Educational and practical: one useful idea per post for owners of small service businesses.",
    "Hook line that stands alone above the fold, short paragraphs, white space, a clear takeaway, a soft CTA (follow the page, book a free strategy call, comment).",
    "3-5 relevant hashtags at the end. 600-1300 characters.",
  ].join(" "),
  linkedin_personal: [
    "Write as Justin Cowell, founder of Interstellar Strategies, in the first person (\"I\").",
    "Founder story, lessons learned, behind-the-build moments, honest opinions. Plain, specific, no hype, no humblebrag.",
    "End by pointing people to the Interstellar Business OS company page or inviting a reply. 2-4 hashtags max.",
    "Hook line that stands alone. 500-1500 characters.",
  ].join(" "),
  youtube_short: "YouTube Shorts title (under 60 characters, no clickbait) plus a 1-3 line description ending with a pointer to the full video and 2-3 hashtags including #shorts.",
};

export const CONVERSATION_KINDS = [
  { key: "connection_request", label: "Connection request", limit: 280, hint: "LinkedIn notes are capped at about 300 characters." },
  { key: "follow_up", label: "Follow-up", limit: 900 },
  { key: "comment_reply", label: "Reply to a comment", limit: 600 },
  { key: "dm_reply", label: "Reply to a DM", limit: 900 },
  { key: "other", label: "Other message", limit: 1200 },
];

export const SERIES = [
  { key: "ai_search_brief", label: "AI Search Brief" },
  { key: "command_system_walkthrough", label: "Command System Walkthrough" },
  { key: "teardown", label: "Teardown" },
  { key: "business_os_qa", label: "Business OS Q&A" },
  { key: "channel", label: "Channel" },
];
export const STAGES = [
  { key: "idea", label: "Idea", day: "Mon · topic + titles" },
  { key: "script", label: "Script", day: "Tue" },
  { key: "record", label: "Record", day: "Wed" },
  { key: "edit", label: "Edit", day: "Thu · edit + clip Shorts" },
  { key: "scheduled", label: "Scheduled", day: "Fri" },
  { key: "published", label: "Published", day: "" },
];

export const DEFAULT_DESCRIPTION_TEMPLATE = `{{hook}}

In this video:
{{chapters}}

Get your free Intel Briefing: ${LINKS.website}
Email: ${LINKS.email}
LinkedIn: ${LINKS.linkedin_company}
Instagram: ${LINKS.instagram}

Interstellar™ | Business OS · The Future of Business
{{hashtags}}`;

export function buildDescription(template, { hook, chapters, hashtags }) {
  const ch = (chapters || []).filter((c) => c?.label).map((c) => `${c.t || "0:00"} ${c.label}`).join("\n");
  return String(template || DEFAULT_DESCRIPTION_TEMPLATE)
    .replace("{{hook}}", hook || "")
    .replace("{{chapters}}", ch || "0:00 Intro")
    .replace("{{hashtags}}", (hashtags || ["#smallbusiness", "#aisearch", "#businessowner"]).join(" "))
    .trim();
}

/* ─── Week window (Mon–Sun, Pacific) ─────────────────────────────── */
export function weekWindow(tz = "America/Los_Angeles", offset = 0) {
  const today = todayIn(tz);
  const monday = addDays(today, -((weekdayOf(today) + 6) % 7) + offset * 7);
  return { start: monday, end: addDays(monday, 6) };
}
export const inWeek = (dateStr, w) => !!dateStr && dateStr.slice(0, 10) >= w.start && dateStr.slice(0, 10) <= w.end;

/* ─── Settings (cadence overrides + description template) ────────── */
const KEY = "social_studio";
export async function loadChannelSettings() {
  const rows = await base44.entities.AppSettings.filter({ key: KEY }, "-created_date", 1).catch(() => []);
  return rows?.[0]?.pageSettings?.channels || {};
}
export async function saveChannelSettings(patch) {
  // Re-read right before writing so the publish settings and folders in the same row are kept.
  const rows = await base44.entities.AppSettings.filter({ key: KEY }, "-created_date", 1).catch(() => []);
  const row = rows?.[0];
  const next = { ...(row?.pageSettings?.channels || {}), ...patch };
  if (row) await base44.entities.AppSettings.update(row.id, { pageSettings: { ...(row.pageSettings || {}), channels: next } });
  else await base44.entities.AppSettings.create({ key: KEY, pageSettings: { channels: next } });
  return next;
}
