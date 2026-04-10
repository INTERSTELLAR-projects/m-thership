import { useState } from "react";
import { Plus, FileText, Shield, Clock, CheckSquare, CalendarDays, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "../components/PageHeader";

const DEFAULT_LEGAL_DOCS = [
  { id: 1, name: "Master Services Agreement", status: "Active", lastUpdated: "Mar 15, 2026" },
  { id: 2, name: "Non-Disclosure Agreement (Template)", status: "Active", lastUpdated: "Feb 28, 2026" },
  { id: 3, name: "Contractor Agreement", status: "Review", lastUpdated: "Mar 10, 2026" },
  { id: 4, name: "Terms of Service", status: "Active", lastUpdated: "Jan 05, 2026" },
];

const DEFAULT_POLICIES = [
  { id: 1, name: "Privacy Policy", version: "v2.3", lastUpdated: "Mar 18, 2026" },
  { id: 2, name: "Data Retention Policy", version: "v1.1", lastUpdated: "Feb 01, 2026" },
  { id: 3, name: "Acceptable Use Policy", version: "v1.0", lastUpdated: "Jan 15, 2026" },
];

const DEFAULT_DEADLINES = [
  { id: 1, task: "Annual Business License Renewal", dueDate: "Jun 30, 2026", status: "Upcoming" },
  { id: 2, task: "Insurance Policy Review", dueDate: "May 15, 2026", status: "Upcoming" },
  { id: 3, task: "Tax Filing (Federal)", dueDate: "Apr 15, 2026", status: "Urgent" },
];

const DEFAULT_TODOS = [
  { id: 1, task: "Review updated contractor agreement", done: false },
  { id: 2, task: "Update privacy policy for new data regulations", done: false },
  { id: 3, task: "File Q1 state taxes", done: true },
  { id: 4, task: "Renew cyber liability insurance", done: false },
];

const DEFAULT_DATES = [
  { id: 1, event: "Business License Renewal", date: "Jun 30, 2026" },
  { id: 2, event: "Annual Insurance Review", date: "May 15, 2026" },
  { id: 3, event: "Tax Filing Deadline", date: "Apr 15, 2026" },
  { id: 4, event: "Contract Renewal - NW Tree Service", date: "Jul 01, 2026" },
];

function load(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) || def; } catch { return def; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

export default function Legal() {
  const [legalDocs, setLegalDocs] = useState(() => load("legal_docs", DEFAULT_LEGAL_DOCS));
  const [policies, setPolicies] = useState(() => load("legal_policies", DEFAULT_POLICIES));
  const [deadlines, setDeadlines] = useState(() => load("legal_deadlines", DEFAULT_DEADLINES));
  const [todos, setTodos] = useState(() => load("legal_todos", DEFAULT_TODOS));
  const [dates, setDates] = useState(() => load("legal_dates", DEFAULT_DATES));

  // Generic helpers
  const updater = (setter, key) => (items) => { setter(items); save(key, items); };
  const setLD = updater(setLegalDocs, "legal_docs");
  const setPol = updater(setPolicies, "legal_policies");
  const setDL = updater(setDeadlines, "legal_deadlines");
  const setTD = updater(setTodos, "legal_todos");
  const setDT = updater(setDates, "legal_dates");

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command Center / Legal" rightText="Legal Management" />

      <div className="px-8 py-6 space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <LegalDocsSection items={legalDocs} setItems={setLD} />
          <PoliciesSection items={policies} setItems={setPol} />
        </div>
        <div className="grid grid-cols-2 gap-6">
          <DeadlinesSection items={deadlines} setItems={setDL} />
          <TodosSection items={todos} setItems={setTD} />
        </div>
        <DatesSection items={dates} setItems={setDT} />
      </div>
    </div>
  );
}

// ── Legal Documents ──────────────────────────────────────────
function LegalDocsSection({ items, setItems }) {
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState({});
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState({ name: "", status: "Active", lastUpdated: "" });

  const del = (id) => setItems(items.filter((i) => i.id !== id));
  const startEdit = (item) => { setEditId(item.id); setEditVal({ ...item }); };
  const saveEdit = () => { setItems(items.map((i) => i.id === editId ? editVal : i)); setEditId(null); };
  const add = () => {
    if (!newVal.name) return;
    setItems([...items, { ...newVal, id: Date.now() }]);
    setAdding(false); setNewVal({ name: "", status: "Active", lastUpdated: "" });
  };

  return (
    <Section title="Legal Documents" icon={FileText}>
      <div className="space-y-1">
        {items.map((doc) => editId === doc.id ? (
          <div key={doc.id} className="space-y-1.5 py-2">
            <Input value={editVal.name} onChange={(e) => setEditVal({ ...editVal, name: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs" placeholder="Name" />
            <div className="flex gap-2">
              <Select value={editVal.status} onValueChange={(v) => setEditVal({ ...editVal, status: v })}>
                <SelectTrigger className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-white/[0.06]">
                  <SelectItem value="Active" className="text-white/70">Active</SelectItem>
                  <SelectItem value="Review" className="text-white/70">Review</SelectItem>
                  <SelectItem value="Expired" className="text-white/70">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Input value={editVal.lastUpdated} onChange={(e) => setEditVal({ ...editVal, lastUpdated: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" placeholder="Date" />
              <button onClick={saveEdit} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setEditId(null)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ) : (
          <div key={doc.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0 group">
            <div>
              <p className="text-white/75 text-sm">{doc.name}</p>
              <p className="text-white/20 text-xs mt-0.5">Updated {doc.lastUpdated}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded ${doc.status === "Active" ? "text-green-400/70 bg-green-400/10" : doc.status === "Expired" ? "text-red-400/70 bg-red-400/10" : "text-yellow-400/70 bg-yellow-400/10"}`}>{doc.status}</span>
              <button onClick={() => startEdit(doc)} className="p-1 text-white/15 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3 h-3" /></button>
              <button onClick={() => del(doc.id)} className="p-1 text-white/15 hover:text-red-400/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
        {adding ? (
          <div className="space-y-1.5 pt-2">
            <Input value={newVal.name} onChange={(e) => setNewVal({ ...newVal, name: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs" placeholder="Document name" />
            <div className="flex gap-2">
              <Select value={newVal.status} onValueChange={(v) => setNewVal({ ...newVal, status: v })}>
                <SelectTrigger className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-white/[0.06]">
                  <SelectItem value="Active" className="text-white/70">Active</SelectItem>
                  <SelectItem value="Review" className="text-white/70">Review</SelectItem>
                  <SelectItem value="Expired" className="text-white/70">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Input value={newVal.lastUpdated} onChange={(e) => setNewVal({ ...newVal, lastUpdated: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" placeholder="Date" />
              <button onClick={add} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setAdding(false)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-white/20 hover:text-white/50 text-xs pt-2 transition-colors"><Plus className="w-3.5 h-3.5" />Add document</button>
        )}
      </div>
    </Section>
  );
}

// ── Policies ─────────────────────────────────────────────────
function PoliciesSection({ items, setItems }) {
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState({});
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState({ name: "", version: "", lastUpdated: "" });

  const del = (id) => setItems(items.filter((i) => i.id !== id));
  const startEdit = (item) => { setEditId(item.id); setEditVal({ ...item }); };
  const saveEdit = () => { setItems(items.map((i) => i.id === editId ? editVal : i)); setEditId(null); };
  const add = () => {
    if (!newVal.name) return;
    setItems([...items, { ...newVal, id: Date.now() }]);
    setAdding(false); setNewVal({ name: "", version: "", lastUpdated: "" });
  };

  return (
    <Section title="Policies" icon={Shield}>
      <div className="space-y-1">
        {items.map((p) => editId === p.id ? (
          <div key={p.id} className="space-y-1.5 py-2">
            <div className="flex gap-2">
              <Input value={editVal.name} onChange={(e) => setEditVal({ ...editVal, name: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" placeholder="Policy name" />
              <Input value={editVal.version} onChange={(e) => setEditVal({ ...editVal, version: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs w-16" placeholder="v1.0" />
              <Input value={editVal.lastUpdated} onChange={(e) => setEditVal({ ...editVal, lastUpdated: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs w-28" placeholder="Date" />
              <button onClick={saveEdit} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setEditId(null)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ) : (
          <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0 group">
            <div>
              <p className="text-white/75 text-sm">{p.name}</p>
              <p className="text-white/20 text-xs mt-0.5">Updated {p.lastUpdated}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/20 text-xs font-mono">{p.version}</span>
              <button onClick={() => startEdit(p)} className="p-1 text-white/15 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3 h-3" /></button>
              <button onClick={() => del(p.id)} className="p-1 text-white/15 hover:text-red-400/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
        {adding ? (
          <div className="flex gap-2 pt-2">
            <Input value={newVal.name} onChange={(e) => setNewVal({ ...newVal, name: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" placeholder="Policy name" />
            <Input value={newVal.version} onChange={(e) => setNewVal({ ...newVal, version: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs w-16" placeholder="v1.0" />
            <Input value={newVal.lastUpdated} onChange={(e) => setNewVal({ ...newVal, lastUpdated: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs w-28" placeholder="Date" />
            <button onClick={add} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setAdding(false)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-white/20 hover:text-white/50 text-xs pt-2 transition-colors"><Plus className="w-3.5 h-3.5" />Add policy</button>
        )}
      </div>
    </Section>
  );
}

// ── Deadlines ─────────────────────────────────────────────────
function DeadlinesSection({ items, setItems }) {
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState({});
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState({ task: "", dueDate: "", status: "Upcoming" });

  const del = (id) => setItems(items.filter((i) => i.id !== id));
  const startEdit = (item) => { setEditId(item.id); setEditVal({ ...item }); };
  const saveEdit = () => { setItems(items.map((i) => i.id === editId ? editVal : i)); setEditId(null); };
  const add = () => {
    if (!newVal.task) return;
    setItems([...items, { ...newVal, id: Date.now() }]);
    setAdding(false); setNewVal({ task: "", dueDate: "", status: "Upcoming" });
  };

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
                  <SelectItem value="Upcoming" className="text-white/70">Upcoming</SelectItem>
                  <SelectItem value="Urgent" className="text-white/70">Urgent</SelectItem>
                  <SelectItem value="Complete" className="text-white/70">Complete</SelectItem>
                </SelectContent>
              </Select>
              <button onClick={saveEdit} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setEditId(null)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ) : (
          <div key={d.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0 group">
            <div>
              <p className="text-white/75 text-sm">{d.task}</p>
              <p className="text-white/20 text-xs mt-0.5">Due: {d.dueDate}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded ${d.status === "Urgent" ? "text-red-400/70 bg-red-400/10" : d.status === "Complete" ? "text-green-400/70 bg-green-400/10" : "text-orange-400/70 bg-orange-400/10"}`}>{d.status}</span>
              <button onClick={() => startEdit(d)} className="p-1 text-white/15 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3 h-3" /></button>
              <button onClick={() => del(d.id)} className="p-1 text-white/15 hover:text-red-400/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
        {adding ? (
          <div className="space-y-1.5 pt-2">
            <Input value={newVal.task} onChange={(e) => setNewVal({ ...newVal, task: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs" placeholder="Task" />
            <div className="flex gap-2">
              <Input value={newVal.dueDate} onChange={(e) => setNewVal({ ...newVal, dueDate: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" placeholder="Due date" />
              <Select value={newVal.status} onValueChange={(v) => setNewVal({ ...newVal, status: v })}>
                <SelectTrigger className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs w-28"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-white/[0.06]">
                  <SelectItem value="Upcoming" className="text-white/70">Upcoming</SelectItem>
                  <SelectItem value="Urgent" className="text-white/70">Urgent</SelectItem>
                  <SelectItem value="Complete" className="text-white/70">Complete</SelectItem>
                </SelectContent>
              </Select>
              <button onClick={add} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
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

// ── Todos ─────────────────────────────────────────────────────
function TodosSection({ items, setItems }) {
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState("");

  const del = (id) => setItems(items.filter((i) => i.id !== id));
  const toggle = (id) => setItems(items.map((i) => i.id === id ? { ...i, done: !i.done } : i));
  const saveEdit = (id) => { setItems(items.map((i) => i.id === id ? { ...i, task: editVal } : i)); setEditId(null); };
  const add = () => {
    if (!newTask.trim()) return;
    setItems([...items, { id: Date.now(), task: newTask.trim(), done: false }]);
    setAdding(false); setNewTask("");
  };

  return (
    <Section title="Legal To-Do List" icon={CheckSquare}>
      <div className="space-y-1">
        {items.map((t) => (
          <div key={t.id} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0 group">
            <button onClick={() => toggle(t.id)} className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${t.done ? "bg-orange-500/20 border-orange-500/40" : "border-white/15"}`}>
              {t.done && <Check className="w-3 h-3 text-orange-500" />}
            </button>
            {editId === t.id ? (
              <>
                <Input value={editVal} onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(t.id); if (e.key === "Escape") setEditId(null); }} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" autoFocus />
                <button onClick={() => saveEdit(t.id)} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setEditId(null)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
              </>
            ) : (
              <>
                <span className={`text-sm flex-1 ${t.done ? "text-white/30 line-through" : "text-white/70"}`}>{t.task}</span>
                <button onClick={() => { setEditId(t.id); setEditVal(t.task); }} className="p-1 text-white/15 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3 h-3" /></button>
                <button onClick={() => del(t.id)} className="p-1 text-white/15 hover:text-red-400/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
              </>
            )}
          </div>
        ))}
        {adding ? (
          <div className="flex items-center gap-2 pt-2">
            <Input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") setAdding(false); }} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" placeholder="New task..." autoFocus />
            <button onClick={add} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setAdding(false)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-white/20 hover:text-white/50 text-xs pt-2 transition-colors"><Plus className="w-3.5 h-3.5" />Add task</button>
        )}
      </div>
    </Section>
  );
}

// ── Important Dates ───────────────────────────────────────────
function DatesSection({ items, setItems }) {
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState({});
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState({ event: "", date: "" });

  const del = (id) => setItems(items.filter((i) => i.id !== id));
  const startEdit = (item) => { setEditId(item.id); setEditVal({ ...item }); };
  const saveEdit = () => { setItems(items.map((i) => i.id === editId ? editVal : i)); setEditId(null); };
  const add = () => {
    if (!newVal.event) return;
    setItems([...items, { ...newVal, id: Date.now() }]);
    setAdding(false); setNewVal({ event: "", date: "" });
  };

  return (
    <Section title="Important Dates" icon={CalendarDays}>
      <div className="grid grid-cols-2 gap-3">
        {items.map((d) => editId === d.id ? (
          <div key={d.id} className="flex items-center gap-2 py-2 px-3 bg-white/[0.02] rounded-lg border border-orange-500/20">
            <Input value={editVal.event} onChange={(e) => setEditVal({ ...editVal, event: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" placeholder="Event" />
            <Input value={editVal.date} onChange={(e) => setEditVal({ ...editVal, date: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs w-28" placeholder="Date" />
            <button onClick={saveEdit} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setEditId(null)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <div key={d.id} className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-lg border border-white/[0.04] group">
            <span className="text-white/60 text-sm">{d.event}</span>
            <div className="flex items-center gap-1">
              <span className="text-orange-500/60 text-xs font-medium">{d.date}</span>
              <button onClick={() => startEdit(d)} className="p-1 text-white/15 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3 h-3" /></button>
              <button onClick={() => del(d.id)} className="p-1 text-white/15 hover:text-red-400/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
        {adding ? (
          <div className="flex items-center gap-2 py-2 px-3 bg-white/[0.02] rounded-lg border border-orange-500/20">
            <Input value={newVal.event} onChange={(e) => setNewVal({ ...newVal, event: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1" placeholder="Event name" autoFocus />
            <Input value={newVal.date} onChange={(e) => setNewVal({ ...newVal, date: e.target.value })} className="h-7 bg-white/[0.04] border-white/[0.08] text-white text-xs w-28" placeholder="Date" />
            <button onClick={add} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setAdding(false)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="flex items-center gap-2 py-2 px-3 bg-white/[0.02] rounded-lg border border-dashed border-white/[0.06] text-white/20 hover:text-white/50 hover:border-white/[0.12] transition-all text-xs"><Plus className="w-3.5 h-3.5" />Add date</button>
        )}
      </div>
    </Section>
  );
}

function Section({ title, icon: SectionIcon, children }) {
  return (
    <div className="bg-card rounded-xl border border-white/[0.06] p-5">
      <div className="flex items-center gap-2 mb-4">
        <SectionIcon className="w-4 h-4 text-orange-500/40" />
        <h3 className="text-white font-bold text-xs tracking-[0.15em] uppercase">{title}</h3>
      </div>
      {children}
    </div>
  );
}