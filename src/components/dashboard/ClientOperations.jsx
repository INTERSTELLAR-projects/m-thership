import { useState } from "react";
import { Bell, Plus, Trash2, Pencil, Check, X } from "lucide-react";

const CARD_KEYS = ["Website Updates", "GBP Updates", "New Website Builds", "Presentations"];

function load(key) {
  try { return JSON.parse(localStorage.getItem("co_" + key) || "[]"); } catch { return []; }
}
function save(key, val) { localStorage.setItem("co_" + key, JSON.stringify(val)); }

function TodoCard({ title }) {
  const [todos, setTodos] = useState(() => load(title));
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");

  const update = (next) => { setTodos(next); save(title, next); };

  const add = () => {
    if (!newText.trim()) return;
    update([...todos, { id: Date.now(), text: newText.trim() }]);
    setNewText(""); setAdding(false);
  };

  const del = (id) => update(todos.filter((t) => t.id !== id));

  const saveEdit = (id) => {
    if (!editText.trim()) return;
    update(todos.map((t) => t.id === id ? { ...t, text: editText.trim() } : t));
    setEditId(null);
  };

  return (
    <div className="relative bg-card rounded-xl border border-white/[0.06] p-5 min-h-[120px] group hover:border-orange-500/20 transition-all duration-300">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-white/80 text-sm font-medium">{title}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setAdding(true); setEditId(null); }}
            className="p-1 rounded text-white/20 hover:text-orange-500/70 transition-colors"
            title="Add item"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <div className="relative">
            <Bell className="w-4 h-4 text-white/20 group-hover:text-orange-500/50 transition-colors" />
            {todos.length > 0 && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full" />}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {todos.length === 0 && !adding && (
          <p className="text-white/15 text-xs">No items yet</p>
        )}
        {todos.map((t) => (
          <div key={t.id} className="flex items-center gap-2 group/item">
            {editId === t.id ? (
              <>
                <input
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveEdit(t.id); if (e.key === "Escape") setEditId(null); }}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-xs text-white outline-none"
                />
                <button onClick={() => saveEdit(t.id)} className="p-0.5 text-green-400/70 hover:text-green-400"><Check className="w-3 h-3" /></button>
                <button onClick={() => setEditId(null)} className="p-0.5 text-white/30 hover:text-white/60"><X className="w-3 h-3" /></button>
              </>
            ) : (
              <>
                <span className="flex-1 text-white/60 text-xs leading-relaxed">• {t.text}</span>
                <button onClick={() => { setEditId(t.id); setEditText(t.text); }} className="p-0.5 text-white/15 hover:text-white/50 opacity-0 group-hover/item:opacity-100 transition-all"><Pencil className="w-3 h-3" /></button>
                <button onClick={() => del(t.id)} className="p-0.5 text-white/15 hover:text-red-400/60 opacity-0 group-hover/item:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
              </>
            )}
          </div>
        ))}
        {adding && (
          <div className="flex items-center gap-2 pt-1">
            <input
              autoFocus
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") { setAdding(false); setNewText(""); } }}
              placeholder="New item..."
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-xs text-white placeholder:text-white/20 outline-none"
            />
            <button onClick={add} className="p-0.5 text-green-400/70 hover:text-green-400"><Check className="w-3 h-3" /></button>
            <button onClick={() => { setAdding(false); setNewText(""); }} className="p-0.5 text-white/30 hover:text-white/60"><X className="w-3 h-3" /></button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientOperations() {
  return (
    <section className="px-8 pt-6">
      <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase mb-4">Client Operations</h2>
      <div className="grid grid-cols-2 gap-4">
        {CARD_KEYS.map((title) => (
          <TodoCard key={title} title={title} />
        ))}
      </div>
    </section>
  );
}