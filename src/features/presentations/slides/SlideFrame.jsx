import React from 'react';
import { SLIDE_W, SLIDE_H } from '@/lib/slideThemes';

const pad2 = (n) => String(n).padStart(2, '0');

export default function SlideFrame({
  theme,
  index = 0,
  total = 1,
  deckTitle = '',
  backdrop = null,
  children,
  pad = '74px 88px 96px',
  hideFooter = false
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: SLIDE_W,
        height: SLIDE_H,
        flex: 'none',
        overflow: 'hidden',
        background: theme.bgGradient || theme.bg,
        color: theme.fg,
        fontFamily: theme.bodyFont
      }}
    >
      {backdrop}

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 236,
          height: 5,
          background: theme.accent,
          opacity: 0.95
        }}
      />

      {!backdrop && (
        <div
          style={{
            position: 'absolute',
            right: -150,
            top: -170,
            width: 540,
            height: 540,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${theme.accentSoft}, rgba(255,255,255,0))`
          }}
        />
      )}

      <div style={{ position: 'relative', height: '100%', padding: pad, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>

      {!hideFooter && (
        <div
          style={{
            position: 'absolute',
            left: 88,
            right: 88,
            bottom: 34,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: theme.monoFont,
            fontSize: 12,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: backdrop ? 'rgba(255,255,255,0.62)' : theme.faint
          }}
        >
          <span style={{ maxWidth: 620, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {deckTitle}
          </span>
          <span>
            {pad2(index + 1)} / {pad2(total)}
          </span>
        </div>
      )}
    </div>
  );
}
