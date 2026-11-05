import React from 'react';
import { fitPx } from '@/features/presentations/slides/SlideFrame';

// Chapter divider: eyebrow (e.g. "02 · Approach"), one big title, one line under it.
export default function SectionSlide({ theme, slide }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
      {slide.eyebrow ? (
        <div style={{ fontFamily: theme.monoFont, fontSize: 18, letterSpacing: '0.22em', textTransform: 'uppercase', color: theme.eyebrowColor || theme.accentText || theme.accent, marginBottom: 28 }}>
          {slide.eyebrow}
        </div>
      ) : null}
      <h2 style={{ fontFamily: theme.displayFont || theme.headingFont, fontSize: fitPx(slide.title, [[24, 100], [44, 80], [999, 62]]), lineHeight: 1, fontWeight: theme.headingWeight || 600, letterSpacing: '-0.035em', margin: 0, maxWidth: '17ch', color: theme.fg, textWrap: 'balance' }}>
        {slide.title}
      </h2>
      <span style={{ display: 'block', width: 180, height: 6, marginTop: 40, background: theme.accentGradient || theme.accent }} />
      {slide.subtitle ? <p style={{ marginTop: 32, fontSize: 28, lineHeight: 1.4, color: theme.muted, maxWidth: '44ch' }}>{slide.subtitle}</p> : null}
    </div>
  );
}
