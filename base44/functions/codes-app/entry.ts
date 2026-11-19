import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";

// Interstellar Codes panel (More → Interstellar Codes, /qr?tab=codes-app).
// Admin-only proxy to the Codes app's growthStats feed: app growth (users, codes, scans) and its SEO manifest.
// The shared key is the CODES_STATS_KEY secret, set to the same value in BOTH apps (Møthership and Interstellar Codes).
// Aggregates only; no personal data crosses over.
const FEED = "https://interstellarcodes.com/functions/growthStats";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: "Sign in required" }, { status: 401 });
    if (me.role !== "admin") return Response.json({ error: "Admins only" }, { status: 403 });
    const key = Deno.env.get("CODES_STATS_KEY") || "";
    if (!key) return Response.json({ ok: false, setup: true, error: "Set the CODES_STATS_KEY secret in Møthership and in Interstellar Codes (same value)." });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(FEED, { method: "POST", headers: { "x-codes-key": key, "content-type": "application/json" }, body: "{}", signal: ctrl.signal }).finally(() => clearTimeout(timer));
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return Response.json({ ok: false, setup: res.status === 401 || res.status === 503, error: data?.error || `Codes app answered ${res.status}` });
    return Response.json({ ok: true, ...data });
  } catch (e) {
    return Response.json({ ok: false, error: "Could not reach interstellarcodes.com" });
  }
});
