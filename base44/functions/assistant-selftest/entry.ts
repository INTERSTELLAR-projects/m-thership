import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import * as C from "../../shared/command.js";
import { invokeJson } from "../../shared/commandServer.ts";
import { loadGround, groundBlock, handleGrounded } from "../../shared/assistantGround.ts";

/*
 * TEMPORARY (Build Engine round, Nov 19 2026): runs the admin assistant's 15 test questions through the same code
 * path as command-ask, without signing in as anyone. Writes are limited to leads named "[TEST] …" (testOnly), and
 * every [TEST] record it made is deleted at the end. Results go to AppSettings "assistant_selftest" (counts and
 * replies only). Expires after Nov 21 2026; the function and its workflow are removed after the run.
 */
const EXPIRES = Date.parse("2026-11-21T00:00:00Z");
const TEST = "[TEST] North Woods Tree Removal";
const QUESTIONS = [
  "What needs me today?",
  "What's our MRR?",
  "Summarize Smallcakes",
  "What's left for VSRL?",
  "What's Seacoast's Brain %?",
  "Which builds are in progress?",
  "Which automations are broken?",
  "How many approvals are waiting by lane?",
  "Where is Service Process?",
  "What's the MRR for Zephyr Plumbing?",
  `Add lead ${TEST} nwtreeremoval.com`,
  `Scrape ${TEST}`,
  `Move ${TEST} to contacted because self-test of the assistant`,
  `Send to Claude: draft a homepage outline for ${TEST}`,
  "Publish the Seacoast site",
];

async function cleanup(db: any) {
  const leads = ((await db.CRMClient.filter({ business: TEST }, "-created_date", 20).catch(() => [])) || []).filter((c: any) => String(c.business).startsWith("[TEST]"));
  const out: Record<string, number> = {};
  const del = async (entity: string, rows: any[]) => { for (const r of rows) { await db[entity].delete(r.id).catch(() => null); out[entity] = (out[entity] || 0) + 1; } };
  for (const c of leads) {
    for (const e of ["BusinessBrain", "ClaudeJob", "LeadStageMove", "PrepChecklist", "Task", "BrainFact"]) await del(e, (await db[e].filter({ client_id: c.id }, "-created_date", 100).catch(() => [])) || []);
    await del("AgentAuditLog", (await db.AgentAuditLog.filter({ record_id: c.id }, "-at", 100).catch(() => [])) || []);
    await del("CRMClient", [c]);
  }
  // Audit rows for jobs queued on the test lead
  const left = ((await db.CRMClient.filter({ business: TEST }, "-created_date", 5).catch(() => [])) || []).length;
  return { deleted: out, test_leads_left: left };
}

export default async function (req: Request) {
  try {
    if (Date.now() > EXPIRES) return Response.json({ error: "expired" }, { status: 410 });
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    if (body?.action === "cleanup") return Response.json(await cleanup(db));
    if (body?.action !== "run") return Response.json({ error: "unknown" }, { status: 400 });

    const results: any[] = [];
    let scrape: any = null;
    for (const q of QUESTIONS) {
      const started = Date.now();
      let row: any = { q };
      try {
        const g = await loadGround(db);
        const det = await handleGrounded(base44, db, q, g, { by: "assistant-selftest", testOnly: true });
        if (det) row = { q, path: "grounded", reply: det.reply, done: (det.done || []).map((d: any) => d.label), open: det.open?.path || null, gated: !!det.gated };
        else {
          const src = await C.loadSources(db);
          const { s, scores } = C.computeAll(src, new Date(), { tz: C.TZ_DEFAULT, name: "Justin" });
          const out: any = await invokeJson(base44, C.askPrompt(q, s, scores, null, s.facts) + groundBlock(g), C.ASK_SCHEMA, 40000).catch(() => null);
          row = { q, path: "llm", reply: String(out?.reply || "(no reply)"), intents: (out?.intents || []).map((i: any) => i.type) };
        }
        if (/^Scrape/.test(q)) {
          const lead = ((await db.CRMClient.filter({ business: TEST }, "-created_date", 1).catch(() => [])) || [])[0];
          scrape = lead ? { status: lead.scrape_status, niche: lead.niche_key, summary: lead.scrape_summary || null } : null;
        }
      } catch (e) { row = { q, error: String((e as Error)?.message || e).slice(0, 300) }; }
      row.ms = Date.now() - started;
      results.push(row);
    }
    const clean = await cleanup(db);
    const value = { at: new Date().toISOString(), results, scrape, cleanup: clean };
    const ex = ((await db.AppSettings.filter({ key: "assistant_selftest" }, "-updated_date", 1).catch(() => [])) || [])[0];
    if (ex) await db.AppSettings.update(ex.id, { value }); else await db.AppSettings.create({ key: "assistant_selftest", value });
    return Response.json({ ok: true, n: results.length });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e).slice(0, 300) }, { status: 500 });
  }
}
