import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { inviteSettings, saveInviteSettings, pickInviteEmail, sentInviteFor, deliverInvite, sendDueInvites, onboardingEmail, normEmail } from "../../shared/portalInvite.ts";

// Client-portal onboarding invites (see base44/shared/portalInvite.ts for the security model).
//   status    (admin)  -> settings + this client's invite log
//   settings  (admin)  -> turn auto-send on/off
//   invite    (admin)  -> grant access + send the welcome email to ONE of the client's portal_emails (once; resend: true to repeat)
//   send_test (admin)  -> send the welcome email to the signed-in admin's own address only. No invite, no client email.
//   run_due   (schedule / admin) -> deliver queued Stripe invites that are due (only while auto-send is on)

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status");
    const user = await base44.auth.me().catch(() => null);
    const db = base44.asServiceRole.entities;

    if (action === "run_due") {
      // Safe without a user: it only delivers invites that a verified Stripe payment already queued.
      if (user && user.role !== "admin") return Response.json({ error: "Admins only" }, { status: 403 });
      return Response.json(await sendDueInvites(base44));
    }

    if (!user || user.role !== "admin") return Response.json({ error: "Admins only" }, { status: 403 });
    const settings = await inviteSettings(db);

    if (action === "settings") {
      const next = await saveInviteSettings(db, { auto_send: body?.auto_send, portal_url: body?.portal_url });
      return Response.json({ settings: next });
    }

    if (action === "send_test") {
      const to = normEmail(user.email);
      const client = body?.client_id ? await db.CRMClient.get(String(body.client_id)).catch(() => null) : null;
      const business = client?.business || "Your Business";
      const { subject, html } = onboardingEmail({ business, contact: client?.contact || user.full_name || "", portalUrl: settings.portal_url, email: to });
      await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: `[TEST] ${subject}`, body: html, from_name: "Interstellar Strategies" });
      // Logged under client_id "test" so it never counts as the client's real invite.
      await db.PortalInvite.create({ client_id: "test", client_name: "Test", email: to, source: "test", status: "sent", sent_at: new Date().toISOString(), invited_by: user.email, message: `Test of the onboarding email (sample business: ${business}) sent to the admin only. No portal access was granted.` });
      return Response.json({ ok: true, to });
    }

    const clientId = String(body?.client_id || "");
    if (!clientId) return Response.json({ error: "Missing client_id" }, { status: 400 });
    const client = await db.CRMClient.get(clientId).catch(() => null);
    if (!client) return Response.json({ error: "Client not found" }, { status: 404 });
    const log = await sentInviteFor(db, clientId);

    if (action === "status") {
      const pick = pickInviteEmail(client, "");
      return Response.json({
        settings: { auto_send: settings.auto_send, portal_url: settings.portal_url },
        portal_emails: client.portal_emails || [],
        portal_enabled: client.portal_enabled === true,
        default_email: "email" in pick ? pick.email : null,
        problem: "error" in pick ? pick.error : null,
        sent: log.sent ? { email: log.sent.email, sent_at: log.sent.sent_at, source: log.sent.source } : null,
        queued: log.queued ? { email: log.queued.email, due_at: log.queued.due_at } : null,
        history: log.rows.slice(0, 10).map((r: Record<string, unknown>) => ({ id: r.id, email: r.email, source: r.source, status: r.status, at: r.sent_at || r.created_date, due_at: r.due_at, message: r.message })),
      });
    }

    if (action === "invite") {
      if (log.sent && body?.resend !== true) {
        return Response.json({ error: `Already invited ${log.sent.email} on ${String(log.sent.sent_at || "").slice(0, 10)}. Choose Resend to send it again.`, code: "already_sent" }, { status: 409 });
      }
      const pick = pickInviteEmail(client, body?.email);
      if ("error" in pick) return Response.json({ error: pick.error }, { status: 400 });
      // A queued Stripe invite for this client is replaced by this manual one.
      if (log.queued) await db.PortalInvite.update(log.queued.id, { status: "skipped", message: `Sent manually by ${user.email} instead.` });
      const row = await db.PortalInvite.create({ client_id: client.id, client_name: client.business, email: pick.email, source: "manual", status: "queued", due_at: new Date().toISOString(), invited_by: user.email, resend: !!log.sent });
      const res = await deliverInvite(base44, row, settings);
      return Response.json(res, { status: res.ok ? 200 : 502 });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
