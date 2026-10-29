import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const LAYOUTS = ['cover', 'list', 'bullets', 'split', 'image', 'stats', 'quote', 'compare', 'timeline', 'closing'];
const THEMES = ['signal', 'signal-dark', 'paper', 'midnight', 'cobalt', 'sandstone', 'carbon', 'violet', 'custom'];
const MAX_SLIDES = 20;
const MAX_VISUALS = 4;

const SLIDE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    layout: { type: 'string', enum: LAYOUTS },
    eyebrow: { type: 'string' },
    title: { type: 'string' },
    subtitle: { type: 'string' },
    body: { type: 'string' },
    bullets: { type: 'array', items: { type: 'string' } },
    stats: {
      type: 'array',
      items: {
        type: 'object',
        properties: { value: { type: 'string' }, label: { type: 'string' } },
        required: ['value', 'label']
      }
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, text: { type: 'string' } },
        required: ['label', 'text']
      }
    },
    columns: {
      type: 'array',
      items: {
        type: 'object',
        properties: { heading: { type: 'string' }, text: { type: 'string' } },
        required: ['heading', 'text']
      }
    },
    attribution: { type: 'string' },
    image_prompt: { type: 'string' },
    needs_visual: { type: 'boolean' },
    notes: { type: 'string' }
  },
  required: ['id', 'layout', 'eyebrow', 'title', 'subtitle', 'body', 'bullets', 'stats', 'steps', 'columns', 'attribution', 'image_prompt', 'needs_visual', 'notes']
};

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    title: { type: 'string' },
    subtitle: { type: 'string' },
    summary: { type: 'string' },
    theme: { type: 'string', enum: THEMES },
    brand: {
      type: 'object',
      properties: {
        bg: { type: 'string' },
        fg: { type: 'string' },
        accent: { type: 'string' },
        mode: { type: 'string', enum: ['light', 'dark'] },
        headingFont: { type: 'string', enum: ['sans', 'serif'] }
      }
    },
    slides: { type: 'array', items: SLIDE_SCHEMA }
  },
  required: ['reply', 'title', 'subtitle', 'summary', 'theme', 'slides']
};

const SYSTEM_PROMPT = `You are SlideFlow's presentation architect: a senior strategy consultant who writes decks and an award-winning slide designer, working as one person. You produce polished, modern, client-ready presentations.

SLIDE STRUCTURE
- Slide 1 is always layout "cover": a real title (never "Introduction"), a subtitle that promises the outcome, and a short eyebrow label giving category or context.
- Then build a narrative arc: situation, problem or opportunity, insight or approach, how it works, evidence or metrics, a comparison where it earns its place, a roadmap or timeline where sequence matters, the ask or next steps, and a final "closing" slide holding one decisive statement plus a one-line next step in the subtitle.
- Aim for the requested length. Never pad with filler, and never repeat a point on two slides.

COPY RULES (this is what makes a deck feel expensive)
- Titles: 2 to 7 words, specific and confident. Never "Overview", "Introduction", "Conclusion" or "Thank you" as a title.
- Bullets: at most 4, each under 12 words, each a real claim or fact rather than a vague promise.
- Write genuinely specific content for the topic. Never output placeholder text, brackets, "TBD" or lorem ipsum.
- Never invent a quote attributed to a named real person or company. If you use a quote, attribute it to a role instead, for example "Head of Operations, mid-market retail".
- No em dashes anywhere in slide copy. Use a comma, a colon or a period.
- Follow the spelling convention of the user's request.

LAYOUTS (pick what the content needs and vary them across the deck)
- cover: title, subtitle, eyebrow. First slide only.
- list: 5 or 6 short bullets rendered as a numbered index. For an agenda or a set of topics.
- bullets: title plus 3 to 4 bullets. The workhorse.
- split: title plus 3 to 4 bullets, set needs_visual true so an image sits beside the text.
- image: a short title and subtitle over a full-bleed visual, needs_visual true. Use once or twice for impact.
- stats: 2 to 4 big figures. Fill stats with short values like "87%", "$4.2M", "3.1x" and a plain-language label.
- quote: one striking line in body (max 22 words), attribution holding the source's role.
- compare: exactly two columns. columns holds [{heading, text}] where text is 2 or 3 short lines separated by "\\n".
- timeline: 3 or 4 steps. steps holds [{label, text}] with a short label like "Phase 1" or "Week 2" and one line of text.
- closing: one decisive statement in body, and the next step in subtitle.

VISUALS
- Set needs_visual true on at most 4 slides per deck, and only on cover, image or split slides.
- image_prompt is a detailed visual brief, 15 to 30 words, covering subject, medium, composition and colour palette. Never describe text, charts, logos or screenshots inside the image.
- Keep image_prompt free of brand names and real people.

SPEAKER NOTES
- notes holds one or two sentences the presenter could actually say out loud on this slide. It is the only place for longer prose.

FIELDS
- Every slide object must include all fields. Use "" for a text field you do not need and [] for a list you do not need.
- When editing an existing deck, keep the exact id of every slide you carry over, and use "" as the id for a slide you add.
- Always return the complete deck in "slides". Never return a partial list, a patch, or a description of changes.

THEMES
- "signal" is the default light theme (snow background, orange #FD5638 accent, dark text, Manrope). Prefer it for most corporate decks unless the content asks for something else.
- "signal-dark" is the dark companion (#2E2E2E background, orange accent, light text).
- The other presets (paper, midnight, cobalt, sandstone, carbon, violet) are still available when the topic or audience suits them.
- Only use "custom" when the user gives brand colors or a font style.

BRAND COLORS
- When the request specifies brand colors or a font style (for example "navy and orange #F47C20", "cream background with gold and bronze accents, serif headings", or any style guide), set theme to "custom" and return a brand object with: bg (background hex), fg (text hex), accent (primary accent hex), mode ("light" or "dark", chosen for legibility), and headingFont ("sans" for a modern sans-serif look, "serif" for elegant serif headings).
- Use the exact hex values the user gave when they gave them. When they named a color ("navy", "cream", "gold", "bronze"), choose a faithful, legible hex. Make sure fg contrasts clearly with bg.
- When the request does not mention brand colors or fonts, pick the best-fitting preset theme and return brand as null or omit it.
- On edits, keep the existing theme and brand unless the user explicitly asks to change the look.

REPLY
- reply is one or two short sentences written directly to the person: what you changed or created, plus any assumption you had to make. Never mention JSON, layouts, fields or ids. If the request was a question rather than a change, answer it and return the deck unchanged.`;

function asText(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function asList(value, max) {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

function normalizeSlide(raw, fallbackId) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const id = asText(s.id, 60);
  return {
    id: id || fallbackId,
    layout: LAYOUTS.indexOf(s.layout) !== -1 ? s.layout : 'bullets',
    eyebrow: asText(s.eyebrow, 70),
    title: asText(s.title, 120),
    subtitle: asText(s.subtitle, 220),
    body: asText(s.body, 600),
    bullets: asList(s.bullets, 6).map((b) => asText(b, 190)).filter(Boolean),
    stats: asList(s.stats, 4)
      .map((x) => ({ value: asText(x && x.value, 24), label: asText(x && x.label, 100) }))
      .filter((x) => x.value || x.label),
    steps: asList(s.steps, 4)
      .map((x) => ({ label: asText(x && x.label, 40), text: asText(x && x.text, 170) }))
      .filter((x) => x.label || x.text),
    columns: asList(s.columns, 2)
      .map((x) => ({ heading: asText(x && x.heading, 70), text: asText(x && x.text, 420) }))
      .filter((x) => x.heading || x.text),
    attribution: asText(s.attribution, 120),
    image_prompt: asText(s.image_prompt, 400),
    image_url: asText(s.image_url, 700),
    needs_visual: s.needs_visual === true,
    notes: asText(s.notes, 600)
  };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin access required' }, { status: 403 });

    const payload = await req.json().catch(() => ({}));
    const instruction = asText(payload && payload.instruction, 2000);
    if (!instruction) return Response.json({ error: 'A prompt is required.' }, { status: 400 });

    const options = payload && typeof payload.options === 'object' && payload.options ? payload.options : {};
    const theme = THEMES.indexOf(options.theme) !== -1 ? options.theme : 'paper';
    const tone = asText(options.tone, 80) || 'Clear and confident';
    const audience = asText(options.audience, 160);
    const requested = Number(options.slideCount);
    const slideTarget = Number.isFinite(requested)
      ? Math.min(Math.max(Math.round(requested), 5), MAX_SLIDES)
      : 10;

    const history = asList(payload && payload.history, 8)
      .map((m) => `${m && m.role === 'assistant' ? 'Assistant' : 'User'}: ${asText(m && m.content, 800)}`)
      .filter(Boolean)
      .join('\n');

    const incoming = payload && typeof payload.deck === 'object' && payload.deck ? payload.deck : null;
    const currentSlides = asList(incoming && incoming.slides, MAX_SLIDES).map((s, i) =>
      normalizeSlide(s, `in-${i + 1}`)
    );
    const isEdit = currentSlides.length > 0;
    const currentTheme = incoming && THEMES.indexOf(incoming.theme) !== -1 ? incoming.theme : theme;

    const parts = [isEdit ? 'TASK: EDIT THE EXISTING DECK.' : 'TASK: CREATE A NEW DECK.'];
    parts.push(`Preferred theme: ${theme}.`);
    parts.push(`Tone of voice: ${tone}.`);
    if (audience) parts.push(`Audience: ${audience}.`);
    if (isEdit) {
      parts.push(
        'CURRENT DECK (return it in full with your changes applied):',
        JSON.stringify({
          title: asText(incoming && incoming.title, 160),
          subtitle: asText(incoming && incoming.subtitle, 220),
          theme: currentTheme,
          brand: incoming && incoming.brand ? incoming.brand : null,
          slides: currentSlides
        })
      );
    } else {
      parts.push(`Target length: about ${slideTarget} slides.`);
    }
    if (history) parts.push('RECENT CONVERSATION:', history);
    parts.push('REQUEST:', instruction);

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${SYSTEM_PROMPT}\n\n---\n\n${parts.join('\n\n')}`,
      response_json_schema: RESPONSE_SCHEMA,
      add_context_from_internet: false
    });

    let result = llm;
    if (typeof result === 'string') {
      try {
        result = JSON.parse(result);
      } catch (parseError) {
        result = null;
      }
    }
    if (!result || !Array.isArray(result.slides) || result.slides.length === 0) {
      return Response.json({ error: 'That deck could not be generated. Try rephrasing the prompt.' }, { status: 502 });
    }

    const previous = new Map();
    currentSlides.forEach((s) => previous.set(s.id, s));

    const usedIds = new Set();
    const slides = result.slides.slice(0, MAX_SLIDES).map((raw, i) => {
      const slide = normalizeSlide(raw, '');
      if (!slide.id || usedIds.has(slide.id)) {
        slide.id = `sl-${crypto.randomUUID().slice(0, 8)}`;
      }
      usedIds.add(slide.id);

      const prior = previous.get(slide.id);
      if (prior && prior.image_prompt && prior.image_prompt === slide.image_prompt && prior.image_url) {
        slide.image_url = prior.image_url;
        slide.needs_visual = true;
      } else if (!slide.needs_visual) {
        slide.image_url = '';
      }
      return slide;
    });

    let visualBudget = MAX_VISUALS;
    slides.forEach((slide) => {
      if (slide.needs_visual && !slide.image_url) {
        if (visualBudget <= 0) slide.needs_visual = false;
        else visualBudget -= 1;
      }
    });

    const resolvedTheme = THEMES.indexOf(result.theme) !== -1 ? result.theme : currentTheme;
    let brand = null;
    if (resolvedTheme === 'custom') {
      const rb = result.brand && typeof result.brand === 'object' ? result.brand : null;
      const ib = incoming && incoming.brand ? incoming.brand : null;
      const src = rb || ib || {};
      brand = {
        bg: asText(src.bg, 9) || '#0B1F3A',
        fg: asText(src.fg, 9) || '#F4F7FB',
        accent: asText(src.accent, 9) || '#F47C20',
        mode: src.mode === 'light' || src.mode === 'dark' ? src.mode : 'dark',
        headingFont: src.headingFont === 'serif' ? 'serif' : 'sans'
      };
    }

    return Response.json({
      reply: asText(result.reply, 600) || 'Your deck is ready. Ask me for any change.',
      title: asText(result.title, 160) || asText(incoming && incoming.title, 160) || 'Untitled deck',
      subtitle: asText(result.subtitle, 220),
      summary: asText(result.summary, 300),
      theme: resolvedTheme,
      brand,
      slides
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
