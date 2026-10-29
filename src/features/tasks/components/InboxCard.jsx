import React, { useState } from "react";
import { Archive, Check, FolderPlus, ListPlus, Mic } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import Field from "@/features/tasks/ui-kit/Field";
import RollButton from "@/features/tasks/ui-kit/RollButton";
import { CATEGORIES, PRIORITIES, PROJECT_TYPES } from "@/features/tasks/lib/constants";
import { btnGhost, inputClass, selectContentClass, selectItemClass, selectTriggerClass } from "@/features/tasks/lib/ui";
import { money } from "@/features/tasks/lib/format";
import { cn } from "@/lib/utils";

const NONE = "__none__";

export default function InboxCard({ item, projects = [], clients = [], onDone }) {
  const [kind, setKind] = useState(item.suggested_kind === "project" ? "project" : "task");
  const [title, setTitle] = useState(item.suggested_title || (item.raw_text || "").slice(0, 80));
  const [category, setCategory] = useState(item.suggested_category || "ops");
  const [priority, setPriority] = useState(String(item.suggested_priority || 3));
  const [projectId, setProjectId] = useState("");
  const [type, setType] = useState(item.suggested_project_type || "website");
  const [value, setValue] = useState(item.suggested_project_value || 0);
  const [busy, setBusy] = useState(false);

  const clientName = item.suggested_client_name || "";
  const matchedClient = clients.find((client) => clientName && (client.name || "").toLowerCase().includes(clientName.toLowerCase()));
  const confidence = Math.round((Number(item.confidence) || 0) * 100);

  const file = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      if (kind === "project") {
        await base44.entities.Project.create({
          title: title.trim(),
          client_id: matchedClient ? matchedClient.id : null,
          client_name: matchedClient ? matchedClient.name : clientName || null,
          type,
          status: "planning",
          priority: Number(priority) || 2,
          contract_value: Number(value) || 0,
          billing: Number(value) ? "one_time" : "unpaid",
          description: "Filed from the voice inbox: " + item.raw_text
        });
      } else {
        const project = projects.find((row) => row.id === projectId);
        await base44.entities.Task.create({
          title: title.trim(),
          category,
          priority: Number(priority) || 3,
          status: "next",
          source: "voice",
          due_date: item.suggested_due_date || null,
          estimated_days: Number(item.suggested_estimated_days) || 0,
          project_id: project ? project.id : null,
          project_name: project ? project.title : null,
          client_id: project ? project.client_id : matchedClient ? matchedClient.id : null,
          client_name: project ? project.client_name : matchedClient ? matchedClient.name : clientName || null,
          notes: "Captured by voice: " + item.raw_text
        });
      }
      await base44.entities.InboxItem.update(item.id, { status: "filed" });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    setBusy(true);
    try {
      await base44.entities.InboxItem.update(item.id, { status: "discarded" });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-hover rounded-md border border-hair bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-[#ff3c00]/10">
          <Mic className="h-3.5 w-3.5 text-[#ff3c00]" />
        </span>
        <div className="min-w-0">
          <p className="text-[12.5px] italic leading-relaxed text-ink/70">&quot;{item.raw_text}&quot;</p>
          <p className="mono-label mt-1 text-[9px] text-ink/40">
            <span className={confidence < 55 ? "text-amber-700" : "text-ink/50"}>confidence {confidence}%</span> · captured {item.captured_on || ""}
          </p>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {[
          { value: "task", label: "File as task" },
          { value: "project", label: "File as project" }
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setKind(option.value)}
            className={cn(
              "mono-label rounded-sm border px-3 py-1.5 text-[9.5px] transition-colors",
              kind === option.value ? "border-ink bg-ink text-white" : "border-hair text-ink/55 hover:border-ink/40 hover:text-ink"
            )}
          >
            {option.label}
          </button>
        ))}
        {clientName ? (
          <span className="text-[11px] text-ink/50">
            heard client: <span className="text-ink">{clientName}</span>
            {matchedClient ? <span className="text-green-700"> · matched</span> : null}
          </span>
        ) : null}
      </div>

      <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </Field>

        {kind === "task" ? (
          <Field label="Attach to project" className="sm:col-span-2">
            <Select value={projectId || NONE} onValueChange={(v) => setProjectId(v === NONE ? "" : v)}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="Loose task" />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                <SelectItem className={selectItemClass} value={NONE}>Loose task (no project)</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} className={selectItemClass} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <Field label="Project type">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                {PROJECT_TYPES.map((option) => (
                  <SelectItem key={option.value} className={selectItemClass} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {kind === "task" ? (
          <Field label="Category">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                {CATEGORIES.map((option) => (
                  <SelectItem key={option.value} className={selectItemClass} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <Field label="Contract value ($)">
            <input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
          </Field>
        )}

        <Field label="Priority">
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              {PRIORITIES.map((option) => (
                <SelectItem key={option.value} className={selectItemClass} value={String(option.value)}>
                  {option.label} {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {item.assistant_note ? (
        <p className="mt-3 rounded-sm border border-hair bg-canvas/60 px-3 py-2 text-[11.5px] leading-relaxed text-ink/60">
          <span className="mono-label mr-1.5 text-[9px] text-[#ff3c00]">Core</span>
          {item.assistant_note}
        </p>
      ) : null}

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-ink/45">{kind === "project" ? "Creates a project worth " + money(value || 0) : "Creates a task in Next Up"}</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={discard} disabled={busy} className={btnGhost}>
            <Archive className="h-3.5 w-3.5" />
            Discard
          </button>
          <RollButton label={busy ? "Filing..." : "File it"} icon={kind === "task" ? ListPlus : FolderPlus} onClick={file} disabled={busy} />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-ink/35">
        <Check className="h-3 w-3" />
        Nothing lands in your system until you file it
      </div>
    </div>
  );
}
