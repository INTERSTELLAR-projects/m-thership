import React from "react";
import { cn } from "@/lib/utils";

// Horizontal pill bar that scopes the whole task board to one client.
// options: [{ key, label, open, hot }]  hot = has overdue or P0/P1 open work.
export default function ClientSwitcher({ options = [], value, onChange }) {
  return (
    <nav aria-label="Filter the board by client" className="-mx-5 md:mx-0">
      <div className="flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:thin] md:flex-wrap md:overflow-visible md:px-0">
        {options.map((opt) => {
          const active = opt.key === value;
          return (
            <button
              key={opt.key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt.key)}
              title={opt.hot ? opt.label + " has overdue or P0/P1 work" : opt.label}
              className={cn(
                "group flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] transition-colors",
                active
                  ? "border-[#ff3c00] bg-[#ff3c00] text-white"
                  : "border-hair bg-card text-ink hover:border-[#ff3c00]/60 hover:text-ink"
              )}
            >
              {opt.hot ? (
                <span
                  aria-hidden="true"
                  className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-white" : "bg-[#ff3c00]")}
                />
              ) : null}
              <span className={cn(opt.strong && "font-semibold")}>{opt.label}</span>
              <span
                className={cn(
                  "mono-label rounded-full px-1.5 text-[10px] tabular-nums",
                  active ? "bg-white/20 text-white" : "bg-ink/[0.06] text-ink/55"
                )}
              >
                {opt.open}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
