// Full briefs for the bigger Send to Claude jobs: the Intel Briefing audit / final sweep,
// and Build with Claude (website or app). The runner works only from these words.

export const MEETINGS_FOLDER = "1fZJbeOinAIvg__13KWRYqK2f9Vk7UMCM";
export const MOTHERSHIP_APP = "69d80bb06c5ad07a795df54e";

function clientBlock(c) {
  const rows = [
    ["CRMClient id", c.id], ["Business", c.business], ["Contact", c.contact], ["Industry", c.industry],
    ["Location", c.location], ["Domain", c.domain || (c.websites || [])[0]], ["Other sites", (c.websites || []).slice(1).join(", ")],
    ["Plan", c.plan], ["Website Base44 app id", c.site_app_id], ["System Base44 app id", c.ops_app_id],
    ["Services we manage", (c.services_managed || []).join(", ")],
  ].filter(([, v]) => v);
  return rows.map(([k, v]) => `- ${k}: ${v}`).join("\n");
}

function meetingsBlock(c) {
  return [
    `Find this client's recorded calls in Google Drive folder ${MEETINGS_FOLDER} (search parentId = '${MEETINGS_FOLDER}').`,
    `Each call is a subfolder titled like "Interstellar Meeting | ${c.business} - YYYY/MM/DD". Match on the business name or an obvious short form (and the contact's name, ${c.contact || "if known"}).`,
    "Open each matching subfolder and read the \"Notes by Gemini\" doc (it holds the summary and transcript). Newest calls win when they disagree.",
  ].join("\n");
}

function refsBlock(refs) {
  if (!refs?.length) return "No uploaded references yet.";
  return refs.map((r) => `- [${r.kind}] ${r.title}${r.file_url ? ` — file: ${r.file_url}` : ""}${r.link_url ? ` — link: ${r.link_url}` : ""}${r.note ? ` — take from it: ${r.note}` : ""}`).join("\n");
}

function intakeBlock(intake) {
  if (!intake) return "No intake on file. Rely on the calls and the live site; list missing facts under needs_from_justin.";
  const a = intake.answers || {};
  const lines = Object.entries(a).filter(([, v]) => (Array.isArray(v) ? v.length : v)).map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
  return [
    `IntakeAudit ${intake.id} (status ${intake.status}).`,
    intake.summary ? `Summary: ${intake.summary}` : "",
    ...lines,
  ].filter(Boolean).join("\n");
}

export function auditInstructions(client, mode = "initial", { intake } = {}) {
  const final = mode === "final";
  return `# Intel Briefing — ${final ? "final sweep" : "business audit"}: ${client.business}

${final
    ? "This is the FINAL SWEEP at the end of the build. Re-run the same checks as the first audit, compare before/after, and list what is left to close (old accounts, duplicate listings, subscriptions to cancel)."
    : "This is the first audit, before anything is built. It decides what to build, what to cancel and what is leaking. It is free with every build."}

## Client
${clientBlock(client)}

## Inputs to read first
${intakeBlock(intake)}

${meetingsBlock(client)}

Also read in app ${MOTHERSHIP_APP}: this client's existing ClientGap records${final ? " (especially audit_kind \"initial\" — re-check each one and say fixed / still open)" : ""}, WorkLog and PerformanceSnapshot.

## Checks (use web research and fetch the live pages; never guess)
1. Website: speed and mobile (fetch the pages; note heavy assets), structure, one clear action per page, forms working, tracking present, titles/meta/H1, schema (JSON-LD types present and valid), sitemap and robots, broken links.
2. Search and AI answers: what shows for "[main service] [city]" style searches; who outranks them; whether AI answers (Google AI Overviews, ChatGPT, Perplexity) mention them. Say plainly when you could not verify something.
3. Listings and reviews: Google Business Profile, Bing, Apple, Yelp, Facebook, Nextdoor, Angi and the industry directories — name/address/phone consistency, review count, rating, reply rate.
4. Software and costs: from the intake and calls, every tool they pay for, users, yearly cost, overlap, and what our build replaces.
5. Follow-up: what happens to a new lead, reply times, missed-call handling.
6. Market: top 3–5 competitors in their service area and the openings.

## Write back (app ${MOTHERSHIP_APP})
- For each finding create a ClientGap: client_id "${client.id}", title, area (website|seo|gbp|brand|system|ops|reviews|social|ads|other), severity (high|medium|low), status "open"${final ? " (or update the matching initial gap to \"fixed\")" : ""}, impact (what it costs them, in plain words), recommendation, evidence (URL / what you saw), audit_kind "${final ? "final" : "initial"}", source_job_id = this ClaudeJob's id, portal_visible false. Justin's approval makes them visible in the client portal.
- result_summary: the 2 sentences you'd say to the owner.
- result_body: the briefing in markdown — scorecard (one line per area with a plain grade), top leaks ranked by cost, competitor comparison table, savings list (cancel / merge), ${final ? "before/after table and the straggler list" : "the prioritised build plan"}. Client-facing tone; it goes in their portal.
- needs_from_justin: logins or facts you could not get.

## Rules
- Read-only on every client site and account. Do not change anything you audit.
- Never show a low score publicly. Nothing here is published until Justin approves.
- No invented numbers, rankings, reviews or quotes. Label anything unconfirmed.`;
}

const WEBSITE_STAGES = [
  "Stage 1 — Plan: build brief, sitemap, page-by-page outline, design direction (from the references), schema plan. Create the new Base44 app (create_base44_app) named \"<Business> — Website\", save its id to the CRMClient as site_app_id, scaffold the layout and home page.",
  "Stage 2 — Pages: build every page in the sitemap with real copy written answer-first from the calls/intake, one clear action per page, forms wired to their lead flow placeholders.",
  "Stage 3 — Search: titles, meta descriptions, one H1 per page, JSON-LD (Organization/LocalBusiness with exact NAP, Service, FAQPage, BreadcrumbList), sitemap.xml, robots.txt, Open Graph, alt text, internal links, image sizes. Aim for perfect Lighthouse SEO and best-practice scores.",
  "Stage 4 — Integrations and final sweep prep (always last): booking/forms/email/analytics integrations, then a full QA pass (every link, form, mobile view, schema validation) and a launch checklist for Justin.",
];
const APP_STAGES = [
  "Stage 1 — Plan: data model (entities + fields), roles, pages, automations and client portal, from the calls/intake. Create the new Base44 app (create_base44_app) named \"<Business> — Command System\", save its id to the CRMClient as ops_app_id, create the entities with RLS.",
  "Stage 2 — Core: CRM (leads → customers → jobs), pipeline, scheduling and the main admin pages.",
  "Stage 3 — Ops and portal: ERP pieces (estimates, invoices, inventory as needed), client portal, rewards, notifications.",
  "Stage 4 — Integrations and security sweep (always last): Stripe/Google/email integrations, then a security pass (RLS on every entity, admin-only by default, no secrets in client code, input validation, role checks in every backend function) and a handoff checklist.",
];

export function buildInstructions(client, type, { refs = [], intake, extra = "" } = {}) {
  const site = type === "website";
  const stages = site ? WEBSITE_STAGES : APP_STAGES;
  return `# Build with Claude — ${site ? "website" : "Command System app"}: ${client.business}

Build this in stages, one stage per run. Do the stage named in "Current stage" below as completely as you can, create_checkpoint with a clear name, then set next_stage to the next stage's name (or "" after the last stage). Justin approves each stage; approval queues the next one.

## Client
${clientBlock(client)}

## Inputs (read all before Stage 1; re-read anything a later stage needs)
### Intake
${intakeBlock(intake)}
${site && intake?.website_prompt ? `\nIntake build prompt (draft, facts only):\n${intake.website_prompt}` : ""}${!site && intake?.system_prompt ? `\nIntake build prompt (draft, facts only):\n${intake.system_prompt}` : ""}

### Calls
${meetingsBlock(client)}

### Design language (reference, read before Stage 1)
- Build Standard: AgencyKnowledge key build_standard in app ${MOTHERSHIP_APP} (brand, truth, the Floor, taste).
- This client's DESIGN.md: BusinessBrain for client_id "${client.id}", field sections.brand.design_md (colors, type, components, voice, do/don't). If it is missing or says unknown, list that under needs_from_justin instead of guessing.

### References Justin uploaded
${refsBlock(refs)}
Look at every screenshot. For a screen recording you cannot play, use its note and its reference site, and say so in result_body.
${extra ? `\n### Justin added\n${extra}` : ""}

## Stages
${stages.map((s) => `- ${s}`).join("\n")}

## Rules
- Facts only from the inputs above or the client's own live site. Missing facts go in needs_from_justin, never invented (no fake reviews, numbers, awards or addresses).
- ${site ? "SEO/schema must be clean: valid JSON-LD, exact NAP matching their Google Business Profile, no keyword stuffing." : "Security first: RLS on every entity, nothing sensitive readable by non-admins, no secrets in frontend code."}
- Do not publish the app or connect a domain — Justin does that. Never use Base44's \"Fix with AI\".
- Integrations and the final sweep stay at the end (Stage 4), whatever order things come up in.
- Interstellar brand gradient (#ff3c00 → #ff6a00 → #ffaa00) is ours, not the client's; use the client's brand.`;
}
