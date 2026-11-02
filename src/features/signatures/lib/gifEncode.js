import { GIFEncoder, quantize } from "gifenc";

// High-quality GIF encoding for signature assets.
// - One shared palette for every frame (sampled across the animation), so colours never
//   flicker between frames.
// - 4×4 ordered (Bayer) dithering in full 8-bit precision, so gradients stay smooth instead
//   of banding. Ordered dithering is fixed per pixel, so still areas never shimmer.
// - Pixels that did not change since the previous frame are written as transparent
//   (dispose = keep): files stay small and only the moving part is redrawn.
// - Consecutive identical frames are merged into one longer frame.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v / 16 - 0.47) * 4);

export function encodeGif(frames, { width, height, delays }) {
  const merged = [];
  frames.forEach((f, i) => {
    const prev = merged[merged.length - 1];
    if (prev && sameFrame(prev.data, f)) prev.delay += delays[i] ?? 40;
    else merged.push({ data: f, delay: delays[i] ?? 40 });
  });

  const palette = buildPalette(merged.map((m) => m.data));
  const transparentIndex = palette.length;
  const fullPalette = [...palette, [0, 0, 0]];
  const nearest = makeNearest(palette);

  const gif = GIFEncoder();
  merged.forEach((f, i) => {
    const prev = i > 0 ? merged[i - 1].data : null;
    const data = f.data;
    const index = new Uint8Array(width * height);
    for (let y = 0, q = 0; y < height; y++) {
      for (let x = 0; x < width; x++, q++) {
        const p = q * 4;
        if (prev && data[p] === prev[p] && data[p + 1] === prev[p + 1] && data[p + 2] === prev[p + 2]) {
          index[q] = transparentIndex;
          continue;
        }
        const o = BAYER[(y & 3) * 4 + (x & 3)];
        index[q] = nearest(data[p] + o, data[p + 1] + o, data[p + 2] + o);
      }
    }
    const delay = Math.max(20, Math.round(f.delay));
    if (i === 0) gif.writeFrame(index, width, height, { palette: fullPalette, delay, repeat: 0, dispose: 1 });
    else gif.writeFrame(index, width, height, { delay, transparent: true, transparentIndex, dispose: 1 });
  });
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}

// 255-colour palette sampled from up to 6 frames spread across the animation.
function buildPalette(frames) {
  const picks = [...new Set([0, 0.2, 0.4, 0.5, 0.6, 0.8].map((t) => Math.round(t * (frames.length - 1))))];
  const px = frames[0].length / 4;
  const step = px * picks.length > 400000 ? 2 : 1;
  const sample = new Uint8ClampedArray(Math.ceil(px / step) * 4 * picks.length);
  let o = 0;
  for (const k of picks) {
    const d = frames[k];
    for (let p = 0; p < d.length; p += 4 * step) {
      sample[o++] = d[p];
      sample[o++] = d[p + 1];
      sample[o++] = d[p + 2];
      sample[o++] = 255;
    }
  }
  return quantize(sample.subarray(0, o), 255, { format: "rgb565" });
}

// Exact nearest-colour lookup (full precision) with a cache keyed on 6 bits per channel.
function makeNearest(palette) {
  const cache = new Map();
  const n = palette.length;
  return (r, g, b) => {
    r = r < 0 ? 0 : r > 255 ? 255 : r;
    g = g < 0 ? 0 : g > 255 ? 255 : g;
    b = b < 0 ? 0 : b > 255 ? 255 : b;
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const c = palette[i];
      const dr = c[0] - r;
      const dg = c[1] - g;
      const db = c[2] - b;
      const dist = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
      if (dist < bestD) {
        bestD = dist;
        best = i;
      }
    }
    cache.set(key, best);
    return best;
  };
}

function sameFrame(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
