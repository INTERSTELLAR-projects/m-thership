import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Check, Loader2, Lock, Plus, RotateCcw, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Panel } from "@/components/financial/finance/ui";
import { LIST_DEFS, LOCKED_LISTS } from "@/lib/optionLists";
import { useOptionList, newOptionValue } from "@/hooks/useOptionList";

const inputCls = "h-8 w-full rounded-md border border-hair bg-paper px-2.5 text-[13px] text-ink outline-none focus:border-[#ff3c00]";
const iconBtn = "inline-flex h-7 w-7 items-center justify-center rounded-md border border-hair bg-card text-ink/55 transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-30 disabled:hover:border-hair";

// Counts how many records use each value (and which used values aren't in the list).
function useUsage(def) {
  return useQuery({
    queryKey: ["option-usage", def.key],
    staleTime: 60_000,
    queryFn: async () => {
      const { entity, field, match } = def.usage;
      let rows = [];
      try { rows = (await base44.entities[entity].list("-created_date", 1000)) || []; } catch { rows = []; }
      const vals = rows.map((r) => r?.[field]).filter((v) => v != null && String(v).trim() !== "").map(String);
      return { vals, match: match || "exact", total: rows.length };
    },
  });
}

const countFor = (usage, value) => {
  if (!usage) return null;
  if (usage.match === "prefix") {
    const v = value.toLowerCase();
    return usage.vals.filter((x) => x.toLowerCase().startsWith(v)).length;
  }
  return usage.vals.filter((x) => x === value).length;
};

function ListEditor({ def }) {
  const { items, save, isLoading } = useOptionList(def.key);
  const usageQ = useUsage(def);
  const usage = usageQ.data;
  const [draft, setDraft] = useState(items);
  const [dirty, setDirty] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => { if (!dirty) setDraft(items); }, [items, dirty]);
  useEffect(() => { setDirty(false); setMsg(""); setConfirmDel(null); setNewLabel(""); }, [def.key]);

  const change = (next) => { setDraft(next); setDirty(true); setMsg(""); };
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= draft.length) return;
    const next = draft.slice();
    [next[i], next[j]] = [next[j], next[i]];
    change(next);
  };
  const add = (labelArg) => {
    const label = String(labelArg ?? newLabel).trim();
    if (!label) return;
    const value = newOptionValue(def.key, label);
    if (!value) return;
    if (draft.some((d) => d.value === value || d.label.toLowerCase() === label.toLowerCase())) { setMsg(`"${label}" is already in the list.`); return; }
    change([...draft, { value, label, archived: false, isDefault: false }]);
    setNewLabel("");
  };
  const doSave = async () => {
    if (draft.some((d) => !String(d.label).trim())) { setMsg("Every item needs a label."); return; }
    setBusy(true);
    try { await save(draft); setDirty(false); setMsg("Saved. Every dropdown using this list updates now."); } catch (e) { setMsg(`Couldn't save: ${e?.message || e}`); } finally { setBusy(false); }
  };

  const orphans = useMemo(() => {
    if (!usage || usage.match === "prefix") return [];
    const known = new Set(draft.map((d) => d.value));
    const counts = {};
    usage.vals.forEach((v) => { if (!known.has(v)) counts[v] = (counts[v] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [usage, draft]);

  return (
    <Panel
      title={def.label}
      subtitle={def.help}
      right={(
        <div className="flex items-center gap-2">
          {dirty && <button type="button" onClick={() => { setDraft(items); setDirty(false); setMsg(""); }} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-ink/60 hover:text-ink"><RotateCcw className="h-3.5 w-3.5" />Undo</button>}
          <button type="button" onClick={doSave} disabled={!dirty || busy} className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium text-white disabled:opacity-40" style={{ background: "linear-gradient(90deg,#ff3c00,#ff6a00)" }}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Save list
          </button>
        </div>
      )}
    >
      {isLoading ? <div className="h-24 animate-pulse rounded-md bg-ink/[0.04]" /> : (
        <>
          <div className="overflow-hidden rounded-md border border-hair">
            <div className="hidden grid-cols-[1fr_150px_90px_120px] gap-3 border-b border-hair bg-ink/[0.02] px-3 py-2 sm:grid">
              {["Label (what pickers show)", "Saved value", "In use", ""].map((h) => <span key={h} className="mono-label text-[9px] text-ink/45">{h}</span>)}
            </div>
            {draft.map((it, i) => {
              const used = countFor(usage, it.value);
              const canDelete = !it.isDefault && used === 0;
              return (
                <div key={it.value} className={`grid grid-cols-[1fr_auto] items-center gap-2 border-b border-hair px-3 py-2 last:border-0 sm:grid-cols-[1fr_150px_90px_120px] sm:gap-3 ${it.archived ? "bg-ink/[0.02]" : ""}`}>
                  <div className="min-w-0">
                    <input value={it.label} onChange={(e) => change(draft.map((d, k) => (k === i ? { ...d, label: e.target.value } : d)))} className={`${inputCls} ${it.archived ? "text-ink/40 line-through" : ""}`} aria-label="Label" />
                    <span className="mt-1 block truncate font-mono text-[10.5px] text-ink/40 sm:hidden">{it.value} · {used == null ? "…" : `${used} record${used === 1 ? "" : "s"}`}</span>
                  </div>
                  <span className="hidden truncate font-mono text-[11px] text-ink/50 sm:block" title={it.value}>{it.value}{it.isDefault ? <span className="ml-1 text-ink/30">· default</span> : null}</span>
                  <span className="hidden text-[12px] tabular-nums text-ink/60 sm:block">{usageQ.isLoading ? "…" : used ? `${used} record${used === 1 ? "" : "s"}` : <span className="text-ink/35">unused</span>}</span>
                  <span className="flex items-center justify-end gap-1">
                    <button type="button" className={iconBtn} onClick={() => move(i, -1)} disabled={i === 0} title="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" className={iconBtn} onClick={() => move(i, 1)} disabled={i === draft.length - 1} title="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" className={iconBtn} onClick={() => change(draft.map((d, k) => (k === i ? { ...d, archived: !d.archived } : d)))} title={it.archived ? "Restore to pickers" : "Archive: hide from pickers, keep on records"}>
                      {it.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    </button>
                    {canDelete && (confirmDel === it.value ? (
                      <button type="button" onClick={() => { change(draft.filter((d) => d.value !== it.value)); setConfirmDel(null); }} className="inline-flex h-7 items-center rounded-md bg-red-600 px-2 text-[11px] font-medium text-white">Delete?</button>
                    ) : (
                      <button type="button" className={iconBtn} onClick={() => setConfirmDel(it.value)} title="Delete (unused custom value)"><Trash2 className="h-3.5 w-3.5" /></button>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>

          {def.noAdd ? (
            <p className="mt-3 text-[11.5px] text-ink/45">New items can't be added here: each one needs its own form. Rename, reorder or archive the ones above.</p>
          ) : (
            <div className="mt-3 flex gap-2">
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={`Add to ${def.label.toLowerCase()}…`} className={inputCls} />
              <button type="button" onClick={() => add()} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-ink bg-ink px-3 text-[12px] font-medium text-white hover:bg-[#ff3c00] hover:border-[#ff3c00]"><Plus className="h-3.5 w-3.5" />Add</button>
            </div>
          )}

          {orphans.length > 0 && (
            <div className="mt-4 rounded-md border border-dashed border-hair p-3">
              <p className="mono-label mb-2 text-[9px] text-ink/45">Used on records but not in this list</p>
              <div className="flex flex-wrap gap-1.5">
                {orphans.slice(0, 20).map(([v, n]) => (
                  <span key={v} className="inline-flex items-center gap-1.5 rounded border border-hair bg-card px-2 py-1 text-[11.5px]">
                    <span className="max-w-[220px] truncate">{v}</span><span className="text-ink/40">{n}</span>
                    {!def.noAdd && def.valueMode === "text" && v.length <= 60 && <button type="button" onClick={() => add(v)} className="text-[#d83300] hover:underline">add</button>}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 text-[11.5px] text-ink/50">
            {msg || (def.valueMode === "key"
              ? "Records store the saved value, so renaming a label is safe everywhere. Archive hides an item from pickers; old records keep it."
              : "Records store the saved value as text. Renaming changes what pickers show; records keep the value they were saved with. Archive hides from pickers. Only unused custom items can be deleted.")}
          </p>
        </>
      )}
    </Panel>
  );
}

export default function ListsTab() {
  const [active, setActive] = useState(LIST_DEFS[0].key);
  const def = LIST_DEFS.find((d) => d.key === active) || LIST_DEFS[0];
  const groups = [...new Set(LIST_DEFS.map((d) => d.group))];
  return (
    <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="space-y-4">
        <nav className="rounded-md border border-hair bg-card p-2">
          {groups.map((g) => (
            <div key={g} className="mb-1 last:mb-0">
              <p className="mono-label px-2 pb-1 pt-2 text-[9px] text-ink/40">{g}</p>
              {LIST_DEFS.filter((d) => d.group === g).map((d) => (
                <button key={d.key} type="button" onClick={() => setActive(d.key)} className={`flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${active === d.key ? "bg-ink text-white" : "text-ink/70 hover:bg-ink/[0.04]"}`}>{d.label}</button>
              ))}
            </div>
          ))}
        </nav>
        <div className="rounded-md border border-hair bg-card p-3">
          <p className="mono-label mb-2 flex items-center gap-1.5 text-[9px] text-ink/45"><Lock className="h-3 w-3" />Locked lists</p>
          <ul className="space-y-2">
            {LOCKED_LISTS.map((l) => (
              <li key={l.label} className="text-[11.5px] leading-snug">
                <span className="font-medium text-ink/75">{l.label}</span>
                <span className="block text-ink/45">{l.why}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <ListEditor key={def.key} def={def} />
    </div>
  );
}
