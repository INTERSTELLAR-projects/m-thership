import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Check, Clock, Plus, Sparkles, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Field from "@/features/tasks/ui-kit/Field";
import RollButton from "@/features/tasks/ui-kit/RollButton";
import { CategoryMix } from "@/features/tasks/ui-kit/CategoryChip";
import { CATEGORIES, PRIORITIES, PROJECT_TYPES, categoryMeta } from "@/features/tasks/lib/constants";
import { btnGhost, dialogClass, inputClass, selectContentClass, selectItemClass, selectTriggerClass, textareaClass } from "@/features/tasks/lib/ui";
import { UNITS, fmtMinutes, itemMinutes, splitMinutes, toMinutes, withEstimate } from "@/features/tasks/lib/estimate";

const EMPTY = { name: "", project_type: "website", description: "", items: [] };

// Editor rows carry amount + unit; everything else is derived on save.
const toRow = (item) => {
  const { amount, unit } = item.estimate_amount != null && item.estimate_unit ? { amount: item.estimate_amount, unit: item.estimate_unit } : splitMinutes(itemMinutes(item));
  return { ...item, estimate_amount: amount, estimate_unit: unit };
};

export default function SopFormDialog({ open, onOpenChange, onSaved, initial = null }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(initial ? { ...EMPTY, ...initial, items: (Array.isArray(initial.items) ? initial.items : []).map(toRow) } : EMPTY);
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setItem = (index, key, value) => setForm((prev) => ({ ...prev, items: prev.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)) }));
  const removeItem = (index) => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  const move = (index, dir) =>
    setForm((prev) => {
      const items = [...prev.items];
      const j = index + dir;
      if (j < 0 || j >= items.length) return prev;
      [items[index], items[j]] = [items[j], items[index]];
      return { ...prev, items };
    });
  const addItem = () =>
    setForm((prev) => {
      const last = prev.items[prev.items.length - 1];
      const nextStart = last ? (Number(last.offset_days) || 0) + Math.max(1, Math.ceil(toMinutes(last.estimate_amount, last.estimate_unit) / 480)) : 0;
      return { ...prev, items: [...prev.items, { title: "", category: "development", priority: 3, estimate_amount: 2, estimate_unit: "h", offset_days: nextStart }] };
    });

  const draft = async () => {
    setDrafting(true);
    setError("");
    try {
      const response = await base44.functions.invoke("suggest-checklist", { project_type: form.project_type, project_title: form.name || "Standard delivery", count: 10 });
      const data = (response && response.data) || {};
      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) setError("The core could not draft that SOP.");
      else set("items", items.map(toRow));
    } catch (err) {
      setError("The core could not draft that SOP right now.");
    } finally {
      setDrafting(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError("Name the SOP.");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      project_type: form.project_type,
      description: form.description || null,
      items: form.items
        .filter((item) => item.title && item.title.trim())
        .map((item) =>
          withEstimate(
            {
              title: item.title.trim(),
              category: item.category || "ops",
              priority: Number(item.priority) || 3,
              offset_days: Number(item.offset_days) || 0,
              phase: item.phase || undefined,
              notes: item.notes || undefined
            },
            item.estimate_amount,
            item.estimate_unit
          )
        )
    };
    try {
      if (initial && initial.id) await base44.entities.TaskTemplate.update(initial.id, payload);
      else await base44.entities.TaskTemplate.create(payload);
      onOpenChange(false);
      if (onSaved) onSaved();
    } catch (err) {
      setError("Could not save that SOP.");
    } finally {
      setSaving(false);
    }
  };

  const minutesOf = (item) => toMinutes(item.estimate_amount, item.estimate_unit);
  const totalMin = form.items.reduce((sum, item) => sum + minutesOf(item), 0);
  const span = form.items.reduce((m, item) => Math.max(m, (Number(item.offset_days) || 0) + minutesOf(item) / 480), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogClass + " sm:max-w-3xl"}>
        <DialogHeader>
          <p className="label-cross text-[10.5px] text-ink/60">(SOP)</p>
          <DialogTitle className="text-[20px] font-semibold tracking-[-0.03em] text-ink">{initial && initial.id ? "Edit SOP" : "New SOP"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="SOP name">
              <input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Website build" className={inputClass} />
            </Field>
            <Field label="Applies to">
              <Select value={form.project_type} onValueChange={(v) => set("project_type", v)}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {PROJECT_TYPES.map((type) => (
                    <SelectItem key={type.value} className={selectItemClass} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Description">
            <textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} className={textareaClass} placeholder="How this work ships end to end" />
          </Field>

          {/* Totals strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-hair bg-card px-3 py-2.5">
            <div className="flex items-center gap-5">
              <div>
                <p className="mono-label text-[8.5px] text-ink/45">Steps</p>
                <p className="text-[16px] font-semibold leading-none tracking-[-0.03em]">{form.items.length}</p>
              </div>
              <div>
                <p className="mono-label text-[8.5px] text-ink/45">Hands-on work</p>
                <p className="flex items-center gap-1 text-[16px] font-semibold leading-none tracking-[-0.03em]">
                  <Clock className="h-3 w-3 text-[#ff3c00]" />
                  {fmtMinutes(totalMin)}
                  {totalMin >= 480 ? <span className="text-[10px] font-normal text-ink/45">· {Math.round(totalMin / 60)}h</span> : null}
                </p>
              </div>
              <div>
                <p className="mono-label text-[8.5px] text-ink/45">Calendar span</p>
                <p className="text-[16px] font-semibold leading-none tracking-[-0.03em]">{span ? Math.ceil(span) + "d" : "—"}</p>
              </div>
            </div>
            <button type="button" onClick={draft} disabled={drafting} className={btnGhost}>
              <Sparkles className="h-3.5 w-3.5 text-[#ff3c00]" />
              {drafting ? "Drafting..." : "Draft with AI"}
            </button>
          </div>
          {totalMin ? <CategoryMix parts={form.items.map((i) => ({ category: i.category, minutes: minutesOf(i) }))} /> : null}

          {/* Column headings */}
          {form.items.length ? (
            <div className="hidden grid-cols-[22px_minmax(0,1fr)_132px_76px_150px_84px_58px] items-end gap-2 px-1 sm:grid">
              <span />
              <p className="mono-label text-[8.5px] text-ink/45">Step</p>
              <p className="mono-label text-[8.5px] text-ink/45">Category</p>
              <p className="mono-label text-[8.5px] text-ink/45">Priority</p>
              <p className="mono-label text-[8.5px] text-ink/45">How long it takes you</p>
              <p className="mono-label text-[8.5px] text-ink/45" title="Working days after kickoff when this step starts">Starts day</p>
              <span />
            </div>
          ) : null}

          <div className="max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
            {form.items.map((item, index) => {
              const cat = categoryMeta(item.category);
              return (
                <div key={index} className="rounded-md border border-hair bg-card p-2" style={{ borderLeft: "3px solid " + cat.color }}>
                  <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[22px_minmax(0,1fr)_132px_76px_150px_84px_58px]">
                    <span className="mono-label text-[9px] text-ink/35">{String(index + 1).padStart(2, "0")}</span>
                    <input value={item.title || ""} onChange={(e) => setItem(index, "title", e.target.value)} placeholder="Step title" className={inputClass} />

                    <Select value={item.category || "ops"} onValueChange={(v) => setItem(index, "category", v)}>
                      <SelectTrigger className={selectTriggerClass + " font-medium"} style={{ color: cat.color === "#ffaa00" ? "#1a1a1a" : cat.color }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category.value} className={selectItemClass} value={category.value}>
                            <span className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-[2px]" style={{ background: category.color }} />
                              {category.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={String(item.priority || 3)} onValueChange={(v) => setItem(index, "priority", Number(v))}>
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        {PRIORITIES.map((priority) => (
                          <SelectItem key={priority.value} className={selectItemClass} value={String(priority.value)}>
                            {priority.label} · {priority.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={item.estimate_amount ?? ""}
                        onChange={(e) => setItem(index, "estimate_amount", e.target.value)}
                        placeholder="0"
                        className={inputClass + " w-[62px] px-2 text-right font-mono"}
                      />
                      <Select value={item.estimate_unit || "h"} onValueChange={(v) => setItem(index, "estimate_unit", v)}>
                        <SelectTrigger className={selectTriggerClass + " px-2"}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={selectContentClass}>
                          {UNITS.map((u) => (
                            <SelectItem key={u.value} className={selectItemClass} value={u.value}>
                              {u.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[10px] text-ink/40">+</span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={item.offset_days ?? ""}
                        onChange={(e) => setItem(index, "offset_days", e.target.value)}
                        placeholder="0"
                        title="Working days after kickoff when this step starts"
                        className={inputClass + " px-2 text-right font-mono"}
                      />
                      <span className="font-mono text-[10px] text-ink/40">d</span>
                    </div>

                    <div className="flex items-center justify-end">
                      <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded-sm p-1 text-ink/35 hover:text-ink disabled:opacity-20" aria-label="Move up">
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => move(index, 1)} disabled={index === form.items.length - 1} className="rounded-sm p-1 text-ink/35 hover:text-ink disabled:opacity-20" aria-label="Move down">
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => removeItem(index)} className="rounded-sm p-1 text-ink/35 hover:text-red-600" aria-label="Remove step">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <button type="button" onClick={addItem} className={btnGhost}>
              <Plus className="h-3.5 w-3.5" />
              Add step
            </button>
            <p className="text-[10.5px] text-ink/45">Days are 8 working hours · weeks 5 days · months 4 weeks. "Starts day" is working days after kickoff.</p>
          </div>

          {error ? <p className="text-[12px] text-amber-700">{error}</p> : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={() => onOpenChange(false)} className={btnGhost}>
              Cancel
            </button>
            <RollButton label={saving ? "Saving..." : "Save SOP"} icon={Check} onClick={save} disabled={saving} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
