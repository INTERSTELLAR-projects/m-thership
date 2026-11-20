// Identical copy of src/lib/unlocks.js for backend functions. tests/unit/unlocks.test.js checks they match.
// Brain unlocks (Build Engine, Nov 19 2026: Mission ALPHA running itself). Identical copy in base44/shared/unlocks.js.
// Each unlock is driven by REAL Brain completeness: the client criteria (src/features/clients/criteria.js) plus a few
// system facts (site live, Command System live, processes set, brand kit delivered). Each one lists exactly what is
// missing, and has a client-facing line for the portal. When an unlock turns on, the brain-unlocks backend prepares its
// work: plans and drafts only. Blog, GBP and citation POSTING stays OFF (Justin's rule); nothing is published or sent.

export const UNLOCKS = [
  {
    key: "basics",
    label: "Business basics",
    needs: ["public_name", "nap_address", "nap_phone", "hours", "services", "service_areas"],
    national_needs: ["public_name", "nap_phone", "services"],
    gives: "Launch grid starts: the directory list for this niche, each listing's state, and a NAP checklist for the missing ones.",
    portal_on: "Your launch grid is under way.",
    portal_off: "Your launch grid starts when we have your {missing}.",
  },
  {
    key: "brand",
    label: "Brand design",
    needs: ["logo", "colors", "fonts", "voice"],
    gives: "Social posts drafted in their style (Social Studio, drafts only) and email signature options to pick in the portal.",
    portal_on: "Your social engine and email signature options are ready.",
    portal_off: "Your social engine unlocks when we have your {missing}.",
  },
  {
    key: "growth",
    label: "Search & content",
    needs: ["keywords", "services", "competitors", "service_areas"],
    national_needs: ["keywords", "services", "competitors"],
    gives: "A foundational SEO step list and the blog engine set up at the chosen frequency. Posting blogs, GBP and citations stays off; this prepares the plan and drafts.",
    portal_on: "Your search plan and blog schedule are set up.",
    portal_off: "Your search plan unlocks when we have your {missing}.",
  },
  {
    key: "transmission",
    label: "Transmission",
    needs: [],
    facts: ["website_live", "command_live", "processes_set", "brand_kit_delivered"],
    gives: "Transmission videos queued; finished videos are stored in the client's portal.",
    portal_on: "Your Transmission videos are in production.",
    portal_off: "Your Transmission videos start when {missing}.",
  },
];

export const FACT_LABEL = {
  website_live: "your website is live",
  command_live: "your Command System is live",
  processes_set: "your processes are set",
  brand_kit_delivered: "your brand kit is delivered",
};

// Criteria labels written for the client ("your brand colors", not "Brand colors").
const CLIENT_WORDS = {
  public_name: "business name", nap_address: "address", nap_phone: "phone number", hours: "hours", services: "services",
  service_areas: "service area", logo: "logo", colors: "brand colors", fonts: "fonts", voice: "brand voice",
  keywords: "keywords or topics", competitors: "competitors",
};

export function isNational(client) {
  const c = client || {};
  if (c.market_scope) return c.market_scope === "national" || c.market_scope === "global";
  return /\b(national|nationwide|global|online|ecommerce|e-commerce)\b/i.test(String((c.scrape_summary || {}).market || ""));
}

const joinWords = (arr) => (arr.length <= 1 ? arr.join("") : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`);

// items: evaluateCriteria(ctx).items (each {key, label, filled}). facts: {website_live, command_live, processes_set,
// brand_kit_delivered}. national: national/global client (keywords → topics, no NAP address or service area needed).
export function evaluateUnlocks(items, facts = {}, national = false) {
  const byKey = new Map((items || []).map((i) => [i.key, i]));
  return UNLOCKS.map((u) => {
    const need = national && u.national_needs ? u.national_needs : u.needs;
    const missingCriteria = need.filter((k) => !(byKey.get(k) && byKey.get(k).filled));
    const missingFacts = (u.facts || []).filter((f) => !facts[f]);
    const missing = [
      ...missingCriteria.map((k) => ({ key: k, label: (byKey.get(k) && byKey.get(k).label) || k, client: CLIENT_WORDS[k] || k })),
      ...missingFacts.map((f) => ({ key: f, label: FACT_LABEL[f], client: FACT_LABEL[f], fact: true })),
    ];
    const total = need.length + (u.facts || []).length;
    const on = missing.length === 0;
    const missingText = joinWords(missing.map((m) => (m.fact ? m.client : `${m.client}`)));
    const portal = on ? u.portal_on : u.portal_off.replace("{missing}", missingText);
    return { key: u.key, label: u.label, gives: u.gives, on, missing, done: total - missing.length, total, portal };
  });
}

// Foundational SEO steps prepared by the growth unlock (a plan, not posting).
export function seoSteps(national) {
  const local = [
    "Confirm the main keyword per service page and per service-area page (from the Brain's keywords)",
    "Titles, meta descriptions and one H1 per page mapped to those keywords",
    "LocalBusiness schema with the exact NAP; FAQPage where there are FAQs",
    "Google Business Profile categories and services match the site (proposal only)",
    "Internal links: every service page links to its areas and back",
    "Search Console + Bing verified; sitemap submitted (after the domain is live)",
    "Competitor gap list: the pages competitors rank with that this site lacks",
    "Blog topic calendar for the chosen frequency (drafts only; posting stays off)",
  ];
  const nat = [
    "Topic clusters from the Brain's keywords/topics, one pillar page per cluster",
    "Titles, meta descriptions and one H1 per page mapped to those topics",
    "Organization and Product/Service schema; FAQPage where there are FAQs",
    "Shopping feed / review site readiness list (proposal only)",
    "Internal links from every article to its pillar page",
    "Search Console + Bing verified; sitemap submitted (after the domain is live)",
    "Competitor gap list: the topics competitors rank for that this site lacks",
    "Blog topic calendar for the chosen frequency (drafts only; posting stays off)",
  ];
  return (national ? nat : local).map((label, i) => ({ key: `seo_${i + 1}`, label, done: false }));
}

export const BLOG_FREQUENCIES = ["weekly", "2_per_month", "monthly"];
export const DEFAULT_BLOG_FREQUENCY = "2_per_month";
