import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DECK_TONES } from '@/lib/slideThemes';

const SLIDE_COUNTS = [6, 8, 10, 12, 16];

export default function DeckOptions({ options, onChange, projects }) {
  return (
    <div className="rounded-none border border-border bg-card/70 p-3 backdrop-blur-md">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Slides</Label>
          <Select
            value={String(options.slideCount)}
            onValueChange={(value) => onChange({ slideCount: Number(value) })}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLIDE_COUNTS.map((count) => (
                <SelectItem key={count} value={String(count)}>
                  {count} slides
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Tone</Label>
          <Select value={options.tone} onValueChange={(value) => onChange({ tone: value })}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DECK_TONES.map((tone) => (
                <SelectItem key={tone} value={tone}>
                  {tone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Project</Label>
          <Select
            value={options.projectId || 'none'}
            onValueChange={(value) => onChange({ projectId: value === 'none' ? '' : value })}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="No project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Audience (optional)</Label>
          <Input
            value={options.audience}
            onChange={(event) => onChange({ audience: event.target.value })}
            placeholder="e.g. CFO and operations leads"
            className="h-9 text-sm"
          />
        </div>

        <div className="col-span-2 flex items-center justify-between rounded-none bg-secondary/70 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">AI visuals</p>
            <p className="text-[11px] text-muted-foreground">Up to 4 images generated for the deck</p>
          </div>
          <Switch checked={options.visuals} onCheckedChange={(checked) => onChange({ visuals: checked })} />
        </div>
      </div>
    </div>
  );
}
