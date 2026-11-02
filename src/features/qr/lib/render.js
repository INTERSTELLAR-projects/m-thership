// QR renderer, ported from Wørmhole's canvas renderer (dot shapes, eye shapes, frames, logo knock-out)
// and rebuilt around one geometry pass so PNG (canvas) and SVG downloads are pixel-identical.
// Everything is laid out in "units" (10 per module) as SVG path data; canvas draws the same paths via Path2D.
import { DEFAULT_STYLE } from "./presets";

const U = 10; // units per module
const QUIET = 4; // quiet zone in modules: never less than the spec minimum of 4
const BANNER = 7; // frame banner height in modules
const BORDER = 2; // frame border thickness in modules
const r2 = (n) => Math.round(n * 100) / 100;

// Rounded rectangle as SVG path data (r = 0 gives a plain rect, r = w/2 a circle).
export function rrPath(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!rr) return `M${r2(x)} ${r2(y)}h${r2(w)}v${r2(h)}h${r2(-w)}Z`;
  const a = `a${r2(rr)} ${r2(rr)} 0 0 1`;
  return `M${r2(x + rr)} ${r2(y)}h${r2(w - 2 * rr)}${a} ${r2(rr)} ${r2(rr)}v${r2(h - 2 * rr)}${a} ${r2(-rr)} ${r2(rr)}h${r2(-(w - 2 * rr))}${a} ${r2(-rr)} ${r2(-rr)}v${r2(-(h - 2 * rr))}${a} ${r2(rr)} ${r2(-rr)}Z`;
}
const circlePath = (cx, cy, r) => `M${r2(cx - r)} ${r2(cy)}a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0Z`;
const diamondPath = (cx, cy, r) => `M${r2(cx)} ${r2(cy - r)}L${r2(cx + r)} ${r2(cy)}L${r2(cx)} ${r2(cy + r)}L${r2(cx - r)} ${r2(cy)}Z`;

export function textColorOn(hex) {
  const c = String(hex || "").replace("#", "");
  if (c.length < 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1a1a1a" : "#ffffff";
}

const CORNER_R = { square: 0, rounded: 0.28, "extra-rounded": 0.42, circle: 0.5 };
const finderOrigins = (n) => [[0, 0], [n - 7, 0], [0, n - 7]];
const inFinder = (x, y, n) => finderOrigins(n).some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);

// Alignment-pattern cells. Scanners lock onto these to correct perspective, so they are always drawn as solid
// squares whatever the dot style (dots/diamonds there are the #1 reason styled codes fail to read).
function alignmentCells(n) {
  const v = (n - 17) / 4;
  const cells = new Set();
  if (v < 2) return cells;
  const num = Math.floor(v / 7) + 2;
  const step = v === 32 ? 26 : Math.ceil((n - 13) / (2 * num - 2)) * 2;
  const pos = [6];
  for (let p = n - 7; pos.length < num; p -= step) pos.splice(1, 0, p);
  for (let i = 0; i < num; i++) {
    for (let j = 0; j < num; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === num - 1) || (i === num - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) cells.add((pos[j] + dy) * n + pos[i] + dx);
    }
  }
  return cells;
}

export function layoutQR(matrix, styleIn) {
  const s = { ...DEFAULT_STYLE, ...(styleIn || {}) };
  const n = matrix.length;
  const frame = ["banner-bottom", "banner-top", "border"].includes(s.frame_style) ? s.frame_style : "none";
  const pad = frame === "border" ? BORDER : 0;
  const banTop = frame === "banner-top" ? BANNER : 0;
  const banBot = frame === "none" ? 0 : frame === "banner-top" ? 0 : BANNER;
  const quiet = Math.max(QUIET, Math.round(Number(s.margin) || QUIET));
  const inner = quiet * 2 + n;
  const W = (pad * 2 + inner) * U;
  const H = (pad + banTop + inner + banBot) * U;
  const qx = (pad + quiet) * U;
  const qy = (pad + banTop + quiet) * U;
  const bg = s.background || "#ffffff";
  const transparent = !!s.transparent_bg;
  const frameColor = s.frame_color || s.corner_color || s.foreground;
  const ops = [];
  let text = null;

  if (frame === "border") {
    const hole = rrPath(pad * U, pad * U, inner * U, inner * U, U * 1.1);
    ops.push({ d: rrPath(0, 0, W, H, U * 1.6) + hole, fill: frameColor, rule: "evenodd" });
    if (!transparent) ops.push({ d: hole, fill: bg });
    text = { x: W / 2, y: (pad + inner) * U + (BANNER * U) / 2, maxW: W - 4 * U, h: BANNER * U };
  } else {
    if (!transparent) ops.push({ d: rrPath(0, 0, W, H, 0), fill: bg });
    if (frame !== "none") {
      const by = frame === "banner-bottom" ? H - BANNER * U : 0;
      ops.push({ d: rrPath(0, by, W, BANNER * U, 0), fill: frameColor });
      text = { x: W / 2, y: by + (BANNER * U) / 2, maxW: W - 4 * U, h: BANNER * U };
    }
  }

  // Data modules. The logo area is knocked out (error correction H recovers it).
  const logo = !!s.logo_url;
  const size = Math.max(10, Math.min(30, Number(s.logo_size) || 22));
  const center = n / 2;
  const clearHalf = logo ? (n * (size / 100)) / 2 + 0.6 : 0;
  const knocked = (x, y) => logo && Math.abs(x + 0.5 - center) < clearHalf && Math.abs(y + 0.5 - center) < clearHalf;
  const dark = (x, y) => matrix[y][x] && !inFinder(x, y, n) && !knocked(x, y);
  const align = alignmentCells(n);
  let body = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!dark(x, y)) continue;
      const px = qx + x * U, py = qy + y * U;
      if (align.has(y * n + x)) body += rrPath(px, py, U, U, s.dot_style === "square" ? 0 : U * 0.18);
      else if (s.dot_style === "dots") body += circlePath(px + U / 2, py + U / 2, U * 0.42);
      else if (s.dot_style === "diamond") body += diamondPath(px + U / 2, py + U / 2, U * 0.52);
      else if (s.dot_style === "rounded") body += rrPath(px, py, U, U, U * 0.35);
      else {
        // square: merge horizontal runs so there are no hairline seams between modules
        let run = 1;
        while (x + run < n && dark(x + run, y)) run++;
        body += rrPath(px, py, run * U, U, 0);
        x += run - 1;
      }
    }
  }
  ops.push({ d: body, fill: "BODY" });

  // Finder "eyes": outer ring + inner dot, each with its own colour.
  const cr = CORNER_R[s.corner_style] ?? CORNER_R.rounded;
  const isCircle = s.corner_style === "circle";
  for (const [fx, fy] of finderOrigins(n)) {
    const x = qx + fx * U, y = qy + fy * U;
    const ring = rrPath(x, y, 7 * U, 7 * U, isCircle ? 3.5 * U : 7 * U * cr) + rrPath(x + U, y + U, 5 * U, 5 * U, isCircle ? 2.5 * U : 5 * U * cr);
    ops.push({ d: ring, fill: s.corner_color || s.foreground, rule: "evenodd" });
    ops.push({ d: rrPath(x + 2 * U, y + 2 * U, 3 * U, 3 * U, isCircle ? 1.5 * U : 3 * U * Math.min(cr + 0.05, 0.5)), fill: s.eye_color || s.corner_color || s.foreground });
  }

  let logoBox = null;
  if (logo) {
    const box = n * U * (size / 100) * 0.9;
    const bx = qx + (n * U) / 2 - box / 2, by = qy + (n * U) / 2 - box / 2;
    if (s.logo_bg !== false) ops.push({ d: rrPath(bx - U * 0.6, by - U * 0.6, box + U * 1.2, box + U * 1.2, box * 0.22), fill: transparent ? "#ffffff" : bg });
    logoBox = { x: bx, y: by, size: box, clip: rrPath(bx, by, box, box, box * 0.16) };
  }

  if (text) {
    const value = String(s.frame_text || "SCAN ME").toUpperCase().slice(0, 28);
    text.value = value;
    text.color = s.frame_text_color || textColorOn(frameColor);
    text.size = Math.min(text.h * 0.42, text.maxW / Math.max(4, value.length * 0.66));
  }

  const gradient = s.gradient && s.gradient_color
    ? { type: s.gradient_type === "radial" ? "radial" : "linear", from: s.foreground, to: s.gradient_color, x1: qx, y1: qy, x2: qx + n * U, y2: qy + n * U, cx: qx + (n * U) / 2, cy: qy + (n * U) / 2, r: n * U * 0.72 }
    : null;

  return { W, H, ops, logoBox, text, gradient, foreground: s.foreground, modules: n };
}

const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";

export function drawCanvas(canvas, L, { pixelWidth = 1024, logoImg = null } = {}) {
  const scale = pixelWidth / L.W;
  canvas.width = Math.round(L.W * scale);
  canvas.height = Math.round(L.H * scale);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, L.W, L.H);
  let bodyPaint = L.foreground;
  if (L.gradient) {
    const g = L.gradient;
    const grad = g.type === "radial" ? ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, g.r) : ctx.createLinearGradient(g.x1, g.y1, g.x2, g.y2);
    grad.addColorStop(0, g.from);
    grad.addColorStop(1, g.to);
    bodyPaint = grad;
  }
  for (const op of L.ops) {
    if (!op.d) continue;
    ctx.fillStyle = op.fill === "BODY" ? bodyPaint : op.fill;
    ctx.fill(new Path2D(op.d), op.rule || "nonzero");
  }
  if (L.logoBox && logoImg && logoImg.naturalWidth) {
    const { x, y, size, clip } = L.logoBox;
    const k = Math.min(size / logoImg.naturalWidth, size / logoImg.naturalHeight);
    const w = logoImg.naturalWidth * k, h = logoImg.naturalHeight * k;
    ctx.save();
    ctx.clip(new Path2D(clip));
    ctx.drawImage(logoImg, x + (size - w) / 2, y + (size - h) / 2, w, h);
    ctx.restore();
  }
  if (L.text) {
    ctx.fillStyle = L.text.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${L.text.size}px ${FONT}`;
    ctx.fillText(L.text.value, L.text.x, L.text.y + L.text.size * 0.04);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function toSVG(L, { logoHref = "", pixelWidth = 1024 } = {}) {
  const defs = [];
  let bodyFill = esc(L.foreground);
  if (L.gradient) {
    const g = L.gradient;
    const stops = `<stop offset="0" stop-color="${esc(g.from)}"/><stop offset="1" stop-color="${esc(g.to)}"/>`;
    defs.push(g.type === "radial"
      ? `<radialGradient id="qrg" gradientUnits="userSpaceOnUse" cx="${r2(g.cx)}" cy="${r2(g.cy)}" r="${r2(g.r)}">${stops}</radialGradient>`
      : `<linearGradient id="qrg" gradientUnits="userSpaceOnUse" x1="${r2(g.x1)}" y1="${r2(g.y1)}" x2="${r2(g.x2)}" y2="${r2(g.y2)}">${stops}</linearGradient>`);
    bodyFill = "url(#qrg)";
  }
  const parts = L.ops.filter((op) => op.d).map((op) => `<path d="${op.d}" fill="${op.fill === "BODY" ? bodyFill : esc(op.fill)}"${op.rule ? ` fill-rule="${op.rule}"` : ""}/>`);
  if (L.logoBox && logoHref) {
    const { x, y, size, clip } = L.logoBox;
    defs.push(`<clipPath id="qrl"><path d="${clip}"/></clipPath>`);
    parts.push(`<image href="${esc(logoHref)}" x="${r2(x)}" y="${r2(y)}" width="${r2(size)}" height="${r2(size)}" preserveAspectRatio="xMidYMid meet" clip-path="url(#qrl)"/>`);
  }
  if (L.text) {
    parts.push(`<text x="${r2(L.text.x)}" y="${r2(L.text.y)}" text-anchor="middle" dominant-baseline="central" font-family="${esc(FONT)}" font-weight="700" font-size="${r2(L.text.size)}" fill="${esc(L.text.color)}">${esc(L.text.value)}</text>`);
  }
  const h = Math.round((pixelWidth * L.H) / L.W);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.W} ${L.H}" width="${pixelWidth}" height="${h}" shape-rendering="geometricPrecision">${defs.length ? `<defs>${defs.join("")}</defs>` : ""}${parts.join("")}</svg>`;
}
