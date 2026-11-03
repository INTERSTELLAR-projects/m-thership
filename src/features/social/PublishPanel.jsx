import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, Check, ExternalLink, Facebook, Instagram, Loader2, RefreshCw, RotateCcw, Send, Undo2, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { POSTS_KEY, listPosts } from "./lib/socialStore";
import { fmtWhen, refreshInsights, restoreDraft, unschedulePost } from "./lib/publish";
import { ApproveDialog, DeclineDialog, useSocialStatus } from "./PublishDialogs";
import { Metrics } from "./PostCard";
import { Btn, Panel, StatusBadge } from "./ui";

/** Approval + publishing block at the top of the post editor. */
export default function PublishPanel({ post, saving, rerender, stale }) {
  const qc = useQueryClient();
  const status = useSocialStatus();
  const tz = status.settings.timezone;
  const allQ = useQuery({ queryKey: POSTS_KEY, queryFn: listPosts });
  const [dialog, setDialog] = useState(null); // "schedule" | "now" | "decline"
  const [busy, setBusy] = useState(false);
  const s = post.status || "draft";
  const targets = post.publish_targets || {};

  const act = async (fn, msg) => {
    setBusy(true);
    try {
      await fn();
      if (msg) toast({ title: msg });
    } catch (e) {
      toast({ title: "Something went wrong", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["SocialPost", post.id] });
      qc.invalidateQueries({ queryKey: POSTS_KEY });
    }
  };

  const tone = { draft: "", approved: "border-[#ff3c00]/50", publishing: "border-[#ff6a00]/60", posted: "border-ink/30", failed: "border-[#b42318]/50", declined: "" }[s];

  return (
    <Panel label="Publishing" title={<span className="flex items-center gap-2">{{ draft: "Waiting for your review", approved: "Approved & scheduled", publishing: "Publishing now…", posted: "Posted", failed: "Didn't publish", declined: "Declined" }[s]}<StatusBadge status={s} /></span>} className={tone} bodyClass="p-3.5 space-y-3">
      {s === "draft" && (
        <>
          <p className="text-[12px] leading-snug text-ink/55">Nothing publishes until you approve it. Approving renders this exact design to a 1080 × 1080 JPEG and schedules it{post.planned_for ? `; Claude planned it for ${post.planned_for}` : ""}.</p>
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="flame" className="col-span-2" onClick={() => setDialog("schedule")} disabled={saving}><Check className="h-3.5 w-3.5" />Approve & schedule</Btn>
            <Btn onClick={() => setDialog("now")} disabled={saving}><Send className="h-3.5 w-3.5" />Post now</Btn>
            <Btn onClick={() => setDialog("decline")}><X className="h-3.5 w-3.5" />Decline</Btn>
          </div>
        </>
      )}

      {(s === "approved" || s === "publishing") && (
        <>
          <div className="flex items-center gap-3 border border-hair bg-paper px-3 py-2.5">
            {s === "publishing" ? <Loader2 className="h-5 w-5 animate-spin text-[#ff6a00]" /> : <CalendarClock className="h-5 w-5 text-[#ff3c00]" />}
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold tracking-[-0.02em]">{fmtWhen(post.scheduled_at, tz)}</p>
              <p className="flex items-center gap-2 text-[11px] text-ink/50">
                {targets.instagram !== false && <span className="inline-flex items-center gap-1"><Instagram className="h-3 w-3" />{status.instagram?.username ? `@${status.instagram.username}` : "Instagram"}</span>}
                {targets.facebook && <span className="inline-flex items-center gap-1"><Facebook className="h-3 w-3" />{status.settings.facebook_page_name || "Facebook Page"}</span>}
                {post.approved_by && <span className="truncate">· approved by {post.approved_by.split("@")[0]}</span>}
              </p>
            </div>
          </div>
          {stale && (
            <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-[#c44a00]">
              {rerender === "working" ? <Loader2 className="mt-px h-3.5 w-3.5 shrink-0 animate-spin" /> : <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />}
              {rerender === "error" ? "Couldn't re-render the image. Use Reschedule to render it again." : "Design changed since approval. Re-rendering the publishing image…"}
            </p>
          )}
          {post.publish_error && <p className="text-[11.5px] text-[#c44a00]">{post.publish_error}</p>}
          {s === "approved" && (
            <div className="grid grid-cols-3 gap-2">
              <Btn onClick={() => setDialog("schedule")} disabled={saving}><CalendarClock className="h-3.5 w-3.5" />Reschedule</Btn>
              <Btn onClick={() => setDialog("now")} disabled={saving}><Send className="h-3.5 w-3.5" />Post now</Btn>
              <Btn onClick={() => act(() => unschedulePost(post.id), "Back in drafts")} disabled={busy}><Undo2 className="h-3.5 w-3.5" />Unschedule</Btn>
            </div>
          )}
          <p className="text-[11px] text-ink/45">Caption edits are picked up at publish time.</p>
        </>
      )}

      {s === "posted" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-ink/55">{fmtWhen(post.published_at || post.posted_at, tz)}</span>
            {post.ig_permalink && <a href={post.ig_permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 border border-hair px-2 py-1 text-[11.5px] hover:border-[#ff3c00] hover:text-[#ff3c00]"><Instagram className="h-3 w-3" />Instagram<ExternalLink className="h-3 w-3" /></a>}
            {post.fb_permalink && <a href={post.fb_permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 border border-hair px-2 py-1 text-[11.5px] hover:border-[#ff3c00] hover:text-[#ff3c00]"><Facebook className="h-3 w-3" />Facebook<ExternalLink className="h-3 w-3" /></a>}
          </div>
          <div className="flex items-center justify-between gap-2 border border-hair bg-paper px-3 py-2">
            {post.insights ? <Metrics insights={post.insights} /> : <span className="text-[11.5px] text-ink/45">Engagement lands after the daily refresh.</span>}
            <Btn variant="ghost" disabled={busy} onClick={() => act(() => refreshInsights(post.id), "Engagement refreshed")}><RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />Refresh</Btn>
          </div>
          {post.insights?.note && <p className="text-[11px] text-ink/45">{post.insights.note}</p>}
          {post.fb_error && <p className="text-[11.5px] text-[#c44a00]">Facebook: {post.fb_error}</p>}
          <p className="text-[11px] text-ink/45">Edits here don&apos;t change the live post.</p>
        </>
      )}

      {s === "failed" && (
        <>
          <p className="border-l-2 border-[#b42318] pl-2 text-[12px] leading-snug text-[#b42318]">{post.publish_error || "Unknown error"}</p>
          <div className="grid grid-cols-3 gap-2">
            <Btn variant="flame" onClick={() => setDialog("now")} disabled={saving}><RotateCcw className="h-3.5 w-3.5" />Retry now</Btn>
            <Btn onClick={() => setDialog("schedule")} disabled={saving}><CalendarClock className="h-3.5 w-3.5" />Reschedule</Btn>
            <Btn onClick={() => act(() => unschedulePost(post.id), "Back in drafts")} disabled={busy}><Undo2 className="h-3.5 w-3.5" />To drafts</Btn>
          </div>
        </>
      )}

      {s === "declined" && (
        <>
          <p className="text-[12px] text-ink/55">{post.declined_reason ? `Reason: ${post.declined_reason}` : "No reason given."}</p>
          <Btn onClick={() => act(() => restoreDraft(post.id), "Restored to drafts")} disabled={busy}><Undo2 className="h-3.5 w-3.5" />Restore to drafts</Btn>
        </>
      )}

      <ApproveDialog open={dialog === "schedule" || dialog === "now"} mode={dialog === "now" ? "now" : "schedule"} post={post} posts={allQ.data || []} onClose={() => setDialog(null)} />
      <DeclineDialog open={dialog === "decline"} post={post} onClose={() => setDialog(null)} />
    </Panel>
  );
}
