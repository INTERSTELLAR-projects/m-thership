// Command home: the Lead Engine at a glance (found this week, previews ready, portal logins, walkthroughs,
// $30 incentives owed, conversions) with one tap to the call sheet.
import { Link } from "react-router-dom";
import { ArrowUpRight, PhoneCall } from "lucide-react";
import { useEngine, money } from "./api";

export default function LeadEngineCard() {
  const q = useEngine("stats", {}, { staleTime: 60000 });
  const d = q.data || {};
  const items = [["Found this week", d.found_week], ["Previews ready", d.previews_ready, d.previews_draft ? `${d.previews_draft} in draft` : ""], ["Portal logins", d.portal_logins], ["Walkthroughs", d.walkthroughs], ["$30 owed", d.incentives_owed, d.incentives_owed ? money(d.incentives_owed_usd) : ""], ["Conversions", d.conversions]];
  return (
    <section className="border border-hair bg-paper/90" data-testid="lead-engine-card">
      <header className="flex items-center justify-between gap-2 border-b border-hair px-4 py-2.5">
        <p className="label-cross text-[10.5px]">(Lead Engine)</p>
        <div className="flex items-center gap-3"><Link to="/leads/finder" className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45 hover:text-[#ff3c00]">Finder</Link><Link to="/leads/hq" className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45 hover:text-[#ff3c00]">Sales HQ</Link><Link to="/leads/desk" className="inline-flex h-8 items-center gap-1.5 bg-[#ff3c00] px-2.5 text-[12px] font-medium text-white hover:bg-ink"><PhoneCall className="h-3.5 w-3.5" />Call sheet<ArrowUpRight className="h-3 w-3" /></Link></div>
      </header>
      {q.isError ? <p className="px-4 py-3 text-[12.5px] text-ink/55">Lead Engine numbers are loading slowly. Open the call sheet.</p> : (
        <div className="grid grid-cols-3 divide-x divide-y divide-hair md:grid-cols-6 md:divide-y-0">
          {items.map(([l, v, hint]) => (
            <div key={l} className="px-3 py-3">
              <p className="text-[22px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{q.isLoading ? "…" : v ?? 0}</p>
              <p className="mono-label mt-1.5 text-[8.5px] text-ink/50">{l}</p>
              {hint ? <p className="text-[10.5px] text-ink/45">{hint}</p> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
