// The 40-Day Business Rebuild: ONE onboarding checklist, the same for every client (Justin, Nov 25 2026).
// Ordered so nothing waits on something unfinished: everything the client must give us is collected in checkpoint 1,
// brand comes before the website, the Command System core comes before website lead forms, the domain and Google
// access come before Launch Grid, and billing starts only on launch day.
// who: "client" = waiting on them · "us" = Justin/team · "claude" = Claude/automation does it.
// day: target day from Completed Intake (Day 0 = intake complete; negative = before the clock starts).
// mins: rough hands-on minutes for Justin (0 when Claude/automation does it).
export const REBUILD_VERSION = "2026-11-25";

export const CHECKPOINTS = [
  {
    key: "close", n: 0, title: "Signed & paid", day: -3,
    why: "Nothing starts until the agreement and start payment are in.",
    items: [
      { key: "terms", t: "Agreement signed in the portal (Terms 2026-11-25)", who: "client", mins: 0 },
      { key: "start_paid", t: "Start payment received ($2,000, or $1,500 referred)", who: "claude", mins: 0, auto: "Stripe invoice marks it on the Financing row" },
      { key: "financing", t: "40-Day Rebuild row created in Financing (plan, referral, expected launch)", who: "us", mins: 3 },
      { key: "crm", t: "CRM client created, portal invite sent", who: "us", mins: 5 },
      { key: "kickoff_booked", t: "60-minute kickoff call booked", who: "us", mins: 2 },
      { key: "intake_sent", t: "Intake form + access checklist sent", who: "claude", mins: 0 },
    ],
  },
  {
    key: "intake", n: 1, title: "Intake & access", day: 0,
    why: "Collect everything at once so no later step stalls waiting on the client.",
    items: [
      { key: "intake_answers", t: "Intake answers: services, prices, service area, ideal customers, competitors, goals", who: "client", mins: 0 },
      { key: "brand_files", t: "Logo files, photos, current colors, approved testimonials", who: "client", mins: 0 },
      { key: "team_roster", t: "Team roster: names, roles, emails, phones", who: "client", mins: 0 },
      { key: "access_domain", t: "Domain registrar / DNS access", who: "client", mins: 0 },
      { key: "access_google", t: "Google access: Business Profile manager, Search Console, Analytics", who: "client", mins: 0 },
      { key: "access_email", t: "Email (Gmail / Workspace) access for the email agent and signatures", who: "client", mins: 0 },
      { key: "access_social", t: "Social accounts access", who: "client", mins: 0 },
      { key: "data_export", t: "Exports from current tools: customers, jobs, price list", who: "client", mins: 0 },
      { key: "kickoff_call", t: "Kickoff call held and recorded: walk every department and its recurring tasks", who: "us", mins: 60 },
      { key: "covered_tasks", t: "Time-Back Guarantee: 3+ Covered Tasks agreed in writing", who: "us", mins: 5 },
      { key: "intake_complete", t: "Completed Intake date set (starts the 40-day clock)", who: "us", mins: 1 },
    ],
  },
  {
    key: "plan", n: 2, title: "Audit & plan", day: 4,
    why: "Decide what's worth building before building it.",
    items: [
      { key: "intel", t: "Intel Briefing: site, listings, competitors and search snapshot", who: "claude", mins: 0 },
      { key: "brain_seed", t: "Business Brain seeded from intake + kickoff transcript", who: "claude", mins: 0 },
      { key: "dept_map", t: "Department map: every task marked automate / make easier", who: "claude", mins: 15 },
      { key: "timeline_shared", t: "Build plan + 40-day timeline posted to the client portal", who: "us", mins: 10 },
    ],
  },
  {
    key: "brand", n: 3, title: "Brand Arsenal", day: 10,
    why: "The website, signatures, QR codes and social all use it.",
    items: [
      { key: "brand_direction", t: "Brand direction: logo suite, colors, type, voice", who: "us", mins: 45 },
      { key: "brand_approved", t: "Client approves brand direction (2 revision rounds included)", who: "client", mins: 0 },
      { key: "brand_arsenal", t: "Brand Arsenal delivered: rules, voice guide, taglines, approved claims", who: "claude", mins: 15 },
      { key: "signatures", t: "Email signatures for every team member", who: "claude", mins: 5 },
      { key: "qr_set", t: "QR code set created (never expire)", who: "claude", mins: 5 },
    ],
  },
  {
    key: "system", n: 4, title: "Command System", day: 22,
    why: "The CRM core comes before the website so lead forms have somewhere to land.",
    items: [
      { key: "data_import", t: "Customers, jobs and price list imported", who: "us", mins: 20 },
      { key: "core_build", t: "Core: CRM pipeline, jobs, quotes to invoices, scheduling", who: "claude", mins: 30 },
      { key: "client_portal", t: "Customer portal: job timeline, check-ins, documents", who: "claude", mins: 15 },
      { key: "roles", t: "Roles and access: owner, managers, team", who: "us", mins: 10 },
      { key: "notifications", t: "Notification stack: branded email, text and in-app", who: "claude", mins: 10 },
      { key: "covered_autos", t: "Automations for the Covered Tasks (guarantee first)", who: "claude", mins: 15 },
      { key: "dept_autos", t: "Rest of the department map automated or made easier", who: "claude", mins: 20 },
      { key: "email_agent", t: "AI email agent: color-coded labels, drafts for approval, portal log", who: "claude", mins: 10 },
      { key: "assistant", t: "AI assistant + Business Brain inside the app", who: "claude", mins: 5 },
      { key: "security", t: "Security Foundation applied + GitHub repo connected", who: "claude", mins: 5 },
    ],
  },
  {
    key: "website", n: 5, title: "Website", day: 28,
    why: "Built on the approved brand; forms post straight into the Command System.",
    items: [
      { key: "copy_draft", t: "Sitemap + answer-first copy drafted", who: "claude", mins: 10 },
      { key: "copy_approved", t: "Client approves copy", who: "client", mins: 0 },
      { key: "site_build", t: "Website designed and built on preview", who: "claude", mins: 30 },
      { key: "lead_wiring", t: "Forms wired into the CRM pipeline (lead → follow-up automation)", who: "claude", mins: 5 },
      { key: "seo_tech", t: "Schema, meta, sitemap, speed, legal pages", who: "claude", mins: 5 },
      { key: "site_review", t: "Client reviews preview (2 revision rounds included)", who: "client", mins: 0 },
    ],
  },
  {
    key: "grid", n: 6, title: "Launch Grid", day: 34,
    why: "Needs the final name, address, phone and domain.",
    items: [
      { key: "nap", t: "Name, address and phone locked everywhere", who: "us", mins: 5 },
      { key: "gbp", t: "Google Business Profile optimized: categories, services, description, photos", who: "us", mins: 30 },
      { key: "gsc_ga", t: "Search Console, Analytics and Bing connected", who: "us", mins: 15 },
      { key: "citations", t: "Citation submissions started (local / national / global set)", who: "us", mins: 30 },
      { key: "social_rebrand", t: "Social profiles rebranded", who: "us", mins: 20 },
      { key: "hub_listing", t: "Listed on the Groundwork industry hub", who: "us", mins: 5 },
    ],
  },
  {
    key: "launch", n: 7, title: "Launch", day: 40,
    why: "Everything tested, team trained, then go live and start billing.",
    items: [
      { key: "qa", t: "Final sweep: forms, notifications, mobile, speed, security scan", who: "claude", mins: 10 },
      { key: "training", t: "Team training + SOP library in the app", who: "us", mins: 45 },
      { key: "devices", t: "App on every phone's home screen + Chrome workspace on desktop and mobile", who: "us", mins: 20 },
      { key: "go_live_ok", t: "Client approves go-live", who: "client", mins: 0 },
      { key: "domain_live", t: "Custom domain connected, website published", who: "us", mins: 10 },
      { key: "system_live", t: "Command System published, team invited", who: "us", mins: 10 },
      { key: "billing_on", t: "Launch date set on Financing + HyperCare+ subscription started in Stripe", who: "us", mins: 5 },
      { key: "welcome", t: "Portal launch + welcome email", who: "claude", mins: 0 },
    ],
  },
  {
    key: "month1", n: 8, title: "Month one on HyperCare+", day: 70,
    why: "Turn the machine on and prove the time back.",
    items: [
      { key: "content_on", t: "30 posts a month generating + social plan delivered", who: "claude", mins: 10 },
      { key: "blog_gbp", t: "Blog and Google profile post cadence running", who: "claude", mins: 5 },
      { key: "email_mkt", t: "Email marketing set up: sending domain, list import, first campaign", who: "us", mins: 30 },
      { key: "videos", t: "Motion-graphic videos scripted and produced (up to 10)", who: "us", mins: 30 },
      { key: "playbook1", t: "First growth playbook (presentation) shared", who: "us", mins: 20 },
      { key: "hiring", t: "Hiring kit ready: job post, screening questions, 30/60/90 plan", who: "claude", mins: 10 },
      { key: "report1", t: "Monthly report #1 + live work feed checked", who: "claude", mins: 5 },
      { key: "timeback_check", t: "Time-Back check: Covered Tasks visible in the activity log", who: "us", mins: 10 },
    ],
  },
];

export const ALL_ITEMS = CHECKPOINTS.flatMap((c) => c.items.map((i) => ({ ...i, cp: c.key, cpTitle: c.title, cpN: c.n, day: c.day })));
export const TOTAL = ALL_ITEMS.length;
export const WHO = {
  client: { label: "Client", tone: "border-[#ffaa00]/60 text-[#8a4b00] bg-[#ffaa00]/10" },
  us: { label: "You", tone: "border-ink/25 text-ink/75 bg-ink/[0.04]" },
  claude: { label: "Claude", tone: "border-[#ff3c00]/40 text-[#ff3c00] bg-[#ff3c00]/[0.06]" },
};

const DAY = 86400000;
const parse = (s) => (s ? new Date(String(s).length === 10 ? s + "T12:00:00" : s) : null);

// Progress for one client's record { items: { key: {done, done_at, note, waiting} }, intake_completed_at, launched_at }.
export function progressOf(rec) {
  const items = (rec && rec.items) || {};
  const done = ALL_ITEMS.filter((i) => items[i.key]?.done);
  const cps = CHECKPOINTS.map((c) => {
    const d = c.items.filter((i) => items[i.key]?.done).length;
    return { ...c, done: d, total: c.items.length, complete: d === c.items.length };
  });
  const current = cps.find((c) => !c.complete) || null;
  // Next steps: open items of the current checkpoint, then the next one (never more than 5).
  const open = ALL_ITEMS.filter((i) => !items[i.key]?.done);
  const next = open.filter((i) => current && i.cpN <= current.n + 1).slice(0, 5);
  const waiting = open.filter((i) => i.who === "client" || items[i.key]?.waiting);
  const start = parse(rec?.intake_completed_at);
  const dayNum = start ? Math.floor((Date.now() - start.getTime()) / DAY) : null;
  const target = start ? new Date(start.getTime() + 40 * DAY) : null;
  const behind = current && dayNum !== null && dayNum > current.day && current.n < 8;
  return {
    done: done.length, total: TOTAL, pct: Math.round((done.length / TOTAL) * 100), cps, current, next, waiting, dayNum, target, behind,
    launched: !!rec?.launched_at || cps.slice(0, 8).every((c) => c.complete),
    minsLeft: open.filter((i) => i.who !== "client").reduce((n, i) => n + (i.mins || 0), 0),
  };
}
