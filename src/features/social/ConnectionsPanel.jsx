import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Instagram, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/use-toast";
import { DEFAULT_PUBLISH, SOCIAL_STATUS_KEY, fmtTime, saveSocialSettings, tzAbbr } from "./lib/publish";
import { useSocialStatus } from "./PublishDialogs";
import { Btn, Field, Select } from "./ui";
import { Card, Pill, Toggle } from "./connUi";
import ClientInstagram from "./ClientInstagram";

export default function ConnectionsPanel({ open, onClose }) {
  const qc = useQueryClient();
  const st = useSocialStatus();
  const [s, setS] = useState(DEFAULT_PUBLISH);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open && st.data) setS({ ...DEFAULT_PUBLISH, ...st.data.settings }); }, [open, st.data]);

  const save = async (patch) => {
    const next = { ...s, ...patch };
    setS(next);
    setSaving(true);
    try {
      const r = await saveSocialSettings(patch);
      qc.setQueryData(SOCIAL_STATUS_KEY, (old) => (old ? { ...old, settings: r.settings } : old));
    } catch (e) {
      toast({ title: "Couldn't save", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const ig = st.instagram || {};
  const fb = st.facebook || {};
  const fbReady = fb.connected && !!s.facebook_page_id;
  const setTime = (i, v) => save({ default_times: s.default_times.map((t, j) => (j === i ? v : t)).filter(Boolean) });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto border-hair bg-[#ebe8e4] p-0 sm:max-w-[580px]">
        <SheetHeader className="border-b border-hair px-5 pb-4 pt-6 text-left">
          <p className="label-cross text-ink/60">(Social Studio)</p>
          <SheetTitle className="text-[30px] font-semibold leading-none tracking-[-0.045em]">Social <span className="text-[#ff3c00]">/connections</span></SheetTitle>
          <SheetDescription className="text-[12.5px]">Where approved posts go, when they go, and who can see the numbers. {saving && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-5 py-5">
          {/* Instagram */}
          <Card label="Publishing" title="Instagram" right={<Btn variant="ghost" onClick={() => st.refetch()} disabled={st.isFetching}><RefreshCw className={`h-3.5 w-3.5 ${st.isFetching ? "animate-spin" : ""}`} />Check</Btn>}>
            {st.isLoading ? <p className="text-[12.5px] text-ink/50"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />Checking the connector…</p> : ig.connected ? (
              <div className="flex items-center gap-3">
                {ig.profile_picture_url ? <img src={ig.profile_picture_url} alt="" className="h-11 w-11 border border-hair object-cover" /> : <Instagram className="h-9 w-9 text-ink/40" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold tracking-[-0.02em]">@{ig.username}</p>
                  <p className="font-mono text-[10.5px] text-ink/50">{ig.followers_count ?? "—"} followers · {ig.media_count ?? "—"} posts</p>
                </div>
                <Pill ok>Connected</Pill>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-[12.5px] text-[#b42318]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Instagram isn&apos;t reachable{ig.error ? `: ${ig.error}` : ""}. Reconnect it in Base44 → Integrations → Instagram Business.</div>
            )}
            {ig.quota && (
              <div>
                <div className="flex justify-between font-mono text-[10px] text-ink/50"><span>API posts, last {ig.quota.window_hours}h</span><span>{ig.quota.usage ?? 0} / {ig.quota.total}</span></div>
                <div className="mt-1 h-1 bg-ink/[0.08]"><div className="h-full flame-bg" style={{ width: `${Math.min(100, ((ig.quota.usage || 0) / (ig.quota.total || 25)) * 100)}%` }} /></div>
              </div>
            )}
            <p className="text-[11.5px] leading-snug text-ink/50">Shared connector on the Interstellar account. Posts publish as single 1080 × 1080 images with the caption and alt text.</p>
          </Card>

          {/* Facebook */}
          <Card label="Cross-posting" title="Facebook Page" right={<Pill ok={fbReady}>{fb.connected ? (s.facebook_page_id ? "Ready" : "Pick a Page") : "Not connected"}</Pill>}>
            {!fb.connected ? (
              <div className="space-y-2 text-[12.5px] leading-snug text-ink/70">
                <p>Connect the Interstellar Facebook Page once and approved posts can go there too.</p>
                <ol className="list-decimal space-y-1 pl-4 text-[12px] text-ink/60">
                  <li>Create the Interstellar Strategies Facebook Page (it doubles as the ads account&apos;s Page).</li>
                  <li>In Base44, open this app → <b>Integrations</b> → <b>Facebook Pages</b> → connect as a <b>shared</b> connector.</li>
                  <li>Grant <span className="font-mono text-[11px]">pages_show_list</span>, <span className="font-mono text-[11px]">pages_manage_posts</span>, <span className="font-mono text-[11px]">pages_read_engagement</span> and tick the Interstellar Page.</li>
                  <li>Come back here, press <b>Check</b>, pick the Page.</li>
                </ol>
              </div>
            ) : (
              <>
                <Field label="Post to this Page">
                  <Select value={s.facebook_page_id} onChange={(v) => save({ facebook_page_id: v })} placeholder="Choose a Page" options={(fb.pages || []).map((p) => ({ value: p.id, label: `${p.name}${p.instagram ? ` · @${p.instagram}` : ""}` }))} />
                </Field>
                {fb.error && <p className="text-[11.5px] text-[#b42318]">{fb.error}</p>}
              </>
            )}
            <Toggle on={!!s.auto_facebook && fbReady} disabled={!fbReady} onChange={(v) => save({ auto_facebook: v })} label="Auto cross-post to Facebook" sub={fbReady ? "New approvals default to Instagram + Facebook. You can still switch it per post." : "Turns on once a Page is connected and chosen."} />
          </Card>

          {/* Schedule defaults */}
          <Card label="Defaults" title={`Posting times · ${tzAbbr(s.timezone)}`}>
            <div className="flex flex-wrap items-end gap-2">
              {s.default_times.map((t, i) => (
                <div key={i} className="flex items-center border border-hair bg-paper">
                  <input type="time" step={900} value={t} onChange={(e) => setTime(i, e.target.value)} className="h-9 bg-transparent px-2 font-mono text-[12.5px] outline-none" />
                  {s.default_times.length > 1 && <button type="button" onClick={() => save({ default_times: s.default_times.filter((_, j) => j !== i) })} className="px-1.5 text-ink/35 hover:text-[#ff3c00]" title="Remove"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
              ))}
              {s.default_times.length < 4 && <Btn variant="ghost" onClick={() => save({ default_times: [...s.default_times, "17:00"] })}><Plus className="h-3.5 w-3.5" />Time</Btn>}
            </div>
            <p className="text-[11.5px] text-ink/50">Approve suggests the planned day at {s.default_times.map(fmtTime).join(" or ")}. &ldquo;Next open slot&rdquo; uses these times.</p>
            <Field label="Posts per day">
              <div className="flex border border-hair">
                {[1, 2, 3].map((n) => <button key={n} type="button" onClick={() => save({ max_per_day: n })} className={`h-8 flex-1 text-[12px] ${Number(s.max_per_day) === n ? "bg-ink text-white" : "bg-paper text-ink/60"}`}>{n}</button>)}
              </div>
            </Field>
            <Toggle on={!!s.post_weekends} onChange={(v) => save({ post_weekends: v })} label="Allow weekend slots" sub="Next open slot skips Saturday and Sunday when off." />
            <Toggle on={!!s.paused} onChange={(v) => save({ paused: v })} label="Pause automatic publishing" sub="Scheduled posts wait until you turn this off. Post now still works." />
          </Card>

          <ClientInstagram connectorId={s.ig_app_user_connector_id} onSaveConnector={(v) => save({ ig_app_user_connector_id: v })} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
