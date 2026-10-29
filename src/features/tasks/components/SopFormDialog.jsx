import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Plus, Sparkles, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Field from "@/features/tasks/ui-kit/Field";
import RollButton from "@/features/tasks/ui-kit/RollButton";
import { CATEGORIES, PRIORITIES, PROJECT_TYPES } from "@/features/tasks/lib/constants";
import {
  btnGhost,
  dialogClass,
  inputClass,
  selectContentClass,
  selectItemClass,
  selectTriggerClass,
  textareaClass
} from "@/features/tasks/lib/ui";
import { days } from "@/features/tasks/lib/format";

const EMPTY = { name: "", project_type: "website", description: "", items: [] };

export default function SopFormDialog({ open, onOpenChange, onSaved, initial = null }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(initial ? { ...EMPTY, ...initial, items: Array.isArray(initial.items) ? initial.items : [] } : EMPTY);
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const setItem = (index, key, value) =>
    setForm((prev) => ({ ...prev, items: prev.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)) }));

  const addItem = () =>
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { title: "", category: "development", priority: 3, estimated_days: 1, offset_days: prev.items.length * 2 }]
    }));

  const removeItem = (index) => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

  const draft = async () => {
    setDrafting(true);
    setError("");
    try {
      const response = await base44.functions.invoke("suggest-checklist", {
        project_type: form.project_type,
        project_title: form.name || "Standard delivery",
        count: 10
      });
      const data = (response && response.data) || {};
      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) setError("The core could not draft that SOP.");
      else set("items", items);
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
        .map((item) => ({
          title: item.title.trim(),
          category: item.category || "ops",
          priority: Number(item.priority) || 3,
          estimated_days: Number(item.estimated_days) || 0,
          offset_days: Number(item.offset_days) || 0
        }))
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

  const totalDays = form.items.reduce((sum, item) => sum + (Number(item.estimated_days) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <p className="label-cross text-[10.5px] text-ink/60">(SOP)</p>
          <DialogTitle className="text-[20px] font-semibold tracking-[-0.03em] text-ink">{initial && initial.id ? "Edit SOP" : "New SOP"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5">
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

          <div className="flex items-center justify-between">
            <p className="mono-label text-[9.5px] text-ink/50">
              {form.items.length} steps · {days(totalDays)} projected
            </p>
            <button type="button" onClick={draft} disabled={drafting} className={btnGhost}>
              <Sparkles className="h-3.5 w-3.5 text-[#ff3c00]" />
              {drafting ? "Drafting..." : "Draft with AI"}
            </button>
          </div>

          <div className="max-h-[38vh] space-y-2 overflow-y-auto pr-1">
            {form.items.map((item, index) => (
              <div key={index} className="rounded-md border border-hair bg-card p-2.5">
                <div className="flex items-center gap-2">
                  <span className="mono-label text-[9px] text-ink/35">{String(index + 1).padStart(2, "0")}</span>
                  <input value={item.title || ""} onChange={(e) => setItem(index, "title", e.target.value)} placeholder="Step title" className={inputClass} />
                  <button type="button" onClick={() => removeItem(index)} className="rounded-sm p-1.5 text-ink/40 hover:text-red-600" aria-label="Remove step">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  <Select value={item.category || "ops"} onValueChange={(v) => setItem(index, "category", v)}>
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category.value} className={selectItemClass} value={category.value}>
                          {category.label}
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
                          {priority.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={item.estimated_days ?? ""}
                    onChange={(e) => setItem(index, "estimated_days", e.target.value)}
                    placeholder="days"
                    className={inputClass}
                  />
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={item.offset_days ?? ""}
                    onChange={(e) => setItem(index, "offset_days", e.target.value)}
                    placeholder="starts d+"
                    className={inputClass}
                  />
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={addItem} className={btnGhost}>
            <Plus className="h-3.5 w-3.5" />
            Add step
          </button>

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
