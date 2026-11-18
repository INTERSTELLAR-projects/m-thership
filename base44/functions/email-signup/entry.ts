import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { emailKeys, loadSettings, loadTheme, upsertContact, findContact, enroll, readiness, deliver, baseUrl } from "../../shared/emailStudio.ts";
import { signToken, verifyToken, isEmail, normEmail, normDate, hmacBytes } from "../../shared/emailCore.ts";
import { onColor, readable } from "../../shared/clientEmail.ts";

// Public sign-up forms for client Email Studio lists (no login).
//   GET  ?f=<form_key>                  hosted form page (link to it, or embed it in an <iframe>)
//   POST ?f=<form_key>  (form or JSON)  email, first_name?, last_name?, phone?, birthday?, zip?, consent=yes, hp field
//                                       -> contact on the form's list with its tags; double opt-in sends a confirm link
//   GET  ?confirm=<signed token>        double opt-in confirmation -> subscribed, welcome automations start
// Protection: per-IP rate limit (8/min, 60/day) + per-form daily cap, honeypot field "website_hp" (bots fill it),
// a minimum fill time, required consent checkbox, 2 KB per value. The form key is public (it is in the embed).

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const ipOf = (req: Request) => String(req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown").split(",")[0].trim().slice(0, 64);
const FIELD_LABEL: Record<string, string> = { first_name: "First name", last_name: "Last name", phone: "Phone", birthday: "Birthday (MM/DD)", zip: "ZIP code" };

async function limited(db: any, key: string, perMin: number, perDay: number) {
  const minute = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
  const day = minute.slice(0, 10);
  try {
    const row = ((await db.RateLimitBucket.filter({ key }, "-updated_date", 1)) || [])[0];
    if (!row) { await db.RateLimitBucket.create({ key, window_start: minute, count: 1, day, day_count: 1 }); return false; }
    const count = row.window_start === minute ? (Number(row.count) || 0) + 1 : 1;
    const dayCount = row.day === day ? (Number(row.day_count) || 0) + 1 : 1;
    if (count > perMin || dayCount > perDay) return true;
    await db.RateLimitBucket.update(row.id, { window_start: minute, count, day, day_count: dayCount });
  } catch (_e) { /* fail open */ }
  return false;
}

function page(theme: any, inner: string, title: string) {
  const btn = theme.primary;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} | ${esc(theme.business)}</title>
<style>*{box-sizing:border-box}body{margin:0;background:transparent;font-family:${theme.font};color:${theme.text}}.card{max-width:460px;margin:0 auto;padding:26px 24px;background:#fff;border-radius:12px;border:1px solid #e7e5e1}
.bar{height:5px;background:${btn};border-radius:12px 12px 0 0;margin:-26px -24px 20px}img.logo{height:40px;width:auto;display:block;margin-bottom:14px}h1{font-size:24px;line-height:1.15;margin:0 0 8px;letter-spacing:-.4px;color:${readable(theme.text)}}p{font-size:15px;line-height:1.5;margin:0 0 16px;color:#4a4a4a}
label{display:block;font-size:13px;font-weight:600;margin:12px 0 5px}input[type=email],input[type=text],input[type=tel]{width:100%;padding:12px 13px;font-size:16px;border:1px solid #d6d3ce;border-radius:8px;background:#fff;color:#111}input:focus{outline:2px solid ${btn};border-color:${btn}}
.consent{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.45;font-weight:400;margin:16px 0}.consent input{margin-top:3px;width:18px;height:18px;accent-color:${btn}}
button{width:100%;margin-top:6px;padding:14px;font-size:16px;font-weight:700;border:0;border-radius:8px;background:${btn};color:${onColor(btn)};cursor:pointer}.hp{position:absolute;left:-5000px;width:1px;height:1px;overflow:hidden}.err{color:#b42318;font-size:14px;margin:0 0 12px}.small{font-size:12px;color:#6b6b6b;margin-top:14px}</style></head>
<body><div class="card"><div class="bar"></div>${theme.logo_url ? `<img class="logo" src="${esc(theme.logo_url)}" alt="${esc(theme.business)}">` : ""}${inner}</div></body></html>`;
}
const htmlRes = (s: string, status = 200) => new Response(s, { status, headers: { ...CORS, "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });

function formHtml(theme: any, form: any, err = "", vals: Record<string, string> = {}) {
  const extra = (form.fields || []).filter((f: string) => FIELD_LABEL[f]).map((f: string) => `<label for="${f}">${FIELD_LABEL[f]}</label><input id="${f}" name="${f}" type="${f === "phone" ? "tel" : "text"}" value="${esc(vals[f] || "")}" autocomplete="${f === "first_name" ? "given-name" : f === "last_name" ? "family-name" : f === "phone" ? "tel" : f === "zip" ? "postal-code" : "off"}">`).join("");
  return page(theme, `<h1>${esc(form.heading || `Join the ${theme.business} list`)}</h1>${form.intro ? `<p>${esc(form.intro)}</p>` : ""}${err ? `<p class="err" role="alert">${esc(err)}</p>` : ""}
<form method="POST"><input type="hidden" name="ts" value="${Date.now()}"><label for="email">Email</label><input id="email" name="email" type="email" required autocomplete="email" value="${esc(vals.email || "")}">${extra}
<div class="hp" aria-hidden="true"><label>Leave this empty<input name="website_hp" tabindex="-1" autocomplete="off"></label></div>
<label class="consent"><input type="checkbox" name="consent" value="yes" required><span>${esc(form.consent_text || `Yes, email me news and offers from ${theme.business}. I can unsubscribe at any time.`)}</span></label>
<button type="submit">${esc(form.button_label || "Sign up")}</button>${form.double_opt_in ? `<p class="small">We'll email you a link to confirm.</p>` : ""}</form>`, form.name || "Sign up");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  const base44 = createClientFromRequest(req);
  const db = base44.asServiceRole.entities;
  const wantsJson = (req.headers.get("content-type") || "").includes("application/json") || (req.headers.get("accept") || "").includes("application/json") && !(req.headers.get("accept") || "").includes("text/html");
  try {
    const keys = await emailKeys();
    // ---- double opt-in confirmation ----
    const confirm = url.searchParams.get("confirm");
    if (confirm) {
      const p = await verifyToken(keys.confirm, "confirm", confirm);
      const [clientId, contactId, formId] = String(p || "").split("|");
      const contact = p ? await db.EmailContact.get(contactId).catch(() => null) : null;
      const client = contact && contact.client_id === clientId ? await db.CRMClient.get(clientId).catch(() => null) : null;
      if (!client) return htmlRes("<p>This confirmation link isn't valid.</p>", 400);
      const theme = await loadTheme(db, client, await loadSettings(db, client));
      if (contact.status === "pending") {
        const now = new Date().toISOString();
        await db.EmailContact.update(contact.id, { status: "subscribed", confirmed_at: now, consent: { ...(contact.consent || {}), basis: "double_opt_in", confirmed_at: now } });
        const form = formId ? await db.EmailSignupForm.get(formId).catch(() => null) : null;
        if (form) await db.EmailSignupForm.update(form.id, { confirmations: (Number(form.confirmations) || 0) + 1 }).catch(() => null);
        for (const l of contact.list_ids || []) await enroll(db, client, { ...contact, status: "subscribed" }, { type: "list_join", list_id: l });
      }
      return htmlRes(page(theme, `<h1>You're confirmed</h1><p>Thanks! You'll now get emails from ${esc(theme.business)}. You can unsubscribe from any email.</p>`, "Confirmed"));
    }

    const key = url.searchParams.get("f") || "";
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(key)) return htmlRes("<p>Form not found.</p>", 404);
    const form = ((await db.EmailSignupForm.filter({ form_key: key }, "-created_date", 1).catch(() => [])) || [])[0];
    const client = form ? await db.CRMClient.get(form.client_id).catch(() => null) : null;
    if (!form || !client || form.status === "paused") return wantsJson ? Response.json({ error: "Form not found" }, { status: 404, headers: CORS }) : htmlRes("<p>This sign-up form isn't available.</p>", 404);
    const settings = await loadSettings(db, client);
    const theme = await loadTheme(db, client, settings);
    if (req.method === "GET") return htmlRes(formHtml(theme, form));
    if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: CORS });

    // ---- submission ----
    let v: Record<string, string> = {};
    if ((req.headers.get("content-type") || "").includes("application/json")) {
      const b = await req.json().catch(() => ({}));
      for (const [k, val] of Object.entries(b || {})) if (typeof val === "string" || typeof val === "boolean") v[k] = String(val).slice(0, 2000);
    } else {
      const f = await req.formData().catch(() => null);
      if (f) for (const [k, val] of f.entries()) if (typeof val === "string") v[k] = val.slice(0, 2000);
    }
    const fail = (msg: string, status = 400) => (wantsJson ? Response.json({ error: msg }, { status, headers: CORS }) : htmlRes(formHtml(theme, form, msg, v), status));
    const ipHash = Array.from(await hmacBytes(keys.rid, `ip:${ipOf(req)}`)).slice(0, 8).map((x) => x.toString(16).padStart(2, "0")).join("");
    if (await limited(db, `email-signup:${ipHash}`, 8, 60)) return fail("Too many sign-ups from this connection. Please try again in a minute.", 429);
    if (await limited(db, `email-signup-form:${form.id}`, 120, 2000)) return fail("This form is busy. Please try again shortly.", 429);
    // Bots: honeypot filled, or submitted faster than a person can type. Pretend success, store nothing.
    const ts = Number(v.ts || 0);
    if (v.website_hp || (ts && Date.now() - ts < 1500)) return wantsJson ? Response.json({ ok: true }, { headers: CORS }) : htmlRes(page(theme, `<h1>Thanks!</h1><p>${esc(form.success_message || "You're on the list.")}</p>`, "Thanks"));
    const email = normEmail(v.email);
    if (!isEmail(email)) return fail("Please enter a valid email address.");
    if (!["yes", "true", "on", "1"].includes(String(v.consent || "").toLowerCase())) return fail("Please tick the box to agree to receive emails.");

    const existing = await findContact(db, client.id, email);
    const sup = await db.EmailSuppression.filter({ client_id: String(client.id), email }, "-created_date", 5).catch(() => []);
    const hardBlock = (sup || []).some((s: any) => s.reason === "bounce" || s.reason === "complaint");
    const doi = form.double_opt_in !== false;
    const now = new Date().toISOString();
    const consent = { basis: doi ? "double_opt_in" : "express", source: `form:${form.name}`, text: String(form.consent_text || "").slice(0, 300), at: now, ip_hash: ipHash, page: String(req.headers.get("referer") || "").slice(0, 200) };
    const data: Record<string, any> = { email };
    for (const k of ["first_name", "last_name", "phone", "zip"]) if (v[k]) data[k] = v[k].trim().slice(0, 120);
    if (v.birthday) data.birthday = normDate(v.birthday, true);
    // A new address (or one that unsubscribed and is signing up again) starts pending under double opt-in.
    const status = hardBlock ? "cleaned" : doi ? "pending" : "subscribed";
    const up = await upsertContact(db, client.id, data, { existing, lists: form.list_id ? [form.list_id] : [], tags: form.tags || [], status, consent, source: "form", source_detail: form.name, test: !!form.test });
    let c = up.contact;
    if (!up.created && !hardBlock && c.status !== "subscribed") {
      // Re-subscribing through a form is an explicit opt-in; unsubscribe suppressions are lifted (only on confirm when DOI).
      await db.EmailContact.update(c.id, { status, consent });
      c = { ...c, status, consent };
      if (!doi) for (const s of sup || []) if (s.reason === "unsubscribe") await db.EmailSuppression.delete(s.id).catch(() => null);
    }
    await db.EmailSignupForm.update(form.id, { submissions: (Number(form.submissions) || 0) + 1, last_submission_at: now }).catch(() => null);
    let note = form.success_message || "You're on the list.";
    if (!hardBlock && c.status === "pending") {
      const ready = readiness(client, settings);
      const link = `${await baseUrl(db)}/functions/email-signup?confirm=${encodeURIComponent(await signToken(keys.confirm, "confirm", `${client.id}|${c.id}|${form.id}`))}`;
      if (ready.ready) {
        const body = `<!doctype html><html><body style="margin:0;background:#f4f4f2;padding:28px 12px;font-family:${theme.font}"><table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="560" style="max-width:560px;background:#fff;border-radius:10px"><tr><td style="height:6px;background:${theme.primary};border-radius:10px 10px 0 0"></td></tr><tr><td style="padding:28px 36px">
<h1 style="margin:0 0 12px;font-size:24px;color:${readable(theme.text)}">Please confirm your email</h1><p style="margin:0 0 20px;font-size:16px;line-height:25px;color:${theme.text}">Tap the button to start getting emails from ${esc(theme.business)}. If you didn't sign up, ignore this email and you won't hear from us.</p>
<a href="${esc(link)}" style="display:inline-block;padding:14px 26px;border-radius:6px;background:${theme.primary};color:${onColor(theme.primary)};font-weight:700;text-decoration:none">Confirm my email</a>
<p style="margin:24px 0 0;font-size:12px;color:#6b6b6b">${esc(theme.business)}${settings.physical_address ? ` &middot; ${esc(settings.physical_address)}` : ""}</p></td></tr></table></td></tr></table></body></html>`;
        await deliver(client, { from: client.ses_from_email || "test@example.com", fromName: settings.from_name || client.business, to: email, subject: `Confirm your email for ${theme.business}`, html: body, tags: { client_id: String(client.id), form_id: form.id } }).catch((e: Error) => console.error("email-signup confirm", e?.message));
      }
      note = "Almost done: check your inbox and tap the link to confirm.";
    } else if (!hardBlock && up.created || (!hardBlock && c.status === "subscribed")) {
      for (const l of up.lists_added || []) await enroll(db, client, c, { type: "list_join", list_id: l });
    }
    if (wantsJson) return Response.json({ ok: true, status: hardBlock ? "subscribed" : c.status, message: note }, { headers: CORS });
    if (form.redirect_url && /^https:\/\//.test(form.redirect_url)) return new Response(null, { status: 303, headers: { ...CORS, location: form.redirect_url } });
    return htmlRes(page(theme, `<h1>Thanks!</h1><p>${esc(note)}</p>`, "Thanks"));
  } catch (e) {
    console.error("email-signup", (e as Error)?.message);
    return wantsJson ? Response.json({ error: "Something went wrong. Please try again." }, { status: 500, headers: CORS }) : htmlRes("<p>Something went wrong. Please try again.</p>", 500);
  }
});
