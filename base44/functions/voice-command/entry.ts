import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { COMMAND_SCHEMA, MIN_CONFIDENCE, buildPrompt, cleanCommand, requireAdmin } from "../../shared/assistant.ts";

const itemsOf = (page: any) => (Array.isArray(page) ? page : (page && page.items) || []);

function taskDoc(parsed: any, ctx: any, extra: any) {
  const projectId = parsed.project_id || (extra && extra.project_id) || null;
  const project = ctx.projects.find((p: any) => p.id === projectId);
  const clientId = parsed.client_id || (extra && extra.client_id) || (project && project.client_id) || null;
  const client = ctx.clients.find((cl: any) => cl.id === clientId);
  const status = parsed.status || (projectId ? "next" : "inbox");
  return {
    title: parsed.title,
    category: parsed.category || "ops",
    task_type: parsed.task_type || (clientId ? "billable" : "internal"),
    priority: parsed.priority || 3,
    status,
    due_date: parsed.due_date || null,
    estimated_days: parsed.estimated_days || 0,
    project_id: projectId,
    project_name: project ? project.label : null,
    client_id: clientId,
    client_name: client ? client.label : null,
    labels: parsed.labels || [],
    notes: "Captured by voice command",
    source: "voice",
    ...(status === "done" ? { completed_at: new Date().toISOString() } : {})
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user, denied } = await requireAdmin(base44);
    if (denied) return denied;

    const TODAY = new Date().toISOString().slice(0, 10);
    const body = await req.json().catch(() => ({}));
    const transcript = String(body && body.transcript ? body.transcript : "").trim().slice(0, 600);
    if (!transcript) return Response.json({ error: "transcript is required" }, { status: 400 });

    // Clients come from the CRM (CRMClient.business is the display name).
    const [clientsRes, projectsRes, tasksRes] = await Promise.all([
      base44.entities.CRMClient.filter({ status: { $ne: "Inactive" } }, { limit: 300, sort: "business" }),
      base44.entities.Project.filter({ status: { $ne: "done" } }, { limit: 150, sort: "-updated_date" }),
      base44.entities.Task.filter({ status: { $ne: "done" } }, { sort: "priority", limit: 60 })
    ]);

    const rawClients = itemsOf(clientsRes);
    const rawProjects = itemsOf(projectsRes);
    const rawTasks = itemsOf(tasksRes);

    const ctx = {
      clients: rawClients.map((c: any) => ({ id: c.id, label: c.business || "" })),
      projects: rawProjects.map((p: any) => ({ id: p.id, label: p.title, client_id: p.client_id || null })),
      openTasks: rawTasks.map((t: any) => ({ id: t.id, label: t.title }))
    };

    const board = {
      open_tasks: rawTasks.length,
      inbox: rawTasks.filter((t: any) => t.status === "inbox").length,
      next_up: rawTasks.filter((t: any) => t.status === "next").length,
      in_progress: rawTasks.filter((t: any) => t.status === "doing").length,
      blocked: rawTasks.filter((t: any) => t.status === "blocked").length,
      critical: rawTasks.filter((t: any) => t.priority === 1).length,
      projected_days: rawTasks.reduce((sum: number, t: any) => sum + (t.estimated_days || 0), 0),
      revenue_in_flight: rawProjects.reduce((sum: number, p: any) => sum + (p.contract_value || 0), 0),
      websites_to_build: rawProjects.filter((p: any) => p.type === "website").length,
      apps_to_build: rawProjects.filter((p: any) => p.type === "app").length,
      clients: rawClients.length
    };

    let parsed: any = null;
    try {
      parsed = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: buildPrompt({
          transcript,
          context: { clients: ctx.clients, projects: ctx.projects, openTasks: ctx.openTasks.slice(0, 40) },
          board,
          today: TODAY,
          name: user.full_name
        }),
        response_json_schema: COMMAND_SCHEMA
      });
    } catch (_llmError) {
      parsed = null;
    }

    const c = cleanCommand(parsed, ctx);
    const speech = c.speech || c.answer || "Logged that for you.";
    const shouldQueue = !parsed || c.intent === "unclear" || c.needs_review || c.confidence < MIN_CONFIDENCE;
    const clientLabel = (id: string | null) => {
      const row = ctx.clients.find((cl: any) => cl.id === id);
      return row ? row.label : null;
    };

    if (shouldQueue && (c.task_title || transcript.length > 3)) {
      const queued = await base44.entities.InboxItem.create({
        raw_text: transcript,
        source: "voice",
        status: "needs_review",
        assistant_note: speech,
        confidence: c.confidence,
        suggested_kind: c.intent === "create_client" ? "client" : c.project_title ? "project" : "task",
        suggested_title: c.task_title || c.project_title || transcript.slice(0, 80),
        suggested_category: c.category || "ops",
        suggested_priority: c.priority || 3,
        suggested_due_date: c.due_date || null,
        suggested_estimated_days: c.estimated_days || 0,
        suggested_project_title: c.project_title || null,
        suggested_project_type: c.project_type || null,
        suggested_project_value: c.project_value || 0,
        suggested_client_name: clientLabel(c.client_id) || c.client_name || null,
        captured_on: TODAY
      });
      return Response.json({
        queued: true,
        filed: false,
        kind: "inbox",
        id: queued.id,
        speech: speech + " It is waiting in your inbox for placement."
      });
    }

    if (c.intent === "query" || c.intent === "brief") {
      return Response.json({ queued: false, filed: false, kind: "answer", speech: c.answer || speech, board });
    }

    if (c.intent === "create_client" && c.client_name) {
      // Fuzzy-match first so a known business is not duplicated in the CRM.
      if (c.client_id) {
        return Response.json({
          queued: false,
          filed: false,
          kind: "client",
          id: c.client_id,
          title: clientLabel(c.client_id),
          speech: (clientLabel(c.client_id) || c.client_name) + " is already in your CRM."
        });
      }
      const created = await base44.entities.CRMClient.create({ business: c.client_name, status: "Lead" });
      return Response.json({ queued: false, filed: true, kind: "client", id: created.id, title: created.business, speech });
    }

    if (c.intent === "create_project" && (c.project_title || c.task_title)) {
      const title = c.project_title || c.task_title;
      const created = await base44.entities.Project.create({
        title,
        client_id: c.client_id,
        client_name: clientLabel(c.client_id) || c.client_name,
        type: c.project_type || "website",
        status: "planning",
        priority: c.priority || 2,
        contract_value: c.project_value || 0,
        billing: c.project_value ? "one_time" : "unpaid",
        due_date: c.due_date
      });
      let taskCount = 0;
      if (c.items.length) {
        const docs = c.items.map((item: any) =>
          taskDoc(
            {
              title: item.title,
              category: item.category || c.category,
              priority: item.priority || 3,
              estimated_days: item.estimated_days || 0,
              labels: c.labels
            },
            { ...ctx, projects: [...ctx.projects, { id: created.id, label: created.title, client_id: created.client_id || null }] },
            { project_id: created.id, client_id: created.client_id }
          )
        );
        await base44.entities.Task.bulkCreate(docs);
        taskCount = docs.length;
      }
      return Response.json({ queued: false, filed: true, kind: "project", id: created.id, title: created.title, tasks: taskCount, speech });
    }

    if (c.intent === "update_task" || (c.intent === "log_time" && c.task_id)) {
      const updates: Record<string, unknown> = {};
      if (c.status) {
        updates.status = c.status;
        updates.completed_at = c.status === "done" ? new Date().toISOString() : null;
      }
      if (c.priority) updates.priority = c.priority;
      if (c.due_date) updates.due_date = c.due_date;
      if (c.estimated_days) updates.estimated_days = c.estimated_days;
      if (c.intent === "log_time" && c.hours) updates.logged_hours = c.hours;
      if (c.labels.length) updates.labels = c.labels;
      if (c.task_id && Object.keys(updates).length) {
        const updated = await base44.entities.Task.update(c.task_id, updates);
        return Response.json({ queued: false, filed: true, kind: "task", id: updated.id, title: updated.title, speech });
      }
    }

    if (c.intent === "log_time" && c.hours && (c.project_id || c.project_title)) {
      const project = rawProjects.find((p: any) => p.id === c.project_id);
      if (project) {
        const updated = await base44.entities.Project.update(project.id, {
          logged_hours: (project.logged_hours || 0) + c.hours
        });
        return Response.json({ queued: false, filed: true, kind: "project", id: updated.id, title: updated.title, speech });
      }
    }

    if ((c.intent === "create_task" || c.intent === "create_tasks" || c.task_title) && c.task_title) {
      const docs = c.items.length
        ? c.items.map((item: any) =>
            taskDoc(
              {
                title: item.title,
                category: item.category || c.category,
                priority: item.priority || c.priority,
                estimated_days: item.estimated_days || 0,
                due_date: c.due_date,
                labels: c.labels,
                status: c.status
              },
              ctx,
              { project_id: c.project_id, client_id: c.client_id }
            )
          )
        : [
            taskDoc(
              {
                title: c.task_title,
                category: c.category,
                task_type: c.task_type,
                priority: c.priority,
                status: c.status,
                due_date: c.due_date,
                estimated_days: c.estimated_days,
                labels: c.labels
              },
              ctx,
              { project_id: c.project_id, client_id: c.client_id }
            )
          ];
      const created = itemsOf(await base44.entities.Task.bulkCreate(docs));
      const first = created[0] || docs[0];
      return Response.json({ queued: false, filed: true, kind: "task", id: first.id || null, title: first.title, count: docs.length, speech });
    }

    const queued = await base44.entities.InboxItem.create({
      raw_text: transcript,
      source: "voice",
      status: "needs_review",
      assistant_note: speech,
      confidence: c.confidence,
      suggested_title: c.task_title || transcript.slice(0, 80),
      suggested_category: c.category || "ops",
      suggested_priority: c.priority || 3,
      suggested_client_name: clientLabel(c.client_id) || c.client_name || null,
      captured_on: TODAY
    });
    return Response.json({
      queued: true,
      filed: false,
      kind: "inbox",
      id: queued.id,
      speech: speech + " I parked it in your inbox so you can place it."
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
