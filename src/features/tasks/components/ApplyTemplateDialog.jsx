import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen } from "lucide-react";
import EmptyState from "@/features/tasks/ui-kit/EmptyState";
import { btnSmallFlame, dialogClass } from "@/features/tasks/lib/ui";
import { days } from "@/features/tasks/lib/format";

export default function ApplyTemplateDialog({ open, onOpenChange, templates = [], onApply, busyId }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <p className="label-cross text-[10.5px] text-ink/60">(SOP)</p>
          <DialogTitle className="text-[20px] font-semibold tracking-[-0.03em] text-ink">Run a standard operating procedure</DialogTitle>
        </DialogHeader>

        {templates.length ? (
          <div className="space-y-2.5">
            {templates.map((template) => {
              const items = Array.isArray(template.items) ? template.items : [];
              const totalDays = items.reduce((sum, item) => sum + (Number(item.estimated_days) || 0), 0);
              return (
                <div key={template.id} className="card-hover flex items-start justify-between gap-3 rounded-md border border-hair bg-card p-3.5">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold tracking-[-0.02em] text-ink">{template.name}</p>
                    <p className="mt-0.5 text-[11px] text-ink/50">
                      {items.length} steps · {days(totalDays)} projected · applied {template.times_applied || 0}×
                    </p>
                    {template.description ? <p className="mt-1.5 text-[11px] leading-relaxed text-ink/45">{template.description}</p> : null}
                  </div>
                  <button type="button" onClick={() => onApply(template)} disabled={busyId === template.id} className={btnSmallFlame}>
                    <BookOpen className="h-3.5 w-3.5" />
                    {busyId === template.id ? "Running..." : "Run"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={BookOpen} title="No SOPs saved yet" hint="Build one in the SOP library, or let the core draft a delivery plan from a project page." />
        )}
      </DialogContent>
    </Dialog>
  );
}
