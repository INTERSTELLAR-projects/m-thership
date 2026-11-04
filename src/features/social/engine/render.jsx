import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toJpeg } from "html-to-image";
import { jsPDF } from "jspdf";
import { base44 } from "@/api/base44Client";
import { specHash } from "../lib/specHash";
import { dataUrlToBlob, downloadDataUrl, downloadZip, getFontEmbedCss, slugify } from "../lib/exportPng";
import { RATIOS, formatOf } from "./platforms";
import { RatioCanvas, SlideCanvas, brandStyle, slidesOf } from "./Ratios";

// Renders a variant's assets offscreen at full size (JPEG, + PDF for LinkedIn documents), uploads them to public
// storage (platform APIs fetch by URL) and returns the fields to store on the SocialVariant.

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 80)));

async function nodeToJpeg(node, w, h) {
  if (!node) throw new Error("Nothing to render");
  if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
  await Promise.all(Array.from(node.querySelectorAll("img")).map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; setTimeout(r, 5000); }))));
  const fontEmbedCSS = await getFontEmbedCss();
  const opts = { width: w, height: h, canvasWidth: w, canvasHeight: h, pixelRatio: 1, quality: 0.92, backgroundColor: "#141414", cacheBust: false, fontEmbedCSS: fontEmbedCSS || undefined, style: { transform: "none", margin: "0" } };
  await toJpeg(node, opts).catch(() => null); // warm-up pass (Safari drops images on pass one)
  return toJpeg(node, opts);
}

async function upload(dataUrlOrBlob, name, type) {
  const blob = typeof dataUrlOrBlob === "string" ? dataUrlToBlob(dataUrlOrBlob) : dataUrlOrBlob;
  const { file_url } = await base44.integrations.Core.UploadFile({ file: new File([blob], name, { type }) });
  if (!file_url) throw new Error("Upload returned no URL");
  return file_url;
}

function pdfOf(pages, r) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [r.w, r.h], hotfixes: ["px_scaling"] });
  pages.forEach((p, i) => { if (i) pdf.addPage([r.w, r.h], "portrait"); pdf.addImage(p, "JPEG", 0, 0, r.w, r.h); });
  return pdf;
}

/** What the rendered image depends on: changing any of it marks the variant's image stale. */
export function renderHash(variant, idea, brand) {
  const f = formatOf(variant.platform, variant.format);
  return specHash(`${variant.ratio || f?.ratio}|${variant.format}`, { design: idea?.design || null, visual: idea?.extraction?.visual || null, slides: f?.slides ? slidesOf(idea) : null, colors: brandStyle(brand) });
}
export const imageStale = (variant, idea, brand) => !!variant.render_hash && variant.render_hash !== renderHash(variant, idea, brand);

export function useVariantRenderer() {
  const [job, setJob] = useState(null); // { ratio, idea, brand, slides }
  const ref = useRef(null);
  const slideRefs = useRef([]);

  const capture = useCallback(async (variant, idea, brand) => {
    const f = formatOf(variant.platform, variant.format);
    const ratio = variant.ratio || f?.ratio || "square";
    const r = RATIOS[ratio];
    const slides = f?.slides ? slidesOf(idea) : [];
    setJob({ ratio, idea, brand, slides });
    await nextFrame(); await nextFrame();
    try {
      const pages = [await nodeToJpeg(ref.current, r.w, r.h)];
      for (let i = 0; i < slides.length; i++) pages.push(await nodeToJpeg(slideRefs.current[i], r.w, r.h));
      return { ratio, r, pages };
    } finally {
      setJob(null);
    }
  }, []);

  /** Render + upload; returns SocialVariant fields. */
  const render = useCallback(async (variant, idea, brand) => {
    const { ratio, r, pages } = await capture(variant, idea, brand);
    const base = `${slugify(idea?.title || variant.platform)}-${variant.platform}-${Date.now().toString(36)}`;
    const fields = { ratio, render_hash: renderHash(variant, idea, brand), rendered_at: new Date().toISOString() };
    if (formatOf(variant.platform, variant.format)?.pdf) {
      fields.document_url = await upload(pdfOf(pages, r).output("blob"), `${base}.pdf`, "application/pdf");
      fields.image_url = await upload(pages[0], `${base}.jpg`, "image/jpeg");
      fields.image_urls = [fields.image_url];
    } else {
      fields.image_urls = [];
      for (let i = 0; i < pages.length; i++) fields.image_urls.push(await upload(pages[i], `${base}${pages.length > 1 ? `-${i + 1}` : ""}.jpg`, "image/jpeg"));
      fields.image_url = fields.image_urls[0];
    }
    return fields;
  }, [capture]);

  /** Local download (manual assist): one JPEG, or a zip of slides (+ the PDF for documents). */
  const download = useCallback(async (variant, idea, brand) => {
    const { r, pages } = await capture(variant, idea, brand);
    const base = `${slugify(idea?.title || "post")}-${variant.platform}-${variant.format}`;
    if (pages.length === 1) return downloadDataUrl(pages[0], `${base}.jpg`);
    const files = pages.map((p, i) => ({ name: `${base}-${i + 1}.jpg`, dataUrl: p }));
    if (formatOf(variant.platform, variant.format)?.pdf) files.push({ name: `${base}.pdf`, dataUrl: pdfOf(pages, r).output("datauristring") });
    return downloadZip(files, `${base}.zip`);
  }, [capture]);

  const node = job
    ? createPortal(
      <div aria-hidden="true" style={{ position: "fixed", left: -30000, top: 0, pointerEvents: "none" }}>
        <RatioCanvas ref={ref} ratio={job.ratio} idea={job.idea} brand={job.brand} />
        {job.slides.map((s, i) => (
          <SlideCanvas key={i} ref={(el) => { slideRefs.current[i] = el; }} ratio={job.ratio} slide={s} index={i} total={job.slides.length} brand={job.brand} />
        ))}
      </div>,
      document.body,
    )
    : null;
  return { render, download, node, busy: !!job };
}
