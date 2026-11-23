// Lead Engine (Nov 2026): industry templates, the lead preview builder and clearly-labeled sample data.
// Pure JS, no imports. This exact file lives twice, byte-identical:
//   src/lib/leadEngine.js        (Templates page, Lead Finder, previews, QA fixtures)
//   base44/shared/leadEngine.js  (lead-engine and lead-finder functions)
// Edit one, copy it over the other (tests/unit/leadEngine.test.js checks they match).
//
// Truth rule: a template never carries a review, rating, award, count or result. The preview only shows a rating or a
// review count when the scrape found it on the business's own Google Business Profile. Sample data in the Command
// System preview is fictional and always labeled "Sample data".

export const ENGINE_VERSION = 1;

// The Interstellar build foundation every template and preview runs on (Playbooks › Website build — foundation v2,
// plus AgencyKnowledge "build_standard").
export const FOUNDATION = {
  title: "Interstellar build foundation",
  link: "/playbooks",
  standard_key: "build_standard",
  prompt_title: "Website build — foundation v2",
  rules: [
    "Hook first: the hero says who it's for, what they get and where, with one main action.",
    "Hero reveal: the headline rises in word by word; the rest reveals one section at a time as it scrolls in.",
    "One idea per section, one section at a time. No walls of cards.",
    "Designed states everywhere: empty, loading, error and success. No dead ends.",
    "References, not templates: this is a starting structure; the client's own photos, words and brand lead.",
    "Truth: never invent a review, rating, number, award or result. Missing facts stay missing or become a marked slot.",
    "Search titles 25–55 characters and descriptions 100–120, so they read in full on mobile and desktop.",
    "Footer credit: Web design by Interstellar Strategies, linking to interstellar-strategies.com.",
    "Reduced-motion fallback on every animation; content readable without scripts.",
  ],
};

export const SEO_LIMITS = { title: [25, 55], description: [100, 120] };

// Type pairs the website preview can load (Google Fonts). Display + body.
export const TYPE_PAIRS = {
  archivo: { display: "Archivo", body: "Inter", note: "Sturdy, confident, trade-ready" },
  fraunces: { display: "Fraunces", body: "Inter", note: "Warm editorial serif, premium" },
  barlow: { display: "Barlow Condensed", body: "Barlow", note: "Bold condensed, energetic" },
  dmserif: { display: "DM Serif Display", body: "DM Sans", note: "High-contrast serif, crafted" },
  grotesk: { display: "Space Grotesk", body: "Inter", note: "Modern, technical, clean" },
  cormorant: { display: "Cormorant Garamond", body: "Inter", note: "Refined, calm, luxury" },
};

/* ------------------------------------------------------------------------------------------------------------- */
/* Families: shared structure for industries that sell the same way.                                              */
/* ------------------------------------------------------------------------------------------------------------- */

const SECTIONS = {
  trade: [
    ["hero", "hero", "Hero", "Who it's for, what they get, where. Call + quote buttons."],
    ["trust", "trust", "Trust bar", "Real Google rating (only if found), service area, licensed/insured slot to confirm."],
    ["services", "services", "Services", "Their real services first, one card each, linking to a service page."],
    ["process", "process", "How it works", "Three or four plain steps from first call to done."],
    ["gallery", "gallery", "Recent work", "Their own job photos. Marked slots until we have them."],
    ["about", "about", "About", "The owner and crew, in their words. A real photo beats any graphic."],
    ["reviews", "reviews", "Reviews", "Their live Google reviews stream here. Never written by us."],
    ["area", "area", "Service area", "Cities and counties they serve, for local search."],
    ["faq", "faq", "FAQ", "Questions customers ask on the phone, answered once."],
    ["cta", "cta", "Call to action", "One last clear ask: call or request a quote."],
    ["contact", "contact", "Contact", "One-question-at-a-time form that drops into the Command System."],
  ],
  beauty: [
    ["hero", "hero", "Hero", "The vibe of the place in one image and one line. Book button."],
    ["trust", "trust", "Trust bar", "Real Google rating (only if found), location, hours."],
    ["services", "services", "Services", "What they do, with starting prices only if the owner gives them."],
    ["team", "team", "The team", "Artists, barbers or providers, each with their own work."],
    ["gallery", "gallery", "Portfolio", "Their own work. Marked slots until we have it."],
    ["reviews", "reviews", "Reviews", "Their live Google reviews stream here. Never written by us."],
    ["visit", "visit", "Visit", "Address, hours, parking, map."],
    ["faq", "faq", "FAQ", "Booking, deposits, prep and aftercare questions."],
    ["cta", "cta", "Book", "One last clear ask: book now."],
    ["contact", "contact", "Contact", "One-question-at-a-time form or booking hand-off."],
  ],
  food: [
    ["hero", "hero", "Hero", "The best real photo of the food or the place. Order or visit button."],
    ["trust", "trust", "Trust bar", "Real Google rating (only if found), hours today, location."],
    ["menu", "services", "Menu highlights", "What people come for. Full menu linked."],
    ["about", "about", "Our story", "Who makes it and why, in their words."],
    ["gallery", "gallery", "Gallery", "Their own photos. Marked slots until we have them."],
    ["reviews", "reviews", "Reviews", "Their live Google reviews stream here. Never written by us."],
    ["visit", "visit", "Visit us", "Address, hours, parking, map."],
    ["faq", "faq", "FAQ", "Orders, catering, allergies and events."],
    ["cta", "cta", "Order", "One last clear ask: order, pre-order or visit."],
    ["contact", "contact", "Contact", "Catering and event requests, one question at a time."],
  ],
  coach: [
    ["hero", "hero", "Hero", "Who they coach and the change they help with. Apply button."],
    ["trust", "trust", "Trust bar", "Real Google rating (only if found), where they coach, in person or online."],
    ["services", "services", "Programs", "Each way to work with them, one card each."],
    ["process", "process", "How it works", "Apply, consult, start, check in."],
    ["about", "about", "Your coach", "The coach's story and approach, in their words."],
    ["gallery", "gallery", "Client results", "Only real, permissioned before-and-afters. Marked slots until then."],
    ["reviews", "reviews", "Reviews", "Their live Google reviews stream here. Never written by us."],
    ["faq", "faq", "FAQ", "Cost, time, check-ins and what's included."],
    ["cta", "cta", "Apply", "One last clear ask: apply or book a consult."],
    ["contact", "contact", "Apply", "One-question-at-a-time application that lands in the Command System."],
  ],
  property: [
    ["hero", "hero", "Hero", "Who they serve (owners, renters, buyers) and where. Main action."],
    ["trust", "trust", "Trust bar", "Real Google rating (only if found), markets served."],
    ["services", "services", "Services", "Each service, one card each."],
    ["owners", "process", "For owners", "How working with them goes, step by step."],
    ["about", "about", "About", "The team and how they work, in their words."],
    ["reviews", "reviews", "Reviews", "Their live Google reviews stream here. Never written by us."],
    ["area", "area", "Markets", "Cities and neighborhoods they cover."],
    ["faq", "faq", "FAQ", "Fees, contracts, reporting and maintenance."],
    ["cta", "cta", "Call to action", "One last clear ask: get a rental analysis or call."],
    ["contact", "contact", "Contact", "One-question-at-a-time form that drops into the Command System."],
  ],
  health: [
    ["hero", "hero", "Hero", "Calm, clear, welcoming. Book an appointment button."],
    ["trust", "trust", "Trust bar", "Real Google rating (only if found), location, new patients welcome slot."],
    ["services", "services", "Services", "Each treatment, one card each, no medical claims."],
    ["process", "process", "Your first visit", "What happens from booking to follow-up."],
    ["team", "team", "The team", "Providers, with credentials the practice confirms."],
    ["reviews", "reviews", "Reviews", "Their live Google reviews stream here. Never written by us."],
    ["visit", "visit", "Visit", "Address, hours, parking, map."],
    ["faq", "faq", "FAQ", "Insurance, payment, first visit and emergencies."],
    ["cta", "cta", "Book", "One last clear ask: book a visit."],
    ["contact", "contact", "Contact", "One-question-at-a-time request form."],
  ],
};

const PROCESS = {
  trade: [["Call or request a quote", "Tell us what you need. We reply fast."], ["On-site look", "We see the job, answer questions and give a clear price."], ["The work", "Scheduled when it suits you, done right, cleaned up after."], ["Follow-up", "We check you're happy and send your invoice."]],
  beauty: [["Book online", "Pick a time that works."], ["Consult", "Talk through what you want."], ["Your appointment", "Sit back. We take it from here."], ["Rebook", "Lock in your next visit before you leave."]],
  food: [["Browse the menu", "See what's fresh today."], ["Order or pre-order", "In person, by phone or online."], ["Pick up or stay", "Grab it to go or stay a while."]],
  coach: [["Apply", "A few questions so we know your goal."], ["Consult", "A short call to see if it's a fit."], ["Start", "Your plan, your check-ins, your coach."], ["Check in", "Progress reviewed and the plan adjusted."]],
  property: [["Free rental analysis", "We look at your property and the market."], ["Onboarding", "Listing, photos, pricing and paperwork."], ["Hands-off management", "Tenants, rent and maintenance handled."], ["Owner reporting", "Clear statements every month."]],
  health: [["Book", "Choose a time online or call."], ["First visit", "Exam, questions answered, a clear plan."], ["Treatment", "Comfortable, explained, at your pace."], ["Follow-up", "Reminders so nothing slips."]],
};

const MODULES = {
  trade: [["dashboard", "Dashboard"], ["pipeline", "Leads & estimates"], ["schedule", "Jobs & schedule"], ["customers", "Customers"], ["invoices", "Invoices"], ["reviews", "Review funnel"], ["pricing", "Pricing engine"]],
  beauty: [["dashboard", "Dashboard"], ["schedule", "Appointments"], ["customers", "Clients"], ["pipeline", "Inquiries"], ["invoices", "Payments"], ["reviews", "Review funnel"]],
  food: [["dashboard", "Dashboard"], ["schedule", "Orders & pre-orders"], ["pipeline", "Catering & events"], ["customers", "Customers"], ["invoices", "Invoices"], ["reviews", "Review funnel"]],
  coach: [["dashboard", "Dashboard"], ["pipeline", "Applications"], ["customers", "Clients"], ["schedule", "Check-ins"], ["invoices", "Payments"], ["reviews", "Testimonials"]],
  property: [["dashboard", "Dashboard"], ["pipeline", "Owner leads"], ["schedule", "Maintenance & turnovers"], ["customers", "Owners"], ["invoices", "Statements & invoices"], ["reviews", "Review funnel"]],
  health: [["dashboard", "Dashboard"], ["schedule", "Appointments"], ["customers", "Patients"], ["pipeline", "New patient requests"], ["invoices", "Payments"], ["reviews", "Review funnel"]],
};

const PIPELINES = {
  trade: ["New lead", "Estimate sent", "Scheduled", "In progress", "Invoiced", "Paid"],
  beauty: ["Inquiry", "Booked", "Visited", "Rebooked", "Regular"],
  food: ["Request", "Quote sent", "Confirmed", "Prepared", "Paid"],
  coach: ["Applied", "Consult booked", "Onboarding", "Active", "Renewal"],
  property: ["New owner lead", "Analysis sent", "Agreement", "Onboarding", "Managed"],
  health: ["Request", "Booked", "Seen", "Treatment plan", "Recall"],
};

const KPIS = {
  trade: [["revenue_mtd", "Revenue this month", "money"], ["open_estimates", "Open estimates", "money"], ["jobs_week", "Jobs this week", "count"], ["close_rate", "Estimate close rate", "pct"]],
  beauty: [["revenue_mtd", "Revenue this month", "money"], ["appointments_week", "Appointments this week", "count"], ["rebook_rate", "Rebook rate", "pct"], ["new_clients", "New clients this month", "count"]],
  food: [["revenue_mtd", "Orders this month", "money"], ["preorders", "Open pre-orders", "count"], ["catering", "Catering requests", "count"], ["avg_ticket", "Average order", "money"]],
  coach: [["mrr", "Monthly coaching revenue", "money"], ["active_clients", "Active clients", "count"], ["checkins_due", "Check-ins due", "count"], ["applications", "New applications", "count"]],
  property: [["doors", "Doors managed", "count"], ["revenue_mtd", "Fees this month", "money"], ["open_requests", "Open maintenance", "count"], ["owner_leads", "Owner leads", "count"]],
  health: [["revenue_mtd", "Production this month", "money"], ["appointments_week", "Appointments this week", "count"], ["new_patients", "New patients", "count"], ["recall_due", "Recalls due", "count"]],
};

const ENTITIES = {
  trade: [["Lead", "name, phone, address, service, source, stage"], ["Estimate", "lead, line items, total, status"], ["Job", "customer, date, crew, status, photos"], ["Invoice", "job, amount, status, paid_at"], ["ReviewRequest", "customer, sent_at, clicked"]],
  beauty: [["Appointment", "client, service, provider, start, status"], ["Client", "name, phone, last visit, notes"], ["Service", "name, duration, price"], ["Payment", "appointment, amount, tip"]],
  food: [["Order", "customer, items, pickup time, status"], ["CateringRequest", "event date, guests, menu, quote"], ["MenuItem", "name, category, price, seasonal"], ["Customer", "name, phone, loyalty"]],
  coach: [["Application", "name, goal, experience, status"], ["Client", "program, start, coach, status"], ["CheckIn", "client, date, weight, notes"], ["Payment", "client, amount, period"]],
  property: [["OwnerLead", "name, property, units, stage"], ["Property", "address, owner, units, status"], ["MaintenanceRequest", "property, issue, vendor, status"], ["Statement", "owner, month, income, fees"]],
  health: [["Appointment", "patient, provider, type, start"], ["Patient", "name, phone, last visit, recall due"], ["TreatmentPlan", "patient, items, status"], ["Payment", "patient, amount, method"]],
};

const NOUNS = {
  trade: { job: "Job", customer: "Customer", money: "Estimate" },
  beauty: { job: "Appointment", customer: "Client", money: "Payment" },
  food: { job: "Order", customer: "Customer", money: "Order" },
  coach: { job: "Check-in", customer: "Client", money: "Payment" },
  property: { job: "Work order", customer: "Owner", money: "Statement" },
  health: { job: "Appointment", customer: "Patient", money: "Payment" },
};

/* ------------------------------------------------------------------------------------------------------------- */
/* Real Interstellar builds used as references (admin-only screens; never shown to a lead).                       */
/* ------------------------------------------------------------------------------------------------------------- */

const REF = {
  north_woods: { name: "North Woods Tree Service", client_id: "69d884d38fe4bacbc82853ac", url: "https://nwtreeremoval.com", site_app_id: "6ada89d4b43ce0a3b309bdd4", command_app_id: "6ae7f007468f8e33b0d4ee8e", note: "Tree removal, land clearing and tree care · Clackamas, Multnomah & Washington Counties" },
  mowmasters: { name: "MowMasters of Ascension", client_id: "69d884d3501897bd1df0794c", url: "https://mowmastersofascension.com", site_app_id: "6ad15b374013f4b32c9e0dbf", command_app_id: "6a7667e1101d735a2639c070", note: "Commercial & residential landscaping · Ascension Parish, LA" },
  palm_shore: { name: "Palm Shore Hardscapes & Design", client_id: "6a7e0ed45a3ed5aeb6868401", url: "https://palmshorehardscapes.com", site_app_id: "6ad6656739d901d4b84d43bb", command_app_id: "6abb58e697456bf5c1066b00", note: "Luxury hardscape design & build · Bluffton, SC · cost-of-operations pricing engine" },
  powerlift: { name: "PowerLift Doors of Oregon", client_id: "6a6c13548653b2e1e6c3de46", url: "https://oregonpowerlift.com", site_app_id: "6a88eef3dc9768005ce14d52", command_app_id: "6a979c9d3e198e037169dc29", note: "Custom hydraulic doors · Oregon, Western Idaho, SW Washington" },
  royalz: { name: "Royalz Barbers", client_id: "6a39ca29c61bf8a49ef76324", url: "https://royalzbarbers.com", site_app_id: "6adffb06ba5d498a8bc187ef", command_app_id: "", note: "Barbershop, two locations (Molalla + Oregon City) · Fresha booking" },
  arcane: { name: "Arcane Ink", client_id: "69d884d3aa7b854da8a12614", url: "https://arcaneinkriverside.com", site_app_id: "6ad812b1497f8aa46878f75c", command_app_id: "6ae0df18290948bda816abca", note: "Tattoo & piercing studio · Riverside, CA" },
  muscle_mentor: { name: "Muscle Mentor Coaching", client_id: "69d884d3049d808969e477d1", url: "https://musclementorcoaching.com", site_app_id: "6adff6c67611f68976c4f3ad", command_app_id: "6aecd94adca24ae719d602c6", note: "In-person & online fitness coaching · Rincon, GA" },
  chasing_gains: { name: "Chasing Gains Coaching", client_id: "69d884d3dd31b39b6a77c7cd", url: "https://chasinggains.net", site_app_id: "6adff7f3ca971053f1a61299", command_app_id: "", note: "Online fitness & nutrition coaching · worldwide" },
  smallcakes: { name: "Smallcakes Baton Rouge", client_id: "6aebc2933e7ada5fece300d8", url: "https://cupcakesbatonrouge.com", site_app_id: "6adaaf560c31e6bd84beb6a5", command_app_id: "6aed0686b972e82d323bad64", note: "Cupcakery, king cakes & ice cream · Baton Rouge, LA" },
  bobablastic: { name: "Bobablastic (Molalla)", client_id: "6a28bfea1bde8e3ea488f04d", url: "https://bobablasticmolalla.com", site_app_id: "6ae00354a339c9f27e784852", command_app_id: "6a35c8ee1fc2c281e7f76204", note: "Boba & smoothie shop (franchise location) · Molalla, OR" },
  bulba: { name: "The Bulba Bros", client_id: "6a3c9320b05f612c08347d74", url: "https://thebulbabros.com", site_app_id: "6ae00af8af9f9124ad5c0b14", command_app_id: "6ae00af8af9f9124ad5c0b14", note: "Pokémon trading card shop · Molalla, OR" },
  velocity: { name: "Velocity Business Solutions", client_id: "6a6c13fd03bab4ff324fce0a", url: "https://govelocity.com", site_app_id: "6a9f090a5efd129c938b4139", command_app_id: "", note: "Merchant services (payment processing) · nationwide" },
  uplift: { name: "Uplift Aviation", client_id: "69d884d371b4c51f98cc3335", url: "https://upliftaviationllc.com", site_app_id: "", command_app_id: "", note: "Aircraft brokerage · former client (win-back)" },
  suite_spotz: { name: "Suite Spotz", client_id: "", url: "https://suitespotz.com", site_app_id: "", command_app_id: "", note: "Short-term rental management · spec website in progress" },
};

/* ------------------------------------------------------------------------------------------------------------- */
/* The seed library. Starting content only: Justin, the team and agents refine it on the Templates page.          */
/* ------------------------------------------------------------------------------------------------------------- */

const SEED = [
  { key: "tree_service", name: "Tree service", category: "Home services & outdoor trades", family: "trade", niche: "home_service", schema: "HomeAndConstructionBusiness", query: "tree service",
    match: ["tree", "arborist", "stump", "land clearing"], services: ["Tree removal", "Tree trimming & pruning", "Stump grinding", "Storm cleanup", "Land clearing", "Arborist assessments"],
    palette: ["Forest", "#2f5d3a", "#c8792b", "#16201a", "#f4f1ea"], type: "archivo", refs: ["north_woods"], status: "refining",
    hero: ["Tree work in {city}, done safely.", "{city}'s tree crew for removals, trimming and cleanup.", "Big trees. Tight spaces. Handled."],
    faq: [["Do I need a permit to remove a tree?", "Some cities require one. We'll tell you on the estimate and help with the paperwork."], ["Do you haul everything away?", "Cleanup is part of the job. Ask about keeping firewood or chips."], ["Can you handle storm emergencies?", "Call us and we'll tell you how fast we can get there."]] },
  { key: "landscaping", name: "Landscaping & lawn care", category: "Home services & outdoor trades", family: "trade", niche: "home_service", schema: "HomeAndConstructionBusiness", query: "landscaping company",
    match: ["landscap", "lawn", "mowing", "grounds"], services: ["Lawn care & mowing", "Landscape design", "Seasonal cleanups", "Mulch & planting", "Irrigation", "Commercial grounds"],
    palette: ["Fresh green", "#3d6b2f", "#e0a526", "#172113", "#f5f3ec"], type: "archivo", refs: ["mowmasters"], status: "refining",
    hero: ["Landscaping in {city} that stays sharp.", "Yards and grounds in {city}, kept right.", "Curb appeal, on a schedule."],
    faq: [["Do you offer recurring service?", "Yes. Weekly, bi-weekly or seasonal plans, set on the first visit."], ["Do you do commercial properties?", "Ask about grounds maintenance for businesses and HOAs."], ["What areas do you cover?", "See the service area below, or call and ask."]] },
  { key: "hardscaping", name: "Hardscaping & outdoor living", category: "Home services & outdoor trades", family: "trade", niche: "home_service", schema: "GeneralContractor", query: "hardscaping contractor",
    match: ["hardscap", "paver", "patio", "retaining wall", "outdoor kitchen", "pool deck"], services: ["Paver patios", "Pool decks", "Outdoor kitchens", "Retaining walls", "Fire features", "Walkways & driveways"],
    palette: ["Stone", "#3b3a36", "#b8834a", "#151413", "#f3efe8"], type: "fraunces", refs: ["palm_shore"], status: "refining",
    hero: ["Outdoor living in {city}, built to last.", "Patios, pool decks and outdoor kitchens in {city}.", "Your backyard, designed and built."],
    faq: [["Do you design and build?", "Yes. Design, materials and the build, managed in one place."], ["How long does a project take?", "It depends on size and permits. You get a timeline with your proposal."], ["Do you help pick materials?", "We'll walk you through pavers, stone and finishes that fit the space."]] },
  { key: "roofing", name: "Roofing", category: "Home services & outdoor trades", family: "trade", niche: "home_service", schema: "RoofingContractor", query: "roofing contractor",
    match: ["roof", "gutter", "shingle"], services: ["Roof replacement", "Roof repair", "Storm damage inspections", "Gutters", "Commercial roofing", "Roof maintenance"],
    palette: ["Slate & brick", "#1f2a37", "#d4492b", "#11161d", "#f2f0ec"], type: "archivo", refs: [], status: "draft",
    hero: ["Roofing in {city}, done right the first time.", "{city} roof repair and replacement.", "A roof you don't have to think about."],
    faq: [["Do you work with insurance claims?", "We can document damage and walk you through the claim process."], ["Repair or replace?", "We'll inspect and tell you honestly which makes sense."], ["What materials do you install?", "Ask about the options we carry for your home and budget."]] },
  { key: "hvac", name: "HVAC", category: "Home services & outdoor trades", family: "trade", niche: "home_service", schema: "HVACBusiness", query: "hvac contractor",
    match: ["hvac", "heating", "air conditioning", "furnace", "heat pump", "cooling"], services: ["AC repair", "Furnace repair", "New system installs", "Heat pumps", "Maintenance plans", "Indoor air quality"],
    palette: ["Cool & warm", "#12355b", "#ef6c2f", "#0c1726", "#f2f3f2"], type: "grotesk", refs: [], status: "draft",
    hero: ["Heating and cooling in {city}, fixed fast.", "{city} HVAC repair, installs and tune-ups.", "Comfortable every season."],
    faq: [["Do you offer maintenance plans?", "Ask about a plan that keeps your system tuned and covered."], ["Can you install a heat pump?", "Yes. We'll size it for your home and explain your options."], ["What if it breaks after hours?", "Call and we'll tell you the fastest way we can help."]] },
  { key: "plumbing", name: "Plumbing", category: "Home services & outdoor trades", family: "trade", niche: "home_service", schema: "Plumber", query: "plumber",
    match: ["plumb", "drain", "water heater", "sewer", "rooter"], services: ["Drain cleaning", "Water heaters", "Leak repair", "Repipes", "Fixture installs", "Emergency plumbing"],
    palette: ["Deep water", "#0f4c75", "#f0a202", "#0b1d2b", "#f3f2ee"], type: "archivo", refs: [], status: "draft",
    hero: ["Plumbing in {city}, fixed right.", "{city} plumbers for leaks, drains and water heaters.", "Leaks stopped. Drains flowing."],
    faq: [["Do you handle emergencies?", "Call us. We'll tell you how fast we can be there."], ["Do you install tankless water heaters?", "Yes. We'll help you choose between tank and tankless."], ["Do you give prices up front?", "You'll know the price before we start."]] },
  { key: "electrical", name: "Electrical", category: "Home services & outdoor trades", family: "trade", niche: "home_service", schema: "Electrician", query: "electrician",
    match: ["electric", "panel", "wiring", "ev charger", "generator"], services: ["Panel upgrades", "EV charger installs", "Lighting", "Rewiring", "Generators", "Troubleshooting & repair"],
    palette: ["Charge", "#1b1b1f", "#f5b301", "#0f0f12", "#f4f2ee"], type: "grotesk", refs: [], status: "draft",
    hero: ["Electrical work in {city}, done to code.", "{city} electricians for panels, EV chargers and lighting.", "Power you can trust."],
    faq: [["Can you install an EV charger?", "Yes. We'll check your panel and recommend the right charger setup."], ["Do you pull permits?", "We handle the permits the job needs."], ["Do you do commercial work?", "Ask about commercial and light industrial projects."]] },
  { key: "garage_doors", name: "Garage & overhead doors", category: "Home services & outdoor trades", family: "trade", niche: "home_service", schema: "HomeAndConstructionBusiness", query: "garage door company",
    match: ["garage door", "overhead door", "hydraulic door", "bifold", "door opener"], services: ["Door installation", "Spring & opener repair", "Commercial doors", "Hydraulic & bifold doors", "Maintenance tune-ups", "Custom doors"],
    palette: ["Steel", "#23272f", "#ff5a1f", "#121418", "#f2f1ee"], type: "barlow", refs: ["powerlift"], status: "refining",
    hero: ["Garage and overhead doors in {city}.", "Doors that open right, every time, in {city}.", "Built, installed and serviced."],
    faq: [["Do you repair springs and openers?", "Yes. Call and describe what's happening."], ["Do you build custom or oversized doors?", "Ask about hangar, shop and architectural doors."], ["Do you service commercial doors?", "Yes, including regular maintenance."]] },
  { key: "pest_control", name: "Pest control", category: "Home services & outdoor trades", family: "trade", niche: "home_service", schema: "HomeAndConstructionBusiness", query: "pest control",
    match: ["pest", "termite", "exterminat", "rodent", "mosquito"], services: ["General pest control", "Termite treatment", "Rodent control", "Mosquito treatment", "Wildlife exclusion", "Commercial pest plans"],
    palette: ["Field", "#24452f", "#e8b931", "#121f16", "#f4f2eb"], type: "archivo", refs: [], status: "draft",
    hero: ["Pest control in {city}, handled for good.", "{city} pest control for homes and businesses.", "Bugs out. Peace of mind in."],
    faq: [["Is treatment safe for kids and pets?", "We'll explain exactly what we use and any precautions."], ["Do you offer ongoing plans?", "Ask about quarterly or monthly service plans."], ["How fast can you come out?", "Call and we'll find the soonest time."]] },
  { key: "cleaning", name: "Cleaning services", category: "Home services & outdoor trades", family: "trade", niche: "home_service", schema: "LocalBusiness", query: "cleaning service",
    match: ["clean", "maid", "janitorial", "housekeeping"], services: ["Recurring house cleaning", "Deep cleaning", "Move-in / move-out", "Office cleaning", "Post-construction cleanup", "Window cleaning"],
    palette: ["Fresh", "#0e5e6f", "#7cc6b8", "#0c2329", "#f4f4f1"], type: "grotesk", refs: [], status: "draft",
    hero: ["A cleaner home in {city}, on your schedule.", "{city} house and office cleaning.", "Come home to clean."],
    faq: [["Do I need to be home?", "No. Many clients give us a key or code."], ["Do you bring supplies?", "Ask what we bring and whether you prefer your own products."], ["Can I set a recurring schedule?", "Weekly, bi-weekly or monthly. Your call."]] },
  { key: "auto_detailing", name: "Auto detailing", category: "Home services & outdoor trades", family: "trade", niche: "home_service", schema: "AutoWash", query: "auto detailing",
    match: ["detail", "ceramic", "paint correction", "car wash"], services: ["Full detail", "Interior detail", "Paint correction", "Ceramic coating", "Mobile detailing", "Fleet detailing"],
    palette: ["Gloss", "#111111", "#d72638", "#0a0a0a", "#f2f1ef"], type: "barlow", refs: [], status: "draft",
    hero: ["Auto detailing in {city} that turns heads.", "{city} detailing, coatings and paint correction.", "Showroom finish, your driveway."],
    faq: [["Do you come to me?", "Ask about mobile detailing at your home or work."], ["How long does a ceramic coating last?", "It depends on the product and care. We'll walk you through it."], ["How long does a full detail take?", "Plan on several hours. We'll give you a time when you book."]] },
  { key: "barber_salon", name: "Barbershop & salon", category: "Tattoo & personal services", family: "beauty", niche: "other", schema: "HairSalon", query: "barbershop",
    match: ["barber", "salon", "hair", "fade", "beauty"], services: ["Haircuts", "Skin fades", "Beard trims", "Hot towel shaves", "Kids cuts", "Color"],
    palette: ["Classic", "#111111", "#b0412e", "#0b0b0b", "#f2efea"], type: "dmserif", refs: ["royalz"], status: "refining",
    hero: ["Fresh cuts in {city}. Book your chair.", "{city}'s barbershop for fades, beards and shaves.", "Look sharp. Book in seconds."],
    faq: [["Do you take walk-ins?", "Booking is the surest way to get your barber. Call to check walk-in times."], ["How do I book?", "Use the Book button. It takes a minute."], ["Do you cut kids' hair?", "Yes. Book a kids cut like any other appointment."]] },
  { key: "tattoo", name: "Tattoo & piercing", category: "Tattoo & personal services", family: "beauty", niche: "other", schema: "TattooParlor", query: "tattoo shop",
    match: ["tattoo", "piercing", "ink"], services: ["Custom tattoos", "Fine line", "Black & grey", "Color work", "Cover-ups", "Piercings"],
    palette: ["Ink", "#121212", "#8b1e1e", "#0a0a0a", "#efece7"], type: "dmserif", refs: ["arcane"], status: "refining",
    hero: ["Custom tattoos in {city}.", "{city} tattoo and piercing studio.", "Your idea, drawn for you."],
    faq: [["Do I need a deposit?", "Ask the studio about deposits when you book a consult."], ["Can I bring my own design?", "Yes. Your artist will help make it work as a tattoo."], ["How do I care for a new tattoo?", "Your artist gives you aftercare instructions after the session."]] },
  { key: "fitness_coaching", name: "Fitness & coaching", category: "Fitness & bodybuilding coaching", family: "coach", niche: "fitness_coach", schema: "ExerciseGym", query: "personal trainer",
    match: ["coach", "trainer", "fitness", "gym", "bodybuilding", "nutrition"], services: ["1:1 coaching", "Online coaching", "Nutrition coaching", "Contest prep", "Small-group training", "Weekly check-ins"],
    palette: ["Iron", "#0d0d0d", "#e4572e", "#0a0a0a", "#f1efeb"], type: "barlow", refs: ["muscle_mentor", "chasing_gains"], status: "refining",
    hero: ["Coaching in {city} and online.", "Train with a coach who checks in.", "Your plan. Your coach. Real accountability."],
    faq: [["Do you coach online?", "Ask about online coaching with check-ins wherever you train."], ["Is nutrition included?", "Each program says what's included. Ask on your consult."], ["Do I need experience?", "No. Your plan starts where you are."]] },
  { key: "bakery_cafe", name: "Bakery & cafe", category: "Food, beverage & retail", family: "food", niche: "food_bev", schema: "Bakery", query: "bakery",
    match: ["bakery", "cafe", "coffee", "cupcake", "boba", "dessert", "donut", "smoothie"], services: ["Signature treats", "Custom cakes", "Coffee & drinks", "Seasonal specials", "Catering & events", "Pre-orders"],
    palette: ["Sweet", "#7a2e3a", "#f2a65a", "#2a1015", "#fbf5ee"], type: "fraunces", refs: ["smallcakes", "bobablastic"], status: "refining",
    hero: ["Fresh every day in {city}.", "{city}'s spot for treats, coffee and custom orders.", "Made fresh. Made for you."],
    faq: [["Do you take custom orders?", "Yes. Send a request with your date and what you have in mind."], ["Do you cater events?", "Ask about catering for parties, offices and weddings."], ["Do you have allergy-friendly options?", "Ask in store or by phone about today's options."]] },
  { key: "restaurant", name: "Restaurant", category: "Food, beverage & retail", family: "food", niche: "food_bev", schema: "Restaurant", query: "restaurant",
    match: ["restaurant", "grill", "kitchen", "sushi", "pizza", "taco", "bar", "diner", "bistro"], services: ["Dine-in", "Takeout", "Catering", "Private events", "Happy hour", "Seasonal menu"],
    palette: ["Supper", "#1d3a2f", "#e07a3f", "#0f1d18", "#f6f2ea"], type: "fraunces", refs: [], status: "draft",
    hero: ["Good food in {city}. Come hungry.", "{city} dining, takeout and catering.", "Pull up a chair."],
    faq: [["Do you take reservations?", "Call or use the booking link if the restaurant offers one."], ["Do you cater?", "Ask about catering and private events."], ["Do you have vegetarian options?", "See the menu or ask your server."]] },
  { key: "property_management", name: "Real estate & property management", category: "Agency & B2B services", family: "property", niche: "other", schema: "RealEstateAgent", query: "property management company",
    match: ["property management", "realty", "real estate", "realtor", "rentals", "leasing"], services: ["Property management", "Tenant placement", "Rent collection", "Maintenance coordination", "Home sales", "Rental analysis"],
    palette: ["Harbor", "#1e3a5f", "#c98b2b", "#0e1b2c", "#f4f2ee"], type: "grotesk", refs: [], status: "draft",
    hero: ["Property management in {city}, hands-off.", "{city} rentals, managed right.", "Your property, handled."],
    faq: [["What do you charge?", "Fees depend on the property and service. Ask for a rental analysis."], ["How do owners get paid?", "Ask how and when owner payments and statements go out."], ["Who handles maintenance?", "We coordinate repairs with vetted vendors."]] },
  { key: "str_management", name: "Short-term rental management", category: "Agency & B2B services", family: "property", niche: "other", schema: "LocalBusiness", query: "vacation rental management",
    match: ["vacation rental", "short-term rental", "airbnb", "str ", "cohost", "co-host"], services: ["Full-service management", "Listing setup & photos", "Dynamic pricing", "Guest messaging", "Cleaning & turnovers", "Owner reporting"],
    palette: ["Coastal", "#16425b", "#f4a259", "#0b2230", "#f6f3ee"], type: "grotesk", refs: ["suite_spotz"], status: "draft",
    hero: ["Short-term rental management in {city}.", "More bookings, less work, in {city}.", "Your rental, run for you."],
    faq: [["What does management include?", "Listing, pricing, guests, cleaning and reporting. Ask for details."], ["Can I still use my place?", "Yes. Block your dates whenever you want."], ["How do I see results?", "Owners get regular statements and reporting."]] },
  { key: "med_spa", name: "Med spa & aesthetics", category: "Tattoo & personal services", family: "health", niche: "other", schema: "HealthAndBeautyBusiness", query: "med spa",
    match: ["med spa", "medspa", "aesthetic", "botox", "injectable", "laser", "facial"], services: ["Injectables", "Facials", "Laser treatments", "Body contouring", "Skin consultations", "Memberships"],
    palette: ["Calm", "#3a2f2a", "#c79a7e", "#1c1714", "#f7f3ef"], type: "cormorant", refs: [], status: "draft",
    hero: ["Aesthetics in {city}, done with care.", "{city} med spa for skin, injectables and laser.", "Feel like yourself, refreshed."],
    faq: [["Is a consultation required?", "Most treatments start with a consultation. Book one online."], ["Who performs treatments?", "Ask about the provider's credentials when you book."], ["Do you offer memberships?", "Ask about membership options."]] },
  { key: "dental", name: "Dental", category: "Tattoo & personal services", family: "health", niche: "other", schema: "Dentist", query: "dentist",
    match: ["dental", "dentist", "orthodont", "smile"], services: ["Cleanings & exams", "Cosmetic dentistry", "Implants", "Clear aligners", "Emergency visits", "Kids dentistry"],
    palette: ["Clean", "#0c4a6e", "#2bb3a3", "#082233", "#f4f6f5"], type: "grotesk", refs: [], status: "draft",
    hero: ["Dental care in {city}, made easy.", "{city} dentist for the whole family.", "A healthy smile, without the stress."],
    faq: [["Do you take my insurance?", "Call with your plan and we'll check for you."], ["Are you taking new patients?", "Call or request an appointment to find out."], ["What if I have a dental emergency?", "Call right away and we'll tell you the next step."]] },
  { key: "retail_shop", name: "Specialty retail & hobby shop", category: "Food, beverage & retail", family: "food", niche: "food_bev", schema: "Store", query: "hobby shop",
    match: ["card shop", "trading card", "hobby", "comic", "game store", "boutique", "shop"], services: ["In-store shopping", "Online orders", "Events & tournaments", "Buy, sell & trade", "Pre-orders", "Gift cards"],
    palette: ["Arcade", "#1b2a49", "#f2a03d", "#0e1628", "#f4f2ee"], type: "grotesk", refs: ["bulba"], status: "draft",
    hero: ["{city}'s shop for collectors and players.", "Shop, trade and play in {city}.", "Your local spot. Come see what's new."],
    faq: [["Do you buy collections?", "Ask in store about buying and trading."], ["Do you host events?", "Check the events calendar or call."], ["Can I order online?", "Ask about online and pre-orders."]] },
  { key: "b2b_services", name: "B2B & professional services", category: "Agency & B2B services", family: "property", niche: "other", schema: "ProfessionalService", query: "business services",
    match: ["merchant", "payment processing", "consult", "broker", "agency", "b2b", "aviation"], services: ["Consultations", "Custom quotes", "Implementation", "Ongoing support", "Account management", "Partnerships"],
    palette: ["Boardroom", "#14213d", "#fca311", "#0b1222", "#f3f2ef"], type: "grotesk", refs: ["velocity", "uplift"], status: "draft",
    hero: ["{service} for growing businesses.", "A partner that picks up the phone.", "Straight answers. Real results you can check."],
    faq: [["How do we get started?", "Book a call and we'll learn how you work today."], ["Do you work nationwide?", "Ask about the markets we serve."], ["How is pricing set?", "Custom to your business. We quote after the first call."]] },
];

// Sample data spec per family: [service-ish label, low, high] price ranges are SAMPLE numbers for the demo only.
const SAMPLE_PRICES = { trade: [350, 6800], beauty: [25, 180], food: [12, 420], coach: [150, 450], property: [180, 2400], health: [95, 1800] };

const titleCase = (s) => String(s || "").replace(/\b\w/g, (c) => c.toUpperCase());

export function pageSeo(key, name, family) {
  const svc = name.split(/[&,]/)[0].trim();
  const pages = family === "food"
    ? [["Home", `{business} | ${svc} in {city}`, `{business} in {city}: what's fresh, hours and how to order. Stop in, call ahead or send a catering request.`], ["Menu", "Menu | {business}", "See the {business} menu: favorites, seasonal specials and custom orders, made fresh in {city}."], ["Contact", "Contact {business} in {city}", "Find {business} in {city}: address, hours, phone and a quick form for orders, catering and events."]]
    : family === "beauty"
      ? [["Home", `{business} | ${svc} in {city}`, `{business} in {city}: book your appointment online in a minute. See services, the team, hours and how to find us.`], ["Services", "Services | {business} {city}", "Every service at {business} in {city}, with how long it takes and how to book your next visit online."], ["Book", "Book at {business} | {city}", "Book your next appointment at {business} in {city}. Pick a service, a time and you're set. It takes a minute."]]
      : [["Home", `${svc} in {city} | {business}`, `{business} provides ${svc.toLowerCase()} in {city} and nearby. See services, recent work and how to get a quote.`], ["Services", `${svc} services | {business}`, `Every ${svc.toLowerCase()} service {business} offers in {city}, what each includes and how to request a quote.`], ["Contact", "Contact {business} in {city}", "Reach {business} in {city}: call, or answer a few quick questions and we'll get back to you with next steps."]];
  return pages.map(([page, title, description]) => ({ page, title, description }));
}

function seedToTemplate(s, now) {
  const [palName, primary, accent, ink, bg] = s.palette;
  const pair = TYPE_PAIRS[s.type] || TYPE_PAIRS.archivo;
  const sample = { job_noun: NOUNS[s.family].job, customer_noun: NOUNS[s.family].customer, money_noun: NOUNS[s.family].money, price_range: SAMPLE_PRICES[s.family], services: s.services };
  return {
    industry_key: s.key,
    name: s.name,
    category: s.category,
    family: s.family,
    niche_key: s.niche,
    status: s.status,
    places_query: s.query,
    match_keywords: s.match,
    website_template: {
      sections: SECTIONS[s.family].map(([key, type, label, purpose]) => ({ key, type, label, purpose, enabled: true })),
      hero_patterns: s.hero,
      services: s.services,
      process: PROCESS[s.family].map(([title, text]) => ({ title, text })),
      faq: s.faq.map(([q, a]) => ({ q, a })),
      palette: { name: palName, primary, accent, ink, bg },
      type: { pair: s.type, display: pair.display, body: pair.body, note: pair.note },
      schema_type: s.schema,
      required_pages: s.family === "food" ? ["Home", "Menu", "About", "Catering / events", "Contact", "Privacy", "Terms"]
        : s.family === "beauty" ? ["Home", "Services", "Team", "Portfolio", "Book", "Contact", "Privacy", "Terms"]
          : s.family === "coach" ? ["Home", "Programs", "About", "Results", "Apply", "Privacy", "Terms"]
            : s.family === "health" ? ["Home", "Services", "Team", "New patients", "Contact", "Privacy", "Terms"]
              : ["Home", "Services (one page each)", "About", "Gallery", "Service area", "Contact", "Privacy", "Terms"],
      seo: { pages: pageSeo(s.key, s.name, s.family), rule: "Titles 25–55 characters, descriptions 100–120. Filled with the real business name and city." },
      photo_direction: s.family === "food" ? "Lead with the best real photo of the food or the room. Natural light, close and warm." : s.family === "beauty" ? "Their own work and the space. Real people, real chairs, no stock smiles." : s.family === "coach" ? "The coach coaching. Real clients only with permission." : "The crew on real jobs and finished work. Before-and-afters beat any graphic.",
    },
    command_template: {
      modules: MODULES[s.family].map(([key, label]) => ({ key, label })),
      pipeline: PIPELINES[s.family],
      entities: ENTITIES[s.family].map(([name, fields]) => ({ name, fields })),
      kpis: KPIS[s.family].map(([key, label, format]) => ({ key, label, format })),
      sample,
    },
    reference_builds: s.refs.map((r) => ({ ...REF[r], key: r })),
    foundation: { title: FOUNDATION.title, link: FOUNDATION.link, prompt_title: FOUNDATION.prompt_title, standard_key: FOUNDATION.standard_key },
    refinement_notes: [{ at: now, author: "Claude (seed)", kind: "seed", note: s.refs.length ? `Seeded from the real builds: ${s.refs.map((r) => REF[r].name).join(", ")}. Starting structure only; refine with real wins.` : "Seeded from the family structure. No Interstellar build in this industry yet: refine after the first one." }],
    version: 1,
  };
}

// The full seed library (22 industries). `now` stamps the seed note.
export function seedTemplates(now = new Date().toISOString()) {
  return SEED.map((s) => seedToTemplate(s, now));
}
export const SEED_KEYS = SEED.map((s) => s.key);

/* ------------------------------------------------------------------------------------------------------------- */
/* Matching                                                                                                        */
/* ------------------------------------------------------------------------------------------------------------- */

// Best template for a lead: an explicit industry_key, else keywords in its industry / one-liner / GBP categories,
// else the niche's family default.
export function matchTemplate(templates, { industry_key = "", text = "", niche_key = "" } = {}) {
  const list = (templates || []).filter(Boolean);
  if (industry_key) { const hit = list.find((t) => t.industry_key === industry_key); if (hit) return hit; }
  const hay = ` ${String(text || "").toLowerCase()} `;
  let best = null, score = 0;
  for (const t of list) {
    const n = (t.match_keywords || []).reduce((a, k) => a + (hay.includes(String(k).toLowerCase()) ? String(k).length : 0), 0);
    if (n > score) { best = t; score = n; }
  }
  if (best) return best;
  const fallback = { home_service: "landscaping", fitness_coach: "fitness_coaching", food_bev: "bakery_cafe", retail_streetwear: "retail_shop" }[niche_key] || "b2b_services";
  return list.find((t) => t.industry_key === fallback) || list[0] || null;
}

/* ------------------------------------------------------------------------------------------------------------- */
/* SEO helpers                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------- */

const fill = (s, v) => String(s || "").replace(/\{(\w+)\}/g, (_, k) => (v[k] != null && v[k] !== "" ? String(v[k]) : ""))
  .replace(/\s+\|\s*$/, "").replace(/^\s*\|\s+/, "").replace(/\bin\s+(\||$)/g, "$1").replace(/\s{2,}/g, " ").replace(/\s+([,.:|])/g, "$1").trim();

function clipWords(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.6 ? cut.slice(0, at) : s.slice(0, max)).replace(/[\s,;:|–-]+$/, "");
}

export function fitTitle(pattern, vars) {
  const [lo, hi] = SEO_LIMITS.title;
  let t = fill(pattern, vars);
  if (t.length > hi) {
    const short = fill(pattern, { ...vars, business: vars.short || vars.business });
    t = short.length <= hi ? short : clipWords(short, hi);
  }
  if (t.length < lo && vars.state && !t.includes(vars.state)) t = `${t}, ${vars.state}`;
  for (const tail of [" | Official site", ` | ${vars.tail || "Local business"}`]) { if (t.length >= lo) break; if (t.length + tail.length <= hi) t += tail; }
  return t;
}

export function fitDescription(pattern, vars) {
  const [lo, hi] = SEO_LIMITS.description;
  let d = fill(pattern, vars);
  if (d.length > hi) {
    d = clipWords(d, hi - 1);
    if (!/[.!?]$/.test(d)) d = `${d}.`;
  }
  const tails = [" Call today.", " Get in touch today.", " We're here to help."];
  for (const tail of tails) { if (d.length >= lo) break; if (d.length + tail.length <= hi) d += tail; }
  return d;
}

export const seoOk = (title, desc) => {
  const t = String(title || "").length, d = String(desc || "").length;
  return { title_ok: t >= SEO_LIMITS.title[0] && t <= SEO_LIMITS.title[1], description_ok: d >= SEO_LIMITS.description[0] && d <= SEO_LIMITS.description[1], title_len: t, desc_len: d };
};

/* ------------------------------------------------------------------------------------------------------------- */
/* Preview builder                                                                                                 */
/* ------------------------------------------------------------------------------------------------------------- */

const str = (v) => (v == null ? "" : String(v)).trim();
const hexOk = (c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(str(c));
function hex6(c) { const h = str(c).replace("#", ""); return `#${h.length === 3 ? h.split("").map((x) => x + x).join("") : h}`.toLowerCase(); }
function lum(c) {
  const h = hex6(c).slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => { const v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrastOn = (c) => (hexOk(c) && lum(c) > 0.42 ? "#111111" : "#ffffff");

// City and state from what we know: Finder fields first, then the GBP address from the scrape, then location text.
export function placeOf(client = {}) {
  const s = client.scrape_summary || {};
  const addr = str(s.gbp?.address || client.gbp_cache?.address || "");
  let city = str(client.city), state = str(client.state);
  const m = addr.match(/,\s*([^,]+?),\s*([A-Z]{2})\s*\d{5}/);
  if (!city && m) city = m[1];
  if (!state && m) state = m[2];
  if (!city) { const loc = str(client.location).split("·")[0]; const lm = loc.match(/([A-Za-z .'-]+),\s*([A-Z]{2})\b/); if (lm) { city = lm[1].trim().split(/\s{2,}/).pop(); state = state || lm[2]; } }
  if (!city) { const area = str(s.market).split("·")[1]; if (area) city = area.trim().split(/[,(]/)[0].trim(); }
  return { city: city.slice(0, 40), state: state.slice(0, 2).toUpperCase(), address: addr };
}

// Deterministic PRNG so the same lead always gets the same sample data.
function prng(seedText) {
  let h = 1779033703 ^ String(seedText || "x").length;
  for (let i = 0; i < String(seedText).length; i++) { h = Math.imul(h ^ String(seedText).charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const FIRST = ["Avery", "Jordan", "Riley", "Morgan", "Casey", "Quinn", "Rowan", "Harper", "Emerson", "Logan", "Parker", "Reese", "Sawyer", "Hayden", "Blake", "Cameron", "Drew", "Elliot", "Finley", "Jamie", "Kendall", "Micah", "Skyler", "Wren"];
const LAST = ["Alvarez", "Brennan", "Calloway", "Dempsey", "Ellison", "Fairbanks", "Garrity", "Holloway", "Iverson", "Jansen", "Kowalski", "Lindqvist", "Marchetti", "Nakamura", "Okafor", "Pemberton", "Quintero", "Rasmussen", "Sorensen", "Underwood", "Vasquez", "Whitlock"];

export function sampleData(template, { business = "", seed = "", city = "" } = {}) {
  const r = prng(`${seed}:${template?.industry_key || ""}`);
  const ri = (a, b) => Math.floor(a + r() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const ct = template?.command_template || {};
  const sp = ct.sample || {};
  const [lo, hi] = sp.price_range || [100, 1000];
  const services = (sp.services && sp.services.length ? sp.services : ["Service"]).slice(0, 8);
  const stages = ct.pipeline && ct.pipeline.length ? ct.pipeline : ["New", "Quoted", "Won"];
  const money = () => Math.round((lo + r() ** 1.6 * (hi - lo)) / 5) * 5;
  const name = () => `${pick(FIRST)} ${pick(LAST)}`;
  const day = (offset) => { const d = new Date(Date.UTC(2026, 0, 12 + offset)); return d.toISOString().slice(0, 10); };
  const customers = Array.from({ length: 10 }, (_, i) => ({ id: `s-c${i + 1}`, name: name(), city: city || "Your city", phone: `(555) 01${String(ri(10, 99))}`, last: day(-ri(1, 60)), total: money() * ri(1, 4) }));
  const cards = Array.from({ length: Math.max(8, stages.length * 2) }, (_, i) => ({ id: `s-p${i + 1}`, name: pick(customers).name, stage: stages[i % stages.length], service: pick(services), value: money(), age: ri(0, 12) }));
  const times = ["8:00 AM", "9:30 AM", "11:00 AM", "1:00 PM", "2:30 PM", "4:00 PM"];
  const statuses = ["Scheduled", "Confirmed", "In progress", "Done"];
  const jobs = Array.from({ length: 8 }, (_, i) => ({ id: `s-j${i + 1}`, title: pick(services), customer: pick(customers).name, date: day(Math.floor(i / 2)), time: times[i % times.length], status: statuses[Math.min(3, Math.floor(i / 2))], value: money() }));
  const invStatus = ["Paid", "Paid", "Sent", "Overdue", "Draft"];
  const invoices = Array.from({ length: 7 }, (_, i) => ({ id: `s-i${i + 1}`, number: `INV-${1040 + i}`, customer: pick(customers).name, amount: money(), status: invStatus[i % invStatus.length], due: day(i - 3) }));
  const paid = invoices.filter((x) => x.status === "Paid").reduce((a, x) => a + x.amount, 0) + jobs.reduce((a, j) => a + j.value, 0);
  const kpiVal = (k) => {
    if (k.format === "money") return k.key === "open_estimates" ? cards.slice(0, 5).reduce((a, c) => a + c.value, 0) : k.key === "avg_ticket" ? money() : paid;
    if (k.format === "pct") return `${ri(38, 71)}%`;
    return ri(4, 26);
  };
  const kpis = (ct.kpis || []).map((k) => ({ key: k.key, label: k.label, format: k.format, value: kpiVal(k) }));
  return { label: "Sample data", business, nouns: { job: sp.job_noun || "Job", customer: sp.customer_noun || "Customer", money: sp.money_noun || "Invoice" }, kpis, customers, pipeline: { stages, cards }, jobs, invoices, reviews: { requested: ri(8, 30), clicked: ri(3, 12) } };
}

// website_config + command_config for one lead. Inputs are the CRMClient (with scrape_summary), its Brain row and the
// chosen template (an IndustryTemplate row or a seed). Never invents facts: anything not found stays empty or becomes
// a marked slot the renderer shows as "Your photo here" etc.
export function buildPreview({ client = {}, template, now = new Date().toISOString() } = {}) {
  const t = template || seedTemplates(now)[0];
  const wt = t.website_template || {};
  const s = client.scrape_summary || {};
  const business = str(client.business || s.name) || "Your Business";
  const short = business.replace(/\b(LLC|Inc\.?|Co\.?|Company|Corp\.?)\b/gi, "").replace(/\s{2,}/g, " ").trim();
  const { city, state, address } = placeOf(client);
  const services = (Array.isArray(s.services) && s.services.length ? s.services : wt.services || []).map(str).filter(Boolean).slice(0, 6);
  const fromSite = Array.isArray(s.services) && s.services.length > 0;
  const colors = (s.colors || []).map(str).filter(hexOk).map(hex6);
  const dark = colors.find((c) => lum(c) < 0.25);
  const bright = colors.find((c) => c !== dark && lum(c) >= 0.08 && lum(c) <= 0.6);
  const pal = wt.palette || {};
  const theme = {
    primary: bright || pal.accent || "#ff3c00",
    ink: dark || pal.ink || "#151515",
    deep: pal.primary || dark || "#1f1f1f",
    bg: pal.bg || "#f4f2ee",
    surface: "#ffffff",
    font_display: wt.type?.display || "Archivo",
    font_body: wt.type?.body || "Inter",
    from_brand: !!(bright || dark),
  };
  theme.on_primary = contrastOn(theme.primary);
  const phone = str(s.gbp?.phone || (client.phones || [])[0] || client.gbp_cache?.phone);
  const rating = typeof s.gbp?.rating === "number" ? s.gbp.rating : typeof client.gbp_cache?.rating === "number" ? client.gbp_cache.rating : null;
  const reviewCount = typeof s.gbp?.reviews === "number" ? s.gbp.reviews : typeof client.gbp_cache?.review_count === "number" ? client.gbp_cache.review_count : null;
  const images = (Array.isArray(s.images) ? s.images : []).map(str).filter((u) => /^https:\/\/\S+\.(jpe?g|png|webp)(\?\S*)?$/i.test(u)).slice(0, 8);
  const area = str(String(s.market || "").split("·")[1]) || (city ? `${city}${state ? `, ${state}` : ""} and nearby` : "");
  const vars = { business, short, city, state, service: services[0] || t.name, tail: t.name };
  const hero = {
    kicker: [t.name, city && `${city}${state ? `, ${state}` : ""}`].filter(Boolean).join(" · "),
    headline: fill((wt.hero_patterns || ["{business}"])[0], vars) || business,
    sub: str(client.one_liner) || (services.length ? `${services.slice(0, 3).join(", ")}${services.length > 3 ? " and more" : ""}${city ? ` in ${city}` : ""}.` : `${t.name}${city ? ` in ${city}` : ""}.`),
    cta_primary: t.family === "beauty" || t.family === "health" ? "Book now" : t.family === "food" ? "Order or visit" : t.family === "coach" ? "Apply now" : "Get a quote",
    cta_secondary: phone ? `Call ${phone}` : "Call us",
    image: images[0] || "",
  };
  const sectionContent = (sec) => {
    switch (sec.type) {
      case "trust": return { items: [rating != null ? `${rating}★ on Google${reviewCount != null ? ` · ${reviewCount} reviews` : ""}` : "", area ? `Serving ${area}` : "", s.gbp?.hours ? "Open today: see hours" : "", t.family === "trade" ? "Licensed & insured: confirm" : ""].filter(Boolean) };
      case "services": return { title: sec.key === "menu" ? "What people come for" : t.family === "coach" ? "Ways to work together" : "What we do", items: services.map((n) => ({ title: n })), note: fromSite ? "" : "Suggested services: confirm with the owner" };
      case "process": return { title: sec.label, items: (wt.process || []).slice(0, 4) };
      case "gallery": return { title: sec.label, images: images.slice(1, 7), slots: Math.max(0, 6 - images.slice(1, 7).length) };
      case "about": return { title: sec.key === "about" && t.family === "food" ? "Our story" : `About ${short}`, body: str(client.one_liner) || "", slot: "The owner's story, in their words. We fill this in with you on the walkthrough." };
      case "team": return { title: sec.label, slot: "Your team, each with their own work." };
      case "reviews": return { title: "What customers say", rating, review_count: reviewCount, slot: "Your live Google reviews stream in here, word for word." };
      case "area": return { title: sec.label, body: area || "", cities: city ? [city] : [] };
      case "visit": return { title: sec.label, address, hours: str(s.gbp?.hours || ""), phone };
      case "faq": return { title: "Questions, answered", items: (wt.faq || []).slice(0, 4) };
      case "cta": return { title: t.family === "food" ? `Hungry? ${short} is ready.` : t.family === "beauty" || t.family === "health" ? "Ready when you are." : `Let's get your ${String(services[0] || "project").toLowerCase()} started.`, button: hero.cta_primary };
      case "contact": return { title: "Start here", steps: t.family === "beauty" ? ["What are you booking?", "When works for you?", "Your name and phone"] : t.family === "food" ? ["What can we make for you?", "When do you need it?", "Your name and phone"] : t.family === "coach" ? ["What's your goal?", "How do you train now?", "Your name and email"] : ["What do you need help with?", "Where's the job?", "Your name and phone"] };
      default: return {};
    }
  };
  const sections = (wt.sections || []).filter((x) => x.type !== "hero").map((sec) => ({ key: sec.key, type: sec.type, label: sec.label, enabled: sec.enabled !== false, ...sectionContent(sec) }));
  const pages = (wt.seo?.pages || pageSeo(t.industry_key, t.name, t.family)).map((p) => {
    const title = fitTitle(p.title, vars), description = fitDescription(p.description, vars);
    return { page: p.page, title, description, ...seoOk(title, description) };
  });
  const home = pages[0] || { title: business, description: "" };
  const schema = {
    "@context": "https://schema.org", "@type": wt.schema_type || "LocalBusiness", name: business,
    ...(phone ? { telephone: phone } : {}),
    ...(address ? { address: { "@type": "PostalAddress", streetAddress: address.split(",")[0], addressLocality: city || undefined, addressRegion: state || undefined } } : {}),
    ...(area ? { areaServed: area } : {}),
    ...(str((client.websites || [])[0]) ? { url: str((client.websites || [])[0]) } : {}),
  };
  const website_config = {
    business, short, city, state, phone, address, hours: str(s.gbp?.hours || ""), logo_url: /^https:\/\//.test(str(client.logo_url || s.logo_url)) ? str(client.logo_url || s.logo_url) : "",
    rating, review_count: reviewCount, theme, hero, sections, images, image_source: images.length ? "their_site" : "placeholder",
    seo: { title: home.title, description: home.description, pages, schema_type: wt.schema_type || "LocalBusiness" }, schema,
    footer: { credit: "Web design by Interstellar Strategies", credit_url: "https://interstellar-strategies.com" },
    services_from_site: fromSite, industry_key: t.industry_key, template_version: t.version || 1, built_at: now,
  };
  const sample = sampleData(t, { business, seed: client.id || business, city });
  const command_config = {
    business, short, logo_url: website_config.logo_url, theme: { primary: theme.primary, ink: theme.ink, on_primary: theme.on_primary },
    modules: (t.command_template?.modules || []).map((m) => ({ key: m.key, label: m.label })),
    entities: t.command_template?.entities || [],
    ...sample,
    industry_key: t.industry_key, template_version: t.version || 1, built_at: now,
  };
  const missing = [!phone && "phone", !city && "city", !fromSite && "services (template suggestions used)", !images.length && "photos (placeholders used)", !theme.from_brand && "brand colors (template palette used)", rating == null && "Google rating"].filter(Boolean);
  return { website_config, command_config, missing, template_key: t.industry_key };
}

// Text edits and section swaps Justin or the team make on a preview. Kept apart from the built config so a rebuild
// keeps them. overrides = { hero: {headline, sub, kicker, cta_primary}, sections: { key: {title, body, enabled} }, order: [keys] }
export function applyOverrides(config, overrides) {
  if (!config) return config;
  const o = overrides || {};
  const out = { ...config, hero: { ...(config.hero || {}), ...pickStr(o.hero, ["headline", "sub", "kicker", "cta_primary", "cta_secondary"]) } };
  let secs = (config.sections || []).map((x) => {
    const p = (o.sections || {})[x.key] || {};
    return { ...x, ...pickStr(p, ["title", "body"]), ...(typeof p.enabled === "boolean" ? { enabled: p.enabled } : {}) };
  });
  if (Array.isArray(o.order) && o.order.length) {
    const pos = (k) => { const i = o.order.indexOf(k); return i < 0 ? 999 : i; };
    secs = [...secs].sort((a, b) => pos(a.key) - pos(b.key));
  }
  out.sections = secs;
  if (o.seo && typeof o.seo === "object") out.seo = { ...(config.seo || {}), ...pickStr(o.seo, ["title", "description"]) };
  return out;
}
function pickStr(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && typeof obj[k] === "string" && obj[k].trim()) out[k] = obj[k].trim().slice(0, 400);
  return out;
}

/* ------------------------------------------------------------------------------------------------------------- */
/* Lead Finder helpers                                                                                             */
/* ------------------------------------------------------------------------------------------------------------- */

// Google's list price for Text Search (New) with phone / website / rating fields (Text Search Enterprise SKU):
// $35.00 per 1,000 requests, first 1,000 a month free. From developers.google.com/maps/billing-and-pricing/pricing,
// page "Last updated 2026-11-17 UTC". One search page = one request (up to 20 places). Check the page before relying on it.
export const PLACES_PRICING = { sku: "Text Search Enterprise", per_request_usd: 0.035, free_per_month: 1000, source: "developers.google.com/maps/billing-and-pricing/pricing", checked: "2026-11-17" };
export const PLACES_CACHE_DAYS = 30;

export const US_STATE_NAMES = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };

export const digitsOf = (p) => String(p || "").replace(/\D/g, "").replace(/^1(\d{10})$/, "$1");
export const domainOfUrl = (u) => { try { return new URL(/^https?:\/\//i.test(String(u)) ? String(u) : `https://${u}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };

// Quick flags from Places fields alone (no fetch). The homepage check adds "dated" separately.
export function placeFlags(p = {}) {
  const f = [];
  if (!str(p.website)) f.push("no_website");
  if (typeof p.review_count === "number" && p.review_count < 15) f.push("few_reviews");
  if (typeof p.photo_count === "number" && p.photo_count < 5) f.push("few_photos");
  return f;
}
export const FLAG_LABEL = { no_website: "No website", dated: "Site looks dated", few_reviews: "Few reviews", few_photos: "Few photos", no_https: "No HTTPS", no_viewport: "Not mobile-ready", old_copyright: "Old copyright", builder: "DIY builder" };

// Lightweight homepage check: HTML string + final URL → reasons the site looks dated. Never stores the page.
export function datedSignals(html, finalUrl, year = new Date().getUTCFullYear()) {
  const h = String(html || "").slice(0, 400000);
  const reasons = [];
  if (/^http:\/\//i.test(String(finalUrl || ""))) reasons.push("no_https");
  if (!/<meta[^>]+name=["']?viewport/i.test(h)) reasons.push("no_viewport");
  const years = [...h.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?((?:19|20)\d{2})/gi)].map((m) => Number(m[1]));
  if (years.length && Math.max(...years) <= year - 2) reasons.push("old_copyright");
  const builders = [["wix", /wix\.com|_wixCIDX|wixstatic/i], ["godaddy", /godaddy|wsimg\.com|img1\.wsimg/i], ["weebly", /weebly/i], ["squarespace-7.0", /squarespace.*7\.0|static1\.squarespace\.com.*\/universal\/scripts-compressed/i], ["jimdo", /jimdo/i], ["homestead", /homestead\.com/i], ["webs", /webs\.com|freewebs/i], ["yola", /yola/i], ["site123", /site123/i], ["duda", /dudamobile|multiscreensite/i], ["frontpage", /Microsoft FrontPage|mso-/i], ["flash", /\.swf["'?]/i]];
  const hit = builders.filter(([, re]) => re.test(h)).map(([n]) => n);
  if (hit.length) reasons.push("builder");
  if (/<table[^>]+(width|bgcolor)=/i.test(h) && !/display:\s*(flex|grid)/i.test(h)) reasons.push("table_layout");
  const dated = reasons.includes("no_https") || reasons.includes("no_viewport") || reasons.includes("old_copyright") || reasons.length >= 2;
  return { dated, reasons, builders: hit, copyright: years.length ? Math.max(...years) : null };
}

/* ------------------------------------------------------------------------------------------------------------- */
/* Lead Desk                                                                                                       */
/* ------------------------------------------------------------------------------------------------------------- */

export const OUTCOMES = [
  { key: "no_answer", label: "No answer", next_days: 2 },
  { key: "callback", label: "Callback", next_days: 1 },
  { key: "not_interested", label: "Not interested", next_days: 0 },
  { key: "booked", label: "Booked walkthrough", next_days: 0 },
  { key: "sent_portal", label: "Sent portal access", next_days: 2 },
];
export const PAY_METHODS = ["Venmo", "Cash App", "PayPal", "Check"];
export const INCENTIVE = { minutes: 30, per_minute: 1, amount: 30 };

export const CALL_SCRIPT = {
  opener: "Hi, is this {contact}? This is {caller} with Interstellar Strategies. Quick one, and no pitch on this call: I came across {business} on Google and actually built you something.",
  pitch: [
    "We built {business} a brand-new website and a Command System, the software that runs your leads, jobs, customers and invoices in one place. It's already made with your name, your services and {city} on it.",
    "No obligation at all. I'd just love 30 minutes of your time to walk you through it.",
    "And because your time is worth something, we'll pay you $1 a minute for those 30 minutes, $30, by Venmo, Cash App, PayPal or check. Whether you like it or not.",
    "Can I send you a private login so you can see it before we talk?",
  ],
  close: "Great. What's the best email for your login? You'll get one email from Interstellar with a button to see your site and system. Does {day} or {day2} work better for the 30 minutes?",
  objections: [
    { q: "Is this a scam? What's the catch?", a: "Fair question. No catch, no card, no contract. We build first because most local businesses we look at deserve a better website and system, and showing beats telling. You see it, we talk 30 minutes, we pay you $30 either way." },
    { q: "I already have a website.", a: "Totally. This isn't about replacing it today. Take a look side by side: what we built is designed to get found on Google and turn visitors into calls. If yours is doing that already, you just made $30." },
    { q: "I don't have time.", a: "That's exactly why we pay for the time. It's 30 minutes, whenever works for you this week or next, and you can look at the login on your phone first." },
    { q: "How much does it cost?", a: "Today, nothing, and we don't talk price on the first call. Every quote is custom to the business, and the walkthrough is how we figure out what you'd actually need." },
    { q: "Why would you pay me?", a: "Because your time is worth something and we're confident in what we built. $1 a minute, $30 for the walkthrough, paid by Venmo, Cash App, PayPal or check within a few days." },
    { q: "Just send me an email.", a: "Happy to. I'll send your private login now, it has your website and system in it. Can I put down a time to walk through it so it doesn't get buried?" },
    { q: "Take me off your list.", a: "Absolutely, I'll mark you do-not-contact right now and you won't hear from us again. Sorry to bother you." },
  ],
  rules: ["Never promise rankings, revenue or results.", "Never quote a price on this call.", "Mark do-not-contact the moment they ask.", "Log the outcome before the next call."],
};

export function fillScript(text, v = {}) {
  return String(text || "").replace(/\{(\w+)\}/g, (_, k) => str(v[k]) || ({ contact: "the owner", caller: "your name", business: "your business", city: "your city", day: "Tuesday", day2: "Thursday" }[k] || ""));
}

// Who is ready to call: a lead with a ready (or sent/viewed) preview, a phone, and no do-not-contact.
export function deskQueue(clients = [], previews = [], todayIso = new Date().toISOString().slice(0, 10)) {
  const byClient = new Map(previews.map((p) => [p.client_id, p]));
  return clients
    .filter((c) => c.status === "Lead" && !c.do_not_contact && byClient.has(c.id) && ["ready", "sent", "viewed"].includes(byClient.get(c.id).status))
    .map((c) => {
      const due = str(c.next_step_at).slice(0, 10);
      return { client: c, preview: byClient.get(c.id), due, overdue: !!due && due < todayIso, today: due === todayIso, fresh: !c.desk_last_call_at };
    })
    .filter((x) => x.client.desk_outcome !== "not_interested")
    .sort((a, b) => (b.overdue - a.overdue) || (b.today - a.today) || (b.fresh - a.fresh) || String(a.due || "9").localeCompare(String(b.due || "9")));
}

export const titleOf = titleCase;
