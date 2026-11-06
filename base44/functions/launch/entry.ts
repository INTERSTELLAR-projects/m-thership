// Road to Dec 31 (Møthership > Command > Road to Dec 31).
//   offers   {}            PUBLIC, read-only: the active public OfferCatalog rows (the one source of truth for packages,
//                          plans, prices, architectures, bonuses, guarantees, portal tools). Internal rows (public false)
//                          and rows pending Justin's approval are never returned. Safe for the website, portal and decks.
//   summary  {}            Admin: launch progress from LaunchItem (overall %, per workstream, Justin's open moves,
//                          blocking count, open questions) for Claude tasks and the Commander brief.
//   requeue_engines {}     Schedule (workflow "Engines — monthly re-queue") or admin: for every running EngineStart whose
//                          next_cycle_at has come, queue that client's next month (Topic Calendar + outreach research/
//                          drafts + social plan + review-request drafts; GBP posts recorded as waiting on Google API),
//                          then move next_cycle_at to the 1st of the following month. Idempotent per client per month.
//                          Only writes ClaudeJob / EngineStart / AutomationRun records; never sends or publishes.
// Never sends anything, never reads secrets.
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";

const arr = (v: any) => (Array.isArray(v) ? v : (v && v.items) || []);
const LAUNCH = "2026-12-31";
const OFFER_FIELDS = ["key", "kind", "name", "short", "price", "price_display", "billing", "payment_plan", "architecture", "architecture_version", "summary", "includes", "bonuses", "value", "terms", "requires", "applies_to", "sort", "effective_from"];

async function list(ent: any, q: any = {}, sort = "sort", limit = 500) {
  try { return arr(await ent.filter(q, sort, limit)); } catch { return []; }
}

function pick(row: any, fields: string[]) {
  const o: any = {};
  for (const f of fields) if (row[f] !== undefined && row[f] !== null && !(Array.isArray(row[f]) && !row[f].length)) o[f] = row[f];
  return o;
}

export function summarize(items: any[]) {
  const live = items.filter((i) => (i.lane || "launch") === "launch" && (i.kind || "gap") === "gap" && i.status !== "deferred");
  const w = (i: any) => Math.max(0.5, Number(i.effort_hours) || 1);
  const done = (i: any) => i.status === "done";
  const pct = (rows: any[]) => { const t = rows.reduce((n, i) => n + w(i), 0); return t ? Math.round((rows.filter(done).reduce((n, i) => n + w(i), 0) / t) * 100) : 0; };
  const streams: Record<string, any[]> = {};
  for (const i of live) { const k = String(i.workstream || "Other").startsWith("Client:") ? "Clients" : i.workstream || "Other"; (streams[k] = streams[k] || []).push(i); }
  const days = Math.max(0, Math.ceil((new Date(`${LAUNCH}T23:59:59-08:00`).getTime() - Date.now()) / 86400000));
  const open = live.filter((i) => !done(i));
  return {
    launch_date: LAUNCH,
    days_left: days,
    overall_pct: pct(live),
    items: live.length,
    open: open.length,
    blocking_open: open.filter((i) => i.blocking_launch).length,
    workstreams: Object.entries(streams).map(([name, rows]) => ({ name, pct: pct(rows), open: rows.filter((i) => !done(i)).length, total: rows.length })).sort((a, b) => a.pct - b.pct),
    justin_moves: open.filter((i) => i.owner === "justin").sort((a, b) => (Number(b.unblocks) || 0) - (Number(a.unblocks) || 0) || (Number(a.priority) || 3) - (Number(b.priority) || 3)).slice(0, 10).map((i) => ({ key: i.key, title: i.title, unblocks: i.unblocks || 0, week: i.week || null, blocking: !!i.blocking_launch })),
    claude_open: open.filter((i) => i.owner === "claude").length,
    client_open: open.filter((i) => i.owner === "client").length,
    questions_open: items.filter((i) => i.kind === "question" && !i.answer && i.status !== "done").map((i) => ({ key: i.key, title: i.title })),
  };
}

// ---------- Engines: monthly re-queue (mirrors src/features/launch/engine.js queueMonth) ----------
const RULES = [
  "Never read, print or store secret values (API keys, passwords, client logins).",
  "Never send an email, post to Google Business Profile or social media, charge a card or delete data. Public content is published only where the brief says it is pre-approved (blog posts from a Topic Calendar Justin approved); everything else is prepared and stops at needs_approval.",
  "Never record a blog post as published (WorkLog, calendar, report) until you have seen it on the client's live blog index.",
  "Client emails: write the subject and the HTML body as a code block in result_body. Never create or send Gmail drafts for client deliverables.",
  "Google Business Profile posts are OFF for every client until the Google Business Profile API is approved: do not write or queue GBP posts.",
  "Backlink and citation outreach is written from Justin Cowell (justin@interstellar-strategies.com) in a personal tone, on the client's behalf. Outreach emails are drafts until Justin approves each one; never send.",
  "SEO or search changes on a live site are proposals until Justin approves them.",
  "Brand gradient: #ff3c00 → #ff6a00 → #ffaa00. Never gold or yellow.",
  "Client grounding: before any client work, read the client's shared context block, BusinessBrain.context_md for that client_id in app 69d80bb06c5ad07a795df54e. It holds their goals and targets, offers, audience, voice and SEO footprint (keywords, city and service pages, GBP and reviews, citations, competitors, map pack). Make the work specific to that business and aimed at those goals.",
  "Do not invent time estimates, prices or numbers. If a fact is missing, list it under needs_from_justin.",
];
const laDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d);
const monthLabel = (key: string) => { const [y, m] = key.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 15)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }); };
const nextFirst = (key: string) => { const [y, m] = key.split("-").map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`; };
function blogsPerMonth(client: any) {
  const rows = Array.isArray(client.blogSchedule) ? client.blogSchedule : [];
  const mine = rows.filter((r: any) => { const mm = String(r.type || "").match(/\(([^)]+)\)/); return !mm || mm[1].trim().toLowerCase() === String(client.business || "").trim().toLowerCase(); });
  const n = mine.filter((r: any) => /blog/i.test(r.type || "")).reduce((s: number, r: any) => { const c = Number(r.count) || 0; return s + (String(r.frequency || "").toLowerCase().includes("week") ? Math.round(c * 4.33) : c); }, 0);
  return n || 4;
}
function calendarBrief(client: any, key: string, n: number) {
  return [
    `# Topic Calendar · ${client.business} · ${monthLabel(key)}`, "",
    `Propose ${n} long-form blog topics for ${client.business} for ${monthLabel(key)}. Justin approves this calendar once; after that every post drafts and publishes on its own, so get the topics right.`,
    "Use the client's ClientDossier keywords and service areas, the approved ContentPlan if one exists, its BusinessBrain, recent ResearchNotes for this client and the existing posts on its live blog (never repeat or near-duplicate a title, slug or angle).",
    "Each topic answers a real question buyers in their service area ask, down to the city, and supports SEO + AI answers (AIO/GEO/AEO).", "",
    "Write back:",
    `- result_data.topics = [{ title, slug, primary_keyword, intent (informational|commercial|local|comparison), city, angle, why, publish_on (YYYY-MM-DD in ${key}, weekdays, spread evenly) }] — exactly ${n} items.`,
    `- result_data.month = "${key}"`, "- result_body = a markdown table of the topics and one line on the month's theme.", "- result_summary = one sentence.",
    "Then status needs_approval. Do not draft or publish any post in this job.", "", "Standing rules:", ...RULES.map((r) => `- ${r}`),
  ].join("\n");
}
function streamBrief(client: any, k: string, month: string) {
  const head: Record<string, string> = {
    outreach: `Backlink and citation research for ${client.business} (${month}): find 10-20 qualified targets (directories, local news, associations, resource pages) matching their industry and service area and add them as OutreachTarget records (status discovered). Then write outreach drafts as OutreachMessage status draft, from Justin Cowell <justin@interstellar-strategies.com>: first person, personal tone, on the client's behalf, short, specific to the target, signed with the outreach_rules signature. Each draft waits for Justin's approval. Never send.`,
    social: `Build ${client.business}'s social plan for ${month} as a social-search strategist (posts found by each platform's search). Save as the result; it is saved hidden from the portal.`,
    reviews: `Prepare ${client.business}'s review requests for ${month}: list recent finished jobs or customers you can verify from their Command System or records, and draft the short request message (SMS + email) with their Google review link. Never send; never invent customers.`,
  };
  return [head[k], "", "GBP posts: off until the Google Business Profile API is approved.", "", "Standing rules:", ...RULES.map((r) => `- ${r}`)].join("\n");
}
async function requeueEngines(db: any, force = false) {
  const today = laDay();
  // Global hold (Justin, Nov 4, 2026): no recurring engine work until every client is launched. Missing record = ON.
  const hold = (await list(db.AppSettings, { key: "engines_hold" }, "-updated_date", 1))[0];
  if (!hold || hold.pageSettings?.on !== false) return { ran_at: new Date().toISOString(), today, held: true, results: [], note: "Engines on hold until all clients are launched (AppSettings engines_hold). Only Justin releases it." };
  const starts = await list(db.EngineStart, {}, "-started_at", 500);
  const latest = new Map<string, any>();
  for (const s of starts) if (!latest.has(s.client_id)) latest.set(s.client_id, s);
  const out: any[] = [];
  for (const s of latest.values()) {
    if (!["queued", "running"].includes(String(s.status || "queued"))) continue;
    if (!force && (!s.next_cycle_at || String(s.next_cycle_at) > today)) continue;
    const client = await db.CRMClient.get(s.client_id).catch(() => null);
    if (!client || client.status !== "Active" || client.plan_status === "inactive") { out.push({ client: s.client_name, skipped: "client inactive" }); continue; }
    const key = String(s.next_cycle_at || today).slice(0, 7);
    const existing = await list(db.ClaudeJob, { client_id: client.id, kind: "topic_calendar" }, "-created_date", 20);
    if (existing.some((j: any) => j.context?.month_key === key && !["cancelled", "failed"].includes(j.status))) { out.push({ client: client.business, skipped: `${key} already queued` }); }
    else {
      const now = new Date().toISOString();
      const month = monthLabel(key);
      const n = blogsPerMonth(client);
      const queued: any[] = [];
      const cal = await db.ClaudeJob.create({ title: `Topic Calendar · ${client.business} · ${month}`, kind: "topic_calendar", client_id: client.id, client_name: client.business, instructions: calendarBrief(client, key, n), status: "queued", priority: 2, requested_at: now, complete_task_on_approve: false, context: { month_key: key, engine_start_id: s.id, stream: "topic_calendar", n } });
      queued.push({ stream: "calendar", title: cal.title, job_id: cal.id, month_key: key });
      for (const [k, kind, label] of [["outreach", "research", "Backlink + citation research and outreach drafts"], ["social", "social_plan", "Social plan for the month"], ["reviews", "task", "Review requests"]]) {
        const title = `Engine · ${client.business} · ${label} · ${month}`;
        const j = await db.ClaudeJob.create({ title, kind, client_id: client.id, client_name: client.business, instructions: streamBrief(client, k, month), status: "queued", priority: 3, requested_at: now, complete_task_on_approve: false, context: { engine_start_id: s.id, stream: k, month, month_key: key } });
        queued.push({ stream: k, title, job_id: j.id, month_key: key });
      }
      queued.push({ stream: "gbp", title: `Google Business Profile posts · ${month}`, job_id: "", state: "waiting", how_it_executes: "Waiting on Google API", month_key: key });
      await db.EngineStart.update(s.id, { status: "running", queued: [...(s.queued || []), ...queued], queued_job_ids: [...(s.queued_job_ids || []), ...queued.map((q) => q.job_id).filter(Boolean)] });
      await db.AutomationRun.create({ automation_name: "Engines — monthly re-queue", kind: "other", client_id: client.id, client_name: client.business, status: "success", started_at: now, finished_at: new Date().toISOString(), processed: true, message: `notify: ${month} queued (Topic Calendar for ${n} posts + outreach, social, review requests). GBP waiting on Google API.` }).catch(() => null);
      out.push({ client: client.business, month: key, queued: queued.length });
    }
    await db.EngineStart.update(s.id, { next_cycle_at: nextFirst(key) });
  }
  return { ran_at: new Date().toISOString(), today, results: out };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : Object.fromEntries(new URL(req.url).searchParams);
    const action = String(body?.action || "offers");
    const db = base44.asServiceRole.entities;

    if (action === "offers") {
      const rows = await list(db.OfferCatalog, { public: true, status: "active" }, "sort", 300);
      const offers = rows.map((r: any) => pick(r, OFFER_FIELDS));
      return Response.json({ offers, count: offers.length, source: "Møthership OfferCatalog", fetched_at: new Date().toISOString() }, { headers: { "Cache-Control": "public, max-age=300" } });
    }

    const user = await base44.auth.me().catch(() => null);
    if (action === "requeue_engines") {
      // Safe without a user (scheduled workflow): it only queues internal jobs for engines Justin/Claude already started.
      if (user && user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
      return Response.json(await requeueEngines(db, !!user && body?.force === true));
    }
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    if (action === "summary") {
      const items = await list(db.LaunchItem, {}, "priority", 1000);
      return Response.json(summarize(items));
    }
    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    console.error("launch", e);
    return Response.json({ error: String((e as any)?.message || e) }, { status: 500 });
  }
});
