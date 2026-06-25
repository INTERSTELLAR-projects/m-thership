import { useState, useEffect } from "react";
import { CheckCircle2, Circle, RefreshCw, FileText, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";

const WEEKDAYS = [
  { num: 1, label: "Mon" },
  { num: 2, label: "Tue" },
  { num: 3, label: "Wed" },
  { num: 4, label: "Thu" },
  { num: 5, label: "Fri" },
  { num: 6, label: "Sat" },
  { num: 0, label: "Sun" },
];

const dayLabel = (num) => WEEKDAYS.find((w) => w.num === num)?.label || "";

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

    // Increment the cumulative counter on the entity when marking done
    if (!wasCompleted) {
      const field = taskType === "Blog Post" ? "blogsPublishedCount" : "gbpPostsDoneCount";
      const current = client[field] || 0;
      base44.entities.OrbitSEOClient.update(client.id, { [field]: current + 1 });
      setClients((prev) => prev.map((c) => c.id === client.id ? { ...c, [field]: current + 1 } : c));
    }
  };

  const buildTasks = (client) => {
    const days = WEEKDAYS.filter((w) => (client.blogDays || []).includes(w.num));
    const tasks = [];
    days.forEach((d) => {
      tasks.push({ key: `${client.id}_${d.num}_blog`, type: "Blog Post", day: d.label, icon: FileText });
      tasks.push({ key: `${client.id}_${d.num}_gbp`, type: "GBP Post", day: d.label, icon: MapPin });
    });
    return tasks;
  };

  const scheduledClients = clients.filter((c) => (c.blogDays || []).length > 0);
  const allTasks = scheduledClients.flatMap(buildTasks);
  const totalItems = allTasks.length;
  const completedItems = allTasks.filter((t) => completions[t.key]).length;

  if (scheduledClients.length === 0) return (
    <section className="px-8 pt-6">
      <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase mb-2">Client Content Schedule</h2>
      <p className="text-white/25 text-xs">No clients have a content schedule set. Choose a blog frequency and weekly days in Orbit SEO → client → Blog tab.</p>
    </section>
  );

  return (
    <section className="px-8 pt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase">Client Content Schedule</h2>
          <p className="text-white/30 text-[10px] mt-0.5 flex items-center gap-1.5">
            <RefreshCw className="w-2.5 h-2.5" />
            Week of {weekRangeLabel()} · Resets weekly · {completedItems}/{totalItems} completed
          </p>
        </div>
        {completedItems === totalItems && totalItems > 0 && (
          <span className="text-green-400/70 text-xs font-semibold tracking-wider uppercase px-2.5 py-1 bg-green-400/10 rounded-lg border border-green-400/15">All Done!</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {scheduledClients.map((client) => {
          const tasks = buildTasks(client);
          const clientDone = tasks.every((t) => completions[t.key]);
          return (
            <div key={client.id} className={`card-hover bg-card rounded-xl border p-4 ${clientDone ? "border-green-500/15 opacity-70" : "border-white/[0.06]"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500/10 to-orange-600/5 flex items-center justify-center text-orange-500/50 text-xs font-bold border border-orange-500/10 shrink-0">
                    {client.businessName?.charAt(0)}
                  </div>
                  <span className="text-white/85 text-sm font-medium truncate">{client.businessName}</span>
                </div>
                {client.blogFrequency
                  ? <span className="text-orange-500/50 text-[10px] font-semibold shrink-0">{client.blogFrequency}</span>
                  : clientDone && <CheckCircle2 className="w-4 h-4 text-green-400/60 shrink-0" />}
              </div>
              <div className="space-y-1.5">
                {tasks.map((task) => {
                  const done = !!completions[task.key];
                  const Icon = task.icon;
                  return (
                    <button
                      key={task.key}
                      onClick={() => toggle(task.key, client, task.type)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all ${
                        done
                          ? "bg-green-500/[0.05] border-green-500/15 opacity-60"
                          : "bg-white/[0.02] border-white/[0.05] hover:border-orange-500/20 hover:bg-orange-500/[0.03]"
                      }`}
                    >
                      {done
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400/70 shrink-0" />
                        : <Circle className="w-3.5 h-3.5 text-white/20 shrink-0" />}
                      <Icon className={`w-3 h-3 shrink-0 ${done ? "text-white/20" : "text-white/35"}`} />
                      <span className={`text-xs flex-1 ${done ? "text-white/30 line-through" : "text-white/65"}`}>
                        {task.type}
                      </span>
                      <span className={`text-[10px] font-semibold shrink-0 ${done ? "text-white/20" : "text-orange-500/50"}`}>
                        {task.day}
                      </span>
                    </button>
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