import React from 'react';
import SlideTitle, { SlideBody } from '@/features/presentations/slides/SlideTitle';

// Comparison: two columns. The second column is the recommended / "after" side and carries the accent.
export default function CompareSlide({ theme, slide }) {
  const columns = (slide.columns || []).slice(0, 2);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SlideTitle theme={theme} eyebrow={slide.eyebrow} title={slide.title} subtitle={slide.subtitle} />
      <SlideBody>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26 }}>
          {columns.map((column, index) => {
            const hi = index === 1;
            const lines = String(column.text || '').split('\n').map((x) => x.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
            const px = lines.length > 3 || lines.some((x) => x.length > 48) ? 23 : 26;
            return (
              <div
                key={index}
                style={{
                  position: 'relative',
                  border: `${hi ? 2 : 1}px solid ${hi ? theme.accent : theme.border}`,
                  background: hi ? theme.accentSoft : theme.panel,
                  borderRadius: theme.radius,
                  padding: '30px 34px 34px',
                  minHeight: 250
                }}
              >
                <div style={{ fontFamily: theme.monoFont, fontSize: 16, letterSpacing: '0.16em', textTransform: 'uppercase', color: hi ? theme.accentText || theme.accent : theme.muted }}>
                  {column.heading}
                </div>
                <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {lines.map((line, i) => (
                    <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      <span style={{ flex: 'none', width: 10, height: 10, marginTop: Math.round(px * 0.5), borderRadius: hi ? 2 : '50%', background: hi ? theme.accent : theme.faint }} />
                      <span style={{ fontSize: px, lineHeight: 1.38, color: theme.fg }}>{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </SlideBody>
    </div>
  );
}
