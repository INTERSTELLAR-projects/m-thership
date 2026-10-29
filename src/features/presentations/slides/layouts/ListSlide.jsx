import React from 'react';
import SlideTitle from '@/components/slides/SlideTitle';

const pad2 = (n) => String(n).padStart(2, '0');

export default function ListSlide({ theme, slide }) {
  const items = (slide.bullets || []).filter((b) => String(b || '').trim());
  const twoColumn = items.length > 3;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SlideTitle theme={theme} eyebrow={slide.eyebrow} title={slide.title} size={46} maxWidth="26ch" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: twoColumn ? '1fr 1fr' : '1fr',
          columnGap: 64
        }}
      >
        {items.map((item, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              gap: 20,
              alignItems: 'baseline',
              padding: '16px 0',
              borderTop: `1px solid ${theme.hairline}`
            }}
          >
            <span style={{ fontFamily: theme.monoFont, fontSize: 14, color: theme.accent, minWidth: 28 }}>
              {pad2(index + 1)}
            </span>
            <span style={{ fontSize: 19, lineHeight: 1.45, color: theme.fg }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
