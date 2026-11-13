// Møthership Command: server helpers shared by command-brief, command-ask, command-execute and command-brain.
// Admin only. Never moves money, never deletes, never sends without an approved ProposedAction.
import * as C from "./command.js";

export const SENDER_NAME = "Interstellar Strategies";
export const nowIso = () => new Date().toISOString();
const str = (v: unknown) => (v == null ? "" : String(v));

export async function requireAdmin(base44: any) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) return { user: null, denied: Response.json({ error: "Not signed in" }, { status: 401 }) };
  if (user.role !== "admin") return { user, denied: Response.json({ error: "Admins only" }, { status: 403 }) };
  return { user, denied: null };
}

export function withTimeout<T>(p: Promise<T>, ms: number, label = "timeout"): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(label)), ms))]);
}

export async function invokeJson(base44: any, prompt: string, schema: any, ms = 45000) {
  const out = await withTimeout(base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema }), ms, "The AI took too long");
  if (typeof out === "string") { try { return JSON.parse(out); } catch { return null; } }
  return out && typeof out === "object" ? out : null;
}

export async function audit(db: any, row: Record<string, unknown>) {
  try { return await db.AgentAuditLog.create({ at: nowIso(), ok: true, ...row }); } catch (e) { console.error("audit", (e as Error).message); return null; }
}

// Today's (and the next two days') timed events from the app's Google Calendar connector, when it is authorised.
// Returns null when the connector is not connected, so the brief can say so.
export async function readCalendar(base44: any, now: Date, tz: string) {
  try {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlecalendar");
    if (!accessToken) return null;
    const qs = new URLSearchParams({ timeMin: new Date(now.getTime() - 14 * 3600e3).toISOString(), timeMax: new Date(now.getTime() + 74 * 3600e3).toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "60", timeZone: tz });
    const res = await withTimeout(fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${qs}`, { headers: { Authorization: `Bearer ${accessToken}` } }), 8000);
    if (!res.ok) return null;
    const data = await res.json();
    const out = [];
    for (const e of data.items || []) {
      if (!e.start?.dateTime || !e.end?.dateTime || e.status === "cancelled") continue;
      const a = new Date(e.start.dateTime), b = new Date(e.end.dateTime);
      const pa = C.zonedParts(a, tz), pb = C.zonedParts(b, tz);
      out.push({ date: pa.date, start: C.fromMin(pa.hour * 60 + pa.minute), end: pa.date === pb.date ? C.fromMin(pb.hour * 60 + pb.minute) : "23:59", title: str(e.summary || "Busy").slice(0, 120) });
    }
    return out;
  } catch {
    return null;
  }
}

const compactScores = (scores: any, cands: any[]) => Object.fromEntries(Object.entries(scores).map(([id, v]: any) => [id, { ...v, todos: cands.filter((c) => c.pillar === id).slice(0, 5).map((c) => ({ title: c.title, why: c.why, ref: c.ref })) }]));

// Build (or rebuild) today's brief. Rules first; the LLM may only reword / reorder with known ids.
export async function generateBrief(base44: any, user: any, opts: { tz?: string; interruption?: any; extraBlock?: any; useLlm?: boolean; reason?: string } = {}) {
  const db = base44.asServiceRole.entities;
  const tz = opts.tz || C.TZ_DEFAULT;
  const now = new Date();
  const today = C.zonedParts(now, tz).date;
  const [src, existingRows, events] = await Promise.all([
    C.loadSources(db),
    db.DailyBrief.filter({ date: today }, "-updated_date", 1).catch(() => []),
    readCalendar(base44, now, tz),
  ]);
  const existing = (Array.isArray(existingRows) ? existingRows : [])[0] || null;
  const interruptions = [...(existing?.interruptions || [])];
  if (opts.interruption) {
    const p = C.zonedParts(now, tz);
    interruptions.push({ date: today, at: now.toISOString(), start: C.fromMin(Math.ceil((p.hour * 60 + p.minute) / 5) * 5), minutes: Math.max(15, Math.min(240, Number(opts.interruption.minutes) || 60)), text: str(opts.interruption.text).slice(0, 200) });
  }
  const extra = [...(existing?.extra_blocks || [])];
  if (opts.extraBlock) extra.push(opts.extraBlock);
  const { s, scores, rule } = C.computeAll(src, now, { tz, events, interruptions, name: user?.full_name, keepPast: existing?.plan_today || [], extraBlocks: extra });

  let llm = null, llmError = "";
  if (opts.useLlm !== false) {
    try { llm = await invokeJson(base44, C.briefPrompt(s, scores, rule, s.facts), C.BRIEF_SCHEMA); }
    catch (e) { llmError = (e as Error).message || "AI unavailable"; }
  } else llmError = "rules only (fast re-plan)";
  const merged = C.mergeLlmBrief(rule, llm, s);
  const b = merged.brief;
  const doc = {
    date: today, version: (Number(existing?.version) || 0) + 1, status: "ready", source: merged.source,
    greeting: b.greeting, since_yesterday: b.since_yesterday, outcomes: b.outcomes, plan_today: b.plan_today,
    tomorrow: b.tomorrow, day_after: b.day_after, gaps: b.gaps, pillar_scores: compactScores(scores, rule.cands),
    facts: { ...C.factsSummary(s), after_hours: !!b.after_hours, llm_accepted: merged.accepted, llm_rejected: merged.rejected, calendar: events ? events.length : null },
    interruptions, extra_blocks: extra, llm_error: llmError, generated_at: nowIso(), generated_by: user?.email || "agent", tz,
  };
  const saved = existing ? await db.DailyBrief.update(existing.id, doc) : await db.DailyBrief.create(doc);

  // Proposals: create new ones (dedupe), retire brief-sourced cards whose condition has cleared.
  const props = C.ruleProposals(s, scores);
  const keys = props.map((p: any) => p.dedupe_key);
  const seen = keys.length ? await db.ProposedAction.filter({ dedupe_key: { $in: keys } }, "-created_date", 500).catch(() => []) : [];
  const have = new Set((Array.isArray(seen) ? seen : []).map((r: any) => r.dedupe_key));
  const fresh = props.filter((p: any) => !have.has(p.dedupe_key));
  if (fresh.length) await db.ProposedAction.bulkCreate(fresh).catch((e: Error) => console.error("proposals", e.message));
  const stale = s.actions.filter((a: any) => a.source === "brief" && a.status === "pending" && a.dedupe_key && !keys.includes(a.dedupe_key));
  for (const a of stale) await db.ProposedAction.update(a.id, { status: "cancelled", result: { reason: "The condition behind this card has cleared." } }).catch(() => null);

  await audit(db, { actor: "agent", action: "brief_generated", entity: "DailyBrief", record_id: saved?.id || existing?.id, summary: `Brief v${doc.version} (${merged.source}${opts.reason ? ", " + opts.reason : ""}): ${b.outcomes.map((o: any) => o.title).join(" | ")}`.slice(0, 500), after: { proposals_added: fresh.length, retired: stale.length } });
  return { brief: { ...(saved || {}), ...doc, id: saved?.id || existing?.id }, proposals_added: fresh.length, retired: stale.length, llm: { accepted: merged.accepted, rejected: merged.rejected, error: llmError } };
}

// ---------------------------------------------------------------- record changes (allowlist, before/after, undo)
export const EDITABLE: Record<string, string[]> = {
  Task: ["status", "due_date", "priority", "completed_at", "labels", "notes", "is_focus", "title"],
  Expense: ["paidCycles"],
  WorkEntry: ["status"],
  CRMClient: ["notes", "next_step", "next_step_at", "pipeline_stage"],
  LaunchItem: ["status", "answer", "answered_at"],
};
const fill = (v: unknown) => (v === "$now" ? nowIso() : v);

export async function applyChanges(db: any, changes: any[], actor: string, paId: string) {
  const done: any[] = [];
  for (const ch of changes || []) {
    const allowed = EDITABLE[ch?.entity];
    if (!allowed) throw new Error(`Changes to ${ch?.entity} are not allowed from Command`);
    const keys = Object.keys(ch.patch || {});
    const bad = keys.filter((k) => !allowed.includes(k));
    if (!keys.length || bad.length) throw new Error(`Field not allowed on ${ch.entity}: ${bad.join(", ") || "(none)"}`);
    const rec = await db[ch.entity].get(ch.id);
    if (!rec) throw new Error(`${ch.entity} ${ch.id} no longer exists`);
    const before = Object.fromEntries(keys.map((k) => [k, rec[k] ?? null]));
    const patch = Object.fromEntries(keys.map((k) => [k, fill(ch.patch[k])]));
    await db[ch.entity].update(ch.id, patch);
    const log = await audit(db, { actor, action: "record_changed", entity: ch.entity, record_id: ch.id, summary: `${ch.entity}: ${str(ch.label).slice(0, 120)} → ${JSON.stringify(patch).slice(0, 200)}`, before, after: patch, proposed_action_id: paId, undo: { entity: ch.entity, id: ch.id, patch: before } });
    done.push({ entity: ch.entity, id: ch.id, audit_id: log?.id });
  }
  return done;
}

export async function undoAudit(db: any, auditId: string, actor: string) {
  const row = await db.AgentAuditLog.get(auditId);
  if (!row) throw new Error("Audit entry not found");
  if (row.undone_at) throw new Error("Already undone");
  const u = row.undo;
  if (!u || !u.entity || !u.id || !u.patch) throw new Error("This action can't be undone automatically");
  const allowed = EDITABLE[u.entity] || (u.entity === "BrainFact" ? ["status"] : null);
  if (!allowed || Object.keys(u.patch).some((k) => !allowed.includes(k))) throw new Error("Undo touches a field Command may not change");
  await db[u.entity].update(u.id, u.patch);
  await db.AgentAuditLog.update(auditId, { undone_at: nowIso() });
  await audit(db, { actor, action: "undo", entity: u.entity, record_id: u.id, summary: `Undid: ${str(row.summary).slice(0, 200)}`, after: u.patch });
  return true;
}

// ---------------------------------------------------------------- email
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function emailHtml(body: string) {
  const paras = str(body).trim().split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:23px;color:#1a1a1a;">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#ebe8e4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ebe8e4;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#f5f3f0;">
<tr><td height="6" style="height:6px;line-height:6px;font-size:0;background-color:#ff3c00;background-image:linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00);">&nbsp;</td></tr>
<tr><td style="padding:32px 36px 16px;">${paras}</td></tr>
<tr><td style="padding:0 36px 28px;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:1.4px;color:#8a8580;text-transform:uppercase;">Interstellar Strategies &middot; The Future of Business</td></tr>
<tr><td height="6" style="height:6px;line-height:6px;font-size:0;background-color:#ffaa00;background-image:linear-gradient(90deg,#ffaa00,#ff6a00,#ff3c00);">&nbsp;</td></tr>
</table></td></tr></table></body></html>`;
}
export const validEmail = (e: string) => /^[^\s@<>,;]+@[^\s@<>,;]+\.[a-z]{2,}$/i.test(str(e).trim());
