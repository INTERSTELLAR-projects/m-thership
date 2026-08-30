import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, CheckCircle2, Sparkles, Plus, Check, Zap, Archive, RotateCcw, Pencil, Star } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { base44 } from "@/api/base44Client";
import RouteBuilder from "../plan/RouteBuilder";
import PlanResults from "../plan/PlanResults";

const arrayMove = (arr, from, to) => { const a = arr.slice(); const [it] = a.splice(from, 1); a.splice(to, 0, it); return a; };

export default function PlanToExecute({ mrr }) {
  const [goals, setGoals] = useState([]);
  const [archived, setArchived] = useState([]);
  const [analyses, setAnalyses] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [runningId, setRunningId] = useState(null);
  const [pulseId, setPulseId] = useState(null);
  const [menu, setMenu] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const knownIds = useRef({});

  const reload = useCallback(async () => {
    try {
      const all = await base44.entities.Goal.list();
      const visible = (all || []).filter((g) => g.status !== "archived").sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
      const arch = (all || []).filter((g) => g.status === "archived").sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
      const ids = visible.map((g) => g.id);
      const map = {};
      await Promise.all(ids.map(async (id) => {
        const an = await base44.entities.PlanAnalysis.filter({ goal_id: id }, "-created_date", 1);
        const la = (an || [])[0] || null;
        map[id] = la;
      }));
      setGoals(visible);
      setArchived(arch);
      setAnalyses(map);
      setSelectedId((prev) => (ids.includes(prev) ? prev : (visible.find((g) => g.is_primary)?.id) || ids[0] || null));
    } catch (e) {}
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const unsubG = base44.entities.Goal.subscribe(() => reload());
    const unsubA = base44.entities.PlanAnalysis.subscribe((ev) => {
      if (ev.type === "create") {
        const gid = ev.data?.goal_id;
        if (gid && !knownIds.current[gid + ev.data.id]) {
          knownIds.current[gid + ev.data.id] = true;
          setPulseId(gid);
          setTimeout(() => setPulseId(null), 2600);
          reload();
        }
      }
    });
    return () => { unsubG(); unsubA(); };
  }, [reload]);

  const selected = goals.find((g) => g.id === selectedId) || null;
  const analysis = selected ? analyses[selected.id] || null : null;
  const achieved = !!(selected && selected.target_mrr > 0 && Number(mrr) >= Number(selected.target_mrr)) || selected?.status === "achieved";

  const runAnalysis = async (id) => {
    if (!id || runningId) return;
    setRunningId(id);
    try { await base44.functions.invoke("recalculatePlan", { goalId: id, trigger: "manual" }); } catch (e) {}
    await reload();
    setRunningId(null);
  };

  const openBuilderNew = () => { setEditingGoal(null); setBuilderOpen(true); };
  const openBuilderEdit = (g) => { setEditingGoal(g); setBuilderOpen(true); };

  const saveGoal = async (data) => {
    const all = await base44.entities.Goal.list();
    const count = (all || []).filter((g) => g.status !== "archived").length;
    const isPrimary = count === 0;
    const created = await base44.entities.Goal.create({
      title: data.title || ("Path to $" + (data.target_mrr || 0).toLocaleString()),
      target_mrr: Number(data.target_mrr) || 0,
      baseline_mrr: mrr || 0,
      priority: count,
      status: "active",
      is_primary: isPrimary,
      routes: data.routes,
      blended_mix: null,
    });
    setBuilderOpen(false);
    setEditingGoal(null);
    await reload();
    setSelectedId(created.id);
    runAnalysis(created.id);
  };

  const saveExisting = async (data) => {
    if (!editingGoal) return;
    const id = editingGoal.id;
    await base44.entities.Goal.update(id, { title: data.title, target_mrr: Number(data.target_mrr) || 0, routes: data.routes });
    setBuilderOpen(false);
    setEditingGoal(null);
    await reload();
    runAnalysis(id);
  };

  const setPrimary = async (id) => {
    setMenu(null);
    await base44.entities.Goal.bulkUpdate(goals.map((g) => ({ id: g.id, is_primary: g.id === id })));
    reload();
  };

  const archiveGoal = async (id) => {
    setMenu(null);
    await base44.entities.Goal.update(id, { status: "archived", is_primary: false });
    if (selectedId === id) setSelectedId(null);
    reload();
  };

  const restoreGoal = async (id) => {
    await base44.entities.Goal.update(id, { status: "active" });
    reload();
  };

  const onDragEnd = async (res) => {
    if (!res.destination || res.source.index === res.destination.droppableId === "trash") return;
    if (res.source.index === res.destination.index) return;
    const ord = arrayMove(goals, res.source.index, res.destination.index);
    setGoals(ord);
    try { await base44.entities.Goal.bulkUpdate(ord.map((g, i) => ({ id: g.id, priority: i }))); } catch (e) {}
  };

  const saveAssumptions = async (routes, blendedMix) => {
    if (!selected) return;
    const id = selected.id;
    try {
      await base44.entities.Goal.update(id, { routes, blended_mix: blendedMix == null ? null : blendedMix });
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, routes, blended_mix: blendedMix == null ? null : blendedMix } : g)));
    } catch (e) {}
  };

  const reRunStale = async (routes, blendedMix) => {
    if (!selected) return;
    await saveAssumptions(routes, blendedMix);
    runAnalysis(selected.id);
  };

  const relTime = (d) => {
    if (!d) return "";
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return s + "s ago";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  };

  const openMenu = (e, g) => {
    e.preventDefault();
    const x = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
    const y = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
    setMenu({ id: g.id, x, y });
  };

  return (
    <div>
      {/* Header with animated goal bubble */}
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        <span className="text-white/40 text-[11px] uppercase tracking-[0.1em] font-mono flex items-center gap-1">
          <Zap className="w-3 h-3 text-orange-400/70" />Plan to Execute
        </span>
        <span className="text-white/20">·</span>
        <button
          onClick={() => (selected ? openBuilderEdit(selected) : openBuilderNew())}
          className={`goal-bubble ${achieved ? "achieved" : ""}`}
          title={selected ? "Edit goal" : "Create a goal"}
        >
          <span className="goal-num text-white text-[15px] font-mono tracking-tight">
            ${selected ? Math.round(selected.target_mrr).toLocaleString() : "—"}
          </span>
        </button>
        <span className="text-white/20">·</span>
        <span className="text-white/40 text-[11px] uppercase tracking-[0.1em] font-mono">Syncs to Daily Briefing</span>
      </div>

      {/* Goal switcher */}
      {goals.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto no-scrollbar pb-1">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="goals" direction="horizontal">
              {(prov) => (
                <div ref={prov.innerRef} {...prov.droppableProps} className="flex items-center gap-1.5">
                  {goals.map((g, i) => {
                    const pct = g.target_mrr > 0 ? Math.min(100, Math.round((mrr / g.target_mrr) * 100)) : 0;
                    const gAchieved = (g.target_mrr > 0 && mrr >= g.target_mrr) || g.status === "achieved";
                    const active = g.id === selectedId;
                    return (
                      <Draggable key={g.id} draggableId={g.id} index={i}>
                        {(p) => (
                          <div
                            ref={p.innerRef}
                            {...p.draggableProps}
                            {...p.dragHandleProps}
                            onClick={() => setSelectedId(g.id)}
                            onContextMenu={(e) => openMenu(e, g)}
                            onTouchStart={(e) => {
                              const t = setTimeout(() => openMenu(e, g), 600);
                              const cancel = () => { clearTimeout(t); e.target.removeEventListener("touchend", cancel); e.target.removeEventListener("touchmove", cancel); };
                              e.target.addEventListener("touchend", cancel, { once: true });
                              e.target.addEventListener("touchmove", cancel, { once: true });
                            }}
                            className={`shrink-0 group relative px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wide flex items-center gap-1.5 cursor-pointer transition-all select-none ${
                              active
                                ? "px-3 bg-gradient-to-r from-orange-500 to-amber-400 text-black font-semibold shadow-[0_0_12px_rgba(255,106,0,0.35)]"
                                : gAchieved
                                  ? "bg-green-500/10 border border-green-500/20 text-green-400/60"
                                  : "bg-white/[0.03] border border-white/[0.08] text-white/55 hover:border-orange-500/30 hover:text-white/80"
                            }`}
                          >
                            {g.is_primary && !active && <Star className="w-2.5 h-2.5 text-orange-400/70" />}
                            {gAchieved && <Check className="w-2.5 h-2.5" />}
                            <span className="truncate max-w-[90px]">{g.title}</span>
                            <span className={`text-[8px] ${active ? "text-black/60" : gAchieved ? "text-green-400/50" : "text-white/30"}`}>{pct}%</span>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {prov.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          <button onClick={openBuilderNew} className="shrink-0 w-6 h-6 rounded-full border border-dashed border-white/15 hover:border-orange-500/40 text-white/40 hover:text-orange-400 flex items-center justify-center transition-all"><Plus className="w-3.5 h-3.5" /></button>
          {archived.length > 0 && (
            <button onClick={() => setShowArchived(true)} className="shrink-0 text-[9px] uppercase tracking-wider text-white/30 hover:text-orange-400 ml-1">Archived</button>
          )}
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 text-white/20 animate-spin" /></div>
      ) : !selected ? (
        <button onClick={openBuilderNew} className="w-full rounded-xl border border-dashed border-orange-500/25 hover:border-orange-500/50 hover:bg-orange-500/[0.04] transition-all p-4 flex items-center justify-center gap-2 text-white/50 hover:text-orange-400 group">
          <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-semibold tracking-wider uppercase font-mono">Define your routes</span>
        </button>
      ) : achieved ? (
        <div key={selected.id} className="goal-crossfade rounded-xl border border-green-500/30 bg-green-500/[0.06] p-4 text-center">
          <CheckCircle2 className="w-5 h-5 text-green-400 mx-auto mb-2" />
          <p className="text-white/80 text-sm font-semibold mb-3">Goal achieved — MRR reached your ${Math.round(selected.target_mrr).toLocaleString()} target.</p>
          <button onClick={openBuilderNew} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-black text-xs font-semibold"><Sparkles className="w-3.5 h-3.5" />Set a new goal</button>
        </div>
      ) : (
        <div key={selected.id} className={`goal-crossfade relative rounded-xl border transition-all ${pulseId === selected.id ? "border-orange-500/60 shadow-[0_0_18px_rgba(255,106,0,0.35)]" : "border-white/[0.06]"}`}>
          {pulseId === selected.id && <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-orange-500 text-black text-[9px] font-bold tracking-wider animate-pulse">UPDATED</span>}
          {!analysis ? (
            <div className="p-4 flex flex-col items-center gap-2">
              <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
              <button onClick={() => runAnalysis(selected.id)} className="text-xs text-orange-400 underline">Run analysis</button>
            </div>
          ) : (
            <PlanResults
              goal={selected}
              analysis={analysis}
              mrr={mrr}
              running={runningId === selected.id}
              onRerun={() => runAnalysis(selected.id)}
              onEdit={() => openBuilderEdit(selected)}
              onAssumptionsSave={saveAssumptions}
              onStaleReRun={reRunStale}
              relTime={relTime(analysis.created_date)}
            />
          )}
        </div>
      )}

      {builderOpen && (
        <RouteBuilder
          open={builderOpen}
          initialGoal={editingGoal}
          currentMrr={mrr}
          onClose={() => { setBuilderOpen(false); setEditingGoal(null); }}
          onSave={editingGoal ? saveExisting : saveGoal}
        />
      )}

      {/* context menu */}
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div className="fixed z-50 bg-card border border-white/10 rounded-lg shadow-xl py-1 w-40" style={{ left: Math.min(menu.x, window.innerWidth - 170), top: Math.min(menu.y, window.innerHeight - 130) }}>
            <button onClick={() => { setPrimary(menu.id); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-white/70 hover:bg-orange-500/10 hover:text-orange-400"><Star className="w-3 h-3" />Set as primary</button>
            <button onClick={() => { const g = goals.find((x) => x.id === menu.id); setMenu(null); if (g) openBuilderEdit(g); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-white/70 hover:bg-orange-500/10 hover:text-orange-400"><Pencil className="w-3 h-3" />Edit</button>
            <button onClick={() => archiveGoal(menu.id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-white/70 hover:bg-red-500/10 hover:text-red-400"><Archive className="w-3 h-3" />Archive</button>
          </div>
        </>
      )}

      {/* archived popover */}
      {showArchived && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowArchived(false)} />
          <div className="absolute z-50 mt-1 bg-card border border-white/10 rounded-lg shadow-xl py-1 w-56 right-0">
            <p className="px-3 pt-1 pb-1.5 text-[9px] uppercase tracking-wider text-white/30 font-mono">Archived goals</p>
            {archived.length === 0 && <p className="px-3 py-2 text-xs text-white/30">None</p>}
            {archived.map((g) => (
              <div key={g.id} className="flex items-center justify-between px-3 py-1.5 hover:bg-white/[0.03]">
                <span className="text-xs text-white/60 truncate flex-1">{g.title}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => openBuilderEdit(g)} className="p-1 text-white/40 hover:text-orange-400"><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => restoreGoal(g.id)} className="p-1 text-white/40 hover:text-green-400" title="Restore"><RotateCcw className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}