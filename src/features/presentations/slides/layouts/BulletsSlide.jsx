import React from 'react';
import SlideTitle, { SlideBody } from '@/features/presentations/slides/SlideTitle';
import BulletList from '@/features/presentations/slides/BulletList';

export default function BulletsSlide({ theme, slide }) {
  const bullets = (slide.bullets || []).filter((b) => String(b || '').trim());
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SlideTitle theme={theme} eyebrow={slide.eyebrow} title={slide.title} subtitle={slide.subtitle} />
      <SlideBody>
        {bullets.length ? (
          <BulletList theme={theme} bullets={bullets} />
        ) : slide.body ? (
          <p style={{ margin: 0, fontSize: 30, lineHeight: 1.4, maxWidth: '40ch', color: theme.fg }}>{slide.body}</p>
        ) : null}
      </SlideBody>
    </div>
  );
}
