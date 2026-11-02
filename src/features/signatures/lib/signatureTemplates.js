// Email-signature HTML engine.
// - Table + inline-style only (Gmail / Outlook / Apple Mail safe; Gmail strips <style>).
// - Responsive without media queries: blocks are inline-block "hybrid" columns that sit
//   side by side on desktop and stack on phones; contact chips, icons and the CTA wrap.
// - Everything that moves (check, photo, icons, CTA) is a hosted GIF from assetRender.js.
import { assetKey } from "./assetStore";
import { mix } from "./assetRender";
import { PLATFORMS, PLATFORM_BY_ID } from "./brandIcons";

// ---- Defaults -------------------------------------------------------------------

export const DEFAULT_CTA = { label: "Book a Call", url: "", style: "gradient", anim: "shine", icon: "arrow", radius: 10 };

export const DEFAULT_THEME = {
  accent_color: "#ff6a00",
  accent_color_2: "#ffaa00",
  text_color: "#141414",
  border_color: "#ebe7e2",
  surface_color: "#ffffff",
  font: "Inter",
  border_style: "gradient", // gradient | box (hairline) | none
  border_width: 2,
  border_radius: "18px",
  accent_bar: false,
  divider_anim: "sweep", // sweep | none — a soft light gliding along the divider
  badge_style: "shine", // shine | pulse | none
  badge_color: "#0a95ff",
  badge_size: 18,
  icon_style: "brand", // brand | logo | accent | ink | soft | outline | white
  icon_shape: "circle", // circle | rounded | square
  icon_size: 26,
  icon_gap: 7,
  icon_layout: "row", // row | column | grid
  icon_anim: "shine", // none | shine | pop
  contact_style: "auto", // auto | icons | caps | bold
  contact_icon_style: "soft", // soft | solid | gradient | ring | bare
  contact_icon_set: "line", // line | solid
  contact_icon_size: 20,
  contact_icon_color: "", // "" = accent
};

const SOCIAL_DEFAULTS = Object.fromEntries(PLATFORMS.map((p) => [p.id, { show: false, url: "" }]));

export const DEFAULT_FIELDS = {
  full_name: "Alex Morgan",
  job_title: "Product Designer",
  company_name: "Nebula Labs",
  slogan: "",
  phone: "+1 (415) 555-0142",
  phone_show: true,
  email: "alex@nebulalabs.com",
  email_show: true,
  website: "nebulalabs.com",
  website_show: true,
  address: "",
  address_show: false,
  profile_photo_url: "",
  photo_side: "left", // left | right | top
  photo_px: 96,
  photo_shape: "rounded", // circle | rounded | square | slant
  photo_anim: "slice", // none | slice | shine | orbit | glow | zoom
  photo_ring: false,
  logo_url: "",
  logo_height: 24,
  logo_position: "brand", // brand (beside company) | top | footer
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

// Ids are kept from earlier versions so saved signatures keep working.
export const TEMPLATES = [
  { id: "t5_rail", name: "Halo", description: "Photo + name header, contact chips" },
  { id: "t1_classic", name: "Split", description: "Tall portrait beside details" },
  { id: "t4_centered", name: "Stack", description: "Centered, mobile-first card" },
  { id: "t2_minimal", name: "Minimal", description: "Borderless with accent rule" },
  { id: "t3_compact", name: "Compact", description: "Slim one-row for replies" },
];

const FONT_STACK = {
  Inter: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  Arial: "Arial, Helvetica, sans-serif",
  Helvetica: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  Georgia: "Georgia, 'Times New Roman', serif",
};

const LEGACY_ICON_STYLE = { badge: "brand", tint: "accent", dark: "ink", color: "logo", mono: "outline" };

export function normalize(fields = {}, theme = {}) {
  const f = {
    ...DEFAULT_FIELDS,
    ...fields,
    social: fields.social ? { ...SOCIAL_DEFAULTS, ...fields.social } : { ...DEFAULT_FIELDS.social },
    cta: { ...DEFAULT_CTA, ...(fields.cta || {}) },
    assets: fields.assets || {},
  };
  if (fields.photo_px == null && fields.photo_size) f.photo_px = { sm: 80, md: 96, lg: 120 }[fields.photo_size] || 96;
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
const mutedOf = (t) => mix(t.text_color, t.surface_color || "#ffffff", 0.5);
const matteOf = (t) => (t.border_style === "none" ? "#ffffff" : t.surface_color);
const TBL = `cellpadding="0" cellspacing="0" border="0" role="presentation"`;

function img(a, alt, extra = "") {
  return `<img src="${esc(a.url)}" width="${a.width}" height="${a.height}" alt="${esc(alt)}" style="display:block;width:${a.width}px;height:${a.height}px;border:0;outline:none;${extra}" />`;
}

// Inline-block column: side by side when there is room, stacks on narrow screens.
function col(html, { width, gap = 0, valign = "middle", bottom = 0 } = {}) {
  return `<div style="display:inline-block;vertical-align:${valign};${width ? `width:${width}px;` : ""}margin:0 ${gap}px ${bottom}px 0;">${html}</div>`;
}

function makeCtx(fields, theme, assets, final, collected) {
  const { f, t } = normalize(fields, theme);
  const A = (spec) => {
    const key = assetKey(spec);
    collected[key] = spec;
    const slot = `${spec.kind}:${spec.platform || spec.name || ""}`;
    return assets ? assets.get(key, final, slot) : null;
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

function nameRow(c, size = 19, center = false) {
  const { f, t } = c;
  return `<table ${TBL}${center ? ` align="center"` : ""}><tr><td style="font-family:${fontOf(t)};font-size:${size}px;line-height:${
    size + 5
  }px;font-weight:800;letter-spacing:-0.4px;color:${esc(t.text_color)};vertical-align:middle;">${esc(f.full_name)}</td>${badgeHtml(c)}</tr></table>`;
}

function titleLine(c, size = 13) {
  const { f, t } = c;
  if (!f.job_title) return "";
  return `<div style="font-family:${fontOf(t)};font-size:${size}px;line-height:${size + 5}px;font-weight:600;color:${esc(t.accent_color)};margin-top:2px;">${esc(
    f.job_title
  )}</div>`;
}

function logoImg(c, height, center = false) {
  const { f } = c;
  if (!f.logo_url) return "";
  return `<img src="${esc(f.logo_url)}" height="${height}" alt="${esc(f.company_name)}" style="display:${
    center ? "inline-block" : "block"
  };height:${height}px;width:auto;max-width:200px;border:0;" />`;
}

const logoH = (c, cap) => Math.min(Number(c.f.logo_height) || 24, cap);

// Company line, with the logo as a brand mark beside it when logo_position = brand.
function brandLine(c, { center = false, mt = 8 } = {}) {
  const { f, t } = c;
  const withLogo = f.logo_url && f.logo_position === "brand";
  if (!f.company_name && !withLogo) return sloganLine(c, center);
  const name = f.company_name
    ? `<td style="vertical-align:middle;font-family:${fontOf(t)};font-size:10px;line-height:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.16em;color:${esc(
        mutedOf(t)
      )};">${esc(f.company_name)}</td>`
    : "";
  const logo = withLogo ? `<td style="vertical-align:middle;padding-right:${f.company_name ? 9 : 0}px;">${logoImg(c, logoH(c, 34))}</td>` : "";
  return `<table ${TBL}${center ? ` align="center"` : ""} style="margin-top:${mt}px;"><tr>${logo}${name}</tr></table>${sloganLine(c, center)}`;
}

// Slogan / tagline under the logo + company line, a step larger than the company caps.
function sloganLine(c, center = false) {
  const { f, t } = c;
  if (!f.slogan) return "";
  return `<div style="font-family:${fontOf(t)};font-size:13px;line-height:18px;font-weight:500;font-style:italic;letter-spacing:-0.1px;color:${esc(
    mix(t.text_color, t.surface_color || "#ffffff", 0.25)
  )};margin-top:5px;${center ? "text-align:center;" : ""}">${esc(f.slogan)}</div>`;
}

function topLogo(c, center = false) {
  if (!c.f.logo_url || c.f.logo_position !== "top") return "";
  return `<div style="margin:0 0 12px 0;${center ? "text-align:center;" : ""}">${logoImg(c, logoH(c, 60), center)}</div>`;
}

function footerLogo(c, center = false) {
  if (!c.f.logo_url || c.f.logo_position !== "footer") return "";
  return `<div style="margin-top:14px;${center ? "text-align:center;" : ""}">${logoImg(c, logoH(c, 40), center)}</div>`;
}

function hairline(c, margin = "14px 0 12px 0") {
  const { t, A } = c;
  const tail = t.border_color;
  if (t.divider_anim === "sweep") {
    const a = A({ kind: "divider", accent: t.accent_color, accent2: t.accent_color_2 || t.accent_color, tail, bg: matteOf(t) });
    if (a && !a.failed) {
      return `<div style="margin:${margin};line-height:0;font-size:0;"><img src="${esc(a.url)}" width="100%" height="3" alt="" style="display:block;width:100%;height:3px;border:0;" /></div>`;
    }
  }
  return `<div style="height:2px;line-height:2px;font-size:0;background-color:${esc(tail)};background-image:linear-gradient(90deg,${esc(t.accent_color)} 0%,${esc(
    t.accent_color_2 || t.accent_color
  )} 30%,${esc(tail)} 68%);margin:${margin};">&nbsp;</div>`;
}

function contactList(f) {
  const out = [];
  if (f.phone_show && f.phone) out.push({ g: "phone", cap: "Call", bold: "Phone", v: f.phone, h: `tel:${f.phone.replace(/[^\d+]/g, "")}` });
  if (f.email_show && f.email) out.push({ g: "mail", cap: "Mail", bold: "Email", v: f.email, h: `mailto:${f.email}` });
  if (f.website_show && f.website) out.push({ g: "globe", cap: "Web", bold: "Website", v: String(f.website).replace(/^https?:\/\//, "").replace(/\/$/, ""), h: href(f.website) });
  if (f.address_show && f.address)
    out.push({ g: "pin", cap: "Visit", bold: "Address", v: f.address, h: `https://maps.google.com/?q=${encodeURIComponent(f.address)}` });
  return out;
}

function glyph(c, name) {
  const { t, A } = c;
  const a = A({
    kind: "glyph",
    name,
    set: t.contact_icon_set || "line",
    style: t.contact_icon_style || "soft",
    color: t.contact_icon_color || t.accent_color,
    color2: t.accent_color_2 || t.accent_color,
    size: Number(t.contact_icon_size) || 20,
    bg: matteOf(t),
  });
  return a && !a.failed ? a : null;
}

/** mode: chips (wrapping row) | rows (stacked). Style comes from theme.contact_style. */
function contacts(c, { mode = "chips", center = false } = {}) {
  const { f, t } = c;
  const items = contactList(f);
  if (!items.length) return "";
  const font = fontOf(t);
  const style = t.contact_style === "auto" ? "icons" : t.contact_style;
  const linkCss = `color:${esc(t.text_color)};text-decoration:none;`;

  if (style === "caps" || style === "bold") {
    const label = (i) =>
      style === "caps"
        ? `<span style="font-size:9px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${esc(t.accent_color)};">${esc(i.cap)}</span>&nbsp;&nbsp;`
        : `<span style="font-weight:700;color:${esc(t.text_color)};">${esc(i.bold)}:</span>&nbsp;`;
    if (mode === "rows") {
      return items
        .map(
          (i) =>
            `<div style="font-family:${font};font-size:12.5px;line-height:21px;color:${esc(t.text_color)};">${label(i)}<a href="${esc(i.h)}" style="${linkCss}${
              style === "bold" ? `color:${esc(t.accent_color)};` : ""
            }">${esc(i.v)}</a></div>`
        )
        .join("");
    }
    return `<div style="${center ? "text-align:center;" : ""}">${items
      .map(
        (i) =>
          `<span style="display:inline-block;white-space:nowrap;margin:0 16px 6px 0;font-family:${font};font-size:12.5px;line-height:18px;">${label(i)}<a href="${esc(
            i.h
          )}" style="${linkCss}">${esc(i.v)}</a></span>`
      )
      .join("")}</div>`;
  }

  // Icon + text are one link, so tapping either opens the call / email / site.
  const chip = (i) => {
    const g = glyph(c, i.g);
    const icon = g ? img(g, i.bold, "display:inline-block;vertical-align:middle;margin-right:8px;") : "";
    const blank = i.g === "globe" || i.g === "pin" ? ` target="_blank"` : "";
    return `<a href="${esc(i.h)}"${blank} style="${linkCss}display:inline-block;white-space:nowrap;font-family:${font};font-size:12.5px;line-height:20px;">${icon}<span style="vertical-align:middle;">${esc(
      i.v
    )}</span></a>`;
  };
  if (mode === "rows") return items.map((i) => `<div style="margin:0 0 7px 0;white-space:nowrap;">${chip(i)}</div>`).join("");
  return `<div style="${center ? "text-align:center;" : ""}">${items
    .map((i) => `<span style="display:inline-block;white-space:nowrap;margin:0 ${center ? 8 : 16}px 8px ${center ? 8 : 0}px;">${chip(i)}</span>`)
    .join("")}</div>`;
}

function visibleSocial(f) {
  return PLATFORMS.map((p) => ({ ...p, ...(f.social[p.id] || {}) })).filter((s) => s.show && s.url);
}

function socialBlock(c, { layout, center = false } = {}) {
  const { f, t, A } = c;
  const items = visibleSocial(f);
  if (!items.length) return "";
  const size = Number(t.icon_size) || 26;
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
    for (let i = 0; i < items.length; i += 3) {
      rows.push(
        `<tr>${[0, 1, 2]
          .map((k) => (items[i + k] ? `<td style="padding:0 ${k === 2 ? 0 : gap}px ${gap}px 0;">${link(items[i + k], i + k)}</td>` : ""))
          .join("")}</tr>`
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
  const r = cta.style === "pill" ? "999px" : `${Number(cta.radius ?? 10)}px`;
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
  return `<table ${TBL} style="border-collapse:separate;display:inline-table;"><tr><td align="center" bgcolor="${esc(conf.bg)}" style="border-radius:${r};border:1.5px solid ${esc(
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
      radius: Number(cta.radius ?? 10),
      accent: t.accent_color,
      accent2: t.accent_color_2,
      bg: matteOf(t),
      font: t.font,
    });
    if (a && !a.failed) {
      return `<a href="${esc(href(cta.url))}" target="_blank" style="text-decoration:none;display:inline-block;">${img(a, cta.label, center ? "margin:0 auto;" : "")}</a>`;
    }
  }
  return ctaHtmlButton(c, cta);
}

function photoBlock(c, sizeOverride) {
  const { f, t, A } = c;
  if (!f.profile_photo_url) return "";
  const size = sizeOverride || Number(f.photo_px) || 96;
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
  const radius = f.photo_shape === "circle" ? "50%" : f.photo_shape === "square" ? "6px" : "22%";
  return `<img src="${esc(f.profile_photo_url)}" width="${size}" height="${size}" alt="${esc(
    f.full_name
  )}" style="display:block;width:${size}px;height:${size}px;object-fit:cover;border-radius:${radius};border:0;" />`;
}

// Social icons + CTA on one line that wraps on small screens.
function actionRow(c, { center = false, mt = 14 } = {}) {
  const social = socialBlock(c, { layout: "row", center });
  const cta = ctaBlock(c, center);
  if (!social && !cta) return "";
  const parts = [];
  if (social) parts.push(`<div style="display:inline-block;vertical-align:middle;margin:0 ${center ? 0 : 18}px 8px 0;">${social}</div>`);
  if (cta) parts.push(`<div style="display:inline-block;vertical-align:middle;margin:0 0 8px 0;">${cta}</div>`);
  if (center) return `<div style="text-align:center;margin-top:${mt}px;">${parts.join("<br />")}</div>`;
  return `<div style="margin-top:${mt}px;">${parts.join("")}</div>`;
}

function accentBar(t, radius) {
  if (!t.accent_bar) return "";
  const r = `${radius}px`;
  return `<tr><td bgcolor="${esc(t.accent_color)}" style="height:4px;line-height:4px;font-size:0;background-color:${esc(
    t.accent_color
  )};background-image:linear-gradient(90deg,${esc(t.accent_color)},${esc(t.accent_color_2 || t.accent_color)});border-radius:${r} ${r} 0 0;">&nbsp;</td></tr>`;
}

function frame(c, inner, pad = "20px 22px", { center = false, maxWidth = 500 } = {}) {
  const { t } = c;
  const al = center ? ` align="center"` : "";
  if (t.border_style === "none") return `<div style="max-width:${maxWidth}px;">${inner}</div>`;
  const R = parseFloat(t.border_radius) || 0;
  const card = (radius, extra = "") =>
    `<table ${TBL} width="100%" bgcolor="${esc(t.surface_color)}" style="border-collapse:separate;border-radius:${radius}px;background-color:${esc(
      t.surface_color
    )};${extra}">${accentBar(t, radius)}<tr><td style="padding:${pad};">${inner}</td></tr></table>`;
  if (t.border_style === "gradient") {
    // Thin gradient border: a gradient cell with a hair of padding around the white card.
    // Whole pixels only (fractional borders render 1px on some sides, 2px on others),
    // and a gradient that stays fully saturated so every edge reads the same weight.
    const bw = Math.max(1, Math.round(Number(t.border_width) || 2));
    const a1 = esc(t.accent_color);
    const a2 = esc(t.accent_color_2 || t.accent_color);
    return `<table ${TBL}${al} bgcolor="${a1}" style="border-collapse:separate;max-width:${maxWidth}px;border-radius:${R}px;background-color:${a1};background-image:linear-gradient(135deg,${a1} 0%,${a2} 50%,${a1} 100%);"><tr><td style="padding:${bw}px;border-radius:${R}px;">${card(Math.max(0, R - bw))}</td></tr></table>`;
  }
  return `<table ${TBL}${al} style="max-width:${maxWidth}px;"><tr><td>${card(R, `border:1px solid ${esc(t.border_color)};`)}</td></tr></table>`;
}

// Header: photo + identity, as two inline-block columns (stack on phones).
function header(c, identity, { gap = 16, size } = {}) {
  const photo = photoBlock(c, size);
  if (!photo) return identity;
  const side = c.f.photo_side || "left";
  const px = size || Number(c.f.photo_px) || 96;
  if (side === "top") return `<div style="margin-bottom:12px;">${photo}</div>${identity}`;
  const p = col(photo, { width: px, gap: side === "left" ? gap : 0, bottom: 6 });
  const id = col(identity, { gap: side === "left" ? 0 : gap, bottom: 6 });
  return `<div>${side === "left" ? p + id : id + p}</div>`;
}

// ---- Templates ------------------------------------------------------------------

// Halo: photo + name header, gradient hairline, contact chips, icons + CTA row.
function tHalo(c) {
  const { t } = c;
  const identity = `${topLogo(c)}${nameRow(c, 19)}${titleLine(c)}${brandLine(c)}`;
  const body = `${header(c, identity)}${hairline(c)}${contacts(c, { mode: "chips" })}${actionRow(c, { mt: 6 })}${footerLogo(c)}`;
  return frame(c, `<div style="font-family:${fontOf(t)};">${body}</div>`);
}

// Split: tall portrait column beside a details column (stacks on phones).
function tSplit(c) {
  const { f, t } = c;
  const details = `${topLogo(c)}${nameRow(c, 19)}${titleLine(c)}${brandLine(c)}${hairline(c, "12px 0 11px 0")}${contacts(c, {
    mode: "rows",
  })}${actionRow(c, { mt: 8 })}${footerLogo(c)}`;
  const size = Number(f.photo_px) || 96;
  const photo = photoBlock(c, Math.max(size, 116));
  let inner;
  if (!photo) inner = details;
  else if (f.photo_side === "top") inner = `<div style="margin-bottom:14px;">${photo}</div>${details}`;
  else {
    const pw = Math.max(size, 116);
    const p = col(photo, { width: pw, gap: f.photo_side === "right" ? 0 : 20, valign: "top", bottom: 10 });
    const d = col(details, { gap: f.photo_side === "right" ? 20 : 0, valign: "top", bottom: 4 });
    inner = f.photo_side === "right" ? d + p : p + d;
  }
  return frame(c, `<div style="font-family:${fontOf(t)};">${inner}</div>`, "20px 22px", { maxWidth: 540 });
}

// Stack: centered card, built mobile-first.
function tStack(c) {
  const { t } = c;
  const photo = photoBlock(c);
  const inner = `<div style="text-align:center;font-family:${fontOf(t)};">${topLogo(c, true)}${
    photo ? `<table ${TBL} align="center" style="margin:0 auto 12px auto;"><tr><td>${photo}</td></tr></table>` : ""
  }${nameRow(c, 20, true)}${titleLine(c)}${brandLine(c, { center: true })}<div style="height:2px;width:36px;line-height:2px;font-size:0;background:${esc(
    t.accent_color
  )};margin:13px auto 13px auto;">&nbsp;</div>${contacts(c, { mode: "chips", center: true })}${actionRow(c, { center: true, mt: 8 })}${footerLogo(
    c,
    true
  )}</div>`;
  return frame(c, inner, "22px 24px", { center: true, maxWidth: 420 });
}

// Minimal: no card; accent rule, compact header, chips, icons + CTA.
function tMinimal(c) {
  const { t } = c;
  const identity = `${topLogo(c)}${nameRow(c, 19)}${titleLine(c)}${brandLine(c, { mt: 6 })}`;
  const body = `${header(c, identity, { gap: 14, size: Math.min(Number(c.f.photo_px) || 96, 80) })}<div style="margin-top:12px;">${contacts(c, {
    mode: "chips",
  })}</div>${actionRow(c, { mt: 4 })}${footerLogo(c)}`;
  return `<table ${TBL} style="max-width:500px;"><tr><td style="border-left:3px solid ${esc(t.accent_color)};padding:2px 0 2px 16px;font-family:${fontOf(
    t
  )};">${body}</td></tr></table>`;
}

// Compact: slim reply signature.
function tCompact(c) {
  const { f, t } = c;
  const font = fontOf(t);
  const role = [f.job_title, f.company_name].filter(Boolean).map(esc).join(" &middot; ");
  const items = contactList(f);
  const line = items.length
    ? `<div style="font-family:${font};font-size:12px;line-height:18px;margin-top:3px;">${items
        .map((i) => `<a href="${esc(i.h)}" style="color:${esc(t.text_color)};text-decoration:none;white-space:nowrap;">${esc(i.v)}</a>`)
        .join(`<span style="color:${esc(t.accent_color)};"> &nbsp;&bull;&nbsp; </span>`)}</div>`
    : "";
  const identity = `${nameRow(c, 15)}${role ? `<div style="font-family:${font};font-size:12px;line-height:17px;color:${esc(mutedOf(t))};">${role}</div>` : ""}${line}${actionRow(
    c,
    { mt: 8 }
  )}`;
  return frame(c, `<div style="font-family:${font};">${header(c, identity, { gap: 14, size: Math.min(Number(f.photo_px) || 96, 64) })}</div>`, "14px 16px");
}

const RENDER = { t5_rail: tHalo, t1_classic: tSplit, t4_centered: tStack, t2_minimal: tMinimal, t3_compact: tCompact };

// ---- Public API -----------------------------------------------------------------

export function generateSignatureHTML({ fields = {}, theme = {}, template_id, assets = null, final = false }) {
  const c = makeCtx(fields, theme, assets, final, {});
  return (RENDER[template_id] || tHalo)(c);
}

export function collectAssetSpecs({ fields = {}, theme = {}, template_id }) {
  const collected = {};
  const c = makeCtx(fields, theme, null, false, collected);
  (RENDER[template_id] || tHalo)(c);
  return collected;
}

export function plainTextSignature(fields) {
  const lines = [fields.full_name, fields.job_title, fields.company_name].filter(Boolean);
  if (fields.phone_show && fields.phone) lines.push(`Phone: ${fields.phone}`);
  if (fields.email_show && fields.email) lines.push(`Email: ${fields.email}`);
  if (fields.website_show && fields.website) lines.push(`Website: ${fields.website}`);
  return lines.join("\n");
}
