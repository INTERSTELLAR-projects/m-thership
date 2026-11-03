import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck, Smartphone, Mail, LifeBuoy, KeyRound, Copy, Download, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { encodeQR } from "@/features/qr/lib/encode";
import { sec, downloadCodes } from "./api";

// Portal: Account > Security. Password change + opt-in two-step verification (authenticator app, email code,
// recovery codes). Every check runs in the account-security backend function; nothing secret is kept here
// except the setup key shown once while pairing an authenticator.

function QrSvg({ text, size = 176 }) {
  const m = useMemo(() => { try { return encodeQR(text, "M"); } catch { return null; } }, [text]);
  if (!m) return null;
  const n = m.length, q = 2;
  return (
    <svg viewBox={`0 0 ${n + q * 2} ${n + q * 2}`} width={size} height={size} role="img" aria-label="Authenticator setup QR code" shapeRendering="crispEdges" className="bg-white">
      <rect width="100%" height="100%" fill="#fff" />
      {m.flatMap((row, y) => row.map((on, x) => (on ? <rect key={`${x}-${y}`} x={x + q} y={y + q} width="1" height="1" fill="#1a1a1a" /> : null)))}
    </svg>
  );
}

function Card({ icon: Icon, title, state, children }) {
  return (
    <section className="border border-hair bg-[#f5f3f0]">
      <header className="flex items-center justify-between gap-3 border-b border-hair px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center bg-ink text-[#ff6a00]"><Icon className="h-4 w-4" /></span>
          <h3 className="text-[16px] font-semibold tracking-[-0.02em]">{title}</h3>
        </div>
        {state}
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

const On = ({ on }) => <span className={`mono-label px-2 py-1 text-[9.5px] ${on ? "bg-[#ff3c00] text-white" : "bg-ink/[0.07] text-ink/55"}`}>{on ? "On" : "Off"}</span>;
const Err = ({ children }) => (children ? <p role="alert" className="mt-3 text-[13px] text-[#b82b00]">{children}</p> : null);
const btn = "inline-flex h-10 items-center justify-center gap-2 px-4 text-[13px] font-medium transition-colors disabled:opacity-50";
const flame = `${btn} bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] text-white hover:brightness-105`;
const ghost = `${btn} border border-hair bg-white text-ink hover:border-ink`;
const codeInput = "h-10 w-[150px] border border-hair bg-white px-3 text-center font-mono text-[16px] tracking-[0.35em] outline-none focus:border-[#ff3c00]";

function CodeRow({ onSubmit, label = "Confirm", busy, autoFocus }) {
  const [code, setCode] = useState("");
  return (
    <form className="mt-4 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); onSubmit(code); }}>
      <input className={codeInput} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus={autoFocus} aria-label="6-digit code" />
      <button type="submit" className={flame} disabled={busy || code.length < 6}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{label}</button>
    </form>
  );
}

function RecoveryCodes({ codes, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-5 border border-ink bg-ink p-5 text-white">
      <p className="mono-label text-[10px] text-[#ff6a00]">Save these now</p>
      <p className="mt-2 text-[13.5px] leading-[1.5] text-white/75">Each recovery code gets you in once if you lose your phone or can't get email. They won't be shown again.</p>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[15px] tracking-[0.12em]">
        {codes.map((c) => <span key={c}>{c}</span>)}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className={`${btn} border border-white/25 text-white hover:border-white`} onClick={() => { navigator.clipboard?.writeText(codes.join("\n")); setCopied(true); }}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy"}</button>
        <button type="button" className={`${btn} border border-white/25 text-white hover:border-white`} onClick={() => downloadCodes(codes)}><Download className="h-4 w-4" />Download</button>
        <button type="button" className={flame} onClick={onClose}>I saved them</button>
      </div>
    </div>
  );
}

function PasswordCard() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setErr("");
    if (next.length < 8) return setErr("Use at least 8 characters.");
    if (next !== again) return setErr("The new passwords don't match.");
    setBusy(true);
    try {
      const me = await base44.auth.me();
      await base44.auth.changePassword({ userId: me.id, currentPassword: cur, newPassword: next });
      setDone(true); setOpen(false); setCur(""); setNext(""); setAgain("");
    } catch (e2) {
      const s = e2?.status || e2?.response?.status;
      setErr(s === 401 ? "Your current password isn't right. If you only sign in with Google, you don't have one here." : e2?.response?.data?.message || e2?.message || "Couldn't change the password.");
    } finally { setBusy(false); }
  };
  const input = "h-10 w-full border border-hair bg-white px-3 text-[14px] outline-none focus:border-[#ff3c00]";
  return (
    <Card icon={KeyRound} title="Password">
      <p className="text-[13.5px] leading-[1.55] text-ink/65">Signing in with Google uses your Google account's own security. If you set a password for the portal, you can change it here.</p>
      {done && <p role="status" className="mt-3 text-[13px] text-ink/75">Password changed.</p>}
      {!open ? (
        <button type="button" className={`${ghost} mt-4`} onClick={() => { setOpen(true); setDone(false); }}>Change password</button>
      ) : (
        <form onSubmit={save} className="mt-4 grid max-w-[420px] gap-2.5">
          <input className={input} type="password" placeholder="Current password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
          <input className={input} type="password" placeholder="New password (8+ characters)" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          <input className={input} type="password" placeholder="New password again" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" className={flame} disabled={busy || !cur || !next || !again}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button>
            <button type="button" className={ghost} onClick={() => setOpen(false)}>Cancel</button>
          </div>
          <Err>{err}</Err>
        </form>
      )}
    </Card>
  );
}

export default function SecurityPanel({ preview = false }) {
  const [st, setSt] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState({});
  const [setup, setSetup] = useState(null); // { secret, otpauth_uri }
  const [emailStep, setEmailStep] = useState(""); // "enable" | "disable"
  const [totpOff, setTotpOff] = useState(false);
  const [codes, setCodes] = useState(null);

  const load = () => sec("status").then(setSt).catch((e) => setLoadErr(e.message));
  useEffect(() => { if (!preview) load(); }, [preview]);

  const run = async (key, fn) => {
    setBusy(key); setErr((x) => ({ ...x, [key]: "" }));
    try { await fn(); } catch (e) { setErr((x) => ({ ...x, [key]: e.message })); } finally { setBusy(""); }
  };

  if (preview) {
    return (
      <div className="space-y-4">
        <Heading />
        <p className="border border-hair bg-[#f5f3f0] px-5 py-4 text-[13.5px] text-ink/65">Admin preview: each client manages their own password and 2-step verification here. If a client is locked out, reset it under Settings &gt; Security.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Heading />
      {loadErr && <p role="alert" className="border border-[#ff3c00]/40 bg-[#ff3c00]/[0.06] px-4 py-3 text-[13.5px] text-[#b82b00]">{loadErr}</p>}
      <PasswordCard />

      {st && (
        <>
          <div className="flex items-start gap-3 border border-hair bg-white px-5 py-4">
            <ShieldCheck className={`mt-0.5 h-5 w-5 shrink-0 ${st.enabled ? "text-[#ff3c00]" : "text-ink/35"}`} />
            <div>
              <p className="text-[14.5px] font-semibold">Two-step verification is {st.enabled ? "on" : "off"}</p>
              <p className="mt-1 text-[13.5px] leading-[1.55] text-ink/60">
                {st.enabled
                  ? "After you sign in, the portal asks for a code from your phone or email before it shows anything. Each new sign-in asks again."
                  : "Add a second check after your password or Google sign-in, so your portal stays locked even if someone gets your password."}
              </p>
            </div>
          </div>

          <Card icon={Smartphone} title="Authenticator app" state={<On on={st.totp} />}>
            <p className="text-[13.5px] leading-[1.55] text-ink/65">Google Authenticator, 1Password, Authy, Microsoft Authenticator or any app that shows 6-digit codes. Recommended.</p>
            {!st.totp && !setup && (
              <button type="button" className={`${flame} mt-4`} disabled={busy === "totp"} onClick={() => run("totp", async () => setSetup(await sec("totp_begin")))}>
                {busy === "totp" && <Loader2 className="h-4 w-4 animate-spin" />}Set up authenticator
              </button>
            )}
            {!st.totp && setup && (
              <div className="mt-4 grid gap-5 sm:grid-cols-[auto,1fr]">
                <div className="border border-hair bg-white p-2"><QrSvg text={setup.otpauth_uri} /></div>
                <div>
                  <p className="text-[13.5px] text-ink/70"><strong>1.</strong> Scan the code with your app. Can&apos;t scan? Enter this key:</p>
                  <p className="mt-2 break-all border border-dashed border-hair bg-white px-3 py-2 font-mono text-[13px] tracking-[0.12em]">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</p>
                  <p className="mt-4 text-[13.5px] text-ink/70"><strong>2.</strong> Enter the 6-digit code it shows.</p>
                  <CodeRow busy={busy === "totp"} autoFocus label="Turn on" onSubmit={(code) => run("totp", async () => {
                    const r = await sec("totp_confirm", { code });
                    setSetup(null);
                    if (r.recovery_codes) setCodes(r.recovery_codes);
                    await load();
                  })} />
                  <button type="button" className="mt-3 text-[12.5px] text-ink/55 hover:text-ink" onClick={() => setSetup(null)}>Cancel</button>
                </div>
              </div>
            )}
            {st.totp && !totpOff && <button type="button" className={`${ghost} mt-4`} onClick={() => setTotpOff(true)}>Turn off</button>}
            {st.totp && totpOff && (
              <div>
                <p className="mt-4 text-[13.5px] text-ink/70">Enter a current code from your app to turn it off.</p>
                <CodeRow busy={busy === "totp"} autoFocus label="Turn off" onSubmit={(code) => run("totp", async () => { await sec("disable", { method: "totp", code }); setTotpOff(false); await load(); })} />
              </div>
            )}
            <Err>{err.totp}</Err>
          </Card>

          <Card icon={Mail} title="Email code" state={<On on={st.email_code} />}>
            <p className="text-[13.5px] leading-[1.55] text-ink/65">We email a 6-digit code to {st.email_hint} each time you sign in. Handy as a backup to the app.</p>
            {!emailStep && (
              <button type="button" className={`${st.email_code ? ghost : flame} mt-4`} disabled={busy === "email"} onClick={() => run("email", async () => {
                await sec("send_email_code", { purpose: st.email_code ? "verify" : "enable" });
                setEmailStep(st.email_code ? "disable" : "enable");
              })}>
                {busy === "email" && <Loader2 className="h-4 w-4 animate-spin" />}{st.email_code ? "Turn off" : "Turn on email codes"}
              </button>
            )}
            {emailStep && (
              <div>
                <p className="mt-4 text-[13.5px] text-ink/70">We sent a code to {st.email_hint}. Enter it to {emailStep === "enable" ? "turn email codes on" : "turn them off"}.</p>
                <CodeRow busy={busy === "email"} autoFocus label={emailStep === "enable" ? "Turn on" : "Turn off"} onSubmit={(code) => run("email", async () => {
                  if (emailStep === "enable") {
                    const r = await sec("email_confirm", { code });
                    if (r.recovery_codes) setCodes(r.recovery_codes);
                  } else {
                    await sec("disable", { method: "email", code });
                  }
                  setEmailStep(""); await load();
                })} />
                <button type="button" className="mt-3 text-[12.5px] text-ink/55 hover:text-ink" onClick={() => setEmailStep("")}>Cancel</button>
              </div>
            )}
            <Err>{err.email}</Err>
          </Card>

          {st.enabled && (
            <Card icon={LifeBuoy} title="Recovery codes" state={<span className="font-mono text-[12px] text-ink/60">{st.recovery_left} left</span>}>
              <p className="text-[13.5px] leading-[1.55] text-ink/65">Single-use codes for when you can&apos;t use your app or email. Making new ones cancels the old set.</p>
              {!codes && (
                <button type="button" className={`${ghost} mt-4`} disabled={busy === "rec"} onClick={() => run("rec", async () => { const r = await sec("recovery_regenerate"); setCodes(r.recovery_codes); await load(); })}>
                  {busy === "rec" && <Loader2 className="h-4 w-4 animate-spin" />}Make new codes
                </button>
              )}
              <Err>{err.rec}</Err>
            </Card>
          )}
          {codes && <RecoveryCodes codes={codes} onClose={() => setCodes(null)} />}
        </>
      )}
      {!st && !loadErr && <p className="py-10 text-center text-[13.5px] text-ink/50">Loading…</p>}
    </div>
  );
}

function Heading() {
  return (
    <div className="mb-2">
      <p className="mono-label text-[10.5px] text-ink/50">(Account)</p>
      <h2 className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.05em] sm:text-[40px]">Account <span className="text-[#ff3c00]">/security</span></h2>
    </div>
  );
}
