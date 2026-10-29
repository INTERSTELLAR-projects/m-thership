import { getIconUrl, getBadgeBg, DEFAULT_CTA } from "./iconLibrary";

// ---- Defaults ---------------------------------------------------------------

export const DEFAULT_THEME = {
  accent_color: "#ff6a00",
  text_color: "#1a1a1a",
  border_color: "#e4e4e4",
  font: "Inter",
  border_style: "box", // "box" | "none"
  border_radius: "10px",
  icon_style: "color",
};

export const DEFAULT_FIELDS = {
  full_name: "Alex Morgan",
  job_title: "Product Designer",
  company_name: "Nebula Labs",
  phone: "+1 (415) 555-0142",
  phone_show: true,
  email: "alex@nebulalabs.com",
  email_show: true,
  website: "nebulalabs.com",
  website_show: true,
  profile_photo_url: "",
  logo_url: "",
  photo_rounded: true,
  verified_badge: true,
  social: {
    website: { show: false, url: "" },
    instagram: { show: true, url: "https://instagram.com/" },
    linkedin: { show: true, url: "https://linkedin.com/" },
    facebook: { show: false, url: "" },
    x: { show: true, url: "https://x.com/" },
    tiktok: { show: false, url: "" },
    youtube: { show: false, url: "" },
  },
  cta: { ...DEFAULT_CTA },
};

export const TEMPLATES = [
  { id: "t1_classic", name: "Classic", description: "Boxed layout with social sidebar" },
  { id: "t2_minimal", name: "Minimal", description: "Clean, borderless, name-first" },
  { id: "t3_compact", name: "Compact", description: "Single row, space-saving" },
  { id: "t4_centered", name: "Centered", description: "Centered, photo on top" },
];

const FONT_STACK = {
  Inter: "Inter, Arial, Helvetica, sans-serif",
  Arial: "Arial, Helvetica, sans-serif",
  Helvetica: "Helvetica, Arial, sans-serif",
  Georgia: "Georgia, 'Times New Roman', serif",
};

// ---- Helpers ----------------------------------------------------------------

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function visibleSocial(fields) {
  const social = fields.social || {};
  return ["website", "instagram", "linkedin", "facebook", "x", "tiktok", "youtube"]
    .map((id) => ({ id, ...social[id] }))
    .filter((s) => s.show && s.url);
}

function iconImg(platformId, theme, size = 24) {
  const url = getIconUrl(platformId, theme.icon_style, theme.accent_color);
  const style =
    theme.icon_style === "badge"
      ? `display:block;width:${size}px;height:${size}px;border-radius:50%;background:${getBadgeBg(
          platformId
        )};padding:4px;box-sizing:border-box;`
      : `display:block;width:${size}px;height:${size}px;`;
  return `<img src="${esc(url)}" width="${size}" height="${size}" alt="${esc(
    platformId
  )}" style="${style}" />`;
}

function socialColumnHtml(fields, theme) {
  const items = visibleSocial(fields);
  if (!items.length) return "";
  const rows = items
    .map(
      (s) => `<tr><td style="padding:0 0 8px 0;"><a href="${esc(s.url)}" style="text-decoration:none;">${iconImg(
        s.id,
        theme
      )}</a></td></tr>`
    )
    .join("");
  return `<table cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${esc(
    theme.border_color
    )};border-radius:${esc(theme.border_radius)};"><tr><td style="padding:8px;"><table cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr></table>`;
}

function verifiedBadge() {
  // Small verified checkmark rendered as a styled badge (email-safe, no external image).
  return `<span style="display:inline-block;vertical-align:middle;width:16px;height:16px;margin-left:4px;background:#0A66C2;border-radius:50%;color:#ffffff;font-family:Arial,sans-serif;font-size:10px;font-weight:700;line-height:16px;text-align:center;">&#10003;</span>`;
}

function ctaButtonHtml(fields, theme) {
  const cta = fields.cta || DEFAULT_CTA;
  if (!cta.label) return "";
  const bg =
    cta.style === "gradient"
      ? `background:linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00);`
      : cta.style === "outline"
      ? `background:transparent;border:1px solid ${esc(theme.accent_color)};`
      : `background:${esc(theme.accent_color)};border:1px solid ${esc(theme.accent_color)};`;
  const color = cta.style === "outline" ? esc(theme.accent_color) : "#ffffff";
  return `<a href="${esc(cta.url || "#")}" style="display:inline-block;text-decoration:none;font-family:${FONT_STACK[theme.font]};font-size:11px;font-weight:700;color:${color};padding:7px 14px;border-radius:20px;${bg}">${esc(
    cta.label
  )}</a>`;
}

function contactRow(label, value, theme, href) {
  return `<tr><td style="padding:1px 0;font-family:${FONT_STACK[theme.font]};font-size:10px;line-height:16px;color:#000000;font-weight:700;white-space:nowrap;">${esc(
    label
  )}:&nbsp;</td><td style="padding:1px 0;font-family:${FONT_STACK[theme.font]};font-size:10px;line-height:16px;"><a href="${esc(
    href || "#"
  )}" style="color:${esc(theme.accent_color)};text-decoration:none;font-weight:400;">${esc(value)}</a></td></tr>`;
}

function contactRows(fields, theme) {
  let rows = "";
  if (fields.phone_show && fields.phone) rows += contactRow("Phone", fields.phone, theme, `tel:${esc(fields.phone)}`);
  if (fields.email_show && fields.email) rows += contactRow("Email", fields.email, theme, `mailto:${esc(fields.email)}`);
  if (fields.website_show && fields.website)
    rows += contactRow("Website", fields.website, theme, fields.website.startsWith("http") ? fields.website : `https://${esc(fields.website)}`);
  return rows ? `<table cellpadding="0" cellspacing="0" border="0">${rows}</table>` : "";
}

function photoHtml(fields, width = 140) {
  if (!fields.profile_photo_url) return "";
  const radius = fields.photo_rounded ? "border-radius:50%;" : "border-radius:8px;";
  return `<img src="${esc(fields.profile_photo_url)}" width="${width}" height="${width}" alt="${esc(
    fields.full_name
  )}" style="display:block;width:${width}px;height:${width}px;object-fit:cover;${radius}" />`;
}

function logoHtml(fields, theme) {
  if (!fields.logo_url) return "";
  return `<img src="${esc(fields.logo_url)}" width="60" alt="${esc(
    fields.company_name
  )}" style="display:block;width:60px;height:auto;margin-bottom:8px;" />`;
}

// ---- Template 1: Classic (exact spec) --------------------------------------

function template1(fields, theme) {
  const border =
    theme.border_style === "box"
      ? `border:1px solid ${esc(theme.border_color)};border-radius:${esc(theme.border_radius)};`
      : "";
  const social = socialColumnHtml(fields, theme);
  const name = `<span style="font-family:${FONT_STACK[theme.font]};font-size:16px;font-weight:700;color:${esc(
    theme.text_color
  )};line-height:20px;">${esc(fields.full_name)}</span>${fields.verified_badge ? verifiedBadge() : ""}`;
  const title = fields.job_title
    ? `<div style="font-family:${FONT_STACK[theme.font]};font-size:12px;line-height:16px;color:${esc(theme.text_color)};margin-top:2px;">${esc(fields.job_title)}</div>`
    : "";
  const company = fields.company_name
    ? `<div style="font-family:${FONT_STACK[theme.font]};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${esc(theme.text_color)};margin-top:4px;">${esc(fields.company_name)}</div>`
    : "";
  const contacts = contactRows(fields, theme);
  const cta = ctaButtonHtml(fields, theme);

  return `<table cellpadding="0" cellspacing="0" border="0" style="${border}"><tr><td style="padding:10px;font-family:${FONT_STACK[theme.font]};font-size:10px;line-height:16px;color:${esc(theme.text_color)};"><table cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:top;">${social}</td>
<td width="20" style="font-size:0;line-height:0;">&nbsp;</td>
<td style="vertical-align:top;">${logoHtml(fields, theme)}${name}${title}${company}${
    contacts ? `<div style="margin-top:8px;">${contacts}</div>` : ""
  }${cta ? `<div style="margin-top:10px;">${cta}</div>` : ""}</td>
${
  fields.profile_photo_url
    ? `<td width="10" style="font-size:0;line-height:0;">&nbsp;</td><td style="vertical-align:top;padding-left:6px;">${photoHtml(fields, 140)}</td>`
    : ""
}
</tr></table></td></tr></table>`;
}

// ---- Template 2: Minimal ----------------------------------------------------

function template2(fields, theme) {
  const name = `<span style="font-family:${FONT_STACK[theme.font]};font-size:18px;font-weight:700;color:${esc(theme.text_color)};">${esc(fields.full_name)}</span>${fields.verified_badge ? verifiedBadge() : ""}`;
  const title = fields.job_title ? `<div style="font-family:${FONT_STACK[theme.font]};font-size:13px;color:${esc(theme.text_color)};margin-top:2px;">${esc(fields.job_title)}${fields.company_name ? ` · <strong>${esc(fields.company_name)}</strong>` : ""}</div>` : "";
  const contacts = contactRows(fields, theme);
  const social = visibleSocial(fields);
  const socialRow = social.length
    ? `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;"><tr>${social
        .map((s) => `<td style="padding:0 6px 0 0;"><a href="${esc(s.url)}" style="text-decoration:none;">${iconImg(s.id, theme, 20)}</a></td>`)
        .join("")}</tr></table>`
    : "";
  const cta = ctaButtonHtml(fields, theme);
  return `<table cellpadding="0" cellspacing="0" border="0"><tr>
${fields.profile_photo_url ? `<td style="vertical-align:middle;padding-right:14px;">${photoHtml(fields, 90)}</td>` : ""}
<td style="vertical-align:middle;font-family:${FONT_STACK[theme.font]};font-size:12px;line-height:18px;color:${esc(theme.text_color)};">${name}${title}${contacts ? `<div style="margin-top:6px;">${contacts}</div>` : ""}${socialRow}${cta ? `<div style="margin-top:10px;">${cta}</div>` : ""}</td>
</tr></table>`;
}

// ---- Template 3: Compact ----------------------------------------------------

function template3(fields, theme) {
  const border = theme.border_style === "box" ? `border:1px solid ${esc(theme.border_color)};border-radius:${esc(theme.border_radius)};` : "";
  const name = `<strong style="font-family:${FONT_STACK[theme.font]};font-size:13px;color:${esc(theme.text_color)};">${esc(fields.full_name)}</strong>${fields.verified_badge ? verifiedBadge() : ""}`;
  const sub = [fields.job_title, fields.company_name].filter(Boolean).map(esc).join(" · ");
  const contacts = contactRows(fields, theme);
  const social = visibleSocial(fields);
  const socialRow = social.length
    ? `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;"><tr>${social
        .map((s) => `<td style="padding:0 5px 0 0;"><a href="${esc(s.url)}" style="text-decoration:none;">${iconImg(s.id, theme, 18)}</a></td>`)
        .join("")}</tr></table>`
    : "";
  return `<table cellpadding="0" cellspacing="0" border="0" style="${border}"><tr><td style="padding:8px 12px;font-family:${FONT_STACK[theme.font]};font-size:11px;line-height:16px;color:${esc(theme.text_color)};">
${fields.logo_url ? `<div style="margin-bottom:4px;">${logoHtml(fields, theme)}</div>` : ""}
${name}${sub ? `<div style="font-size:11px;color:${esc(theme.text_color)};">${sub}</div>` : ""}
${contacts ? `<div style="margin-top:4px;">${contacts}</div>` : ""}
${socialRow}
</td></tr></table>`;
}

// ---- Template 4: Centered ---------------------------------------------------

function template4(fields, theme) {
  const border = theme.border_style === "box" ? `border:1px solid ${esc(theme.border_color)};border-radius:${esc(theme.border_radius)};` : "";
  const photo = fields.profile_photo_url ? `<div style="margin-bottom:8px;">${photoHtml(fields, 80)}</div>` : "";
  const name = `<span style="font-family:${FONT_STACK[theme.font]};font-size:16px;font-weight:700;color:${esc(theme.text_color)};">${esc(fields.full_name)}</span>${fields.verified_badge ? verifiedBadge() : ""}`;
  const title = fields.job_title ? `<div style="font-family:${FONT_STACK[theme.font]};font-size:12px;color:${esc(theme.text_color)};">${esc(fields.job_title)}</div>` : "";
  const company = fields.company_name ? `<div style="font-family:${FONT_STACK[theme.font]};font-size:11px;font-weight:700;text-transform:uppercase;color:${esc(theme.accent_color)};margin-top:2px;">${esc(fields.company_name)}</div>` : "";
  const contacts = contactRows(fields, theme);
  const social = visibleSocial(fields);
  const socialRow = social.length
    ? `<table cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 0 auto;"><tr>${social
        .map((s) => `<td style="padding:0 5px;"><a href="${esc(s.url)}" style="text-decoration:none;">${iconImg(s.id, theme, 20)}</a></td>`)
        .join("")}</tr></table>`
    : "";
  const cta = ctaButtonHtml(fields, theme);
  return `<table cellpadding="0" cellspacing="0" border="0" style="${border}" align="center"><tr><td style="padding:14px;text-align:center;font-family:${FONT_STACK[theme.font]};font-size:11px;line-height:16px;color:${esc(theme.text_color)};">${
    fields.logo_url ? `<div style="margin-bottom:8px;">${logoHtml(fields, theme)}</div>` : ""
  }${photo}${name}${title}${company}${contacts ? `<div style="margin-top:8px;text-align:left;">${contacts}</div>` : ""}${socialRow}${cta ? `<div style="margin-top:10px;">${cta}</div>` : ""}</td></tr></table>`;
}

// ---- Public API -------------------------------------------------------------

export function generateSignatureHTML({ fields, theme, template_id }) {
  const f = { ...DEFAULT_FIELDS, ...fields, social: { ...DEFAULT_FIELDS.social, ...(fields.social || {}) }, cta: { ...DEFAULT_CTA, ...(fields.cta || {}) } };
  const t = { ...DEFAULT_THEME, ...theme };
  switch (template_id) {
    case "t2_minimal":
      return template2(f, t);
    case "t3_compact":
      return template3(f, t);
    case "t4_centered":
      return template4(f, t);
    case "t1_classic":
    default:
      return template1(f, t);
  }
}

export function plainTextSignature(fields) {
  const lines = [fields.full_name, fields.job_title, fields.company_name].filter(Boolean);
  if (fields.phone_show && fields.phone) lines.push(`Phone: ${fields.phone}`);
  if (fields.email_show && fields.email) lines.push(`Email: ${fields.email}`);
  if (fields.website_show && fields.website) lines.push(`Website: ${fields.website}`);
  return lines.join("\n");
}