// Justin's approval rule (Nov 19, 2026). KEEP IDENTICAL to src/lib/approvalLanes.js.
//   taste  Justin approves: visual design, look and feel, layout aesthetics, brand tone, imagery, animation style.
//   logic  Decided by us, no approval: SEO, performance, site architecture, schema, accessibility, security setup,
//          data structure, process logic, page placement by route, copy structure for search, technical defaults,
//          research, and anything Justin already does consistently or has told us to do.
//   gate   Safety gates that always wait for his tap: publishing/deploying, DNS or domain changes, deleting data,
//          spending money or anything billing/pricing, sending emails or texts to real clients, and steps that need
//          his own logins or accounts.
// Only taste and gate items reach Justin's Command screen. Logic items are auto-approved with AUTO_NOTE and an
// audit trail he can override from Command > Decided for you.
export const AUTO_NOTE = "Auto-approved: logic/best practice (Justin's rule, Nov 19)";
export const LANES = {
  taste: { label: "Taste", hint: "Your call: look, feel, brand tone" },
  logic: { label: "Decided for you", hint: "Logic or best practice: we decide" },
  gate: { label: "Hard gate", hint: "Safety gate: publish, DNS, delete, money, client sends, your logins" },
};

const t = (v) => String(v == null ? "" : v).toLowerCase();

// Hard gates first (they win over everything), then taste, then logic.
const GATE_RE = [
  /\bpublish|\bdeploy|cut ?over|go[- ]live|\blive after publish/,
  /\bdns\b|\bdomain|point [\w.-]+\.(com|net|org)|buy [\w.-]+\.(com|net)/,
  /\bdelete\b|\bremove\b.*\b(data|records?|rows?)\b|\bredact|\bpurge/,
  /\bstripe\b|\bprices?\b|\bpricing|\bbilling|\binvoice|\bpay(ment)?\b|\brefund|\bcredit\b|\bbudget|\bspend|\bcharge|\$\s?\d|\ballowances?\b|\bcancel\b|\bdeposit|\bterms\b/,
  /\bsend\b|\bemail(s)? (to|for)\b|\bemail (the |our |a )?(client|customer|lead|owner)s?\b|\bsms\b|\btext(s|-back)?\b.*(send|client|customer)|\binvite\b|\btell [a-z]+/,
  /api_?key|\bsecret|\blogins?\b|\bconnect (quickbooks|amazon ses|ses|google search console|google analytics)|\bclaim(ed)?\b.*listing|listing claimed|verify .*(search console|bing)|\bservice agreement|\bcontract\b/,
  /\bask (james|jen|todd|miguel|ivan|jay|jacob|cami|tyler|kev|jeremy|jamal|chase)|still to get from|questions? for [a-z ]+\(ask|\bgoals call|\bbook (a|an) .*(call|intake)|\bfranchise pitch/,
];
const TASTE_RE = [
  /\bdesign\b|\blook\b|\bfeel\b|\blayout\b|\bfont|\bcolou?r|\bblue\b|\bbrand (call|tone|voice)|\bimagery|\bphoto|\banimation|\bvisual|\baesthetic|\bwording\b|\btone\b|\bvoice\b|\blogo\b|\bstyle\b/,
];

export function laneForText(title, extra = "") {
  // "market-price source" is a data-source choice, not pricing.
  const s = `${t(title)} ${t(extra)}`.replace(/market[- ]price/g, "market data");
  if (GATE_RE.some((r) => r.test(s))) return "gate";
  if (TASTE_RE.some((r) => r.test(s))) return "taste";
  return "logic";
}

// ClaudeJob results waiting for review, by kind.
const JOB_LANE = {
  research: "logic", enrich_profile: "logic", audit: "logic", task: "logic", report: "logic", content_plan: "logic", map_pack_plan: "logic",
  topic_calendar: "logic", playbook: "logic", social_plan: "logic", blog: "logic", checklist_item: "logic", lead_build: "taste", command: "logic", site_visit: "logic",
  build_website: "taste", build_app: "logic", brand: "taste", presentation: "taste", gbp_post: "taste",
  email: "gate",
};
export function laneForJob(job) {
  const k = String(job?.kind || "other");
  if (JOB_LANE[k]) {
    // A generic task whose title is clearly a gate (publish, send, money) still waits.
    if (k === "task" || k === "report") { const l = laneForText(job?.title); return l === "gate" ? "gate" : JOB_LANE[k]; }
    return JOB_LANE[k];
  }
  return laneForText(job?.title, job?.instruction || "");
}

// Foundation prompts (Playbooks): design-led areas are taste; process/SEO/setup areas are logic.
export function laneForPrompt(p) {
  const s = t(p?.title || p?.area_title || "");
  if (/brand kit|social posts|client emails|website build\b/.test(s)) return "taste";
  return "logic";
}

// Command cards (ProposedAction).
export function laneForAction(pa) {
  const k = String(pa?.kind || "");
  if (k === "send_email" || k === "send_sms" || k === "log_expense") return "gate";
  if (k === "record_change" || k === "create_task" || k === "client_note") return laneForText(pa?.title) === "gate" ? "gate" : "logic";
  return laneForText(pa?.title, pa?.body || "");
}

// Road to Dec 31 items Justin owns.
export const laneForLaunchItem = (it) => laneForText(it?.title, it?.why_it_matters || "");

// Public posts are taste (they also publish, which is a gate the publisher still holds).
export const laneForPost = () => "taste";
// Agent learnings: process logic.
export const laneForLearning = () => "logic";
// Bookkeeping: money.
export const laneForLedger = () => "gate";
