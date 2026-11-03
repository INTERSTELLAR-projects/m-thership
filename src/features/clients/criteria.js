// Client Criteria: the ONE list of facts a client profile should hold. Every generator (brand kit,
// playbook, content plan, social plan, citations, ads, Fix with AI, briefs) reads these through
// clientContext.js, and the completeness meter on the client page is computed from this list.
//
// Each field says
//   group      which card it sits in
//   weight     1-3, how much it counts toward completeness
//   unlocks    which outputs need it (a missing field blocks every output listed here)
//   stored     where it lives (shown in the meter)
//   read(ctx)  the current value, from the first source that has it (never invented)
//   write      where an inline edit / accepted enrichment is saved
//   ask        client-answerable: the flight-plan intake field key (or an inline definition) used by
//              "Send intake for missing fields"
//   enrich     Claude may propose a value from public sources (website, GBP, listings)
// Access fields record THAT access was granted (status / by / on). Never passwords.

export const OUTPUTS = [
  { key: "brand_kit", label: "Brand kit", tab: "brand" },
  { key: "playbook", label: "Playbook", tab: "playbook" },
  { key: "content_plan", label: "Content plan", tab: "content" },
  { key: "social_plan", label: "Social plan", tab: "social" },
  { key: "citations", label: "Citations & PR", tab: "citations" },
  { key: "seo", label: "SEO / HyperCare+", tab: "performance" },
  { key: "map_pack", label: "Map pack plan", tab: "mappack" },
  { key: "ads", label: "Ads", tab: "playbook" },
];
export const outputLabel = (k) => (OUTPUTS.find((o) => o.key === k) || { label: k }).label;

export const GROUPS = [
  { key: "basics", label: "Business basics" },
  { key: "brand", label: "Brand" },
  { key: "market", label: "Market" },
  { key: "goals", label: "Goals" },
  { key: "access", label: "Access granted" },
  { key: "proof", label: "Proof" },
];

/* ---------------- readers ---------------- */

export const has = (v) => {
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.some((x) => has(x));
  if (typeof v === "object") return Object.keys(v).length > 0;
  return String(v).trim() !== "";
};
const firstOf = (...vals) => vals.find((v) => has(v));
const names = (arr, key = "name") => (Array.isArray(arr) ? arr.map((x) => (typeof x === "string" ? x : x && (x[key] || x.name || x.term || x.city))).filter(Boolean) : []);
const ia = (ctx, k) => ((ctx.intake && ctx.intake.answers) || {})[k];
const fa = (ctx, k) => {
  const flights = ctx.flights && ctx.flights.length ? ctx.flights : ctx.flight ? [ctx.flight] : [];
  for (const f of flights) {
    const v = f && f.answers ? f.answers[k] : undefined;
    if (has(v)) return v;
  }
  return undefined;
};
const dos = (ctx) => ctx.dossier || {};
const op = (ctx) => ctx.outreach || {};
const kit = (ctx) => (ctx.brandKit && ctx.brandKit.kit) || {};
const cl = (ctx) => ctx.client || {};

// Access: a {status} record on a flight answer, or on the IntakeAudit answers.
function accessOf(ctx, key) {
  const v = fa(ctx, key) || ia(ctx, key);
  if (!v || typeof v !== "object") return undefined;
  return v.status === "granted" || v.status === "not_needed" ? v : undefined;
}
export const accessLabel = (v) => (v && typeof v === "object" ? `${v.status === "not_needed" ? "Not needed" : "Granted"}${v.by ? ` by ${v.by}` : ""}${v.on ? ` on ${v.on}` : ""}` : "");

/* ---------------- the list ---------------- */

const ALL_PLANS = ["brand_kit", "playbook", "content_plan", "social_plan"];

export const CRITERIA = [
  // Business basics
  { key: "public_name", group: "basics", label: "Public business name", weight: 3, unlocks: [...ALL_PLANS, "citations", "seo"], stored: "CRMClient.business / OutreachProfile.nap_name", read: (c) => firstOf(op(c).nap_name, cl(c).business), write: { to: "crm", field: "business" }, ask: "business", enrich: true },
  { key: "legal_name", group: "basics", label: "Legal name (and DBA)", weight: 1, unlocks: [], stored: "Intake answers · legal_name", read: (c) => firstOf(fa(c, "legal_name"), ia(c, "legal_name")), write: { to: "intake", field: "legal_name" }, ask: "legal_name", enrich: false },
  { key: "industry", group: "basics", label: "Industry / trade", weight: 3, unlocks: [...ALL_PLANS, "citations", "seo", "ads"], stored: "CRMClient.industry", read: (c) => firstOf(cl(c).industry, op(c).industry, ia(c, "industry")), write: { to: "crm", field: "industry" }, ask: "industry", enrich: true },
  { key: "description", group: "basics", label: "Short description (who they help, with what)", weight: 2, unlocks: ["brand_kit", "citations"], stored: "ClientDossier.elevator_pitch / OutreachProfile.description", read: (c) => firstOf(dos(c).elevator_pitch, op(c).description, dos(c).tagline), write: { to: "dossier", path: "elevator_pitch" }, ask: { type: "long_text", label: "In one or two sentences: who you help, with what, and the result" }, enrich: true },
  { key: "services", group: "basics", label: "Services / products", weight: 3, unlocks: [...ALL_PLANS, "citations", "seo", "ads", "map_pack"], stored: "ClientDossier.services", read: (c) => firstOf(names(dos(c).services), op(c).services, fa(c, "services_list"), ia(c, "services")), write: { to: "dossier", path: "services", list: "name" }, ask: "services_list", enrich: true },
  { key: "service_areas", group: "basics", label: "Service areas / cities", weight: 3, unlocks: ["playbook", "content_plan", "citations", "seo", "ads", "map_pack"], stored: "ClientDossier.service_area", read: (c) => { const sa = dos(c).service_area || {}; return firstOf(names(sa.cities, "city"), sa.primary_city, op(c).service_area, fa(c, "service_areas"), ia(c, "locations")); }, write: { to: "dossier", path: "service_area.cities", list: "city" }, ask: "service_areas", enrich: true },
  { key: "nap_address", group: "basics", label: "Public address (NAP)", weight: 2, unlocks: ["citations", "seo", "map_pack"], stored: "OutreachProfile.nap_address", read: (c) => firstOf(op(c).nap_address, fa(c, "address"), ia(c, "contact")), write: { to: "outreach", field: "nap_address" }, ask: "address", enrich: true },
  { key: "nap_phone", group: "basics", label: "Public phone (NAP)", weight: 2, unlocks: ["citations", "seo", "map_pack"], stored: "OutreachProfile.nap_phone / CRMClient.phones", read: (c) => firstOf(op(c).nap_phone, fa(c, "public_phone"), (cl(c).phones || [])[0]), write: { to: "outreach", field: "nap_phone" }, ask: "public_phone", enrich: true },
  { key: "hours", group: "basics", label: "Business hours", weight: 1, unlocks: ["citations", "seo"], stored: "OutreachProfile.hours / intake hours", read: (c) => firstOf(op(c).hours, fa(c, "hours"), ia(c, "hours")), write: { to: "outreach", field: "hours" }, ask: "hours", enrich: true },
  { key: "website", group: "basics", label: "Website", weight: 3, unlocks: ["playbook", "content_plan", "citations", "seo", "ads"], stored: "CRMClient.domain", read: (c) => firstOf(cl(c).domain, (cl(c).websites || [])[0], op(c).website), write: { to: "crm", field: "domain" }, ask: null, enrich: false },
  { key: "booking_link", group: "basics", label: "Booking / quote link", weight: 1, unlocks: ["ads"], stored: "Intake answers · booking_link", read: (c) => firstOf(ia(c, "booking_link"), fa(c, "booking_link")), write: { to: "intake", field: "booking_link" }, ask: { type: "short_text", label: "Link where customers book or request a quote (if you have one)" }, enrich: true },

  // Brand
  { key: "logo", group: "brand", label: "Logo", weight: 2, unlocks: ["brand_kit", "social_plan"], stored: "CRMClient.logo_url", read: (c) => firstOf(cl(c).logo_url, (dos(c).brand_identity || {}).logo_url, kit(c).logo && kit(c).logo.primary_url), write: { to: "crm", field: "logo_url" }, ask: "logo", enrich: false },
  { key: "colors", group: "brand", label: "Brand colors", weight: 2, unlocks: ["brand_kit", "social_plan"], stored: "ClientDossier.brand_identity.colors / approved brand kit", read: (c) => firstOf((dos(c).brand_identity || {}).colors, (kit(c).palette || []).map((p) => p && p.hex).filter(Boolean), fa(c, "brand_colors"), ia(c, "colors_fonts")), write: { to: "dossier", path: "brand_identity.colors", list: true }, ask: "brand_colors", enrich: true },
  { key: "fonts", group: "brand", label: "Fonts", weight: 1, unlocks: [], stored: "ClientDossier.brand_identity.fonts / approved brand kit", read: (c) => { const ty = kit(c).typography || {}; return firstOf((dos(c).brand_identity || {}).fonts, [ty.headings && ty.headings.family, ty.body && ty.body.family].filter(Boolean).join(" + "), fa(c, "brand_fonts")); }, write: { to: "dossier", path: "brand_identity.fonts" }, ask: "brand_fonts", enrich: true },
  { key: "voice", group: "brand", label: "Brand voice / tagline", weight: 2, unlocks: ["brand_kit", "social_plan", "content_plan"], stored: "ClientDossier.brand_voice / approved brand kit", read: (c) => firstOf((dos(c).brand_voice || {}).personality, (dos(c).brand_voice || {}).tone, kit(c).voice && kit(c).voice.personality, fa(c, "voice"), ia(c, "tagline_voice")), write: { to: "dossier", path: "brand_voice.personality" }, ask: "voice", enrich: false },
  { key: "photos", group: "brand", label: "Real photos (library or folder link)", weight: 1, unlocks: [], stored: "Flight / intake photos, ClientFile", read: (c) => firstOf(fa(c, "photos"), ia(c, "photos"), (c.files || []).filter((f) => ["social", "design"].includes(f.category)).map((f) => f.title)), write: { to: "intake", field: "photos" }, ask: "photos", enrich: false },

  // Market
  { key: "ideal_customer", group: "market", label: "Ideal customer", weight: 2, unlocks: ["brand_kit", "playbook", "social_plan"], stored: "ClientDossier.audience.ideal_customer", read: (c) => firstOf((dos(c).audience || {}).ideal_customer, ia(c, "ideal_customer")), write: { to: "dossier", path: "audience.ideal_customer" }, ask: { type: "long_text", label: "Who is your ideal customer?" }, enrich: false },
  { key: "competitors", group: "market", label: "Competitors", weight: 2, unlocks: ["playbook", "seo"], stored: "ClientDossier.competitors", read: (c) => firstOf(names(dos(c).competitors), fa(c, "competitors"), ia(c, "competitors")), write: { to: "dossier", path: "competitors", list: "name" }, ask: "competitors", enrich: true },
  { key: "keywords", group: "market", label: "Target keywords", weight: 2, unlocks: ["content_plan", "seo", "ads"], stored: "ClientDossier.keywords (keyword steward) / intake", read: (c) => firstOf(names(dos(c).keywords, "term"), fa(c, "keywords"), ia(c, "keywords")), write: { to: "intake", field: "keywords" }, ask: "keywords", enrich: false },
  { key: "differentiators", group: "market", label: "Differentiators (why them)", weight: 2, unlocks: ["brand_kit", "playbook", "social_plan"], stored: "ClientDossier.differentiators / usp", read: (c) => firstOf(dos(c).differentiators, dos(c).usp, ia(c, "why_choose")), write: { to: "dossier", path: "differentiators", list: true }, ask: { type: "long_text", label: "Why do customers choose you over anyone else?" }, enrich: true },
  { key: "pricing_ranges", group: "market", label: "Pricing ranges / average ticket", weight: 1, unlocks: ["ads"], stored: "ClientDossier.offers / intake avg_ticket", read: (c) => firstOf((dos(c).offers || []).map((o) => (o && o.price ? `${o.name || "Offer"}: ${o.price}` : "")).filter(Boolean), ia(c, "avg_ticket"), ia(c, "pricing")), write: { to: "intake", field: "pricing" }, ask: { type: "short_text", label: "Typical price range or average job value" }, enrich: false },

  // Goals
  { key: "goal_12mo", group: "goals", label: "12-month goal", weight: 3, unlocks: ["playbook", "content_plan", "social_plan", "ads"], stored: "ClientGoal / intake goal_12mo / dossier dream outcome", read: (c) => firstOf((c.goals || []).map((g) => g.title), ia(c, "goal_12mo"), fa(c, "goals"), dos(c).dream_outcome), write: { to: "intake", field: "goal_12mo" }, ask: "goals", enrich: false },
  { key: "kpis", group: "goals", label: "KPIs with real numbers", weight: 2, unlocks: ["playbook", "ads"], stored: "ClientGoal (metric + target) / dossier KPIs", read: (c) => firstOf((c.goals || []).filter((g) => g.metric || g.target_value != null).map((g) => `${g.metric || g.title}: ${g.current_value ?? "?"} → ${g.target_value ?? "?"} ${g.unit || ""}`.trim()), has(dos(c).kpis) ? Object.keys(dos(c).kpis) : null), write: { to: "tab", tab: "goals" }, ask: null, enrich: false },
  { key: "budget_capacity", group: "goals", label: "Budget / capacity", weight: 1, unlocks: ["ads"], stored: "Intake answers · capacity / budget", read: (c) => firstOf(ia(c, "budget"), ia(c, "capacity")), write: { to: "intake", field: "budget" }, ask: { type: "short_text", label: "Monthly marketing budget and how many new jobs you can take on" }, enrich: false },

  // Access (records only)
  { key: "access_gbp", group: "access", label: "Google Business Profile", weight: 2, unlocks: ["seo", "map_pack"], stored: "Onboarding flight access record", read: (c) => accessOf(c, "access_gbp"), write: { to: "access" }, ask: "access_gbp", enrich: false, access: true },
  { key: "access_gsc", group: "access", label: "Search Console", weight: 2, unlocks: ["seo"], stored: "Onboarding flight access record", read: (c) => accessOf(c, "access_gsc"), write: { to: "access" }, ask: "access_gsc", enrich: false, access: true },
  { key: "access_ga4", group: "access", label: "Google Analytics 4", weight: 2, unlocks: ["seo", "ads"], stored: "Onboarding flight access record", read: (c) => accessOf(c, "access_ga4"), write: { to: "access" }, ask: "access_ga4", enrich: false, access: true },
  { key: "access_bing", group: "access", label: "Bing / Apple Business Connect", weight: 1, unlocks: ["seo"], stored: "Onboarding flight access record", read: (c) => accessOf(c, "access_bing"), write: { to: "access" }, ask: "access_bing", enrich: false, access: true },
  { key: "access_socials", group: "access", label: "Social accounts", weight: 1, unlocks: [], stored: "Onboarding flight access record", read: (c) => accessOf(c, "access_socials"), write: { to: "access" }, ask: "access_socials", enrich: false, access: true },

  // Proof
  { key: "reviews_link", group: "proof", label: "Google reviews link", weight: 2, unlocks: ["seo", "social_plan"], stored: "Stärboard (ReviewClient) / intake", read: (c) => { const r = c.review || null; const cache = (r && r.cache) || {}; return firstOf(cache.reviewUrl, r && r.place_id ? `https://search.google.com/local/writereview?placeid=${r.place_id}` : "", ia(c, "reviews_link")); }, write: { to: "intake", field: "reviews_link" }, ask: { type: "short_text", label: "Link to your Google reviews (if you have it)" }, enrich: true },
  { key: "certifications", group: "proof", label: "Licenses / certifications", weight: 1, unlocks: [], stored: "Intake answers · licenses", read: (c) => firstOf(fa(c, "licenses"), ia(c, "licenses")), write: { to: "intake", field: "licenses" }, ask: "licenses", enrich: true },
  { key: "awards", group: "proof", label: "Awards / press", weight: 1, unlocks: [], stored: "Intake answers · awards", read: (c) => ia(c, "awards"), write: { to: "intake", field: "awards" }, ask: { type: "long_text", label: "Awards, press mentions or associations" }, enrich: true },
  { key: "case_studies", group: "proof", label: "Case studies / featured jobs", weight: 1, unlocks: [], stored: "Intake answers · case_studies", read: (c) => firstOf(ia(c, "case_studies"), fa(c, "reviews")), write: { to: "intake", field: "case_studies" }, ask: { type: "long_text", label: "Two or three jobs you're proud of (what, where, result)" }, enrich: false },
];

export const criterionByKey = (k) => CRITERIA.find((f) => f.key === k) || null;

/* ---------------- evaluation ---------------- */

export function displayValue(v, max = 220) {
  if (!has(v)) return "";
  let s;
  if (Array.isArray(v)) s = v.map((x) => (typeof x === "object" && x ? x.name || x.term || x.city || JSON.stringify(x) : x)).filter(Boolean).join(", ");
  else if (typeof v === "object") s = v.status ? accessLabel(v) : JSON.stringify(v);
  else s = String(v);
  s = s.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function evaluateCriteria(ctx) {
  const items = CRITERIA.map((f) => {
    let value;
    try { value = f.read(ctx); } catch { value = undefined; }
    return { ...f, value, filled: has(value) };
  });
  const total = items.reduce((n, i) => n + i.weight, 0);
  const got = items.filter((i) => i.filled).reduce((n, i) => n + i.weight, 0);
  const groups = GROUPS.map((g) => {
    const list = items.filter((i) => i.group === g.key);
    const t = list.reduce((n, i) => n + i.weight, 0);
    const d = list.filter((i) => i.filled).reduce((n, i) => n + i.weight, 0);
    return { ...g, items: list, pct: t ? Math.round((d / t) * 100) : 0, missing: list.filter((i) => !i.filled) };
  });
  const outputs = OUTPUTS.map((o) => {
    const need = items.filter((i) => i.unlocks.includes(o.key));
    const blockers = need.filter((i) => !i.filled);
    return { ...o, ready: blockers.length === 0, blockers, need };
  });
  return { items, groups, outputs, pct: total ? Math.round((got / total) * 100) : 0, missing: items.filter((i) => !i.filled) };
}

export const completenessPct = (ctx) => evaluateCriteria(ctx).pct;
