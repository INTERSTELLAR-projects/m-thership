// logPrompt: admin-only batch ingest of Justin's requests into PromptLog (used by Claude sessions and the Playbooks page).
// POST { rows: [{ text, said_at?, source?: claude|base44_builder|manual, client_id? | client_name?, app_id?,
//                 area_id? | area_slug?, phase?: build|tweak|polish|launch|maintain, tags?: string[] }] }   (max 100)
// Every text goes through scrubSecrets() first: anything that looks like a password, key or token is removed, and a row
// that is nothing but a secret is dropped. Exact repeats (same text + same minute) are skipped.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { arr, cut, nowIso, scrubSecrets, listAll } from "../../shared/playbooks.ts";

const SOURCES = ["claude", "base44_builder", "manual"];
const PHASES = ["build", "tweak", "polish", "launch", "maintain"];

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    const b = await req.json().catch(() => ({}));
    const rows = arr(b?.rows).slice(0, 100);
    if (!rows.length) return Response.json({ error: "Send rows: [{ text, ... }]" }, { status: 400 });

    const db = base44.asServiceRole.entities;
    const [areas, clients, recent] = await Promise.all([
      listAll(db.PlaybookArea, {}, "order", 100),
      listAll(db.CRMClient, {}, "business", 500),
      listAll(db.PromptLog, {}, "-said_at", 1000),
    ]);
    const seen = new Set(recent.map((l: any) => `${String(l.said_at || "").slice(0, 16)}|${l.text}`));
    const findClient = (id: string, name: string) => {
      if (id) return clients.find((c: any) => c.id === id) || null;
      const n = name.toLowerCase().trim();
      if (!n) return null;
      return clients.find((c: any) => String(c.business || "").toLowerCase() === n) || clients.find((c: any) => String(c.business || "").toLowerCase().includes(n)) || null;
    };

    let redacted = 0, skipped = 0;
    const out: any[] = [];
    for (const r of rows) {
      const { text, removed } = scrubSecrets(cut(r?.text, 2000));
      redacted += removed;
      if (!text || /^(\[removed[^\]]*\]\s*)+$/.test(text)) { skipped++; continue; }
      const said = r?.said_at && Number.isFinite(new Date(r.said_at).getTime()) ? new Date(r.said_at).toISOString() : nowIso();
      const key = `${said.slice(0, 16)}|${text}`;
      if (seen.has(key)) { skipped++; continue; }
      seen.add(key);
      const client = findClient(cut(r?.client_id, 64), cut(r?.client_name, 120));
      const area = r?.area_id ? areas.find((a: any) => a.id === r.area_id) : r?.area_slug ? areas.find((a: any) => a.slug === r.area_slug) : null;
      out.push({
        said_at: said, source: SOURCES.includes(r?.source) ? r.source : "claude",
        client_id: client?.id || "", client_name: client?.business || cut(scrubSecrets(r?.client_name).text, 120),
        app_id: cut(r?.app_id, 64), area_id: area?.id || "", phase: PHASES.includes(r?.phase) ? r.phase : "tweak",
        text, tags: arr(r?.tags).map((t: unknown) => cut(scrubSecrets(t).text, 40)).filter(Boolean).slice(0, 12),
      });
    }
    if (out.length) await db.PromptLog.bulkCreate(out);
    return Response.json({ ok: true, created: out.length, skipped, redacted });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
