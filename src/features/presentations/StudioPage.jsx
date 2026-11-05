import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import PresentMode from '@/features/presentations/studio/PresentMode';
import GenerateDeckDialog from '@/features/presentations/studio/GenerateDeckDialog';
import { buildBrief, deckFromJob, editDeck, generateDeck, regenerateSlide } from '@/features/presentations/lib/deckSchema';
import { brandFromText } from '@/features/presentations/lib/clientBrand';
import { queueDeckJob } from '@/features/presentations/lib/claudeDeckJob';
import { approveJob, JOB_STATUS } from '@/features/claude/jobs';
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

// Entity-safe slides: a slide with no chart carries no chart key (null would fail the object-typed field).
const storable = (slides) =>
  (slides || []).map(({ chart, ...s }) =>
    chart && Array.isArray(chart.points)
      ? { ...s, chart: { ...chart, points: chart.points.map((p) => ({ label: String(p.label || ''), value: Number(p.value) || 0 })) } }
      : s
  );

const needsMessage = (needs) =>
  needs && needs.length ? `Facts that would make it stronger (nothing was guessed): ${needs.slice(0, 6).join('; ')}.` : '';

const EMPTY_DECK = {
  id: null,
  title: 'Untitled deck',
  subtitle: '',
  summary: '',
  theme: 'interstellar',
  brand: null,
  prompt: '',
  project_id: '',
  client_id: '',
  client_name: '',
  claude_job_id: '',
  generation_status: 'none',
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

  const [presenting, setPresenting] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [job, setJob] = useState(null);
  const [loadingJob, setLoadingJob] = useState(false);

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
          theme: record.theme || 'interstellar',
          brand: record.brand || null,
          prompt: record.prompt || '',
          project_id: record.project_id || '',
          client_id: record.client_id || '',
          client_name: record.client_name || '',
          claude_job_id: record.claude_job_id || '',
          generation_status: record.generation_status || 'none',
          slides
        };
        deckIdRef.current = record.id;
        snapshotRef.current = serialize(loaded);
        setDeck(loaded);
        setOptions((prev) => ({ ...prev, projectId: record.project_id || '', tone: record.tone || prev.tone }));
        setSelectedId(slides[0] ? slides[0].id : null);
        setMessages([
          { role: 'assistant', content: `Opened “${loaded.title}”. Ask me for any change, or edit a slide directly.` },
          ...(needsMessage(record.needs) ? [{ role: 'assistant', content: needsMessage(record.needs) }] : [])
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
          slides: storable(deck.slides),
          project_id: deck.project_id || ''
        };
        if (deck.id) {
          await base44.entities.Presentation.update(deck.id, body);
        } else {
          const created = await base44.entities.Presentation.create({
            ...body,
            prompt: deck.prompt || '',
            ...(deck.pending || {})
          });
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
  }, [deck]);

  // A deck being built in the Claude Queue: watch its job until the result is back.
  useEffect(() => {
    if (!deck.claude_job_id || deck.generation_status !== 'waiting_claude') {
      setJob(null);
      return undefined;
    }
    let live = true;
    const poll = () =>
      base44.entities.ClaudeJob.get(deck.claude_job_id)
        .then((j) => live && setJob(j))
        .catch(() => null);
    poll();
    const timer = setInterval(poll, 20000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [deck.claude_job_id, deck.generation_status]);

  // Approved from the Claude Queue page while this deck was open: pull the landed deck in.
  useEffect(() => {
    if (!job || job.status !== 'approved' || deck.generation_status !== 'waiting_claude') return;
    const landed = deckFromJob(job);
    if (landed) applyDeck(landed, { generation_status: 'ready' });
  }, [job]);

  const generateVisualsFor = async (slides, themeId, brand) => {
    const targets = slides
      .filter((slide) => slide.needs_visual && slide.image_prompt && !slide.image_url && ['cover', 'split', 'image'].includes(slide.layout))
      .slice(0, 3);
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

  // Chat: the first prompt plans an outline and writes the deck; later prompts edit the whole deck; a prompt on
  // one slide (or Regenerate) rewrites just that slide. All through the ai-gateway, metered to the deck's client.
  const send = async (text, slideId = null, { regenerate = false } = {}) => {
    if (busy || (!text.trim() && !regenerate)) return;
    const history = messages.slice(-6).map((message) => ({ role: message.role, content: message.content }));
    const clientId = deck.client_id || '';

    if (!regenerate) setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setBusy(true);
    if (slideId) setRefineTarget(slideId);
    setStatus(slideId ? 'Rewriting this slide' : deck.slides.length ? 'Updating your deck' : 'Planning the outline');

    try {
      if (slideId) {
        const slide = deck.slides.find((s) => s.id === slideId);
        if (!slide) throw new Error('That slide is gone.');
        const next = await regenerateSlide({ deck, slide, instruction: regenerate ? '' : text, brief: deck.prompt, clientId });
        updateSlide(slideId, next);
        setMessages((prev) => [...prev, { role: 'assistant', content: regenerate ? `Regenerated slide ${deck.slides.indexOf(slide) + 1}.` : 'Updated that slide.' }]);
        return;
      }

      if (deck.slides.length) {
        const { deck: edited, reply } = await editDeck({ deck, instruction: text, brief: deck.prompt, clientId, history });
        const slides = ensureIds(edited.slides);
        setDeck((prev) => ({ ...prev, title: edited.title || prev.title, subtitle: edited.subtitle || prev.subtitle, summary: edited.summary || prev.summary, slides }));
        setSelectedId((current) => (slides.some((slide) => slide.id === current) ? current : slides[0].id));
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
        if (options.visuals) await generateVisualsFor(slides, deck.theme, deck.brand);
        return;
      }

      // New deck from a chat prompt: outline first, then slides. Colours named in the prompt become the theme.
      const brief = buildBrief({ topic: text, audience: options.audience, slideCount: options.slideCount, tone: options.tone });
      const typedBrand = brandFromText(text);
      const nextTheme = typedBrand ? 'custom' : deck.theme || 'interstellar';
      const nextBrand = typedBrand || (nextTheme === 'custom' ? deck.brand : null);
      const { deck: drafted, outline } = await generateDeck({ brief, slideCount: options.slideCount, clientId, onStage: setStatus });
      const slides = ensureIds(drafted.slides);
      setDeck((prev) => ({
        ...prev,
        title: drafted.title || prev.title,
        subtitle: drafted.subtitle || '',
        summary: drafted.summary || '',
        theme: nextTheme,
        brand: nextBrand,
        prompt: brief,
        project_id: prev.project_id || options.projectId || '',
        pending: { outline, needs: drafted.needs || [], generated_by: 'pipeline_v2', brand_source: typedBrand ? 'Brief' : '', audience: options.audience || '' },
        slides
      }));
      setSelectedId(slides[0].id);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Planned ${outline.slides.length} slides and wrote “${drafted.title}”. Edit any slide, or ask me for changes.` },
        ...(needsMessage(drafted.needs) ? [{ role: 'assistant', content: needsMessage(drafted.needs) }] : [])
      ]);
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

  /* ---------- Generate with Claude ---------- */
  const applyDeck = (incoming, extra = {}) => {
    setDeck((prev) => ({
      ...prev,
      title: incoming.title || prev.title,
      subtitle: incoming.subtitle || '',
      summary: incoming.summary || '',
      theme: incoming.theme || prev.theme,
      brand: incoming.theme === 'custom' ? incoming.brand || DEFAULT_CUSTOM_BRAND : null,
      slides: incoming.slides,
      ...extra
    }));
    setSelectedId(incoming.slides[0] ? incoming.slides[0].id : null);
  };

  const handleDraft = async ({ deck: drafted, brief, meta, target, outline }) => {
    const record = {
      client_id: meta.client_id || '',
      client_name: meta.client_name || '',
      brief: meta.brief || {},
      audience: meta.audience || '',
      tone: meta.tone || options.tone,
      brand_source: meta.brand_source || '',
      outline: outline || null,
      needs: drafted.needs || [],
      generated_by: 'pipeline_v2',
      generation_status: 'ready'
    };
    if (target === 'replace' && deck.id) {
      applyDeck(drafted, { prompt: brief, client_id: record.client_id, client_name: record.client_name });
      await base44.entities.Presentation.update(deck.id, { ...record, prompt: brief });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Wrote “${drafted.title}” from your outline. Edit any slide, or ask me for changes.` },
        ...(needsMessage(drafted.needs) ? [{ role: 'assistant', content: needsMessage(drafted.needs) }] : [])
      ]);
      if (options.visuals) await generateVisualsFor(drafted.slides, drafted.theme, drafted.brand);
      return;
    }
    const created = await base44.entities.Presentation.create({
      ...record,
      title: drafted.title,
      subtitle: drafted.subtitle,
      summary: drafted.summary,
      theme: drafted.theme,
      brand: drafted.brand,
      slides: storable(drafted.slides),
      prompt: brief,
      project_id: options.projectId || ''
    });
    toast({ title: 'Draft ready', description: drafted.title });
    navigate(PRESENTATIONS_ROUTES.deck(created.id));
  };

  const handleSendToClaude = async ({ brief, meta, title, target, theme: lookTheme, brand: lookBrand }) => {
    const record = {
      client_id: meta.client_id || '',
      client_name: meta.client_name || '',
      brief: meta.brief || {},
      audience: meta.audience || '',
      tone: meta.tone || options.tone,
      brand_source: meta.brand_source || '',
      theme: lookTheme || 'interstellar',
      brand: lookBrand || null,
      generation_status: 'waiting_claude'
    };
    let presentationId = target === 'replace' && deck.id ? deck.id : null;
    if (presentationId) {
      await base44.entities.Presentation.update(presentationId, record);
    } else {
      const created = await base44.entities.Presentation.create({
        ...record,
        title: title || 'Deck for Claude',
        prompt: brief,
        slides: [],
        project_id: options.projectId || ''
      });
      presentationId = created.id;
    }
    const queued = await queueDeckJob({ presentationId, brief, meta, title });
    await base44.entities.Presentation.update(presentationId, { claude_job_id: queued.id });
    toast({ title: 'Sent to the Claude Queue', description: 'The deck lands here when Claude is done. You approve it by loading it.' });
    if (presentationId === deck.id) {
      setDeck((prev) => ({ ...prev, claude_job_id: queued.id, generation_status: 'waiting_claude' }));
    } else {
      navigate(PRESENTATIONS_ROUTES.deck(presentationId));
    }
  };

  const loadClaudeDeck = async () => {
    const drafted = deckFromJob(job);
    if (!drafted) {
      toast({ title: 'The job has no deck in result_data yet', variant: 'destructive' });
      return;
    }
    setLoadingJob(true);
    try {
      applyDeck(drafted, { generation_status: 'ready' });
      await approveJob(job);
      if (deck.id) await base44.entities.Presentation.update(deck.id, { generation_status: 'ready', generated_by: 'claude_queue' });
      setMessages((prev) => [...prev, { role: 'assistant', content: `Loaded Claude's deck “${drafted.title}”. Every slide is editable.` }]);
      if (options.visuals) await generateVisualsFor(drafted.slides, drafted.theme, drafted.brand);
    } catch (error) {
      toast({ title: 'Could not load the deck', description: error.message, variant: 'destructive' });
    } finally {
      setLoadingJob(false);
    }
  };

  const stopWaiting = async () => {
    setDeck((prev) => ({ ...prev, generation_status: 'none' }));
    if (deck.id) await base44.entities.Presentation.update(deck.id, { generation_status: 'none' }).catch(() => null);
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
            onPresent={() => setPresenting(true)}
            onPrint={() => window.print()}
            onGenerate={() => setGenOpen(true)}
          />

          {deck.generation_status === 'waiting_claude' ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-border/70 bg-[#ff3c00]/[0.05] px-4 py-2.5 text-sm">
              {job && job.status === 'needs_approval' && deckFromJob(job) ? (
                <>
                  <Sparkles className="h-4 w-4 text-[#ff3c00]" />
                  <span className="min-w-0 flex-1">Claude's deck is ready{job.result_summary ? `: ${job.result_summary}` : '.'}</span>
                  <button type="button" disabled={loadingJob} onClick={loadClaudeDeck} className="inline-flex h-8 items-center gap-1.5 bg-[#ff3c00] px-3 text-[12.5px] font-medium text-white hover:bg-[#1a1a1a] disabled:opacity-50">
                    {loadingJob ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Load into editor + approve
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-[#ff3c00]" />
                  <span className="min-w-0 flex-1">
                    Claude Queue is building this deck · {job ? (JOB_STATUS[job.status] || {}).label || job.status : 'checking'}
                    {job && job.status === 'needs_approval' ? ' (no deck in result_data; open the job)' : ''}
                  </span>
                </>
              )}
              {deck.claude_job_id ? <Link to={`/claude?job=${deck.claude_job_id}`} className="text-[12px] text-muted-foreground underline-offset-2 hover:underline">Open job</Link> : null}
              <button type="button" onClick={stopWaiting} className="text-[12px] text-muted-foreground hover:text-foreground">Stop waiting</button>
            </div>
          ) : null}

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
                  onRegenerate={() => send('', selectedSlide.id, { regenerate: true })}
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

      {presenting && deck.slides.length ? (
        <PresentMode slides={deck.slides} theme={theme} deckTitle={deck.title} startIndex={selectedIndex} onClose={() => setPresenting(false)} />
      ) : null}

      <GenerateDeckDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        hasSlides={deck.slides.length > 0}
        defaults={{ audience: options.audience, tone: options.tone, slideCount: options.slideCount }}
        onDraft={handleDraft}
        onSendToClaude={handleSendToClaude}
      />
    </div>
  );
}
