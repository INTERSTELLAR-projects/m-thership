import React from 'react';

export default function BulletList({ theme, bullets = [], size, gap, color, marker = 'rule' }) {
  const items = bullets.filter((b) => String(b || '').trim());
  if (!items.length) return null;
  const longest = Math.max(...items.map((x) => String(x).length));
  const px = size || (items.length <= 3 && longest < 70 ? 30 : items.length <= 4 && longest < 90 ? 27 : 24);
  const g = gap || Math.round(px * 0.95);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: g }}>
      {items.map((item, index) => (
        <div key={index} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {marker === 'rule' ? (
            <span style={{ display: 'block', width: 28, height: 3, marginTop: Math.round(px * 0.68), flex: 'none', background: theme.accent }} />
          ) : (
            <span style={{ display: 'block', width: 9, height: 9, borderRadius: '50%', marginTop: Math.round(px * 0.55), flex: 'none', background: theme.accent }} />
          )}
          <span style={{ fontSize: px, lineHeight: 1.38, color: color || theme.fg, maxWidth: '44ch' }}>{item}</span>
        </div>
      ))}
    </div>
  );
}
