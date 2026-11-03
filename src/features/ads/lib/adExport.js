import { toPng } from "html-to-image";
import { base44 } from "@/api/base44Client";
import { dataUrlToBlob, getFontEmbedCss } from "@/features/social/lib/exportPng";

// Renders an ad frame node (see AdFrame.jsx) to a PNG at its true size and uploads it.
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export async function frameToPng(node, w, h) {
  if (!node) throw new Error("Nothing to export");
  if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
  const fontEmbedCSS = await getFontEmbedCss();
  const opts = { width: w, height: h, canvasWidth: w, canvasHeight: h, pixelRatio: 1, cacheBust: false, fontEmbedCSS: fontEmbedCSS || undefined, style: { transform: "none", margin: "0" } };
  await toPng(node, opts).catch(() => null); // warm-up pass (Safari drops images on the first one)
  await pause(30);
  return toPng(node, opts);
}

export async function uploadPng(dataUrl, name) {
  const blob = dataUrlToBlob(dataUrl);
  const file = new File([blob], name, { type: "image/png" });
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return file_url;
}
