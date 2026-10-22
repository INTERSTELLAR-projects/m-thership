import { useState, useEffect } from "react";
import { Loader2, Zap, Hammer, Smartphone, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import CompleteTaskModal from "@/components/CompleteTaskModal";
import PriorityTaskCard from "@/components/dashboard/PriorityTaskCard";
import TaskForm from "@/components/tasks/TaskForm";
import { EMPTY_FORM } from "@/lib/tasks";

export default function PriorityTasks() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completingTask, setCompletingTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [addingTask, setAddingTask] = useState(false);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });
  const [clients, setClients] = useState([]);

  useEffect(() => {
    base44.entities.ToDoItem.filter({ category: "Priority", done: false }, "created_date", 100).then((data) => {
      setItems(data.filter((i) => !i.done));
      setLoading(false);
    });
    base44.entities.CRMClient.list("business", 200).then(setClients);

    const unsub = base44.entities.ToDoItem.subscribe((event) => {
      if (event.type === "create" && event.data?.category === "Priority" && !event.data?.done) {
        setItems((prev) => (prev.some((i) => i.id === event.id) ? prev : [...prev, event.data]));
      } else if (event.type === "update") {
        if (event.data?.done || event.data?.status === "Completed" || event.data?.category !== "Priority") {
          setItems((prev) => prev.filter((i) => i.id !== event.id));
        } else {
          setItems((prev) => prev.map((i) => i.id === event.id ? event.data : i).filter((i) => i.category === "Priority" && !i.done));
        }
      } else if (event.type === "delete") {
        setItems((prev) => prev.filter((i) => i.id !== event.id));
      }
    });
    return unsub;
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
    setItems((prev) => prev.filter((i) => i.id !== task.id));
  };

  const openAdd = () => {
    setAddForm({ ...EMPTY_FORM });
    setAddingTask(true);
  };

  const saveNew = async () => {
    if (!addForm.title?.trim()) return;
    const { id, created_date, updated_date, created_by, ...fields } = addForm;
    const payload = { ...fields, price: parseFloat(addForm.price) || null, estimatedAmount: parseFloat(addForm.estimatedAmount) || null };
    const created = await base44.entities.ToDoItem.create(payload);
    if (created?.category === "Priority" && !created.done) {
      setItems((prev) => (prev.some((i) => i.id === created.id) ? prev : [...prev, created]));
    }
    setAddingTask(false);
  };

  const openEdit = (item) => {
    setEditingTask(item);
    const { id, created_date, updated_date, created_by, ...rest } = item;
    setEditForm({ ...EMPTY_FORM, ...rest });
  };

  const saveEdit = async () => {
    if (!editForm.title?.trim() || !editingTask) return;
    const { id, created_date, updated_date, created_by, ...fields } = editForm;
    const updated = { ...fields, price: parseFloat(editForm.price) || null, estimatedAmount: parseFloat(editForm.estimatedAmount) || null };
    await base44.entities.ToDoItem.update(editingTask.id, updated);
    setItems((prev) => prev
      .map((i) => (i.id === editingTask.id ? { ...i, ...updated } : i))
      .filter((i) => i.category === "Priority" && !i.done));
    setEditingTask(null);
  };

  const byPriceDesc = (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0);
  const websiteBuilds = items.filter((i) => i.taskType === "New Website Build").sort(byPriceDesc);
  const appBuilds = items.filter((i) => i.taskType === "New App Build").sort(byPriceDesc);
  const inProgressItems = items.filter((i) => (i.status || "Pending") === "In Progress" && i.taskType !== "New Website Build" && i.taskType !== "New App Build");
  const otherItems = items.filter((i) => (i.status || "Pending") !== "In Progress" && i.taskType !== "New Website Build" && i.taskType !== "New App Build").sort(byPriceDesc);
  const totalValue = items.reduce((s, i) => s + (Number(i.price) || 0), 0);

  return (
    <>
      {completingTask && (
        <CompleteTaskModal
          task={completingTask}
          onConfirm={handleConfirmComplete}
          onCancel={() => setCompletingTask(null)}
        />
      )}

      <Dialog open={!!editingTask} onOpenChange={(o) => { if (!o) setEditingTask(null); }}>
        <DialogContent className="bg-card border-white/[0.08] max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-white/80 text-sm tracking-widest uppercase">Edit Task</DialogTitle>
          </DialogHeader>
          {editingTask && (
            <TaskForm form={editForm} setForm={setEditForm} onSave={saveEdit} onCancel={() => setEditingTask(null)} title="Edit Task" clients={clients} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addingTask} onOpenChange={(o) => { if (!o) setAddingTask(false); }}>
        <DialogContent className="bg-card border-white/[0.08] max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-white/80 text-sm tracking-widest uppercase">Add Priority Task</DialogTitle>
          </DialogHeader>
          <TaskForm form={addForm} setForm={setAddForm} onSave={saveNew} onCancel={() => setAddingTask(false)} title="New Task" clients={clients} />
        </DialogContent>
      </Dialog>

      <section className="px-8 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase">Priority Tasks</h2>
            <p className="text-white/30 text-[10px] mt-0.5">
              {items.length} remaining{totalValue > 0 ? " · " : ""}{totalValue > 0 && <span className="text-green-400/90 font-semibold">${totalValue.toLocaleString()} potential</span>} · <a href="/todo" className="text-orange-500/50 hover:text-orange-500/80 transition-colors">manage in To-Do →</a>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {items.length === 0 && !loading && (
              <span className="text-green-400/70 text-xs font-semibold tracking-wider uppercase px-2.5 py-1 bg-green-400/10 rounded-lg border border-green-400/15">All Done!</span>
            )}
            <button onClick={openAdd} className="flex items-center gap-1 px-2.5 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-semibold rounded-lg border border-orange-500/25 transition-colors">
              <Plus className="w-3.5 h-3.5" />Add Task
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 text-white/20 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="bg-card rounded-xl border border-white/[0.06] p-6 text-center">
            <p className="text-white/25 text-sm">No priority tasks yet.</p>
            <button onClick={openAdd} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-semibold rounded-lg border border-orange-500/25 transition-colors">
              <Plus className="w-3.5 h-3.5" />Add Priority Task
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {websiteBuilds.length > 0 && (
              <div className="rounded-xl border border-yellow-400/25 bg-gradient-to-b from-yellow-500/[0.07] to-yellow-500/[0.02] p-3 shadow-[0_0_18px_rgba(250,204,21,0.16)]">
                <div className="flex items-center gap-1.5 mb-2.5 px-1">
                  <Hammer className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-yellow-400 text-[10px] font-bold tracking-[0.15em] uppercase">Newest Websites to Build</span>
                  <span className="ml-auto text-yellow-400/50 text-[10px] font-semibold">{websiteBuilds.length} queued</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {websiteBuilds.map((item) => (
                    <PriorityTaskCard key={item.id} item={item} glowYellow onEdit={openEdit} setStatus={setStatus} />
                  ))}
                </div>
              </div>
            )}

            {appBuilds.length > 0 && (
              <div className="rounded-xl border border-blue-500/30 bg-gradient-to-b from-blue-500/[0.08] to-blue-500/[0.02] p-3 shadow-[0_0_20px_rgba(59,130,246,0.28)]">
                <div className="flex items-center gap-1.5 mb-2.5 px-1">
                  <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-blue-400 text-[10px] font-bold tracking-[0.15em] uppercase">Newest Apps to Build</span>
                  <span className="ml-auto text-blue-400/50 text-[10px] font-semibold">{appBuilds.length} queued</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {appBuilds.map((item) => (
                    <PriorityTaskCard key={item.id} item={item} glowBlue onEdit={openEdit} setStatus={setStatus} />
                  ))}
                </div>
              </div>
            )}

            {inProgressItems.length > 0 && (
              <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.04] p-3 shadow-orange-glow">
                <div className="flex items-center gap-1.5 mb-2.5 px-1">
                  <Zap className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-orange-400 text-[10px] font-bold tracking-[0.15em] uppercase">In Progress Now</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {inProgressItems.map((item) => (
                    <PriorityTaskCard key={item.id} item={item} glow onEdit={openEdit} setStatus={setStatus} />
                  ))}
                </div>
              </div>
            )}

            {otherItems.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {otherItems.map((item) => (
                  <PriorityTaskCard key={item.id} item={item} onEdit={openEdit} setStatus={setStatus} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}