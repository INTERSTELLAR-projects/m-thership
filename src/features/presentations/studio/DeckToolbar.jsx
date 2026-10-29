import React from 'react';
import { Check, ChevronDown, Download, FileText, Loader2, Presentation } from 'lucide-react';
import ThemePicker from '@/features/presentations/studio/ThemePicker';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const PHASE_LABEL = {
  preparing: 'Preparing',
  rendering: 'Rendering',
  packing: 'Packing'
};

export default function DeckToolbar({
  title,
  onTitleChange,
  themeId,
  brand,
  onThemeChange,
  onBrandChange,
  saveState,
  exporting,
  progress,
  onExport,
  hasDeck
}) {
  const total = (progress && progress.total) || 0;
  const done = (progress && progress.done) || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const phaseLabel = exporting
    ? `${PHASE_LABEL[(progress && progress.phase) || 'rendering'] || 'Exporting'}${
        progress && progress.phase === 'rendering' && total > 0 ? ` ${done}/${total}` : ''
      }`
    : null;

  return (
    <div className="relative flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-2.5">
      <Input
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="Untitled deck"
        className="h-9 max-w-[320px] flex-1 border-transparent bg-transparent px-1 font-heading text-[15px] font-semibold shadow-none focus-visible:border-border"
      />

      <span className="flex items-center gap-1.5 rounded-full bg-secondary/80 px-2.5 py-1 text-[11px] text-muted-foreground">
        {saveState === 'saving' ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" /> Saving
          </>
        ) : (
          <>
            <Check className="h-3 w-3" /> {hasDeck ? 'Saved' : 'Not saved yet'}
          </>
        )}
      </span>

      <div className="ml-auto flex items-center gap-3">
        <ThemePicker value={themeId} brand={brand} onChange={onThemeChange} onBrandChange={onBrandChange} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-2" disabled={!hasDeck || Boolean(exporting)}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? phaseLabel : 'Export'}
              {exporting ? null : <ChevronDown className="h-3.5 w-3.5 opacity-70" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Download, exactly as designed</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onExport('pdf')} className="gap-2">
              <FileText className="h-4 w-4" />
              <span>
                PDF
                <span className="block text-[11px] text-muted-foreground">Pixel-accurate, ready to send</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onExport('pptx')} className="gap-2">
              <Presentation className="h-4 w-4" />
              <span>
                PowerPoint (.pptx)
                <span className="block text-[11px] text-muted-foreground">Your slides, with speaker notes</span>
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {exporting ? (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-secondary/70">
          <div className="h-full bg-primary transition-all duration-200" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}
