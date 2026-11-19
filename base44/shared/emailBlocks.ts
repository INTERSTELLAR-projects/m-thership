// @ts-nocheck
// deno-lint-ignore-file
// Email Studio block engine: typed blocks -> email-safe HTML (tables, inline styles, 600px, one mobile query).
// ONE renderer for the in-app preview and the send. This exact file lives twice, byte-identical:
//   src/features/email/emailBlocks.js   (preview; the dev preview cannot import from base44/)
//   base44/shared/emailBlocks.ts        (the email-studio function renders every send with it)
// Edit one, copy it over the other.
// Design: "Interstellar · Mission brief" (approved Nov 18 2026, the Seacoast follow-up): warm stone canvas with the
// grain tile, a 600px card, a dark grain header band (orbit mark + INTERSTELLAR + orange ™, date, "+ KICKER",
// headline with an orange second line), mono "+ 01 · LABEL" section kickers, white hairline cards, dark grain
// inset bands, square gradient button, signature, dark footer strip.
// House rules baked in: no preheader; every link has an explicit colour (orange, or ink on the signature), never
// blue; brand gradient is #ff3c00 -> #ff6a00 -> #ffaa00 (top bar deep->light, bottom bar light->deep, never gold);
// the model only ever fills block text, never raw HTML.

export const SENDER_NAME = "Interstellar Strategies";
export const TEST_EMAIL = "justin@interstellar-strategies.com";
const MEDIA = "https://media.base44.com/images/public/6ae18dc255e0da91f0ee6f1b/";
export const LOGO = `${MEDIA}fa925697b_interstellar-mark-email.png`;
export const ASSETS = {
  tileLight: `${MEDIA}e72d1fa9a_em-tile-light2.png`,
  tileDark: `${MEDIA}a0e14d023_em-tile-dark2.png`,
  play: `${MEDIA}c832b1c5b_em-icon-play.png`,
  deck: `${MEDIA}4181794ed_em-icon-deck.png`,
  doc: `${MEDIA}deaf696cd_em-icon-doc.png`,
  shield: `${MEDIA}71042f0fa_em-icon-shield.png`,
};
export const REG = `<span style="font-size:10px;vertical-align:top;color:#ff6a00;">&trade;</span>`;
export const LINK_RESET_CSS = "a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important}u + #body a{color:inherit}#MessageViewBody a{color:inherit}";

const F = "font-family:Helvetica,Arial,sans-serif;";
const M = "font-family:'Courier New',Courier,monospace;";
const INK = "#1a1a1a";
const HAIR = "#cfccc7";
const ROW = "#e3e0dc";
const MUTED = "#626060";
const GRAD = "background-image:linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00);";
const LINK = { dark: "#ff6a00", light: "#ff3c00", band: "#ffffff" };
const DARK_BG = `bgcolor="#1a1a1a" background="${ASSETS.tileDark}"`;
const DARK_CSS = `background:#1a1a1a url('${ASSETS.tileDark}') repeat;`;

/* ---------------- block catalogue ---------------- */

// tone: where the block sits. dark = the header band (or a dark inset), light = the stone card body, band = orange.
export const BLOCK_TYPES = {
  header: { label: "Header", tone: "dark", hint: "Logo lockup, date and the \"+ KICKER\" line (always first)" },
  hero: { label: "Headline", tone: "dark", hint: "Big headline with an orange second line" },
  intro: { label: "Intro", tone: "dark", hint: "Short line under the headline on the dark header" },
  stats: { label: "Stat strip", tone: "dark", hint: "2-4 numbers with labels (real numbers only)" },
  band: { label: "Short-version band", tone: "band", hint: "Orange gradient summary" },
  section: { label: "Section kicker", tone: "light", hint: "Numbered \"+ 01 · LABEL\" kicker with an optional line under it" },
  paragraph: { label: "Paragraph", tone: "light", hint: "Body text (greeting, closing copy)" },
  videos: { label: "Video cards", tone: "light", hint: "0-3 videos: thumbnail, title, blurb, link" },
  links: { label: "Read links", tone: "light", hint: "Proposal / summary rows with an OPEN link" },
  checklist: { label: "Offer rows", tone: "light", hint: "\"+ What you get\" rows: bold name, then the line" },
  offer: { label: "Investment band", tone: "dark", hint: "Dark band of label / value rows (first highlighted)" },
  guarantee: { label: "Guarantee", tone: "light", hint: "Orange-outlined guarantee block with the shield" },
  cards: { label: "Status cards", tone: "light", hint: "Cards with tags (IN PROGRESS, COMING UP, DONE)" },
  steps: { label: "Steps", tone: "light", hint: "STEP 01 rows (\"What we need from you\")" },
  callout: { label: "Callout", tone: "light", hint: "Dark highlighted note" },
  table: { label: "Table / billing card", tone: "light", hint: "Label / value rows with an optional total" },
  image: { label: "Image", tone: "light", hint: "Full-width image with caption" },
  darkband: { label: "Dark band", tone: "dark", hint: "Big statement band (e.g. the 2027 vision)" },
  button: { label: "Button", tone: "light", hint: "Orange gradient call to action" },
  signoff: { label: "Sign-off", tone: "light", hint: "Closing note and a name line" },
  signature: { label: "Signature", tone: "light", hint: "Justin's signature: name, role, site, email, P.S." },
};
export const BLOCK_ORDER = Object.keys(BLOCK_TYPES);
export const TAG_STYLES = {
  in_progress: { label: "In progress", bg: "#ff3c00", color: "#ffffff" },
  coming_up: { label: "Coming up", bg: "#1a1a1a", color: "#ffffff" },
  done: { label: "Done", bg: "#2f2d2b", color: "#ffaa00" },
  needs_you: { label: "Needs you", bg: "#ff6a00", color: "#ffffff" },
  info: { label: "Note", bg: "#1a1a1a", color: "#ffffff" },
};
export const LINK_ICONS = { deck: "Deck", doc: "Document", play: "Video", link: "Link" };

/* ---------------- merge fields ---------------- */

export const MERGE_FIELDS = [
  { key: "first_name", label: "First name", fallback: "there" },
  { key: "contact_name", label: "Contact name", fallback: "" },
  { key: "business", label: "Business", fallback: "" },
  { key: "email", label: "Email", fallback: "" },
  { key: "website", label: "Website", fallback: "" },
  { key: "portal_url", label: "Portal URL", fallback: "https://interstellar-mothership.com" },
  { key: "plan", label: "Plan", fallback: "" },
];
const FALLBACK = Object.fromEntries(MERGE_FIELDS.map((m) => [m.key, m.fallback]));
const TOKEN = /\{\{\s*([a-z_]+)\s*\}\}/gi;
export const isMergeKey = (k) => Object.prototype.hasOwnProperty.call(FALLBACK, String(k).toLowerCase());

// vars === null leaves the tokens visible (template view); otherwise each recipient token gets the value or its
// fallback. Template tokens that are not recipient fields ({{headline}}, {{intro}}…) are content you fill in: they
// stay visible so the preview shows them and the send warnings catch them.
export function fillMerge(s, vars) {
  const str = String(s ?? "");
  if (!vars) return str;
  return str.replace(TOKEN, (all, k) => {
    const key = k.toLowerCase();
    if (!isMergeKey(key)) return all;
    const v = vars[key];
    return v !== undefined && v !== null && String(v).trim() !== "" ? String(v) : FALLBACK[key] ?? "";
  });
}

// Every merge token used anywhere in the email (subject + all block text).
export function mergeFieldsUsed(doc) {
  const found = new Set();
  const walk = (v) => {
    if (typeof v === "string") { for (const m of v.matchAll(TOKEN)) found.add(m[1].toLowerCase()); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(doc && doc.subject);
  walk(doc && doc.blocks);
  return [...found];
}

// Recipient fields this email uses that the recipient has no value for (first_name falls back to "there", still flagged).
export function missingMerge(doc, vars) {
  return mergeFieldsUsed(doc).filter(isMergeKey).filter((k) => !vars || vars[k] === undefined || vars[k] === null || String(vars[k]).trim() === "");
}

// Template content tokens still in the email ({{headline}}, {{intro}}…): must be written before sending.
export function contentTokensLeft(doc) {
  return mergeFieldsUsed(doc).filter((k) => !isMergeKey(k));
}

/* ---------------- text ---------------- */

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function linkHtml(href, label, color, bold = true) {
  return `<a href="${href}" target="_blank" style="color:${color};text-decoration:underline;${bold ? "font-weight:700;" : ""}"><span style="color:${color};text-decoration:underline;">${label}</span></a>`;
}
export function mailLink(addr, color = "#ff6a00") {
  const a = esc(addr);
  return linkHtml(`mailto:${a}`, a, color);
}

const safeUrl = (u) => {
  const s = String(u || "").trim();
  if (/^(https?:\/\/|mailto:)/i.test(s)) return s;
  if (/^www\./i.test(s)) return `https://${s}`;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s)) return `https://${s}`;
  return "";
};

// Plain text -> safe HTML: merge fields, escaping, [label](url) links, bare emails/URLs as orange links,
// **bold**, line breaks. Nothing the model writes is ever used as HTML.
const LINKISH = /\[([^\]\n]+)\]\(([^)\s]+)\)|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]'"])/g;
export function rich(text, tone, vars) {
  const color = LINK[tone] || LINK.light;
  const src = fillMerge(text, vars);
  let out = "";
  let last = 0;
  for (const m of src.matchAll(LINKISH)) {
    out += esc(src.slice(last, m.index));
    if (m[1]) {
      const href = safeUrl(m[2]) || (/@/.test(m[2]) ? `mailto:${m[2].replace(/^mailto:/i, "")}` : "");
      out += href ? linkHtml(esc(href), esc(m[1]), color) : esc(m[0]);
    } else if (m[3]) out += mailLink(m[3], color);
    else if (m[4]) out += linkHtml(esc(safeUrl(m[4])), esc(m[4]), color);
    last = m.index + m[0].length;
  }
  out += esc(src.slice(last));
  return out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/\r?\n/g, "<br>");
}

// Paragraph text: blank lines start a new <p>.
function paras(text, tone, vars, style) {
  const parts = String(text ?? "").split(/\r?\n\s*\r?\n/).filter((p) => p.trim());
  return parts.map((p, i) => `<p style="margin:0 0 ${i === parts.length - 1 ? 0 : 16}px;${style || ""}">${rich(p, tone, vars)}</p>`).join("");
}

/* ---------------- normalise ---------------- */

const clip = (v, n = 1200) => String(v ?? "").trim().slice(0, n);
let seq = 0;
export const newId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function defaultBlock(type) {
  const id = newId();
  switch (type) {
    case "header": return { id, type, eyebrow: "Update", show_date: true };
    case "hero": return { id, type, title: "Big news", accent: "for {{business}}" };
    case "intro": return { id, type, text: "Everything you need to know, in one place." };
    case "stats": return { id, type, items: [{ value: "", label: "" }, { value: "", label: "", accent: true }, { value: "", label: "" }] };
    case "band": return { id, type, label: "The short version", text: "" };
    case "section": return { id, type, title: "Watch", text: "" };
    case "paragraph": return { id, type, text: "" };
    case "videos": return { id, type, items: [{ thumb: "", title: "", text: "", url: "" }] };
    case "links": return { id, type, items: [{ icon: "deck", title: "", text: "", url: "", cta: "Open" }] };
    case "checklist": return { id, type, items: [{ title: "", text: "" }] };
    case "offer": return { id, type, eyebrow: "Investment", rows: [{ label: "", value: "", accent: true }] };
    case "guarantee": return { id, type, label: "Our guarantee", title: "", text: "" };
    case "cards": return { id, type, items: [{ tag: "In progress", tag_style: "in_progress", title: "", text: "" }] };
    case "steps": return { id, type, items: [{ title: "", text: "", foot: "" }] };
    case "callout": return { id, type, title: "", text: "" };
    case "table": return { id, type, title: "", rows: [{ label: "", value: "" }], total_label: "", total_value: "" };
    case "image": return { id, type, url: "", alt: "", caption: "", link: "" };
    case "darkband": return { id, type, eyebrow: "Looking ahead", title: "", accent: "", text: "" };
    case "button": return { id, type, label: "Log in to your portal", url: "{{portal_url}}" };
    case "signoff": return { id, type, text: "Questions? Reply to this email and it comes straight to our team.", name: "The Interstellar Strategies team" };
    case "signature": return { id, type, ...SIGNATURE };
    default: return { id, type: "paragraph", text: "" };
  }
}

export const SIGNATURE = {
  name: "Justin Cowell",
  role: "Founder, Interstellar Strategies™",
  website: "interstellar-strategies.com",
  email: "justin@interstellar-strategies.com",
  ps: "P.S. Know a business that could use this? Our Prestige referral pays $500 for every one that signs.",
};

// Any loose block-ish object (from the model, a template or an old draft) -> a typed block, or null.
export function normalizeBlock(b) {
  if (!b || typeof b !== "object" || !BLOCK_TYPES[b.type]) return null;
  const id = clip(b.id, 40) || newId();
  const items = Array.isArray(b.items) ? b.items : [];
  const rowsOf = () => (Array.isArray(b.rows) ? b.rows : items);
  switch (b.type) {
    case "header": return { id, type: "header", eyebrow: clip(b.eyebrow || b.label || b.title, 60) || "Update", show_date: b.show_date !== false };
    case "hero": return { id, type: "hero", title: clip(b.title, 80), accent: clip(b.accent, 60) };
    case "intro": case "paragraph": return { id, type: b.type, text: clip(b.text, 3000) };
    case "stats": return { id, type: "stats", items: items.slice(0, 4).map((x) => ({ value: clip(x && x.value, 16), label: clip(x && x.label, 40), accent: !!(x && x.accent) })).filter((x) => x.value || x.label) };
    case "band": return { id, type: "band", label: clip(b.label, 40) || "The short version", text: clip(b.text, 600) };
    case "section": return { id, type: "section", title: clip(b.title || b.label, 60), text: clip(b.text, 600) };
    case "videos": return { id, type: "videos", items: items.slice(0, 3).map((x) => ({ thumb: clip(x && x.thumb, 600), title: clip(x && x.title, 120), text: clip(x && x.text, 400), url: clip(x && x.url, 600) })).filter((x) => x.title || x.url || x.thumb) };
    case "links": return { id, type: "links", items: items.slice(0, 6).map((x) => ({ icon: LINK_ICONS[x && x.icon] ? x.icon : "doc", title: clip(x && x.title, 120), text: clip(x && x.text, 400), url: clip(x && x.url, 600), cta: clip(x && x.cta, 16) || "Open" })).filter((x) => x.title || x.url) };
    case "checklist": return { id, type: "checklist", items: items.slice(0, 12).map((x) => ({ title: clip(x && x.title, 160), text: clip(x && x.text, 400) })).filter((x) => x.title || x.text) };
    case "offer": return { id, type: "offer", eyebrow: clip(b.eyebrow, 40) || "Investment", rows: rowsOf().slice(0, 10).map((r, i) => ({ label: clip(r && r.label, 80), value: clip(r && r.value, 80), accent: r && r.accent !== undefined ? !!r.accent : i === 0 })).filter((r) => r.label || r.value) };
    case "guarantee": return { id, type: "guarantee", label: clip(b.label, 40) || "Our guarantee", title: clip(b.title, 300), text: clip(b.text, 1500) };
    case "cards": return { id, type: "cards", items: items.slice(0, 12).map((x) => ({ tag: clip(x && x.tag, 24), tag_style: TAG_STYLES[x && x.tag_style] ? x.tag_style : "info", title: clip(x && x.title, 120), text: clip(x && x.text, 1200) })).filter((x) => x.title || x.text) };
    case "steps": return { id, type: "steps", items: items.slice(0, 10).map((x) => ({ title: clip(x && x.title, 120), text: clip(x && x.text, 800), foot: clip(x && x.foot, 40) })).filter((x) => x.title || x.text) };
    case "callout": return { id, type: "callout", title: clip(b.title, 120), text: clip(b.text, 1500) };
    case "table": return { id, type: "table", title: clip(b.title, 80), rows: rowsOf().slice(0, 20).map((r) => ({ label: clip(r && r.label, 120), value: clip(r && r.value, 60) })).filter((r) => r.label || r.value), total_label: clip(b.total_label, 60), total_value: clip(b.total_value, 40) };
    case "image": return { id, type: "image", url: clip(b.url, 600), alt: clip(b.alt, 160), caption: clip(b.caption, 300), link: clip(b.link, 600) };
    case "darkband": return { id, type: "darkband", eyebrow: clip(b.eyebrow, 40), title: clip(b.title, 80), accent: clip(b.accent, 60), text: clip(b.text, 1200) };
    case "button": return { id, type: "button", label: clip(b.label, 50) || "Learn more", url: clip(b.url, 600) };
    case "signoff": return { id, type: "signoff", text: clip(b.text, 1200), name: clip(b.name, 80) || "The Interstellar Strategies team" };
    case "signature": return { id, type: "signature", name: clip(b.name, 80) || SIGNATURE.name, role: clip(b.role, 120), website: clip(b.website, 200), email: clip(b.email, 120), ps: clip(b.ps, 400) };
    default: return null;
  }
}

// Header first (exactly one), unknown blocks dropped.
export function normalizeBlocks(blocks) {
  const list = (Array.isArray(blocks) ? blocks : []).map(normalizeBlock).filter(Boolean);
  const header = list.find((b) => b.type === "header") || defaultBlock("header");
  return [header, ...list.filter((b) => b.type !== "header")];
}

/* ---------------- render ---------------- */

const two = (n) => String(n).padStart(2, "0");
const plus = `<span style="color:#ff3c00;font-weight:bold;">+</span>&nbsp; `;
const row = (top, bottom, inner, extra = "") => `<tr><td class="px" style="padding:${top}px 40px ${bottom}px;${extra}">${inner}</td></tr>`;
const rule = (h = 3, cols = 1) => `<tr><td${cols > 1 ? ` colspan="${cols}"` : ""} style="height:${h}px;line-height:${h}px;font-size:0;background:#ff3c00;${GRAD}">&nbsp;</td></tr>`;

function stat(item, width, last) {
  return `<td class="stack" width="${width}%" valign="top" style="padding:14px 16px;${last ? "" : "border-right:1px solid #2c2c2c;"}${F}">
              <div style="font-size:28px;line-height:32px;font-weight:bold;letter-spacing:-1px;color:${item.accent ? "#ff6a00" : "#f5f3f0"};">${esc(item.value)}</div>
              <div style="padding-top:6px;${M}font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.55);text-transform:uppercase;">${esc(item.label)}</div>
            </td>`;
}
function statsTable(b, v) {
  const items = (b.items || []).filter((x) => x.value || x.label);
  if (!items.length) return "";
  const w = Math.floor(100 / items.length);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #2c2c2c;"><tr>${items.map((x, i) => stat({ ...x, value: fillMerge(x.value, v), label: fillMerge(x.label, v) }, w, i === items.length - 1)).join("")}</tr></table>`;
}

// Co-brand: "×" + the client's current website logo (round, thin border). Only when a logo is on file; otherwise the
// header stays Interstellar's lockup alone.
function clientMark(ctx) {
  const src = safeUrl(ctx.clientLogo || "");
  if (!src || !/^https:\/\//i.test(src)) return "";
  const alt = esc(ctx.clientName || "Client logo");
  return `
        <td style="vertical-align:middle;padding:0 14px;${F}font-size:18px;color:#6b6b6b;">&times;</td>
        <td style="vertical-align:middle;"><img src="${esc(src)}" width="40" height="40" alt="${alt}" style="display:block;width:40px;height:40px;border:1px solid #444444;border-radius:50%;object-fit:cover;"></td>`;
}

// The dark header band: lockup + date, kicker, headline (orange second line), intro, stats.
function headerBand(blocks, ctx) {
  const v = ctx.vars;
  const t = (s) => esc(fillMerge(s, v));
  const head = blocks[0];
  const hero = blocks.find((b) => b.type === "hero");
  const parts = [];
  parts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="vertical-align:middle;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;padding-right:12px;"><img src="${LOGO}" width="40" alt="Interstellar Strategies" style="display:block;width:40px;height:auto;border:0;"></td>
        <td style="vertical-align:middle;${F}font-size:18px;letter-spacing:-0.5px;font-weight:bold;color:#f5f3f0;">INTERSTELLAR${REG}</td>${clientMark(ctx)}
      </tr></table>
    </td>
    ${head.show_date === false ? "" : `<td align="right" style="vertical-align:middle;${M}font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.55);">${esc(String(ctx.date).toUpperCase())}</td>`}
  </tr></table>`);
  parts.push(`<div style="${M}font-size:12px;letter-spacing:2px;color:#ff6a00;margin-top:34px;text-transform:uppercase;">${plus}${t(head.eyebrow || "Update")}</div>`);
  if (hero && (hero.title || hero.accent)) {
    parts.push(`<div class="h1" style="${F}font-size:34px;line-height:38px;font-weight:bold;letter-spacing:-1.2px;color:#f5f3f0;margin-top:12px;">${t(hero.title)}${hero.accent ? `${hero.title ? "<br>" : ""}<span style="color:#ff6a00;">${t(hero.accent)}</span>` : ""}</div>`);
  }
  blocks.slice(1).forEach((b) => {
    if (b.type === "intro" && b.text) parts.push(`<div style="${F}font-size:15px;line-height:24px;color:rgba(255,255,255,0.72);margin-top:14px;">${rich(b.text, "dark", v)}</div>`);
    if (b.type === "stats") { const s = statsTable(b, v); if (s) parts.push(`<div style="margin-top:22px;">${s}</div>`); }
  });
  return `<tr><td class="px" ${DARK_BG} style="${DARK_CSS}padding:30px 40px 34px;">
  ${parts.join("\n  ")}
</td></tr>`;
}

function darkInset(inner, cols = 1) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ${DARK_BG} style="${DARK_CSS}">
    ${rule(3, cols)}
    ${inner}
  </table>`;
}

function whiteBox(inner, extra = "") {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${HAIR};background:#ffffff;${extra}">${inner}</table>`;
}

function iconCell(src, top = 14, borderTop = false) {
  return `<td width="44" style="padding:${top}px 0 ${top}px 16px;vertical-align:middle;${borderTop ? `border-top:1px solid ${ROW};` : ""}"><img src="${src}" width="28" height="28" alt="" style="display:block;border:0;"></td>`;
}

// One body block -> table rows. `first` = first block under the header band (gets the extra top padding).
function renderBlock(b, ctx, first) {
  const v = ctx.vars;
  const t = (s) => esc(fillMerge(s, v));
  const top = (n) => (first ? Math.max(n, 34) : n);
  switch (b.type) {
    case "hero":
      return b.title || b.accent ? row(top(18), 8, `<div class="h1" style="${F}font-size:30px;line-height:34px;font-weight:bold;letter-spacing:-1px;color:${INK};">${t(b.title)}${b.accent ? `${b.title ? "<br>" : ""}<span style="color:#ff3c00;">${t(b.accent)}</span>` : ""}</div>`) : "";
    case "intro":
    case "paragraph":
      return b.text ? row(top(0), 16, paras(b.text, "light", v), `${F}font-size:15px;line-height:25px;color:${INK};`) : "";
    case "section": {
      ctx.section += 1;
      const label = `<div style="${M}font-size:11px;letter-spacing:2px;color:${MUTED};text-transform:uppercase;">${plus}${two(ctx.section)} &middot; ${t(b.title)}</div>`;
      const sub = b.text ? `<div style="padding-top:10px;${F}font-size:15px;line-height:25px;color:${INK};">${rich(b.text, "light", v)}</div>` : "";
      return row(top(26), 12, label + sub);
    }
    case "videos":
      return (b.items || []).map((x, i, all) => {
        const href = safeUrl(fillMerge(x.url, v));
        const thumb = safeUrl(fillMerge(x.thumb, v));
        const alt = `Watch: ${esc(fillMerge(x.title, v))}`;
        const img = thumb
          ? `<img src="${esc(thumb)}" width="520" alt="${alt}" style="display:block;width:100%;max-width:520px;height:auto;border:1px solid ${HAIR};">`
          : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ${DARK_BG} style="${DARK_CSS}border:1px solid ${HAIR};"><tr><td align="center" height="200" style="height:200px;vertical-align:middle;"><img src="${ASSETS.play}" width="44" height="44" alt="${alt}" style="display:inline-block;border:0;"></td></tr></table>`;
        const cta = href ? `<a href="${esc(href)}" target="_blank" style="color:#ff3c00;text-decoration:none;font-weight:bold;">WATCH &rarr;</a>` : `<span style="color:#ff3c00;font-weight:bold;">WATCH &rarr;</span>`;
        return row(i === 0 ? top(0) : 0, i === all.length - 1 ? 8 : 18, `${href ? `<a href="${esc(href)}" target="_blank" style="text-decoration:none;display:block;color:${INK};">${img}</a>` : img}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${HAIR};border-top:0;background:#ffffff;"><tr>
    ${iconCell(ASSETS.play)}
    <td style="padding:14px 12px;vertical-align:middle;${F}font-size:15px;line-height:20px;color:${INK};"><strong>${t(x.title)}</strong>${x.text ? `<br><span style="font-size:13px;color:${MUTED};">${rich(x.text, "light", v)}</span>` : ""}</td>
    <td align="right" style="padding:14px 16px;vertical-align:middle;white-space:nowrap;${M}font-size:12px;letter-spacing:1px;">${cta}</td>
  </tr></table>`);
      }).join("\n");
    case "links": {
      const rows = (b.items || []).map((x, i) => {
        const href = safeUrl(fillMerge(x.url, v));
        const bt = i > 0 ? `border-top:1px solid ${ROW};` : "";
        const label = `${t(String(x.cta || "Open").toUpperCase())} &rarr;`;
        return `<tr>
      ${iconCell(ASSETS[x.icon === "deck" ? "deck" : x.icon === "play" ? "play" : "doc"], 16, i > 0)}
      <td style="padding:16px 12px;vertical-align:middle;${bt}${F}font-size:15px;line-height:20px;color:${INK};"><strong>${t(x.title)}</strong>${x.text ? `<br><span style="font-size:13px;color:${MUTED};">${rich(x.text, "light", v)}</span>` : ""}</td>
      <td align="right" style="padding:16px;vertical-align:middle;${bt}white-space:nowrap;${M}font-size:12px;letter-spacing:1px;">${href ? `<a href="${esc(href)}" target="_blank" style="color:#ff3c00;text-decoration:none;font-weight:bold;">${label}</a>` : `<span style="color:#ff3c00;font-weight:bold;">${label}</span>`}</td>
    </tr>`;
      }).join("");
      return rows ? row(top(0), 8, whiteBox(rows)) : "";
    }
    case "checklist": {
      const rows = (b.items || []).map((x, i) => `<tr><td style="padding:12px 16px;${i > 0 ? `border-top:1px solid ${ROW};` : ""}${F}font-size:14px;line-height:21px;color:${INK};">${plus}${x.title ? `<strong>${t(x.title)}</strong>` : ""}${x.title && x.text ? " " : ""}${x.text ? rich(x.text, "light", v) : ""}</td></tr>`).join("");
      return rows ? row(top(0), 8, whiteBox(rows)) : "";
    }
    case "offer": {
      const rows = (b.rows || []).map((r, i, all) => {
        const last = i === all.length - 1;
        const pad = `padding:10px 20px${last ? " 18px" : ""};border-top:1px solid #2c2c2c;`;
        return `<tr class="stack">
      <td style="${pad}${F}font-size:14px;color:rgba(255,255,255,0.6);">${t(r.label)}</td>
      <td align="right" style="${pad}${F}${r.accent ? "font-size:22px;font-weight:bold;letter-spacing:-0.5px;color:#ff6a00;" : "font-size:14px;color:#f5f3f0;"}">${t(r.value)}</td>
    </tr>`;
      }).join("");
      return row(top(24), 8, darkInset(`<tr><td colspan="2" style="padding:18px 20px 8px;${M}font-size:11px;letter-spacing:2px;color:#ff6a00;text-transform:uppercase;">${plus}${t(b.eyebrow || "Investment")}</td></tr>${rows}`, 2));
    }
    case "guarantee":
      return row(top(16), 8, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #ff3c00;background:#fff4ee;">
    <tr>
      <td width="52" style="padding:18px 0 18px 18px;vertical-align:top;"><img src="${ASSETS.shield}" width="32" height="32" alt="" style="display:block;border:0;"></td>
      <td style="padding:18px 20px 18px 14px;${F}font-size:14px;line-height:23px;color:${INK};">
        <div style="${M}font-size:11px;letter-spacing:2px;color:#bf2d00;margin-bottom:6px;text-transform:uppercase;">${t(b.label || "Our guarantee")}</div>
        ${b.title ? `<strong>${t(b.title)}</strong>` : ""}${b.title && b.text ? " " : ""}${b.text ? rich(b.text, "light", v) : ""}
      </td>
    </tr>
  </table>`);
    case "band":
      return row(top(16), 8, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ff3c00" style="background:#ff3c00;${GRAD}"><tr><td style="padding:20px 22px;${F}">
    <div style="${M}font-size:11px;letter-spacing:2px;color:#ffffff;text-transform:uppercase;">+&nbsp; ${t(b.label || "The short version")}</div>
    <div style="padding-top:8px;font-size:20px;line-height:27px;font-weight:bold;letter-spacing:-0.4px;color:#ffffff;">${rich(b.text, "band", v)}</div>
  </td></tr></table>`);
    case "stats": {
      const s = statsTable(b, v);
      return s ? row(top(16), 8, darkInset(`<tr><td style="padding:16px;">${s}</td></tr>`)) : "";
    }
    case "cards":
      return (b.items || []).map((x, i, all) => {
        const tag = TAG_STYLES[x.tag_style] || TAG_STYLES.info;
        const label = x.tag || tag.label;
        return row(i === 0 ? top(0) : 0, i === all.length - 1 ? 8 : 10, whiteBox(`<tr><td style="padding:16px 18px;${F}">
      <span style="${M}font-size:12px;font-weight:bold;color:#ff3c00;">${two(i + 1)}</span>&nbsp;&nbsp;<span style="display:inline-block;padding:3px 7px;background:${tag.bg};color:${tag.color};${M}font-size:10px;letter-spacing:1.5px;text-transform:uppercase;">${t(label)}</span>
      ${x.title ? `<div style="padding-top:10px;font-size:15px;line-height:21px;font-weight:bold;color:${INK};">${t(x.title)}</div>` : ""}
      ${x.text ? `<div style="padding-top:4px;font-size:13px;line-height:20px;color:${MUTED};">${rich(x.text, "light", v)}</div>` : ""}
    </td></tr>`));
      }).join("\n");
    case "steps":
      return (b.items || []).map((x, i, all) => row(i === 0 ? top(0) : 0, i === all.length - 1 ? 8 : 10, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${HAIR};"><tr>
      <td class="steplbl" width="96" valign="top" ${DARK_BG} style="width:96px;${DARK_CSS}padding:16px 14px;${M}font-size:11px;letter-spacing:2px;color:#ff6a00;">STEP ${two(i + 1)}</td>
      <td valign="top" style="background:#ffffff;padding:14px 16px;${F}">
        ${x.title ? `<div style="font-size:15px;font-weight:bold;color:${INK};">${t(x.title)}</div>` : ""}
        ${x.text ? `<div style="padding-top:4px;font-size:13px;line-height:20px;color:${MUTED};">${rich(x.text, "light", v)}</div>` : ""}
        ${x.foot ? `<div style="padding-top:8px;${M}font-size:10px;letter-spacing:1.5px;color:#ff3c00;text-transform:uppercase;">${t(x.foot)}</div>` : ""}
      </td>
    </tr></table>`)).join("\n");
    case "callout":
      return row(top(16), 8, darkInset(`<tr><td style="padding:18px 20px;${F}">
      ${b.title ? `<div style="font-size:16px;line-height:22px;font-weight:bold;color:#f5f3f0;">${t(b.title)}</div>` : ""}
      ${b.text ? `<div style="padding-top:${b.title ? 6 : 0}px;font-size:14px;line-height:22px;color:rgba(255,255,255,0.72);">${rich(b.text, "dark", v)}</div>` : ""}
    </td></tr>`));
    case "table": {
      const rows = (b.rows || []).map((r, i) => `<tr>
        <td style="padding:12px 16px;${i > 0 || b.title ? `border-top:1px solid ${ROW};` : ""}${F}font-size:14px;line-height:21px;color:${INK};">${rich(r.label, "light", v)}</td>
        <td align="right" style="padding:12px 16px;${i > 0 || b.title ? `border-top:1px solid ${ROW};` : ""}${F}font-size:14px;font-weight:bold;color:${INK};white-space:nowrap;">${t(r.value)}</td>
      </tr>`).join("");
      const head = b.title ? `<tr><td colspan="2" style="padding:12px 16px;${M}font-size:11px;letter-spacing:2px;color:${MUTED};text-transform:uppercase;">${t(b.title)}</td></tr>` : "";
      const total = b.total_label || b.total_value ? `<tr>
        <td style="padding:14px 16px;border-top:1px solid ${HAIR};${M}font-size:11px;letter-spacing:2px;color:${INK};text-transform:uppercase;">${t(b.total_label || "Total")}</td>
        <td align="right" style="padding:14px 16px;border-top:1px solid ${HAIR};${F}font-size:22px;font-weight:bold;letter-spacing:-0.5px;color:#ff3c00;white-space:nowrap;">${t(b.total_value)}</td>
      </tr>` : "";
      return row(top(0), 8, whiteBox(head + rows + total));
    }
    case "image": {
      const src = safeUrl(fillMerge(b.url, v));
      if (!src || src.startsWith("mailto:")) return "";
      const img = `<img src="${esc(src)}" width="520" alt="${t(b.alt)}" style="display:block;width:100%;max-width:520px;height:auto;border:1px solid ${HAIR};">`;
      const href = safeUrl(fillMerge(b.link, v));
      return row(top(8), 12, `${href ? `<a href="${esc(href)}" target="_blank" style="text-decoration:none;color:${INK};">${img}</a>` : img}${b.caption ? `
        <div style="padding-top:8px;${F}font-size:12px;line-height:18px;color:#8a8784;">${rich(b.caption, "light", v)}</div>` : ""}`);
    }
    case "darkband":
      return row(top(16), 8, darkInset(`<tr><td style="padding:20px 22px 22px;${F}">
      ${b.eyebrow ? `<div style="${M}font-size:11px;letter-spacing:2px;color:#ff6a00;text-transform:uppercase;">${plus}${t(b.eyebrow)}</div>` : ""}
      ${b.title || b.accent ? `<div class="h2" style="padding-top:10px;font-size:26px;line-height:30px;font-weight:bold;letter-spacing:-0.8px;color:#f5f3f0;">${t(b.title)}${b.accent ? ` <span style="color:#ff6a00;">${t(b.accent)}</span>` : ""}</div>` : ""}
      ${b.text ? `<div style="padding-top:10px;font-size:14px;line-height:22px;color:rgba(255,255,255,0.72);">${rich(b.text, "dark", v)}</div>` : ""}
    </td></tr>`));
    case "button": {
      const href = safeUrl(fillMerge(b.url, v)) || "#";
      return row(top(18), 30, `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td bgcolor="#ff3c00" style="background:#ff3c00;background-image:linear-gradient(90deg,#ff3c00,#ff6a00);box-shadow:0 8px 20px -10px rgba(255,60,0,0.9);">
      <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:14px 24px;${F}font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">${t(b.label || "Learn more")} &nbsp;&rarr;</a>
    </td>
  </tr></table>`);
    }
    case "signoff":
      return row(top(8), 24, `${b.text ? paras(b.text, "light", v) : ""}<div style="padding-top:${b.text ? 14 : 0}px;color:${MUTED};">&mdash; ${t(b.name || "The Interstellar Strategies team")}</div>`, `${F}font-size:15px;line-height:25px;color:${INK};`);
    case "signature": {
      const site = String(fillMerge(b.website, v)).trim();
      const siteHref = safeUrl(site);
      const mail = String(fillMerge(b.email, v)).trim();
      const links = [
        siteHref ? `<a href="${esc(siteHref)}" target="_blank" style="color:${INK};text-decoration:underline;">${esc(site.replace(/^https?:\/\//i, ""))}</a>` : "",
        /@/.test(mail) ? `<a href="mailto:${esc(mail)}" style="color:${INK};text-decoration:underline;">${esc(mail)}</a>` : "",
      ].filter(Boolean).join(" &middot; ");
      return row(top(0), 30, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${HAIR};"><tr>
    <td style="padding-top:18px;${F}font-size:14px;line-height:22px;color:${INK};">
      <strong>${t(b.name)}</strong>${b.role ? `<br><span style="color:${MUTED};">${t(b.role)}</span>` : ""}${links ? `<br>${links}` : ""}
      ${b.ps ? `<div style="margin-top:14px;font-size:12px;line-height:18px;color:#8a8784;">${rich(b.ps, "light", v)}</div>` : ""}
    </td>
  </tr></table>`);
    }
    default:
      return "";
  }
}

// The header band takes the header plus any headline / intro / stats blocks that directly follow it.
const HEAD_TYPES = new Set(["hero", "intro", "stats"]);

// doc = { subject, blocks }. opts.vars = merge values (null keeps {{tokens}} visible), opts.unsubscribeUrl adds the
// unsubscribe line (mass / subscriber sends only), opts.date overrides the header date, opts.clientLogo (+ clientName)
// adds the client's logo to the header lockup.
export function renderEmail(doc, opts = {}) {
  const vars = opts.vars === undefined ? null : opts.vars;
  const date = opts.date || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
  const blocks = normalizeBlocks(doc && doc.blocks);
  const subject = fillMerge(doc && doc.subject, vars);
  const ctx = { vars, date, section: 0, clientLogo: opts.clientLogo || "", clientName: opts.clientName || "" };

  let split = 1;
  const seen = new Set();
  while (split < blocks.length && HEAD_TYPES.has(blocks[split].type) && !seen.has(blocks[split].type)) { seen.add(blocks[split].type); split++; }
  const head = headerBand(blocks.slice(0, split), ctx);
  const body = blocks.slice(split).map((b, i) => renderBlock(b, ctx, i === 0)).filter(Boolean).join("\n\n");

  const unsub = opts.unsubscribeUrl
    ? `<div style="padding-top:10px;${F}font-size:11px;line-height:17px;letter-spacing:0;color:rgba(255,255,255,0.55);">You're getting this because you're on the Interstellar Strategies list. ${linkHtml(esc(opts.unsubscribeUrl), "Unsubscribe", "#ff6a00", true)} anytime with one click.</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
<style>${LINK_RESET_CSS}@media only screen and (max-width:620px){.wrap{width:100%!important}.px{padding-left:22px!important;padding-right:22px!important}.h1{font-size:28px!important;line-height:32px!important}.h2{font-size:22px!important;line-height:26px!important}.stack td{display:block!important;width:100%!important;text-align:left!important}td.stack{display:block!important;width:auto!important;border-right:0!important;border-bottom:1px solid #2c2c2c!important}.steplbl{width:72px!important;padding:14px 10px!important;font-size:10px!important}}a{color:inherit}</style>
</head>
<body id="body" style="margin:0;padding:0;background:#ebe8e4;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ebe8e4" background="${ASSETS.tileLight}" style="background:#ebe8e4 url('${ASSETS.tileLight}') repeat;">
<tr><td align="center" style="padding:32px 12px;">

<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;border:1px solid ${HAIR};background:#f4f2f0;">

<tr><td style="height:4px;line-height:4px;font-size:0;background:#ff3c00;background-image:linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00);">&nbsp;</td></tr>

${head}

${body}

<tr><td class="px" ${DARK_BG} style="${DARK_CSS}padding:16px 40px;${M}font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.55);">INTERSTELLAR&trade; &middot; THE FUTURE OF BUSINESS${unsub}</td></tr>

<tr><td style="height:4px;line-height:4px;font-size:0;background:#ffaa00;background-image:linear-gradient(90deg,#ffaa00,#ff6a00,#ff3c00);">&nbsp;</td></tr>
</table>

</td></tr>
</table>
</body>
</html>`;
}

export function renderSubject(doc, vars) {
  return fillMerge(doc && doc.subject, vars === undefined ? null : vars).replace(/\s+/g, " ").trim();
}

/* ---------------- AI output schema (blocks only, never HTML) ---------------- */

export const AI_EMAIL_SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string", description: "Subject line. No emojis. May use {{first_name}} / {{business}}." },
    blocks: {
      type: "array",
      description: "Ordered email blocks. Start with header, then hero. Plain text only in every field (no HTML).",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: BLOCK_ORDER },
          eyebrow: { type: "string", description: "header / darkband / offer: short label, e.g. CLIENT UPDATE" },
          title: { type: "string", description: "hero/darkband/section/callout/table/guarantee title (guarantee: the bold promise)" },
          accent: { type: "string", description: "hero/darkband: the orange part (hero: the second line), 1-4 words" },
          text: { type: "string", description: "Body text. Plain text; **bold** and [label](https://url) allowed." },
          label: { type: "string", description: "band label (default 'The short version'), guarantee label or button label" },
          url: { type: "string", description: "button / image URL. Only URLs given in the brief, or {{portal_url}} / {{website}}." },
          name: { type: "string", description: "signoff / signature name line" },
          role: { type: "string", description: "signature: role line" },
          website: { type: "string", description: "signature: website" },
          email: { type: "string", description: "signature: email address" },
          ps: { type: "string", description: "signature: P.S. line" },
          total_label: { type: "string" },
          total_value: { type: "string" },
          items: {
            type: "array",
            description: "stats: {value,label,accent}; cards: {tag,tag_style,title,text}; steps: {title,text,foot}; videos: {thumb,title,text,url}; links: {icon,title,text,url,cta}; checklist: {title,text}",
            items: {
              type: "object",
              properties: {
                value: { type: "string" },
                label: { type: "string" },
                accent: { type: "boolean" },
                tag: { type: "string" },
                tag_style: { type: "string", enum: Object.keys(TAG_STYLES) },
                title: { type: "string" },
                text: { type: "string" },
                foot: { type: "string" },
                thumb: { type: "string", description: "videos: thumbnail image URL (only URLs given in the brief)" },
                url: { type: "string", description: "videos / links: the link (only URLs given in the brief)" },
                icon: { type: "string", enum: Object.keys(LINK_ICONS) },
                cta: { type: "string", description: "links: OPEN / READ / WATCH" },
              },
            },
          },
          rows: { type: "array", description: "table / offer rows", items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" }, accent: { type: "boolean" } } } },
        },
        required: ["type"],
      },
    },
    notes: { type: "array", items: { type: "string" }, description: "Facts you needed but did not have (left as [brackets] in the copy)." },
  },
  required: ["subject", "blocks"],
};
