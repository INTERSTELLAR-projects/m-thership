import React from 'react';
import SlideTitle, { SlideBody } from '@/features/presentations/slides/SlideTitle';

const pad2 = (n) => String(n).padStart(2, '0');

// Bullets as cards: 2-4 parallel items {title, text}. Falls back to bullets when a deck has no cards yet.
export default function CardsSlide({ theme, slide }) {
  let cards = (slide.cards || []).filter((c) => c && (c.title || c.text));
  if (!cards.length) cards = (slide.bullets || []).filter(Boolean).slice(0, 4).map((b) => ({ title: '', text: b }));
  const n = Math.max(1, Math.min(cards.length, 4));
  const longest = Math.max(0, ...cards.map((c) => String(c.text || '').length));
  const textPx = n <= 2 ? 26 : n === 3 ? (longest > 90 ? 22 : 24) : longest > 70 ? 22 : 23;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SlideTitle theme={theme} eyebrow={slide.eyebrow} title={slide.title} subtitle={slide.subtitle} />
      <SlideBody>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: 22 }}>
          {cards.slice(0, 4).map((c, i) => (
            <div
              key={i}
              style={{
                position: 'relative',
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius,
                padding: '30px 28px 32px',
                minHeight: 230,
                overflow: 'hidden'
              }}
            >
              <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: i === 0 ? theme.accentGradient || theme.accent : theme.accent, opacity: i === 0 ? 1 : 0.55 }} />
              <div style={{ fontFamily: theme.monoFont, fontSize: 15, letterSpacing: '0.16em', color: theme.accentText || theme.accent }}>{pad2(i + 1)}</div>
              {c.title ? (
                <div style={{ marginTop: 18, fontFamily: theme.headingFont, fontSize: n <= 3 ? 30 : 27, lineHeight: 1.12, fontWeight: theme.headingWeight || 600, letterSpacing: '-0.015em', color: theme.fg }}>
                  {c.title}
                </div>
              ) : null}
              {c.text ? <div style={{ marginTop: 14, fontSize: textPx, lineHeight: 1.4, color: c.title ? theme.muted : theme.fg }}>{c.text}</div> : null}
            </div>
          ))}
        </div>
      </SlideBody>
    </div>
  );
}
