import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Client portal API. Every table is admin-only, so portal users never touch entities directly:
// this function finds the client their login belongs to and returns only that client's
// portal-visible records. Admins can pass client_id to preview any client's portal.

const SAFE_CLIENT = ["id", "business", "contact", "domain", "websites", "plan", "services_managed", "industry", "location", "logoUrl", "logo_url", "started_on"];
const pick = (o: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));
const visible = (r: Record<string, unknown>) => r.portal_visible !== false;
const REQ_KINDS = ["site_edit", "project_submission", "job", "new_page", "question", "app_edit", "other"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const { action = "home", client_id: asClient, ...args } = body || {};
    const db = base44.asServiceRole.entities;

    // Resolve the client this user may see.
    let client: Record<string, unknown> | null = null;
    if (user.role === "admin" && asClient) {
      client = await db.CRMClient.get(asClient).catch(() => null);
    } else {
      const email = String(user.email || "").toLowerCase();
      const all = await db.CRMClient.filter({ portal_enabled: true }, "business", 500);
      client = (all || []).find((c: Record<string, unknown>) => ((c.portal_emails as string[]) || []).some((e) => String(e).toLowerCase() === email)) || null;
    }
    if (!client) return Response.json({ error: "No portal is set up for this login yet.", code: "no_client" }, { status: 403 });
    const cid = client.id as string;
    const by = (entity: string, sort = "-created_date", limit = 500) => db[entity].filter({ client_id: cid }, sort, limit).then((r: unknown[]) => r || []);

    if (action === "home") {
      const [work, autos, reqs, goals, gaps, snaps, tasks, files] = await Promise.all([
        by("WorkLog", "-date", 400), by("Automation"), by("ClientRequest"), by("ClientGoal", "sort"), by("ClientGap"),
        by("PerformanceSnapshot", "-period_end", 60), by("Task", "due_date", 200), by("ClientFile", "-delivered_on", 200),
      ]);
      const msgs = await by("ConversationMessage", "-created_date", 200);
      return Response.json({
        client: pick(client, SAFE_CLIENT),
        user: { email: user.email, name: user.full_name, is_admin_preview: user.role === "admin" },
        work: work.filter(visible).filter((w: Record<string, unknown>) => w.status !== "failed").map((w: Record<string, unknown>) => pick(w, ["id", "kind", "title", "url", "date", "description", "status", "verified_live"])),
        automations: autos.filter(visible).filter((a: Record<string, unknown>) => a.status === "active").map((a: Record<string, unknown>) => pick(a, ["id", "name", "kind", "schedule", "last_run_at", "runs_count"])),
        requests: reqs.map((r: Record<string, unknown>) => pick(r, ["id", "kind", "title", "details", "status", "client_note", "page_status", "page_url", "created_date", "completed_at", "attachments"])),
        goals: goals.map((g: Record<string, unknown>) => pick(g, ["id", "year", "title", "metric", "baseline_value", "target_value", "current_value", "unit", "status", "plan_steps"])),
        gaps: gaps.filter(visible).map((g: Record<string, unknown>) => pick(g, ["id", "title", "area", "severity", "status", "recommendation", "impact"])),
        snapshots: snaps.map((s: Record<string, unknown>) => pick(s, ["id", "source", "period_start", "period_end", "metrics"])),
        upcoming: tasks.filter((t: Record<string, unknown>) => t.portal_visible === true && t.status !== "done").map((t: Record<string, unknown>) => pick(t, ["id", "title", "due_date", "status"])),
        files: files.filter(visible).map((f: Record<string, unknown>) => pick(f, ["id", "title", "category", "file_url", "link_url", "description", "delivered_on"])),
        future: (await by("Project")).filter((p: Record<string, unknown>) => p.portal_visible !== false && ["proposed", "backlog", "planning", "in_progress", "review"].includes(String(p.status))).map((p: Record<string, unknown>) => pick(p, ["id", "title", "type", "status", "description", "progress", "due_date"])),
        unread: msgs.filter((m: Record<string, unknown>) => m.sender_role === "admin" && !m.read_at).length,
      });
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
      return Response.json({ forms: forms.map((f: Record<string, unknown>) => pick(f, ["id", "kind", "title", "intro", "fields"])) });
    }

    if (action === "create_request") {
      const kind = REQ_KINDS.includes(String(args.kind)) ? String(args.kind) : "other";
      const title = String(args.title || "").trim().slice(0, 200);
      if (!title) return Response.json({ error: "Add a title" }, { status: 400 });
      const r = await db.ClientRequest.create({
        client_id: cid, client_name: client.business, kind, title,
        details: String(args.details || "").slice(0, 8000),
        attachments: Array.isArray(args.attachments) ? args.attachments.slice(0, 20).map(String) : [],
        fields: typeof args.fields === "object" && args.fields ? args.fields : {},
        answers: Array.isArray(args.answers) ? args.answers.slice(0, 60) : [],
        form_id: args.form_id ? String(args.form_id) : null, form_title: args.form_title ? String(args.form_title).slice(0, 120) : null,
        source: "portal", contact_email: user.email,
        status: "received", priority: args.priority === "urgent" ? "urgent" : "normal",
        submitted_by: user.email, page_status: ["project_submission", "job"].includes(kind) ? "queued" : "none",
      });
      return Response.json({ request: pick(r, ["id", "kind", "title", "status", "created_date"]) });
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

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: (e as Error).message || "Server error" }, { status: 500 });
  }
});
