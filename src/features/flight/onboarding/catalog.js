// Flight plan walkthrough — one step order for onboarding ANY package, so every piece of client info
// is collected once, up front, and reused everywhere (prefill, never re-asked).
//
// Why this order:
//  1 Client & contacts   — who we talk to; every invite, agreement and invoice goes here.
//  2 Package & billing   — what was sold decides which SOPs run, so it decides what the rest asks for.
//     → right after step 2, ONE combined intake request goes to the client for everything they own
//       (assets, access invites, goals), so client-side lead time runs in parallel with Justin's work.
//  3 Business info       — NAP, hours, services, areas: copied into the site, GBP, citations, schema.
//  4 Brand assets        — logo, colours, fonts, photos: design, GBP and video all start here.
//  5 Access              — the classic bottleneck; record THAT access is granted and by whom (never passwords).
//  6 Goals & keywords    — the brief for the Intel audit, content and SEO.
//  7 Kickoff             — only now start the service: every SOP step lands dated and unblocked.
//  8 Launch checklist    — go-live checks for exactly what was sold.
//
// Requirements are derived from the SOP streams a sale runs (TaskTemplate.service_key): a field is
// BLOCKING when a step in one of those SOPs cannot be done without it, OPTIONAL when it helps.
import { SERVICE_GROUPS } from "@/features/tasks/StartServiceDialog";

export const SALES = SERVICE_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));
export const saleByKey = (k) => SALES.find((s) => s.key === k) || null;
export const CARE_PLANS = [
  { key: "orbit_local", label: "HyperCare+ Local", base: 750 },
  { key: "orbit_national", label: "HyperCare+ National", base: 1750 },
  { key: "orbit_global", label: "HyperCare+ Global", base: 3000 },
  { key: "starship_care", label: "GravïtyCare", base: 197 }
];
const PRICE_OF = { mission_alpha: 8997, mission_bravo: 6497, custom_website: 4997, command_system: 5997, ops_command: 3000, brand_arsenal: 2500, launch_grid: 1400, transmission: 1500, orbit_local: 750, orbit_multi: 350, orbit_national: 1750, orbit_global: 3000, starship_care: 197 };
export const defaultPrice = (k) => PRICE_OF[k] || 0;

// Which sales can put a client on each package page (first = default).
export const SALES_FOR_PACKAGE = {
  "custom-website": ["custom_website", "mission_bravo", "mission_alpha"],
  "command-system": ["command_system", "mission_bravo", "mission_alpha"],
  "intel-briefing": ["custom_website", "command_system", "mission_bravo", "mission_alpha"],
  "ops-command": ["ops_command", "mission_alpha"],
  "brand-arsenal": ["brand_arsenal", "mission_alpha"],
  "launch-grid": ["launch_grid", "mission_alpha"],
  transmission: ["transmission", "mission_alpha"],
  "orbit-seo": ["orbit_local", "orbit_national", "orbit_global", "orbit_multi"],
  gravitycare: ["starship_care"]
};

export const STEPS = [
  { id: "client", num: 1, title: "Client & contacts", short: "Client", why: "Every email, portal invite, agreement and invoice goes to these people. Get them right once." },
  { id: "deal", num: 2, title: "Package, pricing & billing", short: "Deal", why: "What was sold decides which SOPs run, and so which information the rest of this plan asks for." },
  { id: "business", num: 3, title: "Business info", short: "Business", why: "Name, address, phone, hours, services and areas get copied into the site, GBP, citations and schema. One wrong digit spreads everywhere." },
  { id: "brand", num: 4, title: "Brand assets", short: "Brand", why: "Design, GBP photos and the video all start from these. Collected now, nobody waits on a logo in week three." },
  { id: "access", num: 5, title: "Access", short: "Access", why: "Access is the classic bottleneck. Record that it was granted and by whom so launch day never stalls. Never store passwords." },
  { id: "strategy", num: 6, title: "Goals, competitors & keywords", short: "Goals", why: "This is the brief for the Intel audit, the content plan and SEO. Asked once, reused by every Claude job." },
  { id: "kickoff", num: 7, title: "Kickoff & task generation", short: "Kickoff", why: "With everything on file, start the service: every SOP step is created with dates and nothing in it is blocked on missing info." },
  { id: "launch", num: 8, title: "Launch checklist", short: "Launch", why: "The go-live checks for exactly what was sold, in one place." }
];
export const stepById = (id) => STEPS.find((s) => s.id === id) || STEPS[0];

const BUILDS = ["website", "system", "ops_command", "brand_arsenal", "launch_grid", "transmission"];
const ALL = "*";

// Small readers for the prefill sources.
const first = (a) => (Array.isArray(a) && a.length ? a[0] : "");
const names = (arr, key = "name") => (Array.isArray(arr) ? arr.map((x) => (typeof x === "string" ? x : x && (x[key] || x.term || x.city))).filter(Boolean) : []);
const ia = (k) => (s) => {
  const v = s.intake && s.intake.answers ? s.intake.answers[k] : "";
  return Array.isArray(v) ? v.join(", ") : v || "";
};
const brandId = (s) => (s.dossier && s.dossier.brand_identity) || {};

// Access fields are records, not secrets.
export const ACCESS_STATUSES = [
  { key: "not_requested", label: "Not requested" },
  { key: "requested", label: "Requested" },
  { key: "granted", label: "Granted" },
  { key: "not_needed", label: "Not needed" }
];

/*
 * Field catalog.
 *  need:   SOP streams where the field is blocking ("*" = every sale)
 *  opt:    streams where it is shown as optional
 *  ask:    the client can answer it in the combined intake request (RequestForm field type)
 *  prefill(sources) → existing value from CRM / dossier / intake audit (shown, counts as filled)
 *  crm:    CRMClient field it writes back to
 *  intake: IntakeAudit answer id it syncs to (so Claude briefs read it)
 */
export const FIELDS = [
  // 1 · client
  { key: "business", step: "client", label: "Business name (as customers see it)", type: "text", need: [ALL], prefill: (s) => s.client.business, crm: "business" },
  { key: "contact_name", step: "client", label: "Main contact", type: "text", need: [ALL], prefill: (s) => s.client.contact, crm: "contact" },
  { key: "contact_email", step: "client", label: "Contact email", type: "email", need: [ALL], prefill: (s) => first(s.client.emails), crm: "emails" },
  { key: "contact_phone", step: "client", label: "Contact phone", type: "phone", need: [ALL], prefill: (s) => first(s.client.phones), crm: "phones" },
  { key: "decision_makers", step: "client", label: "Owners / decision makers", type: "textarea", opt: [ALL], ask: "short_text", prefill: ia("owners"), intake: "owners" },
  { key: "portal_emails", step: "client", label: "Portal logins (emails, comma separated)", type: "text", need: ["onboarding", "starship", "orbit_setup"], opt: [ALL], ask: "short_text", prefill: (s) => (s.client.portal_emails || []).join(", "), crm: "portal_emails", help: "Who on their team gets the client portal (requests board, reports, intake)." },
  { key: "billing_email", step: "client", label: "Billing email (who pays)", type: "email", opt: [ALL], ask: "email" },

  // 2 · deal (Justin only; package/price/care/start live on the flight record itself)
  { key: "agreement", step: "deal", label: "Mission Agreement", type: "select", options: ["Not sent", "Sent", "Signed"], need: [ALL], done: (v) => v === "Signed", help: "Closing SOP: send for e-signature, save the signed copy to their documents." },
  { key: "payment", step: "deal", label: "Payment", type: "select", options: ["Not invoiced", "Invoice sent", "Paid in full", "Financed", "Subscription set up"], need: [ALL], done: (v) => ["Paid in full", "Financed", "Subscription set up"].includes(v), help: "Stripe invoice or payment link; confirm the payer is matched to the client (Stripe sync)." },
  { key: "referral_source", step: "deal", label: "Referral source (Prestige member?)", type: "text", opt: [ALL] },
  { key: "discount", step: "deal", label: "Discount applied", type: "text", opt: [ALL], help: "10% military / police / first responders, or referral HyperCare+ pricing." },

  // 3 · business
  { key: "legal_name", step: "business", label: "Legal name (and DBA)", type: "text", opt: [ALL], ask: "short_text", prefill: ia("legal_name"), intake: "legal_name" },
  { key: "industry", step: "business", label: "Industry / trade", type: "text", need: ["intel_briefing", "website", "system", "orbit_setup", "launch_grid", "brand_arsenal", "transmission"], opt: [ALL], ask: "short_text", prefill: (s) => s.client.industry || ia("industry")(s), crm: "industry", intake: "industry" },
  { key: "address", step: "business", label: "Public address (or 'service-area business, address hidden')", type: "textarea", need: ["onboarding", "website", "orbit_setup", "orbit_multi", "launch_grid"], opt: [ALL], ask: "long_text", prefill: ia("contact"), intake: "contact", help: "Exactly as it should appear on every listing (NAP)." },
  { key: "public_phone", step: "business", label: "Public phone number", type: "phone", need: ["onboarding", "website", "orbit_setup", "orbit_multi", "launch_grid"], opt: [ALL], ask: "phone", prefill: (s) => first(s.client.phones) },
  { key: "hours", step: "business", label: "Business hours", type: "text", need: ["website", "orbit_setup", "launch_grid"], opt: [ALL], ask: "short_text", prefill: ia("hours"), intake: "hours" },
  { key: "services_list", step: "business", label: "Every service / product they sell", type: "textarea", need: ["intel_briefing", "website", "system", "orbit_setup", "launch_grid"], opt: [ALL], ask: "long_text", prefill: (s) => names(s.dossier && s.dossier.services).join("\n") || ia("services")(s), intake: "services" },
  { key: "service_areas", step: "business", label: "Service areas (cities / counties)", type: "textarea", need: ["website", "orbit_setup", "orbit_local", "orbit_multi", "launch_grid"], opt: [ALL], ask: "long_text", prefill: (s) => { const a = (s.dossier && s.dossier.service_area) || {}; const c = names(a.cities, "city"); return c.length ? c.join(", ") : a.primary_city || s.client.location || ia("locations")(s); }, intake: "locations", crm: "location" },
  { key: "extra_locations", step: "business", label: "Extra locations (address + phone each)", type: "textarea", need: ["orbit_multi"], ask: "long_text" },
  { key: "licenses", step: "business", label: "Licenses, insurance, awards", type: "textarea", opt: ["website", "launch_grid", "orbit_setup"], ask: "long_text", prefill: ia("licenses"), intake: "licenses" },
  { key: "team", step: "business", label: "Team (who does what, who will log in)", type: "textarea", need: ["system"], opt: ["website", "ops_command"], ask: "long_text", prefill: (s) => ia("roles")(s) || ia("users")(s), intake: "roles" },

  // 4 · brand
  { key: "logo", step: "brand", label: "Logo file", type: "upload", need: ["website", "launch_grid", "orbit_setup", "transmission", "onboarding"], opt: ["brand_arsenal"], ask: "files", prefill: (s) => s.client.logo_url || brandId(s).logo_url, crm: "logo_url", help: "Vector (SVG / AI / PDF) if they have it." },
  { key: "brand_colors", step: "brand", label: "Brand colours (hex if known)", type: "text", need: ["website", "transmission"], opt: ["brand_arsenal", "launch_grid"], ask: "short_text", prefill: (s) => (brandId(s).colors || []).join(", ") || ia("colors_fonts")(s), intake: "colors_fonts" },
  { key: "brand_fonts", step: "brand", label: "Fonts", type: "text", opt: ["website", "transmission", "brand_arsenal"], ask: "short_text", prefill: (s) => brandId(s).fonts || "" },
  { key: "photos", step: "brand", label: "20+ real photos (upload or a shared folder link)", type: "upload", multiple: true, need: ["website", "orbit_setup", "launch_grid"], opt: ["transmission", "brand_arsenal"], ask: "photos", help: "Real crew, jobs, before/after. GBP wants 25+." },
  { key: "reviews", step: "brand", label: "Reviews / testimonials to feature", type: "textarea", opt: ["website", "transmission"], ask: "long_text" },
  { key: "brand_likes", step: "brand", label: "What they love / hate; brands they admire", type: "textarea", need: ["brand_arsenal"], opt: ["website"], ask: "long_text", prefill: (s) => ia("brand_admired")(s) || ia("site_likes")(s), intake: "brand_admired" },
  { key: "voice", step: "brand", label: "Tagline and how the brand should sound", type: "textarea", opt: ["website", "brand_arsenal", "transmission"], ask: "long_text", prefill: ia("tagline_voice"), intake: "tagline_voice" },

  // 5 · access — records only
  { key: "access_domain", step: "access", label: "Domain registrar + DNS", type: "access", need: ["website", "starship"], opt: ["orbit_setup", "brand_arsenal"], ask: "access", invite: "Add us to your domain registrar (or tell us who manages DNS)." },
  { key: "access_hosting", step: "access", label: "Current host / site platform", type: "access", opt: ["website", "starship"], ask: "access", invite: "Add us to your current website host / platform." },
  { key: "access_gbp", step: "access", label: "Google Business Profile — Manager", type: "access", need: ["onboarding", "orbit_setup", "orbit_multi", "launch_grid"], opt: ["website"], ask: "access", invite: "Invite {email} as a Manager on your Google Business Profile." },
  { key: "access_gsc", step: "access", label: "Search Console — Owner", type: "access", need: ["website", "orbit_setup"], ask: "access", invite: "Add {email} as an Owner in Google Search Console." },
  { key: "access_ga4", step: "access", label: "Google Analytics 4 — Editor", type: "access", need: ["orbit_setup"], opt: ["website"], ask: "access", invite: "Add {email} as an Editor in Google Analytics." },
  { key: "access_bing", step: "access", label: "Bing Places / Webmaster + Apple Business Connect", type: "access", need: ["launch_grid"], opt: ["orbit_setup", "onboarding"], ask: "access", invite: "Add {email} to Bing Places and Apple Business Connect." },
  { key: "access_socials", step: "access", label: "Social accounts (Meta partner access, etc.)", type: "access", need: ["brand_arsenal"], opt: ["launch_grid", "onboarding", "transmission"], ask: "access", invite: "Give us partner / admin access to your Facebook, Instagram and other social pages." },
  { key: "access_reviews", step: "access", label: "Review platforms (Yelp, industry sites)", type: "access", opt: ["launch_grid", "orbit_local"], ask: "access", invite: "Add us to Yelp and any industry review sites." },
  { key: "access_software", step: "access", label: "Their current software (CRM, scheduling, payments, accounting)", type: "access", need: ["system", "ops_command"], ask: "access", invite: "Add us as an admin on the software you run the business on today." },
  { key: "access_email", step: "access", label: "Email provider (signatures, DNS records)", type: "access", opt: ["brand_arsenal", "website"], ask: "access", invite: "Add us to your email provider (Google Workspace / Microsoft 365)." },

  // 6 · strategy
  { key: "goals", step: "strategy", label: "Where they want the business in 12 months", type: "textarea", need: ["intel_briefing", "website", "system", "orbit_setup"], opt: [ALL], ask: "long_text", prefill: ia("goal_12mo"), intake: "goal_12mo" },
  { key: "primary_cta", step: "strategy", label: "The one action a visitor should take", type: "select", options: ["Call", "Request a quote", "Book online", "Buy online", "Visit / walk in", "Other"], need: ["website"], ask: "select" },
  { key: "competitors", step: "strategy", label: "Top competitors (names or sites)", type: "textarea", need: ["intel_briefing", "orbit_setup"], opt: ["website", "brand_arsenal"], ask: "long_text", prefill: (s) => names(s.dossier && s.dossier.competitors).join("\n") || ia("competitors")(s), intake: "competitors" },
  { key: "keywords", step: "strategy", label: "What they want to show up for", type: "textarea", need: ["orbit_setup"], opt: ["website", "launch_grid"], ask: "long_text", prefill: (s) => names(s.dossier && s.dossier.keywords, "term").slice(0, 15).join("\n") || ia("keywords")(s), intake: "keywords" },
  { key: "reference_sites", step: "strategy", label: "1–2 reference sites they like", type: "textarea", need: ["website"], ask: "long_text", prefill: ia("sites_admired"), intake: "sites_admired" },
  { key: "must_have_pages", step: "strategy", label: "Must-have pages and features", type: "textarea", opt: ["website"], ask: "long_text", prefill: ia("must_have_pages"), intake: "must_have_pages" },
  { key: "software", step: "strategy", label: "Every app they pay for (and roughly what)", type: "textarea", need: ["intel_briefing", "system"], opt: ["ops_command"], ask: "long_text", prefill: ia("software"), intake: "software" },
  { key: "system_needs", step: "strategy", label: "What the system must do (lead → paid)", type: "textarea", need: ["system"], ask: "long_text", prefill: (s) => ia("system_detail")(s) || ia("system_needs")(s), intake: "system_detail" },
  { key: "processes", step: "strategy", label: "Processes done by hand that should run themselves", type: "textarea", need: ["ops_command"], opt: ["system"], ask: "long_text", prefill: (s) => ia("manual_work")(s) || ia("automate_first")(s), intake: "manual_work" },
  { key: "video_brief", step: "strategy", label: "Video: what viewers do next, key message, length, formats", type: "textarea", need: ["transmission"], ask: "long_text" },
  { key: "timeline", step: "strategy", label: "When they want it live", type: "text", opt: [ALL], ask: "short_text", prefill: ia("timeline"), intake: "timeline" },

  // 7 · kickoff
  { key: "kickoff_date", step: "kickoff", label: "Kickoff call (recorded)", type: "date", need: ["onboarding", "system", "ops_command", "brand_arsenal"], opt: [ALL], help: "45 minutes: map lead → paid, log bottlenecks as Gaps." },
  { key: "kickoff_notes", step: "kickoff", label: "Kickoff notes / recording link", type: "textarea", opt: [ALL] }
];
export const fieldByKey = (k) => FIELDS.find((f) => f.key === k);

// Launch checklist per stream.
export const LAUNCH_CHECKS = [
  { key: "domain_ssl", label: "Domain connected, SSL on, www + non-www resolve", streams: ["website"] },
  { key: "redirects", label: "Old URLs mapped, 301 redirects in place", streams: ["website"] },
  { key: "sitemap", label: "Sitemap in Search Console + Bing / IndexNow", streams: ["website"] },
  { key: "live_check", label: "Forms, phone links and analytics firing on the live site", streams: ["website"] },
  { key: "gbp_link", label: "GBP website link updated", streams: ["website"] },
  { key: "site_app", label: "Site app id saved on the client", streams: ["website"] },
  { key: "sys_logins", label: "Logins created for every user", streams: ["system"] },
  { key: "sys_training", label: "Training recorded + quick-start SOP per role", streams: ["system"] },
  { key: "sys_checkpoint", label: "Checkpoint saved before launch", streams: ["system"] },
  { key: "ops_tested", label: "Flows tested with real scenarios; alerts routed", streams: ["ops_command"] },
  { key: "brand_portal", label: "Brand kit + asset library in their portal", streams: ["brand_arsenal"] },
  { key: "grid_owner", label: "Client is owner on every listing; list in portal", streams: ["launch_grid"] },
  { key: "video_placed", label: "Master + cutdowns delivered; video placed on site", streams: ["transmission"] },
  { key: "orbit_found", label: "Search Console + GA4 verified, conversions marked", streams: ["orbit_setup"] },
  { key: "orbit_autos", label: "Blog + GBP automations registered", streams: ["orbit_setup"] },
  { key: "orbit_base", label: "Baseline Performance snapshot taken", streams: ["orbit_setup"] },
  { key: "care_base", label: "Care baseline checkpoint; domain + SSL renewals recorded", streams: ["starship", "orbit_setup"] },
  { key: "care_billing", label: "Care plan billing live in Stripe", streams: ["care"] },
  { key: "launch_msg", label: "Launch message in their portal", streams: [ALL] },
  { key: "review_ask", label: "Review asked for while excitement is high", streams: [ALL] }
];

/* ---------------- derivation ---------------- */

export function streamsFor(flight, client) {
  const sale = saleByKey(flight && flight.sale_package);
  if (!sale) return [];
  const out = new Set(sale.streams || []);
  if (flight.include_onboarding) out.add("onboarding");
  if (needsCare(flight, client)) {
    const care = saleByKey(flight.care_plan);
    (care ? care.streams : []).forEach((s) => out.add(s));
    if (care) out.add("care");
  }
  if (["orbit_local", "orbit_national", "orbit_global", "starship_care"].includes(sale.key)) out.add("care");
  return [...out];
}

export function needsCare(flight, client) {
  const sale = saleByKey(flight && flight.sale_package);
  const covered = ((client && client.services_managed) || []).some((s) => s === "orbit_seo" || s === "starship_care");
  return Boolean(sale && sale.needsCare && !covered);
}

const hits = (list, streams) => (list || []).some((s) => s === ALL || streams.includes(s));

// Blocking | optional | hidden for this sale.
export function levelOf(field, streams) {
  if (!streams.length) return field.step === "client" ? "blocking" : "hidden";
  if (hits(field.need, streams)) return "blocking";
  if (hits(field.opt, streams)) return "optional";
  return "hidden";
}

const filled = (v) => {
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return String(v).trim() !== "";
};

// Value Justin sees: what was saved, else the prefill from existing records.
export function valueOf(field, flight, sources) {
  const saved = flight && flight.answers ? flight.answers[field.key] : undefined;
  if (filled(saved)) return { value: saved, from: (flight.sources && flight.sources[field.key]) || "justin" };
  if (field.prefill && sources) {
    try {
      const v = field.prefill(sources);
      if (filled(v)) return { value: v, from: field.crm ? "crm" : "records" };
    } catch {
      /* a broken prefill never blocks the walkthrough */
    }
  }
  return { value: undefined, from: null };
}

export function isDone(field, value) {
  if (field.type === "access") return Boolean(value && (value.status === "granted" || value.status === "not_needed"));
  if (field.done) return field.done(value);
  return filled(value);
}

// Step 2 virtual fields (stored on the flight itself).
function dealVirtuals(flight, client) {
  const out = [
    { key: "_sale", label: "Package sold", ok: Boolean(saleByKey(flight.sale_package)) },
    { key: "_start", label: "Start date", ok: Boolean(flight.start_date) },
    { key: "_price", label: "Price agreed", ok: Number(flight.price) > 0 }
  ];
  if (needsCare(flight, client)) out.push({ key: "_care", label: "Care plan (required for every hosted build)", ok: Boolean(saleByKey(flight.care_plan)) });
  return out;
}

export function evaluate(flight, client, sources, { startedProjects = [] } = {}) {
  const streams = streamsFor(flight, client);
  const skipped = (flight && flight.skipped) || {};
  const steps = STEPS.map((step) => {
    const items = [];
    if (step.id === "deal") dealVirtuals(flight, client).forEach((v) => items.push({ key: v.key, label: v.label, level: "blocking", done: v.ok, virtual: true }));
    FIELDS.filter((f) => f.step === step.id).forEach((f) => {
      const level = levelOf(f, streams);
      if (level === "hidden") return;
      const { value, from } = valueOf(f, flight, sources);
      items.push({ key: f.key, field: f, label: f.label, level, value, from, done: isDone(f, value), skipped: skipped[f.key] || null });
    });
    if (step.id === "kickoff") {
      const started = (flight.project_ids || []).length > 0 || startedProjects.length > 0;
      items.push({ key: "_started", label: "Service started (project + every SOP step created)", level: "blocking", done: started, virtual: true });
    }
    if (step.id === "launch") {
      LAUNCH_CHECKS.filter((c) => c.streams.some((s) => s === ALL || streams.includes(s))).forEach((c) => {
        items.push({ key: c.key, label: c.label, level: "blocking", done: Boolean(flight.launch_checks && flight.launch_checks[c.key]), check: true, skipped: skipped[c.key] || null });
      });
    }
    const blocking = items.filter((i) => i.level === "blocking");
    const missing = blocking.filter((i) => !i.done && !i.skipped);
    const flagged = blocking.filter((i) => !i.done && i.skipped);
    const optionalMissing = items.filter((i) => i.level === "optional" && !i.done);
    return { ...step, items, missing, flagged, optionalMissing, clear: missing.length === 0, complete: blocking.every((i) => i.done) && blocking.length > 0 };
  });

  const collect = steps.filter((s) => s.num <= 6);
  const collectClear = collect.every((s) => s.clear);
  const started = steps.find((s) => s.id === "kickoff").items.find((i) => i.key === "_started").done;
  const lock = {
    kickoff: collectClear ? null : "Steps 1–6 still have blocking items. Fill them or skip with a flag.",
    launch: started ? null : "Start the service first (step 7)."
  };
  const askable = steps.flatMap((s) => s.items.filter((i) => i.field && i.field.ask && !i.done));
  const blockingTotal = steps.reduce((n, s) => n + s.items.filter((i) => i.level === "blocking").length, 0);
  const blockingDone = steps.reduce((n, s) => n + s.items.filter((i) => i.level === "blocking" && i.done).length, 0);
  return { streams, steps, lock, started, collectClear, askable, progress: blockingTotal ? Math.round((blockingDone / blockingTotal) * 100) : 0 };
}

// The single next thing to do.
export function nextAction(ev, flight, { pendingAnswers = 0 } = {}) {
  const by = (id) => ev.steps.find((s) => s.id === id);
  for (const id of ["client", "deal"]) if (!by(id).clear) return { kind: "step", step: id, label: "Finish " + by(id).title.toLowerCase(), hint: by(id).missing.length + " blocking item(s) left" };
  if (pendingAnswers) return { kind: "apply", label: "Apply the client's intake answers", hint: pendingAnswers + " answer(s) waiting" };
  const ask = ev.askable.filter((i) => i.level === "blocking");
  if (ask.length && !flight.intake_sent_at) return { kind: "intake", label: "Send one intake request (" + ev.askable.length + " items)", hint: "Everything the client owns, in one form, so it runs in parallel" };
  for (const id of ["business", "brand", "access", "strategy"]) if (!by(id).clear) return { kind: "step", step: id, label: "Finish " + by(id).title.toLowerCase(), hint: by(id).missing.length + " blocking item(s) left" };
  if (!ev.started) return { kind: "kickoff", step: "kickoff", label: "Start the service", hint: "Creates the project and every SOP step, dated" };
  if (!by("kickoff").clear) return { kind: "step", step: "kickoff", label: "Finish kickoff", hint: by("kickoff").missing.length + " item(s) left" };
  if (!by("launch").clear) return { kind: "step", step: "launch", label: "Work the launch checklist", hint: by("launch").missing.length + " check(s) left" };
  if (flight.status !== "launched") return { kind: "launched", label: "Mark launched", hint: "Everything is ticked" };
  return { kind: "done", label: "Flight complete", hint: "Launched " + String(flight.launched_at || "").slice(0, 10) };
}

/* ---------------- intake request (RequestForm) ---------------- */

const FORM_TYPE = { short_text: "short_text", long_text: "long_text", email: "email", phone: "phone", files: "files", photos: "photos", select: "select" };

export function intakeFormFields(items, inviteEmail) {
  return items
    .filter((i) => i.field && i.field.ask && !i.done)
    .map((i) => {
      const f = i.field;
      if (f.ask === "access") {
        return { id: f.key, label: (f.invite || f.label).replace("{email}", inviteEmail || "us"), type: "checkbox", required: false, help: "Tick once it is done. Never send passwords here; we only need the invite." };
      }
      return { id: f.key, label: f.label, type: FORM_TYPE[f.ask] || "short_text", required: i.level === "blocking", options: f.options || [], help: f.help || "" };
    });
}

// Turn a submitted ClientRequest back into flight answers.
export function answersFromRequest(req, fieldKeys) {
  const vals = (req && req.fields) || {};
  const out = {};
  (fieldKeys || Object.keys(vals)).forEach((k) => {
    const f = fieldByKey(k);
    const v = vals[k];
    if (!f || v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return;
    if (f.type === "access") {
      if (v === true || v === "true" || v === "yes") out[k] = { status: "requested", by: req.submitted_by || "client", on: String(req.created_date || "").slice(0, 10), note: "Client says the invite was sent (intake). Verify, then mark Granted." };
      return;
    }
    out[k] = Array.isArray(v) && f.type !== "upload" ? v.join(", ") : v;
  });
  return out;
}

// Plain-text list for email / chat when the portal is off.
export function missingAsText(ev, clientName) {
  const lines = [`What we still need from ${clientName || "you"} to start:`];
  ev.steps.forEach((s) => {
    const rows = s.items.filter((i) => i.field && i.field.ask && !i.done);
    if (!rows.length) return;
    lines.push("", s.title.toUpperCase());
    rows.forEach((i) => lines.push(`- ${i.field.ask === "access" ? (i.field.invite || i.label).replace("{email}", "us") : i.label}${i.level === "blocking" ? "" : " (optional)"}`));
  });
  lines.push("", "Please never send passwords. For access we only need you to send the invite.");
  return lines.join("\n");
}
