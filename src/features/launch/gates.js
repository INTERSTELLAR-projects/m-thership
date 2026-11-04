// Every approval gate in Møthership, what it does today, and the recommended policy.
// Modes: auto (no approval; logged and reversible) | notify (proceeds; shows in Justin's digest) | approve (blocks).
// NOTHING here changes behavior yet: every gate keeps its CURRENT mode until Justin saves a policy AND Claude wires
// gateMode() into that gate (LaunchItem m:policy-wire). The saved policy lives in AppSettings key "approval_policy".
import { base44 } from "@/api/base44Client";
import { approveJob } from "@/features/claude/jobs";

export const MODES = {
  auto: { label: "Auto", hint: "No approval. Logged and reversible." },
  notify: { label: "Notify", hint: "Proceeds; you see it in the daily digest." },
  approve: { label: "Approve", hint: "Waits for your click." },
};

// why = what the gate protects. bulk = how "Approve all in group" works ("job" = existing approveJob,
// "status" = plain status flip, false = must be reviewed where it lives).
const job = (kind, label, recommended, why, extra = {}) => ({
  key: `claude.${kind}`, family: "Claude Queue", label, entity: "ClaudeJob", query: { status: "needs_approval", kind }, current: "approve", recommended, why, bulk: "job", link: "/claude", ...extra,
});

export const GATES = [
  job("research", "Research proposals & offer briefs", "auto", "Internal research. Nothing leaves Møthership."),
  job("enrich_profile", "Profile enrichments", "auto", "Facts from the client's own site, GBP and listings. Conflicting values still come to you.", { bulk: false, note: "Approval writes only the fields you tick in the review table, so these can't be bulk-approved yet." }),
  job("social_plan", "Social plans", "auto", "Internal plan, saved hidden from the portal. The posts it produces still need approval."),
  job("content_plan", "Content plans (blog + GBP calendar)", "auto", "Internal plan. Each blog and GBP post still needs approval."),
  job("map_pack_plan", "Map pack plans", "auto", "Internal plan; nothing changes on a profile."),
  job("audit", "Intel audits", "approve", "Approving makes the findings visible in the client's portal (ClientGap.portal_visible) and logs a client-facing work entry."),
  job("playbook", "Industry playbooks", "approve", "Client-facing deliverable (portal Playbook tab)."),
  job("brand", "Brand kits", "approve", "Client-facing deliverable saved onto the profile."),
  job("build_website", "Website build stages", "notify", "Work lands in the sandbox; nothing is live until you publish (publishing stays yours)."),
  job("build_app", "App build stages", "notify", "Approving a stage queues the next one; nothing is live until you publish."),
  job("blog", "Blog drafts", "approve", "Public content on the client's site."),
  job("gbp_post", "GBP post drafts", "approve", "Public content on the client's Google profile."),
  job("email", "Client emails", "approve", "Sent to a client."),
  job("report", "Client reports", "approve", "Client-facing."),
  job("presentation", "Presentations", "approve", "Usually client-facing."),
  job("task", "General tasks", "approve", "Scope varies; may touch a client or a live site."),
  job("other", "Other jobs", "approve", "Scope varies."),
  { key: "social.post", family: "Social Studio", label: "Social Studio posts (Interstellar IG/FB)", entity: "SocialPost", query: { status: "draft" }, current: "approve", recommended: "approve", why: "Public posts; approved posts auto-publish at their time.", bulk: false, link: "/social", note: "Review the images in Social Studio; approving there schedules them." },
  { key: "social.variant", family: "Social Studio", label: "Content-engine variants (13 platforms)", entity: "SocialVariant", query: { status: "draft" }, current: "approve", recommended: "approve", why: "Public posts.", bulk: false, link: "/social" },
  { key: "social.channel", family: "Social Studio", label: "LinkedIn / YouTube / DM drafts", entity: "ChannelPost", query: { status: "draft" }, current: "approve", recommended: "approve", why: "Public; you post these by hand.", bulk: false, link: "/social" },
  { key: "outreach.message", family: "Backlinks & Citations", label: "Outreach emails", entity: "OutreachMessage", query: { status: { $in: ["draft", "needs_approval"] } }, current: "approve", recommended: "approve", why: "Sent to third parties under a real identity.", bulk: false, link: "/backlinks" },
  { key: "outreach.target", family: "Backlinks & Citations", label: "Outreach targets (qualify)", entity: "OutreachTarget", query: { status: "drafted" }, current: "approve", recommended: "auto", why: "Internal research list.", bulk: false, link: "/backlinks" },
  { key: "seo.intel", family: "Search Intel", label: "Search Intel proposed actions", entity: "SeoIntel", query: { kind: "action", status: "proposed" }, current: "approve", recommended: "approve", why: "Most touch live client sites. Approving marks them OK to implement; implementation is still a separate job.", bulk: "status", approveTo: { status: "approved" }, link: "/orbit-seo/manage" },
  { key: "seo.fix", family: "Search Intel", label: "Fix with AI proposals", entity: "SeoFix", query: { status: "proposed" }, current: "approve", recommended: "approve", why: "Live-site changes.", bulk: false, link: "/performance" },
  { key: "mappack.plan", family: "Map pack", label: "Map pack drafts on client pages", entity: "MapPackPlan", query: { status: "draft" }, current: "approve", recommended: "auto", why: "Internal plan; nothing changes on a Google profile until a later approved job.", bulk: "status", approveTo: { status: "approved" }, linkFor: (r) => `/clients/${r.client_id}?tab=mappack` },
  { key: "ads.recommendation", family: "Ads Studio", label: "Ads recommendations", entity: "AdRecommendation", query: { status: "proposed" }, current: "approve", recommended: "approve", why: "Money: budgets, launches, pauses.", bulk: false, link: "/ads" },
  { key: "agents.learning", family: "Agents", label: "Agent learnings (prompt/behavior changes)", entity: "AgentLearning", query: { status: "proposed" }, current: "approve", recommended: "approve", why: "Changes how an agent behaves.", bulk: false, link: "/agents" },
  { key: "brain.merge", family: "Agents", label: "Business Brain updates from research", entity: "BusinessBrain", query: null, current: "auto", recommended: "auto", why: "Nightly refine merges sourced facts; contradictions are flagged for you, never overwritten.", bulk: false, link: "/agents?brain=1" },
  { key: "ledger.review", family: "Accounting", label: "Bank transactions to categorize", entity: "LedgerTransaction", query: { review_status: "needs_review" }, current: "approve", recommended: "notify", why: "Bookkeeping, no money moves. Rule matches can apply automatically; only uncertain ones need you.", bulk: false, link: "/financial" },
  { key: "prestige.redemption", family: "Prestige", label: "Credit redemptions", entity: "PrestigeRedemption", query: { status: "requested" }, current: "approve", recommended: "approve", why: "Money (credit).", bulk: false, link: "/prestige" },
  { key: "portal.invite", family: "Portal", label: "Portal invites waiting for review", entity: "PortalInvite", query: { status: "needs_review" }, current: "approve", recommended: "approve", why: "Sent to a client.", bulk: false, link: "/crm" },
  { key: "inbox.item", family: "Documents", label: "Inbox items to file", entity: "InboxItem", query: { status: "needs_review" }, current: "approve", recommended: "auto", why: "Internal filing.", bulk: false, link: "/documents" },
  { key: "engine.start", family: "Engines", label: "Start engine per client", entity: "EngineStart", query: null, current: "approve", recommended: "notify", why: "Only queues drafts that still need approval; could start the day a client turns green.", bulk: false, link: "/launch" },
];

export const gateByKey = (k) => GATES.find((g) => g.key === k);
export const POLICY_KEY = "approval_policy";

export async function loadPolicy() {
  const rows = (await base44.entities.AppSettings.filter({ key: POLICY_KEY }, "-updated_date", 1).catch(() => [])) || [];
  return rows[0] || null;
}

// The one read every gate will use once wired. Until then nothing calls it with effect.
export function gateMode(policy, key) {
  const g = gateByKey(key);
  const saved = policy?.pageSettings?.modes?.[key];
  const wired = (policy?.pageSettings?.wired || []).includes(key);
  return wired && saved ? saved : g ? g.current : "approve";
}

export async function savePolicy(existing, modes, by) {
  const pageSettings = { ...(existing?.pageSettings || {}), modes, saved_at: new Date().toISOString(), saved_by: by || "justin", wired: existing?.pageSettings?.wired || [] };
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
  if (g.bulk === "status") return base44.entities[g.entity].update(r.id, { ...g.approveTo, approved_at: new Date().toISOString() });
  throw new Error("This group must be reviewed where it lives.");
}
