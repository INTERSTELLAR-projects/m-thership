import React from 'react';

export default function ImageSlide({ theme, slide }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
      {slide.eyebrow ? (
        <div style={{ fontFamily: theme.monoFont, fontSize: 15, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.82)', marginBottom: 20 }}>{slide.eyebrow}</div>
      ) : null}
      <h2 style={{ fontFamily: theme.headingFont, fontSize: 62, lineHeight: 1.04, fontWeight: theme.headingWeight || 600, letterSpacing: '-0.025em', margin: 0, maxWidth: '20ch', color: '#FFFFFF', textWrap: 'balance' }}>
        {slide.title}
      </h2>
      {slide.subtitle ? <p style={{ marginTop: 24, fontSize: 26, lineHeight: 1.4, color: 'rgba(255,255,255,0.88)', maxWidth: '44ch' }}>{slide.subtitle}</p> : null}
    </div>
  );
}
