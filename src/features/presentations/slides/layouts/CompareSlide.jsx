import React from 'react';
import SlideTitle from '@/components/slides/SlideTitle';

export default function CompareSlide({ theme, slide }) {
  const columns = (slide.columns || []).slice(0, 2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SlideTitle theme={theme} eyebrow={slide.eyebrow} title={slide.title} size={46} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
        {columns.map((column, index) => {
          const highlighted = index === 1;
          return (
            <div
              key={index}
              style={{
                border: `1px solid ${highlighted ? theme.accent : theme.border}`,
                background: highlighted ? theme.accentSoft : theme.panel,
                borderRadius: theme.radius,
                padding: '32px 34px',
                minHeight: 268
              }}
            >
              <div
                style={{
                  fontFamily: theme.monoFont,
                  fontSize: 13,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: highlighted ? theme.accent : theme.muted
                }}
              >
                {column.heading}
              </div>
              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {String(column.text || '')
                  .split('\n')
                  .filter((line) => line.trim())
                  .map((line, lineIndex) => (
                    <div key={lineIndex} style={{ fontSize: 19, lineHeight: 1.5, color: theme.fg }}>
                      {line}
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
