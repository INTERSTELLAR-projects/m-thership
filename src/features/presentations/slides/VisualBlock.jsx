import React from 'react';
import { Image } from '@/components/ui/image';

// An image, or (when there is none) a quiet brand-coloured panel. Never a "Visual" placeholder label: an empty
// image slot must still look finished in an export.
export default function VisualBlock({ theme, src, style, logo }) {
  const box = { position: 'relative', overflow: 'hidden', height: '100%', width: '100%', borderRadius: theme.radius, ...style };

  if (src) {
    return (
      <div style={box}>
        <Image src={src} alt="" fittingType="fill" loading="eager" className="absolute inset-0 h-full w-full" />
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
