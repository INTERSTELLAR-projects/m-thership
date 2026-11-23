// QA / demo fixtures for the Lead Engine (preview sandbox ?qa=1 and Presentation mode only; never the live app).
// FICTIONAL businesses only, 555 phone numbers, example.com addresses. Built with the real template + preview code.
import { seedTemplates, buildPreview, presentationPack, prepCard, heatOf, OUTCOMES, PLACES_PRICING, nextAction, followUpDraft, sheetOrder } from "@/lib/leadEngine";

const NOW = new Date();
const ago = (h) => new Date(NOW.getTime() - h * 3600000).toISOString();
const T = seedTemplates(ago(240)).map((t, i) => ({ ...t, id: `qa-t${i}` }));
const tpl = (k) => T.find((t) => t.industry_key === k);

const LEADS = [
  { id: "qa-l1", business: "Cedar Hollow Tree Care (demo)", contact: "Avery Holloway", city: "Riverbend", state: "OR", industry_key: "tree_service", phones: ["(555) 010-0142"], websites: [], lead_flags: ["no_website", "few_reviews"], gbp_cache: { rating: 4.6, review_count: 11, category: "Tree service", maps_url: "https://maps.google.com/?cid=0", photo_count: 3 }, scrape_summary: { services: ["Tree removal", "Stump grinding", "Storm cleanup", "Tree trimming & pruning"], gbp: { rating: 4.6, reviews: 11, address: "100 Example Rd, Riverbend, OR 97000", phone: "(555) 010-0142", hours: "Mon–Sat 7 AM–6 PM" }, colors: ["#23402b", "#d8892f"], owner: "Avery Holloway", email: "office@example.com" }, desk_outcome: "", preview: { status: "viewed", engagement: { first_login_at: ago(1.2), sessions: 3, views: { home: 3, website: 4, command: 2 }, seconds: { website: 420, command: 260 }, last_seen_at: ago(0.4) }, sent_at: ago(26) } },
  { id: "qa-l2", business: "Bluebird Plumbing Co (demo)", contact: "", city: "Lakeside", state: "OR", industry_key: "plumbing", phones: ["(555) 010-0188"], websites: ["http://example.com"], lead_flags: ["dated"], site_check: { dated: true, reasons: ["no_https", "old_copyright"] }, gbp_cache: { rating: 4.2, review_count: 34, category: "Plumber" }, scrape_summary: { services: ["Drain cleaning", "Water heaters", "Leak repair"], gbp: { rating: 4.2, reviews: 34, address: "22 Example Ave, Lakeside, OR 97000", phone: "(555) 010-0188" } }, desk_outcome: "voicemail", preview: { status: "ready" } },
  { id: "qa-l3", business: "Juniper Fade Studio (demo)", contact: "Rowan Pemberton", city: "Maple Grove", state: "OR", industry_key: "barber_salon", phones: ["(555) 010-0121"], websites: [], lead_flags: ["no_website"], gbp_cache: { rating: 4.9, review_count: 58, category: "Barber shop" }, scrape_summary: { services: ["Haircuts", "Skin fades", "Beard trims", "Hot towel shaves"], gbp: { rating: 4.9, reviews: 58, address: "5 Example St, Maple Grove, OR 97000" } }, desk_outcome: "callback", callback_at: ago(-0.5), preview: { status: "sent", sent_at: ago(52) } },
  { id: "qa-l4", business: "Ironclad Garage Doors (demo)", contact: "", city: "Stonebridge", state: "OR", industry_key: "garage_doors", phones: ["(555) 010-0165"], websites: ["https://example.com"], lead_flags: ["few_photos"], gbp_cache: { rating: 4.4, review_count: 19 }, scrape_summary: { services: ["Door installation", "Spring & opener repair", "Commercial doors"], gbp: { rating: 4.4, reviews: 19 } }, preview: { status: "ready" } },
  { id: "qa-l5", business: "Harvest Crumb Bakery (demo)", contact: "Quinn Marchetti", city: "Orchard Lane", state: "OR", industry_key: "bakery_cafe", phones: ["(555) 010-0133"], websites: [], lead_flags: ["no_website"], gbp_cache: { rating: 4.8, review_count: 72 }, scrape_summary: { services: ["Custom cakes", "Cupcakes", "Coffee & drinks", "Catering & events"], gbp: { rating: 4.8, reviews: 72 }, colors: ["#6d2433", "#f0a35c"] }, preview: { status: "ready" } },
];

function full(l) {
  const t = tpl(l.industry_key);
  const c = { ...l, status: "Lead", lead_source: "lead_finder", pipeline_stage: l.preview?.sent_at ? "contacted" : "new", one_liner: "", logo_url: "" };
  const b = buildPreview({ client: c, template: t, now: ago(30) });
  const preview = { id: `${l.id}-p`, client_id: l.id, industry_key: t.industry_key, version: 2, built_at: ago(30), status: l.preview?.status || "ready", sent_at: l.preview?.sent_at || null, engagement: l.preview?.engagement || null, website_base: b.website_config, website_config: b.website_config, website_overrides: {}, command_config: b.command_config, missing: b.missing, build_log: [{ at: ago(30), by: "build queue", action: "build", version: 1, note: `${t.name} template · auto Ready` }, { at: ago(28), by: "justin@interstellar-strategies.com", action: "edit", version: 2, note: "Hero line tightened" }] };
  preview.presentation = presentationPack({ client: c, preview, template: t, rep: { name: "Justin" } });
  return { c, t, preview };
}
const DATA = LEADS.map(full);

const OFFERS = [
  { key: "mission_alpha", kind: "mission", name: "Mission ALPHA", summary: "Flagship: 6 systems + 4 bonuses, live in 45 days.", includes: ["Custom Website", "Command System", "Ops Command", "Brand Arsenal", "Launch Grid", "Transmission"] },
  { key: "mission_bravo", kind: "mission", name: "Mission BRAVO", summary: "Intel Briefing + Website + Command System, no bonuses.", includes: ["Intel Briefing", "Custom Website", "Command System"] },
  { key: "custom_website", kind: "build", name: "Custom Website", summary: "", includes: ["Intel Briefing"] },
  { key: "command_system", kind: "build", name: "Command System", summary: "Lead product: custom CRM + ERP + client portal + automations.", includes: ["Intel Briefing"] },
  { key: "hypercare_local", kind: "subscription", name: "HyperCare+ Local", summary: "", includes: ["GBP posts", "Long-form blogs", "Reviews", "Citations", "Monitoring", "Daily intel"] },
  { key: "gravitycare", kind: "subscription", name: "GravïtyCare", summary: "", includes: ["Hosting", "Uptime", "Small edits"] },
];
const PORTFOLIO = [
  { id: "qa-pf1", slug: "sample-tree-co", name: "Sample Tree Co (demo)", industry: "Tree service", industry_key: "tree_service", url: "https://example.com", domain: "example.com", launched_at: ago(400), description: "Tree removal & land clearing · demo card", objective: "Demo: turn Google searches into booked estimates.", built: ["website", "command_system"], highlights: ["Demo highlight one", "Demo highlight two"], results: [], image_desktop: "", image_phone: "", og_image: "" },
  { id: "qa-pf2", slug: "sample-landscape", name: "Sample Landscaping (demo)", industry: "Landscaping", industry_key: "landscaping", url: "https://example.com", domain: "example.org", launched_at: ago(700), description: "Commercial grounds · demo card", objective: "", built: ["website", "seo_map_pack"], highlights: [], results: [], image_desktop: "", image_phone: "", og_image: "" },
  { id: "qa-pf3", slug: "sample-barber", name: "Sample Barbershop (demo)", industry: "Barbershop", industry_key: "barber_salon", url: "https://example.com", domain: "example.net", launched_at: ago(900), description: "Two locations · demo card", objective: "", built: ["website"], highlights: [], results: [], image_desktop: "", image_phone: "", og_image: "" },
];
const portalFor = (d) => ({ portfolio: PORTFOLIO, tier: "lead", client: { id: d.c.id, business: d.c.business, contact: d.c.contact, city: d.c.city, state: d.c.state, logo_url: "" }, preview: { status: d.preview.status, website: d.preview.website_config, command: d.preview.command_config }, offers: OFFERS, incentive: { amount: 30, minutes: 30, per_minute: 1, methods: ["Venmo", "Cash App", "PayPal", "check"] }, booked: false, businesses: [] });

const CALLS = [["no_answer", 0.2], ["voicemail", 0.4], ["gatekeeper", 0.6], ["sent_portal", 0.9], ["staff_portal", 1.1], ["no_answer", 1.3], ["callback", 1.6], ["booked", 2.2], ["no_answer", 2.5], ["voicemail", 2.7]].map(([outcome, h], i) => ({ id: `qa-c${i}`, outcome, at: ago(h), caller: "justin@interstellar-strategies.com", client_id: DATA[i % DATA.length].c.id }));

function results() {
  const names = [["Pinecrest Tree Service (demo)", "", 4.1, 6, 2], ["Sagebrush Arbor Care (demo)", "https://example.com", 4.7, 41, 10], ["Lantern Tree & Stump (demo)", "", 0, 0, 0], ["Copperline Tree Experts (demo)", "http://example.com", 3.9, 9, 4], ["Falcon Ridge Arborists (demo)", "https://example.com", 4.9, 126, 10], ["Wildflower Tree Works (demo)", "", 4.5, 14, 3]];
  return names.map(([name, website, rating, reviews, photos], i) => ({ place_id: `qa-place-${i}`, name, category: "Tree service", rating: rating || null, review_count: reviews, phone: `(555) 010-02${10 + i}`, website, address: `${100 + i} Example Rd, Riverbend, OR 97000`, city: "Riverbend", state: "OR", maps_url: "https://maps.google.com/?cid=0", photo_count: photos, flags: [!website && "no_website", reviews < 15 && "few_reviews", photos < 5 && "few_photos"].filter(Boolean), existing: i === 4 ? { business: name, status: "Lead" } : null }));
}

export function qaLeadInvoke(name, args = {}) {
  const a = args.action;
  if (name === "portfolio") return a === "list" ? { items: PORTFOLIO.map((x, i) => ({ ...x, client_name: x.name, status: i ? "draft" : "published", source: "seed" })), noindex: true } : { items: PORTFOLIO, noindex: true };
  if (name === "lead-finder") {
    if (a === "status") return { configured: true, pricing: PLACES_PRICING, cache_days: 30, usage: { month_requests: 14, month_est_usd: 0.49, today: 3 }, staff: { kind: "admin" } };
    if (a === "search") return { query: `tree service in ${args.place ? `${args.place}, ` : ""}Oregon`, results: results(), next_page_token: "qa", page: 1, est_cost_usd: PLACES_PRICING.per_request_usd };
    if (a === "check_sites") return { checks: Object.fromEntries((args.urls || []).map((u, i) => [u, i % 2 ? { dated: true, reasons: ["no_https", "no_viewport"] } : { dated: false, reasons: [] }])) };
    return { created: [], skipped: [] };
  }
  if (name === "sales-team") {
    if (a === "me") return { kind: "admin" };
    if (a === "offers") return { products: [{ key: "website", label: "Website", billing: "one_time", offer_key: "custom_website", list_price: 4997, price_display: "$4,997", name: "Custom Website" }, { key: "app", label: "Command System (app)", billing: "one_time", offer_key: "command_system", list_price: 5997, price_display: "$5,997", name: "Command System" }, { key: "bundle", label: "Website + Command System (Mission)", billing: "one_time", offer_key: "mission_alpha", list_price: 11997, price_display: "$11,997", name: "Mission ALPHA" }, { key: "seo", label: "SEO subscription (HyperCare+)", billing: "monthly", offer_key: "hypercare_local", list_price: 750, price_display: "$750/mo", name: "HyperCare+ Local" }] };
    if (a === "deals") return { deals: [] };
    if (a === "reps") return { reps: [{ id: "qa-r1", name: "Sample Rep (demo)", email: "rep@example.com", status: "active", mode: "both", build_pct: 40, allowed_industries: ["tree_service"], weight: 1, capacity: 40, base_retainer: 5000, assigned_total: 12 }] };
    if (a === "comp") return { comp: { base_default: 5000, base_range: [5000, 7000], tiers: [{ from: 0, rate: 0.05 }, { from: 15000, rate: 0.08 }, { from: 30000, rate: 0.1 }], seo_bonus_per_sub: 250, monthly_counts_months: 3, note: "Starting defaults: change them to your real plan." } };
    if (a === "floors") return { floors: { website: 1000, app: 5000, bundle: 5000 } };
    if (a === "hq") {
      const dials = CALLS.length;
      return {
        days: args.days || 7, board: [{ id: "qa-r1", name: "Sample Rep (demo)", status: "active", mode: "both", open_leads: 12, calls: 0, conversations: 0, meetings: 0, previews_built: 6, portal_logins: 0, deals_closed: 0, revenue: 0, seo_subs: 0, month_cost: 5000, month_commission: 0, month_gross: 0, base_retainer: 5000 }],
        callers: [{ email: "justin@interstellar-strategies.com", name: "justin", role: "admin", dials, connects: 6, owners: 3, portals: 2, logins: 1, meetings: 1, deals: 0, revenue: 0, cost: 0, connect_rate: 0.6, owner_rate: 0.3, portal_rate: 0.33, login_rate: 0.5, meeting_rate: 0.33, close_rate: 0, revenue_per_dial: 0, cost_per_dial: 0 }],
        activity: Array.from({ length: 8 }, (_, i) => ({ week: new Date(NOW.getTime() - (7 - i) * 7 * 864e5).toISOString().slice(0, 10), calls: i === 7 ? dials : 0, meetings: i === 7 ? 1 : 0, previews: i === 7 ? 5 : 0, deals: 0 })),
        pipeline: { stages: { new: 3, contacted: 2 }, industries: { tree_service: 1, plumbing: 1, barber_salon: 1, garage_doors: 1, bakery_cafe: 1 } },
        funnel: [{ key: "found", label: "Found", n: 24 }, { key: "built", label: "Preview built", n: 5 }, { key: "contacted", label: "Contacted", n: 4 }, { key: "meeting", label: "Meeting booked", n: 1 }, { key: "closed", label: "Closed", n: 0 }],
        pending_approvals: [], goal: { title: "$1M in 2027 (demo)", target: 1000000, year: 2027, stripe_mrr: 0, committed_mrr: 0, months: Array.from({ length: 12 }, (_, i) => ({ month: `2027-${String(i + 1).padStart(2, "0")}`, target: 83333, project: 0, new_mrr: 0 })), from_goal: false },
        totals: { calls: dials, meetings: 1, deals: 0, revenue: 0, cost: 5000 },
      };
    }
    if (a === "statement") return { rep: {}, statements: [], rules: {} };
    return {};
  }
  if (name === "lead-engine") {
    if (a === "templates") return { templates: T, seeded: true, can_edit: true, allowed: null, multi: false };
    if (a === "stats") return { found_week: 24, previews_ready: 4, previews_draft: 1, portal_logins: 1, walkthroughs: 1, incentives_owed: 1, incentives_owed_usd: 30, conversions: 0 };
    if (a === "queue") return { items: results().slice(0, 4).map((p, i) => ({ id: `qa-q${i}`, business: p.name, city: p.city, state: p.state, industry_key: "tree_service", lead_flags: p.flags, rating: p.rating, reviews: p.review_count, website: p.website, queue: { status: ["pending", "pending", "building", "ready"][i], reason: i === 2 ? "" : "" } })), counts: { pending: 2, building: 1, ready: 1 }, daily_cap: 25, built_today: 5 };
    if (a === "settings") return { settings: { postal_address: "", reply_email: "justin@interstellar-strategies.com", daily_cap: 25, voicemail_attempts: 4 } };
    if (a === "sheet") {
      const rows = DATA.map((d) => {
        const task = d.c.id === "qa-l1" ? { id: "qa-t1", kind: "hot_call", due_at: ago(0.1), priority: 0, reason: "Hottest: came back to the preview more than once. Call now." } : d.c.id === "qa-l3" ? { id: "qa-t3", kind: "callback", due_at: d.c.callback_at, priority: 1, reason: "Callback they asked for." } : d.c.id === "qa-l2" ? { id: "qa-t2", kind: "retry_call", due_at: ago(0.5), priority: 3, reason: "Attempt 2 of 4: voicemail left last time, trying a different hour." } : null;
        return { client: d.c, task, heat: heatOf(d.c, d.preview), preview: { status: d.preview.status, engagement: d.preview.engagement }, prep: prepCard(d.c, d.preview, d.t.name), work: PORTFOLIO.slice(0, 2).map((w) => ({ name: w.name, url: w.url, industry: w.industry, slug: w.slug })) };
      });
      return { rows: sheetOrder(rows), outcomes: OUTCOMES, target: 100, counters: { dials: 37, connects: 14, owners: 6, portals: 5, logins: 2, meetings: 1, deals: 0 }, queue: { building: 1, pending: 2 } };
    }
    if (a === "lead") {
      const d = DATA.find((x) => x.c.id === args.client_id) || DATA[0];
      return { client: d.c, preview: d.preview, calls: CALLS.filter((x) => x.client_id === d.c.id), tasks: [], portal: portalFor(d), heat: heatOf(d.c, d.preview), template: { industry_key: d.t.industry_key, name: d.t.name, version: 1 }, templates: T.map((t) => ({ industry_key: t.industry_key, name: t.name })), next: nextAction(d.c, d.preview), follow_up: followUpDraft("no_answer", { client: d.c }), reps: [], admin: true };
    }
    if (a === "leads") return { leads: DATA.map((d) => ({ ...d.c, preview: { status: d.preview.status }, next: nextAction(d.c, d.preview) })), reps: [], me: null };
    if (a === "invite_compose") return { to: "office@example.com", subject: "We built Cedar Hollow Tree Care (demo) a new website", html: "<div style='font-family:Helvetica;padding:40px'>Email preview renders on the live app (server-side house template).</div>", blockers: ["Add Interstellar's mailing address in Lead Desk › Settings (the law requires it in this email)."] };
    return {};
  }
  return undefined;
}

// Portal home for a fictional lead (QA preview of /portal/qa-l1).
export function qaLeadPortal(clientId) {
  const d = DATA.find((x) => x.c.id === clientId);
  return d ? portalFor(d) : null;
}
