import React from 'react';
import { fitPx } from '@/features/presentations/slides/SlideFrame';

// One decisive statement + the concrete next step, with the client's logo when the brand has one.
export default function ClosingSlide({ theme, slide }) {
  const text = slide.body || slide.title;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
      {slide.eyebrow ? (
        <div style={{ fontFamily: theme.monoFont, fontSize: 15, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.eyebrowColor || theme.accentText || theme.accent, marginBottom: 24 }}>{slide.eyebrow}</div>
      ) : null}
      <h2 style={{ fontFamily: theme.headingFont, fontSize: fitPx(text, [[40, 72], [80, 60], [130, 50], [999, 42]]), lineHeight: 1.06, fontWeight: theme.headingWeight || 600, letterSpacing: '-0.025em', margin: 0, maxWidth: '24ch', textWrap: 'balance' }}>
        {text}
      </h2>
      {slide.subtitle ? (
        <div style={{ marginTop: 40, display: 'inline-flex', alignItems: 'center', gap: 18, alignSelf: 'flex-start', padding: '18px 26px', borderRadius: theme.radius, background: theme.accent, color: theme.accentInk, fontSize: 26, lineHeight: 1.3, fontWeight: 600, maxWidth: '46ch' }}>
          {slide.subtitle}
        </div>
      ) : (
        <span style={{ display: 'block', width: 96, height: 5, marginTop: 40, background: theme.accentGradient || theme.accent }} />
      )}
      {theme.logo ? <img src={theme.logo} alt="" crossOrigin="anonymous" style={{ position: 'absolute', right: 88, bottom: 92, height: 54, maxWidth: 220, objectFit: 'contain' }} /> : null}
    </div>
  );
}
