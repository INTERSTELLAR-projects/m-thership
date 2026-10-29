import React from 'react';

export default function ImageSlide({ theme, slide }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
      <div
        style={{
          fontFamily: theme.monoFont,
          fontSize: 13,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.78)',
          marginBottom: 20
        }}
      >
        {slide.eyebrow}
      </div>
      <h2
        style={{
          fontFamily: theme.headingFont,
          fontSize: 58,
          lineHeight: 1.06,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          margin: 0,
          maxWidth: '22ch',
          color: '#FFFFFF'
        }}
      >
        {slide.title}
      </h2>
      {slide.subtitle ? (
        <p style={{ marginTop: 24, fontSize: 22, lineHeight: 1.5, color: 'rgba(255,255,255,0.84)', maxWidth: '50ch' }}>
          {slide.subtitle}
        </p>
      ) : null}
    </div>
  );
}
