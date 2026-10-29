import React from 'react';
import SlideTitle from '@/components/slides/SlideTitle';

export default function StatsSlide({ theme, slide }) {
  const stats = (slide.stats || []).filter((s) => s && (s.value || s.label));
  const items = stats.length ? stats : [{ value: '—', label: 'Add figures to this slide' }];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SlideTitle theme={theme} eyebrow={slide.eyebrow} title={slide.title} size={46} />
      <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 6 }}>
        {items.map((stat, index) => (
          <div
            key={index}
            style={{
              flex: 1,
              minWidth: 0,
              paddingLeft: index === 0 ? 0 : 36,
              marginLeft: index === 0 ? 0 : 36,
              borderLeft: index === 0 ? 'none' : `1px solid ${theme.hairline}`
            }}
          >
            <div
              style={{
                fontFamily: theme.headingFont,
                fontSize: items.length > 3 ? 64 : 80,
                fontWeight: theme.headingWeight || 600,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                color: theme.accent
              }}
            >
              {stat.value}
            </div>
            <div style={{ marginTop: 18, fontSize: 17, lineHeight: 1.5, color: theme.muted, maxWidth: '24ch' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
      {slide.subtitle ? (
        <p style={{ marginTop: 'auto', fontSize: 18, lineHeight: 1.5, color: theme.muted, maxWidth: '72ch' }}>
          {slide.subtitle}
        </p>
      ) : null}
    </div>
  );
}
