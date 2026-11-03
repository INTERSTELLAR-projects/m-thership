import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, Instagram, Facebook, Loader2, Send, X, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { PostRender } from "./PostCanvas";
import ScaledPost from "./PostCanvas";
import { POSTS_KEY } from "./lib/socialStore";
import {
  DEFAULT_PUBLISH, SOCIAL_STATUS_KEY, approvePost, declinePost, fetchSocialStatus, fmtTime, fmtWhen, isoToZoned, nextOpenSlot,
  publishNow, renderAndUpload, slotIsOpen, suggestSlot, todayIn, tzAbbr, zonedToIso,
} from "./lib/publish";
import { Btn, Field, inputCls } from "./ui";

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60)));

/** Connection status + publish settings (backend). Falls back to defaults while loading or if it fails. */
export function useSocialStatus() {
  const q = useQuery({ queryKey: SOCIAL_STATUS_KEY, queryFn: fetchSocialStatus, staleTime: 5 * 60000, retry: 1 });
  const settings = { ...DEFAULT_PUBLISH, ...(q.data?.settings || {}) };
  const fbReady = !!q.data?.facebook?.connected && !!settings.facebook_page_id;
  return { ...q, settings, fbReady, instagram: q.data?.instagram, facebook: q.data?.facebook };
}

export function useMe() {
  return useQuery({ queryKey: ["auth", "me"], queryFn: () => base44.auth.me(), staleTime: 30 * 60000 });
}

/** Renders a post offscreen at 1080 and uploads a public JPEG of it. */
export function usePostImage() {
  const [post, setPost] = useState(null);
  const ref = useRef(null);
  const resolver = useRef(null);
  const render = useCallback(async (p) => {
    setPost(p);
    await nextFrame();
    await nextFrame();
    try {
      return await renderAndUpload(ref.current, p);
    } finally {
      setPost(null);
    }
  }, []);
  useEffect(() => () => { resolver.current = null; }, []);
  const node = post
    ? createPortal(
      <div aria-hidden="true" style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
        <PostRender ref={ref} template={post.template} spec={post.spec} />
      </div>,
      document.body,
    )
    : null;
  return { render, node, busy: !!post };
}

/* ─── Approve & schedule ─────────────────────────────────────────────── */
export function ApproveDialog({ post, posts, open, onClose, mode: initialMode = "schedule", presetDate, onDone }) {
  const qc = useQueryClient();
  const status = useSocialStatus();
  const me = useMe();
  const img = usePostImage();
  const s = status.settings;
  const tz = s.timezone;
  const [mode, setMode] = useState(initialMode);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [targets, setTargets] = useState({ instagram: true, facebook: false });
  const [step, setStep] = useState(null); // null | "render" | "save" | "publish"

  useEffect(() => {
    if (!open || !post) return;
    setMode(initialMode);
    const slot = presetDate
      ? (() => { const t = [...s.default_times].sort().find((x) => slotIsOpen(posts, s, presetDate, x, post.id)) || s.default_times[0] || "09:00"; return { date: presetDate, time: t }; })()
      : suggestSlot(post, posts, s);
    setDate(slot?.date || todayIn(tz));
    setTime(slot?.time || s.default_times[0] || "09:00");
    setTargets({ instagram: post.publish_targets?.instagram !== false, facebook: post.publish_targets?.facebook ?? (s.auto_facebook && status.fbReady) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, post?.id, presetDate, initialMode]);

  if (!post) return null;
  const iso = date && time ? zonedToIso(date, time, tz) : null;
  const past = mode === "schedule" && iso && Date.parse(iso) < Date.now() + 60000;
  const clash = mode === "schedule" && date && time && !slotIsOpen(posts, s, date, time, post.id);
  const noTarget = !targets.instagram && !targets.facebook;
  const missingCaption = !String(post.caption || "").trim();
  const busy = !!step;

  const quick = (slot) => slot && (setDate(slot.date), setTime(slot.time));
  const open1 = nextOpenSlot(posts, s, { exceptId: post.id });
  const planned = post.planned_for && post.planned_for >= todayIn(tz) ? post.planned_for : null;

  const confirm = async () => {
    try {
      setStep("render");
      const imageFields = await img.render(post);
      setStep("save");
      const when = mode === "now" ? new Date().toISOString() : iso;
      await approvePost(post, { iso: when, targets, user: me.data, imageFields });
      if (mode === "now") {
        setStep("publish");
        const r = await publishNow(post.id);
        const res = r?.results?.find((x) => x.id === post.id) || r?.results?.[0];
        if (res?.result === "posted") toast({ title: "Posted", description: res.permalink ? "Live on Instagram." : "Published." });
        else toast({ title: res?.result === "retrying" ? "Instagram hiccup, retrying in 15 min" : "Didn't post", description: res?.error || r?.note || "See the post for details.", variant: res?.result === "retrying" ? undefined : "destructive" });
      } else {
        toast({ title: "Approved & scheduled", description: fmtWhen(when, tz) });
      }
      qc.invalidateQueries({ queryKey: POSTS_KEY });
      qc.invalidateQueries({ queryKey: ["SocialPost", post.id] });
      onDone?.();
      onClose();
    } catch (e) {
      toast({ title: "Couldn't approve", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setStep(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      {img.node}
      <DialogContent className="max-w-[640px] gap-0 p-0">
        <DialogHeader className="border-b border-hair px-5 pb-4 pt-5">
          <p className="mono-label text-[9px] text-ink/45">Approval</p>
          <DialogTitle className="text-[24px] font-semibold tracking-[-0.04em]">
            {mode === "now" ? <>Post <span className="text-[#ff3c00]">/now</span></> : <>Approve & <span className="text-[#ff3c00]">/schedule</span></>}
          </DialogTitle>
          <DialogDescription className="text-[12.5px]">
            {mode === "now" ? "Renders the image, approves the post and publishes it immediately." : "Renders the image, approves the post and Møthership publishes it at this time."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 px-5 py-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div className="space-y-2">
            <div className="border border-hair"><ScaledPost template={post.template} spec={post.spec} /></div>
            <p className="line-clamp-4 text-[11px] leading-snug text-ink/55">{post.caption || <span className="text-[#b42318]">No caption yet</span>}</p>
          </div>

          <div className="min-w-0 space-y-4">
            <div className="flex border border-hair">
              {[["schedule", "Schedule", CalendarClock], ["now", "Post now", Zap]].map(([k, l, I]) => (
                <button key={k} type="button" onClick={() => setMode(k)} className={`flex h-9 flex-1 items-center justify-center gap-1.5 text-[12px] ${mode === k ? "bg-ink text-white" : "bg-paper text-ink/60 hover:text-ink"}`}><I className="h-3.5 w-3.5" />{l}</button>
              ))}
            </div>

            {mode === "schedule" && (
              <div className="space-y-3">
                <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                  <Field label="Day"><input type="date" value={date} min={todayIn(tz)} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
                  <Field label={`Time · ${tzAbbr(tz)}`}><input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} /></Field>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip onClick={() => quick(open1)} disabled={!open1} accent>Next open slot{open1 ? ` · ${fmtWhen(open1.iso, tz, { short: true })}` : ""}</Chip>
                  {planned && s.default_times.map((t) => (
                    <Chip key={t} onClick={() => quick({ date: planned, time: t })}>Planned day {fmtTime(t)}</Chip>
                  ))}
                  {!planned && s.default_times.map((t) => <Chip key={t} onClick={() => setTime(t)}>{fmtTime(t)}</Chip>)}
                </div>
                {iso && <p className="mono-label text-[9.5px] text-ink/55">Publishes {fmtWhen(iso, tz)}{isoToZoned(iso, tz).date !== date ? "" : ""}</p>}
                {past && <p className="text-[11.5px] text-[#b42318]">That time has passed. Pick a later time or use Post now.</p>}
                {clash && !past && <p className="text-[11.5px] text-[#c44a00]">Another post is already scheduled that day. That's allowed, but it breaks the one-a-day rhythm.</p>}
              </div>
            )}

            <Field label="Publish to">
              <div className="space-y-1.5">
                <Target on={targets.instagram} onClick={() => setTargets((t) => ({ ...t, instagram: !t.instagram }))} icon={Instagram} label="Instagram" sub={status.instagram?.username ? `@${status.instagram.username}` : status.isLoading ? "checking…" : "connector"} />
                <Target
                  on={targets.facebook}
                  disabled={!status.fbReady}
                  onClick={() => status.fbReady && setTargets((t) => ({ ...t, facebook: !t.facebook }))}
                  icon={Facebook}
                  label="Facebook Page"
                  sub={status.fbReady ? s.facebook_page_name || "Page" : "Not connected yet (Social connections)"}
                />
              </div>
            </Field>
            {missingCaption && <p className="text-[11.5px] text-[#c44a00]">This post has no caption. It will publish with the image only.</p>}
          </div>
        </div>

        <DialogFooter className="flex items-center gap-2 border-t border-hair bg-paper/60 px-5 py-3 sm:justify-between">
          <p className="mono-label text-[9px] text-ink/45">
            {step === "render" ? "Rendering 1080 × 1080 JPEG…" : step === "save" ? "Uploading & approving…" : step === "publish" ? "Publishing to Instagram…" : "Image renders from the current design"}
          </p>
          <div className="flex gap-2">
            <Btn onClick={onClose} disabled={busy}>Cancel</Btn>
            <Btn variant="flame" onClick={confirm} disabled={busy || noTarget || (mode === "schedule" && (!iso || past))}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : mode === "now" ? <Send className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              {mode === "now" ? "Approve & post now" : "Approve & schedule"}
            </Btn>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Chip({ children, onClick, disabled, accent }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`border px-2 py-1 text-[11.5px] transition-colors disabled:opacity-40 ${accent ? "border-[#ff3c00]/50 text-[#d83300] hover:bg-[#ff3c00]/5" : "border-hair text-ink/65 hover:border-[#ff3c00] hover:text-[#ff3c00]"}`}>
      {children}
    </button>
  );
}

function Target({ on, onClick, icon: I, label, sub, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`flex w-full items-center gap-2.5 border px-2.5 py-2 text-left transition-colors ${on ? "border-ink bg-ink text-white" : "border-hair bg-paper text-ink/70 hover:border-ink/40"} disabled:cursor-not-allowed disabled:opacity-50`}>
      <I className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-medium">{label}</span>
        <span className={`block truncate text-[10.5px] ${on ? "text-white/60" : "text-ink/45"}`}>{sub}</span>
      </span>
      <span className={`flex h-4 w-4 items-center justify-center border ${on ? "border-white bg-[#ff3c00]" : "border-ink/30"}`}>{on && <Check className="h-3 w-3 text-white" />}</span>
    </button>
  );
}

/* ─── Decline ────────────────────────────────────────────────────────── */
export function DeclineDialog({ post, open, onClose, onDone }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setReason(""); }, [open]);
  const reasons = useMemo(() => ["Off-brand", "Wrong offer or price", "Weak hook", "Duplicate idea", "Timing"], []);
  if (!post) return null;
  const go = async () => {
    setBusy(true);
    try {
      await declinePost(post.id, reason.trim());
      qc.invalidateQueries({ queryKey: POSTS_KEY });
      qc.invalidateQueries({ queryKey: ["SocialPost", post.id] });
      toast({ title: "Declined", description: "Moved to Declined. You can restore it as a draft any time." });
      onDone?.();
      onClose();
    } catch (e) {
      toast({ title: "Couldn't decline", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <p className="mono-label text-[9px] text-ink/45">Review</p>
          <DialogTitle className="text-[22px] font-semibold tracking-[-0.04em]">Decline <span className="text-[#ff3c00]">/post</span></DialogTitle>
          <DialogDescription>{post.title || post.spec?.headline}. It won&apos;t publish. A reason helps the weekly batch get better.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {reasons.map((r) => <Chip key={r} onClick={() => setReason(r)}>{r}</Chip>)}
        </div>
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional reason" className={`${inputCls} resize-none`} />
        <DialogFooter>
          <Btn onClick={onClose} disabled={busy}>Cancel</Btn>
          <Btn variant="ink" onClick={go} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}Decline</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
