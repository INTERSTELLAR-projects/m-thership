import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Lightbulb, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { Btn, Panel } from "../ui";
import { digestTakeaways } from "./ai";
import { PLATFORM } from "./platforms";
import { KEYS, channels } from "./store";

// 06 LEARN: weekly digest per platform from the numbers the platforms actually return (engagement, saves, shares,
// reach where the API allows), what to double down on, and a new idea bank that feeds the next Capture.
// No numbers are invented: platforms without data say so.

const LABEL = { views: "Views", reach: "Reach", impressions: "Impressions", likes: "Likes", reactions: "Reactions", comments: "Comments", replies: "Replies", saves: "Saves", shares: "Shares", reposts: "Reposts", quotes: "Quotes", clicks: "Clicks", outbound_clicks: "Outbound", score: "Score" };

export default function Learn({ eng, onCapture }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState("");
  const d = eng.digests[0] || null;
  const refresh = () => qc.invalidateQueries({ queryKey: KEYS.digests(eng.brand.key) });

  const compute = async () => {
    setBusy("compute");
    try {
      await channels("refresh_insights").catch(() => null);
      await channels("digest", { brand_key: eng.brand.key });
      refresh();
      toast({ title: "Digest updated from platform numbers" });
    } catch (e) { toast({ title: "Couldn't compute", description: String(e?.message || e), variant: "destructive" }); } finally { setBusy(""); }
  };
  const write = async () => {
    setBusy("write");
    try {
      const out = await digestTakeaways({ brand: eng.brand, digest: d, knowledge: eng.knowledge });
      if (!out) { toast({ title: "No data yet", description: "Takeaways need at least one post with numbers." }); return; }
      await base44.entities.SocialDigest.update(d.id, { ...out, written_at: new Date().toISOString() });
      refresh();
    } catch (e) { toast({ title: "Couldn't write takeaways", description: String(e?.message || e), variant: "destructive" }); } finally { setBusy(""); }
  };
  const captureIdea = async (i) => {
    await base44.entities.SocialIdea.create({ brand_key: eng.brand.key, client_id: eng.brand.isInterstellar ? "" : eng.brand.key, brand_name: eng.brand.name, title: i.title, status: "captured", source_type: "thought", source_text: `${i.title}\n\n${i.why || ""}`.trim(), platforms: i.platforms || [] });
    qc.invalidateQueries({ queryKey: KEYS.ideas(eng.brand.key) });
    toast({ title: "Saved to Capture", description: "Pick it under Recent ideas and press Extract & draft." });
    onCapture();
  };

  const per = Object.entries(d?.per_platform || {});
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-ink/60">{d ? <>Week of <b className="text-ink">{d.week_start}</b> · {d.posts_count} posted · {d.data_points} with numbers · computed {String(d.computed_at || "").slice(0, 16).replace("T", " ")} UTC</> : "No digest yet. It's computed every morning for last week; compute it now any time."}</p>
        <div className="flex gap-1">
          <Btn onClick={compute} disabled={!!busy}>{busy === "compute" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Pull numbers & compute</Btn>
          {d?.data_points > 0 && <Btn variant="flame" onClick={write} disabled={!!busy}>{busy === "write" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Write takeaways & ideas</Btn>}
        </div>
      </div>

      {!d || !per.length ? (
        <div className="flex flex-col items-center border border-dashed border-hair px-6 py-14 text-center">
          <p className="text-sm font-medium text-ink/70">Nothing to learn from yet</p>
          <p className="mt-1 max-w-md text-xs text-ink/45">Once posts go live (or you mark manual posts posted with their URL), their real engagement is read back here per platform. Platforms whose API shares no numbers (Telegram, WhatsApp, GBP for now) show posts without stats.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {per.map(([k, p]) => (
            <Panel key={k} label={`${p.posts} posted · ${p.with_data} with data`} title={PLATFORM[k]?.label || k} bodyClass="space-y-2 p-3">
              {Object.keys(p.totals || {}).length ? (
                <div className="grid grid-cols-3 gap-px bg-hair">
                  {Object.entries(p.totals).map(([m, n]) => (
                    <div key={m} className="bg-card px-2 py-1.5"><p className="mono-label text-[8px] text-ink/45">{LABEL[m] || m}</p><p className="text-[18px] font-semibold tabular-nums tracking-[-0.03em]">{Number(n).toLocaleString("en-US")}</p></div>
                  ))}
                </div>
              ) : <p className="text-[12px] text-ink/45">No numbers from this platform yet.</p>}
              {p.top && (
                <p className="text-[12px] leading-snug"><span className="mono-label mr-1 text-[8.5px] text-[#ff3c00]">Top</span>{p.top.title}{p.top.url && <a href={p.top.url} target="_blank" rel="noreferrer" className="ml-1 inline-flex text-ink/45 hover:text-[#ff3c00]" title="Open post"><ExternalLink className="h-3 w-3" /></a>}</p>
              )}
            </Panel>
          ))}
        </div>
      )}

      {d?.summary && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel label="Double down" title="What worked" bodyClass="space-y-2 p-3.5">
            <p className="text-[12.5px] leading-snug text-ink/70">{d.summary}</p>
            <ul className="space-y-1.5 text-[12.5px] leading-snug">{(d.double_down || []).map((x, i) => <li key={i} className="flex gap-2"><span className="font-mono text-[10px] text-[#ff3c00]">{String(i + 1).padStart(2, "0")}</span>{x}</li>)}</ul>
          </Panel>
          <Panel label="Idea bank · feeds the next batch" title={`${(d.ideas || []).length} ideas`} bodyClass="divide-y divide-hair">
            {(d.ideas || []).map((i, n) => (
              <div key={n} className="flex items-start gap-2 px-3.5 py-2">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff6a00]" />
                <div className="min-w-0 flex-1"><p className="text-[12.5px] font-medium">{i.title}</p><p className="text-[11.5px] text-ink/55">{i.why}</p></div>
                <Btn variant="ghost" className="h-7 text-[11px]" onClick={() => captureIdea(i)}>Capture</Btn>
              </div>
            ))}
          </Panel>
        </div>
      )}
      {eng.digests.length > 1 && <p className="text-[11px] text-ink/45">Earlier weeks: {eng.digests.slice(1).map((x) => `${x.week_start} (${x.posts_count} posted)`).join(" · ")}</p>}
    </div>
  );
}
