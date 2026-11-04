// DEMO SCREEN LIBRARY data. Preview sandbox only (?qa=1&demo=1, see src/lib/qa.js). Never active on the live app.
// A FICTIONAL agency book: Interstellar running a made-up roster of clients ("Summit Ridge Builders" and co).
// No real client, person, email, phone or dollar figure appears here. Everything is generated and in memory.
// Remove together with qa.js before launch.

const NOW = new Date();
const DAY = 864e5;
const iso = (d) => d.toISOString().slice(0, 10);
const ago = (n) => iso(new Date(NOW.getTime() - n * DAY));
const ahead = (n) => iso(new Date(NOW.getTime() + n * DAY));
const agoTs = (n, h = 10) => new Date(NOW.getTime() - n * DAY - (NOW.getHours() - h) * 36e5).toISOString();
const aheadTs = (n, h = 10) => new Date(NOW.getTime() + n * DAY + (h - NOW.getHours()) * 36e5).toISOString();
const Y = NOW.getFullYear();
const pad = (n) => String(n).padStart(2, "0");
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

// Deterministic PRNG so every capture shows the same numbers.
let seed = 20261104;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ri = (a, b) => Math.floor(a + rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const slug = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------------------------------------------------------------------------------------------
// Clients: 3 hero accounts + a generated roster. Names checked against the real roster (none collide).
// ---------------------------------------------------------------------------------------------
const HEROES = [
  { business: "Summit Ridge Builders", contact: "Dana Whitaker", industry: "Home services · General contractor", location: "Boise, ID", accent: "#ff3c00", plan: "Mission ALPHA + HyperCare+ National" },
  { business: "Harborline Dental Studio", contact: "Dr. Priya Nand", industry: "Health · Dental", location: "Tacoma, WA", accent: "#0f766e", plan: "Mission BRAVO + HyperCare+ Local" },
  { business: "Blue Heron Coffee Co", contact: "Marcus Bell", industry: "Food & retail · Coffee", location: "Asheville, NC", accent: "#1d4ed8", plan: "Custom Website + HyperCare+ Local" },
];
const PRE = ["Cedar Hollow", "BrightPath", "Ironclad", "Copperline", "Tidewater", "Granite Peak", "Riverbend", "Sterling", "Oakhaven", "Silverline", "Lakeside", "Pinecrest", "Highland", "Bayview", "Stonebridge", "Westfield", "Clearwater", "Maple Grove", "Foxglove", "Kestrel", "Juniper", "Aspen Ridge", "Sunstone", "Coastal", "Prairie Wind", "Hollow Creek", "Ember", "Frontier", "Keystone", "Liberty", "Meridian", "Orchard Lane", "Quarry", "Sagebrush", "Vista", "Wildflower", "Falcon", "Bluebird", "Lantern", "Harvest"];
const SUF = [["Roofing", "Home services · Roofing"], ["Plumbing", "Home services · Plumbing"], ["HVAC", "Home services · HVAC"], ["Electric", "Home services · Electrical"], ["Landscaping", "Home services · Landscaping"], ["Med Spa", "Health · Med spa"], ["Veterinary", "Health · Veterinary"], ["Auto Detailing", "Automotive · Detailing"], ["Pest Control", "Home services · Pest control"], ["Pool & Spa", "Home services · Pools"], ["Fitness", "Coaching & fitness"], ["Law Group", "B2B · Legal"], ["Realty", "Real estate"], ["Bakery", "Food & retail · Bakery"], ["Painting", "Home services · Painting"], ["Fencing", "Home services · Fencing"], ["Solar", "Home services · Solar"], ["Cleaning Co", "Home services · Cleaning"], ["Movers", "Home services · Moving"], ["Chiropractic", "Health · Chiropractic"], ["Remodeling", "Home services · Remodeling"], ["Flooring", "Home services · Flooring"], ["Concrete", "Home services · Concrete"], ["Tree Care", "Home services · Arborist"], ["Insurance", "B2B · Insurance"], ["Physical Therapy", "Health · PT"]];
const CITIES = ["Boise, ID", "Spokane, WA", "Reno, NV", "Bend, OR", "Fort Collins, CO", "Austin, TX", "Raleigh, NC", "Nashville, TN", "Tampa, FL", "Scottsdale, AZ", "Salt Lake City, UT", "Charlotte, NC", "Omaha, NE", "Madison, WI", "Richmond, VA", "Savannah, GA", "Tulsa, OK", "Sacramento, CA", "Des Moines, IA", "Knoxville, TN"];
const FIRST = ["Avery", "Jordan", "Riley", "Morgan", "Casey", "Quinn", "Tatum", "Rowan", "Harper", "Emerson", "Logan", "Parker", "Reese", "Sawyer", "Hayden", "Blake", "Cameron", "Drew", "Elliot", "Finley", "Jamie", "Kendall", "Micah", "Noel", "Skyler", "Toby", "Wren", "Sasha", "Remy", "Corin"];
const LAST = ["Alvarez", "Brennan", "Calloway", "Dempsey", "Ellison", "Fairbanks", "Garrity", "Holloway", "Iverson", "Jansen", "Kowalski", "Lindqvist", "Marchetti", "Nakamura", "Okafor", "Pemberton", "Quintero", "Rasmussen", "Sorensen", "Thackeray", "Underwood", "Vasquez", "Whitlock", "Yamada", "Zeller"];

const SVC = {
  global: { name: "HyperCare+ Global", price: 3000 },
  national: { name: "HyperCare+ National", price: 1750 },
  local: { name: "HyperCare+ Local", price: 750 },
  loc: { name: "HyperCare+ extra location", price: 350 },
  care: { name: "GravïtyCare", price: 197 },
};
const svc = (k, n = 1, i = 1) => ({ id: i, name: n > 1 ? `${SVC[k].name} ×${n}` : SVC[k].name, price: SVC[k].price * n, interval: "month", stripe: true });

function makeClients() {
  const out = [];
  const used = new Set();
  const tierFor = (i) => (i < 42 ? "global" : i < 94 ? "national" : i < 140 ? "local" : "care");
  for (let i = 0; i < 154; i++) {
    let biz, industry, plan;
    const h = HEROES[i];
    if (h) { biz = h.business; industry = h.industry; plan = h.plan; }
    else {
      let k = i;
      do { const p = PRE[k % PRE.length]; const s = SUF[(k * 7 + Math.floor(k / PRE.length)) % SUF.length]; biz = `${p} ${s[0]}`; industry = s[1]; k += 13; } while (used.has(biz));
    }
    used.add(biz);
    const tier = i === 0 ? "national" : i === 1 || i === 2 ? "local" : tierFor(i);
    const services = [svc(tier, 1, 1)];
    if (tier === "global") services.push(svc("loc", ri(2, 6), 2));
    if (tier === "national") services.push(svc("loc", ri(1, 3), 2));
    if (tier === "local") services.push(svc("loc", ri(1, 4), 2));
    if (!plan) plan = tier === "care" ? "Custom Website + GravïtyCare" : `${pick(["Mission ALPHA", "Mission BRAVO", "Command System", "Custom Website"])} + ${SVC[tier].name}`;
    const contact = h ? h.contact : `${pick(FIRST)} ${pick(LAST)}`;
    const domain = `${slug(biz).replace(/-co$/, "")}.demo`;
    out.push({
      id: `c${i + 1}`, business: biz, contact, industry, location: h ? h.location : pick(CITIES),
      emails: [`${contact.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}@${domain}`], phones: [`(208) 555-01${pad(ri(0, 99))}`],
      websites: [domain], domain, status: "Active", services, plan, accent: h ? h.accent : pick(["#ff3c00", "#0f766e", "#1d4ed8", "#7c3aed", "#b45309", "#15803d", "#be123c"]),
      services_managed: ["website", "system", "orbit_seo", ...(i % 3 === 0 ? ["brand"] : [])],
      portal_enabled: true, portal_emails: [`${contact.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}@${domain}`],
      started_on: ago(ri(40, 700)), notes: [], documents: [], completedTasks: [],
      studios: i < 3 ? { social: "on", email: "on", ads: "on", accounting: "on", hiring: "on", presentations: "on" } : undefined,
      created_date: agoTs(ri(40, 700)),
    });
  }
  // Pipeline: 34 open deals across every stage.
  const stages = ["new", "new", "new", "new", "new", "new", "new", "contacted", "contacted", "contacted", "contacted", "contacted", "contacted", "call_booked", "call_booked", "call_booked", "call_booked", "call_booked", "call_held", "call_held", "call_held", "call_held", "proposal_sent", "proposal_sent", "proposal_sent", "proposal_sent", "proposal_sent", "proposal_sent", "won", "won", "won", "lost", "lost", "lost"];
  const interests = ["Mission ALPHA", "Mission BRAVO", "Command System (app)", "Custom Website", "HyperCare+ (SEO)", "Ops Command", "Brand Arsenal"];
  const values = { "Mission ALPHA": 8997, "Mission BRAVO": 6497, "Command System (app)": 5997, "Custom Website": 4997, "HyperCare+ (SEO)": 1750 * 12, "Ops Command": 3000, "Brand Arsenal": 2500 };
  const sources = ["website", "referral", "funnel", "ads", "website", "referral", "prestige"];
  const steps = ["Intro call", "Send audit", "Follow up", "Send proposal", "Check in", "Book strategy call", "Walk through Intel Briefing"];
  stages.forEach((st, j) => {
    let biz; let k = 200 + j * 3;
    do { const p = PRE[(k * 5) % PRE.length]; const s = SUF[(k * 3) % SUF.length]; biz = `${p} ${s[0]}`; k += 1; } while (used.has(biz));
    used.add(biz);
    const interest = interests[j % interests.length];
    out.push({
      id: `L${j + 1}`, business: biz, contact: `${pick(FIRST)} ${pick(LAST)}`, emails: [`hello@${slug(biz)}.demo`], phones: [], websites: [], status: st === "won" ? "Active" : "Lead",
      pipeline_stage: st, lead_source: sources[j % sources.length], lead_interest: interest, lead_value: values[interest] * (interest.startsWith("Mission") ? 1 : ri(1, 2)),
      next_step: steps[j % steps.length], next_step_at: ahead(ri(0, 6)), stage_changed_at: ago(ri(0, 9)),
      booked_call_at: st === "call_booked" ? `${ahead(ri(1, 6))}T${pad(ri(9, 15))}:30:00` : undefined,
      lost_reason: st === "lost" ? pick(["Timing", "Budget", "Went with in-house"]) : undefined,
      industry: SUF[(k * 3) % SUF.length][1], location: pick(CITIES), services: [], notes: [], documents: [], completedTasks: [], created_date: agoTs(ri(0, 30)),
    });
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
function build() {
  const clients = makeClients();
  const active = clients.filter((c) => c.status === "Active" && c.id.startsWith("c"));
  const H = active.slice(0, 3);
  const c1 = H[0];
  const E = {};

  E.CRMClient = clients;

  // Option lists (expense categories + industries) so groups render.
  E.AppSettings = [
    { id: "as1", key: "option_lists", optionLists: {
      expense_categories: ["Payroll", "Contractors", "AI Tools", "Software", "Hosting", "Marketing", "Advertising", "Office", "Insurance", "Finance", "Design", "SEO", "Travel", "Operations"].map((v) => ({ value: v, label: v })),
      investment_categories: ["Team", "Software", "Hardware", "Marketing", "Real estate", "Education", "Other"].map((v) => ({ value: v, label: v })),
    } },
  ];

  // ---------------- Finance ----------------
  const ex = (platform, amount, category, frequency = "Monthly", dueDay = 1, dueMonth = null) => ({ platform, amount, category, frequency, dueDay, dueMonth, paidCycles: [] });
  let eid = 0;
  E.Expense = [
    ex("Payroll · Delivery team (14)", 112400, "Payroll", "Monthly", 1), ex("Payroll · Growth & sales (6)", 46800, "Payroll", "Monthly", 1), ex("Payroll · Operations & finance (5)", 33500, "Payroll", "Monthly", 1),
    ex("Benefits & health plans", 21600, "Payroll", "Monthly", 5), ex("Payroll taxes (employer)", 14900, "Payroll", "Monthly", 15),
    ex("Senior dev contractors", 18500, "Contractors", "Monthly", 10), ex("Video & motion studio", 7200, "Contractors", "Monthly", 12), ex("Copy & content writers", 6400, "Contractors", "Monthly", 20),
    ex("Claude Team + API", 4800, "AI Tools", "Monthly", 7), ex("ChatGPT Team", 1500, "AI Tools", "Monthly", 8), ex("ElevenLabs Pro", 330, "AI Tools", "Monthly", 9), ex("Image & video generation", 1200, "AI Tools", "Monthly", 14),
    ex("App hosting + databases", 3900, "Hosting", "Monthly", 3), ex("CDN, domains & SSL", 640, "Hosting", "Monthly", 6), ex("Backups & monitoring", 420, "Hosting", "Monthly", 11),
    ex("Google Workspace (25 seats)", 600, "Software", "Monthly", 2), ex("Design suite (team)", 1150, "Design", "Monthly", 4), ex("SEO data platforms", 2350, "SEO", "Monthly", 7), ex("Rank tracking + local grids", 980, "SEO", "Monthly", 16),
    ex("Accounting & payroll software", 420, "Finance", "Monthly", 18), ex("Payment processing (est.)", 11800, "Finance", "Monthly", 28),
    ex("Paid search + social", 26500, "Advertising", "Monthly", 25), ex("Sponsorships & events", 4200, "Marketing", "Monthly", 21), ex("Brand & PR", 2800, "Marketing", "Monthly", 22),
    ex("HQ lease", 9800, "Office", "Monthly", 1), ex("Studio equipment lease", 1400, "Office", "Monthly", 9), ex("Team travel", 3900, "Travel", "Monthly", 26),
    ex("General liability + E&O", 14400, "Insurance", "Annually", 15, 3), ex("Cyber insurance", 6200, "Insurance", "Annually", 2, 7), ex("Legal retainer", 2500, "Operations", "Monthly", 19), ex("CPA + tax advisory", 18000, "Finance", "Quarterly", 15),
  ].map((e) => ({ id: `ex${++eid}`, ...e }));

  // Stripe: trailing 12 months collected ≈ $4.8M, rising.
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1);
    const collected = Math.round(285000 + (11 - i) * 21000 + ri(-6000, 6000));
    const fees = Math.round(collected * 0.026);
    months.push({ key: monthKey(d), collected, refunds: Math.round(collected * 0.004), fees, capital: 0, net: collected - fees - Math.round(collected * 0.004), payments: Math.round(collected / 2100) });
  }
  const totals = months.reduce((a, m) => ({ collected: a.collected + m.collected, refunds: a.refunds + m.refunds, fees: a.fees + m.fees, capital: 0, net: a.net + m.net, payments: a.payments + m.payments }), { collected: 0, refunds: 0, fees: 0, capital: 0, net: 0, payments: 0 });
  const stripeRev = {
    configured: true, currency: "usd", generated_at: NOW.toISOString(), months, current: months[11], totals,
    byType: [{ type: "charge", label: "Charges", amount: totals.collected, count: totals.payments }, { type: "stripe_fee", label: "Stripe fees", amount: -totals.fees, count: totals.payments }, { type: "refund", label: "Refunds", amount: -totals.refunds, count: 22 }, { type: "payout", label: "Payouts", amount: -(totals.net - 41000), count: 104 }],
    recent: active.slice(0, 12).map((c, i) => ({ id: `ch_${i}`, created: Math.floor((NOW.getTime() - i * 5 * 36e5) / 1000), amount: c.services.reduce((s, v) => s + v.price, 0), type: "charge", description: `${c.business} · ${c.services[0].name}`, fee: 0, net: 0, status: "available" })),
    transaction_count: totals.payments,
  };
  const subscriptions = active.map((c, i) => {
    const mrr = c.services.reduce((s, v) => s + v.price, 0);
    const started = ago(Math.round(20 + (i / active.length) * 520 + ri(0, 25)));
    return { id: `sub_${i}`, status: "active", started, ended: null, mrr, current_period_end: ahead(ri(1, 28)), client: { id: c.id, name: c.business, business: c.business }, customer: { id: `cus_${i}`, name: c.business }, lines: c.services.map((s) => ({ name: s.name, amount: s.price })), items: c.services.map((s) => ({ name: s.name, amount: s.price, interval: "month" })) };
  });
  // a handful of churned subs so the movement chart has texture
  for (let i = 0; i < 9; i++) subscriptions.push({ id: `sub_x${i}`, status: "canceled", started: ago(400 - i * 20), ended: ago(200 - i * 18), mrr: [750, 1100, 1750, 2450][i % 4], client: null, customer: { id: `cusx${i}`, name: "Former client" }, lines: [], items: [] });
  const mrrNow = subscriptions.filter((s) => s.status === "active").reduce((a, s) => a + s.mrr, 0);
  const hc = active.filter((c) => /HyperCare/.test(c.services[0].name)); const gc = active.filter((c) => /Gravïty/.test(c.services[0].name));
  const sumMrr = (arr) => arr.reduce((a, c) => a + c.services.reduce((x, v) => x + v.price, 0), 0);
  const cur = months[11];
  const stripeSubs = { configured: true, subscriptions: subscriptions.filter((x) => x.status === "active"), plans: { hypercare: { count: hc.length, mrr: sumMrr(hc) }, gravitycare: { count: gc.length, mrr: sumMrr(gc) }, mission: { count: 6, mrr: 8400 } }, month: { key: monthKey(NOW), subscriptions: Math.round(mrrNow * 0.83), invoices: Math.round(active.length * 0.83), other: Math.max(0, cur.collected - Math.round(mrrNow * 0.83)), collected: cur.collected, fees: cur.fees, capital: 0, net: cur.net }, mrr: mrrNow, customers: active.length, history: subscriptions };

  // Accounting & Taxes ledger: this tax year's deposits and spend at the same scale.
  const LB = { business_id: "interstellar", tax_year: Y };
  const L = [];
  const catMap = { Payroll: ["wages", "Sch C L26"], Contractors: ["contract_labor", "Sch C L11"], "AI Tools": ["ai_tools", "Sch C L27a"], Software: ["software", "Sch C L27a"], Hosting: ["hosting", "Sch C L27a"], Advertising: ["advertising", "Sch C L8"], Marketing: ["advertising", "Sch C L8"], Office: ["rent", "Sch C L20b"], Insurance: ["insurance", "Sch C L15"], Finance: ["professional_fees", "Sch C L17"], Design: ["software", "Sch C L27a"], SEO: ["software", "Sch C L27a"], Travel: ["travel", "Sch C L24a"], Operations: ["professional_fees", "Sch C L17"] };
  months.filter((m) => m.key.startsWith(String(Y))).forEach((m, mi) => {
    const [yy, mm] = m.key.split("-").map(Number);
    const last = yy === NOW.getFullYear() && mm === NOW.getMonth() + 1 ? NOW.getDate() : 28;
    for (let k = 0; k < 8; k++) L.push({ ...LB, id: `lg_in${mi}_${k}`, date: `${m.key}-${pad(Math.min(last, 2 + k * 3))}`, amount: Math.round(m.collected / 8), direction: "in", payee: "Stripe payout", description: "Client subscriptions + builds", category: "revenue", tax_category: "income", form_line: "Sch C L1", source: "stripe", account: "Operating account", reconciled: true, review_status: "approved" });
    E.Expense.forEach((e, k) => { if (e.frequency !== "Monthly") return; const [category, form_line] = catMap[e.category] || ["other", "Sch C L27a"]; L.push({ ...LB, id: `lg_out${mi}_${k}`, date: `${m.key}-${pad(Math.min(last, e.dueDay || 1))}`, amount: e.amount, direction: "out", payee: e.platform, description: e.platform, category, tax_category: "deductible", form_line, source: "csv", account: "Operating account", reconciled: true, review_status: "approved" }); });
  });
  [["GOOGLE *ADS 4471", 8420, "out", "advertising"], ["DELTA AIR 0062", 1286.4, "out", "travel"], ["STRIPE TRANSFER", 48200, "in", "transfer"], ["AMAZON MKTPL*2K91", 642.18, "out", null]].forEach(([p, amount, direction, cat], i) => L.push({ ...LB, id: `lg_rv${i}`, date: ago(i), amount, direction, payee: p, description: p, account: "Operating account", source: "csv", reconciled: true, review_status: "needs_review", ai_suggestion: cat ? { category: cat, confidence: 0.9, reason: "Matched descriptor", by: "ai" } : undefined }));
  E.LedgerTransaction = L;
  E.AccountingAlert = [{ id: "aal1", business_id: "interstellar", key: `est-${Y}-Q4`, kind: "estimated_tax", status: "new", title: `Q4 ${Y} estimated taxes due Jan 15, ${Y + 1}`, body: "Set aside and ready: federal $286,400 · state $74,900.", due_date: `${Y + 1}-01-15`, link: "/financial?tab=accounting&sub=plan" }];
  E.BusinessTaxProfile = [{ id: "btp1", business_id: "interstellar", entity_type: "smllc_schedule_c", planned_scorp_year: Y + 1, completed: true, business_name: "Interstellar Strategies" }];
  E.AccountingAsset = [{ id: "aas1", business_id: "interstellar", name: "Studio camera + lighting kit", cost: 38400, placed_in_service: ago(120), business_use_pct: 100, asset_class: "equipment", treatment: "bonus" }, { id: "aas2", business_id: "interstellar", name: "Workstations ×12", cost: 46800, placed_in_service: ago(200), business_use_pct: 100, asset_class: "computer", treatment: "bonus" }];
  E.MileageEntry = Array.from({ length: 24 }, (_, i) => ({ id: `mi${i}`, business_id: "interstellar", date: ago(i * 6), miles: ri(12, 140), purpose: "Client site visit" }));

  // MRR snapshots (fallback history) too
  E.FinanceSnapshot = months.map((m, i) => ({ id: `fs${i}`, date: `${m.key}-28`, mrr: Math.round(mrrNow * (0.66 + i * 0.031)), paying_clients: Math.round(active.length * (0.7 + i * 0.027)), active_clients: Math.round(active.length * (0.7 + i * 0.027)), expenses_monthly: 360000, source: "scheduled" }));

  E.RevenueProjection = [
    ["Granite Peak Solar", "Mission ALPHA", 8997, 9, "One-Time", "Pending"], ["Lakeside Med Spa", "HyperCare+ National", 1750, 12, "Recurring", "Pending"], ["Kestrel Law Group", "Command System", 5997, 18, "One-Time", "Pending"],
    ["Sterling Remodeling", "Mission ALPHA", 8997, 21, "One-Time", "Pending"], ["Coastal Fitness (4 locations)", "HyperCare+ Global", 3000, 25, "Recurring", "Pending"], ["Meridian Realty", "Mission BRAVO", 6497, 30, "One-Time", "Pending"],
    ["Foxglove Bakery", "Custom Website", 4997, 34, "One-Time", "Pending"], ["Highland HVAC", "HyperCare+ National", 1750, 40, "Recurring", "Pending"], ["Westfield Plumbing", "Ops Command", 3000, 45, "One-Time", "Pending"],
    ["Bayview Chiropractic", "Mission ALPHA", 8997, 52, "One-Time", "Pending"], ["Quarry Concrete", "HyperCare+ Local", 750, 58, "Recurring", "Pending"], ["Vista Insurance", "Brand Arsenal", 2500, 63, "One-Time", "Pending"],
    ["Juniper Veterinary", "Mission ALPHA", 8997, -6, "One-Time", "Won"], ["Ember Electric", "HyperCare+ Global", 3000, -12, "Recurring", "Won"], ["Orchard Lane Movers", "Mission BRAVO", 6497, -15, "One-Time", "Won"], ["Liberty Pest Control", "Command System", 5997, -20, "One-Time", "Lost"],
  ].map(([clientName, serviceTitle, amount, d, projectionType, status], i) => ({ id: `rp${i}`, clientName, serviceTitle, amount, expectedCloseDate: d >= 0 ? ahead(d) : ago(-d), projectionType, status, note: "" }));

  E.RevenueGoal = [{ id: "rg1", title: "$10M run-rate", target_amount: 10000000, metric: "run_rate", start_date: `${Y}-01-01`, deadline: `${Y + 1}-12-31`, is_primary: true, notes: "Two platforms, every client. Grow the book, keep churn under 1%." }];
  E.Goal = [{ id: "g1", title: "$10M run-rate", target_mrr: 833000, baseline_mrr: 240000, priority: 1, status: "active", is_primary: true, routes: [
    { id: "r1", name: "Mission ALPHA → HyperCare+ National", preset: "alpha", monthly_price: 2450, has_addons: true, addon_low: 1500, addon_high: 3000, addon_avg: 2500, addon_attach_rate: 0.4, clients_per_month: 9, monthly_churn_rate: 0.008 },
    { id: "r2", name: "Mission BRAVO → HyperCare+ Local", preset: "bravo", monthly_price: 1450, has_addons: true, addon_low: 1400, addon_high: 3000, addon_avg: 2000, addon_attach_rate: 0.3, clients_per_month: 7, monthly_churn_rate: 0.01 },
    { id: "r3", name: "Multi-location → HyperCare+ Global", preset: "global", monthly_price: 4400, has_addons: false, clients_per_month: 3, monthly_churn_rate: 0.006 },
  ] }];

  E.Investment = [
    ["Second studio: video + podcast suite", "Real estate", 185000, "High", "Transmission demand is 3× capacity."], ["Senior engineer ×2 (Command Systems)", "Team", 310000, "High", "Cuts Command System delivery from 21 to 12 days."],
    ["Client success lead", "Team", 95000, "High", "One per 60 accounts."], ["GPU workstation fleet (4)", "Hardware", 48000, "Medium", "Local generation for Simple Social."], ["Brand film + launch campaign", "Marketing", 120000, "Medium", "2027 rebrand rollout."],
    ["Leadership program", "Education", 18000, "Low", "Team leads."], ["Data platform annual plan", "Software", 36000, "Medium", "Search intelligence at scale."], ["Index fund · treasury reserve", "Other", 500000, "High", "6 months of runway parked."],
  ].map(([name, category, estimatedCost, priority, notes], i) => ({ id: `iv${i}`, name, category, estimatedCost, priority, notes, acquired: i === 3 }));

  E.InvestmentAdvice = [
    ["Hire a second Command System engineer", "hire", "Backlog of 11 builds; each engineer ships ~2.5 systems a month.", "Post the role from the Hiring plan", 13000, "monthly", 46000, 1, "high"],
    ["Raise paid search budget by 20% on Mission ALPHA terms", "ads", "Cost per booked call is $142 and 31% of calls close.", "Add $5,300/mo to the Mission ALPHA campaign", 5300, "monthly", 28000, 1, "high"],
    ["Productize the Chrome Workspace setup", "productized_offer", "Every Ops Command client asks for it; one-click install already built.", "Bundle into Ops Command onboarding", 0, "time_only", 9000, 0, "medium"],
  ].map(([title, category, rationale, first_step, est_cost, cost_type, est_monthly_impact, payback_months, confidence], i) => ({ id: `ia${i}`, batch_id: "b1", generated_at: agoTs(1), trigger: "scheduled", kind: "business", title, category, rationale, first_step, est_cost, cost_type, est_monthly_impact, payback_months, confidence, priority: i + 1, status: "new" }));

  // ---------------- Work: tasks, projects, todo ----------------
  const tasks = [];
  const tt = [
    ["Ship crew-scheduling module to Summit Ridge Command System", "development", "doing", c1], ["Record Transmission walkthrough for Harborline", "marketing", "next", H[1]], ["Final Intel Briefing sweep: Blue Heron", "strategy", "next", H[2]],
    ["Proposal: Granite Peak Solar Mission ALPHA", "sales", "doing", null], ["Map pack grid review (42 Global accounts)", "content", "next", null], ["Approve 13-platform launch posts for Summit Ridge", "marketing", "next", c1],
    ["Onboard 3 new HyperCare+ National clients", "ops", "doing", null], ["Q4 estimated taxes: confirm set-aside", "finance", "next", null], ["Interview: Client success lead (round 2)", "admin", "next", null],
    ["Brand Arsenal handover: Cedar Hollow Roofing", "design", "next", active[3]], ["Launch Grid: 18 listings for Ironclad HVAC", "content", "doing", active[5]], ["Rebuild quote flow in Tidewater's system", "development", "blocked", active[7]],
    ["Monthly reports: 154 clients", "content", "next", null], ["Chrome Workspace install for Copperline", "ops", "next", active[6]], ["AI Email Agent rollout: Granite Peak", "ops", "next", active[8]],
  ];
  tt.forEach(([title, category, status, c], i) => tasks.push({ id: `k${i + 1}`, title, category, status, client_id: c?.id, client_name: c?.business || "Interstellar", priority: (i % 3) + 1, due_date: ahead(i % 7 - 1), is_focus: i < 2, source: i % 3 === 0 ? "ai" : "manual", portal_visible: c === c1, estimated_hours: ri(1, 8), logged_hours: ri(0, 6), task_type: c ? "billable" : "internal", project_name: c ? `${c.business} build` : undefined }));
  for (let i = 0; i < 26; i++) { const c = active[ri(3, 60)]; tasks.push({ id: `kd${i}`, title: pick(["Publish blog", "GBP post", "Schema fix", "Speed pass", "Review replies", "Citation cleanup", "Service-area page", "Social batch approved"]) + ` · ${c.business}`, category: pick(["content", "development", "marketing", "ops"]), status: "done", client_id: c.id, client_name: c.business, completed_at: agoTs(ri(0, 6)), due_date: ago(ri(0, 6)), priority: 2, source: "automation", logged_hours: ri(1, 3) }); }
  E.Task = tasks;
  E.ToDoItem = tasks.slice(0, 8).map((t, i) => ({ id: `td${i}`, title: t.title, taskType: "Other Task", category: i < 4 ? "Priority" : "NextUp", status: t.status === "done" ? "Completed" : "Pending", done: false, assignedTo: t.client_name, dueDate: t.due_date }));

  const ptypes = [["Command System", "app", 5997], ["Custom Website", "website", 4997], ["Brand Arsenal", "branding", 2500], ["Launch Grid", "seo", 1400], ["Ops Command", "automation", 3000], ["Transmission", "marketing", 1500]];
  E.Project = [];
  let pj = 0;
  for (let i = 0; i < 30; i++) {
    const c = i < 6 ? c1 : active[3 + (i * 3) % 90];
    const [label, type, value] = ptypes[i % ptypes.length];
    const status = i < 3 ? "in_progress" : pick(["in_progress", "in_progress", "review", "planning", "launched", "launched", "done", "proposed"]);
    E.Project.push({ id: `pj${++pj}`, client_id: c.id, client_name: c.business, title: `${c === c1 ? "Summit Ridge" : c.business} · ${label}`, type, status, priority: (i % 3) + 1, start_date: ago(ri(5, 60)), due_date: ahead(ri(3, 40)), estimated_hours: ri(20, 120), logged_hours: ri(5, 90), contract_value: value, billing: "one_time", accent: c.accent, description: `${label} for ${c.business}.`, portal_visible: true, progress: status === "launched" || status === "done" ? 100 : ri(15, 90), service_key: type });
  }
  E.Project.unshift(
    { id: "pjA", client_id: c1.id, client_name: c1.business, title: "Summit Ridge Command System", type: "app", status: "in_progress", progress: 72, description: "Leads, estimates, jobs, crew calendar, invoices and the customer portal in one system.", portal_visible: true, due_date: ahead(9), contract_value: 5997 },
    { id: "pjB", client_id: c1.id, client_name: c1.business, title: "Fleet & equipment tracker", type: "app", status: "planning", progress: 20, description: "Every truck and trailer: location, service dates and who has it today.", portal_visible: true, due_date: ahead(24) },
    { id: "pjC", client_id: c1.id, client_name: c1.business, title: "Crew time clock", type: "app", status: "proposed", description: "Clock in at the job site; hours flow straight to payroll.", portal_visible: true },
    { id: "pjD", client_id: c1.id, client_name: c1.business, title: "Customer rewards program", type: "app", status: "proposed", description: "Points for referrals and repeat jobs.", portal_visible: true },
  );

  E.TimeEntry = [];
  for (let i = 0; i < 120; i++) { const t = tasks[i % 15]; const d = ri(0, 27); E.TimeEntry.push({ id: `te${i}`, task_id: t.id, task_title: t.title, client_id: t.client_id, client_name: t.client_name, category: t.category, seconds: ri(1800, 14400), started_at: agoTs(d, 9), ended_at: agoTs(d, 12), project_type: pick(["app", "website", "seo", "branding"]) }); }

  E.InboxItem = [
    ["Voice note: call Kestrel Law back about multi-office pages", "task", "Call Kestrel Law re: multi-office pages", "sales"], ["Idea: bundle Chrome Workspace into every Ops Command", "project", "Chrome Workspace productization", "ops"], ["Forwarded: Ironclad wants a fleet tracker", "project", "Ironclad fleet tracker", "development"],
  ].map(([raw_text, suggested_kind, suggested_title, suggested_category], i) => ({ id: `in${i}`, raw_text, source: i === 0 ? "voice" : "manual", status: "needs_review", suggested_kind, suggested_title, suggested_category, suggested_priority: 2, confidence: 0.86, captured_on: agoTs(i) }));

  E.ClaudeJob = [
    ["Blog: storm-season roof inspections (Summit Ridge)", "blog", "needs_approval", c1], ["Monthly report · October (154 clients)", "report", "running", null], ["Industry playbook: dental", "playbook", "approved", H[1]],
    ["Map pack plan: Ironclad HVAC", "map_pack_plan", "queued", active[5]], ["Social plan: Blue Heron Coffee", "social_plan", "needs_approval", H[2]], ["Presentation: Q4 board review", "presentation", "approved", null],
    ["Audit: Granite Peak Solar (Intel Briefing)", "audit", "running", active[8]], ["GBP post batch (42 Global accounts)", "gbp_post", "queued", null],
  ].map(([title, kind, status, c], i) => ({ id: `cj${i}`, title, kind, status, client_id: c?.id, client_name: c?.business, priority: 2, requested_at: agoTs(i % 3), started_at: status === "running" ? agoTs(0) : undefined, result_summary: status === "approved" || status === "needs_approval" ? "Draft ready for review." : "", stage: status }));

  // ---------------- Delivery data per client ----------------
  E.OrbitSEOClient = active.slice(0, 40).map((c, i) => ({ id: `o${i}`, clientId: c.id, businessName: c.business, website: c.domain, primaryLocation: c.location, serviceType: i < 12 ? "International" : i < 26 ? "National" : "Local", status: i % 11 === 4 ? "Needs Attention" : "Active", blogFrequency: "2x weekly", lastBlogPosted: ago(ri(0, 4)), nextBlogDue: ahead(ri(0, 4)), gbpStatus: "Active", gbpLastPost: ago(ri(0, 6)), gbpNextDue: ahead(ri(0, 5)), blogsPublishedCount: ri(40, 180), gbpPostsDoneCount: ri(30, 140), blogs: [], gbpPosts: [], tasks: [] }));

  const workKinds = [["blog", "How to choose a roofing contractor in Boise (2027 guide)"], ["gbp_post", "Free roof inspections after the windstorm"], ["site_edit", "Added Meridian + Eagle service-area pages"], ["project_page", "Project: 4,200 sq ft custom build in Harris Ranch"], ["press", "Featured in Idaho Business Review: 'Builders to watch'"], ["citation", "Listed and verified on Apple Maps, Bing and Nextdoor"], ["schema", "LocalBusiness + Review schema validated"], ["blog", "Kitchen remodel costs in Boise: what drives the price"], ["gbp_post", "Now booking spring additions"], ["search_console", "38 new pages indexed on Google and Bing"], ["new_page", "New page: Financing options"], ["blog", "ADU builds in Ada County: permits, timeline, budget"], ["mention", "Cited in a ChatGPT answer for 'best custom home builder Boise'"], ["report", "October results report published"], ["backlink", "Boise Chamber member directory link live"]];
  E.WorkLog = [];
  workKinds.forEach(([kind, title], i) => E.WorkLog.push({ id: `w${i}`, client_id: c1.id, client_name: c1.business, kind, title, date: ago(Math.floor(i * 1.6)), status: "live", source: i % 2 ? "automation" : "claude", verified_live: true, url: `https://${c1.domain}/`, portal_visible: true }));
  for (let i = 0; i < 60; i++) { const c = active[1 + (i % 40)]; const [kind, title] = pick(workKinds); E.WorkLog.push({ id: `wx${i}`, client_id: c.id, client_name: c.business, kind, title: title.replace(/Boise|Summit Ridge|Ada County|Harris Ranch|Meridian \+ Eagle/g, c.location.split(",")[0]), date: ago(ri(0, 20)), status: "live", source: "automation", verified_live: true, portal_visible: true }); }

  E.Automation = [];
  const autoKinds = [["Blog drop (Tue/Thu)", "blog", "Tue + Thu 9am"], ["GBP post (weekly)", "gbp_post", "Mon 10am"], ["Search Console watch", "search_console", "Daily 6am"], ["Schema check", "schema_check", "Weekly"], ["Citation sync", "citations", "Monthly"], ["Analytics digest", "analytics", "Mon 7am"], ["Review requests", "email", "On job close"]];
  active.slice(0, 30).forEach((c, ci) => autoKinds.forEach(([name, kind, schedule], k) => { if ((ci + k) % 3 === 2 && ci > 0) return; E.Automation.push({ id: `au${ci}_${k}`, client_id: c.id, client_name: c.business, name, kind, runner: k < 2 ? "claude_scheduled" : "base44_function", schedule, status: (ci * 7 + k) % 23 === 5 ? "error" : "active", last_result: "success", last_run_at: agoTs(ri(0, 3)), next_run_at: aheadTs(ri(0, 3)), runs_count: ri(20, 220), portal_visible: true }); }));

  E.AutomationRun = [];
  for (let i = 0; i < 240; i++) { const a = E.Automation[i % E.Automation.length]; E.AutomationRun.push({ id: `ar${i}`, automation_id: a.id, client_id: a.client_id, client_name: a.client_name, kind: a.kind, automation_name: a.name, started_at: agoTs(ri(0, 29), ri(6, 18)), status: i % 37 === 3 ? "failed" : "success", title: a.name, verified_live: true }); }

  E.ClientRequest = [
    [c1, "site_edit", "Add the new financing banner to the homepage", "in_progress", "high"], [c1, "project_submission", "New project: modern farmhouse in Hidden Springs", "complete", "normal"], [c1, "social_post", "Post the crew BBQ photos across every platform", "received", "normal"],
    [c1, "app_edit", "Add a 'warranty claim' button to the customer portal", "in_progress", "normal"], [c1, "design_asset", "Yard sign + truck wrap update", "complete", "normal"], [c1, "email_signature", "Signatures for 6 new hires", "complete", "low"],
    [H[1], "blog_post", "Blog: Invisalign vs braces for adults", "received", "normal"], [H[2], "site_edit", "Holiday hours on every listing", "needs_info", "urgent"], [active[4], "bug", "Booking widget double-submits on iPhone", "in_progress", "urgent"],
    [active[9], "gbp_post", "Promote the spring tune-up special", "received", "normal"], [active[12], "new_page", "Page for the new Spokane location", "in_progress", "high"], [active[15], "question", "Can we add Spanish pages?", "received", "low"],
  ].map(([c, kind, title, status, priority], i) => ({ id: `r${i}`, client_id: c.id, client_name: c.business, kind, title, details: title, status, priority, created_date: agoTs(i * 0.7), completed_at: status === "complete" ? agoTs(i * 0.5) : undefined, source: "portal", page_status: kind === "project_submission" ? "live" : "none" }));

  E.ClientGoal = [
    { id: "cg1", client_id: c1.id, year: Y + 1, title: "Double booked jobs from Google", metric: "Booked jobs from search per month", baseline_value: 38, current_value: 71, target_value: 90, unit: "jobs / mo", status: "on_track", sort: 1, plan_steps: [{ title: "Launch 24 service-area pages", done: true }, { title: "Two blogs a week", done: true }, { title: "Review requests after every job", done: true }, { title: "Map pack top 3 in 8 cities", done: false }] },
    { id: "cg2", client_id: c1.id, year: Y + 1, title: "$12M in signed projects", metric: "Signed contract value", baseline_value: 6.8, current_value: 9.4, target_value: 12, unit: "$M", status: "on_track", sort: 2, plan_steps: [{ title: "Quote follow-up automation", done: true }, { title: "Financing page", done: true }, { title: "Referral rewards in the portal", done: false }] },
    { id: "cg3", client_id: c1.id, year: Y + 1, title: "500 Google reviews", metric: "Google reviews", baseline_value: 212, current_value: 386, target_value: 500, unit: "reviews", status: "on_track", sort: 3, plan_steps: [{ title: "QR review cards in every truck", done: true }, { title: "Text a review link at job close", done: true }] },
  ];
  E.ClientGap = [
    ["No after-hours lead capture", "system", "high", "in_progress", "Nøva answers and books estimates 24/7 from the site."], ["Apple Maps listing missing photos", "gbp", "medium", "planned", "Upload 25 project photos and hours."], ["Spanish-speaking customers have no landing pages", "website", "medium", "planned", "Add ES versions of the top 10 pages."], ["Quote follow-up stops after day 3", "ops", "high", "fixed", "7-touch email + SMS sequence in the Command System."], ["Crew photos not reaching social", "social", "low", "open", "Auto-collect job photos into Social Studio."],
  ].map(([title, area, severity, status, recommendation], i) => ({ id: `gp${i}`, client_id: c1.id, title, area, severity, status, recommendation, portal_visible: true, impact: "Revenue left on the table" }));

  E.PerformanceSnapshot = [];
  for (let m = 6; m >= 1; m--) {
    const f = 1 + (6 - m) * 0.14;
    E.PerformanceSnapshot.push({ id: `ps_g${m}`, client_id: c1.id, source: "gbp", period_start: ago(m * 30), period_end: ago(m * 30 - 29), metrics: { views: Math.round(18400 * f), searches: Math.round(11200 * f), calls: Math.round(412 * f), directions: Math.round(268 * f), website_clicks: Math.round(1310 * f) } });
    E.PerformanceSnapshot.push({ id: `ps_s${m}`, client_id: c1.id, source: "gsc", period_start: ago(m * 30), period_end: ago(m * 30 - 29), metrics: { clicks: Math.round(9800 * f), impressions: Math.round(412000 * f), ctr: 2.4 + (6 - m) * 0.1, avg_position: 9.8 - (6 - m) * 0.9 } });
    E.PerformanceSnapshot.push({ id: `ps_a${m}`, client_id: c1.id, source: "ga4", period_start: ago(m * 30), period_end: ago(m * 30 - 29), metrics: { users: Math.round(24800 * f), sessions: Math.round(33100 * f), conversions: Math.round(640 * f), engagement_rate: 61 + (6 - m) } });
  }
  E.ClientFile = [
    ["Summit Ridge brand kit (v3)", "brand_kit"], ["Estimating SOP", "sop"], ["Crew onboarding guide", "guide"], ["Q3 results presentation", "presentation"], ["Truck wrap + yard sign files", "design"], ["Transmission: 'How we build' (90s)", "video"], ["Animated email signatures (22)", "email_signature"], ["October report", "report"], ["Master services agreement", "contract"], ["Social launch kit · 13 platforms", "social"],
  ].map(([title, category], i) => ({ id: `f${i}`, client_id: c1.id, title, category, link_url: "https://example.com/demo", description: `${title} for Summit Ridge Builders.`, delivered_on: ago(i * 6 + 2), portal_visible: true }));

  E.ConversationMessage = [
    ["admin", "Morning Dana! The crew-scheduling module is live in your Command System. Drag a job onto a crew and they get a text.", 3], ["client", "This is huge. The guys already used it for tomorrow's pours.", 3],
    ["admin", "38 new pages indexed this week and you're now top 3 in the map pack for 'custom home builder' in 6 of 8 cities.", 2], ["client", "Can we get the BBQ photos out on all the socials?", 1],
    ["admin", "Done: scheduled across all 13 platforms for 10am tomorrow. Preview's in Social Studio.", 1], ["admin", "Your October report is in Files. Short version: calls from Google +31%, 61 new reviews.", 0],
  ].map(([sender_role, content, d], i) => ({ id: `m${i}`, client_id: c1.id, content, sender_role, sender_name: sender_role === "admin" ? "Interstellar Strategies" : "Dana Whitaker", messageType: "text", timestamp: agoTs(d, 9 + i), created_date: agoTs(d, 9 + i), read_at: i < 5 ? agoTs(d) : null }));
  for (let i = 0; i < 30; i++) { const c = active[1 + i]; E.ConversationMessage.push({ id: `mx${i}`, client_id: c.id, content: pick(["Thanks, looks great!", "Can we move the call to Thursday?", "New review just came in, can you reply?", "Approved the posts.", "Love the new page."]), sender_role: i % 2 ? "client" : "admin", sender_name: i % 2 ? c.contact : "Interstellar Strategies", timestamp: agoTs(i % 6), created_date: agoTs(i % 6), read_at: null }); }
  E.ChatThread = [{ id: "th1", kind: "group", title: "Summit Ridge × Interstellar · Launch room", description: "Builds, launches and approvals", client_ids: [c1.id], last_message_at: agoTs(0), last_message_preview: "Transmission v2 is ready for review." }, { id: "th2", kind: "group", title: "HyperCare+ National clients", description: "Monthly office hours", client_ids: active.slice(0, 20).map((c) => c.id), last_message_at: agoTs(1), last_message_preview: "Office hours recording is up." }];

  E.ReviewClient = active.slice(0, 24).map((c, i) => {
    const total = c === c1 ? 386 : ri(80, 900);
    const authors = ["Kelsey M.", "Brandon T.", "Olivia R.", "Hector G.", "Naomi P.", "Grant W.", "Leah S.", "Victor A."];
    const texts = c === c1 ? ["They built our dream home on time and on budget. The customer portal kept us in the loop every single day.", "Best contractor experience we've had. Clean job sites, clear estimates, zero surprises.", "Dana and the crew were incredible from first call to final walkthrough.", "We could see every invoice and photo in their app. Total transparency.", "Our ADU came out beautiful. Already recommending them to neighbors."] : ["Fast, friendly and professional.", "Highly recommend!", "Five stars, would book again.", "Great communication the whole way through.", "Exactly what we needed."];
    return { id: `rc${i}`, name: c.business, slug: slug(c.business), crm_client_id: c.id, website: c.domain, active: true, cached_at: agoTs(0), cache: { configured: true, rating: c === c1 ? 4.9 : [4.8, 4.9, 5, 4.7, 4.9][i % 5], total, businessName: c.business, mapsUrl: "https://maps.google.com", reviewUrl: "https://g.page/r/demo/review", reviews: texts.map((text, k) => ({ author: authors[(i + k) % authors.length], rating: 5, text, relative: `${k + 1} ${k ? "days" : "day"} ago`, time: agoTs(k + 1) })) } };
  });

  E.SiteAudit = active.slice(0, 30).map((c, i) => ({ id: `sa${i}`, client_id: c.id, client_name: c.business, url: `https://${c.domain}`, strategy: "mobile", source: "pagespeed", status: "complete", run_at: agoTs(ri(0, 3)), health_score: i === 0 ? 98 : ri(88, 100), scores: { performance: ri(90, 100), seo: 100, accessibility: ri(95, 100), best_practices: 100 }, vitals: { lcp: 1.2 + rnd(), cls: 0.01, inp: 90 }, issues: [] }));
  E.SeoIntel = [
    ["Google expands AI Mode citations for local service queries", "update", "aio", "high", "Answer-first service pages win citations; ours are already structured this way."], ["Map pack: 'open now' weighting increased", "update", "local", "high", "Hours accuracy pushed to all 154 profiles today."], ["Bing Places adds review replies", "action", "local", "medium", "Reply automation extended to Bing."], ["Perplexity shopping cards for services", "horizon", "geo", "medium", "Schema for offers added to service pages."], ["Core Web Vitals: INP threshold tightened", "action", "seo", "medium", "Speed pass scheduled for 12 sites."],
  ].map(([title, kind, area, impact, for_us], i) => ({ id: `si${i}`, brief_date: ago(i % 2), kind, area, impact, title, summary: title, for_us, status: i < 2 ? "implemented" : "approved", source_name: "Search intelligence", source_url: "https://example.com" }));

  E.ClientOperationItem = [];
  E.LegalItem = [
    ["deadline", "Q4 federal estimated tax payment", 72], ["deadline", "State annual report filing", 41], ["deadline", "BOI report update (new officer)", 18], ["deadline", "Sales tax return (Q4)", 87], ["deadline", "W-2s + 1099s to 25 employees & 9 contractors", 88], ["deadline", "Trademark renewal: MØTHERSHIP™", 140],
    ["todo", "Update MSA with AI Email Agent data clause", 6], ["todo", "Renew cyber insurance policy", 24], ["todo", "Contractor agreements for Q1 video team", 12], ["todo", "Privacy policy refresh (Simple Social)", 30], ["todo", "Register trademark: Nøva", 45],
    ["date", "LLC formed", -900], ["date", "S-corp election effective", -300], ["date", "Office lease renewal", 210],
  ].map(([section, task, d], i) => ({ id: `lg${i}`, section, task, dueDate: d >= 0 ? ahead(d) : ago(-d), status: d < 0 ? "Done" : i % 5 === 0 ? "In progress" : "Open", done: d < 0 }));

  E.AppDocument = [
    ["Brand guidelines 2027", "Brand"], ["MSA template", "Legal"], ["Mission ALPHA SOP", "Operations"], ["Pricing & packages", "Sales"], ["Employee handbook", "HR"], ["Onboarding checklist", "Operations"], ["Investor update · Q3", "Finance"], ["Insurance certificates", "Legal"], ["Simple Social roadmap", "Product"], ["Chrome Workspace template", "Operations"], ["Command System architecture", "Product"], ["Board deck · Q3", "Finance"],
  ].map(([name, category], i) => ({ id: `doc${i}`, name, category, url: "https://example.com/doc", date: ago(i * 5), pinned: i < 3 }));
  E.FormTemplate = [];

  // ---------------- Idea Vault ----------------
  E.Idea = [
    ["Simple Social: image, video and voice generation for every client", "Product", "building", 94, "Launch inside the portal; every plan gets fair-use credits."], ["Chrome Workspace one-click installer", "Operations", "live", 91, "Ships as part of Ops Command."], ["AI Email Agent for every Command System", "Product", "building", 89, "Triage, labels and drafted replies with approval."],
    ["Franchise edition of the Command System", "Product", "validating", 86, "Multi-location roll-up for franchise groups."], ["Prestige wall at HQ", "Marketing", "idea", 71, "Celebrate referrers publicly."], ["Interstellar Academy (paid course)", "Content", "validating", 77, "Teach owners the 4-tab business."],
    ["Fleet tracker template", "Product", "live", 82, "Built for Summit Ridge; template for all trades."], ["Restaurant daily-flow module", "Product", "validating", 79, "Prep lists, temps, closing checklist."], ["Quarterly owner summit", "Marketing", "idea", 64, "In-person mastermind for clients."], ["Podcast: The Future of Business", "Content", "parked", 58, "Paused until studio 2."],
  ].map(([title, category, stage, score, description], i) => ({ id: `id${i}`, title, category, stage, score, rank: i + 1, description, status: stage === "live" ? "Implemented" : stage === "building" ? "Planned" : "In Review", date: ago(i * 4), source: i % 3 ? "manual" : "oracle", score_breakdown: { effort_band: pick(["S", "M", "L"]), time_to_dollar_label: pick(["< 30 days", "1–3 months", "3–6 months"]), next_action: "Scope v1" }, scored_at: agoTs(1) }));

  // ---------------- Pipeline extras / prestige ----------------
  E.PrestigeMember = [
    ["Dana Whitaker", "Prestige III", 6, c1], ["Dr. Priya Nand", "Prestige II", 4, H[1]], ["Marcus Bell", "Prestige I", 2, H[2]], ["Avery Lindqvist", "Prestige IV", 11, active[3]], ["Jordan Okafor", "Prestige I", 1, active[4]], ["Rowan Pemberton", "Prestige II", 3, active[5]], ["Harper Yamada", "Recruit", 0, active[6]], ["Logan Vasquez", "Prestige Master", 26, active[7]],
  ].map(([name, prestige, totalReferrals, c], i) => ({ id: `pm${i}`, name, prestige, totalReferrals, client_id: c.id, email: c.emails[0], joinDate: ago(300 - i * 20), active: true, referral_code: slug(name).slice(0, 10) }));
  E.PrestigeReferral = [];
  E.PrestigeMember.forEach((m, mi) => { for (let k = 0; k < Math.min(m.totalReferrals, 5); k++) { const pkg = pick(["Mission ALPHA", "Mission BRAVO", "Custom Website", "Command System"]); E.PrestigeReferral.push({ id: `pr${mi}_${k}`, memberId: m.id, memberName: m.name, referredClientName: active[40 + mi * 5 + k].business, package: pkg, amount: { "Mission ALPHA": 8997, "Mission BRAVO": 6497, "Custom Website": 4997, "Command System": 5997 }[pkg], date: ago(ri(5, 200)), status: k === 0 && mi % 2 ? "Booked" : "Paid Out", signed_at: ago(ri(5, 200)) }); } });
  E.PrestigeReward = E.PrestigeReferral.filter((r) => r.status === "Paid Out").map((r, i) => ({ id: `prw${i}`, memberId: r.memberId, memberName: r.memberName, referralId: r.id, referredClientName: r.referredClientName, kind: "signed", reward_type: "credit_500", title: "$500 Interstellar credit", value: 500, status: i % 3 ? "delivered" : "owed", earned_at: r.date }));
  E.PrestigeRedemption = [];

  // ---------------- Studios: QR, signatures, presentations ----------------
  E.QrCode = [
    ["Truck decal · Leave a review", "Reviews", 4182], ["Yard sign · Free estimate", "Marketing", 2964], ["Business card · Dana", "Team", 1217], ["Job-site door hanger", "Marketing", 1876], ["Showroom · Financing", "Sales", 905], ["Invoice footer · Pay online", "Billing", 3340], ["Home show booth", "Events", 1488], ["Warranty card", "Service", 622],
  ].map(([name, folder, scans], i) => ({ id: `qr${i}`, name, folder, client_id: c1.id, client_name: c1.business, mode: "dynamic", content_type: "link", destination: `https://${c1.domain}/${slug(name)}`, short_code: `sr${i}x7Kq`, encoded_url: `https://interstellar-mothership.com/functions/qr?c=sr${i}x7Kq`, scans, last_scan_at: agoTs(0, 8 + i), active: true, source: "admin", style: { fg: "#1a1a1a", bg: "#ffffff", accent: "#ff3c00", dots: "rounded", corners: "extra-rounded" }, created_date: agoTs(60 - i * 5), updated_date: agoTs(i) }));
  active.slice(1, 12).forEach((c, i) => E.QrCode.push({ id: `qrx${i}`, name: `${c.business} · Leave a review`, folder: "Reviews", client_id: c.id, client_name: c.business, mode: "dynamic", content_type: "link", destination: `https://${c.domain}/review`, short_code: `x${i}aB9`, scans: ri(300, 2400), last_scan_at: agoTs(ri(0, 3)), active: true, source: "admin", style: { fg: "#1a1a1a", bg: "#ffffff" }, created_date: agoTs(90), updated_date: agoTs(i + 2) }));
  E.QrScan = [];
  const dev = ["mobile", "mobile", "mobile", "mobile", "tablet", "desktop"]; const oss = ["iOS", "iOS", "Android", "Android", "iOS", "Windows", "macOS"];
  for (let i = 0; i < 1600; i++) { const q = E.QrCode[i % 8]; const d = Math.floor(Math.pow(rnd(), 1.4) * 30); E.QrScan.push({ id: `qs${i}`, qr_id: q.id, short_code: q.short_code, client_id: c1.id, at: new Date(NOW.getTime() - d * DAY - ri(0, 20) * 36e5).toISOString(), device: pick(dev), os: pick(oss), country: "US" }); }
  E.QrTemplate = [{ id: "qt1", name: "Summit Ridge · Flame", scope: "client", client_id: c1.id, client_name: c1.business, style: { fg: "#1a1a1a", accent: "#ff3c00" }, portal_visible: true }];

  const ROLES = [["Dana Whitaker", "Owner & CEO"], ["Mateo Reyes", "Director of Operations"], ["Claire Donovan", "Lead Estimator"], ["Isaac Monroe", "Project Manager"], ["Grace Holland", "Office Manager"], ["Owen Castillo", "Site Superintendent"], ["Ruby Fischer", "Design Coordinator"], ["Eli Navarro", "Project Manager"], ["Hannah Kerr", "Customer Success"], ["Felix Moreau", "Estimator"], ["Ivy Sinclair", "Marketing Lead"], ["Noah Bauer", "Crew Lead"], ["Zoe Larkin", "Accounts"], ["Silas Grant", "Crew Lead"], ["Mila Ortega", "Permits Coordinator"], ["Theo Walsh", "Warranty & Service"], ["Ada Pierce", "Scheduler"], ["Jonah Ellis", "Field Tech"], ["Lena Brooks", "Interior Designer"], ["Caleb Ross", "Safety Officer"], ["Nora Vance", "HR & Recruiting"], ["Miles Carter", "Estimator"], ["Elena Duarte", "Bookkeeper"], ["Wyatt Hale", "Crew Lead"], ["Sofia Lind", "Sales"]];
  const TPL = ["t1_classic", "t2_minimal", "t3_compact", "t4_centered", "t5_rail"];
  E.Signature = ROLES.map(([full_name, job_title], i) => ({ id: `sg${i}`, name: full_name, template_id: TPL[i % 3 === 0 ? 0 : i % 5], client_id: c1.id, client_name: c1.business, folder: i < 6 ? "Leadership" : i < 16 ? "Office" : "Field", fields: { full_name, job_title, company_name: "Summit Ridge Builders", phone: `(208) 555-01${pad(i + 10)}`, email: `${full_name.split(" ")[0].toLowerCase()}@summitridge.demo`, website: "summitridge.demo", website_show: true, slogan: "Built right. Built to last.", assets: {} }, theme: { accent_color: "#ff3c00", accent_color_2: "#ffaa00", animated: true }, updated_date: agoTs(i % 9), created_date: agoTs(30) }));
  E.SignatureTemplate = [{ id: "st1", name: "Summit Ridge · Animated flame", scope: "client", client_id: c1.id, client_name: c1.business, template_id: "t1_classic", is_default: true, portal_visible: true, fields: { company_name: "Summit Ridge Builders" }, theme: { accent_color: "#ff3c00", accent_color_2: "#ffaa00" } }];

  const deck = (title, client, n, eyebrow) => ({ title, client_id: client?.id, client_name: client?.business, theme: "flame", generation_status: "ready", brand: { bg: "#111111", fg: "#f7f5f2", accent: "#ff3c00", mode: "dark" }, slides: [
    { id: "s1", layout: "cover", eyebrow, title, subtitle: "The Future of Business." },
    { id: "s2", layout: "bigstat", title: "Revenue, trailing 12 months", stats: [{ value: "$4.8M", label: "Collected" }] },
    { id: "s3", layout: "stats", title: "Where we are", stats: [{ value: "154", label: "Active clients" }, { value: "99.2%", label: "Retention" }, { value: "13", label: "Platforms per post" }] },
    { id: "s4", layout: "bullets", title: "What ships next", bullets: ["Simple Social (coming soon)", "AI Email Agent", "Chrome Workspace", "Franchise Command System"] },
    { id: "s5", layout: "closing", title: "Let's build.", subtitle: "interstellar-booking.com" },
  ].slice(0, n) });
  E.Presentation = [
    deck("Q4 board review", null, 5, "Interstellar · Board"), deck("Summit Ridge · 2027 growth plan", c1, 5, "Proposal"), deck("Harborline · Mission BRAVO kickoff", H[1], 4, "Kickoff"), deck("Blue Heron · Holiday campaign", H[2], 4, "Campaign"),
    deck("Granite Peak Solar · Mission ALPHA proposal", active[8], 5, "Proposal"), deck("Franchise Command System · pitch", null, 5, "Product"), deck("All-hands · November", null, 4, "Team"), deck("Simple Social · roadmap", null, 5, "Product"),
  ].map((p, i) => ({ id: `pres${i}`, ...p, project_id: ["dp1", "dp2", "dp2", "dp2", "dp3", "dp1", "dp1", "dp3"][i], created_date: agoTs(i * 3), updated_date: agoTs(i) }));
  E.DeckProject = [{ id: "dp1", name: "Interstellar · Board & team", description: "Board reviews, all-hands, product", client: "Interstellar" }, { id: "dp2", name: "Client proposals & kickoffs", description: "Every Mission deck", client: "Clients" }, { id: "dp3", name: "Sales & product", description: "Pitches and roadmaps", client: "Interstellar" }];

  // ---------------- Hiring (trigger reads flights/projects/clients) ----------------
  E.OnboardingFlight = active.slice(0, 18).map((c, i) => ({ id: `of${i}`, client_id: c.id, client_name: c.business, package_key: pick(["mission_alpha", "mission_bravo", "command_system", "custom_website"]), price: pick([8997, 6497, 5997, 4997]), start_date: ago(i * 3), status: i < 6 ? "collecting" : i < 12 ? "kicked_off" : "launched", care_plan: "orbit_national", current_step: "access" }));

  // ---------------- Agents ----------------
  const DEPTS = ["command", "research", "sales", "marketing", "delivery", "success", "backoffice", "systems"];
  const AG = {
    command: ["CEO agent", "Command Briefing", "Business Brain keeper", "Nightly retro"], research: ["Search intelligence (daily)", "Industry scanner", "Competitor watch", "AI-answer tracker", "Oracle forecaster"],
    sales: ["Lead intake + scoring", "Speed-to-lead responder", "Proposal writer", "Follow-up sequencer", "Prestige referral tracker"], marketing: ["Social Studio · 13 platforms", "Blog engine", "GBP poster", "Email Studio", "Ads optimizer", "Transmission scripts"],
    delivery: ["Onboarding flight", "Intel Briefing auditor", "Launch Grid lister", "Map pack planner", "Command System builder", "Chrome Workspace installer"], success: ["Nøva portal assistant", "Review replies", "Monthly reports", "Client health watch", "AI Email Agent"],
    backoffice: ["Bookkeeping categorizer", "Tax set-aside planner", "Invoice chaser", "Hiring plan trigger", "Legal deadline watch"], systems: ["Email authentication", "Usage caps", "Uptime & forms watch", "Security patching"],
  };
  const KIND = ["claude_scheduled_task", "base44_workflow", "in_app_ai", "backend_function", "manual_skill"];
  E.AgentRegistry = [];
  let srt = 0;
  DEPTS.forEach((dep) => AG[dep].forEach((name, k) => E.AgentRegistry.push({ id: `ag_${dep}_${k}`, key: `${dep}_${k}`, name, department: dep, scope: "interstellar", kind: KIND[(k + dep.length) % KIND.length], status: "live", autonomy: k % 3 === 0 ? "autonomous" : "assisted", autonomy_target: "autonomous", last_run_at: agoTs(0, 6 + k), last_status: "success", run_count_30d: ri(30, 900), success_rate_30d: 0.97 + rnd() * 0.03, schedule: pick(["Daily 6am", "Hourly", "On event", "Weekly Mon", "Every 15 min"]), role: `${name} for the agency.`, sort: ++srt, reports_to: dep === "command" ? undefined : "command_0" })));
  // client agent instances for the first 12 clients
  const CT = ["client_ceo", "brain_keeper", "client_research", "seo_blog", "keyword_steward", "search_console", "map_pack", "social_posts", "ads_optimizer", "email_marketing", "review_replies", "review_requests", "site_audit", "monthly_report", "nova"];
  const CTD = { client_ceo: "ceo", brain_keeper: "brain", client_research: "research", seo_blog: "seo", keyword_steward: "seo", search_console: "seo", map_pack: "seo", social_posts: "social", ads_optimizer: "ads", email_marketing: "email", review_replies: "reviews", review_requests: "reviews", site_audit: "website", monthly_report: "reporting", nova: "reporting" };
  active.slice(0, 12).forEach((c) => CT.forEach((t, k) => E.AgentRegistry.push({ id: `ag_${t}_${c.id}`, key: `${t}:${c.id}`, template_key: t, name: t.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()).replace("Ceo", "CEO").replace("Nova", "Nøva"), department: CTD[t], scope: "client", client_id: c.id, client_name: c.business, kind: KIND[k % KIND.length], status: "live", autonomy: "assisted", last_run_at: agoTs(0, 5 + (k % 10)), last_status: "success", run_count_30d: ri(10, 300), success_rate_30d: 0.98, sort: ++srt })));
  E.AgentLearning = [["Blog engine", "Posts with a cost table get 2.3× more AI-answer citations.", "marketing"], ["Speed-to-lead responder", "Replying under 5 minutes doubled booked calls.", "sales"], ["Review replies", "Naming the crew lead in replies lifts review volume 18%.", "success"]].map(([a, learning, department], i) => ({ id: `al${i}`, agent_key: a, learning, department, status: "proposed", source: "run_review", date: ago(i), evidence: "30-day run review" }));
  E.ResearchNote = [];
  E.CeoBrief = [{ id: "cb1", scope: "interstellar", date: ago(0), generated_at: agoTs(0, 6), headline: "Record month: $482K collected, 9 new Mission ALPHA builds, zero churn.", summary: "All 46 agency agents and 180 client agents ran clean overnight. Two approvals waiting: Summit Ridge blog and Blue Heron social plan.", wins: ["9 Mission ALPHA builds signed", "Map pack top 3 for 41 of 42 Global accounts", "61 new reviews for Summit Ridge"], failures: [], needs_approval: ["Summit Ridge blog", "Blue Heron social plan"], recommendations: ["Hire the second Command System engineer this month"], stats: { agents: 226, runs_24h: 1842, success_rate: 99.4 } }];
  const brainSec = (t) => Object.fromEntries(["overview", "offer_pricing", "audience", "brand", "contacts_channels", "website_logins", "gbp_listings", "content", "apps_systems", "billing", "goals", "problems", "competitors", "decisions"].map((k) => [k, { text: `${t}: ${k.replace(/_/g, " ")} documented.`, confidence: "high", updated_at: agoTs(2) }]));
  E.BusinessBrain = [{ id: "bb0", scope: "interstellar", sections: brainSec("Interstellar"), completeness: 100, glance: "Full-stack growth partner: two platforms per client, 154 active accounts.", glance_at: agoTs(0) }, ...active.slice(0, 12).map((c, i) => ({ id: `bb${i + 1}`, scope: "client", client_id: c.id, client_name: c.business, sections: brainSec(c.business), completeness: ri(86, 100), glance: `${c.business}: ${c.industry}, ${c.location}.`, glance_at: agoTs(1) }))];
  E.AgencyKnowledge = [];

  // ---------------- Intelligence (Oracle) ----------------
  const TOP = [["ai_industry", "AI industry", "Where is AI going for small business?", "up"], ["home_service_local", "Home services & local", "What's changing for local service businesses?", "up"], ["marketing_platforms", "Marketing platforms", "Which platforms matter this quarter?", "mixed"], ["economy", "Economy", "Is demand holding?", "flat"], ["jobs_labor", "Jobs & labor", "Who's hiring, and what does it cost?", "up"], ["tech", "Tech", "What new tools change the work?", "up"], ["markets", "Markets", "Where is capital flowing?", "mixed"], ["future_signals", "Future signals", "What's 3–10 years out?", "up"]];
  E.OracleTopic = TOP.map(([key, name, question, trend], i) => ({ id: `ot${i}`, key, name, question, trend, order: i, finding_count: ri(14, 60), headline_answer: `${name}: momentum continues; act on answer-first content and automation now.`, headline_stat: { display: `${ri(18, 74)}%`, label: "YoY change", source_title: "Industry survey" }, last_scanned_at: agoTs(0, 6), what_it_means: "Clients who run on one system adapt fastest." }));
  E.OracleFinding = [];
  TOP.forEach(([key, name], i) => { for (let k = 0; k < 6; k++) E.OracleFinding.push({ id: `of_${i}_${k}`, topic_key: key, date: ago(k), headline: `${name}: signal ${k + 1} — ${pick(["AI answers now cite local pages more often", "Owners consolidating software stacks", "Booking via chat up sharply", "Review velocity weighs more in map pack", "Short video drives most discovery"])}`, whats_happening: "Tracked across sources this week.", impact: "Medium-to-high for service businesses.", opportunity: "Ship it to clients via HyperCare+.", confidence: pick(["medium", "high"]), horizon: pick(["now", "6-12mo", "1-3yr"]), trend: pick(["up", "up", "mixed"]), status: "active", sources: [{ title: "Demo source", publisher: "Demo", url: "https://example.com" }] }); });
  E.OraclePrediction = [["AI answers drive 30% of local service discovery", 0.7, "1-3yr"], ["Half of trades businesses consolidate to ≤5 apps", 0.62, "1-3yr"], ["Voice booking becomes default for home services", 0.45, "3-10yr"]].map(([claim, probability, horizon], i) => ({ id: `op${i}`, claim, probability, horizon, outcome: "pending", topic_key: TOP[i][0], created_at: agoTs(20 + i), resolve_by: ahead(300) }));
  E.OracleBrief = [{ id: "ob1", kind: "daily", date: ago(0), title: "Daily brief", summary: "Three changes worth acting on today; all three already applied to client sites.", new_findings: 14, top_changes: [] }];
  E.OracleThesis = [];
  E.OracleOpportunity = [["Franchise Command System", "Multi-location groups want one system.", 92], ["AI Email Agent as a stand-alone add-on", "Inbox chaos is the #1 complaint on calls.", 88], ["Simple Social credits marketplace", "Clients want more generations than fair use.", 81]].map(([title, why_now, fit_score], i) => ({ id: `oo${i}`, title, why_now, summary: why_now, fit_score, rank: i + 1, effort: pick(["M", "L"]), revenue_band_estimate: pick(["$250K–$1M/yr", "$1M+/yr"]), status: "new", topic_key: "opportunities", created_at: agoTs(i) }));

  // ---------------- Outreach / content / dossier ----------------
  E.OutreachTarget = [["Apple Business Connect", "citation_directory", "won"], ["Bing Places", "citation_directory", "won"], ["Nextdoor Business", "citation_directory", "won"], ["Angi", "review_site", "won"], ["Houzz", "industry_directory", "approved"], ["Idaho Business Review", "local_news", "replied"], ["Boise Chamber", "association_chamber", "won"], ["BuildZoom", "industry_directory", "sent"], ["Best of Boise awards", "awards_lists", "drafted"], ["Yelp", "review_site", "won"], ["BBB", "association_chamber", "won"], ["Thumbtack", "citation_directory", "qualified"]].map(([name, kind, status], i) => ({ id: `otg${i}`, client_id: c1.id, client_name: c1.business, name, kind, status, priority: i < 6 ? "high" : "medium", cost: "free", url: "https://example.com", domain: "example.com", found_by: "claude", found_at: ago(30 - i), live_ok: status === "won" }));
  E.OutreachMessage = []; E.OutreachProfile = [];
  E.ContentPlan = active.slice(0, 10).map((c, i) => ({ id: `cp${i}`, client_id: c.id, client_name: c.business, version: 2, status: "approved", summary: `2 blogs/week, weekly GBP posts and 13-platform social for ${c.business}.`, automation_status: "active", approved_at: agoTs(10), kpis: [{ name: "Calls from Google", target: "+40%", current: "+31%", source: "GBP" }] }));
  E.ClientDossier = [{ id: "cd1", client_id: c1.id, client_name: c1.business, tagline: "Built right. Built to last.", elevator_pitch: "Design-build custom homes, additions and ADUs across the Treasure Valley.", health_score: 96, brand_identity: { colors: [{ hex: "#ff3c00" }, { hex: "#1a1a1a" }], fonts: ["Geist"] }, service_area: { primary_city: "Boise", cities: ["Boise", "Meridian", "Eagle", "Nampa", "Kuna", "Star", "Caldwell", "Garden City"], model: "service_area" }, keywords: [], team_size: 25 }];
  E.IntakeAudit = [{ id: "ia1", client_id: c1.id, business_name: c1.business, status: "reviewed", answers: {}, sections_complete: 9 }];
  E.BrandKit = [{ id: "bk1", client_id: c1.id, client_name: c1.business, status: "approved", version: 3, portal_visible: true, summary: "Flame orange on charcoal, Geist type, plain-spoken builder voice.", kit: {}, body_md: "# Summit Ridge Builders brand kit\n\nFlame orange (#ff3c00) on charcoal (#1a1a1a). Geist for everything. Voice: plain-spoken, proud of the craft, never salesy.", approved_at: agoTs(20) }];
  E.IndustryPlaybook = [{ id: "ip1", client_id: c1.id, client_name: c1.business, status: "approved", version: 1, portal_visible: true, summary: "2027 growth playbook for custom home builders.", playbook: {}, body_md: "# 2027 Industry Playbook\n\n1. Answer-first service-area pages\n2. Review velocity\n3. 13-platform social from every job", approved_at: agoTs(15) }];
  E.SocialPlan = [{ id: "sp1", client_id: c1.id, client_name: c1.business, status: "approved", version: 2, portal_visible: true, summary: "Every job becomes a post on 13 platforms.", plan: {}, body_md: "# Social plan\n\nPillars: proof of process, before & after, crew spotlights, financing offers.", approved_at: agoTs(12) }];
  const SOPS = [["closing", "Closing the sale", "SAL-01", "consulting"], ["onboarding", "Client onboarding", "ONB-02", "consulting"], ["intel_briefing", "Intel Briefing · audit + final sweep", "INT-03", "consulting"], ["website", "Custom Website · Architect 2.1", "WEB-04", "website"], ["system", "Command System · Ørigin 1.0", "CMD-05", "app"], ["ops_command", "Ops Command · SOPs, automations, AI Email Agent, Chrome Workspace", "OPS-06", "automation"], ["brand_arsenal", "Brand Arsenal · Tesseract 2.3", "BRD-07", "branding"], ["launch_grid", "Launch Grid · Networx 8.6", "LGR-08", "seo"], ["transmission", "Transmission · FPS 1.1", "TRN-09", "marketing"], ["orbit_setup", "HyperCare+ setup (every tier)", "HCS-10", "seo"], ["orbit_local", "HyperCare+ Local · monthly cycle", "HCL-11", "seo"], ["orbit_multi", "HyperCare+ extra location", "HCM-12", "seo"], ["orbit_national", "HyperCare+ National · monthly cycle", "HCN-13", "seo"], ["orbit_global", "HyperCare+ Global · monthly cycle", "HCG-14", "seo"], ["starship", "GravïtyCare · monthly care", "GRC-15", "other"]];
  const STEP = { Kickoff: ["Kickoff call (recorded)", "Access to every account", "Intake answers reviewed"], Build: ["Plan approved", "Build sprint 1", "Review round", "Build sprint 2", "QA pass"], Launch: ["Launch checklist", "Go live + verify", "Handover training", "Portal walkthrough"] };
  E.TaskTemplate = SOPS.map(([service_key, name, sop_code, project_type], i) => ({ id: `tt${i}`, name, sop_code, service_key, sort_order: i, times_applied: ri(20, 140), portal_client_ids: [c1.id], portal_summary: `${name}: every step, in order.`, project_type, items: Object.entries(STEP).flatMap(([phase, titles], pi) => titles.map((title, k) => ({ phase, title, category: pick(["strategy", "development", "content", "design", "ops"]), estimated_minutes: 30 + ((i + k) % 5) * 30, offset_days: pi * 10 + k * 2, priority: 2 }))) }));
  E.RecurringPattern = [];
  E.MapPackPlan = [];
  E.RequestForm = [];
  E.UsageLedger = [];

  // ---------------- Email + Ads ----------------
  E.EmailCampaign = [["Spring additions are booking now", 18420, 0.512], ["Your home, 10 years later: maintenance guide", 18210, 0.468], ["We're hiring crew leads", 9050, 0.441], ["Financing made simple", 17980, 0.497], ["Holiday thank-you + 2027 calendar", 18600, 0.553], ["New: warranty claims in your portal", 6200, 0.612]].map(([name, total, open], i) => ({ id: `ec${i}`, client_id: c1.id, client_name: c1.business, name, subject: name, status: "sent", total, sent_count: total - ri(10, 60), failed_count: ri(0, 8), skipped_count: ri(4, 40), created_at: agoTs(i * 9 + 2), started_at: agoTs(i * 9 + 2), finished_at: agoTs(i * 9 + 2), stats: { open_rate: open, click_rate: open / 5.2, opens: Math.round(total * open), clicks: Math.round((total * open) / 5.2) } }));
  E.EmailList = [{ id: "el1", name: "Past customers", description: "Every closed job since 2014", emails: [] }, { id: "el2", name: "Open estimates", emails: [] }, { id: "el3", name: "Newsletter", emails: [] }];
  E.EmailSubscriber = Array.from({ length: 60 }, (_, i) => ({ id: `es${i}`, email: `${pick(FIRST).toLowerCase()}.${pick(LAST).toLowerCase()}${i}@example.com`, name: `${pick(FIRST)} ${pick(LAST)}`, status: i % 23 === 0 ? "unsubscribed" : "subscribed", source: "import", client_id: c1.id, created_at: agoTs(i) }));
  E.EmailTemplate = [];

  E.AdAccount = [{ id: "aa1", platform: "meta", account_id: "act_demo1", name: "Interstellar · Meta", currency: "USD", connected: true, status: "active", is_primary: true, client_id: "", last_synced_at: agoTs(0) }, { id: "aa2", platform: "google", account_id: "g_demo1", name: "Interstellar · Google Ads", currency: "USD", connected: true, status: "active", client_id: "", last_synced_at: agoTs(0) }];
  const camps = [["Mission ALPHA · Home services owners", "meta", 420, 7.8], ["Command System · Demo video", "meta", 260, 9.4], ["Retargeting · Booking page", "meta", 140, 12.1], ["Search · custom CRM for contractors", "google", 520, 6.9], ["Search · local SEO agency", "google", 310, 8.2], ["Performance Max · Strategy call", "google", 380, 5.6]];
  E.AdCampaign = camps.map(([name, platform, daily_budget], i) => ({ id: `ac${i}`, account_ref: platform === "meta" ? "aa1" : "aa2", platform, external_id: `cmp${i}`, name, objective: "LEADS", status: "active", effective_status: "ACTIVE", daily_budget, origin: "synced", policy_status: "pass", client_id: "", last_synced_at: agoTs(0) }));
  E.AdMetricDaily = [];
  camps.forEach(([name, platform, budget, roas], i) => { for (let d = 0; d < 30; d++) { const spend = Math.round(budget * (0.85 + rnd() * 0.3)); const clicks = Math.round(spend / (1.6 + rnd())); const conv = Math.max(1, Math.round(clicks / (14 + ri(0, 8)))); const rr = roas * (0.85 + rnd() * 0.3); E.AdMetricDaily.push({ id: `am${i}_${d}`, key: `cmp${i}:${ago(d)}`, date: ago(d), level: "campaign", platform, account_ref: platform === "meta" ? "aa1" : "aa2", external_id: `cmp${i}`, ref_id: `ac${i}`, campaign_external_id: `cmp${i}`, name, spend, impressions: clicks * ri(38, 70), reach: clicks * 30, clicks, link_clicks: clicks, ctr: 1.8 + rnd(), cpc: +(spend / clicks).toFixed(2), cpm: 14 + rnd() * 6, conversions: conv, cpa: +(spend / conv).toFixed(2), revenue: Math.round(spend * rr), roas: +rr.toFixed(2), currency: "USD", source: platform === "meta" ? "meta_api" : "google_api", client_id: "" }); } });
  E.AdRecommendation = [{ id: "arc0", title: "Shift $80/day from Retargeting to Performance Max · Strategy call", status: "proposed", expected_impact: "+11 booked calls/week at the same spend", platform: "google", client_id: "", created_date: agoTs(0) }, { id: "arc1", title: "Refresh creative on Command System · Demo video (frequency 4.1)", status: "proposed", expected_impact: "CPL back under $40", platform: "meta", client_id: "", created_date: agoTs(1) }];
  E.AdSet = []; E.Ad = []; E.AdCreative = []; E.AdChangeLog = []; E.AdLearning = []; E.AdPolicyCheck = []; E.AdSettings = [];

  return { E, stripeRev, stripeSubs, c1 };
}

let cache = null;
export function demo() { return (cache ||= build()); }

// Signature thumbnails need rendered HTML. Loaded lazily (a static import would be circular through qa.js).
export async function warmDemo() {
  try {
    const { generateSignatureHTML } = await import("@/features/signatures/lib/signatureTemplates");
    demo().E.Signature.forEach((sg) => { try { sg.generated_html = generateSignatureHTML({ fields: sg.fields, theme: sg.theme, template_id: sg.template_id }); } catch { /* renders on open */ } });
  } catch { /* thumbnails render on open */ }
}

// Function-call fakes for the demo (return undefined to fall through to the QA defaults).
export function demoInvoke(name, args = {}, rows) {
  const D = demo();
  if (name === "stripeRevenue") return D.stripeRev;
  if (name === "stripeSubscriptions") return D.stripeSubs;
  if (name === "stripeProducts") return { configured: true, products: [] };
  if (name === "reviews") { const r = rows("ReviewClient").find((x) => x.slug === args.client); return r ? { ...r.cache, cachedAt: r.cached_at } : { reviews: [] }; }
  if (name === "portal") return demoPortal(args, rows, D);
  if (name === "usage") return demoUsage(args, rows);
  return undefined;
}

function demoUsage(args, rows) {
  const month = new Date().toISOString().slice(0, 7);
  const list = rows("CRMClient").filter((c) => c.status === "Active" && /^c\d/.test(c.id)).slice(0, 36).map((c, i) => {
    const tier = c.services[0].name;
    const plan = /Grav/.test(tier) ? "gravitycare" : "hypercare";
    const caps = plan === "hypercare" ? { ai_action: 1000, marketing_email: 25000, ads_cadence: "daily" } : { ai_action: 200, marketing_email: 2500, ads_cadence: "none" };
    const on = i < 3 ? { social: "on", email: "on", ads: "on", accounting: "on", hiring: "on", presentations: "on" } : { social: "on", email: i % 2 ? "on" : "preview", ads: i % 3 ? "preview" : "on" };
    const u = { ai_action: 180 + ((i * 97) % 760), marketing_email: (i * 1931) % 21000, ads_run: i % 3 ? 0 : 4 + (i % 9), admin_ai_action: 12 + (i % 30), admin_marketing_email: 0, admin_ads_run: 0 };
    u.est_cost_usd = +(u.ai_action * 0.0058 + u.marketing_email * 0.0001).toFixed(2);
    return { id: c.id, business: c.business, plan, plan_label: plan === "hypercare" ? tier : "GravïtyCare", caps, unlimited: false, custom: false, overrides: {}, portal_enabled: true,
      studios: { social: "preview", email: "preview", ads: "preview", accounting: "preview", hiring: "preview", presentations: "preview", ...on },
      ses: { from_email: `news@${c.domain}`, from_name: c.business, reply_to: c.emails[0], domain: c.domain, verified: i % 4 !== 3 }, usage: u };
  });
  if (args.action === "overview") return { month, truncated: false, agency: { est_cost_usd: 61.4 }, clients: list };
  if (args.action === "config") return { secrets: { ANTHROPIC_API_KEY: true, AWS_SES_ACCESS_KEY_ID: true, AWS_SES_SECRET_ACCESS_KEY: true, AWS_SES_REGION: true }, models: { routine: { id: "claude-haiku-5-5" }, long: { id: "claude-sonnet-5-5" } }, ses_feedback_webhook: "https://interstellar-mothership.com/functions/email-bulk?hook=DEMO", checked_at: new Date().toISOString() };
  if (args.action === "summary") { const c = list.find((x) => x.id === (args.client_id || "c1")) || list[0]; return { visible: true, month, plan: c.plan, plan_label: c.plan_label, caps: c.caps, usage: c.usage, admin_usage: {}, est_cost_usd: c.usage.est_cost_usd, unlimited: false, custom: false, studios: c.studios }; }
  return {};
}

const PREST_DEF = {
  referral_base_url: "https://interstellar-strategies.com/contact",
  share_message: "I've been working with Interstellar Strategies. If you want the same for your business, book a free call here: {link}",
  booked: { title: "Priority Pass", detail: "When they book a call, your next request jumps to the front of the build queue.", value: 0 },
  signed: { title: "$500 Interstellar credit", detail: "Added when they pay their first invoice. Spend it on builds, and stack credits for something bigger.", value: 500 },
  tiers: [
    { name: "Prestige I", threshold: 1, unlock: "Custom landing page", value: 1500 }, { name: "Prestige II", threshold: 3, unlock: "Automation build", value: 3000 },
    { name: "Prestige III", threshold: 5, unlock: "Mini app", value: 5000 }, { name: "Prestige IV", threshold: 10, unlock: "Full custom app", value: 10000 }, { name: "Prestige Master", threshold: 25, unlock: "VIP partner status", value: 0 },
  ],
};

function demoPortal(args, rows, D) {
  const cid = args.client_id || D.c1.id;
  const client = rows("CRMClient").find((c) => c.id === cid) || D.c1;
  const of = (e) => rows(e).filter((r) => r.client_id === cid);
  const a = args.action;
  if (a === "home") {
    return {
      client, businesses: [D.c1, ...rows("CRMClient").slice(1, 3)].map((c) => ({ id: c.id, business: c.business })),
      user: { email: "dana@summitridge.demo", name: "Dana Whitaker", is_admin_preview: true },
      work: of("WorkLog"), automations: of("Automation").filter((x) => x.status === "active"), requests: of("ClientRequest"),
      site_health: { score: 98, label: "Excellent", checked_at: new Date().toISOString(), fixed_30d: 41, open: 1, pages_live: 186, speed: 97, seo: 100, issues: [] },
      has_brand_kit: true, has_playbook: true, goals: of("ClientGoal"), gaps: of("ClientGap"), snapshots: of("PerformanceSnapshot"),
      upcoming: of("Task").filter((t) => t.portal_visible && t.status !== "done"), files: of("ClientFile"),
      future: of("Project").filter((p) => ["proposed", "backlog", "planning", "in_progress", "review"].includes(p.status)), unread: 2,
    };
  }
  if (a === "messages") return { messages: of("ConversationMessage").filter((m) => !m.thread_id) };
  if (a === "chats") {
    const direct = of("ConversationMessage");
    const last = direct[direct.length - 1];
    return { me: { name: client.business }, threads: [{ id: "direct", kind: "direct", title: "Interstellar Strategies", last_preview: last?.content || "", last_at: last?.created_date, unread: 1 }, ...rows("ChatThread").filter((t) => (t.client_ids || []).includes(cid)).map((t) => ({ id: t.id, kind: "group", title: t.title, description: t.description, last_preview: t.last_message_preview, last_at: t.last_message_at, unread: 0 }))] };
  }
  if (a === "chat_messages") {
    const msgs = args.thread && args.thread !== "direct" ? [{ id: "gm1", content: "Transmission v2 is ready for review.", sender_role: "admin", created_date: new Date().toISOString() }] : of("ConversationMessage");
    return { messages: msgs.map((m) => ({ id: m.id, content: m.content, sender_role: m.sender_role, created_date: m.created_date, timestamp: m.timestamp, sender: m.sender_role === "client" ? { name: "Dana Whitaker" } : { name: "Interstellar Strategies" } })) };
  }
  if (a === "brand_kit") return { brand_kit: of("BrandKit")[0] || null };
  if (a === "playbook") return { playbook: of("IndustryPlaybook")[0] || null };
  if (a === "social_plan") return { social_plan: of("SocialPlan")[0] || null };
  if (a === "resources") return { resources: [
    { id: "bk1", type: "brand_kit", title: "Brand kit", version: 3, summary: "Logo rules, colors, fonts and voice.", updated: new Date().toISOString() },
    { id: "ip1", type: "playbook", title: "2027 Industry Playbook", version: 1, summary: "What wins for custom home builders next year.", updated: new Date().toISOString() },
    { id: "sp1", type: "social_plan", title: "Social media plan", version: 2, summary: "Every job becomes a post on 13 platforms.", updated: new Date().toISOString() },
    ...rows("TaskTemplate").slice(0, 4).map((t) => ({ id: t.id, type: "shared_sop", title: t.name, code: t.sop_code, summary: t.portal_summary, updated: new Date().toISOString() })),
    ...of("ClientFile").filter((f) => ["sop", "guide"].includes(f.category)).map((f) => ({ id: f.id, type: f.category, title: f.title, summary: f.description, updated: f.delivered_on })),
  ] };
  if (a === "intake") return { intake: of("IntakeAudit")[0] || null };
  if (a === "gbp") {
    const r = rows("ReviewClient").find((x) => x.crm_client_id === cid);
    if (!r) return { connected: false, locations: [] };
    const qr = rows("QrCode").find((q) => q.client_id === cid);
    return { connected: true, business: client.business, locations: [{ id: r.id, slug: r.slug, label: client.business, name: client.business, business_name: client.business, rating: r.cache.rating, total: r.cache.total, maps_url: r.cache.mapsUrl, review_url: r.cache.reviewUrl, cached_at: r.cached_at, reviews: r.cache.reviews, qr: qr ? { id: qr.id, name: qr.name, short_code: qr.short_code, scans: qr.scans, last_scan_at: qr.last_scan_at } : null }] };
  }
  if (a === "sig_list") return { signatures: of("Signature"), templates: rows("SignatureTemplate").filter((t) => t.client_id === cid || t.scope === "global"), brand: { company: client.business, website: client.domain, logo_url: "", slogan: "Built right. Built to last.", colors: ["#ff3c00", "#1a1a1a"] } };
  if (a === "sig_get") return { signature: rows("Signature").find((s) => s.id === args.id) || null };
  if (a === "qr_list") return { codes: of("QrCode"), templates: rows("QrTemplate").filter((t) => t.client_id === cid), brand: { company: client.business, website: client.domain, logo_url: "", accent: client.accent, colors: ["#ff3c00", "#1a1a1a"] } };
  if (a === "qr_get") return { code: rows("QrCode").find((q) => q.id === args.id) || null };
  if (a === "qr_stats") {
    const scans = rows("QrScan").filter((s) => (args.id ? s.qr_id === args.id : s.client_id === cid));
    const counts = {}; const devices = {}; const os = {};
    scans.forEach((s) => { const d = s.at.slice(0, 10); counts[d] = (counts[d] || 0) + 1; devices[s.device] = (devices[s.device] || 0) + 1; os[s.os] = (os[s.os] || 0) + 1; });
    const series = Array.from({ length: 30 }, (_, i) => { const d = new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10); return { date: d, scans: counts[d] || 0 }; });
    const sum = (n) => series.slice(-n).reduce((x, y) => x + y.scans, 0);
    const mult = 11; // the fixture holds a sample; scale to the codes' lifetime counts
    return { stats: { total: scans.length * mult, today: sum(1) * mult, last7: sum(7) * mult, last30: sum(30) * mult, series: series.map((p) => ({ ...p, scans: p.scans * mult })), devices, os, last_scan_at: new Date().toISOString() } };
  }
  if (String(a).startsWith("prestige")) {
    const member = rows("PrestigeMember").find((m) => m.client_id === cid);
    const refs = rows("PrestigeReferral").filter((r) => r.memberId === member?.id);
    const signed = refs.filter((r) => r.status === "Paid Out" || r.status === "Confirmed").length;
    return {
      offer: PREST_DEF, member: member ? { ...member, signed, booked: refs.length } : null, joined: !!member,
      referral_link: `https://interstellar-strategies.com/contact?ref=${member?.referral_code || "dana"}`,
      referrals: refs.map((r) => ({ id: r.id, name: r.referredClientName, status: r.status, date: r.date, package: r.package })),
      rewards: rows("PrestigeReward").filter((r) => r.memberId === member?.id), credit: { earned: signed * 500, spent: 1000, balance: signed * 500 - 1000 },
      stats: { booked: refs.length, signed, credit_balance: signed * 500 - 1000 }, tier_index: signed >= 10 ? 3 : signed >= 5 ? 2 : signed >= 3 ? 1 : 0, redemptions: [], categories: [],
    };
  }
  if (a === "forms") return { forms: [], type_overrides: null };
  if (a === "status") return { connected: true };
  return {};
}
