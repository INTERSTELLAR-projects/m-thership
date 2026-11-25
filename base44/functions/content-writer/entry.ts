// Content pipeline writer (docs/content-pipeline.md). Moves queued ContentSubmissions through checks → photos → writer
// + claim check → publish → live check (shared/contentProcessor.ts).
//   drain {}  Anyone may call it (workflows, content-intake): it only advances rows already queued and returns counts.
//             Each call works for up to ~100 s, then starts the next call itself if work is left.
//   run { id }  admin: one submission now, full detail back.
// Sites, profiles (album / door_project) and the manual queue live in shared/contentSites.ts + contentProcessor.ts.
// Note: a function is rebuilt when its own entry file is saved; touch this file after changing the shared modules.
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { processSubmission, ACTIVE } from "../../shared/contentProcessor.ts";
import { arr, s } from "../../shared/contentPipeline.ts";

const BUDGET_MS = 100_000;

import { schedulerGate } from "../../shared/schedulerGate.ts";
Deno.serve(async (req) => {
  const started = Date.now();
  const deadline = started + BUDGET_MS;
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const b = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const user = await base44.auth.me().catch(() => null);
    const isAdmin = user?.role === "admin";
    const action = s(b?.action) || "drain";
    if (!isAdmin && action === "drain") { const g = await schedulerGate(base44, user, "content-writer:drain", 30, 300); if (g) return g; }

    if (action === "run") {
      if (!isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
      const sub = await db.ContentSubmission.get(s(b.id)).catch(() => null);
      if (!sub) return Response.json({ error: "Not found" }, { status: 404 });
      const steps: any[] = [];
      let r: any = { status: sub.status };
      for (let i = 0; i < 6 && ACTIVE.includes(r.status) && Date.now() < deadline - 20000; i++) {
        r = await processSubmission(base44, sub, deadline);
        steps.push(r);
        if (r.skipped) break;
      }
      return Response.json({ ok: true, result: r, steps });
    }
    if (action !== "drain") return Response.json({ error: "Unknown action" }, { status: 400 });

    const results: any[] = [];
    let more = false;
    while (Date.now() < deadline - 20000) {
      const rows = arr(await db.ContentSubmission.filter({ status: { $in: ACTIVE } }, "received_at", 10).catch(() => []));
      const lockFree = rows.filter((r: any) => !r.locked_at || Date.now() - new Date(r.locked_at).getTime() > 4 * 60 * 1000);
      if (!lockFree.length) break;
      let progressed = false;
      for (const row of lockFree) {
        if (Date.now() > deadline - 20000) { more = true; break; }
        const r = await processSubmission(base44, row, deadline);
        results.push({ id: r.id, status: r.status, more: !!r.more, error: r.error ? "error" : undefined });
        if (!r.skipped) progressed = true;
        if (r.more) more = true;
      }
      if (!progressed) break;
    }
    if (more || Date.now() >= deadline - 20000) {
      const left = arr(await db.ContentSubmission.filter({ status: { $in: ACTIVE } }, "received_at", 1).catch(() => [])).length;
      if (left) {
        try { await Promise.race([base44.asServiceRole.functions.invoke("content-writer", { action: "drain" }), new Promise((r) => setTimeout(r, 2500))]); } catch { /* hourly drain picks it up */ }
      }
    }
    if (!isAdmin) return Response.json({ processed: results.length });
    return Response.json({ processed: results.length, results, ms: Date.now() - started });
  } catch (e) {
    console.error("content-writer", (e as Error)?.message);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
