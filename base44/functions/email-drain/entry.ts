// @ts-nocheck
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { drain } from "../../shared/emailStudio.ts";

// Email Studio sending job (every 5 minutes, "Studios — drain bulk email queue" workflow). Does, in order:
//   1. promotes scheduled EmailSendBatch rows whose time has come (metering the campaign then),
//   2. sends pending batches (one SES email per recipient, suppression + unsubscribe + tracking),
//   3. runs Email Studio automations (due steps + the daily win-back / birthday / anniversary scans).
// No user (the scheduled workflow) or an admin may run it. Portal users never can.
// Test clients (usage_overrides.email_dry_run) go through every step except the SES call.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== "admin") return Response.json({ error: "Admins only" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const out = await drain(base44.asServiceRole.entities, { onlyCampaign: user && body?.campaign_id ? String(body.campaign_id) : "" });
    return Response.json(out);
  } catch (e) {
    console.error("email-drain", e?.message);
    return Response.json({ ok: false, error: e?.message || "drain failed" }, { status: 500 });
  }
});
