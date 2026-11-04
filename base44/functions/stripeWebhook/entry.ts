import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';
import { syncFromStripe } from "../../shared/stripeSync.ts";
import { queueFromInvoice } from "../../shared/portalInvite.ts";
import { creditFromCheckoutSession } from "../../shared/fuel.ts";

/*
 * Stripe → Møthership, as it happens. Register this function's URL in Stripe (Developers → Webhooks) for:
 *   customer.subscription.created · customer.subscription.updated · customer.subscription.deleted · invoice.paid
 *   checkout.session.completed   (Refuel credit packs: credits the client's wallet, idempotent by session id)
 * and save the endpoint's signing secret as STRIPE_WEBHOOK_SECRET. Subscription events re-sync the clients' lines.
 */
async function verify(payload: string, header: string, secret: string) {
  // Stripe can send several v1 signatures (during secret rotation): accept if any one matches.
  const pairs = header.split(",").map((p) => p.trim().split("="));
  const t = pairs.find(([k]) => k === "t")?.[1];
  const sigs = pairs.filter(([k]) => k === "v1").map(([, v]) => v || "");
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(`${t}.${payload}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  // Constant-time compare.
  return sigs.some((v1) => v1.length === hex.length && [...hex].reduce((d, c, i) => d | (c.charCodeAt(0) ^ v1.charCodeAt(i)), 0) === 0);
}

export default async function (req: Request) {
  if (req.method !== "POST") return Response.json({ ok: true, info: "Stripe webhook endpoint" });
  let key = "", whsec = "";
  try { key = secrets.get("STRIPE_SECRET_KEY") || ""; whsec = secrets.get("STRIPE_WEBHOOK_SECRET") || ""; } catch {}
  if (!key || !whsec) return Response.json({ error: "Stripe secrets missing" }, { status: 503 });
  const payload = await req.text();
  const ok = await verify(payload, req.headers.get("stripe-signature") || "", whsec);
  if (!ok) return Response.json({ error: "Bad signature" }, { status: 400 });
  const event = JSON.parse(payload);
  // Refuel packs (one-time Checkout, payment mode). Only sessions the `fuel` function created (metadata.purpose
  // "refuel") are credited; a retried event finds the existing lot and credits nothing twice.
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    try {
      const base44 = createClientFromRequest(req);
      const out = await creditFromCheckoutSession(base44.asServiceRole.entities, event.data?.object || {});
      return Response.json({ received: true, type: event.type, refuel: out });
    } catch (error: any) {
      // 500 so Stripe retries: crediting is idempotent.
      return Response.json({ received: false, error: error.message }, { status: 500 });
    }
  }
  const relevant = /^customer\.subscription\.|^invoice\.paid$|^customer\.(created|updated)$/.test(event.type || "");
  if (!relevant) return Response.json({ received: true, ignored: event.type });
  try {
    const base44 = createClientFromRequest(req);
    const result = await syncFromStripe(base44, key);
    // First payment on a new subscription: queue the client's portal onboarding invite for the next day.
    let invite = null;
    if (event.type === "invoice.paid") invite = await queueFromInvoice(base44, event.data?.object).catch((e: any) => ({ queued: false, reason: e.message }));
    return Response.json({ received: true, type: event.type, synced: result.synced, unmatched: result.unmatched.length, invite });
  } catch (error: any) {
    return Response.json({ received: true, error: error.message }, { status: 200 });
  }
}
