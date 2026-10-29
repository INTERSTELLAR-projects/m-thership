export const TASK_CATEGORIES = ["design", "development", "strategy", "content", "marketing", "sales", "admin", "finance", "ops"];
export const PROJECT_TYPES = ["website", "app", "branding", "marketing", "seo", "automation", "consulting", "internal", "other"];
export const TASK_STATUSES = ["inbox", "next", "doing", "blocked", "done"];
export const INTENTS = ["create_task", "create_tasks", "create_project", "create_client", "update_task", "log_time", "query", "brief", "unclear"];

// Below this confidence a parsed command is parked in the voice inbox instead of filed.
export const MIN_CONFIDENCE = 0.55;

export const COMMAND_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: INTENTS },
    speech: { type: "string" },
    answer: { type: "string" },
    confidence: { type: "number" },
    needs_review: { type: "boolean" },
    client_name: { type: "string" },
    client_id: { type: "string" },
    project_title: { type: "string" },
    project_id: { type: "string" },
    project_type: { type: "string", enum: PROJECT_TYPES },
    project_value: { type: "number" },
    task_title: { type: "string" },
    task_id: { type: "string" },
    category: { type: "string", enum: TASK_CATEGORIES },
    task_type: { type: "string", enum: ["billable", "internal", "unpaid", "personal"] },
    priority: { type: "number" },
    status: { type: "string", enum: TASK_STATUSES },
    due_date: { type: "string" },
    estimated_days: { type: "number" },
    hours: { type: "number" },
    labels: { type: "array", items: { type: "string" } },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          category: { type: "string" },
          priority: { type: "number" },
          estimated_days: { type: "number" }
        },
        required: ["title"]
      }
    }
  },
  required: ["intent", "speech"]
};

export function buildPrompt(input: any) {
  return [
    "You are the Interstellar Command assistant: a calm, precise operations narrator for a creative agency owner.",
    "You convert one spoken utterance into one structured operation on his work system (clients, projects, tasks).",
    "",
    "Today is " + input.today + ". The owner is " + (input.name || "the operator") + ".",
    "",
    'He says: "' + input.transcript + '"',
    "",
    "His current clients (CRM businesses): " + JSON.stringify(input.context.clients),
    "His open projects: " + JSON.stringify(input.context.projects),
    "His open tasks: " + JSON.stringify(input.context.openTasks),
    "Board snapshot: " + JSON.stringify(input.board),
    "",
    "Rules:",
    "- Task categories: " + TASK_CATEGORIES.join(", ") + ". Project types: " + PROJECT_TYPES.join(", ") + ".",
    "- Statuses: inbox (unsorted), next (queued), doing, blocked, done.",
    "- Priority is 1 (critical) to 4 (low). Default 3 unless he stresses urgency.",
    "- due_date must be YYYY-MM-DD; resolve relative phrases ('tomorrow', 'friday', 'next week') against today.",
    "- Reuse an existing client_id / project_id from the lists above when his words clearly match one, otherwise leave the id empty and give the name/title so a new one can be matched or created.",
    "- If he dictates several tasks at once, use create_tasks and put each one in items.",
    "- If he asks a question about his workload or what to focus on, use intent 'query' and answer it in 'answer' using the board snapshot and open tasks.",
    "- If he asks for a briefing, use intent 'brief' and write 2-3 spoken sentences in 'answer' naming the one thing to do next.",
    "- Never name a blocked task as the thing to do next. If the most urgent work is blocked, say what it is waiting on and name the strongest unblocked task instead.",
    "- If the utterance is too vague to place anywhere safely, use intent 'unclear' and set needs_review true.",
    "- 'speech' is what you say back out loud: one or two short sentences, plain words, no markdown, no emoji, no lists. Address him directly. If you filed the work, say where. If you parked it in the inbox, say so plainly.",
    "- Set confidence between 0 and 1 for how certain you are about the destination.",
    "Return only the JSON object."
  ].join("\n");
}

const norm = (v: any) => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function matchId(value: any, list: { id: string; label: string }[]) {
  const key = norm(value);
  if (!key) return null;
  let found = list.find((row) => norm(row.label) === key);
  if (!found) found = list.find((row) => norm(row.label) && (norm(row.label).includes(key) || key.includes(norm(row.label))));
  return found ? found.id : null;
}

export function cleanCommand(raw: any, ctx: any) {
  const src = raw && typeof raw === "object" ? raw : {};
  const text = (v: any) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: any) => (typeof v === "number" && isFinite(v) ? v : null);
  const iso = (v: any) => (text(v) && /^\d{4}-\d{2}-\d{2}$/.test(text(v) as string) ? text(v) : null);

  const intent = INTENTS.includes(src.intent) ? src.intent : "unclear";
  const clientId =
    (text(src.client_id) && ctx.clients.some((c: any) => c.id === src.client_id) ? src.client_id : null) ||
    matchId(src.client_name, ctx.clients);
  const projectId =
    (text(src.project_id) && ctx.projects.some((p: any) => p.id === src.project_id) ? src.project_id : null) ||
    matchId(src.project_title, ctx.projects) ||
    matchId(raw && raw.task_title, ctx.projects);
  const taskId =
    (text(src.task_id) && ctx.openTasks.some((t: any) => t.id === src.task_id) ? src.task_id : null) ||
    matchId(text(src.task_title), ctx.openTasks);

  const items = Array.isArray(src.items)
    ? src.items
        .slice(0, 12)
        .map((item: any) => ({
          title: text(item && item.title),
          category: TASK_CATEGORIES.includes(item && item.category) ? item.category : null,
          priority: num(item && item.priority) ? Math.min(4, Math.max(1, Math.round(item.priority))) : null,
          estimated_days: num(item && item.estimated_days)
        }))
        .filter((item: any) => item.title)
    : [];

  return {
    intent,
    speech: text(src.speech),
    answer: text(src.answer),
    confidence: num(src.confidence) ?? 0.5,
    needs_review: src.needs_review === true,
    client_name: text(src.client_name),
    client_id: clientId,
    project_title: text(src.project_title),
    project_id: projectId,
    project_type: PROJECT_TYPES.includes(src.project_type) ? src.project_type : null,
    project_value: num(src.project_value),
    task_title: text(src.task_title) || (projectId && intent === "create_task" ? null : text(raw && raw.task_title)),
    task_id: taskId,
    category: TASK_CATEGORIES.includes(src.category) ? src.category : null,
    task_type: ["billable", "internal", "unpaid", "personal"].includes(src.task_type) ? src.task_type : null,
    priority: num(src.priority) ? Math.min(4, Math.max(1, Math.round(src.priority))) : null,
    status: TASK_STATUSES.includes(src.status) ? src.status : null,
    due_date: iso(src.due_date),
    estimated_days: num(src.estimated_days),
    hours: num(src.hours),
    labels: Array.isArray(src.labels) ? src.labels.filter((l: any) => typeof l === "string").slice(0, 6) : [],
    items
  };
}

// Shared admin gate: every task-engine function is admin-only.
export async function requireAdmin(base44: any) {
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") return { user: null, denied: Response.json({ error: "Forbidden" }, { status: 403 }) };
  return { user, denied: null };
}
