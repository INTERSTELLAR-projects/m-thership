// @ts-nocheck
// Lead Engine: the "we built this for you" portal invite email and the signed opt-out link.
// House design (emailBlocks renderEmail: Interstellar × client logo lockup, gradient bars #ff3c00→#ff6a00→#ffaa00,
// orange links, no preheader). CAN-SPAM: says why they got it, a working one-click opt-out, and the sender's postal
// address (set in Lead Desk settings; sending is blocked until it is). Nothing here sends: invite_send does, only on
// a person's click.
import { renderEmail, SIGNATURE } from "./emailBlocks.ts";
import { purposeKey, appBaseUrl } from "./emailUnsub.ts";
import { signToken, verifyToken } from "./emailCore.ts";

let KEY: Uint8Array | null = null;
const optKey = async () => (KEY ||= await purposeKey("lead-optout:v1"));

export async function optOutToken(clientId: string) { return await signToken(await optKey(), "lo", String(clientId).replace(/\|/g, "")); }
export async function verifyOptOut(token: string) { return await verifyToken(await optKey(), "lo", token); }
export async function optOutUrl(portalUrl: string, clientId: string) { return `${appBaseUrl(portalUrl)}/functions/lead-engine?optout=${encodeURIComponent(await optOutToken(clientId))}`; }

export async function leadSettings(db: any) {
  const row = ((await db.AppSettings.filter({ key: "lead_engine" }, "-created_date", 1).catch(() => [])) || [])[0] || null;
  const s = (row?.pageSettings || {}) as Record<string, unknown>;
  return { row, postal_address: String(s.postal_address || ""), reply_email: String(s.reply_email || "justin@interstellar-strategies.com"), daily_cap: [25, 50, 100].includes(Number(s.daily_cap)) ? Number(s.daily_cap) : 25, queue_day: String(s.queue_day || ""), queue_today: Number(s.queue_today) || 0 };
}

export function leadInviteEmail({ business, contact, email, loginUrl, optOut, postal, logo, replyEmail, repName }: Record<string, string>) {
  const first = String(contact || "").split(/[\s&,]+/)[0] || "";
  const subject = `We built ${business} a new website`;
  const blocks = [
    { type: "header", eyebrow: `Built for ${business}`.slice(0, 60), show_date: true },
    { type: "hero", title: `We built ${business}`.slice(0, 80), accent: "a new website and system" },
    { type: "intro", text: `${first ? `${first}, ` : ""}no strings attached: we built ${business} a brand-new website and a Command System, the software that runs leads, jobs, customers and invoices in one place. It's ready for you to look at right now.` },
    { type: "band", label: "Our thank-you", text: "Give us 30 minutes to walk you through it and we'll pay you $1 a minute, $30, by Venmo, Cash App, PayPal or check. Whether you love it or not." },
    { type: "section", title: "What's waiting for you" },
    { type: "cards", items: [
      { tag: "Website", tag_style: "info", title: "Your new site, on your phone", text: `Built with ${business}'s name, services and area. See it on mobile and desktop.` },
      { tag: "Command System", tag_style: "info", title: "The software behind it", text: "Click through a live demo of the dashboard, pipeline, schedule and invoices, filled with sample data so you can see how it works." },
      { tag: "No obligation", tag_style: "info", title: "Look first, talk later", text: "Nothing to pay and nothing to sign. Book your 30 minutes from inside when it suits you." },
    ] },
    { type: "button", label: "See what we built", url: loginUrl },
    { type: "paragraph", text: `Sign in with ${email}: continue with Google, or choose Sign up once to set your own password. This private login is only for ${email}.\n\nQuestions? Write to ${replyEmail}.` },
    { type: "signature", ...SIGNATURE, ...(repName ? { name: repName, role: "Interstellar Strategies" } : {}), ps: "" },
    { type: "paragraph", text: `Why you got this: we built a free, no-obligation preview for ${business} and this is the one email we send about it. Don't want to hear from us? Opt out here: ${optOut} and we won't contact you again.\n\nInterstellar Strategies · ${postal}` },
  ];
  const html = renderEmail({ subject, blocks }, { vars: {}, clientLogo: logo || "", clientName: business });
  return { subject, html };
}

export function optOutPage(title: string, text: string, form = "") {
  const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} | Interstellar Strategies</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#ebe8e4;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;display:flex;justify-content:center;padding:48px 16px}
.card{width:100%;max-width:480px;background:#f5f3f0;border:1px solid #cfccc7}.bar{height:6px;background:linear-gradient(90deg,#ff3c00,#ff6a00 55%,#ffaa00)}.in{padding:30px 28px}
.k{font:700 11px 'Courier New',monospace;letter-spacing:2px;color:#9a9893;text-transform:uppercase}.k b{color:#ff3c00}h1{font-size:26px;line-height:1.15;margin:12px 0 10px;letter-spacing:-.4px}p{font-size:16px;line-height:1.55;margin:0;color:#4a4a4a}
button{margin-top:20px;border:0;cursor:pointer;padding:14px 22px;font:700 15px Helvetica,Arial,sans-serif;color:#fff;background:linear-gradient(90deg,#ff3c00,#ff6a00)}button:focus-visible{outline:2px solid #1a1a1a;outline-offset:2px}</style></head>
<body><div class="card"><div class="bar"></div><div class="in"><div class="k"><b>+</b> INTERSTELLAR&trade;</div><h1>${esc(title)}</h1><p>${text}</p>${form}</div></div></body></html>`;
}
