import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';
import { syncFromStripe } from "../../shared/stripeSync.ts";

// Admin button: pull every live subscription from Stripe and rewrite the clients' billing lines.
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    let key = "";
    try { key = secrets.get("STRIPE_SECRET_KEY") || ""; } catch { key = ""; }
    if (!key) return Response.json({ configured: false });
    return Response.json(await syncFromStripe(base44, key));
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 502 });
  }
}
