import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import PptxGenJS from 'pptxgenjs';
import { SLIDE_W, SLIDE_H } from '@/features/presentations/lib/slideThemes';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const dataUrlCache = new Map();

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

async function fetchAsDataURL(url) {
  if (dataUrlCache.has(url)) return dataUrlCache.get(url);
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`status ${response.status}`);
  const blob = await response.blob();
  const dataUrl = await blobToDataURL(blob);
  dataUrlCache.set(url, dataUrl);
  return dataUrl;
}

function whenImgSettled(img, timeout = 6000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    img.addEventListener('load', finish, { once: true });
    img.addEventListener('error', finish, { once: true });
    setTimeout(finish, timeout);
  });
}

function gradientFallback(img, theme) {
  img.removeAttribute('src');
  img.style.display = 'none';
  const parent = img.parentElement;
  if (parent) {
    parent.style.background = `linear-gradient(150deg, ${theme.accentSoft}, ${theme.bg} 78%)`;
  }
}

async function prepareImage(img, theme) {
  const original = img.currentSrc || img.src;
  if (!original) return;
  img.crossOrigin = 'anonymous';

  const trySet = async (url) => {
    const dataUrl = await fetchAsDataURL(url);
    img.src = dataUrl;
    await whenImgSettled(img);
    if (!img.naturalWidth) throw new Error('no natural width');
  };

  try {
    await trySet(original);
  } catch {
    try {
      await pause(300);
      await trySet(original);
    } catch {
      gradientFallback(img, theme);
    }
  }
}

async function settleImages(node, theme) {
  const images = Array.from(node.querySelectorAll('img'));
  await Promise.all(images.map((img) => prepareImage(img, theme)));
}

async function waitForFonts() {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* fonts unavailable: fall back to whatever is loaded */
    }
  }
}

export async function renderSlides(nodes, theme, onProgress) {
  await waitForFonts();
  if (onProgress) onProgress(0, nodes.length, 'rendering');
  const images = [];
  for (let i = 0; i < nodes.length; i += 1) {
    if (onProgress) onProgress(i, nodes.length, 'rendering');
    await settleImages(nodes[i], theme);
    await pause(40);
    const canvas = await html2canvas(nodes[i], {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      logging: false,
      width: SLIDE_W,
      height: SLIDE_H,
      windowWidth: SLIDE_W,
      windowHeight: SLIDE_H
    });
    images.push(canvas.toDataURL('image/png'));
    await pause(24);
  }
  if (onProgress) onProgress(nodes.length, nodes.length, 'packing');
  return images;
}

export async function exportDeckToPdf(nodes, theme, fileName, onProgress) {
  const images = await renderSlides(nodes, theme, onProgress);
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [SLIDE_W, SLIDE_H],
    hotfixes: ['px_scaling'],
    compress: true
  });
  images.forEach((dataUrl, index) => {
    if (index > 0) pdf.addPage([SLIDE_W, SLIDE_H], 'landscape');
    pdf.addImage(dataUrl, 'PNG', 0, 0, SLIDE_W, SLIDE_H);
  });
  pdf.save(`${fileName}.pdf`);
}

export async function exportDeckToPptx(nodes, { theme, fileName, title, slides, onProgress }) {
  const images = await renderSlides(nodes, theme, onProgress);
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'SLIDEFLOW_WIDE', width: 13.333, height: 7.5 });
  pptx.layout = 'SLIDEFLOW_WIDE';
  pptx.title = title || 'Presentation';
  pptx.subject = title || 'Presentation';
  pptx.author = 'SlideFlow';

  images.forEach((dataUrl, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    slide.addImage({ data: dataUrl, x: 0, y: 0, w: 13.333, h: 7.5 });
    const meta = slides && slides[index];
    const noteText = [meta && meta.title, meta && meta.notes]
      .map((s) => (s || '').trim())
      .filter(Boolean)
      .join('\n\n');
    if (noteText) slide.addNotes(noteText);
  });

  await pptx.writeFile({ fileName: `${fileName}.pptx` });
}
