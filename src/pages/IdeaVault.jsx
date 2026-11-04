import { useState, useEffect, useMemo, useCallback } from "react";
import { useCategoryList } from "@/hooks/useOptionList";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Check, X, Lightbulb, Search, Settings, GripVertical, Loader2, Sparkles, ChevronDown, ChevronUp, ArrowLeft, Zap, LayoutList, Columns3, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import MicButton from "../components/MicButton";
import ActionPlan, { Micro } from "@/features/ideas/ActionPlan";
import { generatePlan, createProjectFromPlan, loadContext } from "@/features/ideas/planGen";
import { scoreIdea, orderIdeas, persistRanks, effectiveScore, tierOf, stageOf, STAGES, TIERS } from "@/features/ideas/scoring";
import { BuildNextHero, RankedRow, ScorePanel, ConceptBrief, TierChip, StageChip, RankBadge, ScoreDial, MoveArrow } from "@/features/ideas/VaultParts";

// Categories are shared: Settings > Lists & fields > Idea categories (old per-browser list seeds it once).
const IDEA_CATS_KEY = "idea_vault_categories";
const VIEW_KEY = "idea_vault_view";

const STAGE_TO_STATUS = { idea: "New", validating: "In Review", building: "Planned", live: "Implemented", parked: "Shelved" };
const fieldCls = "bg-ink/[0.03] border border-ink/[0.13] rounded-md px-2 py-1.5 text-xs text-ink outline-none focus:border-[#ff6a00]/60";
const pill = (on) => `px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${on ? "border-[#ff3c00]/40 bg-[#ff3c00]/[0.07] text-[#d13300]" : "border-transparent text-ink/50 hover:text-ink/75"}`;
const readView = () => { try { return localStorage.getItem(VIEW_KEY) || "list"; } catch { return "list"; } };

export default function IdeaVault() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const openId = params.get("idea");
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storedCats, saveCats] = useCategoryList("idea_categories", IDEA_CATS_KEY);
  const categories = useMemo(() => [...new Set([...storedCats, ...ideas.map((i) => i.category).filter(Boolean)])], [storedCats, ideas]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [tierFilter, setTierFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [view, setViewState] = useState(readView);
  const [adding, setAdding] = useState(false);
  const [newIdea, setNewIdea] = useState({ title: "", description: "", category: "", stage: "idea" });
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState({});
  const [managingCats, setManagingCats] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editCat, setEditCat] = useState(null);
  const [generating, setGenerating] = useState({});
  const [scoring, setScoring] = useState({});
  const [bulk, setBulk] = useState(null); // { done, total }
  const [busyId, setBusyId] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [error, setError] = useState("");

  const setView = (v) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } };

  const reorder = useCallback(async (list) => {
    const ordered = orderIdeas(list);
    const changes = await persistRanks(ordered).catch(() => []);
    const byId = Object.fromEntries(changes.map((c) => [c.id, c.fields]));
    setIdeas(ordered.map((i) => (byId[i.id] ? { ...i, ...byId[i.id] } : i)));
  }, []);

  useEffect(() => {
    base44.entities.Idea.list("-created_date", 300).then((data) => { setLoading(false); reorder(data); }).catch(() => setLoading(false));
  }, [reorder]);

  const ordered = useMemo(() => orderIdeas(ideas), [ideas]);
  const patchLocal = (id, fields) => setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...fields } : i)));
  const openIdea = (id) => setParams(id ? { idea: id } : {});

  const runScore = async (idea, ctx) => {
    setScoring((s) => ({ ...s, [idea.id]: true }));
    try {
      const fields = await scoreIdea(idea, ctx);
      return { ...idea, ...fields };
    } finally { setScoring((s) => ({ ...s, [idea.id]: false })); }
  };

  const rescoreOne = async (idea) => {
    setError("");
    try {
      const updated = await runScore(idea);
      await reorder(ideas.map((i) => (i.id === idea.id ? updated : i)));
    } catch (e) { setError(`Scoring failed: ${e?.message || "unknown error"}`); }
  };

  const scoreAll = async (onlyMissing) => {
    setError("");
    const targets = ideas.filter((i) => !onlyMissing || typeof i.score !== "number");
    if (!targets.length) return;
    const ctx = await loadContext().catch(() => null);
    let list = [...ideas];
    setBulk({ done: 0, total: targets.length });
    for (const [n, idea] of targets.entries()) {
      try {
        const u = await runScore(idea, ctx);
        list = list.map((i) => (i.id === u.id ? u : i));
        setIdeas(list);
      } catch (e) { setError(`Scoring "${idea.title}" failed: ${e?.message || "unknown"}`); }
      setBulk({ done: n + 1, total: targets.length });
    }
    await reorder(list);
    setBulk(null);
  };

  const runPlan = async (idea) => {
    setError("");
    setGenerating((g) => ({ ...g, [idea.id]: true }));
    try {
      const fields = await generatePlan(idea);
      patchLocal(idea.id, fields);
      return { ...idea, ...fields };
    } catch (e) {
      setError(`Plan generation failed: ${e?.message || "unknown error"}`);
      return null;
    } finally {
      setGenerating((g) => ({ ...g, [idea.id]: false }));
    }
  };

  // One click from the hero: plan (if missing) -> project + tasks.
  const planAndTasks = async (idea) => {
    if (idea.project_id) return navigate(`/projects/${idea.project_id}`);
    setBusyId(idea.id);
    setError("");
    try {
      const withPlan = idea.plan ? idea : await runPlan(idea);
      if (!withPlan?.plan) return;
      const project = await createProjectFromPlan(withPlan);
      await base44.entities.Idea.update(idea.id, { stage: "building" });
      patchLocal(idea.id, { ...withPlan, project_id: project.id, status: "Planned", stage: "building" });
      navigate(`/projects/${project.id}`);
    } catch (e) {
      setError(`Could not create the plan and tasks: ${e?.message || "unknown error"}`);
    } finally { setBusyId(null); }
  };

  const add = async () => {
    if (!newIdea.title.trim()) return;
    const cat = newIdea.category || categories[0] || "Other";
    const created = await base44.entities.Idea.create({
      ...newIdea, category: cat, status: STAGE_TO_STATUS[newIdea.stage] || "New", source: "manual",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    });
    setIdeas((prev) => [...prev, created]);
    setAdding(false);
    setNewIdea({ title: "", description: "", category: "", stage: "idea" });
    runPlan(created);
    rescoreOne(created);
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
    patchLocal(idea.id, { aiAnalysis: result });
  };

  const del = async (id) => {
    await base44.entities.Idea.delete(id);
    setConfirmDel(null);
    if (openId === id) openIdea(null);
    await reorder(ideas.filter((i) => i.id !== id));
  };

  const startEdit = (idea) => { setEditId(idea.id); setEditVal({ ...idea, stage: stageOf(idea) }); };
  const saveEdit = async () => {
    const { id, title, description, category, stage } = editVal;
    const status = STAGE_TO_STATUS[stage] || "New";
    await base44.entities.Idea.update(id, { title, description, category, stage, status });
    const next = ideas.map((i) => (i.id === id ? { ...i, title, description, category, stage, status } : i));
    setEditId(null);
    await reorder(next);
  };
  const setStage = async (idea, stage) => {
    const status = STAGE_TO_STATUS[stage] || "New";
    await base44.entities.Idea.update(idea.id, { stage, status });
    await reorder(ideas.map((i) => (i.id === idea.id ? { ...i, stage, status } : i)));
  };

  const saveOverride = async (idea, patch) => {
    const o = { ...(idea.override || {}), ...patch, at: new Date().toISOString() };
    if (o.score === null || o.score === undefined || Number.isNaN(o.score)) delete o.score;
    if (!o.rank) delete o.rank;
    await base44.entities.Idea.update(idea.id, { override: o });
    await reorder(ideas.map((i) => (i.id === idea.id ? { ...i, override: o } : i)));
  };

  const toggleStep = async (idea, key) => {
    const next = { ...(idea.plan_progress || {}), [key]: !(idea.plan_progress || {})[key] };
    patchLocal(idea.id, { plan_progress: next });
    await base44.entities.Idea.update(idea.id, { plan_progress: next });
  };

  const turnIntoProject = async (idea) => {
    setBusyId(idea.id);
    setError("");
    try {
      const project = await createProjectFromPlan(idea);
      patchLocal(idea.id, { project_id: project.id, status: "Planned", stage: "building" });
      await base44.entities.Idea.update(idea.id, { stage: "building" });
      navigate(`/projects/${project.id}`);
    } catch (e) {
      setError(`Could not create project: ${e?.message || "unknown error"}`);
    } finally { setBusyId(null); }
  };

  // ---- drag: list view re-ranks inside a tier band; board view moves stage ----
  const onRankDrag = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (view === "board") {
      if (destination.droppableId !== source.droppableId) {
        const idea = ideas.find((i) => i.id === draggableId);
        if (idea) await setStage(idea, destination.droppableId);
      }
      return;
    }
    if (destination.droppableId !== source.droppableId) { setError("Tiers come from the score. To move an idea to another tier, override its score."); return; }
    if (destination.index === source.index) return;
    const band = visible.filter((i) => bandOf(i) === source.droppableId).filter((i) => i.id !== draggableId);
    const without = ordered.filter((i) => i.id !== draggableId);
    let pos;
    if (destination.index < band.length) pos = without.findIndex((i) => i.id === band[destination.index].id);
    else pos = without.findIndex((i) => i.id === band[band.length - 1]?.id) + 1;
    const rank = Math.max(1, pos + 1);
    const idea = ideas.find((i) => i.id === draggableId);
    const o = { ...(idea.override || {}), rank, at: new Date().toISOString() };
    await base44.entities.Idea.update(idea.id, { override: o });
    await reorder(ideas.map((i) => (i.id === idea.id ? { ...i, override: o } : i)));
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
  const onCatDragEnd = (result) => {
    if (!result.destination) return;
    const next = Array.from(categories);
    const [removed] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, removed);
    saveCats(next);
  };

  const bandOf = (i) => tierOf(effectiveScore(i)) || "U";
  const q = search.toLowerCase();
  const visible = ordered.filter((i) => {
    const matchSearch = !q || [i.title, i.description, i.plan?.verdict, i.score_breakdown?.next_action, i.writeup?.pitch].some((t) => String(t || "").toLowerCase().includes(q));
    const matchCat = catFilter === "All" || i.category === catFilter;
    const matchTier = tierFilter === "All" || bandOf(i) === tierFilter;
    const matchStage = stageFilter === "All" || stageOf(i) === stageFilter;
    return matchSearch && matchCat && matchTier && matchStage;
  });
  const top3 = ordered.filter((i) => !["parked", "live"].includes(stageOf(i)) && effectiveScore(i) !== null).slice(0, 3);
  const scoredCount = ideas.filter((i) => typeof i.score === "number").length;
  const tierCounts = ordered.reduce((m, i) => ({ ...m, [bandOf(i)]: (m[bandOf(i)] || 0) + 1 }), {});
  const current = openId ? ideas.find((i) => i.id === openId) : null;
  const BANDS = [...TIERS.map((t) => ({ key: t.key, label: t.label })), { key: "U", label: "Unscored" }];

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
        <select value={editVal.stage || "idea"} onChange={(e) => setEditVal({ ...editVal, stage: e.target.value })} className={fieldCls}>{STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
      </div>
      <div className="flex gap-2">
        <button onClick={saveEdit} className="flex items-center gap-1.5 rounded-md bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-[#ff3c00]"><Check className="h-3.5 w-3.5" />Save</button>
        <button onClick={() => setEditId(null)} className="px-4 py-2 text-xs text-ink/50 hover:text-ink/75">Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Agency / Idea Vault" rightText={`${ideas.length} ideas · ${scoredCount} scored`} />
      <div className="space-y-5 px-4 py-6 md:px-8">
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center justify-between gap-3 rounded-md border border-red-600/30 bg-red-600/[0.05] px-4 py-2.5 text-xs text-red-700">
              {error}<button onClick={() => setError("")}><X className="h-3.5 w-3.5" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {current ? (
          /* ---------- DETAIL ---------- */
          <div className="space-y-5">
            <button onClick={() => openIdea(null)} className="mono-label inline-flex items-center gap-1.5 text-[10px] text-ink/55 hover:text-[#ff3c00]"><ArrowLeft className="h-3.5 w-3.5" />All ideas</button>
            <div className="game-panel p-5 md:p-6">
              {editId === current.id ? editForm : (
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex min-w-0 flex-1 gap-4">
                    <RankBadge rank={current.rank} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <TierChip score={effectiveScore(current)} />
                        <StageChip idea={current} />
                        <Micro>{current.category || "Uncategorised"}</Micro>
                        {current.date && <Micro className="text-ink/35">· {current.date}</Micro>}
                        {current.source === "oracle" && <Micro className="text-[#ff3c00]">· from the Oracle</Micro>}
                      </div>
                      <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.035em] text-ink md:text-[32px]">{current.title}</h2>
                      {current.description && <p className="mt-2 line-clamp-6 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-ink/65">{current.description}</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <select value={stageOf(current)} onChange={(e) => setStage(current, e.target.value)} className={fieldCls}>{STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
                    <button onClick={() => startEdit(current)} className="rounded-md border border-ink/15 p-2 text-ink/50 hover:text-ink"><Pencil className="h-3.5 w-3.5" /></button>
                    {confirmDel === current.id ? (
                      <span className="flex items-center gap-1 rounded-md border border-red-600/30 px-2 py-1 text-xs text-red-700">Delete?
                        <button onClick={() => del(current.id)} className="font-semibold underline">Yes</button>
                        <button onClick={() => setConfirmDel(null)} className="text-ink/50">No</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDel(current.id)} className="rounded-md border border-ink/15 p-2 text-ink/50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <ScorePanel key={`${current.id}-${current.scored_at}`} idea={current} scoring={!!scoring[current.id]} onRescore={() => rescoreOne(current)} onOverride={(p) => saveOverride(current, p)} />

            {current.writeup && <ConceptBrief w={current.writeup} />}

            <div>
              <div className="mb-3 flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-[#ff3c00]" /><Micro className="text-ink/65">Action plan</Micro></div>
              <ActionPlan idea={current} generating={!!generating[current.id]} onGenerate={() => runPlan(current)} onToggleStep={(k) => toggleStep(current, k)} onCreateProject={() => turnIntoProject(current)} creating={busyId === current.id} />
            </div>

            <AIAnalysisPanel idea={current} onReanalyze={analyzeIdea} />
          </div>
        ) : (
          /* ---------- RANKED VAULT ---------- */
          <>
            {!loading && <BuildNextHero ideas={top3} busyId={busyId} onPlan={planAndTasks} onOpen={(i) => openIdea(i.id)} />}

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1 md:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/[0.38]" />
                <Input placeholder="Search ideas, plans, next actions…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 border-ink/[0.13] bg-card pl-10 text-ink placeholder:text-ink/[0.38]" />
              </div>
              <div className="flex rounded-md border border-ink/[0.13] bg-card p-0.5">
                <button onClick={() => setView("list")} className={`flex items-center gap-1 rounded px-2.5 py-1.5 text-xs ${view === "list" ? "bg-ink text-white" : "text-ink/55"}`}><LayoutList className="h-3.5 w-3.5" />Ranked</button>
                <button onClick={() => setView("board")} className={`flex items-center gap-1 rounded px-2.5 py-1.5 text-xs ${view === "board" ? "bg-ink text-white" : "text-ink/55"}`}><Columns3 className="h-3.5 w-3.5" />Board</button>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <button onClick={() => scoreAll(scoredCount > 0 && scoredCount < ideas.length)} disabled={!!bulk} className="flex items-center gap-2 rounded-md border border-ink/15 bg-card px-3 py-2 text-xs font-semibold text-ink/75 hover:border-ink/35 disabled:opacity-60">
                  {bulk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 text-[#ff3c00]" />}
                  {bulk ? `Scoring ${bulk.done}/${bulk.total}…` : scoredCount > 0 && scoredCount < ideas.length ? "Score unscored" : "Re-score all with AI"}
                </button>
                <button onClick={() => setAdding(true)} className="flex items-center gap-2 rounded-md flame-bg px-4 py-2 text-xs font-semibold text-white"><Plus className="h-4 w-4" />Add idea</button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Micro className="mr-1">Tier</Micro>
              <button onClick={() => setTierFilter("All")} className={pill(tierFilter === "All")}>All · {ideas.length}</button>
              {BANDS.filter((b) => tierCounts[b.key]).map((b) => <button key={b.key} onClick={() => setTierFilter(b.key)} className={pill(tierFilter === b.key)}>{b.key === "U" ? "Unscored" : b.key} · {tierCounts[b.key]}</button>)}
              <span className="mx-2 hidden h-4 w-px bg-ink/15 sm:block" />
              <Micro className="mr-1">Stage</Micro>
              <button onClick={() => setStageFilter("All")} className={pill(stageFilter === "All")}>All</button>
              {STAGES.map((s) => <button key={s.key} onClick={() => setStageFilter(s.key)} className={pill(stageFilter === s.key)}>{s.label}</button>)}
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
                <DragDropContext onDragEnd={onCatDragEnd}>
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
                <Micro className="text-[#ff3c00]">New idea · scored and planned automatically</Micro>
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
                  <select value={newIdea.stage} onChange={(e) => setNewIdea({ ...newIdea, stage: e.target.value })} className={fieldCls}>{STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
                </div>
                <div className="flex gap-2">
                  <button onClick={add} className="flex items-center gap-1.5 rounded-md flame-bg px-4 py-2 text-xs font-semibold text-white"><Check className="h-3.5 w-3.5" />Save, score & plan</button>
                  <button onClick={() => setAdding(false)} className="px-4 py-2 text-xs text-ink/50 hover:text-ink/75">Cancel</button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ink/[0.38]" /></div>
            ) : visible.length === 0 && !adding ? (
              <div className="game-panel p-12 text-center">
                <Lightbulb className="mx-auto mb-3 h-8 w-8 text-ink/[0.28]" />
                <p className="text-sm text-ink/[0.48]">{ideas.length ? "No ideas match these filters." : "No ideas yet. Throw one in — you'll get a score and a plan back."}</p>
              </div>
            ) : (
              <DragDropContext onDragEnd={onRankDrag}>
                {view === "list" ? (
                  <div className="space-y-6">
                    {BANDS.map((b) => {
                      const items = visible.filter((i) => bandOf(i) === b.key);
                      if (!items.length) return null;
                      return (
                        <section key={b.key}>
                          <div className="mb-2 flex items-center gap-3">
                            {b.key === "U" ? <span className="mono-label text-[10px] text-ink/45">Unscored</span> : <TierChip score={TIERS.find((t) => t.key === b.key).min} className="!text-[11px] !px-2" />}
                            <span className="mono-label text-[10px] text-ink/50">{b.label.replace(/^[SABC] · /, "")}</span>
                            <span className="h-px flex-1 bg-hair" />
                            <span className="mono-label text-[9.5px] text-ink/35">{items.length}</span>
                          </div>
                          <Droppable droppableId={b.key}>
                            {(provided) => (
                              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
                                {items.map((idea, idx) => (
                                  <Draggable key={idea.id} draggableId={idea.id} index={idx}>
                                    {(drag, snap) => (
                                      <motion.div layout="position" ref={drag.innerRef} {...drag.draggableProps} style={drag.draggableProps.style}>
                                        <RankedRow idea={idea} dragging={snap.isDragging} dragHandle={drag.dragHandleProps} onOpen={() => openIdea(idea.id)} onStage={(s) => setStage(idea, s)} />
                                      </motion.div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </section>
                      );
                    })}
                    <p className="text-[11px] text-ink/40">Drag the handle to re-rank inside a tier (it pins the idea at that spot). Revenue bands and time-to-$ are AI estimates, not market data.</p>
                  </div>
                ) : (
                  <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
                    <div className="grid min-w-[1000px] grid-cols-5 gap-3">
                      {STAGES.map((s) => {
                        const items = visible.filter((i) => stageOf(i) === s.key);
                        return (
                          <Droppable key={s.key} droppableId={s.key}>
                            {(provided, snap) => (
                              <div ref={provided.innerRef} {...provided.droppableProps} className={`min-h-[200px] rounded-lg border p-2 transition-colors ${snap.isDraggingOver ? "border-[#ff6a00]/50 bg-[#ff6a00]/[0.04]" : "border-hair bg-ink/[0.015]"}`}>
                                <div className="mb-2 flex items-center justify-between px-1"><Micro className="text-ink/60">{s.label}</Micro><span className="mono-label text-[9.5px] text-ink/35">{items.length}</span></div>
                                <div className="space-y-2">
                                  {items.map((idea, idx) => (
                                    <Draggable key={idea.id} draggableId={idea.id} index={idx}>
                                      {(drag, ds) => (
                                        <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps} onClick={() => openIdea(idea.id)}
                                          className={`cursor-pointer rounded-md border bg-card p-3 hover:border-ink/30 ${ds.isDragging ? "border-[#ff6a00] shadow-lg" : "border-hair"}`}>
                                          <div className="flex items-center gap-2"><RankBadge rank={idea.rank} /><TierChip score={effectiveScore(idea)} /><MoveArrow idea={idea} /><span className="ml-auto"><ScoreDial score={effectiveScore(idea)} size={32} /></span></div>
                                          <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-ink">{idea.title}</p>
                                          {idea.score_breakdown?.effort_band && <p className="mono-label mt-1.5 text-[9px] text-ink/45">Effort {idea.score_breakdown.effort_band} · {idea.score_breakdown.time_to_dollar_label}</p>}
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                </div>
                              </div>
                            )}
                          </Droppable>
                        );
                      })}
                    </div>
                  </div>
                )}
              </DragDropContext>
            )}
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

