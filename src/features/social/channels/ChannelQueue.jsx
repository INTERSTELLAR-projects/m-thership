import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Link2, Loader2, Plus, Sparkles, Trash2, Undo2, Wand2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { POSTS_KEY, listPosts } from "../lib/socialStore";
import { Btn, Field, PILLAR_LABEL, Select, copyText, inputCls } from "../ui";
import { PILLARS } from "../brand";
import { channelByKey } from "./channels";
import { LINKEDIN_POST_URLS, draftChannelPost } from "./channelAi";
import { CP_KEY, cp, useChannelPosts, useVideos } from "./data";

const TABS = [["draft", "Drafts"], ["approved", "Approved"], ["posted", "Posted"], ["declined", "Declined"]];
const TONE = { draft: "border-ink/25 text-ink/75", approved: "border-[#ff3c00]/50 bg-[#ff3c00]/10 text-[#d83300]", posted: "border-ink bg-ink text-white", declined: "border-hair text-ink/35 line-through" };
const Badge = ({ s }) => <span className={`mono-label inline-flex border px-1.5 py-0.5 text-[8.5px] ${TONE[s] || TONE.draft}`}>{s}</span>;

/**
 * Manual queue for one or more ChannelPost channels (LinkedIn company / personal, YouTube Shorts).
 * Claude drafts → Justin edits & approves → Copy text + Open → Mark as posted with the URL.
 */
export default function ChannelQueue({ channels, defaultChannel, shorts = false }) {
  const qc = useQueryClient();
  const q = useChannelPosts();
  const videosQ = useVideos();
  const postsQ = useQuery({ queryKey: POSTS_KEY, queryFn: listPosts });
  const [channel, setChannel] = useState(defaultChannel || channels[0]);
  const [tab, setTab] = useState("draft");
  const [composer, setComposer] = useState(false);
  const [posting, setPosting] = useState(null);
  const all = (q.data || []).filter((p) => p.channel === channel);
  const list = all.filter((p) => (p.status || "draft") === tab).sort((a, b) => String(a.planned_for || "9").localeCompare(String(b.planned_for || "9")) || String(b.created_date).localeCompare(String(a.created_date)));
  const counts = Object.fromEntries(TABS.map(([k]) => [k, all.filter((p) => (p.status || "draft") === k).length]));
  const refresh = () => qc.invalidateQueries({ queryKey: CP_KEY });

  const patch = async (id, data, msg) => {
    qc.setQueryData(CP_KEY, (old = []) => old.map((p) => (p.id === id ? { ...p, ...data } : p)));
    try { await cp.update(id, data); if (msg) toast({ title: msg }); } catch (e) { toast({ title: "Couldn't save", description: String(e?.message || e), variant: "destructive" }); }
    refresh();
  };
  const ch = channelByKey(channel);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 border-b border-hair">
        {channels.length > 1 && (
          <div className="mb-1.5 mr-3 flex border border-hair">
            {channels.map((k) => (
              <button key={k} type="button" onClick={() => setChannel(k)} className={`h-8 px-3 text-[12px] ${channel === k ? "bg-ink text-white" : "bg-card text-ink/60 hover:text-ink"}`}>{channelByKey(k)?.label.replace("LinkedIn · ", "")}</button>
            ))}
          </div>
        )}
        {TABS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 pb-2 pt-1 text-[13px] ${tab === k ? "border-[#ff3c00] font-semibold" : "border-transparent text-ink/50 hover:text-ink"}`}>
            {l} <span className="font-mono text-[10px] text-ink/40">{counts[k]}</span>
          </button>
        ))}
        <div className="mb-1.5 ml-auto"><Btn variant="flame" onClick={() => setComposer(true)}><Plus className="h-3.5 w-3.5" />New draft</Btn></div>
      </div>

      {ch?.voice && <p className="text-[12px] text-ink/55"><b className="font-medium text-ink/75">Voice:</b> {ch.voice}</p>}

      {q.isLoading ? <p className="py-10 text-center text-[13px] text-ink/50"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p> : list.length === 0 ? (
        <div className="border border-dashed border-hair px-6 py-12 text-center">
          <p className="text-sm font-medium text-ink/70">{tab === "draft" ? "No drafts waiting" : `Nothing ${tab}`}</p>
          <p className="mt-1 text-xs text-ink/45">{tab === "draft" ? "The weekly Claude batch drops drafts here, or start one with New draft." : ""}</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((p) => (
            <QueueCard key={p.id} p={p} shorts={shorts} videos={videosQ.data || []} posts={postsQ.data || []}
              onPatch={(d, m) => patch(p.id, d, m)} onDelete={async () => { await cp.remove(p.id); refresh(); }} onPosted={() => setPosting(p)} />
          ))}
        </div>
      )}

      <Composer open={composer} channel={channel} shorts={shorts} posts={postsQ.data || []} videos={videosQ.data || []} onClose={() => setComposer(false)} onCreated={() => { setTab("draft"); refresh(); }} />
      <PostedDialog p={posting} onClose={() => setPosting(null)} onSave={(url) => { patch(posting.id, { status: "posted", posted_url: url, posted_at: new Date().toISOString() }, "Marked as posted"); setPosting(null); }} />
    </div>
  );
}

function QueueCard({ p, shorts, videos, posts, onPatch, onDelete, onPosted }) {
  const [body, setBody] = useState(p.body || "");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => setBody(p.body || ""), [p.body]);
  const s = p.status || "draft";
  const source = posts.find((x) => x.id === p.source_post_id);
  const video = videos.find((v) => v.id === p.youtube_video_id);
  const openUrl = shorts ? "https://studio.youtube.com/" : LINKEDIN_POST_URLS[p.channel];
  const copy = async () => { if (await copyText(body)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } };
  const rewrite = async () => {
    setBusy(true);
    try {
      const r = await draftChannelPost({ channel: p.channel, pillar: p.pillar, existing: body, topic: "Tighten it: stronger hook, shorter lines, same idea." });
      setBody(r.body);
      onPatch({ body: r.body, hook: r.hook, hashtags: r.hashtags }, "Rewritten");
    } catch (e) { toast({ title: "AI rewrite failed", description: String(e?.message || e), variant: "destructive" }); } finally { setBusy(false); }
  };
  const limit = shorts ? 500 : 3000;

  return (
    <article className={`flex flex-col border bg-card ${s === "approved" ? "border-[#ff3c00]/40" : "border-hair"}`}>
      <header className="flex flex-wrap items-center gap-2 border-b border-hair px-3.5 py-2">
        <Badge s={s} />
        {p.generated_by === "claude" && <Sparkles className="h-3 w-3 text-[#ff6a00]" />}
        <input value={p.title || ""} onChange={(e) => onPatch({ title: e.target.value })} placeholder="Untitled" className="min-w-0 flex-1 bg-transparent text-[13px] font-medium outline-none" />
        <input type="date" value={p.planned_for || ""} onChange={(e) => onPatch({ planned_for: e.target.value })} className="h-7 border border-hair bg-paper px-1.5 font-mono text-[10.5px]" title="Planned day" />
      </header>
      <div className="flex-1 space-y-2 px-3.5 py-3">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} onBlur={() => body !== (p.body || "") && onPatch({ body })} rows={shorts ? 4 : 9} disabled={s === "posted"} className={`${inputCls} resize-y leading-snug`} />
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-ink/45">
          <span className={body.length > limit ? "text-[#b42318]" : ""}>{body.length} chars</span>
          {p.pillar && <span>· {PILLAR_LABEL[p.pillar] || p.pillar}</span>}
          {source && <span className="truncate">· from “{source.title}”</span>}
        </div>
        {shorts && (
          <Field label="Related video (set in YouTube Studio)">
            <Select value={p.youtube_video_id || ""} onChange={(v) => onPatch({ youtube_video_id: v })} placeholder="Pick the long-form source…" options={videos.map((v) => ({ value: v.id, label: v.chosen_title || v.title }))} />
          </Field>
        )}
        {shorts && video && <p className="text-[11px] text-ink/50">Set this Short&apos;s Related video to “{video.chosen_title || video.title}”{video.youtube_url ? ` (${video.youtube_url})` : " once it's published"}.</p>}
        {s === "posted" && p.posted_url && <a href={p.posted_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-[#ff3c00] hover:underline"><Link2 className="h-3 w-3" />{p.posted_url.replace(/^https?:\/\//, "").slice(0, 60)}</a>}
        {s === "declined" && p.declined_reason && <p className="text-[11.5px] text-ink/50">Declined: {p.declined_reason}</p>}
      </div>
      <footer className="flex flex-wrap gap-1.5 border-t border-hair px-3.5 py-2.5">
        {s === "draft" && <>
          <Btn variant="flame" onClick={() => onPatch({ status: "approved", body }, "Approved")}><Check className="h-3.5 w-3.5" />Approve</Btn>
          <Btn onClick={rewrite} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}Rewrite</Btn>
          <Btn onClick={() => onPatch({ status: "declined" }, "Declined")}><X className="h-3.5 w-3.5" />Decline</Btn>
        </>}
        {(s === "approved" || s === "draft") && <>
          <Btn variant={s === "approved" ? "ink" : "outline"} onClick={copy}>{copied ? <Check className="h-3.5 w-3.5 text-[#ff3c00]" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy text"}</Btn>
          <a href={openUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 border border-hair bg-card px-3 text-[12.5px] font-medium hover:border-[#ff3c00] hover:text-[#ff3c00]"><ExternalLink className="h-3.5 w-3.5" />{shorts ? "Open YouTube Studio" : "Open LinkedIn"}</a>
        </>}
        {s === "approved" && <Btn onClick={onPosted}><Check className="h-3.5 w-3.5" />Mark as posted</Btn>}
        {(s === "approved" || s === "declined" || s === "posted") && <Btn variant="ghost" onClick={() => onPatch({ status: "draft", posted_url: s === "posted" ? p.posted_url : "" })}><Undo2 className="h-3.5 w-3.5" />Back to draft</Btn>}
        {s !== "posted" && <Btn variant="ghost" className="ml-auto" onClick={onDelete} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Btn>}
      </footer>
    </article>
  );
}

function Composer({ open, channel, shorts, posts, videos, onClose, onCreated }) {
  const [topic, setTopic] = useState("");
  const [pillar, setPillar] = useState("");
  const [source, setSource] = useState("");
  const [video, setVideo] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setTopic(""); setSource(""); setVideo(""); } }, [open]);
  const sourcePost = posts.find((p) => p.id === source);
  const pillars = useMemo(() => (channel === "linkedin_personal"
    ? [["founder_story", "Founder story"], ["lessons", "Lessons"], ["behind_the_build", "Behind the build"], ["opinion", "Opinion"]]
    : PILLARS.map((p) => [p.key, p.label])), [channel]);
  const go = async (useAi) => {
    setBusy(true);
    try {
      let d = { body: "", hook: "", hashtags: [] };
      if (useAi) {
        const srcText = sourcePost ? [sourcePost.spec?.headline, sourcePost.spec?.subhead, sourcePost.caption_linkedin || sourcePost.caption].filter(Boolean).join("\n") : "";
        const vid = videos.find((v) => v.id === video);
        d = await draftChannelPost({ channel, topic: [topic, vid ? `Short clipped from the video "${vid.chosen_title || vid.title}"` : ""].filter(Boolean).join(". "), pillar, sourceText: srcText });
      }
      await cp.create({
        channel, status: "draft", title: (topic || sourcePost?.title || d.hook || "Untitled").slice(0, 90), pillar: pillar || sourcePost?.pillar || "",
        body: d.body, hook: d.hook, hashtags: d.hashtags, source_post_id: source || "", youtube_video_id: video || "", generated_by: useAi ? "claude" : "justin",
      });
      onCreated();
      onClose();
    } catch (e) {
      toast({ title: "Couldn't draft", description: String(e?.message || e), variant: "destructive" });
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <p className="mono-label text-[9px] text-ink/45">{channelByKey(channel)?.label}</p>
          <DialogTitle className="text-[22px] font-semibold tracking-[-0.04em]">New <span className="text-[#ff3c00]">/draft</span></DialogTitle>
          <DialogDescription>Claude writes it in this channel&apos;s voice. It lands in Drafts; nothing is posted.</DialogDescription>
        </DialogHeader>
        <Field label="Topic or direction"><textarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={channel === "linkedin_personal" ? "e.g. What I learned rebuilding our onboarding in one weekend" : "e.g. Why a Google Business Profile beats a new logo"} className={`${inputCls} resize-none`} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Pillar"><Select value={pillar} onChange={setPillar} placeholder="Any" options={pillars.map(([value, label]) => ({ value, label }))} /></Field>
          <Field label="Repurpose an IG/FB post"><Select value={source} onChange={setSource} placeholder="None" options={posts.slice(0, 60).map((p) => ({ value: p.id, label: p.title || p.spec?.headline }))} /></Field>
        </div>
        {shorts && <Field label="Clipped from video"><Select value={video} onChange={setVideo} placeholder="None" options={videos.map((v) => ({ value: v.id, label: v.chosen_title || v.title }))} /></Field>}
        <DialogFooter>
          <Btn onClick={() => go(false)} disabled={busy}>Blank draft</Btn>
          <Btn variant="flame" onClick={() => go(true)} disabled={busy || (!topic.trim() && !source && !video)}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Draft with Claude</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostedDialog({ p, onClose, onSave }) {
  const [url, setUrl] = useState("");
  useEffect(() => { if (p) setUrl(p.posted_url || ""); }, [p]);
  const ok = !url || /^https?:\/\/\S+$/i.test(url);
  return (
    <Dialog open={!!p} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[22px] font-semibold tracking-[-0.04em]">Mark as <span className="text-[#ff3c00]">/posted</span></DialogTitle>
          <DialogDescription>Paste the post&apos;s URL so it&apos;s on record (optional).</DialogDescription>
        </DialogHeader>
        <input autoFocus value={url} onChange={(e) => setUrl(e.target.value.trim())} placeholder="https://www.linkedin.com/posts/…" className={inputCls} />
        {!ok && <p className="text-[11.5px] text-[#b42318]">That doesn&apos;t look like a link.</p>}
        <DialogFooter>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="flame" disabled={!ok} onClick={() => onSave(url)}><Check className="h-3.5 w-3.5" />Mark posted</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
