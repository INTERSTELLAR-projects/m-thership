import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Field from "@/features/tasks/ui-kit/Field";
import RollButton from "@/features/tasks/ui-kit/RollButton";
import { BILLING, PRIORITIES, PROJECT_STATUSES, PROJECT_TYPES } from "@/features/tasks/lib/constants";
import {
  btnGhost,
  dialogClass,
  inputClass,
  selectContentClass,
  selectItemClass,
  selectTriggerClass,
  textareaClass
} from "@/features/tasks/lib/ui";

const EMPTY = {
  title: "",
  client_id: "",
  client_name: "",
  type: "website",
  status: "planning",
  priority: 2,
  start_date: "",
  due_date: "",
  estimated_hours: "",
  contract_value: "",
  billing: "one_time",
  description: "",
  is_focus: false
};

const NONE = "__none__";

export default function ProjectFormDialog({ open, onOpenChange, clients = [], onSaved, initial = null }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      initial
        ? {
            ...EMPTY,
            ...initial,
            client_id: initial.client_id || "",
            estimated_hours: initial.estimated_hours ?? "",
            contract_value: initial.contract_value ?? "",
            description: initial.description || ""
          }
        : EMPTY
    );
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const draftPlan = async () => {
    if (!form.title.trim()) {
      setError("Name the project first, then let the core draft the plan.");
      return;
    }
    setDrafting(true);
    try {
      const client = clients.find((c) => c.id === form.client_id);
      const response = await base44.functions.invoke("suggest-checklist", {
        project_type: form.type,
        project_title: form.title.trim(),
        client_name: client ? client.name : "",
        count: 9
      });
      const data = (response && response.data) || {};
      const items = Array.isArray(data.items) ? data.items : [];
      const totalDays = items.reduce((sum, item) => sum + (Number(item.estimated_days) || 0), 0);
      set("estimated_hours", Math.round(totalDays * 6));
      setError(items.length ? "Estimated " + Math.round(totalDays * 6) + " hours from " + items.length + " standard steps." : "The core could not draft a plan.");
    } catch (err) {
      setError("The core could not draft a plan right now.");
    } finally {
      setDrafting(false);
    }
  };

  const save = async () => {
    if (!form.title.trim()) {
      setError("Give the project a title.");
      return;
    }
    setSaving(true);
    const client = clients.find((c) => c.id === form.client_id);
    const payload = {
      title: form.title.trim(),
      client_id: form.client_id || null,
      client_name: client ? client.name : null,
      type: form.type,
      status: form.status,
      priority: Number(form.priority) || 2,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
      estimated_hours: Number(form.estimated_hours) || 0,
      contract_value: Number(form.contract_value) || 0,
      billing: form.billing,
      description: form.description || null,
      is_focus: !!form.is_focus
    };
    try {
      if (initial && initial.id) await base44.entities.Project.update(initial.id, payload);
      else await base44.entities.Project.create(payload);
      onOpenChange(false);
      if (onSaved) onSaved();
    } catch (err) {
      setError("Could not save that project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <p className="label-cross text-[10.5px] text-ink/60">(Project)</p>
          <DialogTitle className="text-[20px] font-semibold tracking-[-0.03em] text-ink">{initial && initial.id ? "Edit project" : "New project"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5">
          <Field label="Project">
            <input autoFocus value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Meridian — website rebuild" className={inputClass} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Client">
              <Select value={form.client_id || NONE} onValueChange={(v) => set("client_id", v === NONE ? "" : v)}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="Internal" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem className={selectItemClass} value={NONE}>Internal / unpaid</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} className={selectItemClass} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Type">
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {PROJECT_STATUSES.map((status) => (
                    <SelectItem key={status.value} className={selectItemClass} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input type="date" value={form.start_date || ""} onChange={(e) => set("start_date", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Due date">
              <input type="date" value={form.due_date || ""} onChange={(e) => set("due_date", e.target.value)} className={inputClass} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Contract value ($)">
              <input type="number" min="0" value={form.contract_value} onChange={(e) => set("contract_value", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Estimated hours">
              <div className="flex items-center gap-2">
                <input type="number" min="0" step="0.5" value={form.estimated_hours} onChange={(e) => set("estimated_hours", e.target.value)} className={inputClass} />
                <button type="button" onClick={draftPlan} disabled={drafting} className={btnGhost} title="Let the core project the hours from a standard delivery plan">
                  {drafting ? "..." : "Estimate"}
                </button>
              </div>
            </Field>
          </div>

          <Field label="Billing">
            <Select value={form.billing} onValueChange={(v) => set("billing", v)}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                {BILLING.map((billing) => (
                  <SelectItem key={billing.value} className={selectItemClass} value={billing.value}>
                    {billing.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Scope notes">
            <textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} className={textareaClass} placeholder="Deliverables, stakes, anything the core should weigh" />
          </Field>

          <div className="flex items-center justify-between rounded-md border border-hair bg-card px-3 py-2.5">
            <div>
              <p className="text-[12.5px] text-ink">Flag as focus project</p>
              <p className="text-[11px] text-ink/45">Keeps it at the top of the board</p>
            </div>
            <Switch checked={!!form.is_focus} onCheckedChange={(v) => set("is_focus", v)} />
          </div>

          {error ? <p className="text-[12px] text-amber-700">{error}</p> : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={() => onOpenChange(false)} className={btnGhost}>
              Cancel
            </button>
            <RollButton label={saving ? "Saving..." : initial && initial.id ? "Save project" : "Create project"} icon={Check} onClick={save} disabled={saving} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
