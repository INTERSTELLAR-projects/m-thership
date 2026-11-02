import React from 'react';
import { createPortal } from 'react-dom';
import SlideRenderer from '@/features/presentations/slides/SlideRenderer';
import { getTheme, SLIDE_W, SLIDE_H } from '@/features/presentations/lib/slideThemes';

// Print-to-PDF: the browser prints only this surface, one 1280x720 slide per page, colours kept.
const PRINT_CSS = `
@media print {
  @page { size: ${SLIDE_W}px ${SLIDE_H}px; margin: 0; }
  html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
  body > *:not(.deck-print-root) { display: none !important; }
  .deck-print-root { position: static !important; opacity: 1 !important; z-index: auto !important; width: ${SLIDE_W}px !important; }
  .deck-print-root [data-export-slide] { width: ${SLIDE_W}px; height: ${SLIDE_H}px; overflow: hidden; break-after: page; page-break-after: always; }
  .deck-print-root [data-export-slide]:last-child { break-after: auto; page-break-after: auto; }
  .deck-print-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}`;

export default function ExportRenderer({ containerRef, slides, themeId, brand, deckTitle }) {
  const theme = getTheme(themeId, brand);

  // Portalled to <body> so the off-screen render surface is never clipped or
  // re-anchored by the host layout's transformed / scrolling containers.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={containerRef}
      aria-hidden="true"
      className="deck-print-root"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: SLIDE_W,
        zIndex: -1,
        opacity: 0.01,
        pointerEvents: 'none'
      }}
    >
      <style>{PRINT_CSS}</style>
      {slides.map((slide, index) => (
        <div key={slide.id || index} data-export-slide="">
          <SlideRenderer
            slide={slide}
            theme={theme}
            index={index}
            total={slides.length}
            deckTitle={deckTitle}
          />
        </div>
      ))}
    </div>,
    document.body
  );
}
