import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { addDays, fmtTime, isoToZoned, todayIn, tzAbbr, weekdayOf } from "../lib/publish";
import { Btn, Panel } from "../ui";
import { Toggle } from "../connUi";
import { MODE_LABEL, PLATFORMS, PLATFORM } from "./platforms";
import { daysFrom } from "./schedule";
import { DEFAULT_ENGINE, KEYS, saveEngineSettings } from "./store";

// 05 SCHEDULE: one calendar across every platform, plus the per-platform windows / daily limits / spread the
// auto-queue uses. Windows are starting points to test, not data.

const TONE = {
  approved: "border-[#ff3c00]/50 bg-[#ff3c00]/10",
  publishing: "border-[#ff6a00]/60 bg-[#ff6a00]/15 animate-pulse",
  posted: "border-ink bg-ink text-white",
  failed: "border-[#b42318]/50 bg-[#b42318]/10 text-[#b42318]",
};
const SHOWN = ["approved", "publishing", "posted", "failed"];

export default function ScheduleCalendar({ eng }) {
  const qc = useQueryClient();
  const s = eng.settings || DEFAULT_ENGINE;
  const tz = s.timezone;
  const [offset, setOffset] = useState(0);
  const today = todayIn(tz);
  const monday = addDays(today, -((weekdayOf(today) + 6) % 7) + offset * 14);
  const days = daysFrom(monday, 14);
  const items = useMemo(() => {
    const vs = eng.variants.filter((v) => SHOWN.includes(v.status) && (v.scheduled_at || v.published_at))
      .map((v) => ({ id: v.id, platform: v.platform, status: v.status, when: v.published_at || v.scheduled_at, title: (v.title || v.text || "").split("\n")[0], mode: v.mode, account: v.account_label }));
    const legacy = eng.legacy.filter((p) => SHOWN.includes(p.status) && (p.scheduled_at || p.published_at))
      .map((p) => ({ id: p.id, platform: "instagram", status: p.status, when: p.published_at || p.scheduled_at, title: p.title, mode: "auto", account: "IG/FB studio post" }));
    return [...vs, ...legacy].map((x) => ({ ...x, z: isoToZoned(x.when, tz) })).sort((a, b) => a.when.localeCompare(b.when));
  }, [eng.variants, eng.legacy, tz]);

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_400px]">
      <Panel label={`05 · Schedule · ${tzAbbr(tz)}`} title="Every platform, one calendar" right={
        <div className="flex items-center gap-1">
          <Btn variant="ghost" onClick={() => setOffset((o) => o - 1)} title="Previous two weeks"><ChevronLeft className="h-4 w-4" /></Btn>
          <Btn variant="ghost" onClick={() => setOffset(0)}>Today</Btn>
          <Btn variant="ghost" onClick={() => setOffset((o) => o + 1)} title="Next two weeks"><ChevronRight className="h-4 w-4" /></Btn>
        </div>
      }>
        <div className="grid grid-cols-7 gap-px bg-hair">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="mono-label bg-card px-2 py-1 text-[8.5px] text-ink/45">{d}</div>)}
          {days.map((d) => {
            const list = items.filter((x) => x.z.date === d);
            return (
              <div key={d} className={`min-h-[132px] p-1.5 ${d < today ? "bg-paper" : "bg-card"} ${d === today ? "outline outline-1 -outline-offset-1 outline-[#ff3c00]" : ""}`}>
                <p className={`font-mono text-[10px] ${d === today ? "font-semibold text-[#ff3c00]" : "text-ink/45"}`}>{Number(d.slice(8))}</p>
                <div className="mt-1 space-y-1">
                  {list.map((x) => (
                    <div key={x.id} className={`border px-1 py-0.5 text-[10.5px] leading-tight ${TONE[x.status] || "border-hair"}`} title={`${PLATFORM[x.platform]?.label} · ${x.account || ""} · ${MODE_LABEL[x.mode] || ""}\n${x.title}`}>
                      <span className="font-mono text-[9px] font-semibold">{x.z.time} {PLATFORM[x.platform]?.short}</span>
                      {x.mode && x.mode !== "auto" && x.status !== "posted" && <span className="ml-1 font-mono text-[8.5px] opacity-70">by hand</span>}
                      <span className="block truncate">{x.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="border-t border-hair px-3 py-2 text-[11px] text-ink/50">Orange = approved & queued · black = posted · “by hand” = manual platform, due at that time. IG/FB studio posts from the Instagram & Facebook tab are included so slots don&apos;t collide.</p>
      </Panel>
      <Settings s={s} onSaved={() => qc.invalidateQueries({ queryKey: KEYS.settings })} />
    </div>
  );
}

function Settings({ s, onSaved }) {
  const [draft, setDraft] = useState(s);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(s), [s]);
  const save = async (patch) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    setSaving(true);
    try { await saveEngineSettings({ windows: next.windows, limits: next.limits, spread_minutes: next.spread_minutes, weekends: next.weekends }); onSaved(); } catch (e) { toast({ title: "Couldn't save", description: String(e?.message || e), variant: "destructive" }); } finally { setSaving(false); }
  };
  const setWin = (k, list) => save({ windows: { ...draft.windows, [k]: list } });
  return (
    <Panel label={saving ? "Auto-queue · saving…" : "Auto-queue"} title="Best-time windows per platform" right={saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-ink/40" /> : null} bodyClass="space-y-3 p-3.5">
      <p className="text-[11.5px] leading-snug text-ink/55">Approving a batch gives each variant the first open window for its platform, at most the daily limit per account, and at least the spread between any two posts of the same brand. Starting points: change them as your own numbers come in.</p>
      <div className="flex items-center gap-2">
        <span className="text-[12.5px]">Spread</span>
        <input type="number" min={0} max={240} step={5} value={draft.spread_minutes} onChange={(e) => setDraft({ ...draft, spread_minutes: Number(e.target.value) })} onBlur={() => save({})} className="h-8 w-16 border border-hair bg-paper px-2 font-mono text-[12px]" aria-label="Spread minutes" />
        <span className="text-[12px] text-ink/50">min between posts</span>
      </div>
      <Toggle on={!!draft.weekends} onChange={(v) => save({ weekends: v })} label="Allow weekends" sub="Off: the queue skips Saturday and Sunday." />
      <div className="divide-y divide-hair border border-hair">
        {PLATFORMS.map((p) => {
          const wins = draft.windows?.[p.key] || [];
          return (
            <div key={p.key} className="flex flex-wrap items-center gap-1.5 bg-card px-2 py-1.5">
              <span className="w-[84px] shrink-0 text-[12px] font-medium">{p.key === "gbp" ? "GBP" : p.key === "whatsapp" ? "WhatsApp" : p.label}</span>
              {wins.map((t, i) => (
                <span key={i} className="flex items-center border border-hair bg-paper">
                  <input type="time" step={900} value={t} onChange={(e) => setWin(p.key, wins.map((x, j) => (j === i ? e.target.value : x)).filter(Boolean))} className="h-7 bg-transparent px-1 font-mono text-[11px] outline-none" aria-label={`${p.label} window ${fmtTime(t)}`} />
                  {wins.length > 1 && <button type="button" onClick={() => setWin(p.key, wins.filter((_, j) => j !== i))} className="px-1 text-ink/35 hover:text-[#ff3c00]" title="Remove"><Trash2 className="h-3 w-3" /></button>}
                </span>
              ))}
              {wins.length < 4 && <button type="button" onClick={() => setWin(p.key, [...wins, "17:00"])} className="p-1 text-ink/40 hover:text-[#ff3c00]" title="Add window"><Plus className="h-3.5 w-3.5" /></button>}
              <label className="ml-auto flex items-center gap-1 font-mono text-[10px] text-ink/50">
                max/day
                <input type="number" min={1} max={20} value={draft.limits?.[p.key] ?? p.limit} onChange={(e) => setDraft({ ...draft, limits: { ...draft.limits, [p.key]: Number(e.target.value) } })} onBlur={() => save({})} className="h-7 w-11 border border-hair bg-paper px-1 text-[11px]" />
              </label>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
