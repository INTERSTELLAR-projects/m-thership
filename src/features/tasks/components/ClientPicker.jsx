import React, { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Searchable client dropdown that scopes the whole task board (replaces the row of client pills).
// options: [{ key, label, open, hot, strong }]  hot = overdue, P0/P1 or blocked work.
export default function ClientPicker({ options = [], value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = options.find((o) => o.key === value) || options[0] || { label: "All", open: 0 };
  const t = q.trim().toLowerCase();
  const list = t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
  const pick = (k) => { onChange(k); setOpen(false); setQ(""); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Choose which client the board shows" data-testid="task-client-picker"
          className="flex h-10 w-full min-w-0 items-center gap-2 rounded-md border border-hair bg-card px-3 text-left text-[13px] text-ink transition-colors hover:border-[#ff3c00]/60 sm:w-[320px]">
          <span className="mono-label shrink-0 text-[9.5px] text-ink/45">Client</span>
          {current.hot ? <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff3c00]" /> : null}
          <span className="min-w-0 flex-1 truncate font-medium">{current.label}</span>
          <span className="mono-label shrink-0 rounded-full bg-ink/[0.06] px-1.5 text-[10px] tabular-nums text-ink/60">{current.open}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-ink/40" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,340px)] rounded-md border border-hair bg-card p-0 text-ink">
        <div className="relative border-b border-hair">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients" aria-label="Search clients"
            className="h-10 w-full bg-transparent pl-9 pr-3 text-[13px] outline-none placeholder:text-ink/35" />
        </div>
        <ul className="max-h-[320px] overflow-y-auto p-1" role="listbox">
          {list.length ? list.map((o) => (
            <li key={o.key}>
              <button type="button" role="option" aria-selected={o.key === value} onClick={() => pick(o.key)}
                className={cn("flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-[12.5px] hover:bg-[#ff3c00]/[0.07]", o.key === value && "bg-[#ff3c00]/[0.09]")}>
                <Check className={cn("h-3.5 w-3.5 shrink-0 text-[#ff3c00]", o.key === value ? "opacity-100" : "opacity-0")} />
                <span className={cn("min-w-0 flex-1 truncate", o.strong && "font-semibold")}>{o.label}</span>
                {o.hot ? <span aria-label="Has urgent work" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff3c00]" /> : null}
                <span className="mono-label shrink-0 text-[10px] tabular-nums text-ink/50">{o.open}</span>
              </button>
            </li>
          )) : <li className="px-3 py-3 text-[12px] text-ink/45">No client matches “{q}”.</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
