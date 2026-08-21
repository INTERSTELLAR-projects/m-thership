import { useState, useEffect } from "react";
import { CheckCircle2, Circle, RefreshCw, FileText, MapPin, Users, Flame, CalendarDays } from "lucide-react";
import { base44 } from "@/api/base44Client";

const WEEKDAYS = [
  { num: 1, label: "Mon", full: "Monday" },
  { num: 2, label: "Tue", full: "Tuesday" },
  { num: 3, label: "Wed", full: "Wednesday" },
  { num: 4, label: "Thu", full: "Thursday" },
  { num: 5, label: "Fri", full: "Friday" },
  { num: 6, label: "Sat", full: "Saturday" },
  { num: 0, label: "Sun", full: "Sunday" },
];

const dayMeta = (num) => WEEKDAYS.find((w) => w.num === num);

// Sunday-anchored key — changes every week so completions reset automatically.
function getWeekKey() {
  const d = new Date();
  const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  return `${sunday.getFullYear()}_${sunday.getMonth() + 1}_${sunday.getDate()}`;
}

function weekRangeLabel() {
  const d = new Date();
  const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  const fmt = (x) => x.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(sunday)} – ${fmt(saturday)}`;
}

function loadCompletions(weekKey) {
  try { return JSON.parse(localStorage.getItem(`content_schedule_week_${weekKey}`) || "{}"); } catch { return {}; }
}
function saveCompletions(weekKey, data) {
  localStorage.setItem(`content_schedule_week_${weekKey}`, JSON.stringify(data));
}

export default function ClientContentSchedule() {
  const weekKey = getWeekKey();
  const [clients, setClients] = useState([]);
  const [completions, setCompletions] = useState(() => loadCompletions(weekKey));

  useEffect(() => {
    base44.entities.OrbitSEOClient.list("-created_date", 200).then(setClients);
  }, []);

  const toggle = (key, client, taskType) => {
    const wasCompleted = !!completions[key];
    const next = { ...completions, [key]: !wasCompleted };
    setCompletions(next);
    saveCompletions(weekKey, next);
    if (!wasCompleted) {
      const field = taskType === "Blog Post" ? "blogsPublishedCount" : "gbpPostsDoneCount";
      const current = client[field] || 0;
      base44.entities.OrbitSEOClient.update(client.id, { [field]: current + 1 });
      setClients((prev) => prev.map((c) => c.id === client.id ? { ...c, [field]: current + 1 } : c));
    }
  };

  const scheduledClients = clients.filter((c) => (c.blogDays || []).length > 0);

  // tasks per day: each scheduled day produces a Blog + a GBP post
  const dayTasks = (num) => {
    const list = [];
    scheduledClients.forEach((c) => {
      if ((c.blogDays || []).includes(num)) {
        list.push({ key: `${c.id}_${num}_blog`, type: "Blog Post", icon: FileText, client: c });
        list.push({ key: `${c.id}_${num}_gbp`, type: "GBP Post", icon: MapPin, client: c });
      }
    });
    return list;
  };
  const dayClients = (num) => scheduledClients.filter((c) => (c.blogDays || []).includes(num));

  const allTasks = scheduledClients.flatMap((c) =>
    (c.blogDays || []).flatMap((d) => [
      { key: `${c.id}_${d}_blog`, type: "Blog Post" },
      { key: `${c.id}_${d}_gbp`, type: "GBP Post" },
    ])
  );
  const totalItems = allTasks.length;
  const completedItems = allTasks.filter((t) => completions[t.key]).length;

  const todayNum = new Date().getDay();
  const todayIndex = WEEKDAYS.findIndex((w) => w.num === todayNum);
  const daysWithPosts = WEEKDAYS.filter((w) => dayTasks(w.num).length > 0);

  const blogTotal = scheduledClients.reduce((s, c) => s + (c.blogDays || []).length, 0);
  const todayPosts = dayTasks(todayNum).length;
  const todayDone = dayTasks(todayNum).filter((t) => completions[t.key]).length;
  const pct = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;

  if (scheduledClients.length === 0) return (
    <section className="px-8 pt-6">
      <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase mb-2">Client Content Schedule</h2>
      <p className="text-white/25 text-xs">No clients have a content schedule set. Choose a blog frequency and weekly days in Orbit SEO → client → Blog tab.</p>
    </section>
  );

  return (
    <section className="px-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-bold text-xs tracking-[0.25em] uppercase">Client Content Schedule</h2>
          <p className="text-white/30 text-[10px] mt-0.5 flex items-center gap-1.5">
            <RefreshCw className="w-2.5 h-2.5" />
            Week of {weekRangeLabel()} · Resets weekly · {completedItems}/{totalItems} done
          </p>
        </div>
        {completedItems === totalItems && totalItems > 0 && (
          <span className="text-green-400/80 text-xs font-semibold tracking-wider uppercase px-2.5 py-1 bg-green-400/10 rounded-lg border border-green-400/20 shadow-[0_0_12px_rgba(34,197,94,0.25)]">All Done!</span>
        )}
      </div>

      {/* Stat pills */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-card rounded-xl border border-white/[0.06] p-3">
          <div className="flex items-center gap-1.5 text-white/35 text-[10px] uppercase tracking-wider mb-1"><Users className="w-3 h-3" /> Clients</div>
          <div className="text-white text-xl font-bold">{scheduledClients.length}</div>
        </div>
        <div className="bg-card rounded-xl border border-orange-500/15 p-3 shadow-orange-glow-sm">
          <div className="flex items-center gap-1.5 text-orange-400/70 text-[10px] uppercase tracking-wider mb-1"><FileText className="w-3 h-3" /> Blog Posts</div>
          <div className="text-orange-400 text-xl font-bold">{blogTotal}</div>
        </div>
        <div className="bg-card rounded-xl border border-yellow-400/15 p-3 shadow-[0_0_10px_rgba(250,204,21,0.12)]">
          <div className="flex items-center gap-1.5 text-yellow-400/70 text-[10px] uppercase tracking-wider mb-1"><MapPin className="w-3 h-3" /> GBP Posts</div>
          <div className="text-yellow-400 text-xl font-bold">{blogTotal}</div>
        </div>
        <div className="relative overflow-hidden bg-gradient-to-br from-orange-500/15 to-yellow-400/10 rounded-xl border border-orange-400/30 p-3 shadow-[0_0_16px_rgba(255,170,0,0.22)]">
          <div className="flex items-center gap-1.5 text-orange-300 text-[10px] uppercase tracking-wider mb-1"><Flame className="w-3 h-3" /> Today · {dayMeta(todayNum)?.full}</div>
          <div className="text-white text-xl font-bold">{todayDone}/{todayPosts} <span className="text-[10px] text-white/40 font-normal">done</span></div>
        </div>
      </div>

      {/* Week progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[10px] text-white/35 mb-1.5">
          <span className="uppercase tracking-widest">Weekly Progress</span>
          <span className="font-semibold text-white/50">{pct}%</span>
        </div>
        <div className="h-2.5 w-full bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.04]">
          <div className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 shadow-[0_0_10px_rgba(255,170,0,0.5)] transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Week day strip */}
      <div className="grid grid-cols-7 gap-2 mb-5">
        {WEEKDAYS.map((w, i) => {
          const tasks = dayTasks(w.num);
          const count = tasks.length;
          const doneCount = tasks.filter((t) => completions[t.key]).length;
          const isToday = w.num === todayNum;
          const isPast = i < todayIndex;
          const allDone = count > 0 && doneCount === count;
          const dc = dayClients(w.num);
          return (
            <div
              key={w.num}
              className={`relative overflow-hidden rounded-xl border p-2.5 transition-all ${
                isToday
                  ? "border-orange-400/40 bg-gradient-to-b from-orange-500/20 to-yellow-400/[0.06] shadow-[0_0_18px_rgba(255,170,0,0.30)]"
                  : allDone
                    ? "border-green-500/25 bg-green-500/[0.05]"
                    : isPast
                      ? "border-white/[0.04] bg-white/[0.01] opacity-50"
                      : count > 0
                        ? "border-white/[0.08] bg-card"
                        : "border-white/[0.04] bg-white/[0.01] opacity-60"
              }`}
            >
              {isToday && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-yellow-300" />}
              <div className={`text-[10px] font-bold tracking-widest uppercase ${isToday ? "text-orange-300" : isPast ? "text-white/30" : "text-white/55"}`}>{w.label}</div>
              <div className={`text-xl font-bold mt-0.5 ${isToday ? "text-white" : count > 0 ? "text-white/85" : "text-white/25"}`}>{count}</div>
              <div className="text-[8px] text-white/30 uppercase tracking-wider">{count === 1 ? "post" : "posts"}</div>
              <div className="flex -space-x-1.5 mt-1.5">
                {dc.slice(0, 4).map((c) => (
                  <div key={c.id} title={c.businessName} className={`w-4 h-4 rounded-full border ${isToday ? "border-orange-300/40 bg-orange-500/30" : "border-white/15 bg-white/[0.08]"} flex items-center justify-center text-[8px] font-bold text-white/70`}>
                    {c.businessName?.charAt(0)}
                  </div>
                ))}
                {dc.length > 4 && <div className="w-4 h-4 rounded-full border border-white/15 bg-white/[0.05] flex items-center justify-center text-[7px] text-white/40">+{dc.length - 4}</div>}
              </div>
              {allDone && <div className="absolute top-1.5 right-1.5"><CheckCircle2 className="w-3 h-3 text-green-400/70" /></div>}
            </div>
          );
        })}
      </div>

      {/* Per-day breakdown */}
      <div className="grid grid-cols-2 gap-3">
        {daysWithPosts.map((w) => {
          const tasks = dayTasks(w.num);
          const dc = dayClients(w.num);
          const doneCount = tasks.filter((t) => completions[t.key]).length;
          const isToday = w.num === todayNum;
          const isPast = WEEKDAYS.findIndex((x) => x.num === w.num) < todayIndex;
          return (
            <div
              key={w.num}
              className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${
                isToday
                  ? "border-orange-400/40 bg-gradient-to-br from-orange-500/[0.08] via-card to-yellow-400/[0.04] shadow-[0_0_22px_rgba(255,170,0,0.18)]"
                  : "border-white/[0.06] bg-card"
              }`}
            >
              {isToday && <div className="absolute -top-16 -right-10 w-32 h-32 rounded-full bg-orange-500/20 blur-3xl pointer-events-none" />}
              <div className="relative flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className={`w-3.5 h-3.5 ${isToday ? "text-orange-400" : isPast ? "text-white/25" : "text-white/45"}`} />
                  <span className={`font-display font-bold text-sm tracking-wide ${isToday ? "text-white" : isPast ? "text-white/45" : "text-white/80"}`}>{w.full}</span>
                  {isToday && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-400/30 uppercase tracking-wider">Today</span>}
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${doneCount === tasks.length ? "text-green-400 border-green-500/25 bg-green-500/10" : isToday ? "text-orange-300 border-orange-400/30 bg-orange-500/10" : "text-white/40 border-white/10 bg-white/[0.03]"}`}>
                  {doneCount}/{tasks.length} done
                </span>
              </div>

              <div className="relative space-y-2">
                {dc.map((client) => {
                  const freqWeek = (client.blogDays || []).length;
                  const bKey = `${client.id}_${w.num}_blog`;
                  const gKey = `${client.id}_${w.num}_gbp`;
                  const bDone = !!completions[bKey];
                  const gDone = !!completions[gKey];
                  return (
                    <div key={client.id} className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg border flex items-center justify-center text-[11px] font-bold shrink-0 ${isToday ? "bg-orange-500/15 border-orange-400/30 text-orange-300" : "bg-white/[0.04] border-white/10 text-white/60"}`}>
                        {client.businessName?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white/80 text-xs font-medium truncate">{client.businessName}</span>
                          <span className="text-[9px] text-white/35 shrink-0">{freqWeek}x/week{client.blogFrequency ? ` · ${client.blogFrequency}` : ""}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => toggle(bKey, client, "Blog Post")}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-medium transition-all shrink-0 ${
                          bDone ? "bg-green-500/[0.08] border-green-500/20 text-green-400/80" : "bg-orange-500/[0.06] border-orange-500/20 text-orange-300 hover:bg-orange-500/15"
                        }`}
                      >
                        {bDone ? <CheckCircle2 className="w-3 h-3" /> : <FileText className="w-3 h-3" />} Blog
                      </button>
                      <button
                        onClick={() => toggle(gKey, client, "GBP Post")}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-medium transition-all shrink-0 ${
                          gDone ? "bg-green-500/[0.08] border-green-500/20 text-green-400/80" : "bg-yellow-400/[0.06] border-yellow-400/25 text-yellow-300 hover:bg-yellow-400/15"
                        }`}
                      >
                        {gDone ? <CheckCircle2 className="w-3 h-3" /> : <MapPin className="w-3 h-3" />} GBP
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}