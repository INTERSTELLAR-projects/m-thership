// "Auto-enrich with Claude": a ClaudeJob (kind enrich_profile) that researches the client's public
// presence (website, Google Business Profile, listings) and PROPOSES values for profile fields, each
// with a source URL. Nothing is written until Justin accepts fields one by one in the review table;
// approveJob(job, { accepted }) then writes only those fields.
import { base44 } from "@/api/base44Client";
import { STANDING_RULES } from "@/features/claude/jobs";
import { CRITERIA, criterionByKey, displayValue, evaluateCriteria, has } from "./criteria";
import { loadClientContext } from "./clientContext";
import { writeCriterion } from "./profileActions";

export const ENRICH_CONTEXT = "enrich_profile";
export const isEnrichJob = (job) => !!(job && job.kind === "enrich_profile");

export const ENRICHABLE = CRITERIA.filter((c) => c.enrich);

export function enrichBrief(ctx, extra = "") {
  const c = ctx.client || {};
  const ev = evaluateCriteria(ctx);
  const site = c.domain || (c.websites || [])[0] || "";
  const rc = ctx.review || null;
  const rows = ENRICHABLE.map((f) => {
    const cur = ev.items.find((i) => i.key === f.key);
    return `| ${f.key} | ${f.label} | ${cur && cur.filled ? displayValue(cur.value, 160).replace(/\|/g, "/") : "— (missing)"} |`;
  });
  return `# Enrich client profile: ${c.business}

Research ${c.business}'s PUBLIC presence and propose values for the client profile fields below. Justin reviews every proposal and accepts it field by field; nothing you return is saved until he does.

## Where to look (use WebFetch / WebSearch)
- Their website: ${site || "none on file — search for it by business name and location"}${site ? " (home, about, services, contact, footer, location pages)" : ""}
- Their Google Business Profile${rc && rc.place_id ? ` (Place ID ${rc.place_id})` : ""}: name, address, phone, hours, categories, services, review link.
- Public listings: Yelp, Facebook, BBB, Nextdoor, Angi / industry directories, Apple Maps, Bing Places.
- Business: ${c.business}${c.location ? ` · ${c.location}` : ""}${c.industry ? ` · ${c.industry}` : ""}

## Fields (key | label | currently on file)
| key | label | on file |
| --- | --- | --- |
${rows.join("\n")}

Propose a value for a missing field when you find it stated publicly. For a field already on file, propose only if a public source clearly disagrees with it (say so in note: "differs from what is on file").
${extra ? `\n## Justin added\n${extra}\n` : ""}
## What to produce
1. result_data = { "proposals": [ { "key": "<field key from the table>", "value": "<exact value as published; lists as an array of strings>", "source_url": "<the page you read it on>", "source_label": "Website / Google Business Profile / Yelp …", "confidence": "high | medium | low", "note": "" } ] }
2. result_body = a short markdown table of the proposals (field, value, source).
3. result_summary = one sentence: how many fields you found and from where.
4. needs_from_justin = fields you could not find publicly.

## Rules for this job
- NEVER invent or infer a value. Every proposal is copied from a page you actually read, with that page's URL in source_url. No source, no proposal.
- NAP (name, address, phone) exactly as published on the Google Business Profile when it exists; note any mismatch between sources.
- Services, cities and competitors as the business names them; competitors only when you can name real local businesses offering the same service in their area, with a source.
- Never record logins, passwords or private data. Public business facts only.
- Do NOT create or update any record (CRMClient, ClientDossier, OutreachProfile, IntakeAudit). Approval in Møthership writes the accepted fields.

## Rules
${STANDING_RULES.map((r) => `- ${r}`).join("\n")}

## When you finish
Write back to this ClaudeJob: result_data, result_body, result_summary, needs_from_justin, status = needs_approval, finished_at = now.`;
}

export async function queueEnrichProfile(clientOrCtx, extra = "") {
  const ctx = clientOrCtx && clientOrCtx.client ? clientOrCtx : await loadClientContext(clientOrCtx);
  const c = ctx.client;
  return base44.entities.ClaudeJob.create({
    title: `Enrich profile — ${c.business}`,
    kind: "enrich_profile",
    instructions: enrichBrief(ctx, extra),
    extra,
    client_id: c.id,
    client_name: c.business,
    status: "queued",
    priority: 2,
    complete_task_on_approve: false,
    requested_at: new Date().toISOString(),
    context: { [ENRICH_CONTEXT]: true },
  });
}

// Normalised proposals (only known, enrichable keys with a value and a source).
export function proposalsFromJob(job) {
  const d = (job && job.result_data) || {};
  const raw = Array.isArray(d.proposals) ? d.proposals : Array.isArray(d) ? d : [];
  const seen = new Set();
  return raw.filter((p) => p && typeof p === "object").map((p) => ({
    key: String(p.key || "").trim(),
    value: Array.isArray(p.value) ? p.value.map((x) => String(x).trim()).filter(Boolean) : String(p.value ?? "").trim(),
    source_url: String(p.source_url || "").trim(),
    source_label: String(p.source_label || "").trim(),
    confidence: ["high", "medium", "low"].includes(p.confidence) ? p.confidence : "medium",
    note: String(p.note || "").trim(),
  })).filter((p) => {
    const f = criterionByKey(p.key);
    if (!f || !f.enrich || !has(p.value) || !/^https?:\/\//i.test(p.source_url) || seen.has(p.key)) return false;
    seen.add(p.key);
    return true;
  });
}

// Called from approveJob with the keys Justin ticked. Writes only those; records what was accepted.
export async function applyEnrichment(job, accepted = []) {
  if (!job.client_id) return 0;
  const ctx = await loadClientContext(job.client_id);
  const props = proposalsFromJob(job).filter((p) => accepted.includes(p.key));
  let written = 0;
  for (const p of props) {
    const ok = await writeCriterion(ctx, p.key, p.value, { by: "claude_enrich" }).catch(() => false);
    if (ok) written += 1;
  }
  const dossier = ctx.dossier;
  if (dossier && props.length) {
    const sources = [...(dossier.sources || []), ...props.map((p) => ({ date: new Date().toISOString().slice(0, 10), label: `${p.key}: ${p.source_label || "source"}`, url: p.source_url }))].slice(-60);
    await base44.entities.ClientDossier.update(dossier.id, { sources, last_enriched_at: new Date().toISOString() }).catch(() => null);
  }
  await base44.entities.ClaudeJob.update(job.id, {
    review_notes: [job.review_notes, `(${new Date().toLocaleDateString()}) Accepted ${props.length} of ${proposalsFromJob(job).length} proposed fields: ${props.map((p) => p.key).join(", ") || "none"}`].filter(Boolean).join("\n"),
  }).catch(() => null);
  return written;
}
