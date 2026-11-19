import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { renderEmail, renderSubject, normalizeBlocks, SENDER_NAME } from "../../shared/emailBlocks.ts";
import { unsubscribeUrl, normEmail } from "../../shared/emailUnsub.ts";
import { inviteSettings } from "../../shared/portalInvite.ts";

// Email Studio sends (admin only). Every email is rendered here from typed blocks with the SAME renderer the
// in-app preview uses (base44/shared/emailBlocks.ts = src/features/email/emailBlocks.js).
//   send_test { subject, blocks, vars?, kind? }  -> ONE email to the signed-in admin's own address, "[TEST]" subject.
//   send      { draft_id?, subject, blocks, kind, recipients: [{ email, name?, client_id?, subscriber_id?, vars? }] }
//             -> one separate email per recipient (nobody ever sees another recipient). kind "mass" adds the signed
//                one-click unsubscribe link and skips anyone who unsubscribed; "direct" (1:1 client mail) does not.
// Sent through the app's mail domain as "Justin | Interstellar Strategies".

const MAX_RECIPIENTS = 1000;
const isEmail = (e: string) => /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(e);
const cleanVars = (v: unknown) => {
  const out: Record<string, string> = {};
  if (v && typeof v === "object") Object.entries(v as Record<string, unknown>).slice(0, 30).forEach(([k, val]) => {
    if (/^[a-z_]{1,30}$/.test(k) && (typeof val === "string" || typeof val === "number")) out[k] = String(val).slice(0, 300);
  });
  return out;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== "admin") return Response.json({ error: "Admins only" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const db = base44.asServiceRole.entities;

    const blocks = normalizeBlocks(body?.blocks);
    const doc = { subject: String(body?.subject || "").slice(0, 250), blocks };
    if (!doc.subject.trim()) return Response.json({ error: "Add a subject line first" }, { status: 400 });
    const kind = body?.kind === "mass" ? "mass" : "direct";
    const settings = await inviteSettings(db);
    const portalUrl = settings.portal_url;

    if (action === "send_test") {
      const to = normEmail(user.email);
      const vars = { portal_url: portalUrl, ...cleanVars(body?.vars) };
      const html = renderEmail(doc, { vars, unsubscribeUrl: kind === "mass" ? await unsubscribeUrl(portalUrl, to) : "" });
      await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: `[TEST] ${renderSubject(doc, vars)}`, body: html, from_name: SENDER_NAME });
      return Response.json({ ok: true, to });
    }

    if (action === "send") {
      const raw = Array.isArray(body?.recipients) ? body.recipients : [];
      if (!raw.length) return Response.json({ error: "No recipients" }, { status: 400 });
      if (raw.length > MAX_RECIPIENTS) return Response.json({ error: `At most ${MAX_RECIPIENTS} recipients per send` }, { status: 400 });

      const seen = new Set<string>();
      const recipients: { email: string; name: string; client_id: string; subscriber_id: string; vars: Record<string, string> }[] = [];
      const results: Record<string, unknown>[] = [];
      for (const r of raw) {
        const email = normEmail(r?.email);
        if (!isEmail(email)) { results.push({ email: String(r?.email || "").slice(0, 200), name: String(r?.name || ""), status: "skipped", error: "Not a valid email" }); continue; }
        if (seen.has(email)) continue;
        seen.add(email);
        recipients.push({ email, name: String(r?.name || "").slice(0, 160), client_id: String(r?.client_id || ""), subscriber_id: String(r?.subscriber_id || ""), vars: { portal_url: portalUrl, email, ...cleanVars(r?.vars) } });
      }

      // Mass sends respect unsubscribes, whoever the recipient is.
      let unsubscribed = new Set<string>();
      if (kind === "mass") {
        const subs = await db.EmailSubscriber.filter({ status: "unsubscribed" }, "-updated_date", 5000).catch(() => []);
        unsubscribed = new Set((subs || []).map((s: { email?: string }) => normEmail(s.email)));
      }

      const draftId = String(body?.draft_id || "");
      if (draftId) await db.EmailDraft.update(draftId, { status: "sending" }).catch(() => null);

      const queue = recipients.filter((r) => {
        if (unsubscribed.has(r.email)) { results.push({ email: r.email, name: r.name, status: "skipped", error: "Unsubscribed" }); return false; }
        return true;
      });
      // Co-branded header: each client recipient's email shows "INTERSTELLAR™ × their current website logo".
      const logos = new Map<string, { logo: string; name: string }>();
      for (const id of [...new Set(queue.map((r) => r.client_id).filter(Boolean))]) {
        const c = await db.CRMClient.get(id).catch(() => null);
        if (c?.logo_url) logos.set(id, { logo: String(c.logo_url), name: String(c.business || "") });
      }
      let i = 0;
      const worker = async () => {
        while (i < queue.length) {
          const r = queue[i++];
          try {
            const co = logos.get(r.client_id);
            const html = renderEmail(doc, { vars: r.vars, unsubscribeUrl: kind === "mass" ? await unsubscribeUrl(portalUrl, r.email) : "", clientLogo: co?.logo || "", clientName: co?.name || "" });
            await base44.asServiceRole.integrations.Core.SendEmail({ to: r.email, subject: renderSubject(doc, r.vars), body: html, from_name: SENDER_NAME });
            results.push({ email: r.email, name: r.name, client_id: r.client_id, subscriber_id: r.subscriber_id, status: "sent", at: new Date().toISOString() });
          } catch (e) {
            results.push({ email: r.email, name: r.name, client_id: r.client_id, subscriber_id: r.subscriber_id, status: "failed", error: String((e as Error)?.message || e).slice(0, 300) });
          }
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);

      const sent = results.filter((r) => r.status === "sent").length;
      const failed = results.filter((r) => r.status === "failed").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      const now = new Date().toISOString();
      const record = {
        subject: doc.subject, blocks, kind, sent_at: now, sent_by: user.email,
        status: sent ? "sent" : "failed", sent_count: sent, failed_count: failed, skipped_count: skipped, results,
        recipients: recipients.map((r) => ({ email: r.email, name: r.name, client_id: r.client_id, subscriber_id: r.subscriber_id, vars: r.vars })),
      };
      let saved: { id?: string } | null = null;
      if (draftId) saved = await db.EmailDraft.update(draftId, record).catch(() => null);
      if (!saved) saved = await db.EmailDraft.create({ title: doc.subject, audience: body?.audience || {}, ...record }).catch(() => null);

      // Stamp subscribers that received it.
      const subIds = results.filter((r) => r.status === "sent" && r.subscriber_id).map((r) => String(r.subscriber_id));
      for (const id of subIds.slice(0, 500)) await db.EmailSubscriber.update(id, { last_sent_at: now }).catch(() => null);

      return Response.json({ ok: sent > 0, draft_id: saved?.id || draftId || null, sent, failed, skipped, results });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
