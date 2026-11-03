// Nøva (client portal agent): shared scoping + data helpers.
//
// SECURITY MODEL
// - Every client table is admin-only RLS. The assistant never gets entity tools; it only calls the
//   assistant* backend functions, which import this module.
// - Base44 agents act as the current app user, so each tool call carries the portal user's own login.
//   resolvePortalClient() resolves the client from that login exactly like the `portal` function does
//   (CRMClient.portal_enabled + portal_emails). Anything the model passes as client_id is IGNORED for
//   non-admins, so a prompt-injected "use client X" can never cross clients.
// - Admins (Justin) previewing a client's portal: client_id from the call, else the preview_client_id
//   stored on the admin's latest assistant conversation (set by the portal UI in preview mode).
// - No signed-in user (e.g. if a call ever arrived without auth) => 401. It fails closed.
// - Everything returned is filtered with the same rules as the portal: portal_visible, no internal
//   notes, no admin_notes, no prices/contract values, site score only when >= 70.

type Row = Record<string, any>;

export const AGENT_NAME = "interstellar_assistant";

export const pick = (o: Row, keys: string[]) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined && o?.[k] !== null && o?.[k] !== "").map((k) => [k, o[k]]));
export const visible = (r: Row) => r?.portal_visible !== false;
export const today = () => new Date().toISOString().slice(0, 10);
// Every result carries today's date so the agent can resolve "next Friday" without guessing.
export const json = (body: unknown, status = 200) =>
  Response.json(body && typeof body === "object" && !Array.isArray(body) ? { ...(body as Row), today: today() } : body, { status });
export const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const str = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

// ---- Client resolution (mirrors base44/functions/portal/entry.ts) ----
export type Ctx = {
  user: Row; client: Row; cid: string; db: any; preview: boolean;
  by: (entity: string, sort?: string, limit?: number) => Promise<Row[]>;
};

export async function resolvePortalClient(base44: any, body: Row = {}): Promise<{ error: Response } | Ctx> {
  const user = await base44.auth.me().catch(() => null);
  if (!user) return { error: json({ error: "Not signed in" }, 401) };
  const db = base44.asServiceRole.entities;
  let client: Row | null = null;
  let preview = false;
  if (user.role === "admin") {
    let asClient = body?.client_id || body?.preview_client_id || "";
    if (!asClient) {
      // The agent never knows the client id; the preview UI stores it on the admin's conversation.
      try {
        const convs = await base44.agents.listConversations({ sort: "-updated_date", limit: 20 });
        const list = (Array.isArray(convs) ? convs : (convs?.data || [])) as Row[];
        const c = list.find((x) => x.agent_name === AGENT_NAME && x.metadata?.preview_client_id);
        asClient = c?.metadata?.preview_client_id || "";
      } catch { /* no conversations */ }
    }
    if (asClient) {
      client = await db.CRMClient.get(String(asClient)).catch(() => null);
      preview = !!client;
    }
    if (!client) return { error: json({ error: "Admin: open the assistant from a client's portal preview so it knows which client to act as.", code: "no_client" }, 403) };
  } else {
    const email = String(user.email || "").toLowerCase();
    const all = await db.CRMClient.filter({ portal_enabled: true }, "business", 500);
    client = (all || []).find((c: Row) => ((c.portal_emails as string[]) || []).some((e) => String(e).toLowerCase() === email)) || null;
    if (!client) return { error: json({ error: "No portal is set up for this login yet.", code: "no_client" }, 403) };
  }
  const cid = client.id as string;
  const by = (entity: string, sort = "-created_date", limit = 500): Promise<Row[]> =>
    db[entity].filter({ client_id: cid }, sort, limit).then((r: Row[]) => r || []).catch(() => [] as Row[]);
  return { user, client: client as Row, cid, db, by, preview };
}

// ---- Site health: mirrors clientHealthSummary() in src/features/performance/policy.js ----
const CLIENT_SCORE_FLOOR = 70;
const EDIT_WORK_KINDS = ["site_edit", "schema", "new_page", "project_page", "search_console", "bing"];
const bandLabel = (s: number | null) => (s == null ? "No data" : s >= 90 ? "Excellent" : s >= 75 ? "Good" : s >= 50 ? "Needs work" : "Poor");
export function clientHealthSummary({ audits = [], fixes = [], work = [] }: { audits?: Row[]; fixes?: Row[]; work?: Row[] }) {
  const done = audits.filter((a) => typeof a.health_score === "number" && a.strategy !== "desktop").sort((a, b) => String(a.run_at).localeCompare(String(b.run_at)));
  const latest = done[done.length - 1] || null;
  const score = (latest?.health_score as number | undefined) ?? null;
  const show = score != null && score >= CLIENT_SCORE_FLOOR;
  return {
    score: show ? score : null,
    band: show ? bandLabel(score) : score != null ? "Improving" : null,
    fixes_applied: fixes.filter((f) => f.status === "applied" && f.portal_visible !== false).length,
    edits_made: work.filter((w) => EDIT_WORK_KINDS.includes(String(w.kind)) && w.status !== "failed" && w.portal_visible !== false).length,
    last_checked: latest?.run_at || null,
  };
}

const portalKit = (kits: Row[]) => {
  const k = kits.filter((x) => x.status === "approved").sort((a, b) => (Number(b.version) || 0) - (Number(a.version) || 0))[0];
  return k && k.portal_visible === true ? k : null;
};

export const WORK_LABELS: Record<string, string> = {
  blog: "Blog post", gbp_post: "Google Business post", site_edit: "Website update", project_page: "Project page", new_page: "New page",
  citation: "Directory listing", press: "Press feature", mention: "Brand mention", backlink: "Backlink", schema: "Search markup (schema)",
  search_console: "Google Search Console", bing: "Bing Webmaster", analytics: "Analytics", report: "Report", presentation: "Presentation",
  deliverable: "Deliverable", design: "Design", automation_setup: "Automation", other: "Other work",
};

// ---- Request types: copy of REQUEST_TYPES in src/features/requests/formSchema.js (kinds, labels, field labels) ----
// formSchema.js is the source of truth; keep this list in sync when a type is added.
export const REQUEST_KINDS: Record<string, { label: string; noDue?: boolean; fields: Record<string, string> }> = {
  site_edit: { label: "Website edit", fields: { page: "Which page? (name or URL)", change: "What should change?", current: "What it says now (if replacing text)" } },
  new_page: { label: "New page", fields: { page_name: "Page name", purpose: "What is it for?", content: "Everything the page should say", cta: "What should visitors do?", example: "A page you like the look of (optional)" } },
  blog_post: { label: "Blog / content", fields: { topic: "Topic or title idea", content_type: "Type", points: "Key points, offers or facts to include", keywords: "Words people search for (if you know)", audience: "Who is it for?" } },
  gbp_post: { label: "Google post", fields: { topic: "What's the post about?", post_type: "Post type", details: "Details", offer_dates: "Offer or event dates", button: "Button" } },
  social_post: { label: "Social post", fields: { platforms: "Where?", topic: "What's it about?", caption: "Caption ideas or must-say details" } },
  design_asset: { label: "Design asset", fields: { asset_type: "What do you need?", purpose: "What's it for and what should it say?", size: "Size or format", style: "Style notes or examples you like" } },
  email_signature: { label: "Email signature", fields: { people: "Who needs one? Name, title, phone and email for each", changes: "Anything to add or change (banner, social links, promo)" } },
  seo_question: { label: "SEO question", noDue: true, fields: { topic: "About", question: "Your question", keyword_or_url: "Keyword or page it's about (optional)" } },
  bug: { label: "Something's broken", fields: { where: "Where is it? (page, URL or app screen)", what: "What happened?", expected: "What should happen instead?", device: "Device", browser: "Browser", since: "When did it start?" } },
  app_edit: { label: "App / automation", fields: { area: "Which part?", change: "What should it do differently?", why: "What problem does this solve?" } },
  billing: { label: "Billing", noDue: true, fields: { topic: "About", invoice: "Invoice number (if any)", question: "Your question" } },
  question: { label: "Question", noDue: true, fields: { question: "Your question" } },
  other: { label: "Other", fields: { summary: "What do you need?", details: "Details" } },
};
export const kindLabel = (k: string) => REQUEST_KINDS[k]?.label || String(k || "other").replace(/_/g, " ");
export const OPEN_STATUSES = ["received", "in_progress", "needs_info"];
// Clients may change a request only before work starts (received) or while we're waiting on them (needs_info).
export const CLIENT_EDITABLE = ["received", "needs_info"];
const STATUS_LABEL: Record<string, string> = { received: "Received (in the queue)", in_progress: "In progress", needs_info: "Waiting on you for info", complete: "Complete", declined: "Declined" };

export const requestOut = (r: Row) => ({
  ...pick(r, ["id", "title", "details", "priority", "due_date", "client_note", "page_url", "created_date", "completed_at"]),
  type: kindLabel(String(r.kind)),
  kind: r.kind,
  status: r.status,
  status_label: STATUS_LABEL[String(r.status)] || r.status,
  client_can_edit: CLIENT_EDITABLE.includes(String(r.status)),
});

// ---- Reviews + QR (cached values only; never another client's rows) ----
async function googleProfile(ctx: Ctx) {
  const rows = ((await ctx.db.ReviewClient.filter({ crm_client_id: ctx.cid }).catch(() => [])) || []).filter((r: Row) => r.active !== false && r.slug) as Row[];
  return rows.map((r) => {
    const c = (r.cache || {}) as Row;
    const placeId = String(r.place_id || "");
    const name = String(r.name || c.businessName || ctx.client.business || "");
    return {
      location: name.includes(" — ") ? name.split(" — ").slice(1).join(" — ") : name,
      rating: typeof c.rating === "number" ? c.rating : null,
      review_count: typeof c.total === "number" ? c.total : null,
      review_link: String(c.reviewUrl || (placeId ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}` : "")) || null,
      maps_link: c.mapsUrl || (placeId ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}` : null),
      as_of: r.cached_at || null,
    };
  });
}

async function qrSummary(ctx: Ctx) {
  const [codes, scans] = await Promise.all([
    ctx.by("QrCode", "-updated_date", 300),
    ctx.db.QrScan.filter({ client_id: ctx.cid }, "-at", 5000).catch(() => [] as Row[]),
  ]);
  const since = daysAgo(30);
  return {
    codes: codes.length,
    scans_all_time: (scans || []).length,
    scans_last_30_days: (scans || []).filter((s: Row) => String(s.at || s.created_date || "") >= since).length,
    list: codes.slice(0, 25).map((q: Row) => ({
      name: q.name, type: q.mode === "dynamic" ? "Dynamic (can be re-pointed)" : "Static",
      points_to: q.mode === "dynamic" ? q.destination : (q.url || q.content_type), short_link: q.encoded_url || null,
      scans: q.scans || 0, active: q.active !== false,
    })),
  };
}

const projectOut = (p: Row) => pick(p, ["title", "type", "status", "progress", "due_date", "description"]);
const milestoneOut = (t: Row) => pick(t, ["title", "due_date", "status", "project_name"]);

// ---- Briefing facts: only what the portal already shows ----
export async function gatherBriefing(ctx: Ctx, days = 30) {
  const since = daysAgo(Math.max(1, Math.min(180, Number(days) || 30)));
  const [work, reqs, tasks, projects, audits, fixes, autos, msgs, intakes, google, qr] = await Promise.all([
    ctx.by("WorkLog", "-date", 400), ctx.by("ClientRequest", "-created_date", 300), ctx.by("Task", "due_date", 300), ctx.by("Project", "-updated_date", 100),
    ctx.by("SiteAudit", "-run_at", 60), ctx.by("SeoFix", "-updated_date", 500), ctx.by("Automation", "-created_date", 100),
    ctx.by("ConversationMessage", "-created_date", 200), ctx.by("IntakeAudit", "-created_date", 5), googleProfile(ctx), qrSummary(ctx),
  ]);
  const shown = work.filter(visible).filter((w: Row) => w.status !== "failed");
  const recent = shown.filter((w: Row) => String(w.date || w.created_date || "") >= since);
  const counts: Record<string, number> = {};
  for (const w of recent) { const l = WORK_LABELS[String(w.kind)] || "Other work"; counts[l] = (counts[l] || 0) + 1; }
  const fixesInWindow = fixes.filter((f: Row) => f.status === "applied" && f.portal_visible !== false && String(f.updated_date || "") >= since).length;
  const open = reqs.filter((r: Row) => OPEN_STATUSES.includes(String(r.status)));
  const doneReqs = reqs.filter((r: Row) => r.status === "complete" && String(r.completed_at || r.updated_date || "") >= since);
  const intake = intakes[0];
  const health = clientHealthSummary({ audits, fixes, work });
  return {
    business: ctx.client.business,
    period: { from: since, to: today(), days: Number(days) || 30 },
    work_done: {
      total: recent.length,
      by_type: counts,
      seo_fixes_applied: fixesInWindow,
      items: recent.slice(0, 15).map((w: Row) => ({ type: WORK_LABELS[String(w.kind)] || "Work", title: w.title, date: w.date || null, url: w.url || null, live: w.status === "live" || w.verified_live === true })),
      all_time_logged: shown.length,
    },
    requests: {
      open: open.slice(0, 12).map(requestOut),
      completed_in_period: doneReqs.slice(0, 10).map((r: Row) => ({ title: r.title, completed_at: r.completed_at || null, page_url: r.page_url || null })),
    },
    projects: projects.filter((p: Row) => p.portal_visible !== false && ["planning", "in_progress", "review", "launched"].includes(String(p.status))).slice(0, 8).map(projectOut),
    upcoming_milestones: tasks.filter((t: Row) => t.portal_visible === true && t.status !== "done").slice(0, 8).map(milestoneOut),
    results: {
      // score is null whenever it's below 70: say "we're actively improving it", never a number.
      site_health: { score: health.score, band: health.band, last_checked: health.last_checked, fixes_applied_all_time: health.fixes_applied },
      google_profile: google.map((g) => ({ location: g.location, rating: g.rating, review_count: g.review_count })),
      qr_scans_last_30_days: qr.scans_last_30_days,
      qr_scans_all_time: qr.scans_all_time,
    },
    running_for_you: {
      // Client-facing plan names only (internal keys like orbit_seo must never leak: the only plans are HyperCare+ and GravïtyCare).
      services: (ctx.client.services_managed || []).map((s: string) => (({ website: "Custom Website", system: "Command System", orbit_seo: "HyperCare+", brand: "Brand Arsenal", starship_care: "GravïtyCare" } as Record<string, string>)[s] || String(s).replace(/_/g, " "))),
      automations: autos.filter(visible).filter((a: Row) => a.status === "active").map((a: Row) => a.name),
    },
    waiting_on_you: [
      ...reqs.filter((r: Row) => r.status === "needs_info").map((r: Row) => ({ what: `Info needed on request "${r.title}"`, note: r.client_note || null, request_id: r.id })),
      ...(!intake || intake.status === "in_progress" ? [{ what: "Business audit questionnaire isn't submitted yet (Home > Tell us about your business)", note: null }] : []),
      ...(() => { const n = msgs.filter((m: Row) => m.sender_role === "admin" && !m.read_at).length; return n ? [{ what: `${n} unread message${n === 1 ? "" : "s"} from Justin in Messages`, note: null }] : []; })(),
    ],
  };
}

// ---- Quick facts ----
export async function quickFacts(ctx: Ctx, topic: string) {
  const t = String(topic || "all").toLowerCase();
  const want = (k: string) => t === "all" || t === k;
  const out: Row = {};
  if (want("review_link")) {
    const g = await googleProfile(ctx);
    out.review_link = g.length ? g.map((x) => ({ location: x.location, review_link: x.review_link, maps_link: x.maps_link, rating: x.rating, review_count: x.review_count })) : "No Google Business Profile is connected in the portal yet.";
  }
  if (want("brand_kit")) {
    const k = portalKit(await ctx.by("BrandKit", "-version", 20));
    out.brand_kit = k ? { version: k.version, summary: k.summary || null, details: str(k.body_md, 3000) || null, where: "Brand kit tab" } : "No brand kit is published to the portal yet.";
  }
  if (want("playbook")) {
    const p = portalKit(await ctx.by("IndustryPlaybook", "-version", 20));
    out.playbook = p ? { version: p.version, summary: p.summary || null, details: str(p.body_md, 3000) || null, where: "Playbook tab" } : "No playbook is published to the portal yet.";
  }
  if (want("qr_codes")) out.qr_codes = await qrSummary(ctx);
  if (want("signatures")) {
    const sigs = await ctx.db.Signature.filter({ client_id: ctx.cid }, "-updated_date", 100).catch(() => []);
    out.signatures = { count: (sigs || []).length, list: (sigs || []).slice(0, 25).map((s: Row) => ({ name: s.name, updated: s.updated_date || null })), where: "Signatures tab (free bonus tool)" };
  }
  if (want("milestones")) {
    const [projects, tasks] = await Promise.all([ctx.by("Project", "-updated_date", 100), ctx.by("Task", "due_date", 300)]);
    out.milestones = {
      projects: projects.filter((p: Row) => p.portal_visible !== false && ["proposed", "backlog", "planning", "in_progress", "review"].includes(String(p.status))).map(projectOut),
      upcoming: tasks.filter((x: Row) => x.portal_visible === true && x.status !== "done").slice(0, 12).map(milestoneOut),
    };
  }
  return out;
}

// ---- Requests ----
export function buildRequest(args: Row) {
  const kind = REQUEST_KINDS[String(args.kind)] ? String(args.kind) : "other";
  const spec = REQUEST_KINDS[kind];
  const raw = args.fields && typeof args.fields === "object" && !Array.isArray(args.fields) ? args.fields as Row : {};
  const fields: Row = {};
  for (const [k, v] of Object.entries(raw).slice(0, 30)) {
    if (v == null || v === "") continue;
    fields[k.replace(/[^a-z0-9_]/gi, "").slice(0, 40)] = Array.isArray(v) ? v.slice(0, 20).map((x) => str(x, 300)) : str(v, 4000);
  }
  const answers = Object.entries(fields).map(([id, value]) => ({ id, label: spec.fields[id] || id.replace(/_/g, " "), type: Array.isArray(value) ? "multi_select" : "short_text", value }));
  const pr = String(args.priority || "").toLowerCase();
  const priority = ["low", "high", "urgent"].includes(pr) ? pr : "normal";
  const due = String(args.due_date || "");
  const dueOk = !spec.noDue && /^\d{4}-\d{2}-\d{2}$/.test(due) && due >= today();
  let title = str(args.title, 160);
  if (!title) {
    const first = Object.values(fields).find((v) => typeof v === "string") as string | undefined;
    title = first ? `${spec.label}: ${first.replace(/\s+/g, " ").slice(0, 90)}` : spec.label;
  }
  const details = str(args.details, 8000) || answers.map((a) => `${a.label}: ${Array.isArray(a.value) ? a.value.join(", ") : a.value}`).join("\n");
  return { kind, title, details, fields, answers, priority, due_date: dueOk ? due : null };
}
