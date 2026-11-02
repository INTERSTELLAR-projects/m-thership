// Leads pipeline: stages, sources and the readers that turn a CRMClient (status "Lead") into a pipeline card.
// Older leads have no pipeline fields; everything here derives a sensible value from their notes instead of
// mass-editing data (call booked if a "Strategy call booked" note exists, else new).

export const STAGES = [
  { key: "new", label: "New", hint: "Just came in. Reach out." },
  { key: "contacted", label: "Contacted", hint: "Reached out, waiting on a reply." },
  { key: "call_booked", label: "Call booked", hint: "Strategy call on the calendar." },
  { key: "call_held", label: "Call held", hint: "Call done. Send the proposal." },
  { key: "proposal_sent", label: "Proposal sent", hint: "Waiting on a yes." },
  { key: "won", label: "Won", hint: "Onboarding via the flight plan." },
  { key: "lost", label: "Lost", hint: "Didn't move forward." },
];
export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));
export const OPEN_STAGES = ["new", "contacted", "call_booked", "call_held", "proposal_sent"];
const REACHED_CALL = ["call_booked", "call_held", "proposal_sent", "won"];

export const SOURCES = [
  { key: "website", label: "Website", tone: "bg-ink text-white" },
  { key: "funnel", label: "Funnel", tone: "bg-[#ff3c00] text-white" },
  { key: "referral", label: "Referral", tone: "bg-green-600/15 text-green-800" },
  { key: "cold", label: "Cold", tone: "bg-sky-600/15 text-sky-800" },
  { key: "ads", label: "Ads", tone: "bg-amber-500/20 text-amber-800" },
  { key: "social", label: "Social", tone: "bg-fuchsia-600/15 text-fuchsia-800" },
  { key: "other", label: "Other", tone: "bg-ink/[0.08] text-ink/70" },
];
export const SOURCE_BY_KEY = Object.fromEntries(SOURCES.map((s) => [s.key, s]));

// Same questions the website booking form asks (step 2), so a hand-entered lead is just as complete.
export const INTEREST_OPTIONS = ["Mission ALPHA", "Mission BRAVO", "HyperCare+ (SEO)", "Custom Website", "Command System (app)", "Ops Command", "Brand Arsenal", "Not sure yet"];
export const REVENUE_OPTIONS = ["Under $100K", "$100K–$250K", "$250K–$500K", "$500K–$1M", "$1M–$5M", "$5M+"];
export const TEAM_OPTIONS = ["Just me", "2–5", "6–15", "16–50", "50+"];
export const TIMELINE_OPTIONS = ["ASAP", "Within 30 days", "1–3 months", "3–6 months", "Just exploring"];
export const LOST_REASONS = ["Price", "Timing", "Went with someone else", "Not a fit", "No response", "Other"];

const noteTexts = (c) => (Array.isArray(c && c.notes) ? c.notes.map((n) => String((n && n.text) || "")) : []);
const lastMatch = (c, re) => {
  const texts = noteTexts(c);
  for (let i = texts.length - 1; i >= 0; i -= 1) {
    const m = texts[i].match(re);
    if (m) return m[1].trim();
  }
  return "";
};

export const isLeadish = (c) => Boolean(c && (c.status === "Lead" || c.pipeline_stage || c.lead_source));

export function stageOf(c) {
  if (c.pipeline_stage) return c.pipeline_stage;
  return noteTexts(c).some((t) => /Strategy call booked/i.test(t)) ? "call_booked" : "new";
}

export function sourceOf(c) {
  if (c.lead_source) return c.lead_source;
  const t = noteTexts(c).join("\n");
  if (/booking funnel/i.test(t)) return "funnel";
  if (/website booking form/i.test(t)) return "website";
  return "other";
}

export function interestOf(c) {
  return c.lead_interest || lastMatch(c, /Most interested in:\s*(.+)/i) || "";
}

export function detailsOf(c) {
  const d = { ...(c.lead_details || {}) };
  if (!d.annual_revenue) d.annual_revenue = lastMatch(c, /Annual revenue:\s*(.+)/i);
  if (!d.team_size) d.team_size = lastMatch(c, /Team size:\s*(.+)/i);
  if (!d.timeline) d.timeline = lastMatch(c, /Wants it done:\s*(.+)/i);
  if (!d.biggest_problem) d.biggest_problem = lastMatch(c, /Biggest problem:\s*([\s\S]+)/i);
  if (!d.business_type) d.business_type = c.industry || lastMatch(c, /Industry:\s*(.+)/i);
  return d;
}

// { at: Date|null, label: "Nov 4, 10:30 AM" } or null
export function bookedCallOf(c) {
  if (c.booked_call_at) {
    const raw = String(c.booked_call_at);
    const d = new Date(raw.length === 10 ? raw + "T12:00:00" : raw);
    if (!Number.isNaN(d.getTime())) {
      const label = raw.length === 10
        ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      return { at: d, label };
    }
  }
  const m = lastMatch(c, /Strategy call booked:\s*([^\n(]+)/i);
  if (!m) return null;
  const parts = m.match(/(\d{4}-\d{2}-\d{2})\s*at\s*(.+)/);
  if (parts) {
    const d = new Date(parts[1] + "T12:00:00");
    return { at: Number.isNaN(d.getTime()) ? null : d, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " + parts[2].trim() };
  }
  return { at: null, label: m.trim() };
}

export const reachedCall = (c) => REACHED_CALL.includes(stageOf(c)) || Boolean(c.booked_call_at) || noteTexts(c).some((t) => /Strategy call booked/i.test(t));

export function daysInStage(c) {
  const t = new Date(c.stage_changed_at || c.created_date || Date.now()).getTime();
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

export const todayIso = () => new Date().toLocaleDateString("en-CA");
export const isOverdue = (c) => Boolean(c.next_step_at) && OPEN_STAGES.includes(stageOf(c)) && String(c.next_step_at).slice(0, 10) < todayIso();
export const noteDate = () => new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
export const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");

// Interest → which package page + sale the won lead's flight plan should start on.
const SUGGEST = [
  [/alpha/i, "custom-website", "mission_alpha"],
  [/bravo/i, "custom-website", "mission_bravo"],
  [/hyper|orbit|ørbit|seo/i, "orbit-seo", "orbit_local"],
  [/ops/i, "ops-command", "ops_command"],
  [/brand/i, "brand-arsenal", "brand_arsenal"],
  [/command|app\b|software|system/i, "command-system", "command_system"],
  [/web|site/i, "custom-website", "custom_website"],
];
export function suggestedSale(c) {
  const text = [interestOf(c), c.plan].filter(Boolean).join(" ");
  const hit = SUGGEST.find(([re]) => re.test(text));
  return hit ? { pkgKey: hit[1], sale: hit[2] } : null;
}
