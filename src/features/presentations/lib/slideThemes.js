export const SLIDE_W = 1280;
export const SLIDE_H = 720;

// Interstellar Strategies brand gradient: #ff3c00 → #ff6a00 → #ffaa00 (deep → mid → light orange). Never gold.
const INTERSTELLAR_GRADIENT = 'linear-gradient(90deg, #ff3c00 0%, #ff6a00 55%, #ffaa00 100%)';

export const SLIDE_THEMES = [
  // Interstellar decks follow the SOP-deck branding (AgencyKnowledge voice rules): light canvas #ebe8e4, ink,
  // flame gradient, Geist + JetBrains Mono.
  {
    id: 'interstellar',
    name: 'Interstellar',
    dark: false,
    bg: '#EBE8E4',
    bgGradient:
      'radial-gradient(closest-side at 100% 100%, rgba(255,106,0,0.14), rgba(255,106,0,0) 72%), #EBE8E4',
    fg: '#1A1A1A',
    muted: 'rgba(26,26,26,0.66)',
    faint: 'rgba(26,26,26,0.38)',
    accent: '#FF3C00',
    accentGradient: INTERSTELLAR_GRADIENT,
    accentInk: '#FFFFFF',
    accentSoft: 'rgba(255,60,0,0.10)',
    panel: 'rgba(255,255,255,0.78)',
    border: 'rgba(26,26,26,0.14)',
    hairline: 'rgba(26,26,26,0.10)',
    headingFont: "'Geist', 'Manrope', sans-serif",
    bodyFont: "'Geist', 'Manrope', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    displayFont: "'Geist', 'Manrope', sans-serif",
    headingWeight: 600,
    eyebrowColor: '#E03500',
    accentText: '#E03500',
    chartColors: ['#FF3C00', '#FF6A00', '#FFAA00', '#1A1A1A', '#8A8580'],
    radius: 6,
    swatch: ['#EBE8E4', '#FF3C00', '#FFAA00']
  },
  {
    id: 'interstellar-dark',
    name: 'Interstellar Dark',
    dark: true,
    bg: '#121212',
    bgGradient:
      'radial-gradient(closest-side at 100% 100%, rgba(255,60,0,0.26), rgba(255,60,0,0) 70%), #121212',
    fg: '#F7F4EF',
    muted: 'rgba(247,244,239,0.68)',
    faint: 'rgba(247,244,239,0.38)',
    accent: '#FF6A00',
    accentGradient: INTERSTELLAR_GRADIENT,
    accentInk: '#FFFFFF',
    accentSoft: 'rgba(255,106,0,0.18)',
    panel: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.16)',
    hairline: 'rgba(255,255,255,0.12)',
    headingFont: "'Geist', 'Manrope', sans-serif",
    bodyFont: "'Geist', 'Manrope', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    displayFont: "'Geist', 'Manrope', sans-serif",
    headingWeight: 600,
    eyebrowColor: '#FFAA00',
    chartColors: ['#FF6A00', '#FFAA00', '#FF3C00', '#F7F4EF', '#8A8580'],
    radius: 6,
    swatch: ['#121212', '#FF6A00', '#FFAA00']
  },
  {
    id: 'signal',
    name: 'Signal',
    dark: false,
    bg: '#F4F5F9',
    bgGradient:
      'radial-gradient(closest-side at 100% 100%, rgba(253,86,56,0.25), rgba(253,86,56,0) 70%), #F4F5F9',
    fg: '#2E2E2E',
    muted: '#494A4D',
    faint: 'rgba(46,46,46,0.40)',
    accent: '#FD5638',
    accentInk: '#FFFFFF',
    accentSoft: 'rgba(253,86,56,0.12)',
    panel: 'rgba(255,255,255,0.70)',
    border: '#DFE1EA',
    hairline: '#DFE1EA',
    headingFont: "'Manrope', sans-serif",
    bodyFont: "'Manrope', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    displayFont: "'Manrope', sans-serif",
    headingWeight: 500,
    eyebrowColor: '#A7A9B0',
    radius: 12,
    swatch: ['#F4F5F9', '#FD5638', '#2E2E2E']
  },
  {
    id: 'signal-dark',
    name: 'Signal Dark',
    dark: true,
    bg: '#2E2E2E',
    bgGradient:
      'radial-gradient(closest-side at 100% 100%, rgba(253,86,56,0.25), rgba(253,86,56,0) 70%), #2E2E2E',
    fg: '#F4F5F9',
    muted: '#A7A9B0',
    faint: 'rgba(244,245,249,0.40)',
    accent: '#FD5638',
    accentInk: '#FFFFFF',
    accentSoft: 'rgba(253,86,56,0.22)',
    panel: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.14)',
    hairline: 'rgba(255,255,255,0.12)',
    headingFont: "'Manrope', sans-serif",
    bodyFont: "'Manrope', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    displayFont: "'Manrope', sans-serif",
    headingWeight: 500,
    eyebrowColor: '#A7A9B0',
    radius: 12,
    swatch: ['#2E2E2E', '#FD5638', '#F4F5F9']
  },
  {
    id: 'paper',
    name: 'Paper',
    dark: false,
    bg: '#FBFBFA',
    bgGradient: 'radial-gradient(130% 120% at 100% 0%, #FFFFFF 0%, #F3F4F6 52%, #E7E9ED 100%)',
    fg: '#0D1117',
    muted: 'rgba(13,17,23,0.64)',
    faint: 'rgba(13,17,23,0.34)',
    accent: '#2563EB',
    accentInk: '#FFFFFF',
    accentSoft: 'rgba(37,99,235,0.12)',
    panel: 'rgba(255,255,255,0.74)',
    border: 'rgba(13,17,23,0.14)',
    hairline: 'rgba(13,17,23,0.10)',
    headingFont: "'Sora', sans-serif",
    bodyFont: "'Inter', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    displayFont: "'Instrument Serif', Georgia, serif",
    radius: 22,
    swatch: ['#FBFBFA', '#2563EB', '#0D1117']
  },
  {
    id: 'midnight',
    name: 'Midnight',
    dark: true,
    bg: '#080B14',
    bgGradient: 'radial-gradient(120% 120% at 82% -10%, rgba(56,112,214,0.45) 0%, #0A0E1A 46%, #05070E 100%)',
    fg: '#F6F8FC',
    muted: 'rgba(246,248,252,0.68)',
    faint: 'rgba(246,248,252,0.36)',
    accent: '#67E8F9',
    accentInk: '#04121A',
    accentSoft: 'rgba(103,232,249,0.16)',
    panel: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.18)',
    hairline: 'rgba(255,255,255,0.13)',
    headingFont: "'Sora', sans-serif",
    bodyFont: "'Inter', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    displayFont: "'Instrument Serif', Georgia, serif",
    radius: 22,
    swatch: ['#080B14', '#67E8F9', '#F6F8FC']
  },
  {
    id: 'cobalt',
    name: 'Cobalt',
    dark: true,
    bg: '#0B2340',
    bgGradient: 'radial-gradient(130% 130% at 8% -20%, #1B4A7E 0%, #0B2340 50%, #061729 100%)',
    fg: '#F4F7FB',
    muted: 'rgba(244,247,251,0.70)',
    faint: 'rgba(244,247,251,0.38)',
    accent: '#F5C168',
    accentInk: '#12233A',
    accentSoft: 'rgba(245,193,104,0.16)',
    panel: 'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.20)',
    hairline: 'rgba(255,255,255,0.14)',
    headingFont: "'Sora', sans-serif",
    bodyFont: "'Inter', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    displayFont: "'Instrument Serif', Georgia, serif",
    radius: 20,
    swatch: ['#0B2340', '#F5C168', '#F4F7FB']
  },
  {
    id: 'sandstone',
    name: 'Sandstone',
    dark: false,
    bg: '#F7F2E8',
    bgGradient: 'radial-gradient(130% 120% at 100% 0%, #FFFDF8 0%, #F5EFE3 55%, #EBE1D1 100%)',
    fg: '#1E1A15',
    muted: 'rgba(30,26,21,0.66)',
    faint: 'rgba(30,26,21,0.36)',
    accent: '#B4531F',
    accentInk: '#FFF8F1',
    accentSoft: 'rgba(180,83,31,0.12)',
    panel: 'rgba(255,255,255,0.60)',
    border: 'rgba(30,26,21,0.16)',
    hairline: 'rgba(30,26,21,0.12)',
    headingFont: "'Instrument Serif', Georgia, serif",
    bodyFont: "'Inter', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    displayFont: "'Instrument Serif', Georgia, serif",
    radius: 18,
    swatch: ['#F7F2E8', '#B4531F', '#1E1A15']
  },
  {
    id: 'carbon',
    name: 'Carbon',
    dark: true,
    bg: '#101112',
    bgGradient: 'radial-gradient(120% 120% at 88% -12%, #232728 0%, #121415 48%, #0A0B0C 100%)',
    fg: '#F4F5F4',
    muted: 'rgba(244,245,244,0.66)',
    faint: 'rgba(244,245,244,0.34)',
    accent: '#C6F24E',
    accentInk: '#111213',
    accentSoft: 'rgba(198,242,78,0.15)',
    panel: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.16)',
    hairline: 'rgba(255,255,255,0.12)',
    headingFont: "'Sora', sans-serif",
    bodyFont: "'Inter', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    displayFont: "'Sora', sans-serif",
    radius: 14,
    swatch: ['#101112', '#C6F24E', '#F4F5F4']
  },
  {
    id: 'violet',
    name: 'Violet',
    dark: false,
    bg: '#F8F7FF',
    bgGradient: 'radial-gradient(130% 120% at 95% -5%, #FFFFFF 0%, #F2EFFF 50%, #E8E3FB 100%)',
    fg: '#171229',
    muted: 'rgba(23,18,41,0.64)',
    faint: 'rgba(23,18,41,0.34)',
    accent: '#6D28D9',
    accentInk: '#FFFFFF',
    accentSoft: 'rgba(109,40,217,0.12)',
    panel: 'rgba(255,255,255,0.70)',
    border: 'rgba(23,18,41,0.14)',
    hairline: 'rgba(23,18,41,0.10)',
    headingFont: "'Sora', sans-serif",
    bodyFont: "'Inter', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    displayFont: "'Instrument Serif', Georgia, serif",
    radius: 24,
    swatch: ['#F8F7FF', '#6D28D9', '#171229']
  }
];

export const SLIDE_LAYOUTS = [
  { id: 'cover', label: 'Title / cover' },
  { id: 'section', label: 'Section divider' },
  { id: 'bullets', label: 'Bullets' },
  { id: 'cards', label: 'Cards' },
  { id: 'list', label: 'Numbered list' },
  { id: 'compare', label: 'Comparison' },
  { id: 'split', label: 'Image + text' },
  { id: 'image', label: 'Full image' },
  { id: 'stats', label: 'Key figures' },
  { id: 'bigstat', label: 'Big number' },
  { id: 'chart', label: 'Chart' },
  { id: 'quote', label: 'Quote' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'pricing', label: 'Pricing / offer' },
  { id: 'closing', label: 'Closing' }
];

export const DECK_TONES = [
  'Clear and confident',
  'Bold and punchy',
  'Warm and consultative',
  'Technical and precise',
  'Executive and brief'
];

export const CUSTOM_THEME_ID = 'custom';

export const DEFAULT_CUSTOM_BRAND = {
  bg: '#0B1F3A',
  fg: '#F4F7FB',
  accent: '#F47C20',
  mode: 'dark',
  headingFont: 'sans'
};

function clampHex(value, fallback) {
  const v = typeof value === 'string' ? value.trim() : '';
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : fallback;
}

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const a = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function contrastInk(hex) {
  return luminance(hex) > 0.5 ? '#0D1117' : '#FFFFFF';
}

function shade(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const target = percent < 0 ? 0 : 255;
  const p = Math.abs(percent);
  const nr = Math.round((target - r) * p + r);
  const ng = Math.round((target - g) * p + g);
  const nb = Math.round((target - b) * p + b);
  return `#${[nr, ng, nb].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

const famStr = (v) => (typeof v === 'string' ? v.replace(/['"]/g, '').trim().slice(0, 40) : '');

export function normalizeBrand(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const mode = raw.mode === 'light' || raw.mode === 'dark' ? raw.mode : 'dark';
  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : '',
    bg: clampHex(raw.bg, DEFAULT_CUSTOM_BRAND.bg),
    fg: clampHex(raw.fg, DEFAULT_CUSTOM_BRAND.fg),
    accent: clampHex(raw.accent, DEFAULT_CUSTOM_BRAND.accent),
    accentText: clampHex(raw.accentText, ''),
    accent2: clampHex(raw.accent2, ''),
    mode,
    headingFont: raw.headingFont === 'serif' ? 'serif' : 'sans',
    headingFamily: famStr(raw.headingFamily),
    bodyFamily: famStr(raw.bodyFamily),
    logo_url: /^https?:\/\//.test(String(raw.logo_url || '')) ? String(raw.logo_url) : ''
  };
}

export function buildCustomTheme(input) {
  const brand = normalizeBrand(input);
  const dark = brand.mode === 'dark';
  const fallbackHeading = brand.headingFont === 'serif' ? "'Instrument Serif', Georgia, serif" : "'Sora', sans-serif";
  // The client's real fonts when the brand kit names them (loaded from Google Fonts by loadBrandFonts),
  // falling back to a matching serif / sans.
  const heading = brand.headingFamily ? `'${brand.headingFamily}', ${fallbackHeading}` : fallbackHeading;
  const body = brand.bodyFamily ? `'${brand.bodyFamily}', 'Inter', sans-serif` : "'Inter', sans-serif";
  const accentText = brand.accentText || brand.accent;
  // Chart series colours must all be visible on the canvas: a stored accent2 too close to the background is
  // replaced by a tint of the accent.
  const visible = (hex) => /^#[0-9a-f]{6}$/i.test(hex || '') && Math.abs(luminance(hex) - luminance(brand.bg)) > 0.12;
  const second = visible(brand.accent2) ? brand.accent2 : shade(brand.accent, dark ? 0.45 : -0.4);
  return {
    id: CUSTOM_THEME_ID,
    name: brand.name || 'Custom',
    dark,
    bg: brand.bg,
    // Glow layered over a solid fill: no transparent corners when presenting or exporting.
    bgGradient: `radial-gradient(120% 110% at 100% 0%, ${withAlpha(brand.accent, dark ? 0.16 : 0.09)} 0%, ${withAlpha(brand.accent, 0)} 55%), linear-gradient(180deg, ${brand.bg} 0%, ${shade(brand.bg, dark ? -0.06 : -0.03)} 100%)`,
    fg: brand.fg,
    muted: withAlpha(brand.fg, dark ? 0.74 : 0.72),
    faint: withAlpha(brand.fg, 0.42),
    accent: brand.accent,
    accentText,
    accent2: visible(brand.accent2) ? brand.accent2 : '',
    accentInk: contrastInk(brand.accent),
    accentSoft: withAlpha(brand.accent, dark ? 0.18 : 0.12),
    eyebrowColor: accentText,
    chartColors: [brand.accent, second, withAlpha(brand.fg, 0.6), shade(brand.accent, dark ? -0.35 : 0.55), withAlpha(brand.fg, 0.35)],
    panel: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
    border: withAlpha(brand.fg, dark ? 0.2 : 0.16),
    hairline: withAlpha(brand.fg, dark ? 0.14 : 0.12),
    headingFont: heading,
    bodyFont: body,
    monoFont: "'JetBrains Mono', monospace",
    displayFont: heading,
    headingWeight: brand.headingFont === 'serif' ? 500 : 650,
    radius: 14,
    logo: brand.logo_url || '',
    brandName: brand.name || '',
    swatch: [brand.bg, brand.accent, brand.fg],
    brand
  };
}

export function getTheme(id, brand) {
  if (id === CUSTOM_THEME_ID) return buildCustomTheme(brand || DEFAULT_CUSTOM_BRAND);
  const base = SLIDE_THEMES.find((t) => t.id === id) || SLIDE_THEMES[0];
  return {
    ...base,
    accentText: base.accentText || base.accent,
    chartColors: base.chartColors || [base.accent, base.fg, base.muted, base.faint],
    // A preset theme can still carry the client's logo and name in the footer.
    logo: (brand && brand.logo_url) || '',
    brandName: (brand && brand.name) || ''
  };
}

export function blankSlide(layout = 'bullets') {
  return {
    id: '',
    layout,
    eyebrow: '',
    title: layout === 'cover' ? 'Untitled slide' : 'New slide',
    subtitle: '',
    body: '',
    bullets: layout === 'bullets' || layout === 'split' || layout === 'list' ? [''] : [],
    cards: layout === 'cards' ? [{ title: '', text: '' }, { title: '', text: '' }] : [],
    chart: layout === 'chart' ? { type: 'column', unit_prefix: '', unit_suffix: '', points: [{ label: 'A', value: 1 }, { label: 'B', value: 2 }], note: '' } : null,
    stats: layout === 'stats' || layout === 'bigstat' ? [{ value: '', label: '' }] : [],
    offers: layout === 'pricing' ? [{ name: '', price: '', period: '', description: '', features: [], highlighted: true }] : [],
    steps: layout === 'timeline' ? [{ label: '', text: '' }] : [],
    columns: layout === 'compare' ? [{ heading: '', text: '' }, { heading: '', text: '' }] : [],
    attribution: '',
    image_prompt: '',
    image_url: '',
    needs_visual: layout === 'split' || layout === 'image',
    notes: ''
  };
}

export function slugify(value) {
  return (
    String(value || 'presentation')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'presentation'
  );
}
