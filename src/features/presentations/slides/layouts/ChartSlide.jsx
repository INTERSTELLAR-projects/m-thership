import React from 'react';
import SlideTitle, { SlideBody } from '@/features/presentations/slides/SlideTitle';

// Pure SVG charts (column, bar, line, donut) so they export pixel-for-pixel to PDF / PPTX.
// chart = { type, unit_prefix, unit_suffix, points: [{label, value}], note }
const W = 1104;

const fmt = (c, v) => {
  const n = Number(v);
  const abs = Math.abs(n);
  const s = Number.isInteger(n) ? n.toLocaleString('en-US') : abs < 10 ? n.toFixed(1) : Math.round(n).toLocaleString('en-US');
  return `${c.unit_prefix || ''}${s}${c.unit_suffix || ''}`;
};

function Columns({ c, theme, h }) {
  const pts = c.points;
  const max = Math.max(...pts.map((p) => p.value), 0) || 1;
  const gap = pts.length <= 3 ? 90 : 44;
  const bw = Math.min(180, (W - gap * (pts.length + 1)) / pts.length);
  const total = pts.length * bw + (pts.length - 1) * gap;
  const x0 = (W - total) / 2;
  const top = 48;
  const base = h - 46;
  return (
    <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} style={{ display: 'block' }}>
      <line x1={0} x2={W} y1={base} y2={base} stroke={theme.hairline} strokeWidth={2} />
      {pts.map((p, i) => {
        const bh = Math.max(4, ((base - top) * p.value) / max);
        const x = x0 + i * (bw + gap);
        const hi = i === pts.length - 1;
        return (
          <g key={i}>
            <rect x={x} y={base - bh} width={bw} height={bh} rx={Math.min(8, theme.radius || 0)} fill={hi ? theme.accent : theme.chartColors ? theme.chartColors[2] || theme.faint : theme.faint} opacity={hi ? 1 : 0.55} />
            <text x={x + bw / 2} y={base - bh - 14} textAnchor="middle" fontSize={30} fontWeight={700} fill={hi ? theme.accentText || theme.accent : theme.fg} fontFamily={theme.headingFont}>{fmt(c, p.value)}</text>
            <text x={x + bw / 2} y={base + 34} textAnchor="middle" fontSize={22} fill={theme.muted} fontFamily={theme.bodyFont}>{p.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Bars({ c, theme, h }) {
  const pts = c.points;
  const max = Math.max(...pts.map((p) => p.value), 0) || 1;
  const labelW = 300;
  const row = Math.min(66, (h - 10) / pts.length);
  const barH = row * 0.56;
  return (
    <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} style={{ display: 'block' }}>
      {pts.map((p, i) => {
        const y = i * row + (row - barH) / 2;
        const bw = Math.max(4, ((W - labelW - 170) * p.value) / max);
        const hi = p.value === max;
        return (
          <g key={i}>
            <text x={labelW - 20} y={y + barH / 2 + 8} textAnchor="end" fontSize={22} fill={theme.fg} fontFamily={theme.bodyFont}>{p.label}</text>
            <rect x={labelW} y={y} width={bw} height={barH} rx={Math.min(6, theme.radius || 0)} fill={hi ? theme.accent : theme.chartColors ? theme.chartColors[1] : theme.faint} opacity={hi ? 1 : 0.7} />
            <text x={labelW + bw + 14} y={y + barH / 2 + 9} fontSize={24} fontWeight={700} fill={theme.fg} fontFamily={theme.headingFont}>{fmt(c, p.value)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Line({ c, theme, h }) {
  const pts = c.points;
  const vals = pts.map((p) => p.value);
  const max = Math.max(...vals);
  const min = Math.min(0, ...vals);
  const left = 40, right = W - 40, top = 56, base = h - 50;
  const x = (i) => left + (pts.length === 1 ? 0 : (i * (right - left)) / (pts.length - 1));
  const y = (v) => base - ((v - min) / (max - min || 1)) * (base - top);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  return (
    <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} style={{ display: 'block' }}>
      <line x1={left} x2={right} y1={base} y2={base} stroke={theme.hairline} strokeWidth={2} />
      <path d={`${d} L${x(pts.length - 1)},${base} L${x(0)},${base} Z`} fill={theme.accentSoft} />
      <path d={d} fill="none" stroke={theme.accent} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r={8} fill={theme.bg} stroke={theme.accent} strokeWidth={4} />
          <text x={x(i)} y={y(p.value) - 20} textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'} fontSize={24} fontWeight={700} fill={theme.fg} fontFamily={theme.headingFont}>{fmt(c, p.value)}</text>
          <text x={x(i)} y={base + 34} textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'} fontSize={22} fill={theme.muted} fontFamily={theme.bodyFont}>{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

function Donut({ c, theme, h }) {
  const pts = c.points.filter((p) => p.value > 0);
  const total = pts.reduce((s, p) => s + p.value, 0) || 1;
  const r = Math.min(150, h / 2 - 20);
  const cx = r + 30, cy = h / 2;
  const colors = theme.chartColors || [theme.accent, theme.fg, theme.muted, theme.faint];
  let a0 = -Math.PI / 2;
  const arcs = pts.map((p, i) => {
    const a1 = a0 + (p.value / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const path = pts.length === 1
      ? `M${cx},${cy - r} A${r},${r} 0 1 1 ${cx - 0.01},${cy - r} Z`
      : `M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z`;
    a0 = a1;
    return <path key={i} d={path} fill={colors[i % colors.length]} stroke={theme.bg} strokeWidth={4} />;
  });
  const lx = cx + r + 90;
  const row = Math.min(70, (h - 20) / pts.length);
  const y0 = cy - (row * pts.length) / 2;
  return (
    <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} style={{ display: 'block' }}>
      {arcs}
      <circle cx={cx} cy={cy} r={r * 0.58} fill={theme.bg} />
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize={34} fontWeight={700} fill={theme.fg} fontFamily={theme.headingFont}>{fmt(c, total)}</text>
      <text x={cx} y={cy + 36} textAnchor="middle" fontSize={16} letterSpacing="2" fill={theme.muted} fontFamily={theme.monoFont}>TOTAL</text>
      {pts.map((p, i) => (
        <g key={i}>
          <rect x={lx} y={y0 + i * row + row / 2 - 11} width={22} height={22} rx={4} fill={colors[i % colors.length]} />
          <text x={lx + 38} y={y0 + i * row + row / 2 + 9} fontSize={24} fill={theme.fg} fontFamily={theme.bodyFont}>{p.label}</text>
          <text x={W - 20} y={y0 + i * row + row / 2 + 9} textAnchor="end" fontSize={26} fontWeight={700} fill={theme.fg} fontFamily={theme.headingFont}>{fmt(c, p.value)}</text>
          <text x={W - 20 - 170} y={y0 + i * row + row / 2 + 9} textAnchor="end" fontSize={22} fill={theme.muted} fontFamily={theme.bodyFont}>{Math.round((p.value / total) * 100)}%</text>
        </g>
      ))}
    </svg>
  );
}

export default function ChartSlide({ theme, slide }) {
  const c = slide.chart && Array.isArray(slide.chart.points) && slide.chart.points.length ? slide.chart : null;
  const h = slide.subtitle ? 330 : 380;
  const Kind = !c ? null : c.type === 'bar' ? Bars : c.type === 'line' ? Line : c.type === 'donut' ? Donut : Columns;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SlideTitle theme={theme} eyebrow={slide.eyebrow} title={slide.title} subtitle={slide.subtitle} style={{ marginBottom: 18 }} />
      <SlideBody align="flex-end">
        {Kind ? <Kind c={c} theme={theme} h={h} /> : null}
        {c && c.note ? <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.4, color: theme.faint, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: theme.monoFont }}>{c.note}</p> : null}
      </SlideBody>
    </div>
  );
}
