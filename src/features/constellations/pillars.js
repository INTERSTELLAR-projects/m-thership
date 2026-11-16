// Constellations 1.0 — the nine sectors of a business, scored from what's done and what's missing.
// Built on Hormozi's frameworks: Grand Slam Offer + value equation ($100M Offers), the Core Four lead
// channels ($100M Leads), money models (attraction → upsell → continuity), and Acquisition.com's
// "find the constraint" approach — the weakest sector is the one holding the whole business back.

export const STATUS = {
  done: { label: "Secured", short: "✓", value: 1, color: "#3df5c8" },
  partial: { label: "In progress", short: "◐", value: 0.5, color: "#ffaa00" },
  missing: { label: "Breach", short: "✕", value: 0, color: "#ff3c00" },
  na: { label: "N/A", short: "—", value: null, color: "#6b7a80" },
};

// a() helpers read the context built in useConstellation and return a status, or null when unknown.
const has = (v) => (Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim()));
const count = (n, full, part = 1) => (n >= full ? "done" : n >= part ? "partial" : "missing");
const recent = (rows, days) => rows.filter((r) => r.date && (Date.now() - new Date(r.date).getTime()) / 864e5 <= days).length;

export const PILLARS = [
  {
    id: "command", code: "S-00", name: "COMMAND", title: "Mission & Strategy",
    principle: "Every scaling business knows its numbers, its goal and its single biggest constraint. Without a target and a scoreboard, everything else is guessing.",
    hormozi: "Acquisition.com scaling roadmap — find the constraint, fix one thing at a time.",
    gapAreas: ["other"],
    items: [
      { id: "goals_2027", label: "2027 goals set on a goals call", weight: 3, why: "No target, no plan.", a: (c) => count(c.goals.length, 3) },
      { id: "playbook", label: "2027 playbook delivered", weight: 2, why: "The written plan for the year.", a: (c) => (c.files.some((f) => /playbook/i.test(f.title || "")) ? "done" : null) },
      { id: "kpis", label: "Core numbers tracked (leads, close rate, avg ticket)", weight: 3, why: "You can't fix what you don't measure.", a: (c) => (Object.keys(c.d.kpis || {}).length >= 3 ? "done" : Object.keys(c.d.kpis || {}).length ? "partial" : null) },
      { id: "monthly_report", label: "Monthly performance report", weight: 2, why: "Shows what moved and what didn't.", a: (c) => (recent(c.work.filter((w) => w.kind === "report"), 45) ? "done" : c.work.some((w) => w.kind === "report") ? "partial" : null) },
      { id: "meeting_cadence", label: "Regular strategy meeting cadence", weight: 1, why: "Keeps the plan alive." },
      { id: "portal", label: "Client portal live", weight: 1, why: "One place to see everything.", a: (c) => (c.client.portal_enabled ? "done" : null) },
    ],
  },
  {
    id: "payload", code: "S-01", name: "PAYLOAD", title: "The Offer",
    principle: "Make an offer so good people feel stupid saying no. Value = (dream outcome × perceived likelihood) ÷ (time delay × effort). Raise the top, shrink the bottom.",
    hormozi: "$100M Offers — the Grand Slam Offer and the value equation.",
    gapAreas: [],
    items: [
      { id: "dream_outcome", label: "Dream outcome defined in the customer's words", weight: 3, why: "The thing they're really buying.", a: (c) => (has(c.d.dream_outcome) ? "done" : null) },
      { id: "core_offer", label: "Core offer named and packaged", weight: 3, why: "A named offer beats a list of services.", a: (c) => (c.d.offers?.length ? "done" : null) },
      { id: "guarantee", label: "Guarantee / risk reversal", weight: 2, why: "Raises perceived likelihood.", a: (c) => (c.d.offers?.some((o) => has(o.guarantee)) ? "done" : null) },
      { id: "bonuses", label: "Value stack / bonuses", weight: 1, why: "Makes the price feel small.", a: (c) => (c.d.offers?.some((o) => has(o.bonuses)) ? "done" : null) },
      { id: "value_pricing", label: "Priced on value, not hours", weight: 2, why: "Premium price funds premium delivery." },
      { id: "usp", label: "Clear reason to choose them (USP)", weight: 2, why: "Different beats better.", a: (c) => (has(c.d.usp) ? "done" : c.d.differentiators?.length ? "partial" : null) },
      { id: "urgency", label: "Scarcity or urgency that's real", weight: 1, why: "Gives people a reason to act now." },
    ],
  },
  {
    id: "insignia", code: "S-02", name: "INSIGNIA", title: "Brand & Identity",
    principle: "Branding is pairing your name with things people already like. A consistent look and voice makes every other pillar convert better.",
    hormozi: "$100M Leads — brand is the residue of good advertising.",
    gapAreas: ["brand"],
    items: [
      { id: "logo", label: "Professional logo (all formats)", weight: 2, why: "First impression.", a: (c) => (has(c.client.logo_url) || has(c.d.brand_identity?.logo_url) ? "done" : null) },
      { id: "brand_kit", label: "Brand kit (colors, fonts, usage)", weight: 2, why: "Consistency everywhere.", a: (c) => (c.files.some((f) => f.category === "brand_kit") ? "done" : c.d.brand_identity?.colors?.length ? "partial" : null) },
      { id: "voice", label: "Brand voice documented", weight: 2, why: "So every post and page sounds like them.", a: (c) => (c.d.brand_voice?.tone?.length && has(c.d.brand_voice?.sample) ? "done" : c.d.brand_voice?.tone?.length ? "partial" : null) },
      { id: "tagline", label: "Tagline + elevator pitch", weight: 1, why: "Say it in one breath.", a: (c) => (has(c.d.tagline) && has(c.d.elevator_pitch) ? "done" : has(c.d.tagline) || has(c.d.elevator_pitch) ? "partial" : null) },
      { id: "story", label: "Founder story captured", weight: 1, why: "People buy from people.", a: (c) => (has(c.d.story) ? "done" : null) },
      { id: "photos", label: "Real photo library (no stock)", weight: 2, why: "Real work builds trust." },
      { id: "email_domain", label: "Branded email address", weight: 1, why: "Gmail addresses cost trust.", a: (c) => { const e = (c.client.emails || [])[0] || ""; if (!e) return null; return /@(gmail|yahoo|hotmail|outlook|icloud|aol)\./i.test(e) ? "missing" : "done"; } },
    ],
  },
  {
    id: "signal", code: "S-03", name: "SIGNAL", title: "Search & AI Visibility",
    principle: "Be found when they're already looking. Content is one of the Core Four lead channels — it works while you sleep and compounds.",
    hormozi: "$100M Leads — post free content; the Core Four.",
    gapAreas: ["website", "seo"],
    items: [
      { id: "site", label: "Fast, mobile, conversion-built website", weight: 3, why: "The hub every channel points to.", a: (c) => (has(c.client.site_app_id) ? "done" : has(c.client.domain) ? "partial" : "missing") },
      { id: "service_pages", label: "A page for every core service", weight: 2, why: "One page per thing you want to rank for.", a: (c) => (c.d.services?.length ? (c.d.services.every((s) => has(s.page_url)) ? "done" : "partial") : null) },
      { id: "city_pages", label: "Pages for each target city", weight: 2, why: "Local intent needs local pages.", a: (c) => { const cs = c.d.service_area?.cities || []; if (!cs.length) return null; const live = cs.filter((x) => has(x.page_url)).length; return live >= cs.length ? "done" : live ? "partial" : "missing"; } },
      { id: "keywords", label: "Target keywords mapped to pages", weight: 2, why: "Every page has a job.", a: (c) => { const k = c.d.keywords || []; if (!k.length) return "missing"; const mapped = k.filter((x) => has(x.page_url)).length; return mapped >= k.length * 0.7 ? "done" : "partial"; } },
      { id: "blog", label: "Blog publishing on schedule", weight: 2, why: "Fresh, useful content compounds.", a: (c) => { const n = recent(c.work.filter((w) => w.kind === "blog"), 45); return n >= 4 ? "done" : n ? "partial" : c.autos.some((x) => x.kind === "blog" && x.status === "active") ? "partial" : null; } },
      { id: "gsc", label: "Search Console + Bing verified", weight: 1, why: "Index and measure.", a: (c) => (c.work.some((w) => w.kind === "search_console") && c.work.some((w) => w.kind === "bing") ? "done" : c.work.some((w) => ["search_console", "bing"].includes(w.kind)) ? "partial" : null) },
      { id: "schema", label: "Schema / structured data", weight: 1, why: "Helps Google and AI understand them.", a: (c) => (c.work.some((w) => w.kind === "schema") ? "done" : null) },
      { id: "ai_answers", label: "Shows up in AI answers (ChatGPT, Gemini, AI Overviews)", weight: 2, why: "The new front page." },
    ],
  },
  {
    id: "beacon", code: "S-04", name: "BEACON", title: "Local Map Presence",
    principle: "For a local business the map pack is where buying happens. Proximity, relevance and prominence decide who gets the call.",
    hormozi: "Be where the demand already is — then be the obvious choice there.",
    gapAreas: ["gbp"],
    items: [
      { id: "gbp", label: "Google Business Profile verified + fully filled", weight: 3, why: "The #1 local asset." },
      { id: "categories", label: "Right primary + secondary categories", weight: 2, why: "Category is the biggest map ranking factor." },
      { id: "gbp_posts", label: "GBP posts every week", weight: 2, why: "Activity signals.", a: (c) => { const n = recent(c.work.filter((w) => w.kind === "gbp_post"), 30); return n >= 4 ? "done" : n ? "partial" : null; } },
      { id: "citations", label: "Top citations listed with matching NAP", weight: 2, why: "Consistency = trust.", a: (c) => { const n = c.work.filter((w) => w.kind === "citation").length; return n >= 15 ? "done" : n ? "partial" : null; } },
      { id: "gbp_photos", label: "Fresh photos on the profile", weight: 1, why: "Profiles with photos get more calls." },
      { id: "map_rank", label: "Top 3 in the map pack for the main keyword", weight: 3, why: "Where most local clicks go." },
    ],
  },
  {
    id: "shield", code: "S-05", name: "SHIELD", title: "Proof & Reputation",
    principle: "Proof raises perceived likelihood of achievement — the top of the value equation. Reviews, testimonials and before/afters sell for you.",
    hormozi: "$100M Offers — perceived likelihood of achievement.",
    gapAreas: ["reviews"],
    items: [
      { id: "review_count", label: "Strong review count vs. competitors", weight: 3, why: "Volume is social proof.", a: (c) => (c.reviews ? (c.reviews.count >= 100 ? "done" : c.reviews.count >= 25 ? "partial" : "missing") : null) },
      { id: "rating", label: "4.7★ or better", weight: 2, why: "Below 4.5 loses clicks.", a: (c) => (c.reviews?.rating ? (c.reviews.rating >= 4.7 ? "done" : c.reviews.rating >= 4.3 ? "partial" : "missing") : null) },
      { id: "review_system", label: "Automatic review requests after every job", weight: 3, why: "Reviews should never depend on memory." },
      { id: "widget", label: "Live reviews shown on the website", weight: 1, why: "Proof at the moment of decision.", a: (c) => (c.reviews ? "done" : null) },
      { id: "responses", label: "Owner replies to every review", weight: 1, why: "Shows you care." },
      { id: "portfolio", label: "Project / before-after gallery that grows", weight: 2, why: "Show, don't tell.", a: (c) => (c.forms.some((f) => f.kind === "project_submission" && f.active !== false) ? (c.work.some((w) => w.kind === "project_page") ? "done" : "partial") : null) },
    ],
  },
  {
    id: "intercept", code: "S-06", name: "INTERCEPT", title: "Lead Capture & Sales",
    principle: "Leads are wasted without fast follow-up and a repeatable close. Speed to lead and a simple path to buy multiply every other channel.",
    hormozi: "$100M Leads — the Core Four (warm outreach, content, cold outreach, paid ads) and lead getters.",
    gapAreas: ["ads"],
    items: [
      { id: "cta", label: "One clear call to action everywhere", weight: 2, why: "Confused visitors leave." },
      { id: "capture", label: "Every form/call lands in one CRM", weight: 3, why: "No lead falls through.", a: (c) => (has(c.client.ops_app_id) ? "partial" : null) },
      { id: "speed", label: "Follow-up within 5 minutes", weight: 3, why: "Speed to lead wins the job." },
      { id: "booking", label: "Online booking / instant quote", weight: 2, why: "Remove effort for the buyer." },
      { id: "sources", label: "Lead sources tracked", weight: 1, why: "Know which channel pays.", a: (c) => (c.d.lead_sources?.length ? "done" : null) },
      { id: "core_four", label: "Using 2+ of the Core Four lead channels", weight: 2, why: "One channel is a single point of failure.", a: (c) => (c.d.lead_sources?.length >= 2 ? "done" : c.d.lead_sources?.length ? "partial" : null) },
    ],
  },
  {
    id: "engine", code: "S-07", name: "ENGINE", title: "Delivery & Operations",
    principle: "Scaling breaks the business that runs on the owner's memory. Systems, SOPs and software let quality survive growth.",
    hormozi: "Acquisition.com — productize delivery so it doesn't depend on you.",
    gapAreas: ["system", "ops"],
    items: [
      { id: "ops_app", label: "Operations software (jobs, customers, schedule)", weight: 3, why: "One source of truth.", a: (c) => (has(c.client.ops_app_id) ? "done" : null) },
      { id: "sops", label: "SOPs for the core service", weight: 2, why: "Repeatable quality.", a: (c) => (c.files.some((f) => f.category === "sop") ? "done" : null) },
      { id: "esign", label: "E-signature on quotes/contracts", weight: 1, why: "Close faster, fewer lost papers." },
      { id: "payments", label: "Invoicing + online payments", weight: 2, why: "Get paid faster." },
      { id: "client_portal", label: "Customer portal / status updates", weight: 1, why: "Fewer 'where are we at' calls." },
      { id: "automations", label: "Repetitive work automated", weight: 2, why: "Time back for the owner.", a: (c) => (c.autos.filter((x) => x.status === "active").length >= 2 ? "done" : c.autos.length ? "partial" : null) },
      { id: "software_costs", label: "Software stack consolidated", weight: 1, why: "Stop paying for five tools that overlap.", a: (c) => (c.d.tools?.length ? "partial" : null) },
    ],
  },
  {
    id: "orbit", code: "S-08", name: "ORBIT", title: "Retention & Ascension",
    principle: "The real profit is in the second, third and tenth sale. A money model — attraction offer, upsells, downsells and continuity — raises lifetime value so you can outspend competitors.",
    hormozi: "$100M Money Models — attraction, upsell, downsell, continuity.",
    gapAreas: ["social"],
    items: [
      { id: "money_model", label: "Upsell / continuity offer exists", weight: 3, why: "Lifetime value funds growth.", a: (c) => (c.d.offers?.some((o) => ["upsell", "continuity"].includes(o.kind)) ? "done" : null) },
      { id: "email_list", label: "Customer email list kept", weight: 2, why: "The asset you own." },
      { id: "email_marketing", label: "Email marketing running", weight: 2, why: "Cheapest repeat sales." },
      { id: "reactivation", label: "Past-customer reactivation", weight: 2, why: "Dormant customers are the fastest money." },
      { id: "referrals", label: "Referral program", weight: 2, why: "Best leads are referred." },
      { id: "social", label: "Social posting on a plan", weight: 1, why: "Stay top of mind." },
    ],
  },
];

export const PILLAR_BY_ID = Object.fromEntries(PILLARS.map((p) => [p.id, p]));
export const GAP_TO_PILLAR = { website: "signal", seo: "signal", gbp: "beacon", reviews: "shield", brand: "insignia", system: "engine", ops: "engine", social: "orbit", ads: "intercept", other: "command" };
const GAP_PENALTY = { high: 6, medium: 3, low: 1 };

// DEFCON: 5 = secure … 1 = critical.
export function defcon(score) {
  if (score == null) return { level: "?", label: "NO DATA", color: "#6b7a80" };
  if (score >= 85) return { level: 5, label: "SECURE", color: "#3df5c8" };
  if (score >= 70) return { level: 4, label: "STABLE", color: "#5ad1ff" };
  if (score >= 50) return { level: 3, label: "ELEVATED", color: "#ffaa00" };
  if (score >= 30) return { level: 2, label: "SEVERE", color: "#ff6a00" };
  return { level: 1, label: "CRITICAL", color: "#ff3c00" };
}

// Resolve each item: a saved status (Justin or Claude) wins; otherwise the auto check; otherwise "missing".
export function resolveItems(pillar, ctx) {
  const saved = ctx.d.pillars?.[pillar.id]?.items || {};
  return pillar.items.map((it) => {
    const s = saved[it.id];
    let auto = null;
    try { auto = it.a ? it.a(ctx) : null; } catch { auto = null; }
    const status = s?.status || auto || "missing";
    return { ...it, status, source: s?.status ? (s.by || "manual") : auto ? "auto" : "unset", note: s?.note, evidence: s?.evidence, updated_at: s?.updated_at };
  });
}

export function scorePillar(pillar, ctx) {
  const items = resolveItems(pillar, ctx);
  let got = 0, total = 0;
  for (const it of items) {
    const v = STATUS[it.status]?.value;
    if (v == null) continue;
    got += v * it.weight; total += it.weight;
  }
  const gaps = ctx.gaps.filter((g) => g.status !== "fixed" && (GAP_TO_PILLAR[g.area] || "command") === pillar.id);
  const penalty = Math.min(25, gaps.reduce((s, g) => s + (GAP_PENALTY[g.severity] || 2), 0));
  const base = total ? (got / total) * 100 : null;
  const score = base == null ? null : Math.max(0, Math.round(base - penalty));
  const unknown = items.filter((i) => i.source === "unset").length;
  return { score, items, gaps, penalty, done: items.filter((i) => i.status === "done").length, total: items.filter((i) => i.status !== "na").length, unknown };
}

// Business Brain completeness: how many of the owner questions in the client's own app (e.g. Palm Shore Ops) are
// answered. Reported by the app through client-brain ingest into ClientDossier.client_brain (real counts, summed over
// the client's apps). Skipped questions are left out of the total. null when no app reports one.
//   brain = round(100 * answered / total)
export function brainComponent(d) {
  const cb = d && d.client_brain;
  const total = Math.max(0, Math.floor(Number(cb && cb.total) || 0));
  if (!total) return null;
  const answered = Math.min(total, Math.max(0, Math.floor(Number(cb.answered) || 0)));
  return { score: Math.round((answered / total) * 100), answered, total };
}

// Business health = the mean of the components that have a score: the nine pillar scores and, when the client has a
// reporting app, Business Brain completeness as one more equal-weight component.
//   health = round( (sum of scored pillar scores + brain) / (number of scored pillars + 1) )   with a client-app brain
//   health = round(  sum of scored pillar scores          /  number of scored pillars       )   without one
// So each answered question raises health by 100 / (total questions x 10) points (about 0.2 for 45 questions, 10
// points once every question is answered). Used by scoreAll and by client-brain ingest (from the stored
// pillar_scores), so both always agree.
export function blendHealth(pillarScores, brain) {
  const vals = Object.values(pillarScores || {}).filter((v) => v != null && v !== "").map(Number).filter((v) => Number.isFinite(v)); // unscored pillars (null) don't count
  if (!vals.length) return null; // never score a client on the brain alone
  const b = brain && Number.isFinite(brain.score) ? brain.score : null;
  const sum = vals.reduce((s, v) => s + v, 0) + (b == null ? 0 : b);
  return Math.round(sum / (vals.length + (b == null ? 0 : 1)));
}

export function scoreAll(ctx) {
  /** @type {Record<string, any>} */
  const by = {};
  for (const p of PILLARS) by[p.id] = scorePillar(p, ctx);
  const brain = brainComponent(ctx.d);
  const health = blendHealth(Object.fromEntries(PILLARS.map((p) => [p.id, by[p.id].score])), brain);
  const ranked = PILLARS.filter((p) => by[p.id].score != null).sort((a, b) => by[a.id].score - by[b.id].score);
  const constraint = ranked[0] || null; // Hormozi: fix the weakest link first
  // Next moves: highest-weight breaches across the weakest sectors.
  const moves = ranked.flatMap((p) => by[p.id].items.filter((i) => i.status !== "done" && i.status !== "na").map((i) => ({ pillar: p, item: i, rank: (100 - by[p.id].score) * i.weight * (i.status === "missing" ? 1 : 0.5) })))
    .sort((a, b) => b.rank - a.rank).slice(0, 5);
  return { by, health, constraint, moves, brain };
}
