// Slide themes use Instrument Serif, Inter, Manrope and Sora (JetBrains Mono is
// already loaded by the app). A CSS @import can't be appended to the end of
// src/index.css (imports must come first), so the stylesheet is injected once
// at runtime by the slide renderer instead.
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600&family=Manrope:wght@400;500;600&family=Sora:wght@300;400;500;600;700&display=swap';

let injected = false;

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
