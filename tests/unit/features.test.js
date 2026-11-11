import { describe, expect, it } from 'vitest';
import { derive, emptyAgg, groupBy, money, pct, ratio, sum } from '@/features/ads/lib/metrics';
import { buildUrl, isHttps, slug } from '@/features/ads/lib/utm';
import { fmtClock, fmtMinutes, itemMinutes, splitMinutes, toMinutes, withEstimate } from '@/features/tasks/lib/estimate';
import { contrastRatio, ensureContrast, isHex, luminance, scannability } from '@/features/qr/lib/contrast';

describe('ads metrics', () => {
  const rows = [
    { name: 'A', platform: 'meta', spend: 100, impressions: 1000, clicks: 50, conversions: 5, revenue: 400, frequency: 2 },
    { name: 'A', platform: 'meta', spend: 50, impressions: 3000, clicks: 25, conversions: 0, revenue: 0, frequency: 1 },
  ];

  it('derives ratios from summed totals (never averaged)', () => {
    const s = sum(rows);
    expect(s.spend).toBe(150);
    expect(s.ctr).toBeCloseTo((75 / 4000) * 100);
    expect(s.cpc).toBe(2);
    expect(s.cpa).toBe(30);
    expect(s.roas).toBeCloseTo(400 / 150);
    expect(s.frequency).toBeCloseTo((2 * 1000 + 1 * 3000) / 4000);
  });

  it('returns null (shown as —) when a denominator is zero', () => {
    const d = derive(emptyAgg());
    expect([d.ctr, d.cpc, d.cpa, d.roas, d.frequency]).toEqual([null, null, null, null, null]);
    expect(sum([{ spend: 10, revenue: 0 }]).roas).toBeNull();
  });

  it('ignores junk numbers and groups by key', () => {
    const g = groupBy([...rows, { name: 'B', spend: 'x', impressions: null }], (r) => r.name);
    expect(g.map((x) => [x.key, x.spend])).toEqual([['A', 150], ['B', 0]]);
  });

  it('formatters', () => {
    expect(money(null)).toBe('—');
    expect(money(12.5)).toBe('$12.50');
    expect(money(1234.4)).toBe('$1,234');
    expect(pct(null)).toBe('—');
    expect(pct(12.3456)).toBe('12.35%');
    expect(ratio(2.666)).toBe('2.67x');
  });
});

describe('UTM builder', () => {
  it('sets utm_* keys, keeps other params and removes blank ones', () => {
    const url = buildUrl('https://site.com/p?x=1&utm_term=old', { source: 'facebook', medium: 'paid_social', campaign: ' fall ' });
    const u = new URL(url);
    expect(u.searchParams.get('x')).toBe('1');
    expect(u.searchParams.get('utm_source')).toBe('facebook');
    expect(u.searchParams.get('utm_campaign')).toBe('fall');
    expect(u.searchParams.has('utm_term')).toBe(false);
  });
  it('passes invalid URLs through and validates https', () => {
    expect(buildUrl('not a url', { source: 'x' })).toBe('not a url');
    expect(buildUrl('', {})).toBe('');
    expect(isHttps('https://a.com')).toBe(true);
    expect(isHttps('http://a.com')).toBe(false);
    expect(slug('Fall Sale 2026!!')).toBe('fall-sale-2026');
  });
});

describe('task estimates (working time: 8h day, 5-day week, 4-week month)', () => {
  it('converts units to minutes', () => {
    expect(toMinutes(2, 'h')).toBe(120);
    expect(toMinutes(1, 'd')).toBe(480);
    expect(toMinutes(1, 'w')).toBe(2400);
    expect(toMinutes(1, 'mo')).toBe(9600);
    expect(toMinutes(-5, 'h')).toBe(0);
    expect(toMinutes(1, 'bogus')).toBe(480); // unknown unit defaults to days
  });
  it('reads whichever estimate field an item was saved with', () => {
    expect(itemMinutes({ estimated_minutes: 30 })).toBe(30);
    expect(itemMinutes({ estimate_amount: 2, estimate_unit: 'h' })).toBe(120);
    expect(itemMinutes({ estimated_hours: 1.5 })).toBe(90);
    expect(itemMinutes({ estimated_days: 1 })).toBe(480);
    expect(itemMinutes(null)).toBe(0);
  });
  it('formats and splits minutes', () => {
    expect(fmtMinutes(0)).toBe('—');
    expect(fmtMinutes(45)).toBe('45m');
    expect(fmtMinutes(90)).toBe('1.5h');
    expect(fmtMinutes(960)).toBe('2d');
    expect(fmtMinutes(19200)).toBe('2mo');
    expect(fmtClock(4360)).toBe('1:12:40');
    expect(splitMinutes(120)).toEqual({ amount: 2, unit: 'h' });
    expect(splitMinutes(720)).toEqual({ amount: 1.5, unit: 'd' });
    expect(splitMinutes(0)).toEqual({ amount: '', unit: 'h' });
  });
  it('withEstimate keeps every estimate field consistent', () => {
    expect(withEstimate({ id: 1 }, 3, 'h')).toEqual({ id: 1, estimate_amount: 3, estimate_unit: 'h', estimated_minutes: 180, estimated_hours: 3, estimated_days: 0.38 });
  });
});

describe('QR scannability', () => {
  it('WCAG contrast basics', () => {
    expect(isHex('#ff3c00')).toBe(true);
    expect(isHex('red')).toBe(false);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(luminance('#ffffff')).toBeCloseTo(1);
  });
  it('ensureContrast darkens until readable', () => {
    const c = ensureContrast('#ffcc00', '#ffffff', 4.5);
    expect(contrastRatio(c, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
  it('flags inverted or low-contrast codes and passes the default style', () => {
    const levels = (s) => scannability(s).issues?.map((i) => i.level) ?? [];
    expect(levels({})).not.toContain('error');
    expect(levels({ foreground: '#ffffff', background: '#000000' })).toContain('error');
    expect(levels({ foreground: '#eeeeee' })).toContain('error');
  });
});
