import React from 'react';

// Chapter divider: eyebrow (e.g. "02 · Approach"), one big title, one line under it.
export default function SectionSlide({ theme, slide }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
      {slide.eyebrow ? (
        <div
          style={{
            fontFamily: theme.monoFont,
            fontSize: 16,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: theme.eyebrowColor || theme.accent,
            marginBottom: 28
          }}
        >
          {slide.eyebrow}
        </div>
      ) : null}
      <h2
        style={{
          fontFamily: theme.displayFont || theme.headingFont,
          fontSize: 96,
          lineHeight: 1,
          fontWeight: theme.headingWeight || 600,
          letterSpacing: '-0.035em',
          margin: 0,
          maxWidth: '16ch',
          color: theme.fg
        }}
      >
        {slide.title}
      </h2>
      <span style={{ display: 'block', width: 180, height: 6, marginTop: 40, background: theme.accentGradient || theme.accent }} />
      {slide.subtitle ? (
        <p style={{ marginTop: 32, fontSize: 24, lineHeight: 1.5, color: theme.muted, maxWidth: '48ch' }}>{slide.subtitle}</p>
      ) : null}
    </div>
  );
}
