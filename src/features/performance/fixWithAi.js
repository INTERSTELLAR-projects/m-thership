// Fix with AI: drafts the concrete fix for one issue (Core.InvokeLLM), saves it as a SeoFix
// proposal, and — only after Justin approves the preview — queues it for Claude or marks it applied.
// Nothing here ever changes a live site.
import { base44 } from "@/api/base44Client";
import { STANDING_RULES } from "@/features/claude/jobs";
import { guideFor, FIX_LABELS } from "./issueGuide";

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "One or two sentences: what this change does and why." },
    target: { type: "string", description: "Exactly where it goes (page/URL, head, component, image)." },
    before: { type: "string", description: "The current value or markup, verbatim from the facts given. Empty if none." },
    after: { type: "string", description: "The new value or markup, ready to paste." },
    code: { type: "string", description: "Full code/markup to apply if different from 'after' (e.g. a JSON-LD script tag, a JSX snippet). Empty if not needed." },
    code_language: { type: "string", enum: ["html", "json", "jsx", "css", "text"] },
    steps: { type: "array", items: { type: "string" }, description: "Exact steps to apply it." },
    verify: { type: "array", items: { type: "string" }, description: "How to confirm it worked." },
    needs_confirmation: { type: "array", items: { type: "string" }, description: "Facts Justin must confirm before it goes live (every name/address/phone/hours value used, anything marked [[CONFIRM]])." },
    risk: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["summary", "after", "steps"],
};

function clientFacts(c) {
  return [
    ["Business", c?.business], ["Industry", c?.industry], ["Location", c?.location],
    ["Domain", c?.domain || (c?.websites || [])[0]], ["Phone(s) on file", (c?.phones || []).join(", ")],
    ["Contact", c?.contact], ["Plan", c?.plan],
  ].filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join("\n");
}

function pageFacts(p = {}) {
  const out = [
    ["URL", p.final_url || p.url], ["Title", p.title], ["Meta description", p.meta_description],
    ["H1s", (p.h1s || []).join(" | ")], ["Canonical", p.canonical], ["Robots meta", p.robots_meta],
    ["JSON-LD types present", (p.jsonld_types || []).join(", ")], ["Open Graph", p.og ? JSON.stringify(p.og) : ""],
    ["Images missing alt (src)", (p.images_missing_alt || []).slice(0, 15).join("\n  ")], ["Word count", p.word_count],
    ["robots.txt", p.robots_txt ? JSON.stringify(p.robots_txt) : ""], ["Sitemap", p.sitemap ? JSON.stringify(p.sitemap) : ""],
  ];
  return out.filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => `- ${k}: ${v}`).join("\n");
}

export async function generateFix({ client, audit, issue }) {
  const guide = guideFor(issue);
  const items = (issue.items || []).map((i) => [i.label, i.url, i.snippet].filter(Boolean).join(" — ")).filter(Boolean).slice(0, 10);
  const prompt = `You are the technical SEO lead at Interstellar Strategies, preparing ONE concrete fix for a client website.
The site is moving to (or already on) Base44 (React + Vite + Tailwind; head tags set in the page component or index.html).
Produce the actual change, ready to paste — not advice.

## Client
${clientFacts(client)}

## Page facts (fetched from the live site by our audit on ${String(audit?.run_at || "").slice(0, 10)})
${pageFacts(audit?.page)}

## Issue
- Check: ${issue.title} (${issue.key})
- Severity: ${issue.severity}
- Detail: ${issue.display_value || ""} ${issue.description || ""}
${items.length ? `- Affected elements:\n  ${items.join("\n  ")}` : ""}
- Fix type wanted: ${FIX_LABELS[guide.fix] || "Code fix"}
- Manual guidance: ${guide.steps.join(" / ")}

## Rules
- Use ONLY the facts above. Never invent reviews, ratings, awards, prices, years in business, addresses, phone numbers or hours. Put [[CONFIRM: what]] where a fact is missing and list it in needs_confirmation.
- Name, address and phone must match the Google Business Profile exactly; list every NAP value you used in needs_confirmation.
- Titles 30–60 characters (service + city first, brand last). Meta descriptions 140–160 characters. One H1 per page.
- Alt text: literal and under 125 characters; mention the service or place only if it is genuinely what the image shows (infer from the file name; mark guesses with [[CONFIRM]]).
- JSON-LD must be valid JSON in a <script type="application/ld+json"> tag, using the most specific schema.org LocalBusiness subtype that fits.
- No keyword stuffing. Plain, confident, answer-first copy.
- "before" must quote the current value from the page facts (empty if absent).`;
  const res = await base44.integrations.Core.InvokeLLM({ prompt, model: "claude_sonnet_4_6", response_json_schema: SCHEMA });
  const proposal = typeof res === "string" ? { summary: "", after: res, steps: [] } : res || {};
  return { ...proposal, fix_type: guide.fix, generated_at: new Date().toISOString() };
}

export async function saveProposal({ client, audit, issue, proposal, existing }) {
  const data = {
    client_id: client.id, client_name: client.business, audit_id: audit?.id || "", issue_key: issue.key,
    issue_title: issue.title, severity: issue.severity, fix_type: proposal.fix_type || "generic",
    target_url: audit?.page?.final_url || audit?.url || "", proposal, status: "proposed",
  };
  return existing ? base44.entities.SeoFix.update(existing.id, data) : base44.entities.SeoFix.create(data);
}

function jobInstructions(fix, client) {
  const p = fix.proposal || {};
  return [
    `# SEO fix — ${fix.issue_title}`,
    `Client: ${client?.business || fix.client_name}${client?.domain ? ` (${client.domain})` : ""}`,
    client?.site_app_id ? `Website Base44 app id: ${client.site_app_id}` : "",
    `Page: ${fix.target_url || "home page"}`,
    `SeoFix record: ${fix.id} (Møthership app 69d80bb06c5ad07a795df54e)`,
    "",
    "Justin reviewed and approved this exact change in the Performance dashboard. Apply it as written.",
    "",
    "## Change",
    p.summary || "",
    p.target ? `Where: ${p.target}` : "",
    p.before ? `\nBefore:\n\`\`\`\n${p.before}\n\`\`\`` : "",
    `\nAfter:\n\`\`\`${p.code_language || ""}\n${p.after || ""}\n\`\`\``,
    p.code ? `\nFull code:\n\`\`\`${p.code_language || ""}\n${p.code}\n\`\`\`` : "",
    (p.steps || []).length ? `\n## Steps\n${p.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : "",
    (p.verify || []).length ? `\n## Verify\n${p.verify.map((s) => `- ${s}`).join("\n")}` : "",
    (p.needs_confirmation || []).length ? `\n## Confirm before applying (stop and list under needs_from_justin if any is unconfirmed)\n${p.needs_confirmation.map((s) => `- ${s}`).join("\n")}` : "",
    "",
    "## How to apply",
    "- First check where the live site is actually hosted (fetch the domain). If it is the Base44 app above, make the change in that app's source with the Base44 MCP tools and create_checkpoint. Do NOT publish the app or connect a domain — Justin publishes.",
    "- If the live site is on Framer, Squarespace or anything else, do not log in or change it: put the paste-ready change and click-by-click steps in result_body for Justin.",
    "- Any [[CONFIRM: …]] placeholder left in the change means stop and ask under needs_from_justin.",
    "- When done: result_summary, result_body (what changed, where, diff), status needs_approval. Leave the SeoFix record as it is; Justin marks it applied once it is live.",
    "",
    "## Rules",
    ...STANDING_RULES.map((r) => `- ${r}`),
  ].filter((l) => l !== "").join("\n");
}

export async function queueFix(fix, client) {
  const job = await base44.entities.ClaudeJob.create({
    title: `SEO fix — ${fix.issue_title} · ${fix.client_name}`,
    kind: "task",
    instructions: jobInstructions(fix, client),
    client_id: fix.client_id, client_name: fix.client_name,
    status: "queued", priority: fix.severity === "critical" ? 1 : fix.severity === "high" ? 2 : 3,
    requested_at: new Date().toISOString(), complete_task_on_approve: false,
    context: { seo_fix_id: fix.id, audit_id: fix.audit_id, issue_key: fix.issue_key },
  });
  await base44.entities.SeoFix.update(fix.id, { status: "queued", claude_job_id: job.id, approved_at: new Date().toISOString() });
  return job;
}

const WORK_KIND = { schema: "schema", indexing: "search_console" };

export async function markApplied(fix) {
  const now = new Date().toISOString();
  await base44.entities.SeoFix.update(fix.id, { status: "applied", applied_at: now, approved_at: fix.approved_at || now });
  await base44.entities.WorkLog.create({
    client_id: fix.client_id, client_name: fix.client_name, kind: WORK_KIND[fix.fix_type] || "site_edit",
    title: `SEO fix: ${fix.issue_title}`, description: fix.proposal?.summary || "", url: fix.target_url || "",
    date: now.slice(0, 10), status: "live", source: "manual", portal_visible: true,
  }).catch(() => null);
}

export const dismissFix = (fix) => base44.entities.SeoFix.update(fix.id, { status: "dismissed" });

// Small line diff (LCS) for the before/after preview.
export function lineDiff(a = "", b = "") {
  const A = String(a).split("\n");
  const B = String(b).split("\n");
  if (A.length * B.length > 250000) return [...A.map((t) => ({ t, op: "-" })), ...B.map((t) => ({ t, op: "+" }))];
  const dp = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) { out.push({ t: A[i], op: " " }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: A[i], op: "-" }); i++; }
    else { out.push({ t: B[j], op: "+" }); j++; }
  }
  while (i < A.length) out.push({ t: A[i++], op: "-" });
  while (j < B.length) out.push({ t: B[j++], op: "+" });
  return out;
}
