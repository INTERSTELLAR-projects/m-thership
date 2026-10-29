import React from 'react';

export default function QuoteSlide({ theme, slide }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
      <div
        style={{
          fontFamily: theme.displayFont,
          fontSize: 100,
          lineHeight: 0.6,
          color: theme.accent,
          marginBottom: 30
        }}
      >
        &ldquo;
      </div>
      <blockquote
        style={{
          fontFamily: theme.displayFont,
          fontSize: 46,
          lineHeight: 1.24,
          letterSpacing: '-0.01em',
          margin: 0,
          maxWidth: '30ch'
        }}
      >
        {slide.body || slide.title}
      </blockquote>
      {slide.attribution ? (
        <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 18 }}>
          <span style={{ display: 'block', width: 56, height: 2, background: theme.accent }} />
          <span
            style={{
              fontFamily: theme.monoFont,
              fontSize: 13,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: theme.muted
            }}
          >
            {slide.attribution}
          </span>
        </div>
      ) : null}
    </div>
  );
}
