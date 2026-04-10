import { useState, useEffect } from "react";
import { Plus, Clock, CheckSquare, CalendarDays, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import MicButton from "../components/MicButton";

const DEFAULT_DEADLINES = [
  { section: "deadline", task: "Annual Business License Renewal", dueDate: "Jun 30, 2026", status: "Upcoming" },
  { section: "deadline", task: "Insurance Policy Review", dueDate: "May 15, 2026", status: "Upcoming" },
  { section: "deadline", task: "Tax Filing (Federal)", dueDate: "Apr 15, 2026", status: "Urgent" },
];
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
  const [deadlines, setDeadlines] = useState([]);
  const [todos, setTodos] = useState([]);
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.LegalItem.list("created_date", 500).then(async (data) => {
      if (data.length === 0) {
        // Seed defaults
        const all = [...DEFAULT_DEADLINES, ...DEFAULT_TODOS, ...DEFAULT_DATES];
        const created = await base44.entities.LegalItem.bulkCreate(all);
        setDeadlines(created.filter((i) => i.section === "deadline"));
        setTodos(created.filter((i) => i.section === "todo"));
        setDates(created.filter((i) => i.section === "date"));
      } else {
        setDeadlines(data.filter((i) => i.section === "deadline"));
        setTodos(data.filter((i) => i.section === "todo"));
        setDates(data.filter((i) => i.section === "date"));
      }
      setLoading(false);
    });
  }, []);

  const addItem = async (item) => {
    const created = await base44.entities.LegalItem.create(item);
    if (item.section === "deadline") setDeadlines((p) => [...p, created]);
    if (item.section === "todo") setTodos((p) => [...p, created]);
    if (item.section === "date") setDates((p) => [...p, created]);
  };

  const updateItem = async (id, changes, section) => {
    await base44.entities.LegalItem.update(id, changes);
    if (section === "deadline") setDeadlines((p) => p.map((i) => i.id === id ? { ...i, ...changes } : i));
    if (section === "todo") setTodos((p) => p.map((i) => i.id === id ? { ...i, ...changes } : i));
    if (section === "date") setDates((p) => p.map((i) => i.id === id ? { ...i, ...changes } : i));
  };

  const deleteItem = async (id, section) => {
    await base44.entities.LegalItem.delete(id);
    if (section === "deadline") setDeadlines((p) => p.filter((i) => i.id !== id));
    if (section === "todo") setTodos((p) => p.filter((i) => i.id !== id));
    if (section === "date") setDates((p) => p.filter((i) => i.id !== id));
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command Center / Legal" rightText="Legal Management" />
      <div className="px-8 py-6 space-y-4">
        <DeadlinesSection items={deadlines} onAdd={(i) => addItem({ ...i, section: "deadline" })} onUpdate={(id, c) => updateItem(id, c, "deadline")} onDelete={(id) => deleteItem(id, "deadline")} />
        <TodosSection items={todos} onAdd={(i) => addItem({ ...i, section: "todo" })} onUpdate={(id, c) => updateItem(id, c, "todo")} onDelete={(id) => deleteItem(id, "todo")} />
        <DatesSection items={dates} onAdd={(i) => addItem({ ...i, section: "date" })} onUpdate={(id, c) => updateItem(id, c, "date")} onDelete={(id) => deleteItem(id, "date")} />
      </div>
    </div>
  );
}

function DeadlinesSection({ items, onAdd, onUpdate, onDelete }) {
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState({});
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState({ task: "", dueDate: "", status: "Upcoming" });

  return (
    <Section title="Compliance Deadlines" icon={Clock}>
      <div className="space-y-1">
        {items.map((d) => editId === d.id ? (
          <div key={d.id} className="space-y-1.5 py-2">
            <Input value={editVal.task} onChange={(e) => setEditVal({ ...editVal, task: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs" placeholder="Task" />
            <div className="flex gap-2">
              <Input value={editVal.dueDate} onChange={(e) => setEditVal({ ...editVal, dueDate: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" placeholder="Due date" />
              <Select value={editVal.status} onValueChange={(v) => setEditVal({ ...editVal, status: v })}>
                <SelectTrigger className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs w-28"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-white/[0.06]">
                  {["Upcoming", "Urgent", "Complete"].map((s) => <SelectItem key={s} value={s} className="text-white/70">{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <button onClick={() => { onUpdate(d.id, editVal); setEditId(null); }} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setEditId(null)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ) : (
          <div key={d.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0 group">
            <div><p className="text-white/75 text-sm">{d.task}</p><p className="text-white/20 text-xs mt-0.5">Due: {d.dueDate}</p></div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded ${d.status === "Urgent" ? "text-red-400/70 bg-red-400/10" : d.status === "Complete" ? "text-green-400/70 bg-green-400/10" : "text-orange-400/70 bg-orange-400/10"}`}>{d.status}</span>
              <button onClick={() => { setEditId(d.id); setEditVal({ task: d.task, dueDate: d.dueDate, status: d.status }); }} className="p-1 text-white/15 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3 h-3" /></button>
              <button onClick={() => onDelete(d.id)} className="p-1 text-white/15 hover:text-red-400/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
        {adding ? (
          <div className="space-y-1.5 pt-2">
            <Input value={newVal.task} onChange={(e) => setNewVal({ ...newVal, task: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs" placeholder="Task" autoFocus />
            <div className="flex gap-2">
              <Input value={newVal.dueDate} onChange={(e) => setNewVal({ ...newVal, dueDate: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" placeholder="Due date" />
              <Select value={newVal.status} onValueChange={(v) => setNewVal({ ...newVal, status: v })}>
                <SelectTrigger className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs w-28"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-white/[0.06]">
                  {["Upcoming", "Urgent", "Complete"].map((s) => <SelectItem key={s} value={s} className="text-white/70">{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <button onClick={() => { if (newVal.task) { onAdd(newVal); setAdding(false); setNewVal({ task: "", dueDate: "", status: "Upcoming" }); } }} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setAdding(false)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-white/20 hover:text-white/50 text-xs pt-2 transition-colors"><Plus className="w-3.5 h-3.5" />Add deadline</button>
        )}
      </div>
    </Section>
  );
}

function TodosSection({ items, onAdd, onUpdate, onDelete }) {
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState("");

  return (
    <Section title="Legal To-Do List" icon={CheckSquare}>
      <div className="space-y-1">
        {items.map((t) => (
          <div key={t.id} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0 group">
            <button onClick={() => onUpdate(t.id, { done: !t.done })} className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${t.done ? "bg-orange-500/20 border-orange-500/40" : "border-white/15"}`}>
              {t.done && <Check className="w-3 h-3 text-orange-500" />}
            </button>
            {editId === t.id ? (
              <>
                <Input value={editVal} onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { onUpdate(t.id, { task: editVal }); setEditId(null); } if (e.key === "Escape") setEditId(null); }} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" autoFocus />
                <button onClick={() => { onUpdate(t.id, { task: editVal }); setEditId(null); }} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setEditId(null)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
              </>
            ) : (
              <>
                <span className={`text-sm flex-1 ${t.done ? "text-white/30 line-through" : "text-white/70"}`}>{t.task}</span>
                <button onClick={() => { setEditId(t.id); setEditVal(t.task); }} className="p-1 text-white/15 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3 h-3" /></button>
                <button onClick={() => onDelete(t.id)} className="p-1 text-white/15 hover:text-red-400/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
              </>
            )}
          </div>
        ))}
        {adding ? (
          <div className="flex items-center gap-2 pt-2">
            <Input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { if (newTask.trim()) { onAdd({ task: newTask.trim(), done: false }); setAdding(false); setNewTask(""); } } if (e.key === "Escape") setAdding(false); }} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" placeholder="New task..." autoFocus />
            <MicButton onResult={(t) => setNewTask((p) => p + (p ? " " : "") + t)} />
            <button onClick={() => { if (newTask.trim()) { onAdd({ task: newTask.trim(), done: false }); setAdding(false); setNewTask(""); } }} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setAdding(false)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-white/20 hover:text-white/50 text-xs pt-2 transition-colors"><Plus className="w-3.5 h-3.5" />Add task</button>
        )}
      </div>
    </Section>
  );
}

function DatesSection({ items, onAdd, onUpdate, onDelete }) {
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState({});
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState({ task: "", dueDate: "" });

  return (
    <Section title="Important Dates" icon={CalendarDays}>
      <div className="grid grid-cols-2 gap-3">
        {items.map((d) => editId === d.id ? (
          <div key={d.id} className="flex items-center gap-2 py-2 px-3 bg-white/[0.02] rounded-lg border border-orange-500/20">
            <Input value={editVal.task} onChange={(e) => setEditVal({ ...editVal, task: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" placeholder="Event" />
            <Input value={editVal.dueDate} onChange={(e) => setEditVal({ ...editVal, dueDate: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs w-28" placeholder="Date" />
            <button onClick={() => { onUpdate(d.id, editVal); setEditId(null); }} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setEditId(null)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <div key={d.id} className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-lg border border-white/[0.04] group">
            <span className="text-white/60 text-sm">{d.task}</span>
            <div className="flex items-center gap-1">
              <span className="text-orange-500/60 text-xs font-medium">{d.dueDate}</span>
              <button onClick={() => { setEditId(d.id); setEditVal({ task: d.task, dueDate: d.dueDate }); }} className="p-1 text-white/15 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3 h-3" /></button>
              <button onClick={() => onDelete(d.id)} className="p-1 text-white/15 hover:text-red-400/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
        {adding ? (
          <div className="flex items-center gap-2 py-2 px-3 bg-white/[0.02] rounded-lg border border-orange-500/20">
            <Input value={newVal.task} onChange={(e) => setNewVal({ ...newVal, task: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" placeholder="Event name" autoFocus />
            <Input value={newVal.dueDate} onChange={(e) => setNewVal({ ...newVal, dueDate: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs w-28" placeholder="Date" />
            <button onClick={() => { if (newVal.task) { onAdd(newVal); setAdding(false); setNewVal({ task: "", dueDate: "" }); } }} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setAdding(false)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="flex items-center gap-2 py-2 px-3 bg-white/[0.02] rounded-lg border border-dashed border-white/[0.06] text-white/20 hover:text-white/50 hover:border-white/[0.12] transition-all text-xs"><Plus className="w-3.5 h-3.5" />Add date</button>
        )}
      </div>
    </Section>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-card rounded-xl border border-white/[0.06] p-5">
      <div className="flex items-center gap-2 mb-4"><Icon className="w-4 h-4 text-orange-500/40" /><h3 className="text-white font-bold text-xs tracking-[0.15em] uppercase">{title}</h3></div>
      {children}
    </div>
  );
}