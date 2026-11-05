// QA / demo fixtures for the work ledger (fictional clients c1 Summit Roofing, c2 Harbor Coffee). Preview + ?qa=1 only.
import { DEFAULT_BASELINES, DEFAULT_RATE } from "./baselines";

const H = 3600e3;
const ago = (h) => new Date(Date.now() - h * H).toISOString();
const base = Object.fromEntries(DEFAULT_BASELINES.map((b) => [b.key, b]));
let n = 0;
const row = (h, client, done_by, task_type, title, extra = {}) => {
  const b = base[task_type] || base.other;
  const manual = done_by === "justin_manual" ? b.minutes : 0;
  return {
    id: `we${++n}`, client_id: client === "agency" ? "agency" : client, client_name: client === "c1" ? "Summit Roofing Co" : client === "c2" ? "Harbor Coffee" : "Interstellar",
    title, task_type, category: b.category, done_by, minutes_baseline: b.minutes, manual_minutes: manual, minutes_saved_estimate: done_by === "justin_manual" ? 0 : b.minutes,
    status: "done", completed_at: ago(h), visibility: "internal", processed: true, ...extra,
  };
};
const vis = (title, summary) => ({ visibility: "client", client_title: title, client_summary: summary, client_copy_status: "generated" });

export const QA_LEDGER = [
  row(2, "c1", "scheduled_task", "blog_post", "Blog: How to spot hail damage before it becomes a leak", { agent_key: "seo_blog:c1", agent_name: "Summit blog writer", link: "https://summitroofing.test/blog/hail-damage", ...vis("We published a new guide on spotting hail damage", "Homeowners searching after a storm now find your step-by-step checklist and a clear next step to book an inspection.") }),
  row(5, "c1", "agent", "citation", "Citations: Angi + Houzz listings submitted", { agent_key: "citations:c1", agent_name: "Citation builder", ...vis("We added your business to Angi and Houzz", "Two more trusted directories now list your name, phone and service area exactly as your website does.") }),
  row(9, "c1", "claude_session", "site_page", "Lake Oswego service-area page", vis("We launched your Lake Oswego service page", "Customers in Lake Oswego now land on a page written for their neighborhood, with your recent roofs there.")),
  row(20, "c1", "claude_session", "app_feature", "Crew calendar in the Summit system", vis("We added a crew calendar to your business system", "Your team can see who is on which roof each day and drag jobs to reschedule.")),
  row(26, "agency", "agent", "agent_run", "Nightly brain refresh: 15 brains checked", { agent_key: "brain_keeper", agent_name: "Brain keeper" }),
  row(30, "c2", "scheduled_task", "keyword_dossier", "Keyword steward: 28 keywords mapped to pages", { agent_key: "keyword_steward:c2", agent_name: "Keyword steward", ...vis("We mapped the searches your customers use to your pages", "Each menu item and neighborhood search now points to the page that answers it best.") }),
  row(33, "c2", "justin_manual", "client_request", "Changed the hero photo (request)", vis("We swapped in your new latte-art hero photo", "Your homepage now opens with the photo you sent us.")),
  row(40, "agency", "scheduled_task", "research_brief", "Research department: 4 agency notes", { agent_key: "research_dept", agent_name: "Research department" }),
  row(48, "agency", "justin_manual", "decision", "Approved the monthly topic calendars"),
  row(52, "c1", "scheduled_task", "blog_post", "Blog: Roof repair vs replacement", { agent_key: "seo_blog:c1", agent_name: "Summit blog writer", ...vis("We published a new article on repair vs. replacement", "A plain-English guide that answers the question most roofing shoppers ask before they call.") }),
  row(70, "c2", "claude_session", "seo_setup", "Sitemap, schema and redirects for Harbor Coffee", vis("We tuned your website for search", "Google can now read your menu, hours and location clearly, and old links point to the right pages.")),
  row(96, "agency", "claude_session", "app_feature", "Output ledger + client work feed"),
  row(120, "c1", "agent", "outreach", "Outreach: 6 local backlink targets drafted", { agent_key: "outreach:c1", agent_name: "Outreach agent" }),
  row(150, "c1", "claude_session", "site_migration", "Summit site cutover-ready", vis("We finished your new website and got it ready to go live", "Every page from your old site has a home on the new one, with search basics in place.")),
  row(190, "c2", "scheduled_task", "social_plan", "Social plan: November", { agent_key: "social_plan:c2", agent_name: "Social planner" }),
  row(230, "agency", "justin_manual", "ops_task", "Client call: Summit kickoff"),
  row(300, "c1", "scheduled_task", "audit", "Intel audit — Summit Roofing", { agent_key: "claude_queue", agent_name: "Claude queue", ...vis("We completed a full review of your online presence", "A plain-language briefing on what is working, what is leaking leads and the first fixes to make.") }),
  row(420, "c2", "claude_session", "brand_kit", "Harbor Coffee brand kit", vis("We put together your brand kit", "Your logo rules, colors, fonts and voice in one place for anyone who makes something for you.")),
  row(560, "c1", "claude_session", "app_build_stage", "Summit Command System stage 1", vis("We started building your business system", "The foundation for leads, quotes, jobs and invoices in one place is set up.")),
  row(700, "agency", "claude_session", "automation_setup", "Engines monthly re-queue workflow"),
  row(900, "c2", "team", "site_build", "Harbor Coffee website build", vis("We built your new website", "A fast new site with your full menu, hours and online ordering links.")),
  row(1100, "c1", "justin_manual", "gbp_update", "GBP categories updated"),
  row(1400, "agency", "scheduled_task", "research_brief", "Future Oracle weekly brief", { agent_key: "future_oracle", agent_name: "Future Oracle" }),
  row(1700, "c1", "claude_session", "translation", "Spanish version of the Summit site", vis("We added a Spanish version of your website", "Spanish-speaking homeowners can now read every page in their language.")),
];

export function qaLedgerInvoke(args = {}) {
  if (args.action === "config") return { rows: DEFAULT_BASELINES, hourly_rate: DEFAULT_RATE, updated_at: null };
  if (args.action === "sync") return { created: 0, updated: 0, processed: { copy_generated: 0 } };
  return {};
}

export function qaWorkFeed(cid) {
  return QA_LEDGER.filter((e) => e.client_id === cid && e.visibility === "client" && e.client_title)
    .map((e) => ({ id: e.id, title: e.client_title, summary: e.client_summary, category: e.category, date: e.completed_at.slice(0, 10), url: e.link || "" }));
}
