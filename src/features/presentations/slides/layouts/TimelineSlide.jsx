import React from 'react';
import SlideTitle, { SlideBody } from '@/features/presentations/slides/SlideTitle';

export default function TimelineSlide({ theme, slide }) {
  const steps = (slide.steps || []).slice(0, 5);
  const n = steps.length;
  const longest = Math.max(0, ...steps.map((s) => String(s.text || '').length));
  const px = n >= 5 || longest > 70 ? 22 : 24;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SlideTitle theme={theme} eyebrow={slide.eyebrow} title={slide.title} subtitle={slide.subtitle} />
      <SlideBody>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, n)}, minmax(0, 1fr))`, gap: 26 }}>
          {steps.map((step, index) => (
            <div key={index} style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 46,
                    height: 46,
                    flex: 'none',
                    borderRadius: '50%',
                    background: theme.accent,
                    color: theme.accentInk,
                    fontFamily: theme.monoFont,
                    fontSize: 18,
                    fontWeight: 600,
                    lineHeight: '46px'
                  }}
                >
                  {index + 1}
                </span>
                {index < n - 1 ? <span style={{ display: 'block', flex: 1, height: 2, background: theme.hairline }} /> : null}
              </div>
              <div style={{ marginTop: 24, fontFamily: theme.monoFont, fontSize: 16, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.accentText || theme.accent }}>{step.label}</div>
              <div style={{ marginTop: 12, fontSize: px, lineHeight: 1.38, color: theme.fg }}>{step.text}</div>
            </div>
          ))}
        </div>
      </SlideBody>
    </div>
  );
}
