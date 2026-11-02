import { useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { OPTION_LISTS_KEY, LIST_BY_KEY, mergeList, toStored, slugify } from "@/lib/optionLists";
import { setRequestTypeOverrides } from "@/features/requests/formSchema";

const QK = ["AppSettings", OPTION_LISTS_KEY];

async function fetchRecord() {
  try {
    const rows = await base44.entities.AppSettings.filter({ key: OPTION_LISTS_KEY }, "-created_date", 1);
    return rows?.[0] || null;
  } catch {
    return null; // non-admins can't read AppSettings: everyone falls back to the defaults
  }
}

// Saves ONE list into the shared record (re-reads first so two lists edited in a row never clobber each other).
export async function saveOptionList(key, items) {
  const rec = await fetchRecord();
  const lists = { ...(rec?.optionLists || {}), [key]: toStored(items) };
  if (rec) await base44.entities.AppSettings.update(rec.id, { optionLists: lists });
  else await base44.entities.AppSettings.create({ key: OPTION_LISTS_KEY, optionLists: lists });
  return lists;
}

export function useOptionLists() {
  const q = useQuery({ queryKey: QK, queryFn: fetchRecord, staleTime: 60_000 });
  const stored = useMemo(() => q.data?.optionLists || {}, [q.data]);
  const reqTypes = stored.request_types;
  // Keep kindLabel()/portalForms() in step with Settings everywhere in the admin app. Runs during render
  // (idempotent module setter) so the same render already shows the new labels.
  useMemo(() => setRequestTypeOverrides(Array.isArray(reqTypes) ? reqTypes : null), [reqTypes]);
  return { ...q, stored };
}

/**
 * useOptionList(key) -> {
 *   items:   every item (incl. archived), each { value, label, archived, isDefault }
 *   options: visible items only (for pickers)
 *   values / labels: visible values / labels
 *   labelOf(value): label for any stored value (archived included; unknown values echo back)
 *   save(items): persist the whole list
 * }
 * Always returns the code defaults while loading or when nothing is stored.
 */
export function useOptionList(key) {
  const qc = useQueryClient();
  const { stored, isLoading } = useOptionLists();
  const items = useMemo(() => mergeList(key, stored[key]), [key, stored]);
  const options = useMemo(() => items.filter((i) => !i.archived), [items]);
  const labelOf = useCallback((v) => (items.find((i) => i.value === v)?.label) || (v == null ? "" : String(v)), [items]);
  const save = useCallback(async (next) => {
    await saveOptionList(key, next);
    await qc.invalidateQueries({ queryKey: QK });
  }, [key, qc]);
  return { def: LIST_BY_KEY[key], items, options, values: options.map((o) => o.value), labels: options.map((o) => o.label), labelOf, save, isLoading };
}

/**
 * Drop-in for the older pages that kept their own category arrays in localStorage
 * (Financial expenses, Investments, Idea Vault): returns [labels, saveLabels].
 * saveLabels(nextStrings) writes the shared list, keeping archived items and existing values.
 * First save seeds from the page's old localStorage list so nothing a browser had is lost.
 */
export function useCategoryList(key, legacyStorageKey) {
  const { items, options, save } = useOptionList(key);
  const ref = useRef(items);
  ref.current = items;
  const { stored } = useOptionLists();
  const legacy = useMemo(() => {
    if (!legacyStorageKey || stored[key]) return null;
    try { const s = JSON.parse(localStorage.getItem(legacyStorageKey)); return Array.isArray(s) && s.length ? s : null; } catch { return null; }
  }, [legacyStorageKey, stored, key]);
  const labels = useMemo(() => (legacy ? [...new Set([...legacy, ...options.map((o) => o.value)])] : options.map((o) => o.value)), [legacy, options]);
  const saveLabels = useCallback(async (next) => {
    const cur = ref.current;
    const clean = [...new Set((next || []).map((s) => String(s).trim()).filter(Boolean))];
    const visible = clean.map((v) => cur.find((i) => i.value === v) || { value: v, label: v });
    const archived = cur.filter((i) => i.archived && !clean.includes(i.value));
    // Values dropped by the page editor are archived, not destroyed (records may still use them).
    const dropped = cur.filter((i) => !i.archived && !clean.includes(i.value)).map((i) => ({ ...i, archived: true }));
    await save([...visible.map((i) => ({ ...i, archived: false })), ...archived, ...dropped]);
  }, [save]);
  return [labels, saveLabels];
}

export const newOptionValue = (key, label) => (LIST_BY_KEY[key]?.valueMode === "key" ? slugify(label) : String(label).trim());
