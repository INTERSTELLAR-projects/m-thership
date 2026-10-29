import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ChatPanel from '@/features/presentations/studio/ChatPanel';
import DeckToolbar from '@/features/presentations/studio/DeckToolbar';
import DeckCanvas from '@/features/presentations/studio/DeckCanvas';
import SlideRail from '@/features/presentations/studio/SlideRail';
import SlideInspector from '@/features/presentations/studio/SlideInspector';
import ExportRenderer from '@/features/presentations/studio/ExportRenderer';
import useDeckExport from '@/features/presentations/hooks/useDeckExport';
import { useToast } from '@/components/ui/use-toast';
import { listProjects } from '@/features/presentations/lib/deckStore';
import {
  DECK_TONES,
  blankSlide,
  getTheme,
  DEFAULT_CUSTOM_BRAND,
  normalizeBrand
} from '@/features/presentations/lib/slideThemes';
import { PRESENTATIONS_ROUTES } from '@/features/presentations/routes';

const newId = () =>
  window.crypto && window.crypto.randomUUID
    ? window.crypto.randomUUID()
    : `sl-${Math.random().toString(36).slice(2, 10)}`;

const ensureIds = (slides) => (slides || []).map((slide) => (slide.id ? slide : { ...slide, id: newId() }));

const unwrap = (response) => (response && response.data !== undefined ? response.data : response);

const EMPTY_DECK = {
  id: null,
  title: 'Untitled deck',
  subtitle: '',
  summary: '',
  theme: 'signal',
  brand: null,
  prompt: '',
  project_id: '',
  slides: []
};

const serialize = (deck) =>
  JSON.stringify({
    title: deck.title,
    subtitle: deck.subtitle,
    theme: deck.theme,
    brand: deck.brand || null,
    summary: deck.summary,
    project_id: deck.project_id || '',
    slides: deck.slides
  });

// The host Layout's <main> scrolls and sits under a 38px time-zone bar (plus a
// 48px top bar on mobile), so the studio claims a fixed-height workspace.
const WORKSPACE_CLS = 'relative flex h-[calc(100vh-86px)] min-h-0 flex-col overflow-hidden md:h-[calc(100vh-38px)]';

export default function StudioPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [deck, setDeck] = useState(EMPTY_DECK);
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [saveState, setSaveState] = useState('saved');
  const [mobileView, setMobileView] = useState('deck');
  const [refineTarget, setRefineTarget] = useState(null);
  const [visualTarget, setVisualTarget] = useState(null);
  const [options, setOptions] = useState({
    slideCount: 10,
    tone: DECK_TONES[0],
    audience: '',
    projectId: '',
    visuals: true
  });

  const exportRef = useRef(null);
  const snapshotRef = useRef(serialize(EMPTY_DECK));
  const deckIdRef = useRef(null);
  const { exporting, progress, run: runExport } = useDeckExport(exportRef, deck);

  const theme = getTheme(deck.theme, deck.brand);
  const selectedSlide = useMemo(
    () => deck.slides.find((slide) => slide.id === selectedId) || deck.slides[0] || null,
    [deck.slides, selectedId]
  );
  const selectedIndex = selectedSlide ? deck.slides.findIndex((slide) => slide.id === selectedSlide.id) : 0;

  useEffect(() => {
    let active = true;
    listProjects()
      .then((list) => {
        if (active) setProjects(list);
      })
      .catch(() => {
        /* the project list is optional scaffolding for the studio */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!id) {
      if (deckIdRef.current) {
        deckIdRef.current = null;
        snapshotRef.current = serialize(EMPTY_DECK);
        setDeck(EMPTY_DECK);
        setMessages([]);
        setSelectedId(null);
        setMobileView('deck');
      }
      setLoading(false);
      return undefined;
    }
    if (deckIdRef.current === id) return undefined;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const record = await base44.entities.Presentation.get(id);
        if (!active) return;
        const slides = ensureIds(record.slides || []);
        const loaded = {
          id: record.id,
          title: record.title || 'Untitled deck',
          subtitle: record.subtitle || '',
          summary: record.summary || '',
          theme: record.theme || 'paper',
          brand: record.brand || null,
          prompt: record.prompt || '',
          project_id: record.project_id || '',
          slides
        };
        deckIdRef.current = record.id;
        snapshotRef.current = serialize(loaded);
        setDeck(loaded);
        setOptions((prev) => ({ ...prev, projectId: record.project_id || '', tone: record.tone || prev.tone }));
        setSelectedId(slides[0] ? slides[0].id : null);
        setMessages([
          { role: 'assistant', content: `Opened “${loaded.title}”. Ask me for any change, or edit a slide directly.` }
        ]);
      } catch (error) {
        if (!active) return;
        toast({ title: 'That presentation could not be opened', description: error.message, variant: 'destructive' });
        navigate(PRESENTATIONS_ROUTES.projects, { replace: true });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, navigate, toast]);

  useEffect(() => {
    if (!deck.slides.length) return undefined;
    const payload = serialize(deck);
    if (payload === snapshotRef.current) return undefined;
    setSaveState('saving');
    const timer = setTimeout(async () => {
      try {
        const body = {
          title: deck.title || 'Untitled deck',
          subtitle: deck.subtitle || '',
          summary: deck.summary || '',
          theme: deck.theme,
          brand: deck.brand || null,
          tone: options.tone,
          slides: deck.slides,
          project_id: deck.project_id || ''
        };
        if (deck.id) {
          await base44.entities.Presentation.update(deck.id, body);
        } else {
          const created = await base44.entities.Presentation.create({ ...body, prompt: deck.prompt || '' });
          deckIdRef.current = created.id;
          setDeck((prev) => (prev.id ? prev : { ...prev, id: created.id }));
          navigate(PRESENTATIONS_ROUTES.deck(created.id), { replace: true });
        }
        snapshotRef.current = payload;
        setSaveState('saved');
      } catch (error) {
        setSaveState('error');
        toast({ title: 'Could not save your deck', description: error.message, variant: 'destructive' });
      }
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck]);

  const generateVisualsFor = async (slides, themeId, brand) => {
    const targets = slides
      .filter((slide) => slide.needs_visual && slide.image_prompt && !slide.image_url)
      .slice(0, 4);
    if (!targets.length) return;

    for (let index = 0; index < targets.length; index += 2) {
      const batch = targets.slice(index, index + 2);
      setStatus(`Generating visuals (${Math.min(index + batch.length, targets.length)} of ${targets.length})`);
      await Promise.all(
        batch.map(async (target) => {
          try {
            const response = await base44.functions.invoke('slideVisual', {
              prompt: target.image_prompt,
              theme: themeId,
              brand: themeId === 'custom' ? brand : undefined
            });
            const data = unwrap(response) || {};
            if (data.image_url) {
              setDeck((prev) => ({
                ...prev,
                slides: prev.slides.map((slide) =>
                  slide.id === target.id ? { ...slide, image_url: data.image_url } : slide
                )
              }));
            }
          } catch {
            /* a missing visual never blocks the deck */
          }
        })
      );
    }
  };

  const send = async (text, slideId = null) => {
    if (busy || !text.trim()) return;
    const instruction = slideId
      ? `Change only the slide with id "${slideId}". Leave every other slide exactly as it is. Instruction: ${text}`
      : text;
    const history = messages.slice(-6).map((message) => ({ role: message.role, content: message.content }));

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setBusy(true);
    if (slideId) setRefineTarget(slideId);
    setStatus(deck.slides.length ? 'Updating your deck' : 'Writing your deck');

    try {
      const response = await base44.functions.invoke('deckChat', {
        instruction,
        history,
        options: {
          slideCount: options.slideCount,
          tone: options.tone,
          audience: options.audience,
          theme: deck.theme
        },
        deck: deck.slides.length
          ? { title: deck.title, subtitle: deck.subtitle, theme: deck.theme, brand: deck.brand, slides: deck.slides }
          : null
      });
      const data = unwrap(response) || {};
      if (data.error) throw new Error(data.error);
      if (!Array.isArray(data.slides) || !data.slides.length) throw new Error('No slides came back.');

      const slides = ensureIds(data.slides);
      const nextTheme = data.theme || deck.theme;
      const nextBrand =
        nextTheme === 'custom' ? data.brand || deck.brand || DEFAULT_CUSTOM_BRAND : null;
      setDeck((prev) => ({
        ...prev,
        title: data.title || prev.title,
        subtitle: data.subtitle || prev.subtitle,
        summary: data.summary || prev.summary,
        theme: data.theme || prev.theme,
        brand:
          (data.theme || prev.theme) === 'custom'
            ? data.brand || prev.brand || DEFAULT_CUSTOM_BRAND
            : null,
        prompt: prev.prompt || (slideId ? prev.prompt : text),
        project_id: prev.project_id || options.projectId || '',
        slides
      }));
      setSelectedId((current) => (slides.some((slide) => slide.id === current) ? current : slides[0].id));
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply || 'Done.' }]);
      if (options.visuals) await generateVisualsFor(slides, nextTheme, nextBrand);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `That request did not go through: ${error.message}` }]);
    } finally {
      setBusy(false);
      setStatus('');
      setRefineTarget(null);
    }
  };

  const updateSlide = (slideId, patch) =>
    setDeck((prev) => ({
      ...prev,
      slides: prev.slides.map((slide) => (slide.id === slideId ? { ...slide, ...patch } : slide))
    }));

  const addSlide = () => {
    const slide = { ...blankSlide('bullets'), id: newId() };
    setDeck((prev) => {
      const at = prev.slides.findIndex((entry) => entry.id === selectedId);
      const next = [...prev.slides];
      next.splice(at === -1 ? next.length : at + 1, 0, slide);
      return { ...prev, slides: next };
    });
    setSelectedId(slide.id);
  };

  const duplicateSlide = () => {
    if (!selectedSlide) return;
    const copy = { ...selectedSlide, id: newId() };
    setDeck((prev) => {
      const at = prev.slides.findIndex((entry) => entry.id === selectedSlide.id);
      const next = [...prev.slides];
      next.splice(at + 1, 0, copy);
      return { ...prev, slides: next };
    });
    setSelectedId(copy.id);
  };

  const deleteSlide = () => {
    if (!selectedSlide) return;
    if (deck.slides.length <= 1) {
      toast({ title: 'A deck needs at least one slide' });
      return;
    }
    const remaining = deck.slides.filter((slide) => slide.id !== selectedSlide.id);
    setDeck((prev) => ({ ...prev, slides: remaining }));
    setSelectedId(remaining[0].id);
  };

  const generateVisualFor = async (slide) => {
    setVisualTarget(slide.id);
    try {
      const response = await base44.functions.invoke('slideVisual', {
        prompt: slide.image_prompt,
        theme: deck.theme,
        brand: deck.theme === 'custom' ? deck.brand : undefined
      });
      const data = unwrap(response) || {};
      if (data.error) throw new Error(data.error);
      if (data.image_url) updateSlide(slide.id, { image_url: data.image_url, needs_visual: true });
    } catch (error) {
      toast({ title: 'That visual could not be generated', description: error.message, variant: 'destructive' });
    } finally {
      setVisualTarget(null);
    }
  };

  const handleThemeChange = (themeId) => {
    setDeck((prev) => ({
      ...prev,
      theme: themeId,
      brand: themeId === 'custom' ? prev.brand || DEFAULT_CUSTOM_BRAND : null
    }));
  };

  const handleBrandChange = (brand) => {
    setDeck((prev) => ({ ...prev, theme: 'custom', brand: normalizeBrand(brand) }));
  };

  const handleExport = async (kind) => {
    try {
      const fileName = await runExport(kind);
      toast({ title: 'Download started', description: fileName });
    } catch (error) {
      toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleOptionsChange = (patch) => {
    setOptions((prev) => ({ ...prev, ...patch }));
    if (patch.projectId !== undefined && deck.id) {
      setDeck((prev) => ({ ...prev, project_id: patch.projectId }));
    }
  };

  if (loading) {
    return (
      <div className={`${WORKSPACE_CLS} items-center justify-center`}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={WORKSPACE_CLS}>
      <div className="flex gap-1 border-b border-border/70 px-3 py-2 lg:hidden">
        {[
          { key: 'chat', label: 'Assistant' },
          { key: 'deck', label: 'Slides' }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setMobileView(tab.key)}
            className={`flex-1 rounded-none px-3 py-1.5 text-sm transition-colors ${
              mobileView === tab.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          className={`${
            mobileView === 'chat' ? 'flex' : 'hidden'
          } bg-card/50 backdrop-blur-md min-h-0 w-full flex-col border-border/70 lg:flex lg:w-[340px] lg:flex-none lg:border-r xl:w-[380px]`}
        >
          <ChatPanel
            messages={messages}
            onSend={send}
            busy={busy}
            statusText={status}
            options={options}
            onOptionsChange={handleOptionsChange}
            projects={projects}
          />
        </aside>

        <section className={`${mobileView === 'deck' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col lg:flex`}>
          <DeckToolbar
            title={deck.title}
            onTitleChange={(value) => setDeck((prev) => ({ ...prev, title: value }))}
            themeId={deck.theme}
            brand={deck.brand}
            onThemeChange={handleThemeChange}
            onBrandChange={handleBrandChange}
            saveState={saveState}
            exporting={exporting}
            progress={progress}
            onExport={handleExport}
            hasDeck={deck.slides.length > 0}
          />

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className="thin-scroll flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 lg:p-6">
              <DeckCanvas
                slides={deck.slides}
                theme={theme}
                deckTitle={deck.title}
                selectedId={selectedSlide ? selectedSlide.id : null}
                onSelect={setSelectedId}
                onStart={(prompt) => {
                  setMobileView('chat');
                  send(prompt);
                }}
              />
            </div>

            {selectedSlide ? (
              <aside className="thin-scroll bg-card/50 backdrop-blur-md flex max-h-[56vh] w-full flex-col overflow-y-auto border-t border-border/70 lg:max-h-none lg:w-[300px] lg:flex-none lg:overflow-hidden lg:border-l lg:border-t-0 xl:w-[340px]">
                <SlideInspector
                  slide={selectedSlide}
                  theme={theme}
                  index={selectedIndex}
                  total={deck.slides.length}
                  onChange={(patch) => updateSlide(selectedSlide.id, patch)}
                  onRefine={(text) => send(text, selectedSlide.id)}
                  refining={busy && refineTarget === selectedSlide.id}
                  onDuplicate={duplicateSlide}
                  onDelete={deleteSlide}
                  onGenerateVisual={() => generateVisualFor(selectedSlide)}
                  generatingVisual={visualTarget === selectedSlide.id}
                />
              </aside>
            ) : null}
          </div>

          {deck.slides.length ? (
            <div className="border-t border-border/70">
              <SlideRail
                slides={deck.slides}
                themeId={deck.theme}
                brand={deck.brand}
                deckTitle={deck.title}
                selectedId={selectedSlide ? selectedSlide.id : null}
                onSelect={setSelectedId}
                onReorder={(slides) => setDeck((prev) => ({ ...prev, slides }))}
                onAdd={addSlide}
              />
            </div>
          ) : null}
        </section>
      </div>

      <ExportRenderer containerRef={exportRef} slides={deck.slides} themeId={deck.theme} brand={deck.brand} deckTitle={deck.title} />
    </div>
  );
}
