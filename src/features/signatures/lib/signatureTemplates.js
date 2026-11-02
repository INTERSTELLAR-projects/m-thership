import { getIconSpec, DEFAULT_CTA } from "./iconLibrary";

// ---- Defaults ---------------------------------------------------------------

export const DEFAULT_THEME = {
  accent_color: "#ff6a00",
  text_color: "#1a1a1a",
  border_color: "#e5e2de",
  surface_color: "#ffffff",
  font: "Inter",
  border_style: "box", // "box" | "none"
  border_radius: "12px",
  accent_bar: true,
  badge_animated: true,
  icon_style: "badge",
  icon_shape: "circle",
  icon_size: 26,
  icon_gap: 8,
  icon_layout: "row",
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
  photo_rounded: true,
  photo_side: "right", // "right" | "left"
  photo_size: "md", // "sm" | "md" | "lg"
  logo_url: "",
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
  { id: "t1_classic", name: "Executive", description: "Framed panel with portrait" },
  { id: "t2_minimal", name: "Editorial", description: "Borderless, type-first" },
  { id: "t3_compact", name: "Inline", description: "Tight single block" },
  { id: "t4_centered", name: "Card", description: "Centered portrait card" },
];

const FONT_STACK = {
  Inter: "'Inter', Arial, Helvetica, sans-serif",
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

function hex2rgb(hex) {
  const raw = String(hex || "").replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = parseInt(full, 16);
  if (isNaN(n) || full.length !== 6) return { r: 26, g: 26, b: 26 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex({ r, g, b }) {
  const part = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

// amount = how much of `to` is blended in (0 → from, 1 → to)
function mix(from, to, amount) {
  const a = hex2rgb(from);
  const b = hex2rgb(to);
  return toHex({ r: a.r + (b.r - a.r) * amount, g: a.g + (b.g - a.g) * amount, b: a.b + (b.b - a.b) * amount });
}

const fontOf = (theme) => FONT_STACK[theme.font] || FONT_STACK.Inter;
const mutedOf = (theme) => mix(theme.text_color, "#ffffff", 0.45);
const softAccentOf = (theme) => mix(theme.accent_color, "#ffffff", 0.86);

function visibleSocial(fields) {
  const social = fields.social || {};
  return ["website", "instagram", "linkedin", "facebook", "x", "tiktok", "youtube"]
    .map((id) => ({ id, ...social[id] }))
    .filter((s) => s.show && s.url);
}

// Animated verified badge: brighter blue, live shine + pulse ring.
// Email clients that strip <style> simply show the static gradient badge.
const BADGE_STYLE = `<style type="text/css">
@keyframes sigVShine{0%{transform:translateX(-150%) rotate(18deg)}55%,100%{transform:translateX(260%) rotate(18deg)}}
@keyframes sigVPulse{0%{box-shadow:0 0 0 0 rgba(0,145,255,.55)}70%{box-shadow:0 0 0 6px rgba(0,145,255,0)}100%{box-shadow:0 0 0 0 rgba(0,145,255,0)}}
</style>`;

function verifiedBadge(animated = true) {
  const base = `display:inline-block;position:relative;overflow:hidden;vertical-align:middle;width:17px;height:17px;margin-left:5px;border-radius:50%;background-color:#0091ff;background-image:linear-gradient(150deg,#63c9ff 0%,#0091ff 52%,#0064f0 100%);color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;line-height:17px;text-align:center;`;
  if (!animated) return `<span class="sig-v" style="${base}">&#10003;</span>`;
  const shine = `<span style="position:absolute;top:-40%;left:0;width:55%;height:180%;background-image:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.85),rgba(255,255,255,0));animation:sigVShine 3.4s ease-in-out infinite;">&#8203;</span>`;
  return `<span class="sig-v" style="${base}animation:sigVPulse 2.8s ease-out infinite;box-shadow:0 0 0 0 rgba(0,145,255,.55);">&#10003;${shine}</span>`;
}

function iconCell(platformId, theme) {
  const spec = getIconSpec(platformId, theme);
  if (!spec.url) return "";
  if (!spec.bubble) {
    return `<img src="${esc(spec.url)}" width="${spec.img}" height="${spec.img}" alt="${esc(
      platformId
    )}" style="display:block;width:${spec.img}px;height:${spec.img}px;border:0;" />`;
  }
  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr><td width="${
    spec.box
  }" align="center" bgcolor="${esc(spec.bg)}" style="width:${spec.box}px;border-radius:${
    spec.radius
  };border:${spec.border};padding:${spec.pad}px;text-align:center;vertical-align:middle;"><img src="${esc(
    spec.url
  )}" width="${spec.img}" height="${spec.img}" alt="${esc(
    platformId
  )}" style="display:block;margin:0 auto;width:${spec.img}px;height:${spec.img}px;border:0;" /></td></tr></table>`;
}

function socialBlock(fields, theme, align) {
  const items = visibleSocial(fields);
  if (!items.length) return "";
  const layout = theme.icon_layout || "row";
  const gap = Number(theme.icon_gap) || 0;
  const link = (s) => `<a href="${esc(s.url)}" style="text-decoration:none;" target="_blank">${iconCell(s.id, theme)}</a>`;
  const alignAttr = align === "center" ? ` align="center"` : "";

  if (layout === "column") {
    const rows = items
      .map((s, i) => `<tr><td style="padding:0 0 ${i === items.length - 1 ? 0 : gap}px 0;">${link(s)}</td></tr>`)
      .join("");
    return `<table cellpadding="0" cellspacing="0" border="0"${alignAttr}>${rows}</table>`;
  }

  if (layout === "grid") {
    const rows = [];
    for (let i = 0; i < items.length; i += 2) {
      const second = items[i + 1];
      rows.push(
        `<tr><td style="padding:0 ${gap}px ${Math.max(2, Math.round(gap * 0.8))}px 0;">${link(items[i])}</td><td style="padding:0 0 ${Math.max(
          2,
          Math.round(gap * 0.8)
        )}px 0;">${second ? link(second) : ""}</td></tr>`
      );
    }
    return `<table cellpadding="0" cellspacing="0" border="0"${alignAttr}>${rows.join("")}</table>`;
  }

  const cells = items
    .map((s, i) => `<td style="padding:0 ${i === items.length - 1 ? 0 : gap}px 0 0;">${link(s)}</td>`)
    .join("");
  return `<table cellpadding="0" cellspacing="0" border="0"${alignAttr}><tr>${cells}</tr></table>`;
}

function photoSize(fields) {
  if (fields.photo_size === "sm") return 72;
  if (fields.photo_size === "lg") return 116;
  return 92;
}

function photoHtml(fields, theme, size) {
  if (!fields.profile_photo_url) return "";
  const px = size || photoSize(fields);
  const radius = fields.photo_rounded ? "50%" : "10px";
  return `<img src="${esc(fields.profile_photo_url)}" width="${px}" height="${px}" alt="${esc(
    fields.full_name
  )}" style="display:block;width:${px}px;height:${px}px;object-fit:cover;border-radius:${radius};border:2px solid ${esc(
    mix(theme.accent_color, "#ffffff", 0.6)
  )};" />`;
}

function logoHtml(fields, theme, height = 34) {
  if (!fields.logo_url) return "";
  return `<img src="${esc(fields.logo_url)}" height="${height}" alt="${esc(
    fields.company_name
  )}" style="display:block;height:${height}px;width:auto;max-width:160px;border:0;margin:0 0 12px 0;" />`;
}

function nameBlock(fields, theme, size = 17) {
  const font = fontOf(theme);
  return `<div style="font-family:${font};font-size:${size}px;line-height:${size + 5}px;font-weight:700;letter-spacing:-0.3px;color:${esc(
    theme.text_color
  )};">${esc(fields.full_name)}${fields.verified_badge ? verifiedBadge(theme.badge_animated !== false) : ""}</div>`;
}

function titleLine(fields, theme, size = 12.5) {
  if (!fields.job_title) return "";
  return `<div style="font-family:${fontOf(theme)};font-size:${size}px;line-height:${size + 5}px;font-weight:600;color:${esc(
    theme.accent_color
  )};margin-top:4px;">${esc(fields.job_title)}</div>`;
}

function companyLine(fields, theme, marginTop = 7) {
  if (!fields.company_name) return "";
  return `<div style="font-family:${fontOf(theme)};font-size:9.5px;line-height:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.16em;color:${esc(
    mutedOf(theme)
  )};margin-top:${marginTop}px;">${esc(fields.company_name)}</div>`;
}

function divider(theme, margin = "12px 0") {
  return `<div style="border-top:1px solid ${esc(
    theme.border_color
  )};font-size:0;line-height:0;margin:${margin};">&nbsp;</div>`;
}

function contactRows(fields, theme) {
  const font = fontOf(theme);
  const labelColor = mutedOf(theme);
  const rows = [];
  const row = (label, value, href) =>
    rows.push(
      `<tr><td style="padding:2px 12px 2px 0;font-family:${font};font-size:8.5px;line-height:16px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:${esc(
        labelColor
      )};white-space:nowrap;vertical-align:top;">${esc(label)}</td><td style="padding:2px 0;font-family:${font};font-size:11.5px;line-height:16px;color:${esc(
        theme.text_color
      )};"><a href="${esc(href)}" style="color:${esc(theme.text_color)};text-decoration:none;">${esc(value)}</a></td></tr>`
    );
  if (fields.phone_show && fields.phone) row("Call", fields.phone, `tel:${fields.phone.replace(/[^\d+]/g, "")}`);
  if (fields.email_show && fields.email) row("Mail", fields.email, `mailto:${fields.email}`);
  if (fields.website_show && fields.website)
    row("Web", fields.website, fields.website.startsWith("http") ? fields.website : `https://${fields.website}`);
  return rows.length ? `<table cellpadding="0" cellspacing="0" border="0">${rows.join("")}</table>` : "";
}

function contactInline(fields, theme) {
  const font = fontOf(theme);
  const parts = [];
  if (fields.phone_show && fields.phone)
    parts.push(
      `<a href="tel:${esc(fields.phone.replace(/[^\d+]/g, ""))}" style="color:${esc(
        theme.text_color
      )};text-decoration:none;">${esc(fields.phone)}</a>`
    );
  if (fields.email_show && fields.email)
    parts.push(`<a href="mailto:${esc(fields.email)}" style="color:${esc(theme.text_color)};text-decoration:none;">${esc(fields.email)}</a>`);
  if (fields.website_show && fields.website) {
    const href = fields.website.startsWith("http") ? fields.website : `https://${fields.website}`;
    parts.push(`<a href="${esc(href)}" style="color:${esc(theme.text_color)};text-decoration:none;">${esc(fields.website)}</a>`);
  }
  if (!parts.length) return "";
  return `<div style="font-family:${font};font-size:11px;line-height:16px;color:${esc(
    theme.text_color
  )};margin-top:6px;">${parts.join(`<span style="color:${esc(mutedOf(theme))};"> &nbsp;·&nbsp; </span>`)}</div>`;
}

function ctaButtonHtml(fields, theme) {
  const cta = { ...DEFAULT_CTA, ...(fields.cta || {}) };
  if (!cta.label) return "";
  const font = fontOf(theme);
  const accent = theme.accent_color;
  const href = esc(cta.url || "#");
  const label = esc(cta.label);
  const base = `display:inline-block;text-decoration:none;font-family:${font};font-size:10.5px;line-height:14px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;`;

  if (cta.style === "link") {
    return `<a href="${href}" style="${base}color:${esc(
      accent
    )};padding:2px 0;border-bottom:1.5px solid ${esc(accent)};">${label} &nbsp;&#8594;</a>`;
  }

  const conf =
    {
      solid: { bg: accent, fg: "#ffffff", border: accent, radius: "7px", pad: "11px 20px" },
      gradient: {
        bg: accent,
        fg: "#ffffff",
        border: mix(accent, "#ffffff", 0.2),
        radius: "7px",
        pad: "11px 20px",
        extra: `background-image:linear-gradient(100deg,${esc(accent)},${esc(mix(accent, "#ffffff", 0.38))});`,
      },
      outline: { bg: theme.surface_color, fg: accent, border: accent, radius: "7px", pad: "10px 19px" },
      tint: { bg: softAccentOf(theme), fg: accent, border: softAccentOf(theme), radius: "7px", pad: "11px 20px" },
      pill: { bg: accent, fg: "#ffffff", border: accent, radius: "999px", pad: "11px 22px" },
      dark: { bg: "#1a1a1a", fg: "#ffffff", border: "#1a1a1a", radius: "7px", pad: "11px 20px" },
    }[cta.style] || null;

  const style = conf || { bg: accent, fg: "#ffffff", border: accent, radius: "7px", pad: "11px 20px" };
  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr><td align="center" bgcolor="${esc(
    style.bg
  )}" style="border-radius:${style.radius};border:1px solid ${esc(style.border)};${style.extra || ""}"><a href="${href}" style="${base}color:${esc(
    style.fg
  )};padding:${style.pad};display:inline-block;">${label}</a></td></tr></table>`;
}

function framedStyle(theme) {
  if (theme.border_style !== "box") return "";
  return `border:1px solid ${esc(theme.border_color)};border-radius:${esc(theme.border_radius)};background:${esc(
    theme.surface_color
  )};`;
}

function accentBar(theme) {
  if (theme.border_style !== "box" || !theme.accent_bar) return "";
  const radius = esc(theme.border_radius);
  return `<tr><td style="height:3px;line-height:3px;font-size:0;background-color:${esc(
    theme.accent_color
  )};background-image:linear-gradient(90deg,${esc(theme.accent_color)},${esc(
    mix(theme.accent_color, "#ffffff", 0.45)
  )});border-radius:${radius} ${radius} 0 0;">&nbsp;</td></tr>`;
}

// ---- Template 1: Executive (framed panel) -----------------------------------

function template1(fields, theme) {
  const font = fontOf(theme);
  const social = socialBlock(fields, theme);
  const cta = ctaButtonHtml(fields, theme);
  const contacts = contactRows(fields, theme);
  const photo = fields.profile_photo_url
    ? `<td width="${photoSize(fields) + 16}" style="vertical-align:top;${
        fields.photo_side === "left" ? "padding-right:16px;" : "padding-left:16px;"
      }">${photoHtml(fields, theme)}</td>`
    : "";
  const left = fields.photo_side === "left" ? photo : "";
  const right = fields.photo_side === "left" ? "" : photo;

  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;${framedStyle(theme)}">${accentBar(
    theme
  )}<tr><td style="padding:16px 18px;"><table cellpadding="0" cellspacing="0" border="0"><tr>${left}<td style="vertical-align:top;font-family:${font};">${logoHtml(
    fields,
    theme
  )}${nameBlock(fields, theme)}${titleLine(fields, theme)}${companyLine(fields, theme)}${
    contacts ? `${divider(theme)}${contacts}` : ""
  }${social ? `<div style="margin-top:13px;">${social}</div>` : ""}${
    cta ? `<div style="margin-top:15px;">${cta}</div>` : ""
  }</td>${right}</tr></table></td></tr></table>`;
}

// ---- Template 2: Editorial (borderless, type-first) -------------------------

function template2(fields, theme) {
  const font = fontOf(theme);
  const social = socialBlock(fields, theme);
  const cta = ctaButtonHtml(fields, theme);
  const contacts = contactRows(fields, theme);
  const photo = fields.profile_photo_url
    ? `<td width="${photoSize(fields) + 18}" style="vertical-align:top;${
        fields.photo_side === "left" ? "padding-right:18px;" : "padding-left:18px;"
      }">${photoHtml(fields, theme)}</td>`
    : "";
  const left = fields.photo_side === "left" ? photo : "";
  const right = fields.photo_side === "left" ? "" : photo;

  return `<table cellpadding="0" cellspacing="0" border="0"><tr>${left}<td style="vertical-align:top;font-family:${font};">${logoHtml(
    fields,
    theme
  )}${nameBlock(fields, theme, 20)}${titleLine(fields, theme, 13)}${
    fields.company_name
      ? `<div style="font-family:${font};font-size:10px;line-height:15px;letter-spacing:0.16em;text-transform:uppercase;color:${esc(
          mutedOf(theme)
        )};margin-top:8px;">${esc(fields.company_name)}</div>`
      : ""
  }${contacts ? `${divider(theme, "14px 0")}${contacts}` : ""}${
    social ? `<div style="margin-top:14px;">${social}</div>` : ""
  }${cta ? `<div style="margin-top:16px;">${cta}</div>` : ""}</td>${right}</tr></table>`;
}

// ---- Template 3: Inline (compact) -------------------------------------------

function template3(fields, theme) {
  const font = fontOf(theme);
  const social = socialBlock(fields, theme);
  const cta = ctaButtonHtml(fields, theme);
  const photo = fields.profile_photo_url
    ? `<td width="${photoSize(fields) + 14}" style="vertical-align:middle;${
        fields.photo_side === "left" ? "padding-right:14px;" : "padding-left:14px;"
      }">${photoHtml(fields, theme, fields.photo_size === "lg" ? 88 : 64)}</td>`
    : "";
  const left = fields.photo_side === "left" ? photo : "";
  const right = fields.photo_side === "left" ? "" : photo;
  const role = [fields.job_title, fields.company_name].filter(Boolean).map(esc).join(" · ");

  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;${framedStyle(
    theme
  )}">${accentBar(theme)}<tr><td style="padding:12px 15px;"><table cellpadding="0" cellspacing="0" border="0"><tr>${left}<td style="vertical-align:middle;font-family:${font};">${nameBlock(
    fields,
    theme,
    14
  )}${
    role
      ? `<div style="font-family:${font};font-size:11px;line-height:16px;color:${esc(mutedOf(theme))};margin-top:2px;">${role}</div>`
      : ""
  }${contactInline(fields, theme)}${social ? `<div style="margin-top:9px;">${social}</div>` : ""}${
    cta ? `<div style="margin-top:10px;">${cta}</div>` : ""
  }</td>${right}</tr></table></td></tr></table>`;
}

// ---- Template 4: Card (centered portrait) -----------------------------------

function template4(fields, theme) {
  const font = fontOf(theme);
  const social = socialBlock(fields, theme, "center");
  const cta = ctaButtonHtml(fields, theme);
  const contacts = contactRows(fields, theme);
  const photo = fields.profile_photo_url
    ? `<div style="margin:0 0 12px 0;">${photoHtml(fields, theme)}</div>`
    : "";

  return `<table cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:separate;${framedStyle(
    theme
  )}">${accentBar(theme)}<tr><td style="padding:20px 22px;text-align:center;font-family:${font};">${
    fields.logo_url ? `<div style="text-align:center;"><img src="${esc(fields.logo_url)}" height="30" alt="${esc(
      fields.company_name
    )}" style="display:inline-block;height:30px;width:auto;max-width:150px;border:0;margin:0 0 12px 0;" /></div>` : ""
  }${photo}${nameBlock(fields, theme, 18)}${
    fields.job_title
      ? `<div style="font-family:${font};font-size:12px;line-height:17px;color:${esc(theme.accent_color)};margin-top:4px;">${esc(
          fields.job_title
        )}</div>`
      : ""
  }${
    fields.company_name
      ? `<div style="font-family:${font};font-size:9.5px;line-height:14px;letter-spacing:0.16em;text-transform:uppercase;color:${esc(
          mutedOf(theme)
        )};margin-top:6px;">${esc(fields.company_name)}</div>`
      : ""
  }<div style="height:1px;width:38px;line-height:1px;font-size:0;background:${esc(
    theme.accent_color
  )};margin:12px auto 0 auto;">&nbsp;</div>${contacts ? `<div style="margin-top:12px;">${contacts}</div>` : ""}${
    social ? `<div style="margin-top:14px;">${social}</div>` : ""
  }${cta ? `<div style="margin-top:16px;">${cta}</div>` : ""}</td></tr></table>`;
}

// ---- Public API -------------------------------------------------------------

export function generateSignatureHTML({ fields, theme, template_id }) {
  const f = {
    ...DEFAULT_FIELDS,
    ...fields,
    social: { ...DEFAULT_FIELDS.social, ...(fields.social || {}) },
    cta: { ...DEFAULT_CTA, ...(fields.cta || {}) },
  };
  const t = { ...DEFAULT_THEME, ...theme };
  let body;
  switch (template_id) {
    case "t2_minimal":
      body = template2(f, t);
      break;
    case "t3_compact":
      body = template3(f, t);
      break;
    case "t4_centered":
      body = template4(f, t);
      break;
    case "t1_classic":
    default:
      body = template1(f, t);
  }
  return BADGE_STYLE + body;
}

export function plainTextSignature(fields) {
  const lines = [fields.full_name, fields.job_title, fields.company_name].filter(Boolean);
  if (fields.phone_show && fields.phone) lines.push(`Phone: ${fields.phone}`);
  if (fields.email_show && fields.email) lines.push(`Email: ${fields.email}`);
  if (fields.website_show && fields.website) lines.push(`Website: ${fields.website}`);
  return lines.join("\n");
}