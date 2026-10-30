import React, { useCallback, useEffect, useState } from "react";
import { BookOpen, Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import TasksNav from "@/features/tasks/components/TasksNav";
import SopFormDialog from "@/features/tasks/components/SopFormDialog";
import Panel from "@/features/tasks/ui-kit/Panel";
import EmptyState from "@/features/tasks/ui-kit/EmptyState";
import RollButton from "@/features/tasks/ui-kit/RollButton";
import CategoryChip, { CategoryMix } from "@/features/tasks/ui-kit/CategoryChip";
import PriorityBadge from "@/features/tasks/ui-kit/PriorityBadge";
import { projectTypeMeta } from "@/features/tasks/lib/constants";
import { itemsOf } from "@/features/tasks/lib/clients";
import { fmtMinutes, itemMinutes, minutesToDays } from "@/features/tasks/lib/estimate";

export default function TaskSops() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await base44.entities.TaskTemplate.list({ sort: "-times_applied", limit: 50 });
      setTemplates(itemsOf(page));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (template) => {
    setTemplates((prev) => prev.filter((row) => row.id !== template.id));
    await base44.entities.TaskTemplate.delete(template.id);
  };

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen pb-24">
      <PageHeader breadcrumb="Command / Tasks" title="SOP Library" rightText={templates.length + " procedures"}>
        <RollButton label="New SOP" icon={Plus} onClick={openNew} />
      </PageHeader>
      <TasksNav />

      <div className="space-y-6 px-5 py-6 md:px-8">
        <p className="max-w-2xl text-[13px] leading-relaxed text-ink/60">
          The checklist every project of a given kind runs. Apply one to a project and the core lays out the whole delivery plan with dates. Estimates feed the task clock, and the Output page tells you when real time drifts from them.
        </p>

        {loading ? (
          <p className="py-16 text-center text-[12.5px] text-ink/45">Reading the library...</p>
        ) : templates.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {templates.map((template) => {
              const type = projectTypeMeta(template.project_type);
              const items = Array.isArray(template.items) ? template.items : [];
              const totalMin = items.reduce((sum, item) => sum + itemMinutes(item), 0);
              const span = items.reduce((m, item) => Math.max(m, (Number(item.offset_days) || 0) + minutesToDays(itemMinutes(item))), 0);
              const open = Boolean(expanded[template.id]);
              const shown = open ? items : items.slice(0, 8);
              return (
                <Panel
                  key={template.id}
                  className="card-hover"
                  kicker={type.label + " · run " + (template.times_applied || 0) + "×"}
                  title={template.name}
                  action={
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(template);
                          setDialogOpen(true);
                        }}
                        className="rounded-sm p-1.5 text-ink/45 hover:text-ink"
                        aria-label="Edit SOP"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => remove(template)} className="rounded-sm p-1.5 text-ink/45 hover:text-red-600" aria-label="Delete SOP">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  }
                >
                  {template.description ? <p className="mb-3 text-[12px] leading-relaxed text-ink/60">{template.description}</p> : null}

                  <div className="mb-3 grid grid-cols-3 gap-2 rounded-md border border-hair bg-canvas/60 px-3 py-2.5">
                    <div>
                      <p className="mono-label text-[8.5px] text-ink/45">Steps</p>
                      <p className="mt-0.5 text-[18px] font-semibold leading-none tracking-[-0.03em] text-ink">{items.length}</p>
                    </div>
                    <div>
                      <p className="mono-label text-[8.5px] text-ink/45">Work</p>
                      <p className="mt-0.5 flex items-baseline gap-1 text-[18px] font-semibold leading-none tracking-[-0.03em] text-ink">
                        <Clock className="h-3 w-3 self-center text-[#ff3c00]" />
                        {fmtMinutes(totalMin)}
                        <span className="text-[10px] font-normal text-ink/45">{totalMin >= 480 ? "· " + Math.round(totalMin / 60) + "h" : ""}</span>
                      </p>
                    </div>
                    <div>
                      <p className="mono-label text-[8.5px] text-ink/45">Calendar span</p>
                      <p className="mt-0.5 text-[18px] font-semibold leading-none tracking-[-0.03em] text-ink">
                        {span ? Math.ceil(span) + "d" : "—"}
                      </p>
                    </div>
                  </div>

                  <CategoryMix parts={items.map((i) => ({ category: i.category, minutes: itemMinutes(i) }))} className="mb-4" />

                  <ol className="divide-y divide-hair border-t border-hair">
                    {shown.map((item, index) => {
                      const min = itemMinutes(item);
                      return (
                        <li key={item.title + index} className="flex items-center gap-2.5 py-1.5 text-[12px] text-ink/80">
                          <span className="mono-label w-5 shrink-0 text-[9px] text-ink/35">{String(index + 1).padStart(2, "0")}</span>
                          <span className="min-w-0 flex-1 truncate">{item.title}</span>
                          <PriorityBadge value={item.priority} compact />
                          <CategoryChip value={item.category} />
                          <span className={"w-12 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums " + (min ? "text-ink" : "text-ink/30")}>{fmtMinutes(min)}</span>
                        </li>
                      );
                    })}
                  </ol>
                  {items.length > 8 ? (
                    <button type="button" onClick={() => setExpanded((p) => ({ ...p, [template.id]: !open }))} className="mt-2 text-[11px] text-[#ff3c00] hover:underline">
                      {open ? "Show fewer" : "+" + (items.length - 8) + " more steps"}
                    </button>
                  ) : null}
                </Panel>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No SOPs yet"
            hint="Build one by hand, or let the core draft the standard delivery plan for you."
            action={<RollButton label="Draft an SOP" icon={Plus} onClick={openNew} />}
          />
        )}
      </div>

      <SopFormDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={editing} onSaved={load} />
    </div>
  );
}
