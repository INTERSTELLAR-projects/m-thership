// Every approval gate in Møthership, what it did before Nov 4, 2026 and Justin's policy.
// Modes: auto (no approval; cleared by the policy sweep, logged to AutomationRun and reversible) |
// notify (proceeds the same way and shows in the daily digest as "notify") | approve (waits for Justin).
// The saved policy lives in AppSettings key "approval_policy" (pageSettings.modes); gateMode() is the one read
// every gate uses. The sweep that applies it is policySweep.js (runs on admin load, hourly while open, and from
// the Approval policy tab). Rule of thumb (Justin): anything Claude knows the answer to, or can resolve by asking
// one question, does not need his approval; anything published, sent to clients or the public, money, pricing,
// live-site changes, portal invites and client-visible audits does.
import { base44 } from "@/api/base44Client";
import { approveJob } from "@/features/claude/jobs";

export const MODES = {
  auto: { label: "Auto", hint: "No approval. Logged and reversible." },
  notify: { label: "Notify", hint: "Proceeds; you see it in the daily digest." },
  approve: { label: "Approve", hint: "Waits for your click." },
};

// why = what the gate protects. bulk = how "Approve all in group" works ("job" = existing approveJob,
// "status" = plain status flip, false = must be reviewed where it lives). autoIf = only rows matching it may
// clear automatically (the rest still wait). clear = custom auto action for gates without a bulk path.
const job = (kind, label, recommended, why, extra = {}) => ({
  key: `claude.${kind}`, family: "Claude Queue", label, entity: "ClaudeJob", query: { status: "needs_approval", kind }, current: "approve", recommended, why, bulk: "job", link: "/claude", ...extra,
});

export const GATES = [
  job("research", "Research proposals & offer briefs", "auto", "Internal research. Nothing leaves Møthership."),
  job("enrich_profile", "Profile enrichments", "auto", "Facts copied from a public source with its URL. Auto-applies only when every proposal is high-confidence and fills an empty field; anything that disagrees with what is on file still comes to you.", { bulk: false, note: "Mixed or conflicting proposals stay in the review table." }),
  job("social_plan", "Social plans", "auto", "Internal plan, saved hidden from the portal. The posts it produces still need approval."),
  job("content_plan", "Content plans", "auto", "Internal plan. Blog topics are approved once a month on the Topic Calendar."),
  job("map_pack_plan", "Map pack plans", "auto", "Internal plan; nothing changes on a profile."),
  job("topic_calendar", "Monthly blog Topic Calendars", "approve", "One card per client per month. Approving it lets that month's posts draft and publish on their own."),
  job("blog", "Blog posts from an approved Topic Calendar", "auto", "Pre-approved by the month's Topic Calendar. Published into the client's Base44 blog and counted only once verified live. Blog jobs without a calendar still wait.", { autoIf: (r) => !!(r.context && r.context.calendar_id) }),
  job("build_website", "Website build stages", "notify", "Work lands in the sandbox; nothing is live until you publish (publishing stays yours)."),
  job("build_app", "App build stages", "notify", "Approving a stage queues the next one; nothing is live until you publish."),
  job("audit", "Intel audits", "approve", "Approving makes the findings visible in the client's portal (ClientGap.portal_visible) and logs a client-facing work entry."),
  job("playbook", "Industry playbooks", "approve", "Client-facing deliverable (portal Playbook tab)."),
  job("brand", "Brand kits", "approve", "Client-facing deliverable saved onto the profile."),
  job("gbp_post", "GBP post drafts", "approve", "Public content. GBP posting is off for every client until the Google Business Profile API is approved."),
  job("email", "Client emails", "approve", "Sent to a client."),
  job("report", "Client reports", "approve", "Client-facing."),
  job("presentation", "Presentations", "approve", "Usually client-facing."),
  job("task", "General tasks", "approve", "Scope varies; may touch a client or a live site."),
  job("other", "Other jobs", "approve", "Scope varies."),
  { key: "social.post", family: "Social Studio", label: "Social Studio posts (Interstellar IG/FB)", entity: "SocialPost", query: { status: "draft" }, current: "approve", recommended: "approve", why: "Public posts; approved posts auto-publish at their time.", bulk: false, link: "/social", note: "Review the images in Social Studio; approving there schedules them." },
  { key: "social.variant", family: "Social Studio", label: "Content-engine variants (13 platforms)", entity: "SocialVariant", query: { status: "draft" }, current: "approve", recommended: "approve", why: "Public posts.", bulk: false, link: "/social" },
  { key: "social.channel", family: "Social Studio", label: "LinkedIn / YouTube / DM drafts", entity: "ChannelPost", query: { status: "draft" }, current: "approve", recommended: "approve", why: "Public; you post these by hand.", bulk: false, link: "/social" },
  { key: "outreach.message", family: "Backlinks & Citations", label: "Outreach emails", entity: "OutreachMessage", query: { status: { $in: ["draft", "needs_approval"] } }, current: "approve", recommended: "approve", why: "Sent to third parties as Justin (justin@interstellar-strategies.com), on the client's behalf.", bulk: false, link: "/backlinks" },
  { key: "outreach.target", family: "Backlinks & Citations", label: "Outreach targets (qualify)", entity: "OutreachTarget", query: { status: "discovered" }, current: "approve", recommended: "auto", why: "Internal research list. Auto moves discovered targets to qualified; nothing is contacted.", bulk: "status", approveTo: { status: "qualified" }, link: "/backlinks" },
  { key: "seo.intel", family: "Search Intel", label: "Search Intel proposed actions", entity: "SeoIntel", query: { kind: "action", status: "proposed" }, current: "approve", recommended: "approve", why: "Most touch live client sites. Approving marks them OK to implement; implementation is still a separate job.", bulk: "status", approveTo: { status: "approved" }, link: "/orbit-seo/manage" },
  { key: "seo.fix", family: "Search Intel", label: "Fix with AI proposals", entity: "SeoFix", query: { status: "proposed" }, current: "approve", recommended: "approve", why: "Live-site changes.", bulk: false, link: "/performance" },
  { key: "mappack.plan", family: "Map pack", label: "Map pack drafts on client pages", entity: "MapPackPlan", query: { status: "draft" }, current: "approve", recommended: "auto", why: "Internal plan; nothing changes on a Google profile until a later approved job.", bulk: "status", approveTo: { status: "approved" }, linkFor: (r) => `/clients/${r.client_id}?tab=mappack` },
  { key: "ads.recommendation", family: "Ads Studio", label: "Ads recommendations", entity: "AdRecommendation", query: { status: "proposed" }, current: "approve", recommended: "approve", why: "Money: budgets, launches, pauses.", bulk: false, link: "/ads" },
  { key: "agents.learning", family: "Agents", label: "Agent learnings", entity: "AgentLearning", query: { status: "proposed" }, current: "approve", recommended: "auto", why: "Internal-only learnings (no client attached) apply automatically. Client learnings still come to you.", bulk: "status", approveTo: { status: "applied", applied: true }, autoIf: (r) => !r.client_id, link: "/agents" },
  { key: "brain.merge", family: "Agents", label: "Business Brain updates from research", entity: "BusinessBrain", query: null, current: "auto", recommended: "auto", why: "Nightly refine merges sourced facts; contradictions are flagged for you, never overwritten.", bulk: false, link: "/agents?brain=1" },
  { key: "ledger.review", family: "Accounting", label: "Bank transactions to categorize", entity: "LedgerTransaction", query: { review_status: "needs_review" }, current: "approve", recommended: "notify", why: "Bookkeeping, no money moves. Rule matches and high-confidence suggestions apply automatically and show in the digest; uncertain ones still need you.", bulk: false, link: "/financial", autoIf: (r) => !!r.category && (!!r.rule_id || Number(r.ai_suggestion && r.ai_suggestion.confidence) >= 0.85) },
  { key: "prestige.redemption", family: "Prestige", label: "Credit redemptions", entity: "PrestigeRedemption", query: { status: "requested" }, current: "approve", recommended: "approve", why: "Money (credit).", bulk: false, link: "/prestige" },
  { key: "portal.invite", family: "Portal", label: "Portal invites waiting for review", entity: "PortalInvite", query: { status: "needs_review" }, current: "approve", recommended: "approve", why: "Sent to a client.", bulk: false, link: "/crm" },
  { key: "inbox.item", family: "Documents", label: "Inbox items to file", entity: "InboxItem", query: { status: "needs_review" }, current: "approve", recommended: "auto", why: "Internal filing. Confident voice captures become tasks automatically; unclear ones stay.", bulk: false, link: "/documents", autoIf: (r) => (r.suggested_kind || "task") === "task" && !!r.suggested_title && Number(r.confidence) >= 0.7 },
  { key: "engine.start", family: "Engines", label: "Start engine per client", entity: "EngineStart", query: null, current: "approve", recommended: "notify", why: "Claude presses Start engine when all four lights are green and tells you. It queues the Topic Calendar (yours to approve), outreach drafts (yours to approve) and internal plans.", bulk: false, link: "/launch" },
];

// Justin's policy (Nov 4, 2026) = the recommended column.
export const JUSTIN_POLICY = Object.fromEntries(GATES.map((g) => [g.key, g.recommended]));

export const gateByKey = (k) => GATES.find((g) => g.key === k);
export const POLICY_KEY = "approval_policy";

export async function loadPolicy() {
  const rows = (await base44.entities.AppSettings.filter({ key: POLICY_KEY }, "-updated_date", 1).catch(() => [])) || [];
  return rows[0] || null;
}

// The one read every gate uses. Saved choice wins; a gate added after the last save uses its recommendation.
export function gateMode(policy, key) {
  const g = gateByKey(key);
  const saved = policy?.pageSettings?.modes?.[key];
  if (saved && MODES[saved]) return saved;
  if (policy?.pageSettings?.saved_at) return g ? g.recommended : "approve";
  return g ? g.current : "approve";
}

export async function savePolicy(existing, modes, by) {
  const pageSettings = { ...(existing?.pageSettings || {}), modes, saved_at: new Date().toISOString(), saved_by: by || "justin", wired: GATES.map((g) => g.key) };
  if (existing) return base44.entities.AppSettings.update(existing.id, { pageSettings });
  return base44.entities.AppSettings.create({ key: POLICY_KEY, pageSettings });
}

const list = (p) => Promise.resolve(p).then((r) => (Array.isArray(r) ? r : (r && r.items) || [])).catch(() => []);

// Everything waiting, grouped by gate. One list call per gate entity.
export async function loadWaiting() {
  const out = {};
  await Promise.all(GATES.filter((g) => g.query).map(async (g) => {
    const ent = base44.entities[g.entity];
    if (!ent) { out[g.key] = []; return; }
    out[g.key] = await list(ent.filter(g.query, "-created_date", g.entity === "LedgerTransaction" ? 2000 : 300));
  }));
  return out;
}

export function rowTitle(g, r) {
  return r.title || r.name || r.headline || r.payee || r.topic || r.learning || r.client_name || r.email || "(untitled)";
}

export async function approveRow(g, r) {
  if (g.bulk === "job") return approveJob(r);
  if (g.bulk === "status") return base44.entities[g.entity].update(r.id, { ...g.approveTo, ...(g.entity === "MapPackPlan" ? { approved_at: new Date().toISOString() } : {}) });
  throw new Error("This group must be reviewed where it lives.");
}
