import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Sparkles, Check, RotateCcw, X, Copy, ArrowUpRight, Loader2, Plus, AlertTriangle } from "lucide-react";
import { useList, timeAgo } from "@/lib/useData";
import { cn } from "@/lib/utils";
import {
  useJobs, useRefreshJobs, JOB_STATUS, KIND_LABELS, approveJob, requestChanges, cancelJob, retryJob, chatPrompt, queueCustom,
} from "@/features/claude/jobs";

const TABS = [
  { key: "review", label: "Needs your OK", match: ["needs_approval"] },
  { key: "working", label: "Queued & working", match: ["queued", "running", "changes_requested"] },
  { key: "failed", label: "Failed", match: ["failed"] },
  { key: "done", label: "Approved", match: ["approved", "cancelled"] },
];

function StatusChip({ status }) {
  const s = JOB_STATUS[status] || JOB_STATUS.queued;
  return <span className={cn("mono-label rounded-sm px-1.5 py-0.5 text-[9px]", s.tone)}>{s.label}</span>;
}

function JobDetail({ job, onDone }) {
  const refresh = useRefreshJobs();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);
  const [showBrief, setShowBrief] = useState(false);

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); refresh(); onDone?.(); } finally { setBusy(""); }
  };
  const copy = async () => {
    await navigator.clipboard.writeText(chatPrompt(job));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-hair px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={job.status} />
          <span className="mono-label text-[9px] text-ink/45">{KIND_LABELS[job.kind] || job.kind}</span>
          <span className="mono-label text-[9px] text-ink/40">sent {timeAgo(job.requested_at || job.created_date)}</span>
        </div>
        <h2 className="mt-2 text-[18px] font-semibold tracking-[-0.02em]">{job.title}</h2>
        <p className="text-[12.5px] text-ink/55">
          {job.client_id ? <Link to={`/clients/${job.client_id}`} className="hover:text-[#ff3c00]">{job.client_name}</Link> : "No client"}
          {job.project_id ? <> · <Link to={`/projects/${job.project_id}`} className="hover:text-[#ff3c00]">{job.project_name || "Project"}</Link></> : null}
        </p>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {job.status === "queued" && (
          <p className="rounded-sm bg-ink/[0.04] px-3 py-2.5 text-[12.5px] text-ink/65">
            Waiting for Claude&apos;s next scheduled run. To run it now, copy the prompt into a Claude chat.
          </p>
        )}
        {job.status === "running" && (
          <p className="flex items-center gap-2 rounded-sm bg-[#ff6a00]/10 px-3 py-2.5 text-[12.5px] text-[#c24100]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Claude is working on this{job.started_at ? ` (started ${timeAgo(job.started_at)})` : ""}.
          </p>
        )}
        {job.needs_from_justin && (
          <div className="rounded-sm border border-amber-300 bg-amber-50 px-3 py-2.5">
            <p className="mono-label flex items-center gap-1.5 text-[9.5px] text-amber-800"><AlertTriangle className="h-3 w-3" /> Needs you</p>
            <p className="mt-1 whitespace-pre-wrap text-[13px] text-amber-900">{job.needs_from_justin}</p>
          </div>
        )}
        {job.result_summary && (
          <div>
            <p className="mono-label text-[9.5px] text-ink/45">Result</p>
            <p className="mt-1 text-[14px] leading-relaxed">{job.result_summary}</p>
          </div>
        )}
        {!!job.result_links?.length && (
          <div className="flex flex-wrap gap-2">
            {job.result_links.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-sm border border-hair px-2 py-1 text-[12px] hover:border-[#ff3c00] hover:text-[#ff3c00]">
                {l.label || l.url} <ArrowUpRight className="h-3 w-3" />
              </a>
            ))}
          </div>
        )}
        {job.result_body && (
          <article className="prose prose-sm max-w-none rounded-sm border border-hair bg-card px-4 py-3 text-[13px] [&_pre]:overflow-x-auto [&_pre]:bg-ink/[0.05] [&_pre]:p-3">
            <ReactMarkdown>{job.result_body}</ReactMarkdown>
          </article>
        )}
        {job.runner_log && (
          <div>
            <p className="mono-label text-[9.5px] text-ink/45">Run log</p>
            <pre className="mt-1 whitespace-pre-wrap rounded-sm bg-ink/[0.04] p-3 text-[11.5px] text-ink/70">{job.runner_log}</pre>
          </div>
        )}
        {job.review_notes && (
          <div>
            <p className="mono-label text-[9.5px] text-ink/45">Your change notes</p>
            <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-ink/70">{job.review_notes}</p>
          </div>
        )}
        <div>
          <button type="button" onClick={() => setShowBrief((v) => !v)} className="mono-label text-[9.5px] text-ink/50 hover:text-[#ff3c00]">
            {showBrief ? "Hide" : "Show"} the brief Claude works from
          </button>
          {showBrief && <pre className="mt-2 whitespace-pre-wrap rounded-sm bg-ink/[0.04] p-3 text-[11.5px] text-ink/70">{job.instructions}</pre>}
        </div>
      </div>

      <footer className="space-y-3 border-t border-hair px-5 py-4">
        {["needs_approval", "failed"].includes(job.status) && (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="What should Claude change? (for Request changes)"
            className="w-full rounded-sm border border-hair bg-card px-3 py-2 text-[13px] outline-none focus:border-[#ff3c00]"
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {job.status === "needs_approval" && (
            <button type="button" disabled={!!busy} onClick={() => run("ok", () => approveJob(job))}
              className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60">
              {busy === "ok" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Approve{job.task_id && job.complete_task_on_approve !== false ? " & complete step" : ""}
            </button>
          )}
          {["needs_approval", "failed"].includes(job.status) && (
            <button type="button" disabled={!!busy || !notes.trim()} onClick={() => run("redo", () => requestChanges(job, notes.trim()))}
              className="inline-flex items-center gap-1.5 rounded-sm border border-hair px-3 py-2 text-[12.5px] hover:border-[#ff3c00] disabled:opacity-40">
              <RotateCcw className="h-3.5 w-3.5" /> Request changes
            </button>
          )}
          {job.status === "failed" && (
            <button type="button" disabled={!!busy} onClick={() => run("retry", () => retryJob(job))}
              className="inline-flex items-center gap-1.5 rounded-sm border border-hair px-3 py-2 text-[12.5px] hover:border-[#ff3c00]">
              <RotateCcw className="h-3.5 w-3.5" /> Retry as is
            </button>
          )}
          {["queued", "changes_requested", "running", "needs_approval", "failed"].includes(job.status) && (
            <button type="button" disabled={!!busy} onClick={() => run("cancel", () => cancelJob(job))}
              className="inline-flex items-center gap-1.5 px-2 py-2 text-[12.5px] text-ink/50 hover:text-red-600">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          )}
          <button type="button" onClick={copy} className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-ink/55 hover:text-ink">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy prompt"}
          </button>
        </div>
      </footer>
    </div>
  );
}

function NewJob({ onClose }) {
  const refresh = useRefreshJobs();
  const clients = useList("CRMClient", { sort: "business", limit: 200 });
  const [form, setForm] = useState({ title: "", kind: "other", client_id: "", instructions: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async () => {
    setBusy(true);
    try {
      const client = (clients.data || []).find((c) => c.id === form.client_id);
      await queueCustom({ title: form.title.trim(), kind: form.kind, instructions: `# ${form.title.trim()}\n\n${form.instructions.trim()}`, client });
      refresh();
      onClose();
    } finally { setBusy(false); }
  };
  const input = "w-full rounded-sm border border-hair bg-card px-3 py-2 text-[13px] outline-none focus:border-[#ff3c00]";
  return (
    <div className="space-y-3 border-b border-hair bg-ink/[0.02] p-4">
      <input value={form.title} onChange={set("title")} placeholder="What should Claude do?" className={input} />
      <div className="grid grid-cols-2 gap-2">
        <select value={form.client_id} onChange={set("client_id")} className={input}>
          <option value="">No client</option>
          {(clients.data || []).map((c) => <option key={c.id} value={c.id}>{c.business}</option>)}
        </select>
        <select value={form.kind} onChange={set("kind")} className={input}>
          {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <textarea value={form.instructions} onChange={set("instructions")} rows={4} placeholder="Details, links, what done looks like" className={input} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-2 text-[12.5px] text-ink/55">Cancel</button>
        <button type="button" disabled={busy || !form.title.trim()} onClick={submit}
          className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">
          <Sparkles className="h-3.5 w-3.5" /> Authorize Claude
        </button>
      </div>
    </div>
  );
}

export default function ClaudeQueue() {
  const { data = [], isLoading } = useJobs(400);
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState("review");
  const [adding, setAdding] = useState(false);
  const selectedId = params.get("job");

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, data.filter((j) => t.match.includes(j.status)).length])), [data]);
  const list = data.filter((j) => TABS.find((t) => t.key === tab).match.includes(j.status));
  const selected = data.find((j) => j.id === selectedId) || list[0];

  // Opening a link to a specific job jumps to its tab.
  useEffect(() => {
    const j = data.find((x) => x.id === selectedId);
    if (j) { const t = TABS.find((x) => x.match.includes(j.status)); if (t) setTab(t.key); }
  }, [selectedId, data]);

  return (
    <div className="px-5 pb-10 pt-6 md:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-cross">(Claude queue)</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.03em]">Send to Claude</h1>
          <p className="mt-1 max-w-xl text-[13px] text-ink/55">
            Every step you authorize lands here. Claude&apos;s scheduled run picks up queued jobs, does the work, and sends it back for your OK.
          </p>
        </div>
        <button type="button" onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1.5 rounded-sm border border-hair px-3 py-2 text-[12.5px] hover:border-[#ff3c00]">
          <Plus className="h-3.5 w-3.5" /> New job
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => { setTab(t.key); setParams({}); }}
            className={cn("rounded-sm px-3 py-1.5 text-[12.5px]", tab === t.key ? "bg-ink text-canvas" : "bg-ink/[0.05] text-ink/65 hover:bg-ink/[0.08]")}>
            {t.label} <span className="ml-1 font-mono text-[11px] opacity-70">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      <div className="grid min-h-[560px] overflow-hidden rounded-md border border-hair bg-card lg:grid-cols-[360px_1fr]">
        <aside className="border-b border-hair lg:border-b-0 lg:border-r">
          {adding && <NewJob onClose={() => setAdding(false)} />}
          {isLoading ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink/50">Loading…</p>
          ) : list.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] leading-relaxed text-ink/50">
              {tab === "review" ? "Nothing waiting on you." : "Nothing here."} Use the ✦ Claude button on any task to send a step.
            </p>
          ) : (
            <ul className="divide-y divide-hair">
              {list.map((j) => (
                <li key={j.id}>
                  <button type="button" onClick={() => setParams({ job: j.id })}
                    className={cn("block w-full px-4 py-3 text-left hover:bg-[#ff3c00]/[0.035]", selected?.id === j.id && "bg-[#ff3c00]/[0.06]")}>
                    <div className="flex items-center justify-between gap-2">
                      <StatusChip status={j.status} />
                      <span className="font-mono text-[10.5px] text-ink/40">{timeAgo(j.finished_at || j.requested_at || j.created_date)}</span>
                    </div>
                    <p className="mt-1.5 truncate text-[13.5px] font-medium">{j.title}</p>
                    <p className="truncate text-[11.5px] text-ink/50">{j.client_name || "No client"} · {KIND_LABELS[j.kind] || j.kind}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="min-h-[480px]">
          {selected ? <JobDetail key={selected.id} job={selected} /> : (
            <div className="grid h-full place-items-center p-10 text-center text-[13px] text-ink/45">Pick a job to see what Claude did.</div>
          )}
        </section>
      </div>
    </div>
  );
}
