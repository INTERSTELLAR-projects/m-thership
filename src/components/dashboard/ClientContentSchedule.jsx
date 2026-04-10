import { useState, useEffect } from "react";
import { CheckCircle2, Circle, RefreshCw } from "lucide-react";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function loadCRMClients() {
  try { return JSON.parse(localStorage.getItem("crm_clients") || "[]"); } catch { return []; }
}

function getCompletionKey(year, month) {
  return `content_schedule_completions_${year}_${month}`;
}

function loadCompletions(year, month) {
  try { return JSON.parse(localStorage.getItem(getCompletionKey(year, month)) || "{}"); } catch { return {}; }
}

function saveCompletions(year, month, data) {
  localStorage.setItem(getCompletionKey(year, month), JSON.stringify(data));
}

export default function ClientContentSchedule() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthLabel = `${MONTH_NAMES[month]} ${year}`;

  const [clients, setClients] = useState([]);
  const [completions, setCompletions] = useState(() => loadCompletions(year, month));

  useEffect(() => {
    const all = loadCRMClients();
    setClients(all);
  }, []);

  const toggleComplete = (clientId, entryId) => {
    const key = `${clientId}_${entryId}`;
    const next = { ...completions, [key]: !completions[key] };
    setCompletions(next);
    saveCompletions(year, month, next);
  };

  const totalItems = clients.reduce((sum, c) => sum + (c.blogSchedule?.length || 0), 0);
  const completedItems = Object.values(completions).filter(Boolean).length;

  if (clients.length === 0) return (
    <section className="px-8 pt-6">
      <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase mb-2">Client Content Schedule</h2>
      <p className="text-white/25 text-xs">No CRM clients found. Add clients in the CRM to see their content schedules here.</p>
    </section>
  );

  return (
    <section className="px-8 pt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase">Client Content Schedule</h2>
          <p className="text-white/30 text-[10px] mt-0.5 flex items-center gap-1.5">
            <RefreshCw className="w-2.5 h-2.5" />
            {monthLabel} · Resets on the 1st · {completedItems}/{totalItems} completed
          </p>
        </div>
        {completedItems === totalItems && totalItems > 0 && (
          <span className="text-green-400/70 text-xs font-semibold tracking-wider uppercase px-2.5 py-1 bg-green-400/10 rounded-lg border border-green-400/15">All Done!</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {clients.map((client) => {
          const clientDone = client.blogSchedule.every((e) => completions[`${client.id}_${e.id}`]);
          return (
            <div key={client.id} className={`bg-card rounded-xl border p-4 transition-all ${clientDone ? "border-green-500/15 opacity-70" : "border-white/[0.06] hover:border-orange-500/15"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500/10 to-orange-600/5 flex items-center justify-center text-orange-500/50 text-xs font-bold border border-orange-500/10 shrink-0">
                    {client.business.charAt(0)}
                  </div>
                  <span className="text-white/85 text-sm font-medium">{client.business}</span>
                </div>
                {clientDone && <CheckCircle2 className="w-4 h-4 text-green-400/60 shrink-0" />}
              </div>
              {(!client.blogSchedule || client.blogSchedule.length === 0) ? (
                <p className="text-white/20 text-xs px-1">No content schedule — add one in CRM → Services.</p>
              ) : (
              <div className="space-y-1.5">
                {client.blogSchedule.map((entry) => {
                  const key = `${client.id}_${entry.id}`;
                  const done = !!completions[key];
                  return (
                    <button
                      key={entry.id}
                      onClick={() => toggleComplete(client.id, entry.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all ${
                        done
                          ? "bg-green-500/[0.05] border-green-500/15 opacity-60"
                          : "bg-white/[0.02] border-white/[0.05] hover:border-orange-500/20 hover:bg-orange-500/[0.03]"
                      }`}
                    >
                      {done
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400/70 shrink-0" />
                        : <Circle className="w-3.5 h-3.5 text-white/20 shrink-0" />
                      }
                      <span className={`text-xs flex-1 ${done ? "text-white/30 line-through" : "text-white/65"}`}>
                        {entry.type}
                      </span>
                      <span className={`text-[10px] font-semibold shrink-0 ${done ? "text-white/20" : "text-orange-500/50"}`}>
                        {entry.count}x {entry.frequency}
                      </span>
                    </button>
                  );
                })}
              </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}