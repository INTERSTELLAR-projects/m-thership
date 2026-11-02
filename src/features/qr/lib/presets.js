// Style defaults, the Interstellar style packs, frame CTAs and Wørmhole's centre-icon presets.

export const DEFAULT_STYLE = {
  dot_style: "rounded", // square | rounded | dots | diamond
  corner_style: "rounded", // square | rounded | extra-rounded | circle
  foreground: "#1a1a1a",
  gradient: false,
  gradient_type: "linear", // linear | radial
  gradient_color: "#ff3c00",
  corner_color: "#1a1a1a",
  eye_color: "#1a1a1a",
  background: "#ffffff",
  transparent_bg: false,
  frame_style: "none", // none | banner-bottom | banner-top | border
  frame_text: "SCAN ME",
  frame_color: "#1a1a1a",
  frame_text_color: "",
  logo_url: "",
  logo_size: 22,
  logo_bg: true,
  margin: 4,
};

// Packs only set colours/shapes/frames. They never touch the logo, so a client's logo survives a pack switch.
export const PACKS = [
  {
    id: "classic", name: "Classic", blurb: "Crisp ink on white. Reads anywhere.",
    style: { dot_style: "square", corner_style: "square", foreground: "#111111", gradient: false, corner_color: "#111111", eye_color: "#111111", background: "#ffffff", transparent_bg: false, frame_style: "none" },
  },
  {
    id: "nebula", name: "Nebula", blurb: "Violet dust swirling to magenta.",
    style: { dot_style: "dots", corner_style: "extra-rounded", foreground: "#3b0764", gradient: true, gradient_type: "radial", gradient_color: "#a21caf", corner_color: "#4c1d95", eye_color: "#c2410c", background: "#ffffff", transparent_bg: false, frame_style: "none" },
  },
  {
    id: "solar-flare", name: "Solar Flare", blurb: "Interstellar flame, burning off ink.",
    style: { dot_style: "rounded", corner_style: "rounded", foreground: "#1a1a1a", gradient: true, gradient_type: "linear", gradient_color: "#ff3c00", corner_color: "#ff3c00", eye_color: "#1a1a1a", background: "#ffffff", transparent_bg: false, frame_style: "banner-bottom", frame_color: "#ff3c00", frame_text: "SCAN ME" },
  },
  {
    id: "deep-space", name: "Deep Space", blurb: "Midnight navy on star-paper.",
    style: { dot_style: "dots", corner_style: "circle", foreground: "#0b1026", gradient: true, gradient_type: "linear", gradient_color: "#1e3a8a", corner_color: "#0b1026", eye_color: "#ff3c00", background: "#f5f3f0", transparent_bg: false, frame_style: "border", frame_color: "#0b1026", frame_text: "SCAN TO LAUNCH" },
  },
  {
    id: "event-horizon", name: "Event Horizon", blurb: "Diamonds falling into the wormhole.",
    style: { dot_style: "diamond", corner_style: "circle", foreground: "#1a1a1a", gradient: false, corner_color: "#1a1a1a", eye_color: "#ff3c00", background: "#ffffff", transparent_bg: false, frame_style: "banner-top", frame_color: "#1a1a1a", frame_text: "ENTER THE WORMHOLE" },
  },
];

export const CTA_TEXTS = ["SCAN ME", "SCAN TO ORDER", "SCAN FOR MENU", "LEAVE A REVIEW", "BOOK NOW", "GET A QUOTE", "FOLLOW US", "ENTER THE WORMHOLE"];

const isHex = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c.trim());
const NEUTRAL = /^#(f{6}|0{6}|1a1a1a|111111|141414|1c1c1c|f5f3f0|ebe8e4)$/i;
const lum = (hex) => {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const ratioOnWhite = (hex) => 1.05 / (lum(hex) + 0.05);
const deepen = (hex) => {
  let c = hex;
  for (let i = 0; i < 30 && ratioOnWhite(c) < 4; i++) c = "#" + [1, 3, 5].map((k) => Math.round(parseInt(c.slice(k, k + 2), 16) * 0.9).toString(16).padStart(2, "0")).join("");
  return c;
};

// The client's own look: their logo in the middle, their accent (deepened until it scans) on the corners.
export function brandAccent(brand) {
  if (!brand) return null;
  const colors = (brand.colors || []).map((x) => (typeof x === "string" ? x : x?.hex)).filter(isHex);
  return [brand.accent, brand.martian_color, ...colors].find((c) => isHex(c) && !NEUTRAL.test(c)) || null;
}
export function brandPack(brand) {
  if (!brand) return null;
  const accent = brandAccent(brand);
  const deep = accent ? deepen(accent) : "#1a1a1a";
  return {
    id: "brand", name: "Brand auto", blurb: `${brand.company || "Client"} colours and logo.`, brand: true,
    style: {
      dot_style: "rounded", corner_style: "extra-rounded", foreground: "#1a1a1a",
      gradient: !!accent, gradient_type: "linear", gradient_color: deep,
      corner_color: deep, eye_color: "#1a1a1a", background: "#ffffff", transparent_bg: false,
      frame_style: "none", frame_color: deep, frame_text: "SCAN ME",
      ...(brand.logo_url ? { logo_url: brand.logo_url, logo_size: 22, logo_bg: true } : {}),
    },
  };
}

export const applyPack = (current, packStyle) => ({ ...DEFAULT_STYLE, ...(current || {}), ...(packStyle || {}) });

// Wørmhole's centre-icon presets (inline SVG, no upload needed).
const circle = (fill, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="${fill}"/>${inner}</svg>`;
const stroke = '<g fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">';
const svgSrc = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
export const ICON_PRESETS = [
  { id: "link", label: "Link", src: svgSrc(circle("#ff3c00", `${stroke}<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></g>`)) },
  { id: "location", label: "Location", src: svgSrc(circle("#EF4444", `${stroke}<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></g>`)) },
  { id: "email", label: "Email", src: svgSrc(circle("#1a1a1a", `${stroke}<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></g>`)) },
  { id: "phone", label: "Phone", src: svgSrc(circle("#16a34a", `${stroke}<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></g>`)) },
  { id: "whatsapp", label: "WhatsApp", src: svgSrc(circle("#22C55E", `${stroke}<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></g>`)) },
  { id: "wifi", label: "Wi-Fi", src: svgSrc(circle("#2563EB", `${stroke}<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></g>`)) },
  { id: "star", label: "Review", src: svgSrc(circle("#f59e0b", `${stroke}<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></g>`)) },
  { id: "rocket", label: "Rocket", src: svgSrc(circle("#1a1a1a", `${stroke}<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z"/></g>`)) },
];
