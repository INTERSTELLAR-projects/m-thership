import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldAlert, RotateCcw } from "lucide-react";
import { sec } from "@/features/security/api";
import { fmtDate } from "@/lib/useData";

// Settings > Security (admin). What protects each kind of login, and a reset for clients locked out of 2-step.
export default function SecurityTab() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const load = () => sec("admin_list").then(setData).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const reset = async (email) => {
    if (!window.confirm(`Turn off 2-step verification for ${email}? They'll sign in with just their password or Google until they turn it on again.`)) return;
    setBusy(email); setMsg(""); setErr("");
    try { await sec("admin_reset", { email }); setMsg(`2-step verification turned off for ${email}.`); await load(); } catch (e) { setErr(e.message); } finally { setBusy(""); }
  };

  return (
    <div className="max-w-4xl space-y-5">
      <section className="border border-hair bg-paper p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-[#ff3c00]" />
          <div className="space-y-2 text-[13.5px] leading-[1.6] text-ink/70">
            <p className="text-[15px] font-semibold text-ink">Client portal logins</p>
            <p>Clients can turn on 2-step verification under <strong>Account</strong> in their portal: an authenticator app (recommended), an emailed code, and single-use recovery codes. Once it&apos;s on, every portal request is refused on the server until that sign-in session passes the second step.</p>
            <p className="text-[15px] font-semibold text-ink pt-2">Your admin login</p>
            <p>The admin app reads data directly with the platform session, so an app-level second step couldn&apos;t actually be enforced there. Sign in with Google and keep 2-Step Verification on for that Google account: that is the real second factor for Møthership admin access.</p>
          </div>
        </div>
      </section>

      <section className="border border-hair bg-paper">
        <header className="flex items-center justify-between border-b border-hair px-5 py-3.5">
          <p className="mono-label text-[10.5px] text-ink/60">Clients with 2-step on</p>
          {data && <span className="font-mono text-[12px] text-ink/50">{data.logins.length}</span>}
        </header>
        {err && <p role="alert" className="px-5 py-3 text-[13px] text-[#b82b00]">{err}</p>}
        {msg && <p role="status" className="px-5 py-3 text-[13px] text-ink/70">{msg}</p>}
        {data && !data.configured && <p className="flex items-center gap-2 px-5 py-3 text-[13px] text-[#b82b00]"><ShieldAlert className="h-4 w-4" />The MFA_ENCRYPTION_KEY secret is missing, so clients can&apos;t turn 2-step on.</p>}
        {!data && !err && <p className="px-5 py-6 text-[13px] text-ink/50">Loading…</p>}
        {data && data.logins.length === 0 && <p className="px-5 py-6 text-[13px] text-ink/55">No client has turned it on yet.</p>}
        {data && data.logins.length > 0 && (
          <ul className="divide-y divide-hair">
            {data.logins.map((l) => (
              <li key={l.email} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div>
                  <p className="text-[14px] font-medium">{l.email}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink/50">
                    {[l.totp && "authenticator", l.email_code && "email code"].filter(Boolean).join(" + ")} · {l.recovery_left} recovery left · on since {l.enabled_at ? fmtDate(l.enabled_at) : "—"}{l.locked ? " · locked" : ""}
                  </p>
                </div>
                <button type="button" onClick={() => reset(l.email)} disabled={busy === l.email} className="inline-flex h-9 items-center gap-1.5 border border-hair bg-white px-3 text-[12.5px] font-medium hover:border-[#ff3c00] hover:text-[#ff3c00] disabled:opacity-50">
                  {busy === l.email ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}Reset 2-step
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
