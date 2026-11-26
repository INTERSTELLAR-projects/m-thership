// @ts-nocheck
// The client portal API (moved here from functions/portal/entry.ts in portal v2, Nov 2026, so the entry stays tiny).
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { requireSecondFactor } from "./twoFactor.ts";
import { BANNED as LEDGER_BANNED, isClientSafeUrl } from "./workLedger.ts";
import { workCounts } from "./workCounts.ts";
import { scorePillars, portalPillars } from "./clientPillars.js";
import { portalView } from "./buildTemplates.js";
import { submitTypesFor, checkSubmission, statusLabel, SUBMIT_TYPES, RECEIVED_TEXT } from "./submitTypes.js";
import { SEASON_PRESETS, cleanSeason, cleanOffer, offerLabel, todayPacific, autoSeason, offerLive } from "./siteExtras.js";
import { LEAD_ACTIONS, leadHome, leadTrack } from "./leadPortal.ts";
import { termsGate } from "./termsServer.ts";

// Portal v2 (Nov 2026): + needs_you / brain / health on home; actions brain + brain_answer.
// Client portal API. Every table is admin-only, so portal users never touch entities directly:
// this function finds the client their login belongs to and returns only that client's
// portal-visible records. Admins can pass client_id to preview any client's portal.

const liveSubscriptions = (c: Record<string, unknown>) => (Array.isArray(c.services) ? c.services : [])
  .filter((x: any) => x && x.stripe && ["active", "trialing"].includes(String(x.status || "")))
  .map((x: any) => ({ name: String(x.name || ""), monthly: Number(x.price) || 0, status: String(x.status), items: (Array.isArray(x.items) ? x.items : []).map((i: any) => String(i.name || "").replace(/^Interstellar[®™]?\s*/i, "")) }));
const SAFE_CLIENT = ["id", "business", "contact", "domain", "websites", "plan", "services_managed", "industry", "location", "logoUrl", "logo_url", "started_on", "studios"];
const pick = (o: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));
const visible = (r: Record<string, unknown>) => r.portal_visible !== false;
// Request types are configured once on the frontend (REQUEST_TYPES in src/features/requests/formSchema.js);
// here any slug is accepted so adding a type needs no backend change.
const reqKind = (k: unknown) => (/^[a-z][a-z0-9_]{1,39}$/.test(String(k || "")) ? String(k) : "other");
const isUrl = (u: unknown) => /^https?:\/\/\S+$/i.test(String(u || ""));

// ---- Site health: mirrors clientHealthSummary() in src/features/performance/policy.js exactly ----
// Clients never see a score below the floor, and never see raw audits or issues.
const CLIENT_SCORE_FLOOR = 70;
const EDIT_WORK_KINDS = ["site_edit", "schema", "new_page", "project_page", "search_console", "bing"];
const bandLabel = (score: number | null) => (score == null ? "No data" : score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 50 ? "Needs work" : "Poor");
type Row = Record<string, unknown>;

// The client's next open call prep (soonest upcoming, else the newest undated one) with only its shared questions.
async function nextCallFor(db: any, cid: string) {
  const rows = ((await db.CallPrep.filter({ client_id: cid }, "-created_date", 30).catch(() => [])) || []) as Row[];
  const now = Date.now() - 2 * 3600e3;
  const open = rows.filter((r) => r.status !== "done" && (!r.scheduled_for || Date.parse(String(r.scheduled_for)) >= now));
  open.sort((a, b) => (a.scheduled_for ? Date.parse(String(a.scheduled_for)) : 9e15) - (b.scheduled_for ? Date.parse(String(b.scheduled_for)) : 9e15));
  for (const r of open) {
    const qa = Array.isArray(r.qa) ? (r.qa as Row[]) : [];
    const questions = qa.map((x, i) => ({ i, q: String(x.q || ""), answer: String(x.client_answer || ""), share: x.share === true })).filter((x) => x.share && x.q).map(({ share: _s, ...x }) => x);
    if (questions.length) return { id: r.id, title: String(r.title || "Our next call"), scheduled_for: r.scheduled_for || null, questions };
  }
  return null;
}
function clientHealthSummary({ audits = [], fixes = [], work = [] }: { audits?: Row[]; fixes?: Row[]; work?: Row[] }) {
  const done = audits.filter((a) => typeof a.health_score === "number" && a.strategy !== "desktop")
    .sort((a, b) => String(a.run_at).localeCompare(String(b.run_at)));
  const latest = done[done.length - 1] || null;
  const score = (latest?.health_score as number | undefined) ?? null;
  const show = score != null && score >= CLIENT_SCORE_FLOOR;
  const fixesApplied = fixes.filter((f) => f.status === "applied" && f.portal_visible !== false).length;
  const edits = work.filter((w) => EDIT_WORK_KINDS.includes(String(w.kind)) && w.status !== "failed" && w.portal_visible !== false).length;
  return {
    score: show ? score : null,
    band: show ? bandLabel(score) : score != null ? "Improving" : null,
    trend: show ? done.filter((a) => (a.health_score as number) >= CLIENT_SCORE_FLOOR).slice(-12).map((a) => ({ date: String(a.run_at).slice(0, 10), score: a.health_score })) : [],
    fixes_applied: fixesApplied,
    edits_made: edits,
    last_checked: latest?.run_at || null,
  };
}

// Latest approved, portal-visible brand kit (the newest approved kit wins; if it is hidden, nothing shows).
const portalKit = (kits: Row[]) => {
  const k = kits.filter((x) => x.status === "approved").sort((a, b) => (Number(b.version) || 0) - (Number(a.version) || 0))[0];
  return k && k.portal_visible === true ? k : null;
};

// ---------------------------------------------------------------------------------------------------------------
// Portal v2 helpers: Business Brain, "What needs you" and business health. Client-safe fields only.
// ---------------------------------------------------------------------------------------------------------------
// Brain sections a client may read back (same list the Presentation Creator uses). Never billing, logins or notes.
const BRAIN_SECTIONS_FOR_CLIENT: Record<string, string> = { overview: "Your business", offer_pricing: "Offers & pricing", audience: "Your customers", brand: "Brand & voice" };
const isClosed = (x: Row) => ["answered", "closed", "dismissed", "resolved"].includes(String(x?.status || "").toLowerCase());
async function clientBrainRow(db: any, cid: string): Promise<Row | null> {
  const rows = ((await db.BusinessBrain.filter({ client_id: cid }, "-updated_date", 3).catch(() => [])) || []) as Row[];
  return rows.find((b) => b.scope !== "interstellar") || null;
}
async function brainFor(db: any, cid: string) {
  const [row, facts, dossier] = await Promise.all([
    clientBrainRow(db, cid),
    // Only the owner's own answers (synced from their Command System). Facts the team wrote about the client stay internal.
    db.BrainFact.filter({ client_id: cid, status: "active", source: "client_app" }, "-answered_at", 200).catch(() => []),
    db.ClientDossier.filter({ client_id: cid }, "-updated_date", 1).then((r: Row[]) => (r || [])[0] || null).catch(() => null),
  ]);
  const sections = (row?.sections || {}) as Record<string, Row>;
  const known = Object.entries(BRAIN_SECTIONS_FOR_CLIENT)
    .filter(([k]) => String(sections[k]?.text || "").trim())
    .map(([k, label]) => ({ key: k, label, text: String(sections[k].text).replace(/<!--[^>]*-->/g, "").slice(0, 1600), updated_at: sections[k].updated_at || null }));
  const own = ((facts || []) as Row[]).filter((f) => !(f.data as Row)?.test)
    .slice(0, 60).map((f) => ({ id: f.id, question: String(f.question || "").slice(0, 300), answer: String(f.statement || "").slice(0, 600), area: f.area || "other", at: f.answered_at || f.date || null }));
  const questions = (((row?.open_questions as Row[]) || []).filter((x) => x?.q && !isClosed(x))).slice(0, 25).map((x) => ({ q: String(x.q).slice(0, 600), section: x.section || "", added_at: x.added_at || null }));
  const stats = (dossier?.client_brain || null) as Row | null;
  // Progress toward "the more it knows, the more runs itself": the app's answered/total when a Command System syncs,
  // otherwise the brain's own completeness score. null = nothing to measure yet (designed empty state).
  const pct = stats && Number(stats.total) > 0 ? Math.round((Number(stats.answered) / Number(stats.total)) * 100)
    : typeof row?.completeness === "number" ? Math.max(0, Math.min(100, Math.round(row.completeness as number))) : null;
  return {
    exists: !!row || own.length > 0,
    pct,
    answered: stats ? Number(stats.answered) || 0 : null,
    total: stats ? Number(stats.total) || 0 : null,
    facts_count: own.length + known.length,
    sections: known,
    facts: own,
    questions,
  };
}

async function portalV2Extras(db: any, client: Row, cid: string, reqs: Row[], shown: Row[]) {
  const brain = await brainFor(db, cid).catch(() => null);
  // What needs you: questions from the brain, requests waiting on the owner's answer, payments due or late.
  const needsInfo = reqs.filter((r) => r.status === "needs_info").slice(0, 10).map((r) => ({ id: r.id, title: r.title, note: r.client_note || "", kind: r.kind }));
  const plans = ((await db.ClientFinancing.filter({ client_id: cid }, "-created_date", 20).catch(() => [])) || []) as Row[];
  const financing = plans.filter((p) => p.status === "active").map((p) => ({
    id: p.id, title: p.title, payment_amount: p.payment_amount, frequency: p.frequency, num_payments: p.num_payments, first_due_date: p.first_due_date,
    grace_days: p.grace_days, status: p.status, payments: ((p.payments as Row[]) || []).map((x) => ({ date: x.date, amount: x.amount })),
  }));
  // Business health: reviews from the cached Google profile (no live fetch here), listings work we finished, local
  // keywords being tracked, and whether a Command System is connected. Search numbers come from `snapshots`.
  const rc = ((await db.ReviewClient.filter({ crm_client_id: cid }).catch(() => [])) || []).filter((r: Row) => r.active !== false && r.slug) as Row[];
  const reviews = rc.map((r) => {
    const c = (r.cache || {}) as Row;
    const name = String(r.name || c.businessName || client.business || "");
    return { location: name.includes(" — ") ? name.split(" — ").slice(1).join(" — ") : name, rating: typeof c.rating === "number" ? c.rating : null, count: typeof c.total === "number" ? c.total : null, as_of: r.cached_at || null };
  });
  const mp = ((await db.MapPackPlan.filter({ client_id: cid }, "-updated_date", 1).catch(() => [])) || [])[0] as Row | undefined;
  const monthKey = new Date().toISOString().slice(0, 7);
  const cit = shown.filter((e) => e.category === "citations");
  return {
    brain: brain ? { exists: brain.exists, pct: brain.pct, facts_count: brain.facts_count, open: brain.questions.length } : null,
    needs_you: { questions: brain ? brain.questions.slice(0, 5) : [], requests: needsInfo, financing },
    health: {
      reviews,
      listings: { total: cit.length, this_month: cit.filter((e) => String(e.completed_at || "").slice(0, 7) === monthKey).length },
      local_keywords: mp && ["approved", "active", "live"].includes(String(mp.status)) ? ((mp.keywords as Row[]) || []).length : 0,
      command_system: { connected: !!String(client.command_app_id || "").trim(), revenue: null, leads: null },
    },
  };
}

export async function portalHandler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
    // Two-step verification: a portal login that turned it on gets nothing until this session passed it.
    const gate = await requireSecondFactor(base44, req, user);
    if (gate) return gate;
    const body = await req.json().catch(() => ({}));
    const { action = "home", client_id: asClient, ...args } = body || {};
    const db = base44.asServiceRole.entities;

    // Resolve the client this user may see.
    // Package-deal owners (one login in portal_emails of 2+ clients) may pass client_id to switch business;
    // the id is only honoured when this login is on THAT client's portal_emails (never trusted from the browser alone).
    let client: Record<string, unknown> | null = null;
    const lc = (v: unknown) => String(v || "").toLowerCase();
    const emailsOf = (c: Record<string, unknown>) => ((c.portal_emails as string[]) || []).map(lc).filter(Boolean);
    let mine: Record<string, unknown>[] = [];
    if (user.role === "admin" && asClient) {
      client = await db.CRMClient.get(asClient).catch(() => null);
    } else {
      const email = lc(user.email);
      const all = await db.CRMClient.filter({ portal_enabled: true }, "business", 500);
      mine = ((all || []) as Record<string, unknown>[]).filter((c) => emailsOf(c).includes(email));
      if (asClient) {
        client = mine.find((c) => c.id === String(asClient)) || null;
        // A stale saved choice on first load falls back to the login's first business; anything else is refused.
        if (!client && action === "home") client = mine[0] || null;
        else if (!client && mine.length) return Response.json({ error: "This login can't open that business.", code: "not_allowed" }, { status: 403 });
      } else client = mine[0] || null;
    }
    if (!client) return Response.json({ error: "No portal is set up for this login yet.", code: "no_client" }, { status: 403 });
    // Businesses this login (or, in admin preview, this client's portal logins) can switch between.
    const businessesFor = async () => {
      const keep = (c: Record<string, unknown>) => ({ id: c.id, business: c.business, logo_url: c.logo_url || c.logoUrl || "", accent: c.accent || "", ...(user.role === "admin" ? { portal_enabled: !!c.portal_enabled } : {}) });
      if (user.role !== "admin") return mine.map(keep);
      const em = emailsOf(client as Record<string, unknown>);
      if (!em.length) return [keep(client as Record<string, unknown>)];
      const all = ((await db.CRMClient.list("business", 500).catch(() => [])) || []) as Record<string, unknown>[];
      const linked = all.filter((c) => c.id === (client as Record<string, unknown>).id || emailsOf(c).some((e) => em.includes(e)));
      return linked.map(keep);
    };
    const cid = client.id as string;
    // Lead Engine two-tier portal: a lead-tier login sees only its own preview, Interstellar's packages and the
    // walkthrough booking. Every other action (work feed, requests, studios, messages, tools) is refused, for the
    // lead and for an admin previewing them. Data is scoped to this client_id only.
    if (client.portal_tier === "lead") {
      if (!LEAD_ACTIONS.includes(String(action))) return Response.json({ error: "This part of the portal opens once you're an Interstellar client.", code: "lead_tier" }, { status: 403 });
      if (action === "home") return Response.json(await leadHome(db, client, user));
      return Response.json(await leadTrack(db, client, user, args));
    }
    if (action === "lead_track") return Response.json({ ok: true, skipped: "client tier" });
    // Terms gate (docs/portal-terms.md): a client login that has not accepted the active Terms of Service for this
    // client gets nothing but the terms. No portal data is read before this line.
    if (user.role !== "admin") {
      const terms = await termsGate(db, user, client);
      if (terms) return Response.json(terms, { status: 428 });
    }
    // No active care plan (canceled / ended in Stripe): the portal shows a friendly "plan inactive, contact us"
    // screen. Only the home summary and messages (so they can reach us) stay open; their data is kept untouched.
    if (client.plan_status === "inactive") {
      const OPEN = ["home", "chats", "chat_messages", "chat_send", "messages", "send_message"];
      if (action === "home") {
        return Response.json({ plan_inactive: true, client: pick(client, ["id", "business", "logoUrl", "logo_url"]), businesses: [] });
      }
      if (!OPEN.includes(String(action)) && user.role !== "admin") {
        return Response.json({ error: "Your Interstellar plan is inactive. Message us and we'll get you back up and running.", code: "plan_inactive" }, { status: 403 });
      }
    }
    const by = (entity: string, sort = "-created_date", limit = 500) => db[entity].filter({ client_id: cid }, sort, limit).then((r: unknown[]) => r || []);

    // Chat helpers. Group membership lives on ChatThread.client_ids and is only ever checked here.
    const myGroups = async () => ((await db.ChatThread.filter({ kind: "group" }, "-last_message_at", 300).catch(() => [])) || [])
      .filter((g: Record<string, unknown>) => !g.archived && ((g.client_ids as string[]) || []).includes(cid)) as Record<string, unknown>[];
    const groupFor = async (id: string) => {
      const g = await db.ChatThread.get(id).catch(() => null);
      return g && g.kind === "group" && !g.archived && ((g.client_ids as string[]) || []).includes(cid) ? g as Record<string, unknown> : null;
    };
    const groupMsgs = async (gid: string) => ((await db.ConversationMessage.filter({ thread_id: gid }, "created_date", 500).catch(() => [])) || []) as Record<string, unknown>[];
    const groupUnreadCount = (ms: Record<string, unknown>[]) => ms.filter((m) => m.sender_client_id !== cid && !((m.read_by_client_ids as string[]) || []).includes(cid)).length;
    const senderOf = (c: Record<string, unknown>) => ({ id: c.id, name: c.business, logo_url: c.logo_url || "", martian_color: c.martian_color || "", accent: c.accent || "" });
    const chatOut = (m: Record<string, unknown>, sender: unknown) => ({
      id: m.id, content: m.content, sender_role: m.sender_role, at: m.created_date || m.timestamp,
      mine: m.sender_role === "client" ? (m.sender_client_id ? m.sender_client_id === cid : !m.thread_id) : user.role === "admin",
      sender,
    });

    if (action === "home") {
      const [work, autos, reqs, goals, gaps, snaps, tasks, files, audits, fixes, kits] = await Promise.all([
        by("WorkLog", "-date", 400), by("Automation"), by("ClientRequest"), by("ClientGoal", "sort"), by("ClientGap"),
        by("PerformanceSnapshot", "-period_end", 60), by("Task", "due_date", 200), by("ClientFile", "-delivered_on", 200),
        by("SiteAudit", "-run_at", 60).catch(() => []), by("SeoFix", "-updated_date", 500).catch(() => []), by("BrandKit", "-version", 20).catch(() => []),
      ]);
      const playbooks = await by("IndustryPlaybook", "-version", 20).catch(() => []);
      // Pillars (client-friendly): scored from the Brain and system signals only; "still learning" when there's not enough.
      const brainRow = ((await by("BusinessBrain", "-updated_date", 1).catch(() => [])) as Record<string, unknown>[])[0] || null;
      const pillars = portalPillars(scorePillars({ brain: brainRow, automations: autos as any[], gaps: gaps as any[], requests: reqs as any[], work: work as any[] }));
      // Live build (Build Engine): only the client-friendly checklist items, lit as they're ticked; plus the first
      // go-live dates so the portal can play the launch animation once.
      const checklistRow = ((await by("BuildChecklist", "-updated_date", 1).catch(() => [])) as Record<string, unknown>[])[0] || null;
      const build = { view: portalView(checklistRow as any), website_live_at: client.website_live_at || null, command_live_at: client.command_live_at || null };
      // Brain unlocks as progress: label + the client-facing line only (never what's missing in internal terms).
      const UNLOCK_ORDER = ["basics", "brand", "growth", "transmission"];
      const unlocks = ((await by("ClientUnlock", "key", 10).catch(() => [])) as Record<string, unknown>[])
        .filter((u) => UNLOCK_ORDER.includes(String(u.key)))
        .sort((a, b) => UNLOCK_ORDER.indexOf(String(a.key)) - UNLOCK_ORDER.indexOf(String(b.key)))
        .map((u) => ({ key: u.key, label: u.label, on: !!u.on, portal: String(u.portal || "") }));
      const msgs = await by("ConversationMessage", "-created_date", 200);
      // "Work we did": the work ledger's client-visible, finished rows, in client-safe team-voice copy only (never the
      // internal title, who or what did it, minutes, costs or evidence). Older WorkLog rows the ledger hasn't picked up
      // yet fill in, unless their title names internal tools.
      const ledger = (await by("WorkEntry", "-completed_at", 400).catch(() => [])) as Record<string, unknown>[];
      const covered = new Set(ledger.filter((e) => e.source_type === "work_log").map((e) => String(e.source_id)));
      const KIND_CAT: Record<string, string> = { blog: "content", gbp_post: "gbp", citation: "citations", press: "citations", mention: "citations", backlink: "citations", schema: "seo", search_console: "seo", bing: "seo", analytics: "seo" };
      // The rows a client may see. The feed below and the task counts (work_counts) are both built from these two lists,
      // so nothing internal, unfinished or unpublished is ever counted.
      const ledgerShown = ledger.filter((e) => e.visibility === "client" && e.status === "done" && e.client_title && e.client_copy_status !== "skipped");
      const legacyShown = work.filter(visible).filter((w: Record<string, unknown>) => w.status === "live" && !covered.has(String(w.id)) && !LEDGER_BANNED.test(String(w.title || "")));
      const workFeed = [
        ...ledgerShown.map((e) => ({
          id: e.id, title: e.client_title, summary: e.client_summary || "", category: e.category || "website",
          date: e.completed_at ? String(e.completed_at).slice(0, 10) : null, url: isClientSafeUrl(e.link) ? e.link : "",
        })),
        ...legacyShown.map((w: Record<string, unknown>) => ({
          id: `wl_${w.id}`, title: w.title, summary: "", category: KIND_CAT[String(w.kind)] || "website", date: w.date || null, url: isClientSafeUrl(w.url) ? w.url : "",
        })),
      ].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 120);
      // Task counts for the feed header ("12 things done for you this month"): counts only, never time. Pacific calendar.
      let workCountsOut: unknown = null;
      try {
        workCountsOut = workCounts([
          ...ledgerShown.map((e) => ({ at: e.completed_at, category: e.category || "website" })),
          ...legacyShown.map((w: Record<string, unknown>) => ({ at: w.date, category: KIND_CAT[String(w.kind)] || "website" })),
        ]);
      } catch { workCountsOut = null; }
      const groupUnread = await myGroups().then((gs) => Promise.all(gs.map(async (g) => groupUnreadCount(await groupMsgs(g.id as string))))).then((n) => n.reduce((a, b) => a + b, 0)).catch(() => 0);
      // Portal v2 (Nov 2026): "What needs you", the Business Brain summary and business health. Additive fields only;
      // each part fails soft to null so the home screen always loads.
      const v2 = await portalV2Extras(db, client, cid, reqs as Row[], [...ledgerShown, ...legacyShown.map((w: Row) => ({ category: KIND_CAT[String(w.kind)] || "website", completed_at: w.date }))]).catch(() => null);
      return Response.json({
        ...(v2 || {}),
        // Live Stripe subscriptions only (written by the Stripe sync): one line each with its item names. Never
        // ids, history or anything Stripe isn't billing right now.
        client: { ...pick(client, SAFE_CLIENT), subscriptions: liveSubscriptions(client) },
        businesses: await businessesFor().catch(() => []),
        user: { email: user.email, name: user.full_name, is_admin_preview: user.role === "admin" },
        work: work.filter(visible).filter((w: Record<string, unknown>) => w.status !== "failed").map((w: Record<string, unknown>) => pick(w, ["id", "kind", "title", "url", "date", "description", "status", "verified_live"])),
        automations: autos.filter(visible).filter((a: Record<string, unknown>) => a.status === "active").map((a: Record<string, unknown>) => pick(a, ["id", "name", "kind", "schedule", "last_run_at", "runs_count"])),
        requests: reqs.map((r: Record<string, unknown>) => pick(r, ["id", "kind", "title", "details", "status", "priority", "due_date", "client_note", "page_status", "page_url", "created_date", "completed_at", "attachments"])),
        site_health: clientHealthSummary({ audits, fixes, work }),
        has_brand_kit: !!portalKit(kits),
        has_playbook: !!portalKit(playbooks),
        goals: goals.map((g: Record<string, unknown>) => pick(g, ["id", "year", "title", "metric", "baseline_value", "target_value", "current_value", "unit", "status", "plan_steps"])),
        // Gaps titled "Internal: ..." are notes for the team and never reach the client, even if marked visible.
        gaps: gaps.filter(visible).filter((g: Record<string, unknown>) => !/^\s*internal\s*[:\-–]/i.test(String(g.title || ""))).map((g: Record<string, unknown>) => pick(g, ["id", "title", "area", "severity", "status", "recommendation", "impact"])),
        snapshots: snaps.map((s: Record<string, unknown>) => pick(s, ["id", "source", "period_start", "period_end", "metrics"])),
        pillars,
        build,
        unlocks,
        // Client to-dos: what we're working on, what's next and what we need from the client (Task.client_action).
        upcoming: tasks.filter((t: Record<string, unknown>) => t.portal_visible === true && t.status !== "done").map((t: Record<string, unknown>) => pick(t, ["id", "title", "due_date", "status", "client_action", "client_note"])),
        files: files.filter(visible).map((f: Record<string, unknown>) => pick(f, ["id", "title", "category", "file_url", "link_url", "description", "delivered_on"])),
        future: (await by("Project")).filter((p: Record<string, unknown>) => p.portal_visible !== false && ["proposed", "backlog", "planning", "in_progress", "review"].includes(String(p.status))).map((p: Record<string, unknown>) => pick(p, ["id", "title", "type", "status", "description", "progress", "due_date"])),
        unread: msgs.filter((m: Record<string, unknown>) => m.sender_role === "admin" && !m.read_at).length + groupUnread,
        work_feed: workFeed,
        work_counts: workCountsOut,
        next_call: await nextCallFor(db, cid).catch(() => null),
      });
    }

    // ---- Your Brain (portal v2): what we know about the business, the questions waiting, and answering them ----
    if (action === "brain") {
      const b = await brainFor(db, cid);
      return Response.json(b);
    }
    if (action === "brain_answer") {
      // The client answers one open question. The answer is queued on the brain as a pending update for the team to
      // merge (never written straight into a section), and the question is marked answered.
      const q = String(args.q || "").trim().slice(0, 600);
      const answer = String(args.answer || "").trim().replace(/(password|passcode|pwd|api[_ -]?key|secret|token)\s*[:=]\s*\S+/gi, "[removed]").slice(0, 4000);
      if (!q || !answer) return Response.json({ error: "Add your answer first." }, { status: 400 });
      const row = await clientBrainRow(db, cid);
      if (!row) return Response.json({ error: "That question isn't open any more." }, { status: 404 });
      const qs = ((row.open_questions as Row[]) || []);
      const i = qs.findIndex((x) => String(x?.q || "").trim() === q && !isClosed(x));
      if (i < 0) return Response.json({ error: "That question isn't open any more." }, { status: 404 });
      const now = new Date().toISOString();
      const nextQs = qs.map((x, j) => (j === i ? { ...x, status: "answered", answered_at: now } : x));
      const pending = [{ id: `portal_${Date.now().toString(36)}`, section: String(qs[i].section || "overview"), text: `Q: ${q}\nA (from the owner, in the portal): ${answer}`, source: "client_portal", by: "client", by_email: user.role === "admin" ? "" : user.email, added_at: now, status: "pending" }, ...(((row.pending_updates as Row[]) || []))].slice(0, 300);
      if (user.role !== "admin") await db.BusinessBrain.update(row.id as string, { open_questions: nextQs, pending_updates: pending });
      return Response.json({ ok: true, preview: user.role === "admin" });
    }

    // ---- Chats: the client's 1:1 with Interstellar + group chats they belong to ----
    // Never returns member lists or member counts. Membership is checked on every call.
    if (action === "chats") {
      const [direct, groups] = await Promise.all([by("ConversationMessage", "-created_date", 200), myGroups()]);
      const dLast = direct[0] as Record<string, unknown> | undefined;
      const threads: Record<string, unknown>[] = [{
        id: "direct", kind: "direct", title: "Interstellar Strategies",
        last_preview: dLast ? String(dLast.content || "").slice(0, 140) : "", last_at: dLast ? (dLast.created_date || dLast.timestamp) : null,
        unread: direct.filter((m: Record<string, unknown>) => m.sender_role === "admin" && !m.read_at).length,
      }];
      for (const g of groups) {
        const ms = await groupMsgs(g.id as string);
        const last = ms[ms.length - 1] as Record<string, unknown> | undefined;
        threads.push({
          id: g.id, kind: "group", title: g.title, description: g.description || "",
          last_preview: last ? String(last.content || "").slice(0, 140) : "", last_at: last ? (last.created_date || last.timestamp) : (g.created_date || null),
          unread: groupUnreadCount(ms),
        });
      }
      return Response.json({ me: senderOf(client), threads });
    }

    if (action === "chat_messages") {
      const thread = String(args.thread || "direct");
      if (thread === "direct") {
        const msgs = await by("ConversationMessage", "created_date", 500);
        if (user.role !== "admin") {
          await Promise.all(msgs.filter((m: Record<string, unknown>) => m.sender_role === "admin" && !m.read_at).map((m: Record<string, unknown>) => db.ConversationMessage.update(m.id as string, { read_at: new Date().toISOString() })));
        }
        return Response.json({ messages: msgs.map((m: Record<string, unknown>) => chatOut(m, m.sender_role === "client" ? senderOf(client) : null)) });
      }
      const g = await groupFor(thread);
      if (!g) return Response.json({ error: "Chat not found" }, { status: 404 });
      const msgs = await groupMsgs(g.id as string);
      if (user.role !== "admin") {
        await Promise.all(msgs.filter((m: Record<string, unknown>) => m.sender_client_id !== cid && !((m.read_by_client_ids as string[]) || []).includes(cid))
          .map((m: Record<string, unknown>) => db.ConversationMessage.update(m.id as string, { read_by_client_ids: [...((m.read_by_client_ids as string[]) || []), cid] })));
      }
      const ids = [...new Set(msgs.map((m: Record<string, unknown>) => m.sender_client_id).filter(Boolean) as string[])];
      const senders: Record<string, unknown> = {};
      await Promise.all(ids.map(async (id) => { const c = id === cid ? client : await db.CRMClient.get(id).catch(() => null); if (c) senders[id] = senderOf(c as Record<string, unknown>); }));
      return Response.json({
        thread: { id: g.id, kind: "group", title: g.title, description: g.description || "" },
        messages: msgs.map((m: Record<string, unknown>) => chatOut(m, m.sender_role === "client" ? (senders[m.sender_client_id as string] || { name: String(m.sender_name || "Member") }) : null)),
      });
    }

    if (action === "chat_send") {
      const thread = String(args.thread || "direct");
      const content = String(args.content || "").trim().slice(0, 5000);
      if (!content) return Response.json({ error: "Empty message" }, { status: 400 });
      const role = user.role === "admin" ? "admin" : "client";
      const now = new Date().toISOString();
      const base = { content, sender_role: role, senderEmail: user.email, messageType: "text", timestamp: now, sender_name: role === "admin" ? "Interstellar Strategies" : client.business };
      if (thread === "direct") {
        const m = await db.ConversationMessage.create({ ...base, client_id: cid, recipientEmail: role === "admin" ? (((client.emails as string[]) || [])[0] || "") : "interstellar", ...(role === "client" ? { sender_client_id: cid } : {}) });
        return Response.json({ message: chatOut(m, role === "client" ? senderOf(client) : null) });
      }
      const g = await groupFor(thread);
      if (!g) return Response.json({ error: "Chat not found" }, { status: 404 });
      const m = await db.ConversationMessage.create({ ...base, thread_id: g.id, recipientEmail: `group:${g.id}`, ...(role === "client" ? { sender_client_id: cid, read_by_client_ids: [cid] } : { read_at: now }) });
      await db.ChatThread.update(g.id as string, { last_message_at: now, last_message_preview: content.slice(0, 140) }).catch(() => null);
      return Response.json({ message: chatOut(m, role === "client" ? senderOf(client) : null) });
    }

    if (action === "messages") {
      const msgs = await by("ConversationMessage", "created_date", 500);
      if (user.role !== "admin") {
        await Promise.all(msgs.filter((m: Record<string, unknown>) => m.sender_role === "admin" && !m.read_at).map((m: Record<string, unknown>) => db.ConversationMessage.update(m.id as string, { read_at: new Date().toISOString() })));
      }
      return Response.json({ messages: msgs.map((m: Record<string, unknown>) => pick(m, ["id", "content", "sender_role", "timestamp", "created_date", "attachments"])) });
    }

    if (action === "send_message") {
      const content = String(args.content || "").trim().slice(0, 5000);
      if (!content) return Response.json({ error: "Empty message" }, { status: 400 });
      const m = await db.ConversationMessage.create({ client_id: cid, content, sender_role: user.role === "admin" ? "admin" : "client", senderEmail: user.email, messageType: "text", timestamp: new Date().toISOString() });
      return Response.json({ message: pick(m, ["id", "content", "sender_role", "timestamp", "created_date"]) });
    }

    if (action === "forms") {
      const forms = await db.RequestForm.filter({ client_id: cid, active: true });
      // Request-type labels / order / hidden flags edited in Settings > Lists & fields (labels only, no secrets).
      const optRows = await db.AppSettings.filter({ key: "option_lists" }, "-created_date", 1).catch(() => []);
      const typeList = (optRows || [])[0]?.optionLists?.request_types;
      const type_overrides = Array.isArray(typeList) ? typeList.map((t: Record<string, unknown>) => ({ value: String(t.value || ""), label: String(t.label || ""), archived: t.archived === true })) : null;
      return Response.json({ forms: forms.map((f: Record<string, unknown>) => pick(f, ["id", "kind", "title", "intro", "fields"])), type_overrides });
    }

    if (action === "brand_kit") {
      const k = portalKit(await by("BrandKit", "-version", 20).catch(() => []));
      return Response.json({ brand_kit: k ? pick(k, ["version", "kit", "body_md", "summary"]) : null });
    }

    // Industry playbook: only this client's newest approved playbook, and only when it is portal-visible.
    if (action === "playbook") {
      const p = portalKit(await by("IndustryPlaybook", "-version", 20).catch(() => []));
      return Response.json({ playbook: p ? pick(p, ["version", "playbook", "body_md", "summary", "quick_wins_done", "approved_at"]) : null });
    }

    // Social plan: only this client's newest approved plan, and only when it is portal-visible.
    if (action === "social_plan") {
      const p = portalKit(await by("SocialPlan", "-version", 20).catch(() => []));
      return Response.json({ social_plan: p ? pick(p, ["version", "plan", "body_md", "summary", "approved_at"]) : null });
    }

    // ---- Resources hub: everything Justin has published to this client, in one list ----
    // Brand kit / playbook / social plan: newest approved + portal_visible only. Client SOPs & guides:
    // this client's ClientFile rows (category sop|guide, portal_visible !== false). Shared SOPs: SOP-library
    // TaskTemplates whose portal_client_ids include this client (never time estimates or other clients).
    const RES_FILE_CATS = ["sop", "guide"];
    const sharedSop = (t: Row) => ({
      id: t.id, title: t.name, code: t.sop_code || "", summary: String(t.portal_summary || "").slice(0, 2000), // never fall back to the internal description (it holds prices)
      phases: (() => {
        const out: { phase: string; steps: { title: string; notes: string }[] }[] = [];
        for (const it of ((t.items as Row[]) || []).slice(0, 200)) {
          const phase = String(it.phase || "Steps");
          let g = out.find((x) => x.phase === phase);
          if (!g) { g = { phase, steps: [] }; out.push(g); }
          g.steps.push({ title: String(it.title || "").slice(0, 300), notes: String(it.notes || "").slice(0, 1200) });
        }
        return out;
      })(),
      updated: t.updated_date || t.created_date || null,
    });
    if (action === "resources") {
      const [kits, books, socials, files, sops] = await Promise.all([
        by("BrandKit", "-version", 20).catch(() => []), by("IndustryPlaybook", "-version", 20).catch(() => []), by("SocialPlan", "-version", 20).catch(() => []),
        by("ClientFile", "-delivered_on", 300).catch(() => []), db.TaskTemplate.list("sort_order", 300).catch(() => []),
      ]);
      const items: Row[] = [];
      const doc = (type: string, title: string, r: Row | null) => r && items.push({ id: r.id, type, title, version: r.version || 1, summary: String(r.summary || "").slice(0, 400), updated: r.approved_at || r.updated_date || r.created_date || null });
      doc("brand_kit", "Brand kit", portalKit(kits));
      doc("playbook", "2027 Industry Playbook", portalKit(books));
      doc("social_plan", "Social media plan", portalKit(socials));
      files.filter((f: Row) => RES_FILE_CATS.includes(String(f.category)) && visible(f)).forEach((f: Row) => items.push({
        id: f.id, type: f.category, title: f.title, summary: String(f.description || "").slice(0, 400), updated: f.delivered_on || f.updated_date || f.created_date || null,
      }));
      (sops || []).filter((t: Row) => ((t.portal_client_ids as string[]) || []).includes(cid)).forEach((t: Row) => {
        const s = sharedSop(t);
        items.push({ id: s.id, type: "shared_sop", title: s.title, code: s.code, summary: s.summary.slice(0, 400), updated: s.updated });
      });
      return Response.json({ resources: items });
    }

    if (action === "resource") {
      const type = String(args.type || "");
      const id = String(args.id || "");
      if (type === "sop" || type === "guide") {
        const f = id ? await db.ClientFile.get(id).catch(() => null) : null;
        if (!f || f.client_id !== cid || !visible(f) || !RES_FILE_CATS.includes(String(f.category))) return Response.json({ error: "Not found" }, { status: 404 });
        return Response.json({ resource: { type: f.category, ...pick(f, ["id", "title", "category", "file_url", "link_url", "description", "delivered_on", "updated_date"]) } });
      }
      if (type === "shared_sop") {
        const t = id ? await db.TaskTemplate.get(id).catch(() => null) : null;
        if (!t || !((t.portal_client_ids as string[]) || []).includes(cid)) return Response.json({ error: "Not found" }, { status: 404 });
        return Response.json({ resource: { type, ...sharedSop(t) } });
      }
      return Response.json({ error: "Unknown resource" }, { status: 400 });
    }

    if (action === "create_request") {
      let kind = reqKind(args.kind);
      const title = String(args.title || "").trim().slice(0, 200);
      if (!title) return Response.json({ error: "Add a title" }, { status: 400 });
      // A custom form must belong to this client; standard forms ("std:<kind>") have no record.
      let formId: string | null = null;
      let formTitle = args.form_title ? String(args.form_title).slice(0, 120) : null;
      let form: Record<string, unknown> | null = null;
      if (args.form_id && !String(args.form_id).startsWith("std:")) {
        form = await db.RequestForm.get(String(args.form_id)).catch(() => null);
        if (!form || form.client_id !== cid || form.active === false) return Response.json({ error: "Form not found" }, { status: 404 });
        formId = form.id as string; formTitle = String(form.title || formTitle || "").slice(0, 120); kind = reqKind(form.kind);
      }
      const fields = typeof args.fields === "object" && args.fields && !Array.isArray(args.fields) ? args.fields as Record<string, unknown> : {};
      const answers = Array.isArray(args.answers) ? args.answers.slice(0, 60) : [];
      if (JSON.stringify(fields).length > 60000 || JSON.stringify(answers).length > 60000) return Response.json({ error: "Request is too large" }, { status: 413 });
      const pr = String(args.priority || "").toLowerCase();
      const due = String(args.due_date || "");
      const r = await db.ClientRequest.create({
        client_id: cid, client_name: client.business, kind, title,
        details: String(args.details || "").slice(0, 8000),
        attachments: Array.isArray(args.attachments) ? args.attachments.filter(isUrl).slice(0, 30).map(String) : [],
        fields, answers,
        form_id: formId, form_title: formTitle,
        source: "portal", contact_email: user.email,
        status: "received", priority: ["low", "high", "urgent"].includes(pr) ? pr : "normal",
        ...(/^\d{4}-\d{2}-\d{2}$/.test(due) ? { due_date: due } : {}),
        submitted_by: user.email, page_status: ["project_submission", "job"].includes(kind) ? "queued" : "none",
      });
      if (form) await db.RequestForm.update(form.id as string, { submissions: (Number(form.submissions) || 0) + 1 }).catch(() => null);
      return Response.json({ request: pick(r, ["id", "kind", "title", "status", "created_date"]) });
    }

    // Portal Submit intake (Justin's standard for every client, Nov 19 2026). Capture only: the submission is stored in
    // the content pipeline's ContentSubmission (channel "portal", status "received", capture_only) — the writer never
    // touches "received" rows — and opens a project_submission request on Justin's Command screen. Nothing is published.
    if (action === "submit_content") {
      if (client.submit_intake === false) return Response.json({ error: "Submissions are switched off for this account" }, { status: 403 });
      const chk: any = checkSubmission(String(client.niche_key || "other"), args);
      if (chk.error) return Response.json({ error: chk.error }, { status: 400 });
      const label = SUBMIT_TYPES[chk.kind].label;
      const at = new Date().toISOString();
      const recId = `portal_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const sub = await db.ContentSubmission.create({
        client_id: cid, client_name: client.business, source_app_id: "portal", source_record_id: recId, source_entity: "PortalSubmit",
        channel: "portal", capture_only: true, kind: chk.kind, submitted_by: user.email, raw: { ...chk.fields, title: chk.title }, fields: chk.fields,
        photos: chk.photos, consent: chk.consent, is_test: /^\[TEST\]/.test(String(client.business || "")),
        status: "received", status_detail: RECEIVED_TEXT, received_at: at, version: 1, attempts: 0,
        history: [{ at, action: "received", by: user.email, note: "Portal Submit (capture only)" }],
      });
      const lines = Object.entries(chk.fields).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
      const req = await db.ClientRequest.create({
        client_id: cid, client_name: client.business, kind: "project_submission",
        title: `New submission from ${client.business}: ${label}`,
        details: [`${label}: ${chk.title}`, ...lines, `${chk.photos.length} photo${chk.photos.length === 1 ? "" : "s"}`, chk.consent ? "Consent to feature: yes" : "", "Capture only: not published. Auto-posting is wired per client at the end."].filter(Boolean).join("\n").slice(0, 8000),
        attachments: chk.photos.map((p: any) => p.url), fields: { submission_id: sub.id, submission_kind: chk.kind, channel: "portal" },
        source: "portal", contact_email: user.email, submitted_by: user.email, status: "received", priority: "normal", page_status: "none",
      });
      await db.ContentSubmission.update(sub.id, { request_id: req.id }).catch(() => null);
      return Response.json({ ok: true, message: RECEIVED_TEXT, item: { id: sub.id, kind: chk.kind, label, title: chk.title, status: "received", status_label: statusLabel("received"), received_at: at } });
    }

    if (action === "submissions") {
      const rows = (await by("ContentSubmission", "-received_at", 100).catch(() => [])) as Record<string, any>[];
      return Response.json({
        enabled: client.submit_intake !== false,
        types: submitTypesFor(String(client.niche_key || "other")),
        items: rows.filter((r) => !r.is_test || /^\[TEST\]/.test(String(client.business || ""))).map((r) => ({
          id: r.id, kind: r.kind, label: (SUBMIT_TYPES as any)[r.kind]?.label || r.kind, channel: r.channel || "command_system",
          title: String(r.fields?.title || r.fields?.product_name || r.raw?.title || r.raw?.shoot_title || r.writer_output?.title || "").slice(0, 140),
          status: r.status, status_label: statusLabel(r.status), received_at: r.received_at || r.created_date,
          url: r.status === "live" && isUrl(r.published_url) ? r.published_url : "", photo: (r.photos || [])[0]?.url || "",
        })),
      });
    }

    if (action === "intake") {
      const list = await by("IntakeAudit", "-created_date", 5);
      const a = list[0];
      return Response.json({ intake: a ? pick(a, ["id", "status", "answers", "submitted_at"]) : null });
    }

    if (action === "save_intake") {
      const list = await by("IntakeAudit", "-created_date", 5);
      let a = list[0];
      const answers = typeof args.answers === "object" && args.answers ? args.answers : {};
      const submit = !!args.submit;
      if (!a) a = await db.IntakeAudit.create({ client_id: cid, business_name: client.business, contact_email: user.email, status: "in_progress", answers: {} });
      if (a.status === "reviewed" && user.role !== "admin") return Response.json({ error: "This audit was already reviewed." }, { status: 409 });
      const upd = await db.IntakeAudit.update(a.id, { answers, status: submit ? "submitted" : "in_progress", ...(submit ? { submitted_at: new Date().toISOString() } : {}) });
      return Response.json({ intake: pick(upd, ["id", "status", "answers", "submitted_at"]) });
    }

    // ---- Prestige referral program: the client's own referrer record, read-only (plus join, "seen" and
    // credit redemption requests). Mirrors DEFAULT_OFFER / CREDIT_CATEGORIES in src/lib/prestige.js. ----
    if (action === "prestige" || action === "prestige_seen" || action === "prestige_join" || action === "prestige_redeem") {
      const CREDIT_PER_SIGNED = 500;
      const CREDIT_CAP = 500;
      const CATS: Record<string, { group: "build" | "capped"; label: string }> = {
        automation: { group: "build", label: "Automation" },
        app_upgrade: { group: "build", label: "App upgrade" },
        website_feature: { group: "build", label: "Website feature" },
        addon_package: { group: "build", label: "Add-on package" },
        merch: { group: "capped", label: "Custom merch" },
        marketing_materials: { group: "capped", label: "Marketing materials" },
        social_posts: { group: "capped", label: "Social posts" },
        video: { group: "capped", label: "Videos" },
        ad_spend: { group: "capped", label: "Ad spend" },
      };
      const DEF = {
        referral_base_url: "https://interstellar-strategies.com/contact",
        share_message: "I've been working with Interstellar Strategies on my website and marketing. If you want the same for your business, book a free call here: {link}",
        booked: { title: "Priority Pass", detail: "When they book a call, your next request jumps to the front of the build queue.", value: 0 },
        signed: { title: "$500 Interstellar credit", detail: "Added to your account when they pay their first invoice. Spend it on builds — automations, app upgrades, interactive website features, add-ons — and stack credits for something bigger. Or use up to $500 at a time on merch, marketing materials, social posts, videos or ad spend.", value: CREDIT_PER_SIGNED },
        tiers: [
          { name: "Prestige I", threshold: 1, unlock: "Custom landing page", detail: "A conversion-built landing page for an offer, a service or a campaign.", value: 1500 },
          { name: "Prestige II", threshold: 3, unlock: "Automation build", detail: "An automation that takes a recurring task off your plate: lead capture, follow-up, review requests or intake.", value: 3000 },
          { name: "Prestige III", threshold: 5, unlock: "Mini app", detail: "A focused custom app: a calculator, booking tool, internal dashboard or client tool.", value: 5000 },
          { name: "Prestige IV", threshold: 10, unlock: "Full custom app", detail: "A full custom application with backend, database and integrations, built around how you run.", value: 10000 },
          { name: "Prestige Master", threshold: 25, unlock: "VIP partner status", detail: "Partner status: priority build queue, first access to every new system, and your name on the Prestige wall.", value: 0 },
        ],
        terms: "Every booked call earns a Priority Pass and every signed referral earns $500 in Interstellar credit. Tier unlocks are counted on signed referrals and stack. A referral counts as signed once their first invoice is paid. Credits are added to your Interstellar account, stack with no expiry unless stated, apply to Interstellar work only, have no cash value and are non-transferable. Merch, marketing materials, social posts, videos and ad spend are redeemed through Interstellar and capped at $500 per redemption.",
      };
      const setRows = await db.AppSettings.filter({ key: "prestige_offer" }, "-created_date", 1).catch(() => []);
      const saved = ((setRows || [])[0]?.prestigeOffer || {}) as Record<string, any>;
      // Offers saved under the old rules (post pack / next invoice / free month) fall back to the new defaults.
      const legacy = (r: any) => !!r && /post pack|next invoice|free month|account credit/i.test(`${r.title || ""} ${r.detail || ""}`);
      const savedTerms = typeof saved.terms === "string" && saved.terms && !/next invoice|free month|Credits apply to Interstellar work,/i.test(saved.terms) ? saved.terms : DEF.terms;
      const offer = { ...DEF, ...saved, terms: savedTerms, booked: { ...DEF.booked, ...(legacy(saved.booked) ? {} : saved.booked || {}), value: 0 }, signed: { ...DEF.signed, ...(legacy(saved.signed) ? {} : saved.signed || {}), value: CREDIT_PER_SIGNED }, tiers: (Array.isArray(saved.tiers) && saved.tiers.length ? saved.tiers : DEF.tiers).slice().sort((a: any, b: any) => (a.threshold || 0) - (b.threshold || 0)) };
      const emails = ((client.portal_emails as string[]) || []).map((e) => String(e).toLowerCase());
      const allMembers = await db.PrestigeMember.list("-created_date", 500).catch(() => []);
      let member = (allMembers || []).find((m: Record<string, unknown>) => m.client_id === cid)
        || (allMembers || []).find((m: Record<string, unknown>) => (!m.client_id || m.client_id === cid) && m.email && emails.includes(String(m.email).toLowerCase()))
        || null;
      const slug = (s: unknown) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "friend";

      if (action === "prestige_join") {
        if (!member) {
          member = await db.PrestigeMember.create({ name: client.business, email: user.role === "admin" ? (emails[0] || "") : user.email, client_id: cid, prestige: "Recruit", totalReferrals: 0, joinDate: new Date().toISOString().slice(0, 10), active: true, referral_code: slug(client.business), last_celebrated_tier: 0, client_celebrated_tier: 0, notes: "Joined from the client portal." });
        } else if (!member.client_id) {
          member = await db.PrestigeMember.update(member.id, { client_id: cid });
        }
      }
      if (!member) return Response.json({ member: null, offer });

      const refs = await db.PrestigeReferral.filter({ memberId: member.id }, "-date", 500).catch(() => []);
      const signed = (refs || []).filter((r: Record<string, unknown>) => r.status === "Confirmed" || r.status === "Paid Out").length;
      const booked = (refs || []).filter((r: Record<string, unknown>) => ["Booked", "Confirmed", "Paid Out"].includes(String(r.status))).length;
      let tier = 0;
      offer.tiers.forEach((t: any, i: number) => { if (signed >= Number(t.threshold || 0)) tier = i + 1; });

      if (action === "prestige_seen") {
        const seen = Math.min(tier, Math.max(0, Math.round(Number(args.tier) || 0)));
        if (user.role !== "admin" && seen > Number(member.client_celebrated_tier || 0)) await db.PrestigeMember.update(member.id, { client_celebrated_tier: seen });
        return Response.json({ ok: true });
      }

      const rewards = await db.PrestigeReward.filter({ memberId: member.id }, "-created_date", 500).catch(() => []);
      const redemptions = await db.PrestigeRedemption.filter({ memberId: member.id }, "-created_date", 500).catch(() => []);
      // balance = earned credits − approved/fulfilled redemptions. Pending requests are never deducted,
      // only reserved (available) so the same credit can't be requested twice.
      const isCredit = (r: Record<string, unknown>) => r.reward_type === "credit_500" || (!r.reward_type && r.kind === "signed");
      const earned = (rewards || []).filter((r: Record<string, unknown>) => isCredit(r) && r.status !== "void").reduce((s: number, r: Record<string, unknown>) => s + (Number(r.value) || 0), 0);
      const redeemed = (redemptions || []).filter((x: Record<string, unknown>) => x.status === "approved" || x.status === "fulfilled").reduce((s: number, x: Record<string, unknown>) => s + (Number(x.amount) || 0), 0);
      const pending = (redemptions || []).filter((x: Record<string, unknown>) => x.status === "requested").reduce((s: number, x: Record<string, unknown>) => s + (Number(x.amount) || 0), 0);
      const credits = { earned, redeemed, pending, balance: earned - redeemed, available: Math.max(0, earned - redeemed - pending) };

      if (action === "prestige_redeem") {
        if (user.role === "admin" && asClient) return Response.json({ error: "Preview only: clients send this from their own portal. Log redemptions on the Prestige page." }, { status: 400 });
        const category = String(args.category || "");
        const cat = CATS[category];
        const amount = Number(args.amount);
        if (!cat) return Response.json({ error: "Pick where the credit should go." }, { status: 400 });
        if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount) !== amount) return Response.json({ error: "Enter a whole-dollar amount." }, { status: 400 });
        if (cat.group === "capped" && amount > CREDIT_CAP) return Response.json({ error: `${cat.label} is capped at $${CREDIT_CAP} per redemption.` }, { status: 400 });
        if (amount > credits.available) return Response.json({ error: `That's more than the $${credits.available.toLocaleString()} available.` }, { status: 400 });
        const details = String(args.details || "").trim().slice(0, 4000);
        const nowIso = new Date().toISOString();
        const request = await db.ClientRequest.create({
          client_id: cid, client_name: client.business, kind: "credit_redemption",
          title: `Credit redemption: ${cat.label} · $${amount.toLocaleString()}`,
          details: [`Category: ${cat.label} (${cat.group === "build" ? "build, stackable" : `capped at $${CREDIT_CAP}`})`, `Amount: $${amount.toLocaleString()}`, `Balance when requested: $${credits.balance.toLocaleString()}`, details ? `Notes: ${details}` : ""].filter(Boolean).join("\n"),
          fields: { topic: "Credit redemption", category, category_group: cat.group, amount },
          answers: [], attachments: [], form_id: null, form_title: "Credit redemption",
          source: "portal", contact_email: user.email, status: "received", priority: "normal",
          submitted_by: user.email, page_status: "none",
        });
        const red = await db.PrestigeRedemption.create({
          memberId: member.id, memberName: member.name, client_id: cid, client_name: client.business,
          category, category_group: cat.group, amount, status: "requested", details, request_id: request.id,
          source: "portal", requested_by: user.email, requested_at: nowIso,
        });
        return Response.json({ ok: true, request: pick(request, ["id", "title", "status"]), redemption: pick(red, ["id", "category", "amount", "status"]) });
      }

      const code = (member.referral_code as string) || slug(member.name);
      const base = String(offer.referral_base_url || DEF.referral_base_url);
      const link = `${base}${base.includes("?") ? "&" : "?"}ref=${encodeURIComponent(code)}`;
      return Response.json({
        offer,
        link,
        share_text: String(offer.share_message || "").replace(/\{link\}/g, link).replace(/\{name\}/g, String(member.name || "")),
        member: { id: member.id, name: member.name, signed, booked, sent: (refs || []).length, tier, celebrated: Number(member.client_celebrated_tier || 0) },
        referrals: (refs || []).map((r: Record<string, unknown>) => pick(r, ["id", "referredClientName", "status", "date"])),
        rewards: (rewards || []).filter((r: Record<string, unknown>) => r.status !== "void").map((r: Record<string, unknown>) => pick(r, ["id", "kind", "reward_type", "title", "value", "status", "earned_at", "delivered_at", "referredClientName", "tier_index"])),
        credits,
        redemptions: (redemptions || []).map((x: Record<string, unknown>) => pick(x, ["id", "category", "category_group", "amount", "status", "requested_at", "created_date"])),
      });
    }

    // ---- Email signatures: the client's own signatures + templates, plus Interstellar's global templates ----
    const SIG_KEYS = ["id", "name", "template_id", "fields", "theme", "generated_html", "folder", "client_id", "source_template_id", "updated_date", "created_by"];
    const TPL_KEYS = ["id", "name", "description", "folder", "scope", "client_id", "is_default", "template_id", "fields", "theme", "preview_html", "updated_date"];
    const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
    const tooBig = (v: unknown) => JSON.stringify(v || {}).length > 400000;
    const clean = (a: Record<string, unknown>) => {
      const out: Record<string, unknown> = {};
      if (a.name !== undefined) out.name = String(a.name || "Untitled").slice(0, 120);
      if (a.folder !== undefined) out.folder = String(a.folder || "").slice(0, 80);
      if (a.template_id !== undefined) out.template_id = String(a.template_id || "t5_rail").slice(0, 40);
      if (a.fields !== undefined) out.fields = obj(a.fields);
      if (a.theme !== undefined) out.theme = obj(a.theme);
      return out;
    };
    const ownSig = async (id: unknown) => {
      const s = id ? await db.Signature.get(String(id)).catch(() => null) : null;
      return s && s.client_id === cid ? s : null;
    };
    const ownTpl = async (id: unknown) => {
      const t = id ? await db.SignatureTemplate.get(String(id)).catch(() => null) : null;
      return t && t.scope === "client" && t.client_id === cid ? t : null;
    };

    if (action === "sig_list") {
      const [sigs, own, global, dossiers] = await Promise.all([
        db.Signature.filter({ client_id: cid }, "-updated_date", 300),
        db.SignatureTemplate.filter({ client_id: cid, scope: "client" }, "-updated_date", 200),
        db.SignatureTemplate.filter({ scope: "global" }, "-updated_date", 200),
        db.ClientDossier.filter({ client_id: cid }).catch(() => []),
      ]);
      const d = (dossiers || [])[0] || {};
      const bi = (d.brand_identity || {}) as Record<string, unknown>;
      return Response.json({
        signatures: (sigs || []).map((s: Record<string, unknown>) => pick(s, SIG_KEYS)),
        templates: [...(own || []), ...(global || []).filter((t: Record<string, unknown>) => t.portal_visible !== false)].map((t: Record<string, unknown>) => pick(t, TPL_KEYS)),
        brand: { company: client.business, website: client.domain, logo_url: client.logo_url || bi.logo_url || "", slogan: d.tagline || "", colors: bi.colors || [] },
      });
    }

    if (action === "sig_get") {
      const s = await ownSig(args.id);
      if (!s) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json({ signature: pick(s, SIG_KEYS) });
    }

    if (action === "sig_save") {
      const data = clean(args);
      if (args.generated_html !== undefined) data.generated_html = String(args.generated_html || "").slice(0, 200000);
      if (args.source_template_id) data.source_template_id = String(args.source_template_id);
      if (tooBig(data.fields) || tooBig(data.theme)) return Response.json({ error: "Signature is too large" }, { status: 413 });
      if (args.id) {
        const s = await ownSig(args.id);
        if (!s) return Response.json({ error: "Not found" }, { status: 404 });
        const u = await db.Signature.update(s.id, data);
        return Response.json({ signature: pick(u, SIG_KEYS) });
      }
      const c = await db.Signature.create({ name: "Untitled signature", template_id: "t5_rail", ...data, client_id: cid, client_name: client.business });
      return Response.json({ signature: pick(c, SIG_KEYS) });
    }

    if (action === "sig_delete") {
      const s = await ownSig(args.id);
      if (!s) return Response.json({ error: "Not found" }, { status: 404 });
      await db.Signature.delete(s.id);
      return Response.json({ ok: true });
    }

    if (action === "tpl_get") {
      const t = args.id ? await db.SignatureTemplate.get(String(args.id)).catch(() => null) : null;
      const ok = t && ((t.scope === "client" && t.client_id === cid) || (t.scope === "global" && t.portal_visible !== false));
      if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json({ template: pick(t, TPL_KEYS) });
    }

    if (action === "tpl_save") {
      const data = clean(args);
      if (args.preview_html !== undefined) data.preview_html = String(args.preview_html || "").slice(0, 200000);
      if (args.is_default === false) data.is_default = false;
      if (tooBig(data.fields) || tooBig(data.theme)) return Response.json({ error: "Template is too large" }, { status: 413 });
      if (args.id) {
        const t = await ownTpl(args.id);
        if (!t) return Response.json({ error: "Only your own templates can be edited" }, { status: 403 });
        const u = await db.SignatureTemplate.update(t.id, data);
        return Response.json({ template: pick(u, TPL_KEYS) });
      }
      const c = await db.SignatureTemplate.create({ name: "Untitled template", template_id: "t5_rail", ...data, scope: "client", client_id: cid, client_name: client.business, is_default: false });
      return Response.json({ template: pick(c, TPL_KEYS) });
    }

    if (action === "tpl_default") {
      const t = await ownTpl(args.id);
      if (!t) return Response.json({ error: "Only your own templates can be the default" }, { status: 403 });
      const mine = await db.SignatureTemplate.filter({ client_id: cid, scope: "client", is_default: true });
      await Promise.all((mine || []).filter((x: Record<string, unknown>) => x.id !== t.id).map((x: Record<string, unknown>) => db.SignatureTemplate.update(x.id as string, { is_default: false })));
      const u = await db.SignatureTemplate.update(t.id, { is_default: true });
      return Response.json({ template: pick(u, TPL_KEYS) });
    }

    if (action === "tpl_delete") {
      const t = await ownTpl(args.id);
      if (!t) return Response.json({ error: "Only your own templates can be deleted" }, { status: 403 });
      await db.SignatureTemplate.delete(t.id);
      return Response.json({ ok: true });
    }

    // ---- Workspace: "Questions for our next call". Only questions Justin marked share=true on this client's next
    // open call prep; the client's answer is stored beside his (never over his own call notes). ----
    if (action === "call_answer") {
      const prep = args.prep_id ? await db.CallPrep.get(String(args.prep_id)).catch(() => null) : null;
      if (!prep || prep.client_id !== cid || prep.status === "done") return Response.json({ error: "Not found" }, { status: 404 });
      const i = Number(args.i);
      const qa = Array.isArray(prep.qa) ? [...prep.qa] : [];
      if (!Number.isInteger(i) || !qa[i] || qa[i].share !== true) return Response.json({ error: "Not found" }, { status: 404 });
      const answer = String(args.answer || "").trim().slice(0, 2000);
      qa[i] = { ...qa[i], client_answer: answer, client_answered_at: new Date().toISOString() };
      await db.CallPrep.update(prep.id, { qa });
      return Response.json({ ok: true });
    }

    // ---- Google Business Profile: this client's ReviewClient rows (one per location), served from the Stärboard cache. ----
    // Never returns another client's rows: ReviewClient is matched on crm_client_id === cid only.
    // ---- Seasons + offers (self-serve, Nov 19 2026). The site reads them through the public site-config function. ----
    // A checkout discount for an offer is a hard gate (money): it waits for Justin's one tap and is never created here.
    if (action === "seasons" || action === "season_set" || action === "offer_save" || action === "offer_end") {
      const OFFER_KEYS = ["id", "title", "description", "kind", "value", "starts_on", "ends_on", "status", "discount_status", "discount_code"];
      const supported = !!client.site_key;
      if (action === "seasons") {
        const [seasons, offers] = await Promise.all([
          db.SiteSeason.filter({ client_id: cid }, "key", 20).catch(() => []),
          db.SiteOffer.filter({ client_id: cid }, "-created_date", 50).catch(() => []),
        ]);
        return Response.json({
          supported, today: todayPacific(), presets: SEASON_PRESETS,
          // Automatic seasons: what the calendar puts on their site when nothing is switched on by hand.
          auto_on: client.seasons_auto !== false,
          auto: (() => { const a = autoSeason(todayPacific(), (offers || []).some((o: Record<string, unknown>) => offerLive(o, todayPacific()))); return a ? { key: a.key, label: a.label } : null; })(),
          seasons: (seasons || []).map((r: Record<string, unknown>) => pick(r, ["id", "key", "label", "active", "banner_text", "accent", "featured_title", "featured_text", "activated_at"])),
          offers: (offers || []).map((r: Record<string, unknown>) => ({ ...pick(r, OFFER_KEYS), label: offerLabel(r) })),
        });
      }
      if (!supported) return Response.json({ error: "Your website isn't connected to seasons and offers yet. Ask us and we'll switch it on." }, { status: 400 });
      if (action === "season_set") {
        const c = cleanSeason(args);
        if ((c as any).error) return Response.json({ error: (c as any).error }, { status: 400 });
        const active = args.active === true;
        const rows = (await db.SiteSeason.filter({ client_id: cid }, "key", 20).catch(() => [])) || [];
        // One season at a time: turning one on turns the others off; turning it off reverts the site.
        if (active) for (const r of rows) if (r.active && r.key !== (c as any).key) await db.SiteSeason.update(r.id, { active: false, updated_by: user.email });
        const prev = rows.find((r: Record<string, unknown>) => r.key === (c as any).key);
        const patch = { ...(c as any), client_id: cid, client_name: client.business, active, updated_by: user.email, ...(active ? { activated_at: new Date().toISOString() } : {}) };
        const row = prev ? await db.SiteSeason.update(prev.id, patch) : await db.SiteSeason.create(patch);
        return Response.json({ ok: true, season: pick(row, ["id", "key", "label", "active", "banner_text", "accent", "featured_title", "featured_text"]) });
      }
      if (action === "offer_save") {
        const o = cleanOffer(args);
        if ((o as any).error) return Response.json({ error: (o as any).error }, { status: 400 });
        const row = await db.SiteOffer.create({ ...(o as any), client_id: cid, client_name: client.business, status: "live", discount_status: "awaiting_approval", created_by: user.email });
        return Response.json({ ok: true, offer: { ...pick(row, OFFER_KEYS), label: offerLabel(row) }, note: "It shows on your site between its dates. We'll set up the matching checkout discount for you." });
      }
      if (action === "offer_end") {
        const r = args.id ? await db.SiteOffer.get(String(args.id)).catch(() => null) : null;
        if (!r || r.client_id !== cid) return Response.json({ error: "Not found" }, { status: 404 });
        await db.SiteOffer.update(r.id, { status: "ended", ...(r.discount_status === "awaiting_approval" ? { discount_status: "none" } : {}) });
        return Response.json({ ok: true });
      }
    }

    if (action === "gbp") {
      const REVIEWS_URL = "https://interstellar-mothership.com/functions/reviews";
      const STALE_MS = 26 * 60 * 60 * 1000;
      const rows = ((await db.ReviewClient.filter({ crm_client_id: cid }).catch(() => [])) || []).filter((r: Row) => r.active !== false && r.slug) as Row[];
      if (!rows.length) return Response.json({ connected: false, locations: [] });
      const norm = (u: unknown) => { try { return new URL(String(u || "")).toString(); } catch { return ""; } };
      const shortName = (n: unknown) => {
        const parts = String(n || "").trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return "Google reviewer";
        return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
      };
      const codes = ((await db.QrCode.filter({ client_id: cid }, "-updated_date", 500).catch(() => [])) || []) as Row[];
      const locations = await Promise.all(rows.map(async (r) => {
        let cache = (r.cache || null) as Row | null;
        let cachedAt = (r.cached_at as string) || null;
        // Stale or never fetched: ask the public reviews endpoint, which refreshes at most once a day.
        if (!cache || !cachedAt || Date.now() - Date.parse(cachedAt) > STALE_MS) {
          try {
            const res = await fetch(`${REVIEWS_URL}?client=${encodeURIComponent(String(r.slug))}`, { signal: AbortSignal.timeout(8000) });
            const j = await res.json().catch(() => null);
            if (res.ok && j && !j.error) { cache = j; cachedAt = j.cachedAt || cachedAt; }
          } catch { /* serve what we have */ }
        }
        const c = (cache || {}) as Row;
        const placeId = String(r.place_id || "");
        const reviewUrl = String(c.reviewUrl || (placeId ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}` : ""));
        const name = String(r.name || c.businessName || client.business || "");
        const dest = norm(reviewUrl);
        const qr = dest ? codes.find((q) => q.mode === "dynamic" && norm(q.destination) === dest) : null;
        return {
          id: r.id,
          slug: r.slug,
          label: name.includes(" — ") ? name.split(" — ").slice(1).join(" — ") : name,
          name,
          business_name: c.businessName || name,
          rating: typeof c.rating === "number" ? c.rating : null,
          total: typeof c.total === "number" ? c.total : null,
          maps_url: c.mapsUrl || (placeId ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}` : ""),
          review_url: reviewUrl,
          cached_at: cachedAt,
          reviews: ((c.reviews as Row[]) || []).slice(0, 8).map((v) => ({
            author: shortName(v.author), rating: v.rating, relative: v.relative || "", time: v.time || null, text: String(v.text || "").slice(0, 1200),
          })),
          qr: qr ? pick(qr, ["id", "name", "short_code", "scans", "last_scan_at"]) : null,
        };
      }));
      return Response.json({ connected: true, business: client.business, locations });
    }

    // ---- QR codes (bonus tool): the client's own codes + templates, scan stats. Scoped to cid on every action. ----
    // Dynamic codes print QR_REDIRECT?c=<short_code>; the public `qr` function resolves them. The short code is
    // minted here once and never changes (it is printed), and only http(s) destinations are ever stored.
    if (String(action).startsWith("qr_")) {
      const QR_REDIRECT = "https://interstellar-mothership.com/functions/qr";
      const QR_KEYS = ["id", "name", "folder", "mode", "content_type", "destination", "url", "text", "email_to", "email_subject", "email_body", "phone", "sms_body", "wifi_ssid", "wifi_password", "wifi_encryption", "wifi_hidden", "whatsapp_number", "whatsapp_message", "style", "short_code", "encoded_url", "scans", "last_scan_at", "active", "client_id", "client_name", "source", "created_date", "updated_date"];
      const QR_TPL_KEYS = ["id", "name", "description", "scope", "client_id", "client_name", "style", "updated_date"];
      const QR_TYPES = ["link", "text", "email", "phone", "sms", "wifi", "whatsapp"];
      const str = (v: unknown, n: number) => String(v ?? "").slice(0, n);
      const httpUrl = (u: unknown) => {
        let s = String(u || "").trim();
        if (!s || s.length > 2000) return null;
        if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s;
        try {
          const x = new URL(s);
          if ((x.protocol !== "https:" && x.protocol !== "http:") || x.username || x.password || !x.hostname.includes(".")) return null;
          return x.toString();
        } catch { return null; }
      };
      const styleOf = (v: unknown) => {
        const s = { ...(obj(v) as Record<string, unknown>) };
        if (s.logo_url !== undefined) {
          const l = String(s.logo_url || "");
          // Logos: uploaded https files or small inline SVG/PNG data URLs only.
          s.logo_url = /^https:\/\//i.test(l) || /^data:image\/(svg\+xml|png|jpeg|webp|gif)[;,]/i.test(l) ? l.slice(0, 200000) : "";
        }
        return s;
      };
      const ownQr = async (id: unknown) => {
        const q = id ? await db.QrCode.get(String(id)).catch(() => null) : null;
        return q && q.client_id === cid ? q as Record<string, unknown> : null;
      };
      const ownQrTpl = async (id: unknown) => {
        const t = id ? await db.QrTemplate.get(String(id)).catch(() => null) : null;
        return t && t.scope === "client" && t.client_id === cid ? t as Record<string, unknown> : null;
      };
      const ALPHA = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
      const mint = async () => {
        for (let i = 0; i < 8; i++) {
          const code = Array.from(crypto.getRandomValues(new Uint8Array(7)), (b) => ALPHA[b % ALPHA.length]).join("");
          const taken = await db.QrCode.filter({ short_code: code }, "-created_date", 1).catch(() => []);
          if (!(taken || []).length) return { short_code: code, encoded_url: `${QR_REDIRECT}?c=${code}` };
        }
        throw new Error("Couldn't mint a short link. Try again.");
      };
      const summarize = (scans: Row[]) => {
        const counts: Record<string, number> = {};
        const devices: Record<string, number> = {};
        const os: Record<string, number> = {};
        let last: string | null = null;
        for (const s of scans) {
          const at = String(s.at || s.created_date || "");
          if (!at) continue;
          counts[at.slice(0, 10)] = (counts[at.slice(0, 10)] || 0) + 1;
          const dv = String(s.device || "other"); devices[dv] = (devices[dv] || 0) + 1;
          const o = String(s.os || "Other"); os[o] = (os[o] || 0) + 1;
          if (!last || at > last) last = at;
        }
        const series = Array.from({ length: 30 }, (_, i) => {
          const d = new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10);
          return { date: d, scans: counts[d] || 0 };
        });
        const sumLast = (n: number) => series.slice(-n).reduce((a, b) => a + b.scans, 0);
        return { total: scans.length, today: sumLast(1), last7: sumLast(7), last30: sumLast(30), series, devices, os, last_scan_at: last };
      };

      if (action === "qr_list") {
        const [codes, own, global, dossiers] = await Promise.all([
          db.QrCode.filter({ client_id: cid }, "-updated_date", 500),
          db.QrTemplate.filter({ client_id: cid, scope: "client" }, "-updated_date", 200).catch(() => []),
          db.QrTemplate.filter({ scope: "global" }, "-updated_date", 200).catch(() => []),
          db.ClientDossier.filter({ client_id: cid }).catch(() => []),
        ]);
        const d = (dossiers || [])[0] || {};
        const bi = (d.brand_identity || {}) as Record<string, unknown>;
        return Response.json({
          codes: (codes || []).map((q: Row) => pick(q, QR_KEYS)),
          templates: [...(own || []), ...(global || []).filter((t: Row) => t.portal_visible !== false)].map((t: Row) => pick(t, QR_TPL_KEYS)),
          brand: { company: client.business, website: client.domain || ((client.websites as string[]) || [])[0] || "", logo_url: client.logo_url || bi.logo_url || "", accent: client.accent || "", martian_color: client.martian_color || "", colors: bi.colors || [] },
          redirect_base: QR_REDIRECT,
        });
      }

      if (action === "qr_get") {
        const q = await ownQr(args.id);
        if (!q) return Response.json({ error: "Not found" }, { status: 404 });
        return Response.json({ code: pick(q, QR_KEYS) });
      }

      if (action === "qr_save") {
        const existing = args.id ? await ownQr(args.id) : null;
        if (args.id && !existing) return Response.json({ error: "Not found" }, { status: 404 });
        const mode = args.mode === "static" ? "static" : "dynamic";
        const data: Record<string, unknown> = {
          name: str(args.name, 120).trim() || "Untitled QR code",
          folder: str(args.folder, 80),
          mode,
          content_type: mode === "dynamic" ? "link" : (QR_TYPES.includes(String(args.content_type)) ? String(args.content_type) : "link"),
          text: str(args.text, 1200), email_to: str(args.email_to, 200), email_subject: str(args.email_subject, 200), email_body: str(args.email_body, 2000),
          phone: str(args.phone, 40), sms_body: str(args.sms_body, 600),
          wifi_ssid: str(args.wifi_ssid, 64), wifi_password: str(args.wifi_password, 128),
          wifi_encryption: ["WPA", "WEP", "nopass"].includes(String(args.wifi_encryption)) ? String(args.wifi_encryption) : "WPA",
          wifi_hidden: args.wifi_hidden === true,
          whatsapp_number: str(args.whatsapp_number, 30), whatsapp_message: str(args.whatsapp_message, 1000),
          style: styleOf(args.style),
        };
        if (tooBig(data.style)) return Response.json({ error: "Design is too large (try a smaller logo)" }, { status: 413 });
        if (args.active !== undefined) data.active = args.active !== false;
        // Destinations: http(s) only, validated server-side.
        if (mode === "dynamic") {
          const dest = httpUrl(args.destination);
          if (!dest) return Response.json({ error: "Add a valid destination link (http or https)." }, { status: 400 });
          data.destination = dest;
        } else if (data.content_type === "link") {
          const u = args.url ? httpUrl(args.url) : "";
          if (u === null) return Response.json({ error: "That link isn't a valid web address." }, { status: 400 });
          data.url = u;
        }
        if (existing) {
          if (mode === "dynamic" && !existing.short_code) Object.assign(data, await mint());
          const u = await db.QrCode.update(existing.id as string, data);
          return Response.json({ code: pick(u, QR_KEYS) });
        }
        if (mode === "dynamic") Object.assign(data, await mint());
        const c = await db.QrCode.create({ ...data, client_id: cid, client_name: client.business, source: "portal", created_by_email: user.email, scans: 0, active: true });
        return Response.json({ code: pick(c, QR_KEYS) });
      }

      if (action === "qr_delete") {
        const q = await ownQr(args.id);
        if (!q) return Response.json({ error: "Not found" }, { status: 404 });
        await db.QrCode.delete(q.id as string);
        return Response.json({ ok: true });
      }

      if (action === "qr_stats") {
        if (args.id) {
          const q = await ownQr(args.id);
          if (!q) return Response.json({ error: "Not found" }, { status: 404 });
          const scans = await db.QrScan.filter({ qr_id: q.id }, "-at", 5000).catch(() => []);
          return Response.json({ stats: summarize((scans || []).filter((s: Row) => s.client_id === cid || !s.client_id)) });
        }
        const scans = await db.QrScan.filter({ client_id: cid }, "-at", 5000).catch(() => []);
        return Response.json({ stats: summarize(scans || []) });
      }

      if (action === "qr_tpl_save") {
        const data = { name: str(args.name, 80).trim() || "Untitled template", description: str(args.description, 300), style: styleOf(args.style) };
        if (tooBig(data.style)) return Response.json({ error: "Template is too large" }, { status: 413 });
        if (args.id) {
          const t = await ownQrTpl(args.id);
          if (!t) return Response.json({ error: "Only your own templates can be edited" }, { status: 403 });
          const u = await db.QrTemplate.update(t.id as string, data);
          return Response.json({ template: pick(u, QR_TPL_KEYS) });
        }
        const c = await db.QrTemplate.create({ ...data, scope: "client", client_id: cid, client_name: client.business, portal_visible: true });
        return Response.json({ template: pick(c, QR_TPL_KEYS) });
      }

      if (action === "qr_tpl_delete") {
        const t = await ownQrTpl(args.id);
        if (!t) return Response.json({ error: "Only your own templates can be deleted" }, { status: 403 });
        await db.QrTemplate.delete(t.id as string);
        return Response.json({ ok: true });
      }
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: (e as Error).message || "Server error" }, { status: 500 });
  }
}
