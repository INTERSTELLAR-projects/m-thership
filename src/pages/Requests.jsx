import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Play, Check } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { base44 } from "@/api/base44Client";
import { useList, useInvalidate, fmtDate } from "@/lib/useData";
import { Tag, SmallBtn } from "@/features/clients/ui";

const COLUMNS = [
  ["received", "Received"],
  ["in_progress", "In progress"],
  ["needs_info", "Needs info"],
  ["complete", "Complete"],
];

// Every client's site edits and project submissions in one queue.
export default function Requests() {
  const reqs = useList("ClientRequest", { sort: "-created_date", limit: 500 });
  const invalidate = useInvalidate();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");

  const rows = useMemo(() => (reqs.data || []).filter((r) => {
    const s = q.toLowerCase();
    return (!s || r.title?.toLowerCase().includes(s) || r.client_name?.toLowerCase().includes(s)) && (kind === "all" || r.kind === kind);
  }), [reqs.data, q, kind]);

  const move = async (r, status) => {
    await base44.entities.ClientRequest.update(r.id, { status, completed_at: status === "complete" ? new Date().toISOString() : null });
    invalidate("ClientRequest");
  };

  return (
    <div className="pb-16">
      <PageHeader breadcrumb="Command / Requests" rightText="Site edits & project submissions" />
      <div className="flex flex-wrap items-center gap-3 px-5 pt-6 md:px-8">
        <div className="flex h-9 flex-1 items-center gap-2 border border-hair bg-paper px-3 md:max-w-sm">
          <Search className="h-3.5 w-3.5 text-ink/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search requests or clients" className="flex-1 bg-transparent text-[13px] outline-none" />
        </div>
        {[["all", "All"], ["site_edit", "Site edits"], ["project_submission", "Projects"], ["new_page", "New pages"], ["question", "Questions"]].map(([k, l]) => (
          <SmallBtn key={k} active={kind === k} onClick={() => setKind(k)}>{l}</SmallBtn>
        ))}
      </div>

      <div className="grid gap-4 px-5 pt-5 md:px-8 lg:grid-cols-4">
        {COLUMNS.map(([status, label]) => {
          const list = rows.filter((r) => r.status === status);
          return (
            <section key={status} className="flex min-h-[300px] flex-col rounded-md border border-hair bg-card">
              <header className="flex items-center justify-between border-b border-hair px-4 py-3">
                <p className="text-[14px] font-semibold">{label}</p>
                <span className="font-mono text-[11px] tabular-nums text-ink/50">{list.length}</span>
              </header>
              <ul className="flex-1 space-y-2 p-2">
                {list.map((r) => (
                  <li key={r.id} className="card-hover border border-hair bg-paper p-3">
                    <div className="flex items-center gap-1.5">
                      <span className="mono-label text-[9px] text-ink/45">{r.kind?.replace("_", " ")}</span>
                      {r.priority === "urgent" && <Tag tone="red">Urgent</Tag>}
                      {r.page_status && r.page_status !== "none" && <Tag tone="ink">Page {r.page_status}</Tag>}
                    </div>
                    <Link to={`/clients/${r.client_id}?tab=requests`} className="mt-1 block text-[13.5px] font-medium hover:text-[#ff3c00]">{r.title}</Link>
                    <p className="text-[11.5px] text-ink/55">{r.client_name} · {fmtDate(r.created_date)}</p>
                    {r.attachments?.length > 0 && <p className="mt-1 text-[11px] text-ink/45">{r.attachments.length} attachment{r.attachments.length === 1 ? "" : "s"}</p>}
                    <div className="mt-2 flex gap-1.5">
                      {status === "received" && <SmallBtn onClick={() => move(r, "in_progress")}><Play className="h-3 w-3" /> Start</SmallBtn>}
                      {(status === "in_progress" || status === "needs_info") && <SmallBtn onClick={() => move(r, "complete")}><Check className="h-3 w-3" /> Complete</SmallBtn>}
                      {status === "in_progress" && <SmallBtn onClick={() => move(r, "needs_info")}>Needs info</SmallBtn>}
                    </div>
                  </li>
                ))}
                {list.length === 0 && <li className="px-2 py-6 text-center text-[12px] text-ink/40">Empty</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
