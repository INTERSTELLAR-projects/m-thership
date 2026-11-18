// "Want us to do it? Send a request" — on every Studio screen. Done for you, or do it yourself: the client can
// use the tool, or hand the job to the Interstellar team. Creates a ClientRequest through the existing portal
// request flow (portal function, action create_request), so it lands in Møthership > Requests like any other.
import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Send, Sparkles, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function RequestHelpButton({ studio, studioLabel, scopeId, preview, context = "", placeholder, compact }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true); setErr("");
    try {
      await base44.functions.invoke("portal", {
        action: "create_request", client_id: scopeId, kind: "studio_request", priority: "normal",
        title: `${studioLabel}: ${text.trim().split("\n")[0].slice(0, 90)}`,
        details: `${text.trim()}${context ? `\n\nFrom: ${context}` : ""}`,
        fields: { topic: "Done for you", studio },
      });
      setSent(true); setText("");
    } catch (e2) {
      setErr(e2?.response?.data?.error || "Couldn't send that. Try again, or message us.");
    } finally { setBusy(false); }
  };
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setSent(false); }} className={`group inline-flex items-center gap-2 rounded-full border border-[#ff3c00]/35 bg-white font-semibold text-ink shadow-[0_6px_20px_-12px_rgba(255,60,0,.6)] transition-colors hover:border-[#ff3c00] hover:bg-[#ff3c00] hover:text-white ${compact ? "h-9 px-3.5 text-[12.5px]" : "h-10 px-4 text-[13px]"}`} data-request-help={studio}>
        <Sparkles className="h-4 w-4 text-[#ff3c00] group-hover:text-white" />
        <span><span className="hidden sm:inline">Want us to do it? </span>Send a request</span>
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onMouseDown={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Send a request">
          <form onSubmit={submit} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#ff3c00]">Done for you</p>
                <h3 className="mt-1 text-[20px] font-semibold tracking-[-0.03em]">Want us to do it?</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink/60">Tell us what you need and our team takes it from here. You&apos;ll see it in Requests and we&apos;ll message you when it&apos;s ready.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-md p-1.5 text-ink/45 hover:bg-ink/5"><X className="h-4 w-4" /></button>
            </div>
            {sent ? (
              <div className="mt-5 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-[14px] text-green-900">
                <Check className="h-5 w-5" /> Request sent. We&apos;re on it.
              </div>
            ) : (
              <>
                <textarea autoFocus rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder || "e.g. Write and send our holiday promo to everyone on the Customers list next Tuesday morning."} className="mt-4 w-full rounded-lg border border-hair px-3 py-2.5 text-[14px] outline-none focus:border-[#ff3c00] focus:ring-2 focus:ring-[#ff3c00]/15" />
                {err && <p role="alert" className="mt-2 text-[12.5px] text-red-700">{err}</p>}
                {preview && <p className="mt-2 text-[12px] text-ink/50">Admin preview: this creates a real request for this client.</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-md px-4 text-[13.5px] text-ink/60 hover:text-ink">Cancel</button>
                  <button type="submit" disabled={!text.trim() || busy} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#ff3c00] px-5 text-[13.5px] font-semibold text-white hover:bg-ink disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send request
                  </button>
                </div>
              </>
            )}
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}
