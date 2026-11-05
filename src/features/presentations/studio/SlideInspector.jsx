import React from 'react';
import { Copy, ImagePlus, Loader2, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import RowListEditor from '@/features/presentations/studio/inspector/RowListEditor';
import VisualBlock from '@/features/presentations/slides/VisualBlock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SLIDE_LAYOUTS } from '@/features/presentations/lib/slideThemes';
import { CHART_TYPES } from '@/features/presentations/lib/deckSchema';

const labelCls = 'text-[11px] uppercase tracking-wider text-muted-foreground';

// Pricing / offer cards: name, price, period, description, features (one per line), recommended.
function OffersEditor({ offers, onChange }) {
  const list = Array.isArray(offers) ? offers : [];
  const set = (i, patch) => onChange(list.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  return (
    <div className="space-y-2.5">
      {list.map((o, i) => (
        <div key={i} className="space-y-2 rounded-none border border-border/80 bg-secondary/40 p-2.5">
          <div className="grid grid-cols-2 gap-2">
            <Input value={o.name || ''} onChange={(e) => set(i, { name: e.target.value })} placeholder="Name" className="h-9 bg-card text-sm" />
            <Input value={o.price || ''} onChange={(e) => set(i, { price: e.target.value })} placeholder="$4,997" className="h-9 bg-card text-sm" />
          </div>
          <Input value={o.period || ''} onChange={(e) => set(i, { period: e.target.value })} placeholder="one-time / per month" className="h-9 bg-card text-sm" />
          <Textarea value={o.description || ''} onChange={(e) => set(i, { description: e.target.value })} placeholder="One line on who it is for" rows={2} className="resize-none bg-card text-sm" />
          <Textarea
            value={Array.isArray(o.features) ? o.features.join('\n') : o.features || ''}
            onChange={(e) => set(i, { features: e.target.value.split('\n') })}
            placeholder="Features, one per line"
            rows={4}
            className="resize-none bg-card text-sm"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={Boolean(o.highlighted)} onChange={(e) => set(i, { highlighted: e.target.checked })} className="accent-[#ff3c00]" />
              Recommended
            </label>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[11px] text-muted-foreground" onClick={() => onChange(list.filter((_, j) => j !== i))}>
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          </div>
        </div>
      ))}
      {list.length < 3 ? (
        <Button variant="outline" size="sm" className="w-full border-dashed text-xs" onClick={() => onChange([...list, { name: '', price: '', period: '', description: '', features: [], highlighted: false }])}>
          Add offer
        </Button>
      ) : null}
    </div>
  );
}
const VISUAL_LAYOUTS = ['cover', 'split', 'image'];

// Chart data: type, units and the points (label + number). Values should be the real figures from the brief.
function ChartEditor({ chart, onChange }) {
  const c = chart && typeof chart === 'object' ? chart : { type: 'column', unit_prefix: '', unit_suffix: '', points: [], note: '' };
  const set = (patch) => onChange({ ...c, ...patch });
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <Select value={c.type || 'column'} onValueChange={(v) => set({ type: v })}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{CHART_TYPES.map((t) => <SelectItem key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
        </Select>
        <Input value={c.unit_prefix || ''} onChange={(e) => set({ unit_prefix: e.target.value })} placeholder="Prefix $" className="h-9 text-sm" />
        <Input value={c.unit_suffix || ''} onChange={(e) => set({ unit_suffix: e.target.value })} placeholder="Suffix % / K" className="h-9 text-sm" />
      </div>
      <RowListEditor
        fields={[
          { key: 'label', label: 'Label', placeholder: 'Q3' },
          { key: 'value', label: 'Value', placeholder: '412' }
        ]}
        items={(c.points || []).map((p) => ({ label: p.label, value: String(p.value ?? '') }))}
        onChange={(rows) => set({ points: rows.map((r) => ({ label: r.label || '', value: String(r.value ?? '').replace(/[^0-9.-]/g, '') })) })}
        max={8}
        addLabel="Add data point"
      />
      <Input value={c.note || ''} onChange={(e) => set({ note: e.target.value })} placeholder="Source or context line" className="h-9 text-sm" />
    </div>
  );
}

export default function SlideInspector({
  slide,
  theme,
  index,
  total,
  onChange,
  onRefine,
  onRegenerate,
  refining,
  onDuplicate,
  onDelete,
  onGenerateVisual,
  generatingVisual
}) {
  const [prompt, setPrompt] = React.useState('');
  const hasText = (key) => String(slide[key] || '').trim();
  const showSubtitle = !['quote'].includes(slide.layout);
  const showBody = ['quote', 'closing', 'bullets', 'split', 'pricing'].includes(slide.layout);

  const runRefine = () => {
    const text = prompt.trim();
    if (!text || refining) return;
    setPrompt('');
    onRefine(text);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Slide {index + 1}</p>
          <p className="text-[11px] text-muted-foreground">of {total}</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {onRegenerate ? (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onRegenerate} disabled={refining} title="Rewrite this slide from the brief">
              {refining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Regenerate
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDuplicate} aria-label="Duplicate slide">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            aria-label="Delete slide"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="thin-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <div className="space-y-2">
          <Label className={labelCls}>Change this slide by asking</Label>
          <div className="relative">
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  runRefine();
                }
              }}
              placeholder="e.g. make the headline punchier, add a figure about retention"
              rows={2}
              className="resize-none pr-10 text-sm"
            />
            <Button
              size="icon"
              className="absolute bottom-2.5 right-2.5 h-7 w-7"
              onClick={runRefine}
              disabled={refining || !prompt.trim()}
              aria-label="Refine slide"
            >
              {refining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className={labelCls}>Layout</Label>
          <Select value={slide.layout} onValueChange={(value) => onChange({ layout: value })}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLIDE_LAYOUTS.map((layout) => (
                <SelectItem key={layout.id} value={layout.id}>
                  {layout.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className={labelCls}>Eyebrow</Label>
          <Input
            value={slide.eyebrow}
            onChange={(event) => onChange({ eyebrow: event.target.value })}
            placeholder="Short label above the title"
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label className={labelCls}>Title</Label>
          <Textarea
            value={slide.title}
            onChange={(event) => onChange({ title: event.target.value })}
            rows={2}
            className="resize-none text-sm"
          />
        </div>

        {showSubtitle ? (
          <div className="space-y-2">
            <Label className={labelCls}>Subtitle</Label>
            <Textarea
              value={slide.subtitle}
              onChange={(event) => onChange({ subtitle: event.target.value })}
              rows={2}
              className="resize-none text-sm"
            />
          </div>
        ) : null}

        {showBody ? (
          <div className="space-y-2">
            <Label className={labelCls}>{slide.layout === 'quote' ? 'Quote (real words only)' : slide.layout === 'closing' ? 'Statement' : 'Text (shown when there are no bullets)'}</Label>
            <Textarea
              value={slide.body}
              onChange={(event) => onChange({ body: event.target.value })}
              rows={3}
              className="resize-none text-sm"
            />
          </div>
        ) : null}

        {['bullets', 'split', 'list'].includes(slide.layout) ? (
          <div className="space-y-2">
            <Label className={labelCls}>Bullets</Label>
            <RowListEditor
              fields={[{ key: 'value', label: 'Bullet', type: 'textarea' }]}
              items={slide.bullets}
              onChange={(bullets) => onChange({ bullets })}
              max={6}
              addLabel="Add bullet"
            />
          </div>
        ) : null}

        {slide.layout === 'cards' ? (
          <div className="space-y-2">
            <Label className={labelCls}>Cards</Label>
            <RowListEditor
              fields={[
                { key: 'title', label: 'Card title', placeholder: 'Priority scheduling' },
                { key: 'text', label: 'Text', type: 'textarea', placeholder: 'One short line' }
              ]}
              items={slide.cards}
              onChange={(cards) => onChange({ cards })}
              max={4}
              addLabel="Add card"
            />
          </div>
        ) : null}

        {slide.layout === 'chart' ? (
          <div className="space-y-2">
            <Label className={labelCls}>Chart data</Label>
            <ChartEditor chart={slide.chart} onChange={(chart) => onChange({ chart })} />
          </div>
        ) : null}

        {slide.layout === 'pricing' ? (
          <div className="space-y-2">
            <Label className={labelCls}>Offers</Label>
            <OffersEditor offers={slide.offers} onChange={(offers) => onChange({ offers })} />
          </div>
        ) : null}

        {slide.layout === 'bigstat' ? (
          <div className="space-y-2">
            <Label className={labelCls}>The figure</Label>
            <RowListEditor
              fields={[
                { key: 'value', label: 'Value', placeholder: '3.4x' },
                { key: 'label', label: 'Label', type: 'textarea', placeholder: 'What the figure means' }
              ]}
              items={slide.stats}
              onChange={(stats) => onChange({ stats })}
              max={1}
              addLabel="Add figure"
            />
          </div>
        ) : null}

        {slide.layout === 'stats' ? (
          <div className="space-y-2">
            <Label className={labelCls}>Key figures</Label>
            <RowListEditor
              fields={[
                { key: 'value', label: 'Value', placeholder: '87%' },
                { key: 'label', label: 'Label', type: 'textarea', placeholder: 'What the figure means' }
              ]}
              items={slide.stats}
              onChange={(stats) => onChange({ stats })}
              max={4}
              addLabel="Add figure"
            />
          </div>
        ) : null}

        {slide.layout === 'timeline' ? (
          <div className="space-y-2">
            <Label className={labelCls}>Steps</Label>
            <RowListEditor
              fields={[
                { key: 'label', label: 'Label', placeholder: 'Phase 1' },
                { key: 'text', label: 'Text', type: 'textarea' }
              ]}
              items={slide.steps}
              onChange={(steps) => onChange({ steps })}
              max={5}
              addLabel="Add step"
            />
          </div>
        ) : null}

        {slide.layout === 'compare' ? (
          <div className="space-y-2">
            <Label className={labelCls}>Columns</Label>
            <RowListEditor
              fields={[
                { key: 'heading', label: 'Heading' },
                { key: 'text', label: 'Lines', type: 'textarea', placeholder: 'One line per row' }
              ]}
              items={slide.columns}
              onChange={(columns) => onChange({ columns })}
              max={2}
            />
          </div>
        ) : null}

        {slide.layout === 'quote' ? (
          <div className="space-y-2">
            <Label className={labelCls}>Attribution</Label>
            <Input
              value={slide.attribution}
              onChange={(event) => onChange({ attribution: event.target.value })}
              placeholder="Who said it, as they're named (real quotes only)"
              className="h-9 text-sm"
            />
          </div>
        ) : null}

        {VISUAL_LAYOUTS.includes(slide.layout) ? (
          <div className="space-y-2 rounded-none border border-border/80 bg-secondary/40 p-3">
            <Label className={labelCls}>Visual</Label>
            <div className="overflow-hidden rounded-none">
              <VisualBlock theme={theme} src={slide.image_url} style={{ height: 116 }} />
            </div>
            <Input
              value={slide.image_url || ''}
              onChange={(event) => onChange({ image_url: event.target.value.trim(), needs_visual: Boolean(event.target.value.trim()) || slide.needs_visual })}
              placeholder="Image URL (paste one), or generate below"
              className="h-9 bg-card text-sm"
            />
            <Textarea
              value={slide.image_prompt}
              onChange={(event) => onChange({ image_prompt: event.target.value })}
              placeholder="Describe the image you want"
              rows={2}
              className="resize-none bg-card text-sm"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-xs"
                disabled={generatingVisual || !hasText('image_prompt')}
                onClick={onGenerateVisual}
              >
                {generatingVisual ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                {slide.image_url ? 'Replace image' : 'Generate image'}
              </Button>
              {slide.image_url ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => onChange({ image_url: '', needs_visual: false })}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label className={labelCls}>Speaker notes</Label>
          <Textarea
            value={slide.notes}
            onChange={(event) => onChange({ notes: event.target.value })}
            placeholder="What to say out loud on this slide"
            rows={3}
            className="resize-none text-sm"
          />
        </div>
      </div>
    </div>
  );
}
