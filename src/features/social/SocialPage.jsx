import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Download, FolderPlus, Grid2x2, Loader2, Pencil, Plug, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { PILLARS } from "./brand";
import { useBatchExport } from "./BatchExport";
import { exampleSpec, TEMPLATES } from "./templates";
import {
  FOLDERS_KEY, POSTS_KEY, createPost, deletePost, folderNames, listPosts, listSavedFolders, renameFolder, saveFolders, updatePost,
} from "./lib/socialStore";
import { TABS, approvePost, fmtWhen, restoreDraft, suggestSlot, tabOf, unschedulePost } from "./lib/publish";
import { ApproveDialog, DeclineDialog, useMe, usePostImage, useSocialStatus } from "./PublishDialogs";
import PostCard from "./PostCard";
import CalendarView from "./CalendarView";
import ConnectionsPanel from "./ConnectionsPanel";
import { Btn, ConfirmDialog, PromptDialog, Select, inputCls } from "./ui";

const VIEW_KEY = "social_studio_view2";
const readView = () => { try { return localStorage.getItem(VIEW_KEY) || "grid"; } catch { return "grid"; } };
const writeView = (v) => { try { localStorage.setItem(VIEW_KEY, v); } catch { /* per-viewer convenience */ } };

export default function SocialPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState(readView);
  const [selected, setSelected] = useState(() => new Set());
  const [dialog, setDialog] = useState(null); // { kind, post?, mode?, date? }
  const [connections, setConnections] = useState(false);
  const [bulk, setBulk] = useState(null); // { done, total }
  const batch = useBatchExport();
  const img = usePostImage();
  const status = useSocialStatus();
  const me = useMe();
  const tz = status.settings.timezone;

  const postsQ = useQuery({
    queryKey: POSTS_KEY,
    queryFn: listPosts,
    // Poll while something is publishing or due within the hour, so cards flip to Posted on their own.
    refetchInterval: (q) => ((q.state.data || []).some((p) => p.status === "publishing" || (p.status === "approved" && Date.parse(p.scheduled_at || 0) < Date.now() + 3600000)) ? 30000 : false),
  });
  const foldersQ = useQuery({ queryKey: FOLDERS_KEY, queryFn: listSavedFolders });
  const posts = useMemo(() => postsQ.data || [], [postsQ.data]);
  const folders = folderNames(posts, foldersQ.data);
  const batches = Array.from(new Set(posts.map((p) => p.generation_batch).filter(Boolean))).sort().reverse();

  const f = {
    tab: params.get("tab") || "draft",
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

  const matches = (p) =>
    (!f.folder || p.folder === f.folder) &&
    (!f.pillar || p.pillar === f.pillar) &&
    (!f.batch || p.generation_batch === f.batch) &&
    (!f.q || `${p.title} ${p.spec?.headline || ""} ${p.caption || ""}`.toLowerCase().includes(f.q.toLowerCase()));
  const pool = posts.filter(matches);
  const counts = Object.fromEntries(TABS.map((t) => [t.key, pool.filter((p) => tabOf(p.status) === t.key).length]));
  const sortFor = (tab) => (a, b) => {
    if (tab === "scheduled") return String(a.scheduled_at || "").localeCompare(String(b.scheduled_at || ""));
    if (tab === "posted") return String(b.published_at || b.posted_at || "").localeCompare(String(a.published_at || a.posted_at || ""));
    if (tab === "draft") return String(a.planned_for || "9999").localeCompare(String(b.planned_for || "9999"));
    return String(b.updated_date || "").localeCompare(String(a.updated_date || ""));
  };
  const filtered = pool.filter((p) => tabOf(p.status) === f.tab).sort(sortFor(f.tab));

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

  const run = async (fn, okMsg) => {
    try { await fn(); if (okMsg) toast({ title: okMsg }); } catch (e) { toast({ title: "Something went wrong", description: String(e?.message || e), variant: "destructive" }); }
    refresh();
  };
  const actions = {
    approve: (post) => setDialog({ kind: "approve", post, mode: "schedule" }),
    postNow: (post) => setDialog({ kind: "approve", post, mode: "now" }),
    decline: (post) => setDialog({ kind: "decline", post }),
    unschedule: (post) => run(() => unschedulePost(post.id), "Moved back to drafts"),
    restore: (post) => run(() => restoreDraft(post.id), "Restored to drafts"),
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
  const selectedDrafts = selectedPosts.filter((p) => (p.status || "draft") === "draft");

  // Approve each selected draft on its planned day (or the next open slot), one at a time.
  const bulkApprove = async () => {
    const list = [...selectedDrafts].sort((a, b) => String(a.planned_for || "9").localeCompare(String(b.planned_for || "9")));
    let working = [...posts];
    setBulk({ done: 0, total: list.length });
    try {
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const slot = suggestSlot(p, working, status.settings);
        if (!slot) throw new Error(`No open slot for ${p.title}`);
        const imageFields = await img.render(p);
        const targets = { instagram: true, facebook: !!(status.settings.auto_facebook && status.fbReady) };
        await approvePost(p, { iso: slot.iso, targets, user: me.data, imageFields });
        working = working.map((x) => (x.id === p.id ? { ...x, status: "approved", scheduled_at: slot.iso } : x));
        setBulk({ done: i + 1, total: list.length });
      }
      toast({ title: `Approved & scheduled ${list.length} post${list.length === 1 ? "" : "s"}` });
      setSelected(new Set());
    } catch (e) {
      toast({ title: "Bulk approve stopped", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setBulk(null);
      refresh();
    }
  };

  const exportZip = async (list, name) => {
    try { await batch.run(list, name); } catch (e) { toast({ title: "Export failed", description: String(e?.message || e), variant: "destructive" }); }
  };
  const closeDialog = () => setDialog(null);
  const setViewP = (v) => { setView(v); writeView(v); };

  return (
    <div className="min-h-full">
      {batch.node}
      {img.node}
      <PageHeader breadcrumb="Studio / Social Studio" rightText="Claude drafts · Justin approves · Møthership posts">
        <Btn onClick={() => setConnections(true)} title="Instagram, Facebook Page, posting times">
          <span className={`h-1.5 w-1.5 ${status.instagram?.connected ? "bg-[#ff3c00]" : "bg-ink/30"}`} />
          <Plug className="h-3.5 w-3.5" />Connections
        </Btn>
        <Btn variant="flame" onClick={newPost}><Plus className="h-3.5 w-3.5" />New post</Btn>
      </PageHeader>

      <div className="px-5 py-5 md:px-8">
        <AnalyticsStrip posts={posts} status={status} tz={tz} onOpen={(tab) => setFilter("tab", tab)} />

        {/* Folders (status tabs) + view */}
        <div className="mt-5 flex flex-wrap items-end gap-x-1 gap-y-2 border-b border-hair">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => { setFilter("tab", t.key === "draft" ? "" : t.key); setSelected(new Set()); }}
              className={`relative -mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-[13.5px] tracking-[-0.01em] transition-colors ${f.tab === t.key ? "border-[#ff3c00] font-semibold text-ink" : "border-transparent text-ink/50 hover:text-ink"}`}>
              {t.label}
              <span className={`font-mono text-[10px] ${t.key === "failed" && counts.failed ? "text-[#b42318]" : "text-ink/40"}`}>{counts[t.key]}</span>
            </button>
          ))}
          <div className="mb-1.5 ml-auto flex border border-hair">
            <button type="button" onClick={() => setViewP("grid")} className={`flex h-8 items-center gap-1 px-2.5 text-[12px] ${view === "grid" ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}><Grid2x2 className="h-3.5 w-3.5" />Cards</button>
            <button type="button" onClick={() => setViewP("calendar")} className={`flex h-8 items-center gap-1 px-2.5 text-[12px] ${view === "calendar" ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}><CalendarDays className="h-3.5 w-3.5" />Calendar</button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border border-hair bg-card p-2">
          <div className="relative min-w-[160px] flex-1 md:max-w-[240px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
            <input value={f.q} onChange={(e) => setFilter("q", e.target.value)} placeholder="Search posts" className={`${inputCls} h-8 py-0 pl-8`} />
          </div>
          <Select className="h-8 w-auto" value={f.folder} onChange={(v) => setFilter("folder", v)} placeholder="All folders" options={folders} />
          <Select className="h-8 w-auto" value={f.pillar} onChange={(v) => setFilter("pillar", v)} placeholder="All pillars" options={PILLARS.map((p) => ({ value: p.key, label: p.label }))} />
          <Select className="h-8 w-auto" value={f.batch} onChange={(v) => setFilter("batch", v)} placeholder="All batches" options={batches} />
          <div className="ml-auto flex items-center gap-1">
            <Btn variant="ghost" onClick={() => setDialog({ kind: "newFolder" })} title="New folder"><FolderPlus className="h-3.5 w-3.5" />Folder</Btn>
            {f.folder && <Btn variant="ghost" onClick={() => setDialog({ kind: "renameFolder" })} title="Rename this folder"><Pencil className="h-3.5 w-3.5" />Rename</Btn>}
            {(f.batch || f.folder) && filtered.length > 0 && (
              <Btn onClick={() => exportZip(filtered, f.batch || f.folder)} disabled={batch.busy}><Download className="h-3.5 w-3.5" />Download (.zip)</Btn>
            )}
          </div>
        </div>

        {/* Bulk bar */}
        {ids.length > 0 && (
          <div className="sticky top-0 z-20 mt-2 flex flex-wrap items-center gap-2 border border-ink bg-ink px-3 py-2 text-white">
            <span className="mono-label text-[10px] text-white/70">{ids.length} selected</span>
            {selectedDrafts.length > 0 && (
              <Btn variant="flame" onClick={bulkApprove} disabled={!!bulk}>
                {bulk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {bulk ? `Approving ${bulk.done}/${bulk.total}…` : `Approve ${selectedDrafts.length} on planned days`}
              </Btn>
            )}
            {selectedDrafts.length > 0 && <Btn variant="ink" className="border-white/25" onClick={() => patch.mutate({ ids: selectedDrafts.map((p) => p.id), data: { status: "declined", declined_at: new Date().toISOString() } })}><X className="h-3.5 w-3.5" />Decline</Btn>}
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
        ) : view === "calendar" ? (
          <CalendarView
            posts={pool}
            settings={status.settings}
            onApproveDraft={(post, date) => setDialog({ kind: "approve", post, mode: "schedule", date })}
            onOpenSchedule={(post) => (post.status === "approved" || post.status === "failed") && setDialog({ kind: "approve", post, mode: "schedule" })}
          />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((p) => <PostCard key={p.id} post={p} tz={tz} selected={selected.has(p.id)} onToggle={() => toggle(p.id)} actions={actions} />)}
            {filtered.length === 0 && <EmptyTab tab={f.tab} />}
          </div>
        )}
      </div>

      <ApproveDialog
        open={dialog?.kind === "approve"}
        post={dialog?.post ? posts.find((p) => p.id === dialog.post.id) || dialog.post : null}
        posts={posts}
        mode={dialog?.mode}
        presetDate={dialog?.date}
        onClose={closeDialog}
      />
      <DeclineDialog open={dialog?.kind === "decline"} post={dialog?.post} onClose={closeDialog} />
      <ConnectionsPanel open={connections} onClose={() => setConnections(false)} />

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
        description="This removes the posts and their revision history. Anything already on Instagram stays there. It can't be undone."
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

/* ─── Analytics strip ───────────────────────────────────────────────── */
function AnalyticsStrip({ posts, status, tz, onOpen }) {
  const since = Date.now() - 30 * 86400000;
  const posted = posts.filter((p) => p.status === "posted" && Date.parse(p.published_at || p.posted_at || 0) > since);
  const sum = (k) => posted.reduce((t, p) => t + (Number(p.insights?.[k]) || 0), 0);
  const hasReach = posted.some((p) => p.insights?.reach != null);
  const next = posts.filter((p) => p.status === "approved" && p.scheduled_at).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  const drafts = posts.filter((p) => (p.status || "draft") === "draft").length;
  const ig = status.instagram;
  const cells = [
    { label: "Needs review", value: drafts, sub: drafts ? "drafts waiting" : "inbox zero", tab: "draft", hot: drafts > 0 },
    { label: "Next post", value: next ? fmtWhen(next.scheduled_at, tz, { short: true }) : "—", sub: next ? next.title : "nothing scheduled", tab: "scheduled", small: true },
    { label: "Posted · 30d", value: posted.length, sub: "via Møthership", tab: "posted" },
    { label: "Likes · 30d", value: sum("likes").toLocaleString("en-US"), sub: `${sum("comments").toLocaleString("en-US")} comments`, tab: "posted" },
    { label: "Reach · 30d", value: hasReach ? sum("reach").toLocaleString("en-US") : "—", sub: hasReach ? "accounts reached" : "needs insights scope", tab: "posted" },
    { label: "Instagram", value: ig?.connected ? (ig.followers_count ?? "—").toLocaleString("en-US") : "—", sub: ig?.connected ? `followers · @${ig.username}` : status.isLoading ? "checking…" : "not connected" },
  ];
  return (
    <div className="grid grid-cols-2 gap-px border border-hair bg-hair md:grid-cols-3 xl:grid-cols-6">
      {cells.map((c) => (
        <button key={c.label} type="button" onClick={() => c.tab && onOpen(c.tab === "draft" ? "" : c.tab)} className="min-w-0 bg-card px-4 py-3 text-left transition-colors hover:bg-paper">
          <p className="mono-label flex items-center gap-1.5 text-[8.5px] text-ink/45">{c.hot && <span className="h-1.5 w-1.5 bg-[#ff3c00]" />}{c.label}</p>
          <p className={`mt-1 truncate font-semibold tabular-nums tracking-[-0.04em] ${c.small ? "text-[16px] leading-[26px]" : "text-[24px] leading-[26px]"}`}>{c.value}</p>
          <p className="truncate text-[11px] text-ink/45">{c.sub}</p>
        </button>
      ))}
    </div>
  );
}

function EmptyTab({ tab }) {
  const copy = {
    draft: ["No drafts waiting", "The weekly Claude batch lands here. Approve, edit or decline each one."],
    scheduled: ["Nothing scheduled", "Approve a draft to give it a time. Møthership publishes it then."],
    posted: ["Nothing posted yet", "Published posts show here with their permalink and engagement."],
    failed: ["No failures", "If Instagram rejects a post it lands here with the reason."],
    declined: ["Nothing declined", "Declined drafts are kept here so you can restore them."],
  }[tab] || ["Nothing here", ""];
  return (
    <div className="col-span-full flex flex-col items-center border border-dashed border-hair px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink/70">{copy[0]}</p>
      <p className="mt-1 max-w-sm text-xs text-ink/45">{copy[1]}</p>
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
