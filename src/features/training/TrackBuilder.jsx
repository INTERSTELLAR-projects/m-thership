// Track builder: owners edit everything (track settings, module order, lessons, embeds, linked SOPs, checklist, quiz,
// gaps) and review the Spanish version before trainees can switch to it.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, BookOpenCheck, Check, Eye, Image as ImageIcon, Languages, Loader2, Plus, Quote, RefreshCw, Save, Trash2, UserPlus, Video, X,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import Lesson from "./Lesson";
import { Button, Chip, ConfirmButton, Field, Notice, inputCls } from "./ui";
import { errText } from "./api";

const STATUS_OPTS = [["draft", "Draft"], ["needs_sops", "Needs SOPs"], ["published", "Published"], ["archived", "Archived"]];

export default function TrackBuilder({ trackId, call, scopeKey, portal, onBack, onPreview, onAssign, onRebuild, roles }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useQuery({ queryKey: ["training", scopeKey, "track", trackId], queryFn: () => call("track", { track_id: trackId }) });
  const refresh = async () => { await qc.invalidateQueries({ queryKey: ["training", scopeKey] }); };
  const [sel, setSel] = useState(null);
  const track = q.data?.track;
  const modules = useMemo(() => q.data?.modules || [], [q.data]);
  useEffect(() => { if (!sel && modules[0]) setSel(modules[0].id); }, [modules, sel]);

  if (q.isLoading) return <p className="flex items-center gap-2 py-16 text-[13px] text-ink/50"><Loader2 className="h-4 w-4 animate-spin" />Loading the track…</p>;
  if (q.isError || !track) return <Notice tone="error">{errText(q.error, "Couldn't load this track.")}</Notice>;

  const mod = modules.find((m) => m.id === sel) || modules[0];
  const saveTrack = async (patch, msg) => {
    try { await call("save_track", { track: { id: track.id, ...patch } }); if (msg) toast({ title: msg }); await refresh(); } catch (e) { toast({ title: "Couldn't save", description: errText(e), variant: "destructive" }); }
  };
  const move = async (i, d) => {
    const ids = modules.map((m) => m.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try { await call("reorder", { track_id: track.id, module_ids: ids }); await refresh(); } catch (e) { toast({ title: "Couldn't reorder", description: errText(e), variant: "destructive" }); }
  };
  const addModule = async () => {
    try { const r = await call("save_module", { module: { track_id: track.id, title: "New module", lesson_md: "", required: true } }); await refresh(); setSel(r.module.id); } catch (e) { toast({ title: "Couldn't add", description: errText(e), variant: "destructive" }); }
  };
  const gapsTotal = (track.gaps || []).length + modules.reduce((s, m) => s + (m.gaps || []).length, 0);
  const needs = modules.filter((m) => m.needs_sops).length;

  return (
    <div className="space-y-5" data-track-builder>
      <div className="flex flex-wrap items-center gap-2">
        <Button kind="quiet" icon={ArrowLeft} onClick={onBack} className="-ml-2">All tracks</Button>
        <span className="flex-1" />
        <Button icon={Eye} onClick={() => onPreview(track.id)} disabled={!modules.length}>Preview as trainee</Button>
        <Button icon={RefreshCw} onClick={() => onRebuild(track)}>Rebuild from SOPs</Button>
        <Button kind="flame" icon={UserPlus} onClick={() => onAssign(track.id)} disabled={!modules.length}>Assign</Button>
      </div>

      <TrackHeader track={track} roles={roles} onSave={saveTrack} modules={modules} gapsTotal={gapsTotal} needs={needs} portal={portal} />

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="border border-hair bg-card">
            <div className="flex items-center justify-between border-b border-hair px-3 py-2.5">
              <p className="mono-label text-[9.5px] text-ink/55">{modules.length} module{modules.length === 1 ? "" : "s"} · {modules.reduce((s, m) => s + (m.est_minutes || 0), 0)} min</p>
              <Button size="sm" kind="quiet" icon={Plus} onClick={addModule}>Add</Button>
            </div>
            <ol className="divide-y divide-hair">
              {modules.map((m, i) => (
                <li key={m.id} className={`group flex items-center gap-2 px-2 py-2 ${m.id === mod?.id ? "bg-paper" : ""}`}>
                  <button type="button" onClick={() => setSel(m.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center text-[11.5px] font-semibold ${m.id === mod?.id ? "flame-bg text-white" : "bg-ink/[0.07] text-ink/60"}`}>{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{m.title}</span>
                      <span className="flex flex-wrap items-center gap-1 pt-0.5">
                        {m.needs_sops && <Chip tone="amber">Needs SOPs</Chip>}
                        {(m.gaps || []).length > 0 && !m.needs_sops && <Chip tone="amber">{m.gaps.length} gap{m.gaps.length === 1 ? "" : "s"}</Chip>}
                        {m.es?.status === "approved" && <Chip tone="green">ES</Chip>}
                        {m.es?.status === "draft" && <Chip>ES draft</Chip>}
                        {!m.required && <Chip>Optional</Chip>}
                        {m.drafted && !m.reviewed && <Chip tone="soft">Review</Chip>}
                      </span>
                    </span>
                  </button>
                  <span className="flex flex-col opacity-60 group-hover:opacity-100">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 disabled:opacity-25" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === modules.length - 1} className="p-0.5 disabled:opacity-25" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <ConfirmButton icon={Trash2} confirmText="Yes, delete track" className="mt-2" onConfirm={async () => { try { await call("delete_track", { track_id: track.id }); await refresh(); onBack(); } catch (e) { toast({ title: "Couldn't delete", description: errText(e), variant: "destructive" }); } }}>Delete track</ConfirmButton>
        </aside>
        {mod ? <ModuleEditor key={mod.id + (mod.updated_date || "")} mod={mod} track={track} call={call} refresh={refresh} portal={portal} onDeleted={() => setSel(null)} /> : <Notice>Add a module to start.</Notice>}
      </div>
    </div>
  );
}

function TrackHeader({ track, roles, onSave, modules, gapsTotal, needs, portal }) {
  const [v, setV] = useState({ title: track.title, description: track.description || "", role_label: track.role_label || "", pass_score: track.pass_score ?? 80 });
  const dirty = v.title !== track.title || v.description !== (track.description || "") || v.role_label !== (track.role_label || "") || Number(v.pass_score) !== (track.pass_score ?? 80);
  const esCount = modules.filter((m) => m.es?.status === "approved").length;
  return (
    <section className="border border-hair bg-card">
      <div className="h-[3px] bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" />
      <div className="grid gap-5 p-4 md:p-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <input value={v.title} onChange={(e) => setV((s) => ({ ...s, title: e.target.value }))} className="w-full border-0 border-b border-transparent bg-transparent p-0 text-[26px] font-semibold tracking-[-0.035em] outline-none focus:border-[#ff3c00]" aria-label="Track title" />
          <textarea value={v.description} onChange={(e) => setV((s) => ({ ...s, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} placeholder="What this track covers, in one or two sentences trainees will read first." />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Role shown to trainees"><input value={v.role_label} onChange={(e) => setV((s) => ({ ...s, role_label: e.target.value }))} className={inputCls} placeholder={roles?.[track.role] || "Role"} /></Field>
            <Field label="Quiz pass mark (%)"><input type="number" min={0} max={100} value={v.pass_score} onChange={(e) => setV((s) => ({ ...s, pass_score: e.target.value }))} className={inputCls} /></Field>
            <Field label="Status">
              <select value={track.status} onChange={(e) => onSave({ status: e.target.value }, "Status updated")} className={inputCls}>
                {STATUS_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-[13px]"><input type="checkbox" checked={track.requires_signoff !== false} onChange={(e) => onSave({ requires_signoff: e.target.checked })} className="h-4 w-4 accent-[#ff3c00]" />Manager signs off at the end</label>
            <label className="inline-flex items-center gap-2 text-[13px]"><input type="checkbox" checked={!!track.es_enabled} onChange={(e) => onSave({ es_enabled: e.target.checked }, e.target.checked ? "Spanish toggle on for trainees" : "Spanish toggle off")} className="h-4 w-4 accent-[#ff3c00]" /><Languages className="h-3.5 w-3.5 text-ink/50" />EN / ES toggle for trainees <span className="text-ink/45">({esCount}/{modules.length} approved)</span></label>
            <span className="flex-1" />
            {dirty && <Button kind="ink" icon={Save} onClick={() => onSave({ ...v, pass_score: Number(v.pass_score) }, "Track saved")}>Save</Button>}
          </div>
        </div>
        <div className="space-y-3">
          {(gapsTotal > 0 || needs > 0) && (
            <div className="border border-amber-300/70 bg-amber-50 px-3 py-3">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-900"><AlertTriangle className="h-4 w-4" />{needs ? `${needs} module${needs === 1 ? "" : "s"} need SOPs · ` : ""}{gapsTotal} gap{gapsTotal === 1 ? "" : "s"} flagged</p>
              <p className="mt-1 text-[12px] leading-snug text-amber-900/80">These are things your SOPs don&apos;t say yet. Fill them in the lesson, or add the missing SOP and rebuild. Nothing was guessed.</p>
              {(track.gaps || []).length > 0 && <ul className="mt-2 space-y-1 text-[12px] text-amber-950/80">{track.gaps.map((g, i) => <li key={i} className="flex gap-1.5"><span className="mt-[7px] h-1 w-1 shrink-0 bg-amber-700" />{g}</li>)}</ul>}
            </div>
          )}
          {(track.source_refs || []).length > 0 && (
            <div>
              <p className="mono-label text-[9.5px] text-ink/50">Built from</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">{track.source_refs.map((r, i) => <span key={i} className="inline-flex items-center gap-1 border border-hair bg-paper px-2 py-1 text-[11.5px]"><BookOpenCheck className="h-3 w-3 text-[#ff3c00]" />{r.title}</span>)}</div>
            </div>
          )}
          {!portal && track.created_via && <p className="text-[11px] text-ink/40">Created in {track.created_via === "portal" ? "the client portal" : track.created_via === "seed" ? "the seed from Interstellar's SOPs" : "Møthership"}{track.drafted_at ? ` · drafted ${new Date(track.drafted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</p>}
        </div>
      </div>
    </section>
  );
}

function ModuleEditor({ mod, track, call, refresh, portal, onDeleted }) {
  const { toast } = useToast();
  const [tab, setTab] = useState("content");
  const [d, setD] = useState(() => ({
    title: mod.title || "", summary: mod.summary || "", lesson_md: mod.lesson_md || "", est_minutes: mod.est_minutes || 15, required: mod.required !== false,
    embeds: mod.embeds || [], sop_refs: mod.sop_refs || [], checklist: mod.checklist || [], quiz: mod.quiz || [], gaps: mod.gaps || [], needs_sops: !!mod.needs_sops,
  }));
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const set = (k, v) => setD((s) => ({ ...s, [k]: v }));
  const dirty = JSON.stringify(d) !== JSON.stringify({ title: mod.title || "", summary: mod.summary || "", lesson_md: mod.lesson_md || "", est_minutes: mod.est_minutes || 15, required: mod.required !== false, embeds: mod.embeds || [], sop_refs: mod.sop_refs || [], checklist: mod.checklist || [], quiz: mod.quiz || [], gaps: mod.gaps || [], needs_sops: !!mod.needs_sops });
  const save = async () => {
    setBusy(true);
    try { await call("save_module", { module: { id: mod.id, track_id: track.id, ...d } }); toast({ title: "Module saved" }); await refresh(); } catch (e) { toast({ title: "Couldn't save", description: errText(e), variant: "destructive" }); } finally { setBusy(false); }
  };
  const TABS = [["content", "Lesson"], ["checklist", `Hands-on (${d.checklist.length})`], ["quiz", `Quiz (${d.quiz.length})`], ["es", "Español"]];

  return (
    <section className="border border-hair bg-card" data-module-editor>
      <div className="flex flex-wrap items-center gap-2 border-b border-hair px-4 py-3">
        <div className="flex flex-wrap gap-1" role="tablist">
          {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`h-8 px-3 text-[12.5px] font-medium ${tab === k ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}>{l}</button>)}
        </div>
        <span className="flex-1" />
        {dirty && <span className="text-[11.5px] text-[#ff3c00]">Unsaved changes</span>}
        <Button kind={dirty ? "flame" : "ghost"} icon={Save} busy={busy} disabled={!dirty} onClick={save}>Save module</Button>
      </div>

      {tab === "content" && (
        <div className="space-y-4 p-4 md:p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <Field label="Module title"><input value={d.title} onChange={(e) => set("title", e.target.value)} className={inputCls} /></Field>
            <Field label="Minutes"><input type="number" min={1} max={240} value={d.est_minutes} onChange={(e) => set("est_minutes", Number(e.target.value) || 1)} className={inputCls} /></Field>
          </div>
          <Field label="Summary (one sentence)"><input value={d.summary} onChange={(e) => set("summary", e.target.value)} className={inputCls} /></Field>
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-[13px]"><input type="checkbox" checked={d.required} onChange={(e) => set("required", e.target.checked)} className="h-4 w-4 accent-[#ff3c00]" />Required to finish the track</label>
            <label className="inline-flex items-center gap-2 text-[13px]"><input type="checkbox" checked={d.needs_sops} onChange={(e) => set("needs_sops", e.target.checked)} className="h-4 w-4 accent-[#ff3c00]" />Still needs SOPs</label>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="mono-label text-[9.5px] text-ink/55">Lesson (markdown: **bold**, - lists, ## headings, &gt; notes)</span>
              <button type="button" onClick={() => setShowPreview((x) => !x)} className="text-[12px] font-medium text-[#ff3c00] hover:underline">{showPreview ? "Edit" : "Preview"}</button>
            </div>
            {showPreview ? <div className="mt-1.5 border border-hair bg-paper px-4 py-4"><Lesson md={d.lesson_md} embeds={d.embeds} /></div> : <textarea value={d.lesson_md} onChange={(e) => set("lesson_md", e.target.value)} rows={14} className={`${inputCls} mt-1.5 resize-y font-mono text-[12.5px] leading-relaxed`} />}
          </div>
          <Embeds list={d.embeds} onChange={(v) => set("embeds", v)} />
          <SopLinks list={d.sop_refs} onChange={(v) => set("sop_refs", v)} call={call} />
          <Gaps list={d.gaps} onChange={(v) => set("gaps", v)} />
          {!portal && (mod.sources || []).length > 0 && (
            <details className="border border-hair bg-paper px-3 py-2">
              <summary className="cursor-pointer text-[12.5px] font-medium">Where each lesson point came from ({mod.sources.length})</summary>
              <ul className="mt-2 space-y-2">{mod.sources.map((s, i) => <li key={i} className="text-[12px]"><p className="text-ink/80">{s.text}</p><p className="mt-0.5 flex gap-1 text-ink/50"><Quote className="mt-0.5 h-3 w-3 shrink-0" />“{s.quote}” · {s.source_title}</p></li>)}</ul>
            </details>
          )}
          <div className="border-t border-hair pt-3">
            <ConfirmButton icon={Trash2} confirmText="Yes, delete module" onConfirm={async () => { try { await call("delete_module", { module_id: mod.id }); await refresh(); onDeleted(); } catch (e) { toast({ title: "Couldn't delete", description: errText(e), variant: "destructive" }); } }}>Delete module</ConfirmButton>
          </div>
        </div>
      )}

      {tab === "checklist" && (
        <div className="space-y-3 p-4 md:p-5">
          <p className="text-[12.5px] text-ink/55">Hands-on tasks the trainee does for real and ticks off. Keep each one a single action.</p>
          {d.checklist.map((c, i) => (
            <div key={c.id || i} className="border border-hair bg-paper p-3">
              <div className="flex gap-2">
                <span className="mt-2 font-mono text-[11px] text-ink/40">{i + 1}</span>
                <textarea value={c.text} onChange={(e) => set("checklist", d.checklist.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} rows={2} className={`${inputCls} resize-none`} />
                <button type="button" onClick={() => set("checklist", d.checklist.filter((_, j) => j !== i))} className="h-9 w-9 shrink-0 text-ink/40 hover:text-red-700" aria-label="Remove task"><X className="mx-auto h-4 w-4" /></button>
              </div>
              {c.quote && <p className="ml-5 mt-1.5 flex gap-1 text-[11.5px] text-ink/50"><Quote className="mt-0.5 h-3 w-3 shrink-0" />“{c.quote}”{c.source_title ? ` · ${c.source_title}` : ""}</p>}
            </div>
          ))}
          <Button icon={Plus} onClick={() => set("checklist", [...d.checklist, { id: `c${Date.now().toString(36)}`, text: "" }])}>Add task</Button>
        </div>
      )}

      {tab === "quiz" && (
        <div className="space-y-3 p-4 md:p-5">
          <p className="text-[12.5px] text-ink/55">Quick check after the tasks. Trainees need {track.pass_score ?? 80}% to pass; pick the correct answer with the dot.</p>
          {d.quiz.map((q, i) => {
            const upd = (patch) => set("quiz", d.quiz.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={q.id || i} className="border border-hair bg-paper p-3">
                <div className="flex gap-2">
                  <span className="mt-2 font-mono text-[11px] text-[#ff3c00]">Q{i + 1}</span>
                  <input value={q.question} onChange={(e) => upd({ question: e.target.value })} className={inputCls} placeholder="Question" />
                  <button type="button" onClick={() => set("quiz", d.quiz.filter((_, j) => j !== i))} className="h-9 w-9 shrink-0 text-ink/40 hover:text-red-700" aria-label="Remove question"><X className="mx-auto h-4 w-4" /></button>
                </div>
                <div className="ml-7 mt-2 space-y-1.5">
                  {q.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input type="radio" name={`ans-${mod.id}-${i}`} checked={q.answer_index === oi} onChange={() => upd({ answer_index: oi })} className="h-4 w-4 accent-[#ff3c00]" aria-label={`Option ${oi + 1} is correct`} />
                      <input value={o} onChange={(e) => upd({ options: q.options.map((x, k) => (k === oi ? e.target.value : x)) })} className={`${inputCls} py-1.5 ${q.answer_index === oi ? "border-green-600/60" : ""}`} />
                      {q.options.length > 2 && <button type="button" onClick={() => upd({ options: q.options.filter((_, k) => k !== oi), answer_index: q.answer_index > oi ? q.answer_index - 1 : q.answer_index === oi ? 0 : q.answer_index })} className="text-ink/35 hover:text-red-700" aria-label="Remove option"><X className="h-3.5 w-3.5" /></button>}
                    </div>
                  ))}
                  {q.options.length < 4 && <button type="button" onClick={() => upd({ options: [...q.options, ""] })} className="text-[12px] font-medium text-[#ff3c00]">+ Option</button>}
                  <input value={q.explanation || ""} onChange={(e) => upd({ explanation: e.target.value })} className={`${inputCls} py-1.5 text-[12.5px]`} placeholder="Why it's right (shown after they answer)" />
                  {q.quote && <p className="flex gap-1 text-[11.5px] text-ink/50"><Quote className="mt-0.5 h-3 w-3 shrink-0" />“{q.quote}”{q.source_title ? ` · ${q.source_title}` : ""}</p>}
                </div>
              </div>
            );
          })}
          <Button icon={Plus} onClick={() => set("quiz", [...d.quiz, { id: `q${Date.now().toString(36)}`, question: "", options: ["", "", ""], answer_index: 0, explanation: "" }])}>Add question</Button>
        </div>
      )}

      {tab === "es" && <SpanishPanel mod={mod} call={call} refresh={refresh} portal={portal} dirty={dirty} />}
    </section>
  );
}

function Embeds({ list, onChange }) {
  return (
    <div>
      <span className="mono-label text-[9.5px] text-ink/55">Videos and images</span>
      <div className="mt-1.5 space-y-2">
        {list.map((e, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select value={e.type} onChange={(ev) => onChange(list.map((x, j) => (j === i ? { ...x, type: ev.target.value } : x)))} className={`${inputCls} w-[100px] py-1.5`}><option value="video">Video</option><option value="image">Image</option></select>
            <input value={e.url} onChange={(ev) => onChange(list.map((x, j) => (j === i ? { ...x, url: ev.target.value } : x)))} placeholder="https:// YouTube, Vimeo, Loom, .mp4 or image link" className={`${inputCls} min-w-[200px] flex-1 py-1.5`} />
            <input value={e.caption || ""} onChange={(ev) => onChange(list.map((x, j) => (j === i ? { ...x, caption: ev.target.value } : x)))} placeholder="Caption" className={`${inputCls} w-full py-1.5 sm:w-[180px]`} />
            <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className="text-ink/40 hover:text-red-700" aria-label="Remove"><X className="h-4 w-4" /></button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button size="sm" icon={Video} onClick={() => onChange([...list, { type: "video", url: "", caption: "" }])}>Add video</Button>
          <Button size="sm" icon={ImageIcon} onClick={() => onChange([...list, { type: "image", url: "", caption: "" }])}>Add image</Button>
        </div>
      </div>
    </div>
  );
}

function SopLinks({ list, onChange, call }) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState(null);
  useEffect(() => { if (open && !sources) call("sources").then((r) => setSources(r.sources || [])).catch(() => setSources([])); }, [open, sources, call]);
  const has = new Set(list.map((r) => `${r.type}:${r.id}`));
  return (
    <div>
      <span className="mono-label text-[9.5px] text-ink/55">Linked SOPs</span>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {list.map((r, i) => <span key={i} className="inline-flex items-center gap-1 border border-hair bg-paper px-2 py-1 text-[12px]"><BookOpenCheck className="h-3 w-3 text-[#ff3c00]" />{r.title}<button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className="text-ink/40 hover:text-red-700" aria-label="Unlink"><X className="h-3 w-3" /></button></span>)}
        <button type="button" onClick={() => setOpen((x) => !x)} className="inline-flex h-7 items-center gap-1 border border-dashed border-ink/25 px-2 text-[12px] text-ink/60 hover:border-ink/50"><Plus className="h-3 w-3" />Link an SOP</button>
      </div>
      {open && (
        <div className="mt-2 max-h-48 overflow-y-auto border border-hair bg-paper">
          {sources == null ? <p className="px-3 py-2 text-[12px] text-ink/50">Loading…</p> : sources.map((s) => {
            const [type, ...rest] = s.id.split(":");
            const key = `${type === "file" ? "client_file" : type}:${rest.join(":")}`;
            const on = has.has(key);
            return (
              <button key={s.id} type="button" disabled={on} onClick={() => onChange([...list, { type: type === "file" ? "client_file" : type, id: rest.join(":"), title: s.title }])} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] hover:bg-white disabled:opacity-40">
                {on ? <Check className="h-3.5 w-3.5 text-[#ff3c00]" /> : <Plus className="h-3.5 w-3.5 text-ink/40" />}{s.title}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Gaps({ list, onChange }) {
  if (!list.length) return null;
  return (
    <div className="border border-amber-300/70 bg-amber-50 px-3 py-3">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-900"><AlertTriangle className="h-3.5 w-3.5" />Missing from the SOPs</p>
      <ul className="mt-1.5 space-y-1">
        {list.map((g, i) => (
          <li key={i} className="flex items-start gap-2 text-[12.5px] text-amber-950/85">
            <span className="min-w-0 flex-1">{g}</span>
            <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className="shrink-0 text-[11.5px] font-medium text-amber-900 underline">Resolved</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SpanishPanel({ mod, call, refresh, portal, dirty }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState("");
  const [es, setEs] = useState(() => mod.es || null);
  const run = async (key, fn, msg) => {
    setBusy(key);
    try { const r = await fn(); if (r?.module?.es) setEs(r.module.es); if (msg) toast({ title: msg }); await refresh(); } catch (e) { toast({ title: "Couldn't do that", description: errText(e), variant: "destructive" }); } finally { setBusy(""); }
  };
  if (!es) {
    return (
      <div className="p-5">
        <p className="text-[14px] font-semibold">No Spanish version yet.</p>
        <p className="mt-1 max-w-lg text-[12.5px] text-ink/55">{portal ? "Draft a Spanish version of this module. You review and approve it before any trainee sees it." : "AI-translates this module (ai-gateway, Haiku, metered). The owner reviews and approves before trainees can switch to it."}</p>
        {dirty && <Notice tone="warn" className="mt-3">Save the module first so the Spanish version matches it.</Notice>}
        <Button className="mt-4" kind="flame" icon={Languages} busy={busy === "tr"} disabled={dirty} onClick={() => run("tr", () => call("translate", { module_id: mod.id }), "Spanish draft ready for review")}>Draft Spanish version</Button>
      </div>
    );
  }
  const upd = (patch) => setEs((s) => ({ ...s, ...patch }));
  return (
    <div className="space-y-4 p-4 md:p-5" data-spanish-review>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={es.status === "approved" ? "green" : "amber"}>{es.status === "approved" ? "Approved · trainees can switch to ES" : "Draft · waiting for your review"}</Chip>
        {es.stale && <Chip tone="amber">English changed since this draft</Chip>}
        <span className="flex-1" />
        <Button size="sm" icon={RefreshCw} busy={busy === "tr"} disabled={dirty} onClick={() => run("tr", () => call("translate", { module_id: mod.id }), "New Spanish draft")}>Redraft</Button>
        {es.status === "approved"
          ? <Button size="sm" busy={busy === "un"} onClick={() => run("un", () => call("approve_es", { module_id: mod.id, unapprove: true }), "Back to draft")}>Back to draft</Button>
          : <Button size="sm" kind="flame" icon={Check} busy={busy === "ok"} onClick={() => run("ok", () => call("approve_es", { module_id: mod.id, es }), "Spanish approved")}>Approve Spanish</Button>}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Field label="Título"><input value={es.title} onChange={(e) => upd({ title: e.target.value })} className={inputCls} /></Field>
          <Field label="Resumen"><input value={es.summary || ""} onChange={(e) => upd({ summary: e.target.value })} className={inputCls} /></Field>
          <Field label="Lección"><textarea value={es.lesson_md} onChange={(e) => upd({ lesson_md: e.target.value })} rows={12} className={`${inputCls} resize-y font-mono text-[12.5px]`} /></Field>
        </div>
        <div className="space-y-3">
          <p className="mono-label text-[9.5px] text-ink/55">Práctica</p>
          {(es.checklist || []).map((c, i) => (
            <div key={c.id}>
              <p className="text-[11px] text-ink/40">{mod.checklist?.[i]?.text}</p>
              <input value={c.text} onChange={(e) => upd({ checklist: es.checklist.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} className={`${inputCls} py-1.5`} />
            </div>
          ))}
          <p className="mono-label pt-2 text-[9.5px] text-ink/55">Repaso</p>
          {(es.quiz || []).map((q, i) => (
            <div key={q.id} className="space-y-1 border border-hair bg-paper p-2">
              <input value={q.question} onChange={(e) => upd({ quiz: es.quiz.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)) })} className={`${inputCls} py-1.5`} />
              {q.options.map((o, oi) => (
                <input key={oi} value={o} onChange={(e) => upd({ quiz: es.quiz.map((x, j) => (j === i ? { ...x, options: x.options.map((y, k) => (k === oi ? e.target.value : y)) } : x)) })} className={`${inputCls} py-1 text-[12.5px] ${mod.quiz?.[i]?.answer_index === oi ? "border-green-600/60" : ""}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
