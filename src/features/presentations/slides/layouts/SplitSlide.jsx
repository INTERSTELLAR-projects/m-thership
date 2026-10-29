import React from 'react';
import SlideTitle from '@/components/slides/SlideTitle';
import BulletList from '@/components/slides/BulletList';
import VisualBlock from '@/components/slides/VisualBlock';

export default function SplitSlide({ theme, slide }) {
  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', gap: 60 }}>
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <SlideTitle theme={theme} eyebrow={slide.eyebrow} title={slide.title} size={46} maxWidth="22ch" />
        <BulletList theme={theme} bullets={slide.bullets} size={21} gap={20} />
      </div>
      <div style={{ width: 430, height: 440, flex: 'none' }}>
        <VisualBlock theme={theme} src={slide.image_url} />
      </div>
    </div>
  );
}
