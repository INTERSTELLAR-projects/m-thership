import React from 'react';
import SlideTitle from '@/features/presentations/slides/SlideTitle';

// Pricing / offer: 1–3 cards. The highlighted one carries the accent and a "Recommended" tag.
export default function PricingSlide({ theme, slide }) {
  const offers = (slide.offers || []).filter((o) => o && (o.name || o.price)).slice(0, 3);
  const items = offers.length ? offers : [{ name: 'Offer', price: '—', period: '', description: 'Add an offer to this slide', features: [], highlighted: true }];
  const dense = items.length === 3;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SlideTitle theme={theme} eyebrow={slide.eyebrow} title={slide.title} size={44} />
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: 24, alignItems: 'stretch', maxWidth: items.length === 1 ? 560 : 'none' }}>
        {items.map((offer, index) => {
          const hi = Boolean(offer.highlighted);
          const features = Array.isArray(offer.features) ? offer.features : String(offer.features || '').split('\n');
          return (
            <div
              key={index}
              style={{
                position: 'relative',
                border: `1px solid ${hi ? theme.accent : theme.border}`,
                background: hi ? theme.accentSoft : theme.panel,
                borderRadius: theme.radius,
                padding: dense ? '26px 26px' : '30px 34px',
                overflow: 'hidden'
              }}
            >
              {hi ? <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: theme.accentGradient || theme.accent }} /> : null}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontFamily: theme.monoFont, fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', color: hi ? theme.accent : theme.muted }}>{offer.name}</span>
                {hi ? (
                  <span style={{ fontFamily: theme.monoFont, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', padding: '4px 8px', borderRadius: 3, background: theme.accent, color: theme.accentInk }}>Recommended</span>
                ) : null}
              </div>
              <div style={{ marginTop: 18, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: theme.headingFont, fontSize: dense ? 46 : 56, fontWeight: 700, letterSpacing: '-0.03em', color: theme.fg, lineHeight: 1 }}>{offer.price}</span>
                {offer.period ? <span style={{ fontSize: 17, color: theme.muted }}>{offer.period}</span> : null}
              </div>
              {offer.description ? <p style={{ marginTop: 14, fontSize: 16, lineHeight: 1.45, color: theme.muted }}>{offer.description}</p> : null}
              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {features.filter((f) => String(f || '').trim()).slice(0, dense ? 5 : 6).map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: dense ? 15 : 17, lineHeight: 1.4, color: theme.fg }}>
                    <span style={{ flex: 'none', width: 14, height: 2, marginTop: 10, background: theme.accent }} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {slide.subtitle ? <p style={{ marginTop: 'auto', paddingTop: 18, fontSize: 16, lineHeight: 1.5, color: theme.muted, maxWidth: '80ch' }}>{slide.subtitle}</p> : null}
    </div>
  );
}
