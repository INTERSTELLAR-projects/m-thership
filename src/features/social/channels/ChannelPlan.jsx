import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, ExternalLink, FileText, Minus, Plus, Zap, Hand } from "lucide-react";
import { POSTS_KEY, listPosts } from "../lib/socialStore";
import { PILLAR_LABEL } from "../ui";
import { CHANNELS, inWeek, saveChannelSettings, weekWindow } from "./channels";
import { CH_SETTINGS_KEY, useChannelPosts, useChannelSettings, useVideos } from "./data";

const whenOf = (p) => (p.scheduled_at || p.published_at || p.posted_at || p.planned_for || "").slice(0, 10);

/** This week's planned / approved / posted counts for one channel. */
function progressFor(key, { posts, cposts, videos, w }) {
  const tally = { planned: 0, approved: 0, posted: 0 };
  const add = (s) => { if (s === "posted" || s === "published") tally.posted++; else if (s === "approved" || s === "publishing" || s === "scheduled") tally.approved++; else if (s !== "declined" && s !== "failed") tally.planned++; };
  if (key === "instagram" || key === "facebook") {
    posts.filter((p) => inWeek(whenOf(p), w))
      .filter((p) => key === "instagram" ? p.publish_targets?.instagram !== false : p.status === "draft" || p.publish_targets?.facebook === true)
      .forEach((p) => add(p.status || "draft"));
  } else if (key === "youtube_long") {
    videos.filter((v) => inWeek(v.publish_date, w)).forEach((v) => add(v.stage));
  } else {
    cposts.filter((c) => c.channel === key && inWeek((c.posted_at || c.planned_for || "").slice(0, 10), w)).forEach((c) => add(c.status));
  }
  return tally;
}

export default function ChannelPlan({ go }) {
  const qc = useQueryClient();
  const postsQ = useQuery({ queryKey: POSTS_KEY, queryFn: listPosts });
  const cpQ = useChannelPosts();
  const ytQ = useVideos();
  const setQ = useChannelSettings();
  const [offset, setOffset] = useState(0);
  const w = weekWindow(undefined, offset);
  const overrides = setQ.data?.cadence || {};
  const data = useMemo(() => ({ posts: postsQ.data || [], cposts: cpQ.data || [], videos: ytQ.data || [], w }), [postsQ.data, cpQ.data, ytQ.data, w]);

  const setCadence = async (key, n) => {
    const cadence = { ...overrides, [key]: Math.max(0, Math.min(14, n)) };
    qc.setQueryData(CH_SETTINGS_KEY, (old) => ({ ...(old || {}), cadence }));
    await saveChannelSettings({ cadence }).catch(() => null);
  };
  const label = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mono-label text-[9px] text-ink/45">Channel plan</p>
          <h2 className="text-[26px] font-semibold leading-none tracking-[-0.04em]">Every channel, <span className="text-[#ff3c00]">/one plan</span></h2>
          <p className="mt-1.5 max-w-2xl text-[12.5px] text-ink/55">Instagram and Facebook publish through approvals. LinkedIn and YouTube are planned here and posted by you; nothing on those channels posts automatically.</p>
        </div>
        <div className="flex items-center border border-hair bg-card">
          <button type="button" onClick={() => setOffset(offset - 1)} className="h-8 px-2.5 text-[12px] text-ink/60 hover:text-[#ff3c00]">←</button>
          <span className="mono-label px-2 text-[9.5px] text-ink/70">{offset === 0 ? "This week" : offset === 1 ? "Next week" : offset === -1 ? "Last week" : ""} · {label(w.start)}–{label(w.end)}</span>
          <button type="button" onClick={() => setOffset(offset + 1)} className="h-8 px-2.5 text-[12px] text-ink/60 hover:text-[#ff3c00]">→</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {CHANNELS.map((c) => {
          const target = overrides[c.key] ?? c.cadence;
          const t = progressFor(c.key, data);
          const pct = target ? Math.min(100, Math.round((t.posted / target) * 100)) : 0;
          const queued = Math.min(100, Math.round(((t.posted + t.approved) / (target || 1)) * 100));
          const dest = c.key === "instagram" || c.key === "facebook" ? "posts" : c.key.startsWith("linkedin") ? "linkedin" : "youtube";
          return (
            <section key={c.key} className="flex flex-col border border-hair bg-card">
              <header className="flex items-start gap-3 border-b border-hair px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[16px] font-semibold tracking-[-0.02em]">{c.label}</h3>
                    <span className={`mono-label inline-flex items-center gap-1 border px-1.5 py-0.5 text-[8px] ${c.mode === "auto" ? "border-[#ff3c00]/50 bg-[#ff3c00]/10 text-[#d83300]" : "border-hair text-ink/55"}`}>
                      {c.mode === "auto" ? <Zap className="h-2.5 w-2.5" /> : <Hand className="h-2.5 w-2.5" />}{c.mode === "auto" ? "Auto-publish" : "Manual"}
                    </span>
                  </div>
                  <a href={c.link} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10.5px] text-ink/50 hover:text-[#ff3c00]">{c.handle}<ExternalLink className="h-2.5 w-2.5" /></a>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setCadence(c.key, target - 1)} className="flex h-6 w-6 items-center justify-center border border-hair text-ink/50 hover:text-[#ff3c00]" title="Lower target"><Minus className="h-3 w-3" /></button>
                    <span className="w-7 text-center text-[20px] font-semibold tabular-nums tracking-[-0.04em]">{target}</span>
                    <button type="button" onClick={() => setCadence(c.key, target + 1)} className="flex h-6 w-6 items-center justify-center border border-hair text-ink/50 hover:text-[#ff3c00]" title="Raise target"><Plus className="h-3 w-3" /></button>
                  </div>
                  <p className="mono-label mt-0.5 text-[8px] text-ink/45">{c.unit}</p>
                </div>
              </header>

              <div className="flex-1 space-y-3 px-4 py-3">
                <div>
                  <div className="relative h-1.5 bg-ink/[0.08]">
                    <div className="absolute inset-y-0 left-0 bg-[#ff3c00]/25" style={{ width: `${queued}%` }} />
                    <div className="absolute inset-y-0 left-0 flame-bg" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 font-mono text-[10.5px]">
                    <span className="text-ink/55"><b className="text-ink">{t.planned}</b> planned</span>
                    <span className="text-center text-ink/55"><b className="text-ink">{t.approved}</b> {c.mode === "auto" ? "scheduled" : "approved"}</span>
                    <span className="text-right text-ink/55"><b className="text-ink">{t.posted}</b> / {target} posted</span>
                  </div>
                  {!overrides[c.key] && c.cadenceNote && <p className="mt-1 text-[10.5px] text-ink/40">Target {c.cadenceNote}</p>}
                </div>

                {c.voice && <p className="text-[12px] leading-snug text-ink/65">{c.voice}</p>}
                <p className="text-[12px] leading-snug text-ink/55">{c.how}</p>

                <div className="flex flex-wrap gap-1">
                  {c.pillars.map((p) => <span key={p} className="border border-hair bg-paper px-1.5 py-0.5 text-[10.5px] text-ink/60">{PILLAR_LABEL[p] || p.replace(/_/g, " ")}</span>)}
                </div>

                {c.flags && (
                  <ul className="space-y-1 border-l-2 border-[#ff6a00] pl-2.5">
                    {c.flags.map((f) => <li key={f} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-ink/70"><AlertTriangle className="mt-px h-3 w-3 shrink-0 text-[#ff6a00]" />{f}</li>)}
                  </ul>
                )}
              </div>

              <footer className="flex flex-wrap items-center gap-2 border-t border-hair px-4 py-2.5">
                <button type="button" onClick={() => go(dest)} className="inline-flex items-center gap-1 text-[12px] font-medium text-[#ff3c00] hover:underline">
                  {dest === "posts" ? "Open Instagram & Facebook posts" : dest === "linkedin" ? "Open LinkedIn queue" : "Open YouTube planner"}<ArrowRight className="h-3 w-3" />
                </button>
                {c.doc && <a href={c.doc} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[12px] text-ink/55 hover:text-[#ff3c00]"><FileText className="h-3 w-3" />Channel plan doc</a>}
              </footer>
            </section>
          );
        })}
      </div>
    </div>
  );
}
