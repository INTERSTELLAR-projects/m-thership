// Social Studio brand rules: the single source the weekly Claude generator (docs/social-generator.md)
// and the in-app "Edit with AI" / "Generate variations" prompts read. Plain data, so a
// scheduled task can read this file as text and the app can import it.
// PRICES: the source of truth is Settings > Agency knowledge (AgencyKnowledge offers). BRAND.offers
// below is the fallback; liveOffers() and brandBrief() read the in-app prices first, and the Settings
// tab flags any mismatch.
import { offerPrice, offerByKey } from "@/features/agency/knowledge";

export const BRAND = {
  company: "Interstellar Strategies",
  app: "Møthership",
  slogan: "The Future of Business",
  website: "interstellar-strategies.com",
  founder: "Justin Cowell",
  audience:
    "Owners of small and mid-size service businesses (plumbing, HVAC, roofing, landscaping, cleaning, auto, salons, studios, clinics, contractors) who are busy, practical and allergic to tech jargon.",
  what_we_sell: [
    "Custom websites built to bring calls and booked jobs, not just look nice (Architect 2.1).",
    "One Command System (Ørigin 1.0): CRM, ERP, client portal and automations in one login, built around how the business actually runs.",
    "Local and AI search visibility: Google Business Profile, map pack, citations, reviews, and showing up in AI answers (AIO / GEO / AEO), managed under HyperCare+.",
  ],
  offers: {
    // Fallback copy of the AgencyKnowledge offer prices (same keys as the start-service catalog,
    // except hypercare_plus = orbit_local and gravitycare = starship_care).
    mission_alpha: { label: "Mission ALPHA", price: 8997, includes: ["Custom Website", "Command System", "Ops Command", "Brand Arsenal", "Launch Grid", "Transmission", "Intel Briefing (free)"] },
    mission_bravo: { label: "Mission BRAVO", price: 6497, includes: ["Custom Website", "Command System", "Intel Briefing (free)"] },
    custom_website: { label: "Custom Website", price: 4997 },
    command_system: { label: "Command System", price: 5997 },
    ops_command: { label: "Ops Command", price: 3000 },
    brand_arsenal: { label: "Brand Arsenal", price: 2500 },
    launch_grid: { label: "Launch Grid", price: 1400 },
    transmission: { label: "Transmission", price: 1500 },
    hypercare_plus: { label: "HyperCare+", price_from_monthly: 750 },
    gravitycare: { label: "GravïtyCare", price_monthly: 197 },
  },
  bonuses: [
    "Every build includes a free Intel Briefing: an audit before the build and a final sweep at the end.",
    "Clients get the portal tools for life: email signatures and QR codes.",
  ],
};

export const PAIN_POINTS = [
  { key: "app_pile", pain: "Paying for a pile of disconnected apps that don't talk to each other.", fix: "One Command System: CRM, scheduling, invoicing, portal and automations in one login." },
  { key: "spreadsheet_glue", pain: "Spreadsheets holding the whole business together.", fix: "Live records that update themselves, with every job, lead and invoice in one place." },
  { key: "quiet_website", pain: "A website that looks fine but doesn't bring calls.", fix: "A custom site built around one job: turning visitors into calls and booked work." },
  { key: "invisible", pain: "Invisible in the Google map pack and in AI answers.", fix: "Local and AI search work: profile, citations, reviews, schema and content that answers real questions." },
  { key: "owner_is_system", pain: "The owner is the system. Nothing moves unless you touch it.", fix: "Automations and a dashboard that run the routine so the business runs without you in every loop." },
  { key: "slow_follow_up", pain: "Missed leads and slow follow-up.", fix: "Every lead lands in one pipeline with instant follow-up and reminders." },
  { key: "no_reviews", pain: "No system for getting reviews.", fix: "Automatic review requests after every job, plus QR codes for the counter and the truck." },
  { key: "double_entry", pain: "Typing the same data into three places.", fix: "Enter it once. The system carries it to the quote, the invoice and the client portal." },
];

export const PILLARS = [
  { key: "pain_point", label: "Pain point", goal: "Name a pain the owner feels this week, in their words, then hint at the fix." },
  { key: "product_showcase", label: "Product showcase", goal: "Show the product UI doing one specific job. One idea per post." },
  { key: "proof_of_process", label: "Proof of process", goal: "Show how we work (audit, build, launch, care) without claiming results we can't prove." },
  { key: "education", label: "Education", goal: "Teach one useful thing about websites, local search, AI answers or operations." },
  { key: "offer", label: "Offer", goal: "Present a real offer with real prices from BRAVO/ALPHA. Never invent discounts or deadlines." },
  { key: "founder_story", label: "Founder story", goal: "Justin's point of view as a founder building the future of business. First person, plain, no hype." },
];

export const VOICE = {
  tone: [
    "Confident, plain and specific. Talk like an operator, not a marketer.",
    "Short sentences. One idea per post.",
    "Name the pain in the owner's words before naming the fix.",
    "Product names are allowed (Command System, Møthership, HyperCare+) but never lead with jargon.",
  ],
  rules: [
    "Never invent client results, statistics, case studies, testimonials or reviews.",
    "Any number that is not a real, sourced figure must be clearly labeled hypothetical or sample (the templates show a 'Sample data' tag on mock UI; big_stat must set hypothetical: true unless a source is given in note).",
    "Mock UI uses fictional businesses only (e.g. Ridgeline Plumbing, Summit Air HVAC, Cedar & Stone Landscaping, Bayview Roofing, Lakeside Electric). Never real client names or real client numbers.",
    "No emoji strings, in the image or the caption.",
    "Brand gradient is orange (#ff3c00 → #ff6a00 → #ffaa00). Never gold.",
    "The slogan is exactly \"The Future of Business\".",
    "Prices only from BRAVO/ALPHA offers in this file; no invented discounts, deadlines or scarcity.",
    "Captions are short and punchy: a keyword-first hook line (see SEARCH rules), two to four short lines, a clear call to action, then 3 to 5 relevant hashtags (Instagram caps posts at 5).",
    "Hooks follow the Triple Hook Method (HOOKS below): context line with the search phrase, then lean, then a contrarian snapback. No invented stats in hooks.",
    "LinkedIn caption: same idea, slightly longer and more reflective, 3 to 5 hashtags, no hashtag walls.",
    "Never post to social media, approve or schedule anything. Generated posts are drafts (status draft); only Justin approves and schedules them in Møthership.",
  ],
  cta_examples: [
    "Book a free strategy call",
    "Link in bio",
    "See the Command System",
    "DM us \"SYSTEM\"",
    "Get your free Intel Briefing",
  ],
  hashtag_bank: [
    "#smallbusiness", "#servicebusiness", "#businessowner", "#localseo", "#googlebusinessprofile",
    "#websitedesign", "#crm", "#automation", "#businesssystems", "#aisearch", "#entrepreneur",
    "#contractors", "#homeservices", "#operations", "#interstellarstrategies",
  ],
  banned_words: ["synergy", "game-changer", "revolutionary", "unlock", "skyrocket", "guaranteed results", "10x"],
};

// Social search (social SEO) rules: every generated post is written to be FOUND in Instagram / TikTok /
// YouTube / LinkedIn search and in Google (public pro Instagram posts are indexed since July 2025).
// Sourced playbook: Settings > Agency knowledge, section "social_search" (AgencyKnowledge key social_search).
export const SEARCH = {
  rules: [
    "Keyword-first hook: the first caption line (and the first on-screen words) uses the phrase an owner would actually type into search, e.g. \"How to get more Google reviews\", not \"Big news!\".",
    "Pick ONE primary search phrase per post (from SEARCH.keywords or a close variant) and use it plus at most one secondary keyword naturally in the caption. Never keyword-stuff.",
    "alt_text describes what is actually in the image AND names the topic keyword, one sentence, under ~125 characters (e.g. \"Dashboard mockup showing a CRM for a plumbing business with jobs, invoices and reviews in one view\").",
    "Hashtags: 3 to 5, specific and relevant (topic + niche + #interstellarstrategies). No generic walls (#love #instagood), never more than 5.",
    "On-image text states the topic plainly (the headline is the search phrase or a direct answer), not a teaser.",
    "Reels / Shorts / TikTok scripts: say the primary keyword out loud in the first 3 seconds, show it as on-screen text, keep burned-in captions on; YouTube Shorts title = the search phrase.",
    "Brand naming is identical everywhere: \"Interstellar Strategies\" (never Interstellar Strategy / IS / Interstellar Digital), product names exactly as in BRAND/offers.",
    "Answer-style posts beat announcements: how-to, checklist, myth vs fact, cost/what-to-expect. Give people a reason to save or send the post.",
    "Original content only: no reposted clips, no third-party watermarks.",
  ],
  // Starting search phrases our audience types (validate in Instagram/TikTok search suggestions; not volume data).
  keywords: [
    "website design for small business", "website for contractors", "local SEO for service business", "how to rank in Google Maps",
    "Google Business Profile tips", "how to get more Google reviews", "CRM for small business", "CRM for contractors",
    "small business automation", "show up in AI search", "get found on ChatGPT", "why my website gets no calls",
  ],
};

// Hook framework (Settings > Agency knowledge, section "hooks"; AgencyKnowledge key hooks). Every generator opens
// posts, Reels/Shorts/TikTok scripts and YouTube scripts with it, combined with the keyword-first SEARCH rule.
export const HOOKS = {
  name: "Triple Hook Method",
  source: "Kallaway, \"Triple Hook Method\" — https://www.instagram.com/p/DfQ5RxHjg1S/",
  steps: [
    { key: "context", label: "Context", rule: "The first line immediately establishes what the post/video is about: say it in audio, show it on screen, write it in the caption, ideally all three aligned. It contains the post's search phrase (keyword-first). Delaying context, even to the end of the first sentence, raises skip rate (the author's claim)." },
    { key: "lean", label: "Lean", rule: "Create curiosity in a direction so the viewer leans in and wants more (open the curiosity loop)." },
    { key: "snapback", label: "Contrarian snapback", rule: "Then pull the viewer the other way: a turn or contrast (\"but here's the thing…\") that snaps them down an unexpected path, like setting a fish hook." },
  ],
  test: "Read the first 1-2 sentences alone: is the context clear AND is there something that makes you want to hear more?",
  rules: [
    "Open with context, then lean, then the contrarian snapback. Never a vague teaser first.",
    "The context line contains the primary search phrase (social search: keyword-first).",
    "No invented statistics or results in hooks. A number in a hook must be real and sourced, or the hook is rewritten without it.",
  ],
};

/** Hook framework text for AI prompts. Prefers the AgencyKnowledge "hooks" section when it is passed in. */
export function hookBrief(section) {
  const d = section?.data || {};
  const steps = Array.isArray(d.steps) && d.steps.length ? d.steps : HOOKS.steps;
  const rules = Array.isArray(d.rules) && d.rules.length ? d.rules : HOOKS.rules;
  return [
    `Hook framework: ${d.name || HOOKS.name} (${d.source || HOOKS.source}). Every post and script opens with it:`,
    ...steps.map((s, i) => `${i + 1}. ${String(s.label || s.key).toUpperCase()}: ${s.rule}`),
    `Test: ${d.test || HOOKS.test}`,
    ...rules.map((r) => `- ${r}`),
  ].join("\n");
}

// draft -> approved (scheduled) -> publishing -> posted | failed; declined. Only Justin approves.
export const STATUSES = [
  { key: "draft", label: "Draft" },
  { key: "approved", label: "Scheduled" },
  { key: "publishing", label: "Publishing" },
  { key: "posted", label: "Posted" },
  { key: "failed", label: "Failed" },
  { key: "declined", label: "Declined" },
];

export const PLATFORMS = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "x", label: "X" },
  { key: "tiktok", label: "TikTok" },
];

// Offer key here -> AgencyKnowledge offer key.
export const OFFER_KEY_MAP = { hypercare_plus: "orbit_local", gravitycare: "starship_care" };

// BRAND.offers with prices from Agency knowledge (fallback: the values above).
export function liveOffers() {
  return Object.fromEntries(Object.entries(BRAND.offers).map(([k, o]) => {
    const ak = OFFER_KEY_MAP[k] || k;
    const fallback = o.price ?? o.price_from_monthly ?? o.price_monthly ?? 0;
    const price = offerPrice(ak, fallback);
    const field = o.price != null ? "price" : o.price_from_monthly != null ? "price_from_monthly" : "price_monthly";
    const live = offerByKey(ak);
    return [k, { ...o, [field]: price, ...(live && Array.isArray(live.includes) && live.includes.length ? { includes: live.includes } : {}) }];
  }));
}

const offersText = () => Object.values(liveOffers()).map((o) => `${o.label}: $${Number(o.price ?? o.price_from_monthly ?? o.price_monthly).toLocaleString("en-US")}${o.price_from_monthly != null ? "/mo and up" : o.price_monthly != null ? "/mo" : ""}`).join("; ");

// Compact text the AI prompts embed.
export function brandBrief() {
  return [
    `Real offer prices (use only these, exactly): ${offersText()}`,
    `Company: ${BRAND.company}. Slogan: "${BRAND.slogan}". Audience: ${BRAND.audience}`,
    `What we sell:\n- ${BRAND.what_we_sell.join("\n- ")}`,
    `Pain points we speak to:\n- ${PAIN_POINTS.map((p) => `${p.pain} -> ${p.fix}`).join("\n- ")}`,
    `Voice:\n- ${VOICE.tone.join("\n- ")}`,
    `Hard rules:\n- ${VOICE.rules.join("\n- ")}`,
    `Search rules (social SEO):\n- ${SEARCH.rules.join("\n- ")}\nStarting search phrases: ${SEARCH.keywords.join("; ")}`,
    hookBrief(),
    `Avoid words: ${VOICE.banned_words.join(", ")}`,
  ].join("\n\n");
}
