import React from 'react';
import { Copy, ImagePlus, Loader2, Sparkles, Trash2 } from 'lucide-react';
import RowListEditor from '@/components/studio/inspector/RowListEditor';
import VisualBlock from '@/components/slides/VisualBlock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SLIDE_LAYOUTS } from '@/lib/slideThemes';

const labelCls = 'text-[11px] uppercase tracking-wider text-muted-foreground';
const VISUAL_LAYOUTS = ['cover', 'split', 'image'];

export default function SlideInspector({
  slide,
  theme,
  index,
  total,
  onChange,
  onRefine,
  refining,
  onDuplicate,
  onDelete,
  onGenerateVisual,
  generatingVisual
}) {
  const [prompt, setPrompt] = React.useState('');
  const hasText = (key) => String(slide[key] || '').trim();
  const showSubtitle = !['quote', 'closing', 'stats'].includes(slide.layout);
  const showBody = ['quote', 'closing', 'bullets'].includes(slide.layout);

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
          <Label className={labelCls}>{slide.layout === 'quote' ? 'Quote title' : 'Title'}</Label>
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
            <Label className={labelCls}>{slide.layout === 'quote' ? 'Quote' : 'Statement'}</Label>
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
              max={4}
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
              placeholder="Head of Operations, mid-market retail"
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
