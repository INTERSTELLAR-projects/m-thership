import React from 'react';
import SlideTitle from '@/features/presentations/slides/SlideTitle';

// One figure, as big as the slide allows. stats[0] = {value, label}; subtitle = context or source.
export default function BigStatSlide({ theme, slide }) {
  const stat = (slide.stats || [])[0] || { value: '', label: '' };
  const value = String(stat.value || '');
  const size = value.length > 8 ? 140 : value.length > 5 ? 180 : 220;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {slide.title || slide.eyebrow ? <SlideTitle theme={theme} eyebrow={slide.eyebrow} title={slide.title} size={46} /> : null}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 64 }}>
        <div style={{ fontFamily: theme.displayFont || theme.headingFont, fontSize: size, lineHeight: 0.9, fontWeight: 700, letterSpacing: '-0.05em', color: theme.accentText || theme.accent, whiteSpace: 'nowrap' }}>
          {value}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', width: 64, height: 5, marginBottom: 24, background: theme.accentGradient || theme.accent }} />
          <div style={{ fontSize: 34, lineHeight: 1.25, fontWeight: 500, color: theme.fg, maxWidth: '18ch' }}>{stat.label}</div>
          {slide.subtitle ? <p style={{ marginTop: 20, fontSize: 24, lineHeight: 1.4, color: theme.muted, maxWidth: '30ch' }}>{slide.subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}
