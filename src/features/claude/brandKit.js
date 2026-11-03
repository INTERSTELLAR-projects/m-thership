// "Generate brand kit with Claude": the brief, the queue call, and what approval saves.
// Claude's result stays on the ClaudeJob (needs_approval) until Justin approves it;
// only then is a BrandKit record written for the client.
import { base44 } from "@/api/base44Client";
import { STANDING_RULES } from "./jobs";
import { loadClientContext, contextToBrief } from "@/features/clients/clientContext";
import { loadAgencyKnowledge, agencyBlock } from "@/features/agency/knowledge";

export const BRAND_KIT_CONTEXT = "brand_kit";

// The standard Interstellar brand-kit structure (sections in display order).
export const KIT_SECTIONS = [
  ["overview", "Brand overview"],
  ["logo", "Logo usage"],
  ["palette", "Color palette"],
  ["typography", "Typography"],
  ["voice", "Voice & tone"],
  ["taglines", "Taglines & messaging"],
  ["imagery", "Imagery & iconography"],
  ["applications", "Applications"],
  ["dos", "Do"],
  ["donts", "Don't"],
];

export const KIT_JSON_SHAPE = `{
  "overview": { "essence": "one line", "mission": "", "positioning": "", "personality": ["3-5 traits"], "audience": "" },
  "logo": {
    "primary_url": "existing logo file URL if one is on file, else \\"\\"",
    "description": "what the mark is and what it communicates",
    "variations": [{ "name": "Primary / Stacked / Icon / Mono", "use": "when to use it", "url": "" }],
    "clear_space": "e.g. the height of the logo's cap letter on every side",
    "minimum_size": "e.g. 120px wide on screen, 1in in print",
    "backgrounds": "which variation goes on light, dark and photo backgrounds",
    "misuse": ["don't stretch", "don't recolor outside the palette", "..."]
  },
  "palette": [
    { "name": "Brand name for the color", "hex": "#RRGGBB", "rgb": "r, g, b", "role": "primary | secondary | accent | neutral | background | text", "usage": "where it goes and roughly how much (e.g. 60/30/10)", "on_color_text": "#FFFFFF or #111111 for accessible contrast" }
  ],
  "typography": {
    "headings": { "family": "", "weights": "", "source": "Google Fonts / Adobe / system", "fallback": "" },
    "body": { "family": "", "weights": "", "source": "", "fallback": "" },
    "accent": { "family": "", "use": "optional" },
    "scale": [{ "level": "H1 / H2 / H3 / Body / Small / Button", "size": "px", "weight": "", "line_height": "", "tracking": "" }],
    "notes": "pairing rationale and rules (case, max line length)"
  },
  "voice": {
    "personality": "how the brand sounds in one or two sentences",
    "tone": ["3-5 tone words"],
    "we_say": ["words and phrases to use"],
    "we_never_say": ["words and phrases to avoid"],
    "sample": "a short paragraph written in the voice",
    "by_channel": [{ "channel": "Website / Social / Email / GBP / Phone", "guidance": "" }]
  },
  "taglines": { "primary": "", "alternates": ["3-5 options"], "elevator_pitch": "2 sentences", "value_props": ["3-5"], "key_messages": ["3-5"] },
  "imagery": { "photo_style": "", "subjects": ["what to show"], "avoid": ["what not to show"], "lighting_and_color": "", "iconography": "", "textures_patterns": "" },
  "applications": [{ "touchpoint": "Website / Social post / Business card / Vehicle / Signage / Email signature / Uniform", "guidance": "" }],
  "dos": ["5-8 short rules"],
  "donts": ["5-8 short rules"]
}`;

const show = (v) => (Array.isArray(v) ? v.join(", ") : typeof v === "object" && v ? JSON.stringify(v) : String(v ?? ""));

function rowsBlock(rows) {
  return rows.filter(([, v]) => v && (!Array.isArray(v) || v.length)).map(([k, v]) => `- ${k}: ${show(v)}`).join("\n");
}

function clientBlock(c) {
  return rowsBlock([
    ["CRMClient id", c.id], ["Business", c.business], ["Contact", c.contact], ["Industry", c.industry],
    ["Location", c.location], ["Domain", c.domain || (c.websites || [])[0]], ["Other sites", (c.websites || []).slice(1)],
    ["Plan", c.plan], ["Services we manage", c.services_managed], ["Logo on file", c.logo_url], ["Accent color on file", c.accent],
    ["Client since", c.started_on], ["Notes", typeof c.notes === "string" ? c.notes.slice(0, 1500) : ""],
  ]);
}

function dossierBlock(d) {
  if (!d) return "No dossier yet.";
  return rowsBlock([
    ["Elevator pitch", d.elevator_pitch], ["Tagline", d.tagline], ["USP", d.usp], ["Story", d.story], ["Founded", d.founded],
    ["Service area", d.service_area], ["Services", d.services], ["Offers", d.offers], ["Differentiators", d.differentiators],
    ["Audience", d.audience], ["Competitors", d.competitors], ["Brand identity on file", d.brand_identity], ["Brand voice on file", d.brand_voice],
    ["Dream outcome", d.dream_outcome],
  ]) || "Dossier is empty.";
}

function intakeBlock(intake) {
  if (!intake) return "No intake audit on file.";
  const a = intake.answers || {};
  const lines = Object.entries(a).filter(([, v]) => (Array.isArray(v) ? v.length : v)).map(([k, v]) => `- ${k}: ${show(v)}`);
  return [`IntakeAudit ${intake.id} (status ${intake.status}).`, intake.summary ? `Summary: ${intake.summary}` : "", ...lines].filter(Boolean).join("\n");
}

function requestsBlock(requests) {
  const withAnswers = (requests || []).filter((r) => (r.answers || []).length || r.details);
  if (!withAnswers.length) return "No form submissions on file.";
  return withAnswers.slice(0, 8).map((r) => {
    const answers = (r.answers || []).filter((x) => x && x.value !== undefined && x.value !== "" && !(Array.isArray(x.value) && !x.value.length));
    return [
      `### ${r.form_title || r.title} (${(r.created_date || "").slice(0, 10)})`,
      r.details ? `Details: ${r.details}` : "",
      ...answers.map((x) => `- ${x.label || x.id}: ${show(x.value)}`),
      (r.attachments || []).length ? `Attachments: ${r.attachments.join(", ")}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n\n");
}

function filesBlock(files) {
  const brand = (files || []).filter((f) => f.category === "brand_kit" || /logo|brand/i.test(f.title || ""));
  if (!brand.length) return "No brand files uploaded yet.";
  return brand.map((f) => `- ${f.title}${f.file_url ? ` — ${f.file_url}` : ""}${f.link_url ? ` — ${f.link_url}` : ""}${f.description ? ` (${f.description})` : ""}`).join("\n");
}

// Inputs come from the shared client context (src/features/clients/clientContext.js).
export async function gatherBrandInputs(client) {
  const [ctx, agency] = await Promise.all([loadClientContext(client.id), loadAgencyKnowledge()]);
  return { intake: ctx.intake, requests: ctx.requests, dossier: ctx.dossier, files: ctx.files, current: ctx.brandKit, ctx, agency };
}

export function brandKitBrief(client, { intake, requests, dossier, files, current, ctx, agency, extra = "" } = {}) {
  return `# Generate brand kit: ${client.business}

Build a complete, client-ready brand kit for ${client.business}: brand overview, logo usage, color palette with hex codes, typography, voice & tone, taglines & messaging, imagery, applications, and do / don't rules. It must be specific to this business — no generic filler.
Reference format: Justin's "Soft River" brand kit. If you can reach it (search Google Drive for "Soft River"), mirror its section order, depth and presentation; otherwise follow the structure below.

## Client
${clientBlock(client)}

## Inputs (read all of these first)
### Intake audit answers
${intakeBlock(intake)}

### Form submissions
${requestsBlock(requests)}

### Client dossier (Constellations)
${dossierBlock(dossier)}

${ctx ? `\n${contextToBrief(ctx, { sections: ["profile", "services"], level: 3 })}\n` : ""}
### Brand files already on file
${filesBlock(files)}
Look at every logo/image above before choosing colors: if they already have a logo, the palette must be built from it (sample the exact hex values) and the kit documents how to use that logo — do not redesign it.
${client.domain || (client.websites || [])[0] ? `\nAlso fetch their live site (${client.domain || client.websites[0]}) and note the colors, fonts and tone they already use.` : ""}
${current ? `\n### Current approved kit (v${current.version || 1})\nThis is a revision. Keep what works and change what Justin asks for.\n${current.summary || ""}` : ""}
${extra ? `\n## Justin added\n${extra}` : ""}

## What to produce
1. result_data = { "brand_kit": <the JSON below, every section filled> }. Hex codes must be real #RRGGBB values with an accessible text color for each (WCAG AA 4.5:1 for body text). Fonts must be real, licensable (prefer Google Fonts) with fallbacks.
\`\`\`json
${KIT_JSON_SHAPE}
\`\`\`
2. result_body = the same kit as clean client-facing markdown, one H2 per section, palette as a table (Name | Hex | RGB | Role | Usage).
3. result_summary = two sentences on the direction (the feel, the main colors, the type pairing).
4. needs_from_justin = anything missing (vector logo files, an existing style guide, owner preferences you could not confirm).

${agencyBlock(agency, ["delivery"])}
## Rules for this job
- Do NOT create or update a BrandKit record and do not touch the CRMClient. Approval in Møthership saves the kit to the client profile.
- Facts (story, claims, awards, numbers) only from the inputs above or the client's own site. Never invent reviews or credentials.
- The Interstellar gradient (#ff3c00 → #ff6a00 → #ffaa00) is ours — never use it in a client's kit unless it is genuinely their color.
- Nothing is shown to the client until Justin approves.

## Rules
${STANDING_RULES.map((r) => `- ${r}`).join("\n")}

## When you finish
Write back to this ClaudeJob: result_data, result_body, result_summary, result_links (any files you made), needs_from_justin, status = needs_approval, finished_at = now.`;
}

export async function queueBrandKit(client, extra = "") {
  const inputs = await gatherBrandInputs(client);
  const instructions = brandKitBrief(client, { ...inputs, extra });
  return base44.entities.ClaudeJob.create({
    title: `Brand kit — ${client.business}`,
    kind: "brand",
    instructions,
    extra,
    client_id: client.id,
    client_name: client.business,
    status: "queued",
    priority: 2,
    complete_task_on_approve: false,
    requested_at: new Date().toISOString(),
    context: { [BRAND_KIT_CONTEXT]: true, revision_of: inputs.current?.id || "" },
  });
}

export const isBrandKitJob = (job) => !!(job && job.kind === "brand" && job.context && job.context[BRAND_KIT_CONTEXT]);

// The kit JSON Claude returned, wherever it put it.
export function kitFromJob(job) {
  const d = job?.result_data;
  if (!d || typeof d !== "object") return null;
  const kit = d.brand_kit && typeof d.brand_kit === "object" ? d.brand_kit : d;
  return Object.keys(kit).length ? kit : null;
}

// Called from approveJob: write the approved kit onto the client profile.
export async function saveApprovedKit(job) {
  if (!job.client_id) return null;
  const existing = await base44.entities.BrandKit.filter({ client_id: job.client_id }, "-version", 50).catch(() => []);
  if ((existing || []).some((k) => k.source_job_id === job.id)) return null; // already saved
  const now = new Date().toISOString();
  const me = await base44.auth.me().catch(() => null);
  await Promise.all(
    (existing || []).filter((k) => k.status === "approved").map((k) => base44.entities.BrandKit.update(k.id, { status: "archived", portal_visible: false }))
  );
  const version = (existing || []).reduce((max, k) => Math.max(max, Number(k.version) || 0), 0) + 1;
  return base44.entities.BrandKit.create({
    client_id: job.client_id,
    client_name: job.client_name || "",
    status: "approved",
    version,
    summary: job.result_summary || "",
    kit: kitFromJob(job) || {},
    body_md: job.result_body || "",
    source_job_id: job.id,
    approved_at: now,
    approved_by: me?.email || "",
    portal_visible: true,
  });
}
