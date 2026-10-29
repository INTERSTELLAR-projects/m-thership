import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, Loader2, Plus, Sparkles } from 'lucide-react';
import ProjectCard from '@/features/presentations/projects/ProjectCard';
import ProjectDialog from '@/features/presentations/projects/ProjectDialog';
import DeckRow from '@/features/presentations/projects/DeckRow';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  createProject,
  deleteDeck,
  deleteProject,
  listDecks,
  listProjects,
  moveDeck,
  updateProject
} from '@/features/presentations/lib/deckStore';
import { base44 } from '@/api/base44Client';
import { PRESENTATIONS_ROUTES } from '@/features/presentations/routes';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projects, setProjects] = useState([]);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [projectList, deckList] = await Promise.all([listProjects(), listDecks()]);
    setProjects(projectList);
    setDecks(deckList);
  };

  useEffect(() => {
    let active = true;
    load()
      .catch((error) => {
        if (active) toast({ title: 'Could not load your work', description: error.message, variant: 'destructive' });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const decksFor = (projectId) => decks.filter((deck) => (deck.project_id || '') === projectId);
  const unfiled = decksFor('');
  const openDeck = (deckId) => navigate(PRESENTATIONS_ROUTES.deck(deckId));

  const handleSaveProject = async (form) => {
    setSaving(true);
    try {
      if (editing) await updateProject(editing.id, form);
      else await createProject(form);
      await load();
      setDialogOpen(false);
      setEditing(null);
      toast({ title: editing ? 'Project updated' : 'Project created' });
    } catch (error) {
      toast({ title: 'Could not save the project', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async (project) => {
    if (!window.confirm(`Delete “${project.name}”? Its presentations stay and move to unfiled.`)) return;
    try {
      await deleteProject(project.id);
      await load();
      toast({ title: 'Project deleted' });
    } catch (error) {
      toast({ title: 'Could not delete the project', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteDeck = async (deckId) => {
    if (!window.confirm('Delete this presentation? This cannot be undone.')) return;
    try {
      await deleteDeck(deckId);
      await load();
      toast({ title: 'Presentation deleted' });
    } catch (error) {
      toast({ title: 'Could not delete the presentation', description: error.message, variant: 'destructive' });
    }
  };

  const handleRenameDeck = async (deckId) => {
    const deck = decks.find((entry) => entry.id === deckId);
    const title = window.prompt('Rename presentation', deck?.title || '');
    if (title === null) return;
    try {
      await base44.entities.Presentation.update(deckId, { title: title.trim() || 'Untitled deck' });
      await load();
    } catch (error) {
      toast({ title: 'Could not rename it', description: error.message, variant: 'destructive' });
    }
  };

  const handleMoveDeck = async (deckId, projectId) => {
    try {
      await moveDeck(deckId, projectId);
      await load();
    } catch (error) {
      toast({ title: 'Could not move the presentation', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="thin-scroll mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="font-sans text-2xl font-medium tracking-tight sm:text-3xl">Deck projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep presentations organised by client or engagement.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <FolderPlus className="h-4 w-4" />
          New project
        </Button>
        <Button className="gap-2" onClick={() => navigate(PRESENTATIONS_ROUTES.studio)}>
          <Sparkles className="h-4 w-4" />
          New presentation
        </Button>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            decks={decksFor(project.id)}
            projects={projects}
            onOpenDeck={openDeck}
            onMoveDeck={handleMoveDeck}
            onDeleteDeck={handleDeleteDeck}
            onEditDeck={handleRenameDeck}
            onEditProject={(entry) => { setEditing(entry); setDialogOpen(true); }}
            onDeleteProject={handleDeleteProject}
          />
        ))}

        <section className="rounded-none border border-border bg-card/70 p-4 backdrop-blur-md">
          <header className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-none bg-secondary">
              <Plus className="h-4 w-4 text-muted-foreground" />
            </span>
            <div>
              <h3 className="font-sans text-[15px] font-medium">Unfiled presentations</h3>
              <p className="text-[11px] text-muted-foreground">
                {unfiled.length} {unfiled.length === 1 ? 'presentation' : 'presentations'} without a project
              </p>
            </div>
          </header>
          <div className="mt-4 flex flex-col gap-2">
            {unfiled.length ? (
              unfiled.map((deck) => (
                <DeckRow
                  key={deck.id}
                  deck={deck}
                  projects={projects}
                  onOpen={openDeck}
                  onMove={handleMoveDeck}
                  onDelete={handleDeleteDeck}
                  onEdit={handleRenameDeck}
                />
              ))
            ) : (
              <p className="rounded-none border border-dashed border-border/80 px-3 py-4 text-center text-[12px] text-muted-foreground">
                {projects.length ? 'Everything is filed in a project.' : 'Create your first presentation in the Studio.'}
              </p>
            )}
          </div>
        </section>
      </div>

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}
        project={editing}
        onSave={handleSaveProject}
        saving={saving}
      />
    </div>
  );
}
