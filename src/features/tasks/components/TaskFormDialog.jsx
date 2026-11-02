import React, { useEffect, useState } from "react";
import { settleTimer } from "@/features/tasks/lib/timer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Check, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Field from "@/features/tasks/ui-kit/Field";
import RollButton from "@/features/tasks/ui-kit/RollButton";
import { CATEGORIES, PRIORITIES, TASK_STATUSES, TASK_TYPES } from "@/features/tasks/lib/constants";
import {
  btnDanger,
  btnGhost,
  dialogClass,
  inputClass,
  selectContentClass,
  selectItemClass,
  selectTriggerClass,
  textareaClass
} from "@/features/tasks/lib/ui";
import { UNITS, fmtClock, itemMinutes, splitMinutes, withEstimate } from "@/features/tasks/lib/estimate";

const EMPTY = {
  title: "",
  project_id: "",
  client_id: "",
  category: "development",
  task_type: "billable",
  status: "next",
  priority: 3,
  due_date: "",
  estimate_amount: "",
  estimate_unit: "h",
  labels: "",
  notes: "",
  is_focus: false,
  parent_task_id: ""
};

const NONE = "__none__";

export default function TaskFormDialog({ open, onOpenChange, projects = [], clients = [], onSaved, initial = null, lockProject = null }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        ...EMPTY,
        ...initial,
        project_id: initial.project_id || "",
        client_id: initial.client_id || "",
        due_date: initial.due_date || "",
        ...splitMinutes(itemMinutes(initial)),
        labels: Array.isArray(initial.labels) ? initial.labels.join(", ") : "",
        notes: initial.notes || "",
        parent_task_id: initial.parent_task_id || ""
      });
    } else {
      const project = projects.find((p) => p.id === lockProject);
      setForm({ ...EMPTY, project_id: lockProject || "", client_id: (project && project.client_id) || "" });
    }
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!form.title.trim()) {
      setError("Give the task a title.");
      return;
    }
    setSaving(true);
    setError("");
    const project = projects.find((p) => p.id === form.project_id);
    const clientId = form.client_id || (project && project.client_id) || null;
    const client = clients.find((c) => c.id === clientId);
    const payload = {
      title: form.title.trim(),
      project_id: form.project_id || null,
      project_name: project ? project.title : null,
      client_id: clientId,
      client_name: client ? client.name : (project && project.client_name) || null,
      category: form.category,
      task_type: form.task_type,
      status: form.status,
      priority: Number(form.priority) || 3,
      due_date: form.due_date || null,
      ...withEstimate({}, form.estimate_amount, form.estimate_unit),
      project_type: (project && project.type) || (initial && initial.project_type) || null,
      labels: form.labels ? form.labels.split(",").map((l) => l.trim()).filter(Boolean) : [],
      notes: form.notes || null,
      is_focus: !!form.is_focus,
      parent_task_id: form.parent_task_id || null
    };
    const wasDone = initial && initial.status === "done";
    if (form.status === "done" && !wasDone) {
      payload.completed_at = new Date().toISOString();
      if (initial && initial.id) await settleTimer(initial);
    }
    if (form.status !== "done" && wasDone) payload.completed_at = null;
    try {
      if (initial && initial.id) await base44.entities.Task.update(initial.id, payload);
      else await base44.entities.Task.create({ ...payload, source: "manual" });
      onOpenChange(false);
      if (onSaved) onSaved();
    } catch (err) {
      setError("Could not save that task. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial || !initial.id) return;
    setSaving(true);
    try {
      await base44.entities.Task.delete(initial.id);
      onOpenChange(false);
      if (onSaved) onSaved();
    } catch (err) {
      setError("Could not delete that task.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <p className="label-cross text-[10.5px] text-ink/60">(Task)</p>
          <DialogTitle className="text-[20px] font-semibold tracking-[-0.03em] text-ink">
            {initial && initial.id ? "Edit task" : form.parent_task_id ? "New subtask" : "New task"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5">
          <Field label="Task">
            <input autoFocus value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Design the landing page hero" className={inputClass} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Project">
              <Select
                value={form.project_id || NONE}
                onValueChange={(v) => {
                  const project = projects.find((p) => p.id === v);
                  setForm((prev) => ({ ...prev, project_id: v === NONE ? "" : v, client_id: (project && project.client_id) || prev.client_id }));
                }}
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem className={selectItemClass} value={NONE}>No project (internal)</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} className={selectItemClass} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Client">
              <Select value={form.client_id || NONE} onValueChange={(v) => set("client_id", v === NONE ? "" : v)}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="No client" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem className={selectItemClass} value={NONE}>None</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} className={selectItemClass} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
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
            </Field>
            <Field label="Task type">
              <Select value={form.task_type} onValueChange={(v) => set("task_type", v)}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {TASK_TYPES.map((type) => (
                    <SelectItem key={type.value} className={selectItemClass} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Priority">
              <Select value={String(form.priority)} onValueChange={(v) => set("priority", Number(v))}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority.value} className={selectItemClass} value={String(priority.value)}>
                      {priority.label} {priority.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {TASK_STATUSES.map((status) => (
                    <SelectItem key={status.value} className={selectItemClass} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Due date">
              <input type="date" value={form.due_date || ""} onChange={(e) => set("due_date", e.target.value)} className={inputClass} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="How long it takes you">
              <div className="flex items-center gap-1.5">
                <input type="number" step="0.5" min="0" value={form.estimate_amount} onChange={(e) => set("estimate_amount", e.target.value)} placeholder="0" className={inputClass + " w-24 text-right font-mono"} />
                <Select value={form.estimate_unit || "h"} onValueChange={(v) => set("estimate_unit", v)}>
                  <SelectTrigger className={selectTriggerClass}>
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
            </Field>
            <Field label="Clocked so far">
              <p className="flex h-9 items-center font-mono text-[12.5px] tabular-nums text-ink/70">
                {initial && Number(initial.logged_seconds) > 0 ? fmtClock(initial.logged_seconds) : "0:00:00"}
                {initial && initial.timer_started_at ? <span className="ml-2 text-[10px] text-[#ff3c00]">clock running</span> : null}
              </p>
            </Field>
          </div>

          <Field label="Labels (comma separated)">
            <input value={form.labels} onChange={(e) => set("labels", e.target.value)} placeholder="retainer, launch" className={inputClass} />
          </Field>

          <Field label="Notes">
            <textarea value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} className={textareaClass} placeholder="Anything the core should know" />
          </Field>

          <div className="flex items-center justify-between rounded-md border border-hair bg-card px-3 py-2.5">
            <div>
              <p className="text-[12.5px] text-ink">Push into Focus now</p>
              <p className="text-[11px] text-ink/45">Rides at the top of the task board above everything else</p>
            </div>
            <Switch checked={!!form.is_focus} onCheckedChange={(v) => set("is_focus", v)} />
          </div>

          {error ? <p className="text-[12px] text-red-600">{error}</p> : null}

          <div className="flex items-center justify-between pt-1">
            {initial && initial.id ? (
              <button type="button" onClick={remove} disabled={saving} className={btnDanger}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onOpenChange(false)} className={btnGhost}>
                Cancel
              </button>
              <RollButton
                label={saving ? "Saving..." : initial && initial.id ? "Save task" : "Add task"}
                icon={Check}
                onClick={save}
                disabled={saving}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
