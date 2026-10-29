import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const STYLE = {
  signal: 'refined corporate editorial imagery, clean composition with a warm orange accent on a near-white snow background, soft directional light, minimal and confident',
  'signal-dark': 'moody corporate editorial imagery, dark charcoal background with a warm orange accent glow, low-key cinematic lighting',
  paper: 'clean editorial photography or refined abstract geometry, bright neutral palette, soft natural shadows',
  midnight: 'moody dark editorial imagery, deep navy and near-black tones, a single glowing light source',
  cobalt: 'cool corporate abstract imagery, deep blue palette with pale highlights',
  sandstone: 'warm film photography, sand and terracotta palette, soft golden light',
  carbon: 'high-contrast minimal abstract imagery, charcoal tones with one bright accent',
  violet: 'atmospheric abstract imagery, deep violet and indigo palette with a soft glow'
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin access required' }, { status: 403 });

    const payload = await req.json().catch(() => ({}));
    const brief = typeof (payload && payload.prompt) === 'string' ? payload.prompt.trim().slice(0, 500) : '';
    if (brief.length < 4) return Response.json({ error: 'A visual brief is required.' }, { status: 400 });

    const theme =
      typeof (payload && payload.theme) === 'string' && (payload.theme === 'custom' || STYLE[payload.theme])
        ? payload.theme
        : 'paper';
    const brand = payload && typeof payload.brand === 'object' && payload.brand ? payload.brand : null;

    let style;
    if (theme === 'custom' && brand) {
      const mood = brand.mode === 'light' ? 'bright, airy, soft natural light' : 'moody, considered, low-key lighting';
      style = `sophisticated editorial imagery in a palette built around ${brand.accent || '#2563EB'} on ${brand.bg || '#0B1F3A'} with ${brand.fg || '#F4F7FB'} highlights, ${mood}`;
    } else {
      style = STYLE[theme] || STYLE.paper;
    }

    const prompt = `Presentation slide visual, wide 16:9 landscape composition. ${brief}. Style: ${style}. Absolutely no text, letters, numbers, captions, logos, watermarks, charts or interface elements anywhere in the image. Sophisticated, high-end, gallery quality.`;

    const generated = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt });
    const url = generated && typeof generated.url === 'string' ? generated.url : '';
    if (!url) return Response.json({ error: 'That visual could not be generated.' }, { status: 502 });

    return Response.json({ image_url: url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
