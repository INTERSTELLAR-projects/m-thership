import React from 'react';
import { SLIDE_W, SLIDE_H } from '@/features/presentations/lib/slideThemes';
import loadSlideFonts, { loadBrandFonts } from '@/features/presentations/lib/loadSlideFonts';

loadSlideFonts();

const pad2 = (n) => String(n).padStart(2, '0');

// Pick a font size from text length: steps = [[maxChars, px], ...] ascending.
export const fitPx = (text, steps) => {
  const n = String(text || '').length;
  for (const [max, px] of steps) if (n <= max) return px;
  return steps[steps.length - 1][1];
};

// 1280x720 stage. Footer + top bar are marked data-chrome so readability checks skip them.
export default function SlideFrame({
  theme,
  index = 0,
  total = 1,
  deckTitle = '',
  backdrop = null,
  children,
  pad = '68px 88px 92px',
  hideFooter = false
}) {
  const b = theme.brand;
  if (b) loadBrandFonts([b.headingFamily, b.bodyFamily]);
  const footerColor = backdrop ? 'rgba(255,255,255,0.7)' : theme.faint;
  return (
    <div
      style={{
        position: 'relative',
        width: SLIDE_W,
        height: SLIDE_H,
        flex: 'none',
        overflow: 'hidden',
        background: theme.bgGradient || theme.bg,
        backgroundColor: theme.bg,
        color: theme.fg,
        fontFamily: theme.bodyFont
      }}
    >
      {backdrop}

      <div
        data-chrome=""
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: theme.accentGradient ? '100%' : 236,
          height: 6,
          background: theme.accentGradient || theme.accent
        }}
      />

      <div style={{ position: 'relative', height: '100%', padding: pad, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>

      {!hideFooter && (
        <div
          data-chrome=""
          style={{
            position: 'absolute',
            left: 88,
            right: 88,
            bottom: 30,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 24,
            fontFamily: theme.monoFont,
            fontSize: 13,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: footerColor
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            {theme.logo ? (
              <img src={theme.logo} alt="" crossOrigin="anonymous" style={{ height: 22, maxWidth: 120, objectFit: 'contain', flex: 'none' }} />
            ) : null}
            <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 640 }}>{deckTitle}</span>
          </span>
          <span style={{ flex: 'none' }}>
            {pad2(index + 1)} / {pad2(total)}
          </span>
        </div>
      )}
    </div>
  );
}
