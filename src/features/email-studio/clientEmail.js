// @ts-nocheck
// Client Email Studio renderer: typed blocks + the client's brand -> email-safe HTML (tables, inline styles, 600px).
// ONE renderer for the portal preview and the send. This exact file lives twice, byte-identical:
//   src/features/email-studio/clientEmail.js   (portal preview)
//   base44/shared/clientEmail.ts               (email-client / email-bulk render every send with it)
// Edit one, copy it over the other (tests/unit/emailCore.test.js fails if they drift).
// Rules: the AI only ever fills block text, never raw HTML. Every email gets the CAN-SPAM footer (business name,
// mailing address, why they get it, one-click unsubscribe via {{unsubscribe_url}}). No preheader.

export const CLIENT_BLOCKS = {
  heading: { label: "Heading", hint: "Big headline" },
  text: { label: "Text", hint: "Paragraphs. **bold** and [link text](https://...) work" },
  button: { label: "Button", hint: "Call to action" },
  image: { label: "Image", hint: "Full-width image (https link)" },
  callout: { label: "Highlight box", hint: "Offer or key note in your brand color" },
  columns: { label: "2-3 columns", hint: "Short side-by-side points" },
  quote: { label: "Quote", hint: "A real customer quote (never invented)" },
  divider: { label: "Divider", hint: "Thin line" },
};

let seq = 0;
export const blockId = () => `k${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function defaultClientBlock(type) {
  const id = blockId();
  if (type === "heading") return { id, type, text: "Your headline here" };
  if (type === "text") return { id, type, text: "Hi {{first_name}},\n\nWrite your message here." };
  if (type === "button") return { id, type, label: "Book now", url: "" };
  if (type === "image") return { id, type, url: "", alt: "", link: "" };
  if (type === "callout") return { id, type, title: "This month only", text: "Describe the offer." };
  if (type === "columns") return { id, type, items: [{ title: "First", text: "Short point" }, { title: "Second", text: "Short point" }] };
  if (type === "quote") return { id, type, text: "", cite: "" };
  return { id, type: "divider" };
}

const str = (v, max = 4000) => String(v ?? "").slice(0, max);
const url = (v) => { const s = String(v ?? "").trim(); return /^(https?:\/\/|mailto:|tel:|\{\{)/i.test(s) ? s.slice(0, 2000) : ""; };

export function normalizeClientBlocks(blocks) {
  return (Array.isArray(blocks) ? blocks : []).slice(0, 40).filter((b) => b && CLIENT_BLOCKS[b.type]).map((b) => {
    const id = /^[a-z0-9]{3,40}$/i.test(String(b.id || "")) ? String(b.id) : blockId();
    if (b.type === "heading") return { id, type: b.type, text: str(b.text, 200) };
    if (b.type === "text") return { id, type: b.type, text: str(b.text, 6000) };
    if (b.type === "button") return { id, type: b.type, label: str(b.label, 60), url: url(b.url) };
    if (b.type === "image") return { id, type: b.type, url: url(b.url), alt: str(b.alt, 200), link: url(b.link) };
    if (b.type === "callout") return { id, type: b.type, title: str(b.title, 120), text: str(b.text, 1200) };
    if (b.type === "columns") return { id, type: b.type, items: (Array.isArray(b.items) ? b.items : []).slice(0, 3).map((i) => ({ title: str(i?.title, 80), text: str(i?.text, 400) })) };
    if (b.type === "quote") return { id, type: b.type, text: str(b.text, 600), cite: str(b.cite, 120) };
    return { id, type: "divider" };
  });
}

/* ---------------- color helpers (contrast checks against the brand) ---------------- */

export const isHex = (c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(c || "").trim());
const full = (c) => { const h = String(c).trim().replace("#", ""); return h.length === 3 ? h.split("").map((x) => x + x).join("") : h; };
export function luminance(c) {
  const h = full(c);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
export const onColor = (bg) => (contrast(bg, "#ffffff") >= contrast(bg, "#111111") ? "#ffffff" : "#111111");
// Darken a color until it reaches `min` contrast on `against` (links / headings on white must stay readable).
export function readable(c, against = "#ffffff", min = 4.5) {
  if (!isHex(c)) return "#111111";
  let h = full(c);
  for (let i = 0; i < 20 && contrast(`#${h}`, against) < min; i++) {
    h = [0, 2, 4].map((k) => Math.max(0, Math.round(parseInt(h.slice(k, k + 2), 16) * 0.85)).toString(16).padStart(2, "0")).join("");
  }
  return `#${h}`;
}

// Brand kit (BrandKit.kit) + overrides -> email theme. Never invents colors: falls back to neutral ink.
export function themeFrom({ business, logo_url, kit, overrides, address, footer_note, reason } = {}) {
  const pal = Array.isArray(kit?.palette) ? kit.palette.filter((p) => isHex(p?.hex)) : [];
  const byRole = (re) => pal.find((p) => re.test(`${p.role || ""} ${p.name || ""}`))?.hex;
  const o = overrides || {};
  const primary = isHex(o.primary) ? o.primary : byRole(/primary/i) || pal[0]?.hex || "#111111";
  const accent = isHex(o.accent) ? o.accent : byRole(/accent|highlight|secondary/i) || primary;
  const text = isHex(o.text) ? o.text : (() => { const t = byRole(/\btext\b|\bink\b|type/i); return t && contrast(t, "#ffffff") >= 7 ? t : "#1a1a1a"; })();
  const background = isHex(o.background) ? o.background : "#f4f4f2";
  const fontName = String(o.font || kit?.typography?.primary || "").split(/[\d(]/)[0].replace(/[^A-Za-z ]/g, "").trim().slice(0, 40);
  return {
    business: str(business, 120) || "Our business", logo_url: url(o.logo_url || logo_url), primary, accent, text, background,
    font: `${fontName ? `'${fontName}', ` : ""}Helvetica, Arial, sans-serif`,
    address: str(address, 300), footer_note: str(footer_note, 300), reason: str(reason, 200),
  };
}

/* ---------------- render ---------------- */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// **bold**, [label](url), line breaks; merge tags pass through untouched (filled per recipient at send time).
function inline(t, link) {
  let s = esc(t);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:|\{\{)[^)\s]+)\)/g, (_, l, u) => `<a href="${u}" style="color:${link};font-weight:700;text-decoration:underline">${l}</a>`);
  return s.replace(/\n/g, "<br>");
}
const paras = (t, link, style) => String(t || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p style="margin:0 0 16px;${style}">${inline(p, link)}</p>`).join("");

function block(b, th) {
  const link = readable(th.primary);
  const body = `font-family:${th.font};font-size:16px;line-height:26px;color:${th.text};`;
  const pad = (inner, extra = "") => `<tr><td style="padding:0 40px;${extra}" class="px">${inner}</td></tr>`;
  if (b.type === "heading") return pad(`<h1 style="margin:8px 0 16px;font-family:${th.font};font-size:30px;line-height:36px;letter-spacing:-0.5px;font-weight:800;color:${readable(th.text)}">${inline(b.text, link)}</h1>`);
  if (b.type === "text") return pad(paras(b.text, link, body));
  if (b.type === "button") {
    if (!b.label) return "";
    const bg = th.primary;
    return pad(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px"><tr><td style="background:${bg};border-radius:6px"><a href="${esc(b.url || "#")}" style="display:inline-block;padding:14px 26px;font-family:${th.font};font-size:15px;font-weight:700;color:${onColor(bg)};text-decoration:none;border-radius:6px">${esc(b.label)}</a></td></tr></table>`);
  }
  if (b.type === "image") {
    if (!b.url) return "";
    const img = `<img src="${esc(b.url)}" alt="${esc(b.alt)}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:6px">`;
    return pad(`<div style="margin:0 0 24px">${b.link ? `<a href="${esc(b.link)}">${img}</a>` : img}</div>`);
  }
  if (b.type === "callout") {
    const bg = th.primary;
    const fg = onColor(bg);
    return pad(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px"><tr><td style="background:${bg};border-radius:8px;padding:22px 24px">${b.title ? `<p style="margin:0 0 6px;font-family:${th.font};font-size:19px;line-height:25px;font-weight:800;color:${fg}">${esc(b.title)}</p>` : ""}<p style="margin:0;font-family:${th.font};font-size:15px;line-height:23px;color:${fg}">${inline(b.text, fg)}</p></td></tr></table>`);
  }
  if (b.type === "columns") {
    const items = (b.items || []).filter((i) => i.title || i.text);
    if (!items.length) return "";
    const w = Math.floor(100 / items.length);
    const cells = items.map((i) => `<td class="col" valign="top" width="${w}%" style="padding:0 8px 16px 0"><p style="margin:0 0 4px;font-family:${th.font};font-size:16px;font-weight:800;color:${readable(th.accent)}">${esc(i.title)}</p><p style="margin:0;font-family:${th.font};font-size:14px;line-height:21px;color:${th.text}">${inline(i.text, link)}</p></td>`).join("");
    return pad(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px"><tr>${cells}</tr></table>`);
  }
  if (b.type === "quote") {
    if (!b.text) return "";
    return pad(`<div style="margin:0 0 24px;border-left:4px solid ${th.accent};padding:4px 0 4px 18px"><p style="margin:0;font-family:${th.font};font-size:18px;line-height:27px;font-style:italic;color:${th.text}">&ldquo;${esc(b.text)}&rdquo;</p>${b.cite ? `<p style="margin:8px 0 0;font-family:${th.font};font-size:13px;color:#6b6b6b">${esc(b.cite)}</p>` : ""}</div>`);
  }
  return pad(`<div style="height:1px;background:#e4e2de;margin:8px 0 24px;line-height:1px;font-size:1px">&nbsp;</div>`);
}

// doc = { subject, blocks }, theme from themeFrom(). Returns full HTML with merge tags left in for the send.
export function renderClientEmail(doc, th) {
  const t = th || themeFrom({});
  const blocks = normalizeClientBlocks(doc?.blocks);
  const head = t.logo_url
    ? `<img src="${esc(t.logo_url)}" alt="${esc(t.business)}" height="44" style="display:block;height:44px;width:auto;max-width:220px;border:0">`
    : `<span style="font-family:${t.font};font-size:20px;font-weight:800;letter-spacing:-0.3px;color:${readable(t.text)}">${esc(t.business)}</span>`;
  const link = "#6b6b6b";
  const foot = [
    `<strong style="color:#4a4a4a">${esc(t.business)}</strong>`,
    t.address ? esc(t.address) : "",
    esc(t.reason || `You're getting this email because you're on the ${t.business} list.`),
    t.footer_note ? esc(t.footer_note) : "",
    `<a href="{{unsubscribe_url}}" style="color:${link};text-decoration:underline">Unsubscribe</a>`,
  ].filter(Boolean).join("<br>");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${esc(doc?.subject || t.business)}</title>
<style>a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}@media (max-width:620px){.px{padding-left:22px!important;padding-right:22px!important}.col{display:block!important;width:100%!important}h1{font-size:26px!important;line-height:32px!important}}</style></head>
<body id="body" style="margin:0;padding:0;background:${t.background}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${t.background}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden">
<tr><td style="height:6px;line-height:6px;font-size:6px;background:${t.primary}">&nbsp;</td></tr>
<tr><td style="padding:28px 40px 20px" class="px">${head}</td></tr>
${blocks.map((b) => block(b, t)).join("\n")}
<tr><td style="padding:8px 40px 32px" class="px">&nbsp;</td></tr>
</table>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px"><tr><td style="padding:20px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:19px;color:#6b6b6b;text-align:center" class="px">${foot}</td></tr></table>
</td></tr></table></body></html>`;
}

// Plain-text part (deliverability): headings, text, button links, footer.
export function renderClientText(doc, th) {
  const t = th || themeFrom({});
  const lines = [];
  for (const b of normalizeClientBlocks(doc?.blocks)) {
    if (b.type === "heading") lines.push(b.text.toUpperCase(), "");
    else if (b.type === "text") lines.push(b.text.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)"), "");
    else if (b.type === "button" && b.label) lines.push(`${b.label}: ${b.url}`, "");
    else if (b.type === "callout") lines.push(`${b.title}\n${b.text}`, "");
    else if (b.type === "columns") lines.push(b.items.map((i) => `- ${i.title}: ${i.text}`).join("\n"), "");
    else if (b.type === "quote" && b.text) lines.push(`"${b.text}" ${b.cite ? `- ${b.cite}` : ""}`, "");
  }
  lines.push("--", t.business, t.address, "Unsubscribe: {{unsubscribe_url}}");
  return lines.filter((l) => l !== undefined).join("\n");
}

// JSON schema the AI fills (InvokeLLM response_json_schema). Text only, never HTML.
export const CLIENT_EMAIL_SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string" },
    blocks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["heading", "text", "button", "callout", "columns", "quote", "divider"] },
          text: { type: "string" }, label: { type: "string" }, url: { type: "string" }, title: { type: "string" }, cite: { type: "string" },
          items: { type: "array", items: { type: "object", properties: { title: { type: "string" }, text: { type: "string" } } } },
        },
        required: ["type"],
      },
    },
  },
  required: ["subject", "blocks"],
};
