import React from 'react';
import moment from 'moment';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getTheme } from '@/lib/slideThemes';

export default function DeckRow({ deck, projects, onOpen, onMove, onDelete, onEdit }) {
  const theme = getTheme(deck.theme, deck.brand);
  const slideCount = (deck.slides || []).length;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-2 py-3 transition-colors hover:bg-accent/40">
      <button type="button" onClick={() => onOpen(deck.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-none border border-border/80" style={{ background: theme.swatch[0] }}>
          <span className="h-2 w-2 rounded-full" style={{ background: theme.swatch[1] }} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{deck.title}</span>
          <span className="block text-[11px] text-muted-foreground">
            {slideCount} {slideCount === 1 ? 'slide' : 'slides'} · updated {moment(deck.updated_date).fromNow()}
          </span>
        </span>
      </button>

      <Select value={deck.project_id || 'none'} onValueChange={(value) => onMove(deck.id, value === 'none' ? '' : value)}>
        <SelectTrigger className="h-8 w-[150px] text-xs">
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

      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpen(deck.id)}>
        Open
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Deck actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onEdit(deck.id)} className="gap-2">
            <Pencil className="h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDelete(deck.id)} className="gap-2 text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
