import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { verifyUnsubToken } from "../../shared/emailUnsub.ts";

// Public one-click unsubscribe for Email Studio mass / subscriber emails. No login: the signed token in the link
// (base44/shared/emailUnsub.ts) is the only proof needed, and it can only ever unsubscribe the address it was
// issued for.
//   GET  ?t=<token>                 -> branded page with one "Unsubscribe" button (a GET never changes anything,
//                                      so mail scanners that pre-open links cannot unsubscribe anyone)
//   POST t=<token>[&op=resubscribe] -> marks the EmailSubscriber unsubscribed (creating the row if the address was
//                                      only a CRM client), or subscribed again; returns the confirmation page.

const LOGO = "https://media.base44.com/images/public/6ae18dc255e0da91f0ee6f1b/9226df076_interstellar-email-logo.png";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

function page({ title, accent, text, form = "" }: { title: string; accent: string; text: string; form?: string }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} ${esc(accent)} | Interstellar Strategies</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#0f0f0f;color:#d6d4cf;font-family:Helvetica,Arial,sans-serif;display:flex;flex-direction:column}
.bar{height:6px;background:linear-gradient(90deg,#ff3c00,#ff6a00 55%,#ffaa00)}.bar.b{background:linear-gradient(90deg,#ffaa00,#ff6a00,#ff3c00)}
main{flex:1;width:100%;max-width:640px;margin:0 auto;padding:28px 24px 48px}
.lock{display:flex;align-items:center;gap:10px;color:#fff;font-weight:700;letter-spacing:2px;font-size:15px}.lock sup{color:#ff3c00;font-size:9px}
.eyebrow{margin-top:56px;font-size:13px;font-weight:700;letter-spacing:1.5px;color:#9a9893;text-transform:uppercase}.eyebrow span{color:#ff3c00}
h1{margin:14px 0 0;font-size:44px;line-height:1.05;letter-spacing:-1.5px;color:#fff}h1 span{color:#ff3c00}
p{font-size:17px;line-height:27px;margin:20px 0 0}a{color:#ff6a00;font-weight:700}
button{margin-top:28px;border:0;cursor:pointer;padding:16px 28px;font:700 14px Helvetica,Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#fff;background:linear-gradient(90deg,#ff3c00,#ff6a00)}
button.ghost{background:transparent;border:1px solid #2a2a2a;color:#bdbab5;margin-left:0}
footer{padding:0 24px 28px;max-width:640px;margin:0 auto;width:100%;font-size:11px;font-weight:700;letter-spacing:1.6px;color:#6f6c68;text-transform:uppercase}
</style></head><body><div class="bar"></div><main>
<div class="lock"><img src="${LOGO}" width="40" height="31" alt="Interstellar">INTERSTELLAR<sup>&reg;</sup></div>
<div class="eyebrow"><span>+</span>&nbsp; Email preferences</div>
<h1>${esc(title)} <span>/${esc(accent)}</span></h1>
<p>${text}</p>${form}
</main><footer>Interstellar Strategies &nbsp;&middot;&nbsp; The Future of Business</footer><div class="bar b"></div></body></html>`;
}

const html = (s: string, status = 200) => new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
const formFor = (t: string, op: string, label: string, ghost = false) =>
  `<form method="POST"><input type="hidden" name="t" value="${esc(t)}"><input type="hidden" name="op" value="${op}"><button class="${ghost ? "ghost" : ""}" type="submit">${label}</button></form>`;
const bad = () => html(page({ title: "Link", accent: "expired", text: `This unsubscribe link isn't valid. Email <a href="mailto:justin@interstellar-strategies.com">justin@interstellar-strategies.com</a> and we'll take you off the list by hand.` }), 400);

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("t") || "";
    let op = "";
    if (req.method === "POST") {
      const type = req.headers.get("content-type") || "";
      if (type.includes("application/json")) {
        const b = await req.json().catch(() => ({}));
        token = String(b?.t || token);
        op = String(b?.op || "");
      } else {
        const f = await req.formData().catch(() => null);
        if (f) { token = String(f.get("t") || token); op = String(f.get("op") || ""); }
      }
      // RFC 8058 one-click POST (List-Unsubscribe=One-Click) also unsubscribes.
      if (!op) op = "unsubscribe";
    }
    const email = await verifyUnsubToken(token);
    if (!email) return bad();

    if (req.method !== "POST") {
      return html(page({ title: "Unsubscribe", accent: "one click", text: `Stop Interstellar Strategies list emails to <a href="mailto:${esc(email)}">${esc(email)}</a>? Emails about work we're doing for your business still reach you.`, form: formFor(token, "unsubscribe", "Unsubscribe &nbsp;&rarr;") }));
    }

    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const rows = (await db.EmailSubscriber.filter({ email }, "-created_date", 5).catch(() => [])) || [];
    const now = new Date().toISOString();
    if (op === "resubscribe") {
      if (rows.length) for (const r of rows) await db.EmailSubscriber.update(r.id, { status: "subscribed" });
      else await db.EmailSubscriber.create({ email, status: "subscribed", source: "unsubscribe_link", created_at: now, tags: [] });
      return html(page({ title: "You're back", accent: "on the list", text: `Welcome back. <a href="mailto:${esc(email)}">${esc(email)}</a> will get our updates again.` }));
    }
    if (rows.length) for (const r of rows) await db.EmailSubscriber.update(r.id, { status: "unsubscribed", unsubscribed_at: now });
    else await db.EmailSubscriber.create({ email, status: "unsubscribed", unsubscribed_at: now, source: "unsubscribe_link", created_at: now, tags: [] });
    return html(page({ title: "You're", accent: "unsubscribed", text: `<a href="mailto:${esc(email)}">${esc(email)}</a> won't get any more Interstellar Strategies list emails. Changed your mind?`, form: formFor(token, "resubscribe", "Resubscribe", true) }));
  } catch (e) {
    console.error("email-unsubscribe", (e as Error).message);
    return html(page({ title: "Something", accent: "went wrong", text: `Please try again, or email <a href="mailto:justin@interstellar-strategies.com">justin@interstellar-strategies.com</a> and we'll take you off the list by hand.` }), 500);
  }
});
