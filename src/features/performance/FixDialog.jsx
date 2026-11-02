import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Loader2, Copy, Check, RefreshCw, Send, CheckCircle2, X, AlertTriangle, ArrowUpRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { generateFix, saveProposal, queueFix, markApplied, dismissFix, lineDiff } from "./fixWithAi";
import { guideFor, FIX_LABELS } from "./issueGuide";
import { SeverityChip, DarkButton } from "./ui";

const STATUS = {
  proposed: { label: "Draft — needs your OK", tone: "text-[#ffaa00]" },
  queued: { label: "Approved · queued for Claude", tone: "text-[#ff8a5c]" },
  applied: { label: "Applied", tone: "text-emerald-300" },
  dismissed: { label: "Dismissed", tone: "text-white/40" },
};

function DiffView({ before, after }) {
  const rows = useMemo(() => lineDiff(before || "", after || ""), [before, after]);
  return (
    <pre className="max-h-72 overflow-auto rounded-md border border-white/10 bg-black/40 p-0 text-[11.5px] leading-relaxed">
      {rows.map((r, i) => (
        <div key={i} className={`whitespace-pre-wrap break-words px-3 ${r.op === "+" ? "bg-emerald-400/10 text-emerald-200" : r.op === "-" ? "bg-[#ff3c00]/10 text-[#ff9b78] line-through decoration-[#ff3c00]/40" : "text-white/55"}`}>
          <span className="mr-2 select-none text-white/30">{r.op === " " ? " " : r.op}</span>{r.t || " "}
        </div>
      ))}
    </pre>
  );
}

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1400); } catch { /* clipboard blocked */ } }}
      className="inline-flex items-center gap-1 text-[11px] text-white/50 hover:text-white"
    >
      {ok ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{ok ? "Copied" : "Copy"}
    </button>
  );
}

export default function FixDialog({ open, onOpenChange, client, audit, issue, existing, onChanged }) {
  const [fix, setFix] = useState(existing || null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const [confirmApplied, setConfirmApplied] = useState(false);

  useEffect(() => { if (open) { setFix(existing || null); setError(""); setChecked(false); setConfirmApplied(false); } }, [open, existing]);

  if (!issue) return null;
  const guide = guideFor(issue);
  const p = fix?.proposal || null;
  const needs = p?.needs_confirmation || [];
  const hasPlaceholder = /\[\[CONFIRM/i.test(`${p?.after || ""}\n${p?.code || ""}`);
  const canApprove = fix && fix.status === "proposed" && (needs.length === 0 || checked);

  const run = async (key, fn) => {
    setBusy(key); setError("");
    try { await fn(); onChanged?.(); } catch (e) { setError(e?.response?.data?.error || e?.message || "Something went wrong"); } finally { setBusy(""); }
  };

  const generate = () => run("gen", async () => {
    const proposal = await generateFix({ client, audit, issue });
    const saved = await saveProposal({ client, audit, issue, proposal, existing: fix && fix.status === "proposed" ? fix : null });
    setFix(saved); setChecked(false);
  });
  const approveQueue = () => run("queue", async () => {
    const job = await queueFix(fix, client);
    setFix({ ...fix, status: "queued", claude_job_id: job.id });
  });
  const applied = () => run("applied", async () => {
    await markApplied(fix);
    setFix({ ...fix, status: "applied" });
    setConfirmApplied(false);
  });
  const dismiss = () => run("dismiss", async () => { await dismissFix(fix); setFix({ ...fix, status: "dismissed" }); });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-white/10 bg-[#121110] p-0 text-white sm:rounded-lg [&>button]:text-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] flame-bg" />
        <DialogHeader className="space-y-2 px-5 pt-6 text-left md:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityChip severity={issue.severity} />
            <span className="mono-label text-[9px] text-white/40">{FIX_LABELS[guide.fix] || "Fix"} · {client?.business}</span>
          </div>
          <DialogTitle className="pr-6 text-[19px] tracking-[-0.03em] text-white">Fix with AI — {issue.title}</DialogTitle>
          <DialogDescription className="text-[12.5px] text-white/55">
            Claude drafts the exact change. You review it here. Nothing touches the live site until you approve, and even then it goes to the Claude queue (or you mark it applied yourself).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 pb-6 md:px-6">
          {!p && (
            <div className="rounded-md border border-dashed border-white/15 p-5 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-[#ff6a00]" />
              <p className="mt-2 text-[13px] text-white/70">Generate a concrete fix from this audit&apos;s page facts and the client record.</p>
              <DarkButton variant="flame" onClick={generate} disabled={!!busy} className="mt-4">
                {busy === "gen" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {busy === "gen" ? "Drafting the fix…" : "Generate fix"}
              </DarkButton>
            </div>
          )}

          {p && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={`mono-label text-[10px] ${STATUS[fix.status]?.tone || "text-white/50"}`}>{STATUS[fix.status]?.label || fix.status}</p>
                {fix.claude_job_id && (
                  <Link to={`/claude?job=${fix.claude_job_id}`} className="inline-flex items-center gap-1 text-[12px] text-[#ff8a5c] hover:underline">Open in Claude queue <ArrowUpRight className="h-3 w-3" /></Link>
                )}
              </div>

              {p.summary && <p className="text-[14px] leading-relaxed text-white/85">{p.summary}</p>}
              {p.target && <p className="text-[12px] text-white/50"><span className="mono-label mr-1.5 text-[9px] text-white/35">Where</span>{p.target}</p>}

              {(needs.length > 0 || hasPlaceholder) && (
                <div className="rounded-md border border-[#ffaa00]/30 bg-[#ffaa00]/[0.06] p-3.5">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#ffc566]"><AlertTriangle className="h-3.5 w-3.5" /> Confirm before it goes live</p>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[12px] text-white/70">
                    {needs.map((n, i) => <li key={i}>{n}</li>)}
                    {hasPlaceholder && <li>The change still contains a [[CONFIRM]] placeholder — Claude will stop and ask before applying it.</li>}
                  </ul>
                  {fix.status === "proposed" && needs.length > 0 && (
                    <label className="mt-2.5 flex items-center gap-2 text-[12px] text-white/80">
                      <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="h-3.5 w-3.5 accent-[#ff3c00]" />
                      I&apos;ve checked these against the Google Business Profile / client
                    </label>
                  )}
                </div>
              )}

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="mono-label text-[9.5px] text-white/45">Before → after</p>
                  <CopyBtn text={p.after || ""} />
                </div>
                <DiffView before={p.before} after={p.after} />
              </div>

              {p.code && p.code.trim() !== (p.after || "").trim() && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="mono-label text-[9.5px] text-white/45">Full code {p.code_language ? `(${p.code_language})` : ""}</p>
                    <CopyBtn text={p.code} />
                  </div>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-white/10 bg-black/40 p-3 text-[11.5px] text-white/80">{p.code}</pre>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {(p.steps || []).length > 0 && (
                  <div>
                    <p className="mono-label mb-1.5 text-[9.5px] text-white/45">Apply</p>
                    <ol className="list-decimal space-y-1 pl-5 text-[12.5px] text-white/75">{p.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                  </div>
                )}
                {(p.verify || []).length > 0 && (
                  <div>
                    <p className="mono-label mb-1.5 text-[9.5px] text-white/45">Verify</p>
                    <ul className="list-disc space-y-1 pl-5 text-[12.5px] text-white/75">{p.verify.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
              </div>
            </>
          )}

          {error && <p className="rounded-md border border-[#ff3c00]/30 bg-[#ff3c00]/10 px-3 py-2 text-[12.5px] text-[#ff9b78]">{error}</p>}

          {p && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-4">
              <div className="flex flex-wrap gap-1.5">
                {fix.status === "proposed" && (
                  <>
                    <DarkButton variant="subtle" onClick={generate} disabled={!!busy}>{busy === "gen" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Regenerate</DarkButton>
                    <DarkButton variant="subtle" onClick={dismiss} disabled={!!busy}><X className="h-3.5 w-3.5" /> Dismiss</DarkButton>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {["proposed", "queued"].includes(fix.status) && (
                  confirmApplied ? (
                    <span className="flex items-center gap-2 text-[12px] text-white/70">
                      Live on the site now?
                      <DarkButton onClick={applied} disabled={!!busy}>{busy === "applied" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Yes, mark applied</DarkButton>
                      <DarkButton variant="subtle" onClick={() => setConfirmApplied(false)}>Cancel</DarkButton>
                    </span>
                  ) : (
                    <DarkButton onClick={() => setConfirmApplied(true)} disabled={!!busy || (fix.status === "proposed" && needs.length > 0 && !checked)} title="Use when you've made this change yourself">
                      <CheckCircle2 className="h-3.5 w-3.5" /> I applied it
                    </DarkButton>
                  )
                )}
                {fix.status === "proposed" && (
                  <DarkButton variant="flame" onClick={approveQueue} disabled={!canApprove || !!busy} title={!canApprove ? "Confirm the facts above first" : ""}>
                    {busy === "queue" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Approve &amp; send to Claude
                  </DarkButton>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
