import React from 'react';
import { fitPx } from '@/features/presentations/slides/SlideFrame';

// Eyebrow + takeaway title (+ optional subtitle). The title shrinks for long takeaways so it never wraps past
// two lines.
export default function SlideTitle({ theme, eyebrow, title, subtitle, size = 54, color, maxWidth = '28ch', style }) {
  const px = Math.min(size, fitPx(title, [[28, size], [44, Math.round(size * 0.9)], [64, Math.round(size * 0.8)], [999, Math.round(size * 0.7)]]));
  return (
    <div style={{ marginBottom: 30, flex: 'none', ...style }}>
      {eyebrow ? (
        <div
          style={{
            fontFamily: theme.monoFont,
            fontSize: 15,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: theme.eyebrowColor || theme.accentText || theme.accent,
            marginBottom: 16
          }}
        >
          {eyebrow}
        </div>
      ) : null}
      <h2
        style={{
          fontFamily: theme.headingFont,
          fontSize: px,
          lineHeight: 1.06,
          fontWeight: theme.headingWeight || 600,
          letterSpacing: '-0.025em',
          margin: 0,
          maxWidth,
          color: color || theme.fg,
          textWrap: 'balance'
        }}
      >
        {title}
      </h2>
      {subtitle ? (
        <p style={{ margin: '18px 0 0', fontSize: 24, lineHeight: 1.4, color: theme.muted, maxWidth: '56ch' }}>{subtitle}</p>
      ) : null}
    </div>
  );
}

// The area under the title: fills the remaining height and centres its content vertically, so short slides
// don't leave the bottom half empty.
export function SlideBody({ children, align = 'center', style }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: align, ...style }}>
      {children}
    </div>
  );
}
