import React from 'react';
import SlideTitle from '@/features/presentations/slides/SlideTitle';

// One figure, as big as the slide allows. stats[0] = {value, label}; subtitle = context or source.
export default function BigStatSlide({ theme, slide }) {
  const stat = (slide.stats || [])[0] || { value: '—', label: 'Add the figure' };
  const value = String(stat.value || '—');
  const size = value.length > 7 ? 150 : value.length > 4 ? 190 : 230;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {slide.title || slide.eyebrow ? <SlideTitle theme={theme} eyebrow={slide.eyebrow} title={slide.title} size={36} /> : null}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 64 }}>
        <div
          style={{
            fontFamily: theme.displayFont || theme.headingFont,
            fontSize: size,
            lineHeight: 0.9,
            fontWeight: 700,
            letterSpacing: '-0.05em',
            color: theme.accent,
            whiteSpace: 'nowrap'
          }}
        >
          {value}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', width: 64, height: 4, marginBottom: 24, background: theme.accentGradient || theme.accent }} />
          <div style={{ fontSize: 30, lineHeight: 1.3, fontWeight: 500, color: theme.fg, maxWidth: '20ch' }}>{stat.label}</div>
          {slide.subtitle ? <p style={{ marginTop: 20, fontSize: 18, lineHeight: 1.5, color: theme.muted, maxWidth: '36ch' }}>{slide.subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}
