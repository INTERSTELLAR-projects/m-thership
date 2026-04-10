import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Lightbulb, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import PageHeader from "../components/PageHeader";

const CATEGORIES = ["All", "Marketing", "Product", "Operations", "Tech", "Content", "Other"];

const STATUS_OPTIONS = ["New", "In Review", "Planned", "Implemented", "Shelved"];

function load() {
  try { return JSON.parse(localStorage.getItem("idea_vault") || "[]"); } catch { return []; }
}
function save(ideas) { localStorage.setItem("idea_vault", JSON.stringify(ideas)); }

export default function IdeaVault() {
  const [ideas, setIdeas] = useState(() => load());
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [adding, setAdding] = useState(false);
  const [newIdea, setNewIdea] = useState({ title: "", description: "", category: "Other", status: "New" });
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState({});

  const update = (next) => { setIdeas(next); save(next); };

  const add = () => {
    if (!newIdea.title.trim()) return;
    update([{ ...newIdea, id: Date.now(), date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }, ...ideas]);
    setAdding(false);
    setNewIdea({ title: "", description: "", category: "Other", status: "New" });
  };

  const del = (id) => update(ideas.filter((i) => i.id !== id));
  const startEdit = (idea) => { setEditId(idea.id); setEditVal({ ...idea }); };
  const saveEdit = () => { update(ideas.map((i) => i.id === editId ? editVal : i)); setEditId(null); };

  const filtered = ideas.filter((i) => {
    const matchSearch = i.title.toLowerCase().includes(search.toLowerCase()) || i.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "All" || i.category === catFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command Center / Idea Vault" rightText="Idea Management" />
      <div className="px-8 py-6 space-y-5">

        {/* Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <Input placeholder="Search ideas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-card border-white/[0.06] text-white placeholder:text-white/20 h-9" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${catFilter === c ? "bg-orange-500/15 text-orange-500 border border-orange-500/20" : "text-white/30 hover:text-white/50 border border-transparent"}`}>{c}</button>
            ))}
          </div>
          <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors">
            <Plus className="w-4 h-4" />Add Idea
          </button>
        </div>

        {/* Add Form */}
        {adding && (
          <div className="bg-card rounded-xl border border-orange-500/20 p-5 space-y-3">
            <h3 className="text-white font-bold text-xs tracking-[0.15em] uppercase">New Idea</h3>
            <Input value={newIdea.title} onChange={(e) => setNewIdea({ ...newIdea, title: e.target.value })} placeholder="Idea title..." className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25" autoFocus />
            <textarea value={newIdea.description} onChange={(e) => setNewIdea({ ...newIdea, description: e.target.value })} placeholder="Describe the idea..." className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none resize-none min-h-[80px]" />
            <div className="flex gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs">Category:</span>
                <select value={newIdea.category} onChange={(e) => setNewIdea({ ...newIdea, category: e.target.value })} className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-white outline-none">
                  {CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs">Status:</span>
                <select value={newIdea.status} onChange={(e) => setNewIdea({ ...newIdea, status: e.target.value })} className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-white outline-none">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={add} className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors"><Check className="w-3.5 h-3.5" />Save Idea</button>
              <button onClick={() => setAdding(false)} className="px-4 py-2 text-white/30 hover:text-white/60 text-xs transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {/* Ideas List */}
        {filtered.length === 0 && !adding && (
          <div className="bg-card rounded-xl border border-white/[0.06] p-12 text-center">
            <Lightbulb className="w-8 h-8 text-white/10 mx-auto mb-3" />
            <p className="text-white/25 text-sm">No ideas yet. Start capturing your thoughts.</p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((idea) => (
            <div key={idea.id} className="bg-card rounded-xl border border-white/[0.06] p-5 group hover:border-orange-500/15 transition-all">
              {editId === idea.id ? (
                <div className="space-y-3">
                  <Input value={editVal.title} onChange={(e) => setEditVal({ ...editVal, title: e.target.value })} className="bg-white/[0.04] border-white/[0.08] text-white" />
                  <textarea value={editVal.description} onChange={(e) => setEditVal({ ...editVal, description: e.target.value })} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none resize-none min-h-[80px]" />
                  <div className="flex gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-white/40 text-xs">Category:</span>
                      <select value={editVal.category} onChange={(e) => setEditVal({ ...editVal, category: e.target.value })} className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-white outline-none">
                        {CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/40 text-xs">Status:</span>
                      <select value={editVal.status} onChange={(e) => setEditVal({ ...editVal, status: e.target.value })} className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-white outline-none">
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors"><Check className="w-3.5 h-3.5" />Save</button>
                    <button onClick={() => setEditId(null)} className="px-4 py-2 text-white/30 hover:text-white/60 text-xs transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-white/90 text-sm font-semibold">{idea.title}</h3>
                        <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-orange-500/10 text-orange-500/70">{idea.category}</span>
                        <StatusBadge status={idea.status} />
                      </div>
                      {idea.description && <p className="text-white/45 text-sm mt-1 leading-relaxed">{idea.description}</p>}
                      <p className="text-white/15 text-[10px] mt-2">{idea.date}</p>
                    </div>
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => startEdit(idea)} className="p-1.5 text-white/20 hover:text-white/60 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => del(idea.id)} className="p-1.5 text-white/20 hover:text-red-400/60 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    "New": "bg-blue-500/10 text-blue-400/70",
    "In Review": "bg-yellow-500/10 text-yellow-400/70",
    "Planned": "bg-purple-500/10 text-purple-400/70",
    "Implemented": "bg-green-500/10 text-green-400/70",
    "Shelved": "bg-white/5 text-white/25",
  };
  return <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded ${colors[status] || "bg-white/5 text-white/25"}`}>{status}</span>;
}