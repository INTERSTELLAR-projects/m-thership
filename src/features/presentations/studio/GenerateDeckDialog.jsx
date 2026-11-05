import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ListChecks, Loader2, RefreshCw, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useList } from '@/lib/useData';
import { DECK_TONES, SLIDE_LAYOUTS } from '@/features/presentations/lib/slideThemes';
import { LOOKS, buildBrief, clientFacts, planOutline, writeSlides } from '@/features/presentations/lib/deckSchema';
import { clientBrand, brandFromText } from '@/features/presentations/lib/clientBrand';

const labelCls = 'text-[11px] uppercase tracking-wider text-muted-foreground';
const COUNTS = [5, 6, 8, 10, 12, 14, 16, 20];

function Swatches({ brand }) {
  if (!brand) return null;
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {[brand.bg, brand.accent, brand.accent2, brand.fg].filter(Boolean).map((c, i) => (
        <span key={i} className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: c }} />
      ))}
      {brand.headingFamily ? <span className="ml-1 text-[11px] text-muted-foreground">{brand.headingFamily}</span> : null}
    </span>
  );
}

// Outline-first: brief -> outline you can review and edit -> slides. Or queue the brief for Claude.
export default function GenerateDeckDialog({ open, onOpenChange, hasSlides, defaults = {}, onDraft, onSendToClaude }) {
  const [form, setForm] = useState({ topic: '', clientId: '', audience: '', goals: '', slideCount: 10, tone: DECK_TONES[0], look: 'interstellar', includePricing: false, extra: '', target: 'new' });
  const [facts, setFacts] = useState(null);
  const [cBrand, setCBrand] = useState({ brand: null, source: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showBrief, setShowBrief] = useState(false);
  const [outline, setOutline] = useState(null);
  const clients = useList('CRMClient', { sort: 'business', limit: 300, enabled: open });

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm((f) => ({ ...f, audience: f.audience || defaults.audience || '', tone: defaults.tone || f.tone, slideCount: defaults.slideCount || f.slideCount, target: hasSlides ? 'new' : 'replace' }));
  }, [open]);

  useEffect(() => {
    let live = true;
    if (!form.clientId) {
      setFacts(null);
      setCBrand({ brand: null, source: '' });
      return undefined;
    }
    clientFacts(form.clientId).then((f) => live && setFacts(f)).catch(() => live && setFacts(null));
    clientBrand(form.clientId)
      .then((b) => {
        if (!live) return;
        setCBrand(b);
        if (b.brand) setForm((f) => ({ ...f, look: 'client' }));
      })
      .catch(() => live && setCBrand({ brand: null, source: '' }));
    return () => { live = false; };
  }, [form.clientId]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const brief = useMemo(() => buildBrief({ ...form, facts }), [form, facts]);
  const briefBrand = useMemo(() => brandFromText(`${form.topic}\n${form.goals}\n${form.extra}`), [form.topic, form.goals, form.extra]);

  // The look the deck will get: client brand kit, colours named in the brief, or Interstellar.
  const look = useMemo(() => {
    if (form.look === 'client' && cBrand.brand) return { theme: 'custom', brand: { ...cBrand.brand, name: cBrand.brand.name || (facts && facts.business) || '' }, source: cBrand.source };
    if (form.look === 'auto' && briefBrand) return { theme: 'custom', brand: briefBrand, source: 'Brief' };
    if (form.look === 'interstellar-dark') return { theme: 'interstellar-dark', brand: null, source: '' };
    return { theme: 'interstellar', brand: null, source: '' };
  }, [form.look, cBrand, briefBrand, facts]);

  const meta = { client_id: facts ? facts.id : '', client_name: facts ? facts.business : '', audience: form.audience, tone: form.tone, brief: { ...form, facts: undefined } };
  const canGo = form.topic.trim().length > 3 && !busy;

  const plan = async () => {
    setBusy('outline');
    setError('');
    try {
      setOutline(await planOutline({ brief, slideCount: form.slideCount, clientId: meta.client_id }));
    } catch (e) {
      setError(e.message || 'The outline did not come back. Try again.');
    } finally {
      setBusy('');
    }
  };

  const write = async () => {
    setBusy('slides');
    setError('');
    try {
      const { deck, removed } = await writeSlides({ brief, outline, slideCount: outline.slides.length, clientId: meta.client_id });
      await onDraft({ deck: { ...deck, theme: look.theme, brand: look.brand }, brief, meta: { ...meta, brand_source: look.source }, target: form.target, outline, removed });
      setOutline(null);
      onOpenChange(false);
    } catch (e) {
      setError(e.message || 'The slides did not come back. Try again.');
    } finally {
      setBusy('');
    }
  };

  const queue = async () => {
    setBusy('claude');
    setError('');
    try {
      await onSendToClaude({ brief, meta: { ...meta, brand_source: look.source }, title: form.topic.trim().slice(0, 80), target: form.target, theme: look.theme, brand: look.brand });
      onOpenChange(false);
    } catch (e) {
      setError(e.message || 'Could not queue the job.');
    } finally {
      setBusy('');
    }
  };

  const editRow = (i, patch) => setOutline((o) => ({ ...o, slides: o.slides.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const moveRow = (i, d) =>
    setOutline((o) => {
      const s = [...o.slides];
      const j = i + d;
      if (j < 0 || j >= s.length) return o;
      [s[i], s[j]] = [s[j], s[i]];
      return { ...o, slides: s };
    });
  const removeRow = (i) => setOutline((o) => ({ ...o, slides: o.slides.filter((_, j) => j !== i) }));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { onOpenChange(v); if (!v) setOutline(null); } }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{outline ? 'Review the outline' : 'Generate a deck'}</DialogTitle>
          <DialogDescription>
            {outline
              ? 'One line per slide. Edit, reorder or remove anything, then write the slides. Every figure comes from your brief.'
              : 'Describe the deck. We plan an outline first so you can check the story, then write every slide on brand.'}
          </DialogDescription>
        </DialogHeader>

        {outline ? (
          <div className="space-y-4">
            <div className="border-l-2 border-[#ff3c00] bg-secondary/50 px-3 py-2">
              <p className="text-sm font-semibold">{outline.title}</p>
              {outline.takeaway ? <p className="mt-0.5 text-[12px] text-muted-foreground">Takeaway: {outline.takeaway}</p> : null}
            </div>
            <ol className="space-y-2">
              {outline.slides.map((s, i) => (
                <li key={i} className="border border-border bg-card p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 font-mono text-[11px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                    <Select value={s.layout} onValueChange={(v) => editRow(i, { layout: v })}>
                      <SelectTrigger className="h-8 w-[132px] text-[12px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{SLIDE_LAYOUTS.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input value={s.title} onChange={(e) => editRow(i, { title: e.target.value })} className="h-8 flex-1 text-[13px]" aria-label={`Slide ${i + 1} title`} />
                    <button type="button" onClick={() => moveRow(i, -1)} className="text-muted-foreground hover:text-foreground" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => moveRow(i, 1)} className="text-muted-foreground hover:text-foreground" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => removeRow(i)} className="text-muted-foreground hover:text-red-600" aria-label="Remove slide"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  {s.points.length ? <p className="mt-1.5 pl-8 text-[11.5px] leading-snug text-muted-foreground">{s.points.join(' · ')}</p> : null}
                </li>
              ))}
            </ol>
            {outline.needs.length ? (
              <div className="bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900">
                <p className="font-medium">Facts that would make this deck stronger</p>
                <ul className="mt-1 list-disc pl-4">{outline.needs.map((n) => <li key={n}>{n}</li>)}</ul>
                <p className="mt-1 text-amber-800/80">Add them to the brief and re-plan, or write the slides without them. Nothing is guessed.</p>
              </div>
            ) : null}
            {error ? <p className="text-[12.5px] text-red-600">{error}</p> : null}
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-between">
              <div className="flex gap-2">
                <Button variant="ghost" className="gap-2" disabled={!!busy} onClick={() => setOutline(null)}><ArrowLeft className="h-4 w-4" /> Back to brief</Button>
                <Button variant="outline" className="gap-2" disabled={!!busy} onClick={plan}>{busy === 'outline' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Re-plan</Button>
              </div>
              <Button className="gap-2 bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] text-white hover:opacity-90" disabled={!!busy || outline.slides.length < 2} onClick={write}>
                {busy === 'slides' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} {busy === 'slides' ? 'Writing slides…' : `Write ${outline.slides.length} slides`}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className={labelCls}>What is the deck?</Label>
              <Textarea value={form.topic} onChange={(e) => set({ topic: e.target.value })} rows={2} placeholder="e.g. Proposal to the Ortega family for a backyard patio: scope, 3-week timeline, $28,400 investment" className="resize-none text-sm" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className={labelCls}>Client</Label>
                <Select value={form.clientId || 'none'} onValueChange={(v) => set({ clientId: v === 'none' ? '' : v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="No client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No client</SelectItem>
                    {(clients.data || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.business}</SelectItem>)}
                  </SelectContent>
                </Select>
                {facts ? <p className="text-[11px] text-muted-foreground">{facts.lines.length + (facts.brain || []).length} facts from the profile and Business Brain{cBrand.brand ? <> · brand from {cBrand.source} <Swatches brand={cBrand.brand} /></> : ' · no brand on file yet'}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label className={labelCls}>Audience</Label>
                <Input value={form.audience} onChange={(e) => set({ audience: e.target.value })} placeholder="Homeowners at a home show" className="h-9 text-sm" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className={labelCls}>Goal — what should the audience do or believe after?</Label>
              <Textarea value={form.goals} onChange={(e) => set({ goals: e.target.value })} rows={2} placeholder="Sign up for the Home Care Plan at the booth today" className="resize-none text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className={labelCls}>Facts, numbers and prices to use</Label>
              <Textarea value={form.extra} onChange={(e) => set({ extra: e.target.value })} rows={4} placeholder="Paste the real numbers, prices, dates, steps and terms. The deck uses only what is here and in the client profile." className="resize-y text-sm" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className={labelCls}>Slides</Label>
                <Select value={String(form.slideCount)} onValueChange={(v) => set({ slideCount: Number(v) })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{COUNTS.map((n) => <SelectItem key={n} value={String(n)}>{n} slides</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className={labelCls}>Tone</Label>
                <Select value={form.tone} onValueChange={(v) => set({ tone: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{DECK_TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className={labelCls}>Look</Label>
                <Select value={form.look} onValueChange={(v) => set({ look: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOOKS.map((l) => (
                      <SelectItem key={l.id} value={l.id} disabled={(l.id === 'client' && !cBrand.brand) || (l.id === 'auto' && !briefBrand)}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {look.brand ? <p className="text-[11px] text-muted-foreground"><Swatches brand={look.brand} /></p> : null}
              </div>
            </div>

            <div className="flex items-center justify-between bg-secondary/70 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Include a pricing slide</p>
                <p className="text-[11px] text-muted-foreground">Only prices you give are used</p>
              </div>
              <Switch checked={form.includePricing} onCheckedChange={(v) => set({ includePricing: v })} />
            </div>

            {hasSlides ? (
              <div className="flex gap-2 text-sm">
                {[['new', 'Make a new deck'], ['replace', 'Replace the open deck']].map(([k, label]) => (
                  <button key={k} type="button" onClick={() => set({ target: k })} className={`flex-1 border px-3 py-2 ${form.target === k ? 'border-[#ff3c00] bg-[#ff3c00]/[0.06]' : 'border-border'}`}>{label}</button>
                ))}
              </div>
            ) : null}

            <div>
              <button type="button" onClick={() => setShowBrief((v) => !v)} className="text-[11px] uppercase tracking-wider text-muted-foreground hover:text-[#ff3c00]">{showBrief ? 'Hide' : 'Show'} the brief</button>
              {showBrief ? <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap bg-secondary/60 p-3 text-[11.5px] text-muted-foreground">{brief}</pre> : null}
            </div>

            {error ? <p className="text-[12.5px] text-red-600">{error}</p> : null}

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button variant="outline" className="gap-2" disabled={!canGo} onClick={queue}>
                {busy === 'claude' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Send to Claude Queue
              </Button>
              <Button className="gap-2 bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] text-white hover:opacity-90" disabled={!canGo} onClick={plan}>
                {busy === 'outline' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />} {busy === 'outline' ? 'Planning…' : 'Plan the outline'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
