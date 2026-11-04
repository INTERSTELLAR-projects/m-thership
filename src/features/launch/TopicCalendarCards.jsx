// Monthly Topic Calendar approvals: one card per client per month. Approve once and that month's posts draft,
// publish into the client's Base44 blog on their dates and are verified live; "Ask for changes" sends it back.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { approveJob, requestChanges } from "@/features/claude/jobs";
import { topicsFromJob, monthLabel } from "./topicCalendar";

function Card({ job, onDone }) {
  const topics = topicsFromJob(job);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [asking, setAsking] = useState(false);
  const [err, setErr] = useState("");
  const month = (job.context && job.context.month_key) || (job.result_data && job.result_data.month) || "";
  const approve = async () => {
    setBusy(true); setErr("");
    try { await approveJob(job); onDone(); } catch (e) { setErr(e?.message || "Could not approve."); } finally { setBusy(false); }
  };
  const send = async () => {
    if (!notes.trim()) return;
    setBusy(true); setErr("");
    try { await requestChanges(job, notes.trim()); setAsking(false); setNotes(""); onDone(); } catch (e) { setErr(e?.message || "Could not send."); } finally { setBusy(false); }
  };
  return (
    <article className="border border-hair bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hair px-4 py-3">
        <div className="min-w-0">
          <p className="mono-label text-[9.5px] text-ink/50">Topic calendar · {month ? monthLabel(month) : "this month"}</p>
          <h4 className="truncate text-[15px] font-semibold tracking-[-0.02em]">{job.client_name}</h4>
        </div>
        <span className="font-mono text-[11px] text-[#ff3c00]">{topics.length} posts</span>
      </header>
      {job.result_summary && <p className="border-b border-hair px-4 py-2 text-[12.5px] text-ink/60">{job.result_summary}</p>}
      <ol className="divide-y divide-hair">
        {topics.map((t, i) => (
          <li key={`${t.slug}-${i}`} className="flex gap-3 px-4 py-2">
            <span className="w-[52px] shrink-0 font-mono text-[11px] text-ink/45">{t.publish_on.slice(5)}</span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium leading-snug">{t.title}</span>
              <span className="block text-[11.5px] text-ink/50">{[t.primary_keyword, t.city, t.intent].filter(Boolean).join(" · ")}</span>
            </span>
          </li>
        ))}
        {!topics.length && <li className="px-4 py-3 text-[12.5px] text-ink/50">No topics in this draft. Ask Claude for changes.</li>}
      </ol>
      {asking && (
        <div className="border-t border-hair px-4 py-3">
          <label className="mb-1 block text-[12px] font-medium" htmlFor={`n-${job.id}`}>What should change?</label>
          <textarea id={`n-${job.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full border border-hair bg-canvas px-3 py-2 text-[13px] outline-none focus:border-ink/40" placeholder="e.g. swap post 3 for a Gonzales topic; nothing about pricing this month" />
        </div>
      )}
      {err && <p className="px-4 pb-2 text-[12px] text-red-700">{err}</p>}
      <footer className="flex flex-wrap justify-end gap-2 border-t border-hair px-4 py-3">
        {asking ? (
          <>
            <button type="button" onClick={() => setAsking(false)} disabled={busy} className="h-9 px-3 text-[12.5px] text-ink/60 hover:text-ink">Cancel</button>
            <button type="button" onClick={send} disabled={busy || !notes.trim()} className="h-9 bg-ink px-4 text-[12.5px] font-medium text-white hover:bg-[#ff3c00] disabled:opacity-40">Send to Claude</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setAsking(true)} disabled={busy} className="h-9 border border-hair px-3 text-[12.5px] text-ink/70 hover:border-ink/30">Ask for changes</button>
            <button type="button" onClick={approve} disabled={busy || !topics.length} className="inline-flex h-9 items-center gap-1.5 bg-[#ff3c00] px-4 text-[12.5px] font-medium text-white hover:bg-ink disabled:opacity-40"><Check className="h-3.5 w-3.5" />{busy ? "Approving…" : "Approve month"}</button>
          </>
        )}
      </footer>
    </article>
  );
}

export default function TopicCalendarCards() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["ClaudeJob", "topicCalendars"],
    queryFn: async () => (await base44.entities.ClaudeJob.filter({ kind: "topic_calendar", status: "needs_approval" }, "-finished_at", 60).catch(() => [])) || [],
    staleTime: 20_000,
  });
  const rows = q.data || [];
  if (!rows.length) return null;
  const done = () => ["ClaudeJob", "launchWaiting", "TopicCalendar"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  return (
    <section className="mb-6" aria-label="Topic calendars">
      <div className="mb-2 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-[#ff3c00]" />
        <p className="text-[13.5px] font-semibold">Monthly topic calendars</p>
        <span className="text-[12px] text-ink/50">Approve once per client per month; the posts then publish on their own and count only once verified live.</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((j) => <Card key={j.id} job={j} onDone={done} />)}
      </div>
    </section>
  );
}
