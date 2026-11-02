import React from 'react';

export default function ClosingSlide({ theme, slide }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
      <h2
        style={{
          fontFamily: theme.headingFont,
          fontSize: 62,
          lineHeight: 1.06,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          margin: 0,
          maxWidth: '28ch'
        }}
      >
        {slide.body || slide.title}
      </h2>
      {slide.subtitle ? (
        <p style={{ marginTop: 30, fontSize: 24, lineHeight: 1.5, color: theme.muted, maxWidth: '46ch' }}>
          {slide.subtitle}
        </p>
      ) : null}
      <span
        style={{
          display: 'block',
          width: 96,
          height: 4,
          marginTop: 40,
          borderRadius: 4,
          background: theme.accentGradient || theme.accent
        }}
      />
    </div>
  );
}
