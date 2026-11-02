import { useMemo } from "react";
import { useOptionList } from "@/hooks/useOptionList";
import { SOURCE_BY_KEY } from "./pipeline";

const NEW_TONE = "bg-[#ff6a00]/15 text-[#a33a00]";

// Lead sources from Settings > Lists & fields, keeping the shipped colour per built-in source.
// all: every source incl. archived (for badges on old leads); visible: what pickers show.
export function useLeadSources() {
  const { items, options } = useOptionList("lead_sources");
  return useMemo(() => {
    const dress = (i) => ({ key: i.value, label: i.label, archived: i.archived, tone: SOURCE_BY_KEY[i.value]?.tone || NEW_TONE });
    const all = items.map(dress);
    return { all, visible: options.map(dress), byKey: Object.fromEntries(all.map((s) => [s.key, s])) };
  }, [items, options]);
}
