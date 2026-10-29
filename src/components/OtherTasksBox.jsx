import { useState, useEffect } from "react";
import { Plus, Trash2, Check, X, CheckSquare, Square, Pencil, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const CARD_KEY = "other-tasks";

export default function OtherTasksBox({ clients = [] }) {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newClient, setNewClient] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    base44.entities.ClientOperationItem.filter({ card: CARD_KEY }, "created_date", 200).then((data) => {
      setTodos(data);
      setLoading(false);
    });
  }, []);

  const add = async () => {
    if (!newText.trim()) return;
    const created = await base44.entities.ClientOperationItem.create({ card: CARD_KEY, text: newText.trim(), client: newClient, done: false });
    setTodos([...todos, created]);
    setNewText(""); setNewClient(""); setAdding(false);
  };

  const del = async (id) => {
    await base44.entities.ClientOperationItem.delete(id);
    setTodos(todos.filter((t) => t.id !== id));
  };

  const toggleDone = async (t) => {
    await base44.entities.ClientOperationItem.update(t.id, { done: !t.done });
    setTodos(todos.map((x) => x.id === t.id ? { ...x, done: !x.done } : x));
  };

  const saveEdit = async (id) => {
    if (!editText.trim()) return;
    await base44.entities.ClientOperationItem.update(id, { text: editText.trim() });
    setTodos(todos.map((t) => t.id === id ? { ...t, text: editText.trim() } : t));
    setEditId(null);
  };

  const done = todos.filter((t) => t.done).length;

  return (
    <section className="px-8 pt-4 pb-6">
      <div className="bg-card rounded-md border border-ink/[0.13] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-ink font-bold text-xs tracking-[0.2em] uppercase">Other Small Tasks</h2>
            <p className="text-ink/[0.43] text-[10px] mt-0.5">{done}/{todos.length} complete</p>
          </div>
          <button
            onClick={() => { setAdding(true); setEditId(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500/70 hover:text-orange-500 text-xs font-medium rounded-lg border border-orange-500/15 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />Add Task
          </button>
        </div>

        {loading && <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 text-ink/[0.38] animate-spin" /></div>}

        {!loading && todos.length === 0 && !adding && (
          <p className="text-ink/[0.33] text-xs text-center py-4">No other tasks yet. Add one above.</p>
        )}

        <div className="space-y-1.5">
          {todos.map((t) => (
            <div key={t.id} className="flex items-center gap-2.5 group py-1">
              <button onClick={() => toggleDone(t)} className="shrink-0 text-ink/[0.38] hover:text-orange-500/70 transition-colors">
                {t.done ? <CheckSquare className="w-4 h-4 text-green-600/70" /> : <Square className="w-4 h-4" />}
              </button>
              {editId === t.id ? (
                <>
                  <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(t.id); if (e.key === "Escape") setEditId(null); }} className="flex-1 bg-ink/[0.04] border border-ink/[0.13] rounded px-2 py-0.5 text-xs text-ink outline-none" />
                  <button onClick={() => saveEdit(t.id)} className="p-0.5 text-green-600/70 hover:text-green-600"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditId(null)} className="p-0.5 text-ink/[0.48] hover:text-ink/60"><X className="w-3.5 h-3.5" /></button>
                </>
              ) : (
                <>
                  <span className={`flex-1 text-xs ${t.done ? "line-through text-ink/[0.43]" : "text-ink/65"}`}>{t.text}</span>
                  {t.client && <span className="text-orange-500/60 text-[10px] font-semibold px-1.5 py-0.5 bg-orange-500/[0.06] rounded shrink-0">{t.client}</span>}
                  <button onClick={() => { setEditId(t.id); setEditText(t.text); }} className="p-0.5 text-ink/[0.33] hover:text-ink/50 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => del(t.id)} className="p-0.5 text-ink/[0.33] hover:text-red-600/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
                </>
              )}
            </div>
          ))}

          {adding && (
            <div className="flex items-center gap-2 pt-2 flex-wrap border-t border-ink/[0.13]">
              <input autoFocus value={newText} onChange={(e) => setNewText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") { setAdding(false); setNewText(""); setNewClient(""); } }} placeholder="Task description..." className="flex-1 min-w-[160px] bg-ink/[0.04] border border-ink/[0.13] rounded px-2 py-1 text-xs text-ink placeholder:text-ink/[0.38] outline-none" />
              <select value={newClient} onChange={(e) => setNewClient(e.target.value)} className="bg-ink/[0.04] border border-ink/[0.13] rounded px-2 py-1 text-xs text-ink/60 outline-none max-w-[140px]">
                <option value="">No client</option>
                {clients.map((c) => <option key={c.id} value={c.business}>{c.business}</option>)}
              </select>
              <button onClick={add} className="p-1 text-green-600/70 hover:text-green-600"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => { setAdding(false); setNewText(""); setNewClient(""); }} className="p-1 text-ink/[0.48] hover:text-ink/60"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}