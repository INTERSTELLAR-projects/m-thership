// Client-portal onboarding invites.
//
// Security model:
// - No passwords, codes or tokens are ever put in an email or stored. Access is granted with Base44's own
//   user invite (users.inviteUser), and the person signs in through Base44's login (Google or emailed one-time code).
// - Only ONE email per invite, and it must be one of the client's portal_emails. A Stripe payment can only add the
//   paying customer's own email, and only when the client has no portal login yet; anything else waits for review.
// - The portal function itself only ever shows a login the client whose portal_emails contains that email.
// - One sent invite per client. Re-sending is an explicit admin action and is logged as a resend.
// - Nothing goes out automatically unless auto_send is switched on (AppSettings key "portal_invites").

// deno-lint-ignore-file no-explicit-any
export const DEFAULT_PORTAL_URL = "https://m-thership.base44.app";
const LOGO = "https://media.base44.com/images/public/6ae18dc255e0da91f0ee6f1b/536102fbf_interstellar-mark-v2.webp";
const DAY_MS = 24 * 60 * 60 * 1000;

export const normEmail = (e: unknown) => String(e || "").trim().toLowerCase();
export const isEmail = (e: string) => /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(e);
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export async function inviteSettings(db: any) {
  const rows = (await db.AppSettings.filter({ key: "portal_invites" }, "-created_date", 1).catch(() => [])) || [];
  const row = rows[0] || null;
  const s = (row?.portalSettings || {}) as Record<string, unknown>;
  const url = String(s.portal_url || "");
  return { row, auto_send: s.auto_send === true, portal_url: /^https:\/\/[^\s]+$/.test(url) ? url.replace(/\/+$/, "") : DEFAULT_PORTAL_URL };
}

export async function saveInviteSettings(db: any, patch: { auto_send?: boolean; portal_url?: string }) {
  const cur = await inviteSettings(db);
  const next: Record<string, unknown> = { auto_send: cur.auto_send, portal_url: cur.portal_url };
  if (typeof patch.auto_send === "boolean") next.auto_send = patch.auto_send;
  if (typeof patch.portal_url === "string" && /^https:\/\/[^\s]+$/.test(patch.portal_url)) next.portal_url = patch.portal_url.replace(/\/+$/, "");
  if (cur.row) await db.AppSettings.update(cur.row.id, { portalSettings: next });
  else await db.AppSettings.create({ key: "portal_invites", portalSettings: next });
  return { auto_send: next.auto_send === true, portal_url: String(next.portal_url) };
}

export function onboardingEmail({ business, contact, portalUrl, email }: { business: string; contact?: string; portalUrl: string; email: string }) {
  const first = String(contact || "").split(/[\s&,]+/)[0] || "there";
  const loginUrl = `${portalUrl}/login`;
  const subject = `Your ${business} portal is ready`;
  const step = (n: number, title: string, text: string) => `
              <tr><td style="padding:0 0 14px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                  <td width="34" valign="top" style="font:600 13px/26px Arial,Helvetica,sans-serif;color:#ffffff;"><div style="width:26px;height:26px;background:#ff3c00;background-image:linear-gradient(135deg,#ff3c00,#ff6a00);text-align:center;border-radius:2px;">${n}</div></td>
                  <td valign="top" style="font:15px/22px Arial,Helvetica,sans-serif;color:#141414;"><strong>${title}</strong><br><span style="color:#5b5753;font-size:14px;">${text}</span></td>
                </tr></table>
              </td></tr>`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#ebe8e4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ebe8e4;">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dcd7d1;">
      <tr><td height="6" style="height:6px;line-height:6px;font-size:0;background:#ff3c00;background-image:linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00);">&nbsp;</td></tr>
      <tr><td style="padding:28px 36px 8px 36px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="middle" style="padding-right:12px;"><img src="${LOGO}" width="40" height="40" alt="Interstellar Strategies" style="display:block;border:0;width:40px;height:40px;"></td>
          <td valign="middle" style="font:700 15px/18px Arial,Helvetica,sans-serif;letter-spacing:2px;color:#141414;">M&Oslash;THERSHIP<br><span style="font:400 10px/14px 'Courier New',monospace;letter-spacing:2px;color:#8a847e;">BY INTERSTELLAR</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:20px 36px 0 36px;font:700 28px/32px Arial,Helvetica,sans-serif;color:#141414;letter-spacing:-0.5px;">
        Your client portal is <span style="color:#ff3c00;">ready</span>, ${esc(first)}.
      </td></tr>
      <tr><td style="padding:14px 36px 0 36px;font:15px/24px Arial,Helvetica,sans-serif;color:#3b3835;">
        Thanks for choosing Interstellar Strategies. Everything we do for <strong>${esc(business)}</strong> now lives in one place: every blog, Google post and website update as it goes live, your results, your Google reviews, requests, files and a direct line to our team.
      </td></tr>
      <tr><td style="padding:22px 36px 0 36px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="2" style="height:2px;line-height:2px;font-size:0;background:#ff3c00;background-image:linear-gradient(90deg,#ff3c00,#ff6a00);">&nbsp;</td></tr></table>
      </td></tr>
      <tr><td style="padding:24px 36px 6px 36px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${step(1, "Log in", `Use the button below and sign in with <strong>${esc(email)}</strong>. Use Google if that address is a Google account, or ask for a one-time code by email. There is no password to remember.`)}${step(2, "Tell us about your business", "Fill in the short business audit on your Home page. It saves as you go.")}${step(3, "Send your first request", "Website edits, content, Google posts, design: pick a form under Requests and we reply within 1 business day.")}
        </table>
      </td></tr>
      <tr><td align="left" style="padding:8px 36px 8px 36px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="background:#ff3c00;background-image:linear-gradient(90deg,#ff3c00,#ff6a00);">
            <a href="${esc(loginUrl)}" target="_blank" style="display:inline-block;padding:15px 30px;font:600 15px/18px Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;">Log in to your portal &rarr;</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:10px 36px 0 36px;font:12px/18px Arial,Helvetica,sans-serif;color:#8a847e;">
        Or paste this into your browser: <a href="${esc(loginUrl)}" style="color:#ff3c00;text-decoration:underline;">${esc(loginUrl)}</a>
      </td></tr>
      <tr><td style="padding:22px 36px 28px 36px;font:13px/20px Arial,Helvetica,sans-serif;color:#5b5753;">
        This invite is only for ${esc(email)}. We will never ask for your password by email. If you weren't expecting this, just reply and let us know.<br><br>
        Talk soon,<br><strong style="color:#141414;">Justin Cowell</strong><br>Interstellar Strategies
      </td></tr>
      <tr><td height="6" style="height:6px;line-height:6px;font-size:0;background:#ffaa00;background-image:linear-gradient(90deg,#ffaa00,#ff6a00,#ff3c00);">&nbsp;</td></tr>
    </table>
    <p style="margin:16px 0 0 0;font:11px/16px Arial,Helvetica,sans-serif;color:#8a847e;">Interstellar Strategies &middot; Molalla, Oregon</p>
  </td></tr>
</table>
</body></html>`;
  return { subject, html };
}

// Which single email this client's invite goes to. Returns { email, addToPortal } or { error }.
export function pickInviteEmail(client: any, wanted?: string, opts: { fromStripe?: boolean } = {}) {
  const portal = ((client.portal_emails as string[]) || []).map(normEmail).filter(Boolean);
  const w = normEmail(wanted);
  if (w) {
    if (!isEmail(w)) return { error: "That isn't a valid email address." };
    if (portal.includes(w)) return { email: w, addToPortal: false };
    // A paying customer can become the first portal login; anyone else needs Justin to add them first.
    if (opts.fromStripe && portal.length === 0) return { email: w, addToPortal: true };
    return { error: `${w} isn't one of this client's portal login emails. Add it under Edit client > Portal login emails first.`, review: true };
  }
  if (portal.length) return { email: portal[0], addToPortal: false };
  return { error: "This client has no portal login email yet. Add one under Edit client > Portal login emails." };
}

export async function sentInviteFor(db: any, clientId: string) {
  const rows = ((await db.PortalInvite.filter({ client_id: clientId }, "-created_date", 50).catch(() => [])) || []).filter((r: any) => r.source !== "test");
  return { sent: rows.find((r: any) => r.status === "sent") || null, queued: rows.find((r: any) => r.status === "queued") || null, rows };
}

// Grants portal access and sends the branded onboarding email. Logs the result on the invite row.
export async function deliverInvite(base44: any, invite: any, settings: { portal_url: string }) {
  const db = base44.asServiceRole.entities;
  const client = await db.CRMClient.get(invite.client_id).catch(() => null);
  if (!client) {
    await db.PortalInvite.update(invite.id, { status: "failed", message: "Client record no longer exists." });
    return { ok: false, error: "Client not found" };
  }
  const email = normEmail(invite.email);
  const portal = ((client.portal_emails as string[]) || []).map(normEmail);
  if (!portal.includes(email)) {
    await db.PortalInvite.update(invite.id, { status: "needs_review", message: `${email} is no longer in this client's portal login emails, so nothing was sent.` });
    return { ok: false, error: "Email not in portal_emails" };
  }
  try {
    try {
      await base44.asServiceRole.users.inviteUser(email, "user");
    } catch (e: any) {
      const msg = String(e?.response?.data?.message || e?.message || e);
      // Already a user of the app: access already exists, carry on with the welcome email.
      if (!/already|exist/i.test(msg)) throw e;
    }
    if (client.portal_enabled !== true) await db.CRMClient.update(client.id, { portal_enabled: true });
    const { subject, html } = onboardingEmail({ business: client.business, contact: client.contact, portalUrl: settings.portal_url, email });
    await base44.asServiceRole.integrations.Core.SendEmail({ to: email, subject, body: html, from_name: "Interstellar Strategies" });
    const now = new Date().toISOString();
    await db.PortalInvite.update(invite.id, { status: "sent", sent_at: now, message: `Portal access granted and welcome email sent to ${email}.` });
    return { ok: true, email, sent_at: now };
  } catch (e: any) {
    const msg = String(e?.response?.data?.message || e?.message || e).slice(0, 400);
    await db.PortalInvite.update(invite.id, { status: "failed", message: msg });
    return { ok: false, error: msg };
  }
}

// Called by the Stripe webhook for a paid invoice. Only the first invoice of a new subscription queues an invite,
// due the day after payment. Renewals, upgrades and clients already invited are ignored.
export async function queueFromInvoice(base44: any, invoice: any) {
  const db = base44.asServiceRole.entities;
  if (!invoice || invoice.object !== "invoice") return { queued: false, reason: "not an invoice" };
  if (invoice.billing_reason !== "subscription_create") return { queued: false, reason: `billing_reason ${invoice.billing_reason}` };
  if (!(Number(invoice.amount_paid) > 0)) return { queued: false, reason: "nothing paid" };
  const customer = String(invoice.customer || "");
  const clients = (await db.CRMClient.list("business", 500)) || [];
  const client = clients.find((c: any) => c.stripe_customer_id === customer || ((c.stripe_customer_ids as string[]) || []).includes(customer));
  if (!client) return { queued: false, reason: "no client matched this Stripe customer" };
  const existing = (await db.PortalInvite.filter({ stripe_invoice_id: String(invoice.id) }, "-created_date", 1).catch(() => [])) || [];
  if (existing.length) return { queued: false, reason: "already handled", invite_id: existing[0].id };
  const { sent, queued } = await sentInviteFor(db, client.id);
  const pkg = ((invoice.lines?.data || []) as any[]).map((l) => l.description || l.price?.nickname || "").filter(Boolean).join(", ").slice(0, 300);
  const base = { client_id: client.id, client_name: client.business, source: "stripe", stripe_invoice_id: String(invoice.id), stripe_customer_id: customer, package: pkg, invited_by: "stripe" };
  if (sent || queued) {
    await db.PortalInvite.create({ ...base, email: normEmail(invoice.customer_email) || "unknown@invalid.test", status: "skipped", message: sent ? "Client already has a portal invite; not sent again." : "An invite is already queued for this client." });
    return { queued: false, reason: "already invited" };
  }
  const pick = pickInviteEmail(client, invoice.customer_email, { fromStripe: true });
  if ("error" in pick) {
    await db.PortalInvite.create({ ...base, email: normEmail(invoice.customer_email) || "unknown@invalid.test", status: "needs_review", message: pick.error });
    return { queued: false, reason: pick.error };
  }
  if (pick.addToPortal) await db.CRMClient.update(client.id, { portal_emails: [pick.email] });
  const paidAt = Number(invoice.status_transitions?.paid_at) ? Number(invoice.status_transitions.paid_at) * 1000 : Date.now();
  const row = await db.PortalInvite.create({ ...base, email: pick.email, status: "queued", due_at: new Date(paidAt + DAY_MS).toISOString(), message: `Queued after ${pkg || "subscription"} payment. Goes out the day after payment.` });
  return { queued: true, invite_id: row.id, client: client.business };
}

// Sends every queued invite that is due. Does nothing while auto_send is off.
export async function sendDueInvites(base44: any) {
  const db = base44.asServiceRole.entities;
  const settings = await inviteSettings(db);
  if (!settings.auto_send) return { auto_send: false, sent: 0, results: [] };
  const queued = (await db.PortalInvite.filter({ status: "queued" }, "due_at", 50).catch(() => [])) || [];
  const now = Date.now();
  const results: any[] = [];
  for (const inv of queued) {
    if (!inv.due_at || Date.parse(inv.due_at) > now) continue;
    const { sent } = await sentInviteFor(db, inv.client_id);
    if (sent && sent.id !== inv.id) { await db.PortalInvite.update(inv.id, { status: "skipped", message: "Client was already invited." }); continue; }
    results.push({ id: inv.id, client: inv.client_name, ...(await deliverInvite(base44, inv, settings)) });
  }
  return { auto_send: true, sent: results.filter((r) => r.ok).length, results };
}
