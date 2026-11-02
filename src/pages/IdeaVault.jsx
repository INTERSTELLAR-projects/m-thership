import { useState, useEffect, useRef } from "react";
import { useCategoryList } from "@/hooks/useOptionList";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Check, X, Lightbulb, Search, Settings, GripVertical, Loader2, Sparkles, ChevronDown, ChevronUp, ArrowLeft, Zap, Rocket } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import MicButton from "../components/MicButton";
import ActionPlan, { Micro } from "@/features/ideas/ActionPlan";
import { generatePlan, createProjectFromPlan } from "@/features/ideas/planGen";

// Categories are shared: Settings > Lists & fields > Idea categories (old per-browser list seeds it once).
const IDEA_CATS_KEY = "idea_vault_categories";

function persistCats() {
  // kept as a no-op so older call sites stay harmless; categories now live in AppSettings.
}
const STATUS_OPTIONS = ["New", "In Review", "Planned", "Implemented", "Shelved"];
const fieldCls = "bg-ink/[0.03] border border-ink/[0.13] rounded-md px-2 py-1.5 text-xs text-ink outline-none focus:border-[#ff6a00]/60";
const pill = (on) => `px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${on ? "border-[#ff3c00]/40 bg-[#ff3c00]/[0.07] text-[#d13300]" : "border-transparent text-ink/50 hover:text-ink/75"}`;

export default function IdeaVault() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const openId = params.get("idea");
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, saveCats] = useCategoryList("idea_categories", IDEA_CATS_KEY);
  const catsRef = useRef(categories);
  catsRef.current = categories;
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [adding, setAdding] = useState(false);
  const [newIdea, setNewIdea] = useState({ title: "", description: "", category: "", status: "New" });
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState({});
  const [managingCats, setManagingCats] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editCat, setEditCat] = useState(null);
  const [generating, setGenerating] = useState({});
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    base44.entities.Idea.list("-created_date", 200).then((data) => {
      setIdeas(data);
      const saved = catsRef.current;
      const existingCats = [...new Set(data.map((i) => i.category).filter(Boolean))];
      const merged = [...new Set([...saved, ...existingCats])];
      if (merged.length !== saved.length) { saveCats(merged).catch(() => null); persistCats(); }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const patchLocal = (id, fields) => setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...fields } : i)));
  const openIdea = (id) => setParams(id ? { idea: id } : {});

  const runPlan = async (idea) => {
    setError("");
    setGenerating((g) => ({ ...g, [idea.id]: true }));
    try {
      const fields = await generatePlan(idea);
      patchLocal(idea.id, fields);
    } catch (e) {
      setError(`Plan generation failed: ${e?.message || "unknown error"}`);
    } finally {
      setGenerating((g) => ({ ...g, [idea.id]: false }));
    }
  };

  const add = async () => {
    if (!newIdea.title.trim()) return;
    const cat = newIdea.category || categories[0] || "Other";
    const created = await base44.entities.Idea.create({
      ...newIdea, category: cat,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    });
    setIdeas((prev) => [created, ...prev]);
    setAdding(false);
    setNewIdea({ title: "", description: "", category: "", status: "New" });
    runPlan(created);
  };

  // Legacy free-text analysis, kept for older ideas
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
    patchLocal(idea.id, { aiAnalysis: result });
  };

  const del = async (id) => {
    if (!window.confirm("Delete this idea?")) return;
    await base44.entities.Idea.delete(id);
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    if (openId === id) openIdea(null);
  };

  const startEdit = (idea) => { setEditId(idea.id); setEditVal({ ...idea }); };
  const saveEdit = async () => {
    const { id, title, description, category, status } = editVal;
    await base44.entities.Idea.update(id, { title, description, category, status });
    patchLocal(id, { title, description, category, status });
    setEditId(null);
  };
  const setStatus = async (idea, status) => {
    patchLocal(idea.id, { status });
    await base44.entities.Idea.update(idea.id, { status });
  };

  const toggleStep = async (idea, key) => {
    const next = { ...(idea.plan_progress || {}), [key]: !(idea.plan_progress || {})[key] };
    patchLocal(idea.id, { plan_progress: next });
    await base44.entities.Idea.update(idea.id, { plan_progress: next });
  };

  const turnIntoProject = async (idea) => {
    if (!window.confirm(`Create a project and tasks from "${idea.title}"?`)) return;
    setCreating(true);
    setError("");
    try {
      const project = await createProjectFromPlan(idea);
      patchLocal(idea.id, { project_id: project.id, status: "Planned" });
      navigate(`/projects/${project.id}`);
    } catch (e) {
      setError(`Could not create project: ${e?.message || "unknown error"}`);
    } finally {
      setCreating(false);
    }
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
    saveCats(categories.map((c, idx) => (idx === i ? t : c)));
    const affected = ideas.filter((idea) => idea.category === old);
    for (const idea of affected) await base44.entities.Idea.update(idea.id, { category: t });
    setIdeas((prev) => prev.map((idea) => (idea.category === old ? { ...idea, category: t } : idea)));
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

  const q = search.toLowerCase();
  const filtered = ideas.filter((i) => {
    const matchSearch = !q || (i.title || "").toLowerCase().includes(q) || (i.description || "").toLowerCase().includes(q) || (i.plan?.verdict || "").toLowerCase().includes(q);
    const matchCat = catFilter === "All" || i.category === catFilter;
    const matchStatus = statusFilter === "All" || (i.status || "New") === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });
  const counts = STATUS_OPTIONS.reduce((m, s) => ({ ...m, [s]: ideas.filter((i) => (i.status || "New") === s).length }), {});
  const planned = ideas.filter((i) => i.plan).length;
  const current = openId ? ideas.find((i) => i.id === openId) : null;

  const editForm = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input value={editVal.title || ""} onChange={(e) => setEditVal({ ...editVal, title: e.target.value })} className="flex-1 border-ink/[0.13] bg-ink/[0.03] text-ink" />
        <MicButton onResult={(t) => setEditVal((p) => ({ ...p, title: (p.title || "") + (p.title ? " " : "") + t }))} />
      </div>
      <div className="relative">
        <textarea value={editVal.description || ""} onChange={(e) => setEditVal({ ...editVal, description: e.target.value })} className="min-h-[100px] w-full resize-y rounded-md border border-ink/[0.13] bg-ink/[0.03] px-3 py-2 pr-9 text-sm text-ink outline-none" />
        <MicButton onResult={(t) => setEditVal((p) => ({ ...p, description: (p.description || "") + (p.description ? " " : "") + t }))} className="absolute right-1 top-2" />
      </div>
      <div className="flex flex-wrap gap-3">
        <select value={editVal.category || ""} onChange={(e) => setEditVal({ ...editVal, category: e.target.value })} className={fieldCls}>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select value={editVal.status || "New"} onChange={(e) => setEditVal({ ...editVal, status: e.target.value })} className={fieldCls}>{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </div>
      <div className="flex gap-2">
        <button onClick={saveEdit} className="flex items-center gap-1.5 rounded-md bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-[#ff3c00]"><Check className="h-3.5 w-3.5" />Save</button>
        <button onClick={() => setEditId(null)} className="px-4 py-2 text-xs text-ink/50 hover:text-ink/75">Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Agency / Idea Vault" rightText={`${ideas.length} ideas · ${planned} with plans`} />
      <div className="space-y-5 px-4 py-6 md:px-8">
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-red-600/30 bg-red-600/[0.05] px-4 py-2.5 text-xs text-red-700">
            {error}<button onClick={() => setError("")}><X className="h-3.5 w-3.5" /></button>
          </div>
        )}

        {current ? (
          /* ---------- DETAIL ---------- */
          <div className="space-y-5">
            <button onClick={() => openIdea(null)} className="mono-label inline-flex items-center gap-1.5 text-[10px] text-ink/55 hover:text-[#ff3c00]"><ArrowLeft className="h-3.5 w-3.5" />All ideas</button>
            <div className="game-panel p-5 md:p-6">
              {editId === current.id ? editForm : (
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Micro>{current.category || "Uncategorised"}</Micro>
                      {current.date && <Micro className="text-ink/35">· {current.date}</Micro>}
                    </div>
                    <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.035em] text-ink md:text-[32px]">{current.title}</h2>
                    {current.description && <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-ink/65">{current.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <select value={current.status || "New"} onChange={(e) => setStatus(current, e.target.value)} className={fieldCls}>{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                    <button onClick={() => startEdit(current)} className="rounded-md border border-ink/15 p-2 text-ink/50 hover:text-ink"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => del(current.id)} className="rounded-md border border-ink/15 p-2 text-ink/50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-[#ff3c00]" /><Micro className="text-ink/65">Action plan</Micro></div>
              <ActionPlan
                idea={current}
                generating={!!generating[current.id]}
                onGenerate={() => runPlan(current)}
                onToggleStep={(k) => toggleStep(current, k)}
                onCreateProject={() => turnIntoProject(current)}
                creating={creating}
              />
            </div>

            <AIAnalysisPanel idea={current} onReanalyze={analyzeIdea} />
          </div>
        ) : (
          /* ---------- LIST ---------- */
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1 md:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/[0.38]" />
                <Input placeholder="Search ideas, plans…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 border-ink/[0.13] bg-card pl-10 text-ink placeholder:text-ink/[0.38]" />
              </div>
              <button onClick={() => setAdding(true)} className="ml-auto flex items-center gap-2 rounded-md flame-bg px-4 py-2 text-xs font-semibold text-white"><Plus className="h-4 w-4" />Add idea</button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Micro className="mr-1">Status</Micro>
              <button onClick={() => setStatusFilter("All")} className={pill(statusFilter === "All")}>All · {ideas.length}</button>
              {STATUS_OPTIONS.map((s) => <button key={s} onClick={() => setStatusFilter(s)} className={pill(statusFilter === s)}>{s} · {counts[s] || 0}</button>)}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Micro className="mr-1">Category</Micro>
              <button onClick={() => setCatFilter("All")} className={pill(catFilter === "All")}>All</button>
              {categories.map((c) => <button key={c} onClick={() => setCatFilter(c)} className={pill(catFilter === c)}>{c}</button>)}
              <button onClick={() => setManagingCats(true)} title="Manage categories" className="rounded-md border border-dashed border-ink/[0.18] p-1.5 text-ink/40 hover:text-ink/70"><Settings className="h-3.5 w-3.5" /></button>
            </div>

            {managingCats && (
              <div className="game-panel space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <Micro className="text-ink/65">Manage categories</Micro>
                  <button onClick={() => setManagingCats(false)} className="text-ink/50 hover:text-ink"><X className="h-4 w-4" /></button>
                </div>
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="idea-cats">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="max-h-64 space-y-1 overflow-y-auto">
                        {categories.map((cat, i) => (
                          <Draggable key={cat} draggableId={cat} index={i}>
                            {(drag) => (
                              <div ref={drag.innerRef} {...drag.draggableProps} className="flex items-center gap-2 rounded-md border border-ink/[0.13] bg-ink/[0.02] p-2">
                                <span {...drag.dragHandleProps} className="cursor-grab text-ink/[0.33] hover:text-ink/60"><GripVertical className="h-3.5 w-3.5" /></span>
                                {editCat?.index === i ? (
                                  <>
                                    <Input value={editCat.val} onChange={(e) => setEditCat({ ...editCat, val: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") saveEditCat(i); if (e.key === "Escape") setEditCat(null); }} className="h-7 flex-1 border-ink/[0.13] bg-ink/[0.04] text-xs text-ink" autoFocus />
                                    <button onClick={() => saveEditCat(i)} className="text-xs font-semibold text-[#ff3c00]">Save</button>
                                    <button onClick={() => setEditCat(null)} className="text-xs text-ink/50">Cancel</button>
                                  </>
                                ) : (
                                  <>
                                    <span className="flex-1 text-sm text-ink/75">{cat}</span>
                                    <button onClick={() => setEditCat({ index: i, val: cat })} className="p-1 text-ink/[0.43] hover:text-ink/70"><Pencil className="h-3.5 w-3.5" /></button>
                                    <button onClick={() => deleteCat(i)} className="p-1 text-ink/[0.43] hover:text-red-600/70"><Trash2 className="h-3.5 w-3.5" /></button>
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
                  <Input placeholder="New category…" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCat()} className="h-9 flex-1 border-ink/[0.13] bg-ink/[0.03] text-ink" />
                  <button onClick={addCat} className="rounded-md bg-ink px-3 py-2 text-white hover:bg-[#ff3c00]"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
            )}

            {adding && (
              <div className="game-panel relative space-y-3 p-5">
                <span className="pointer-events-none absolute left-0 top-0 h-[2px] w-full flame-bg" />
                <Micro className="text-[#ff3c00]">New idea · a plan is generated automatically</Micro>
                <div className="flex items-center gap-2">
                  <Input value={newIdea.title} onChange={(e) => setNewIdea({ ...newIdea, title: e.target.value })} placeholder="Idea title…" className="flex-1 border-ink/[0.13] bg-ink/[0.03] text-ink" autoFocus />
                  <MicButton onResult={(t) => setNewIdea((p) => ({ ...p, title: p.title + (p.title ? " " : "") + t }))} />
                </div>
                <div className="relative">
                  <textarea value={newIdea.description} onChange={(e) => setNewIdea({ ...newIdea, description: e.target.value })} placeholder="Brain-dump it — who it's for, why now, anything you know…" className="min-h-[90px] w-full resize-y rounded-md border border-ink/[0.13] bg-ink/[0.03] px-3 py-2 pr-9 text-sm text-ink outline-none placeholder:text-ink/40" />
                  <MicButton onResult={(t) => setNewIdea((p) => ({ ...p, description: p.description + (p.description ? " " : "") + t }))} className="absolute right-1 top-2" />
                </div>
                <div className="flex flex-wrap gap-3">
                  <select value={newIdea.category || categories[0]} onChange={(e) => setNewIdea({ ...newIdea, category: e.target.value })} className={fieldCls}>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                  <select value={newIdea.status} onChange={(e) => setNewIdea({ ...newIdea, status: e.target.value })} className={fieldCls}>{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                </div>
                <div className="flex gap-2">
                  <button onClick={add} className="flex items-center gap-1.5 rounded-md flame-bg px-4 py-2 text-xs font-semibold text-white"><Check className="h-3.5 w-3.5" />Save & plan</button>
                  <button onClick={() => setAdding(false)} className="px-4 py-2 text-xs text-ink/50 hover:text-ink/75">Cancel</button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ink/[0.38]" /></div>
            ) : filtered.length === 0 && !adding ? (
              <div className="game-panel p-12 text-center">
                <Lightbulb className="mx-auto mb-3 h-8 w-8 text-ink/[0.28]" />
                <p className="text-sm text-ink/[0.48]">{ideas.length ? "No ideas match these filters." : "No ideas yet. Throw one in — you'll get a plan back."}</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((idea) => editId === idea.id ? (
                  <div key={idea.id} className="game-panel p-5 sm:col-span-2 xl:col-span-3">{editForm}</div>
                ) : (
                  <IdeaCard key={idea.id} idea={idea} generating={!!generating[idea.id]} onOpen={() => openIdea(idea.id)} onEdit={() => startEdit(idea)} onDelete={() => del(idea.id)} onPlan={() => runPlan(idea)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function IdeaCard({ idea, generating, onOpen, onEdit, onDelete, onPlan }) {
  const plan = idea.plan;
  const steps = (plan?.phases || []).reduce((n, p) => n + (p.steps?.length || 0), 0);
  const done = Object.values(idea.plan_progress || {}).filter(Boolean).length;
  const pct = steps ? Math.round((done / steps) * 100) : 0;
  return (
    <div onClick={onOpen} className="game-panel group flex cursor-pointer flex-col p-5 transition-colors hover:border-ink/40">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mono-label rounded border border-ink/10 px-1.5 py-0.5 text-[9.5px] text-ink/55">{idea.category || "—"}</span>
          <StatusBadge status={idea.status} />
          {idea.project_id && <span className="mono-label inline-flex items-center gap-1 rounded bg-ink px-1.5 py-0.5 text-[9px] text-white"><Rocket className="h-2.5 w-2.5" />Project</span>}
        </div>
        <div className="flex gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1 text-ink/40 hover:text-ink"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-ink/40 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <h3 className="mt-3 text-[16px] font-semibold leading-snug tracking-[-0.02em] text-ink group-hover:text-[#ff3c00]">{idea.title}</h3>
      {idea.description && <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink/55">{idea.description}</p>}

      <div className="mt-auto pt-4">
        {generating ? (
          <p className="flex items-center gap-2 text-xs text-ink/50"><Loader2 className="h-3.5 w-3.5 animate-spin" />Building action plan…</p>
        ) : plan ? (
          <div className="border-t border-hair pt-3">
            <Micro className="text-[#ff3c00]">Do first</Micro>
            <p className="mt-1 line-clamp-2 text-[12.5px] font-medium text-ink/80">{plan.do_first?.title || plan.verdict}</p>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink/[0.07]"><div className="h-full flame-bg" style={{ width: `${pct}%` }} /></div>
              <span className="mono-label text-[9.5px] text-ink/45">{done}/{steps}</span>
            </div>
          </div>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); onPlan(); }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ff3c00] hover:underline"><Zap className="h-3.5 w-3.5" />Generate action plan</button>
        )}
        {idea.date && <p className="mono-label mt-3 text-[9px] text-ink/30">{idea.date}</p>}
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
    try { await onReanalyze(idea); } finally { setLoading(false); }
  };
  return (
    <div className="game-panel p-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-2 text-left">
          <Sparkles className="h-3.5 w-3.5 text-ink/40" />
          <Micro>Quick analysis {idea.aiAnalysis ? "" : "· none yet"}</Micro>
          {loading ? <Loader2 className="h-3 w-3 animate-spin text-ink/40" /> : open ? <ChevronUp className="h-3 w-3 text-ink/40" /> : <ChevronDown className="h-3 w-3 text-ink/40" />}
        </button>
        <button onClick={handleReanalyze} disabled={loading} className="text-[11px] text-ink/45 hover:text-[#ff3c00]">{idea.aiAnalysis ? "↺ Refresh" : "Run"}</button>
      </div>
      {open && !loading && idea.aiAnalysis && (
        <ReactMarkdown className="prose prose-sm mt-3 max-w-none text-xs text-ink/65 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_li]:my-0.5 [&_ul]:pl-4">
          {idea.aiAnalysis}
        </ReactMarkdown>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = { New: "bg-blue-500/10 text-blue-700/80", "In Review": "bg-yellow-500/15 text-yellow-700/80", Planned: "bg-purple-500/10 text-purple-700/80", Implemented: "bg-green-500/10 text-green-700/80", Shelved: "bg-ink/5 text-ink/[0.45]" };
  return <span className={`mono-label rounded px-1.5 py-0.5 text-[9.5px] ${colors[status] || colors.Shelved}`}>{status || "New"}</span>;
}
