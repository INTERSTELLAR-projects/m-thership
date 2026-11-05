// QA MODE — design preview with FAKE data, only on the Base44 preview sandbox host with ?qa=1.
// Never active on the live app. Real data stays protected by entity access rules either way.
// Remove this file (and its two imports) before launch.

import { QA_ACCOUNTING } from "@/features/accounting/qaFixtures";
import { QA_SOCIAL, qaSocialInvoke } from "@/features/social/qaFixtures";
import { qaUsageInvoke } from "@/features/usage/qaFixtures";
import { qaFuelInvoke } from "@/features/fuel/qaFixtures";
import { demo, demoInvoke, warmDemo } from "@/lib/demoData";
import { QA_LEDGER, qaLedgerInvoke, qaWorkFeed } from "@/features/output/qaFixtures";
import { qaTrainingInvoke } from "@/features/training/qaFixtures";

const host = typeof window !== "undefined" ? window.location.hostname : "";
const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
if (host.startsWith("preview-sandbox--") && params.get("qa") === "1") {
  try { sessionStorage.setItem("ms_qa", "1"); } catch { /* ignore */ }
}
let flag = false;
try { flag = host.startsWith("preview-sandbox--") && sessionStorage.getItem("ms_qa") === "1"; } catch { flag = false; }
export const IS_QA = flag;

// DEMO (screen library for the sales deck): ?qa=1&demo=1 swaps in a big fictional book from src/lib/demoData.js.
// ?demo=0 switches it off again. Same preview-only guard as QA.
if (flag && params.get("demo") === "1") { try { sessionStorage.setItem("ms_demo", "1"); } catch { /* ignore */ } }
if (flag && params.get("demo") === "0") { try { sessionStorage.removeItem("ms_demo"); } catch { /* ignore */ } }
let demoFlag = false;
try { demoFlag = flag && sessionStorage.getItem("ms_demo") === "1"; } catch { demoFlag = false; }
export const IS_DEMO = demoFlag;

export const QA_USER = { id: "qa-admin", email: IS_DEMO ? "commander@interstellar.demo" : "qa@interstellar.test", full_name: "Commander", role: "admin" };

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => iso(new Date(today.getTime() - n * 864e5));
const daysAhead = (n) => iso(new Date(today.getTime() + n * 864e5));

const FIX = {
  CRMClient: [
    { id: "c1", business: "Summit Roofing Co", contact: "Dana Reyes", emails: ["dana@summit.test"], phones: ["(503) 555-0101"], websites: ["summitroofing.test"], status: "Active", services: [{ id: 1, name: "HyperCare+", price: 750 }, { id: 2, name: "GravïtyCare", price: 197 }], services_managed: ["website", "system", "orbit_seo"], plan: "ALPHA + HyperCare+ Local", domain: "summitroofing.test", notes: [], documents: [], completedTasks: [] },
    { id: "c2", business: "Harbor Coffee", contact: "Lee Park", emails: ["lee@harbor.test"], phones: [], websites: ["harborcoffee.test"], status: "Active", services: [{ id: 1, name: "HyperCare+", price: 500 }], services_managed: ["website", "orbit_seo"], plan: "BRAVO + HyperCare+ Local", domain: "harborcoffee.test", notes: [], documents: [], completedTasks: [] },
    { id: "c3", business: "Peak Fitness Lab", contact: "Sam Ortiz", emails: ["sam@peak.test"], phones: [], websites: ["peakfit.test"], status: "Lead", services: [], services_managed: [], domain: "peakfit.test", notes: [], documents: [], completedTasks: [] },
    // Extra pipeline leads (fictional) so the board reads like a working week in demo footage.
    { id: "c4", business: "Cascade Plumbing", contact: "Jordan Hale", emails: ["jordan@cascade.test"], phones: [], websites: [], status: "Lead", pipeline_stage: "new", lead_source: "website", lead_interest: "Command System (app)", next_step: "Intro call", next_step_at: daysAhead(1), stage_changed_at: daysAgo(0), services: [], notes: [], documents: [], completedTasks: [] },
    { id: "c5", business: "Ridgeline HVAC", contact: "Morgan Lee", emails: ["morgan@ridgeline.test"], phones: [], websites: [], status: "Lead", pipeline_stage: "new", lead_source: "referral", lead_interest: "Mission ALPHA", next_step: "Send audit", next_step_at: daysAhead(2), stage_changed_at: daysAgo(1), services: [], notes: [], documents: [], completedTasks: [] },
    { id: "c6", business: "Evergreen Landscaping", contact: "Casey Ward", emails: ["casey@evergreen.test"], phones: [], websites: [], status: "Lead", pipeline_stage: "contacted", lead_source: "funnel", lead_interest: "Custom Website", next_step: "Follow up", next_step_at: daysAhead(1), stage_changed_at: daysAgo(2), services: [], notes: [], documents: [], completedTasks: [] },
    { id: "c7", business: "Northside Electric", contact: "Riley Shaw", emails: ["riley@northside.test"], phones: [], websites: [], status: "Lead", pipeline_stage: "call_booked", lead_source: "website", lead_interest: "Command System (app)", booked_call_at: daysAhead(2) + "T10:30:00", stage_changed_at: daysAgo(1), services: [], notes: [], documents: [], completedTasks: [] },
    { id: "c8", business: "Bridgetown Painting", contact: "Avery Cole", emails: ["avery@bridgetown.test"], phones: [], websites: [], status: "Lead", pipeline_stage: "call_held", lead_source: "ads", lead_interest: "Ops Command", next_step: "Send proposal", next_step_at: daysAhead(1), stage_changed_at: daysAgo(3), services: [], notes: [], documents: [], completedTasks: [] },
    { id: "c9", business: "Timberline Fencing", contact: "Quinn Brooks", emails: ["quinn@timberline.test"], phones: [], websites: [], status: "Lead", pipeline_stage: "proposal_sent", lead_source: "referral", lead_interest: "Mission BRAVO", next_step: "Check in", next_step_at: daysAhead(3), stage_changed_at: daysAgo(4), services: [], notes: [], documents: [], completedTasks: [] },
  ],
  OrbitSEOClient: [
    { id: "o1", clientId: "c1", businessName: "Summit Roofing Co", website: "summitroofing.test", serviceType: "Local", status: "Active", blogFrequency: "2x weekly", lastBlogPosted: daysAgo(2), nextBlogDue: daysAhead(1), gbpStatus: "Active", gbpLastPost: daysAgo(3), gbpNextDue: daysAhead(2), blogsPublishedCount: 24, gbpPostsDoneCount: 18, blogs: [], gbpPosts: [], tasks: [] },
    { id: "o2", clientId: "c2", businessName: "Harbor Coffee", website: "harborcoffee.test", serviceType: "Local", status: "Needs Attention", blogFrequency: "Weekly", lastBlogPosted: daysAgo(9), nextBlogDue: daysAgo(2), gbpStatus: "Active", gbpLastPost: daysAgo(6), gbpNextDue: daysAhead(1), blogsPublishedCount: 11, gbpPostsDoneCount: 9, blogs: [], gbpPosts: [], tasks: [] },
  ],
  ToDoItem: [
    { id: "t1", title: "Finish Summit Roofing launch checklist", taskType: "Website Update", category: "Priority", status: "In Progress", done: false, assignedTo: "Summit Roofing Co", dueDate: daysAhead(2), price: 0 },
    { id: "t2", title: "Set up blog schedule for Harbor Coffee", taskType: "Other Task", category: "Priority", status: "Pending", done: false, assignedTo: "Harbor Coffee", dueDate: daysAhead(5) },
    { id: "t3", title: "Recreate onboarding SOPs", taskType: "Internal Tasks", category: "NextUp", status: "Pending", done: false, assignedTo: "Interstellar" },
    { id: "t4", title: "Optimize GBP for Peak Fitness", taskType: "GBP Update", category: "Priority", status: "Completed", done: true, assignedTo: "Peak Fitness Lab", completedDate: new Date(today.getTime() - 2 * 864e5).toISOString() },
  ],
  Task: [
    { id: "k1", title: "Build Summit service-area pages", client_id: "c1", client_name: "Summit Roofing Co", category: "development", status: "doing", priority: 1, due_date: daysAhead(1), is_focus: true, source: "manual" },
    { id: "k2", title: "Write Harbor Coffee holiday menu post", client_id: "c2", client_name: "Harbor Coffee", category: "content", status: "next", priority: 2, due_date: daysAhead(3), source: "ai" },
    { id: "k3", title: "Send Peak Fitness intake audit", client_id: "c3", client_name: "Peak Fitness Lab", category: "sales", status: "next", priority: 1, due_date: daysAgo(1), source: "manual" },
    { id: "k4", title: "Publish Summit storm-damage blog", client_id: "c1", client_name: "Summit Roofing Co", category: "content", status: "next", priority: 2, due_date: daysAhead(2), source: "ai", portal_visible: true },
    { id: "k5", title: "Add crew calendar to Summit system", client_id: "c1", client_name: "Summit Roofing Co", category: "development", status: "doing", priority: 1, due_date: daysAhead(4), source: "manual", portal_visible: true },
    { id: "k6", title: "Reply to Cascade Plumbing inquiry", client_id: "c4", client_name: "Cascade Plumbing", category: "sales", status: "next", priority: 1, due_date: daysAhead(0), source: "manual" },
    { id: "k7", title: "Harbor Coffee GBP holiday hours", client_id: "c2", client_name: "Harbor Coffee", category: "seo", status: "next", priority: 3, due_date: daysAhead(5), source: "ai" },
  ],
  WorkLog: [
    { id: "w1", client_id: "c1", client_name: "Summit Roofing Co", kind: "blog", title: "Roof repair vs replacement: what Portland homeowners should know", date: daysAgo(2), status: "live", source: "automation", verified_live: true, url: "https://summitroofing.test/blog/repair-vs-replace" },
    { id: "w2", client_id: "c1", client_name: "Summit Roofing Co", kind: "gbp_post", title: "Storm season inspection offer", date: daysAgo(3), status: "live", source: "automation", verified_live: true },
    { id: "w3", client_id: "c2", client_name: "Harbor Coffee", kind: "site_edit", title: "Updated fall hours on contact page", date: daysAgo(4), status: "live", source: "manual" },
    { id: "w4", client_id: "c1", client_name: "Summit Roofing Co", kind: "blog", title: "How to spot hail damage before it becomes a leak", date: daysAgo(0), status: "live", source: "automation", verified_live: true },
    { id: "w5", client_id: "c1", client_name: "Summit Roofing Co", kind: "gbp_post", title: "Free roof check after the windstorm", date: daysAgo(0), status: "live", source: "automation", verified_live: true },
    { id: "w6", client_id: "c1", client_name: "Summit Roofing Co", kind: "site_edit", title: "Added Lake Oswego service-area page", date: daysAgo(1), status: "live", source: "manual" },
  ],
  Automation: [
    { id: "a1", client_id: "c1", client_name: "Summit Roofing Co", name: "Blog drop (Tue/Thu)", kind: "blog", runner: "claude_scheduled", schedule: "Tue + Thu 9am PT", status: "active", last_result: "success", last_run_at: new Date(today.getTime() - 2 * 864e5).toISOString(), runs_count: 24 },
    { id: "a2", client_id: "c2", client_name: "Harbor Coffee", name: "GBP post (weekly)", kind: "gbp_post", runner: "claude_scheduled", schedule: "Mon 10am PT", status: "error", last_result: "failed", last_message: "GBP API returned 401", last_run_at: new Date(today.getTime() - 1 * 864e5).toISOString(), runs_count: 9 },
  ],
  ClientRequest: [
    { id: "r1", client_id: "c2", client_name: "Harbor Coffee", kind: "site_edit", title: "Change the hero photo", details: "Use the new latte art photo", status: "received", created_date: new Date().toISOString() },
    { id: "r2", client_id: "c1", client_name: "Summit Roofing Co", kind: "project_submission", title: "New project: Cedar shake re-roof in Lake Oswego", status: "in_progress", page_status: "generating", created_date: new Date().toISOString() },
  ],
  Expense: [{ id: "e1", name: "Base44", amount: 100, category: "Software", frequency: "Monthly" }],
  ClientGoal: [{ id: "g1", client_id: "c1", year: 2027, title: "Double booked roofing jobs from Google", metric: "Calls from Google per month", baseline_value: 40, current_value: 58, target_value: 80, unit: "calls / mo", status: "on_track", plan_steps: [{ title: "Launch service-area pages", done: true }, { title: "2 blogs a week", done: true }, { title: "Review request automation", done: false }] }],
  ClientGap: [{ id: "gp1", client_id: "c1", title: "No review request after jobs", area: "reviews", severity: "high", status: "planned", recommendation: "Text a review link when a job closes" }],
  PerformanceSnapshot: [
    { id: "p1", client_id: "c1", source: "gbp", period_start: daysAgo(60), period_end: daysAgo(31), metrics: { views: 2100, searches: 1400, calls: 44, directions: 31, website_clicks: 120 } },
    { id: "p2", client_id: "c1", source: "gbp", period_start: daysAgo(30), period_end: daysAgo(1), metrics: { views: 2650, searches: 1710, calls: 58, directions: 37, website_clicks: 151 } },
    { id: "p3", client_id: "c1", source: "gsc", period_start: daysAgo(30), period_end: daysAgo(1), metrics: { clicks: 812, impressions: 24100, ctr: 3.4, avg_position: 11.2 } },
  ],
  ClientFile: [{ id: "f1", client_id: "c1", title: "Summit brand kit", category: "brand_kit", file_url: "https://example.com/kit.pdf", delivered_on: daysAgo(20) }, { id: "f2", client_id: "c1", title: "Onboarding SOP", category: "sop", link_url: "https://docs.example.com", delivered_on: daysAgo(10) }],
  ConversationMessage: [{ id: "m1", client_id: "c1", content: "Your new service-area pages are live!", sender_role: "admin", created_date: new Date().toISOString() }],
  Project: [
    { id: "pj1", client_id: "c1", title: "Customer rewards program", type: "app", status: "proposed", description: "Points for referrals and repeat jobs", portal_visible: true },
    { id: "pj2", client_id: "c1", title: "Summit Command System", type: "app", status: "in_progress", description: "Leads, quotes, jobs and invoices in one place", portal_visible: true },
    { id: "pj3", client_id: "c2", title: "Harbor Coffee website", type: "website", status: "launched", description: "New site with online menu" },
  ],
  Goal: [],
  WorkEntry: QA_LEDGER,
  ...QA_ACCOUNTING,
  ...QA_SOCIAL,
};

const clone = (x) => JSON.parse(JSON.stringify(x));
const store = {};
const rows = (name) => (store[name] ||= clone((IS_DEMO && demo().E[name]) || FIX[name] || []));
const matches = (r, q = {}) => Object.entries(q).every(([k, v]) => (v && typeof v === "object" ? true : r[k] === v));
const sortBy = (arr, sort) => {
  if (!sort || typeof sort !== "string") return arr;
  const desc = sort.startsWith("-");
  const key = sort.replace(/^-/, "");
  return [...arr].sort((a, b) => ((a[key] ?? "") > (b[key] ?? "") ? 1 : -1) * (desc ? -1 : 1));
};

function entityApi(name) {
  return {
    // Some callers pass list({ sort, limit }) and read `.items`: support both shapes.
    list: async (sort, limit) => { const o = sort && typeof sort === "object" ? sort : { sort, limit }; const out = sortBy(rows(name), o.sort).slice(0, o.limit || 500); Object.defineProperty(out, "items", { value: out, enumerable: false }); return out; },
    filter: async (q, sort, limit) => sortBy(rows(name).filter((r) => matches(r, q)), typeof sort === "object" ? sort?.sort : sort).slice(0, (typeof sort === "object" ? sort?.limit : limit) || 500),
    aggregate: async () => [],
    count: async (q) => rows(name).filter((r) => matches(r, q || {})).length,
    get: async (id) => rows(name).find((r) => r.id === id) || null,
    create: async (data) => { const r = { id: `qa_${Math.random().toString(36).slice(2, 9)}`, created_date: new Date().toISOString(), ...data }; rows(name).unshift(r); return r; },
    bulkCreate: async (list) => Promise.all(list.map((d) => entityApi(name).create(d))),
    update: async (id, data) => { const r = rows(name).find((x) => x.id === id); if (r) Object.assign(r, data); return r; },
    bulkUpdate: async () => [],
    delete: async (id) => { store[name] = rows(name).filter((r) => r.id !== id); return { id }; },
    deleteMany: async () => ({}),
    subscribe: () => () => {},
  };
}

export function installQa(base44) {
  if (!IS_QA) return base44;
  if (IS_DEMO) warmDemo();
  const ents = new Proxy({}, { get: (_, name) => entityApi(String(name)) });
  try {
    Object.defineProperty(base44, "entities", { value: ents, configurable: true });
  } catch { base44.entities = ents; }
  base44.auth.me = async () => QA_USER;
  base44.auth.isAuthenticated = async () => true;
  base44.auth.logout = () => { sessionStorage.removeItem("ms_qa"); window.location.href = "/"; };
  base44.integrations = { Core: { InvokeLLM: async () => ({}), UploadFile: async () => ({ file_url: "" }) } };
  base44.functions = {
    invoke: async (name, args = {}) => {
      if (IS_DEMO) { const d = demoInvoke(name, args, rows); if (d !== undefined) return { data: d }; }
      if (String(name).startsWith("social-")) return { data: qaSocialInvoke(name, args) };
      if (name === "usage") return { data: qaUsageInvoke(args) };
      if (name === "fuel") return { data: qaFuelInvoke(args) };
      if (name === "work-ledger") return { data: qaLedgerInvoke(args) };
      if (name === "training") return { data: qaTrainingInvoke(args) };
      if (name !== "portal") return { data: {} };
      const cid = args.client_id || "c1";
      const of = (e) => rows(e).filter((r) => r.client_id === cid);
      if (args.action === "messages") return { data: { messages: of("ConversationMessage") } };
      if (args.action === "intake") return { data: { intake: of("IntakeAudit")[0] || null } };
      if (args.action === "home") {
        return { data: {
          client: rows("CRMClient").find((c) => c.id === cid), user: { email: QA_USER.email, is_admin_preview: true },
          work: of("WorkLog"), automations: of("Automation").filter((a) => a.status === "active"), requests: of("ClientRequest"),
          goals: of("ClientGoal"), gaps: of("ClientGap"), snapshots: of("PerformanceSnapshot"), upcoming: of("Task").filter((t) => t.portal_visible),
          files: of("ClientFile"), future: of("Project"), unread: 1, work_feed: qaWorkFeed(cid),
        } };
      }
      return { data: {} };
    },
  };
  return base44;
}
