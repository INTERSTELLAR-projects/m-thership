// "Ready to publish" on a finished build job. Justin's tap is the approval: it records the request and the
// Send to Claude queue runner deploys those exact checkpoints on its next run, verifies the live URL and logs it.
// The first time a client's website or Command System goes live, their portal plays the launch animation.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Rocket, Loader2, Check } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { canPublish, requestPublish } from "./engine";

export default function ReadyToPublish({ job, compact = false }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const p = job?.publish || {};
  if (p.status === "deployed") return <p className="inline-flex items-center gap-1.5 text-[12px] text-green-700" data-testid="publish-deployed"><Check className="h-3.5 w-3.5" />Live{p.deployed_at ? ` since ${new Date(p.deployed_at).toLocaleDateString()}` : ""}{(p.live_urls || [])[0] ? <> · <a href={p.live_urls[0]} target="_blank" rel="noreferrer" className="underline">open</a></> : null}</p>;
  if (p.status === "requested" || p.status === "deploying") return <p className="text-[12px] text-[#c24100]" data-testid="publish-requested">Publishing approved. Claude deploys it on the next run (hourly, 7 AM–9 PM PT), or say "run the queue" in chat.</p>;
  if (p.status === "failed") return <p className="text-[12px] text-red-700">Deploy failed: {p.error || "see the job log"}</p>;
  if (!canPublish(job)) return null;
  const go = async () => {
    setBusy(true); setErr("");
    try { await requestPublish(job, user); qc.invalidateQueries({ queryKey: ["ClaudeJob"] }); } catch (e) { setErr(e?.message || "Couldn't record it"); }
    setBusy(false);
  };
  const n = (job.build?.checkpoints || []).length;
  return (
    <div className={compact ? "" : "rounded-sm border border-[#ff3c00]/30 bg-[#ff3c00]/[0.05] px-3 py-2.5"} data-testid="ready-to-publish">
      {!compact ? <p className="mb-2 text-[12.5px] text-ink/70">Everything else is done. Publishing is your call: this deploys {n === 1 ? "the saved checkpoint" : `the ${n} saved checkpoints`} ({(job.build?.checkpoints || []).map((c) => c.kind).join(" + ")}).</p> : null}
      <button type="button" onClick={go} disabled={busy} className="inline-flex h-9 items-center gap-1.5 bg-[#ff3c00] px-3 text-[12.5px] font-medium text-white hover:bg-ink disabled:opacity-50">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}Ready to publish
      </button>
      {err ? <p className="mt-1 text-[12px] text-red-700">{err}</p> : null}
    </div>
  );
}
