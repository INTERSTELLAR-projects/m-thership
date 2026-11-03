// Branded client-portal onboarding email. Same structure as the Intel briefing and client update emails:
// dark header (logo + INTERSTELLAR), eyebrow, big "Title /accent" heading, stat strip, gradient "short version"
// band, light body with numbered cards and steps, dark footer with the CTA. No preheader. Never mentions the
// platform the app runs on.
const LOGO = "https://media.base44.com/images/public/6ae18dc255e0da91f0ee6f1b/9226df076_interstellar-email-logo.png";
// Links are always bright orange, never client-default blue: every address/URL in text is an explicit anchor with
// the color on the <a> AND an inner <span> (some clients override anchor color). #ff6a00 on dark, #ff3c00 on light,
// white bold underlined on the orange band. REG = the orange registered mark after the INTERSTELLAR wordmark.
export const REG = `<sup style="color:#ff3c00;font-size:9px;line-height:0;vertical-align:super;">&reg;</sup>`;
export const LINK_RESET_CSS = "a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important}u + #body a{color:inherit}#MessageViewBody a{color:inherit}";
export function mailLink(addr: string, color = "#ff6a00") {
  const a = String(addr ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
  return `<a href="mailto:${a}" style="color:${color};text-decoration:underline;font-weight:700;"><span style="color:${color};text-decoration:underline;">${a}</span></a>`;
}
// Shared header for every Møthership email: gradient top bar, then the lockup (orbit icon + INTERSTELLAR + orange ®,
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

export function onboardingEmail({ business, contact, portalUrl, email }: { business: string; contact?: string; portalUrl: string; email: string }) {
  const first = String(contact || "").split(/[\s&,]+/)[0] || "there";
  const loginUrl = `${portalUrl}/login`;
  const subject = `Your ${business} portal is ready`;
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
  const F = "font-family:Helvetica,Arial,sans-serif;";
  const eyebrow = (t: string) => `<div style="${F}font-size:13px;font-weight:700;letter-spacing:1.5px;color:#ff3c00;text-transform:uppercase;">+&nbsp; ${t}</div>`;
  const stat = (n: string, label: string, accent = false, last = false) => `
            <td width="33%" valign="top" style="padding:16px 14px;${last ? "" : "border-right:1px solid #2a2a2a;"}${F}">
              <div style="font-size:34px;line-height:38px;font-weight:700;color:${accent ? "#ff3c00" : "#ffffff"};letter-spacing:-1px;">${n}</div>
              <div style="padding-top:6px;font-size:12px;font-weight:700;letter-spacing:1.2px;color:#9a9893;text-transform:uppercase;">${label}</div>
            </td>`;
  const card = (n: string, tag: string, title: string, text: string) => `
      <tr><td class="px" style="padding:0 40px 14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid #e0ddd8;border-left:5px solid #ff3c00;">
          <tr><td style="padding:20px 22px;${F}">
            <span style="font-size:22px;font-weight:700;color:#ff3c00;letter-spacing:-0.5px;">${n}</span>&nbsp;&nbsp;<span style="display:inline-block;vertical-align:4px;padding:4px 8px;background-color:#141414;color:#ffffff;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">${tag}</span>
            <div style="padding-top:10px;font-size:18px;line-height:24px;font-weight:700;color:#141414;">${title}</div>
            <div style="padding-top:6px;font-size:15px;line-height:23px;color:#4a4744;">${text}</div>
          </td></tr>
        </table>
      </td></tr>`;
  const step = (n: string, title: string, text: string, foot: string) => `
      <tr><td class="px" style="padding:0 40px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0ddd8;">
          <tr>
            <td width="120" valign="top" bgcolor="#1a1a1a" style="width:120px;background-color:#1a1a1a;padding:18px 16px;font-family:'Courier New',monospace;font-size:13px;font-weight:700;letter-spacing:1.5px;color:#ff6a00;">STEP ${n}</td>
            <td valign="top" bgcolor="#ffffff" style="background-color:#ffffff;padding:16px 18px;${F}">
              <div style="font-size:16px;font-weight:700;color:#141414;">${title}</div>
              <div style="padding-top:4px;font-size:14px;line-height:21px;color:#4a4744;">${text}</div>
              <div style="padding-top:8px;font-size:11px;font-weight:700;letter-spacing:1.4px;color:#ff3c00;text-transform:uppercase;">${foot}</div>
            </td>
          </tr>
        </table>
      </td></tr>`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title>
<style>${LINK_RESET_CSS}@media (max-width:620px){.wrap{width:100%!important}.px{padding-left:22px!important;padding-right:22px!important}.h1{font-size:36px!important;line-height:40px!important}}</style></head>
<body id="body" style="margin:0;padding:0;background:#ebe8e4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ebe8e4" style="background-color:#ebe8e4;">
<tr><td align="center" style="padding:24px 10px 40px;">
<table role="presentation" class="wrap" width="640" cellpadding="0" cellspacing="0" border="0" style="width:640px;max-width:640px;">

  <tr><td bgcolor="#0f0f0f" style="background-color:#0f0f0f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${emailHeaderRows(`Portal access &nbsp;&middot;&nbsp; ${esc(date)}`)}
      <tr><td class="px h1" style="padding:14px 40px 0;${F}font-size:48px;line-height:50px;font-weight:700;letter-spacing:-1.5px;color:#ffffff;">
        Your portal <span style="color:#ff3c00;">/is ready</span>
      </td></tr>
      <tr><td class="px" style="padding:20px 40px 36px;${F}font-size:17px;line-height:27px;color:#d6d4cf;">
        ${esc(first)}, welcome aboard. Everything we do for ${esc(business)} now lives in one place, built just for you: your work, your results, your requests and a direct line to our team.
      </td></tr>
      <tr><td class="px" style="padding:0 40px 36px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #2a2a2a;"><tr>${stat("1", "Login for everything")}${stat("2", "Ways to sign in", true)}${stat("24/7", "Access, any device", false, true)}
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <tr><td bgcolor="#ff3c00" class="px" style="background-color:#ff3c00;background-image:linear-gradient(110deg,#ff3c00,#ff5a00 60%,#ff7a00);padding:30px 40px 32px;${F}">
    <div style="font-size:12px;font-weight:700;letter-spacing:1.8px;color:#ffffff;text-transform:uppercase;opacity:0.9;">&#9733;&nbsp; The short version</div>
    <div style="padding-top:10px;font-size:24px;line-height:32px;font-weight:700;letter-spacing:-0.4px;color:#ffffff;">Sign in with ${mailLink(email, "#ffffff")}. Continue with Google, or choose Sign up the first time to set your own password.</div>
  </td></tr>

  <tr><td bgcolor="#f5f3f0" style="background-color:#f5f3f0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" style="padding:40px 40px 16px;">${eyebrow("What's inside")}</td></tr>
      ${card("01", "Work feed", "Everything we publish for you", "Every blog, Google post and website update shows up the moment it goes live.")}
      ${card("02", "Results", "Your numbers and your reviews", "Site health, Google reviews and the results we track, in one view.")}
      ${card("03", "Requests", "Ask for anything", "Website edits, content, Google posts or design: send a request or a message and track it to done.")}
      ${card("04", "Assistant", "N&oslash;va, on call", "Ask what we did this month, check a request or reach Justin, by text or voice.")}
      ${card("05", "Bonus", "Tools that are yours for life", "Email signatures, QR codes with scan tracking, and Prestige referral rewards.")}
      <tr><td class="px" style="padding:26px 40px 14px;">${eyebrow("What we need from you")}
        <div style="padding-top:8px;${F}font-size:15px;line-height:23px;color:#4a4744;">Three quick things when you log in:</div></td></tr>
      ${step("01", "Log in", `Use the button below and sign in with ${mailLink(email, "#ff3c00")}: Google, or Sign up once to set a password.`, "Takes a minute")}
      ${step("02", "Tell us about your business", "Fill in the short business audit on your Home page. It saves as you go.", "On your Home page")}
      ${step("03", "Send your first request", "Pick a form under Requests, or just message us.", "Whenever you're ready")}
      <tr><td style="padding:0 0 28px;font-size:0;line-height:0;">&nbsp;</td></tr>
    </table>
  </td></tr>

  <tr><td bgcolor="#0f0f0f" class="px" style="background-color:#0f0f0f;padding:34px 40px 30px;${F}">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td bgcolor="#ff3c00" style="background-color:#ff3c00;background-image:linear-gradient(90deg,#ff3c00,#ff6a00);">
        <a href="${esc(loginUrl)}" target="_blank" style="display:inline-block;padding:16px 28px;${F}font-size:14px;font-weight:700;letter-spacing:1.5px;color:#ffffff;text-decoration:none;text-transform:uppercase;">Log in to your portal &nbsp;&rarr;</a>
      </td>
    </tr></table>
    <div style="padding-top:22px;font-size:14px;line-height:22px;color:#bdbab5;">This invite is only for ${mailLink(email, "#ff6a00")}. We will never ask for a password by email. Questions? Email ${mailLink("justin@interstellar-strategies.com", "#ff6a00")}.</div>
    <div style="padding-top:16px;font-size:14px;line-height:22px;color:#bdbab5;">Welcome to the future of business, ${esc(first)}.<br>&mdash; Justin Cowell, Interstellar Strategies</div>
    <div style="padding-top:22px;font-size:11px;font-weight:700;letter-spacing:1.6px;color:#6f6c68;text-transform:uppercase;">Interstellar Strategies &nbsp;&middot;&nbsp; The Future of Business</div>
  </td></tr>
  <tr><td height="6" bgcolor="#ffaa00" style="height:6px;line-height:6px;font-size:0;background-color:#ffaa00;background-image:linear-gradient(90deg,#ffaa00,#ff6a00,#ff3c00);">&nbsp;</td></tr>

</table>
</td></tr>
</table>
</body></html>`;
  return { subject, html };
}

// Sent through the app's own mail domain (no-reply@interstellar-mothership.com, set up in the app's email
// settings), shown as "Justin | Interstellar Strategies". SendEmail has no reply-to, so the footer gives
// Justin's address as a mailto link instead of "just reply".
export const SENDER_NAME = "Justin | Interstellar Strategies";
export async function sendBrandedEmail(base44: any, { to, subject, html }: { to: string; subject: string; html: string }) {
  await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body: html, from_name: SENDER_NAME });
  return { via: "app_mail_domain" };
}
