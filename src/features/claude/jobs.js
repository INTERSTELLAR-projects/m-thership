// Send to Claude: Justin authorizes a step with a click, a Claude scheduled task does it,
// and nothing is final until he approves the result here.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { auditInstructions, buildInstructions as buildBrief } from "./briefs";
import { settleTimer } from "@/features/tasks/lib/timer";
import { isBrandKitJob, saveApprovedKit } from "./brandKit";
import { isDeckJob, saveApprovedDeck } from "@/features/presentations/lib/deckSchema";
import { isPlaybookJob, saveApprovedPlaybook } from "./playbook";
import { isContentPlanJob, saveApprovedContentPlan } from "./contentPlan";
import { isSocialPlanJob, saveApprovedSocialPlan } from "./socialPlan";
import { isEnrichJob, applyEnrichment } from "@/features/clients/enrich";
import { isMapPackJob, saveApprovedMapPack } from "./mapPack";

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
  gbp_post: "GBP post", report: "Report", brand: "Brand", email: "Email draft", research: "Research", presentation: "Presentation", playbook: "Industry playbook", content_plan: "Content plan", social_plan: "Social plan", enrich_profile: "Profile enrichment", map_pack_plan: "Map pack plan", other: "Other",
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
  // Intel Briefing SOP steps get the full audit brief.
  if (client && /intel/i.test(task.sop_name || "")) {
    const mode = /final|sweep|straggler/i.test(`${task.title} ${task.notes || ""}`) ? "final" : "initial";
    return queueAudit(client, mode, { task, extra });
  }
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

async function latestIntake(clientId) {
  const rows = await base44.entities.IntakeAudit.filter({ client_id: clientId }, "-created_date", 1).catch(() => []);
  return rows?.[0] || null;
}

export async function queueAudit(client, mode = "initial", { task, extra = "" } = {}) {
  const intake = await latestIntake(client.id);
  const label = mode === "final" ? "Intel final sweep" : "Intel audit";
  return base44.entities.ClaudeJob.create({
    title: `${label} — ${client.business}`,
    kind: "audit",
    instructions: auditInstructions(client, mode, { intake }) + (extra ? `\n\n## Justin added\n${extra}` : ""),
    extra, task_id: task?.id || "", project_id: task?.project_id || "", project_name: task?.project_name || "",
    client_id: client.id, client_name: client.business, status: "queued", priority: 2,
    complete_task_on_approve: !!task, requested_at: new Date().toISOString(), context: { audit_mode: mode },
  });
}

const stageBrief = (base, stage, name) => `${base}\n\n## Current stage\nStage ${stage}${name ? `: ${name}` : " (the first one listed)"}`;

export async function queueBuild(client, type, { refs = [], extra = "" } = {}) {
  const intake = await latestIntake(client.id);
  const base = buildBrief(client, type, { refs, intake, extra });
  return base44.entities.ClaudeJob.create({
    title: `Build ${type === "website" ? "website" : "Command System"} — ${client.business} · stage 1`,
    kind: type === "website" ? "build_website" : "build_app",
    instructions: stageBrief(base, 1, ""), extra, stage: 1,
    client_id: client.id, client_name: client.business, status: "queued", priority: 2,
    complete_task_on_approve: false, requested_at: new Date().toISOString(), context: { base, build_type: type },
  });
}

// Approve: the job is final, its task is done, and it lands in Live Ops + the client's page.
export async function approveJob(job, opts = {}) {
  const now = new Date().toISOString();
  // Profile enrichment: only the fields Justin ticked in the review table are written.
  if (isEnrichJob(job)) {
    if (!Array.isArray(opts.accepted)) throw new Error("Review the proposed fields first: tick the ones to keep in the review table, then approve.");
    await applyEnrichment(job, opts.accepted);
  }
  // Brand kit: only an approved result is saved onto the client profile.
  if (isBrandKitJob(job)) await saveApprovedKit(job);
  // Deck: an approved deck lands on its Presentation (only while that deck is still waiting for it).
  if (isDeckJob(job)) await saveApprovedDeck(job).catch(() => null);
  // Industry playbook: approval archives the previous version and saves a new one on the profile.
  if (isPlaybookJob(job)) await saveApprovedPlaybook(job);
  // Content plan: same versioning; keeps written/published queue rows from the previous version.
  if (isContentPlanJob(job)) await saveApprovedContentPlan(job);
  // Social plan: same versioning as the playbook; saved hidden from the portal.
  if (isSocialPlanJob(job)) await saveApprovedSocialPlan(job);
  // Map pack plan: the approved draft becomes the client's plan on the Map pack tab.
  if (isMapPackJob(job)) await saveApprovedMapPack(job);
  await base44.entities.ClaudeJob.update(job.id, { status: "approved", approved_at: now });
  // Intel audit: findings become visible in the client portal, and the briefing is logged as work.
  if (job.kind === "audit" && job.client_id) {
    await base44.entities.ClientGap.filter({ source_job_id: job.id }, "-created_date", 200)
      .then((gaps) => Promise.all((gaps || []).map((g) => base44.entities.ClientGap.update(g.id, { portal_visible: true }))))
      .catch(() => null);
    await base44.entities.WorkLog.create({
      client_id: job.client_id, client_name: job.client_name, kind: "report",
      title: job.context?.audit_mode === "final" ? "Intel Briefing — final sweep" : "Intel Briefing — business audit",
      description: job.result_summary || "", date: now.slice(0, 10), status: "live", source: "claude", portal_visible: true,
    }).catch(() => null);
  }
  // Multi-stage builds: approving a stage queues the next one.
  if (job.next_stage && job.context?.base) {
    const stage = (Number(job.stage) || 1) + 1;
    await base44.entities.ClaudeJob.create({
      title: job.title.replace(/stage \d+$/, `stage ${stage}`),
      kind: job.kind, instructions: stageBrief(job.context.base, stage, job.next_stage) + (job.result_summary ? `\n\nPrevious stage result: ${job.result_summary}` : ""),
      stage, parent_job_id: job.id, client_id: job.client_id, client_name: job.client_name,
      status: "queued", priority: 2, complete_task_on_approve: false, requested_at: now, context: job.context,
    });
  }
  if (job.task_id && job.complete_task_on_approve !== false) {
    await settleTimer(job.task_id);
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
