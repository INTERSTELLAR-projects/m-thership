import React from 'react';

export default function SlideTitle({ theme, eyebrow, title, size = 52, color, maxWidth = '30ch', style }) {
  return (
    <div style={{ marginBottom: 34, ...style }}>
      {eyebrow ? (
        <div
          style={{
            fontFamily: theme.monoFont,
            fontSize: 13,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: theme.eyebrowColor || theme.accent,
            marginBottom: 16
          }}
        >
          {eyebrow}
        </div>
      ) : null}
      <h2
        style={{
          fontFamily: theme.headingFont,
          fontSize: size,
          lineHeight: 1.08,
          fontWeight: theme.headingWeight || 600,
          letterSpacing: '-0.02em',
          margin: 0,
          maxWidth,
          color: color || theme.fg
        }}
      >
        {title}
      </h2>
    </div>
  );
}
