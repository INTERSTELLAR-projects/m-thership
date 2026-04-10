import { useState, useEffect } from "react";
import { CheckSquare, Square, Pencil, Check, X, Loader2, Link } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function PriorityTasks() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    base44.entities.ToDoItem.filter({ category: "Priority" }, "created_date", 100).then((data) => {
      setItems(data);
      setLoading(false);
    });

    const unsub = base44.entities.ToDoItem.subscribe((event) => {
      if (event.type === "create" && event.data?.category === "Priority") {
        setItems((prev) => [...prev, event.data]);
      } else if (event.type === "update") {
        setItems((prev) => prev.map((i) => i.id === event.id ? event.data : i).filter((i) => i.category === "Priority"));
      } else if (event.type === "delete") {
        setItems((prev) => prev.filter((i) => i.id !== event.id));
      }
    });
    return unsub;
  }, []);

  const toggleDone = async (item) => {
    await base44.entities.ToDoItem.update(item.id, { done: !item.done });
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, done: !i.done } : i));
  };

  const saveEdit = async (id) => {
    if (!editTitle.trim()) return;
    await base44.entities.ToDoItem.update(id, { title: editTitle.trim() });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, title: editTitle.trim() } : i));
    setEditId(null);
  };

  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  return (
    <section className="px-8 pt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase">Priority Tasks</h2>
          <p className="text-white/30 text-[10px] mt-0.5">
            {pending.length} remaining · <a href="/todo" className="text-orange-500/50 hover:text-orange-500/80 transition-colors">manage in To-Do →</a>
          </p>
        </div>
        {pending.length === 0 && items.length > 0 && (
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
          {[...pending, ...done].map((item) => (
            <div key={item.id} className={`card-hover bg-card rounded-xl border p-3 flex items-start gap-3 group ${item.done ? "border-green-500/10 opacity-60" : "border-white/[0.06]"}`}>
              <button onClick={() => toggleDone(item)} className="mt-0.5 shrink-0 text-white/25 hover:text-orange-500/70 transition-colors">
                {item.done ? <CheckSquare className="w-4 h-4 text-green-400/70" /> : <Square className="w-4 h-4" />}
              </button>
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
                  <p className={`text-xs font-medium leading-relaxed ${item.done ? "text-white/30 line-through" : "text-white/80"}`}>{item.title}</p>
                )}
                {item.dueDate && (
                  <p className="text-orange-500/50 text-[10px] mt-0.5">
                    Due {new Date(item.dueDate + 'T00:00:00').toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                )}
              </div>
              {editId !== item.id && (
                <button onClick={() => { setEditId(item.id); setEditTitle(item.title); }} className="p-1 text-white/15 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}