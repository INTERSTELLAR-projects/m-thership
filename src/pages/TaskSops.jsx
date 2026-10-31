import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpRight, BookOpen, Check, Clock, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import TasksNav from "@/features/tasks/components/TasksNav";
import EmptyState from "@/features/tasks/ui-kit/EmptyState";
import RollButton from "@/features/tasks/ui-kit/RollButton";
import CategoryChip, { CategoryMix } from "@/features/tasks/ui-kit/CategoryChip";
import PriorityBadge from "@/features/tasks/ui-kit/PriorityBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, PRIORITIES, PROJECT_TYPES, categoryMeta, projectTypeMeta } from "@/features/tasks/lib/constants";
import { btnGhost, inputClass, selectContentClass, selectItemClass, selectTriggerClass } from "@/features/tasks/lib/ui";
import { itemsOf } from "@/features/tasks/lib/clients";
import { UNITS, fmtMinutes, itemMinutes, minutesToDays, splitMinutes, toMinutes, withEstimate } from "@/features/tasks/lib/estimate";
import { PACKAGES, packagePath } from "@/features/packages/registry";
import { cn } from "@/lib/utils";

/* SOP Library — list on the left, the whole SOP readable on the right.
   Steps are grouped by phase with full (wrapping) titles. "Edit" turns the same view into the editor,
   one roomy card per step, so long step names are never cut off. */

const pkgOf = (t) => PACKAGES.find((p) => p.service_keys.includes(t.service_key)) || null;
const groupOf = (t) => {
  const p = pkgOf(t);
  if (p) return p.kind === "recurring" ? "Subscriptions" : "Packages";
  if (t.service_key === "onboarding" || t.service_key === "closing") return "Sales & onboarding";
  return "Other";
};
const GROUP_ORDER = ["Sales & onboarding", "Packages", "Subscriptions", "Other"];

const toRow = (item) => {
  const { amount, unit } = item.estimate_amount != null && item.estimate_unit ? { amount: item.estimate_amount, unit: item.estimate_unit } : splitMinutes(itemMinutes(item));
  return { ...item, estimate_amount: amount, estimate_unit: unit };
};
const statsOf = (items) => {
  const totalMin = items.reduce((s, i) => s + itemMinutes(i), 0);
  const span = items.reduce((m, i) => Math.max(m, (Number(i.offset_days) || 0) + minutesToDays(itemMinutes(i))), 0);
  return { totalMin, span };
};
const byPhase = (items) => {
  const out = [];
  items.forEach((item, index) => {
    const key = item.phase || "Steps";
    const last = out[out.length - 1];
    if (last && last.phase === key) last.rows.push({ item, index });
    else out.push({ phase: key, rows: [{ item, index }] });
  });
  return out;
};

function Stat({ label, children }) {
  return (
    <div>
      <p className="mono-label text-[8.5px] text-ink/45">{label}</p>
      <p className="mt-1 flex items-baseline gap-1 text-[20px] font-semibold leading-none tracking-[-0.03em] text-ink">{children}</p>
    </div>
  );
}

/* ---------- read view ---------- */
function SopView({ template, onEdit, onDelete }) {
  const items = Array.isArray(template.items) ? template.items : [];
  const { totalMin, span } = statsOf(items);
  const pkg = pkgOf(template);
  let n = 0;
  return (
    <div className="overflow-hidden rounded-md border border-hair bg-card">
      <header className="border-b border-hair px-5 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label-cross text-[10.5px] text-ink/60">({projectTypeMeta(template.project_type).label}{template.sop_code ? " · " + template.sop_code : ""} · run {template.times_applied || 0}×)</p>
            <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-ink">{template.name}</h2>
            {template.description ? <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink/65">{template.description}</p> : null}
            {pkg ? (
              <Link to={packagePath(pkg.key)} className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-[#ff3c00] hover:underline">
                <pkg.icon className="h-3.5 w-3.5" /> Part of {pkg.label} — see what the client gets <ArrowUpRight className="h-3 w-3" />
              </Link>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onEdit} className={btnGhost}><Pencil className="h-3.5 w-3.5" /> Edit steps</button>
            <button type="button" onClick={onDelete} className={btnGhost + " hover:border-red-600/40 hover:text-red-700"} aria-label="Delete SOP"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div className="mt-4 grid max-w-xl grid-cols-3 gap-4">
          <Stat label="Steps">{items.length}</Stat>
          <Stat label="Your work"><Clock className="h-3.5 w-3.5 self-center text-[#ff3c00]" />{fmtMinutes(totalMin)}</Stat>
          <Stat label="Calendar span">{span ? Math.ceil(span) + "d" : "—"}</Stat>
        </div>
        <CategoryMix parts={items.map((i) => ({ category: i.category, minutes: itemMinutes(i) }))} className="mt-4" />
      </header>

      {items.length ? (
        <div className="divide-y divide-hair">
          {byPhase(items).map(({ phase, rows }) => {
            const phaseMin = rows.reduce((s, r) => s + itemMinutes(r.item), 0);
            return (
              <section key={phase + rows[0].index}>
                <div className="flex items-center justify-between bg-canvas/70 px-5 py-2 md:px-6">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/70">{phase}</p>
                  <p className="font-mono text-[11px] text-ink/50">{rows.length} step{rows.length === 1 ? "" : "s"} · {fmtMinutes(phaseMin)}</p>
                </div>
                <ol>
                  {rows.map(({ item }) => {
                    n += 1;
                    const min = itemMinutes(item);
                    return (
                      <li key={n} className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 border-t border-hair/60 px-5 py-3 first:border-t-0 md:grid-cols-[28px_minmax(0,1fr)_auto] md:px-6">
                        <span className="mono-label pt-[3px] text-[10px] text-ink/35">{String(n).padStart(2, "0")}</span>
                        <div className="min-w-0">
                          <p className="text-[14px] leading-snug text-ink">{item.title}</p>
                          {item.notes ? <p className="mt-1 text-[12px] leading-relaxed text-ink/55">{item.notes}</p> : null}
                        </div>
                        <div className="col-start-2 mt-2 flex flex-wrap items-center gap-2 md:col-start-3 md:mt-0 md:justify-end">
                          <CategoryChip value={item.category} />
                          <PriorityBadge value={item.priority} compact />
                          <span className="font-mono text-[10.5px] text-ink/45" title="Starts this many working days after kickoff">day +{Number(item.offset_days) || 0}</span>
                          <span className={cn("w-14 text-right font-mono text-[12.5px] font-semibold tabular-nums", min ? "text-ink" : "text-ink/30")}>{fmtMinutes(min)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="px-6 py-10 text-center text-[12.5px] text-ink/45">No steps yet. Click Edit steps to add them.</p>
      )}
    </div>
  );
}

/* ---------- edit view (also used for a new SOP) ---------- */
function SopEditor({ initial, onCancel, onSaved }) {
  const [form, setForm] = useState(() => ({
    name: "", project_type: "website", description: "",
    ...(initial || {}),
    items: (Array.isArray(initial && initial.items) ? initial.items : []).map(toRow),
  }));
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setItem = (i, k, v) => setForm((p) => ({ ...p, items: p.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) }));
  const removeItem = (i) => setForm((p) => ({ ...p, items: p.items.filter((_, j) => j !== i) }));
  const move = (i, dir) => setForm((p) => {
    const items = [...p.items]; const j = i + dir;
    if (j < 0 || j >= items.length) return p;
    [items[i], items[j]] = [items[j], items[i]];
    return { ...p, items };
  });
  const addItem = (afterIndex = null) => setForm((p) => {
    const ref = afterIndex == null ? p.items[p.items.length - 1] : p.items[afterIndex];
    const row = { title: "", category: ref ? ref.category : "development", priority: 3, estimate_amount: 30, estimate_unit: "min", offset_days: ref ? Number(ref.offset_days) || 0 : 0, phase: ref ? ref.phase : "" };
    const items = [...p.items];
    items.splice(afterIndex == null ? items.length : afterIndex + 1, 0, row);
    return { ...p, items };
  });

  const draft = async () => {
    setDrafting(true); setError("");
    try {
      const r = await base44.functions.invoke("suggest-checklist", { project_type: form.project_type, project_title: form.name || "Standard delivery", count: 10 });
      const items = Array.isArray(r && r.data && r.data.items) ? r.data.items : [];
      if (!items.length) setError("The core could not draft that SOP.");
      else set("items", items.map(toRow));
    } catch { setError("The core could not draft that SOP right now."); }
    finally { setDrafting(false); }
  };

  const save = async () => {
    if (!form.name.trim()) { setError("Name the SOP."); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      project_type: form.project_type,
      description: form.description || null,
      items: form.items.filter((it) => it.title && it.title.trim()).map((it) =>
        withEstimate({
          title: it.title.trim(), category: it.category || "ops", priority: Number(it.priority) || 3,
          offset_days: Number(it.offset_days) || 0, phase: it.phase || undefined, notes: it.notes || undefined,
        }, it.estimate_amount, it.estimate_unit)
      ),
    };
    try {
      let saved;
      if (initial && initial.id) saved = await base44.entities.TaskTemplate.update(initial.id, payload);
      else saved = await base44.entities.TaskTemplate.create(payload);
      onSaved(saved && saved.id ? saved.id : initial && initial.id);
    } catch { setError("Could not save that SOP."); setSaving(false); }
  };

  const mins = (it) => toMinutes(it.estimate_amount, it.estimate_unit);
  const totalMin = form.items.reduce((s, it) => s + mins(it), 0);
  const span = form.items.reduce((m, it) => Math.max(m, (Number(it.offset_days) || 0) + mins(it) / 480), 0);
  const phases = [...new Set(form.items.map((it) => it.phase).filter(Boolean))];

  return (
    <div className="overflow-hidden rounded-md border border-[#ff3c00]/40 bg-card">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-hair bg-card/95 px-5 py-3 backdrop-blur md:px-6">
        <div className="flex items-center gap-5">
          <p className="label-cross text-[10.5px] text-ink/60">({initial && initial.id ? "Editing" : "New SOP"})</p>
          <span className="font-mono text-[11.5px] text-ink/70">{form.items.length} steps · <span className="text-ink">{fmtMinutes(totalMin)}</span> work · {span ? Math.ceil(span) + "d span" : "—"}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={draft} disabled={drafting} className={btnGhost}><Sparkles className="h-3.5 w-3.5 text-[#ff3c00]" />{drafting ? "Drafting..." : "Draft with AI"}</button>
          <button type="button" onClick={onCancel} className={btnGhost}><X className="h-3.5 w-3.5" /> Cancel</button>
          <RollButton label={saving ? "Saving..." : "Save SOP"} icon={Check} onClick={save} disabled={saving} />
        </div>
      </header>

      <div className="space-y-5 px-5 py-5 md:px-6">
        {error ? <p className="text-[12px] text-amber-700">{error}</p> : null}
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
          <label className="block">
            <span className="mono-label text-[9.5px] text-ink/50">SOP name</span>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Website build" className={inputClass + " mt-1 h-10 text-[14px]"} />
          </label>
          <label className="block">
            <span className="mono-label text-[9.5px] text-ink/50">Applies to</span>
            <Select value={form.project_type} onValueChange={(v) => set("project_type", v)}>
              <SelectTrigger className={selectTriggerClass + " mt-1 h-10"}><SelectValue /></SelectTrigger>
              <SelectContent className={selectContentClass}>
                {PROJECT_TYPES.map((t) => <SelectItem key={t.value} className={selectItemClass} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
        </div>
        <label className="block">
          <span className="mono-label text-[9.5px] text-ink/50">Description</span>
          <textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="How this work ships end to end"
            className="mt-1 w-full resize-y rounded-md border border-hair bg-card px-3 py-2 text-[13px] leading-relaxed text-ink outline-none focus:border-[#ff3c00]" />
        </label>
        {totalMin ? <CategoryMix parts={form.items.map((it) => ({ category: it.category, minutes: mins(it) }))} /> : null}

        <datalist id="sop-phases">{phases.map((p) => <option key={p} value={p} />)}</datalist>

        <ol className="space-y-2.5">
          {form.items.map((it, i) => {
            const cat = categoryMeta(it.category);
            return (
              <li key={i} className="rounded-md border border-hair bg-canvas/40 p-3" style={{ borderLeft: "4px solid " + cat.color }}>
                <div className="flex items-start gap-3">
                  <span className="mono-label pt-2.5 text-[10px] text-ink/40">{String(i + 1).padStart(2, "0")}</span>
                  <textarea
                    value={it.title || ""}
                    onChange={(e) => setItem(i, "title", e.target.value)}
                    rows={Math.max(1, Math.ceil((it.title || "").length / 90))}
                    placeholder="What gets done in this step"
                    className="min-w-0 flex-1 resize-none rounded-md border border-hair bg-card px-3 py-2 text-[14px] leading-snug text-ink outline-none focus:border-[#ff3c00]"
                  />
                  <div className="flex shrink-0 flex-col items-center">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-sm p-1 text-ink/35 hover:text-ink disabled:opacity-20" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === form.items.length - 1} className="rounded-sm p-1 text-ink/35 hover:text-ink disabled:opacity-20" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2 pl-8 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.2fr)_150px_120px_170px_110px_auto]">
                  <label className="col-span-2 block sm:col-span-3 lg:col-span-1">
                    <span className="mono-label text-[8.5px] text-ink/45">Phase</span>
                    <input list="sop-phases" value={it.phase || ""} onChange={(e) => setItem(i, "phase", e.target.value)} placeholder="e.g. Build" className={inputClass + " mt-1"} />
                  </label>
                  <label className="block">
                    <span className="mono-label text-[8.5px] text-ink/45">Category</span>
                    <Select value={it.category || "ops"} onValueChange={(v) => setItem(i, "category", v)}>
                      <SelectTrigger className={selectTriggerClass + " mt-1 font-medium"}><SelectValue /></SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} className={selectItemClass} value={c.value}>
                            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-[2px]" style={{ background: c.color }} />{c.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="block">
                    <span className="mono-label text-[8.5px] text-ink/45">Priority</span>
                    <Select value={String(it.priority || 3)} onValueChange={(v) => setItem(i, "priority", Number(v))}>
                      <SelectTrigger className={selectTriggerClass + " mt-1"}><SelectValue /></SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        {PRIORITIES.map((p) => <SelectItem key={p.value} className={selectItemClass} value={String(p.value)}>{p.label} · {p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="block">
                    <span className="mono-label text-[8.5px] text-ink/45">How long it takes you</span>
                    <div className="mt-1 flex items-center gap-1">
                      <input type="number" step="0.25" min="0" value={it.estimate_amount ?? ""} onChange={(e) => setItem(i, "estimate_amount", e.target.value)} className={inputClass + " w-[70px] px-2 text-right font-mono"} />
                      <Select value={it.estimate_unit || "h"} onValueChange={(v) => setItem(i, "estimate_unit", v)}>
                        <SelectTrigger className={selectTriggerClass + " px-2"}><SelectValue /></SelectTrigger>
                        <SelectContent className={selectContentClass}>{UNITS.map((u) => <SelectItem key={u.value} className={selectItemClass} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </label>
                  <label className="block">
                    <span className="mono-label text-[8.5px] text-ink/45" title="Working days after kickoff">Starts day</span>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="font-mono text-[10px] text-ink/40">+</span>
                      <input type="number" step="1" min="0" value={it.offset_days ?? ""} onChange={(e) => setItem(i, "offset_days", e.target.value)} className={inputClass + " px-2 text-right font-mono"} />
                    </div>
                  </label>
                  <div className="flex items-end justify-end gap-1">
                    <button type="button" onClick={() => addItem(i)} className="rounded-sm p-2 text-ink/40 hover:text-ink" title="Add a step below"><Plus className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => removeItem(i)} className="rounded-sm p-2 text-ink/40 hover:text-red-600" title="Remove step"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <div className="mt-2 pl-8">
                  <input value={it.notes || ""} onChange={(e) => setItem(i, "notes", e.target.value)} placeholder="Notes for this step (optional)" className={inputClass + " h-8 text-[12px]"} />
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => addItem()} className={btnGhost}><Plus className="h-3.5 w-3.5" /> Add step</button>
          <p className="text-[10.5px] text-ink/45">Days are 8 working hours · weeks 5 days · months 4 weeks. "Starts day" is working days after kickoff.</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- page ---------- */
export default function TaskSops() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState("view"); // view | edit | new
  const [q, setQ] = useState("");

  const load = useCallback(async (focusId) => {
    setLoading(true);
    try {
      const page = await base44.entities.TaskTemplate.list({ sort: "sort_order", limit: 100 });
      const rows = itemsOf(page).sort((a, b) => (a.sort_order || 100) - (b.sort_order || 100));
      setTemplates(rows);
      const linked = new URLSearchParams(window.location.search).get("sop");
      setSelectedId((cur) => focusId || cur || (linked && rows.some((r) => r.id === linked) ? linked : null) || (rows[0] && rows[0].id) || null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const selected = templates.find((t) => t.id === selectedId) || null;
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = templates.filter((t) => !needle || (t.name || "").toLowerCase().includes(needle) || (t.items || []).some((i) => (i.title || "").toLowerCase().includes(needle)));
    return GROUP_ORDER.map((g) => ({ name: g, rows: list.filter((t) => groupOf(t) === g) })).filter((g) => g.rows.length);
  }, [templates, q]);

  const pick = (id) => { setSelectedId(id); setMode("view"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const remove = async (t) => {
    if (!window.confirm(`Delete the SOP "${t.name}"? Projects already started from it keep their tasks.`)) return;
    setTemplates((p) => p.filter((r) => r.id !== t.id));
    setSelectedId(null);
    await base44.entities.TaskTemplate.delete(t.id);
  };

  return (
    <div className="min-h-screen pb-24">
      <PageHeader breadcrumb="Command / Tasks" title="SOP Library" rightText={templates.length + " procedures"}>
        <RollButton label="New SOP" icon={Plus} onClick={() => { setMode("new"); setSelectedId(null); }} />
      </PageHeader>
      <TasksNav />

      <div className="px-5 py-6 md:px-8">
        {loading && !templates.length ? (
          <p className="py-16 text-center text-[12.5px] text-ink/45">Reading the library...</p>
        ) : templates.length || mode === "new" ? (
          <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            {/* list */}
            <aside className="lg:sticky lg:top-4 lg:self-start">
              <div className="overflow-hidden rounded-md border border-hair bg-card">
                <div className="border-b border-hair p-2.5">
                  <div className="flex items-center gap-2 rounded-md border border-hair bg-canvas/60 px-2.5">
                    <Search className="h-3.5 w-3.5 text-ink/40" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an SOP or step" className="h-8 w-full bg-transparent text-[12.5px] outline-none placeholder:text-ink/35" />
                  </div>
                </div>
                <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                  {groups.map((g) => (
                    <div key={g.name}>
                      <p className="mono-label bg-canvas/70 px-3 py-1.5 text-[8.5px] text-ink/50">{g.name}</p>
                      {g.rows.map((t) => {
                        const items = Array.isArray(t.items) ? t.items : [];
                        const { totalMin } = statsOf(items);
                        const pkg = pkgOf(t);
                        const active = t.id === selectedId && mode !== "new";
                        return (
                          <button key={t.id} type="button" onClick={() => pick(t.id)}
                            className={cn("flex w-full items-center gap-2.5 border-l-[3px] px-3 py-2.5 text-left transition-colors", active ? "border-[#ff3c00] bg-[#ff3c00]/[0.06]" : "border-transparent hover:bg-ink/[0.03]")}>
                            {pkg ? <pkg.icon className="h-3.5 w-3.5 shrink-0" style={{ color: pkg.color }} /> : <BookOpen className="h-3.5 w-3.5 shrink-0 text-ink/40" />}
                            <span className="min-w-0 flex-1">
                              <span className={cn("block truncate text-[13px]", active ? "font-semibold text-ink" : "text-ink/85")}>{t.name}</span>
                              <span className="block font-mono text-[10.5px] text-ink/45">{items.length} steps · {fmtMinutes(totalMin)}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  {!groups.length ? <p className="px-3 py-6 text-center text-[12px] text-ink/45">Nothing matches.</p> : null}
                </div>
              </div>
            </aside>

            {/* detail */}
            <main className="min-w-0">
              {mode === "new" ? (
                <SopEditor key="new" initial={null} onCancel={() => setMode("view")} onSaved={(id) => { setMode("view"); load(id); }} />
              ) : selected ? (
                mode === "edit" ? (
                  <SopEditor key={selected.id + "-edit"} initial={selected} onCancel={() => setMode("view")} onSaved={(id) => { setMode("view"); load(id); }} />
                ) : (
                  <SopView template={selected} onEdit={() => setMode("edit")} onDelete={() => remove(selected)} />
                )
              ) : (
                <p className="rounded-md border border-dashed border-hair px-6 py-16 text-center text-[12.5px] text-ink/45">Pick an SOP on the left.</p>
              )}
            </main>
          </div>
        ) : (
          <EmptyState icon={BookOpen} title="No SOPs yet" hint="Build one by hand, or let the core draft the standard delivery plan for you."
            action={<RollButton label="Draft an SOP" icon={Plus} onClick={() => setMode("new")} />} />
        )}
      </div>
    </div>
  );
}
