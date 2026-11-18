// The client's deck brand, resolved from what Møthership already knows, best source first:
//   1. the approved BrandKit (palette with names/roles, typography, logo)
//   2. the Business Brain "brand" section (hex codes and font names written in the text)
//   3. the ClientDossier brand_identity + CRMClient logo
// Returns a deck brand { name, bg, fg, accent, accent2, mode, headingFont, headingFamily, bodyFamily, logo_url }
// with contrast guarded (text >= 4.5:1 on the background, accent >= 3:1 so big numbers and charts stay readable).
import { base44 } from "@/api/base44Client";

const HEX_RE = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;
const SERIF_RE = /serif|playfair|merriweather|lora|garamond|baskerville|fraunces|dm serif|libre|instrument serif|cormorant|crimson|georgia|times/i;

export const normHex = (h) => {
  let s = String(h || "").trim();
  if (!s) return "";
  if (!s.startsWith("#")) s = `#${s}`;
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return "";
  if (s.length === 4) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return s.toUpperCase();
};

function rgb(hex) {
  const h = normHex(hex).slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
export function lum(hex) {
  if (!normHex(hex)) return 0;
  const [r, g, b] = rgb(hex).map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function mix(hex, target, p) {
  const a = rgb(hex), t = rgb(target);
  return `#${a.map((v, i) => Math.round(v + (t[i] - v) * p).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}
const saturation = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
};

// Darken (light bg) or lighten (dark bg) a colour until it reaches the target contrast on bg.
export function ensureContrast(color, bg, target) {
  let c = normHex(color);
  if (!c) return c;
  const towards = lum(bg) > 0.4 ? "#000000" : "#FFFFFF";
  for (let i = 0; i < 12 && contrast(c, bg) < target; i += 1) c = mix(c, towards, 0.12);
  return c;
}

// Clean a font family name down to something Google Fonts can serve ("Inter Display" -> "Inter").
export function cleanFamily(name) {
  const s = String(name || "").split(/[,(/]/)[0].replace(/["']/g, "").replace(/\b(display|text|variable|vf)\b/gi, "").replace(/\s+/g, " ").trim();
  if (!s || s.length > 40 || /^(sans|serif|sans-serif|system|default|unknown|none)$/i.test(s)) return "";
  return s;
}

/** Build a guarded deck brand from raw colours + fonts. */
export function makeBrand({ name = "", palette = [], headingFamily = "", bodyFamily = "", logo_url = "" }) {
  const cols = palette.map((p) => ({ ...p, hex: normHex(p.hex) })).filter((p) => p.hex);
  if (!cols.length) return null;
  const tag = (p) => `${p.role || ""} ${p.name || ""} ${p.use || ""}`.toLowerCase();
  const find = (re) => cols.find((p) => re.test(tag(p)));
  const bgC = find(/background|\bbg\b|canvas|base|paper/);
  const textC = find(/\btext\b|ink|body copy|foreground/);
  const rest = cols.filter((p) => p !== bgC && p !== textC);
  // Kits list their primary colour early: first vivid mid-tone in listed order, then the most saturated.
  const vivid = [
    ...rest.filter((p) => saturation(p.hex) > 0.35 && lum(p.hex) > 0.04 && lum(p.hex) < 0.85),
    ...rest.slice().sort((a, b) => saturation(b.hex) - saturation(a.hex))
  ].filter((p, i, a) => a.indexOf(p) === i);
  const named = find(/primary|accent|brand|signature/);
  const accentC = named && named !== bgC ? named : vivid[0] || cols[0];

  let bg = bgC ? bgC.hex : "";
  if (!bg) {
    // No declared background. Light text means a dark canvas; otherwise a mostly-dark palette gets its darkest
    // colour, and everything else gets a warm off-white canvas.
    const nonText = cols.filter((p) => p !== textC);
    const darks = nonText.filter((p) => lum(p.hex) < 0.08).sort((a, b) => lum(a.hex) - lum(b.hex));
    if (textC && lum(textC.hex) > 0.6) bg = darks[0] ? darks[0].hex : "#111111";
    else if (!textC && darks.length && darks.length / Math.max(1, nonText.length) >= 0.5) bg = darks[0].hex;
    else bg = "#FAF8F5";
  }
  const dark = lum(bg) < 0.4;
  let fg = textC && contrast(textC.hex, bg) >= 4.5 ? textC.hex : "";
  if (!fg) {
    const darkest = cols.filter((p) => p.hex !== bg).sort((a, b) => lum(a.hex) - lum(b.hex))[0];
    fg = !dark && darkest && contrast(darkest.hex, bg) >= 7 ? darkest.hex : dark ? "#F7F5F2" : "#141414";
  }
  // accent stays the exact brand colour (rules, bars, fills); accentText is the same hue nudged until it is
  // readable as text on the background (big numbers, eyebrows, labels).
  const accent = accentC.hex;
  const accentText = ensureContrast(accentC.hex, bg, 3);
  // Secondary colour: distinct from the accent AND visible on the canvas (v2 test: a brief whose palette was
  // black + yellow picked the black background as the second chart colour, hiding a donut slice).
  const accent2C = vivid.find((p) => p !== accentC && p.hex !== bg && p.hex !== fg && contrast(p.hex, accentC.hex) > 1.3 && contrast(p.hex, bg) >= 2) || null;
  const accent2 = accent2C ? accent2C.hex : "";
  const hf = cleanFamily(headingFamily);
  const bf = cleanFamily(bodyFamily) || hf;
  return {
    name,
    bg,
    fg,
    accent,
    accentText,
    accent2,
    mode: dark ? "dark" : "light",
    headingFont: SERIF_RE.test(headingFamily) && !/sans/i.test(headingFamily) ? "serif" : "sans",
    headingFamily: hf,
    bodyFamily: bf && !SERIF_RE.test(bf) ? bf : "",
    logo_url: /^https?:\/\//.test(String(logo_url || "")) ? logo_url : ""
  };
}

/** Deck brand from an approved BrandKit's `kit` JSON. */
export function brandFromKit(kit, name = "") {
  if (!kit || typeof kit !== "object") return null;
  const palette = (Array.isArray(kit.palette) ? kit.palette : []).map((p) => (typeof p === "string" ? { hex: p } : p || {}));
  const ty = kit.typography || {};
  const fam = (x) => (x && typeof x === "object" ? x.family || x.name || "" : x || "");
  const logo = kit.logo || {};
  return makeBrand({
    name: name || (kit.overview && kit.overview.business) || "",
    palette,
    headingFamily: fam(ty.headings || ty.heading || ty.display),
    bodyFamily: fam(ty.body || ty.text),
    logo_url: logo.primary_url || logo.url || logo.horizontal_url || ""
  });
}

/** Deck brand from free text (Business Brain brand section, or a typed brief): hex codes + font names. */
export function brandFromText(text, name = "", logo_url = "") {
  const t = String(text || "");
  const palette = [];
  // Each hex is tagged only by its own clause ("orange accent #E8833A", "charcoal #2B2B2B background").
  t.split(/\n|;|,|:|\.(?=\s)|\band\b/i).forEach((clause) => {
    (clause.match(HEX_RE) || []).forEach((h) => palette.push({ hex: h, name: clause.replace(HEX_RE, " ").trim().slice(0, 60) }));
  });
  if (!palette.length) return null;
  const NAMED_BG = { white: "#FFFFFF", black: "#0B0B0B", cream: "#F6F1E9", "off-white": "#FAF8F5", ivory: "#FBF8F1" };
  if (!palette.some((p) => /background|\bbg\b/i.test(p.name))) {
    const m = t.match(/\b(white|black|cream|off-white|ivory)\s+(?:background|bg|canvas)\b/i);
    if (m) palette.unshift({ hex: NAMED_BG[m[1].toLowerCase()], name: "background" });
  }
  if (!palette.some((p) => /\btext\b|\bink\b/i.test(p.name))) {
    const m = t.match(/\b(white|black)\s+(?:text|type|copy)\b/i);
    if (m) palette.push({ hex: m[1].toLowerCase() === "white" ? "#FFFFFF" : "#111111", name: "text" });
  }
  const font = (re) => {
    const m = t.match(re);
    return m ? m[1] : "";
  };
  const heading = font(/(?:heading|headline|display)s?(?: font)?\s*[:=-]\s*([A-Za-z][A-Za-z0-9 ]{1,30})/i) || font(/font[s]?\s*[:=-]\s*([A-Za-z][A-Za-z0-9 ]{1,30})/i);
  const body = font(/body(?: font| copy| text)?\s*[:=-]\s*([A-Za-z][A-Za-z0-9 ]{1,30})/i);
  const brand = makeBrand({ name, palette, headingFamily: heading, bodyFamily: body, logo_url });
  if (brand && /serif headings|serif heading|serif font/i.test(t) && !/sans[- ]serif headings/i.test(t)) brand.headingFont = "serif";
  return brand;
}

const first = (p) => Promise.resolve(p).then((r) => (Array.isArray(r) ? r[0] : r && r.items ? r.items[0] : null) || null).catch(() => null);

/** Resolve the client's deck brand. Returns { brand, source } (brand null when nothing usable is on file). */
export async function clientBrand(clientId) {
  if (!clientId) return { brand: null, source: "" };
  const [client, kit, brain, dossier] = await Promise.all([
    base44.entities.CRMClient.get(clientId).catch(() => null),
    first(base44.entities.BrandKit.filter({ client_id: clientId, status: "approved" }, "-created_date", 1)),
    first(base44.entities.BusinessBrain.filter({ client_id: clientId }, "-updated_date", 1)),
    first(base44.entities.ClientDossier.filter({ client_id: clientId }, "-updated_date", 1))
  ]);
  return brandFromRecords({ client, kit, brain, dossier });
}

/** Same as clientBrand, from records already loaded (the client portal gets them from the deck-client function). */
export function brandFromRecords({ client, kit, brain, dossier }) {
  const name = (client && client.business) || "";
  const bi = (dossier && dossier.brand_identity) || {};
  const logo = (client && client.logo_url) || bi.logo_url || "";
  const fromKit = kit ? brandFromKit(kit.kit, name) : null;
  if (fromKit) return { brand: { ...fromKit, logo_url: fromKit.logo_url || logo }, source: "Approved brand kit" };
  // Client DESIGN.md (sections.brand.design_md): only its color-token and typography sections, so the YAML
  // header doesn't add unnamed colors. Comes after the approved kit, before the free-text brand section.
  const dmText = String((brain && brain.sections && brain.sections.brand && brain.sections.brand.design_md && brain.sections.brand.design_md.text) || "");
  const dmPart = (dmText.match(/##\s*\d*\.?\s*Color tokens[\s\S]*?(?=\n##\s*\d*\.?\s*Spacing|$)/i) || [""])[0];
  const fromDesign = dmPart ? brandFromText(dmPart, name, logo) : null;
  if (fromDesign) return { brand: fromDesign, source: "Client DESIGN.md" };
  const brainText = brain && brain.sections && brain.sections.brand && brain.sections.brand.text;
  const fromBrain = brainText ? brandFromText(brainText, name, logo) : null;
  if (fromBrain) return { brand: fromBrain, source: "Business Brain" };
  const cols = (bi.colors || []).map((c) => ({ hex: c }));
  const fromDossier = cols.length ? makeBrand({ name, palette: cols, headingFamily: bi.fonts || "", logo_url: logo }) : null;
  if (fromDossier) return { brand: fromDossier, source: "Client profile" };
  return { brand: null, source: "" };
}
