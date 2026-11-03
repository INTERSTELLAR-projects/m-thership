import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { renderSubject } from "./emailBlocks";
import { recipientIssues } from "./recipients";
import { Btn, Pill } from "./ui";

// In-app send confirmation: count, kind, warnings, and a per-recipient check (subject as they'll see it + any
// missing merge data). Sending only starts after the explicit tick + button.
export default function SendDialog({ open, onClose, doc, recipients, kind, warnings, onSend }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setChecked(false); setBusy(false); setResult(null); setError(""); } }, [open]);
  const flagged = recipients.filter((r) => recipientIssues(doc, r).length);

  const go = async () => {
    setBusy(true);
    setError("");
    try { setResult(await onSend()); }
    catch (e) { setError(e.message || "Send failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{result ? "Send finished" : `Send to ${recipients.length} ${recipients.length === 1 ? "person" : "people"}?`}</DialogTitle>
          <DialogDescription>
            {result
              ? `${result.sent} sent${result.failed ? `, ${result.failed} failed` : ""}${result.skipped ? `, ${result.skipped} skipped` : ""}. Saved to Sent history.`
              : `${kind === "mass" ? "Mass email: each person gets their own copy with a one-click unsubscribe link; anyone who unsubscribed is skipped." : "1:1 email: each person gets their own copy, nobody sees the other recipients."} From "Justin | Interstellar Strategies".`}
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <>
            {(warnings.length > 0 || flagged.length > 0) && (
              <div className="space-y-1 border border-amber-500/40 bg-amber-50 p-2.5 text-[12px] text-amber-900">
                {warnings.map((w) => <p key={w} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}</p>)}
                {flagged.length > 0 && <p className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{flagged.length} recipient{flagged.length === 1 ? " is" : "s are"} missing merge data (fallbacks are used, e.g. "there" for first name).</p>}
              </div>
            )}
            <div className="max-h-72 overflow-auto border border-hair">
              <table className="w-full text-left text-[12px]">
                <thead className="sticky top-0 bg-paper">
                  <tr className="mono-label text-[8.5px] text-ink/45"><th className="px-2.5 py-1.5">To</th><th className="px-2.5 py-1.5">Subject they'll see</th><th className="px-2.5 py-1.5">Check</th></tr>
                </thead>
                <tbody>
                  {recipients.slice(0, 500).map((r) => {
                    const issues = recipientIssues(doc, r);
                    return (
                      <tr key={r.key} className="border-t border-hair align-top">
                        <td className="px-2.5 py-1.5"><p className="font-medium">{r.name && r.name !== r.email ? r.name : ""}</p><p className="text-ink/55">{r.email}</p></td>
                        <td className="px-2.5 py-1.5 text-ink/75">{renderSubject(doc, r.vars)}</td>
                        <td className="px-2.5 py-1.5">{issues.length ? <Pill tone="warn">{issues.join(" · ")}</Pill> : <Pill>ok</Pill>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="accent-[#ff3c00]" />
              I checked the preview and these {recipients.length} recipient{recipients.length === 1 ? "" : "s"}.
            </label>
            {error && <p className="text-[12px] text-red-700">{error}</p>}
          </>
        )}

        {result && (
          <div className="max-h-72 overflow-auto border border-hair">
            {(result.results || []).map((r, i) => (
              <div key={`${r.email}-${i}`} className="flex items-center gap-2 border-b border-hair px-2.5 py-1.5 text-[12px] last:border-b-0">
                {r.status === "sent" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : r.status === "skipped" ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> : <XCircle className="h-3.5 w-3.5 text-red-600" />}
                <span className="flex-1 truncate">{r.email}</span>
                <span className="text-ink/50">{r.status}{r.error ? ` · ${r.error}` : ""}</span>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {result ? <Btn variant="ink" onClick={onClose}>Done</Btn> : (
            <>
              <Btn disabled={busy} onClick={onClose}>Cancel</Btn>
              <Btn variant="flame" disabled={!checked || busy || !recipients.length} onClick={go}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} {busy ? "Sending…" : `Send ${recipients.length}`}
              </Btn>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
