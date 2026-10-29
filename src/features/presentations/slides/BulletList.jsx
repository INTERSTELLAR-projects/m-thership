import React from 'react';

export default function BulletList({ theme, bullets = [], size = 23, gap = 22, color, marker = 'rule' }) {
  const items = bullets.filter((b) => String(b || '').trim());
  if (!items.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {items.map((item, index) => (
        <div key={index} style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
          {marker === 'rule' ? (
            <span
              style={{
                display: 'block',
                width: 26,
                height: 2,
                marginTop: Math.round(size * 0.62),
                flex: 'none',
                background: theme.accent
              }}
            />
          ) : null}
          {marker === 'dot' ? (
            <span
              style={{
                display: 'block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                marginTop: Math.round(size * 0.5),
                flex: 'none',
                background: theme.accent
              }}
            />
          ) : null}
          <span style={{ fontSize: size, lineHeight: 1.5, color: color || theme.fg, maxWidth: '52ch' }}>{item}</span>
        </div>
      ))}
    </div>
  );
}
