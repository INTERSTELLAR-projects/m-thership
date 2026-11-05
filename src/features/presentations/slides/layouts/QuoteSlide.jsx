import React from 'react';
import { fitPx } from '@/features/presentations/slides/SlideFrame';

// A quote copied from the input (generation only allows verbatim, sourced quotes).
export default function QuoteSlide({ theme, slide }) {
  const text = slide.body || slide.title;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
      <div style={{ fontFamily: theme.displayFont, fontSize: 120, lineHeight: 0.6, color: theme.accent, marginBottom: 30 }}>&ldquo;</div>
      <blockquote style={{ fontFamily: theme.displayFont, fontSize: fitPx(text, [[90, 52], [150, 44], [999, 38]]), lineHeight: 1.22, letterSpacing: '-0.01em', margin: 0, maxWidth: '30ch' }}>
        {text}
      </blockquote>
      {slide.attribution ? (
        <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 18 }}>
          <span style={{ display: 'block', width: 56, height: 3, background: theme.accent }} />
          <span style={{ fontFamily: theme.monoFont, fontSize: 16, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.muted }}>{slide.attribution}</span>
        </div>
      ) : null}
    </div>
  );
}
