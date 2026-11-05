// Slide themes use Geist, Instrument Serif, Inter, Manrope and Sora (+ JetBrains Mono). A CSS @import can't be
// appended to the end of src/index.css (imports must come first), so the stylesheet is injected at runtime.
// Client brand fonts (from the brand kit / Business Brain) are loaded on demand from Google Fonts by family name;
// a family Google doesn't serve just falls back to the theme's serif / sans stack.
export const BASE_FAMILIES = ['Geist', 'Instrument Serif', 'Inter', 'Manrope', 'Sora', 'JetBrains Mono'];
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=Sora:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';

let injected = false;
const loadedFamilies = new Set();

export const familyHref = (family) =>
  `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`;

export default function loadSlideFonts() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  if (document.querySelector('link[data-slide-fonts]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONT_HREF;
  link.setAttribute('data-slide-fonts', '');
  document.head.appendChild(link);
}

/** Load a client's brand families (e.g. ["Playfair Display", "Lato"]). Safe to call on every render. */
export function loadBrandFonts(families = []) {
  if (typeof document === 'undefined') return;
  families
    .map((f) => String(f || '').trim())
    .filter((f) => f && /^[A-Za-z0-9 ]{2,40}$/.test(f) && !BASE_FAMILIES.includes(f) && !loadedFamilies.has(f))
    .forEach((family) => {
      loadedFamilies.add(family);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = familyHref(family);
      link.setAttribute('data-brand-font', family);
      document.head.appendChild(link);
    });
}

/** The Google Fonts stylesheet URLs a deck needs (used by the exporter to embed fonts). */
export function deckFontHrefs(theme) {
  const hrefs = [FONT_HREF];
  const b = theme && theme.brand;
  if (b) [b.headingFamily, b.bodyFamily].filter((f) => f && !BASE_FAMILIES.includes(f)).forEach((f) => hrefs.push(familyHref(f)));
  return [...new Set(hrefs)];
}
