import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Check, X, Lightbulb, Search, Settings, GripVertical, Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import MicButton from "../components/MicButton";

const DEFAULT_CATEGORIES = ["Marketing", "Product", "Operations", "Tech", "Content", "Other"];
const IDEA_CATS_KEY = "idea_vault_categories";

function loadIdeaCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem(IDEA_CATS_KEY));
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch {}
  return DEFAULT_CATEGORIES;
}
const STATUS_OPTIONS = ["New", "In Review", "Planned", "Implemented", "Shelved"];

export default function IdeaVault() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState({});
  const [categories, setCategories] = useState(loadIdeaCategories);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [adding, setAdding] = useState(false);
  const [newIdea, setNewIdea] = useState({ title: "", description: "", category: "", status: "New" });
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState({});
  const [managingCats, setManagingCats] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editCat, setEditCat] = useState(null);

  useEffect(() => {
    base44.entities.Idea.list("-created_date", 200).then((data) => {
      setIdeas(data);
      // Merge any new categories from existing ideas into saved list
      const saved = loadIdeaCategories();
      const existingCats = [...new Set(data.map((i) => i.category).filter(Boolean))];
      const merged = [...new Set([...saved, ...existingCats])];
      if (merged.length !== saved.length) {
        setCategories(merged);
        localStorage.setItem(IDEA_CATS_KEY, JSON.stringify(merged));
      }
      setLoading(false);
    });
  }, []);

  const add = async () => {
    if (!newIdea.title.trim()) return;
    const cat = newIdea.category || categories[0] || "Other";
    const created = await base44.entities.Idea.create({
      ...newIdea, category: cat,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    });
    setIdeas([created, ...ideas]);
    setAdding(false);
    setNewIdea({ title: "", description: "", category: "", status: "New" });
    // Trigger AI analysis in background
    analyzeIdea(created);
  };

  const analyzeIdea = async (idea) => {
    const prompt = `You are a sharp business strategist and creative advisor. Analyze this business idea and provide:
1. A quick take on its potential and strengths
2. 3-5 specific add-ons or expansions that could make it significantly better
3. Any important considerations or pitfalls to watch for

Be concise, practical, and actionable. Use bullet points.

Idea Title: ${idea.title}
Description: ${idea.description || "(no description provided)"}
Category: ${idea.category}`;

    const result = await base44.integrations.Core.InvokeLLM({ prompt, model: "claude_sonnet_4_6" });
    await base44.entities.Idea.update(idea.id, { aiAnalysis: result });
    setIdeas((prev) => prev.map((i) => i.id === idea.id ? { ...i, aiAnalysis: result } : i));
  };

  const del = async (id) => {
    await base44.entities.Idea.delete(id);
    setIdeas(ideas.filter((i) => i.id !== id));
  };

  const startEdit = (idea) => { setEditId(idea.id); setEditVal({ ...idea }); };

  const saveEdit = async () => {
    const { id, created_date, updated_date, created_by, ...fields } = editVal;
    await base44.entities.Idea.update(id, fields);
    setIdeas(ideas.map((i) => i.id === id ? editVal : i));
    setEditId(null);
  };

  const saveCats = (next) => {
    setCategories(next);
    localStorage.setItem(IDEA_CATS_KEY, JSON.stringify(next));
  };

  const addCat = () => {
    const t = newCatName.trim();
    if (!t || categories.includes(t)) return;
    saveCats([...categories, t]);
    setNewCatName("");
  };

  const deleteCat = (i) => {
    const next = categories.filter((_, idx) => idx !== i);
    saveCats(next);
    if (catFilter === categories[i]) setCatFilter("All");
  };

  const saveEditCat = async (i) => {
    const t = editCat.val.trim();
    if (!t) return;
    const old = categories[i];
    saveCats(categories.map((c, idx) => idx === i ? t : c));
    // Update all ideas in that category
    const affected = ideas.filter((idea) => idea.category === old);
    for (const idea of affected) {
      await base44.entities.Idea.update(idea.id, { category: t });
    }
    setIdeas(ideas.map((idea) => idea.category === old ? { ...idea, category: t } : idea));
    if (catFilter === old) setCatFilter(t);
    setEditCat(null);
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const next = Array.from(categories);
    const [removed] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, removed);
    saveCats(next);
  };

  const filtered = ideas.filter((i) => {
    const matchSearch = i.title.toLowerCase().includes(search.toLowerCase()) || i.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "All" || i.category === catFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command Center / Idea Vault" rightText="Idea Management" />
      <div className="px-8 py-6 space-y-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/[0.38]" />
            <Input placeholder="Search ideas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-card border-ink/[0.13] text-ink placeholder:text-ink/[0.38] h-9" />
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            <button onClick={() => setCatFilter("All")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${catFilter === "All" ? "bg-gradient-to-r from-orange-500/20 to-amber-400/10 text-orange-300 border border-orange-500/30 shadow-[0_0_12px_rgba(255,106,0,0.25)]" : "text-ink/[0.48] hover:text-ink/50 border border-transparent"}`}>All</button>
            {categories.map((c) => (
              <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${catFilter === c ? "bg-gradient-to-r from-orange-500/20 to-amber-400/10 text-orange-300 border border-orange-500/30 shadow-[0_0_12px_rgba(255,106,0,0.25)]" : "text-ink/[0.48] hover:text-ink/50 border border-transparent"}`}>{c}</button>
            ))}
            <button onClick={() => setManagingCats(true)} className="p-1.5 rounded-lg text-ink/[0.38] hover:text-ink/50 border border-dashed border-ink/[0.13] hover:border-ink/20 transition-all"><Settings className="w-3.5 h-3.5" /></button>
          </div>
          <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-semibold shadow-[0_0_14px_rgba(255,106,0,0.25)] text-xs font-semibold rounded-lg transition-colors"><Plus className="w-4 h-4" />Add Idea</button>
        </div>

        {managingCats && (
          <div className="relative overflow-hidden bg-card rounded-xl border border-orange-500/25 p-5 space-y-3 shadow-[0_0_16px_rgba(255,106,0,0.12)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Manage Categories</h3>
              <button onClick={() => setManagingCats(false)} className="text-ink/[0.48] hover:text-ink/60"><X className="w-4 h-4" /></button>
            </div>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="idea-cats">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1 max-h-64 overflow-y-auto">
                    {categories.map((cat, i) => (
                      <Draggable key={cat} draggableId={cat} index={i}>
                        {(drag) => (
                          <div ref={drag.innerRef} {...drag.draggableProps} className="flex items-center gap-2 p-2 rounded-lg bg-ink/[0.02] border border-ink/[0.13]">
                            <span {...drag.dragHandleProps} className="text-ink/[0.33] hover:text-ink/[0.58] cursor-grab active:cursor-grabbing"><GripVertical className="w-3.5 h-3.5" /></span>
                            {editCat?.index === i ? (
                              <>
                                <Input value={editCat.val} onChange={(e) => setEditCat({ ...editCat, val: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") saveEditCat(i); if (e.key === "Escape") setEditCat(null); }} className="h-7 flex-1 bg-ink/[0.04] border-ink/[0.13] text-ink text-xs" autoFocus />
                                <button onClick={() => saveEditCat(i)} className="text-orange-500 text-xs font-semibold hover:text-orange-400">Save</button>
                                <button onClick={() => setEditCat(null)} className="text-ink/[0.48] text-xs hover:text-ink/60">Cancel</button>
                              </>
                            ) : (
                              <>
                                <span className="flex-1 text-ink/70 text-sm">{cat}</span>
                                <button onClick={() => setEditCat({ index: i, val: cat })} className="p-1 text-ink/[0.43] hover:text-ink/60 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                                <button onClick={() => deleteCat(i)} className="p-1 text-ink/[0.43] hover:text-red-600/70 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                              </>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            <div className="flex gap-2 pt-1">
              <Input placeholder="New category..." value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCat()} className="flex-1 bg-ink/[0.03] border-ink/[0.13] text-ink placeholder:text-ink/[0.38] h-9" />
              <button onClick={addCat} className="px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-semibold shadow-[0_0_14px_rgba(255,106,0,0.25)] rounded-lg transition-colors"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {adding && (
          <div className="relative overflow-hidden bg-card rounded-xl border border-orange-500/35 p-5 space-y-3 shadow-[0_0_16px_rgba(255,106,0,0.18)]">
            <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">New Idea</h3>
            <div className="flex items-center gap-2">
              <Input value={newIdea.title} onChange={(e) => setNewIdea({ ...newIdea, title: e.target.value })} placeholder="Idea title..." className="bg-ink/[0.04] border-ink/[0.13] text-ink placeholder:text-ink/[0.43] flex-1" autoFocus />
              <MicButton onResult={(t) => setNewIdea((p) => ({ ...p, title: p.title + (p.title ? " " : "") + t }))} />
            </div>
            <div className="relative">
              <textarea value={newIdea.description} onChange={(e) => setNewIdea({ ...newIdea, description: e.target.value })} placeholder="Describe the idea..." className="w-full bg-ink/[0.04] border border-ink/[0.13] rounded-lg px-3 py-2 pr-9 text-sm text-ink placeholder:text-ink/[0.43] outline-none resize-none min-h-[80px]" />
              <MicButton onResult={(t) => setNewIdea((p) => ({ ...p, description: p.description + (p.description ? " " : "") + t }))} className="absolute top-2 right-1" />
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-ink/[0.58] text-xs">Category:</span>
                <select value={newIdea.category || categories[0]} onChange={(e) => setNewIdea({ ...newIdea, category: e.target.value })} className="bg-ink/[0.04] border border-ink/[0.13] rounded px-2 py-1 text-xs text-ink outline-none">
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-ink/[0.58] text-xs">Status:</span>
                <select value={newIdea.status} onChange={(e) => setNewIdea({ ...newIdea, status: e.target.value })} className="bg-ink/[0.04] border border-ink/[0.13] rounded px-2 py-1 text-xs text-ink outline-none">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={add} className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-semibold shadow-[0_0_14px_rgba(255,106,0,0.25)] text-xs font-semibold rounded-lg transition-colors"><Check className="w-3.5 h-3.5" />Save Idea</button>
              <button onClick={() => setAdding(false)} className="px-4 py-2 text-ink/[0.48] hover:text-ink/60 text-xs transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-ink/[0.38] animate-spin" /></div>
        ) : (
          <>
            {filtered.length === 0 && !adding && (
              <div className="game-panel p-12 text-center">
                <Lightbulb className="w-8 h-8 text-ink/[0.28] mx-auto mb-3" />
                <p className="text-ink/[0.43] text-sm">No ideas yet. Start capturing your thoughts.</p>
              </div>
            )}
            <div className="space-y-3">
              {filtered.map((idea) => (
                <div key={idea.id} className="card-hover game-panel p-5 group">
                  {editId === idea.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Input value={editVal.title} onChange={(e) => setEditVal({ ...editVal, title: e.target.value })} className="bg-ink/[0.04] border-ink/[0.13] text-ink flex-1" />
                        <MicButton onResult={(t) => setEditVal((p) => ({ ...p, title: p.title + (p.title ? " " : "") + t }))} />
                      </div>
                      <div className="relative">
                        <textarea value={editVal.description} onChange={(e) => setEditVal({ ...editVal, description: e.target.value })} className="w-full bg-ink/[0.04] border border-ink/[0.13] rounded-lg px-3 py-2 pr-9 text-sm text-ink outline-none resize-none min-h-[80px]" />
                        <MicButton onResult={(t) => setEditVal((p) => ({ ...p, description: p.description + (p.description ? " " : "") + t }))} className="absolute top-2 right-1" />
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-ink/[0.58] text-xs">Category:</span>
                          <select value={editVal.category} onChange={(e) => setEditVal({ ...editVal, category: e.target.value })} className="bg-ink/[0.04] border border-ink/[0.13] rounded px-2 py-1 text-xs text-ink outline-none">
                            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-ink/[0.58] text-xs">Status:</span>
                          <select value={editVal.status} onChange={(e) => setEditVal({ ...editVal, status: e.target.value })} className="bg-ink/[0.04] border border-ink/[0.13] rounded px-2 py-1 text-xs text-ink outline-none">
                            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-semibold shadow-[0_0_14px_rgba(255,106,0,0.25)] text-xs font-semibold rounded-lg transition-colors"><Check className="w-3.5 h-3.5" />Save</button>
                        <button onClick={() => setEditId(null)} className="px-4 py-2 text-ink/[0.48] hover:text-ink/60 text-xs transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <button onClick={() => setCollapsed((p) => ({ ...p, [idea.id]: !p[idea.id] }))} className="text-left">
                            <h3 className="text-ink/90 text-sm font-semibold hover:text-ink transition-colors">{idea.title}</h3>
                          </button>
                          <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded border bg-orange-500/15 border-orange-500/25 text-orange-300/80">{idea.category}</span>
                          <StatusBadge status={idea.status} />
                        </div>
                        {!collapsed[idea.id] && (
                          <>
                            {idea.description && <p className="text-ink/[0.63] text-sm mt-1 leading-relaxed">{idea.description}</p>}
                            <p className="text-ink/[0.33] text-[10px] mt-2">{idea.date}</p>
                            <AIAnalysisPanel idea={idea} onReanalyze={analyzeIdea} />
                          </>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0 items-center">
                        <button onClick={() => setCollapsed((p) => ({ ...p, [idea.id]: !p[idea.id] }))} className="p-1.5 text-ink/[0.38] hover:text-ink/50 transition-colors">{collapsed[idea.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}</button>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => startEdit(idea)} className="p-1.5 text-ink/[0.38] hover:text-ink/60 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => del(idea.id)} className="p-1.5 text-ink/[0.38] hover:text-red-600/60 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                ))}
                </div>
          </>
        )}
      </div>
    </div>
  );
}

function AIAnalysisPanel({ idea, onReanalyze }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReanalyze = async () => {
    setLoading(true);
    setOpen(true);
    await onReanalyze(idea);
    setLoading(false);
  };

  if (!idea.aiAnalysis && !loading) {
    return (
      <button onClick={handleReanalyze} className="flex items-center gap-1.5 mt-2 text-[10px] font-semibold text-orange-500/50 hover:text-orange-500/80 transition-colors">
        <Sparkles className="w-3 h-3" />Analyze with AI
      </button>
    );
  }

  return (
    <div className="mt-3 border-t border-ink/[0.13] pt-3">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-[10px] font-semibold text-orange-500/60 hover:text-orange-500/90 transition-colors w-full text-left">
        <Sparkles className="w-3 h-3" />
        <span>AI Analysis</span>
        {loading ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : open ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
        {!loading && <button onClick={(e) => { e.stopPropagation(); handleReanalyze(); }} className="ml-auto text-ink/[0.38] hover:text-orange-500/50 transition-colors">↺ Refresh</button>}
      </button>
      {open && !loading && idea.aiAnalysis && (
        <div className="mt-2 bg-orange-500/[0.03] border border-orange-500/10 rounded-lg px-4 py-3">
          <ReactMarkdown className="text-xs text-ink/55 prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_ul]:pl-4 [&_li]:my-0.5">
            {idea.aiAnalysis}
          </ReactMarkdown>
        </div>
      )}
      {loading && (
        <div className="mt-2 flex items-center gap-2 text-ink/[0.43] text-xs"><Loader2 className="w-3.5 h-3.5 animate-spin" />Analyzing your idea...</div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = { "New": "bg-blue-500/10 text-blue-600/70", "In Review": "bg-yellow-500/10 text-yellow-600/70", "Planned": "bg-purple-500/10 text-purple-600/70", "Implemented": "bg-green-500/10 text-green-600/70", "Shelved": "bg-ink/5 text-ink/[0.43]" };
  return <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded ${colors[status] || "bg-ink/5 text-ink/[0.43]"}`}>{status}</span>;
}