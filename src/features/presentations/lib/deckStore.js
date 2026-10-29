import { base44 } from '@/api/base44Client';

export async function listProjects() {
  const page = await base44.entities.DeckProject.list({ sort: 'name', limit: 100 });
  return page.items || [];
}

export async function listDecks() {
  const page = await base44.entities.Presentation.list({ sort: '-updated_date', limit: 100 });
  return page.items || [];
}

export async function createProject(data) {
  return base44.entities.DeckProject.create(data);
}

export async function updateProject(id, data) {
  return base44.entities.DeckProject.update(id, data);
}

export async function deleteProject(id) {
  await base44.entities.Presentation.updateMany({ project_id: id }, { $set: { project_id: '' } });
  return base44.entities.DeckProject.delete(id);
}

export async function deleteDeck(id) {
  return base44.entities.Presentation.delete(id);
}

export async function moveDeck(id, projectId) {
  return base44.entities.Presentation.update(id, { project_id: projectId || '' });
}

export function deckProgressLabel(generated, total) {
  if (total <= 0) return 'Preparing';
  if (generated >= total) return 'Done';
  return `Rendering ${generated + 1} of ${total}`;
}
