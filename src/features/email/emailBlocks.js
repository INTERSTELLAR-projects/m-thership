// @ts-nocheck
// deno-lint-ignore-file
// Email Studio block engine: typed blocks -> email-safe HTML (tables, inline styles, 640px, one mobile query).
// ONE renderer for the in-app preview and the send. This exact file lives twice, byte-identical:
//   src/features/email/emailBlocks.js   (preview; the dev preview cannot import from base44/)
//   base44/shared/emailBlocks.ts        (the email-studio function renders every send with it)
// Edit one, copy it over the other. House rules baked in: no preheader; header is only the orbit icon +
// INTERSTELLAR + orange (R), then "+ EYEBROW · date"; every link and email address is an explicit orange link
// (#ff3c00 on light, #ff6a00 on dark, white bold on the orange band), never blue; brand gradient is
// #ff3c00 -> #ff6a00 -> #ffaa00 (never gold); the model only ever fills block text, never raw HTML.

export const SENDER_NAME = "Justin | Interstellar Strategies";
export const TEST_EMAIL = "justin@interstellar-strategies.com";
export const LOGO = "https://media.base44.com/images/public/6ae18dc255e0da91f0ee6f1b/9226df076_interstellar-email-logo.png";
export const REG = `<sup style="color:#ff3c00;font-size:9px;line-height:0;vertical-align:super;">&reg;</sup>`;
export const LINK_RESET_CSS = "a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important}u + #body a{color:inherit}#MessageViewBody a{color:inherit}";

const F = "font-family:Helvetica,Arial,sans-serif;";
const LINK = { dark: "#ff6a00", light: "#ff3c00", band: "#ffffff" };

/* ---------------- block catalogue ---------------- */

// tone: which band of the email the block sits in. dark = #0f0f0f, light = #f5f3f0, band = orange gradient.
export const BLOCK_TYPES = {
  header: { label: "Header", tone: "dark", hint: "Logo lockup + eyebrow and date (always first)" },
  hero: { label: "Hero title", tone: "dark", hint: "Big \"Title /accent\" heading" },
  intro: { label: "Intro", tone: "dark", hint: "Opening paragraph on the dark header" },
  stats: { label: "Stat strip", tone: "dark", hint: "2-4 numbers with labels (real numbers only)" },
  band: { label: "Short-version band", tone: "band", hint: "Orange gradient summary" },
  section: { label: "Section label", tone: "light", hint: "Orange \"+ LABEL\" with optional line under it" },
  paragraph: { label: "Paragraph", tone: "light", hint: "Body text" },
  cards: { label: "Status cards", tone: "light", hint: "Numbered cards with tags (IN PROGRESS, COMING UP, DONE)" },
  steps: { label: "Steps", tone: "light", hint: "STEP 01 rows (\"What we need from you\")" },
  callout: { label: "Callout", tone: "light", hint: "Dark highlighted note" },
  table: { label: "Table / billing card", tone: "light", hint: "Label / value rows with an optional total" },
  image: { label: "Image", tone: "light", hint: "Full-width image with caption" },
  darkband: { label: "Dark band", tone: "dark", hint: "Big statement band (e.g. the 2027 vision)" },
  button: { label: "Button", tone: "dark", hint: "Orange gradient call to action" },
  signoff: { label: "Sign-off", tone: "dark", hint: "Closing note and signature" },
};
export const BLOCK_ORDER = Object.keys(BLOCK_TYPES);
export const TAG_STYLES = {
  in_progress: { label: "In progress", bg: "#ff3c00", color: "#ffffff" },
  coming_up: { label: "Coming up", bg: "#141414", color: "#ffffff" },
  done: { label: "Done", bg: "#2f2d2b", color: "#ffaa00" },
  needs_you: { label: "Needs you", bg: "#ff6a00", color: "#ffffff" },
  info: { label: "Note", bg: "#141414", color: "#ffffff" },
};

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

// vars === null leaves the tokens visible (template view); otherwise each token gets the value or its fallback.
export function fillMerge(s, vars) {
  const str = String(s ?? "");
  if (!vars) return str;
  return str.replace(TOKEN, (_, k) => {
    const key = k.toLowerCase();
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

// Fields this email uses that the recipient has no value for (first_name falls back to "there", still flagged).
export function missingMerge(doc, vars) {
  return mergeFieldsUsed(doc).filter((k) => !vars || vars[k] === undefined || vars[k] === null || String(vars[k]).trim() === "");
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

/* ---------------- normalise ---------------- */

const clip = (v, n = 1200) => String(v ?? "").trim().slice(0, n);
let seq = 0;
export const newId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function defaultBlock(type) {
  const id = newId();
  switch (type) {
    case "header": return { id, type, eyebrow: "Update", show_date: true };
    case "hero": return { id, type, title: "Big news", accent: "for {{business}}" };
    case "intro": return { id, type, text: "{{first_name}}, here is what you need to know." };
    case "stats": return { id, type, items: [{ value: "", label: "" }, { value: "", label: "", accent: true }, { value: "", label: "" }] };
    case "band": return { id, type, label: "The short version", text: "" };
    case "section": return { id, type, title: "What's inside", text: "" };
    case "paragraph": return { id, type, text: "" };
    case "cards": return { id, type, items: [{ tag: "In progress", tag_style: "in_progress", title: "", text: "" }] };
    case "steps": return { id, type, items: [{ title: "", text: "", foot: "" }] };
    case "callout": return { id, type, title: "", text: "" };
    case "table": return { id, type, title: "", rows: [{ label: "", value: "" }], total_label: "", total_value: "" };
    case "image": return { id, type, url: "", alt: "", caption: "", link: "" };
    case "darkband": return { id, type, eyebrow: "Looking ahead", title: "", accent: "", text: "" };
    case "button": return { id, type, label: "Log in to your portal", url: "{{portal_url}}" };
    case "signoff": return { id, type, text: "Questions? Reply to this email and it comes straight to me.", name: "Justin Cowell, Interstellar Strategies" };
    default: return { id, type: "paragraph", text: "" };
  }
}

// Any loose block-ish object (from the model, a template or an old draft) -> a typed block, or null.
export function normalizeBlock(b) {
  if (!b || typeof b !== "object" || !BLOCK_TYPES[b.type]) return null;
  const id = clip(b.id, 40) || newId();
  const items = Array.isArray(b.items) ? b.items : [];
  switch (b.type) {
    case "header": return { id, type: "header", eyebrow: clip(b.eyebrow || b.label || b.title, 60) || "Update", show_date: b.show_date !== false };
    case "hero": return { id, type: "hero", title: clip(b.title, 80), accent: clip(b.accent, 60) };
    case "intro": case "paragraph": return { id, type: b.type, text: clip(b.text, 3000) };
    case "stats": return { id, type: "stats", items: items.slice(0, 4).map((x) => ({ value: clip(x && x.value, 16), label: clip(x && x.label, 40), accent: !!(x && x.accent) })).filter((x) => x.value || x.label) };
    case "band": return { id, type: "band", label: clip(b.label, 40) || "The short version", text: clip(b.text, 600) };
    case "section": return { id, type: "section", title: clip(b.title || b.label, 60), text: clip(b.text, 600) };
    case "cards": return { id, type: "cards", items: items.slice(0, 12).map((x) => ({ tag: clip(x && x.tag, 24), tag_style: TAG_STYLES[x && x.tag_style] ? x.tag_style : "info", title: clip(x && x.title, 120), text: clip(x && x.text, 1200) })).filter((x) => x.title || x.text) };
    case "steps": return { id, type: "steps", items: items.slice(0, 10).map((x) => ({ title: clip(x && x.title, 120), text: clip(x && x.text, 800), foot: clip(x && x.foot, 40) })).filter((x) => x.title || x.text) };
    case "callout": return { id, type: "callout", title: clip(b.title, 120), text: clip(b.text, 1500) };
    case "table": return { id, type: "table", title: clip(b.title, 80), rows: (Array.isArray(b.rows) ? b.rows : items).slice(0, 20).map((r) => ({ label: clip(r && r.label, 120), value: clip(r && r.value, 60) })).filter((r) => r.label || r.value), total_label: clip(b.total_label, 60), total_value: clip(b.total_value, 40) };
    case "image": return { id, type: "image", url: clip(b.url, 600), alt: clip(b.alt, 160), caption: clip(b.caption, 300), link: clip(b.link, 600) };
    case "darkband": return { id, type: "darkband", eyebrow: clip(b.eyebrow, 40), title: clip(b.title, 80), accent: clip(b.accent, 60), text: clip(b.text, 1200) };
    case "button": return { id, type: "button", label: clip(b.label, 50) || "Learn more", url: clip(b.url, 600) };
    case "signoff": return { id, type: "signoff", text: clip(b.text, 1200), name: clip(b.name, 80) || "Justin Cowell, Interstellar Strategies" };
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

const pad = (top, bottom = 0) => `padding:${top}px 40px ${bottom}px;`;

function eyebrowLight(t) {
  return `<div style="${F}font-size:13px;font-weight:700;letter-spacing:1.5px;color:#ff3c00;text-transform:uppercase;">+&nbsp; ${t}</div>`;
}

export function headerRows(eyebrow) {
  return `<tr><td height="6" bgcolor="#ff3c00" style="height:6px;line-height:6px;font-size:0;background-color:#ff3c00;background-image:linear-gradient(90deg,#ff3c00,#ff6a00 55%,#ffaa00);">&nbsp;</td></tr>
      <tr><td class="px" style="padding:26px 40px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="middle" width="48" style="width:48px;"><img src="${LOGO}" width="40" height="31" alt="Interstellar" style="display:block;border:0;"></td>
          <td valign="middle" style="${F}font-size:15px;font-weight:700;letter-spacing:2px;color:#ffffff;">INTERSTELLAR${REG}</td>
        </tr></table>
      </td></tr>
      <tr><td class="px" style="padding:44px 40px 0;${F}font-size:13px;font-weight:700;letter-spacing:1.5px;color:#9a9893;text-transform:uppercase;"><span style="color:#ff3c00;">+</span>&nbsp; ${eyebrow}</td></tr>`;
}

function stat(item, width, last) {
  return `<td class="stack" width="${width}%" valign="top" style="padding:16px 14px;${last ? "" : "border-right:1px solid #2a2a2a;"}${F}">
              <div style="font-size:34px;line-height:38px;font-weight:700;color:${item.accent ? "#ff3c00" : "#ffffff"};letter-spacing:-1px;">${esc(item.value)}</div>
              <div style="padding-top:6px;font-size:12px;font-weight:700;letter-spacing:1.2px;color:#9a9893;text-transform:uppercase;">${esc(item.label)}</div>
            </td>`;
}

const two = (n) => String(n).padStart(2, "0");

// One block -> table rows. `first` = first block in its band (gets the band's top padding).
function renderBlock(b, ctx, first) {
  const v = ctx.vars;
  const t = (s) => esc(fillMerge(s, v));
  switch (b.type) {
    case "header": {
      const label = t(b.eyebrow || "Update");
      return headerRows(b.show_date === false ? label : `${label} &nbsp;&middot;&nbsp; ${esc(ctx.date)}`);
    }
    case "hero":
      return `<tr><td class="px h1" style="${pad(first ? 40 : 14)}${F}font-size:48px;line-height:50px;font-weight:700;letter-spacing:-1.5px;color:#ffffff;">${t(b.title)}${b.accent ? ` <span style="color:#ff3c00;">/${t(b.accent)}</span>` : ""}</td></tr>`;
    case "intro":
      return `<tr><td class="px" style="${pad(first ? 40 : 20)}${F}font-size:17px;line-height:27px;color:#d6d4cf;">${rich(b.text, "dark", v)}</td></tr>`;
    case "stats": {
      const items = (b.items || []).filter((x) => x.value || x.label);
      if (!items.length) return "";
      const w = Math.floor(100 / items.length);
      return `<tr><td class="px" style="${pad(first ? 40 : 28)}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #2a2a2a;"><tr>${items.map((x, i) => stat({ ...x, value: fillMerge(x.value, v), label: fillMerge(x.label, v) }, w, i === items.length - 1)).join("")}
        </tr></table>
      </td></tr>`;
    }
    case "band":
      return `<tr><td class="px" style="padding:30px 40px 32px;${F}">
    <div style="font-size:12px;font-weight:700;letter-spacing:1.8px;color:#ffffff;text-transform:uppercase;">&#9733;&nbsp; ${t(b.label || "The short version")}</div>
    <div style="padding-top:10px;font-size:24px;line-height:32px;font-weight:700;letter-spacing:-0.4px;color:#ffffff;">${rich(b.text, "band", v)}</div>
  </td></tr>`;
    case "section":
      return `<tr><td class="px" style="${pad(first ? 40 : 26, 14)}">${eyebrowLight(t(b.title))}${b.text ? `
        <div style="padding-top:8px;${F}font-size:15px;line-height:23px;color:#4a4744;">${rich(b.text, "light", v)}</div>` : ""}</td></tr>`;
    case "paragraph":
      return `<tr><td class="px" style="${pad(first ? 40 : 0, 16)}${F}font-size:15px;line-height:24px;color:#4a4744;">${rich(b.text, "light", v)}</td></tr>`;
    case "cards":
      return (b.items || []).map((x, i) => {
        const tag = TAG_STYLES[x.tag_style] || TAG_STYLES.info;
        const label = x.tag || tag.label;
        return `
      <tr><td class="px" style="${pad(first && i === 0 ? 40 : 0, 14)}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid #e0ddd8;border-left:5px solid #ff3c00;">
          <tr><td style="padding:20px 22px;${F}">
            <span style="font-size:22px;font-weight:700;color:#ff3c00;letter-spacing:-0.5px;">${two(i + 1)}</span>&nbsp;&nbsp;<span style="display:inline-block;vertical-align:4px;padding:4px 8px;background-color:${tag.bg};color:${tag.color};font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">${t(label)}</span>
            ${x.title ? `<div style="padding-top:10px;font-size:18px;line-height:24px;font-weight:700;color:#141414;">${t(x.title)}</div>` : ""}
            ${x.text ? `<div style="padding-top:6px;font-size:15px;line-height:23px;color:#4a4744;">${rich(x.text, "light", v)}</div>` : ""}
          </td></tr>
        </table>
      </td></tr>`;
      }).join("");
    case "steps":
      return (b.items || []).map((x, i) => `
      <tr><td class="px" style="${pad(first && i === 0 ? 40 : 0, 12)}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0ddd8;">
          <tr>
            <td class="steplbl" width="120" valign="top" bgcolor="#1a1a1a" style="width:120px;background-color:#1a1a1a;padding:18px 16px;font-family:'Courier New',monospace;font-size:13px;font-weight:700;letter-spacing:1.5px;color:#ff6a00;">STEP ${two(i + 1)}</td>
            <td valign="top" bgcolor="#ffffff" style="background-color:#ffffff;padding:16px 18px;${F}">
              ${x.title ? `<div style="font-size:16px;font-weight:700;color:#141414;">${t(x.title)}</div>` : ""}
              ${x.text ? `<div style="padding-top:4px;font-size:14px;line-height:21px;color:#4a4744;">${rich(x.text, "light", v)}</div>` : ""}
              ${x.foot ? `<div style="padding-top:8px;font-size:11px;font-weight:700;letter-spacing:1.4px;color:#ff3c00;text-transform:uppercase;">${t(x.foot)}</div>` : ""}
            </td>
          </tr>
        </table>
      </td></tr>`).join("");
    case "callout":
      return `<tr><td class="px" style="${pad(first ? 40 : 4, 16)}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#141414" style="background-color:#141414;border-left:5px solid #ff3c00;">
          <tr><td style="padding:20px 22px;${F}">
            ${b.title ? `<div style="font-size:17px;line-height:23px;font-weight:700;color:#ffffff;">${t(b.title)}</div>` : ""}
            ${b.text ? `<div style="padding-top:${b.title ? 6 : 0}px;font-size:15px;line-height:23px;color:#d6d4cf;">${rich(b.text, "dark", v)}</div>` : ""}
          </td></tr>
        </table>
      </td></tr>`;
    case "table": {
      const rows = (b.rows || []).map((r) => `
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #ece9e4;${F}font-size:15px;line-height:21px;color:#4a4744;">${rich(r.label, "light", v)}</td>
              <td align="right" style="padding:12px 0 12px 12px;border-bottom:1px solid #ece9e4;${F}font-size:15px;font-weight:700;color:#141414;white-space:nowrap;">${t(r.value)}</td>
            </tr>`).join("");
      const total = b.total_label || b.total_value ? `
            <tr>
              <td style="padding:14px 0 0;${F}font-size:12px;font-weight:700;letter-spacing:1.4px;color:#141414;text-transform:uppercase;">${t(b.total_label || "Total")}</td>
              <td align="right" style="padding:14px 0 0 12px;${F}font-size:22px;font-weight:700;color:#ff3c00;white-space:nowrap;">${t(b.total_value)}</td>
            </tr>` : "";
      return `<tr><td class="px" style="${pad(first ? 40 : 4, 16)}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid #e0ddd8;border-top:4px solid #ff3c00;">
          <tr><td style="padding:20px 22px 22px;">
            ${b.title ? `<div style="${F}font-size:12px;font-weight:700;letter-spacing:1.5px;color:#9a9893;text-transform:uppercase;padding-bottom:4px;">${t(b.title)}</div>` : ""}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}${total}
            </table>
          </td></tr>
        </table>
      </td></tr>`;
    }
    case "image": {
      const src = safeUrl(fillMerge(b.url, v));
      if (!src || src.startsWith("mailto:")) return "";
      const img = `<img src="${esc(src)}" width="560" alt="${t(b.alt)}" style="display:block;width:100%;max-width:560px;height:auto;border:0;">`;
      const href = safeUrl(fillMerge(b.link, v));
      return `<tr><td class="px" style="${pad(first ? 40 : 4, 16)}">${href ? `<a href="${esc(href)}" target="_blank" style="text-decoration:none;">${img}</a>` : img}${b.caption ? `
        <div style="padding-top:8px;${F}font-size:12px;line-height:18px;color:#7a7773;">${rich(b.caption, "light", v)}</div>` : ""}</td></tr>`;
    }
    case "darkband":
      return `<tr><td class="px" style="${pad(first ? 40 : 20)}">
        ${b.eyebrow ? `<div style="${F}font-size:13px;font-weight:700;letter-spacing:1.5px;color:#9a9893;text-transform:uppercase;"><span style="color:#ff3c00;">+</span>&nbsp; ${t(b.eyebrow)}</div>` : ""}
        ${b.title || b.accent ? `<div class="h2" style="padding-top:12px;${F}font-size:34px;line-height:38px;font-weight:700;letter-spacing:-1px;color:#ffffff;">${t(b.title)}${b.accent ? ` <span style="color:#ff3c00;">/${t(b.accent)}</span>` : ""}</div>` : ""}
        ${b.text ? `<div style="padding-top:14px;${F}font-size:16px;line-height:25px;color:#d6d4cf;">${rich(b.text, "dark", v)}</div>` : ""}
      </td></tr>`;
    case "button": {
      const href = safeUrl(fillMerge(b.url, v)) || "#";
      return `<tr><td class="px" style="${pad(first ? 34 : 22)}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="#ff3c00" style="background-color:#ff3c00;background-image:linear-gradient(90deg,#ff3c00,#ff6a00);">
            <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:16px 28px;${F}font-size:14px;font-weight:700;letter-spacing:1.5px;color:#ffffff;text-decoration:none;text-transform:uppercase;">${t(b.label || "Learn more")} &nbsp;&rarr;</a>
          </td>
        </tr></table>
      </td></tr>`;
    }
    case "signoff":
      return `<tr><td class="px" style="${pad(first ? 34 : 22)}${F}">
        ${b.text ? `<div style="font-size:14px;line-height:22px;color:#bdbab5;">${rich(b.text, "dark", v)}</div>` : ""}
        <div style="padding-top:${b.text ? 16 : 0}px;font-size:14px;line-height:22px;color:#bdbab5;">&mdash; ${t(b.name || "Justin Cowell, Interstellar Strategies")}</div>
      </td></tr>`;
    default:
      return "";
  }
}

const BAND_BG = {
  dark: `bgcolor="#0f0f0f" style="background-color:#0f0f0f;"`,
  light: `bgcolor="#f5f3f0" style="background-color:#f5f3f0;"`,
  band: `bgcolor="#ff3c00" style="background-color:#ff3c00;background-image:linear-gradient(110deg,#ff3c00,#ff5a00 60%,#ff7a00);"`,
};
const BAND_BOTTOM = { dark: 36, light: 26, band: 0 };

// doc = { subject, blocks }. opts.vars = merge values (null keeps {{tokens}} visible), opts.unsubscribeUrl adds the
// unsubscribe line (mass / subscriber sends only), opts.date overrides the header date.
export function renderEmail(doc, opts = {}) {
  const vars = opts.vars === undefined ? null : opts.vars;
  const date = opts.date || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
  const blocks = normalizeBlocks(doc && doc.blocks);
  const subject = fillMerge(doc && doc.subject, vars);
  const ctx = { vars, date };

  // Group consecutive blocks of the same tone into one band.
  const bands = [];
  blocks.forEach((b) => {
    const tone = BLOCK_TYPES[b.type].tone;
    const cur = bands[bands.length - 1];
    if (cur && cur.tone === tone && tone !== "band") cur.blocks.push(b);
    else bands.push({ tone, blocks: [b] });
  });
  // The footer (tagline, unsubscribe, bottom bar) closes the last dark band, or a dark band of its own.
  if (!bands.length || bands[bands.length - 1].tone !== "dark") bands.push({ tone: "dark", blocks: [], footerOnly: true });
  const footBand = bands[bands.length - 1];

  const unsub = opts.unsubscribeUrl
    ? `<div style="padding-top:12px;font-size:11px;line-height:17px;color:#6f6c68;">You're getting this because you're on the Interstellar Strategies list. ${linkHtml(esc(opts.unsubscribeUrl), "Unsubscribe", "#ff6a00", true)} anytime with one click.</div>`
    : "";
  const footer = `<tr><td class="px" style="padding:${footBand.footerOnly ? 30 : 22}px 40px 30px;${F}">
        <div style="font-size:11px;font-weight:700;letter-spacing:1.6px;color:#6f6c68;text-transform:uppercase;">Interstellar Strategies &nbsp;&middot;&nbsp; The Future of Business</div>${unsub}
      </td></tr>`;

  const body = bands.map((band, bi) => {
    const rows = band.blocks.map((b, i) => renderBlock(b, ctx, i === 0 && !(b.type === "header"))).join("\n");
    const isLast = bi === bands.length - 1;
    const bottom = isLast ? "" : BAND_BOTTOM[band.tone] ? `<tr><td style="padding:0 0 ${BAND_BOTTOM[band.tone]}px;font-size:0;line-height:0;">&nbsp;</td></tr>` : "";
    return `  <tr><td ${BAND_BG[band.tone]}>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${rows}
${bottom}${isLast ? footer : ""}
    </table>
  </td></tr>`;
  }).join("\n\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title>
<style>${LINK_RESET_CSS}@media (max-width:620px){.wrap{width:100%!important}.px{padding-left:22px!important;padding-right:22px!important}.h1{font-size:36px!important;line-height:40px!important}.h2{font-size:28px!important;line-height:32px!important}.stack{display:block!important;width:auto!important;border-right:0!important;border-bottom:1px solid #2a2a2a!important}.steplbl{width:84px!important;padding:16px 10px!important;font-size:11px!important}}</style></head>
<body id="body" style="margin:0;padding:0;background:#ebe8e4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ebe8e4" style="background-color:#ebe8e4;">
<tr><td align="center" style="padding:24px 10px 40px;">
<table role="presentation" class="wrap" width="640" cellpadding="0" cellspacing="0" border="0" style="width:640px;max-width:640px;">

${body}
  <tr><td height="6" bgcolor="#ffaa00" style="height:6px;line-height:6px;font-size:0;background-color:#ffaa00;background-image:linear-gradient(90deg,#ffaa00,#ff6a00,#ff3c00);">&nbsp;</td></tr>

</table>
</td></tr>
</table>
</body></html>`;
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
          eyebrow: { type: "string", description: "header / darkband: short uppercase label, e.g. CLIENT UPDATE" },
          title: { type: "string", description: "hero/darkband/section/callout/table title" },
          accent: { type: "string", description: "hero/darkband: the orange part after the slash, 1-3 words" },
          text: { type: "string", description: "Body text. Plain text; **bold** and [label](https://url) allowed." },
          label: { type: "string", description: "band label (default 'The short version') or button label" },
          url: { type: "string", description: "button / image URL. Only URLs given in the brief, or {{portal_url}} / {{website}}." },
          name: { type: "string", description: "signoff name line" },
          total_label: { type: "string" },
          total_value: { type: "string" },
          items: {
            type: "array",
            description: "stats: {value,label,accent}; cards: {tag,tag_style,title,text}; steps: {title,text,foot}",
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
              },
            },
          },
          rows: { type: "array", description: "table rows", items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" } } } },
        },
        required: ["type"],
      },
    },
    notes: { type: "array", items: { type: "string" }, description: "Facts you needed but did not have (left as [brackets] in the copy)." },
  },
  required: ["subject", "blocks"],
};
