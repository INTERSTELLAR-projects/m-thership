import { base44 } from "@/api/base44Client";

// Data access for the Social Studio. SocialPost is admin-only (RLS). Folder names are the union
// of folders used by posts and an explicit list kept in AppSettings (key social_studio) so an
// empty folder can exist before anything is filed in it.

const SETTINGS_KEY = "social_studio";
export const POSTS_KEY = ["SocialPost"];
export const FOLDERS_KEY = ["SocialPost", "folders"];

export const listPosts = () => base44.entities.SocialPost.list("-created_date", 500);
export const getPost = (id) => base44.entities.SocialPost.get(id);
export const createPost = (data) => base44.entities.SocialPost.create(data);
export const updatePost = (id, data) => base44.entities.SocialPost.update(id, data);
export const deletePost = (id) => base44.entities.SocialPost.delete(id);

async function settingsRow() {
  const rows = await base44.entities.AppSettings.filter({ key: SETTINGS_KEY }, "-created_date", 1).catch(() => []);
  return rows[0] || null;
}

export async function listSavedFolders() {
  const row = await settingsRow();
  const f = row?.pageSettings?.folders;
  return Array.isArray(f) ? f.filter(Boolean) : [];
}

export async function saveFolders(folders) {
  const clean = Array.from(new Set(folders.map((f) => String(f).trim()).filter(Boolean)));
  const row = await settingsRow();
  if (row) await base44.entities.AppSettings.update(row.id, { pageSettings: { ...(row.pageSettings || {}), folders: clean } });
  else await base44.entities.AppSettings.create({ key: SETTINGS_KEY, pageSettings: { folders: clean } });
  return clean;
}

/** Rename a folder everywhere: the saved list and every post filed in it. */
export async function renameFolder(from, to, posts) {
  const name = String(to || "").trim();
  if (!name || name === from) return;
  const saved = await listSavedFolders();
  await saveFolders(saved.map((f) => (f === from ? name : f)).concat(saved.includes(from) ? [] : [name]));
  await Promise.all(posts.filter((p) => p.folder === from).map((p) => updatePost(p.id, { folder: name })));
}

export function folderNames(posts, saved) {
  return Array.from(new Set([...(saved || []), ...posts.map((p) => p.folder).filter(Boolean)])).sort((a, b) => b.localeCompare(a));
}
