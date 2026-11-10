import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { processPendingRuns } from "../../shared/runs.ts";

// Runs whenever an AutomationRun is created (workflow) and on demand from Mission Control.
// Idempotent: only touches runs not yet processed, so a retry never double-logs.
//
// The service-role token shares one entity_list budget (350 calls / 60s) with every other backend function.
// The nightly brain refresh (22:13 PT) burns most of it, so a call landing in that window gets "Rate limit
// exceeded ... Retry after Ns". Wait the advised time and try again instead of failing the workflow.
// (The workflow trigger also skips AutomationRuns created with processed: true, which have nothing to do.)
const MAX_TRIES = 3;
const MAX_TOTAL_WAIT_MS = 40_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const retryAfterMs = (msg: string) => {
  const m = /rate limit exceeded[\s\S]*?retry after (\d+)\s*s/i.exec(msg);
  return m ? (Number(m[1]) + 1) * 1000 + Math.floor(Math.random() * 1500) : null;
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let waited = 0;
  for (let attempt = 1; ; attempt++) {
    try {
      const results = await processPendingRuns(base44.asServiceRole.entities);
      // Trimmed for anyone but an admin: workflow triggers only need the count (security hardening Nov 2026).
      const caller = await base44.auth.me().catch(() => null);
      if (caller?.role !== "admin") return Response.json({ processed: results.length });
      return Response.json({ processed: results.length, results, attempts: attempt, waited_ms: waited });
    } catch (e) {
      const msg = (e as Error)?.message || String(e);
      const wait = retryAfterMs(msg);
      if (wait === null || attempt >= MAX_TRIES || waited + wait > MAX_TOTAL_WAIT_MS) {
        return Response.json({ error: msg, attempts: attempt, waited_ms: waited }, { status: wait === null ? 500 : 503 });
      }
      waited += wait;
      await sleep(wait);
    }
  }
});
