// TEMPORARY: one-off test send of the onboarding email to Justin only. Deleted right after use.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { inviteSettings, onboardingEmail, sendBrandedEmail } from "../../shared/portalInvite.ts";

const TO = "justin@interstellar-strategies.com";
const NONCE = "075d736a45d9a83f1a40dc86585ee773";

Deno.serve(async (req) => {
  if (new URL(req.url).searchParams.get("k") !== NONCE) return Response.json({ error: "Not found" }, { status: 404 });
  const base44 = createClientFromRequest(req);
  const db = base44.asServiceRole.entities;
  const settings = await inviteSettings(db);
  const { subject, html } = onboardingEmail({ business: "Interstellar Strategies", contact: "Justin", portalUrl: settings.portal_url, email: TO });
  const sent = await sendBrandedEmail(base44, { to: TO, subject: `[TEST] ${subject}`, html });
  await db.PortalInvite.create({ client_id: "test", client_name: "Test", email: TO, source: "test", status: "sent", sent_at: new Date().toISOString(), invited_by: "claude", message: "Test of the onboarding email (orange links, INTERSTELLAR® lockup, custom domain, new sender) sent to the admin only. No portal access was granted." });
  return Response.json({ ok: true, to: TO, subject: `[TEST] ${subject}`, login_url: `${settings.portal_url}/login`, ...sent });
});
