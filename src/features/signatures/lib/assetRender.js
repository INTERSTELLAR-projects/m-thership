// Renders the animated pieces of an email signature (verified check, profile photo,
// social icons, CTA button) on a canvas and encodes them as GIF (animated) or PNG (still).
// Email apps strip CSS animation and SVG, so hosted GIFs are the only way a signature moves.
import { encodeGif } from "./gifEncode";
import { PLATFORM_BY_ID, drawGlyph, brandGradient } from "./brandIcons";

// ---- color + math helpers --------------------------------------------------------

export function hex2rgb(hex) {
  const raw = String(hex || "").replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = parseInt(full, 16);
  if (isNaN(n) || full.length !== 6) return { r: 26, g: 26, b: 26 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export function mix(from, to, amount) {
  const a = hex2rgb(from);
  const b = hex2rgb(to);
  const p = (x, y) => Math.max(0, Math.min(255, Math.round(x + (y - x) * amount))).toString(16).padStart(2, "0");
  return `#${p(a.r, b.r)}${p(a.g, b.g)}${p(a.b, b.b)}`;
}
const rgba = (hex, a) => {
  const { r, g, b } = hex2rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const prog = (f, start, len) => clamp01((f - start) / len);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// 0 → 1 → 0 with eased in/out, so every effect leaves and returns to the resting design.
const bump = (t) => Math.sin(Math.PI * easeInOut(clamp01(t)));
// Every looping GIF starts and ends on the finished design (Outlook also only shows frame 1).
const STEP = 40; // ms per frame ≈ 25fps, the smoothest rate every mail client honours

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return { c, ctx: c.getContext("2d", { willReadFrequently: true }) };
}

function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shapePath(ctx, shape, x, y, w, h) {
  if (shape === "circle") {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.closePath();
  } else if (shape === "square") rr(ctx, x, y, w, h, w * 0.06);
  else if (shape === "slant") {
    const k = w * 0.14;
    ctx.beginPath();
    ctx.moveTo(x + k, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - k, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  } else rr(ctx, x, y, w, h, w * 0.22);
}

function shine(ctx, x, y, w, h, t, alpha = 0.6, rgb = null) {
  const col = rgb ? `${rgb.r},${rgb.g},${rgb.b}` : "255,255,255";
  if (t <= 0 || t >= 1) return;
  // Sine-eased glide that is on screen for the whole sweep (no wasted off-canvas frames).
  const band = Math.max(w, h) * 0.55;
  const p = (1 - Math.cos(Math.PI * t)) / 2;
  const cx = x - band * 0.5 + (w + band) * p;
  // Gradient is built in the band's own (translated + rotated) space.
  const g = ctx.createLinearGradient(-band / 2, 0, band / 2, 0);
  g.addColorStop(0, `rgba(${col},0)`);
  g.addColorStop(0.35, `rgba(${col},${alpha * 0.35})`);
  g.addColorStop(0.5, `rgba(${col},${alpha})`);
  g.addColorStop(0.65, `rgba(${col},${alpha * 0.35})`);
  g.addColorStop(1, `rgba(${col},0)`);
  ctx.save();
  ctx.translate(cx, y + h / 2);
  ctx.rotate(0.38);
  ctx.fillStyle = g;
  ctx.fillRect(-band / 2, -h * 1.5, band, h * 3);
  ctx.restore();
}

// Renders `count` frames with draw(ctx, f) and encodes a looping GIF.
function film(w, h, count, draw, delayOf) {
  const { ctx } = makeCanvas(w, h);
  const frames = [];
  const delays = [];
  for (let f = 0; f < count; f++) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.clearRect(0, 0, w, h);
    draw(ctx, f);
    frames.push(ctx.getImageData(0, 0, Math.round(w), Math.round(h)).data);
    delays.push(delayOf(f, count));
  }
  return encodeGif(frames, { width: Math.round(w), height: Math.round(h), delays });
}

function still(w, h, draw) {
  const { c, ctx } = makeCanvas(w, h);
  draw(ctx, 0);
  return new Promise((res) => c.toBlob(res, "image/png"));
}

const holdLast = (hold, step) => (f, n) => (f === n - 1 ? hold : step);

// ---- verified check ----------------------------------------------------------------

function rosette(ctx, cx, cy, R) {
  ctx.beginPath();
  ctx.moveTo(cx + R * 0.64, cy);
  ctx.arc(cx, cy, R * 0.64, 0, Math.PI * 2);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8;
    const x = cx + Math.cos(a) * R * 0.56;
    const y = cy + Math.sin(a) * R * 0.56;
    ctx.moveTo(x + R * 0.44, y);
    ctx.arc(x, y, R * 0.44, 0, Math.PI * 2);
  }
}

function drawBadge(ctx, spec, px, { pop = 1, check = 1, gleam = 0, ring = 0 }) {
  const cx = px / 2;
  const cy = px / 2;
  const R = px * (spec.anim === "pulse" ? 0.37 : 0.44);
  const base = spec.color || "#0a95ff";
  ctx.fillStyle = spec.bg || "#ffffff";
  ctx.fillRect(0, 0, px, px);
  if (ring > 0 && ring < 1) {
    ctx.strokeStyle = rgba(base, 0.55 * (1 - ring));
    ctx.lineWidth = px * 0.05;
    ctx.beginPath();
    ctx.arc(cx, cy, R * (0.95 + ring * 0.32), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pop, pop);
  ctx.translate(-cx, -cy);
  const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  g.addColorStop(0, mix(base, "#ffffff", 0.42));
  g.addColorStop(0.55, base);
  g.addColorStop(1, mix(base, "#000000", 0.16));
  rosette(ctx, cx, cy, R);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  rosette(ctx, cx, cy, R);
  ctx.clip();
  shine(ctx, cx - R, cy - R, R * 2, R * 2, gleam, 0.75);
  ctx.restore();
  if (check > 0) {
    const pts = [
      [0.29, 0.52],
      [0.44, 0.665],
      [0.72, 0.37],
    ].map(([x, y]) => [cx - R + x * 2 * R, cy - R + y * 2 * R]);
    const l1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
    const l2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
    let len = (l1 + l2) * check;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = R * 0.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    const a = Math.min(1, len / l1);
    ctx.lineTo(pts[0][0] + (pts[1][0] - pts[0][0]) * a, pts[0][1] + (pts[1][1] - pts[0][1]) * a);
    if (len > l1) {
      const b = Math.min(1, (len - l1) / l2);
      ctx.lineTo(pts[1][0] + (pts[2][0] - pts[1][0]) * b, pts[1][1] + (pts[2][1] - pts[1][1]) * b);
    }
    ctx.stroke();
  }
  ctx.restore();
}

async function renderBadge(spec) {
  const size = spec.size || 18;
  const px = size * 3;
  if (spec.anim === "none") {
    return { blob: await still(px, px, (ctx) => drawBadge(ctx, spec, px, {})), width: size, height: size };
  }
  const pulse = spec.anim === "pulse";
  const blob = film(
    px,
    px,
    40,
    (ctx, f) =>
      drawBadge(ctx, spec, px, {
        pop: 1 + 0.08 * bump(prog(f, 1, 14)),
        check: 1,
        gleam: pulse ? 0 : prog(f, 7, 24),
        ring: pulse ? prog(f, 3, 30) : 0,
      }),
    holdLast(2600, STEP)
  );
  return { blob, width: size, height: size };
}

// ---- profile photo -----------------------------------------------------------------

const imgCache = new Map();
export function loadImage(src) {
  if (!imgCache.has(src)) {
    imgCache.set(
      src,
      new Promise((res, rej) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => res(i);
        i.onerror = () => {
          imgCache.delete(src);
          rej(new Error("Could not load image"));
        };
        i.src = src;
      })
    );
  }
  return imgCache.get(src);
}

function cover(ctx, img, x, y, w, h, zoom = 1, focusY = 0.32) {
  const s = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) * focusY, dw, dh);
}

async function renderPhoto(spec) {
  const img = await loadImage(spec.src);
  const size = spec.size || 120;
  // Animated photos are the heaviest asset: 1.5× keeps them crisp on retina at a sane file size.
  const k = !spec.anim || spec.anim === "none" ? Math.min(2, 340 / size) : Math.min(1.5, 240 / size);
  const px = Math.round(size * k);
  const accent = spec.accent || "#ff6a00";
  const accent2 = spec.accent2 || mix(accent, "#ffffff", 0.4);
  const fx = spec.anim === "orbit" || spec.anim === "glow" || spec.ring;
  const pad = fx ? Math.round(px * 0.055) : 0;
  const x0 = pad;
  const w = px - pad * 2;
  const shape = spec.shape || "rounded";
  const bg = spec.bg || "#ffffff";

  const base = (ctx, zoom = 1) => {
    ctx.save();
    shapePath(ctx, shape, x0, x0, w, w);
    ctx.clip();
    cover(ctx, img, x0, x0, w, w, zoom);
    ctx.restore();
  };
  const ringStroke = (ctx, style, lw) => {
    ctx.save();
    const o = pad * 0.5;
    shapePath(ctx, shape, x0 - o, x0 - o, w + o * 2, w + o * 2);
    ctx.strokeStyle = style;
    ctx.lineWidth = lw;
    ctx.stroke();
    ctx.restore();
  };
  const plainRing = (ctx) => spec.ring && ringStroke(ctx, accent, Math.max(2, pad * 0.45));
  const fill = (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, px, px);
  };
  const out = (blob) => ({ blob, width: size, height: size });

  if (!spec.anim || spec.anim === "none") {
    return out(
      await still(px, px, (ctx) => {
        fill(ctx);
        base(ctx);
        plainRing(ctx);
      })
    );
  }

  if (spec.anim === "slice") {
    const N = 5;
    const skew = w * 0.17;
    const gap = Math.max(2, px * 0.012);
    const span = (w + skew * 2) / N;
    const stripPath = (ctx, i) => {
      const a = x0 - skew + i * span;
      const b = a + span;
      ctx.beginPath();
      ctx.moveTo(a + skew + gap / 2, x0);
      ctx.lineTo(b + skew - gap / 2, x0);
      ctx.lineTo(b - skew - gap / 2, x0 + w);
      ctx.lineTo(a - skew + gap / 2, x0 + w);
      ctx.closePath();
    };
    // Strips glide apart in alternating directions, then lock back together.
    return out(
      film(
        px,
        px,
        36,
        (ctx, f) => {
          fill(ctx);
          for (let i = 0; i < N; i++) {
            const d = bump(prog(f, 2 + i * 2, 24));
            const dir = i % 2 ? 1 : -1;
            ctx.save();
            shapePath(ctx, shape, x0, x0, w, w);
            ctx.clip();
            ctx.translate(0, dir * w * 0.075 * d);
            stripPath(ctx, i);
            ctx.clip();
            cover(ctx, img, x0, x0, w, w, 1 + 0.03 * d);
            ctx.restore();
          }
          ctx.save();
          shapePath(ctx, shape, x0, x0, w, w);
          ctx.clip();
          shine(ctx, x0, x0, w, w, prog(f, 8, 25), 0.3);
          ctx.restore();
          plainRing(ctx);
        },
        holdLast(3200, STEP)
      )
    );
  }

  if (spec.anim === "shine") {
    return out(
      film(
        px,
        px,
        34,
        (ctx, f) => {
          fill(ctx);
          base(ctx);
          ctx.save();
          shapePath(ctx, shape, x0, x0, w, w);
          ctx.clip();
          shine(ctx, x0, x0, w, w, prog(f, 1, 31), 0.45);
          ctx.restore();
          plainRing(ctx);
        },
        holdLast(3000, STEP)
      )
    );
  }

  if (spec.anim === "orbit") {
    const n = 45;
    return out(
      film(
        px,
        px,
        n,
        (ctx, f) => {
          fill(ctx);
          base(ctx);
          const g = ctx.createConicGradient((f / n) * Math.PI * 2, px / 2, px / 2);
          g.addColorStop(0, accent);
          g.addColorStop(0.35, accent2);
          g.addColorStop(0.6, rgba(accent2, 0));
          g.addColorStop(1, accent);
          ringStroke(ctx, g, pad * 0.62);
        },
        () => STEP
      )
    );
  }

  if (spec.anim === "glow") {
    const n = 40;
    return out(
      film(
        px,
        px,
        n,
        (ctx, f) => {
          fill(ctx);
          const p = 0.5 - 0.5 * Math.cos((f / n) * Math.PI * 2);
          ctx.save();
          ctx.shadowColor = rgba(accent, 0.35 + 0.5 * p);
          ctx.shadowBlur = pad * (0.5 + 1.1 * p);
          shapePath(ctx, shape, x0, x0, w, w);
          ctx.fillStyle = accent;
          ctx.fill();
          ctx.restore();
          base(ctx);
          ringStroke(ctx, accent, Math.max(2, pad * 0.3));
        },
        () => 50
      )
    );
  }

  // zoom (slow push-in and back)
  const n = 44;
  return out(
    film(
      px,
      px,
      n,
      (ctx, f) => {
        fill(ctx);
        base(ctx, 1 + 0.06 * (0.5 - 0.5 * Math.cos((f / n) * Math.PI * 2)));
        plainRing(ctx);
      },
      () => 70
    )
  );
}

// ---- social icons ------------------------------------------------------------------

// Static icon art (container + glyph) on a transparent layer, cached per spec.
const layerCache = new Map();
function iconLayer(spec, px) {
  const key = JSON.stringify([spec.platform, spec.style, spec.shape, spec.accent, px]);
  if (layerCache.has(key)) return layerCache.get(key);
  const { c, ctx } = makeCanvas(px, px);
  const platform = PLATFORM_BY_ID[spec.platform];
  const accent = spec.accent || "#ff6a00";
  const style = spec.style || "brand";
  const shape = spec.shape || "circle";
  const brandOf = (x, y, w, h) => (platform.id === "website" ? accent : brandGradient(ctx, platform, x, y, w, h));
  const m = px / 2;
  if (style === "logo") {
    const g = px * 0.92;
    drawGlyph(ctx, platform, m, m, g, brandOf(m - g / 2, m - g / 2, g, g));
  } else {
    const container = {
      brand: { fill: brandOf(0, 0, px, px), glyph: "#ffffff" },
      accent: { fill: accent, glyph: "#ffffff" },
      ink: { fill: "#121212", glyph: "#ffffff" },
      soft: { fill: mix(accent, "#ffffff", 0.86), glyph: accent },
      outline: { fill: null, stroke: accent, glyph: accent },
      white: { fill: "#ffffff", stroke: "#e4e4e7", glyph: brandOf(px * 0.23, px * 0.23, px * 0.54, px * 0.54) },
    }[style] || { fill: brandOf(0, 0, px, px), glyph: "#ffffff" };
    const lw = px * (style === "outline" ? 0.065 : 0.035);
    const inset = container.stroke ? lw / 2 : 0;
    shapePath(ctx, shape, inset, inset, px - inset * 2, px - inset * 2);
    if (container.fill) {
      ctx.fillStyle = container.fill;
      ctx.fill();
    }
    if (container.stroke) {
      ctx.strokeStyle = container.stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    drawGlyph(ctx, platform, m, m, px * (platform.id === "website" ? 0.5 : 0.52), container.glyph);
  }
  layerCache.set(key, c);
  return c;
}

// Light styles get a brand-tinted sheen (a white one would vanish on a white chip);
// either way the sheen only lands on the icon's own pixels (source-atop), never the background.
function drawIcon(ctx, spec, px, { squash = 1, gleam = 0 } = {}) {
  ctx.fillStyle = spec.bg || "#ffffff";
  ctx.fillRect(0, 0, px, px);
  const layer = iconLayer(spec, px);
  let art = layer;
  if (gleam > 0 && gleam < 1) {
    const tmp = makeCanvas(px, px);
    tmp.ctx.drawImage(layer, 0, 0);
    tmp.ctx.globalCompositeOperation = "source-atop";
    const light = ["white", "soft", "outline"].includes(spec.style);
    const platform = PLATFORM_BY_ID[spec.platform];
    const tint = platform.id === "website" || !platform.brand || platform.brand === "#000000" ? spec.accent || "#ff6a00" : platform.brand;
    shine(tmp.ctx, 0, 0, px, px, gleam, light ? 0.42 : 0.6, light ? hex2rgb(tint) : null);
    art = tmp.c;
  }
  const m = px / 2;
  ctx.save();
  ctx.translate(m, m);
  ctx.scale(squash, squash);
  ctx.translate(-m, -m);
  ctx.drawImage(art, 0, 0);
  ctx.restore();
}

async function renderIcon(spec) {
  const size = spec.size || 28;
  const px = size * 2;
  const out = (blob) => ({ blob, width: size, height: size });
  if (!spec.anim || spec.anim === "none") return out(await still(px, px, (ctx) => drawIcon(ctx, spec, px)));
  // Every icon GIF has the same length; only the start offset differs, so the wave stays in sync.
  const start = 1 + Math.min(spec.index || 0, 6) * 4;
  const total = 50;
  if (spec.anim === "pop") {
    return out(
      film(px, px, total, (ctx, f) => drawIcon(ctx, spec, px, { squash: 1 - 0.13 * bump(prog(f, start, 14)) }), holdLast(2800, STEP))
    );
  }
  return out(film(px, px, total, (ctx, f) => drawIcon(ctx, spec, px, { gleam: prog(f, start, 24) }), holdLast(2800, STEP)));
}

// ---- CTA button --------------------------------------------------------------------

const ICON_PATHS = {
  arrow: ["M5 12h14", "M13 6l6 6-6 6"],
  calendar: ["M8 2v4", "M16 2v4", "M3 10h18", "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"],
  phone: [
    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",
  ],
  mail: ["M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M22 6l-10 7L2 6"],
  globe: ["M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20", "M2 12h20", "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],
  pin: ["M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z", "M12 7a3 3 0 1 0 0 6 3 3 0 1 0 0-6"],
};

// Small contact glyph (phone / mail / globe / pin) in a soft accent disc.
async function renderGlyph(spec) {
  const size = spec.size || 20;
  const k = 3;
  const px = size * k;
  return {
    blob: await still(px, px, (ctx) => {
      ctx.fillStyle = spec.bg || "#ffffff";
      ctx.fillRect(0, 0, px, px);
      if (spec.style !== "bare") {
        ctx.beginPath();
        ctx.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2);
        ctx.fillStyle = mix(spec.color || "#ff6a00", spec.bg || "#ffffff", 0.88);
        ctx.fill();
      }
      const g = spec.style === "bare" ? px * 0.86 : px * 0.5;
      drawLineIcon(ctx, spec.name, (px - g) / 2, (px - g) / 2, g, spec.color || "#ff6a00");
    }),
    width: size,
    height: size,
  };
}

function drawLineIcon(ctx, name, x, y, size, color) {
  const paths = ICON_PATHS[name];
  if (!paths) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  paths.forEach((d) => ctx.stroke(new Path2D(d)));
  ctx.restore();
}

const CTA_FONT = { Inter: "Inter, Arial, sans-serif", Arial: "Arial, sans-serif", Helvetica: "Helvetica, Arial, sans-serif", Georgia: "Georgia, serif" };

function ctaLayout(spec, ctx) {
  const k = 2;
  const label = String(spec.label || "Book a call").toUpperCase();
  ctx.font = `700 ${12 * k}px ${CTA_FONT[spec.font] || CTA_FONT.Inter}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${1.3 * k}px`;
  const tw = ctx.measureText(label).width;
  const icon = spec.icon && spec.icon !== "none" ? spec.icon : null;
  const iw = icon ? 14 * k : 0;
  const gap = icon ? 8 * k : 0;
  const padX = 19 * k;
  const H = 38 * k;
  const W = Math.ceil(tw + iw + gap + padX * 2);
  const m = spec.anim === "pulse" || spec.style === "neon" ? 9 * k : 0;
  return { k, label, tw, icon, iw, gap, padX, H, W, m };
}

function drawCta(ctx, spec, L, { gleam = 0, glow = 0.5, nudge = 0 } = {}) {
  const { k, label, tw, icon, iw, gap, padX, H, W, m } = L;
  const accent = spec.accent || "#ff6a00";
  const accent2 = spec.accent2 || mix(accent, "#ffffff", 0.35);
  const style = spec.style || "gradient";
  ctx.fillStyle = spec.bg || "#ffffff";
  ctx.fillRect(0, 0, W + m * 2, H + m * 2);
  const r = style === "pill" ? H / 2 : Math.min(H / 2, (spec.radius ?? 8) * k);
  const x = m;
  const y = m;
  const grad = () => {
    const g = ctx.createLinearGradient(x, y, x + W, y + H);
    g.addColorStop(0, accent);
    g.addColorStop(1, accent2);
    return g;
  };
  const look =
    {
      gradient: { fill: grad(), text: "#ffffff", icon: "#ffffff" },
      pill: { fill: grad(), text: "#ffffff", icon: "#ffffff" },
      solid: { fill: accent, text: "#ffffff", icon: "#ffffff" },
      outline: { fill: spec.bg || "#ffffff", stroke: accent, text: accent, icon: accent },
      glass: { fill: mix(accent, "#ffffff", 0.88), stroke: mix(accent, "#ffffff", 0.5), text: mix(accent, "#000000", 0.2), icon: accent, sheen: true },
      neon: { fill: "#0c0c0e", stroke: accent, text: "#ffffff", icon: accent, glowAlways: true },
      ink: { fill: "#111111", text: "#ffffff", icon: accent },
    }[style] || { fill: grad(), text: "#ffffff", icon: "#ffffff" };

  if (m && (spec.anim === "pulse" || look.glowAlways)) {
    ctx.save();
    ctx.shadowColor = rgba(accent, 0.3 + 0.55 * glow);
    ctx.shadowBlur = m * (0.6 + 0.9 * glow);
    rr(ctx, x, y, W, H, r);
    ctx.fillStyle = look.fill;
    ctx.fill();
    ctx.restore();
  }
  rr(ctx, x, y, W, H, r);
  ctx.fillStyle = look.fill;
  ctx.fill();
  if (look.sheen) {
    ctx.save();
    rr(ctx, x, y, W, H, r);
    ctx.clip();
    const s = ctx.createLinearGradient(0, y, 0, y + H);
    s.addColorStop(0, "rgba(255,255,255,0.75)");
    s.addColorStop(0.5, "rgba(255,255,255,0)");
    ctx.fillStyle = s;
    ctx.fillRect(x, y, W, H / 2);
    ctx.restore();
  }
  if (look.stroke) {
    rr(ctx, x + 0.75 * k, y + 0.75 * k, W - 1.5 * k, H - 1.5 * k, Math.max(0, r - 0.75 * k));
    ctx.strokeStyle = look.stroke;
    ctx.lineWidth = 1.5 * k;
    ctx.stroke();
  }
  ctx.fillStyle = look.text;
  ctx.textBaseline = "middle";
  ctx.font = `700 ${12 * k}px ${CTA_FONT[spec.font] || CTA_FONT.Inter}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${1.3 * k}px`;
  const tx = x + padX;
  ctx.fillText(label, tx, y + H / 2 + 0.5 * k);
  if (icon) drawLineIcon(ctx, icon, tx + tw + gap + nudge * k, y + (H - iw) / 2, iw, look.icon);
  if (gleam > 0) {
    ctx.save();
    rr(ctx, x, y, W, H, r);
    ctx.clip();
    shine(ctx, x, y, W, H, gleam, style === "glass" || style === "outline" ? 0.45 : 0.5);
    ctx.restore();
  }
}

async function renderCta(spec) {
  if (document.fonts?.load) {
    try {
      await document.fonts.load(`700 24px ${spec.font || "Inter"}`);
    } catch {
      /* fall back to Arial */
    }
  }
  const probe = makeCanvas(4, 4).ctx;
  const L = ctaLayout(spec, probe);
  const cw = L.W + L.m * 2;
  const ch = L.H + L.m * 2;
  const out = (blob) => ({ blob, width: Math.round(cw / L.k), height: Math.round(ch / L.k) });
  if (!spec.anim || spec.anim === "none") return out(await still(cw, ch, (ctx) => drawCta(ctx, spec, L)));
  if (spec.anim === "pulse") {
    const n = 40;
    return out(film(cw, ch, n, (ctx, f) => drawCta(ctx, spec, L, { glow: 0.5 - 0.5 * Math.cos((f / n) * Math.PI * 2) }), () => 50));
  }
  if (spec.anim === "arrow") {
    // Two quick nudges, then rest.
    return out(
      film(cw, ch, 34, (ctx, f) => drawCta(ctx, spec, L, { nudge: 4 * (bump(prog(f, 1, 14)) + bump(prog(f, 16, 14))) }), holdLast(1800, STEP))
    );
  }
  return out(film(cw, ch, 36, (ctx, f) => drawCta(ctx, spec, L, { gleam: prog(f, 1, 32) }), holdLast(2400, STEP)));
}

// Display size estimate before rendering (so the preview layout doesn't jump).
export function estimateSize(spec) {
  if (spec.kind === "cta") {
    const L = ctaLayout(spec, makeCanvas(4, 4).ctx);
    return { width: Math.round((L.W + L.m * 2) / L.k), height: Math.round((L.H + L.m * 2) / L.k) };
  }
  const s = spec.size || 24;
  return { width: s, height: s };
}

export async function renderAsset(spec) {
  if (spec.kind === "badge") return renderBadge(spec);
  if (spec.kind === "photo") return renderPhoto(spec);
  if (spec.kind === "icon") return renderIcon(spec);
  if (spec.kind === "cta") return renderCta(spec);
  if (spec.kind === "glyph") return renderGlyph(spec);
  throw new Error("Unknown asset " + spec.kind);
}

// Static first look of an icon for the editor's swatches (sync).
export function iconSwatch(spec) {
  const px = (spec.size || 28) * 2;
  const { c, ctx } = makeCanvas(px, px);
  drawIcon(ctx, spec, px);
  return c.toDataURL("image/png");
}
