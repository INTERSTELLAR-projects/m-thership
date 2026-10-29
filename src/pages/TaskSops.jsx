import React, { useCallback, useEffect, useState } from "react";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import TasksNav from "@/features/tasks/components/TasksNav";
import SopFormDialog from "@/features/tasks/components/SopFormDialog";
import Panel from "@/features/tasks/ui-kit/Panel";
import EmptyState from "@/features/tasks/ui-kit/EmptyState";
import RollButton from "@/features/tasks/ui-kit/RollButton";
import { projectTypeMeta } from "@/features/tasks/lib/constants";
import { itemsOf } from "@/features/tasks/lib/clients";
import { days } from "@/features/tasks/lib/format";

export default function TaskSops() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

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
          The checklist every project of a given kind runs. Apply one to a project and the core lays out the whole delivery plan with dates.
        </p>

        {loading ? (
          <p className="py-16 text-center text-[12.5px] text-ink/45">Reading the library...</p>
        ) : templates.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {templates.map((template) => {
              const type = projectTypeMeta(template.project_type);
              const items = Array.isArray(template.items) ? template.items : [];
              const totalDays = items.reduce((sum, item) => sum + (Number(item.estimated_days) || 0), 0);
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
                  <p className="mono-label mb-3 text-[9.5px] text-ink/45">
                    {items.length} steps · {days(totalDays)} projected
                  </p>
                  <ol className="space-y-1.5">
                    {items.slice(0, 8).map((item, index) => (
                      <li key={item.title + index} className="flex items-center gap-2 text-[12px] text-ink/75">
                        <span className="mono-label text-[9px] text-ink/35">{String(index + 1).padStart(2, "0")}</span>
                        <span className="flex-1 truncate">{item.title}</span>
                        <span className="text-ink/40">{item.category}</span>
                        <span className="text-ink/40">{item.estimated_days}d</span>
                      </li>
                    ))}
                  </ol>
                  {items.length > 8 ? <p className="mt-2 text-[11px] text-ink/45">+{items.length - 8} more steps</p> : null}
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
