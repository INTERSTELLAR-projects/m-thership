// @ts-nocheck
// Follow-up engine writer: turns followUpsFor() (pure, leadEngine.js) into LeadTask rows, one open task per lead +
// kind, and keeps CRMClient.lead_heat current. Creates tasks and drafts only; never sends anything.
import { followUpsFor, heatOf, followUpDraft, FOLLOW_UP_DEFAULTS } from "./leadEngine.js";

const nowIso = () => new Date().toISOString();

export async function followUpRules(db: any) {
  const row = ((await db.AppSettings.filter({ key: "lead_engine" }, "-created_date", 1).catch(() => [])) || [])[0];
  const s = row?.pageSettings || {};
  return { ...FOLLOW_UP_DEFAULTS, voicemail_attempts: Math.max(1, Math.min(10, Number(s.voicemail_attempts) || FOLLOW_UP_DEFAULTS.voicemail_attempts)) };
}

export async function sweepLead(db: any, client: any, opts: { preview?: any; rules?: any } = {}) {
  if (!client) return { tasks: 0 };
  const rules = opts.rules || (await followUpRules(db));
  const preview = opts.preview !== undefined ? opts.preview : (((await db.LeadPreview.filter({ client_id: client.id }, "-updated_date", 1).catch(() => [])) || [])[0] || null);
  const calls = ((await db.LeadCallLog.filter({ client_id: client.id }, "-at", 40).catch(() => [])) || []) as any[];
  const want = followUpsFor({ client, preview, calls, rules });
  const open = (((await db.LeadTask.filter({ client_id: client.id, status: "open" }, "-created_date", 20).catch(() => [])) || []) as any[]);
  const byKind = new Map(open.map((t) => [t.kind, t]));
  for (const w of want) {
    const draft = w.draft ? followUpDraft(w.draft, { client }) : null;
    const cur = byKind.get(w.kind);
    const data = { client_id: client.id, client_name: client.business, assigned_rep_id: client.assigned_rep_id || "", kind: w.kind, status: "open", due_at: w.due_at, priority: w.priority, reason: w.reason, attempt: w.attempt || null, ...(draft ? { draft } : {}) };
    if (!cur) await db.LeadTask.create(data).catch(() => null);
    else if (cur.due_at !== w.due_at || cur.reason !== w.reason) await db.LeadTask.update(cur.id, data).catch(() => null);
    byKind.delete(w.kind);
  }
  for (const stale of byKind.values()) await db.LeadTask.update(stale.id, { status: "expired", done_at: nowIso(), done_by: "sweep" }).catch(() => null);
  const heat = heatOf(client, preview);
  if (client.lead_heat !== heat) await db.CRMClient.update(client.id, { lead_heat: heat }).catch(() => null);
  return { tasks: want.length, heat };
}
