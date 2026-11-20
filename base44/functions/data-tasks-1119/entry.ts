import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

/*
 * TEMPORARY (Nov 19-20 2026, Justin's data-only tasks). Removed after use. No input is trusted: every action is fixed.
 *   analyze      counts + top payees of the bank ledger, rules, and the Search Intel actions -> AppSettings data_tasks_1119
 *   seo_approve  approves every proposed Search Intel action with "Approved by Justin, Nov 19"; hard-gate ones get a
 *                HOLD FOR TAP line so the queue runner checkpoints but never deploys them.
 * Never moves money, never touches the bank connection, never deletes.
 */
const EXPIRES = Date.parse("2026-11-21T12:00:00Z");
const s = (v: unknown) => (v == null ? "" : String(v));
const norm = (v: unknown) => s(v).toLowerCase().replace(/\s+/g, " ").trim();
function payeePattern(v: unknown) {
  let p = norm(v)
    .replace(/(pos|debit|card|purchase|recurring|ach|withdrawal|payment|online|checkcard|visa|mc)\s+/g, " ")
    .replace(/[#*]\s*\w*\d\w*/g, " ").replace(/\b\d{2,}\b/g, " ").replace(/\b(xx+\d*|\d+x+)\b/g, " ")
    .replace(/[^a-z0-9 .&'-]/g, " ").replace(/\s+/g, " ").trim();
  p = p.replace(/\s+[a-z]{2}$/, "").trim();
  return p.split(" ").slice(0, 3).join(" ");
}
async function listAll(ent: any, q: any, sort: string, max = 5000) {
  const out: any[] = [];
  for (let skip = 0; skip < max; skip += 500) {
    const page = (await ent.filter(q, sort, 500, skip).catch(() => [])) || [];
    out.push(...page);
    if (page.length < 500) break;
  }
  return out;
}
const HOLD_IDS = new Set(["A-1119-1", "A-1106-5", "A-1105-3", "A-1031-1", "A-1029-5", "A-1103-1"]);

async function save(db: any, patch: any) {
  const ex = ((await db.AppSettings.filter({ key: "data_tasks_1119" }, "-updated_date", 1).catch(() => [])) || [])[0];
  const value = { ...(ex?.pageSettings || {}), ...patch, at: new Date().toISOString() };
  if (ex) await db.AppSettings.update(ex.id, { pageSettings: value }); else await db.AppSettings.create({ key: "data_tasks_1119", pageSettings: value });
}

export default async function (req: Request) {
  try {
    if (Date.now() > EXPIRES) return Response.json({ error: "expired" }, { status: 410 });
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const action = s(body?.action);

    if (action === "analyze") {
      const tx = await listAll(db.LedgerTransaction, {}, "date");
      const rules = await listAll(db.LedgerRule, {}, "priority", 1000);
      const by = (f: (t: any) => string) => tx.reduce((m: any, t: any) => { const k = f(t) || "(none)"; m[k] = (m[k] || 0) + 1; return m; }, {});
      const groups: Record<string, any> = {};
      for (const t of tx) {
        const k = `${t.direction}|${payeePattern(t.payee || t.description)}`;
        const g = groups[k] || (groups[k] = { k, n: 0, amt: 0, cats: {}, rs: {}, sample: s(t.payee || t.description).slice(0, 60), acct: s(t.account).slice(0, 30), sugg: {} });
        g.n++; g.amt += Number(t.amount) || 0;
        g.cats[t.category || "-"] = (g.cats[t.category || "-"] || 0) + 1;
        g.rs[t.review_status || "-"] = (g.rs[t.review_status || "-"] || 0) + 1;
        if (t.ai_suggestion?.category) g.sugg[t.ai_suggestion.category] = (g.sugg[t.ai_suggestion.category] || 0) + 1;
      }
      const top = Object.values(groups).sort((a: any, b: any) => b.n - a.n).slice(0, 260).map((g: any) => ({ ...g, amt: Math.round(g.amt) }));
      await save(db, {
        ledger: { total: tx.length, review: by((t) => t.review_status), category: by((t) => t.category), direction: by((t) => t.direction), source: by((t) => t.source), account: by((t) => t.account), years: by((t) => s(t.date).slice(0, 4)) },
        rules: rules.map((r: any) => ({ p: r.pattern, c: r.category, d: r.direction, pr: r.priority, l: !!r.learned, a: r.active !== false })),
        groups: top, group_count: Object.keys(groups).length,
      });
      return Response.json({ ok: true, n: tx.length });
    }

    if (action === "seo_approve") {
      const rows = await listAll(db.SeoIntel, { kind: "action", status: "proposed" }, "brief_date", 500);
      const done: string[] = [], held: string[] = [];
      for (const r of rows) {
        const hold = HOLD_IDS.has(s(r.action_id));
        const lines = [s(r.notes).trimEnd(), "Approved by Justin, Nov 19"];
        if (hold) lines.push("HOLD FOR TAP: changes are made and checkpointed, but nothing goes live until Justin taps Ready to publish (hard gate: live site change).");
        await db.SeoIntel.update(r.id, { status: "approved", notes: lines.join("\n") });
        (hold ? held : done).push(s(r.action_id));
      }
      await save(db, { seo: { approved: done.length + held.length, held } });
      return Response.json({ ok: true, approved: done.length + held.length, held });
    }
    return Response.json({ error: "unknown" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: s((e as Error)?.message).slice(0, 300) }, { status: 500 });
  }
}
