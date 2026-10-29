import React from "react";
import { priorityMeta } from "@/features/tasks/lib/constants";

export default function PriorityBadge({ value, compact = false }) {
  const meta = priorityMeta(value);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm border px-2 py-[3px] text-[10px] font-semibold tracking-wide"
      style={{ borderColor: meta.color + "40", color: meta.color, background: meta.color + "12" }}
      title={meta.name}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {compact ? meta.label : meta.label + " " + meta.name}
    </span>
  );
}
