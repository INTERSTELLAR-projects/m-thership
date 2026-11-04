// Road to Dec 31 (Møthership > Command > Road to Dec 31).
//   offers   {}            PUBLIC, read-only: the active public OfferCatalog rows (the one source of truth for packages,
//                          plans, prices, architectures, bonuses, guarantees, portal tools). Internal rows (public false)
//                          and rows pending Justin's approval are never returned. Safe for the website, portal and decks.
//   summary  {}            Admin: launch progress from LaunchItem (overall %, per workstream, Justin's open moves,
//                          blocking count, open questions) for Claude tasks and the Commander brief.
// Never writes anything, never sends anything, never reads secrets.
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";

const arr = (v: any) => (Array.isArray(v) ? v : (v && v.items) || []);
const LAUNCH = "2026-12-31";
const OFFER_FIELDS = ["key", "kind", "name", "short", "price", "price_display", "billing", "payment_plan", "architecture", "architecture_version", "summary", "includes", "bonuses", "value", "terms", "requires", "applies_to", "sort", "effective_from"];

async function list(ent: any, q: any = {}, sort = "sort", limit = 500) {
  try { return arr(await ent.filter(q, sort, limit)); } catch { return []; }
}

function pick(row: any, fields: string[]) {
  const o: any = {};
  for (const f of fields) if (row[f] !== undefined && row[f] !== null && !(Array.isArray(row[f]) && !row[f].length)) o[f] = row[f];
  return o;
}

export function summarize(items: any[]) {
  const live = items.filter((i) => (i.lane || "launch") === "launch" && (i.kind || "gap") === "gap" && i.status !== "deferred");
  const w = (i: any) => Math.max(0.5, Number(i.effort_hours) || 1);
  const done = (i: any) => i.status === "done";
  const pct = (rows: any[]) => { const t = rows.reduce((n, i) => n + w(i), 0); return t ? Math.round((rows.filter(done).reduce((n, i) => n + w(i), 0) / t) * 100) : 0; };
  const streams: Record<string, any[]> = {};
  for (const i of live) { const k = String(i.workstream || "Other").startsWith("Client:") ? "Clients" : i.workstream || "Other"; (streams[k] = streams[k] || []).push(i); }
  const days = Math.max(0, Math.ceil((new Date(`${LAUNCH}T23:59:59-08:00`).getTime() - Date.now()) / 86400000));
  const open = live.filter((i) => !done(i));
  return {
    launch_date: LAUNCH,
    days_left: days,
    overall_pct: pct(live),
    items: live.length,
    open: open.length,
    blocking_open: open.filter((i) => i.blocking_launch).length,
    workstreams: Object.entries(streams).map(([name, rows]) => ({ name, pct: pct(rows), open: rows.filter((i) => !done(i)).length, total: rows.length })).sort((a, b) => a.pct - b.pct),
    justin_moves: open.filter((i) => i.owner === "justin").sort((a, b) => (Number(b.unblocks) || 0) - (Number(a.unblocks) || 0) || (Number(a.priority) || 3) - (Number(b.priority) || 3)).slice(0, 10).map((i) => ({ key: i.key, title: i.title, unblocks: i.unblocks || 0, week: i.week || null, blocking: !!i.blocking_launch })),
    claude_open: open.filter((i) => i.owner === "claude").length,
    client_open: open.filter((i) => i.owner === "client").length,
    questions_open: items.filter((i) => i.kind === "question" && !i.answer && i.status !== "done").map((i) => ({ key: i.key, title: i.title })),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : Object.fromEntries(new URL(req.url).searchParams);
    const action = String(body?.action || "offers");
    const db = base44.asServiceRole.entities;

    if (action === "offers") {
      const rows = await list(db.OfferCatalog, { public: true, status: "active" }, "sort", 300);
      const offers = rows.map((r: any) => pick(r, OFFER_FIELDS));
      return Response.json({ offers, count: offers.length, source: "Møthership OfferCatalog", fetched_at: new Date().toISOString() }, { headers: { "Cache-Control": "public, max-age=300" } });
    }

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    if (action === "summary") {
      const items = await list(db.LaunchItem, {}, "priority", 1000);
      return Response.json(summarize(items));
    }
    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    console.error("launch", e);
    return Response.json({ error: String((e as any)?.message || e) }, { status: 500 });
  }
});
