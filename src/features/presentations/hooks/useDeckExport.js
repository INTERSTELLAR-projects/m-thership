import { useState } from 'react';
import { exportDeckToPdf, exportDeckToPptx } from '@/features/presentations/lib/exportDeck';
import { slugify, getTheme } from '@/features/presentations/lib/slideThemes';

export default function useDeckExport(containerRef, deck) {
  const [exporting, setExporting] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, phase: 'idle' });

  const run = async (kind) => {
    const container = containerRef.current;
    const nodes = container ? Array.from(container.querySelectorAll('[data-export-slide]')) : [];
    if (!nodes.length) throw new Error('There is nothing to export yet.');

    setExporting(kind);
    setProgress({ done: 0, total: nodes.length, phase: 'preparing' });
    try {
      const fileName = slugify(deck.title);
      const theme = getTheme(deck.theme, deck.brand);
      const onProgress = (done, total, phase) => setProgress({ done, total, phase });
      if (kind === 'pdf') {
        await exportDeckToPdf(nodes, theme, fileName, onProgress);
      } else {
        await exportDeckToPptx(nodes, {
          theme,
          fileName,
          title: deck.title,
          slides: deck.slides || [],
          onProgress
        });
      }
      return `${fileName}.${kind === 'pdf' ? 'pdf' : 'pptx'}`;
    } finally {
      setExporting(null);
      setProgress({ done: 0, total: 0, phase: 'idle' });
    }
  };

  return { exporting, progress, run };
}
