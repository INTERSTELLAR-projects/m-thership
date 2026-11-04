import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, CheckCheck, Copy, Download, ExternalLink, Link2, Loader2, Send, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { fmtWhen } from "../lib/publish";
import { Btn, inputCls, copyText } from "../ui";
import { enforce, hookHints } from "./ai";
import { MODE_LABEL, MODE_TONE, PLATFORM, RATIOS, formatOf } from "./platforms";
import { Fit, RatioCanvas } from "./Ratios";
import { imageStale, useVariantRenderer } from "./render";
import { autoQueue } from "./schedule";
import { KEYS, channels } from "./store";

// 04 APPROVE: one review queue for the whole batch. Cards grouped by idea, a per-platform preview, inline edit,
// the Triple Hook checklist, approve one or Approve all. Approval renders the images, auto-queues a time per
// platform, and is the ONLY thing that lets the publisher post. Manual platforms: copy, download, open, Mark posted.

const TABS = [
  { key: "draft", label: "To review", statuses: ["draft"] },
  { key: "approved", label: "Approved", statuses: ["approved", "publishing"] },
  { key: "posted", label: "Posted", statuses: ["posted"] },
  { key: "failed", label: "Failed", statuses: ["failed"] },
  { key: "declined", label: "Declined", statuses: ["declined"] },
];

function useApprove(eng, me) {
  const qc = useQueryClient();
  const renderer = useVariantRenderer();
  const [busy, setBusy] = useState(null);
  const approve = async (list) => {
    const ideas = Object.fromEntries(eng.ideas.map((i) => [i.id, i]));
    const ids = new Set(list.map((v) => v.id));
    const existing = [
      ...eng.variants.filter((v) => !ids.has(v.id)),
      ...eng.legacy.map((p) => ({ platform: "instagram", status: p.status, scheduled_at: p.scheduled_at, published_at: p.published_at })),
    ];
    const queue = list
      .filter((v) => !v.scheduled_at || Date.parse(v.scheduled_at) < Date.now())
      .map((v) => ({ ...v, daily_limit: eng.accounts.find((a) => a.id === v.account_id)?.daily_limit }));
    const slots = autoQueue(queue, existing, eng.settings || {});
    setBusy({ done: 0, total: list.length });
    let ok = 0;
    try {
      for (const v of list) {
        const idea = ideas[v.idea_id];
        const f = formatOf(v.platform, v.format);
        const fields = v.needs_image !== false && idea ? await renderer.render(v, idea, eng.brand) : {};
        const slot = slots.find((s) => s.id === v.id)?.iso || v.scheduled_at;
        if (!slot) throw new Error(`No open ${PLATFORM[v.platform]?.label} slot in the next 60 days (check limits/windows).`);
        const mode = (v.account_id && eng.modeOf(v.account_id)?.mode) || "manual";
        await base44.entities.SocialVariant.update(v.id, {
          ...fields, text: v.text || "", title: v.title || "", status: "approved", approved_at: new Date().toISOString(), approved_by: me?.email || "admin",
          scheduled_at: slot, mode: f?.manual ? "manual" : mode, publish_error: "", declined_reason: "",
        });
        ok++;
        setBusy({ done: ok, total: list.length });
      }
      toast({ title: `Approved ${ok}`, description: "Auto platforms post at their times. Manual ones wait in Approved for you." });
    } catch (e) {
      toast({ title: `Approved ${ok}, then stopped`, description: String(e?.message || e), variant: "destructive" });
    } finally {
      setBusy(null);
      qc.invalidateQueries({ queryKey: KEYS.variants(eng.brand.key) });
    }
  };
  return { approve, busy, renderer };
}

export default function ReviewQueue({ eng, me }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState("draft");
  const [marking, setMarking] = useState(null);
  const { approve, busy, renderer } = useApprove(eng, me);
  const ideas = Object.fromEntries(eng.ideas.map((i) => [i.id, i]));
  const statuses = TABS.find((t) => t.key === tab).statuses;
  const list = useMemo(() => eng.variants.filter((v) => statuses.includes(v.status || "draft")), [eng.variants, statuses]);
  const groups = useMemo(() => {
    const m = new Map();
    for (const v of list) { if (!m.has(v.idea_id)) m.set(v.idea_id, []); m.get(v.idea_id).push(v); }
    return [...m.entries()];
  }, [list]);
  const counts = Object.fromEntries(TABS.map((t) => [t.key, eng.variants.filter((v) => t.statuses.includes(v.status || "draft")).length]));
  const refresh = () => qc.invalidateQueries({ queryKey: KEYS.variants(eng.brand.key) });
  const patch = async (v, data) => {
    qc.setQueryData(KEYS.variants(eng.brand.key), (old = []) => old.map((x) => (x.id === v.id ? { ...x, ...data } : x)));
    try { await base44.entities.SocialVariant.update(v.id, data); } catch (e) { toast({ title: "Couldn't save", description: String(e?.message || e), variant: "destructive" }); refresh(); }
  };
  const act = {
    approve: (v) => approve([v]),
    decline: (v) => patch(v, { status: "declined", approved_at: null }),
    restore: (v) => patch(v, { status: "draft", approved_at: null, publish_error: "" }),
    unapprove: (v) => patch(v, { status: "draft", approved_at: null, scheduled_at: null }),
    postNow: async (v) => {
      try { const r = await channels("publish_now", { variant_id: v.id }); toast({ title: r?.results?.[0]?.result || "Done", description: r?.results?.[0]?.error || r?.results?.[0]?.url || "" }); } catch (e) { toast({ title: "Couldn't post", description: String(e?.message || e), variant: "destructive" }); }
      refresh();
    },
    download: (v) => ideas[v.idea_id] && renderer.download(v, ideas[v.idea_id], eng.brand).catch((e) => toast({ title: "Download failed", description: String(e?.message || e), variant: "destructive" })),
    mark: (v) => setMarking(v),
  };

  return (
    <div className="space-y-3">
      {renderer.node}
      <div className="flex flex-wrap items-end gap-x-1 gap-y-2 border-b border-hair">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-[13px] ${tab === t.key ? "border-[#ff3c00] font-semibold" : "border-transparent text-ink/50 hover:text-ink"}`}>
            {t.label}<span className="font-mono text-[10px] text-ink/40">{counts[t.key]}</span>
          </button>
        ))}
        {tab === "draft" && counts.draft > 0 && (
          <div className="mb-1.5 ml-auto">
            <Btn variant="flame" disabled={!!busy} onClick={() => approve(list)}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}{busy ? `Rendering + approving ${busy.done}/${busy.total}` : `Approve all ${counts.draft}`}</Btn>
          </div>
        )}
      </div>

      {groups.length === 0 && (
        <div className="flex flex-col items-center border border-dashed border-hair px-6 py-14 text-center">
          <p className="text-sm font-medium text-ink/70">{tab === "draft" ? "Nothing waiting for review" : "Nothing here yet"}</p>
          <p className="mt-1 max-w-sm text-xs text-ink/45">{tab === "draft" ? "Capture an idea and its platform drafts land here, grouped by idea." : "Approved, posted and failed variants show here with their platform."}</p>
        </div>
      )}

      {groups.map(([ideaId, vs]) => {
        const idea = ideas[ideaId];
        const drafts = vs.filter((v) => v.status === "draft");
        return (
          <section key={ideaId} className="border border-hair bg-card">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hair px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="mono-label text-[8.5px] text-ink/45">Idea · {vs.length} variant{vs.length === 1 ? "" : "s"}{idea?.extraction?.primary_keyword ? ` · ${idea.extraction.primary_keyword}` : ""}</p>
                <h3 className="truncate text-[14px] font-semibold tracking-[-0.02em]">{idea?.title || "Idea"}</h3>
              </div>
              {drafts.length > 1 && <Btn variant="ink" disabled={!!busy} onClick={() => approve(drafts)}><CheckCheck className="h-3.5 w-3.5" />Approve all {drafts.length}</Btn>}
            </header>
            <div className="grid gap-px bg-hair sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {vs.map((v) => <VariantCard key={v.id} v={v} idea={idea} eng={eng} act={act} patch={patch} busy={!!busy} />)}
            </div>
          </section>
        );
      })}

      <MarkPostedDialog v={marking} onClose={() => setMarking(null)} onDone={() => { setMarking(null); refresh(); }} />
    </div>
  );
}

function VariantCard({ v, idea, eng, act, patch, busy }) {
  const p = PLATFORM[v.platform];
  const f = formatOf(v.platform, v.format);
  const ratio = RATIOS[v.ratio || f?.ratio] || RATIOS.square;
  const [text, setText] = useState(v.text || "");
  const [title, setTitle] = useState(v.title || "");
  const live = enforce(v.platform, text, { emoji: !!eng.brand.guide?.emoji_ok });
  const len = v.platform === "x" || v.platform === "threads" ? [...text].length : text.length;
  const over = !!p?.text_max && len > p.text_max;
  const hint = hookHints(text, idea?.extraction?.primary_keyword);
  const hc = v.hook_check || {};
  const editable = ["draft", "failed"].includes(v.status);
  const mode = f?.manual ? "manual" : (v.account_id && eng.modeOf(v.account_id)?.mode) || v.mode || "manual";
  const stale = idea && v.image_url && imageStale(v, idea, eng.brand);
  const save = () => { if (text !== (v.text || "") || title !== (v.title || "")) patch(v, { text, title, edited: true }); };
  const accountUrl = eng.accounts.find((a) => a.id === v.account_id)?.url;

  return (
    <article className="flex min-w-0 flex-col bg-card">
      <div className="flex items-center gap-2 border-b border-hair px-3 py-2">
        <span className="font-mono text-[10px] font-semibold">{p?.short}</span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{p?.label} · {f?.label}{v.account_label ? <span className="text-ink/45"> · {v.account_label}</span> : null}</span>
        <span className={`mono-label border px-1 py-0.5 text-[8px] ${MODE_TONE[mode]}`}>{MODE_LABEL[mode]}</span>
      </div>
      <div className="relative bg-[#141414]">
        <div className="mx-auto" style={{ maxWidth: ratio.h > ratio.w ? 190 : 340 }}>
          {v.image_url && !stale && v.status !== "draft"
            ? <img src={v.image_url} alt={v.alt_text || ""} className="block w-full" style={{ aspectRatio: `${ratio.w} / ${ratio.h}` }} />
            : idea ? <Fit w={ratio.w} h={ratio.h}><RatioCanvas ratio={v.ratio || f?.ratio} idea={idea} brand={eng.brand} /></Fit> : null}
        </div>
        <span className="absolute bottom-1.5 right-1.5 bg-black/60 px-1 font-mono text-[9px] text-white">{ratio.label}{f?.slides ? ` · +${idea?.extraction?.carousel?.slides?.length || 0} slides` : ""}</span>
        {stale && <span className="absolute left-1.5 top-1.5 bg-[#ff6a00] px-1 font-mono text-[9px] text-white">design changed · re-approve to re-render</span>}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {(p?.title_max || f?.video) && <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={save} disabled={!editable} placeholder={p?.title_max ? `Title (≤ ${p.title_max})` : "Title"} className={`${inputCls} h-8 py-1 text-[12.5px] font-medium`} />}
        <textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={save} disabled={!editable} rows={7} className={`${inputCls} resize-y text-[12.5px] leading-snug`} aria-label={`${p?.label} post text`} />
        <div className="flex items-center justify-between font-mono text-[10px]">
          <span className={over ? "text-[#b42318]" : "text-ink/45"}>{len.toLocaleString("en-US")} / {p?.text_max?.toLocaleString("en-US")}</span>
          {v.alt_text && <span className="truncate pl-2 text-ink/40" title={v.alt_text}>alt text ✓</span>}
        </div>
        {live.warnings.map((w) => <p key={w} className="text-[11px] leading-snug text-[#c44a00]">{w}</p>)}
        {v.script && <details className="text-[11.5px]"><summary className="cursor-pointer text-ink/60">Script</summary><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-sans text-[11.5px] leading-snug text-ink/75">{v.script}</pre></details>}

        <div className="border border-hair bg-paper px-2 py-1.5">
          <p className="mono-label text-[8px] text-ink/45">Triple Hook check</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {[["context", "Context in line 1"], ["lean", "Lean"], ["snapback", "Snapback"]].map(([k, label]) => (
              <label key={k} className="flex items-center gap-1 text-[11.5px]">
                <input type="checkbox" checked={!!hc[k]} onChange={(e) => patch(v, { hook_check: { ...hc, [k]: e.target.checked } })} className="accent-[#ff3c00]" />
                {label}
              </label>
            ))}
          </div>
          {hint.context_likely === false && <p className="mt-0.5 text-[10.5px] text-[#c44a00]">Line 1 doesn&apos;t contain the search phrase “{idea?.extraction?.primary_keyword}”.</p>}
        </div>

        {v.publish_error && <p className={`text-[11px] leading-snug ${v.status === "failed" ? "text-[#b42318]" : "text-ink/55"}`}>{v.publish_error}</p>}
        {v.scheduled_at && ["approved", "publishing"].includes(v.status) && <p className="font-mono text-[10.5px] text-ink/60">{mode === "auto" ? "Posts" : "Due"} {fmtWhen(v.scheduled_at, eng.settings?.timezone)}{mode !== "auto" ? " · post by hand" : ""}</p>}
        {v.status === "posted" && (
          <div className="text-[11.5px]">
            {v.posted_url ? <a href={v.posted_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#ff3c00] hover:underline"><ExternalLink className="h-3 w-3" />View post</a> : <span className="text-ink/50">Posted (no link saved)</span>}
            {v.insights && Object.keys(v.insights).some((k) => typeof v.insights[k] === "number") && (
              <p className="mt-1 font-mono text-[10px] text-ink/55">{Object.entries(v.insights).filter(([, n]) => typeof n === "number").map(([k, n]) => `${k} ${n.toLocaleString("en-US")}`).join(" · ")}</p>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-1 border-t border-hair pt-2">
          {v.status === "draft" && <><Btn variant="flame" className="h-8" disabled={busy || over} onClick={() => act.approve({ ...v, text, title })}><Check className="h-3.5 w-3.5" />Approve</Btn><Btn variant="ghost" className="h-8" onClick={() => act.decline(v)}><X className="h-3.5 w-3.5" />Decline</Btn></>}
          {v.status === "failed" && <><Btn variant="flame" className="h-8" disabled={busy} onClick={() => act.approve({ ...v, text, title, scheduled_at: null })}>Re-approve</Btn><Btn variant="ghost" className="h-8" onClick={() => act.restore(v)}>Back to draft</Btn></>}
          {v.status === "declined" && <Btn variant="ghost" className="h-8" onClick={() => act.restore(v)}>Restore</Btn>}
          {v.status === "approved" && mode === "auto" && <Btn variant="ink" className="h-8" onClick={() => act.postNow(v)}><Send className="h-3.5 w-3.5" />Post now</Btn>}
          {["approved", "failed"].includes(v.status) && mode !== "auto" && (
            <>
              <Btn className="h-8" onClick={async () => (await copyText([title, text].filter(Boolean).join("\n\n"))) && toast({ title: "Copied" })}><Copy className="h-3.5 w-3.5" />Copy</Btn>
              <Btn className="h-8" onClick={() => act.download(v)}><Download className="h-3.5 w-3.5" />Asset</Btn>
              <a href={accountUrl || p?.open} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 border border-hair bg-card px-2.5 text-[12px] hover:border-[#ff3c00] hover:text-[#ff3c00]"><ExternalLink className="h-3.5 w-3.5" />Open</a>
              <Btn variant="flame" className="h-8" onClick={() => act.mark(v)}><Link2 className="h-3.5 w-3.5" />Mark posted</Btn>
            </>
          )}
          {v.status === "approved" && <Btn variant="ghost" className="h-8" onClick={() => act.unapprove(v)}>Unapprove</Btn>}
        </div>
      </div>
    </article>
  );
}

function MarkPostedDialog({ v, onClose, onDone }) {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try { await channels("mark_posted", { variant_id: v.id, url: url.trim() }); toast({ title: "Marked posted" }); setUrl(""); onDone(); } catch (e) { toast({ title: "Couldn't save", description: String(e?.message || e), variant: "destructive" }); } finally { setSaving(false); }
  };
  return (
    <Dialog open={!!v} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark posted · {PLATFORM[v?.platform]?.label}</DialogTitle>
          <DialogDescription>Paste the live post URL so Learn can read its numbers back where the platform allows.</DialogDescription>
        </DialogHeader>
        <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className={inputCls} />
        <DialogFooter>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="flame" onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Mark posted</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
