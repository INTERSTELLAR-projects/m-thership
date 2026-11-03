import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { listDrafts, KEYS } from "./store";
import { Pill, fmtDate } from "./ui";

// Client profile hooks into Email Studio: the "Email client" link target and a "Recent emails" card.
export const emailClientPath = (clientId) => `/email?client=${encodeURIComponent(clientId)}`;

// An EmailDraft involves the client when it was sent to / addressed to them.
export function draftsForClient(drafts, clientId) {
  return (drafts || []).filter((d) =>
    (d.results || []).some((r) => r.client_id === clientId) ||
    (d.recipients || []).some((r) => r.client_id === clientId) ||
    ((d.audience && d.audience.mode === "clients" && d.audience.client_ids) || []).includes(clientId));
}

export function ClientRecentEmails({ client, limit = 8 }) {
  const q = useQuery({ queryKey: KEYS.drafts, queryFn: listDrafts });
  const rows = draftsForClient(q.data, client.id).slice(0, limit);
  return (
    <section className="mt-6 border border-hair bg-card">
      <header className="flex items-center justify-between gap-2 border-b border-hair px-3.5 py-2.5">
        <div>
          <p className="mono-label text-[8.5px] text-ink/45">Email Studio</p>
          <h3 className="text-[13px] font-semibold tracking-[-0.01em]">Recent emails</h3>
        </div>
        <Link to={emailClientPath(client.id)} className="inline-flex h-8 items-center gap-1.5 border border-hair px-2.5 text-[12px] font-medium hover:border-[#ff3c00] hover:text-[#ff3c00]">
          <Mail className="h-3.5 w-3.5" /> Email client
        </Link>
      </header>
      {q.isLoading && <p className="p-3.5 text-[12px] text-ink/45">Loading…</p>}
      {!q.isLoading && rows.length === 0 && <p className="p-3.5 text-[12px] text-ink/45">No emails to {client.business} from Email Studio yet.</p>}
      {rows.map((d) => {
        const mine = (d.results || []).find((r) => r.client_id === client.id);
        const status = d.status === "sent" ? (mine ? mine.status : "sent") : d.status || "draft";
        return (
          <Link key={d.id} to={`/email?draft=${d.id}`} className="flex items-center gap-3 border-b border-hair px-3.5 py-2 last:border-b-0 hover:bg-paper">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium">{d.subject || d.title || "Untitled"}</span>
              <span className="block text-[11px] text-ink/50">{d.status === "sent" ? `Sent ${fmtDate(d.sent_at)}${mine ? ` to ${mine.email}` : ""}` : `Draft · edited ${fmtDate(d.updated_date || d.created_date)}`}</span>
            </span>
            <Pill tone={status === "sent" ? "ink" : status === "failed" || status === "skipped" ? "warn" : "plain"}>{status}</Pill>
          </Link>
        );
      })}
    </section>
  );
}
