// Constellation v2 ("the whole ship"): pure functions only, so the hierarchy, the flow directions and the
// activity-to-orb mapping are unit tested (tests/unit/shipGraph.test.js).
//
// Flow, left to right:  Claude core  ->  Møthership brain  ->  departments  ->  clients  ->  client agents / apps
// Inbound:              research lanes (Search Intel, Future Oracle, Idea Vault, client research, learnings) -> brain
// Outbound ideas:       brain -> "ideas waiting" card, and research department -> clients with new research
// Returning results:    every edge also carries a "back" stream (work done, learnings) toward the brain.
import { INTERSTELLAR_DEPTS } from "../defs";

export const TZ = "America/Los_Angeles";

// Neon on black, anchored on the Interstellar flame. Each stream has its own hue so direction reads at a glance.
export const COLORS = {
  claude: "#ffb27a", // Claude core: warm white-amber
  brain: "#b18cff", // Møthership brain: violet
  intel: "#38c8ff", // research flooding in: cyan
  command: "#ff6a00", // orders going out: flame
  result: "#2ee6c5", // results and learning coming back: teal
  idea: "#ffc23d", // ideas going out: gold
  broken: "#ff4433",
};
const CLIENT_HUES = ["#ff6a00", "#38c8ff", "#b18cff", "#2ee6c5", "#ffc23d", "#ff5fa2", "#7cf07a", "#5b8cff"];

// Client agent departments roll up to the Møthership department that commands them.
export const CLIENT_TO_HQ = {
  research: "research", seo: "marketing", social: "marketing", ads: "marketing", email: "marketing",
  reviews: "success", reporting: "success", website: "delivery", ops: "delivery", brain: "command", ceo: "command",
};
// Work ledger categories roll up the same way (for results flowing back).
export const CATEGORY_TO_HQ = {
  website: "delivery", app_build: "delivery", brand: "delivery", ops: "delivery",
  seo: "marketing", content: "marketing", gbp: "marketing", citations: "marketing", social: "marketing", email: "marketing", ads: "marketing",
  research: "research", security: "systems", billing: "backoffice",
};

export const LANES = [
  { key: "search_intel", label: "Search Intel", sub: "SEO · AIO · GEO · AEO changes", path: "/packages/orbit-seo" },
  { key: "oracle", label: "Future Oracle", sub: "Industry & market waves", path: "/intelligence" },
  { key: "ideas", label: "Idea Vault", sub: "Ideas, scored", path: "/idea-vault" },
  { key: "research", label: "Client research", sub: "Competitors & search, per client", path: null },
  { key: "learnings", label: "Agent learnings", sub: "What runs taught us", path: null },
];

// ---------------------------------------------------------------- time
const arr = (v) => (Array.isArray(v) ? v : []);
// created_date comes back without a zone ("2026-11-13T02:26:23.913000"): it is UTC.
export function ts(v) {
  if (!v) return NaN;
  let s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += "T12:00:00Z";
  else if (/T\d{2}:\d{2}/.test(s) && !/(Z|[+-]\d{2}:?\d{2})$/.test(s)) s += "Z";
  return Date.parse(s);
}
function tzOffsetMs(t, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(t / 1000) * 1000;
}
// Start of "today" in Justin's time zone, as epoch ms.
export function dayStart(now = new Date(), tz = TZ) {
  const t = now.getTime();
  const local = new Date(t + tzOffsetMs(t, tz));
  const mid = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return mid - tzOffsetMs(mid, tz);
}
const since = (v, from) => { const t = ts(v); return Number.isFinite(t) && t >= from; };

// When each record "happened".
export const when = {
  run: (r) => r.started_at || r.finished_at || r.created_date,
  work: (w) => w.completed_at || w.created_date,
  job: (j) => j.finished_at || j.started_at || j.requested_at || j.created_date,
  research: (n) => n.created_at || n.created_date,
  learning: (l) => l.created_date || l.date,
  intel: (s) => s.created_date || s.brief_date,
  oracle: (o) => o.created_at || o.scanned_at || o.created_date || o.date,
  idea: (i) => i.created_date || i.date,
  fact: (f) => f.created_date || f.date,
};

// ---------------------------------------------------------------- activity -> motion
// Orbs per second on one stream. Always a calm ambient baseline so the ship never looks dead; grows with the log of real
// activity so one busy workflow (hundreds of runs) can't drown every other path.
export function orbRate(count, { base = 0.12, k = 0.32, max = 2.2 } = {}) {
  const c = Math.max(0, Number(count) || 0);
  return Math.min(max, base + k * Math.log1p(c));
}
// 0.35 (quiet) .. 1 (busy): line + orb brightness.
export function orbGlow(count) {
  const c = Math.max(0, Number(count) || 0);
  return 0.35 + 0.65 * Math.min(1, Math.log1p(c) / Math.log1p(40));
}
const stream = (count, opts) => ({ count: Math.max(0, Number(count) || 0), rate: orbRate(count, opts), glow: orbGlow(count) });

// ---------------------------------------------------------------- matching
// Same rule as the classic AgentPanel: a run belongs to an agent by name / run_match, scoped to the client for instances;
// client app workflows also match on their workflow id.
export function runMatchesAgent(run, a) {
  if (!run || !a) return false;
  if (a.kind === "client_app_workflow" && a.external_id && run.automation_id && String(run.automation_id) === String(a.external_id)) return true;
  const names = new Set([...(arr(a.run_match)), a.name].filter(Boolean).map((s) => String(s).toLowerCase()));
  if (!names.has(String(run.automation_name || "").toLowerCase())) return false;
  return a.scope === "client" && a.client_id ? run.client_id === a.client_id : true;
}
export function agentForRun(run, agents) {
  return arr(agents).find((a) => runMatchesAgent(run, a)) || null;
}
// Which Møthership department owns an agent (client instances roll up).
export const hqDeptOf = (a) => (!a ? null : a.scope === "client" ? CLIENT_TO_HQ[a.department] || "delivery" : a.department);

const statusRank = { broken: 4, live: 3, paused: 2, planned: 1 };
const rollStatus = (list) => arr(list).reduce((best, a) => ((statusRank[a.status] || 0) > (statusRank[best] || 0) ? a.status : best), "planned");
const maxIso = (list) => arr(list).filter(Boolean).sort((x, y) => ts(y) - ts(x))[0] || null;
const hashHue = (id) => CLIENT_HUES[[...String(id)].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7) % CLIENT_HUES.length];

// ---------------------------------------------------------------- the ship
// data: { registry, runs, jobs, work, research, learnings, intel, findings, opps, ideas, actions, facts, brains, clients, dossiers, brief, usage }
export function buildShip(data, { now = new Date(), focus = "" } = {}) {
  const d = data || {};
  const today = dayStart(now);
  const week = now.getTime() - 7 * 864e5;
  const registry = arr(d.registry).filter((a) => a.scope !== "template");
  const hq = registry.filter((a) => a.scope === "interstellar");
  const inst = registry.filter((a) => a.scope === "client");
  const runsToday = arr(d.runs).filter((r) => since(when.run(r), today));
  const workToday = arr(d.work).filter((w) => w.status === "done" && since(when.work(w), today));
  const jobsToday = arr(d.jobs).filter((j) => since(j.finished_at, today));
  const researchToday = arr(d.research).filter((n) => since(when.research(n), today));
  const clientsById = Object.fromEntries(arr(d.clients).map((c) => [c.id, c]));

  // Per-agent "ran today": matched runs, or at least 1 when last_run_at is today (Claude tasks report that way).
  const agentRunsToday = (a) => Math.max(runsToday.filter((r) => runMatchesAgent(r, a)).length, since(a.last_run_at, today) ? 1 : 0);
  const workDept = (w) => {
    const a = w.agent_key ? registry.find((x) => x.key === w.agent_key || x.template_key === w.agent_key) : null;
    return (a && hqDeptOf(a)) || CATEGORY_TO_HQ[w.category] || "delivery";
  };

  // ---- summary
  const live = registry.filter((a) => a.status === "live");
  const clientsServed = new Set(inst.filter((a) => a.status === "live" && clientsById[a.client_id]).map((a) => a.client_id));
  const ideasWaiting =
    arr(d.research).filter((n) => n.status === "new").length +
    arr(d.intel).filter((s) => s.status === "proposed").length +
    arr(d.opps).filter((o) => o.status === "new").length +
    arr(d.ideas).filter((i) => i.status === "New").length;
  const needsYou =
    arr(d.actions).filter((a) => a.status === "pending").length +
    arr(d.jobs).filter((j) => j.status === "needs_approval").length +
    arr(d.work).filter((w) => w.status === "awaiting_approval").length;
  const aiCallsToday = arr(d.usage).filter((u) => u.kind === "ai_action" && since(u.created_at || u.created_date, today)).reduce((s, u) => s + (Number(u.calls) || 1), 0);
  const claudeRunsToday = hq.filter((a) => a.kind === "claude_scheduled_task" && since(a.last_run_at, today)).length + jobsToday.length;
  const factsActive = arr(d.facts).filter((f) => f.status !== "superseded").length;
  const learned7d = arr(d.facts).filter((f) => since(when.fact(f), week)).length + arr(d.learnings).filter((l) => since(when.learning(l), week)).length;
  const eventsToday = runsToday.length + workToday.length + jobsToday.length + researchToday.length;
  const summary = { agentsLive: live.length, clientsServed: clientsServed.size, eventsToday, ideasWaiting, needsYou, aiCallsToday, claudeRunsToday, factsActive, learned7d, runsToday: runsToday.length, workToday: workToday.length };

  // ---- nodes
  const nodes = {};
  const edges = [];
  const add = (n) => { nodes[n.id] = n; return n; };
  const link = (from, to, kind, fwd, back, extra = {}) => edges.push({ id: `${from}>${to}`, from, to, kind, fwd, back, ...extra });

  const hqBrain = arr(d.brains).find((b) => b.scope === "interstellar") || null;
  const pillarScores = (d.brief && d.brief.pillar_scores) || {};
  add({ id: "claude", type: "claude", label: "Claude", sub: "The engine under everything", color: COLORS.claude, metrics: { aiCallsToday, claudeRunsToday, factsActive, learned7d } });
  add({ id: "brain", type: "brain", label: "Møthership Brain", sub: "Main brain of the ship", color: COLORS.brain, brain: hqBrain, metrics: { factsActive, completeness: hqBrain ? Math.round(hqBrain.completeness || 0) : null, pillars: pillarScores } });
  link("claude", "brain", "fuel", stream(aiCallsToday + claudeRunsToday), stream(learned7d, { base: 0.04 }), { color: COLORS.claude, backColor: COLORS.brain });

  // Research lanes flow in.
  const laneItems = {
    search_intel: arr(d.intel), oracle: [...arr(d.findings), ...arr(d.opps)], ideas: arr(d.ideas), research: arr(d.research), learnings: arr(d.learnings),
  };
  const laneWhen = { search_intel: when.intel, oracle: when.oracle, ideas: when.idea, research: when.research, learnings: when.learning };
  const laneWaiting = {
    search_intel: arr(d.intel).filter((s) => s.status === "proposed").length,
    oracle: arr(d.opps).filter((o) => o.status === "new").length,
    ideas: arr(d.ideas).filter((i) => i.status === "New").length,
    research: arr(d.research).filter((n) => n.status === "new").length,
    learnings: arr(d.learnings).filter((l) => l.status === "proposed").length,
  };
  LANES.forEach((L) => {
    const items = laneItems[L.key];
    const recent = items.filter((x) => since(laneWhen[L.key](x), week)).length;
    add({ id: `lane:${L.key}`, type: "lane", key: L.key, label: L.label, sub: L.sub, path: L.path, color: COLORS.intel, metrics: { total: items.length, week: recent, waiting: laneWaiting[L.key], last: maxIso(items.map(laneWhen[L.key])) } });
    link(`lane:${L.key}`, "brain", "intel", stream(recent), stream(0, { base: 0 }), { color: COLORS.intel });
  });
  add({ id: "ideas_out", type: "ideas", label: "Ideas & moves waiting", sub: "From research, for you to approve", color: COLORS.idea, metrics: { ideasWaiting, needsYou } });
  link("brain", "ideas_out", "ideas", stream(ideasWaiting, { base: 0.06 }), stream(0, { base: 0 }), { color: COLORS.idea });

  // Departments.
  INTERSTELLAR_DEPTS.forEach((dep) => {
    const agents = hq.filter((a) => a.department === dep.key);
    const fwd = agents.reduce((s, a) => s + agentRunsToday(a), 0);
    const back = workToday.filter((w) => (!w.client_id || w.client_id === "agency") && workDept(w) === dep.key).length;
    const instCount = inst.filter((a) => hqDeptOf(a) === dep.key).length;
    add({
      id: `dept:${dep.key}`, type: "dept", key: dep.key, label: dep.label, code: dep.code, sub: dep.blurb, color: COLORS.command,
      status: agents.length ? rollStatus(agents) : instCount ? "live" : "planned", agents,
      metrics: { agents: agents.length, live: agents.filter((a) => a.status === "live").length, planned: agents.filter((a) => a.status === "planned").length, broken: agents.filter((a) => a.status === "broken").length, runsToday: fwd, lastRun: maxIso(agents.map((a) => a.last_run_at)), clientAgents: instCount },
    });
    link("brain", `dept:${dep.key}`, "command", stream(fwd), stream(back, { base: 0.03 }), { color: COLORS.command, backColor: COLORS.result });
  });

  // Clients, their apps and their agents.
  const dossierBy = Object.fromEntries(arr(d.dossiers).map((x) => [x.client_id, x]));
  arr(d.clients).forEach((c, i) => {
    const mine = inst.filter((a) => a.client_id === c.id);
    const brain = arr(d.brains).find((b) => b.client_id === c.id) || null;
    const dossier = dossierBy[c.id] || null;
    const health = dossier && Number.isFinite(Number(dossier.health_score)) && dossier.health_score !== null ? Math.round(Number(dossier.health_score)) : brain ? Math.round(brain.completeness || 0) : null;
    const apps = [];
    if (c.site_app_id) apps.push({ id: c.site_app_id, label: "Website", kind: "site" });
    if (c.ops_app_id) apps.push({ id: c.ops_app_id, label: "Ops / Command app", kind: "ops" });
    mine.filter((a) => a.kind === "client_app_workflow" && a.owner_app_id).forEach((a) => {
      const hit = apps.find((x) => x.id === a.owner_app_id);
      if (hit) hit.label = a.owner_app || hit.label; else apps.push({ id: a.owner_app_id, label: a.owner_app || "Client app", kind: "app" });
    });
    const groups = [{ key: "mothership", label: "Run from Møthership", appId: null, agents: mine.filter((a) => a.kind !== "client_app_workflow") }];
    apps.forEach((app) => groups.push({ key: `app:${app.id}`, label: app.label, appId: app.id, appKind: app.kind, agents: mine.filter((a) => a.kind === "client_app_workflow" && a.owner_app_id === app.id) }));
    const cWorkToday = workToday.filter((w) => w.client_id === c.id);
    const cRuns = mine.reduce((s, a) => s + agentRunsToday(a), 0) + runsToday.filter((r) => r.client_id === c.id && !mine.some((a) => runMatchesAgent(r, a))).length;
    const newResearch = arr(d.research).filter((n) => n.client_id === c.id && n.status === "new").length;
    const accent = /^#[0-9a-f]{6}$/i.test(c.accent || "") ? c.accent : hashHue(c.id || i);
    const waiting = arr(d.jobs).filter((j) => j.client_id === c.id && j.status === "needs_approval").length + arr(d.work).filter((w) => w.client_id === c.id && w.status === "awaiting_approval").length;
    add({
      id: `client:${c.id}`, type: "client", clientId: c.id, label: c.business, sub: c.industry || c.domain || "", color: accent, logo: c.logo_url || null, client: c,
      status: mine.length ? rollStatus(mine) : "planned", apps, groups, health, brain,
      metrics: { agents: mine.length, live: mine.filter((a) => a.status === "live").length, inApp: mine.filter((a) => a.kind === "client_app_workflow").length, runsToday: cRuns, workToday: cWorkToday.length, newResearch, waiting, lastRun: maxIso(mine.map((a) => a.last_run_at)) },
    });
    // Department -> client: one edge per Møthership department that commands at least one of this client's agents.
    const byDept = {};
    mine.forEach((a) => { const k = hqDeptOf(a); (byDept[k] ||= []).push(a); });
    Object.entries(byDept).forEach(([k, list]) => {
      if (!nodes[`dept:${k}`] || list.every((a) => a.status === "planned")) return;
      const fwd = list.reduce((s, a) => s + agentRunsToday(a), 0);
      const back = cWorkToday.filter((w) => workDept(w) === k).length;
      link(`dept:${k}`, `client:${c.id}`, "serve", stream(fwd), stream(back, { base: 0.03 }), {
        color: COLORS.command, backColor: COLORS.result, idea: k === "research" && newResearch ? stream(newResearch, { base: 0.05 }) : null, agents: list.length,
      });
    });
    // Client -> its agents (collapsed cluster, or one card per app / group when the client is in focus).
    const expanded = focus === `client:${c.id}`;
    if (!expanded) {
      add({ id: `cagents:${c.id}`, type: "cagents", clientId: c.id, label: `${mine.filter((a) => a.status === "live").length} live agents`, color: accent, agents: mine, apps, metrics: { inApp: mine.filter((a) => a.kind === "client_app_workflow").length } });
      link(`client:${c.id}`, `cagents:${c.id}`, "app", stream(cRuns), stream(cWorkToday.length, { base: 0.03 }), { color: accent, backColor: COLORS.result });
    } else {
      groups.forEach((g) => {
        if (!g.agents.length && g.key === "mothership") return;
        const gid = `cgroup:${c.id}:${g.key}`;
        const gRuns = g.agents.reduce((s, a) => s + agentRunsToday(a), 0);
        add({ id: gid, type: "cgroup", clientId: c.id, label: g.label, appId: g.appId, appKind: g.appKind || null, color: accent, agents: g.agents, status: g.agents.length ? rollStatus(g.agents) : "planned", metrics: { agents: g.agents.length, runsToday: gRuns, synced: maxIso(g.agents.map((a) => a.synced_at)) } });
        link(`client:${c.id}`, gid, "app", stream(gRuns), stream(g.key === "mothership" ? cWorkToday.length : 0, { base: 0.03 }), { color: accent, backColor: COLORS.result });
      });
    }
  });

  return { summary, nodes, edges, focus };
}

// ---------------------------------------------------------------- hierarchy + filters
// Parent chain for breadcrumbs: agent -> dept / client group -> client.
export function breadcrumb(ship, sel, registry) {
  const out = [{ id: "", label: "Whole ship" }];
  if (!sel) return out;
  const n = ship.nodes[sel];
  if (sel.startsWith("agent:")) {
    const a = arr(registry).find((x) => x.key === sel.slice(6));
    if (!a) return out;
    if (a.scope === "client") {
      const c = ship.nodes[`client:${a.client_id}`];
      if (c) out.push({ id: c.id, label: c.label });
      if (a.kind === "client_app_workflow" && a.owner_app) out.push({ id: `cgroup:${a.client_id}:app:${a.owner_app_id}`, label: a.owner_app });
    } else {
      const dep = ship.nodes[`dept:${a.department}`];
      if (dep) out.push({ id: dep.id, label: dep.label });
    }
    out.push({ id: sel, label: a.name });
    return out;
  }
  if (!n) return out;
  if (n.type === "cgroup" || n.type === "cagents") { const c = ship.nodes[`client:${n.clientId}`]; if (c) out.push({ id: c.id, label: c.label }); }
  out.push({ id: n.id, label: n.label });
  return out;
}

// Which nodes stay lit for a search / filter. Core, brain and lanes always stay lit.
export function litNodes(ship, registry, { q = "", client = "", dept = "", status = "" } = {}) {
  const query = String(q).trim().toLowerCase();
  if (!query && !client && !dept && !status) return null;
  const lit = new Set(["claude", "brain", "ideas_out", ...Object.keys(ship.nodes).filter((k) => k.startsWith("lane:"))]);
  const agentOk = (a) => (!status || a.status === status) && (!query || `${a.name} ${a.role || ""} ${a.branch || ""} ${a.client_name || ""} ${a.owner_app || ""}`.toLowerCase().includes(query));
  Object.values(ship.nodes).forEach((n) => {
    if (n.type === "dept") {
      if (client || (dept && n.key !== dept)) return;
      if (n.agents.some(agentOk) || (!status && query && n.label.toLowerCase().includes(query)) || (!query && !status)) lit.add(n.id);
    }
    if (n.type === "client") {
      if (client && n.clientId !== client) return;
      const mine = arr(registry).filter((a) => a.scope === "client" && a.client_id === n.clientId && (!dept || hqDeptOf(a) === dept));
      if ((dept || status || query) && !mine.some(agentOk) && !(query && !status && n.label.toLowerCase().includes(query))) return;
      lit.add(n.id);
      Object.values(ship.nodes).filter((x) => x.clientId === n.clientId && x.type !== "client").forEach((x) => lit.add(x.id));
      ship.edges.filter((e) => e.to === n.id).forEach((e) => { if (!dept || e.from === `dept:${dept}`) lit.add(e.from); });
    }
  });
  return lit;
}

// ---------------------------------------------------------------- live events
export const recordPath = (entity, id, rec = {}) => {
  switch (entity) {
    case "ClaudeJob": return `/claude?job=${id}`;
    case "WorkEntry": return `/output-analytics?entry=${id}`;
    case "ProposedAction": return `/?card=${id}`;
    case "ResearchNote": return `/agents?note=${id}`;
    case "AutomationRun": return "/automations";
    case "SeoIntel": return "/packages/orbit-seo";
    case "OracleFinding": case "OracleOpportunity": return "/intelligence";
    case "Idea": return "/idea-vault";
    case "CRMClient": return `/clients/${id}`;
    case "BrainFact": return "/brain";
    case "AgentLearning": return rec.link || "/agents?v=classic";
    default: return "/";
  }
};

// Every record that moves through the ship, newest first, with its type.
export function eventsOf(data, { from = 0 } = {}) {
  const d = data || {};
  const out = [];
  const push = (type, entity, list, at, label) => arr(list).forEach((r) => { const t = ts(at(r)); if (Number.isFinite(t) && t >= from) out.push({ key: `${entity}:${r.id}`, type, entity, id: r.id, at: t, label: label(r), rec: r }); });
  push("run", "AutomationRun", d.runs, when.run, (r) => `${r.automation_name || r.title || "Run"}${r.client_name ? ` · ${r.client_name}` : ""}${r.status === "failed" ? " · failed" : ""}`);
  push("work", "WorkEntry", arr(d.work).filter((w) => w.status === "done" || w.status === "awaiting_approval"), when.work, (w) => `${w.title || "Work"}${w.client_name && w.client_id !== "agency" ? ` · ${w.client_name}` : ""}`);
  push("job", "ClaudeJob", d.jobs, when.job, (j) => `${j.title || "Claude job"} · ${String(j.status || "").replace(/_/g, " ")}`);
  push("research", "ResearchNote", d.research, when.research, (n) => `${n.topic || n.summary || "Research"}${n.client_name ? ` · ${n.client_name}` : ""}`);
  return out.sort((a, b) => b.at - a.at);
}

// Events not seen before (by key).
export function freshEvents(seen, events) {
  return arr(events).filter((e) => !seen.has(e.key));
}

// The true path a record took through the ship, as node ids in flow order, trimmed to edges that exist.
// dir "fwd": orders and research flowing out; "back": results flowing home to the brain.
export function eventPath(evt, ship, registry) {
  if (!evt || !ship) return null;
  const r = evt.rec || {};
  const clientId = r.client_id && r.client_id !== "agency" && ship.nodes[`client:${r.client_id}`] ? r.client_id : null;
  const tail = (dept) => {
    const p = [`dept:${dept}`];
    if (clientId) {
      p.push(`client:${clientId}`);
      const agent = evt.agent;
      if (ship.nodes[`cagents:${clientId}`]) p.push(`cagents:${clientId}`);
      else if (agent && agent.kind === "client_app_workflow" && ship.nodes[`cgroup:${clientId}:app:${agent.owner_app_id}`]) p.push(`cgroup:${clientId}:app:${agent.owner_app_id}`);
      else if (ship.nodes[`cgroup:${clientId}:mothership`]) p.push(`cgroup:${clientId}:mothership`);
    }
    return p;
  };
  let nodesInOrder;
  let dir = "fwd";
  let color = COLORS.command;
  if (evt.type === "run") {
    const a = agentForRun(r, registry);
    evt.agent = a;
    const dept = hqDeptOf(a) || (clientId ? "delivery" : "command");
    nodesInOrder = ["claude", "brain", ...tail(dept)];
    if (r.status === "failed") color = COLORS.broken;
  } else if (evt.type === "job") {
    nodesInOrder = ["claude", "brain", ...tail(clientId ? "delivery" : "command")];
    color = COLORS.claude;
  } else if (evt.type === "research") {
    nodesInOrder = ["lane:research", "brain", ...(clientId ? tail("research") : [])];
    color = COLORS.intel;
  } else if (evt.type === "work") {
    const a = r.agent_key ? arr(registry).find((x) => x.key === r.agent_key) : null;
    evt.agent = a;
    const dept = hqDeptOf(a) || CATEGORY_TO_HQ[r.category] || "delivery";
    nodesInOrder = ["brain", ...tail(dept)].reverse(); // agents -> client -> dept -> brain
    dir = "back";
    color = COLORS.result;
  } else return null;
  // Keep the longest prefix where each hop is a real edge (either direction).
  const has = (a, b) => ship.edges.find((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));
  const hops = [];
  for (let i = 0; i < nodesInOrder.length - 1; i++) {
    const e = has(nodesInOrder[i], nodesInOrder[i + 1]);
    if (!e) break;
    hops.push({ edge: e.id, forward: e.from === nodesInOrder[i] });
  }
  if (!hops.length) return null;
  return { key: evt.key, nodes: nodesInOrder.slice(0, hops.length + 1), hops, dir, color, label: evt.label, href: recordPath(evt.entity, evt.id, r), at: evt.at };
}

// ---------------------------------------------------------------- panel content
// The last activities for a node, newest first (max n). Client nodes only ever see that client's records.
export function activitiesFor(nodeId, ship, data, registry, n = 10) {
  const d = data || {};
  const all = eventsOf(d);
  const node = ship.nodes[nodeId];
  let list = [];
  if (nodeId === "claude") list = all.filter((e) => e.type === "job" || (e.type === "run" && /claude|research|search|keyword|digest|queue/i.test(e.label)));
  else if (nodeId === "brain") {
    list = arr(d.facts).map((f) => ({ key: `BrainFact:${f.id}`, type: "fact", entity: "BrainFact", id: f.id, at: ts(when.fact(f)), label: f.statement || f.question || "Fact", rec: f })).filter((e) => Number.isFinite(e.at));
    list = [...list, ...all.filter((e) => e.type === "research")].sort((a, b) => b.at - a.at);
  } else if (nodeId.startsWith("lane:")) {
    const key = nodeId.slice(5);
    const map = { search_intel: ["SeoIntel", d.intel, when.intel, (x) => x.title], oracle: ["OracleFinding", [...arr(d.findings), ...arr(d.opps)], when.oracle, (x) => x.headline || x.title], ideas: ["Idea", d.ideas, when.idea, (x) => x.title], research: ["ResearchNote", d.research, when.research, (x) => `${x.topic || x.summary}${x.client_name ? ` · ${x.client_name}` : ""}`], learnings: ["AgentLearning", d.learnings, when.learning, (x) => x.learning] }[key];
    if (map) list = arr(map[1]).map((x) => ({ key: `${map[0]}:${x.id}`, type: key, entity: x.headline !== undefined && map[0] === "OracleFinding" ? "OracleFinding" : x.why_now !== undefined ? "OracleOpportunity" : map[0], id: x.id, at: ts(map[2](x)), label: map[3](x) || "Item", rec: x, status: x.status })).filter((e) => Number.isFinite(e.at)).sort((a, b) => b.at - a.at);
  } else if (node && node.type === "dept") {
    const agents = node.agents;
    list = all.filter((e) => (e.type === "run" && agents.some((a) => runMatchesAgent(e.rec, a))) || (e.type === "work" && (!e.rec.client_id || e.rec.client_id === "agency") && (agents.some((a) => a.key === e.rec.agent_key) || CATEGORY_TO_HQ[e.rec.category] === node.key)));
  } else if (node && (node.type === "client" || node.type === "cagents" || node.type === "cgroup")) {
    const cid = node.clientId;
    list = all.filter((e) => e.rec && e.rec.client_id === cid);
    if (node.type === "cgroup") list = list.filter((e) => e.type !== "run" || node.agents.some((a) => runMatchesAgent(e.rec, a)));
  } else if (nodeId.startsWith("agent:")) {
    const a = arr(registry).find((x) => x.key === nodeId.slice(6));
    if (a) list = all.filter((e) => (e.type === "run" && runMatchesAgent(e.rec, a)) || (e.type === "work" && e.rec.agent_key && (e.rec.agent_key === a.key || (a.template_key && e.rec.agent_key === a.template_key && e.rec.client_id === a.client_id))));
  } else if (nodeId === "ideas_out") {
    list = all.filter((e) => e.type === "research" && e.rec.status === "new");
  }
  return list.slice(0, n).map((e) => ({ ...e, href: recordPath(e.entity, e.id, e.rec) }));
}

// What a node is waiting on Justin for ("Needs you"), with deep links.
export function waitingFor(nodeId, ship, data, registry) {
  const d = data || {};
  const node = ship.nodes[nodeId];
  const item = (entity, r, label) => ({ key: `${entity}:${r.id}`, entity, id: r.id, label, href: recordPath(entity, r.id, r) });
  const jobs = arr(d.jobs).filter((j) => j.status === "needs_approval");
  const work = arr(d.work).filter((w) => w.status === "awaiting_approval");
  if (nodeId === "claude") return jobs.map((j) => item("ClaudeJob", j, j.title || "Claude job"));
  if (nodeId === "brain" || nodeId === "ideas_out") return [
    ...arr(d.actions).filter((a) => a.status === "pending").map((a) => item("ProposedAction", a, a.title || "Proposed move")),
    ...(nodeId === "ideas_out" ? arr(d.research).filter((n) => n.status === "new").map((n) => item("ResearchNote", n, `${n.topic || n.summary}${n.client_name ? ` · ${n.client_name}` : ""}`)) : []),
  ];
  if (nodeId.startsWith("lane:")) {
    const key = nodeId.slice(5);
    if (key === "research") return arr(d.research).filter((n) => n.status === "new").map((n) => item("ResearchNote", n, `${n.topic || n.summary}${n.client_name ? ` · ${n.client_name}` : ""}`));
    if (key === "search_intel") return arr(d.intel).filter((s) => s.status === "proposed").map((s) => item("SeoIntel", s, s.title));
    if (key === "oracle") return arr(d.opps).filter((o) => o.status === "new").map((o) => item("OracleOpportunity", o, o.title));
    if (key === "ideas") return arr(d.ideas).filter((i) => i.status === "New").map((i) => item("Idea", i, i.title));
    if (key === "learnings") return arr(d.learnings).filter((l) => l.status === "proposed").map((l) => item("AgentLearning", l, l.learning));
  }
  if (node && (node.type === "client" || node.type === "cagents" || node.type === "cgroup")) {
    const cid = node.clientId;
    return [...jobs.filter((j) => j.client_id === cid).map((j) => item("ClaudeJob", j, j.title)), ...work.filter((w) => w.client_id === cid).map((w) => item("WorkEntry", w, w.title)), ...arr(d.research).filter((n) => n.client_id === cid && n.status === "new").map((n) => item("ResearchNote", n, n.topic || n.summary))];
  }
  if (node && node.type === "dept") return work.filter((w) => (!w.client_id || w.client_id === "agency") && (node.agents.some((a) => a.key === w.agent_key) || CATEGORY_TO_HQ[w.category] === node.key)).map((w) => item("WorkEntry", w, w.title));
  if (nodeId.startsWith("agent:")) {
    const a = arr(registry).find((x) => x.key === nodeId.slice(6));
    if (!a) return [];
    return work.filter((w) => w.agent_key && (w.agent_key === a.key || (a.template_key && w.agent_key === a.template_key && w.client_id === a.client_id))).map((w) => item("WorkEntry", w, w.title));
  }
  return [];
}

export function summaryLine(s) {
  const p = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  return [
    `${p(s.agentsLive, "agent", "agents")} running for ${p(s.clientsServed, "client", "clients")}`,
    `${p(s.eventsToday, "event", "events")} today`,
    `${p(s.ideasWaiting, "idea", "ideas")} from research waiting`,
    s.needsYou ? `${s.needsYou} need you` : null,
  ].filter(Boolean).join(" · ");
}
