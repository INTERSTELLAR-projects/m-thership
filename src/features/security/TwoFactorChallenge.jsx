import { useState } from "react";
import { Loader2, ShieldCheck, Smartphone, Mail, LifeBuoy, LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AuthShell from "@/features/auth/AuthShell";
import { sec } from "./api";

// Second step after sign-in, for portal logins that turned 2-step verification on.
// Shown when the portal answers 428 { code: "2fa_required" }; passing it binds this session on the server.
export default function TwoFactorChallenge({ methods = {}, emailHint = "", onDone }) {
  const first = methods.totp ? "totp" : methods.email ? "email" : "recovery";
  const [method, setMethod] = useState(first);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const pick = (m) => { setMethod(m); setCode(""); setErr(""); setInfo(""); };
  const send = async () => {
    setErr(""); setInfo("");
    try { const r = await sec("send_email_code", { purpose: "verify" }); setInfo(`Code sent to ${r.sent_to || emailHint}.`); } catch (e) { setErr(e.message); }
  };
  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const r = await sec("verify", { method, code });
      if (method === "recovery" && typeof r.recovery_left === "number") setInfo(`${r.recovery_left} recovery codes left.`);
      onDone?.();
    } catch (e2) { setErr(e2.message); setBusy(false); }
  };

  const tabs = [
    methods.totp && ["totp", "Authenticator", Smartphone],
    methods.email && ["email", "Email code", Mail],
    ["recovery", "Recovery code", LifeBuoy],
  ].filter(Boolean);
  const isRecovery = method === "recovery";

  return (
    <AuthShell eyebrow="(Two-step verification)">
      <div className="ms-fade">
        <div className="mb-5 flex h-11 w-11 items-center justify-center bg-ink text-[#ff6a00]"><ShieldCheck className="h-5 w-5" /></div>
        <h2 className="text-[34px] font-semibold leading-[1.02] tracking-[-0.05em] sm:text-[40px]">One more <span className="text-[#ff3c00]">/step</span></h2>
        <p className="mt-3 text-[14.5px] leading-[1.55] text-ink/60">
          {method === "totp" ? "Enter the 6-digit code from your authenticator app." : method === "email" ? `We'll email a 6-digit code to ${emailHint}.` : "Enter one of the recovery codes you saved when you turned this on."}
        </p>

        {tabs.length > 1 && (
          <div className="mt-6 grid gap-px border border-hair bg-hair" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map(([k, l, Icon]) => (
              <button key={k} type="button" onClick={() => pick(k)} aria-pressed={method === k} className={`flex items-center justify-center gap-1.5 px-2 py-2.5 text-[12.5px] font-medium ${method === k ? "bg-ink text-white" : "bg-[#f5f3f0] text-ink/65 hover:text-ink"}`}>
                <Icon className="h-3.5 w-3.5" />{l}
              </button>
            ))}
          </div>
        )}

        {info && <p role="status" className="mt-5 border border-ink/15 bg-white/70 px-3.5 py-3 text-[13.5px] text-ink/75">{info}</p>}
        {err && <p role="alert" className="mt-5 border border-[#ff3c00]/40 bg-[#ff3c00]/[0.06] px-3.5 py-3 text-[13.5px] text-[#b82b00]">{err}</p>}

        <form onSubmit={submit} className="mt-6 space-y-4">
          {method === "email" && <button type="button" onClick={send} className="ms-btn ms-btn--ghost">Email me a code</button>}
          <div>
            <label htmlFor="mfa-code" className="mono-label mb-1.5 block text-[10.5px] text-ink/60">{isRecovery ? "Recovery code" : "6-digit code"}</label>
            <input
              id="mfa-code"
              className={`ms-input text-center font-mono ${isRecovery ? "text-[18px] uppercase tracking-[0.2em]" : "text-[22px] tracking-[0.5em]"}`}
              inputMode={isRecovery ? "text" : "numeric"}
              autoComplete="one-time-code"
              maxLength={isRecovery ? 9 : 6}
              value={code}
              onChange={(e) => setCode(isRecovery ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ""))}
              placeholder={isRecovery ? "XXXX-XXXX" : "••••••"}
              autoFocus
            />
          </div>
          <button type="submit" className="ms-btn ms-btn--flame" disabled={busy || (isRecovery ? code.replace(/[^A-Z0-9]/g, "").length < 8 : code.length < 6)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Verify
          </button>
        </form>
        <p className="mt-7 flex items-center justify-between border-t border-hair pt-5 text-[13px] text-ink/55">
          <span>Locked out? Email <a className="ms-link" href="mailto:hello@interstellar-strategies.com">hello@interstellar-strategies.com</a>.</span>
          <button type="button" onClick={() => base44.auth.logout()} className="inline-flex items-center gap-1.5 hover:text-[#ff3c00]"><LogOut className="h-3.5 w-3.5" />Sign out</button>
        </p>
      </div>
    </AuthShell>
  );
}
