import React from 'react';
import SlideTitle, { SlideBody } from '@/features/presentations/slides/SlideTitle';

// Pricing / offer: 1-3 cards. The highlighted one carries the accent and a "Recommended" tag. A single offer
// sits beside its terms (subtitle) instead of floating in half the slide.
export default function PricingSlide({ theme, slide }) {
  const items = (slide.offers || []).filter((o) => o && (o.name || o.price)).slice(0, 3);
  const dense = items.length === 3;
  const single = items.length === 1;
  const card = (offer, index) => {
    const hi = Boolean(offer.highlighted) || single;
    const features = (Array.isArray(offer.features) ? offer.features : String(offer.features || '').split('\n')).filter((f) => String(f || '').trim());
    return (
      <div
        key={index}
        style={{
          position: 'relative',
          border: `${hi ? 2 : 1}px solid ${hi ? theme.accent : theme.border}`,
          background: hi ? theme.accentSoft : theme.panel,
          borderRadius: theme.radius,
          padding: dense ? '26px 26px 28px' : '30px 34px 32px',
          overflow: 'hidden',
          minWidth: 0
        }}
      >
        {hi ? <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: theme.accentGradient || theme.accent }} /> : null}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontFamily: theme.monoFont, fontSize: 15, letterSpacing: '0.14em', textTransform: 'uppercase', color: hi ? theme.accentText || theme.accent : theme.muted }}>{offer.name}</span>
          {hi && !single ? (
            <span style={{ fontFamily: theme.monoFont, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '5px 9px', borderRadius: 3, background: theme.accent, color: theme.accentInk }}>Recommended</span>
          ) : null}
        </div>
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: theme.headingFont, fontSize: dense ? 50 : 68, fontWeight: 700, letterSpacing: '-0.03em', color: theme.fg, lineHeight: 1 }}>{offer.price}</span>
          {offer.period ? <span style={{ fontSize: 22, color: theme.muted }}>{offer.period}</span> : null}
        </div>
        {offer.description ? <p style={{ margin: '14px 0 0', fontSize: 22, lineHeight: 1.4, color: theme.muted }}>{offer.description}</p> : null}
        {features.length ? (
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {features.slice(0, dense ? 4 : 5).map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 22, lineHeight: 1.35, color: theme.fg }}>
                <span style={{ flex: 'none', width: 16, height: 3, marginTop: 14, background: theme.accent }} />
                <span>{f}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SlideTitle theme={theme} eyebrow={slide.eyebrow} title={slide.title} />
      <SlideBody>
        {single ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 48, alignItems: 'center' }}>
            {card(items[0], 0)}
            {slide.subtitle || slide.body ? (
              <div style={{ fontSize: 26, lineHeight: 1.45, color: theme.fg }}>
                {[slide.subtitle, slide.body].filter(Boolean).map((x, i) => (
                  <p key={i} style={{ margin: i ? '18px 0 0' : 0, color: i ? theme.muted : theme.fg }}>{x}</p>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, items.length)}, minmax(0, 1fr))`, gap: 22, alignItems: 'stretch' }}>{items.map(card)}</div>
            {slide.subtitle ? <p style={{ margin: '22px 0 0', fontSize: 22, lineHeight: 1.45, color: theme.muted, maxWidth: '70ch' }}>{slide.subtitle}</p> : null}
          </>
        )}
      </SlideBody>
    </div>
  );
}
