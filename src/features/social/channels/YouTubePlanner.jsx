import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { CalendarDays, Check, ExternalLink, FileText, Loader2, Plus, Scissors, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/use-toast";
import { Btn, Field, Select, TextArea, TextInput, inputCls } from "../ui";
import { DEFAULT_DESCRIPTION_TEMPLATE, LINKS, SERIES, STAGES, YT_PLAN_DOC, buildDescription, saveChannelSettings } from "./channels";
import { draftVideo } from "./channelAi";
import ChannelQueue from "./ChannelQueue";
import { CH_SETTINGS_KEY, CP_KEY, YT_KEY, cp, useChannelSettings, useVideos, yt } from "./data";

const seriesLabel = (k) => SERIES.find((s) => s.key === k)?.label || "";
const RHYTHM = [["Mon", "Topic + titles"], ["Tue", "Script"], ["Wed", "Record"], ["Thu", "Edit + clip Shorts"], ["Fri", "Publish"]];

export default function YouTubePlanner() {
  const qc = useQueryClient();
  const q = useVideos();
  const setQ = useChannelSettings();
  const [openId, setOpenId] = useState(null);
  const [tplOpen, setTplOpen] = useState(false);
  const videos = q.data || [];
  const template = setQ.data?.youtube_description_template || DEFAULT_DESCRIPTION_TEMPLATE;

  const onDragEnd = async (r) => {
    if (!r.destination) return;
    const stage = r.destination.droppableId;
    if (stage === r.source.droppableId) return;
    qc.setQueryData(YT_KEY, (old = []) => old.map((v) => (v.id === r.draggableId ? { ...v, stage } : v)));
    await yt.update(r.draggableId, { stage }).catch(() => toast({ title: "Couldn't move it", variant: "destructive" }));
    qc.invalidateQueries({ queryKey: YT_KEY });
  };
  const add = async () => {
    const v = await yt.create({ title: "New video idea", stage: "idea", series: "ai_search_brief", format: "long", sort: (videos.length + 1) * 10 });
    qc.invalidateQueries({ queryKey: YT_KEY });
    setOpenId(v.id);
  };

  return (
    <div className="mt-5 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mono-label text-[9px] text-ink/45">YouTube · Interstellar™ | Business OS</p>
          <h2 className="text-[26px] font-semibold leading-none tracking-[-0.04em]">Video <span className="text-[#ff3c00]">/pipeline</span></h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={YT_PLAN_DOC} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 border border-hair bg-card px-3 text-[12.5px] font-medium hover:border-[#ff3c00] hover:text-[#ff3c00]"><FileText className="h-3.5 w-3.5" />Channel plan doc</a>
          <a href={LINKS.youtube_studio} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 border border-hair bg-card px-3 text-[12.5px] font-medium hover:border-[#ff3c00] hover:text-[#ff3c00]"><ExternalLink className="h-3.5 w-3.5" />YouTube Studio</a>
          <Btn onClick={() => setTplOpen(!tplOpen)}>Description template</Btn>
          <Btn variant="flame" onClick={add}><Plus className="h-3.5 w-3.5" />New video</Btn>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-px border border-hair bg-hair">
        {RHYTHM.map(([d, l]) => (
          <div key={d} className="bg-card px-3 py-2">
            <p className="mono-label text-[8.5px] text-[#ff3c00]">{d}</p>
            <p className="text-[12px] font-medium leading-tight">{l}</p>
          </div>
        ))}
      </div>

      {tplOpen && <TemplateEditor value={template} onSave={async (v) => { await saveChannelSettings({ youtube_description_template: v }); qc.invalidateQueries({ queryKey: CH_SETTINGS_KEY }); toast({ title: "Template saved" }); }} />}

      {q.isLoading ? <p className="py-10 text-center text-[13px] text-ink/50"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p> : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid auto-cols-[minmax(210px,1fr)] grid-flow-col gap-2 overflow-x-auto pb-2">
            {STAGES.map((s) => {
              const col = videos.filter((v) => (v.stage || "idea") === s.key).sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0));
              return (
                <Droppable droppableId={s.key} key={s.key}>
                  {(drop, snap) => (
                    <div ref={drop.innerRef} {...drop.droppableProps} className={`flex min-h-[300px] flex-col gap-1.5 border p-1.5 ${snap.isDraggingOver ? "border-[#ff3c00] bg-[#ff3c00]/5" : "border-hair bg-card/60"}`}>
                      <div className="flex items-baseline justify-between px-1">
                        <span className="text-[13px] font-semibold">{s.label}</span>
                        <span className="mono-label text-[8.5px] text-ink/40">{s.day || ""} · {col.length}</span>
                      </div>
                      {col.map((v, i) => (
                        <Draggable draggableId={v.id} index={i} key={v.id}>
                          {(drag, ds) => (
                            <button ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps} type="button" onClick={() => setOpenId(v.id)}
                              className={`block w-full border bg-paper px-2.5 py-2 text-left transition-colors hover:border-[#ff3c00]/60 ${ds.isDragging ? "rotate-1 shadow-xl" : ""} ${v.format === "trailer" ? "border-[#ff6a00]/50" : "border-hair"}`}>
                              <p className="mono-label text-[8px] text-ink/45">{v.format === "trailer" ? "Trailer · <60s" : seriesLabel(v.series)}</p>
                              <p className="mt-0.5 text-[12.5px] font-medium leading-snug">{v.chosen_title || v.title}</p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[9.5px] text-ink/45">
                                {v.publish_date && <span className="inline-flex items-center gap-0.5"><CalendarDays className="h-2.5 w-2.5" />{v.publish_date.slice(5).replace("-", "/")}</span>}
                                {(v.title_options || []).length > 0 && <span>{v.title_options.length} titles</span>}
                                {v.script && <span>script</span>}
                                {(v.shorts || []).length > 0 && <span className="inline-flex items-center gap-0.5"><Scissors className="h-2.5 w-2.5" />{v.shorts.length}</span>}
                              </div>
                              {v.guardrails && <p className="mt-1 text-[10px] leading-tight text-[#c44a00]">{v.guardrails}</p>}
                            </button>
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
      )}

      <section className="border border-hair bg-card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="mono-label text-[9px] text-ink/45">YouTube · Shorts</p>
            <h3 className="text-[18px] font-semibold tracking-[-0.03em]">Shorts <span className="text-[#ff3c00]">/queue</span></h3>
          </div>
          <p className="max-w-xl text-[11.5px] leading-snug text-ink/50">Reuse IG/FB posts and clips from the long-form video. Export clean masters (no other-platform watermarks), upload by hand, and set each Short&apos;s Related video to its long-form source.</p>
        </div>
        <ChannelQueue channels={["youtube_short"]} shorts />
      </section>

      <VideoSheet id={openId} videos={videos} template={template} onClose={() => setOpenId(null)} />
    </div>
  );
}

function TemplateEditor({ value, onSave }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="space-y-2 border border-hair bg-card p-3.5">
      <p className="text-[12px] text-ink/55">Upload-default description. Placeholders: <span className="font-mono">{"{{hook}}"}</span>, <span className="font-mono">{"{{chapters}}"}</span>, <span className="font-mono">{"{{hashtags}}"}</span>. Keep it in sync with YouTube Studio → Settings → Upload defaults.</p>
      <textarea rows={10} value={v} onChange={(e) => setV(e.target.value)} className={`${inputCls} font-mono text-[12px]`} />
      <div className="flex justify-end gap-2"><Btn onClick={() => setV(DEFAULT_DESCRIPTION_TEMPLATE)}>Reset</Btn><Btn variant="flame" onClick={() => onSave(v)}>Save template</Btn></div>
    </div>
  );
}

function VideoSheet({ id, videos, template, onClose }) {
  const qc = useQueryClient();
  const server = videos.find((v) => v.id === id);
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState("");
  useEffect(() => { setD(server ? { ...server } : null); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!id) return null;
  const set = (patch) => setD((x) => ({ ...x, ...patch }));
  const save = async (patch) => {
    const next = { ...d, ...patch };
    setD(next);
    const { id: _id, created_date: _c, updated_date: _u, created_by: _b, ...data } = next;
    await yt.update(id, data).catch((e) => toast({ title: "Couldn't save", description: String(e?.message || e), variant: "destructive" }));
    qc.invalidateQueries({ queryKey: YT_KEY });
  };
  const ai = async (part) => {
    setBusy(part);
    try {
      const r = await draftVideo({ video: d, part });
      const patch = part === "titles"
        ? { title_options: r.title_options, thumbnail_ideas: r.thumbnail_ideas.length ? r.thumbnail_ideas : d.thumbnail_ideas }
        : { title_options: r.title_options.length ? r.title_options : d.title_options, thumbnail_ideas: r.thumbnail_ideas, angle: d.angle || r.hook, script: r.script, chapters: r.chapters, shorts: r.shorts.length ? r.shorts : d.shorts };
      await save(patch);
      toast({ title: part === "titles" ? "Titles and thumbnail ideas drafted" : "Script, chapters and Shorts drafted" });
    } catch (e) {
      toast({ title: "Claude couldn't draft it", description: String(e?.message || e), variant: "destructive" });
    } finally { setBusy(""); }
  };
  const makeShorts = async () => {
    const shorts = d.shorts || [];
    const made = [];
    for (const s of shorts) {
      if (s.channel_post_id) { made.push(s); continue; }
      const p = await cp.create({ channel: "youtube_short", status: "draft", title: s.title || "Short", hook: s.title, body: [s.title, s.hook, `Full video: ${d.chosen_title || d.title}`, "#shorts #smallbusiness"].filter(Boolean).join("\n"), youtube_video_id: id, generated_by: "claude" });
      made.push({ ...s, channel_post_id: p.id });
    }
    await save({ shorts: made });
    qc.invalidateQueries({ queryKey: CP_KEY });
    toast({ title: "Shorts added to the Shorts queue", description: "Each one points at this video as its Related video." });
  };
  if (!d) return null;
  const titles = d.title_options || [];
  const chapters = d.chapters || [];
  const shorts = d.shorts || [];
  const list = (arr, max) => (arr || []).concat(arr.length < max ? [""] : []);

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto border-hair bg-[#ebe8e4] p-0 sm:max-w-[680px]">
        <SheetHeader className="border-b border-hair px-5 pb-4 pt-6 text-left">
          <p className="label-cross text-ink/60">({d.format === "trailer" ? "Trailer" : seriesLabel(d.series) || "Video"})</p>
          <SheetTitle className="sr-only">{d.title}</SheetTitle>
          <input value={d.title || ""} onChange={(e) => set({ title: e.target.value })} onBlur={() => save({})} className="w-full bg-transparent text-[26px] font-semibold leading-tight tracking-[-0.04em] outline-none focus:text-[#ff3c00]" />
          <div className="flex flex-wrap gap-2 pt-1">
            <Btn variant="flame" onClick={() => ai("all")} disabled={!!busy}>{busy === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Draft script with Claude</Btn>
            <Btn onClick={() => ai("titles")} disabled={!!busy}>{busy === "titles" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}Titles & thumbnails</Btn>
          </div>
        </SheetHeader>

        <div className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Stage"><Select value={d.stage || "idea"} onChange={(v) => save({ stage: v })} options={STAGES.map((s) => ({ value: s.key, label: s.label }))} /></Field>
            <Field label="Series"><Select value={d.series || ""} onChange={(v) => save({ series: v })} placeholder="—" options={SERIES.map((s) => ({ value: s.key, label: s.label }))} /></Field>
            <Field label="Format"><Select value={d.format || "long"} onChange={(v) => save({ format: v })} options={[{ value: "long", label: "Long-form" }, { value: "trailer", label: "Trailer <60s" }]} /></Field>
            <Field label="Publish date"><input type="date" value={d.publish_date || ""} onChange={(e) => save({ publish_date: e.target.value })} className={inputCls} /></Field>
          </div>
          <Field label="Angle / promise"><TextArea rows={2} value={d.angle} onChange={(v) => set({ angle: v })} onBlur={() => save({})} /></Field>
          {d.guardrails && <p className="border-l-2 border-[#ff6a00] pl-2.5 text-[12px] text-[#c44a00]">{d.guardrails}</p>}

          <Field label="Title options" hint={`${titles.length}/10 · click one to use it`}>
            <div className="space-y-1">
              {list(titles, 10).map((t, i) => (
                <div key={i} className="flex gap-1">
                  <button type="button" onClick={() => t && save({ chosen_title: t })} title="Use this title" className={`flex w-8 shrink-0 items-center justify-center border ${t && d.chosen_title === t ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-hair bg-paper text-ink/30"}`}><Check className="h-3.5 w-3.5" /></button>
                  <input value={t} onChange={(e) => { const n = [...titles]; n[i] = e.target.value; set({ title_options: n.filter((x, j) => x || j < titles.length) }); }} onBlur={() => save({ title_options: (d.title_options || []).filter(Boolean).slice(0, 10) })} placeholder="Add a title option" className={`${inputCls} py-1.5`} />
                  <span className={`w-9 shrink-0 self-center text-right font-mono text-[9.5px] ${t.length > 70 ? "text-[#b42318]" : "text-ink/35"}`}>{t.length || ""}</span>
                </div>
              ))}
            </div>
          </Field>

          <Field label="Thumbnail ideas">
            <div className="space-y-1">
              {list(d.thumbnail_ideas || [], 6).map((t, i) => (
                <input key={i} value={t} onChange={(e) => { const n = [...(d.thumbnail_ideas || [])]; n[i] = e.target.value; set({ thumbnail_ideas: n }); }} onBlur={() => save({ thumbnail_ideas: (d.thumbnail_ideas || []).filter(Boolean) })} placeholder="Big text + visual" className={`${inputCls} py-1.5`} />
              ))}
            </div>
          </Field>

          <Field label="Script" hint={d.script ? `${d.script.split(/\s+/).length} words · ~${Math.max(1, Math.round(d.script.split(/\s+/).length / 150))} min` : ""}>
            <TextArea rows={14} value={d.script} onChange={(v) => set({ script: v })} onBlur={() => save({})} />
          </Field>

          <Field label="Chapters">
            <div className="space-y-1">
              {list(chapters, 20).map((c, i) => (
                <div key={i} className="flex gap-1">
                  <input value={c?.t || ""} onChange={(e) => { const n = [...chapters]; n[i] = { ...(n[i] || {}), t: e.target.value }; set({ chapters: n }); }} onBlur={() => save({ chapters: (d.chapters || []).filter((x) => x?.label) })} placeholder="0:00" className={`${inputCls} w-20 py-1.5 font-mono`} />
                  <input value={c?.label || ""} onChange={(e) => { const n = [...chapters]; n[i] = { ...(n[i] || {}), label: e.target.value }; set({ chapters: n }); }} onBlur={() => save({ chapters: (d.chapters || []).filter((x) => x?.label) })} placeholder="Chapter" className={`${inputCls} py-1.5`} />
                </div>
              ))}
            </div>
          </Field>

          <Field label="Description" hint="built from the upload-default template">
            <TextArea rows={10} value={d.description} onChange={(v) => set({ description: v })} onBlur={() => save({})} />
            <div className="mt-1.5"><Btn onClick={() => save({ description: buildDescription(template, { hook: d.angle, chapters: d.chapters }) })}>Build from template</Btn></div>
          </Field>

          <Field label="Shorts" hint="3–5 per video">
            <div className="space-y-1.5">
              {shorts.map((s, i) => (
                <div key={i} className="flex items-start gap-2 border border-hair bg-paper px-2.5 py-2">
                  <Scissors className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/40" />
                  <div className="min-w-0 flex-1">
                    <input value={s.title || ""} onChange={(e) => { const n = [...shorts]; n[i] = { ...s, title: e.target.value }; set({ shorts: n }); }} onBlur={() => save({})} className="w-full bg-transparent text-[12.5px] font-medium outline-none" />
                    <p className="text-[11px] text-ink/50">{s.timestamp ? `${s.timestamp} · ` : ""}{s.hook}</p>
                    <p className="mono-label mt-0.5 text-[8px] text-ink/40">Related video → this video{s.channel_post_id ? " · in Shorts queue" : ""}</p>
                  </div>
                  <button type="button" onClick={() => save({ shorts: shorts.filter((_, j) => j !== i) })} className="text-ink/30 hover:text-[#b42318]"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <div className="flex gap-2">
                {shorts.length < 5 && <Btn variant="ghost" onClick={() => save({ shorts: [...shorts, { title: "New Short", hook: "", status: "idea" }] })}><Plus className="h-3.5 w-3.5" />Short</Btn>}
                {shorts.some((s) => !s.channel_post_id) && <Btn onClick={makeShorts}><Scissors className="h-3.5 w-3.5" />Add to Shorts queue</Btn>}
              </div>
            </div>
          </Field>

          <Field label="YouTube URL (after publishing)"><TextInput value={d.youtube_url} onChange={(v) => set({ youtube_url: v })} onBlur={() => save({})} placeholder="https://youtu.be/…" /></Field>
          <Field label="Notes"><TextArea rows={2} value={d.notes} onChange={(v) => set({ notes: v })} onBlur={() => save({})} /></Field>
          <button type="button" onClick={async () => { await yt.remove(id); qc.invalidateQueries({ queryKey: YT_KEY }); onClose(); }} className="text-[12px] text-ink/45 hover:text-[#b42318]"><Trash2 className="mr-1 inline h-3.5 w-3.5" />Delete video</button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
