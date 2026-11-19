// Admin assistant ("Ask, tell, or say 'something came up'"): grounding + actions.
// Everything it says comes from records loaded here; anything it can't find it says it can't find (no guessing).
// Actions it can take on its own (internal, logged, undoable): create a lead, scrape a lead, queue a ClaudeJob
// (held for the Build Engine runner, like the Claude command box), move a lead's stage (with a reason, logged to
// LeadStageMove), add a task, open a page. Hard gates (publish/deploy, DNS, deleting data, money, emailing or texting
// real clients) are never done here: it says so and points to where Justin approves them.
import { automationIssue } from "./clientPillars.js";
import { laneForJob, laneForAction } from "./approvalLanes.js";
import { STAGES, STAGE_LABEL, stageOf, moveStage } from "./leadStage.ts";
import { runScrape } from "./leadScrape.ts";

const str = (v: unknown) => (v == null ? "" : String(v));
const arr = (v: any) => (Array.isArray(v) ? v : (v && v.items) || []);
const safe = (p: Promise<any>) => p.then(arr).catch(() => []);
const money = (n: number) => `$${Math.round(n || 0).toLocaleString("en-US")}`;
const norm = (v: unknown) => str(v).toLowerCase().replace(/[™®&'’.,!?:;()\-]/g, " ").replace(/\s+/g, " ").trim();
const OPEN_REQ = ["received", "in_progress", "needs_info"];
const BUILD_KINDS = ["lead_build", "build_website", "build_app"];
const HOLD = { held_for: "build_engine_step3" };

// Route map (docs/route-map.md): where things live after the Build Engine round. Used for "open …" / "where is …".
export const ROUTES: [string, string, string[]][] = [
  ["Command", "/", ["command", "home", "today", "dashboard"]],
  ["Clients", "/crm", ["clients", "client list"]],
  ["Pipeline", "/pipeline", ["pipeline", "leads", "lead board"]],
  ["Requests", "/requests", ["requests", "client requests"]],
  ["Service Process", "/flight-plan", ["service process", "onboarding", "flight plan"]],
  ["House of Brands", "/brands", ["house of brands", "brands"]],
  ["Brand numbers", "/brands?view=numbers", ["brand numbers"]],
  ["Messages", "/comms", ["messages", "inbox"]],
  ["Client posts", "/client-posts", ["client posts", "content pipeline"]],
  ["Claude", "/claude", ["claude", "claude queue", "jobs", "command box"]],
  ["Playbooks", "/playbooks", ["playbooks"]],
  ["Automations", "/automations", ["automations"]],
  ["Financial", "/financial", ["financial", "finance", "money"]],
  ["Client numbers", "/financial?tab=clients", ["client numbers"]],
  ["Stripe", "/financial?tab=stripe", ["stripe"]],
  ["Usage & cost", "/usage-cost", ["usage and cost", "usage cost", "credits", "cost"]],
  ["How you use Møthership", "/more/usage", ["how you use", "usage tracking", "my usage"]],
  ["Road to Dec 31", "/launch", ["road to dec 31", "launch", "launch list"]],
  ["Calls", "/calls", ["calls"]],
  ["Tasks", "/tasks", ["tasks", "to do"]],
  ["Settings", "/settings", ["settings"]],
];

export async function loadGround(db: any) {
  const [clients, brains, jobs, props, reqs, autos, catalog, meters, preps, taste] = await Promise.all([
    safe(db.CRMClient.list("business", 600)),
    safe(db.BusinessBrain.list("-updated_date", 600)),
    safe(db.ClaudeJob.list("-created_date", 300)),
    safe(db.ProposedAction.filter({ status: "pending" }, "-created_date", 200)),
    safe(db.ClientRequest.list("-created_date", 400)),
    safe(db.Automation.list("-updated_date", 500)),
    safe(db.AutomationCatalog.list("name", 300)),
    safe(db.UsageMeter.list("-recorded_at", 60)),
    safe(db.PrepChecklist.list("-updated_date", 200)),
    safe(db.AppSettings.filter({ key: "approval_taste_rule" }, "-updated_date", 1)),
  ]);
  const brainBy = new Map<string, any>();
  for (const b of brains) if (b.client_id && !brainBy.has(b.client_id)) brainBy.set(b.client_id, b);
  const now = Date.now();
  const mrrOf = (c: any) => {
    const lines = arr(c.services);
    const stripe = lines.filter((l: any) => l.stripe && ["active", "trialing"].includes(str(l.status || "active"))).reduce((t: number, l: any) => t + (Number(l.price) || 0), 0);
    let committed = lines.filter((l: any) => !l.stripe && l.interval !== "one_time" && l.interval !== "once" && !l.discontinued && !l.included && !["canceled", "cancelled", "ended", "not_started"].includes(str(l.status))).reduce((t: number, l: any) => t + (Number(l.price) || 0), 0);
    if (!committed && !stripe && c.deal_monthly && c.deal_monthly.plan !== "none") committed = Number(c.deal_monthly.amount) || 0;
    return { stripe, committed };
  };
  const live = clients.filter((c: any) => c.status !== "Inactive");
  const rows = live.map((c: any) => {
    const brain = brainBy.get(c.id);
    const myJobs = jobs.filter((j: any) => j.client_id === c.id);
    const build = myJobs.find((j: any) => BUILD_KINDS.includes(j.kind) && !["approved", "done", "cancelled"].includes(j.status));
    const held = (j: any) => j?.context?.held_for === HOLD.held_for && j.status === "queued";
    const prep = preps.find((p: any) => p.client_id === c.id && p.status === "active");
    const myAutos = autos.filter((a: any) => a.client_id === c.id);
    return {
      id: c.id, name: str(c.business), status: str(c.status), stage: c.status === "Lead" ? stageOf(c) : "", brand: str(c.brand_id) || "interstellar",
      brain: brain ? Number(brain.completeness) || 0 : null, open_questions: arr(brain?.open_questions).filter((q: any) => q.status !== "answered").length,
      mrr: mrrOf(c), deal: { one: Number(c.deal_one_time?.amount) || 0, one_status: str(c.deal_one_time?.status), monthly: Number(c.deal_monthly?.amount) || 0, plan: str(c.deal_monthly?.plan) },
      build: build ? (held(build) ? "build queued (held for the Build Engine runner)" : `build ${str(build.status).replace(/_/g, " ")}`) : "",
      prep_left: prep ? arr(prep.steps).filter((s: any) => !s.done).map((s: any) => str(s.label || s.title || s.key)).filter(Boolean) : [],
      jobs_open: myJobs.filter((j: any) => !["approved", "done", "cancelled"].includes(j.status)).map((j: any) => ({ title: str(j.title).slice(0, 80), status: held(j) ? "held" : str(j.status) })),
      requests: reqs.filter((r: any) => r.client_id === c.id && OPEN_REQ.includes(r.status)).map((r: any) => ({ title: str(r.title).slice(0, 80), status: str(r.status) })),
      automation_issues: myAutos.map((a: any) => ({ name: str(a.name), issue: automationIssue(a, now) })).filter((x: any) => x.issue).map((x: any) => `${x.name}: ${x.issue.reason}`),
      scrape: str(c.scrape_status), niche: str(c.niche_key),
    };
  });
  const lanes: Record<string, number> = { taste: 0, gate: 0, logic: 0 };
  for (const j of jobs) if (["needs_review", "needs_approval"].includes(j.status)) lanes[laneForJob(j)] = (lanes[laneForJob(j)] || 0) + 1;
  for (const p of props) lanes[laneForAction(p)] = (lanes[laneForAction(p)] || 0) + 1;
  const catalogIssues = catalog.filter((e: any) => e.enabled !== false && e.last_status === "failed").map((e: any) => `${e.name}: last run failed`);
  const meterBy = new Map<string, any>();
  for (const m of meters) if (!meterBy.has(m.kind)) meterBy.set(m.kind, m);
  return {
    at: new Date(now).toISOString(),
    clients: rows,
    stripeMrr: rows.filter((r: any) => r.status === "Active").reduce((t: number, r: any) => t + r.mrr.stripe, 0),
    committedMrr: rows.filter((r: any) => r.status === "Active").reduce((t: number, r: any) => t + r.mrr.committed, 0),
    lanes, pending: props.map((p: any) => ({ title: str(p.title).slice(0, 90), lane: laneForAction(p) })),
    reviewJobs: jobs.filter((j: any) => ["needs_review", "needs_approval"].includes(j.status)).map((j: any) => ({ title: str(j.title).slice(0, 90), client: str(j.client_name), lane: laneForJob(j) })),
    automationIssues: [...rows.flatMap((r: any) => r.automation_issues.map((x: string) => `${r.name} · ${x}`)), ...catalogIssues],
    meters: [...meterBy.values()].map((m: any) => ({ kind: str(m.kind), used: m.used, limit: m.limit, unit: str(m.unit), pct: m.pct_used, at: str(m.recorded_at).slice(0, 10) })),
    lastSweep: taste[0]?.value || null,
  };
}

export function groundBlock(g: any) {
  const lean = g.clients.map((c: any) => ({ id: c.id, name: c.name, status: c.status, stage: c.stage || undefined, brain: c.brain, mrr: c.mrr.stripe || undefined, committed: c.mrr.committed || undefined, build: c.build || undefined, requests: c.requests.length || undefined, issues: c.automation_issues.length || undefined }));
  return [
    "",
    "MØTHERSHIP FACTS (live records; the only facts you may use; if it isn't here say you don't see it):",
    `Stripe MRR (live subscriptions only): ${money(g.stripeMrr)}. Committed monthly not in Stripe yet: ${money(g.committedMrr)} (never add it to Stripe MRR).`,
    "Clients: " + JSON.stringify(lean),
    `Approvals waiting by lane: taste ${g.lanes.taste || 0}, hard gate ${g.lanes.gate || 0}, logic ${g.lanes.logic || 0} (logic is auto-approved by Justin's Nov 19 rule).`,
    "Automation problems: " + JSON.stringify(g.automationIssues.slice(0, 20)),
    "Usage meters: " + JSON.stringify(g.meters),
    "Pages: " + JSON.stringify(ROUTES.map(([n, p]) => `${n} ${p}`)),
  ].join("\n");
}

// ---------------------------------------------------------------- matching
const COMMON = new Set(["the", "and", "of", "co", "company", "llc", "inc", "services", "service", "group", "test", "studio", "strategies"]);
export function findClient(text: string, clients: any[]) {
  const t = ` ${norm(text)} `;
  let best: any = null, bestLen = 0;
  for (const c of clients) {
    const n = norm(c.name);
    if (!n) continue;
    const words = n.split(" ").filter((w) => !COMMON.has(w));
    const keys = [n, words.slice(0, 2).join(" "), words[0] && words[0].length >= 4 ? words[0] : ""].filter((k) => k && k.length >= 3);
    for (const k of keys) {
      if (t.includes(` ${k} `) && k.length > bestLen) { best = c; bestLen = k.length; }
    }
  }
  return best;
}
export function findRoute(text: string) {
  const t = norm(text);
  let best: any = null, len = 0;
  for (const [name, path, keys] of ROUTES) for (const k of [norm(name), ...keys.map(norm)]) if (k && t.includes(k) && k.length > len) { best = { name, path }; len = k.length; }
  return best;
}
const stageIn = (text: string) => {
  const t = norm(text);
  const pairs: [string, string][] = [["call booked", "call_booked"], ["call held", "call_held"], ["proposal sent", "proposal_sent"], ["proposal", "proposal_sent"], ["contacted", "contacted"], ["won", "won"], ["lost", "lost"], ["new", "new"]];
  for (const [k, v] of pairs) if (new RegExp(`\\b(to|into|as)\\s+${k}\\b`).test(t)) return v;
  return null;
};
const GATE_ASK = /^(please\s+)?(publish|deploy|go live|push live|change (the )?dns|point (the )?domain|delete|remove|purge|refund|charge|invoice|bill|cancel (the |their )?(subscription|plan)|email|text|sms|send(?!\s+to\s+claude))\b/i;

// ---------------------------------------------------------------- answers
function clientSummary(c: any) {
  const parts = [`${c.name}: ${c.status}${c.stage ? ` (${STAGE_LABEL[c.stage] || c.stage})` : ""}.`];
  parts.push(c.brain == null ? "No Brain yet." : `Brain ${c.brain}%${c.open_questions ? ` with ${c.open_questions} open question${c.open_questions === 1 ? "" : "s"}` : ""}.`);
  if (c.mrr.stripe || c.mrr.committed) parts.push(`MRR ${money(c.mrr.stripe)} in Stripe${c.mrr.committed ? `, plus ${money(c.mrr.committed)}/mo committed (not in Stripe yet)` : ""}.`);
  if (c.deal.one || c.deal.monthly) parts.push(`Deal: ${c.deal.one ? money(c.deal.one) + (c.deal.one_status ? ` (${c.deal.one_status})` : "") : ""}${c.deal.one && c.deal.monthly ? " + " : ""}${c.deal.monthly ? `${money(c.deal.monthly)}/mo` : ""}.`);
  if (c.build) parts.push(`Build: ${c.build}.`);
  if (c.requests.length) parts.push(`${c.requests.length} open request${c.requests.length === 1 ? "" : "s"}.`);
  if (c.automation_issues.length) parts.push(`Automations: ${c.automation_issues.slice(0, 2).join("; ")}.`);
  return parts.join(" ");
}
function whatsLeft(c: any) {
  const items: string[] = [];
  if (c.prep_left.length) items.push(`prep: ${c.prep_left.slice(0, 5).join(", ")}${c.prep_left.length > 5 ? ` (+${c.prep_left.length - 5})` : ""}`);
  if (c.build) items.push(c.build);
  for (const j of c.jobs_open.slice(0, 4)) items.push(`Claude job "${j.title}" (${j.status})`);
  for (const r of c.requests.slice(0, 4)) items.push(`request "${r.title}" (${r.status.replace(/_/g, " ")})`);
  if (c.open_questions) items.push(`${c.open_questions} Brain question${c.open_questions === 1 ? "" : "s"} to answer (Brain ${c.brain}%)`);
  for (const a of c.automation_issues.slice(0, 2)) items.push(a);
  return items.length ? `Left for ${c.name}: ${items.join("; ")}.` : `I don't see anything open for ${c.name}: no prep steps, builds, Claude jobs, requests or Brain questions waiting.`;
}
function needsToday(g: any) {
  const taste = g.pending.filter((p: any) => p.lane === "taste").length + g.reviewJobs.filter((j: any) => j.lane === "taste").length;
  const gate = g.pending.filter((p: any) => p.lane === "gate").length + g.reviewJobs.filter((j: any) => j.lane === "gate").length;
  const reqs = g.clients.reduce((t: number, c: any) => t + c.requests.filter((r: any) => r.status === "received").length, 0);
  const builds = g.clients.filter((c: any) => /needs review|needs approval/.test(c.build)).map((c: any) => c.name);
  const broken = g.automationIssues.filter((x: string) => /failed|late|never/i.test(x));
  const bits = [
    `${taste} taste approval${taste === 1 ? "" : "s"}`, `${gate} hard-gate item${gate === 1 ? "" : "s"}`, `${reqs} new client request${reqs === 1 ? "" : "s"}`,
    builds.length ? `builds waiting on you: ${builds.join(", ")}` : "no builds waiting on you",
    broken.length ? `${broken.length} broken automation${broken.length === 1 ? "" : "s"} (first: ${broken[0]})` : "no broken automations",
  ];
  return `Needs you today: ${bits.join("; ")}.`;
}

export type GroundOut = { reply: string; done: any[]; open?: { path: string; name: string } | null; kind: string; gated?: boolean } | null;

/**
 * Deterministic path: questions and actions it can answer from records alone. Returns null to let the LLM handle it
 * (with groundBlock appended). opts.testOnly: writes only touch leads whose name starts with "[TEST]".
 */
export async function handleGrounded(base44: any, db: any, text: string, g: any, opts: { by?: string; testOnly?: boolean } = {}): Promise<GroundOut> {
  const t = str(text).trim();
  const low = norm(t);
  const by = opts.by || "assistant";
  const writable = (c: any) => !opts.testOnly || /^\[TEST\]/.test(str(c?.name || c?.business));
  const audit = (row: any) => db.AgentAuditLog.create({ at: new Date().toISOString(), ok: true, actor: "assistant", ...row }).catch(() => null);

  // Hard gates: never act, say where Justin approves it.
  if (GATE_ASK.test(t)) {
    return { kind: "gate", gated: true, done: [], reply: "That's a hard gate (publishing, DNS, deleting data, money, or emailing/texting a real client), so I won't do it from here. Approve it yourself where it lives: drafts wait in Command › Needs you, publishing and DNS on Road to Dec 31, billing in Financial." };
  }

  // Create a lead: "add lead Acme Roofing acmeroofing.com"
  const lead = /^(?:add|new|create)\s+(?:a\s+)?lead:?\s+(.+)$/i.exec(t);
  if (lead) {
    const raw = lead[1].trim();
    const site = (/((?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\.?[a-z]{2,}(?:\/\S*)?)/i.exec(raw) || [])[1] || "";
    const name = raw.replace(site, "").replace(/[,;:]+\s*$/, "").replace(/\s+(at|website|site)\s*$/i, "").trim();
    if (!name) return { kind: "action", done: [], reply: "What's the business name?" };
    if (opts.testOnly && !/^\[TEST\]/.test(name)) return { kind: "action", done: [], reply: "Self-test mode: only [TEST] leads can be created." };
    const url = site ? (/^https?:\/\//.test(site) ? site : `https://${site}`) : "";
    const rec = await db.CRMClient.create({ business: name.slice(0, 120), status: "Lead", pipeline_stage: "new", websites: url ? [url] : [], domain: url ? url.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "", lead_source: "", scrape_status: "none", stage_changed_at: new Date().toISOString() });
    const log = await audit({ action: "lead_created", entity: "CRMClient", record_id: rec.id, summary: `Lead: ${name}`, undo: { entity: "CRMClient", id: rec.id, patch: { status: "Inactive" } } });
    return { kind: "action", done: [{ type: "lead", id: rec.id, label: `Lead added: ${name}`, audit_id: log?.id }], open: { path: `/pipeline?lead=${rec.id}`, name: "Pipeline" }, reply: `Added ${name} as a new lead${url ? ` (${url})` : ""}. Say "scrape ${name}" to research it.` };
  }

  const client = findClient(t, g.clients);

  // Scrape a lead
  if (/^(?:scrape|research)\b/i.test(t)) {
    if (!client) return { kind: "action", done: [], reply: "I don't see that lead. Which one should I scrape?" };
    if (!writable(client)) return { kind: "action", done: [], reply: "Self-test mode: only [TEST] leads can be scraped." };
    const rec = await db.CRMClient.get(client.id).catch(() => null);
    if (!rec) return { kind: "action", done: [], reply: `I can't load ${client.name}.` };
    const r = await runScrape(base44, rec);
    if (r?.error) return { kind: "action", done: [], reply: `The scrape for ${client.name} failed: ${r.error}` };
    return { kind: "action", done: [{ type: "scrape", id: client.id, label: `Scraped ${client.name}: Brain ${r.completeness}%` }], open: { path: `/clients/${client.id}`, name: client.name }, reply: `Scraped ${client.name}. Brain is now ${r.completeness}%, niche ${r.niche_key}. Filled: ${r.filled.join(", ") || "nothing new"}. Not found: ${r.not_found.join(", ") || "nothing"}.` };
  }

  // Move a lead's stage: "move Acme to call booked because …"
  if (/^(?:move|mark|set)\b/i.test(t) && stageIn(t)) {
    const to = stageIn(t) as string;
    if (!client) return { kind: "action", done: [], reply: "Which lead should I move?" };
    if (client.status !== "Lead" && to !== "won") return { kind: "action", done: [], reply: `${client.name} isn't a lead (status ${client.status}), so it has no pipeline stage to move.` };
    if (!writable(client)) return { kind: "action", done: [], reply: "Self-test mode: only [TEST] leads can be moved." };
    const reason = (/\b(?:because|since|reason:?)\s+(.+)$/i.exec(t) || [])[1] || `Asked in the assistant: "${t.slice(0, 120)}"`;
    let r: any;
    try { r = await moveStage(db, client.id, to, { by: "assistant", reason, source: "assistant", auto: true }); } catch (e) { return { kind: "action", done: [], reply: `Couldn't move ${client.name}: ${(e as Error).message}` }; }
    if (r?.unchanged) return { kind: "action", done: [], reply: `${client.name} is already at ${STAGE_LABEL[to]}.` };
    return { kind: "action", done: [{ type: "move", id: r?.move_id || client.id, move_id: r?.move_id, label: `${client.name} → ${STAGE_LABEL[to]}` }], reply: `Moved ${client.name} to ${STAGE_LABEL[to]} (logged with the reason, undo from the Pipeline toast or the card).` };
  }

  // Queue a Claude job: "send to claude: … for Acme" / "have claude …"
  const job = /^(?:send to claude|tell claude|have claude|ask claude|queue(?: a)?(?: claude)?(?: job)?)[:,]?\s+(.+)$/i.exec(t);
  if (job) {
    if (opts.testOnly && !(client && writable(client))) return { kind: "action", done: [], reply: "Self-test mode: Claude jobs only for [TEST] leads." };
    const instruction = job[1].trim();
    const rec = await db.ClaudeJob.create({ title: `${client ? client.name + ": " : ""}${instruction.slice(0, 90)}`, kind: "command", status: "queued", client_id: client?.id || "", client_name: client?.name || "", brand: client?.brand || "interstellar", instruction, instructions: instruction, priority: 3, requested_at: new Date().toISOString(), complete_task_on_approve: false, not_before: "2099-12-31", context: { ...HOLD, from: "assistant" } });
    const log = await audit({ action: "claude_job_queued", entity: "ClaudeJob", record_id: rec.id, summary: `Queued: ${instruction.slice(0, 120)}`, undo: { entity: "ClaudeJob", id: rec.id, patch: { status: "cancelled" } } });
    return { kind: "action", done: [{ type: "job", id: rec.id, label: `Queued for Claude: ${instruction.slice(0, 60)}`, audit_id: log?.id }], open: { path: "/claude", name: "Claude" }, reply: `Queued for Claude${client ? ` on ${client.name}` : ""}. It waits in the Claude list (held until the Build Engine runner is switched on).` };
  }

  // Open a page
  if (/^(?:open|go to|show me|take me to|where (?:is|are|do i find))\b/i.test(t)) {
    if (client && !/\b(pipeline|automations|requests|messages)\b/i.test(low)) return { kind: "open", done: [], open: { path: `/clients/${client.id}`, name: client.name }, reply: `Opening ${client.name}.` };
    const r = findRoute(t);
    if (r) return { kind: "open", done: [], open: r, reply: `${r.name} is at ${r.path}. Opening it.` };
    return { kind: "open", done: [], reply: "I don't know that page. Try Command, Clients, Pipeline, Claude, Automations or Financial." };
  }

  // Questions
  if (/needs? me|need me|needs? my|what needs|waiting on me|what do i (need|have) to do/.test(low)) return { kind: "answer", done: [], reply: needsToday(g) };
  if (/\b(what s|whats|what is) left\b|\bleft (for|on|to do)\b|\bremaining for\b/.test(low)) {
    if (!client) return { kind: "answer", done: [], reply: "Which client? I don't see one by that name." };
    return { kind: "answer", done: [], reply: whatsLeft(client) };
  }
  if (client && /\b(summar|tell me about|how is|how s|status|update on|where are we)\b/.test(low)) return { kind: "answer", done: [], reply: clientSummary(client) };
  if (client && /\bbrain\b/.test(low)) return { kind: "answer", done: [], reply: client.brain == null ? `${client.name} has no Brain yet.` : `${client.name}'s Brain is ${client.brain}%${client.open_questions ? `, with ${client.open_questions} open questions` : ""}.` };
  if (client && /\b(mrr|paying|revenue|deal|worth)\b/.test(low)) return { kind: "answer", done: [], reply: clientSummary(client) };
  if (/\b(mrr|monthly recurring|recurring revenue)\b/.test(low)) {
    const n = g.clients.filter((c: any) => c.status === "Active" && c.mrr.stripe > 0).length;
    return { kind: "answer", done: [], reply: `Stripe MRR is ${money(g.stripeMrr)} from ${n} paying client${n === 1 ? "" : "s"}. Separately, ${money(g.committedMrr)}/mo is committed but not in Stripe yet (not counted in MRR).` };
  }
  if (/\b(builds?|in progress)\b/.test(low) && !client) {
    const b = g.clients.filter((c: any) => c.build).map((c: any) => `${c.name} (${c.build})`);
    return { kind: "answer", done: [], reply: b.length ? `Builds: ${b.join("; ")}.` : "No builds in progress." };
  }
  if (/\b(automation|broken|failing|late blog)/.test(low)) {
    const list = client ? client.automation_issues : g.automationIssues;
    return { kind: "answer", done: [], reply: list.length ? `Automations needing attention${client ? ` for ${client.name}` : ""}: ${list.slice(0, 6).join("; ")}${list.length > 6 ? ` (+${list.length - 6} more)` : ""}.` : `No automation problems${client ? ` for ${client.name}` : ""} in the records.` };
  }
  if (/\b(approval|approve|taste|hard gate|decided for)\b/.test(low)) {
    const sw = g.lastSweep?.last || g.lastSweep?.first || null;
    return { kind: "answer", done: [], reply: `Waiting now: ${g.lanes.taste || 0} taste, ${g.lanes.gate || 0} hard-gate, ${g.lanes.logic || 0} logic (logic gets auto-approved on the next sweep).${sw?.approved != null ? ` Last sweep auto-approved ${sw.approved}.` : ""}` };
  }
  if (/\b(usage|credits?|cost|claude plan)\b/.test(low)) {
    return { kind: "answer", done: [], reply: g.meters.length ? `Latest meters: ${g.meters.map((m: any) => `${m.kind} ${m.pct != null ? `${Math.round(m.pct)}%` : `${m.used ?? "?"}/${m.limit ?? "?"} ${m.unit}`} (${m.at})`).join("; ")}.` : "No usage meter readings are recorded yet (Money › Usage & cost)." };
  }
  if (/\b(leads?|pipeline)\b/.test(low) && !client) {
    const leads = g.clients.filter((c: any) => c.status === "Lead");
    const by = STAGES.map((s) => [s, leads.filter((c: any) => c.stage === s).length]).filter(([, n]) => n).map(([s, n]) => `${STAGE_LABEL[s as string]} ${n}`);
    return { kind: "answer", done: [], reply: `${leads.length} open lead${leads.length === 1 ? "" : "s"}${by.length ? `: ${by.join(", ")}` : ""}.` };
  }
  if (/\brequests?\b/.test(low)) {
    const list = (client ? [client] : g.clients).filter((c: any) => c.requests.length).map((c: any) => `${c.name} ${c.requests.length}`);
    return { kind: "answer", done: [], reply: list.length ? `Open requests: ${list.join(", ")}.` : `No open requests${client ? ` for ${client.name}` : ""}.` };
  }
  if (/\bhow many clients\b|\bclient count\b/.test(low)) {
    const active = g.clients.filter((c: any) => c.status === "Active").length;
    return { kind: "answer", done: [], reply: `${active} active client${active === 1 ? "" : "s"} and ${g.clients.filter((c: any) => c.status === "Lead").length} leads.` };
  }
  if (client) return { kind: "answer", done: [], reply: clientSummary(client) };
  return null;
}
