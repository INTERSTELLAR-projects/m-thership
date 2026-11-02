import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Copy, Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useJobsByTask, useRefreshJobs, queueTask, JOB_STATUS, ACTIVE, buildInstructions, chatPrompt } from "./jobs";

// A small button on every task row. One click opens the brief, a second click authorizes Claude.
export default function SendToClaudeButton({ task, compact = false, className = "" }) {
  const jobs = useJobsByTask();
  const refresh = useRefreshJobs();
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [showBrief, setShowBrief] = useState(false);
  const job = jobs.get(task.id);

  if (task.status === "done" && !job) return null;

  if (job && ACTIVE.includes(job.status)) {
    const s = JOB_STATUS[job.status];
    return (
      <Link
        to={`/claude?job=${job.id}`}
        title="Open in the Claude queue"
        className={cn("mono-label inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-1 text-[8.5px]", s.tone, className)}
      >
        {job.status === "running" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        {!compact && s.label}
      </Link>
    );
  }

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      await queueTask(task, extra.trim());
      refresh();
      setOpen(false);
      setExtra("");
    } catch (e) {
      setError(e?.message || "Could not queue it");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    const preview = buildInstructions({ task, extra: extra.trim() });
    await navigator.clipboard.writeText(chatPrompt({ id: "(not queued yet)", instructions: preview }));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Send to Claude"
        className={cn("inline-flex shrink-0 items-center gap-1 rounded-sm p-1.5 text-ink/45 transition-colors hover:text-[#ff3c00]", className)}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {!compact && <span className="text-[11px]">Claude</span>}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send to Claude</DialogTitle>
            <DialogDescription>
              Claude does it on the next run and sends it back for your OK.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
              <span className="mono-label text-[9px] text-ink/45">For</span>
              <span className="rounded-sm border border-hair px-1.5 py-0.5 text-ink/75">{task.client_name || "No client"}</span>
              {task.project_name && <span className="rounded-sm border border-hair px-1.5 py-0.5 text-ink/60">{task.project_name}</span>}
            </div>
            <label className="block">
              <span className="mono-label text-[9.5px] text-ink/50">What should Claude do?</span>
              <p className="mt-1 text-[13.5px] font-medium">{task.title}</p>
              <textarea
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                rows={2}
                placeholder="Add a note, or leave blank to do the step as written"
                className="mt-1.5 w-full rounded-sm border border-hair bg-card px-3 py-2 text-[13px] outline-none focus:border-[#ff3c00]"
              />
            </label>
            <div>
              <button type="button" onClick={() => setShowBrief((v) => !v)} className="mono-label text-[9.5px] text-ink/50 hover:text-[#ff3c00]">
                {showBrief ? "Hide" : "Show"} full brief
              </button>
              {showBrief && (
                <>
                  <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-sm bg-ink/[0.04] p-3 text-[11.5px] text-ink/70">
                    {buildInstructions({ task, extra: extra.trim() })}
                  </pre>
                  <p className="mt-1 text-[10.5px] text-ink/45">Client and project details are added when it&apos;s queued.</p>
                </>
              )}
            </div>
            {error && <p className="text-[12px] text-red-600">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 text-[12px] text-ink/60 hover:text-ink">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy prompt for a live chat"}
              </button>
              <button
                type="button"
                onClick={send}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Authorize Claude
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
