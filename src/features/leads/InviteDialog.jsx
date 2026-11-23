// "Send portal access": composes the lead-tier invite email (house design, opt-out + mailing address in the
// footer) and shows it exactly as it will arrive. Nothing goes out until a person clicks Send.
import { useEffect, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { engine } from "./api";
import { btn, btnFlame, input } from "./ui";

export default function InviteDialog({ lead, open, onClose, onSent }) {
  const [email, setEmail] = useState("");
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState("");
  const compose = async (to) => {
    setBusy("compose"); setErr("");
    try { const r = await engine("invite_compose", { client_id: lead.id, email: to }); setData(r); if (!to) setEmail(r.to || ""); } catch (e) { setErr(e.message); }
    setBusy("");
  };
  useEffect(() => { if (open && lead?.id) { setSent(""); setData(null); compose(""); } }, [open, lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open || !lead) return null;
  const send = async () => {
    setBusy("send"); setErr("");
    try { const r = await engine("invite_send", { client_id: lead.id, email, confirm: true }); setSent(r.to); onSent?.(r); } catch (e) { setErr(e.message); }
    setBusy("");
  };
  const blockers = data?.blockers || [];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-3 backdrop-blur-sm md:p-8" role="dialog" aria-modal="true" aria-label={`Send portal access to ${lead.business}`}>
      <div className="w-full max-w-[760px] border border-hair bg-canvas shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-hair px-4 py-3">
          <div className="min-w-0"><p className="mono-label text-[9.5px] text-ink/45">Send portal access</p><p className="truncate text-[15px] font-semibold">{lead.business}</p></div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center text-ink/50 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-4">
          {sent ? (
            <p role="status" className="border border-green-200 bg-green-50 px-3 py-3 text-[13px] text-green-800">Sent to {sent}. Their lead-tier login is on, and the preview is marked Sent. Logins show up on the call sheet as hot.</p>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => compose(email)} placeholder="Business email from their website or Google profile" aria-label="Send to" className={input} />
                <button type="button" onClick={send} disabled={!!busy || blockers.length > 0 || !email} className={`${btnFlame} h-10 shrink-0 justify-center`}>{busy === "send" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Send</button>
              </div>
              <p className="text-[11.5px] text-ink/50">Use the public email on their website or Google profile. An owner's email only if it's public there.</p>
              {blockers.length ? <ul className="space-y-1 border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">{blockers.map((b) => <li key={b}>{b}</li>)}</ul> : null}
              {err ? <p role="alert" className="text-[12.5px] text-red-700">{err}</p> : null}
            </>
          )}
          {data?.subject ? <p className="text-[12.5px]"><span className="text-ink/50">Subject:</span> <b className="font-medium">{data.subject}</b></p> : null}
          <div className="border border-hair bg-white">{busy === "compose" && !data ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-ink/40" /></div> : data?.html ? <iframe title="Email preview" srcDoc={data.html} className="block h-[560px] w-full" sandbox="" /> : null}</div>
          <div className="flex justify-end"><button type="button" onClick={onClose} className={btn}>{sent ? "Done" : "Cancel"}</button></div>
        </div>
      </div>
    </div>
  );
}
