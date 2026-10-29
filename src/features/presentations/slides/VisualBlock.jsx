import React from 'react';
import { Image } from '@/components/ui/image';

export default function VisualBlock({ theme, src, style }) {
  const box = {
    position: 'relative',
    overflow: 'hidden',
    height: '100%',
    width: '100%',
    borderRadius: theme.radius,
    ...style
  };

  if (src) {
    return (
      <div style={box}>
        <Image
          src={src}
          alt=""
          fittingType="fill"
          loading="eager"
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }

  return (
    <div
      style={{
        ...box,
        border: `1px solid ${theme.border}`,
        background: `linear-gradient(150deg, ${theme.accentSoft}, rgba(255,255,255,0) 72%)`
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 190,
          height: 190,
          top: '22%',
          left: '26%',
          transform: 'rotate(45deg)',
          border: `1px solid ${theme.accent}`,
          opacity: 0.3
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 26,
          fontFamily: theme.monoFont,
          fontSize: 11,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: theme.muted
        }}
      >
        Visual
      </div>
    </div>
  );
}
