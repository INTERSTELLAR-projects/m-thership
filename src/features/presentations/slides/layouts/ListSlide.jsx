import React from 'react';
import SlideTitle, { SlideBody } from '@/features/presentations/slides/SlideTitle';

const pad2 = (n) => String(n).padStart(2, '0');

export default function ListSlide({ theme, slide }) {
  const items = (slide.bullets || []).filter((b) => String(b || '').trim());
  const twoColumn = items.length > 4;
  const longest = Math.max(0, ...items.map((x) => String(x).length));
  const px = twoColumn ? (longest > 48 ? 22 : 24) : longest > 60 ? 25 : 28;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SlideTitle theme={theme} eyebrow={slide.eyebrow} title={slide.title} subtitle={slide.subtitle} />
      <SlideBody>
        <div style={{ display: 'grid', gridTemplateColumns: twoColumn ? '1fr 1fr' : '1fr', columnGap: 56 }}>
          {items.map((item, index) => (
            <div key={index} style={{ display: 'flex', gap: 22, alignItems: 'baseline', padding: '18px 0', borderTop: `2px solid ${theme.hairline}` }}>
              <span style={{ fontFamily: theme.monoFont, fontSize: 18, color: theme.accentText || theme.accent, minWidth: 30 }}>{pad2(index + 1)}</span>
              <span style={{ fontSize: px, lineHeight: 1.35, color: theme.fg }}>{item}</span>
            </div>
          ))}
        </div>
      </SlideBody>
    </div>
  );
}
