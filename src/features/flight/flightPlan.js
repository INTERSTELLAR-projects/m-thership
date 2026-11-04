// Flight Plan — every way a client can buy, and every stage it flows through until it is delivered.
// The steps inside each node are read live from the SOP library (TaskTemplate), so editing an SOP
// updates this chart. What lives here is only the routing: which purchase passes through which stage.

export const LANES = [
  { key: "alpha", label: "Mission ALPHA", price: "$8,997", sub: "All seven packages · 45-day build", service: "mission_alpha", color: "#ff3c00" },
  { key: "bravo", label: "Mission BRAVO", price: "$6,497", sub: "Intel Briefing + Website + Command System", service: "mission_bravo", color: "#8a2e00" },
  { key: "website", label: "Website only", price: "$4,997", sub: "Intel Briefing + Custom Website · offered on the call", service: "custom_website", color: "#1a1a1a" },
  { key: "app", label: "App only", price: "$5,997", sub: "Intel Briefing + Command System · offered on the call", service: "command_system", color: "#57534e" },
  { key: "addon", label: "Add-on only", price: "$1,400–$3,000", sub: "One package for an existing client", service: null, color: "#b45309" },
];

// Packages an existing client can buy on their own (the "Add-on only" lane).
// The Intel Briefing is never sold alone: it comes free with every build.
export const ADDONS = [
  { key: "ops_command", label: "Ops Command", price: "$3,000" },
  { key: "brand_arsenal", label: "Brand Arsenal", price: "$2,500" },
  { key: "launch_grid", label: "Launch Grid", price: "$1,400" },
  { key: "transmission", label: "Transmission Video", price: "Quoted" },
];

export const TIERS = [
  { key: "local", label: "Local", price: 750, streams: ["orbit_setup", "orbit_local", "starship"] },
  { key: "multi", label: "Multi-location", price: 1100, streams: ["orbit_setup", "orbit_local", "orbit_multi", "starship"], note: "Local + $350/mo per extra location (one extra shown)" },
  { key: "national", label: "National", price: 1750, streams: ["orbit_setup", "orbit_national", "starship"] },
  { key: "global", label: "Global", price: 3000, streams: ["orbit_setup", "orbit_national", "orbit_global", "starship"] },
];

const ALL4 = { alpha: "on", bravo: "on", website: "on", app: "on" };
const isSweep = (item) => /^before launch/i.test(item.phase || "");

// Stage groups, top to bottom. Each row: lanes → "on" (always) | "if" (only if that add-on was bought).
export const STAGES = [
  {
    num: "01", title: "Close the sale", hint: "Quote accepted, care plan chosen, money in, service started in Møthership.",
    rows: [
      {
        key: "sale", sop: "closing", label: "Closing the Sale",
        doing: "Agree the package and the care plan, sign, take payment, then Client → Start a service.",
        lanes: { ...ALL4, addon: "on" },
      },
    ],
  },
  {
    num: "02", title: "Onboard", hint: "New clients only. Paperwork, access, kickoff call and a first win in week one.",
    rows: [
      { key: "onboarding", sop: "onboarding", doing: "Agreement, every login and access, kickoff call, content checklist, first GBP win.", lanes: { ...ALL4 } },
    ],
  },
  {
    num: "03", title: "Discover", hint: "Every build opens with the Intel audit — free with ALPHA, BRAVO, Website and App. It sets the build plan for everything below.",
    rows: [
      { key: "intel", sop: "intel_briefing", filter: (i) => !isSweep(i), label: "Intel Briefing · audit", doing: "Audit site, search, listings, software spend and follow-up; build the scorecard and plan. ✦ Claude tab → Audit the business.", lanes: { ...ALL4 } },
    ],
  },
  {
    num: "04", title: "Build", hint: "These run in parallel, not one after another. Each one is its own SOP and project tasks.",
    parallel: true,
    rows: [
      { key: "website", sop: "website", doing: "Inputs → build prompt → Base44 build → edit rounds → SEO + schema → pillar sweep.", lanes: { alpha: "on", bravo: "on", website: "on" } },
      { key: "system", sop: "system", doing: "Discovery → approved blueprint → build → integrations → security test → training.", lanes: { alpha: "on", bravo: "on", app: "on" } },
      { key: "ops", sop: "ops_command", doing: "Map processes, write SOPs, automate them in their system, route alerts, set up the AI Email Agent and Chrome Workspace, train.", lanes: { alpha: "on", addon: "if" }, addon: "ops_command" },
      { key: "brand", sop: "brand_arsenal", doing: "Discovery, direction, full kit, voice guide, signatures, socials, launch posts.", lanes: { alpha: "on", addon: "if" }, addon: "brand_arsenal" },
      { key: "grid", sop: "launch_grid", doing: "Claim, verify and complete every listing; merge duplicates; hand over ownership.", lanes: { alpha: "on", addon: "if" }, addon: "launch_grid" },
    ],
  },
  {
    num: "05", title: "Finish", hint: "Every build ends with the Intel final sweep. ALPHA also gets the video.",
    rows: [
      { key: "transmission", sop: "transmission", doing: "Brief, script, produce, one revision, deliver cutdowns and place it on the site.", lanes: { alpha: "on", addon: "if" }, addon: "transmission" },
      { key: "sweep", sop: "intel_briefing", filter: isSweep, label: "Intel Briefing · final sweep", doing: "Before/after scorecard, close old accounts, clean listings, cancel subscriptions. ✦ Claude tab → Run the final sweep.", lanes: { ...ALL4 } },
    ],
  },
  {
    num: "06", title: "Launch", hint: "Go live and hand over. These steps already sit inside the build SOPs; shown here so launch day is in one place.",
    rows: [
      {
        key: "launch", milestone: true, label: "Go live + hand off",
        doing: "Domain, redirects, sitemap, live checks, training, logins, launch message, review ask.",
        lanes: { ...ALL4 },
        from: [
          { sop: "website", filter: (i) => /stage 6|stage 7/i.test(i.phase || "") },
          { sop: "system", filter: (i) => /^launch|after launch/i.test(i.phase || "") },
        ],
        laneFrom: { alpha: [0, 1], bravo: [0, 1], website: [0], app: [1] },
      },
    ],
  },
  {
    num: "07", title: "Care", hint: "Required for every mission, website and app. HyperCare+ already includes GravïtyCare.",
    care: true,
    rows: [
      { key: "gate", gate: true, label: "Which care plan?", doing: "The plan chosen at the sale goes live the day they launch.", lanes: { ...ALL4, addon: "keep" } },
      {
        key: "care_setup", fork: true, label: "Month 0 · set up", doing: "Foundations before anything recurring runs.",
        lanes: { ...ALL4 },
        hyper: { streams: ["orbit_setup"], label: "HyperCare+ setup" },
        gravity: { sop: "starship", filter: (i) => /setup/i.test(i.phase || ""), label: "GravïtyCare setup" },
      },
      {
        key: "care_monthly", fork: true, loop: true, label: "Every month", doing: "The recurring work and the monthly report, until they cancel.",
        lanes: { ...ALL4 },
        hyper: { tier: true, label: "HyperCare+ monthly" },
        gravity: { sop: "starship", filter: (i) => /month/i.test(i.phase || ""), label: "GravïtyCare monthly" },
      },
    ],
  },
];

// Service keys → package pages + "what the client gets" in the registry / deliverables.
export const SOP_TO_PACKAGE = {
  intel_briefing: "intel-briefing", website: "custom-website", system: "command-system", ops_command: "ops-command",
  brand_arsenal: "brand-arsenal", launch_grid: "launch-grid", transmission: "transmission",
  orbit_setup: "orbit-seo", orbit_local: "orbit-seo", orbit_multi: "orbit-seo", orbit_national: "orbit-seo", orbit_global: "orbit-seo",
  starship: "gravitycare",
};

// Every SOP piece (service_key + optional step filter) a scenario runs, for the totals strip.
export function scenarioPieces({ lane, care, tier, addon }) {
  const pieces = [];
  const tierRow = TIERS.find((t) => t.key === tier) || TIERS[0];
  for (const stage of STAGES) {
    for (const row of stage.rows) {
      const state = row.lanes?.[lane];
      if (!state || row.manual || row.milestone || row.gate) continue;
      if (state === "if" && row.addon !== addon) continue;
      if (row.fork) {
        if (care === "hyper") {
          if (row.hyper.streams) row.hyper.streams.forEach((k) => pieces.push({ sop: k }));
          if (row.hyper.tier) tierRow.streams.filter((k) => k !== "orbit_setup" && k !== "starship").forEach((k) => pieces.push({ sop: k }));
          if (row.key === "care_setup") pieces.push({ sop: "starship" }); // HyperCare+ includes GravïtyCare
        } else {
          pieces.push({ sop: row.gravity.sop, filter: row.gravity.filter });
        }
        continue;
      }
      pieces.push({ sop: row.sop, filter: row.filter });
    }
  }
  return pieces;
}

// Loose ends found when the chart was built (Oct 31, 2026): where Møthership's "Start a service"
// does not yet match this flow. Kept here so they stay visible until fixed.
// All six loose ends found on Oct 31 were fixed on Oct 31 – Nov 1 (care plan required at start,
// no double GravïtyCare, system care hand-off step, build prices, $750 public / $500 referral, Closing SOP).
// Nov 2, 2026: Justin confirmed Transmission sold alone is $1,500 (already the value in start-service).
export const LOOSE_ENDS = [];
