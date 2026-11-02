import { useEffect, useState } from "react";
import { Radar, FileText } from "lucide-react";
import { useConstellation } from "./useConstellation";
import CommandCenter from "./CommandCenter";
import BriefingDeck from "./BriefingDeck";
import DossierEditor from "./DossierEditor";
import { defcon } from "./pillars";

export default function ConstellationsTab({ client }) {
  const con = useConstellation(client);
  const [view, setView] = useState("command");
  const [deck, setDeck] = useState(null);

  // Keep the stored score in step so lists and the dashboard can show it.
  useEffect(() => {
    if (con.loading || con.health == null) return;
    const t = setTimeout(() => { con.persistScore().catch(() => {}); }, 1500);
    return () => clearTimeout(t);
  }, [con.loading, con.health]); // eslint-disable-line react-hooks/exhaustive-deps

  const dc = defcon(con.health);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-hair bg-card p-1">
          {[["command", "Command center", Radar], ["dossier", "Dossier", FileText]].map(([k, l, I]) => (
            <button key={k} onClick={() => setView(k)} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium ${view === k ? "bg-ink text-white" : "text-ink/55 hover:text-ink"}`}><I className="h-3.5 w-3.5" /> {l}</button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[13px]">
          <span className="text-ink/50">Business health</span>
          <span className="mono-label rounded px-2 py-1 text-[11px] font-bold" style={{ background: `${dc.color}22`, color: dc.color === "#3df5c8" ? "#0a8a6e" : dc.color }}>{con.health ?? "—"} · DEFCON {dc.level}</span>
          {con.constraint && <span className="hidden text-ink/50 md:inline">Constraint: <b className="text-ink">{con.constraint.name}</b></span>}
        </div>
      </div>

      {con.loading ? (
        <div className="grid h-[60vh] place-items-center rounded-2xl bg-[#04131a] font-mono text-[11px] tracking-[.3em] text-[#3df5c8]">INITIALIZING COMMAND CENTER…</div>
      ) : view === "command" ? (
        <CommandCenter client={client} con={con} onOpenDeck={setDeck} />
      ) : (
        <DossierEditor client={client} con={con} />
      )}

      {deck && <BriefingDeck pillarId={deck} con={con} client={client} onClose={() => setDeck(null)} />}
    </div>
  );
}
