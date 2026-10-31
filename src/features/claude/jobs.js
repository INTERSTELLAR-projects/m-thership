// Send to Claude: Justin authorizes a step with a click, a Claude scheduled task does it,
// and nothing is final until he approves the result here.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export const JOB_STATUS = {
  queued: { label: "Queued", tone: "bg-ink/[0.07] text-ink/70" },
  running: { label: "Claude working", tone: "bg-[#ff6a00]/15 text-[#c24100]" },
  needs_approval: { label: "Needs your OK", tone: "bg-[#ff3c00] text-white" },
  changes_requested: { label: "Redo queued", tone: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved", tone: "bg-green-100 text-green-800" },
  failed: { label: "Failed", tone: "bg-red-100 text-red-700" },
  cancelled: { label: "Cancelled", tone: "bg-ink/[0.05] text-ink/45" },
};

export const ACTIVE = ["queued", "running", "needs_approval", "changes_requested"];

export const KIND_LABELS = {
  task: "Task", audit: "Business audit", build_website: "Website build", build_app: "App build", blog: "Blog",
  gbp_post: "GBP post", report: "Report", brand: "Brand", email: "Email draft", research: "Research", other: "Other",
};

export function guessKind(text = "") {
  const t = text.toLowerCase();
  if (/audit|intel/.test(t)) return "audit";
  if (/\bgbp\b|google business/.test(t)) return "gbp_post";
  if (/blog/.test(t)) return "blog";
  if (/report/.test(t)) return "report";
  if (/signature|brand|logo|collateral|social post/.test(t)) return "brand";
  if (/email|newsletter/.test(t)) return "email";
  if (/research|competitor/.test(t)) return "research";
  return "task";
}

// Rules every job carries, so the runner never needs this conversation's memory.
export const STANDING_RULES = [
  "Never read, print or store secret values (API keys, passwords, client logins).",
  "Never send an email, publish public content, post to Google Business Profile, charge a card or delete data. Prepare it, then stop at needs_approval.",
  "Client emails: write the subject and the HTML body as a code block in result_body. Never create or send Gmail drafts for client deliverables.",
  "GBP post copy never contains a phone number, a street address or a bare URL. The CTA link is the plain blog URL with no UTM parameters.",
  "SEO or search changes on a live site are proposals until Justin approves them.",
  "Brand gradient: #ff3c00 → #ff6a00 → #ffaa00. Never gold or yellow.",
  "Do not invent time estimates, prices or numbers. If a fact is missing, list it under needs_from_justin.",
];

export function buildInstructions({ task, client, project, extra }) {
  const lines = [];
  lines.push(`# ${task.title}`);
  if (task.sop_name) lines.push(`SOP: ${task.sop_name}${task.sop_step ? ` — step "${task.sop_step}"` : ""}`);
  if (project) lines.push(`Project: ${project.title}${project.service_key ? ` (${project.service_key})` : ""}`);
  if (task.notes) lines.push(`Step notes: ${task.notes}`);
  if (client) {
    lines.push("", "## Client");
    const c = client;
    [
      ["Business", c.business], ["Contact", c.contact], ["Industry", c.industry], ["Location", c.location],
      ["Domain", c.domain || (c.websites || [])[0]], ["Plan", c.plan],
      ["Website Base44 app id", c.site_app_id], ["System Base44 app id", c.ops_app_id],
      ["Services", (c.services_managed || []).join(", ")],
    ].forEach(([k, v]) => v && lines.push(`- ${k}: ${v}`));
  }
  if (extra) lines.push("", "## Justin added", extra);
  lines.push("", "## Rules", ...STANDING_RULES.map((r) => `- ${r}`));
  lines.push(
    "",
    "## When you finish",
    "Write back to this ClaudeJob: result_summary (one or two sentences), result_body (markdown: what you did, drafts, code), result_links (anything you created), needs_from_justin (anything only he can do), status = needs_approval, finished_at = now.",
  );
  return lines.join("\n");
}

export function useJobs(limit = 300) {
  return useQuery({
    queryKey: ["ClaudeJob", "all", limit],
    queryFn: async () => {
      const rows = await base44.entities.ClaudeJob.list("-created_date", limit);
      return Array.isArray(rows) ? rows : [];
    },
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

// Latest job per task (one shared query across every row).
export function useJobsByTask() {
  const { data = [] } = useJobs();
  const map = new Map();
  data.forEach((j) => { if (j.task_id && !map.has(j.task_id)) map.set(j.task_id, j); });
  return map;
}

export function useRefreshJobs() {
  const qc = useQueryClient();
  return () => ["ClaudeJob", "Task", "AutomationRun"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export async function queueTask(task, extra = "") {
  const [client, project] = await Promise.all([
    task.client_id ? base44.entities.CRMClient.get(task.client_id).catch(() => null) : null,
    task.project_id ? base44.entities.Project.get(task.project_id).catch(() => null) : null,
  ]);
  const instructions = buildInstructions({ task, client, project, extra });
  return base44.entities.ClaudeJob.create({
    title: task.title,
    kind: guessKind(`${task.title} ${task.sop_step || ""}`),
    instructions,
    extra,
    task_id: task.id,
    project_id: task.project_id || "",
    project_name: task.project_name || project?.title || "",
    client_id: task.client_id || "",
    client_name: task.client_name || client?.business || "",
    status: "queued",
    priority: task.priority || 3,
    requested_at: new Date().toISOString(),
    context: { sop_name: task.sop_name || "", sop_step: task.sop_step || "", category: task.category || "" },
  });
}

export async function queueCustom({ title, kind = "other", instructions, client }) {
  return base44.entities.ClaudeJob.create({
    title, kind, client_id: client?.id || "", client_name: client?.business || "",
    instructions: [instructions, "", "## Rules", ...STANDING_RULES.map((r) => `- ${r}`)].join("\n"),
    status: "queued", requested_at: new Date().toISOString(), complete_task_on_approve: false,
  });
}

// Approve: the job is final, its task is done, and it lands in Live Ops + the client's page.
export async function approveJob(job) {
  const now = new Date().toISOString();
  await base44.entities.ClaudeJob.update(job.id, { status: "approved", approved_at: now });
  if (job.task_id && job.complete_task_on_approve !== false) {
    await base44.entities.Task.update(job.task_id, { status: "done", completed_at: now }).catch(() => null);
  }
  await base44.entities.AutomationRun.create({
    automation_name: "Send to Claude",
    kind: "claude_job",
    title: job.title,
    client_id: job.client_id || "",
    client_name: job.client_name || "",
    status: "success",
    started_at: job.started_at || job.requested_at || now,
    finished_at: now,
    message: job.result_summary || "Approved",
    output_url: (job.result_links || [])[0]?.url || "",
    processed: true,
  }).catch(() => null);
}

export async function requestChanges(job, notes) {
  await base44.entities.ClaudeJob.update(job.id, {
    status: "changes_requested",
    review_notes: [job.review_notes, `(${new Date().toLocaleDateString()}) ${notes}`].filter(Boolean).join("\n"),
  });
}

export const cancelJob = (job) => base44.entities.ClaudeJob.update(job.id, { status: "cancelled" });
export const retryJob = (job) => base44.entities.ClaudeJob.update(job.id, { status: "queued", runner_log: "" });

// For running it live in a chat instead of waiting for the scheduled run.
export function chatPrompt(job) {
  return [
    `Run Møthership Claude job ${job.id} now (Base44 app 69d80bb06c5ad07a795df54e, entity ClaudeJob).`,
    "Set it to running, do the work below, then write the result back and set status needs_approval.",
    job.review_notes ? `\nJustin's change notes:\n${job.review_notes}` : "",
    "",
    job.instructions,
  ].join("\n");
}
