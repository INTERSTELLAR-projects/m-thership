import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { ChevronLeft, ChevronRight, GripVertical, Instagram, Facebook } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import ScaledPost from "./PostCanvas";
import { POSTS_KEY } from "./lib/socialStore";
import { addDays, isoToZoned, reschedulePost, todayIn, weekdayOf, zonedToIso, fmtTime, tzAbbr } from "./lib/publish";
import { Btn, StatusBadge } from "./ui";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const mondayOf = (d) => addDays(d, -((weekdayOf(d) + 6) % 7));
const whenOf = (p) => p.scheduled_at || p.published_at || p.posted_at;

/**
 * Week calendar of scheduled + posted items. Drag a scheduled card to another day to move it
 * (keeps its time). Drag a draft from the tray onto a day to approve it for that day.
 */
export default function CalendarView({ posts, settings, onApproveDraft, onOpenSchedule }) {
  const qc = useQueryClient();
  const tz = settings.timezone;
  const today = todayIn(tz);
  const [week, setWeek] = useState(() => mondayOf(today));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);

  const byDay = useMemo(() => {
    const m = Object.fromEntries(days.map((d) => [d, []]));
    for (const p of posts) {
      if (!["approved", "publishing", "posted", "failed"].includes(p.status)) continue;
      const w = whenOf(p);
      if (!w) continue;
      const z = isoToZoned(w, tz);
      if (m[z.date]) m[z.date].push({ ...p, _time: z.time });
    }
    for (const d of days) m[d].sort((a, b) => a._time.localeCompare(b._time));
    return m;
  }, [posts, days, tz]);

  const drafts = posts.filter((p) => (p.status || "draft") === "draft").sort((a, b) => String(a.planned_for || "9").localeCompare(String(b.planned_for || "9")));

  const onDragEnd = async (r) => {
    if (!r.destination) return;
    const to = r.destination.droppableId;
    if (!to.startsWith("day:") || to === r.source.droppableId) return;
    const date = to.slice(4);
    const post = posts.find((p) => p.id === r.draggableId);
    if (!post) return;
    if (post.status === "draft") { onApproveDraft(post, date); return; }
    if (post.status !== "approved" && post.status !== "failed") return;
    const time = post.scheduled_at ? isoToZoned(post.scheduled_at, tz).time : settings.default_times[0];
    const iso = zonedToIso(date, time, tz);
    if (Date.parse(iso) < Date.now() + 60000) {
      toast({ title: "That time has already passed", description: "Open the post to pick a later time, or use Post now.", variant: "destructive" });
      return;
    }
    const prev = qc.getQueryData(POSTS_KEY);
    qc.setQueryData(POSTS_KEY, (old = []) => old.map((p) => (p.id === post.id ? { ...p, scheduled_at: iso } : p)));
    try {
      await reschedulePost(post.id, iso);
      toast({ title: "Rescheduled", description: `${DOW[weekdayOf(date)]} ${date.slice(5).replace("-", "/")} · ${fmtTime(time)} ${tzAbbr(tz)}` });
    } catch (e) {
      qc.setQueryData(POSTS_KEY, prev);
      toast({ title: "Couldn't reschedule", description: String(e?.message || e), variant: "destructive" });
    } finally {
      qc.invalidateQueries({ queryKey: POSTS_KEY });
    }
  };

  const label = `${new Date(`${days[0]}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${new Date(`${days[6]}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
        <section className="min-w-0 border border-hair bg-card">
          <header className="flex flex-wrap items-center gap-2 border-b border-hair px-3 py-2.5">
            <div className="mr-auto">
              <p className="mono-label text-[8.5px] text-ink/45">Week · {tzAbbr(tz)}</p>
              <h3 className="text-[15px] font-semibold tracking-[-0.02em]">{label}</h3>
            </div>
            <Btn variant="ghost" onClick={() => setWeek(addDays(week, -7))} title="Previous week"><ChevronLeft className="h-4 w-4" /></Btn>
            <Btn onClick={() => setWeek(mondayOf(today))}>This week</Btn>
            <Btn variant="ghost" onClick={() => setWeek(addDays(week, 7))} title="Next week"><ChevronRight className="h-4 w-4" /></Btn>
          </header>
          <div className="grid grid-cols-1 divide-y divide-hair sm:grid-cols-7 sm:divide-x sm:divide-y-0">
            {days.map((d) => {
              const wd = weekdayOf(d);
              const weekend = wd === 0 || wd === 6;
              const isToday = d === today;
              const past = d < today;
              return (
                <Droppable droppableId={`day:${d}`} key={d} isDropDisabled={past}>
                  {(drop, snap) => (
                    <div ref={drop.innerRef} {...drop.droppableProps} className={`flex min-h-[150px] flex-col gap-1.5 p-1.5 transition-colors sm:min-h-[420px] ${snap.isDraggingOver ? "bg-[#ff3c00]/[0.06]" : weekend && !settings.post_weekends ? "bg-ink/[0.025]" : ""} ${past ? "opacity-70" : ""}`}>
                      <div className="flex items-baseline justify-between px-1 pb-0.5 pt-0.5">
                        <span className={`mono-label text-[9px] ${isToday ? "text-[#ff3c00]" : "text-ink/45"}`}>{DOW[wd]}</span>
                        <span className={`text-[15px] font-semibold tabular-nums tracking-[-0.03em] ${isToday ? "flex h-6 w-6 items-center justify-center bg-[#ff3c00] text-[12px] text-white" : "text-ink/70"}`}>{Number(d.slice(8))}</span>
                      </div>
                      {byDay[d].map((p, i) => (
                        <Draggable draggableId={p.id} index={i} key={p.id} isDragDisabled={!["approved", "failed"].includes(p.status)}>
                          {(drag, ds) => (
                            <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps} className={ds.isDragging ? "rotate-1 shadow-xl" : ""}>
                              <CalCard post={p} onOpen={() => onOpenSchedule?.(p)} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {drop.placeholder}
                      {byDay[d].length === 0 && !past && <p className="mt-auto hidden px-1 pb-1 text-[10.5px] text-ink/30 sm:block">Drop a draft here</p>}
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </section>

        <Droppable droppableId="tray" isDropDisabled>
          {(drop) => (
            <aside ref={drop.innerRef} {...drop.droppableProps} className="border border-hair bg-card">
              <header className="border-b border-hair px-3 py-2.5">
                <p className="mono-label text-[8.5px] text-ink/45">Needs review</p>
                <h3 className="text-[15px] font-semibold tracking-[-0.02em]">Drafts <span className="text-[#ff3c00]">/{drafts.length}</span></h3>
              </header>
              <div className="max-h-[520px] space-y-1.5 overflow-y-auto p-2">
                {drafts.length === 0 && <p className="px-1 py-6 text-center text-[12px] text-ink/45">No drafts waiting.</p>}
                {drafts.map((p, i) => (
                  <Draggable draggableId={p.id} index={i} key={p.id}>
                    {(drag, ds) => (
                      <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps} className={`flex items-center gap-2 border border-hair bg-paper p-1.5 ${ds.isDragging ? "shadow-xl" : "hover:border-[#ff3c00]/50"}`}>
                        <GripVertical className="h-3.5 w-3.5 shrink-0 text-ink/30" />
                        <div className="w-11 shrink-0 border border-hair"><ScaledPost template={p.template} spec={p.spec} /></div>
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-medium">{p.title || p.spec?.headline}</p>
                          <p className="mono-label truncate text-[8.5px] text-ink/45">{p.planned_for ? `Planned ${p.planned_for.slice(5).replace("-", "/")}` : "No day yet"}</p>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {drop.placeholder}
              </div>
              <p className="border-t border-hair px-3 py-2 text-[10.5px] leading-snug text-ink/45">Drag a draft onto a day to approve it. Drag a scheduled card to move it; the time stays.</p>
            </aside>
          )}
        </Droppable>
      </div>
    </DragDropContext>
  );
}

function CalCard({ post, onOpen }) {
  const t = post.publish_targets || {};
  return (
    <div className={`group border bg-paper ${post.status === "failed" ? "border-[#b42318]/50" : post.status === "posted" ? "border-ink/20" : "border-[#ff3c00]/40"}`}>
      <Link to={`/social/${post.id}`} className="block border-b border-hair"><ScaledPost template={post.template} spec={post.spec} /></Link>
      <button type="button" onClick={onOpen} className="w-full px-1.5 py-1 text-left">
        <div className="flex items-center gap-1">
          <span className="font-mono text-[10.5px] font-medium tabular-nums">{fmtTime(post._time)}</span>
          {t.instagram !== false && <Instagram className="h-3 w-3 text-ink/45" />}
          {t.facebook && <Facebook className="h-3 w-3 text-ink/45" />}
        </div>
        <p className="line-clamp-2 text-[11px] leading-tight text-ink/70">{post.title || post.spec?.headline}</p>
        <div className="mt-1"><StatusBadge status={post.status} /></div>
      </button>
    </div>
  );
}
