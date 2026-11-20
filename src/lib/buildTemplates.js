// Build Engine step 4: build checklist templates per niche (identical copy in base44/shared/buildTemplates.js).
// Each template has two tracks: Website and Command System. Every item says whether Claude does it (auto) or it
// needs a person (manual), and how it reads to the client in the portal (client_label; empty = internal only).
// gate: "taste" = Justin's look-and-feel call; "publish" = Justin's tap (deploy); "dns" = Justin's tap that connects the
// client's own domain. Connecting the domain is ALWAYS the last Website step and is what makes the site live (Justin,
// Nov 19 2026): everything before it runs on the base44.app address. The runner never does gates.
// The BuildChecklistTemplate entity holds the editable copy; these are the defaults it is seeded from.
// v3 (Nov 19 2026): LINKED APPS. A client's website and Command System are linked, and Claude wires both links itself:
//   1. Website forms -> Command System: the website's server forwards every quote/contact request to the Command app's
//      backend function websiteIntake (signed: x-intake-key; secrets WEBSITE_INTAKE_KEY on Command = COMMAND_INTAKE_KEY
//      + COMMAND_INTAKE_URL on the website). Same pattern as VSRL's websiteLead.
//   2. Approved photos -> website gallery as DRAFTS: photos the owner approves in the Command System (or that are
//      approved in Interstellar's portal flow) go to the website's backend function projectPhoto (signed: x-photo-key =
//      PHOTO_FEED_KEY on both; WEBSITE_PHOTO_URL on Command). Capture only: auto-publish stays off; the page shows
//      published photos only. Reference build: the [TEST] Summit Ridge Landscaping website + Command System.
// v4 (Nov 19 2026): SELF-SERVE SEASONS + OFFERS. The site reads a SiteSeason config (banner, accent, featured section)
//   and live offers from Møthership's public site-config function by the client's site_key (CRMClient.site_key), and
//   falls back to its normal look when nothing is on. The client switches them in the portal. Checkout discounts for
//   offers are a money hard gate (Justin's tap), never part of the build.

export const NICHE_KEYS = ["home_service", "fitness_coach", "retail_streetwear", "food_bev", "other"];
export const NICHE_LABEL = { home_service: "Home service", fitness_coach: "Fitness coach", retail_streetwear: "Retail / streetwear", food_bev: "Food & beverage", other: "Other" };
export const TEMPLATE_VERSION = 4;
export const DOMAIN_TOKEN = "<domain>";

const I = (key, label, auto, client_label = "", group = "", gate = "") => ({ key, label, auto, client_label, group, gate });

// Website pages per niche (the "pages" group).
const PAGES = {
  home_service: [
    I("page_home", "Home page: answer-first hero, services, service area, reviews, quote CTA", true, "Your homepage", "pages"),
    I("page_services", "One page per core service (from the Brain's service list)", true, "Your service pages", "pages"),
    I("page_areas", "Service-area pages for core cities (real cities from the Brain only)", true, "Your service-area pages", "pages"),
    I("page_projects", "Projects / gallery (real photos only; placeholder section if none yet)", true, "Your project gallery", "pages"),
    I("page_about", "About + reviews page", true, "Your about page", "pages"),
    I("page_quote", "Contact / request-a-quote page", true, "Your quote page", "pages"),
    I("page_faq", "FAQ page with FAQPage schema (answers from the Brain only)", true, "Your FAQ", "pages"),
  ],
  fitness_coach: [
    I("page_home", "Home page: who it's for, outcome, programs, apply CTA", true, "Your homepage", "pages"),
    I("page_programs", "Coaching programs pages (real offers only, no invented prices)", true, "Your program pages", "pages"),
    I("page_results", "Results / transformations (only real, permitted client results)", false, "Your results page", "pages"),
    I("page_about", "About the coach", true, "Your about page", "pages"),
    I("page_apply", "Apply / book a consult funnel", true, "Your application page", "pages"),
    I("page_faq", "FAQ with FAQPage schema", true, "Your FAQ", "pages"),
    I("page_blog", "Blog index ready for the growth engine", true, "Your blog", "pages"),
  ],
  retail_streetwear: [
    I("page_home", "Home page: brand story hero, current drop, featured products", true, "Your homepage", "pages"),
    I("page_shop", "Shop / collections pages", true, "Your shop", "pages"),
    I("page_product", "Product page template with Product schema (real products only)", true, "Your product pages", "pages"),
    I("page_drops", "Drops / lookbook page", true, "Your drops page", "pages"),
    I("page_about", "Brand story / about", true, "Your brand story", "pages"),
    I("page_size", "Size guide", false, "Your size guide", "pages"),
    I("page_policies", "Shipping, returns and contact pages (owner confirms policy text)", false, "Your shipping & returns pages", "pages"),
  ],
  food_bev: [
    I("page_home", "Home page: hero, hours, location, menu highlights, order CTA", true, "Your homepage", "pages"),
    I("page_menu", "Menu page (HTML, not a PDF; real items and prices from the owner only)", true, "Your menu", "pages"),
    I("page_order", "Order online / catering request page", true, "Your ordering page", "pages"),
    I("page_location", "Locations & hours page with map", true, "Your location page", "pages"),
    I("page_about", "About / story", true, "Your about page", "pages"),
    I("page_rewards", "Events / rewards page", true, "Your rewards page", "pages"),
    I("page_gallery", "Gallery (real photos only)", true, "Your photo gallery", "pages"),
  ],
  other: [
    I("page_home", "Home page", true, "Your homepage", "pages"),
    I("page_offer", "Services / offer pages", true, "Your service pages", "pages"),
    I("page_about", "About page", true, "Your about page", "pages"),
    I("page_proof", "Proof: reviews, case studies (real only)", true, "Your reviews page", "pages"),
    I("page_contact", "Contact page", true, "Your contact page", "pages"),
    I("page_faq", "FAQ with FAQPage schema", true, "Your FAQ", "pages"),
  ],
};

const WEBSITE_COMMON = [
  I("content_copy", "All copy written from the Brain and scrape (nothing invented; gaps marked for the owner)", true, "Your website copy", "content"),
  I("design_defaults", "Visual direction: colors, fonts, imagery left as on-brand defaults and listed for Justin", false, "", "content", "taste"),
  I("nap_schema", "NAP consistent everywhere + LocalBusiness/Organization schema, sameAs links", true, "Google-ready business details", "nap_schema"),
  I("forms", "Forms (quote/contact/booking) with spam protection, saved on the site", true, "Your contact and quote forms", "forms"),
  I("link_forms", "Linked apps: every form submission also posts into this client's Command System (server-side forwardToCommand -> Command function websiteIntake, signed x-intake-key; secrets set by name on both apps; checked with one [TEST] lead)", true, "Your forms feed your Command System", "forms"),
  I("link_gallery", "Linked apps: projects/gallery takes approved photos as DRAFTS (function projectPhoto, signed x-photo-key; image copied to site storage; page shows published only; auto-publish off; checked with one [TEST] photo)", true, "", "pages"),
  I("site_season", "Seasons: the site reads its SiteSeason config (site-config function, by site_key) for the banner, accent and featured section; off = normal look; fails soft", true, "Seasonal looks you switch on yourself", "content"),
  I("site_offers", "Offers: live offers from site-config show as a banner/section between their dates (no checkout change; discounts are Justin's tap)", true, "Offers you run yourself", "content"),
  I("seo_basics", "SEO basics: unique titles/meta, one H1, sitemap, robots, canonicals, internal links, alt text, prerendered routes", true, "Search-engine setup", "seo"),
  I("speed", "Speed pass: compressed images, lazy loading, good LCP/CLS", true, "Fast loading on phones", "speed"),
  I("security", "Security check: no secrets in code, admin-only data, rate limits on public functions", true, "", "security"),
  I("analytics", "Analytics + Search Console: connect GA4 and verify Search Console (needs Justin's account access)", false, "Visitor tracking", "analytics"),
  I("preview_review", "Preview link ready for Justin's look-over", true, "Preview ready", "launch"),
  I("publish_site", "Publish on the base44.app address (Justin's tap: Ready to publish)", false, "Your site is up for a final look", "launch", "publish"),
  // Always last. Live = this domain connected AND verified (custom-domains status "verified").
  I("connect_domain", "Connect <domain> (hard gate: DNS — Justin taps; the site is live when the domain verifies)", false, "Your website is live", "launch", "dns"),
];

// Command System modules per niche.
const MODULES = {
  home_service: [
    I("mod_leads", "Leads & quote requests inbox (from the website forms)", true, "Lead inbox", "modules"),
    I("mod_estimates", "Estimates / quotes builder (no invented prices; owner's price list)", true, "Estimates", "modules"),
    I("mod_jobs", "Jobs & scheduling calendar", true, "Job schedule", "modules"),
    I("mod_crew", "Crew & daily tasks", true, "Crew tasks", "modules"),
    I("mod_customers", "Customers & properties", true, "Customer list", "modules"),
    I("mod_invoices", "Invoices & payments tracking (records only; no charging)", true, "Invoices", "modules"),
    I("mod_reviews", "Review requests after a finished job (drafts; owner sends)", true, "Review requests", "modules"),
    I("mod_photos", "Job photos: upload, caption, approve with \"Use on website\"", true, "Project photos to your site", "modules"),
  ],
  fitness_coach: [
    I("mod_clients", "Clients & intake forms", true, "Client list", "modules"),
    I("mod_programs", "Programs & weekly check-ins", true, "Check-ins", "modules"),
    I("mod_nutrition", "Nutrition / meal plans", true, "Meal plans", "modules"),
    I("mod_progress", "Progress tracking (weights, photos, measurements)", true, "Progress tracking", "modules"),
    I("mod_payments", "Plans & payment status (records only)", true, "Plans & payments", "modules"),
    I("mod_messages", "Coach ↔ client messages", true, "Messages", "modules"),
  ],
  retail_streetwear: [
    I("mod_products", "Products & inventory", true, "Products & stock", "modules"),
    I("mod_drops", "Drops calendar", true, "Drop calendar", "modules"),
    I("mod_orders", "Orders & fulfilment tracking", true, "Orders", "modules"),
    I("mod_customers", "Customers & VIP list", true, "Customer list", "modules"),
    I("mod_content", "Content calendar", true, "Content calendar", "modules"),
    I("mod_collabs", "Wholesale / collabs tracker", true, "Collabs", "modules"),
  ],
  food_bev: [
    I("mod_menu", "Menu manager (feeds the website menu)", true, "Menu manager", "modules"),
    I("mod_orders", "Orders & catering requests", true, "Catering requests", "modules"),
    I("mod_inventory", "Inventory & suppliers", true, "Inventory", "modules"),
    I("mod_staff", "Staff schedule & shift tasks", true, "Staff schedule", "modules"),
    I("mod_loyalty", "Loyalty / rewards", true, "Rewards", "modules"),
    I("mod_reviews", "Reviews tracker", true, "Reviews", "modules"),
  ],
  other: [
    I("mod_leads", "Leads inbox", true, "Lead inbox", "modules"),
    I("mod_customers", "Customers", true, "Customer list", "modules"),
    I("mod_projects", "Projects & tasks", true, "Projects", "modules"),
    I("mod_invoices", "Invoices tracking (records only)", true, "Invoices", "modules"),
    I("mod_reports", "Owner dashboard & reports", true, "Your dashboard", "modules"),
  ],
};

const COMMAND_COMMON = [
  I("data_model", "Data model from the Brain's process map", true, "", "modules"),
  I("data_import", "Import the owner's existing data (customers, price list) — needs files from the client", false, "Your data brought over", "data"),
  I("logins", "Logins & roles: owner + team accounts (invites are a send: Justin taps)", false, "Your team logins", "logins", "publish"),
  I("connections", "Connections: Stripe, Google Calendar etc. (needs the owner's accounts)", false, "Connected tools", "connections"),
  I("automations", "Automations & notifications (internal only until approved)", true, "Automations", "automations"),
  I("mothership_sync", "Brain sync to Møthership (command_app_id + sync key)", true, "", "connections"),
  I("link_website_intake", "Linked apps: website requests land in the leads/inquiry inbox (backend function websiteIntake, fails closed without WEBSITE_INTAKE_KEY, dedupes on source_ref, never emails during tests)", true, "Website requests in your inbox", "connections"),
  I("link_photo_feed", "Linked apps: photos approved here (or in the portal) go to the website gallery as drafts (signed, PHOTO_FEED_KEY + WEBSITE_PHOTO_URL); nothing auto-publishes", true, "Approved photos sent to your website", "connections"),
  I("test_run", "Test run with [TEST] sample data, then remove it", true, "", "launch"),
  I("training", "Hand-off walkthrough for the owner", false, "Your walkthrough", "launch"),
  I("publish_command", "Publish the Command System (Justin's tap: Ready to publish)", false, "Your system is live", "launch", "publish"),
];

export function templateFor(niche) {
  const k = NICHE_KEYS.includes(niche) ? niche : "other";
  return {
    niche_key: k,
    label: NICHE_LABEL[k],
    version: TEMPLATE_VERSION,
    tracks: [
      { key: "website", label: "Website", items: [...PAGES[k], ...WEBSITE_COMMON] },
      { key: "command", label: "Command System", items: [...MODULES[k], ...COMMAND_COMMON] },
    ],
  };
}
export const ALL_TEMPLATES = NICHE_KEYS.map(templateFor);

export const domainOf = (client) => String((client && (client.domain || (client.websites || [])[0])) || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
export const withDomain = (label, client) => String(label || "").replace(DOMAIN_TOKEN, domainOf(client) || "the client's domain");

// Live-site automations only start once the domain is connected and verified (Search Console, IndexNow, Bing).
const LIVE_SITE_KINDS = ["search_console", "bing", "indexnow", "rich_results", "schema_check"];
export const isLiveSiteAutomation = (a) => LIVE_SITE_KINDS.includes(String((a && a.kind) || "")) || /search console|indexnow|bing webmaster/i.test(String((a && a.name) || ""));
export const startsWhenText = (client) => `Starts when ${domainOf(client) || "the domain"} is connected`;
export const isLaunched = (client) => !!(client && client.website_live_at);

// A client's checklist from a template (entity BuildChecklist).
export function instantiate(template, client) {
  const t = template && template.tracks ? template : templateFor(client && client.niche_key);
  return {
    client_id: client.id,
    client_name: client.business,
    niche_key: t.niche_key,
    template_version: t.version || TEMPLATE_VERSION,
    tracks: t.tracks.map((tr) => ({ key: tr.key, label: tr.label, items: tr.items.map((it) => ({ ...it, label: withDomain(it.label, client), done: false, done_at: "", done_by: "", note: "", preview_url: "", job_id: "" })) })),
  };
}

// Items added to the template since a checklist was made (e.g. the v3 linked-apps items), appended unticked to the
// right track in template order. Never removes or changes an existing item. Returns null when nothing is missing.
export function missingItems(checklist, template, client) {
  const t = template && template.tracks ? template : templateFor(checklist && checklist.niche_key);
  let added = 0;
  const tracks = ((checklist && checklist.tracks) || []).map((tr) => {
    const src = t.tracks.find((x) => x.key === tr.key);
    if (!src) return tr;
    const have = new Set(tr.items.map((i) => i.key));
    const extra = src.items.filter((i) => !have.has(i.key)).map((it) => ({ ...it, label: withDomain(it.label, client), done: false, done_at: "", done_by: "", note: "", preview_url: "", job_id: "" }));
    if (!extra.length) return tr;
    added += extra.length;
    // Keep Connect <domain> last on the Website track.
    const last = tr.items.length && tr.items[tr.items.length - 1].key === "connect_domain" ? tr.items[tr.items.length - 1] : null;
    const body = last ? tr.items.slice(0, -1) : tr.items;
    return { ...tr, items: [...body, ...extra, ...(last ? [last] : [])] };
  });
  return added ? { tracks, template_version: t.version || TEMPLATE_VERSION, added } : null;
}

export function tick(checklist, trackKey, itemKey, patch) {
  return {
    ...checklist,
    tracks: (checklist.tracks || []).map((tr) => (tr.key !== trackKey ? tr : { ...tr, items: tr.items.map((it) => (it.key !== itemKey ? it : { ...it, ...patch })) })),
  };
}

export function progress(checklist) {
  const out = { done: 0, total: 0, tracks: {} };
  for (const tr of (checklist && checklist.tracks) || []) {
    const d = tr.items.filter((i) => i.done).length;
    out.tracks[tr.key] = { done: d, total: tr.items.length, pct: tr.items.length ? Math.round((d / tr.items.length) * 100) : 0 };
    out.done += d; out.total += tr.items.length;
  }
  out.pct = out.total ? Math.round((out.done / out.total) * 100) : 0;
  return out;
}

// Client-friendly view for the portal: only items with a client_label, in order, lit when done.
export function portalView(checklist) {
  if (!checklist || !checklist.tracks) return null;
  const tracks = checklist.tracks.map((tr) => ({ key: tr.key, label: tr.key === "command" ? "Your Command System" : "Your website", items: tr.items.filter((i) => i.client_label).map((i) => ({ label: i.client_label, done: !!i.done })) }));
  const all = tracks.flatMap((t) => t.items);
  return { tracks, done: all.filter((i) => i.done).length, total: all.length, pct: all.length ? Math.round((all.filter((i) => i.done).length / all.length) * 100) : 0 };
}
