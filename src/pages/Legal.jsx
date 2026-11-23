import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Trash2, Pencil, Check, X, Repeat, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import MicButton from "../components/MicButton";
import DeadlineHero, { URGENCY } from "@/features/legal/DeadlineHero";
import { computeDeadline, categoryOf, fmtDate, toDueString, toEditorValue } from "@/features/legal/legalDates";
import TermsAdmin from "@/features/terms/TermsAdmin";
import ErrorBoundary from "@/components/ErrorBoundary";

// LegalItem sections: "todo" = checklist, "date" / "deadline" = dated items (both feed the countdown hero).
const isDateSection = (s) => s === "date" || s === "deadline";

export default function Legal() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDateId, setEditDateId] = useState(null);
  const [addingDate, setAddingDate] = useState(false);
  const datesRef = useRef(null);

  useEffect(() => {
    base44.entities.LegalItem.list("created_date", 500)
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const todos = items.filter((i) => i.section === "todo");
  const dates = items.filter((i) => isDateSection(i.section));

  const { dated, undated } = useMemo(() => {
    const all = items.filter((d) => isDateSection(d.section) && !d.done).map((d) => computeDeadline(d));
    return {
      dated: all.filter((d) => d.dated).sort((a, b) => a.days - b.days),
      undated: all.filter((d) => !d.dated),
    };
  }, [items]);

  const addItem = async (item) => {
    const created = await base44.entities.LegalItem.create(item);
    setItems((p) => [...p, created]);
  };
  const updateItem = async (id, changes) => {
    await base44.entities.LegalItem.update(id, changes);
    setItems((p) => p.map((i) => (i.id === id ? { ...i, ...changes } : i)));
  };
  const deleteItem = async (id) => {
    await base44.entities.LegalItem.delete(id);
    setItems((p) => p.filter((i) => i.id !== id));
  };

  const scrollToDates = () => setTimeout(() => datesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  const editFromHero = (id) => {
    setAddingDate(false);
    setEditDateId(id);
    scrollToDates();
  };
  const addFromHero = () => {
    setEditDateId(null);
    setAddingDate(true);
    scrollToDates();
  };

  if (loading)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-ink/40" />
        <p className="mono-label text-[10px] text-ink/45">Loading legal</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Agency / Legal" rightText="Legal Management" />
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 md:px-8">
        <DeadlineHero dated={dated} undated={undated} onEdit={editFromHero} onAdd={addFromHero} />
        {/* Client Terms of Service: the portal clickwrap gate (docs/portal-terms.md). */}
        <div id="terms" className="scroll-mt-6"><ErrorBoundary where="terms admin"><TermsAdmin /></ErrorBoundary></div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div ref={datesRef} className="scroll-mt-6 lg:col-span-3">
            <DatesSection
              items={dates}
              editId={editDateId}
              setEditId={setEditDateId}
              adding={addingDate}
              setAdding={setAddingDate}
              onAdd={(i) => addItem({ ...i, section: "date" })}
              onUpdate={updateItem}
              onDelete={deleteItem}
            />
          </div>
          <div className="lg:col-span-2">
            <TodosSection items={todos} onAdd={(i) => addItem({ ...i, section: "todo" })} onUpdate={updateItem} onDelete={deleteItem} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ label, title, count, children }) {
  return (
    <section className="game-panel">
      <div className="flex items-end justify-between gap-3 border-b border-hair px-5 py-4">
        <div>
          <p className="mono-label text-[9.5px] text-ink/50">{label}</p>
          <h3 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-ink">{title}</h3>
        </div>
        {count !== undefined && <span className="font-mono text-xs text-ink/45">{String(count).padStart(2, "0")}</span>}
      </div>
      {children}
    </section>
  );
}

const iconBtn = "rounded p-1.5 text-ink/35 transition-colors hover:bg-ink/[0.05]";

function TodosSection({ items, onAdd, onUpdate, onDelete }) {
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState("");
  const open = items.filter((t) => !t.done);
  const ordered = [...open, ...items.filter((t) => t.done)];

  const saveNew = () => {
    if (!newTask.trim()) return;
    onAdd({ task: newTask.trim(), done: false });
    setAdding(false);
    setNewTask("");
  };
  const saveEdit = (id) => {
    onUpdate(id, { task: editVal });
    setEditId(null);
  };

  return (
    <Panel label={`${open.length} open · ${items.length - open.length} done`} title="Legal to-dos" count={open.length}>
      <ul className="divide-y divide-hair">
        {ordered.map((t) => (
          <li key={t.id} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink/[0.02]">
            <button
              onClick={() => onUpdate(t.id, { done: !t.done })}
              className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-all ${t.done ? "flame-bg border-transparent text-white" : "border-ink/25 hover:border-[#ff3c00]"}`}
              aria-label={t.done ? "Mark not done" : "Mark done"}
            >
              {t.done && <Check className="h-3 w-3" />}
            </button>
            {editId === t.id ? (
              <>
                <Input value={editVal} onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(t.id); if (e.key === "Escape") setEditId(null); }} className="h-8 flex-1 border-hair bg-paper text-sm text-ink" autoFocus />
                <button onClick={() => saveEdit(t.id)} className={`${iconBtn} text-green-700`}><Check className="h-3.5 w-3.5" /></button>
                <button onClick={() => setEditId(null)} className={iconBtn}><X className="h-3.5 w-3.5" /></button>
              </>
            ) : (
              <>
                <span className={`flex-1 text-sm ${t.done ? "text-ink/40 line-through" : "text-ink/85"}`}>{t.task}</span>
                <div className="flex opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                  <button onClick={() => { setEditId(t.id); setEditVal(t.task); }} className={`${iconBtn} hover:text-[#ff3c00]`} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => onDelete(t.id)} className={`${iconBtn} hover:text-red-600`} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </>
            )}
          </li>
        ))}
        {items.length === 0 && !adding && <li className="px-5 py-6 text-sm text-ink/45">No to-dos yet.</li>}
      </ul>
      <div className="border-t border-hair px-5 py-3">
        {adding ? (
          <div className="flex items-center gap-2">
            <Input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveNew(); if (e.key === "Escape") setAdding(false); }} className="h-8 flex-1 border-hair bg-paper text-sm text-ink" placeholder="New task…" autoFocus />
            <MicButton onResult={(t) => setNewTask((p) => p + (p ? " " : "") + t)} />
            <button onClick={saveNew} className={`${iconBtn} text-green-700`}><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => setAdding(false)} className={iconBtn}><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="mono-label inline-flex items-center gap-1.5 text-[10px] text-[#ff3c00] hover:text-[#e03500]"><Plus className="h-3.5 w-3.5" />Add task</button>
        )}
      </div>
    </Panel>
  );
}

function DateEditor({ initial, onSave, onCancel, autoFocusName }) {
  const start = toEditorValue(initial.dueDate);
  const [task, setTask] = useState(initial.task || "");
  const [iso, setIso] = useState(start.iso);
  const [annual, setAnnual] = useState(start.annual);
  const unparsed = initial.dueDate && !start.iso ? initial.dueDate : null;

  const save = () => {
    if (!task.trim()) return;
    const changes = { task: task.trim() };
    if (iso) changes.dueDate = toDueString(iso, annual);
    else if (!unparsed) changes.dueDate = "";
    onSave(changes);
  };

  return (
    <div className="space-y-3 bg-[#ff3c00]/[0.03] px-5 py-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input value={task} onChange={(e) => setTask(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onCancel(); }} className="h-9 flex-1 border-hair bg-paper text-sm text-ink" placeholder="e.g. Business License Renewal" autoFocus={autoFocusName} />
        <Input type="date" value={iso} onChange={(e) => setIso(e.target.value)} className="h-9 border-hair bg-paper text-sm text-ink sm:w-44" autoFocus={!autoFocusName} />
      </div>
      {unparsed && <p className="font-mono text-[11px] text-amber-700">Current text “{unparsed}” isn’t a date the countdown can read. Pick one above, or leave blank to keep it.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-ink/70">
          <input type="checkbox" checked={annual} onChange={(e) => setAnnual(e.target.checked)} className="h-3.5 w-3.5 accent-[#ff3c00]" />
          <Repeat className="h-3.5 w-3.5 text-ink/45" />Repeats every year
        </label>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="mono-label rounded-md border border-hair px-3 py-1.5 text-[10px] text-ink/60 hover:text-ink">Cancel</button>
          <button onClick={save} className="mono-label rounded-md flame-bg px-3 py-1.5 text-[10px] text-white">Save</button>
        </div>
      </div>
    </div>
  );
}

function DatesSection({ items, editId, setEditId, adding, setAdding, onAdd, onUpdate, onDelete }) {
  const rows = useMemo(() => {
    const all = items.map((d) => computeDeadline(d));
    return [...all.filter((r) => r.dated).sort((a, b) => a.days - b.days), ...all.filter((r) => !r.dated)];
  }, [items]);

  return (
    <Panel label="Renewals · filings · contracts" title="Important dates" count={items.length}>
      <div className="hidden grid-cols-[1fr_9rem_7rem_4.5rem] gap-3 border-b border-hair px-5 py-2 md:grid">
        {["Item", "Date", "Countdown", ""].map((h) => <span key={h} className="mono-label text-[9px] text-ink/45">{h}</span>)}
      </div>
      <ul className="divide-y divide-hair">
        {rows.map((r) => {
          const d = r.item;
          if (editId === d.id)
            return (
              <li key={d.id}>
                <DateEditor initial={d} onSave={(c) => { onUpdate(d.id, c); setEditId(null); }} onCancel={() => setEditId(null)} />
              </li>
            );
          const u = r.dated ? URGENCY[r.urgency] : null;
          return (
            <li key={d.id} className="group grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-5 py-3 transition-colors hover:bg-ink/[0.02] md:grid-cols-[1fr_9rem_7rem_4.5rem]">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink/90">{d.task || "Untitled"}</p>
                <p className="mono-label mt-0.5 text-[9px] text-ink/45">
                  {categoryOf(d)}
                  {r.recurring && " · yearly"}
                  {d.section === "deadline" && " · deadline"}
                </p>
              </div>
              <div className="order-3 col-span-2 font-mono text-[11px] text-ink/65 md:order-none md:col-span-1">
                {r.dated ? fmtDate(r.due) : (
                  <button onClick={() => setEditId(d.id)} className="text-[#ff3c00] hover:underline">{d.dueDate ? `“${d.dueDate}” · fix date` : "Add a date →"}</button>
                )}
              </div>
              <div className="order-4 col-span-2 md:order-none md:col-span-1">
                {r.dated ? (
                  <span className={`mono-label inline-block rounded border px-1.5 py-0.5 text-[9.5px] ${u.chip}`}>
                    {r.days === 0 ? "Today" : r.overdue ? `${-r.days}d overdue` : `${r.days}d`}
                  </span>
                ) : <span className="font-mono text-[11px] text-ink/30">—</span>}
              </div>
              <div className="flex justify-end opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                <button onClick={() => { setAdding(false); setEditId(d.id); }} className={`${iconBtn} hover:text-[#ff3c00]`} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => onDelete(d.id)} className={`${iconBtn} hover:text-red-600`} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </li>
          );
        })}
        {items.length === 0 && !adding && <li className="px-5 py-6 text-sm text-ink/45">No dates yet — add your first renewal or filing date.</li>}
      </ul>
      <div className="border-t border-hair">
        {adding ? (
          <DateEditor initial={{ task: "", dueDate: "" }} autoFocusName onSave={(c) => { onAdd(c); setAdding(false); }} onCancel={() => setAdding(false)} />
        ) : (
          <div className="px-5 py-3">
            <button onClick={() => { setEditId(null); setAdding(true); }} className="mono-label inline-flex items-center gap-1.5 text-[10px] text-[#ff3c00] hover:text-[#e03500]"><Plus className="h-3.5 w-3.5" />Add date</button>
          </div>
        )}
      </div>
    </Panel>
  );
}
