// Business Brain from the client's own app (client-brain ingest, docs/client-brain-sync.md): how many owner questions
// are answered there and what he said, grouped by area. Read-only here: answers are given and changed in the client's
// app and sync in on their own. Counts toward business health (pillars.js blendHealth).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BrainCircuit, ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appName } from "@/features/agents/ship/graph";

const rows = (v) => (Array.isArray(v) ? v : (v && v.items) || []);
const day = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""; };

export default function ClientBrainCard({ client, stats }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["BrainFact", "client_app", client?.id],
    queryFn: async () => rows(await base44.entities.BrainFact.filter({ client_id: client.id, source: "client_app", status: "active" }, "-answered_at", 300)).filter((f) => !(f.data && f.data.test)),
    enabled: !!client?.id,
  });
  const facts = q.data || [];
  if (!stats?.total && !facts.length) return null;
  const total = Number(stats?.total) || 0;
  const answered = Math.min(total, Number(stats?.answered) || 0);
  const pct = total ? Math.round((answered / total) * 100) : null;
  const apps = Object.values(stats?.apps || {}).map((a) => appName(a.app_name)).filter(Boolean);
  const byArea = {};
  for (const f of facts) (byArea[f.area || "other"] ||= []).push(f);
  const shown = open ? facts : facts.slice(0, 4);

  return (
    <div className="rounded-2xl border border-hair bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mono-label flex items-center gap-1.5 text-[10.5px] text-ink/45"><BrainCircuit className="h-3.5 w-3.5" /> Business Brain{apps.length ? ` · ${apps.join(", ")}` : ""}</p>
          <p className="mt-1 text-[15px] font-semibold text-ink">{total ? `${answered} of ${total} questions answered` : `${facts.length} answers on file`}</p>
          <p className="mt-0.5 text-[12.5px] text-ink/55">The owner's own answers from their app. They sync here automatically and count toward business health{stats?.synced_at ? ` (last sync ${day(stats.synced_at)})` : ""}.</p>
        </div>
        {pct != null ? <span className="mono-label rounded bg-[#ff6a00]/10 px-2 py-1 text-[11px] font-bold text-[#c2410c]">{pct}% complete</span> : null}
      </div>
      {total ? <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #ff3c00, #ff6a00)" }} /></div> : null}
      {q.isLoading ? <p className="mt-3 text-[12.5px] text-ink/45">Loading answers…</p> : facts.length ? (
        <div className="mt-4 space-y-3">
          {shown.map((f) => (
            <div key={f.id} className="border-l-2 border-[#ff6a00]/40 pl-3">
              {f.question ? <p className="text-[12px] text-ink/50">{f.question}</p> : null}
              <p className="text-[13.5px] leading-snug text-ink">{f.statement}</p>
              <p className="mono-label mt-1 text-[10px] text-ink/40">{f.area || "other"}{f.captured_by_name ? ` · ${f.captured_by_name}` : ""}{day(f.answered_at) ? ` · ${day(f.answered_at)}` : ""}</p>
            </div>
          ))}
          {facts.length > 4 ? (
            <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#ff3c00]">
              {open ? <><ChevronUp className="h-3.5 w-3.5" /> Show fewer</> : <><ChevronDown className="h-3.5 w-3.5" /> Show all {facts.length} ({Object.keys(byArea).length} areas)</>}
            </button>
          ) : null}
        </div>
      ) : <p className="mt-3 text-[12.5px] text-ink/45">No answers yet.</p>}
    </div>
  );
}
