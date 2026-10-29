import React from "react";
import { Search, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RollButton from "@/features/tasks/ui-kit/RollButton";
import { CATEGORIES, PRIORITIES, TASK_STATUSES } from "@/features/tasks/lib/constants";
import { inputClass, selectContentClass, selectItemClass, selectTriggerClass } from "@/features/tasks/lib/ui";
import { cn } from "@/lib/utils";

const ALL = "__all__";

export default function TaskFilters({ filters, setFilters, clients = [], onNew }) {
  const set = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="rounded-md border border-hair bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[190px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
          <input value={filters.search} onChange={(e) => set("search", e.target.value)} placeholder="Search tasks" className={cn(inputClass, "pl-9")} />
        </div>
        <Select value={filters.category} onValueChange={(v) => set("category", v)}>
          <SelectTrigger className={cn(selectTriggerClass, "w-[150px]")}>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className={selectContentClass}>
            <SelectItem className={selectItemClass} value={ALL}>All categories</SelectItem>
            {CATEGORIES.map((category) => (
              <SelectItem key={category.value} className={selectItemClass} value={category.value}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.priority} onValueChange={(v) => set("priority", v)}>
          <SelectTrigger className={cn(selectTriggerClass, "w-[140px]")}>
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent className={selectContentClass}>
            <SelectItem className={selectItemClass} value={ALL}>All priorities</SelectItem>
            {PRIORITIES.map((priority) => (
              <SelectItem key={priority.value} className={selectItemClass} value={String(priority.value)}>
                {priority.label} {priority.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.client} onValueChange={(v) => set("client", v)}>
          <SelectTrigger className={cn(selectTriggerClass, "w-[170px]")}>
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent className={selectContentClass}>
            <SelectItem className={selectItemClass} value={ALL}>All clients</SelectItem>
            <SelectItem className={selectItemClass} value="__none__">Internal only</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} className={selectItemClass} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <RollButton label="New task" icon={Plus} onClick={onNew} />
      </div>

      <div className="no-scrollbar mt-3 flex items-center gap-1.5 overflow-x-auto">
        {[{ value: ALL, label: "Everything" }, ...TASK_STATUSES].map((status) => {
          const active = filters.status === status.value;
          return (
            <button
              key={status.value}
              type="button"
              onClick={() => set("status", status.value)}
              className={cn(
                "mono-label shrink-0 rounded-sm border px-3 py-1.5 text-[9.5px] transition-colors",
                active ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-hair text-ink/55 hover:border-ink/40 hover:text-ink"
              )}
            >
              {status.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
