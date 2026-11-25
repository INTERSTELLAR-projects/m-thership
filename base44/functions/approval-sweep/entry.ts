import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { AUTO_NOTE, laneForJob, laneForPrompt, laneForAction, laneForLaunchItem, laneForLearning } from "../../shared/approvalLanes.js";

/*
 * Justin's approval rule (Nov 19, 2026): he approves TASTE only. Logic, research and best practice are decided by us;
 * hard gates (publish, DNS, delete, money, client sends, his logins) always wait for his tap.
 * This sweep finds every open approval item the backend can clear with the same effect as its own page, classifies it
 * with shared/approvalLanes.js and auto-approves the "logic" ones. Every auto-approval writes an AgentAuditLog row
 * (action "auto_approved", summary starting with AUTO_NOTE) with an undo patch, so Command > Decided for you can put
 * it back in front of Justin with one tap. Taste and gate items are left exactly as they are.
 * Kinds whose approval code lives only in the app (profile enrichments, playbooks, plans, calendars) are cleared by
 * the in-app policy sweep (src/features/launch/policySweep.js) with the same rule.
 *   { action: "sweep" }       admin: full report
 *   { action: "scheduled" }   workflow "Approvals — taste rule sweep" (no user): counts only
 *   { action: "classify" }    admin: counts by lane, changes nothing
 */
const now = () => new Date().toISOString();
const s = (v: unknown) => (v == null ? "" : String(v));

async function listAll(ent: any, q: any, sort = "-created_date", max = 2000) {
  const out: any[] = [];
  for (let skip = 0; skip < max; skip += 500) {
    const rows = await ent.filter(q, sort, 500, skip).catch(() => []);
    out.push(...(rows || []));
    if (!rows || rows.length < 500) break;
  }
  return out;
}

async function auditAuto(db: any, entity: string, rec: any, title: string, undoPatch: any, extra = "") {
  return db.AgentAuditLog.create({ at: now(), ok: true, actor: "policy:taste-rule", action: "auto_approved", entity, record_id: rec.id, summary: `${AUTO_NOTE}: ${title}${extra ? ` (${extra})` : ""}`.slice(0, 480), before: undoPatch, undo: { entity, id: rec.id, patch: undoPatch } }).catch(() => null);
}

// Server-side equivalents of each page's approve action.
async function approveJob(db: any, j: any) {
  const t = now();
  await db.ClaudeJob.update(j.id, { status: "approved", approved_at: t, review_notes: [s(j.review_notes), `(${t.slice(0, 10)}) ${AUTO_NOTE}`].filter(Boolean).join("\n") });
  if (j.kind === "audit" && j.client_id) {
    const gaps = await db.ClientGap.filter({ source_job_id: j.id }, "-created_date", 200).catch(() => []);
    for (const g of gaps || []) await db.ClientGap.update(g.id, { portal_visible: true }).catch(() => null);
    await db.WorkLog.create({ client_id: j.client_id, client_name: j.client_name, kind: "report", title: j.context?.audit_mode === "final" ? "Intel Briefing — final sweep" : "Intel Briefing — business audit", description: s(j.result_summary), date: t.slice(0, 10), status: "live", source: "claude", portal_visible: true }).catch(() => null);
  }
  if (j.task_id && j.complete_task_on_approve !== false) await db.Task.update(j.task_id, { status: "done", completed_at: t }).catch(() => null);
  await db.AutomationRun.create({ automation_name: "Approval policy", kind: "claude_job", title: s(j.title).slice(0, 200), client_id: j.client_id || "", client_name: j.client_name || "", status: "success", started_at: t, finished_at: t, message: `auto: ${AUTO_NOTE}`, processed: true }).catch(() => null);
}
async function approvePrompt(db: any, p: any) {
  const same = await db.FoundationPrompt.filter({ area_id: p.area_id, status: "approved" }, "-version", 100).catch(() => []);
  const retired: string[] = [];
  for (const o of same || []) if (o.id !== p.id && s(o.industry) === s(p.industry)) { await db.FoundationPrompt.update(o.id, { status: "retired" }); retired.push(o.id); }
  await db.FoundationPrompt.update(p.id, { status: "approved", approved_at: now(), rejected_at: null });
  if (!s(p.industry) && p.area_id) await db.PlaybookArea.update(p.area_id, { current_prompt_id: p.id }).catch(() => null);
  return retired;
}

const SERVER_JOB_KINDS = new Set(["audit", "research", "task", "report", "checklist_item"]);

export async function sweep(db: any, apply: boolean) {
  const out: any = { at: now(), open: 0, auto: 0, taste: 0, gate: 0, left_for_app: 0, by_source: {}, auto_titles: [] as string[], errors: [] as string[] };
  const count = (src: string, lane: string) => { out.by_source[src] = out.by_source[src] || { open: 0, logic: 0, taste: 0, gate: 0 }; out.by_source[src].open++; out.by_source[src][lane]++; out.open++; if (lane === "taste") out.taste++; if (lane === "gate") out.gate++; };
  const did = (title: string) => { out.auto++; if (out.auto_titles.length < 80) out.auto_titles.push(title); };

  // Claude jobs waiting for review.
  for (const j of await listAll(db.ClaudeJob, { status: { $in: ["needs_approval", "needs_review"] } })) {
    const lane = laneForJob(j); count("Claude jobs", lane);
    if (lane !== "logic") continue;
    if (!SERVER_JOB_KINDS.has(s(j.kind))) { out.left_for_app++; continue; }
    if (!apply) { did(j.title); continue; }
    try { await approveJob(db, j); await auditAuto(db, "ClaudeJob", j, j.title, { status: j.status }); did(j.title); } catch (e: any) { out.errors.push(`${j.title}: ${s(e?.message)}`); }
  }
  // Road to Dec 31 items Justin owns: logic ones become ours (owner claude) with the note; nothing is marked done.
  for (const it of await listAll(db.LaunchItem, { owner: "justin", status: { $in: ["todo", "in_progress", "waiting"] } })) {
    const lane = laneForLaunchItem(it); count("Road to Dec 31", lane);
    if (lane !== "logic") continue;
    if (!apply) { did(it.title); continue; }
    try {
      await db.LaunchItem.update(it.id, { owner: "claude", notes: [s(it.notes), `${now().slice(0, 10)}: ${AUTO_NOTE}. Decided and done by us; no approval needed.`].filter(Boolean).join("\n") });
      await auditAuto(db, "LaunchItem", it, it.title, { owner: "justin" });
      did(it.title);
    } catch (e: any) { out.errors.push(`${it.title}: ${s(e?.message)}`); }
  }
  // Foundation prompts (Playbooks drafts).
  for (const p of await listAll(db.FoundationPrompt, { status: "draft" })) {
    const lane = laneForPrompt(p); count("Foundation prompts", lane);
    if (lane !== "logic") continue;
    if (!apply) { did(p.title); continue; }
    try { const retired = await approvePrompt(db, p); await auditAuto(db, "FoundationPrompt", p, p.title, { status: "draft" }, retired.length ? `retired ${retired.length} older version` : ""); did(p.title); } catch (e: any) { out.errors.push(`${p.title}: ${s(e?.message)}`); }
  }
  // Agent learnings.
  for (const l of await listAll(db.AgentLearning, { status: "proposed" })) {
    const lane = laneForLearning(l); count("Agent learnings", lane);
    if (!apply) { did(s(l.learning).slice(0, 120)); continue; }
    try { await db.AgentLearning.update(l.id, { status: "applied", applied: true }); await auditAuto(db, "AgentLearning", l, s(l.learning).slice(0, 160), { status: "proposed", applied: false }); did(s(l.learning).slice(0, 120)); } catch (e: any) { out.errors.push(`learning: ${s(e?.message)}`); }
  }
  // Command cards.
  for (const pa of await listAll(db.ProposedAction, { status: { $in: ["pending", "snoozed"] } })) {
    const lane = laneForAction(pa); count("Command cards", lane);
    if (lane !== "logic") continue;
    // Record changes and tasks run through Command's own executor when Justin's app next loads; summary cards
    // ("N Claude jobs waiting for your OK") are retired here because the rule now clears what they point at.
    if (pa.kind === "choice" && /claude jobs waiting/i.test(s(pa.title))) {
      if (!apply) { did(pa.title); continue; }
      await db.ProposedAction.update(pa.id, { status: "skipped" }).catch(() => null);
      await auditAuto(db, "ProposedAction", pa, pa.title, { status: pa.status }, "summary card retired");
      did(pa.title);
      continue;
    }
    out.left_for_app++;
  }
  // Counted, never touched: public posts (taste) and bookkeeping (gate: money).
  const posts = (await listAll(db.SocialPost, { status: "draft" })).length + (await listAll(db.SocialVariant, { status: "draft" })).length + (await listAll(db.ChannelPost, { status: "draft" })).length;
  for (let i = 0; i < posts; i++) count("Social posts", "taste");
  const ledger = (await listAll(db.LedgerTransaction, { review_status: "needs_review" }, "-created_date", 5000)).length;
  out.by_source["Bank transactions"] = { open: ledger, logic: 0, taste: 0, gate: ledger }; out.open += ledger; out.gate += ledger;
  return out;
}

import { schedulerGate } from "../../shared/schedulerGate.ts";
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = s(body?.action || "sweep");
    const user = await base44.auth.me().catch(() => null);
    const admin = user?.role === "admin";
    if (action !== "scheduled" && !admin) return Response.json({ error: "Admins only" }, { status: 403 });
    if (!admin) { const g = await schedulerGate(base44, user, "approval-sweep", 4, 60); if (g) return g; }
    const db = base44.asServiceRole.entities;
    const out = await sweep(db, action !== "classify");
    const rows = (await db.AppSettings.filter({ key: "approval_taste_rule" }, "-updated_date", 1).catch(() => [])) || [];
    const status = { last: out, rule: AUTO_NOTE };
    if (action !== "classify") {
      if (rows[0]) await db.AppSettings.update(rows[0].id, { pageSettings: { ...(rows[0].pageSettings || {}), ...status, first: rows[0].pageSettings?.first || out } });
      else await db.AppSettings.create({ key: "approval_taste_rule", pageSettings: { ...status, first: out } });
    }
    if (!admin) return Response.json({ ok: true, open: out.open, auto: out.auto, taste: out.taste, gate: out.gate });
    return Response.json(out);
  } catch (error: any) {
    return Response.json({ error: s(error?.message).slice(0, 300) }, { status: 500 });
  }
}
