import React from 'react';
import SlideTitle from '@/components/slides/SlideTitle';

export default function TimelineSlide({ theme, slide }) {
  const steps = (slide.steps || []).slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SlideTitle theme={theme} eyebrow={slide.eyebrow} title={slide.title} size={46} />
      <div style={{ display: 'flex', gap: 26, marginTop: 8 }}>
        {steps.map((step, index) => (
          <div key={index} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 38,
                  height: 38,
                  flex: 'none',
                  borderRadius: '50%',
                  background: index === 0 ? theme.accent : theme.panel,
                  border: `1px solid ${index === 0 ? theme.accent : theme.border}`,
                  color: index === 0 ? theme.accentInk : theme.fg,
                  fontFamily: theme.monoFont,
                  fontSize: 14
                }}
              >
                {index + 1}
              </span>
              <span style={{ display: 'block', flex: 1, height: 1, background: theme.hairline }} />
            </div>
            <div
              style={{
                marginTop: 24,
                fontFamily: theme.monoFont,
                fontSize: 13,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: theme.accent
              }}
            >
              {step.label}
            </div>
            <div style={{ marginTop: 14, fontSize: 18, lineHeight: 1.5, color: theme.muted }}>{step.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
