import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2, CalendarDays, Clock, CheckCircle2, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import MicButton from "../components/MicButton";
import PageHeader from "../components/PageHeader";
import CompleteTaskModal from "../components/CompleteTaskModal";
import TaskForm from "@/components/tasks/TaskForm";
import { CATEGORIES, TASK_STATUSES, STATUS_STYLES, EMPTY_FORM, toHours, formatTotal } from "@/lib/tasks";

const SUMMARY_META = {
  Priority: {
    solid: "bg-orange-500",
    grad: "from-orange-500 to-amber-400",
    text: "text-orange-400",
    textSoft: "text-orange-400/70",
    border: "border-orange-500/30",
    chip: "bg-orange-500/10 border-orange-500/25",
    glow: "shadow-[0_0_12px_rgba(255,106,0,0.35)]",
    dot: "bg-orange-500",
  },
  NextUp: {
    solid: "bg-yellow-400",
    grad: "from-yellow-400 to-amber-300",
    text: "text-yellow-300",
    textSoft: "text-yellow-300/70",
    border: "border-yellow-400/30",
    chip: "bg-yellow-400/10 border-yellow-400/25",
    glow: "shadow-[0_0_12px_rgba(250,204,21,0.30)]",
    dot: "bg-yellow-400",
  },
};

function TimeEstimateSummary({ items }) {
  const catData = CATEGORIES.map((cat) => {
    const catItems = items.filter((i) => i.category === cat && !i.done);
    const totalHours = catItems.reduce((sum, i) => sum + toHours(i.estimatedAmount, i.estimatedUnit), 0);
    const count = catItems.length;
    return { cat, totalHours, count };
  });

  const totalAll = catData.reduce((sum, d) => sum + d.totalHours, 0);
  const maxHours = Math.max(...catData.map((d) => d.totalHours), 1);

  return (
    <div className="relative overflow-hidden bg-card rounded-2xl border border-white/[0.07] p-5">
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-orange-500/[0.06] blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-10 w-40 h-40 rounded-full bg-yellow-400/[0.04] blur-3xl pointer-events-none" />

      <div className="relative flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(255,106,0,0.8)]" />
          <h2 className="font-display font-bold text-[11px] tracking-[0.25em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Time Estimate Overview</h2>
        </div>
        <span className="text-white/25 text-[10px] tracking-widest uppercase font-medium">
          {totalAll > 0 ? formatTotal(totalAll) : "—"} total
        </span>
      </div>

      <div className="relative space-y-5">
        {catData.map(({ cat, totalHours, count }) => {
          const pct = maxHours > 0 ? (totalHours / maxHours) * 100 : 0;
          const c = SUMMARY_META[cat];
          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <span className={`text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-md border ${c.chip} ${c.textSoft}`}>{cat}</span>
                  <span className="text-white/30 text-xs">{count} task{count !== 1 ? "s" : ""} remaining</span>
                </div>
                <span className={`text-sm font-bold ${c.text} drop-shadow`}>{totalHours > 0 ? formatTotal(totalHours) : "—"}</span>
              </div>
              <div className="relative h-2.5 w-full bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.04]">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${c.grad} ${c.glow} transition-all duration-700`}
                  style={{ width: `${pct}%` }}
                />
                <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)", opacity: 0.5 }} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="relative text-white/20 text-[10px] mt-4 tracking-wide">Based on estimated times for incomplete tasks only.</p>
    </div>
  );
}

export default function ToDo() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ ...EMPTY_FORM });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [completingTask, setCompletingTask] = useState(null);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem("todo_tab") || "active");

  useEffect(() => {
    base44.entities.ToDoItem.list("created_date", 500).then((data) => {
      setItems(data);
      setLoading(false);
    });
    base44.entities.CRMClient.list("business", 200).then(setClients);
  }, []);

  const setStatus = (item, status) => {
    if (status === "Completed") {
      setCompletingTask(item);
      return;
    }
    base44.entities.ToDoItem.update(item.id, { status, done: false });
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status, done: false } : i));
  };

  const handleConfirmComplete = async (timeData) => {
    const task = completingTask;
    setCompletingTask(null);
    await base44.entities.ToDoItem.update(task.id, { status: "Completed", done: true, ...timeData });
    setItems((prev) => prev.map((i) => i.id === task.id ? { ...i, status: "Completed", done: true, ...timeData } : i));
  };

  const add = async () => {
    if (!newForm.title.trim()) return;
    const created = await base44.entities.ToDoItem.create({
      ...newForm,
      price: parseFloat(newForm.price) || null,
      estimatedAmount: parseFloat(newForm.estimatedAmount) || null,
      status: "Pending",
      done: false,
    });
    setItems((prev) => [...prev, created]);
    setNewForm({ ...EMPTY_FORM });
    setAdding(false);
  };

  const startEdit = (item) => { setEditId(item.id); setEditForm({ ...item }); };

  const saveEdit = async () => {
    const { id, created_date, updated_date, created_by, ...fields } = editForm;
    const updated = { ...fields, price: parseFloat(editForm.price) || null, estimatedAmount: parseFloat(editForm.estimatedAmount) || null };
    await base44.entities.ToDoItem.update(id, updated);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...updated } : i));
    setEditId(null);
  };

  const del = async (id) => {
    await base44.entities.ToDoItem.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const activeItems = items.filter((i) => !i.done);
  const doneItems = items.filter((i) => i.done).sort((a, b) => new Date(b.completedDate || b.updated_date) - new Date(a.completedDate || a.updated_date));

  const byPriceDesc = (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0);
  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = activeItems.filter((i) => i.category === cat).sort(byPriceDesc);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      {completingTask && (
        <CompleteTaskModal
          task={completingTask}
          onConfirm={handleConfirmComplete}
          onCancel={() => setCompletingTask(null)}
        />
      )}
      <PageHeader breadcrumb="Command Center / To-Do" rightText="Master Task List" />
      <div className="px-8 py-6 space-y-6">
        <TimeEstimateSummary items={items} />

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); localStorage.setItem("todo_tab", v); }} className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-card border border-white/[0.06]">
              <TabsTrigger value="active" className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-500 text-white/40 gap-2">
                Active <span className="text-[10px] opacity-60">({activeItems.length})</span>
              </TabsTrigger>
              <TabsTrigger value="done" className="data-[state=active]:bg-green-500/15 data-[state=active]:text-green-400 text-white/40 gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> Done <span className="text-[10px] opacity-60">({doneItems.length})</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-0">
              <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-black font-semibold shadow-[0_0_14px_rgba(255,106,0,0.25)] text-xs font-semibold rounded-lg transition-colors">
                <Plus className="w-4 h-4" />Add Task
              </button>
            </TabsContent>
          </div>

          <TabsContent value="active">
            {adding && (
              <div className="mb-6">
                <TaskForm form={newForm} setForm={setNewForm} onSave={add} onCancel={() => { setAdding(false); setNewForm({ ...EMPTY_FORM }); }} title="New Task" clients={clients} />
              </div>
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
                    onDelete={del}
                    onSetStatus={setStatus}
                    clients={clients}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="done">
            <DoneTab items={doneItems} onDelete={del} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function DoneTab({ items, onDelete }) {
  if (items.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-white/[0.06] p-12 text-center">
        <CheckCircle2 className="w-8 h-8 text-white/10 mx-auto mb-3" />
        <p className="text-white/25 text-sm">No completed tasks yet. Complete a task to see it here.</p>
      </div>
    );
  }

  const totalActualHours = items.reduce((sum, i) => sum + toHours(i.actualAmount, i.actualUnit), 0);
  const totalEstHours = items.reduce((sum, i) => sum + toHours(i.estimatedAmount, i.estimatedUnit), 0);

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="game-panel p-4 text-center">
          <p className="text-green-400 text-2xl font-bold">{items.length}</p>
          <p className="text-white/30 text-xs mt-1 uppercase tracking-wider">Tasks Completed</p>
        </div>
        <div className="game-panel p-4 text-center">
          <p className="text-orange-400 text-2xl font-bold">{totalActualHours > 0 ? formatTotal(totalActualHours) : "—"}</p>
          <p className="text-white/30 text-xs mt-1 uppercase tracking-wider">Actual Time Logged</p>
        </div>
        <div className="game-panel p-4 text-center">
          <p className="text-blue-400 text-2xl font-bold">{totalEstHours > 0 ? formatTotal(totalEstHours) : "—"}</p>
          <p className="text-white/30 text-xs mt-1 uppercase tracking-wider">Total Estimated Time</p>
        </div>
      </div>

      {/* Completed task list */}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-card rounded-xl border border-green-500/10 p-4 flex items-start gap-4 group">
            <div className="w-5 h-5 rounded border bg-green-500/20 border-green-500/40 flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-3 h-3 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/60 line-through">{item.title}</p>
              {item.description && <p className="text-white/25 text-xs mt-0.5">{item.description}</p>}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${item.category === "Priority" ? "text-red-400/60 border-red-500/20" : "text-blue-400/60 border-blue-500/20"}`}>
                  {item.category}
                </span>
                {item.completedDate && (
                  <span className="flex items-center gap-1 text-green-500/50 text-[10px]">
                    <CheckCircle2 className="w-3 h-3" />
                    Completed {new Date(item.completedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
                {item.actualAmount && item.actualUnit && (
                  <span className="flex items-center gap-1 text-orange-500/50 text-[10px]">
                    <Clock className="w-3 h-3" />Actual: {item.actualAmount} {item.actualUnit}
                  </span>
                )}
                {item.estimatedAmount && item.estimatedUnit && (
                  <span className="flex items-center gap-1 text-white/20 text-[10px]">
                    <Clock className="w-3 h-3" />Est: {item.estimatedAmount} {item.estimatedUnit}
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => onDelete(item.id)} className="p-1.5 text-white/15 hover:text-red-400/60 opacity-0 group-hover:opacity-100 transition-all shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategorySection({ category, items, editId, editForm, setEditForm, onEdit, onSaveEdit, onCancelEdit, onDelete, onSetStatus, clients }) {
  const catColor = category === "Priority" ? "text-orange-400/80 bg-orange-500/10 border-orange-500/25" : "text-yellow-300/80 bg-yellow-400/10 border-yellow-400/25";

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">{category}</h2>
        <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded border ${catColor}`}>{items.length} task{items.length !== 1 ? "s" : ""}</span>
      </div>
      {items.length === 0 ? (
        <div className="game-panel p-6 text-center">
          <p className="text-white/20 text-sm">No {category} tasks yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            if (editId === item.id) {
              return <TaskForm key={item.id} form={editForm} setForm={setEditForm} onSave={onSaveEdit} onCancel={onCancelEdit} title="Edit Task" inline={true} clients={clients} />;
            }
            return <TaskRow key={item.id} item={item} onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)} onSetStatus={(s) => onSetStatus(item, s)} />;
          })}
        </div>
      )}
    </div>
  );
}

function TaskRow({ item, onEdit, onDelete, onSetStatus }) {
  const currentStatus = item.status || "Pending";
  return (
    <div className="card-hover game-panel p-4 flex items-start gap-4 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/85">{item.title}</p>
        {item.description && <p className="text-white/35 text-xs mt-1 leading-relaxed">{item.description}</p>}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {Number(item.price) > 0 && (
            <span className="flex items-center gap-1 text-green-400 text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.25)]">
              <DollarSign className="w-3 h-3" />{Number(item.price).toLocaleString()}
            </span>
          )}
          {item.taskType && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/15 text-white/55">
              {item.taskType}
            </span>
          )}
          {item.assignedTo && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400/80">
              {item.assignedTo}
            </span>
          )}
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
        <div className="flex gap-1.5 mt-2.5">
          {TASK_STATUSES.map((s) => (
            <button key={s} onClick={() => onSetStatus(s)} className={`px-2.5 py-0.5 rounded text-[10px] font-medium border transition-all ${currentStatus === s ? STATUS_STYLES[s] : "text-white/20 border-transparent hover:text-white/40"}`}>{s}</button>
          ))}
        </div>
      </div>
      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
        <button onClick={onEdit} className="p-1.5 text-white/20 hover:text-white/60 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
        <button onClick={onDelete} className="p-1.5 text-white/20 hover:text-red-400/60 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}