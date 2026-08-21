import { useState, useEffect } from "react";
import { Plus, CheckSquare, CalendarDays, Trash2, Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import MicButton from "../components/MicButton";
import GlowCard from "../components/game/GlowCard";
import SectionTitle from "../components/game/SectionTitle";
import StatTile from "../components/game/StatTile";

const DEFAULT_TODOS = [
  { section: "todo", task: "Review updated contractor agreement", done: false },
  { section: "todo", task: "Update privacy policy for new data regulations", done: false },
  { section: "todo", task: "File Q1 state taxes", done: true },
  { section: "todo", task: "Renew cyber liability insurance", done: false },
];
const DEFAULT_DATES = [
  { section: "date", task: "Business License Renewal", dueDate: "Jun 30, 2026" },
  { section: "date", task: "Annual Insurance Review", dueDate: "May 15, 2026" },
  { section: "date", task: "Tax Filing Deadline", dueDate: "Apr 15, 2026" },
  { section: "date", task: "Contract Renewal - NW Tree Service", dueDate: "Jul 01, 2026" },
];

export default function Legal() {
  const [todos, setTodos] = useState([]);
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.LegalItem.list("created_date", 500).then(async (data) => {
      if (data.length === 0) {
        const all = [...DEFAULT_TODOS, ...DEFAULT_DATES];
        const created = await base44.entities.LegalItem.bulkCreate(all);
        setTodos(created.filter((i) => i.section === "todo"));
        setDates(created.filter((i) => i.section === "date"));
      } else {
        setTodos(data.filter((i) => i.section === "todo"));
        setDates(data.filter((i) => i.section === "date"));
      }
      setLoading(false);
    });
  }, []);

  const addItem = async (item) => {
    const created = await base44.entities.LegalItem.create(item);
    if (item.section === "todo") setTodos((p) => [...p, created]);
    if (item.section === "date") setDates((p) => [...p, created]);
  };

  const updateItem = async (id, changes, section) => {
    await base44.entities.LegalItem.update(id, changes);
    if (section === "todo") setTodos((p) => p.map((i) => i.id === id ? { ...i, ...changes } : i));
    if (section === "date") setDates((p) => p.map((i) => i.id === id ? { ...i, ...changes } : i));
  };

  const deleteItem = async (id, section) => {
    await base44.entities.LegalItem.delete(id);
    if (section === "todo") setTodos((p) => p.filter((i) => i.id !== id));
    if (section === "date") setDates((p) => p.filter((i) => i.id !== id));
  };

  const openCount = todos.filter((t) => !t.done).length;
  const doneCount = todos.filter((t) => t.done).length;

  if (loading) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
      <p className="text-white/25 text-[10px] tracking-[0.3em] uppercase font-display">Initializing Legal Ops</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command Center / Legal" rightText="Legal Management" />
      <div className="px-8 py-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <StatTile label="Open To-Dos" value={openCount} color="orange" />
          <StatTile label="Important Dates" value={dates.length} color="yellow" />
          <StatTile label="Completed" value={doneCount} color="green" />
        </div>
        <TodosSection items={todos} onAdd={(i) => addItem({ ...i, section: "todo" })} onUpdate={(id, c) => updateItem(id, c, "todo")} onDelete={(id) => deleteItem(id, "todo")} />
        <DatesSection items={dates} onAdd={(i) => addItem({ ...i, section: "date" })} onUpdate={(id, c) => updateItem(id, c, "date")} onDelete={(id) => deleteItem(id, "date")} />
      </div>
    </div>
  );
}

function TodosSection({ items, onAdd, onUpdate, onDelete }) {
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState("");

  return (
    <GlowCard>
      <SectionTitle icon={CheckSquare} title="Legal To-Do List" count={items.filter((t) => !t.done).length} className="mb-4" />
      <div className="space-y-0.5">
        {items.map((t) => (
          <div key={t.id} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0 group hover:bg-orange-500/[0.02] -mx-2 px-2 rounded-lg transition-colors">
            <button onClick={() => onUpdate(t.id, { done: !t.done })} className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${t.done ? "bg-gradient-to-br from-orange-500 to-amber-400 border-orange-500/40 text-black" : "border-white/15 hover:border-orange-500/50"}`}>
              {t.done && <Check className="w-3 h-3" />}
            </button>
            {editId === t.id ? (
              <>
                <Input value={editVal} onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { onUpdate(t.id, { task: editVal }); setEditId(null); } if (e.key === "Escape") setEditId(null); }} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" autoFocus />
                <button onClick={() => { onUpdate(t.id, { task: editVal }); setEditId(null); }} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setEditId(null)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
              </>
            ) : (
              <>
                <span className={`text-sm flex-1 ${t.done ? "text-white/30 line-through" : "text-white/75"}`}>{t.task}</span>
                <button onClick={() => { setEditId(t.id); setEditVal(t.task); }} className="p-1 text-white/15 hover:text-orange-400/70 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3 h-3" /></button>
                <button onClick={() => onDelete(t.id)} className="p-1 text-white/15 hover:text-red-400/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
              </>
            )}
          </div>
        ))}
        {adding ? (
          <div className="flex items-center gap-2 pt-3">
            <Input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { if (newTask.trim()) { onAdd({ task: newTask.trim(), done: false }); setAdding(false); setNewTask(""); } } if (e.key === "Escape") setAdding(false); }} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" placeholder="New task..." autoFocus />
            <MicButton onResult={(t) => setNewTask((p) => p + (p ? " " : "") + t)} />
            <button onClick={() => { if (newTask.trim()) { onAdd({ task: newTask.trim(), done: false }); setAdding(false); setNewTask(""); } }} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setAdding(false)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-orange-300/60 hover:text-orange-300 text-xs pt-3 transition-colors"><Plus className="w-3.5 h-3.5" />Add task</button>
        )}
      </div>
    </GlowCard>
  );
}

function DatesSection({ items, onAdd, onUpdate, onDelete }) {
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState({});
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState({ task: "", dueDate: "" });

  return (
    <GlowCard>
      <SectionTitle icon={CalendarDays} title="Important Dates" count={items.length} className="mb-4" />
      <div className="grid grid-cols-2 gap-3">
        {items.map((d) => editId === d.id ? (
          <div key={d.id} className="flex items-center gap-2 py-2 px-3 bg-white/[0.02] rounded-lg border border-orange-500/30">
            <Input value={editVal.task} onChange={(e) => setEditVal({ ...editVal, task: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" placeholder="Event" />
            <Input value={editVal.dueDate} onChange={(e) => setEditVal({ ...editVal, dueDate: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs w-28" placeholder="Date" />
            <button onClick={() => { onUpdate(d.id, editVal); setEditId(null); }} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setEditId(null)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <div key={d.id} className="relative overflow-hidden flex items-center justify-between py-2.5 px-3.5 bg-white/[0.02] rounded-lg border border-white/[0.06] hover:border-orange-500/30 hover:bg-orange-500/[0.03] transition-all group">
            <div className="absolute -left-6 -top-6 w-14 h-14 rounded-full bg-orange-500/[0.05] blur-2xl pointer-events-none" />
            <span className="relative text-white/75 text-sm">{d.task}</span>
            <div className="relative flex items-center gap-2">
              <span className="text-[11px] font-display font-bold tracking-wider px-2 py-1 rounded bg-gradient-to-r from-orange-500/15 to-amber-400/10 border border-orange-500/20 text-orange-300">{d.dueDate}</span>
              <button onClick={() => { setEditId(d.id); setEditVal({ task: d.task, dueDate: d.dueDate }); }} className="p-1 text-white/15 hover:text-orange-400/70 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3 h-3" /></button>
              <button onClick={() => onDelete(d.id)} className="p-1 text-white/15 hover:text-red-400/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
        {adding ? (
          <div className="flex items-center gap-2 py-2 px-3 bg-white/[0.02] rounded-lg border border-orange-500/30">
            <Input value={newVal.task} onChange={(e) => setNewVal({ ...newVal, task: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" placeholder="Event name" autoFocus />
            <Input value={newVal.dueDate} onChange={(e) => setNewVal({ ...newVal, dueDate: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs w-28" placeholder="Date" />
            <button onClick={() => { if (newVal.task) { onAdd(newVal); setAdding(false); setNewVal({ task: "", dueDate: "" }); } }} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setAdding(false)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="relative flex items-center gap-2 py-2 px-3 bg-white/[0.02] rounded-lg border border-dashed border-orange-500/20 text-orange-300/50 hover:text-orange-300/80 hover:border-orange-500/40 transition-all text-xs"><Plus className="w-3.5 h-3.5" />Add date</button>
        )}
      </div>
    </GlowCard>
  );
}