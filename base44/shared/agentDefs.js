// Agent Constellation definitions (backend copy of src/features/agents/defs.js; keep both identical).
// sections. Used by the agents backend function to build per-client instances.
// KEEP BOTH FILES IDENTICAL: the agents backend function builds client instances from the same template.

export const INTERSTELLAR_DEPTS = [
  { key: "command", label: "Command", code: "CMD", blurb: "Commander and the systems that run the agency every day." },
  { key: "research", label: "Research & Intelligence", code: "INT", blurb: "Watches search, social, ads, AI and the market; feeds every other department." },
  { key: "sales", label: "Sales & Deals", code: "SAL", blurb: "Leads in, calls booked, proposals out, deals closed." },
  { key: "marketing", label: "Marketing", code: "MKT", blurb: "Social, content and blogs, SEO and AI search, ads, email, video." },
  { key: "delivery", label: "Client Delivery & Ops", code: "OPS", blurb: "Builds, onboarding, portal, map packs and the client systems we run." },
  { key: "success", label: "Client Success", code: "CSX", blurb: "Nøva, reviews, reporting and keeping every client healthy." },
  { key: "backoffice", label: "Back Office", code: "BKO", blurb: "Accounting and taxes, billing, hiring, legal and contracts." },
  { key: "systems", label: "Systems & Security", code: "SYS", blurb: "Email authentication, usage caps, integrations and AI plumbing." },
];

export const CLIENT_DEPTS = [
  { key: "research", label: "Research", code: "RES", blurb: "Competitors, search landscape and industry signals for this client only." },
  { key: "seo", label: "SEO & AI Search", code: "SEO", blurb: "Blogs, GBP posts, keywords, Search Console, map pack and local pages." },
  { key: "social", label: "Social", code: "SOC", blurb: "Social plan, post drafts and Instagram results." },
  { key: "ads", label: "Ads", code: "ADS", blurb: "Paid campaigns: read, recommend, never spend without approval." },
  { key: "email", label: "Email", code: "EML", blurb: "Marketing email through the client's own verified domain." },
  { key: "reviews", label: "Reviews & Reputation", code: "REV", blurb: "Google reviews feed, replies and review requests." },
  { key: "website", label: "Website Care", code: "WEB", blurb: "Site QA, speed, audits and uptime." },
  { key: "reporting", label: "Reporting", code: "RPT", blurb: "Monthly report and the client-facing portal assistant." },
  { key: "ops", label: "Client App Automations", code: "APP", blurb: "Workflows running inside the client's own Base44 systems." },
];

// Standard per-client agent set. Every active client gets one instance of each (key `<template>:<clientId>`).
// Status is derived from real data by the agents function (sync_clients); nothing here claims an agent is live.
export const CLIENT_TEMPLATES = [
  { key: "client_ceo", department: "ceo", name: "Client CEO", kind: "in_app_ai", autonomy_target: "assisted", role: "Answers Justin about this client: what its agents did, what is stuck, what needs his approval. Grounded only in this client's brain and agent runs.", replaces: "Digging through records before a client call", reads: ["brain", "runs"], writes: [], kpis: ["Questions answered from records", "Approvals surfaced"] },
  { key: "brain_keeper", department: "brain", name: "Brain keeper", kind: "backend_function", autonomy_target: "autonomous", role: "Merges agent and research findings into the client's Business Brain nightly, dedupes, flags contradictions for Justin and rewrites the one-screen summary.", replaces: "Keeping a client file up to date by hand", reads: ["brain", "research_notes", "learnings"], writes: ["brain"], kpis: ["Brain completeness %", "Open conflicts"] },
  { key: "client_research", department: "research", name: "Competitor & search research", kind: "claude_scheduled_task", autonomy_target: "autonomous", role: "On a rotation, researches this client's competitors, search results and industry with real sources and files ResearchNotes for its agents.", replaces: "Manual competitor checks", reads: ["brain"], writes: ["research_notes", "brain_pending"], kpis: ["Sourced notes per month"] },
  { key: "customer_voice", department: "research", name: "Customer voice miner", kind: "claude_scheduled_task", autonomy_target: "assisted", role: "Turns real reviews, DMs and emails into FAQs, objections and content ideas.", replaces: "Guessing what customers ask", reads: ["brain", "reviews"], writes: ["brain_pending"], kpis: ["FAQs sourced from real questions"] },
  { key: "seo_blog", department: "seo", name: "Blog + GBP posts", kind: "claude_scheduled_task", autonomy_target: "assisted", role: "Writes the client's blog delivery package and matching Google Business Profile posts on schedule. Justin approves and publishes.", replaces: "Content writer + GBP manager", reads: ["brain", "live_site"], writes: ["chat_package"], kpis: ["Posts delivered on schedule", "Posts verified live"] },
  { key: "keyword_steward", department: "seo", name: "Keyword steward", kind: "claude_scheduled_task", autonomy_target: "autonomous", role: "Monthly: maintains the client's keyword map and service area in the dossier from real data only.", replaces: "SEO keyword research", reads: ["dossier", "live_site", "worklog"], writes: ["dossier"], kpis: ["Keywords mapped to pages"] },
  { key: "search_console", department: "seo", name: "Search Console watch", kind: "claude_scheduled_task", autonomy_target: "assisted", role: "Weekly indexing and coverage check, requests indexing within quota and reports real-page problems.", replaces: "Weekly GSC review", reads: ["gsc", "sitemap"], writes: ["report"], kpis: ["Real pages not indexed"] },
  { key: "map_pack", department: "seo", name: "Map pack & citations", kind: "manual_skill", autonomy_target: "assisted", role: "Plans and tracks the Google map pack: categories, service areas, citations and rank grids.", replaces: "Local SEO specialist", reads: ["brain", "gbp"], writes: ["map_pack_plan"], kpis: ["Map pack rank", "Citations consistent"] },
  { key: "local_pages", department: "seo", name: "City & project pages", kind: "claude_scheduled_task", autonomy_target: "assisted", role: "Publishes city / service-area and finished-project pages from real submissions.", replaces: "Page-by-page local SEO build-out", reads: ["brain", "submissions"], writes: ["website"], kpis: ["Local pages live"] },
  { key: "social_plan", department: "social", name: "Social plan", kind: "manual_skill", autonomy_target: "assisted", role: "Builds the client's social search plan (pillars, hooks, keywords) for Justin's approval.", replaces: "Social strategist", reads: ["brain", "research_notes"], writes: ["social_plan"], kpis: ["Plan approved"] },
  { key: "social_posts", department: "social", name: "Post drafts", kind: "in_app_ai", autonomy_target: "assisted", role: "Drafts the client's weekly posts from the approved plan. Drafts only.", replaces: "Social content creator", reads: ["social_plan", "brain"], writes: ["drafts"], kpis: ["Drafts approved"] },
  { key: "social_insights", department: "social", name: "Instagram results", kind: "base44_workflow", autonomy_target: "autonomous", role: "Daily read-only sync of the client's Instagram followers, reach and posts for reports.", replaces: "Pulling screenshots for reports", reads: ["instagram"], writes: ["report_numbers"], kpis: ["Days synced"] },
  { key: "ads_optimizer", department: "ads", name: "Ads optimizer", kind: "base44_workflow", autonomy_target: "assisted", role: "Reads real ad performance and proposes changes for approval. Never spends or launches by itself.", replaces: "Media buyer check-ins", reads: ["ad_metrics", "learnings"], writes: ["recommendations"], kpis: ["CPL", "Approved recommendations"] },
  { key: "email_marketing", department: "email", name: "Email marketing", kind: "in_app_ai", autonomy_target: "assisted", role: "Drafts campaigns in the client's voice and sends only what was approved, through their verified domain.", replaces: "Email marketer", reads: ["brain", "lists"], writes: ["campaigns"], kpis: ["Open rate", "Unsubscribes"] },
  { key: "reviews_feed", department: "reviews", name: "Google reviews feed", kind: "backend_function", autonomy_target: "autonomous", role: "Serves the client's live Google rating and reviews to their website (Stärboard), refreshed at most daily.", replaces: "Manually updating review widgets", reads: ["google_places"], writes: ["website_feed"], kpis: ["Rating", "Review count"] },
  { key: "review_replies", department: "reviews", name: "Review replies", kind: "in_app_ai", autonomy_target: "assisted", role: "Drafts a reply to every new review in the client's voice within 1 hour (the promise to clients); replies post after approval.", replaces: "Owner replying to reviews", reads: ["reviews", "brain"], writes: ["drafts"], kpis: ["Reply rate", "Reply time"] },
  { key: "review_requests", department: "reviews", name: "Review requests", kind: "base44_workflow", autonomy_target: "autonomous", role: "Asks every finished customer for a review automatically after the job.", replaces: "Remembering to ask for reviews", reads: ["jobs"], writes: ["requests"], kpis: ["Reviews per month"] },
  { key: "site_audit", department: "website", name: "Speed & SEO audit", kind: "backend_function", autonomy_target: "assisted", role: "PageSpeed + on-page checks on the live site (read-only), flagged on the Command Briefing.", replaces: "Manual site QA", reads: ["live_site"], writes: ["site_audit"], kpis: ["Health score"] },
  { key: "intel_audit", department: "website", name: "Intel audit", kind: "manual_skill", autonomy_target: "assisted", role: "Deep audit of site, GBP and listings that files gaps for Justin's approval.", replaces: "Agency audit", reads: ["live_site", "gbp", "brain"], writes: ["client_gaps"], kpis: ["Gaps found / fixed"] },
  { key: "uptime_watch", department: "website", name: "Uptime & forms watch", kind: "backend_function", autonomy_target: "autonomous", role: "Checks the site and its lead forms are up and alerts Justin when something breaks.", replaces: "Finding out from the client", reads: ["live_site"], writes: ["alerts"], kpis: ["Downtime minutes"] },
  { key: "monthly_report", department: "reporting", name: "Monthly report", kind: "claude_scheduled_task", autonomy_target: "assisted", role: "Writes the client's monthly results report from real numbers only, for Justin to send.", replaces: "Report building", reads: ["brain", "runs", "metrics"], writes: ["report"], kpis: ["Reports on time"] },
  { key: "nova", department: "reporting", name: "Nøva portal assistant", kind: "in_app_ai", autonomy_target: "autonomous", role: "The client's portal assistant: daily briefing card, requests and quick facts for their own account only.", replaces: "Answering status questions", reads: ["portal_records"], writes: ["requests"], kpis: ["Questions answered", "Hand-offs"] },
];

export const TEMPLATE_BY_KEY = Object.fromEntries(CLIENT_TEMPLATES.map((t) => [t.key, t]));

// Business Brain sections (client and Interstellar). Completeness is measured over all 14.
export const BRAIN_SECTIONS = [
  { key: "overview", label: "Overview", hint: "What the business is, who owns it, where it operates." },
  { key: "offer_pricing", label: "Offer & pricing", hint: "What they sell and what it costs. Only published or confirmed prices." },
  { key: "audience", label: "Audience / avatar", hint: "Who buys, why, objections." },
  { key: "brand", label: "Brand", hint: "Colors, fonts, voice, taglines, logo locations." },
  { key: "contacts_channels", label: "Contacts & channels", hint: "People, emails, phones, social profiles." },
  { key: "website_logins", label: "Website & where logins live", hint: "Platform, domain, app ids, where each login is held. Never passwords." },
  { key: "gbp_listings", label: "GBP & listings", hint: "Google Business Profile, Bing, Apple, citations, reviews." },
  { key: "content", label: "Content history & schedule", hint: "Blog cadence, categories, what is live, social plan." },
  { key: "apps_systems", label: "Apps & systems", hint: "What we built and what they use." },
  { key: "billing", label: "Billing", hint: "What Interstellar bills, what the client pays for tools." },
  { key: "goals", label: "Goals", hint: "Stated goals and 2027 targets." },
  { key: "problems", label: "Problems & gaps", hint: "What is broken or missing right now." },
  { key: "competitors", label: "Competitors", hint: "Named competitors with strengths and weaknesses." },
  { key: "decisions", label: "Decisions log", hint: "Decisions made and why (dated)." },
];
export const BRAIN_SECTION_KEYS = BRAIN_SECTIONS.map((s) => s.key);

const UNKNOWN_RE = /^\s*(unknown|n\/a|none|tbd)\.?\s*$/i;
// 1 = solid, 0.5 = thin or low confidence, 0 = empty / unknown.
export function sectionScore(sec) {
  const text = String((sec && sec.text) || "").trim();
  if (!text || UNKNOWN_RE.test(text) || (sec && sec.confidence === "unknown")) return 0;
  if (text.length < 60 || (sec && sec.confidence === "low")) return 0.5;
  return 1;
}
export function brainCompleteness(sections) {
  const s = sections || {};
  const total = BRAIN_SECTION_KEYS.reduce((sum, k) => sum + sectionScore(s[k]), 0);
  return Math.round((total / BRAIN_SECTION_KEYS.length) * 100);
}
