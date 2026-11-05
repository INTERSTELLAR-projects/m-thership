// Deck export (PDF / PPTX). Slides are snapshotted with html-to-image, which renders through the browser's own
// layout engine (SVG foreignObject), so exports match the screen: gradients, SVG charts, letter-spacing and
// line-heights included. (v1 used html2canvas, which re-implements CSS and misplaced labels and step numbers.)
// Fonts are inlined as data URLs so the snapshot uses the deck's real fonts; html2canvas stays as a per-slide
// fallback if a snapshot ever fails.
import { toJpeg } from 'html-to-image';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import PptxGenJS from 'pptxgenjs';
import { SLIDE_W, SLIDE_H } from '@/features/presentations/lib/slideThemes';
import { deckFontHrefs } from '@/features/presentations/lib/loadSlideFonts';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

const fontCache = new Map();
async function fontCssFor(href) {
  if (fontCache.has(href)) return fontCache.get(href);
  const p = (async () => {
    const css = await (await fetch(href)).text();
    // Google returns one @font-face per unicode subset, each preceded by a /* subset */ comment. Keep latin.
    const blocks = css.split('/*').map((b) => b.trim()).filter(Boolean);
    const keep = blocks.filter((b) => /^latin \*\//.test(b)).map((b) => b.replace(/^latin \*\//, '').trim());
    const faces = await Promise.all(
      keep.map(async (face) => {
        const m = face.match(/url\(([^)]+)\)/);
        if (!m) return '';
        const data = await blobToDataURL(await (await fetch(m[1].replace(/["']/g, ''))).blob());
        return face.replace(m[0], `url(${data})`);
      })
    );
    return faces.join('\n');
  })().catch(() => '');
  fontCache.set(href, p);
  return p;
}

async function embedFontCss(theme) {
  const parts = await Promise.all(deckFontHrefs(theme).map(fontCssFor));
  return parts.filter(Boolean).join('\n');
}

async function waitForImages(node) {
  const imgs = Array.from(node.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth
        ? Promise.resolve()
        : new Promise((r) => {
            img.addEventListener('load', r, { once: true });
            img.addEventListener('error', r, { once: true });
            setTimeout(r, 8000);
          })
    )
  );
}

async function snapshot(node, theme, fontEmbedCSS) {
  const opts = {
    width: SLIDE_W,
    height: SLIDE_H,
    canvasWidth: SLIDE_W * 2,
    canvasHeight: SLIDE_H * 2,
    pixelRatio: 1,
    quality: 0.93,
    backgroundColor: theme.bg,
    cacheBust: false,
    fontEmbedCSS: fontEmbedCSS || undefined,
    style: { opacity: '1', transform: 'none', margin: '0' }
  };
  try {
    // The first pass warms html-to-image's resource cache (images can drop on pass one).
    await toJpeg(node, opts).catch(() => null);
    await pause(30);
    const url = await toJpeg(node, opts);
    if (url && url.length > 2000) return url;
    throw new Error('empty snapshot');
  } catch {
    const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: theme.bg, logging: false, width: SLIDE_W, height: SLIDE_H, windowWidth: SLIDE_W, windowHeight: SLIDE_H });
    return canvas.toDataURL('image/jpeg', 0.93);
  }
}

export async function renderSlides(nodes, theme, onProgress) {
  if (document.fonts && document.fonts.ready) await document.fonts.ready.catch(() => {});
  if (onProgress) onProgress(0, nodes.length, 'rendering');
  const fontEmbedCSS = await embedFontCss(theme);
  const images = [];
  for (let i = 0; i < nodes.length; i += 1) {
    if (onProgress) onProgress(i, nodes.length, 'rendering');
    await waitForImages(nodes[i]);
    images.push(await snapshot(nodes[i], theme, fontEmbedCSS));
  }
  if (onProgress) onProgress(nodes.length, nodes.length, 'packing');
  return images;
}

export async function exportDeckToPdf(nodes, theme, fileName, onProgress, meta = {}) {
  const images = await renderSlides(nodes, theme, onProgress);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [SLIDE_W, SLIDE_H], hotfixes: ['px_scaling'], compress: true });
  pdf.setProperties({ title: meta.title || fileName, author: meta.author || '', creator: meta.author || '' });
  images.forEach((dataUrl, index) => {
    if (index > 0) pdf.addPage([SLIDE_W, SLIDE_H], 'landscape');
    pdf.addImage(dataUrl, 'JPEG', 0, 0, SLIDE_W, SLIDE_H, undefined, 'FAST');
  });
  pdf.save(`${fileName}.pdf`);
}

export async function exportDeckToPptx(nodes, { theme, fileName, title, slides, author, onProgress }) {
  const images = await renderSlides(nodes, theme, onProgress);
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'DECK_WIDE', width: 13.333, height: 7.5 });
  pptx.layout = 'DECK_WIDE';
  pptx.title = title || 'Presentation';
  pptx.subject = title || 'Presentation';
  pptx.author = author || '';
  pptx.company = author || '';

  images.forEach((dataUrl, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: String(theme.bg || '#FFFFFF').replace('#', '').slice(0, 6) };
    slide.addImage({ data: dataUrl, x: 0, y: 0, w: 13.333, h: 7.5 });
    const meta = slides && slides[index];
    const noteText = String((meta && meta.notes) || '').trim();
    if (noteText) slide.addNotes(noteText);
  });

  await pptx.writeFile({ fileName: `${fileName}.pptx` });
}
