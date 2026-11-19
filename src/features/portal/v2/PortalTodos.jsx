// Portal "To-dos with us": what Interstellar is working on, what's next, and what we need from the client.
// Built from the same Task records Justin manages in Møthership, but only tasks marked "show to client"
// (portal_visible) ever arrive here; the portal API strips everything else. Finished work lives in the work feed.
import { CircleDot, ArrowRight, Hand } from "lucide-react";
import { fmtDate } from "@/lib/useData";
import { groupTodos } from "@/features/tasks/lib/clientVisibility";

export { groupTodos };


function Col({ icon: Icon, title, tone, list, empty }) {
  return (
    <div className="min-w-0 rounded-md border border-hair bg-canvas/40">
      <p className="flex items-center justify-between gap-2 border-b border-hair px-3.5 py-2.5 text-[13px] font-semibold text-ink">
        <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" style={{ color: tone }} />{title}</span>
        <span className="font-mono text-[11px] text-ink/45">{list.length}</span>
      </p>
      <ul className="space-y-1.5 p-2.5">
        {list.length ? list.slice(0, 6).map((t) => (
          <li key={t.id} className="rounded-sm bg-card px-3 py-2">
            <p className="text-[13.5px] font-medium leading-snug text-ink">{t.title}</p>
            {t.client_note ? <p className="mt-0.5 text-[12.5px] leading-snug text-ink/60">{t.client_note}</p> : null}
            {t.due_date ? <p className="mt-1 font-mono text-[10.5px] text-ink/45">Due {fmtDate(t.due_date)}</p> : null}
          </li>
        )) : <li className="px-1 py-2 text-[12.5px] text-ink/45">{empty}</li>}
        {list.length > 6 ? <li className="px-1 text-[11.5px] text-ink/45">+{list.length - 6} more</li> : null}
      </ul>
    </div>
  );
}

export default function PortalTodos({ items = [], business }) {
  const g = groupTodos(items);
  const total = g.needs.length + g.doing.length + g.next.length;
  if (!total) return null;
  return (
    <section aria-labelledby="band-todos" className="overflow-hidden rounded-lg border border-hair bg-card" data-testid="portal-todos">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-hair px-4 pb-3.5 pt-4 sm:px-6">
        <div className="min-w-0">
          <p className="mono-label text-[9.5px] text-[#ff3c00]">(To-dos) Our list with {business || "you"}</p>
          <h2 id="band-todos" className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.035em] sm:text-[26px]">
            <span className="tabular-nums text-[#ff3c00]">{g.doing.length}</span> in progress{g.needs.length ? <> · <span className="tabular-nums text-[#ff3c00]">{g.needs.length}</span> {g.needs.length === 1 ? "thing" : "things"} we need from you</> : null}
          </h2>
        </div>
      </header>
      <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-3">
        <Col icon={Hand} title="Needed from you" tone="#ff3c00" list={g.needs} empty="Nothing needed from you right now." />
        <Col icon={CircleDot} title="We're working on" tone="#b45309" list={g.doing} empty="Nothing in progress this minute." />
        <Col icon={ArrowRight} title="Up next" tone="#57534e" list={g.next} empty="Nothing queued yet." />
      </div>
    </section>
  );
}
