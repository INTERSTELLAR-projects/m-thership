import { GIFEncoder, quantize, applyPalette } from "gifenc";

// frames: array of Uint8ClampedArray RGBA buffers (same width/height).
// delays: ms per frame. Consecutive identical frames are merged, and pixels that did not
// change since the previous frame are written as transparent (dispose = keep), so a photo
// with a moving ring only pays for the ring — not the whole photo — on every frame.
export function encodeGif(frames, { width, height, delays }) {
  const gif = GIFEncoder();
  const merged = [];
  frames.forEach((f, i) => {
    const prev = merged[merged.length - 1];
    if (prev && sameFrame(prev.data, f)) prev.delay += delays[i] ?? 60;
    else merged.push({ data: f, delay: delays[i] ?? 60 });
  });

  merged.forEach((f, i) => {
    const delay = Math.max(20, Math.round(f.delay));
    if (i === 0) {
      const palette = quantize(f.data, 256, { format: "rgb565" });
      const index = applyPalette(f.data, palette, "rgb565");
      gif.writeFrame(index, width, height, { palette, delay, repeat: 0, dispose: 1 });
      return;
    }
    const prev = merged[i - 1].data;
    const changed = changedOnly(f.data, prev);
    const palette = quantize(changed, 255, { format: "rgb565" });
    const index = applyPalette(f.data, palette, "rgb565");
    const transparentIndex = palette.length;
    palette.push([0, 0, 0]);
    for (let p = 0, q = 0; q < index.length; p += 4, q++) {
      if (f.data[p] === prev[p] && f.data[p + 1] === prev[p + 1] && f.data[p + 2] === prev[p + 2]) index[q] = transparentIndex;
    }
    gif.writeFrame(index, width, height, { palette, delay, transparent: true, transparentIndex, dispose: 1 });
  });
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}

// RGBA buffer where unchanged pixels are fully transparent, so the palette is spent on what moved.
function changedOnly(cur, prev) {
  const out = new Uint8ClampedArray(cur.length);
  let any = false;
  for (let p = 0; p < cur.length; p += 4) {
    if (cur[p] !== prev[p] || cur[p + 1] !== prev[p + 1] || cur[p + 2] !== prev[p + 2]) {
      out[p] = cur[p];
      out[p + 1] = cur[p + 1];
      out[p + 2] = cur[p + 2];
      out[p + 3] = 255;
      any = true;
    }
  }
  return any ? out : cur;
}

function sameFrame(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
