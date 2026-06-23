import { useState, useEffect } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import CompleteTaskModal from "@/components/CompleteTaskModal";

export default function PriorityTasks() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [completingTask, setCompletingTask] = useState(null); // task pending confirmation

  useEffect(() => {
    base44.entities.ToDoItem.filter({ category: "Priority", done: false }, "created_date", 100).then((data) => {
      setItems(data.filter((i) => !i.done));
      setLoading(false);
    });

    const unsub = base44.entities.ToDoItem.subscribe((event) => {
      if (event.type === "create" && event.data?.category === "Priority" && !event.data?.done) {
        setItems((prev) => [...prev, event.data]);
      } else if (event.type === "update") {
        if (event.data?.done || event.data?.status === "Completed") {
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
    await base44.entities.ToDoItem.update(task.id, {
      status: "Completed",
      done: true,
      ...timeData,
    });
    setItems((prev) => prev.filter((i) => i.id !== task.id));
  };

  const saveEdit = async (id) => {
    if (!editTitle.trim()) return;
    await base44.entities.ToDoItem.update(id, { title: editTitle.trim() });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, title: editTitle.trim() } : i));
    setEditId(null);
  };

  const STATUS_STYLES = {
    Pending: "bg-white/5 text-white/35 border-white/10",
    "In Progress": "bg-orange-500/15 text-orange-400 border-orange-500/25",
    Completed: "bg-green-500/15 text-green-400 border-green-500/25",
  };

  return (
    <>
      {completingTask && (
        <CompleteTaskModal
          task={completingTask}
          onConfirm={handleConfirmComplete}
          onCancel={() => setCompletingTask(null)}
        />
      )}

      <section className="px-8 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase">Priority Tasks</h2>
            <p className="text-white/30 text-[10px] mt-0.5">
              {items.length} remaining · <a href="/todo" className="text-orange-500/50 hover:text-orange-500/80 transition-colors">manage in To-Do →</a>
            </p>
          </div>
          {items.length === 0 && !loading && (
            <span className="text-green-400/70 text-xs font-semibold tracking-wider uppercase px-2.5 py-1 bg-green-400/10 rounded-lg border border-green-400/15">All Done!</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 text-white/20 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="bg-card rounded-xl border border-white/[0.06] p-6 text-center">
            <p className="text-white/25 text-sm">No priority tasks yet. Add them in the To-Do page.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => {
              const currentStatus = item.status || "Pending";
              return (
                <div key={item.id} className="card-hover bg-card rounded-xl border border-white/[0.06] p-3 flex items-start gap-3 group">
                  <div className="flex-1 min-w-0">
                    {editId === item.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(item.id); if (e.key === "Escape") setEditId(null); }}
                          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-xs text-white outline-none"
                        />
                        <button onClick={() => saveEdit(item.id)} className="p-0.5 text-green-400/70 hover:text-green-400"><Check className="w-3 h-3" /></button>
                        <button onClick={() => setEditId(null)} className="p-0.5 text-white/30 hover:text-white/60"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <p className="text-xs font-medium leading-relaxed text-white/80">{item.title}</p>
                    )}
                    {item.dueDate && (
                      <p className="text-orange-500/50 text-[10px] mt-0.5">
                        Due {new Date(item.dueDate + 'T00:00:00').toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    )}
                    <div className="flex gap-1 mt-2">
                      {["Pending", "In Progress", "Completed"].map((s) => (
                        <button key={s} onClick={() => setStatus(item, s)} className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                          currentStatus === s ? STATUS_STYLES[s] : "text-white/20 border-transparent hover:text-white/40"
                        }`}>{s}</button>
                      ))}
                    </div>
                  </div>
                  {editId !== item.id && (
                    <button onClick={() => { setEditId(item.id); setEditTitle(item.title); }} className="p-1 text-white/15 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}