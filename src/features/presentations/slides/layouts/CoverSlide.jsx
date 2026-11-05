import React from 'react';
import VisualBlock from '@/features/presentations/slides/VisualBlock';
import { fitPx } from '@/features/presentations/slides/SlideFrame';

export default function CoverSlide({ theme, slide }) {
  const withPanel = Boolean(slide.image_url || theme.logo || slide.needs_visual);
  const size = fitPx(slide.title, withPanel ? [[22, 84], [40, 72], [60, 62], [999, 54]] : [[30, 96], [50, 82], [999, 66]]);
  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', gap: 64 }}>
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        {theme.logo && slide.image_url ? (
          <img src={theme.logo} alt="" crossOrigin="anonymous" style={{ height: 44, maxWidth: 220, objectFit: 'contain', marginBottom: 34, display: 'block' }} />
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 30 }}>
          <span style={{ display: 'block', width: 46, height: 4, background: theme.accentGradient || theme.accent }} />
          <span style={{ fontFamily: theme.monoFont, fontSize: 15, letterSpacing: '0.2em', textTransform: 'uppercase', color: theme.eyebrowColor || theme.accentText || theme.muted }}>
            {slide.eyebrow || theme.brandName || 'Presentation'}
          </span>
        </div>
        <h1 style={{ fontFamily: theme.displayFont, fontSize: size, lineHeight: 1.02, fontWeight: theme.headingWeight || 600, letterSpacing: '-0.03em', margin: 0, maxWidth: withPanel ? '15ch' : '20ch', textWrap: 'balance' }}>
          {slide.title}
        </h1>
        {slide.subtitle ? (
          <p style={{ marginTop: 30, fontSize: 26, lineHeight: 1.4, color: theme.muted, maxWidth: '36ch' }}>{slide.subtitle}</p>
        ) : null}
      </div>
      {withPanel ? (
        <div style={{ width: 420, height: 500, flex: 'none' }}>
          <VisualBlock theme={theme} src={slide.image_url} logo={slide.image_url ? '' : theme.logo} />
        </div>
      ) : null}
    </div>
  );
}
