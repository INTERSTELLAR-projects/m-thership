import React from 'react';
import SlideTitle, { SlideBody } from '@/features/presentations/slides/SlideTitle';
import BulletList from '@/features/presentations/slides/BulletList';
import VisualBlock from '@/features/presentations/slides/VisualBlock';

// Image + text. Shows bullets, or the body when there are no bullets (v1 silently dropped the body).
export default function SplitSlide({ theme, slide }) {
  const bullets = (slide.bullets || []).filter((b) => String(b || '').trim());
  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'stretch', gap: 60 }}>
      <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <SlideTitle theme={theme} eyebrow={slide.eyebrow} title={slide.title} subtitle={slide.subtitle} size={50} maxWidth="20ch" />
        <SlideBody>
          {bullets.length ? (
            <BulletList theme={theme} bullets={bullets} size={bullets.length > 3 ? 24 : 26} />
          ) : slide.body ? (
            <p style={{ margin: 0, fontSize: 26, lineHeight: 1.45, color: theme.fg, maxWidth: '34ch' }}>{slide.body}</p>
          ) : null}
        </SlideBody>
      </div>
      <div style={{ width: 440, flex: 'none', alignSelf: 'center', height: 470 }}>
        <VisualBlock theme={theme} src={slide.image_url} />
      </div>
    </div>
  );
}
