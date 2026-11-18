// @ts-nocheck
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { emailKeys, loadSettings, loadTheme } from "../../shared/emailStudio.ts";
import { verifyToken } from "../../shared/emailCore.ts";
import { onColor, readable } from "../../shared/clientEmail.ts";

// One-click unsubscribe for client Email Studio contacts, on the CLIENT's brand (their subscribers never see ours).
// No login and no address in the URL: ?u=<signed opaque token> = client id | contact id | source (campaign or
// automation step), signed with a purpose-bound key (emailStudio.contactUnsubUrl).
//   GET  ?u=<token>               page with one "Unsubscribe" button (a GET never changes anything, so mail scanners
//                                 that pre-open links cannot unsubscribe anyone)
//   POST u=<token>[&op=resubscribe]  unsubscribe (suppression + contact status + EmailEvent for results) or undo.
//   RFC 8058 List-Unsubscribe-Post (one-click from the inbox) is a POST without op -> unsubscribe.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const html = (s, status = 200) => new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });

function page(t, title, text, form = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} | ${esc(t.business)}</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:${t.background};font-family:${t.font};color:${t.text};display:flex;align-items:flex-start;justify-content:center;padding:48px 16px}
.card{width:100%;max-width:480px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 20px 50px -30px rgba(0,0,0,.35)}.bar{height:6px;background:${t.primary}}.in{padding:30px 28px}
img{height:40px;width:auto;display:block;margin-bottom:18px}.biz{font-weight:800;font-size:18px;margin-bottom:18px;color:${readable(t.text)}}h1{font-size:26px;line-height:1.15;margin:0 0 10px;letter-spacing:-.4px;color:${readable(t.text)}}
p{font-size:16px;line-height:1.55;margin:0 0 6px;color:#4a4a4a}a{color:${readable(t.primary)};font-weight:700}button{margin-top:20px;border:0;border-radius:8px;cursor:pointer;padding:14px 22px;font:700 15px ${t.font};background:${t.primary};color:${onColor(t.primary)}}
button.ghost{background:transparent;border:1px solid #d6d3ce;color:#4a4a4a}.foot{padding:14px 28px;border-top:1px solid #eee;font-size:12px;color:#7a7a7a}</style></head>
<body><div class="card"><div class="bar"></div><div class="in">${t.logo_url ? `<img src="${esc(t.logo_url)}" alt="${esc(t.business)}">` : `<div class="biz">${esc(t.business)}</div>`}<h1>${esc(title)}</h1><p>${text}</p>${form}</div><div class="foot">${esc(t.business)}${t.address ? ` &middot; ${esc(t.address)}` : ""}</div></div></body></html>`;
}
const formFor = (u, op, label, ghost = false) => `<form method="POST"><input type="hidden" name="u" value="${esc(u)}"><input type="hidden" name="op" value="${op}"><button class="${ghost ? "ghost" : ""}" type="submit">${label}</button></form>`;
const BAD = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Helvetica,Arial,sans-serif;padding:40px 20px;max-width:520px;margin:auto"><h1 style="font-size:24px">This link isn't valid</h1><p>Reply to the email you received and ask to be removed, and the business will take you off their list.</p></body>`;

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    let u = url.searchParams.get("u") || "";
    let op = "";
    if (req.method === "POST") {
      const type = req.headers.get("content-type") || "";
      if (type.includes("application/json")) { const b = await req.json().catch(() => ({})); u = String(b?.u || u); op = String(b?.op || ""); }
      else { const f = await req.formData().catch(() => null); if (f) { u = String(f.get("u") || u); op = String(f.get("op") || ""); } }
      if (!op) op = "unsubscribe";
    }
    const keys = await emailKeys();
    const p = await verifyToken(keys.unsub, "u", u);
    const [clientId, contactId, src, id, step] = String(p || "").split("|");
    if (!p || !clientId || !contactId) return html(BAD, 400);
    const db = createClientFromRequest(req).asServiceRole.entities;
    const [client, contact] = [await db.CRMClient.get(clientId).catch(() => null), await db.EmailContact.get(contactId).catch(() => null)];
    if (!client || !contact || contact.client_id !== clientId) return html(BAD, 400);
    const t = await loadTheme(db, client, await loadSettings(db, client));
    const email = String(contact.email).toLowerCase();
    const addr = `<strong>${esc(email)}</strong>`;
    if (req.method !== "POST") return html(page(t, "Unsubscribe?", `Stop emails from ${esc(t.business)} to ${addr}?`, formFor(u, "unsubscribe", "Unsubscribe")));
    const now = new Date().toISOString();
    const rows = (await db.EmailSuppression.filter({ client_id: clientId, email }, "-created_date", 20).catch(() => [])) || [];
    if (op === "resubscribe") {
      for (const r of rows) if (r.reason === "unsubscribe") await db.EmailSuppression.delete(r.id).catch(() => null);
      if (contact.status === "unsubscribed" && !rows.some((r) => r.reason === "bounce" || r.reason === "complaint")) await db.EmailContact.update(contact.id, { status: "subscribed", unsubscribed_at: null }).catch(() => null);
      return html(page(t, "You're back on the list", `${addr} will get emails from ${esc(t.business)} again.`));
    }
    if (!rows.some((r) => r.reason === "unsubscribe")) {
      await db.EmailSuppression.create({ client_id: clientId, email, reason: "unsubscribe", detail: "One-click unsubscribe link", campaign_id: src === "c" ? id : "", created_at: now });
      await db.EmailEvent.create({ client_id: clientId, campaign_id: src === "c" ? id : "", automation_id: src === "a" ? id : "", step_id: step || "", rid: contactId, contact_id: contactId, email, type: "unsubscribe", at: now, link_index: -1, url: "" }).catch(() => null);
    }
    if (contact.status !== "unsubscribed") await db.EmailContact.update(contact.id, { status: "unsubscribed", unsubscribed_at: now }).catch(() => null);
    return html(page(t, "You're unsubscribed", `${addr} won't get any more emails from ${esc(t.business)}. Changed your mind?`, formFor(u, "resubscribe", "Resubscribe", true)));
  } catch (e) {
    console.error("email-optout", e?.message);
    return html(BAD, 500);
  }
});
