import React from 'react';
import { createPortal } from 'react-dom';
import SlideRenderer from '@/features/presentations/slides/SlideRenderer';
import { getTheme, SLIDE_W } from '@/features/presentations/lib/slideThemes';

export default function ExportRenderer({ containerRef, slides, themeId, brand, deckTitle }) {
  const theme = getTheme(themeId, brand);

  // Portalled to <body> so the off-screen render surface is never clipped or
  // re-anchored by the host layout's transformed / scrolling containers.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={containerRef}
      aria-hidden="true"
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
