// Command home: today's field inbox items (WhatsApp from the glasses, site visits, quick captures).
import { Link } from "react-router-dom";
import { Camera } from "lucide-react";
import { useList } from "@/lib/useData";
import { FieldItemRow } from "./FieldItemRow";

const ptDay = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

export default function FieldInboxCard() {
  const q = useList("FieldInbox", { sort: "-created_date", limit: 30 });
  const today = ptDay(Date.now());
  const rows = (q.data || []).filter((r) => { const t = r.created_at || r.created_date; return t && ptDay(t) === today; });
  return (
    <section className="border border-hair bg-paper/80" aria-label="Field inbox" data-testid="field-inbox-card">
      <header className="flex items-center justify-between gap-2 border-b border-hair px-4 py-2.5">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Field inbox <span className="ml-1 font-mono text-[12px] text-ink/45">{rows.length || ""}</span></h2>
        <div className="flex items-center gap-3">
          <Link to="/field#site-visit" className="inline-flex items-center gap-1.5 text-[12px] text-ink/65 hover:text-[#ff3c00]"><Camera className="h-3.5 w-3.5" />Site visit</Link>
          <Link to="/field" className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45 hover:text-[#ff3c00]">All →</Link>
        </div>
      </header>
      {q.isLoading ? <p className="px-4 py-3 text-[12.5px] text-ink/45">Loading…</p> : rows.length ? (
        <ul className="divide-y divide-hair">{rows.slice(0, 5).map((r) => <FieldItemRow key={r.id} item={r} />)}</ul>
      ) : <p className="px-4 py-3 text-[12.5px] text-ink/55">Nothing from the field today. “Hey Meta, send a WhatsApp to Møthership …” lands here.</p>}
    </section>
  );
}
