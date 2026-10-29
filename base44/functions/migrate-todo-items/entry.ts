// One-time, idempotent migration: ToDoItem -> Task.
// Admin only. Each created Task carries the label "legacy:<ToDoItem.id>"; any ToDoItem whose
// label already exists on a Task is skipped, so re-running is safe.
// POST {} to migrate; POST { "dry_run": true } to preview without writing.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { requireAdmin } from "../../shared/assistant.ts";

const itemsOf = (page: any) => (Array.isArray(page) ? page : (page && page.items) || []);

async function listAll(entity: any, options: Record<string, unknown> = {}) {
  const rows: any[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 100; guard += 1) {
    const page: any = await entity.list(cursor ? { ...options, cursor } : { ...options, limit: 500 });
    rows.push(...itemsOf(page));
    cursor = page && page.next_cursor ? page.next_cursor : null;
    if (!cursor || !(page && page.has_more !== false)) break;
  }
  return rows;
}

const clean = (v: unknown) =>
  String(v || "")
    .replace(/\([^)]*\)/g, " ") // drop "(Molalla)" style suffixes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function matchClient(assignedTo: string, clients: { id: string; business: string; key: string }[]) {
  const parts = String(assignedTo || "")
    .split(/\s+x\s+/i) // "Bobablastic x Bulba Bros" -> take the first part that matches
    .map(clean)
    .filter(Boolean);
  for (const part of parts) {
    const exact = clients.find((c) => c.key === part);
    if (exact) return exact;
    const loose = clients.find((c) => c.key && (c.key.includes(part) || part.includes(c.key)));
    if (loose) return loose;
  }
  return null;
}

function categoryFor(taskType: unknown) {
  const t = String(taskType || "");
  if (/website|app|førge|forge/i.test(t)) return "development";
  if (/gbp|seo/i.test(t)) return "marketing";
  if (/internal/i.test(t)) return "admin";
  return "ops";
}

function isoDay(value: unknown) {
  const s = String(value || "").trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  const d = new Date(m[1] + "T12:00:00Z");
  return isNaN(d.getTime()) ? null : m[1];
}

function isoStamp(value: unknown) {
  if (!value) return null;
  const s = String(value).trim();
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + "T12:00:00Z" : s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function estimate(amount: unknown, unit: unknown) {
  const n = Number(amount) || 0;
  if (!n) return {};
  switch (unit) {
    case "Minutes":
      return { estimated_hours: Math.round((n / 60) * 100) / 100 };
    case "Hours":
      return { estimated_hours: n };
    case "Days":
      return { estimated_days: n };
    case "Weeks":
      return { estimated_days: n * 5 };
    case "Months":
      return { estimated_days: n * 21 };
    default:
      return {};
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { denied } = await requireAdmin(base44);
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    const dryRun = !!(body && body.dry_run);

    const [todos, tasks, crm] = await Promise.all([
      listAll(base44.entities.ToDoItem, { sort: "created_date" }),
      listAll(base44.entities.Task, { fields: ["id", "labels"] }),
      listAll(base44.entities.CRMClient, { fields: ["id", "business"] })
    ]);

    const migrated = new Set<string>();
    for (const task of tasks) {
      for (const label of Array.isArray(task.labels) ? task.labels : []) {
        if (typeof label === "string" && label.startsWith("legacy:")) migrated.add(label.slice(7));
      }
    }

    const clients = crm.map((c: any) => ({ id: c.id, business: c.business || "", key: clean(c.business) }));

    const docs: any[] = [];
    const unmatched = new Set<string>();
    let skipped = 0;
    let matchedClients = 0;
    const statusCounts: Record<string, number> = {};

    for (const item of todos) {
      if (migrated.has(item.id)) {
        skipped += 1;
        continue;
      }

      const isDone = item.done === true || item.status === "Completed";
      const inProgress = !isDone && item.status === "In Progress";
      const isPriority = item.category !== "NextUp"; // default category is Priority
      const status = isDone ? "done" : inProgress ? "doing" : isPriority ? "next" : "inbox";
      const priority = isPriority ? 2 : 3;

      const assigned = String(item.assignedTo || "").trim();
      const internal = !assigned || /^interstellar\b/i.test(assigned);
      const client = internal ? null : matchClient(assigned, clients);
      if (client) matchedClients += 1;
      if (!internal && !client) unmatched.add(assigned);

      const noteParts = [item.description || ""];
      if (!internal && !client) noteParts.push("Assigned to: " + assigned);
      if (Number(item.price)) noteParts.push("Price: $" + Number(item.price));
      const notes = noteParts.filter(Boolean).join("\n\n") || null;

      const doc: Record<string, unknown> = {
        title: item.title || "(untitled)",
        notes,
        status,
        priority,
        is_focus: inProgress,
        category: categoryFor(item.taskType),
        task_type: internal ? "internal" : "billable",
        source: "manual",
        labels: ["legacy:" + item.id],
        ...estimate(item.estimatedAmount, item.estimatedUnit)
      };
      const due = isoDay(item.dueDate);
      if (due) doc.due_date = due;
      if (isDone) {
        const completed = isoStamp(item.completedDate);
        if (completed) doc.completed_at = completed;
      }
      if (client) {
        doc.client_id = client.id;
        doc.client_name = client.business;
      }

      statusCounts[status] = (statusCounts[status] || 0) + 1;
      docs.push(doc);
    }

    let created = 0;
    if (!dryRun) {
      for (let i = 0; i < docs.length; i += 50) {
        const chunk = docs.slice(i, i + 50);
        await base44.entities.Task.bulkCreate(chunk);
        created += chunk.length;
      }
    }

    return Response.json({
      dry_run: dryRun,
      todo_items: todos.length,
      already_migrated: skipped,
      to_create: docs.length,
      created,
      matched_clients: matchedClients,
      internal: docs.filter((d) => d.task_type === "internal").length,
      by_status: statusCounts,
      unmatched_assignees: Array.from(unmatched),
      sample: dryRun ? docs.slice(0, 5) : undefined
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
