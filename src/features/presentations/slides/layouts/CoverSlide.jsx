import React from 'react';
import VisualBlock from '@/features/presentations/slides/VisualBlock';

export default function CoverSlide({ theme, slide }) {
  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', gap: 68 }}>
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 34 }}>
          <span style={{ display: 'block', width: 46, height: 3, background: theme.accent }} />
          <span
            style={{
              fontFamily: theme.monoFont,
              fontSize: 14,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: theme.muted
            }}
          >
            {slide.eyebrow || 'Presentation'}
          </span>
        </div>
        <h1
          style={{
            fontFamily: theme.displayFont,
            fontSize: 80,
            lineHeight: 1.02,
            fontWeight: 600,
            letterSpacing: '-0.025em',
            margin: 0,
            maxWidth: '18ch'
          }}
        >
          {slide.title}
        </h1>
        {slide.subtitle ? (
          <p style={{ marginTop: 30, fontSize: 23, lineHeight: 1.5, color: theme.muted, maxWidth: '40ch' }}>
            {slide.subtitle}
          </p>
        ) : null}
      </div>
      <div style={{ width: 400, height: 420, flex: 'none' }}>
        <VisualBlock theme={theme} src={slide.image_url} />
      </div>
    </div>
  );
}
