import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { loadSettings, ingestEvent } from "../../shared/emailStudio.ts";
import { verifyHookSignature } from "../../shared/emailCore.ts";
import { getSecret } from "../../shared/portalClient.ts";
import { studioState, planUnlocksStudios } from "../../shared/usagePlans.ts";

// Inbound automation triggers from a client's own Command System (server to server, no login).
// Contract: /mnt/user-data/outputs/mothership/studios-upgrade/AUTOMATION-TRIGGER-CONTRACT.md (summary below).
//   POST /functions/email-hook?c=<CRMClient id>
//   X-Interstellar-Timestamp: <unix seconds>                (must be within 5 minutes)
//   X-Interstellar-Signature: v1=<hex HMAC-SHA256(key, "<timestamp>.<raw body>")>
//   body: { event, email, first_name?, last_name?, name?, phone?, tags?, list?, fields?, consent?, occurred_at?, idempotency_key? }
// The key is a per-client app secret; its NAME is EmailStudioSettings.trigger_secret_name (EMAIL_TRIGGER_KEY_<SLUG>).
// Justin sets the value; it is never stored in data or returned. Rate limit: 120 / minute per client.

const ok = (b: unknown, status = 200) => Response.json(b, { status });

async function limited(db: any, key: string, perMin: number) {
  const minute = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
  try {
    const row = ((await db.RateLimitBucket.filter({ key }, "-updated_date", 1)) || [])[0];
    if (!row) { await db.RateLimitBucket.create({ key, window_start: minute, count: 1, day: minute.slice(0, 10), day_count: 1 }); return false; }
    const count = row.window_start === minute ? (Number(row.count) || 0) + 1 : 1;
    if (count > perMin) return true;
    await db.RateLimitBucket.update(row.id, { window_start: minute, count, day: minute.slice(0, 10), day_count: (Number(row.day_count) || 0) + 1 });
  } catch (_e) { /* fail open */ }
  return false;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return ok({ error: "POST only" }, 405);
  try {
    const url = new URL(req.url);
    const cid = String(url.searchParams.get("c") || "");
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(cid)) return ok({ error: "unknown_client" }, 404);
    const raw = await req.text();
    if (raw.length > 64_000) return ok({ error: "too_large" }, 413);
    const db = createClientFromRequest(req).asServiceRole.entities;
    const client = await db.CRMClient.get(cid).catch(() => null);
    if (!client) return ok({ error: "unknown_client" }, 404);
    if (await limited(db, `email-hook:${cid}`, 120)) return ok({ error: "rate_limited" }, 429);
    const settings = await loadSettings(db, client);
    const name = String(settings.trigger_secret_name || "");
    const secret = /^[A-Z][A-Z0-9_]{2,80}$/.test(name) ? getSecret(name) : "";
    const v = await verifyHookSignature(secret, req.headers.get("x-interstellar-timestamp"), raw, req.headers.get("x-interstellar-signature"));
    if (!v.ok) return ok({ error: v.reason }, v.reason === "key_not_configured" ? 503 : 401);
    if (!(planUnlocksStudios(client) || client?.usage_overrides?.email_dry_run === true) || studioState(client, "email") !== "on") return ok({ error: "email_studio_off" }, 403);
    let payload: any = {};
    try { payload = JSON.parse(raw); } catch { return ok({ error: "bad_json" }, 400); }
    const out = await ingestEvent(db, client, payload);
    if ((out as any).error) return ok({ error: (out as any).error }, (out as any).status || 400);
    return ok(out);
  } catch (e) {
    console.error("email-hook", (e as Error)?.message);
    return ok({ error: "server_error" }, 500);
  }
});
