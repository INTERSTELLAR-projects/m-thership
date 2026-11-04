// QA-mode fixtures for the Social Studio (only used by src/lib/qa.js on the preview sandbox with ?qa=1).
// Copies of the first weekly batch, put into every publishing state so the UI can be reviewed.
import { specHash } from "./lib/specHash";
import { SEED_VIDEOS } from "./channels/seedVideos";
import { QA_CHANNELS_STATUS, QA_ENGINE } from "./engine/qaEngine";

const BASE = [
  { id: "6aea2fa76a9f7c6ca398d943", title: "Untitled post", status: "draft", pillar: "pain_point", template: "pain_fix", spec: { eyebrow: "The app pile", headline: "Your business runs on 9 logins and a spreadsheet.", accent_word: "9 logins", subhead: "Every new tool fixed one problem and created two more.", cta: "See the Command System", theme: "light", lockup: "interstellar", mock: { before_label: "Today", before_items: ["Leads in one app, jobs in another", "Invoices typed in twice", "Follow-ups living in your head", "A spreadsheet holding it together"], after_label: "One system", after_items: ["Every lead lands in one pipeline", "Quote to invoice in one click", "Follow-ups that send themselves", "One login for the whole team"] } }, caption: "Nine logins and a spreadsheet is not a system.", generated_by: "justin", created_date: "2026-11-03T19:01:59.486Z" },
  { id: "6ae9210c7922f8b6e704fe69", title: "Fri · Offer: Mission BRAVO", status: "draft", folder: "Week of 2026-11-09", pillar: "offer", template: "offer_stack", spec: { accent_word: "runs the rest", cta: "Book a free strategy call", eyebrow: "Mission BRAVO", headline: "A website that sells. A system that runs the rest.", lockup: "interstellar", mock: { items: [{ name: "Custom Website", value: "$4,997" }, { name: "Command System", value: "$5,997" }, { name: "Intel Briefing", value: "Free" }], offer_name: "Mission BRAVO", price: "$6,497", price_note: "Website + Command System, built together. Runs on HyperCare+ or GravïtyCare after launch.", total_label: "$10,994 if bought separately" }, theme: "light" }, caption: "A website that brings the calls. A system that handles everything after.\n\nMission BRAVO: a custom website plus your own Command System, built together. Free Intel Briefing included.\n\n$6,497.\n\nBook a free strategy call. Link in bio.\n\n#smallbusiness #websitedesign #crm #businesssystems #servicebusiness", planned_for: "2026-11-13", generation_batch: "wk-2026-11-09", generated_by: "claude", created_date: "2026-11-02T23:47:24.100Z" },
  { id: "6ae9210c7922f8b6e704fe68", title: "Thu · Portal: every client sees the work", status: "draft", folder: "Week of 2026-11-09", pillar: "proof_of_process", template: "portal_preview", spec: { accent_word: "Without asking", cta: "Book a free strategy call", eyebrow: "Client portal", headline: "Every client sees the work. Every month. Without asking.", lockup: "mothership", mock: { business: "Cedar & Stone Landscaping", counters: [{ label: "Blogs published", value: "4" }, { label: "Google posts", value: "8" }, { label: "Website updates", value: "6" }, { label: "Listings fixed", value: "11" }], feed: [{ date: "Nov 5", tag: "Blog", title: "When to aerate a lawn in the Pacific Northwest" }, { date: "Nov 3", tag: "Google post", title: "Fall cleanup slots open this week" }], month: "November" }, subhead: "Blogs, Google posts, fixes and updates land in the portal as they ship.", theme: "dark" }, caption: "Our clients never have to ask what we did this month.", planned_for: "2026-11-12", generation_batch: "wk-2026-11-09", generated_by: "claude", created_date: "2026-11-02T23:47:24.100Z" },
  { id: "6ae9210c7922f8b6e704fe67", title: "Wed · Checklist: is your website losing calls?", status: "draft", folder: "Week of 2026-11-09", pillar: "education", template: "checklist", spec: { accent_word: "losing calls", cta: "Get your free Intel Briefing", eyebrow: "Website check", headline: "Is your website quietly losing calls?", lockup: "interstellar", mock: { checked: 5, items: ["Your phone number isn't on the first screen", "It takes over 3 seconds to load on a phone", "Your services don't have their own pages", "Google and your site list different hours", "Nothing gives a visitor a reason to call today"] }, subhead: "Two or more? It's a brochure, not a salesperson.", theme: "dark" }, caption: "Your website might look fine and still be losing calls.", planned_for: "2026-11-11", generation_batch: "wk-2026-11-09", generated_by: "claude", created_date: "2026-11-02T23:47:24.100Z" },
  { id: "6ae9210c7922f8b6e704fe66", title: "Tue · Command Briefing: know where to start", status: "draft", folder: "Week of 2026-11-09", pillar: "product_showcase", template: "command_briefing", spec: { accent_word: "exactly where", cta: "See it in a free call", eyebrow: "Mission Control", headline: "Start every day knowing exactly where to start.", lockup: "mothership", mock: { chips: [{ hot: true, label: "2 quotes to approve" }, { hot: true, label: "4 new leads" }, { hot: false, label: "On pace" }], date_line: "Tuesday, November 10, 2026", greeting: "Good morning", name: "Marcus", one_thing: "Two furnace quotes are waiting on you. Approve them before noon.", tiles: [{ label: "Due today", sub: "none overdue", value: "6" }, { label: "Calls this week", sub: "4 new leads", value: "11" }, { flame: true, label: "Collected (mo)", sub: "9 invoices paid", value: "$22,860" }] }, subhead: "Your system reads every lead, job and invoice overnight, then hands you the one thing.", theme: "light" }, caption: "What if your business told you where to start every morning?", planned_for: "2026-11-10", generation_batch: "wk-2026-11-09", generated_by: "claude", created_date: "2026-11-02T23:47:24.100Z" },
  { id: "6ae9210c7922f8b6e704fe65", title: "Mon · Stack collapse: 8 apps that never talk", status: "draft", folder: "Week of 2026-11-09", pillar: "pain_point", template: "stack_collapse", spec: { accent_word: "never talk", cta: "Book a free strategy call", eyebrow: "The app pile", headline: "You're paying rent on 8 apps that never talk.", lockup: "interstellar", mock: { apps: [{ cost: 79, name: "CRM" }, { cost: 49, name: "Scheduling" }, { cost: 35, name: "Invoicing" }, { cost: 29, name: "Online forms" }, { cost: 99, name: "Review requests" }, { cost: 45, name: "Email marketing" }, { cost: 24, name: "Team chat" }, { cost: 0, name: "Spreadsheets" }], system_items: ["Leads + pipeline", "Scheduling + invoicing", "Client portal", "Review requests", "Automations"], system_name: "One Command System", total_note: "Hypothetical stack at typical list prices" }, subhead: "One system, built around how your shop actually runs.", theme: "light" }, caption: "Eight logins. Eight bills. Zero of them talk to each other.", planned_for: "2026-11-09", generation_batch: "wk-2026-11-09", generated_by: "claude", created_date: "2026-11-02T23:47:24.100Z" },
];

const at = (days, hourUtc) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); d.setUTCHours(hourUtc, 0, 0, 0); return d.toISOString(); };
const STATES = {
  "6ae9210c7922f8b6e704fe65": { status: "approved", scheduled_at: at(1, 17), approved_at: at(0, 18), approved_by: "qa@interstellar.test", publish_targets: { instagram: true, facebook: false } },
  "6ae9210c7922f8b6e704fe66": { status: "approved", scheduled_at: at(2, 20), approved_at: at(0, 18), approved_by: "qa@interstellar.test", publish_targets: { instagram: true, facebook: true } },
  "6aea2fa76a9f7c6ca398d943": { status: "posted", scheduled_at: at(-1, 17), published_at: at(-1, 17), ig_permalink: "https://www.instagram.com/interstellarstrategies/", insights: { likes: 14, comments: 3, reach: 212, updated_at: at(0, 14) }, publish_targets: { instagram: true } },
  "6ae9210c7922f8b6e704fe67": { status: "failed", scheduled_at: at(-1, 20), approved_at: at(-2, 18), publish_error: "Instagram could not fetch the image (code 9004). Approve again to re-render and re-upload it." },
};

const withImage = (p) => (p.status === "approved" ? { ...p, image_url: "https://example.com/qa.jpg", image_spec_hash: specHash(p.template, p.spec) } : p);

export const QA_SOCIAL = {
  SocialPost: BASE.map((p) => withImage({ ...p, ...(STATES[p.id] || {}) })),
  SocialAccount: [],
  YouTubeVideo: SEED_VIDEOS.map((v, i) => ({ id: `qa_v${i}`, ...v, ...(i === 0 ? { stage: "script", publish_date: at(3, 17).slice(0, 10), title_options: ["The Future of Business, in 60 seconds", "What this channel will teach you"] } : {}), ...(i === 1 ? { stage: "record" } : {}) })),
  ChannelPost: [
    { id: "qa_l1", channel: "linkedin_company", status: "draft", title: "Your map pack is a storefront", pillar: "education", generated_by: "claude", planned_for: at(1, 17).slice(0, 10), created_date: at(0, 10), body: "Your Google Business Profile is the storefront most customers see first.\n\nWe audit three things before we touch a website: categories, service areas, and whether the hours match the site.\n\nGet those right and the map pack starts doing its job.\n\nFollow Interstellar Business OS for one practical fix a week.\n\n#localseo #smallbusiness #googlebusinessprofile" },
    { id: "qa_l2", channel: "linkedin_personal", status: "draft", title: "Why I stopped selling websites", pillar: "founder_story", generated_by: "claude", planned_for: at(2, 17).slice(0, 10), created_date: at(0, 10), body: "I stopped selling websites last year.\n\nNot because websites don't matter. Because owners kept telling me the site was fine and the business still ran on sticky notes.\n\nSo now we build the system first and the website second.\n\nMore on how that works over on the Interstellar Business OS page.\n\n#founder #smallbusiness" },
    { id: "qa_l3", channel: "linkedin_company", status: "posted", title: "Eight apps, one system", pillar: "pain_point", generated_by: "claude", planned_for: at(-1, 17).slice(0, 10), posted_at: at(-1, 18), posted_url: "https://www.linkedin.com/company/interstellar-business-os/", created_date: at(-3, 10), body: "Eight logins. Eight bills. Zero of them talk to each other." },
  ],
  SocialConversation: [],
  ...QA_ENGINE,
};

const QA_STATUS = {
  settings: { timezone: "America/Los_Angeles", default_times: ["09:00", "12:00"], post_weekends: false, max_per_day: 1, auto_facebook: false, facebook_page_id: "", facebook_page_name: "", ig_app_user_connector_id: "", paused: false },
  instagram: { connected: true, username: "interstellarstrategies", account_type: "BUSINESS", followers_count: 2, media_count: 0, quota: { usage: 0, total: 100, window_hours: 24 } },
  facebook: { connected: false, pages: [] },
};

/** Fake responses for social-publish / social-instagram in QA mode. Never publishes anything. */
export function qaSocialInvoke(name, args = {}) {
  if (name === "social-publish" && (args.action || "status") === "status") return QA_STATUS;
  if (name === "social-publish") return { ok: true, results: [], note: "QA mode: nothing was published" };
  if (name === "social-instagram") return { visible: false };
  if (name === "social-channels") return (args.action || "status") === "status" ? QA_CHANNELS_STATUS : { ok: true, results: [], note: "QA mode: nothing was published" };
  if (name === "social-clients") {
    return {
      connected: true, missing_scopes: ["instagram_basic", "instagram_manage_insights"],
      pages: [{ id: "p1", name: "Interstellar Strategies", via: "page_access", has_instagram: false }],
      accounts: [],
    };
  }
  return {};
}
