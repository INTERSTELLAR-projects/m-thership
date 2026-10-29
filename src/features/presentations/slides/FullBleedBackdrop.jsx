import React from 'react';
import { Image } from '@/components/ui/image';

export default function FullBleedBackdrop({ theme, slide }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {slide.image_url ? (
        <Image src={slide.image_url} alt="" fittingType="fill" loading="eager" className="absolute inset-0 h-full w-full" />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(140deg, ${theme.accentSoft}, rgba(0,0,0,0) 62%), ${theme.bgGradient || theme.bg}`
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(103deg, rgba(4,7,14,0.86) 0%, rgba(4,7,14,0.62) 44%, rgba(4,7,14,0.2) 82%)'
        }}
      />
    </div>
  );
}
