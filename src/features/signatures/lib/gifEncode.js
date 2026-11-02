import { GIFEncoder, quantize, applyPalette } from "gifenc";

// frames: array of Uint8ClampedArray RGBA buffers (same width/height).
// delays: ms per frame. Consecutive identical frames are merged.
export function encodeGif(frames, { width, height, delays }) {
  const gif = GIFEncoder();
  const merged = [];
  frames.forEach((f, i) => {
    const prev = merged[merged.length - 1];
    if (prev && sameFrame(prev.data, f)) prev.delay += delays[i] ?? 60;
    else merged.push({ data: f, delay: delays[i] ?? 60 });
  });
  merged.forEach((f, i) => {
    const palette = quantize(f.data, 256, { format: "rgb565" });
    const index = applyPalette(f.data, palette, "rgb565");
    gif.writeFrame(index, width, height, {
      palette,
      delay: Math.max(20, Math.round(f.delay)),
      ...(i === 0 ? { repeat: 0 } : {}),
    });
  });
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}

function sameFrame(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
