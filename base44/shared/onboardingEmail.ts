// Branded client-portal onboarding email. Same structure as the Intel briefing and client update emails:
// dark header (logo + INTERSTELLAR), eyebrow, big "Title /accent" heading, stat strip, gradient "short version"
// band, light body with numbered cards and steps, dark footer with the CTA. No preheader. Never mentions the
// platform the app runs on.
import { renderEmail, SIGNATURE } from "./emailBlocks.ts";
const LOGO = "https://media.base44.com/images/public/6ae18dc255e0da91f0ee6f1b/9226df076_interstellar-email-logo.png";
// Links are always bright orange, never client-default blue: every address/URL in text is an explicit anchor with
// the color on the <a> AND an inner <span> (some clients override anchor color). #ff6a00 on dark, #ff3c00 on light,
// white bold underlined on the orange band. REG = the orange trademark (™) after the INTERSTELLAR wordmark.
export const REG = `<sup style="color:#ff3c00;font-size:9px;line-height:0;vertical-align:super;">&trade;</sup>`;
export const LINK_RESET_CSS = "a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important}u + #body a{color:inherit}#MessageViewBody a{color:inherit}";
export function mailLink(addr: string, color = "#ff6a00") {
  const a = String(addr ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
  return `<a href="mailto:${a}" style="color:${color};text-decoration:underline;font-weight:700;"><span style="color:${color};text-decoration:underline;">${a}</span></a>`;
}
// Shared header for every Møthership email: gradient top bar, then the lockup (orbit icon + INTERSTELLAR + orange ™,
// nothing under it), then the eyebrow row "+ EYEBROW" (orange +, grey uppercase). Rows for a dark (#0f0f0f) table
// that uses the .px padding class. `eyebrow` is trusted HTML (escape any data before passing it).
export function emailHeaderRows(eyebrow: string) {
  const F = "font-family:Helvetica,Arial,sans-serif;";
  return `<tr><td height="6" bgcolor="#ff3c00" style="height:6px;line-height:6px;font-size:0;background-color:#ff3c00;background-image:linear-gradient(90deg,#ff3c00,#ff6a00 55%,#ffaa00);">&nbsp;</td></tr>
      <tr><td class="px" style="padding:26px 40px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="middle" width="48" style="width:48px;"><img src="${LOGO}" width="40" height="31" alt="Interstellar" style="display:block;border:0;"></td>
          <td valign="middle" style="${F}font-size:15px;font-weight:700;letter-spacing:2px;color:#ffffff;">INTERSTELLAR${REG}</td>
        </tr></table>
      </td></tr>
      <tr><td class="px" style="padding:44px 40px 0;${F}font-size:13px;font-weight:700;letter-spacing:1.5px;color:#9a9893;text-transform:uppercase;"><span style="color:#ff3c00;">+</span>&nbsp; ${eyebrow}</td></tr>`;
}
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// The portal onboarding email renders through the Email Studio engine (emailBlocks.ts) in the house
// "Interstellar · Mission brief" design, so system emails and Email Studio emails look the same.
export function onboardingEmail({ business, contact, portalUrl, email }: { business: string; contact?: string; portalUrl: string; email: string }) {
  const first = String(contact || "").split(/[\s&,]+/)[0] || "there";
  const loginUrl = `${portalUrl}/login`;
  const subject = `Your ${business} portal is ready`;
  const blocks = [
    { type: "header", eyebrow: "Portal access", show_date: true },
    { type: "hero", title: "Your portal", accent: "is ready" },
    { type: "intro", text: `${first}, welcome aboard. Everything we do for ${business} now lives in one place, built just for you: your work, your results, your requests and a direct line to our team.` },
    { type: "stats", items: [{ value: "1", label: "Login for everything" }, { value: "2", label: "Ways to sign in", accent: true }, { value: "24/7", label: "Access, any device" }] },
    { type: "band", label: "The short version", text: `Sign in with ${email}. Continue with Google, or choose Sign up the first time to set your own password.` },
    { type: "section", title: "What's inside" },
    { type: "cards", items: [
      { tag: "Work feed", tag_style: "info", title: "Everything we publish for you", text: "Every blog, Google post and website update shows up the moment it goes live." },
      { tag: "Results", tag_style: "info", title: "Your numbers and your reviews", text: "Site health, Google reviews and the results we track, in one view." },
      { tag: "Requests", tag_style: "info", title: "Ask for anything", text: "Website edits, content, Google posts or design: send a request or a message and track it to done." },
      { tag: "Assistant", tag_style: "info", title: "Nøva, on call", text: "Ask what we did this month, check a request or reach our team, by text or voice." },
      { tag: "Bonus", tag_style: "info", title: "Tools that are yours for life", text: "Email signatures, QR codes with scan tracking, and Prestige referral rewards." },
    ] },
    { type: "section", title: "What we need from you", text: "Three quick things when you log in:" },
    { type: "steps", items: [
      { title: "Log in", text: `Use the button below and sign in with ${email}: Google, or Sign up once to set a password.`, foot: "Takes a minute" },
      { title: "Tell us about your business", text: "Fill in the short business audit on Your Brain. It saves as you go.", foot: "On Your Brain" },
      { title: "Send your first request", text: "Pick a form under Requests, or just message us.", foot: "Whenever you're ready" },
    ] },
    { type: "button", label: "Log in to your portal", url: loginUrl },
    { type: "paragraph", text: `This invite is only for ${email}. We will never ask for a password by email. Questions? Write to justin@interstellar-strategies.com and it comes straight to me.\n\nWelcome to the future of business, ${first}.` },
    { type: "signature", ...SIGNATURE, ps: "" },
  ];
  // Names and addresses go in as block text: the engine escapes everything and never treats it as HTML.
  const html = renderEmail({ subject, blocks }, { vars: {} });
  return { subject, html };
}

// Sent through the app's own mail domain (no-reply@interstellar-mothership.com, set up in the app's email
// settings), shown as "Justin | Interstellar Strategies". SendEmail has no reply-to, so the footer gives
// Justin's address as a mailto link instead of "just reply".
export const SENDER_NAME = "Interstellar Strategies";
export async function sendBrandedEmail(base44: any, { to, subject, html }: { to: string; subject: string; html: string }) {
  await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body: html, from_name: SENDER_NAME });
  return { via: "app_mail_domain" };
}
