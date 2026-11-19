import { useState } from "react";
import { Check, RotateCcw, ChevronDown, ChevronRight, Link2, Loader2, AlertTriangle, Send, X } from "lucide-react";
import { timeAgo } from "@/lib/useData";
import { cn } from "@/lib/utils";
import { JOB_STATUS, approveJob, requestChanges, retryJob, useRefreshJobs } from "./jobs";
import { oneLine, needsList, SIMPLE_GROUPS } from "./simple";
import { Link } from "react-router-dom";
import { isEnrichJob } from "@/features/clients/enrich";

function Pill({ status }) {
  const s = JOB_STATUS[status] || JOB_STATUS.queued;
  return <span className={cn("mono-label shrink-0 rounded-sm px-1.5 py-0.5 text-[9px]", s.tone)}>{s.label}</span>;
}

function SimpleCard({ job, open, onToggle, renderDetail }) {
  const refresh = useRefreshJobs();
  const [busy, setBusy] = useState("");
  const [sendingBack, setSendingBack] = useState(false);
  const [note, setNote] = useState("");
  const needs = needsList(job);
  const links = job.result_links || [];
  const canReview = ["needs_approval", "needs_review", "failed"].includes(job.status);

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); refresh(); setSendingBack(false); setNote(""); } finally { setBusy(""); }
  };

  return (
    <li data-record-id={job.id} className={cn("rounded-md border bg-card", job.status === "needs_approval" ? "border-[#ff3c00]/40" : "border-hair")}>
      <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill status={job.status} />
            <span className="truncate text-[11.5px] text-ink/50">{job.client_name || "No client"}</span>
            <span className="font-mono text-[10.5px] text-ink/35">{timeAgo(job.finished_at || job.requested_at || job.created_date)}</span>
          </div>
          <p className="mt-1.5 text-[14px] font-medium leading-snug">{job.title}</p>
          <p className="mt-1 flex items-start gap-1.5 text-[12.5px] leading-snug text-ink/65">
            {job.status === "running" && <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-[#ff3c00]" />}
            {oneLine(job)}
          </p>
          {needs.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="mono-label inline-flex items-center gap-1 text-[9px] text-amber-800"><AlertTriangle className="h-3 w-3" /> Needs from you</span>
              {needs.slice(0, 4).map((n, i) => (
                <span key={i} title={n} className="max-w-[240px] truncate rounded-sm border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-900">{n}</span>
              ))}
              {needs.length > 4 && <span className="text-[11px] text-amber-800">+{needs.length - 4} more</span>}
            </div>
          )}
          {links.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {links.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noreferrer" title={l.label || l.url}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-hair text-ink/55 hover:border-[#ff3c00] hover:text-[#ff3c00]">
                  <Link2 className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {job.status === "needs_approval" && isEnrichJob(job) && job.client_id && (
            <Link to={`/clients/${job.client_id}`} className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2 text-[13px] font-medium text-white">
              <Check className="h-3.5 w-3.5" /> Review fields
            </Link>
          )}
          {job.status === "needs_approval" && !isEnrichJob(job) && (
            <button type="button" disabled={!!busy} onClick={() => run("ok", () => approveJob(job))}
              className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60">
              {busy === "ok" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
            </button>
          )}
          {job.status === "failed" && (
            <button type="button" disabled={!!busy} onClick={() => run("retry", () => retryJob(job))}
              className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-4 py-2 text-[13px] font-medium text-canvas disabled:opacity-60">
              {busy === "retry" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Retry
            </button>
          )}
          {canReview && (
            <button type="button" disabled={!!busy} onClick={() => setSendingBack((v) => !v)}
              className={cn("inline-flex items-center gap-1.5 rounded-sm border px-3 py-2 text-[12.5px] hover:border-[#ff3c00]", sendingBack ? "border-[#ff3c00] text-[#ff3c00]" : "border-hair")}>
              <RotateCcw className="h-3.5 w-3.5" /> Send back
            </button>
          )}
          <button type="button" onClick={onToggle}
            className="inline-flex items-center gap-1 rounded-sm px-2 py-2 text-[12.5px] text-ink/55 hover:text-ink">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} Details
          </button>
        </div>
      </div>
      {sendingBack && (
        <form className="flex gap-2 border-t border-hair px-3.5 py-2.5"
          onSubmit={(e) => { e.preventDefault(); if (note.trim()) run("redo", () => requestChanges(job, note.trim())); }}>
          <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should Claude change?"
            className="min-w-0 flex-1 rounded-sm border border-hair bg-card px-3 py-2 text-[13px] outline-none focus:border-[#ff3c00]" />
          <button type="submit" disabled={!!busy || !note.trim()}
            className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-3 py-2 text-[12.5px] text-canvas disabled:opacity-40">
            {busy === "redo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send
          </button>
          <button type="button" onClick={() => setSendingBack(false)} className="px-1 text-ink/45 hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
        </form>
      )}
      {open && <div className="max-h-[70vh] overflow-y-auto border-t border-hair">{renderDetail(job)}</div>}
    </li>
  );
}

export default function SimpleQueue({ jobs, isLoading, selectedId, renderDetail }) {
  const [openId, setOpenId] = useState(selectedId || "");
  const [showDone, setShowDone] = useState(false);

  if (isLoading) return <p className="py-10 text-center text-[13px] text-ink/50">Loading…</p>;

  return (
    <div className="space-y-6">
      {SIMPLE_GROUPS.map((g) => {
        const list = jobs.filter((j) => g.match.includes(j.status));
        const collapsed = g.collapsed && !showDone;
        return (
          <section key={g.key}>
            <button type="button" disabled={!g.collapsed} onClick={() => setShowDone((v) => !v)}
              className="mb-2 flex items-center gap-2 text-left disabled:cursor-default">
              {g.collapsed && (collapsed ? <ChevronRight className="h-3.5 w-3.5 text-ink/45" /> : <ChevronDown className="h-3.5 w-3.5 text-ink/45" />)}
              <h2 className={cn("text-[13px] font-semibold tracking-[-0.01em]", g.key === "review" && list.length && "text-[#ff3c00]")}>{g.label}</h2>
              <span className="font-mono text-[11px] text-ink/45">{list.length}</span>
            </button>
            {!collapsed && (list.length === 0 ? (
              <p className="rounded-md border border-dashed border-hair px-4 py-4 text-[12.5px] text-ink/45">
                {g.key === "review" ? "Nothing waiting on you." : "Nothing here."}
              </p>
            ) : (
              <ul className="space-y-2">
                {(g.collapsed ? list.slice(0, 50) : list).map((j) => (
                  <SimpleCard key={j.id} job={j} open={openId === j.id} onToggle={() => setOpenId((id) => (id === j.id ? "" : j.id))} renderDetail={renderDetail} />
                ))}
              </ul>
            ))}
          </section>
        );
      })}
    </div>
  );
}
