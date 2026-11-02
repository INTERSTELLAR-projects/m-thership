// Scannability checks: every dark part of the code must be clearly darker than the background.
// Phone cameras read luminance contrast, so we use the WCAG contrast ratio as the yardstick.
import { DEFAULT_STYLE } from "./presets";

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (c) => typeof c === "string" && HEX.test(c.trim());

function channels(hex) {
  const c = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
}
export function luminance(hex) {
  if (!isHex(hex)) return 1;
  const [r, g, b] = channels(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
export function darken(hex, amount = 0.12) {
  if (!isHex(hex)) return "#1a1a1a";
  const out = channels(hex).map((v) => Math.max(0, Math.round(v * (1 - amount))));
  return "#" + out.map((v) => v.toString(16).padStart(2, "0")).join("");
}
// Darken a colour step by step until it reaches `target` contrast against `bg`.
export function ensureContrast(hex, bg = "#ffffff", target = 4.5) {
  let c = isHex(hex) ? hex : "#1a1a1a";
  for (let i = 0; i < 30 && (contrastRatio(c, bg) < target || luminance(c) > luminance(bg)); i++) c = darken(c, 0.1);
  return c;
}

const ERROR_BELOW = 2.5;
const WARN_BELOW = 3.2;

export function scannability(styleIn) {
  const s = { ...DEFAULT_STYLE, ...(styleIn || {}) };
  const bg = s.transparent_bg ? "#ffffff" : s.background;
  const darks = [["Pattern", s.foreground], s.gradient ? ["Gradient end", s.gradient_color] : null, ["Corner frames", s.corner_color], ["Corner dots", s.eye_color]].filter(Boolean);
  const issues = [];
  let min = 21;
  for (const [label, c] of darks) {
    if (!isHex(c)) continue;
    const r = contrastRatio(c, bg);
    min = Math.min(min, r);
    if (luminance(c) > luminance(bg)) issues.push({ level: "error", text: `${label} is lighter than the background. Lots of phone cameras can't read inverted codes.` });
    else if (r < ERROR_BELOW) issues.push({ level: "error", text: `${label} is too close to the background (${r.toFixed(1)}:1). Phones may not read it.` });
    else if (r < WARN_BELOW) issues.push({ level: "warn", text: `${label} has low contrast (${r.toFixed(1)}:1). Test it with a phone before printing.` });
  }
  if (s.transparent_bg) issues.push({ level: "warn", text: "Transparent background: only place it on a light, plain surface." });
  if (s.logo_url && Number(s.logo_size) > 26) issues.push({ level: "warn", text: "Big logo. Keep it at 26% or less so the code reads reliably." });
  const level = issues.some((i) => i.level === "error") ? "error" : issues.length ? "warn" : "ok";
  return { level, ratio: min, issues, ecc: s.logo_url ? "H" : "Q", quiet: Math.max(4, Number(s.margin) || 4) };
}

// One-click fix: light background, every dark part darkened to at least 4.5:1, logo capped at 26%.
export function autoFix(styleIn) {
  const s = { ...DEFAULT_STYLE, ...(styleIn || {}) };
  const bg = !s.transparent_bg && isHex(s.background) && luminance(s.background) > 0.6 ? s.background : "#ffffff";
  return {
    ...s,
    background: bg,
    transparent_bg: false,
    foreground: ensureContrast(s.foreground, bg),
    gradient_color: ensureContrast(s.gradient_color, bg),
    corner_color: ensureContrast(s.corner_color, bg),
    eye_color: ensureContrast(s.eye_color, bg),
    logo_size: Math.min(26, Number(s.logo_size) || 22),
  };
}
