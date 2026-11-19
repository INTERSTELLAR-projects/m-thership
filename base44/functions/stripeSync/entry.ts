import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';
import { syncFromStripe } from "../../shared/stripeSync.ts";

// Pull every live (active + trialing) subscription from Stripe and rewrite the clients' billing lines.
// Read-only toward Stripe: it only lists subscriptions, customers and products; nothing in Stripe is changed.
//   Admin ("Sync from Stripe" button): full report.
//   Scheduled resync (workflow "Stripe — scheduled resync", action "scheduled"): runs without a user and
//   returns counts only, so nothing about clients or amounts leaves the function.
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const scheduled = body?.action === "scheduled";
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!scheduled) {
      if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
      if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    let key = "";
    try { key = secrets.get("STRIPE_SECRET_KEY") || ""; } catch { key = ""; }
    if (!key) return Response.json({ configured: false });
    const result = await syncFromStripe(base44, key);
    if (scheduled && (!user || user.role !== "admin")) return Response.json({ ok: !result.errors.length, synced: result.synced, errors: result.errors.length, subscriptions: result.subscriptions, unmatched: result.unmatched.length, synced_at: result.synced_at });
    return Response.json(result);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 502 });
  }
}
