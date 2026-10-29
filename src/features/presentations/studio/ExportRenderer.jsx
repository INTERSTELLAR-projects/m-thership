import React from 'react';
import SlideRenderer from '@/components/slides/SlideRenderer';
import { getTheme, SLIDE_W } from '@/lib/slideThemes';

export default function ExportRenderer({ containerRef, slides, themeId, brand, deckTitle }) {
  const theme = getTheme(themeId, brand);

  return (
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
    </div>
  );
}
