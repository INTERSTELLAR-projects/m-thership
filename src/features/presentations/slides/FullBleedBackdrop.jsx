import React from 'react';

export default function FullBleedBackdrop({ theme, slide }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: theme.bg }}>
      {slide.image_url ? (
        <img src={slide.image_url} alt="" crossOrigin="anonymous" loading="eager" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(140deg, ${theme.accentSoft}, rgba(0,0,0,0) 62%), ${theme.bgGradient || theme.bg}` }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(103deg, rgba(4,7,14,0.86) 0%, rgba(4,7,14,0.62) 44%, rgba(4,7,14,0.2) 82%)' }} />
    </div>
  );
}
