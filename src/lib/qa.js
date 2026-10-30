// QA MODE — design preview with FAKE data, only on the Base44 preview sandbox host with ?qa=1.
// Never active on the live app. Real data stays protected by entity access rules either way.
// Remove this file (and its two imports) before launch.

const host = typeof window !== "undefined" ? window.location.hostname : "";
const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
if (host.startsWith("preview-sandbox--") && params.get("qa") === "1") {
  try { sessionStorage.setItem("ms_qa", "1"); } catch { /* ignore */ }
}
let flag = false;
try { flag = host.startsWith("preview-sandbox--") && sessionStorage.getItem("ms_qa") === "1"; } catch { flag = false; }
export const IS_QA = flag;

export const QA_USER = { id: "qa-admin", email: "qa@interstellar.test", full_name: "QA Admin", role: "admin" };

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => iso(new Date(today.getTime() - n * 864e5));
const daysAhead = (n) => iso(new Date(today.getTime() + n * 864e5));

const FIX = {
  CRMClient: [
    { id: "c1", business: "Summit Roofing Co", contact: "Dana Reyes", emails: ["dana@summit.test"], phones: ["(503) 555-0101"], websites: ["summitroofing.test"], status: "Active", services: [{ id: 1, name: "HyperCare+", price: 750 }, { id: 2, name: "Starshïp", price: 197 }], services_managed: ["website", "system", "orbit_seo"], plan: "ALPHA + HyperCare+ Local", domain: "summitroofing.test", notes: [], documents: [], completedTasks: [] },
    { id: "c2", business: "Harbor Coffee", contact: "Lee Park", emails: ["lee@harbor.test"], phones: [], websites: ["harborcoffee.test"], status: "Active", services: [{ id: 1, name: "HyperCare+", price: 500 }], services_managed: ["website", "orbit_seo"], plan: "BRAVO + HyperCare+ Local", domain: "harborcoffee.test", notes: [], documents: [], completedTasks: [] },
    { id: "c3", business: "Peak Fitness Lab", contact: "Sam Ortiz", emails: ["sam@peak.test"], phones: [], websites: ["peakfit.test"], status: "Lead", services: [], services_managed: [], domain: "peakfit.test", notes: [], documents: [], completedTasks: [] },
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
  ],
  WorkLog: [
    { id: "w1", client_id: "c1", client_name: "Summit Roofing Co", kind: "blog", title: "Roof repair vs replacement: what Portland homeowners should know", date: daysAgo(2), status: "live", source: "automation", verified_live: true, url: "https://summitroofing.test/blog/repair-vs-replace" },
    { id: "w2", client_id: "c1", client_name: "Summit Roofing Co", kind: "gbp_post", title: "Storm season inspection offer", date: daysAgo(3), status: "live", source: "automation", verified_live: true },
    { id: "w3", client_id: "c2", client_name: "Harbor Coffee", kind: "site_edit", title: "Updated fall hours on contact page", date: daysAgo(4), status: "live", source: "manual" },
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
  Project: [{ id: "pj1", client_id: "c1", title: "Customer rewards program", type: "app", status: "proposed", description: "Points for referrals and repeat jobs", portal_visible: true }],
  Goal: [],
};

const clone = (x) => JSON.parse(JSON.stringify(x));
const store = {};
const rows = (name) => (store[name] ||= clone(FIX[name] || []));
const matches = (r, q = {}) => Object.entries(q).every(([k, v]) => (v && typeof v === "object" ? true : r[k] === v));
const sortBy = (arr, sort) => {
  if (!sort || typeof sort !== "string") return arr;
  const desc = sort.startsWith("-");
  const key = sort.replace(/^-/, "");
  return [...arr].sort((a, b) => ((a[key] ?? "") > (b[key] ?? "") ? 1 : -1) * (desc ? -1 : 1));
};

function entityApi(name) {
  return {
    list: async (sort, limit) => sortBy(rows(name), sort).slice(0, limit || 500),
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
          files: of("ClientFile"), future: of("Project"), unread: 1,
        } };
      }
      return { data: {} };
    },
  };
  return base44;
}
