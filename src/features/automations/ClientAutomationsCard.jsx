import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useAutomationHub, appliesToClient } from "./useAutomationHub";
import { SourceChip, StatusPill } from "./AutomationsHub";
import { CHANNEL_META, fmtWhen, relTime } from "./meta";

// Compact "everything that runs for this client" card for the client cockpit (Automations tab).
// The client's own automation records are edited below it; this card adds Claude tasks, workflows and endpoints.
export default function ClientAutomationsCard({ client }) {
  const { rows, isLoading } = useAutomationHub();
  const mine = useMemo(() => rows
    .filter((r) => appliesToClient(r, client.id))
    .sort((a, b) => (a.scope === "client" ? 0 : 1) - (b.scope === "client" ? 0 : 1) || (a.nextAt ? a.nextAt.getTime() : Infinity) - (b.nextAt ? b.nextAt.getTime() : Infinity)), [rows, client.id]);
  const own = mine.filter((r) => r.scope === "client");
  const shared = mine.filter((r) => r.scope !== "client");

  return (
    <section className="mb-6 overflow-hidden rounded-md border border-hair bg-card">
      <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" }} />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hair px-4 py-3">
        <div>
          <p className="mono-label text-[9.5px] text-ink/50">Automations for this client</p>
          <h3 className="text-[15px] font-semibold tracking-[-0.02em]">
            {isLoading ? "Loading…" : `${own.length} just for ${client.business} · ${shared.length} for every client`}
          </h3>
        </div>
        <Link to={`/automations?client=${client.id}`} className="inline-flex items-center gap-1 text-[12px] text-[#d83300] hover:underline">Open in Automations hub <ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </header>
      {!isLoading && !mine.length ? (
        <p className="px-4 py-6 text-center text-[12.5px] text-ink/50">Nothing runs for this client yet.</p>
      ) : (
        <ul className="divide-y divide-hair">
          {[...own, ...shared].map((r) => (
            <li key={r.key} className="grid gap-1 px-4 py-2.5 text-[12.5px] md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_64px] md:items-center md:gap-3">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2"><span className="truncate font-medium">{r.name}</span><SourceChip source={r.source} /></span>
                <span className="block truncate text-[11px] text-ink/45">{r.channels.map((c) => CHANNEL_META[c] || c).join(" · ")}</span>
              </span>
              <span className="truncate text-ink/65">{r.schedule}</span>
              <span className="text-ink/60">{r.lastAt ? <>{relTime(r.lastAt)} <span className="text-ink/40">{r.lastStatus === "failed" ? "failed" : ""}</span></> : <span className="text-ink/35">{r.lastStatus === "never" ? "Never ran" : "—"}</span>}</span>
              <span className="tabular-nums text-ink/60">{r.nextAt ? fmtWhen(r.nextAt) : <span className="text-ink/35">{r.enabled ? "On event" : "—"}</span>}</span>
              <span><StatusPill status={r.status} /></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
