import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Check, Mail, ShieldCheck, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Tag } from "@/features/clients/ui";
import { fmtDate } from "@/lib/useData";

const call = async (args) => (await base44.functions.invoke("portal-invite", args)).data;
const errText = (e) => e?.response?.data?.error || e?.message || "Something went wrong.";

// In-app replacement for the old window.confirm / window.alert invite flow.
// Invites go to ONE portal login email at a time; the server enforces it is in this client's portal_emails.
export default function PortalInviteDialog({ open, client, onClose, onEditClient }) {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["portal-invite", client?.id], queryFn: () => call({ action: "status", client_id: client.id }), enabled: open && !!client?.id, retry: false });
  const s = status.data;
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null); // { tone, text }
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => { if (open) { setMsg(null); setBusy(""); } }, [open]);
  useEffect(() => { if (s?.default_email) setEmail((e) => e || s.default_email); }, [s?.default_email]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => panel.current?.querySelector("button")?.focus(), 30);
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!open || !client) return null;
  const emails = s?.portal_emails || [];
  const refresh = () => { status.refetch(); qc.invalidateQueries({ queryKey: ["CRMClient"] }); };

  const run = async (kind, args) => {
    setBusy(kind); setMsg(null);
    try {
      const r = await call(args);
      if (kind === "test") setMsg({ tone: "ok", text: `Test email sent to ${r.to}. No client was emailed.` });
      else if (kind === "auto") setMsg({ tone: "ok", text: r.settings.auto_send ? "Automatic invites are on. New subscribers get theirs the day after payment." : "Automatic invites are off. Payments still queue an invite, but nothing is sent until you turn this on." });
      else setMsg({ tone: "ok", text: `Invite sent to ${r.email}. They sign in with Google or a one-time email code, and only ever see ${client.business}.` });
      refresh();
    } catch (e) {
      setMsg({ tone: "err", text: errText(e) });
    } finally { setBusy(""); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="pi-title" onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-lg border border-hair bg-canvas shadow-2xl">
        <div className="h-[3px] bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" aria-hidden="true" />
        <div className="flex items-center justify-between border-b border-hair px-5 py-4">
          <div>
            <p className="mono-label text-[9.5px] text-ink/50">Client portal</p>
            <h3 id="pi-title" className="text-[18px] font-semibold tracking-[-0.03em]">Invite {client.business}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-ink/50 hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {status.isLoading ? <p className="text-[13px] text-ink/50">Loading…</p> : status.isError ? (
            <p className="text-[13px] text-red-700">{errText(status.error)}</p>
          ) : (
            <>
              {s.sent && (
                <div className="flex items-start gap-2 border border-green-200 bg-green-50 px-3 py-2.5 text-[12.5px] text-green-900">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Invited {s.sent.email} on {fmtDate(String(s.sent.sent_at || "").slice(0, 10))}.
                </div>
              )}
              {s.queued && !s.sent && (
                <div className="border border-hair bg-card px-3 py-2.5 text-[12.5px] text-ink/70">Queued from a Stripe payment for {s.queued.email}, due {fmtDate(String(s.queued.due_at || "").slice(0, 10))}.</div>
              )}
              {emails.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-[13px] text-ink/70">{s.problem}</p>
                  <button type="button" onClick={() => { onClose(); onEditClient(); }} className="h-10 border border-hair bg-card px-4 text-[13px] font-medium hover:border-ink/30">Edit client</button>
                </div>
              ) : (
                <div>
                  <label htmlFor="pi-email" className="mono-label mb-1.5 block text-[9.5px] text-ink/55">Send to</label>
                  <select id="pi-email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 w-full border border-hair bg-card px-3 text-[13.5px]">
                    {emails.map((e) => <option key={e} value={String(e).toLowerCase()}>{e}</option>)}
                  </select>
                  <p className="mt-1.5 text-[11.5px] text-ink/50">Only this client&apos;s portal login emails can be invited. Add more under Edit client.</p>
                </div>
              )}
              <ul className="space-y-1.5 border-t border-hair pt-4 text-[12.5px] text-ink/65">
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff3c00]" /> No password is emailed. They sign in with Google or a one-time code.</li>
                <li className="flex gap-2"><Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff3c00]" /> Sends the branded welcome email with a &ldquo;Log in to your portal&rdquo; button and turns their portal on.</li>
              </ul>
              <div className="flex items-center justify-between gap-3 border-t border-hair pt-4">
                <div>
                  <p className="text-[13px] font-medium">Invite automatically after payment</p>
                  <p className="text-[11.5px] text-ink/50">The day after a new subscription is paid in Stripe. Applies to all clients.</p>
                </div>
                <button type="button" role="switch" aria-checked={!!s.settings?.auto_send} disabled={!!busy} onClick={() => run("auto", { action: "settings", auto_send: !s.settings?.auto_send })}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${s.settings?.auto_send ? "bg-[#ff3c00]" : "bg-ink/20"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${s.settings?.auto_send ? "left-[22px]" : "left-0.5"}`} />
                  <span className="sr-only">Invite automatically after payment</span>
                </button>
              </div>
              {s.history?.length > 0 && (
                <details className="border-t border-hair pt-3">
                  <summary className="cursor-pointer text-[12px] text-ink/55">Invite log ({s.history.length})</summary>
                  <ul className="mt-2 space-y-1.5">
                    {s.history.map((h) => (
                      <li key={h.id} className="flex flex-wrap items-center gap-2 text-[11.5px] text-ink/65">
                        <Tag tone={h.status === "sent" ? "green" : h.status === "failed" || h.status === "needs_review" ? "amber" : "muted"}>{h.status.replace("_", " ")}</Tag>
                        <span>{h.email}</span><span className="text-ink/40">{h.source} · {fmtDate(String(h.at || "").slice(0, 10))}</span>
                        {h.message && <span className="w-full text-ink/45">{h.message}</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
          {msg && <p role="status" className={`text-[12.5px] ${msg.tone === "err" ? "text-red-700" : "text-green-800"}`}>{msg.text}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hair px-5 py-4">
          <button type="button" disabled={!!busy} onClick={() => run("test", { action: "send_test", client_id: client.id })} className="text-[12.5px] text-ink/60 hover:text-[#ff3c00] disabled:opacity-40">
            {busy === "test" ? "Sending test…" : "Send me a test"}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-10 border border-hair px-4 text-[13px] hover:border-ink/30">Cancel</button>
            <button type="button" disabled={!!busy || !s || emails.length === 0 || !email} onClick={() => run("invite", { action: "invite", client_id: client.id, email, resend: !!s?.sent })}
              className="inline-flex h-10 items-center gap-2 bg-[#ff3c00] px-4 text-[13px] font-medium text-white hover:bg-ink disabled:opacity-40">
              <Send className="h-3.5 w-3.5" /> {busy === "invite" ? "Sending…" : s?.sent ? "Resend invite" : "Send invite"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
