import React from "react";
import { categoryMeta } from "@/features/tasks/lib/constants";
import { cn } from "@/lib/utils";

// Solid, readable category tag. Light text on the category colour; amber/yellow get ink text.
const DARK_TEXT = new Set(["content"]);

export default function CategoryChip({ value, size = "sm", className = "" }) {
  const c = categoryMeta(value);
  const dark = DARK_TEXT.has(c.value);
  return (
    <span
      className={cn(
        "mono-label inline-flex shrink-0 items-center whitespace-nowrap rounded-sm font-semibold uppercase tracking-[0.12em]",
        size === "sm" ? "h-[18px] px-1.5 text-[8.5px]" : "h-6 px-2 text-[9.5px]",
        className
      )}
      style={{ background: c.color, color: dark ? "#1a1a1a" : "#ffffff" }}
    >
      {c.label}
    </span>
  );
}

// Stacked bar: share of total minutes per category. `parts` = [{ category, minutes }]
export function CategoryMix({ parts = [], height = 6, className = "" }) {
  const total = parts.reduce((s, p) => s + (Number(p.minutes) || 0), 0);
  if (!total) return null;
  const byCat = new Map();
  parts.forEach((p) => byCat.set(p.category || "ops", (byCat.get(p.category || "ops") || 0) + (Number(p.minutes) || 0)));
  const rows = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <div className={className}>
      <div className="flex w-full overflow-hidden rounded-sm bg-ink/[0.06]" style={{ height }}>
        {rows.map(([cat, m]) => (
          <div key={cat} title={categoryMeta(cat).label + " · " + Math.round((m / total) * 100) + "%"} style={{ width: (m / total) * 100 + "%", background: categoryMeta(cat).color }} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {rows.map(([cat, m]) => (
          <span key={cat} className="flex items-center gap-1 text-[10px] text-ink/60">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: categoryMeta(cat).color }} />
            {categoryMeta(cat).label} <span className="font-mono tabular-nums text-ink/45">{Math.round((m / total) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
