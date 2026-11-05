import React from 'react';

// An image, or (when there is none) a quiet brand-coloured panel. Never a "Visual" placeholder label: an empty
// image slot must still look finished in an export.
export default function VisualBlock({ theme, src, style, logo }) {
  const box = { position: 'relative', overflow: 'hidden', height: '100%', width: '100%', borderRadius: theme.radius, ...style };

  if (src) {
    return (
      <div style={box}>
        {/* object-fit: cover so a 16:9 image fills a portrait panel (v1 letterboxed it with white bars). */}
        <img src={src} alt="" crossOrigin="anonymous" loading="eager" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }

  return (
    <div style={{ ...box, background: theme.accentGradient || `linear-gradient(150deg, ${theme.accent}, ${theme.accent2 || theme.accentSoft})` }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 0% 100%, rgba(0,0,0,0.22), rgba(0,0,0,0) 60%)' }} />
      <div style={{ position: 'absolute', right: -60, top: -60, width: 260, height: 260, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)' }} />
      <div style={{ position: 'absolute', right: 30, top: 30, width: 120, height: 120, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)' }} />
      {logo ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <img src={logo} alt="" crossOrigin="anonymous" style={{ maxWidth: '70%', maxHeight: '45%', objectFit: 'contain' }} />
        </div>
      ) : null}
    </div>
  );
}
