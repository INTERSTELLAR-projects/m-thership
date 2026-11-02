import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { CheckSquare, Columns3, Download, FolderPlus, Grid2x2, Loader2, Pencil, Plus, Search, Sparkles, Square, Trash2, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { PILLARS, STATUSES } from "./brand";
import ScaledPost from "./PostCanvas";
import { useBatchExport } from "./BatchExport";
import { exampleSpec, getTemplate, TEMPLATES } from "./templates";
import {
  FOLDERS_KEY, POSTS_KEY, createPost, deletePost, folderNames, listPosts, listSavedFolders, renameFolder, saveFolders, updatePost,
} from "./lib/socialStore";
import { Btn, ConfirmDialog, PILLAR_LABEL, PromptDialog, Select, StatusBadge, inputCls } from "./ui";

const VIEW_KEY = "social_studio_view";
const readView = () => { try { return localStorage.getItem(VIEW_KEY) || "board"; } catch { return "board"; } };
const writeView = (v) => { try { localStorage.setItem(VIEW_KEY, v); } catch { /* per-viewer convenience */ } };

export default function SocialPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState(readView);
  const [selected, setSelected] = useState(() => new Set());
  const [dialog, setDialog] = useState(null); // { kind: "newFolder" | "renameFolder" | "moveFolder" | "delete" }
  const batch = useBatchExport();

  const postsQ = useQuery({ queryKey: POSTS_KEY, queryFn: listPosts });
  const foldersQ = useQuery({ queryKey: FOLDERS_KEY, queryFn: listSavedFolders });
  const posts = useMemo(() => postsQ.data || [], [postsQ.data]);
  const folders = folderNames(posts, foldersQ.data);
  const batches = Array.from(new Set(posts.map((p) => p.generation_batch).filter(Boolean))).sort().reverse();

  const f = {
    status: params.get("status") || "",
    folder: params.get("folder") || "",
    pillar: params.get("pillar") || "",
    batch: params.get("batch") || "",
    q: params.get("q") || "",
  };
  const setFilter = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  const filtered = posts.filter((p) =>
    (!f.status || view === "board" || p.status === f.status) &&
    (!f.folder || p.folder === f.folder) &&
    (!f.pillar || p.pillar === f.pillar) &&
    (!f.batch || p.generation_batch === f.batch) &&
    (!f.q || `${p.title} ${p.spec?.headline || ""} ${p.caption || ""}`.toLowerCase().includes(f.q.toLowerCase())),
  );

  const refresh = () => { qc.invalidateQueries({ queryKey: POSTS_KEY }); qc.invalidateQueries({ queryKey: FOLDERS_KEY }); };

  const patch = useMutation({
    mutationFn: ({ ids, data }) => Promise.all(ids.map((id) => updatePost(id, data))),
    onMutate: async ({ ids, data }) => {
      await qc.cancelQueries({ queryKey: POSTS_KEY });
      const prev = qc.getQueryData(POSTS_KEY);
      qc.setQueryData(POSTS_KEY, (old = []) => old.map((p) => (ids.includes(p.id) ? { ...p, ...data } : p)));
      return { prev };
    },
    onError: (_e, _v, ctx) => { qc.setQueryData(POSTS_KEY, ctx?.prev); toast({ title: "Couldn't update the post", variant: "destructive" }); },
    onSettled: () => qc.invalidateQueries({ queryKey: POSTS_KEY }),
  });

  const setStatus = (ids, status) => {
    const data = { status };
    if (status === "posted") data.posted_at = new Date().toISOString();
    patch.mutate({ ids, data });
  };

  const newPost = async () => {
    const t = TEMPLATES[0];
    const created = await createPost({
      title: "Untitled post",
      status: "draft",
      template: t.key,
      spec: exampleSpec(t.key),
      pillar: t.best_for?.[0] || "pain_point",
      platforms: ["instagram", "facebook", "linkedin"],
      folder: f.folder || undefined,
      generated_by: "justin",
    });
    refresh();
    navigate(`/social/${created.id}`);
  };

  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ids = Array.from(selected).filter((id) => posts.some((p) => p.id === id));
  const selectedPosts = posts.filter((p) => selected.has(p.id));

  const onDragEnd = (r) => {
    if (!r.destination || r.destination.droppableId === r.source.droppableId) return;
    setStatus([r.draggableId], r.destination.droppableId);
  };

  const exportZip = async (list, name) => {
    try {
      await batch.run(list, name);
    } catch (e) {
      toast({ title: "Export failed", description: String(e?.message || e), variant: "destructive" });
    }
  };

  const closeDialog = () => setDialog(null);

  return (
    <div className="min-h-full">
      {batch.node}
      <PageHeader breadcrumb="Studio / Social Studio" rightText="Static 1:1 · Claude drafts, Justin posts">
        <Btn variant="flame" onClick={newPost}><Plus className="h-3.5 w-3.5" />New post</Btn>
      </PageHeader>

      <div className="px-5 py-5 md:px-8">
        <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
          On-brand posts rendered from structured specs. Claude drops a weekly batch as drafts; review, tweak or edit with AI, download the PNG, post it, then mark it posted.
          Nothing here posts to social media.
        </p>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border border-hair bg-card p-2">
          <div className="flex border border-hair">
            <button type="button" onClick={() => { setView("board"); writeView("board"); }} className={`flex h-8 items-center gap-1 px-2.5 text-[12px] ${view === "board" ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}><Columns3 className="h-3.5 w-3.5" />Board</button>
            <button type="button" onClick={() => { setView("grid"); writeView("grid"); }} className={`flex h-8 items-center gap-1 px-2.5 text-[12px] ${view === "grid" ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}><Grid2x2 className="h-3.5 w-3.5" />Grid</button>
          </div>
          <div className="relative min-w-[160px] flex-1 md:max-w-[240px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
            <input value={f.q} onChange={(e) => setFilter("q", e.target.value)} placeholder="Search posts" className={`${inputCls} h-8 py-0 pl-8`} />
          </div>
          {view === "grid" && <Select className="h-8 w-auto" value={f.status} onChange={(v) => setFilter("status", v)} placeholder="All statuses" options={STATUSES.map((s) => ({ value: s.key, label: s.label }))} />}
          <Select className="h-8 w-auto" value={f.folder} onChange={(v) => setFilter("folder", v)} placeholder="All folders" options={folders} />
          <Select className="h-8 w-auto" value={f.pillar} onChange={(v) => setFilter("pillar", v)} placeholder="All pillars" options={PILLARS.map((p) => ({ value: p.key, label: p.label }))} />
          <Select className="h-8 w-auto" value={f.batch} onChange={(v) => setFilter("batch", v)} placeholder="All batches" options={batches} />
          <div className="ml-auto flex items-center gap-1">
            <Btn variant="ghost" onClick={() => setDialog({ kind: "newFolder" })} title="New folder"><FolderPlus className="h-3.5 w-3.5" />Folder</Btn>
            {f.folder && <Btn variant="ghost" onClick={() => setDialog({ kind: "renameFolder" })} title="Rename this folder"><Pencil className="h-3.5 w-3.5" />Rename</Btn>}
            {(f.batch || f.folder) && filtered.length > 0 && (
              <Btn onClick={() => exportZip(filtered, f.batch || f.folder)} disabled={batch.busy}><Download className="h-3.5 w-3.5" />Download {f.batch ? "batch" : "folder"} (.zip)</Btn>
            )}
          </div>
        </div>

        {/* Bulk bar */}
        {ids.length > 0 && (
          <div className="sticky top-0 z-20 mt-2 flex flex-wrap items-center gap-2 border border-ink bg-ink px-3 py-2 text-white">
            <span className="mono-label text-[10px] text-white/70">{ids.length} selected</span>
            <select value="" onChange={(e) => e.target.value && setStatus(ids, e.target.value)} className="h-8 border border-white/25 bg-ink px-2 text-[12px]">
              <option value="">Move to status…</option>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <Btn variant="ink" className="border-white/25" onClick={() => setDialog({ kind: "moveFolder" })}>Move to folder</Btn>
            <Btn variant="ink" className="border-white/25" onClick={() => exportZip(selectedPosts, `social-${new Date().toISOString().slice(0, 10)}`)} disabled={batch.busy}><Download className="h-3.5 w-3.5" />Download (.zip)</Btn>
            <Btn variant="ink" className="border-white/25" onClick={() => setDialog({ kind: "delete" })}><Trash2 className="h-3.5 w-3.5" />Delete</Btn>
            <button type="button" onClick={() => setSelected(new Set())} className="ml-auto p-1 text-white/60 hover:text-white" title="Clear selection"><X className="h-4 w-4" /></button>
          </div>
        )}
        {batch.progress && (
          <p className="mt-2 flex items-center gap-2 text-[12px] text-ink/60"><Loader2 className="h-3.5 w-3.5 animate-spin" />Rendering {batch.progress.done} / {batch.progress.total} at 1080×1080…</p>
        )}

        {/* Body */}
        {postsQ.isLoading ? (
          <p className="py-20 text-center text-[13px] text-ink/50"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading posts…</p>
        ) : posts.length === 0 ? (
          <Empty onNew={newPost} />
        ) : view === "board" ? (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="mt-4 grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-4">
              {STATUSES.map((s) => {
                const col = filtered.filter((p) => (p.status || "draft") === s.key);
                return (
                  <Droppable droppableId={s.key} key={s.key}>
                    {(drop, snap) => (
                      <div ref={drop.innerRef} {...drop.droppableProps} className={`flex min-h-[320px] flex-col gap-2 border p-2 transition-colors ${snap.isDraggingOver ? "border-[#ff3c00] bg-[#ff3c00]/5" : "border-hair bg-card/60"}`}>
                        <div className="flex items-center justify-between px-1 pb-1">
                          <span className="text-[13px] font-semibold tracking-[-0.01em]">{s.label}</span>
                          <span className="mono-label text-[9px] text-ink/45">{col.length}</span>
                        </div>
                        {col.map((p, i) => (
                          <Draggable draggableId={p.id} index={i} key={p.id}>
                            {(drag, dsnap) => (
                              <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps} className={dsnap.isDragging ? "rotate-1 shadow-xl" : ""}>
                                <PostCard post={p} compact selected={selected.has(p.id)} onToggle={() => toggle(p.id)} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {drop.placeholder}
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </DragDropContext>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((p) => <PostCard key={p.id} post={p} selected={selected.has(p.id)} onToggle={() => toggle(p.id)} onStatus={(s) => setStatus([p.id], s)} />)}
            {filtered.length === 0 && <p className="col-span-full py-16 text-center text-[13px] text-ink/50">No posts match these filters.</p>}
          </div>
        )}
      </div>

      <PromptDialog
        open={dialog?.kind === "newFolder"}
        title="New folder"
        description="Folders group posts, e.g. one per weekly batch or campaign."
        initial=""
        confirmLabel="Create"
        onClose={closeDialog}
        onConfirm={async (name) => {
          await saveFolders([...(foldersQ.data || []), name]);
          if (ids.length) patch.mutate({ ids, data: { folder: name } });
          refresh();
          setFilter("folder", name);
          closeDialog();
        }}
      />
      <PromptDialog
        open={dialog?.kind === "renameFolder"}
        title="Rename folder"
        initial={f.folder}
        confirmLabel="Rename"
        onClose={closeDialog}
        onConfirm={async (name) => {
          await renameFolder(f.folder, name, posts);
          refresh();
          setFilter("folder", name);
          closeDialog();
        }}
      />
      <MoveFolderDialog
        open={dialog?.kind === "moveFolder"}
        folders={folders}
        onClose={closeDialog}
        onConfirm={async (name) => {
          if (!folders.includes(name)) await saveFolders([...(foldersQ.data || []), name]);
          patch.mutate({ ids, data: { folder: name } });
          qc.invalidateQueries({ queryKey: FOLDERS_KEY });
          closeDialog();
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        title={`Delete ${ids.length} post${ids.length === 1 ? "" : "s"}?`}
        description="This removes the posts and their revision history. It can't be undone."
        confirmLabel="Delete"
        onClose={closeDialog}
        onConfirm={async () => {
          await Promise.all(ids.map((id) => deletePost(id)));
          setSelected(new Set());
          refresh();
          closeDialog();
        }}
      />
    </div>
  );
}

function PostCard({ post, compact, selected, onToggle, onStatus }) {
  const t = getTemplate(post.template);
  return (
    <div className={`group relative border bg-card transition-colors ${selected ? "border-[#ff3c00]" : "border-hair hover:border-[#ff3c00]/50"}`}>
      <Link to={`/social/${post.id}`} className="block">
        <ScaledPost template={post.template} spec={post.spec} />
      </Link>
      <button type="button" onClick={onToggle} className={`absolute left-1.5 top-1.5 bg-white/90 p-0.5 ${selected ? "text-[#ff3c00]" : "text-ink/40 opacity-0 group-hover:opacity-100"}`} title="Select">
        {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
      </button>
      <div className={compact ? "px-2.5 py-2" : "px-3 py-2.5"}>
        <div className="flex items-center gap-1.5">
          <StatusBadge status={post.status} />
          {post.generated_by === "claude" && <Sparkles className="h-3 w-3 text-[#ff6a00]" title="Generated by Claude" />}
          <span className="mono-label ml-auto truncate text-[8.5px] text-ink/45">{PILLAR_LABEL[post.pillar] || ""}</span>
        </div>
        <Link to={`/social/${post.id}`} className="mt-1 block truncate text-[13px] font-medium hover:text-[#ff3c00]">{post.title || post.spec?.headline || "Untitled"}</Link>
        <p className="truncate text-[11px] text-ink/45">{t.label}{post.folder ? ` · ${post.folder}` : ""}{post.planned_for ? ` · ${post.planned_for}` : ""}</p>
        {onStatus && (
          <select value={post.status || "draft"} onChange={(e) => onStatus(e.target.value)} className="mt-2 h-7 w-full border border-hair bg-paper px-1.5 text-[11.5px]">
            {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

function MoveFolderDialog({ open, folders, onClose, onConfirm }) {
  const [choice, setChoice] = useState("");
  const [custom, setCustom] = useState("");
  const name = custom.trim() || choice;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Move to folder</DialogTitle></DialogHeader>
        <Select value={choice} onChange={setChoice} placeholder="Pick a folder" options={folders} />
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="…or type a new folder name" className={inputCls} />
        <DialogFooter>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="flame" disabled={!name} onClick={() => onConfirm(name)}>Move</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Empty({ onNew }) {
  return (
    <div className="mt-6 flex flex-col items-center justify-center border border-dashed border-hair px-6 py-16 text-center">
      <Sparkles className="mb-3 h-6 w-6 text-ink/25" />
      <p className="text-sm font-medium text-ink/70">No posts yet</p>
      <p className="mt-1 max-w-sm text-xs text-ink/45">The weekly Claude batch lands here as drafts. You can also start one by hand.</p>
      <div className="mt-4"><Btn variant="flame" onClick={onNew}><Plus className="h-3.5 w-3.5" />New post</Btn></div>
    </div>
  );
}
