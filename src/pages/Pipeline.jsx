import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { AlertTriangle, CalendarClock, CircleDollarSign, Inbox, Loader2, PhoneCall, Target, Trophy, UserPlus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { base44 } from "@/api/base44Client";
import { useList, useInvalidate } from "@/lib/useData";
import { useToast } from "@/components/ui/use-toast";
import StatCard from "@/features/tasks/ui-kit/StatCard";
import EmptyState from "@/features/tasks/ui-kit/EmptyState";
import { btnSmallFlame } from "@/features/tasks/lib/ui";
import { cn } from "@/lib/utils";
import NewLeadDialog from "@/features/pipeline/NewLeadDialog";
import { ContactLinks, LeadDialog, LostDialog, SourceBadge, WonDialog } from "@/features/pipeline/LeadDialogs";
import {
  STAGES, OPEN_STAGES, SOURCES, isLeadish, stageOf, sourceOf, interestOf, bookedCallOf, reachedCall,
  daysInStage, isOverdue, noteDate, money,
} from "@/features/pipeline/pipeline";

const RECENT_DAYS = 90;
const recent = (c) => Date.now() - new Date(c.stage_changed_at || c.updated_date || c.created_date || 0).getTime() < RECENT_DAYS * 86400000;
const nowIso = () => new Date().toISOString();

function LeadCard({ c, onOpen, onMove, provided, dragging }) {
  const stage = stageOf(c);
  const call = bookedCallOf(c);
  const interest = interestOf(c);
  const overdue = isOverdue(c);
  const days = daysInStage(c);
  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={() => onOpen(c)}
      className={cn("cursor-pointer rounded-md border bg-paper p-3 transition-shadow", dragging ? "border-[#ff3c00] shadow-lg" : "border-hair hover:border-ink/30", overdue && "border-l-2 border-l-red-600")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold tracking-[-0.01em]">{c.business}</p>
          {c.contact ? <p className="truncate text-[11.5px] text-ink/55">{c.contact}</p> : null}
        </div>
        <SourceBadge c={c} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {interest ? <span className="rounded-sm bg-[#ff3c00]/[0.08] px-1.5 py-0.5 text-[10.5px] font-medium text-[#c24100]">{interest}</span> : null}
        {Number(c.lead_value) > 0 ? <span className="font-mono text-[10.5px] text-ink/70">{money(c.lead_value)}</span> : null}
        <span className="font-mono text-[10px] text-ink/40">{days}d in stage</span>
      </div>
      {call && ["call_booked", "call_held"].includes(stage) ? (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-ink/70"><CalendarClock className="h-3 w-3 text-[#ff3c00]" /> {call.label}</p>
      ) : null}
      {c.next_step || c.next_step_at ? (
        <p className={cn("mt-1.5 truncate text-[11px]", overdue ? "font-medium text-red-700" : "text-ink/60")}>
          {overdue ? <AlertTriangle className="mr-1 inline h-3 w-3" /> : null}
          {c.next_step || "Next step"}{c.next_step_at ? ` · ${new Date(String(c.next_step_at).slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
        </p>
      ) : null}
      {stage === "lost" && c.lost_reason ? <p className="mt-1.5 truncate text-[11px] text-ink/50">Lost: {c.lost_reason}</p> : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <ContactLinks c={c} />
        {/* Touch-friendly move control (drag works too) */}
        <select
          value={stage}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onMove(c, e.target.value)}
          className="h-7 max-w-[120px] rounded-sm border border-hair bg-card px-1 text-[11px] text-ink/70 md:hidden"
          aria-label="Move to stage"
        >
          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
    </div>
  );
}

export default function Pipeline() {
  const [params, setParams] = useSearchParams();
  const clientsQ = useList("CRMClient", { sort: "-created_date", limit: 1000 });
  const invalidate = useInvalidate();
  const { toast } = useToast();
  const [overrides, setOverrides] = useState({});
  const [source, setSource] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [wonLead, setWonLead] = useState(null);
  const [lostLead, setLostLead] = useState(null);
  const [newOpen, setNewOpen] = useState(params.get("new") === "1");

  useEffect(() => {
    if (params.get("new") === "1") setNewOpen(true);
  }, [params]);
  const closeNew = (o) => {
    setNewOpen(o);
    if (!o && params.get("new")) setParams({});
  };

  const all = useMemo(() => (clientsQ.data || []).map((c) => (overrides[c.id] ? { ...c, ...overrides[c.id] } : c)), [clientsQ.data, overrides]);
  const leadish = useMemo(() => all.filter(isLeadish), [all]);
  // Board: every open lead, plus won / lost in the last 90 days.
  const board = useMemo(() => leadish.filter((c) => {
    const s = stageOf(c);
    if (s === "won") return recent(c);
    if (c.status !== "Lead") return false;
    return s === "lost" ? recent(c) : true;
  }), [leadish]);
  const filtered = source === "all" ? board : board.filter((c) => sourceOf(c) === source);
  const statBase = source === "all" ? leadish : leadish.filter((c) => sourceOf(c) === source);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = statBase.filter((c) => {
      const d = new Date(c.created_date || 0);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const bySource = SOURCES.map((s) => [s.label, thisMonth.filter((c) => sourceOf(c) === s.key).length]).filter(([, n]) => n);
    const booked = statBase.filter(reachedCall).length;
    const won = statBase.filter((c) => stageOf(c) === "won").length;
    const lost = statBase.filter((c) => stageOf(c) === "lost").length;
    const open = statBase.filter((c) => c.status === "Lead" && OPEN_STAGES.includes(stageOf(c)));
    const value = open.reduce((s, c) => s + (Number(c.lead_value) || 0), 0);
    const unvalued = open.filter((c) => !(Number(c.lead_value) > 0)).length;
    const overdue = open.filter(isOverdue).length;
    return { thisMonth: thisMonth.length, bySource, booked, total: statBase.length, won, lost, value, unvalued, open: open.length, overdue };
  }, [statBase]);

  const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "—");
  const lead = openId ? all.find((c) => c.id === openId) || null : null;

  const patch = async (c, data) => {
    setOverrides((o) => ({ ...o, [c.id]: { ...(o[c.id] || {}), ...data } }));
    try {
      await base44.entities.CRMClient.update(c.id, data);
      invalidate("CRMClient");
    } catch (e) {
      setOverrides((o) => {
        const next = { ...o };
        delete next[c.id];
        return next;
      });
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
      throw e;
    }
  };

  const markLost = async (c, reason) => {
    await patch(c, {
      pipeline_stage: "lost", stage_changed_at: nowIso(), lost_reason: reason,
      notes: [...(c.notes || []), { id: Date.now(), text: `Pipeline: marked lost${reason ? ` (${reason})` : ""}.`, date: noteDate() }],
    });
    // Keep the referrer's Prestige board honest.
    if (c.lead_referrer_member_id) {
      const refs = await base44.entities.PrestigeReferral.filter({ memberId: c.lead_referrer_member_id }, "-created_date", 100).catch(() => []);
      const r = (Array.isArray(refs) ? refs : []).find((x) => x.referredClientName === c.business && ["Pending", "Booked"].includes(x.status));
      if (r) await base44.entities.PrestigeReferral.update(r.id, { status: "Lost" }).catch(() => null);
    }
  };

  const markWon = async (c, pkg) => {
    if (stageOf(c) === "won") return;
    await patch(c, {
      pipeline_stage: "won", stage_changed_at: nowIso(), lost_reason: "",
      notes: [...(c.notes || []), { id: Date.now(), text: `Pipeline: won → onboarding on ${pkg.label}.`, date: noteDate() }],
    });
  };

  const move = (c, stage) => {
    if (!stage || stage === stageOf(c)) return;
    if (stage === "won") return setWonLead(c);
    if (stage === "lost") return setLostLead(c);
    patch(c, { pipeline_stage: stage, stage_changed_at: nowIso() }).catch(() => null);
  };

  const onDragEnd = (r) => {
    if (!r.destination || r.destination.droppableId === r.source.droppableId) return;
    const c = all.find((x) => x.id === r.draggableId);
    if (c) move(c, r.destination.droppableId);
  };

  const sourceCounts = Object.fromEntries(SOURCES.map((s) => [s.key, board.filter((c) => sourceOf(c) === s.key).length]));

  return (
    <div className="pb-16">
      <PageHeader breadcrumb="Command / Pipeline" title="Leads /Pipeline" rightText={`${stats.open} open`}>
        <button type="button" onClick={() => setNewOpen(true)} className={btnSmallFlame}><UserPlus className="h-3.5 w-3.5" /> New lead</button>
      </PageHeader>

      <div className="space-y-5 px-4 pt-6 md:px-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard icon={Inbox} label="Leads this month" value={stats.thisMonth} hint={stats.bySource.length ? stats.bySource.map(([l, n]) => `${l} ${n}`).join(" · ") : "None yet this month"} />
          <StatCard icon={PhoneCall} label="Call-booked rate" value={pct(stats.booked, stats.total)} hint={`${stats.booked} of ${stats.total} leads booked a call`} />
          <StatCard icon={Trophy} label="Close rate" value={pct(stats.won, stats.won + stats.lost)} hint={stats.won + stats.lost ? `${stats.won} won · ${stats.lost} lost` : "No decided leads yet"} />
          <StatCard icon={CircleDollarSign} label="Pipeline value" value={money(stats.value)} hint={stats.unvalued ? `${stats.unvalued} open lead${stats.unvalued === 1 ? "" : "s"} with no value set` : "All open leads valued"} />
          <StatCard icon={AlertTriangle} accent={stats.overdue ? "#dc2626" : "#ff3c00"} label="Overdue next steps" value={stats.overdue} hint={stats.overdue ? "Past due, still open" : "Nothing overdue"} />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mono-label mr-1 text-[9.5px] text-ink/50">Source</span>
          <button type="button" onClick={() => setSource("all")} className={cn("rounded-sm border px-2.5 py-1 text-[12px]", source === "all" ? "border-ink bg-ink text-white" : "border-hair bg-card hover:border-ink/40")}>All <span className="font-mono text-[10px] opacity-60">{board.length}</span></button>
          {SOURCES.map((s) => (
            <button key={s.key} type="button" onClick={() => setSource(s.key)} className={cn("rounded-sm border px-2.5 py-1 text-[12px]", source === s.key ? "border-ink bg-ink text-white" : "border-hair bg-card hover:border-ink/40", !sourceCounts[s.key] && source !== s.key && "opacity-50")}>
              {s.label} <span className="font-mono text-[10px] opacity-60">{sourceCounts[s.key]}</span>
            </button>
          ))}
        </div>

        {clientsQ.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ink/40" /></div>
        ) : !board.length ? (
          <EmptyState
            icon={Target}
            title="No leads yet"
            hint="Leads from the website booking form and the Interstellar Booking funnel land here automatically. Add referrals and cold approaches by hand."
            action={<button type="button" onClick={() => setNewOpen(true)} className={btnSmallFlame}><UserPlus className="h-3.5 w-3.5" /> New lead</button>}
          />
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
              <div className="grid min-w-max auto-cols-[272px] grid-flow-col gap-3">
                {STAGES.map((s) => {
                  const list = filtered.filter((c) => stageOf(c) === s.key).sort((a, b) => (isOverdue(b) - isOverdue(a)) || String(b.stage_changed_at || b.created_date).localeCompare(String(a.stage_changed_at || a.created_date)));
                  const val = list.reduce((sum, c) => sum + (Number(c.lead_value) || 0), 0);
                  return (
                    <section key={s.key} className={cn("flex min-h-[320px] flex-col rounded-md border bg-card", s.key === "won" ? "border-[#ff3c00]/40" : "border-hair")}>
                      <header className="border-b border-hair px-3 py-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[13.5px] font-semibold">{s.label}</p>
                          <span className="font-mono text-[11px] tabular-nums text-ink/50">{list.length}</span>
                        </div>
                        <p className="text-[10.5px] text-ink/45">{s.hint}{val ? ` · ${money(val)}` : ""}{["won", "lost"].includes(s.key) ? ` · last ${RECENT_DAYS}d` : ""}</p>
                      </header>
                      <Droppable droppableId={s.key}>
                        {(drop, snap) => (
                          <div ref={drop.innerRef} {...drop.droppableProps} className={cn("flex-1 space-y-2 p-2 transition-colors", snap.isDraggingOver && "bg-[#ff3c00]/[0.04]")}>
                            {list.map((c, i) => (
                              <Draggable key={c.id} draggableId={c.id} index={i}>
                                {(p, ds) => <LeadCard c={c} provided={p} dragging={ds.isDragging} onOpen={(x) => setOpenId(x.id)} onMove={move} />}
                              </Draggable>
                            ))}
                            {drop.placeholder}
                            {!list.length ? <p className="px-1 py-4 text-center text-[11px] text-ink/35">Empty</p> : null}
                          </div>
                        )}
                      </Droppable>
                    </section>
                  );
                })}
              </div>
            </div>
          </DragDropContext>
        )}
      </div>

      <NewLeadDialog open={newOpen} onOpenChange={closeNew} onCreated={(c) => { invalidate("CRMClient"); toast({ title: "Lead added", description: c.business }); }} />
      <LeadDialog
        lead={lead}
        onClose={() => setOpenId(null)}
        onPatch={patch}
        onMove={(c, s) => { if (s === "won" || s === "lost") setOpenId(null); move(c, s); }}
        onWon={(c) => { setOpenId(null); setWonLead(c); }}
        onLost={(c) => { setOpenId(null); setLostLead(c); }}
      />
      <WonDialog lead={wonLead} onClose={() => setWonLead(null)} onWon={markWon} />
      <LostDialog lead={lostLead} onClose={() => setLostLead(null)} onSave={markLost} />
    </div>
  );
}

