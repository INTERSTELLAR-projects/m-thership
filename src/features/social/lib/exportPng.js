import { toPng } from "html-to-image";
import JSZip from "jszip";
import { SIZE } from "../templates/kit";

// PNG export for social posts. html-to-image snapshots the live 1080x1080 node through an SVG
// foreignObject, so CSS gradients, background-clip:text and the grain overlay come out as they
// look on screen. Fonts: the Google Fonts sheet is cross-origin (its rules can't be read), so
// the Geist + JetBrains Mono latin faces are fetched once, inlined as data URLs and handed to
// html-to-image as fontEmbedCSS. That guarantees the exported PNG uses the brand fonts.

const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";

let fontCssPromise = null;

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("font read failed"));
    r.readAsDataURL(blob);
  });
}

async function buildFontCss() {
  const css = await (await fetch(FONT_CSS_URL)).text();
  // Google returns one @font-face per unicode subset, each preceded by a /* subset */ comment.
  const blocks = css.split("/*").map((b) => b.trim()).filter(Boolean);
  const keep = blocks.filter((b) => /^latin \*\//.test(b)).map((b) => b.replace(/^latin \*\//, "").trim());
  const faces = await Promise.all(
    keep.map(async (face) => {
      const m = face.match(/url\(([^)]+)\)/);
      if (!m) return "";
      const url = m[1].replace(/["']/g, "");
      const data = await blobToDataURL(await (await fetch(url)).blob());
      return face.replace(m[0], `url(${data})`);
    }),
  );
  return faces.join("\n");
}

export function getFontEmbedCss() {
  if (!fontCssPromise) {
    fontCssPromise = buildFontCss().catch(() => {
      fontCssPromise = null;
      return "";
    });
  }
  return fontCssPromise;
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForImages(node) {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.addEventListener("load", r, { once: true }); img.addEventListener("error", r, { once: true }); setTimeout(r, 5000); }))),
  );
}

/** Render a 1080x1080 post node to a PNG data URL at exactly 1080x1080. */
export async function postToPng(node) {
  if (!node) throw new Error("Nothing to export");
  if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
  await waitForImages(node);
  const fontEmbedCSS = await getFontEmbedCss();
  const opts = {
    width: SIZE,
    height: SIZE,
    canvasWidth: SIZE,
    canvasHeight: SIZE,
    pixelRatio: 1,
    cacheBust: false,
    fontEmbedCSS: fontEmbedCSS || undefined,
    style: { transform: "none", margin: "0" },
  };
  // First pass warms html-to-image's resource cache (Safari often drops images on pass one).
  await toPng(node, opts).catch(() => null);
  await pause(30);
  return toPng(node, opts);
}

export function slugify(s) {
  return String(s || "post").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "post";
}

export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(",");
  const mime = (head.match(/data:([^;]+)/) || [])[1] || "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** files: [{ name, dataUrl } | { name, text }] -> downloads one zip. */
export async function downloadZip(files, zipName) {
  const zip = new JSZip();
  for (const f of files) {
    if (f.dataUrl) zip.file(f.name, f.dataUrl.split(",")[1], { base64: true });
    else zip.file(f.name, f.text || "");
  }
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, zipName);
}
