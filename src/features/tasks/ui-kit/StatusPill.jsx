import React from "react";
import { statusMeta } from "@/features/tasks/lib/constants";

export default function StatusPill({ value, className = "" }) {
  const meta = statusMeta(value);
  return (
    <span
      className={"mono-label inline-flex items-center gap-1.5 rounded-sm border px-2 py-[3px] text-[9.5px] " + className}
      style={{ borderColor: meta.color + "40", color: meta.color, background: meta.color + "10" }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}
