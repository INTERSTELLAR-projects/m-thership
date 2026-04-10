import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2, CheckSquare, Square, CalendarDays, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";

const CATEGORIES = ["Priority", "NextUp"];
const EST_UNITS = ["Hours", "Days", "Weeks", "Months"];

const TO_HOURS = { Hours: 1, Days: 8, Weeks: 40, Months: 160 };

function toHours(amount, unit) {
  return (parseFloat(amount) || 0) * (TO_HOURS[unit] || 1);
}

function formatTotal(hours) {
  if (hours >= 160) return `${(hours / 160).toFixed(1)} months`;
  if (hours >= 40) return `${(hours / 40).toFixed(1)} weeks`;
  if (hours >= 8) return `${(hours / 8).toFixed(1)} days`;
  return `${hours.toFixed(0)} hours`;
}

function TimeEstimateSummary({ items }) {
  const catData = CATEGORIES.map((cat) => {
    const catItems = items.filter((i) => i.category === cat && !i.done);
    const totalHours = catItems.reduce((sum, i) => sum + toHours(i.estimatedAmount, i.estimatedUnit), 0);
    const count = catItems.length;
    return { cat, totalHours, count };
  });

  const maxHours = Math.max(...catData.map((d) => d.totalHours), 1);
  const catColors = { Priority: { bar: "bg-red-500/60", text: "text-red-400/80", border: "border-red-500/20" }, NextUp: { bar: "bg-blue-500/60", text: "text-blue-400/80", border: "border-blue-500/20" } };

  return (
    <div className="bg-card rounded-xl border border-white/[0.06] p-5">
      <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase mb-4">Time Estimate Overview</h2>
      <div className="space-y-4">
        {catData.map(({ cat, totalHours, count }) => {
          const pct = maxHours > 0 ? (totalHours / maxHours) * 100 : 0;
          const colors = catColors[cat];
          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded border ${colors.border} ${colors.text}`}>{cat}</span>
                  <span className="text-white/25 text-xs">{count} task{count !== 1 ? "s" : ""} remaining</span>
                </div>
                <span className={`text-sm font-bold ${colors.text}`}>{totalHours > 0 ? formatTotal(totalHours) : "—"}</span>
              </div>
              <div className="h-2.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-white/20 text-[10px] mt-3">Based on estimated times for incomplete tasks only.</p>
    </div>
  );
}

const EMPTY_FORM = { title: "", description: "", category: "Priority", dueDate: "", estimatedAmount: "", estimatedUnit: "Hours" };

export default function ToDo() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ ...EMPTY_FORM });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    base44.entities.ToDoItem.list("created_date", 500).then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  const add = async () => {
    if (!newForm.title.trim()) return;
    const created = await base44.entities.ToDoItem.create({
      ...newForm,
      estimatedAmount: parseFloat(newForm.estimatedAmount) || null,
      done: false,
    });
    setItems((prev) => [...prev, created]);
    setNewForm({ ...EMPTY_FORM });
    setAdding(false);
  };

  const startEdit = (item) => { setEditId(item.id); setEditForm({ ...item }); };

  const saveEdit = async () => {
    const { id, created_date, updated_date, created_by, ...fields } = editForm;
    const updated = { ...fields, estimatedAmount: parseFloat(editForm.estimatedAmount) || null };
    await base44.entities.ToDoItem.update(id, updated);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...updated } : i));
    setEditId(null);
  };

  const toggleDone = async (item) => {
    await base44.entities.ToDoItem.update(item.id, { done: !item.done });
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, done: !i.done } : i));
  };

  const del = async (id) => {
    await base44.entities.ToDoItem.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = items.filter((i) => i.category === cat);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command Center / To-Do" rightText="Master Task List" />
      <div className="px-8 py-6 space-y-6">
        <div className="flex justify-end">
          <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors">
            <Plus className="w-4 h-4" />Add Task
          </button>
        </div>

        <TimeEstimateSummary items={items} />

        {adding && (
          <TaskForm form={newForm} setForm={setNewForm} onSave={add} onCancel={() => { setAdding(false); setNewForm({ ...EMPTY_FORM }); }} title="New Task" />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-white/20 animate-spin" /></div>
        ) : (
          <div className="space-y-8">
            {CATEGORIES.map((cat) => (
              <CategorySection
                key={cat}
                category={cat}
                items={grouped[cat] || []}
                editId={editId}
                editForm={editForm}
                setEditForm={setEditForm}
                onEdit={startEdit}
                onSaveEdit={saveEdit}
                onCancelEdit={() => setEditId(null)}
                onToggleDone={toggleDone}
                onDelete={del}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CategorySection({ category, items, editId, editForm, setEditForm, onEdit, onSaveEdit, onCancelEdit, onToggleDone, onDelete }) {
  const done = items.filter((i) => i.done).length;
  const catColor = category === "Priority" ? "text-red-400/70 bg-red-400/10 border-red-400/15" : "text-blue-400/70 bg-blue-400/10 border-blue-400/15";

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase">{category}</h2>
        <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded border ${catColor}`}>{done}/{items.length} done</span>
      </div>
      {items.length === 0 ? (
        <div className="bg-card rounded-xl border border-white/[0.06] p-6 text-center">
          <p className="text-white/20 text-sm">No {category} tasks yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            editId === item.id ? (
              <TaskForm key={item.id} form={editForm} setForm={setEditForm} onSave={onSaveEdit} onCancel={onCancelEdit} title="Edit Task" inline />
            ) : (
              <TaskRow key={item.id} item={item} onEdit={() => onEdit(item)} onToggleDone={() => onToggleDone(item)} onDelete={() => onDelete(item.id)} />
            )
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ item, onEdit, onToggleDone, onDelete }) {
  return (
    <div className={`bg-card rounded-xl border p-4 flex items-start gap-4 group transition-all ${item.done ? "border-green-500/10 opacity-60" : "border-white/[0.06] hover:border-orange-500/15"}`}>
      <button onClick={onToggleDone} className="mt-0.5 shrink-0 text-white/25 hover:text-orange-500/70 transition-colors">
        {item.done ? <CheckSquare className="w-4 h-4 text-green-400/70" /> : <Square className="w-4 h-4" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${item.done ? "text-white/30 line-through" : "text-white/85"}`}>{item.title}</p>
        {item.description && <p className="text-white/35 text-xs mt-1 leading-relaxed">{item.description}</p>}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {item.dueDate && (
            <span className="flex items-center gap-1 text-orange-500/60 text-[10px] font-medium">
              <CalendarDays className="w-3 h-3" />Due {new Date(item.dueDate + 'T00:00:00').toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
          {item.estimatedAmount && item.estimatedUnit && (
            <span className="flex items-center gap-1 text-white/30 text-[10px]">
              <Clock className="w-3 h-3" />{item.estimatedAmount} {item.estimatedUnit}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
        <button onClick={onEdit} className="p-1.5 text-white/20 hover:text-white/60 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
        <button onClick={onDelete} className="p-1.5 text-white/20 hover:text-red-400/60 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

function TaskForm({ form, setForm, onSave, onCancel, title, inline }) {
  return (
    <div className={`bg-card rounded-xl border border-orange-500/20 p-5 space-y-3 ${inline ? "" : ""}`}>
      <h3 className="text-white font-bold text-xs tracking-[0.15em] uppercase">{title}</h3>
      <div>
        <Label className="text-white/40 text-xs">Title</Label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Task title..." className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 mt-1" autoFocus />
      </div>
      <div>
        <Label className="text-white/40 text-xs">Description (optional)</Label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Add more detail..." className="w-full mt-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none resize-none min-h-[60px]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-white/40 text-xs">Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-white/[0.06]">
              {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-white/70">{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-white/40 text-xs">Due Date</Label>
          <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="bg-white/[0.04] border-white/[0.08] text-white mt-1 h-9" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-white/40 text-xs">Est. Time (amount)</Label>
          <Input type="number" min="0" value={form.estimatedAmount} onChange={(e) => setForm({ ...form, estimatedAmount: e.target.value })} placeholder="e.g. 3" className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 mt-1 h-9" />
        </div>
        <div>
          <Label className="text-white/40 text-xs">Est. Unit</Label>
          <Select value={form.estimatedUnit} onValueChange={(v) => setForm({ ...form, estimatedUnit: v })}>
            <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-white/[0.06]">
              {EST_UNITS.map((u) => <SelectItem key={u} value={u} className="text-white/70">{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onSave} className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors"><Check className="w-3.5 h-3.5" />Save Task</button>
        <button onClick={onCancel} className="px-4 py-2 text-white/30 hover:text-white/60 text-xs transition-colors">Cancel</button>
      </div>
    </div>
  );
}