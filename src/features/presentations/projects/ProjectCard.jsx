import React from 'react';
import { FolderOpen, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import DeckRow from '@/features/presentations/projects/DeckRow';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function ProjectCard({ project, decks, projects, onOpenDeck, onMoveDeck, onDeleteDeck, onEditDeck, onEditProject, onDeleteProject }) {
  return (
    <section className="flex flex-col rounded-none border border-border bg-card/70 p-4 backdrop-blur-md">
      <header className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-none bg-secondary">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-sans text-[15px] font-medium">{project.name}</h3>
          <p className="text-[11px] text-muted-foreground">
            {project.client ? `${project.client} · ` : ''}
            {decks.length} {decks.length === 1 ? 'presentation' : 'presentations'}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Project actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEditProject(project)} className="gap-2">
              <Pencil className="h-4 w-4" />
              Edit project
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDeleteProject(project)} className="gap-2 text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" />
              Delete project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {project.description ? (
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{project.description}</p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        {decks.length ? (
          decks.map((deck) => (
            <DeckRow
              key={deck.id}
              deck={deck}
              projects={projects}
              onOpen={onOpenDeck}
              onMove={onMoveDeck}
              onDelete={onDeleteDeck}
              onEdit={onEditDeck}
            />
          ))
        ) : (
          <p className="rounded-none border border-dashed border-border/80 px-3 py-4 text-center text-[12px] text-muted-foreground">
            No presentations in this project yet.
          </p>
        )}
      </div>
    </section>
  );
}
