import { useState, useEffect } from "react";
import { Bell, Plus, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const STATUS_OPTIONS = ["Pending", "In Progress", "Completed"];
const STATUS_STYLES = {
  Pending: "bg-white/5 text-white/35 border-white/10",
  "In Progress": "bg-orange-500/15 text-orange-400 border-orange-500/25",
  Completed: "bg-green-500/15 text-green-400 border-green-500/25",
};

const CARD_KEYS = ["Website Updates", "GBP Updates", "New Website Builds", "Presentations"];

function TodoCard({ title, clients }) {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newClient, setNewClient] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editClient, setEditClient] = useState("");

  useEffect(() => {
    base44.entities.ClientOperationItem.filter({ card: title }, "created_date", 100).then((data) => {
      setTodos(data);
      setLoading(false);
    });
  }, [title]);

  const add = async () => {
    if (!newText.trim()) return;
    const created = await base44.entities.ClientOperationItem.create({ card: title, text: newText.trim(), due: newDue.trim(), client: newClient, status: "Pending", done: false });
    setTodos([...todos, created]);
    setNewText(""); setNewDue(""); setNewClient(""); setAdding(false);
  };

  const setStatus = async (t, status) => {
    const done = status === "Completed";
    await base44.entities.ClientOperationItem.update(t.id, { status, done });
    setTodos(todos.map((x) => x.id === t.id ? { ...x, status, done } : x));

    // Push to CRM client's completedTasks when marked Completed
    if (done && t.client) {
      const matches = await base44.entities.CRMClient.filter({ business: t.client }, "business", 1);
      if (matches.length > 0) {
        const crm = matches[0];
        const completedTasks = [...(crm.completedTasks || []), {
          id: Date.now(),
          text: t.text,
          card: title,
          completedDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          due: t.due || null,
        }];
        await base44.entities.CRMClient.update(crm.id, { completedTasks });
      }
    }
  };

  const del = async (id) => {
    await base44.entities.ClientOperationItem.delete(id);
    setTodos(todos.filter((t) => t.id !== id));
  };

  const saveEdit = async (id) => {
    if (!editText.trim()) return;
    await base44.entities.ClientOperationItem.update(id, { text: editText.trim(), due: editDue.trim(), client: editClient });
    setTodos(todos.map((t) => t.id === id ? { ...t, text: editText.trim(), due: editDue.trim(), client: editClient } : t));
    setEditId(null);
  };

  return (
    <div className="card-hover relative bg-card rounded-xl border border-white/[0.06] p-5 min-h-[120px] group">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-white/80 text-sm font-medium">{title}</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => { setAdding(true); setEditId(null); }} className="p-1 rounded text-white/20 hover:text-orange-500/70 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
          <div className="relative">
            <Bell className="w-4 h-4 text-white/20 group-hover:text-orange-500/50 transition-colors" />
            {todos.length > 0 && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full" />}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {loading && <Loader2 className="w-3.5 h-3.5 text-white/20 animate-spin" />}
        {!loading && todos.length === 0 && !adding && <p className="text-white/15 text-xs">No items yet</p>}
        {todos.map((t) => (
          <div key={t.id} className="flex items-center gap-2 group/item">
            {editId === t.id ? (
              <>
                <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(t.id); if (e.key === "Escape") setEditId(null); }} className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-xs text-white outline-none" />
                <input type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-xs text-white/60 outline-none w-32" />
                <select value={editClient} onChange={(e) => setEditClient(e.target.value)} className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-xs text-white/60 outline-none max-w-[120px]">
                  <option value="">No client</option>
                  {clients.map((c) => <option key={c.id} value={c.business}>{c.business}</option>)}
                </select>
                <button onClick={() => saveEdit(t.id)} className="p-0.5 text-green-400/70 hover:text-green-400"><Check className="w-3 h-3" /></button>
                <button onClick={() => setEditId(null)} className="p-0.5 text-white/30 hover:text-white/60"><X className="w-3 h-3" /></button>
              </>
            ) : (
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs leading-relaxed ${t.done ? "line-through text-white/25" : "text-white/70"}`}>• {t.text}</span>
                    {t.client && <span className="ml-2 text-orange-500/60 text-[10px] font-semibold px-1.5 py-0.5 bg-orange-500/[0.06] rounded">{t.client}</span>}
                    {t.due && <span className="ml-1 text-orange-500/50 text-[10px] font-medium">{new Date(t.due + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                  </div>
                  <button onClick={() => { setEditId(t.id); setEditText(t.text); setEditDue(t.due || ""); setEditClient(t.client || ""); }} className="p-0.5 text-white/15 hover:text-white/50 opacity-0 group-hover/item:opacity-100 transition-all"><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => del(t.id)} className="p-0.5 text-white/15 hover:text-red-400/60 opacity-0 group-hover/item:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
                </div>
                <div className="flex gap-1 ml-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button key={s} onClick={() => setStatus(t, s)} className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                      (t.status || "Pending") === s ? STATUS_STYLES[s] : "text-white/20 border-transparent hover:text-white/40"
                    }`}>{s}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {adding && (
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <input autoFocus value={newText} onChange={(e) => setNewText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") { setAdding(false); setNewText(""); setNewDue(""); setNewClient(""); } }} placeholder="New item..." className="flex-1 min-w-[120px] bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-xs text-white placeholder:text-white/20 outline-none" />
            <select value={newClient} onChange={(e) => setNewClient(e.target.value)} className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-xs text-white/60 outline-none max-w-[130px]">
              <option value="">No client</option>
              {clients.map((c) => <option key={c.id} value={c.business}>{c.business}</option>)}
            </select>
            <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-xs text-white/60 outline-none w-32" />
            <button onClick={add} className="p-0.5 text-green-400/70 hover:text-green-400"><Check className="w-3 h-3" /></button>
            <button onClick={() => { setAdding(false); setNewText(""); setNewDue(""); setNewClient(""); }} className="p-0.5 text-white/30 hover:text-white/60"><X className="w-3 h-3" /></button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientOperations() {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    base44.entities.CRMClient.list("business", 200).then((data) => setClients(data));
  }, []);

  return (
    <section className="px-8 pt-6">
      <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase mb-4">Client Projects</h2>
      <div className="grid grid-cols-2 gap-4">
        {CARD_KEYS.map((title) => <TodoCard key={title} title={title} clients={clients} />)}
      </div>
    </section>
  );
}