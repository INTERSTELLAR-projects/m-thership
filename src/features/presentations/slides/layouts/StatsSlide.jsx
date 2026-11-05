import React from 'react';
import SlideTitle, { SlideBody } from '@/features/presentations/slides/SlideTitle';

export default function StatsSlide({ theme, slide }) {
  const items = (slide.stats || []).filter((s) => s && (s.value || s.label));
  const longest = Math.max(0, ...items.map((s) => String(s.value || '').length));
  const valuePx = items.length > 3 || longest > 7 ? 72 : 92;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SlideTitle theme={theme} eyebrow={slide.eyebrow} title={slide.title} />
      <SlideBody>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, items.length)}, minmax(0, 1fr))`, gap: 0 }}>
          {items.map((stat, index) => (
            <div key={index} style={{ minWidth: 0, padding: index === 0 ? '0 32px 0 0' : '0 32px', borderLeft: index === 0 ? 'none' : `2px solid ${theme.hairline}` }}>
              <div style={{ fontFamily: theme.headingFont, fontSize: valuePx, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1, color: theme.accentText || theme.accent, whiteSpace: 'nowrap' }}>
                {stat.value}
              </div>
              <div style={{ marginTop: 20, fontSize: 24, lineHeight: 1.35, color: theme.fg, maxWidth: '18ch' }}>{stat.label}</div>
            </div>
          ))}
        </div>
        {slide.subtitle ? <p style={{ margin: '44px 0 0', fontSize: 22, lineHeight: 1.45, color: theme.muted, maxWidth: '60ch' }}>{slide.subtitle}</p> : null}
      </SlideBody>
    </div>
  );
}
