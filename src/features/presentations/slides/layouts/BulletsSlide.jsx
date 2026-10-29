import React from 'react';
import SlideTitle from '@/features/presentations/slides/SlideTitle';
import BulletList from '@/features/presentations/slides/BulletList';

export default function BulletsSlide({ theme, slide }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SlideTitle theme={theme} eyebrow={slide.eyebrow} title={slide.title} size={50} />
      {slide.subtitle ? (
        <p style={{ fontSize: 21, lineHeight: 1.5, color: theme.muted, margin: '0 0 34px', maxWidth: '62ch' }}>
          {slide.subtitle}
        </p>
      ) : null}
      <BulletList theme={theme} bullets={slide.bullets} size={23} gap={24} />
    </div>
  );
}
