import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useList } from '@/lib/useData';
import { DECK_TONES } from '@/features/presentations/lib/slideThemes';
import { LOOKS, buildBrief, clientFacts, quickDraft } from '@/features/presentations/lib/deckSchema';

const labelCls = 'text-[11px] uppercase tracking-wider text-muted-foreground';
const COUNTS = [6, 8, 10, 12, 14, 16, 20];

// Build a rich brief once; then either draft it in-app now, or queue it for Claude to build properly.
export default function GenerateDeckDialog({ open, onOpenChange, hasSlides, defaults = {}, onDraft, onSendToClaude }) {
  const [form, setForm] = useState({ topic: '', clientId: '', audience: '', goals: '', slideCount: 10, tone: DECK_TONES[0], look: 'interstellar', includePricing: false, extra: '', target: 'new' });
  const [facts, setFacts] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showBrief, setShowBrief] = useState(false);
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
      return undefined;
    }
    clientFacts(form.clientId).then((f) => live && setFacts(f)).catch(() => live && setFacts(null));
    return () => { live = false; };
  }, [form.clientId]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const brief = useMemo(() => buildBrief({ ...form, facts }), [form, facts]);
  const meta = { client_id: facts ? facts.id : '', client_name: facts ? facts.business : '', audience: form.audience, tone: form.tone, brief: { ...form, facts: undefined } };
  const canGo = form.topic.trim().length > 3 && !busy;

  const draft = async () => {
    setBusy('draft');
    setError('');
    try {
      const deck = await quickDraft(brief);
      await onDraft({ deck, brief, meta, target: form.target });
      onOpenChange(false);
    } catch (e) {
      setError(e.message || 'The draft did not come back. Try again or send it to Claude.');
    } finally {
      setBusy('');
    }
  };

  const queue = async () => {
    setBusy('claude');
    setError('');
    try {
      await onSendToClaude({ brief, meta, title: form.topic.trim().slice(0, 80), target: form.target });
      onOpenChange(false);
    } catch (e) {
      setError(e.message || 'Could not queue the job.');
    } finally {
      setBusy('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate a deck with Claude</DialogTitle>
          <DialogDescription>One brief, two ways: a quick in-app draft now, or a Claude Queue job that researches and builds it properly and lands back here as an editable deck.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className={labelCls}>Topic</Label>
            <Textarea value={form.topic} onChange={(e) => set({ topic: e.target.value })} rows={2} placeholder="e.g. Mission ALPHA proposal for Palm Shore Hardscapes: website, system and map pack" className="resize-none text-sm" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className={labelCls}>Client (from CRM)</Label>
              <Select value={form.clientId || 'none'} onValueChange={(v) => set({ clientId: v === 'none' ? '' : v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="No client" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No client</SelectItem>
                  {(clients.data || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.business}</SelectItem>)}
                </SelectContent>
              </Select>
              {facts ? <p className="text-[11px] text-muted-foreground">{facts.lines.length} facts pulled from the CRM, dossier and brand kit.</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label className={labelCls}>Audience</Label>
              <Input value={form.audience} onChange={(e) => set({ audience: e.target.value })} placeholder="Owner + office manager" className="h-9 text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className={labelCls}>Goals — what should this deck achieve?</Label>
            <Textarea value={form.goals} onChange={(e) => set({ goals: e.target.value })} rows={2} placeholder="Close the sale on ALPHA; show the 45-day plan; handle the 'we already have a site' objection" className="resize-none text-sm" />
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
                <SelectContent>{LOOKS.map((l) => <SelectItem key={l.id} value={l.id} disabled={l.id === 'client' && !(facts && facts.colors && facts.colors.length)}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-none bg-secondary/70 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Include a pricing / offer slide</p>
              <p className="text-[11px] text-muted-foreground">Only prices you put in the brief are used</p>
            </div>
            <Switch checked={form.includePricing} onCheckedChange={(v) => set({ includePricing: v })} />
          </div>

          <div className="space-y-1.5">
            <Label className={labelCls}>Anything else (prices, facts, must-say lines)</Label>
            <Textarea value={form.extra} onChange={(e) => set({ extra: e.target.value })} rows={2} className="resize-none text-sm" />
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
            <Button variant="outline" className="gap-2" disabled={!canGo} onClick={draft}>
              {busy === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Quick draft now
            </Button>
            <Button className="gap-2 bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] text-white hover:opacity-90" disabled={!canGo} onClick={queue}>
              {busy === 'claude' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Send to Claude Queue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
