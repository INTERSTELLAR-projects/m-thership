// Universe: the whole operation as one zoomable tree.
//   Claude (the engine, and the surfaces where its work happens)
//     -> Møthership (the hub every brand runs through)
//       -> brands (Interstellar first, then each sister brand)
//         -> Interstellar HQ departments | industry groups -> clients
//           -> the client's departments -> the agents working each one, and what they delivered.
// Pure functions over records already in Møthership. Nothing is invented: a missing record shows as a gap or an
// honest empty state, never as activity.
import { rootOf, childBrands, brandIdOfClient, brandTheme, clientBrainStats, brandOwnBrain } from "@/features/brands/graph";
import { CLIENT_DEPTS, INTERSTELLAR_DEPTS } from "@/features/agents/defs";

const arr = (v) => (Array.isArray(v) ? v : (v && v.items) || []);
const s = (v) => (v == null ? "" : String(v).trim());
const DAY = 864e5;
const tsOf = (v) => { const t = new Date(v || 0).getTime(); return Number.isFinite(t) ? t : 0; };

export const SIZE = {
  claude: { w: 860, h: 214 },
  hub: { w: 400, h: 156 },
  brand: { w: 300, h: 176 },
  addbrand: { w: 230, h: 120 },
  hq: { w: 290, h: 136 },
  group: { w: 252, h: 112 },
  client: { w: 252, h: 150 },
  dept: { w: 236, h: 0 },
  out: { w: 270, h: 0 },
};
export const deptHeight = (n) => 62 + Math.max(1, n) * 34;
export const outHeight = (n) => 62 + Math.max(1, Math.min(5, n)) * 34;

export const TONE = { ok: "#2ee6c5", warn: "#ffaa00", bad: "#ff4433", idle: "rgba(244,239,233,.38)", info: "rgba(244,239,233,.38)", live: "#ff6a00" };

// Agent kinds, in plain words (never a vendor name).
export const KIND_LABEL = {
  claude_scheduled_task: "Claude scheduled task", base44_workflow: "App workflow", in_app_ai: "In-app AI", backend_function: "Backend function",
  manual_skill: "Claude skill (on demand)", browser_agent: "Browser agent", computer_agent: "Computer agent",
};
export const kindLabel = (k) => KIND_LABEL[k] || s(k).replace(/_/g, " ").replace(/base44/gi, "app") || "Agent";

const JOB_DEPT = { blog: "seo", gbp_post: "seo", map_pack_plan: "seo", citations: "seo", social_plan: "social", social: "social", email: "email", report: "reporting", app_build: "ops", audit: "website", site_edit: "website", ads: "ads", research: "research", reviews: "reviews" };
const WORK_DEPT = { blog: "seo", gbp_post: "seo", project_page: "seo", city_page: "seo", citations: "seo", social: "social", social_post: "social", email: "email", site_edit: "website", report: "reporting", app_edit: "ops", ads: "ads", review: "reviews" };

export function rel(iso, now = Date.now()) {
  const t = tsOf(iso);
  if (!t) return "never";
  const m = Math.round((now - t) / 6e4);
  const fut = m < 0;
  const a = Math.abs(m);
  const txt = a < 1 ? "just now" : a < 60 ? `${a}m` : a < 1440 ? `${Math.round(a / 60)}h` : `${Math.round(a / 1440)}d`;
  return a < 1 ? txt : fut ? `in ${txt}` : `${txt} ago`;
}

const slugOf = (v) => s(v).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other";
export const isTestClient = (c) => /\[test\]|\btest\b|\(demo\)/i.test(s(c && c.business));
const industryGroup = (c) => (isTestClient(c) ? "Test clients" : s(c.industry).split("·")[0].trim() || "Other");

// What an agent is doing right now, from its own record and any running Claude job for the same client + department.
export function agentNow(a, { job, now = Date.now() } = {}) {
  if (a.status === "broken") return { text: s(a.last_error) || "Failed on its last run", tone: "bad" };
  if (a.status === "paused") return { text: "Paused", tone: "idle" };
  if (a.status === "planned") return { text: "Planned · not running yet", tone: "idle" };
  if (job) return { text: `${job.status === "needs_approval" ? "Waiting for your OK" : "Working on"}: ${s(job.title)}`, tone: "live" };
  if (a.last_run_at) return { text: `Ran ${rel(a.last_run_at, now)}${a.last_status && a.last_status !== "success" ? ` · ${a.last_status}` : ""}${a.schedule ? ` · ${a.schedule}` : ""}`, tone: a.last_status === "error" ? "bad" : now - tsOf(a.last_run_at) < DAY ? "ok" : "idle" };
  return { text: a.schedule ? `Live · ${a.schedule} · no runs logged yet` : "Live · no runs logged yet", tone: "idle" };
}

const deptStatus = (agents) => (agents.some((a) => a.status === "broken") ? "bad" : agents.some((a) => a.status === "paused") ? "warn" : agents.some((a) => a.status === "live") ? "ok" : "idle");
const worst = (list) => (list.includes("bad") ? "bad" : list.includes("warn") ? "warn" : list.includes("ok") ? "ok" : "idle");

// Foundation wires of one client: real fields and records only (same rules as the client Agents view).
export function clientWires(c, { snapshots = [], profiles = [], appBrain = null, ev = null } = {}) {
  const site = s(c.domain) || s(arr(c.websites)[0]);
  const mine = profiles.filter((p) => s(p.client_id) === s(c.id));
  const sync = mine.some((p) => p.has_sync === "yes") ? "yes" : mine.some((p) => p.has_sync === "partial") ? "partial" : "no";
  const synced = !!(appBrain && appBrain.syncedAt) || sync === "yes";
  const reporting = [...new Set(snapshots.map((x) => s(x.source).toUpperCase()).filter(Boolean))];
  const access = ev ? ["access_gsc", "access_gbp", "access_ga4"].filter((k) => arr(ev.items).some((i) => i.key === k && i.filled && !i.na)).length : 0;
  const stripe = arr(c.services).filter((x) => x && (x.stripe || x.stripe_price_id || x.stripe_subscription_id));
  const logins = arr(c.portal_emails).length;
  return [
    { k: "site", label: "Website", state: site ? (c.site_app_id ? "on" : "partial") : "off", sub: site ? `${site.replace(/^https?:\/\//, "")}${c.site_app_id ? "" : " · site app not linked"}` : "No website on file" },
    { k: "cmd", label: "Command System", state: c.command_app_id ? (synced ? "on" : "partial") : c.ops_app_id ? "partial" : "off", sub: c.command_app_id ? (synced ? `Brain sync on${appBrain && appBrain.syncedAt ? ` · ${rel(appBrain.syncedAt)}` : ""}` : "Linked · not syncing yet") : c.ops_app_id ? "Ops app linked · sync not set" : "Not connected" },
    { k: "portal", label: "Portal", state: c.portal_enabled ? (logins ? "on" : "partial") : "off", sub: c.portal_enabled ? `${logins} login${logins === 1 ? "" : "s"}` : "Portal off" },
    { k: "data", label: "Data sources", state: reporting.length ? "on" : access ? "partial" : "off", sub: reporting.length ? `${reporting.join(" · ")} reporting` : access ? `${access} access granted · no data yet` : "Not connected" },
    { k: "billing", label: "Billing", state: stripe.length ? "on" : arr(c.services).length ? "partial" : "off", sub: stripe.length ? `${stripe.length} Stripe line${stripe.length === 1 ? "" : "s"}` : arr(c.services).length ? "Services set · not on Stripe" : "No services yet" },
  ];
}

const clientHref = (id, tab) => `/clients/${id}${tab ? `?tab=${tab}` : ""}`;
const agentHref = (a) => (a.scope === "client" ? `/agents?v=classic&web=clients&client=${a.client_id}&agent=${encodeURIComponent(a.key)}` : `/agents?v=classic&agent=${encodeURIComponent(a.key)}`);

// Gaps: what is missing or broken, each a to-do with the page that fixes it.
export function clientGaps(c, { wires, brainPct, profile, agents }) {
  const g = [];
  const add = (key, sev, label, to, fix) => g.push({ id: `${c.id}:${key}`, key, sev, label, to, fix, clientId: c.id, clientName: c.business });
  const w = Object.fromEntries(wires.map((x) => [x.k, x]));
  if (w.site.state === "off") add("site", "bad", "No website on file", clientHref(c.id, "profile"), "Add the website");
  if (w.billing.state === "off") add("billing", "bad", "No billing set up", clientHref(c.id, "billing"), "Set up billing");
  if (brainPct == null) add("brain", "bad", "Business Brain not started", clientHref(c.id, "dossier"), "Start the Brain");
  else if (brainPct < 60) add("brain", "warn", `Business Brain ${brainPct}% complete`, clientHref(c.id, "dossier"), "Fill the Brain");
  agents.filter((a) => a.status === "broken").forEach((a) => add(`agent:${a.key}`, "bad", `${a.name} is broken${a.last_error ? `: ${a.last_error}` : ""}`, agentHref(a), "Open the agent"));
  if (w.cmd.state === "off") add("cmd", "warn", "Command System not connected", clientHref(c.id, "systems"), "Connect it");
  else if (w.cmd.state === "partial") add("cmd", "warn", "Command System not syncing to the Brain", clientHref(c.id, "systems"), "Fix the sync");
  if (w.data.state === "off") add("data", "warn", "No data sources (Search Console, GA4, GBP)", clientHref(c.id, "performance"), "Connect data");
  if (w.portal.state === "off") add("portal", "warn", "Client portal is off", "/settings?tab=portal", "Turn on the portal");
  if (!agents.length) add("agents", "info", "No agents deployed yet", `/agents?v=classic&web=clients&client=${c.id}`, "Deploy agents");
  if (profile && profile.pct < 50) add("profile", "warn", `Profile ${profile.pct}% · ${profile.missing} items missing`, clientHref(c.id, "profile"), "Fill in what's missing");
  return g;
}

// ---------------------------------------------------------------- build
// data: { brands, clients, dossiers, brandFacts, brains, profiles, registry, jobs, runs, work, snapshots, evals: Map<id, evaluateCriteria()> }
export function buildUniverse(data, { now = Date.now() } = {}) {
  const d = data || {};
  const nodes = {};
  const put = (n) => { nodes[n.id] = { children: [], gaps: [], ...SIZE[n.type], ...n }; return nodes[n.id]; };
  const kid = (parent, child) => { nodes[parent].children.push(child.id); child.parent = parent; return child; };

  const brands = arr(d.brands);
  const root = rootOf(brands);
  const sisters = childBrands(brands, root);
  const clients = arr(d.clients).filter((c) => (c.status || "Active") === "Active");
  const registry = arr(d.registry);
  const jobs = arr(d.jobs);
  const runs = arr(d.runs);
  const work = arr(d.work);
  const profiles = arr(d.profiles);
  const evals = d.evals instanceof Map ? d.evals : new Map();
  const dossierBy = Object.fromEntries(arr(d.dossiers).map((x) => [x.client_id, x]));
  const brainBy = Object.fromEntries(arr(d.brains).filter((b) => b.scope === "client" && b.client_id).map((b) => [b.client_id, b]));
  const snapBy = {};
  arr(d.snapshots).forEach((x) => { (snapBy[x.client_id] ||= []).push(x); });
  const agentsBy = {};
  registry.filter((a) => a.scope === "client" && a.client_id).forEach((a) => { (agentsBy[a.client_id] ||= []).push(a); });
  const hqAgents = registry.filter((a) => a.scope === "interstellar");
  const openJobs = jobs.filter((j) => ["running", "queued", "needs_approval"].includes(j.status));
  const dayAgo = now - DAY;
  const runs24 = runs.filter((r) => tsOf(r.started_at) >= dayAgo);
  const runsBy = {};
  runs24.forEach((r) => { if (r.client_id) runsBy[r.client_id] = (runsBy[r.client_id] || 0) + 1; });
  const workBy = {};
  work.forEach((w) => { if (w.client_id) (workBy[w.client_id] ||= []).push(w); });
  Object.values(workBy).forEach((l) => l.sort((a, b) => s(b.date || b.created_date).localeCompare(s(a.date || a.created_date))));

  // Claude + its surfaces.
  const weekAgo = now - 7 * DAY;
  const posts7 = work.filter((w) => ["blog", "gbp_post", "social", "social_post"].includes(w.kind) && tsOf(w.date || w.created_date) >= weekAgo).length;
  const browserAgents = registry.filter((a) => /browser|computer|chrome/i.test(`${a.kind} ${a.name}`));
  const appsLinked = clients.filter((c) => c.command_app_id || c.ops_app_id || c.site_app_id).length;
  const jobsOf = (re) => jobs.filter((j) => re.test(s(j.kind)));
  const surfaces = [
    { k: "chats", label: "Chats & agents", value: registry.filter((a) => a.status === "live").length, unit: "agents live", sub: `${openJobs.length} job${openJobs.length === 1 ? "" : "s"} in the queue`, to: "/claude" },
    { k: "builds", label: "App builds", value: appsLinked, unit: "client apps", sub: `${jobsOf(/app_build|build/).length} build job${jobsOf(/app_build|build/).length === 1 ? "" : "s"}`, to: "/systems" },
    { k: "browser", label: "Computer & browser", value: browserAgents.length, unit: browserAgents.length === 1 ? "agent" : "agents", sub: browserAgents.length ? `${browserAgents.filter((a) => a.status === "live").length} live` : "None registered yet", to: "/agents?v=classic" },
    { k: "decks", label: "Presentations", value: jobsOf(/presentation|deck/).length, unit: "decks", sub: jobsOf(/presentation|deck/).length ? "From the Claude queue" : "None in the queue", to: "/claude" },
    { k: "posts", label: "Posts", value: posts7, unit: "this week", sub: "Blogs, GBP and social, logged live", to: "/client-posts" },
  ];
  put({ id: "claude", type: "claude", label: "Claude", sub: "The engine behind everything we do", surfaces, metrics: { runs24: runs24.length, jobs: openJobs.length } });

  kid("claude", put({ id: "hub", type: "hub", label: "Møthership", sub: "The hub every brand runs through" }));

  // Clients.
  const clientNode = (c, parentId, color) => {
    const agents = (agentsBy[c.id] || []).slice().sort((a, b) => s(a.name).localeCompare(s(b.name)));
    const appBrain = clientBrainStats(dossierBy[c.id]);
    const bb = brainBy[c.id];
    const brainPct = bb && Number.isFinite(Number(bb.completeness)) ? Math.round(Number(bb.completeness)) : appBrain && appBrain.score != null ? appBrain.score : null;
    const ev = evals.get(c.id) || null;
    const profile = ev ? { pct: ev.pct, missing: arr(ev.missing).length, top: arr(ev.missing).slice(0, 6).map((i) => i.label) } : null;
    const wires = clientWires(c, { snapshots: snapBy[c.id] || [], profiles, appBrain, ev });
    const gaps = clientGaps(c, { wires, brainPct, profile, agents });
    const wireScore = wires.reduce((t, w) => t + (w.state === "on" ? 1 : w.state === "partial" ? 0.5 : 0), 0) / wires.length;
    const agentScore = agents.length ? agents.filter((a) => a.status === "live").length / agents.length : 0;
    const parts = [brainPct ?? 0, wireScore * 100, agentScore * 100, ...(profile ? [profile.pct] : [])];
    const foundation = Math.round(parts.reduce((t, x) => t + x, 0) / parts.length);
    const cjobs = openJobs.filter((j) => j.client_id === c.id);
    const n = kid(parentId, put({
      id: `client:${c.id}`, type: "client", clientId: c.id, label: c.business || "Client", sub: s(c.industry) || s(c.domain), color: /^#[0-9a-f]{6}$/i.test(s(c.accent)) ? c.accent : color,
      logo: c.logo_url || null, test: isTestClient(c), wires, gaps, brainPct, appBrain, profile, foundation, agents, plan: s(c.plan),
      status: gaps.some((g) => g.sev === "bad") ? "bad" : gaps.some((g) => g.sev === "warn") ? "warn" : "ok",
      activity: (runsBy[c.id] || 0) + cjobs.length, jobs: cjobs, delivered: (workBy[c.id] || []).slice(0, 8),
    }));
    // Departments (with their agents), then what was delivered.
    CLIENT_DEPTS.forEach((dep) => {
      const list = agents.filter((a) => a.department === dep.key);
      if (!list.length) return;
      const job = cjobs.find((j) => JOB_DEPT[j.kind] === dep.key) || null;
      const rows = list.map((a, i) => ({ ...a, now: agentNow(a, { job: i === list.findIndex((x) => x.status === "live") ? job : null, now }) }));
      kid(n.id, put({ id: `dept:${c.id}:${dep.key}`, type: "dept", dept: dep.key, code: dep.code, label: dep.label, blurb: dep.blurb, clientId: c.id, agents: rows, h: deptHeight(rows.length), status: deptStatus(list), activity: job ? 1 : 0 }));
    });
    const core = agents.filter((a) => ["ceo", "brain"].includes(a.department));
    if (core.length) {
      const rows = core.map((a) => ({ ...a, now: agentNow(a, { now }) }));
      const cn = put({ id: `dept:${c.id}:core`, type: "dept", dept: "core", code: "CEO", label: "Client CEO & Brain", blurb: "Answers about this client and keeps its Brain current.", clientId: c.id, agents: rows, h: deptHeight(rows.length), status: deptStatus(core) });
      cn.parent = n.id;
      n.children.unshift(cn.id);
    }
    const items = (workBy[c.id] || []).slice(0, 5).map((w) => ({ id: w.id, title: s(w.title) || "Work", kind: s(w.kind).replace(/_/g, " "), at: w.date || w.created_date, url: s(w.url), dept: WORK_DEPT[w.kind] || null, by: w.source === "automation" ? "Automation" : "Claude" }));
    kid(n.id, put({ id: `out:${c.id}`, type: "out", label: "Delivered", clientId: c.id, items, h: outHeight(items.length), status: items.length ? "ok" : "idle" }));
    return n;
  };

  // Brands.
  const brandList = root ? [root, ...sisters] : sisters;
  const clientsOf = (b) => clients.filter((c) => { const id = brandIdOfClient(c, brands, root); return b === root ? !id : id === b.id; });
  if (!root) {
    // No Brand records yet: Interstellar still owns every client.
    brandList.unshift(null);
  }
  brandList.forEach((b, bi) => {
    const isRoot = !b || b === root;
    const t = brandTheme(b);
    const mine = b ? clientsOf(b) : clients;
    const own = b ? brandOwnBrain(b, d.brandFacts) : { score: null, reporting: false, answered: 0, total: 0 };
    const id = b ? `brand:${b.id}` : "brand:interstellar";
    const n = kid("hub", put({
      id, type: "brand", brand: b, root: isRoot, slug: (b && b.slug) || "interstellar", label: (b && b.name) || "Interstellar Strategies", sub: (b && b.niche) || (isRoot ? "Any industry" : ""),
      tagline: (b && b.tagline) || "", bstatus: (b && b.status) || "active", color: t.primary, accent: t.accent, own, order: bi,
    }));
    const bg = [];
    const add = (key, sev, label, to, fix) => bg.push({ id: `${id}:${key}`, key, sev, label, to, fix, brandId: b && b.id });
    const href = isRoot ? "/brands" : `/brands/${(b && b.slug) || ""}`;
    if (!mine.length) add("clients", isRoot ? "warn" : "idle", "No clients yet", "/crm", "Add the first client");
    if (!isRoot && b && !s(b.template_app_id)) add("template", "warn", "No template app linked", href, "Link the template app");
    if (b && !own.reporting) add("brain", "warn", "Brand Brain not reporting yet", href, "Connect the brand brain");
    else if (own.score != null && own.score < 50) add("brain", "warn", `Brand Brain ${own.score}% answered`, href, "Answer the brand questions");
    n.gaps = bg;

    if (isRoot) {
      const hq = kid(id, put({ id: "hq", type: "hq", label: `${(b && b.name) || "Interstellar"} HQ`, sub: "The agency's own departments", color: t.primary }));
      INTERSTELLAR_DEPTS.forEach((dep) => {
        const list = hqAgents.filter((a) => a.department === dep.key);
        const rows = list.map((a) => ({ ...a, now: agentNow(a, { now }) }));
        kid("hq", put({ id: `dept:hq:${dep.key}`, type: "dept", dept: dep.key, code: dep.code, label: dep.label, blurb: dep.blurb, agents: rows, h: deptHeight(rows.length), status: rows.length ? deptStatus(list) : "idle", hq: true }));
      });
      hq.agentCount = hqAgents.length;
      hq.live = hqAgents.filter((a) => a.status === "live").length;
      hq.gaps = hqAgents.filter((a) => a.status === "broken").map((a) => ({ id: `hq:${a.key}`, key: a.key, sev: "bad", label: `${a.name} is broken`, to: agentHref(a), fix: "Open the agent" }));
      hq.status = hq.gaps.length ? "bad" : hqAgents.length ? "ok" : "idle";
    }
    // Clients: straight under the brand when there are a few, grouped by industry when there are many.
    const sorted = mine.slice().sort((a, b2) => Number(isTestClient(a)) - Number(isTestClient(b2)) || s(a.business).localeCompare(s(b2.business)));
    if (sorted.length > 12) {
      const groups = new Map();
      // Broad industry first; a broad group that would hold more than 24 clients splits by trade ("Roofing", "HVAC").
      const broad = {};
      sorted.forEach((c) => { const g = industryGroup(c); broad[g] = (broad[g] || 0) + 1; });
      const keyOf = (c) => { const g = industryGroup(c); const fine = s(s(c.industry).split("·")[1]); return broad[g] > 24 && fine && g !== "Test clients" ? fine : g; };
      sorted.forEach((c) => { const g = keyOf(c); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(c); });
      // Fold tiny groups into "Other" so the level stays short.
      const big = [...groups].filter(([k, l]) => l.length >= 3 || k === "Test clients");
      const small = [...groups].filter(([k, l]) => !(l.length >= 3 || k === "Test clients")).flatMap(([, l]) => l);
      const final = [...big.filter(([k]) => k !== "Test clients").sort((a, b2) => b2[1].length - a[1].length), ...(small.length ? [["Other", small]] : []), ...big.filter(([k]) => k === "Test clients")];
      final.forEach(([label, list]) => {
        const gn = kid(id, put({ id: `group:${b ? b.id : "root"}:${slugOf(label)}`, type: "group", label, color: t.primary, count: list.length, test: label === "Test clients" }));
        list.forEach((c) => clientNode(c, gn.id, t.primary));
      });
    } else sorted.forEach((c) => clientNode(c, id, t.primary));
  });
  kid("hub", put({ id: "addbrand", type: "addbrand", label: "Add a brand", sub: "Each brand gets its own branch, clients and template, run through the same pipeline." }));

  // Roll up: gaps, health and activity, bottom-up.
  const roll = (id) => {
    const n = nodes[id];
    const kids = n.children.map(roll);
    const clientKids = kids.filter((k) => k.type === "client" || k.clients);
    n.allGaps = [...n.gaps, ...kids.flatMap((k) => k.allGaps)];
    n.activity = (n.activity || 0) + kids.reduce((t, k) => t + (k.activity || 0), 0);
    if (n.type === "client") { n.clients = 1; n.health = n.foundation; }
    else if (["group", "brand", "hub", "claude"].includes(n.type)) {
      n.clients = clientKids.reduce((t, k) => t + (k.clients || 0), 0);
      const hs = n.children.map((k) => nodes[k]).filter((k) => k.clients && k.health != null);
      n.health = n.clients ? Math.round(hs.reduce((t, k) => t + k.health * k.clients, 0) / n.clients) : null;
      n.agents = n.children.map((k) => nodes[k]).reduce((t, k) => t + (k.agents ? (Array.isArray(k.agents) ? k.agents.length : k.agents) : k.agentCount || 0), 0);
    }
    if (n.type === "client") n.agentsCount = n.agents.length;
    if (!n.status) n.status = n.allGaps.some((g) => g.sev === "bad") ? "bad" : n.allGaps.some((g) => g.sev === "warn") ? "warn" : n.clients || n.type === "dept" ? "ok" : "idle";
    if (["group", "brand", "hub", "claude"].includes(n.type)) n.status = n.type === "brand" && !n.clients && !n.allGaps.some((g) => g.sev !== "idle") ? "idle" : worst(n.allGaps.map((g) => g.sev).concat(n.clients ? ["ok"] : []));
    return n;
  };
  roll("claude");
  const rank = { bad: 0, warn: 1, info: 2, idle: 3 };
  Object.values(nodes).forEach((n) => {
    n.gaps = n.gaps.slice().sort((a, b) => rank[a.sev] - rank[b.sev]);
    n.issues = n.allGaps.filter((g) => g.sev === "bad" || g.sev === "warn").sort((a, b) => rank[a.sev] - rank[b.sev]);
  });

  const gaps = nodes.claude.allGaps.filter((g) => g.sev === "bad" || g.sev === "warn").sort((a, b) => (a.sev === b.sev ? 0 : a.sev === "bad" ? -1 : 1));
  const totals = {
    brands: brandList.length, clients: clients.length, agents: registry.length, live: registry.filter((a) => a.status === "live").length,
    broken: registry.filter((a) => a.status === "broken").length, runs24: runs24.length, jobs: openJobs.length, gaps: gaps.length, bad: gaps.filter((g) => g.sev === "bad").length,
  };
  Object.assign(nodes.hub, { totals });

  // The workflow lane: Claude -> agent -> department -> client deliverable, newest first.
  const clientName = Object.fromEntries(clients.map((c) => [c.id, c.business]));
  const flows = [
    ...openJobs.filter((j) => j.client_id && clientName[j.client_id]).slice(0, 4).map((j) => ({ id: `job:${j.id}`, live: true, by: "Claude", dept: JOB_DEPT[j.kind] || null, clientId: j.client_id, client: clientName[j.client_id], title: s(j.title), at: j.started_at || j.requested_at, state: j.status })),
    ...work.filter((w) => w.client_id && clientName[w.client_id]).slice().sort((a, b) => s(b.date || b.created_date).localeCompare(s(a.date || a.created_date))).slice(0, 10)
      .map((w) => ({ id: `work:${w.id}`, live: false, by: w.source === "automation" ? "Automation" : "Claude", dept: WORK_DEPT[w.kind] || null, clientId: w.client_id, client: clientName[w.client_id], title: s(w.title), at: w.date || w.created_date, state: "delivered" })),
  ].map((f) => {
    const ag = (agentsBy[f.clientId] || []).find((a) => a.department === f.dept && a.status === "live");
    return { ...f, agent: ag ? ag.name : null, agentKey: ag ? ag.key : null, deptLabel: (CLIENT_DEPTS.find((x) => x.key === f.dept) || {}).label || "Delivery" };
  });

  return { nodes, gaps, totals, flows, root };
}

// Path of ids from the top down to id.
export function pathTo(nodes, id) {
  const out = [];
  let cur = nodes[id];
  while (cur) { out.unshift(cur.id); cur = cur.parent ? nodes[cur.parent] : null; }
  return out;
}

// Search index: brands, clients, departments and agents.
export function searchIndex(nodes) {
  const out = [];
  Object.values(nodes).forEach((n) => {
    if (n.type === "brand") out.push({ id: n.id, node: n.id, label: n.label, sub: `Brand · ${n.sub || ""}`, type: "brand" });
    if (n.type === "client") out.push({ id: n.id, node: n.id, label: n.label, sub: `Client · ${n.sub || ""}`, type: "client" });
    if (n.type === "group") out.push({ id: n.id, node: n.id, label: n.label, sub: `${n.count} clients · ${nodes[n.parent] ? nodes[n.parent].label : ""}`, type: "group" });
    if (n.type === "dept") {
      const owner = n.hq ? "HQ" : (nodes[`client:${n.clientId}`] || {}).label || "";
      (n.agents || []).forEach((a) => out.push({ id: `agent:${a.key}`, node: n.id, agentKey: a.key, label: a.name, sub: `Agent · ${n.label} · ${owner}`, type: "agent" }));
    }
  });
  return out;
}

export function searchUniverse(index, q, limit = 8) {
  const t = s(q).toLowerCase();
  if (!t) return [];
  const score = (r) => { const l = r.label.toLowerCase(); return l.startsWith(t) ? 0 : l.includes(t) ? 1 : r.sub.toLowerCase().includes(t) ? 2 : 9; };
  return index.map((r) => [score(r), r]).filter(([sc]) => sc < 9).sort((a, b) => a[0] - b[0] || a[1].label.localeCompare(b[1].label)).slice(0, limit).map(([, r]) => r);
}
