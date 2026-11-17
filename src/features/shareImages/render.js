// Share image renderer: 1200x630 Open Graph images drawn with the Canvas API.
// Layout math is a straight port of Justin's powerlift-reference-gen.py (Pillow):
//   home / default = logo centered (720 wide); page = logo (104 tall) | 2px white divider | UPPERCASE label,
//   46px gaps, label wraps to 2 lines max inside 520px and shrinks 64 -> 36 in 2px steps, group centered.
// Backgrounds are procedural presets tuned by the profile colors. No React in here so it can be tested on its own.

export const W = 1200;
export const H = 630;

export const PRESETS = {
  blueprint: { label: "Blueprint grid", hint: "Navy, soft glow, grid lines, corner ticks", colors: { primary: "#07112A", secondary: "#0C245C", accent: "#1F5BFF", glow: "#1646C8", text: "#FFFFFF" } },
  gradient: { label: "Gradient", hint: "Two-color sweep with soft light blobs", colors: { primary: "#F3EDE1", secondary: "#0A0A0A", accent: "#1A1A1A", glow: "#FFFFFF", text: "#FFFFFF" } },
  asphalt_stripes: { label: "Asphalt + stripes", hint: "Asphalt grain, twin racing stripes as the divider", colors: { primary: "#1E1E20", secondary: "#4A4A4D", accent: "#E10600", glow: "#6A6A6E", text: "#FFFFFF" } },
  grain_blur: { label: "Grain blur", hint: "Monochrome light blooms with film grain, a new shape per image", colors: { primary: "#050505", secondary: "#E9E9E9", accent: "#8E8E8E", glow: "#FFFFFF", text: "#FFFFFF" } },
  patina: { label: "Patina", hint: "Dark mottled metal, green and gold", colors: { primary: "#070B09", secondary: "#2F4A3B", accent: "#B88A3B", glow: "#5E4E26", text: "#FFFFFF" } },
  starfield: { label: "Starfield", hint: "Deep space, stars and a faint nebula", colors: { primary: "#030306", secondary: "#0B0B18", accent: "#FF6A00", glow: "#24123A", text: "#FFFFFF" } },
  stone: { label: "Stone", hint: "Veined stone texture in two tones", colors: { primary: "#2C8A86", secondary: "#69C7BE", accent: "#1C625F", glow: "#A8E8DF", text: "#FFFFFF" } },
  photo_blur: { label: "Photo blur", hint: "Background photo, blurred and darkened", colors: { primary: "#000000", secondary: "#1A1A1A", accent: "#FFFFFF", glow: "#FFFFFF", text: "#FFFFFF" } },
};
export const PRESET_KEYS = Object.keys(PRESETS);

export const DEFAULT_OPTIONS = {
  home_logo_width: 720,
  home_logo_max_height: 300,
  page_logo_height: 104,
  page_logo_max_width: 420,
  text_max_width: 520,
  grain: null, // null = preset default
  seed: 1,
};

const FALLBACK_FONT = { family: "SI Fallback Sans", url: "/fonts/inter-tight/inter-tight-800-normal-latin.woff2", weight: 800 };

// ---------- small helpers ----------
export function hexToRgb(hex) {
  let h = String(hex || "").trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return [0, 0, 0];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] * (1 - t) + b[i] * t));
const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

export function hashStr(s) {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function erf(x) {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
export function makeCanvas(w = W, h = H) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

// A filled ellipse after a Gaussian blur, drawn as a radial gradient (same look in every browser, no ctx.filter).
// sigma is in pixels like Pillow's GaussianBlur radius. inverse = fill outside the ellipse (vignette).
function blurredEllipse(ctx, { cx, cy, rx, ry, sigma, color, alpha, inverse = false, rotate = 0 }) {
  const s = sigma / ((rx + ry) / 2);
  const R = 1 + 3.2 * s;
  ctx.save();
  ctx.translate(cx, cy);
  if (rotate) ctx.rotate(rotate);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const r = (i / N) * R;
    let a = 0.5 * (1 - erf((r - 1) / (s * Math.SQRT2)));
    if (inverse) a = 1 - a;
    g.addColorStop(i / N, css(color, a * alpha));
  }
  ctx.fillStyle = g;
  ctx.fillRect(-60, -60, 120, 120);
  ctx.restore();
}

function addGrain(ctx, amount, rand) {
  if (!amount) return;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const k = amount * 255;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 2 * k;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// Smooth value noise (fbm) as a Float32Array of W*H in 0..1, made by upscaling small random grids.
function fbm(rand, { base = 6, octaves = 5, persistence = 0.55 } = {}) {
  const c = makeCanvas(W, H);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, W, H);
  let amp = 1;
  const weights = [];
  for (let o = 0; o < octaves; o++) { weights.push(amp); amp *= persistence; }
  let acc = 0;
  for (let o = 0; o < octaves; o++) {
    const gw = Math.max(2, Math.round(base * 2 ** o));
    const gh = Math.max(2, Math.round(gw * H / W));
    const small = makeCanvas(gw + 2, gh + 2);
    const sctx = small.getContext("2d");
    const id = sctx.createImageData(gw + 2, gh + 2);
    for (let i = 0; i < id.data.length; i += 4) { const v = rand() * 255; id.data[i] = v; id.data[i + 1] = v; id.data[i + 2] = v; id.data[i + 3] = 255; }
    sctx.putImageData(id, 0, 0);
    acc += weights[o];
    ctx.globalAlpha = weights[o] / acc; // running average
    ctx.drawImage(small, 1, 1, gw, gh, 0, 0, W, H);
  }
  ctx.globalAlpha = 1;
  const d = ctx.getImageData(0, 0, W, H).data;
  const out = new Float32Array(W * H);
  let mn = 1; let mx = 0;
  for (let i = 0, j = 0; j < out.length; i += 4, j++) { const v = d[i] / 255; out[j] = v; if (v < mn) mn = v; if (v > mx) mx = v; }
  const span = mx - mn || 1;
  for (let j = 0; j < out.length; j++) out[j] = (out[j] - mn) / span;
  return out;
}

function paintField(ctx, field, colorAt) {
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let j = 0, i = 0; j < field.length; j++, i += 4) {
    const c = colorAt(field[j], j % W, (j / W) | 0);
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
const ramp = (stops, t) => {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) { const [t0, c0] = stops[i - 1]; const [t1, c1] = stops[i]; return mix(c0, c1, (t - t0) / (t1 - t0 || 1)); }
  }
  return stops[stops.length - 1][1];
};

function drawCover(ctx, img, darken = 0.45, blurPasses = 3) {
  // Blur by stepping down then back up (soft, consistent across browsers).
  const iw = img.naturalWidth || img.width; const ih = img.naturalHeight || img.height;
  const sc = Math.max(W / iw, H / ih);
  const dw = iw * sc; const dh = ih * sc;
  let src = makeCanvas(W, H);
  src.getContext("2d").drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  for (let p = 0; p < blurPasses; p++) {
    const f = 2 ** (p + 2);
    const tiny = makeCanvas(Math.max(2, Math.round(W / f)), Math.max(2, Math.round(H / f)));
    const tctx = tiny.getContext("2d");
    tctx.imageSmoothingQuality = "high";
    tctx.drawImage(src, 0, 0, tiny.width, tiny.height);
    const up = makeCanvas(W, H);
    const uctx = up.getContext("2d");
    uctx.imageSmoothingQuality = "high";
    uctx.drawImage(tiny, 0, 0, W, H);
    src = up;
  }
  ctx.drawImage(src, 0, 0);
  ctx.fillStyle = `rgba(0,0,0,${darken})`;
  ctx.fillRect(0, 0, W, H);
}

// ---------- background presets ----------
const BACKGROUNDS = {
  blueprint(ctx, c) {
    // vertical gradient: BG0 -> 30% of the way to BG1
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, css(c.primary));
    g.addColorStop(1, css(mix(c.primary, c.secondary, 0.3)));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // glow: ellipse [0.18W,-0.35H,0.82W,0.95H] fill 150, blur 160
    blurredEllipse(ctx, { cx: W * 0.5, cy: H * 0.3, rx: W * 0.32, ry: H * 0.65, sigma: 160, color: c.glow, alpha: 150 / 255 });
    // grid every 30px, brighter every 150px
    const line = mix(c.accent, WHITE, 0.4);
    for (let x = 0; x <= W; x += 30) { ctx.fillStyle = css(line, (x % 150 ? 14 : 34) / 255); ctx.fillRect(x, 0, 1, H); }
    for (let y = 15; y <= H; y += 30) { ctx.fillStyle = css(line, ((y - 15) % 150 ? 14 : 34) / 255); ctx.fillRect(0, y, W, 1); }
    // vignette: outside ellipse [-0.15W,-0.3H,1.15W,1.3H] at 170, blur 120
    blurredEllipse(ctx, { cx: W / 2, cy: H / 2, rx: W * 0.65, ry: H * 0.8, sigma: 120, color: mix(c.primary, BLACK, 0.55), alpha: 170 / 255, inverse: true });
    // corner ticks
    ctx.fillStyle = css(mix(c.accent, WHITE, 0.5), 120 / 255);
    for (const [x, y, sx, sy] of [[36, 36, 1, 1], [W - 36, 36, -1, 1], [36, H - 36, 1, -1], [W - 36, H - 36, -1, -1]]) {
      ctx.fillRect(sx > 0 ? x : x - 22, y - 1, 23, 2);
      ctx.fillRect(x - 1, sy > 0 ? y : y - 22, 2, 23);
    }
  },

  gradient(ctx, c, rand, opts) {
    const ang = ((opts.gradient_angle ?? 0) * Math.PI) / 180;
    const dx = Math.cos(ang) * W / 2; const dy = Math.sin(ang) * H / 2;
    const g = ctx.createLinearGradient(W / 2 - dx, H / 2 - dy, W / 2 + dx, H / 2 + dy);
    const mid = opts.gradient_mid ?? 0.55;
    g.addColorStop(0, css(c.primary));
    g.addColorStop(Math.max(0.05, mid - 0.25), css(mix(c.primary, c.secondary, 0.35)));
    g.addColorStop(mid, css(c.secondary));
    g.addColorStop(1, css(c.secondary));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // two soft blobs so it never looks flat
    blurredEllipse(ctx, { cx: W * (0.15 + rand() * 0.3), cy: H * (0.1 + rand() * 0.3), rx: W * 0.35, ry: H * 0.4, sigma: 180, color: c.glow, alpha: 0.18, rotate: rand() * 0.6 - 0.3 });
    blurredEllipse(ctx, { cx: W * (0.55 + rand() * 0.35), cy: H * (0.65 + rand() * 0.3), rx: W * 0.4, ry: H * 0.35, sigma: 200, color: c.accent, alpha: 0.35, rotate: rand() * 0.6 - 0.3 });
  },

  asphalt_stripes(ctx, c, rand) {
    const field = fbm(rand, { base: 5, octaves: 6, persistence: 0.6 });
    const dark = c.primary; const light = c.secondary;
    paintField(ctx, field, (v) => mix(dark, light, Math.pow(v, 1.4) * 0.8));
    // aggregate speckle: dark pits and light stones
    for (let i = 0; i < 14000; i++) {
      const x = rand() * W; const y = rand() * H; const r = rand() * 1.6 + 0.3;
      ctx.fillStyle = rand() < 0.55 ? css(mix(dark, BLACK, 0.5), 0.55) : css(mix(light, WHITE, 0.35), 0.35);
      ctx.fillRect(x, y, r, r);
    }
    blurredEllipse(ctx, { cx: W / 2, cy: H / 2, rx: W * 0.7, ry: H * 0.85, sigma: 140, color: BLACK, alpha: 0.55, inverse: true });
  },

  grain_blur(ctx, c, rand) {
    ctx.fillStyle = css(c.primary); ctx.fillRect(0, 0, W, H);
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const big = rand() < 0.5;
      blurredEllipse(ctx, {
        cx: W * (rand() * 1.2 - 0.1), cy: H * (rand() * 1.2 - 0.1),
        rx: W * (big ? 0.35 + rand() * 0.3 : 0.12 + rand() * 0.2), ry: H * (0.12 + rand() * 0.45),
        sigma: 70 + rand() * 120, color: i % 2 ? c.secondary : c.glow, alpha: 0.55 + rand() * 0.4, rotate: rand() * Math.PI,
      });
    }
    // dark eye in the middle so the white label stays readable
    blurredEllipse(ctx, { cx: W / 2, cy: H / 2, rx: W * 0.36, ry: H * 0.2, sigma: 120, color: c.primary, alpha: 0.5 });
  },

  patina(ctx, c, rand, opts, assets) {
    if (assets.bgImage) { drawCover(ctx, assets.bgImage, 0.35, 1); }
    else {
      const f = fbm(rand, { base: 4, octaves: 6, persistence: 0.62 });
      const f2 = fbm(rand, { base: 9, octaves: 3, persistence: 0.5 });
      paintField(ctx, f, (v) => {
        const t = Math.min(1, Math.max(0, v * 1.1 - 0.05));
        return ramp([[0, c.primary], [0.45, mix(c.primary, c.secondary, 0.7)], [0.72, c.secondary], [0.9, mix(c.secondary, c.accent, 0.65)], [1, mix(c.accent, WHITE, 0.1)]], t);
      });
      // mottled highlights
      const img = ctx.getImageData(0, 0, W, H); const d = img.data;
      for (let j = 0, i = 0; j < f2.length; j++, i += 4) { const k = 0.75 + f2[j] * 0.5; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
      ctx.putImageData(img, 0, 0);
    }
    // darker on the left where the logo sits, plus edge shade
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, css(c.primary, 0.85)); g.addColorStop(0.45, css(c.primary, 0.55)); g.addColorStop(1, css(c.primary, 0.15));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    blurredEllipse(ctx, { cx: W / 2, cy: H / 2, rx: W * 0.7, ry: H * 0.8, sigma: 130, color: BLACK, alpha: 0.6, inverse: true });
  },

  starfield(ctx, c, rand) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, css(c.primary)); g.addColorStop(1, css(c.secondary));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    blurredEllipse(ctx, { cx: W * (0.2 + rand() * 0.6), cy: H * (0.2 + rand() * 0.6), rx: W * 0.4, ry: H * 0.3, sigma: 200, color: c.glow, alpha: 0.6, rotate: rand() - 0.5 });
    blurredEllipse(ctx, { cx: W * (0.1 + rand() * 0.8), cy: H * (0.1 + rand() * 0.8), rx: W * 0.18, ry: H * 0.14, sigma: 140, color: c.accent, alpha: 0.07 });
    for (let i = 0; i < 1100; i++) {
      const x = rand() * W; const y = rand() * H; const m = rand();
      const r = m > 0.985 ? 1.4 + rand() * 0.8 : m > 0.9 ? 0.9 + rand() * 0.4 : 0.35 + rand() * 0.5;
      ctx.fillStyle = css(mix(WHITE, rand() < 0.15 ? [255, 210, 170] : [200, 215, 255], rand() * 0.35), 0.25 + rand() * 0.7);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (m > 0.985) blurredEllipse(ctx, { cx: x, cy: y, rx: 7, ry: 7, sigma: 5, color: WHITE, alpha: 0.18 });
    }
    blurredEllipse(ctx, { cx: W / 2, cy: H / 2, rx: W * 0.7, ry: H * 0.85, sigma: 140, color: BLACK, alpha: 0.6, inverse: true });
  },

  stone(ctx, c, rand, opts, assets) {
    if (assets.bgImage) { drawCover(ctx, assets.bgImage, 0.2, 0); }
    else {
      const f = fbm(rand, { base: 3, octaves: 7, persistence: 0.58 });
      const v2 = fbm(rand, { base: 2, octaves: 5, persistence: 0.6 });
      paintField(ctx, f, (v, x, y) => {
        const vein = Math.pow(1 - Math.min(1, Math.abs(v2[y * W + x] - 0.5) * 9), 6); // thin bright veins
        const base = mix(c.primary, c.secondary, Math.min(1, Math.max(0, (v - 0.2) * 1.2)));
        return mix(mix(base, c.accent, Math.max(0, 0.45 - v) * 0.8), c.glow, vein * 0.55);
      });
    }
    blurredEllipse(ctx, { cx: W / 2, cy: H / 2, rx: W * 0.7, ry: H * 0.85, sigma: 150, color: mix(c.accent, BLACK, 0.6), alpha: 0.45, inverse: true });
  },

  photo_blur(ctx, c, rand, opts, assets) {
    if (assets.bgImage) {
      drawCover(ctx, assets.bgImage, opts.photo_darken ?? 0.5, 3);
      blurredEllipse(ctx, { cx: W / 2, cy: H / 2, rx: W * 0.7, ry: H * 0.85, sigma: 140, color: BLACK, alpha: 0.5, inverse: true });
    } else {
      BACKGROUNDS.gradient(ctx, c, rand, opts);
    }
  },
};

export const DEFAULT_GRAIN = { blueprint: 0, gradient: 0.035, asphalt_stripes: 0.07, grain_blur: 0.13, patina: 0.05, starfield: 0.015, stone: 0.05, photo_blur: 0.04 };
// Presets whose background changes from image to image (Justin's grain sets never repeat a shape).
const VARIES_PER_PAGE = new Set(["grain_blur"]);

export function resolvedColors(profile) {
  const preset = PRESETS[profile?.background_style] || PRESETS.gradient;
  const pc = profile?.colors || {};
  const pick = (k) => hexToRgb(pc[k] && /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(pc[k]) ? pc[k] : preset.colors[k]);
  return { primary: pick("primary"), secondary: pick("secondary"), accent: pick("accent"), glow: pick("glow"), text: pick("text") };
}
export const optionsOf = (profile) => ({ ...DEFAULT_OPTIONS, ...(profile?.options || {}) });

const bgCache = new Map();
function backgroundFor(profile, page, assets) {
  const style = PRESETS[profile?.background_style] ? profile.background_style : "gradient";
  const opts = optionsOf(profile);
  const variant = VARIES_PER_PAGE.has(style) ? page?.file_name || page?.key || "" : "";
  const key = JSON.stringify([style, profile?.colors, opts, profile?.background_image_url || "", !!assets.bgImage, variant]);
  if (bgCache.has(key)) return bgCache.get(key);
  const c = makeCanvas();
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const rand = rng(hashStr(`${opts.seed}|${style}|${variant}`));
  BACKGROUNDS[style](ctx, resolvedColors(profile), rand, opts, assets);
  addGrain(ctx, opts.grain ?? DEFAULT_GRAIN[style], rng(hashStr(`grain|${opts.seed}|${variant}`)));
  if (bgCache.size > 40) bgCache.delete(bgCache.keys().next().value);
  bgCache.set(key, c);
  return c;
}
export function clearBackgroundCache() { bgCache.clear(); }

// Twin worn racing stripes (Redline), used as the divider on asphalt_stripes.
const STRIPE_W = 44; const STRIPE_GAP = 26;
const STRIPE_BLOCK = STRIPE_W * 2 + STRIPE_GAP;
function drawStripes(ctx, x, color, seed) {
  const rand = rng(seed);
  const st = makeCanvas(STRIPE_BLOCK, H);
  const sctx = st.getContext("2d");
  sctx.fillStyle = css(color, 0.92);
  sctx.fillRect(0, 0, STRIPE_W, H);
  sctx.fillRect(STRIPE_W + STRIPE_GAP, 0, STRIPE_W, H);
  // worn paint: knock out flecks and streaks
  sctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 2600; i++) {
    const s = rand() * 2.4 + 0.4;
    sctx.fillStyle = `rgba(0,0,0,${0.35 + rand() * 0.6})`;
    sctx.fillRect(rand() * STRIPE_BLOCK, rand() * H, s, s * (1 + rand() * 2));
  }
  for (let i = 0; i < 40; i++) {
    sctx.fillStyle = `rgba(0,0,0,${0.08 + rand() * 0.15})`;
    sctx.fillRect(rand() * STRIPE_BLOCK, rand() * H, 1 + rand() * 6, 20 + rand() * 120);
  }
  sctx.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 6;
  ctx.drawImage(st, Math.round(x), 0);
  ctx.restore();
  return STRIPE_BLOCK;
}

function fitLogo(img, { width, maxHeight }) {
  const iw = img.naturalWidth || img.width; const ih = img.naturalHeight || img.height;
  let w = width; let h = (ih * w) / iw;
  if (h > maxHeight) { h = maxHeight; w = (iw * h) / ih; }
  return { w, h };
}
function fitPageLogo(img, { height, maxWidth }) {
  const iw = img.naturalWidth || img.width; const ih = img.naturalHeight || img.height;
  let h = height; let w = (iw * h) / ih;
  if (w > maxWidth) { w = maxWidth; h = (ih * w) / iw; }
  return { w, h };
}

export function labelText(profile, page) {
  const raw = String(page?.label || "").trim();
  return profile?.label_case === "as_typed" ? raw : raw.toUpperCase();
}

// Port of lines_for() + the shrink loop.
function layoutLabel(ctx, label, font, maxw) {
  const words = label.split(/\s+/).filter(Boolean);
  const linesFor = (sz) => {
    ctx.font = `${font.weight} ${sz}px "${font.family}"`;
    const ls = []; let cur = "";
    for (const w of words) {
      const t = (cur + " " + w).trim();
      if (ctx.measureText(t).width <= maxw) cur = t;
      else { if (cur) ls.push(cur); cur = w; }
    }
    ls.push(cur);
    return ls;
  };
  let size = 64;
  let ls = linesFor(size);
  const widest = () => Math.max(...ls.map((x) => ctx.measureText(x).width));
  while ((ls.length > 2 || widest() > maxw) && size > 36) { size -= 2; ls = linesFor(size); }
  return { size, lines: ls, width: widest(), overflow: ls.length > 2 || widest() > maxw };
}

/** Draw one share image into `canvas` (resized to 1200x630). Returns { overflow } for the label check. */
export function renderImage(canvas, profile, page, assets = {}) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const style = profile?.background_style;
  const opts = optionsOf(profile);
  const col = resolvedColors(profile);
  ctx.drawImage(backgroundFor(profile, page, assets), 0, 0);
  const logo = assets.logo;
  const font = assets.font || { family: "sans-serif", weight: 800 };
  const stripes = style === "asphalt_stripes";
  const seed = hashStr(`stripes|${opts.seed}|${page?.file_name || ""}`);

  if (!page || page.kind === "home" || page.kind === "default") {
    if (stripes) drawStripes(ctx, W * 0.82, col.accent, seed);
    if (logo) {
      const { w, h } = fitLogo(logo, { width: opts.home_logo_width, maxHeight: opts.home_logo_max_height });
      ctx.drawImage(logo, Math.floor((W - w) / 2), Math.floor((H - h) / 2), w, h);
    }
    return { overflow: false };
  }

  const label = labelText(profile, page);
  const { size, lines, width: tw, overflow } = layoutLabel(ctx, label, font, opts.text_max_width);
  const lg = logo ? fitPageLogo(logo, { height: opts.page_logo_height, maxWidth: opts.page_logo_max_width }) : { w: 0, h: 0 };
  const gap = stripes ? 64 : 46;
  const divW = stripes ? STRIPE_BLOCK : 2;
  const total = lg.w + gap * 2 + divW + tw;
  const x0 = Math.floor((W - total) / 2);
  if (logo) ctx.drawImage(logo, x0, Math.floor((H - lg.h) / 2), lg.w, lg.h);
  const dx = x0 + lg.w + gap;
  if (stripes) drawStripes(ctx, dx, col.accent, seed);
  else { ctx.fillStyle = "rgba(255,255,255,0.784)"; ctx.fillRect(Math.round(dx) - 1, H / 2 - 78, 2, 156); }

  ctx.font = `${font.weight} ${size}px "${font.family}"`;
  ctx.fillStyle = css(col.text);
  ctx.textBaseline = "alphabetic";
  const lh = Math.floor(size * 1.02);
  const th = lh * lines.length - (lh - size);
  const ty = H / 2 - th / 2;
  const tx = dx + divW + gap - (stripes ? 0 : 2);
  lines.forEach((t, i) => {
    const m = ctx.measureText(t);
    const asc = m.actualBoundingBoxAscent; const inkH = asc + m.actualBoundingBoxDescent;
    ctx.fillText(t, tx, ty + i * lh + (size - inkH) / 2 + asc);
  });
  return { overflow };
}

// ---------- assets ----------
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    if (!url) { reject(new Error("No URL")); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      // Make sure the canvas stays readable (no CORS taint) before we trust it.
      try { const c = makeCanvas(2, 2); const x = c.getContext("2d"); x.drawImage(img, 0, 0, 2, 2); x.getImageData(0, 0, 1, 1); resolve(img); }
      catch { reject(Object.assign(new Error("This image blocks cross-site reading (CORS)"), { code: "cors" })); }
    };
    img.onerror = () => reject(Object.assign(new Error("Image could not be loaded (missing, or blocked by CORS)"), { code: "load" }));
    img.src = url;
  });
}

const fontCache = new Map();
async function loadFace(family, url, weight) {
  const k = `${family}|${url}`;
  if (fontCache.has(k)) return fontCache.get(k);
  const p = (async () => {
    const ff = new FontFace(family, `url("${url}")`, { weight: "100 900", style: "normal" });
    await ff.load();
    document.fonts.add(ff);
    await document.fonts.load(`${weight} 64px "${family}"`);
    return true;
  })();
  fontCache.set(k, p);
  p.catch(() => fontCache.delete(k));
  return p;
}

/** Fonts, logo and background photo for a profile. Never throws; problems come back in notes. */
export async function prepareAssets(profile) {
  const out = { logo: null, bgImage: null, font: null, notes: [] };
  const weight = Number(profile?.font_weight) || 800;
  const fam = profile?.font_url ? `SI ${profile.font_family || "Display"} ${hashStr(profile.font_url) % 99999}` : null;
  const fontP = (async () => {
    if (fam) {
      try { await loadFace(fam, profile.font_url, weight); return { family: fam, weight, fallback: false, name: `${profile.font_family || "Custom"} ${weight}` }; }
      catch { out.notes.push({ kind: "font", text: "The font file did not load; using the bundled bold sans." }); }
    }
    try { await loadFace(FALLBACK_FONT.family, FALLBACK_FONT.url, 800); } catch { /* system sans */ }
    return { family: FALLBACK_FONT.family, weight: 800, fallback: true, name: "Inter Tight 800 (bundled)" };
  })();
  const logoP = profile?.logo_url
    ? loadImage(profile.logo_url).catch((e) => { out.notes.push({ kind: "logo", code: e.code, text: e.message }); return null; })
    : Promise.resolve(null);
  const needsBg = ["photo_blur", "stone", "patina"].includes(profile?.background_style) && profile?.background_image_url;
  const bgP = needsBg
    ? loadImage(profile.background_image_url).catch((e) => { out.notes.push({ kind: "background", code: e.code, text: e.message }); return null; })
    : Promise.resolve(null);
  [out.font, out.logo, out.bgImage] = await Promise.all([fontP, logoP, bgP]);
  return out;
}

export function canvasToJpeg(canvas, quality = 0.9) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode JPG"))), "image/jpeg", quality));
}

export const slugFile = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
