import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

// Settings > Integrations and Settings > Automations helper. Admin only.
//   { action: "secrets" }  -> { secrets: { NAME: true|false } }  EXISTENCE ONLY. Values are never read
//                             into the response, never logged, never compared.
//   { action: "upsert", entries: [{ key, name, source, ... }], replace_source?: "claude_task" }
//                          -> writes AutomationCatalog rows by key (create or update) and stamps the
//                             catalog meta (AppSettings key "automation_catalog"). With replace_source,
//                             rows of that source whose key is not in `entries` are marked enabled:false
//                             + notes "No longer listed" (never deleted).
// Used by Claude when it refreshes the scheduled-task snapshot, so the catalog stays in Møthership.

const KNOWN = [
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "LEAD_INTAKE_KEY", "MOTHERSHIP_INGEST_KEY",
  "PAGESPEED_API_KEY", "GOOGLE_PLACES_API_KEY", "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY", "AWS_SES_ACCESS_KEY_ID", "AWS_SES_SECRET_ACCESS_KEY", "AWS_SES_REGION",
];

function isSet(name: string): boolean {
  let v = "";
  try { v = secrets.get(name) || ""; } catch { v = ""; }
  if (!v) { try { v = Deno.env.get(name) || ""; } catch { v = ""; } }
  return v.length > 0;
}

const FIELDS = [
  "key", "name", "source", "description", "how_it_works", "schedule_human", "cron", "scope", "client_ids", "client_names",
  "channels", "enabled", "last_run_at", "last_status", "next_run_at", "run_match", "external_id", "notes",
];

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const action = body?.action || "secrets";

    if (action === "secrets") {
      const out: Record<string, boolean> = {};
      for (const n of KNOWN) out[n] = isSet(n);
      return Response.json({ secrets: out, checked_at: new Date().toISOString() });
    }

    if (action === "upsert") {
      const db = base44.asServiceRole.entities;
      const entries = Array.isArray(body.entries) ? body.entries : [];
      const now = new Date().toISOString();
      const existing = (await db.AutomationCatalog.list("-updated_date", 1000)) || [];
      const byKey = new Map(existing.map((r: any) => [r.key, r]));
      let created = 0, updated = 0, retired = 0;
      const seen = new Set<string>();
      for (const e of entries) {
        if (!e?.key || !e?.name || !e?.source) continue;
        seen.add(e.key);
        const data: Record<string, unknown> = { snapshot_at: now };
        for (const f of FIELDS) if (e[f] !== undefined) data[f] = e[f];
        const cur: any = byKey.get(e.key);
        if (cur) { await db.AutomationCatalog.update(cur.id, data); updated++; }
        else { await db.AutomationCatalog.create(data); created++; }
      }
      if (body.replace_source) {
        for (const r of existing as any[]) {
          if (r.source === body.replace_source && !seen.has(r.key) && r.enabled !== false) {
            await db.AutomationCatalog.update(r.id, { enabled: false, notes: `No longer listed at ${now.slice(0, 10)}`, snapshot_at: now });
            retired++;
          }
        }
      }
      const metaRows = (await db.AppSettings.filter({ key: "automation_catalog" }, "-created_date", 1)) || [];
      const meta = { updated_at: now, updated_by: user.email, last_source: body.replace_source || "mixed", entries: entries.length };
      if (metaRows[0]) await db.AppSettings.update(metaRows[0].id, { catalogMeta: { ...(metaRows[0].catalogMeta || {}), ...meta } });
      else await db.AppSettings.create({ key: "automation_catalog", catalogMeta: meta });
      return Response.json({ ok: true, created, updated, retired });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
