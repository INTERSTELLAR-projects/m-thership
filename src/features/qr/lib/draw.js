// Layout + export helpers shared by the live preview, library thumbnails and downloads.
import { encodeQR, eccFor } from "./encode";
import { layoutQR, drawCanvas, toSVG } from "./render";
import { fileSlug } from "./content";

export const buildLayout = (value, style) => layoutQR(encodeQR(value, eccFor(style)), style);

// Load a logo for drawing. Remote logos are requested with CORS so the canvas can still be exported.
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    if (!url) return resolve(null);
    const img = new Image();
    if (!url.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The logo couldn't be loaded for download. Re-upload it and try again."));
    img.src = url;
  });
}

const toDataUrl = async (url) => {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error("logo fetch failed");
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
};

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function downloadPNG(value, style, name, pixelWidth = 2048) {
  const logo = await loadImage(style?.logo_url);
  const canvas = document.createElement("canvas");
  drawCanvas(canvas, buildLayout(value, style), { pixelWidth, logoImg: logo });
  const blob = await new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't export the PNG."))), "image/png");
    } catch {
      reject(new Error("The logo's host blocks downloads. Re-upload the logo, then try again."));
    }
  });
  saveBlob(blob, `${fileSlug(name)}.png`);
}

export async function downloadSVG(value, style, name) {
  let href = style?.logo_url || "";
  if (href && !href.startsWith("data:")) href = await toDataUrl(href).catch(() => href);
  const svg = toSVG(buildLayout(value, style), { logoHref: href });
  saveBlob(new Blob([svg], { type: "image/svg+xml" }), `${fileSlug(name)}.svg`);
}
