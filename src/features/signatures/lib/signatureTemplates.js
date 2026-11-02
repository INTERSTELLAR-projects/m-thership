// Email-signature HTML engine. Table-based, inline styles only (Gmail/Outlook/Apple Mail safe).
// Anything that moves (check, photo, icons, CTA) is a hosted GIF rendered by assetRender.js.
import { assetKey } from "./assetStore";
import { mix } from "./assetRender";
import { PLATFORMS, PLATFORM_BY_ID } from "./brandIcons";

// ---- Defaults -------------------------------------------------------------------

export const DEFAULT_CTA = { label: "Book a Call", url: "", style: "gradient", anim: "shine", icon: "arrow", radius: 8 };

export const DEFAULT_THEME = {
  accent_color: "#ff6a00",
  accent_color_2: "#ffaa00",
  text_color: "#141414",
  border_color: "#e7e3de",
  surface_color: "#ffffff",
  font: "Inter",
  border_style: "box", // box | none
  border_radius: "14px",
  accent_bar: true,
  badge_style: "shine", // shine | pulse | none
  badge_color: "#0a95ff",
  badge_size: 18,
  icon_style: "brand", // brand | logo | accent | ink | soft | outline | white
  icon_shape: "circle", // circle | rounded | square
  icon_size: 30,
  icon_gap: 8,
  icon_layout: "row", // row | column | grid
  icon_anim: "shine", // none | shine | pop
  contact_style: "caps", // caps | bold
};

const SOCIAL_DEFAULTS = Object.fromEntries(PLATFORMS.map((p) => [p.id, { show: false, url: "" }]));

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
  photo_side: "right", // left | right | top
  photo_px: 124,
  photo_shape: "rounded", // circle | rounded | square | slant
  photo_anim: "slice", // none | slice | shine | orbit | glow | zoom
  photo_ring: false,
  logo_url: "",
  logo_height: 34,
  verified_badge: true,
  social: {
    ...SOCIAL_DEFAULTS,
    instagram: { show: true, url: "https://instagram.com/" },
    linkedin: { show: true, url: "https://linkedin.com/" },
    x: { show: true, url: "https://x.com/" },
  },
  cta: { ...DEFAULT_CTA },
  assets: {},
};

export const TEMPLATES = [
  { id: "t5_rail", name: "Signature", description: "Icon rail, big animated photo" },
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

// Older saved signatures used different keys; map them onto the current engine.
const LEGACY_ICON_STYLE = { badge: "brand", tint: "accent", dark: "ink", color: "logo", mono: "outline" };

export function normalize(fields = {}, theme = {}) {
  const f = {
    ...DEFAULT_FIELDS,
    ...fields,
    social: fields.social ? { ...SOCIAL_DEFAULTS, ...fields.social } : { ...DEFAULT_FIELDS.social },
    cta: { ...DEFAULT_CTA, ...(fields.cta || {}) },
    assets: fields.assets || {},
  };
  if (fields.photo_px == null && fields.photo_size) f.photo_px = { sm: 88, md: 112, lg: 140 }[fields.photo_size] || 124;
  if (fields.photo_shape == null && fields.photo_rounded != null) f.photo_shape = fields.photo_rounded ? "circle" : "rounded";
  const t = { ...DEFAULT_THEME, ...theme };
  if (LEGACY_ICON_STYLE[t.icon_style]) t.icon_style = LEGACY_ICON_STYLE[t.icon_style];
  if (theme.badge_style == null && theme.badge_animated === false) t.badge_style = "none";
  return { f, t };
}

// ---- Helpers --------------------------------------------------------------------

function esc(str) {
  if (str == null) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const href = (u) => {
  const s = String(u || "").trim();
  if (!s) return "#";
  return /^(https?:|mailto:|tel:)/i.test(s) ? s : `https://${s}`;
};
const fontOf = (t) => FONT_STACK[t.font] || FONT_STACK.Inter;
const mutedOf = (t) => mix(t.text_color, "#ffffff", 0.45);
const matteOf = (t) => (t.border_style === "box" ? t.surface_color : "#ffffff");
const TBL = `cellpadding="0" cellspacing="0" border="0"`;

function img(a, alt, extra = "") {
  return `<img src="${esc(a.url)}" width="${a.width}" height="${a.height}" alt="${esc(alt)}" style="display:block;width:${a.width}px;height:${a.height}px;border:0;outline:none;${extra}" />`;
}

// Context passed through the templates: f (fields), t (theme), A(spec) -> asset | null.
function makeCtx(fields, theme, assets, final, collected) {
  const { f, t } = normalize(fields, theme);
  const A = (spec) => {
    const key = assetKey(spec);
    collected[key] = spec;
    return assets ? assets.get(key, final) : null;
  };
  return { f, t, A, final };
}

// ---- Building blocks ------------------------------------------------------------

function badgeHtml(c) {
  const { f, t, A } = c;
  if (!f.verified_badge) return "";
  const size = Number(t.badge_size) || 18;
  const a = A({ kind: "badge", color: t.badge_color, anim: t.badge_style, size, bg: matteOf(t) });
  if (!a || a.failed) return "";
  return `<td style="padding-left:6px;vertical-align:middle;">${img(a, "Verified")}</td>`;
}

function nameRow(c, size = 17) {
  const { f, t } = c;
  return `<table ${TBL}><tr><td style="font-family:${fontOf(t)};font-size:${size}px;line-height:${size + 5}px;font-weight:800;letter-spacing:-0.3px;color:${esc(
    t.text_color
  )};vertical-align:middle;">${esc(f.full_name)}</td>${badgeHtml(c)}</tr></table>`;
}

function titleLine(c, size = 12.5, color) {
  const { f, t } = c;
  if (!f.job_title) return "";
  return `<div style="font-family:${fontOf(t)};font-size:${size}px;line-height:${size + 5}px;font-weight:600;color:${esc(
    color || t.accent_color
  )};margin-top:3px;">${esc(f.job_title)}</div>`;
}

function companyLine(c, mt = 6) {
  const { f, t } = c;
  if (!f.company_name) return "";
  return `<div style="font-family:${fontOf(t)};font-size:9.5px;line-height:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.16em;color:${esc(
    mutedOf(t)
  )};margin-top:${mt}px;">${esc(f.company_name)}</div>`;
}

function logoHtml(c, center = false) {
  const { f } = c;
  if (!f.logo_url) return "";
  const h = Number(f.logo_height) || 34;
  return `<img src="${esc(f.logo_url)}" height="${h}" alt="${esc(f.company_name)}" style="display:${
    center ? "inline-block" : "block"
  };height:${h}px;width:auto;max-width:180px;border:0;margin:0 0 12px 0;" />`;
}

function divider(t, margin = "12px 0") {
  return `<div style="border-top:1px solid ${esc(t.border_color)};font-size:0;line-height:0;margin:${margin};">&nbsp;</div>`;
}

function contactList(f) {
  const out = [];
  if (f.phone_show && f.phone) out.push({ cap: "Call", bold: "Phone", v: f.phone, h: `tel:${f.phone.replace(/[^\d+]/g, "")}` });
  if (f.email_show && f.email) out.push({ cap: "Mail", bold: "Email", v: f.email, h: `mailto:${f.email}` });
  if (f.website_show && f.website) out.push({ cap: "Web", bold: "Website", v: f.website, h: href(f.website) });
  return out;
}

function contactRows(c) {
  const { f, t } = c;
  const font = fontOf(t);
  const items = contactList(f);
  if (!items.length) return "";
  if (t.contact_style === "bold") {
    const rows = items
      .map(
        (i) =>
          `<tr><td style="padding:1.5px 0;font-family:${font};font-size:12px;line-height:17px;color:${esc(
            t.text_color
          )};"><a href="${esc(i.h)}" style="color:${esc(t.text_color)};text-decoration:none;font-weight:700;">${esc(
            i.bold
          )}:&nbsp; <span style="font-weight:500;color:${esc(t.accent_color)};">${esc(i.v)}</span></a></td></tr>`
      )
      .join("");
    return `<table ${TBL}>${rows}</table>`;
  }
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:2px 12px 2px 0;font-family:${font};font-size:8.5px;line-height:16px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:${esc(
          t.accent_color
        )};white-space:nowrap;vertical-align:top;">${esc(i.cap)}</td><td style="padding:2px 0;font-family:${font};font-size:12px;line-height:16px;color:${esc(
          t.text_color
        )};"><a href="${esc(i.h)}" style="color:${esc(t.text_color)};text-decoration:none;">${esc(i.v)}</a></td></tr>`
    )
    .join("");
  return `<table ${TBL}>${rows}</table>`;
}

function contactInline(c) {
  const { f, t } = c;
  const items = contactList(f);
  if (!items.length) return "";
  return `<div style="font-family:${fontOf(t)};font-size:11.5px;line-height:17px;color:${esc(t.text_color)};margin-top:6px;">${items
    .map((i) => `<a href="${esc(i.h)}" style="color:${esc(t.text_color)};text-decoration:none;">${esc(i.v)}</a>`)
    .join(`<span style="color:${esc(t.accent_color)};"> &nbsp;&bull;&nbsp; </span>`)}</div>`;
}

function visibleSocial(f) {
  return PLATFORMS.map((p) => ({ ...p, ...(f.social[p.id] || {}) })).filter((s) => s.show && s.url);
}

function socialBlock(c, { layout, center = false } = {}) {
  const { f, t, A } = c;
  const items = visibleSocial(f);
  if (!items.length) return "";
  const size = Number(t.icon_size) || 30;
  const gap = Number(t.icon_gap) || 0;
  const mode = layout || t.icon_layout || "row";
  const link = (s, i) => {
    const a = A({
      kind: "icon",
      platform: s.id,
      style: t.icon_style,
      shape: t.icon_shape,
      size,
      accent: t.accent_color,
      bg: matteOf(t),
      anim: t.icon_anim,
      index: t.icon_anim === "none" ? 0 : i,
    });
    if (a?.failed) return "";
    const inner = a ? img(a, PLATFORM_BY_ID[s.id].label) : `<div style="width:${size}px;height:${size}px;"></div>`;
    return `<a href="${esc(href(s.url))}" target="_blank" style="text-decoration:none;display:block;">${inner}</a>`;
  };
  const align = center ? ` align="center"` : "";
  if (mode === "column") {
    return `<table ${TBL}${align}>${items
      .map((s, i) => `<tr><td style="padding:0 0 ${i === items.length - 1 ? 0 : gap}px 0;">${link(s, i)}</td></tr>`)
      .join("")}</table>`;
  }
  if (mode === "grid") {
    const rows = [];
    for (let i = 0; i < items.length; i += 2) {
      const b = items[i + 1];
      rows.push(
        `<tr><td style="padding:0 ${gap}px ${gap}px 0;">${link(items[i], i)}</td><td style="padding:0 0 ${gap}px 0;">${
          b ? link(b, i + 1) : ""
        }</td></tr>`
      );
    }
    return `<table ${TBL}${align}>${rows.join("")}</table>`;
  }
  return `<table ${TBL}${align}><tr>${items
    .map((s, i) => `<td style="padding:0 ${i === items.length - 1 ? 0 : gap}px 0 0;">${link(s, i)}</td>`)
    .join("")}</tr></table>`;
}

function ctaHtmlButton(c, cta) {
  const { t } = c;
  const font = fontOf(t);
  const accent = t.accent_color;
  const accent2 = t.accent_color_2 || mix(accent, "#ffffff", 0.35);
  const label = esc(cta.label);
  const link = esc(href(cta.url));
  const base = `display:inline-block;text-decoration:none;font-family:${font};font-size:11px;line-height:14px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;`;
  if (cta.style === "link") {
    return `<a href="${link}" style="${base}color:${esc(accent)};padding:2px 0;border-bottom:2px solid ${esc(accent)};">${label} &nbsp;&#8594;</a>`;
  }
  const r = cta.style === "pill" ? "999px" : `${Number(cta.radius ?? 8)}px`;
  const conf =
    {
      solid: { bg: accent, fg: "#ffffff", bd: accent },
      gradient: { bg: accent, fg: "#ffffff", bd: accent, extra: `background-image:linear-gradient(100deg,${esc(accent)},${esc(accent2)});` },
      pill: { bg: accent, fg: "#ffffff", bd: accent, extra: `background-image:linear-gradient(100deg,${esc(accent)},${esc(accent2)});` },
      outline: { bg: matteOf(t), fg: accent, bd: accent },
      glass: { bg: mix(accent, "#ffffff", 0.88), fg: mix(accent, "#000000", 0.2), bd: mix(accent, "#ffffff", 0.5) },
      neon: { bg: "#0c0c0e", fg: "#ffffff", bd: accent },
      ink: { bg: "#111111", fg: "#ffffff", bd: "#111111" },
    }[cta.style] || { bg: accent, fg: "#ffffff", bd: accent };
  return `<table ${TBL} style="border-collapse:separate;"><tr><td align="center" bgcolor="${esc(conf.bg)}" style="border-radius:${r};border:1.5px solid ${esc(
    conf.bd
  )};${conf.extra || ""}"><a href="${link}" style="${base}color:${esc(conf.fg)};padding:11px 20px;">${label}${
    cta.icon && cta.icon !== "none" ? " &nbsp;&#8594;" : ""
  }</a></td></tr></table>`;
}

function ctaBlock(c, center = false) {
  const { f, t, A } = c;
  const cta = f.cta;
  if (!cta || !cta.label) return "";
  const asImage = cta.style !== "link" && (cta.anim !== "none" || cta.style === "glass" || cta.style === "neon");
  if (asImage) {
    const a = A({
      kind: "cta",
      label: cta.label,
      style: cta.style,
      anim: cta.anim,
      icon: cta.icon,
      radius: Number(cta.radius ?? 8),
      accent: t.accent_color,
      accent2: t.accent_color_2,
      bg: matteOf(t),
      font: t.font,
    });
    if (a && !a.failed) {
      return `<a href="${esc(href(cta.url))}" target="_blank" style="text-decoration:none;display:${center ? "inline-block" : "block"};">${img(
        a,
        cta.label
      )}</a>`;
    }
  }
  return ctaHtmlButton(c, cta);
}

function photoBlock(c, sizeOverride) {
  const { f, t, A } = c;
  if (!f.profile_photo_url) return "";
  const size = sizeOverride || Number(f.photo_px) || 124;
  const a = A({
    kind: "photo",
    src: f.profile_photo_url,
    size,
    shape: f.photo_shape,
    anim: f.photo_anim,
    ring: !!f.photo_ring,
    accent: t.accent_color,
    accent2: t.accent_color_2,
    bg: matteOf(t),
  });
  if (a && !a.failed) return img(a, f.full_name);
  const radius = f.photo_shape === "circle" ? "50%" : f.photo_shape === "square" ? "4px" : "18%";
  return `<img src="${esc(f.profile_photo_url)}" width="${size}" height="${size}" alt="${esc(
    f.full_name
  )}" style="display:block;width:${size}px;height:${size}px;object-fit:cover;border-radius:${radius};border:0;" />`;
}

function withPhoto(c, inner, { gap = 18, valign = "middle", center = false, size } = {}) {
  const photo = photoBlock(c, size);
  if (!photo) return inner;
  const side = c.f.photo_side || "right";
  if (side === "top") {
    const al = center ? ` align="center"` : "";
    return `<table ${TBL}${al}><tr><td${al} style="padding:0 0 ${gap - 4}px 0;">${photo}</td></tr><tr><td${al}>${inner}</td></tr></table>`;
  }
  const ph = `<td style="vertical-align:${valign};padding:${side === "left" ? `0 ${gap}px 0 0` : `0 0 0 ${gap}px`};">${photo}</td>`;
  const body = `<td style="vertical-align:${valign};">${inner}</td>`;
  return `<table ${TBL}><tr>${side === "left" ? ph + body : body + ph}</tr></table>`;
}

function accentBar(t) {
  if (!t.accent_bar) return "";
  const r = esc(t.border_radius);
  return `<tr><td bgcolor="${esc(t.accent_color)}" style="height:4px;line-height:4px;font-size:0;background-color:${esc(
    t.accent_color
  )};background-image:linear-gradient(90deg,${esc(t.accent_color)},${esc(t.accent_color_2 || t.accent_color)});border-radius:${r} ${r} 0 0;">&nbsp;</td></tr>`;
}

function frame(c, inner, pad = "18px 20px", center = false) {
  const { t } = c;
  if (t.border_style !== "box") return inner;
  return `<table ${TBL}${center ? ` align="center"` : ""} bgcolor="${esc(t.surface_color)}" style="border-collapse:separate;border:1px solid ${esc(
    t.border_color
  )};border-radius:${esc(t.border_radius)};background-color:${esc(t.surface_color)};">${accentBar(t)}<tr><td style="padding:${pad};">${inner}</td></tr></table>`;
}

// ---- Templates ------------------------------------------------------------------

// Signature: vertical icon rail, logo, name + check, contacts, CTA, big animated photo.
function tRail(c) {
  const { t } = c;
  const font = fontOf(t);
  const social = socialBlock(c, { layout: "column" });
  const cta = ctaBlock(c);
  const contacts = contactRows(c);
  const content = `<td style="vertical-align:middle;font-family:${font};">${logoHtml(c)}${nameRow(c, 18)}${titleLine(c, 12.5)}${companyLine(
    c,
    7
  )}${contacts ? `<div style="margin-top:10px;">${contacts}</div>` : ""}${cta ? `<div style="margin-top:13px;">${cta}</div>` : ""}</td>`;
  const rail = social
    ? `<td style="vertical-align:middle;padding:0 18px 0 0;"><table ${TBL} style="border-collapse:separate;border:1px solid ${esc(
        t.border_color
      )};border-radius:12px;"><tr><td style="padding:9px 8px;">${social}</td></tr></table></td>`
    : "";
  const inner = `<table ${TBL}><tr>${rail}${content}</tr></table>`;
  return frame(c, withPhoto(c, inner, { gap: 22, valign: "middle" }), "16px 18px");
}

// Executive: framed panel, details stack, social row, CTA.
function tExecutive(c) {
  const { t } = c;
  const font = fontOf(t);
  const social = socialBlock(c);
  const cta = ctaBlock(c);
  const contacts = contactRows(c);
  const inner = `<div style="font-family:${font};">${logoHtml(c)}${nameRow(c)}${titleLine(c)}${companyLine(c)}${
    contacts ? `${divider(t)}${contacts}` : ""
  }${social ? `<div style="margin-top:13px;">${social}</div>` : ""}${cta ? `<div style="margin-top:15px;">${cta}</div>` : ""}</div>`;
  return frame(c, withPhoto(c, inner, { gap: 18, valign: "top" }));
}

// Editorial: borderless, type-first, accent rule.
function tEditorial(c) {
  const { t } = c;
  const font = fontOf(t);
  const social = socialBlock(c);
  const cta = ctaBlock(c);
  const contacts = contactRows(c);
  const inner = `<table ${TBL}><tr><td style="border-left:3px solid ${esc(t.accent_color)};padding:2px 0 2px 16px;font-family:${font};">${logoHtml(
    c
  )}${nameRow(c, 21)}${titleLine(c, 13)}${companyLine(c, 8)}${contacts ? `<div style="margin-top:12px;">${contacts}</div>` : ""}${
    social ? `<div style="margin-top:13px;">${social}</div>` : ""
  }${cta ? `<div style="margin-top:15px;">${cta}</div>` : ""}</td></tr></table>`;
  return withPhoto(c, inner, { gap: 20, valign: "middle" });
}

// Inline: compact one-block signature.
function tInline(c) {
  const { f, t } = c;
  const font = fontOf(t);
  const social = socialBlock(c, { layout: "row" });
  const cta = ctaBlock(c);
  const role = [f.job_title, f.company_name].filter(Boolean).map(esc).join(" &middot; ");
  const inner = `<div style="font-family:${font};">${nameRow(c, 15)}${
    role ? `<div style="font-family:${font};font-size:11.5px;line-height:16px;color:${esc(mutedOf(t))};margin-top:2px;">${role}</div>` : ""
  }${contactInline(c)}${
    social || cta
      ? `<table ${TBL} style="margin-top:9px;"><tr>${social ? `<td style="vertical-align:middle;padding-right:12px;">${social}</td>` : ""}${
          cta ? `<td style="vertical-align:middle;">${cta}</td>` : ""
        }</tr></table>`
      : ""
  }</div>`;
  return frame(c, withPhoto(c, inner, { gap: 14, valign: "middle", size: Math.min(Number(f.photo_px) || 124, 84) }), "13px 16px");
}

// Card: centered portrait card.
function tCard(c) {
  const { f, t } = c;
  const font = fontOf(t);
  const social = socialBlock(c, { layout: "row", center: true });
  const cta = ctaBlock(c, true);
  const contacts = contactRows(c);
  const photo = photoBlock(c);
  const inner = `<div style="text-align:center;font-family:${font};">${f.logo_url ? `<div>${logoHtml(c, true)}</div>` : ""}${
    photo ? `<table ${TBL} align="center"><tr><td style="padding:0 0 12px 0;">${photo}</td></tr></table>` : ""
  }<table ${TBL} align="center"><tr><td>${nameRow(c, 19)}</td></tr></table>${titleLine(c, 12.5)}${companyLine(
    c,
    6
  )}<div style="height:2px;width:40px;line-height:2px;font-size:0;background:${esc(t.accent_color)};margin:12px auto 0 auto;">&nbsp;</div>${
    contacts ? `<table ${TBL} align="center" style="margin-top:12px;"><tr><td style="text-align:left;">${contacts}</td></tr></table>` : ""
  }${social ? `<div style="margin-top:14px;">${social}</div>` : ""}${cta ? `<div style="margin-top:16px;">${cta}</div>` : ""}</div>`;
  return frame(c, inner, "22px 26px", true);
}

const RENDER = { t5_rail: tRail, t1_classic: tExecutive, t2_minimal: tEditorial, t3_compact: tInline, t4_centered: tCard };

// ---- Public API -----------------------------------------------------------------

/**
 * assets: { get(key, final) } from useSignatureAssets. final=true only returns hosted URLs.
 */
export function generateSignatureHTML({ fields = {}, theme = {}, template_id, assets = null, final = false }) {
  const c = makeCtx(fields, theme, assets, final, {});
  const body = (RENDER[template_id] || tRail)(c);
  return `<table ${TBL} style="font-family:${fontOf(c.t)};"><tr><td>${body}</td></tr></table>`;
}

// Every asset spec the current design needs: { key: spec }.
export function collectAssetSpecs({ fields = {}, theme = {}, template_id }) {
  const collected = {};
  const c = makeCtx(fields, theme, null, false, collected);
  (RENDER[template_id] || tRail)(c);
  return collected;
}

export function plainTextSignature(fields) {
  const lines = [fields.full_name, fields.job_title, fields.company_name].filter(Boolean);
  if (fields.phone_show && fields.phone) lines.push(`Phone: ${fields.phone}`);
  if (fields.email_show && fields.email) lines.push(`Email: ${fields.email}`);
  if (fields.website_show && fields.website) lines.push(`Website: ${fields.website}`);
  return lines.join("\n");
}
