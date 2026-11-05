// Seed: Interstellar's onboarding track for the planned hire in the Hiring plan (Client Operations & Build Specialist),
// built only from Interstellar's own SOPs (SOP-01, SOP-02, SOP-04, SOP-06) and the Hiring plan's 30/60/90 ramp.
// Every lesson point, checklist task and quiz answer restates a step from those sources; `quote` holds the exact source
// text. Open questions in the Hiring plan (hours, pay, office, access) are gaps, never filled in.
// Used once to seed the live TrainingTrack (Nov 2026) and by the preview QA fixtures.

const ref = (id, code, name) => ({ type: "sop", id, title: `${code} · ${name}` });
export const OPS_REFS = {
  closing: ref("6ae66fc398075033271c580e", "SOP-01", "Closing the Sale"),
  onboarding: ref("6ae3be9c1cb216d1ab737ef5", "SOP-02", "Client Onboarding"),
  website: ref("6ae3be9c1cb216d1ab737ef7", "SOP-04", "Custom Website Build"),
  setup: ref("6ae3beb856e863c5f4b26a13", "SOP-06", "HyperCare+ Setup (every tier)"),
  ramp: { type: "hiring", id: "ramp", title: "Hiring plan · 30 / 60 / 90-day ramp" },
};

const c = (id, text, src, quote) => ({ id, text, source_id: src.id, source_title: src.title, quote });
const q = (id, question, options, answer_index, explanation, src, quote) => ({ id, question, options, answer_index, explanation, source_id: src.id, source_title: src.title, quote });

export const OPS_TRACK = {
  title: "Client Operations & Build Specialist onboarding",
  role: "client_ops_build",
  role_label: "Client Operations & Build Specialist",
  description: "Your first weeks at Interstellar: how a client goes from yes on the call to live, step by step, straight from our SOPs. Read each lesson, do the hands-on tasks, pass the quick check, then move on.",
  status: "draft",
  hiring_role_key: "client_ops_build",
  template_key: "client_ops_build",
  pass_score: 80,
  requires_signoff: true,
  es_enabled: false,
  source_refs: Object.values(OPS_REFS),
  gaps: [
    "Office location, hours and pay are still open decisions in the Hiring plan, so they're left out of this track.",
    "The Hiring plan hasn't decided what the hire can see in Møthership™ (full admin or a limited staff role). Decide before day 1.",
    "SOP-01 is untimed (\"Untimed until real times are tracked\"), so its module has no time targets.",
  ],
};

export const OPS_MODULES = [
  {
    title: "Closing hand-off: yes to kickoff",
    summary: "What happens between a yes on the call and the client's kickoff.",
    lesson_md: [
      "Justin closes the sale. These are the steps that turn a yes into a started client, so you know what's already done when a client reaches you.",
      "",
      "- On the call, the package (ALPHA, BRAVO or a single build) and the care plan it runs on are confirmed.",
      "- The Mission Agreement presentation goes out for e-signature. Once signed, it's saved to the client's documents.",
      "- The client pays by Stripe invoice or payment link, paid in full or financed. When it lands, the payer is matched to the client in Møthership™.",
      "- The care plan subscription is set up in Stripe to start at launch. There's no charge for it today.",
      "- The service is started in Møthership™ (package + required care plan). That creates every SOP step with dates.",
      "- Then the hand-over to Client Onboarding: the welcome email with portal access goes out the same day.",
    ].join("\n"),
    sop_refs: [OPS_REFS.closing],
    checklist: [
      c("c1", "Sit in on Justin's next closing recap and write down the package and care plan that were confirmed.", OPS_REFS.closing, "confirm the package (ALPHA, BRAVO or a single build) and the care plan it runs on"),
      c("c2", "Open one paid client and check the payer is matched to the client in Møthership™.", OPS_REFS.closing, "confirm the payer is matched to the client in Møthership"),
      c("c3", "Open a started service and find the SOP steps it created, with their dates.", OPS_REFS.closing, "creates every SOP step with dates"),
    ],
    quiz: [
      q("q1", "When does the client's care plan start charging?", ["Today, at signing", "At launch", "After 90 days"], 1, "The care plan subscription is created to start at launch, with no charge today.", OPS_REFS.closing, "Care plan subscription created in Stripe to start at launch — no charge today"),
      q("q2", "What does starting the service in Møthership™ do?", ["Sends the invoice", "Creates every SOP step with dates", "Marks the client as paid"], 1, "Starting the service (package + required care plan) creates every SOP step with dates.", OPS_REFS.closing, "creates every SOP step with dates"),
      q("q3", "After kickoff, what goes out the same day?", ["The welcome email with portal access", "The first monthly report", "A review request"], 0, "The hand-over to Client Onboarding: the welcome email with portal access goes out today.", OPS_REFS.closing, "welcome email with portal access goes out today"),
    ],
    est_minutes: 20, required: true,
    gaps: ["SOP-01 doesn't say whether Justin or the new hire sends the Stripe invoice once the hire starts."],
  },
  {
    title: "Welcome and access",
    summary: "Get a new client welcomed and every account connected, safely.",
    lesson_md: [
      "Onboarding starts the day the client pays. First the welcome, then access to every account we need.",
      "",
      "- Mark the client Active: plan, services, start date.",
      "- Send the welcome email with portal access.",
      "- Order the welcome pack (card, patch, tee, review QR stand).",
      "- Make sure the access checklist is live in their portal.",
      "- Google access: GBP Manager, Search Console Owner, GA4 Editor.",
      "- Domain, DNS, hosting + email provider access.",
      "- Bing Webmaster, Bing Places + Apple Business Connect access.",
      "- Social + review platform access (Meta partner, Yelp, industry sites).",
      "- Passwords only come by secure link. They're never stored in our apps.",
    ].join("\n"),
    sop_refs: [OPS_REFS.onboarding],
    checklist: [
      c("c1", "Open a client's portal and find their access checklist.", OPS_REFS.onboarding, "Access checklist live in their portal"),
      c("c2", "Write down the three Google access levels we ask for.", OPS_REFS.onboarding, "GBP Manager, Search Console Owner, GA4 Editor"),
      c("c3", "Draft a message asking a client for domain, DNS, hosting and email provider access. Justin reviews it before it goes out.", OPS_REFS.onboarding, "Domain, DNS, hosting + email provider access"),
    ],
    quiz: [
      q("q1", "What access do we need on Google Search Console?", ["Owner", "Viewer", "Restricted user"], 0, "We ask for Search Console Owner (with GBP Manager and GA4 Editor).", OPS_REFS.onboarding, "GBP Manager, Search Console Owner, GA4 Editor"),
      q("q2", "A client wants to send you their hosting password. How?", ["In the portal chat", "By secure link", "By email"], 1, "Passwords only by secure link, never stored in our apps.", OPS_REFS.onboarding, "Passwords only by secure link, never stored in our apps"),
      q("q3", "What's in the welcome pack?", ["Card, patch, tee, review QR stand", "A printed invoice and brochure", "Business cards only"], 0, "The welcome pack is a card, patch, tee and review QR stand.", OPS_REFS.onboarding, "Order the welcome pack (card, patch, tee, review QR stand)"),
    ],
    est_minutes: 25, required: true,
    gaps: ["SOP-02 doesn't name the secure-link tool for passwords.", "SOP-02 doesn't say who orders the welcome pack, or from where."],
  },
  {
    title: "Kickoff, content and the first win",
    summary: "Map how the client's business runs, collect content, then deliver a quick win.",
    lesson_md: [
      "Once access is in, we learn how the business runs and get the client an early result.",
      "",
      "- Kickoff call (45 min, recorded): map lead → paid.",
      "- Log the process map and the bottlenecks as Gaps.",
      "- Content checklist complete: logos, 20+ photos, reviews, services, team.",
      "- Confirm the welcome pack landed.",
      "- First win: GBP tune-up + first post live.",
      "- Review link + QR live; ask their last 20 happy customers.",
      "- Top 10 citations claimed or corrected to match NAP.",
      "- Portal message: here's what we already did this week, and log the Work.",
      "- Onboarding exit check: paperwork, access, knowledge all ticked.",
    ].join("\n"),
    sop_refs: [OPS_REFS.onboarding],
    checklist: [
      c("c1", "Sit in on a kickoff call and draft the client's lead → paid map.", OPS_REFS.onboarding, "Kickoff call (45 min, recorded): map lead → paid"),
      c("c2", "Log two bottlenecks from that call as Gaps.", OPS_REFS.onboarding, "Log the process map + bottlenecks as Gaps"),
      c("c3", "Draft the \"here's what we already did this week\" portal message for Justin to review.", OPS_REFS.onboarding, "Portal message: here's what we already did this week"),
    ],
    quiz: [
      q("q1", "How long is the kickoff call?", ["30 minutes", "45 minutes", "90 minutes"], 1, "The kickoff call is 45 minutes and recorded.", OPS_REFS.onboarding, "Kickoff call (45 min, recorded)"),
      q("q2", "How many photos does the content checklist ask for?", ["5 or more", "20 or more", "100 or more"], 1, "The content checklist asks for logos, 20+ photos, reviews, services and team.", OPS_REFS.onboarding, "Content checklist complete (logos, 20+ photos, reviews, services, team)"),
      q("q3", "How many citations are claimed or corrected for the first win?", ["Top 3", "Top 10", "Top 50"], 1, "Top 10 citations are claimed or corrected to match NAP.", OPS_REFS.onboarding, "Top 10 citations claimed or corrected to match NAP"),
    ],
    est_minutes: 25, required: true,
    gaps: ["SOP-02 doesn't say where kickoff recordings are saved."],
  },
  {
    title: "Website build: inputs to launch",
    summary: "The seven stages of a custom website, from intake to hand-off.",
    lesson_md: [
      "Every custom website follows the same stages. Your job is to keep the inputs complete and the checks honest.",
      "",
      "- Inputs: intake audit complete (services, areas, goals, pages), assets collected (logo, 20+ photos, reviews, licenses, team), 1–2 reference sites with notes, the primary CTA and the domain plan.",
      "- Build prompt: generate it (Analyze) and approve the page map.",
      "- First build: real copy + real photos, no placeholders.",
      "- Refine: batched edit rounds by page, SEO + schema page by page, then client review round 1 (portal, 48-hour deadline).",
      "- Pillar sweep: speed, mobile, SEO, schema, AI answers, conversion, tracking, trust, accessibility. Then review round 2 and clear the fix list.",
      "- Launch: domain connected, SSL active, www + non-www resolve; old URLs mapped to new with 301 redirects; sitemap to Search Console; live check of forms, phone links and analytics; GBP website link updated.",
      "- Hand off: log the Work, care plan active, launch message in the portal with a 60-second walkthrough video, and ask for a review while excitement is high.",
    ].join("\n"),
    sop_refs: [OPS_REFS.website],
    checklist: [
      c("c1", "Fill the intake checklist for a sample client and flag what's missing.", OPS_REFS.website, "intake audit complete (services, areas, goals, pages)"),
      c("c2", "Run the pillar sweep on one live client site and list the fixes.", OPS_REFS.website, "Pillar sweep: speed, mobile, SEO, schema, AI answers, conversion, tracking, trust, accessibility"),
      c("c3", "Do a live check on a launched site: forms, phone links, analytics.", OPS_REFS.website, "Live check: forms, phone links, analytics firing"),
    ],
    quiz: [
      q("q1", "How long does the client have for review round 1?", ["24 hours", "48 hours", "1 week"], 1, "Client review round 1 runs in the portal with a 48-hour deadline.", OPS_REFS.website, "Client review round 1 (portal, 48-hr deadline)"),
      q("q2", "What goes into the first build?", ["Placeholder text to fill in later", "Real copy and real photos", "Stock photos only"], 1, "The first build uses real copy and real photos, no placeholders.", OPS_REFS.website, "real copy + real photos, no placeholders"),
      q("q3", "At launch, the old site's URLs need…", ["301 redirects to the new pages", "To be deleted", "Nothing"], 0, "Old URLs are mapped to new ones with 301 redirects in place.", OPS_REFS.website, "Map old URLs → new + 301 redirects in place"),
    ],
    est_minutes: 30, required: true,
    gaps: ["SOP-04 doesn't say who approves the page map when Justin is out."],
  },
  {
    title: "HyperCare+ setup: Month 0",
    summary: "The foundations every HyperCare+ client gets before anything recurring runs.",
    lesson_md: [
      "HyperCare+ starts with Month 0 foundations. Nothing recurring runs until every box is ticked.",
      "",
      "- Search Console verified and the sitemap submitted. GA4 installed with conversions marked. Bing Webmaster (import from GSC) and the IndexNow key on the site.",
      "- Google Business Profile: categories, services, products, hours, attributes, Q&A, plus 25+ photos and the review link and QR.",
      "- Site: schema validated on every page, service and area pages in place, NAP identical everywhere, speed and mobile pass.",
      "- Møthership™: baseline Performance snapshot, goals set with the client and Gaps logged.",
      "- Care: hosting and uptime monitoring confirmed, a checkpoint saved as the care baseline, domain and SSL renewal dates recorded, and the client shown the Requests board in their portal.",
      "- Month 1: the care checklist (forms, links, 404s, speed, logins, automations) and the first monthly report in their portal.",
    ].join("\n"),
    sop_refs: [OPS_REFS.setup],
    checklist: [
      c("c1", "Check one HyperCare+ client's Google Business Profile for categories, services, hours and Q&A.", OPS_REFS.setup, "GBP: categories, services, products, hours, attributes, Q&A"),
      c("c2", "Validate the schema on every page of one client site.", OPS_REFS.setup, "Schema validated on every page"),
      c("c3", "Record a baseline Performance snapshot for a new client.", OPS_REFS.setup, "Baseline Performance snapshot"),
    ],
    quiz: [
      q("q1", "When does recurring HyperCare+ work start?", ["Right after payment", "When every Month 0 box is ticked", "After the first monthly report"], 1, "Nothing recurring runs until every Month 0 box is ticked.", OPS_REFS.setup, "Nothing recurring runs until every box is ticked"),
      q("q2", "How many photos go on the Google Business Profile in setup?", ["10 or more", "25 or more", "50 or more"], 1, "Setup adds 25+ GBP photos plus the review link and QR.", OPS_REFS.setup, "GBP: 25+ photos + review link and QR"),
      q("q3", "Where does Bing Webmaster setup come from?", ["Import from Search Console", "Typed in by hand", "Copied from GA4"], 0, "Bing Webmaster is set up by importing from GSC.", OPS_REFS.setup, "Bing Webmaster (import from GSC)"),
    ],
    est_minutes: 25, required: true,
    gaps: ["SOP-06 registers blog and GBP automations \"when automations go live\"; there's no date for that yet."],
  },
  {
    title: "Your first 30 days",
    summary: "What you'll learn and own in your first month.",
    lesson_md: [
      "The first 30 days are for learning the system with Justin next to you.",
      "",
      "- Shadow every onboarding Justin runs.",
      "- Learn Møthership™ end to end: Clients, Flight Plan, Tasks, Requests, Comms and the package pages.",
      "- Run onboarding for one or two clients, with Justin reviewing every client message before it goes out.",
      "- Own the connection checklist on every new client: domain, Google Business Profile, analytics, Search Console, billing and portal access.",
      "- Day 30: your first skills test (design + system).",
    ].join("\n"),
    sop_refs: [OPS_REFS.ramp],
    checklist: [
      c("c1", "Shadow every onboarding Justin runs this month.", OPS_REFS.ramp, "Shadow every onboarding I run"),
      c("c2", "Open each area of Møthership™: Clients, Flight Plan, Tasks, Requests, Comms and the package pages.", OPS_REFS.ramp, "Clients, Flight Plan, Tasks, Requests, Comms and the package pages"),
      c("c3", "Take the Day 30 skills test (design + system).", OPS_REFS.ramp, "Day 30: first skills test (design + system)"),
    ],
    quiz: [
      q("q1", "In days 1–30, who reviews your client messages before they go out?", ["Nobody", "Justin", "The client"], 1, "You run onboarding with Justin reviewing every client message before it goes out.", OPS_REFS.ramp, "with me reviewing every client message before it goes out"),
      q("q2", "What happens on day 30?", ["Your first skills test", "A pay review", "Nothing special"], 0, "Day 30 is the first skills test (design + system).", OPS_REFS.ramp, "Day 30: first skills test (design + system)"),
    ],
    est_minutes: 15, required: true,
    gaps: ["The ramp doesn't set a pass mark for the day-30 skills test."],
  },
];
