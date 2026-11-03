import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Loader2, MailCheck, KeyRound, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AuthShell from "./AuthShell";

// Branded sign-in for Møthership. Only real SDK auth calls:
//   loginViaEmailPassword · loginWithProvider("google") · register → verifyOtp (+ resendOtp) · resetPasswordRequest · resetPassword
// Routes: /login · /register (first-time setup from an invite) · /forgot-password · /reset-password?token=…
// After any successful sign-in: hard redirect (window.location) so the auth provider re-initialises.

const errText = (e, fallback) => {
  const d = e?.response?.data || e?.data || {};
  const m = d?.message || d?.detail || d?.error?.message || (typeof d?.error === "string" ? d.error : "") || e?.message;
  return typeof m === "string" && m && !/^Request failed with status/i.test(m) ? m : fallback;
};
const statusOf = (e) => e?.status || e?.response?.status || 0;

// Same-origin post-login destination from ?returnTo= or ?from_url=, else "/".
function useReturnTo() {
  const { search } = useLocation();
  return useMemo(() => {
    const p = new URLSearchParams(search);
    const raw = p.get("returnTo") || p.get("from_url") || "";
    if (!raw) return "/";
    try {
      const u = new URL(raw, window.location.origin);
      if (u.origin !== window.location.origin || /^\/(login|register|forgot-password|reset-password)\b/.test(u.pathname)) return "/";
      return u.pathname + u.search + u.hash;
    } catch { return "/"; }
  }, [search]);
}
const go = (to) => { window.location.href = to; };
const withReturn = (path, returnTo) => (returnTo && returnTo !== "/" ? `${path}?returnTo=${encodeURIComponent(returnTo)}` : path);

function Title({ children, accent, sub }) {
  return (
    <div className="mb-7">
      <h2 className="text-[34px] font-semibold leading-[1.02] tracking-[-0.05em] sm:text-[40px]">
        {children} <span className="text-[#ff3c00]">/{accent}</span>
      </h2>
      {sub && <p className="mt-3 text-[14.5px] leading-[1.55] text-ink/60">{sub}</p>}
    </div>
  );
}

function Label({ htmlFor, children, right }) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <label htmlFor={htmlFor} className="mono-label text-[10.5px] text-ink/60">{children}</label>
      {right}
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={show ? "text" : "password"} className="ms-input pr-12" value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} placeholder={placeholder} required minLength={8} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink/45 hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Alert({ tone = "error", children }) {
  if (!children) return null;
  const cls = tone === "error" ? "border-[#ff3c00]/40 bg-[#ff3c00]/[0.06] text-[#b82b00]" : "border-ink/15 bg-white/70 text-ink/75";
  return <p role={tone === "error" ? "alert" : "status"} className={`mb-5 border px-3.5 py-3 text-[13.5px] leading-[1.45] ${cls}`}>{children}</p>;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.02c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28V6.61H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l4.01-3.11z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.8l3.44-3.44A11.96 11.96 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77z" />
    </svg>
  );
}

function GoogleButton({ returnTo, label = "Continue with Google" }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="ms-btn ms-btn--ghost" disabled={busy} onClick={() => { setBusy(true); base44.auth.loginWithProvider("google", returnTo); }}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />} {label}
    </button>
  );
}

function Divider({ children = "or with email" }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-hair" /><span className="mono-label text-[10px] text-ink/45">{children}</span><span className="h-px flex-1 bg-hair" />
    </div>
  );
}

// ---------- /login ----------
function SignIn({ returnTo }) {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const note = params.get("reset") === "1" ? "Password updated. Sign in with your new password." : "";

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await base44.auth.loginViaEmailPassword(email.trim(), password);
      go(returnTo);
    } catch (e2) {
      const s = statusOf(e2);
      setErr(s === 403 ? "This email isn't verified yet. Finish setting up your login first." : s === 429 ? "Too many attempts. Wait a few minutes and try again." : errText(e2, "That email and password didn't match. Try again, or reset your password."));
      setBusy(false);
    }
  };

  return (
    <div className="ms-fade">
      <Title accent="aboard" sub="Sign in to your Interstellar client portal.">Welcome</Title>
      <Alert tone="info">{note}</Alert>
      <Alert>{err}</Alert>
      <GoogleButton returnTo={returnTo} />
      <Divider />
      <form onSubmit={submit} className="space-y-4" noValidate={false}>
        <div>
          <Label htmlFor="email">Email</Label>
          <input id="email" type="email" className="ms-input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@business.com" required />
        </div>
        <div>
          <Label htmlFor="password" right={<Link to={withReturn("/forgot-password", returnTo)} className="text-[12.5px] ms-link">Forgot password?</Link>}>Password</Label>
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" placeholder="Your password" />
        </div>
        <button type="submit" className="ms-btn ms-btn--flame !mt-6" disabled={busy || !email || !password}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Sign in {!busy && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
      <p className="mt-7 border-t border-hair pt-5 text-[13.5px] text-ink/60">
        First time here? <Link to={withReturn("/register", returnTo)} className="ms-link">Set up your login</Link> with the email your invite went to.
      </p>
    </div>
  );
}

// ---------- /register (first-time setup from an invite) ----------
function Setup({ returnTo }) {
  const [step, setStep] = useState("details");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const create = async (e) => {
    e.preventDefault();
    setErr(""); setInfo("");
    if (password.length < 8) return setErr("Use at least 8 characters.");
    if (password !== confirm) return setErr("The passwords don't match.");
    setBusy(true);
    try {
      await base44.auth.register({ email: email.trim(), password });
      setStep("code");
    } catch (e2) {
      const m = errText(e2, "");
      setErr(/exist|already|registered/i.test(m) ? "There's already a login for this email. Sign in, or reset your password." : m || "We couldn't set up that login. Check the email your invite went to, or contact us.");
    } finally { setBusy(false); }
  };

  const verify = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = await base44.auth.verifyOtp({ email: email.trim(), otpCode: code.trim() });
      const token = res?.access_token || res?.data?.access_token;
      if (token) { base44.auth.setToken(token); go(returnTo); return; }
      // No session came back: sign in with the password they just chose.
      await base44.auth.loginViaEmailPassword(email.trim(), password);
      go(returnTo);
    } catch (e2) {
      setErr(statusOf(e2) === 429 ? "Too many attempts. Wait a few minutes." : errText(e2, "That code didn't work. Check it, or send a new one."));
      setBusy(false);
    }
  };

  const resend = async () => {
    setErr(""); setInfo("");
    try { await base44.auth.resendOtp(email.trim()); setInfo("New code sent. Check your inbox."); } catch (e2) { setErr(errText(e2, "Couldn't send a new code yet. Wait a minute and try again.")); }
  };

  if (step === "code") {
    return (
      <div className="ms-fade">
        <div className="mb-5 flex h-11 w-11 items-center justify-center bg-ink text-[#ff6a00]"><MailCheck className="h-5 w-5" /></div>
        <Title accent="inbox" sub={`We sent a 6-digit code to ${email}. Enter it to confirm the email and finish setup.`}>Check your</Title>
        <Alert tone="info">{info}</Alert>
        <Alert>{err}</Alert>
        <form onSubmit={verify} className="space-y-4">
          <div>
            <Label htmlFor="otp">Verification code</Label>
            <input id="otp" inputMode="numeric" autoComplete="one-time-code" className="ms-input text-center font-mono text-[22px] tracking-[0.5em]" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="••••••" required />
          </div>
          <button type="submit" className="ms-btn ms-btn--flame" disabled={busy || code.length < 6}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm and enter</button>
        </form>
        <p className="mt-6 text-[13.5px] text-ink/60">No code? <button type="button" onClick={resend} className="ms-link">Send a new one</button> · <button type="button" onClick={() => setStep("details")} className="ms-link">Change email</button></p>
      </div>
    );
  }

  return (
    <div className="ms-fade">
      <Title accent="login" sub="Use the email your invite went to and choose a password. Prefer Google? Continue with Google instead.">Set up your</Title>
      <Alert>{err}</Alert>
      <GoogleButton returnTo={returnTo} />
      <Divider>or set a password</Divider>
      <form onSubmit={create} className="space-y-4">
        <div>
          <Label htmlFor="s-email">Invite email</Label>
          <input id="s-email" type="email" className="ms-input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@business.com" required />
        </div>
        <div>
          <Label htmlFor="s-pass">Password</Label>
          <PasswordInput id="s-pass" value={password} onChange={setPassword} autoComplete="new-password" placeholder="At least 8 characters" />
        </div>
        <div>
          <Label htmlFor="s-confirm">Confirm password</Label>
          <PasswordInput id="s-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" placeholder="Type it again" />
        </div>
        <button type="submit" className="ms-btn ms-btn--flame !mt-6" disabled={busy || !email || !password || !confirm}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Continue {!busy && <ArrowRight className="h-4 w-4" />}</button>
      </form>
      <p className="mt-7 border-t border-hair pt-5 text-[13.5px] text-ink/60">Already set up? <Link to={withReturn("/login", returnTo)} className="ms-link">Sign in</Link></p>
    </div>
  );
}

// ---------- /forgot-password ----------
function Forgot({ returnTo }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    // Always the same answer, so the page never reveals whether a login exists.
    try { await base44.auth.resetPasswordRequest(email.trim()); } catch { /* generic success */ }
    setSent(true); setBusy(false);
  };
  if (sent) {
    return (
      <div className="ms-fade">
        <div className="mb-5 flex h-11 w-11 items-center justify-center bg-ink text-[#ff6a00]"><MailCheck className="h-5 w-5" /></div>
        <Title accent="inbox" sub={`If ${email} has a portal login, a reset link is on its way. It expires in 1 hour.`}>Check your</Title>
        <Link to={withReturn("/login", returnTo)} className="ms-btn ms-btn--ghost">Back to sign in</Link>
      </div>
    );
  }
  return (
    <div className="ms-fade">
      <div className="mb-5 flex h-11 w-11 items-center justify-center bg-ink text-[#ff6a00]"><KeyRound className="h-5 w-5" /></div>
      <Title accent="password" sub="Enter your login email and we'll send you a link to choose a new one.">Reset your</Title>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="f-email">Email</Label>
          <input id="f-email" type="email" className="ms-input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@business.com" required />
        </div>
        <button type="submit" className="ms-btn ms-btn--flame" disabled={busy || !email}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Send reset link</button>
      </form>
      <p className="mt-7 border-t border-hair pt-5 text-[13.5px] text-ink/60">Remembered it? <Link to={withReturn("/login", returnTo)} className="ms-link">Sign in</Link></p>
    </div>
  );
}

// ---------- /reset-password?token=… ----------
function Reset() {
  const { search } = useLocation();
  const token = new URLSearchParams(search).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (password.length < 8) return setErr("Use at least 8 characters.");
    if (password !== confirm) return setErr("The passwords don't match.");
    setBusy(true);
    try {
      await base44.auth.resetPassword({ resetToken: token, newPassword: password });
      go("/login?reset=1");
    } catch (e2) {
      setErr(statusOf(e2) === 400 ? "This reset link has expired or was already used. Ask for a new one." : errText(e2, "Couldn't update the password. Try again."));
      setBusy(false);
    }
  };
  if (!token) {
    return (
      <div className="ms-fade">
        <Title accent="expired" sub="This reset link is missing its code. Ask for a new link.">Link</Title>
        <Link to="/forgot-password" className="ms-btn ms-btn--flame">Get a new link</Link>
      </div>
    );
  }
  return (
    <div className="ms-fade">
      <div className="mb-5 flex h-11 w-11 items-center justify-center bg-ink text-[#ff6a00]"><ShieldCheck className="h-5 w-5" /></div>
      <Title accent="password" sub="Pick something you don't use anywhere else.">Choose a new</Title>
      <Alert>{err}</Alert>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="r-pass">New password</Label>
          <PasswordInput id="r-pass" value={password} onChange={setPassword} autoComplete="new-password" placeholder="At least 8 characters" />
        </div>
        <div>
          <Label htmlFor="r-confirm">Confirm password</Label>
          <PasswordInput id="r-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" placeholder="Type it again" />
        </div>
        <button type="submit" className="ms-btn ms-btn--flame !mt-6" disabled={busy || !password || !confirm}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save password</button>
      </form>
    </div>
  );
}

const EYEBROWS = { "/login": "(Sign in)", "/register": "(First-time setup)", "/forgot-password": "(Account recovery)", "/reset-password": "(Account recovery)" };

export default function LoginPage() {
  const { pathname } = useLocation();
  const returnTo = useReturnTo();
  const path = pathname.replace(/\/+$/, "") || "/login";

  // Already signed in? Skip the form (setup and reset still render, since they work without a session).
  useEffect(() => {
    if (path !== "/login") return;
    let off = false;
    base44.auth.isAuthenticated().then((ok) => { if (ok && !off) go(returnTo); }).catch(() => {});
    return () => { off = true; };
  }, [path, returnTo]);

  return (
    <AuthShell eyebrow={EYEBROWS[path] || "(Sign in)"}>
      {path === "/register" ? <Setup returnTo={returnTo} />
        : path === "/forgot-password" ? <Forgot returnTo={returnTo} />
        : path === "/reset-password" ? <Reset />
        : <SignIn returnTo={returnTo} />}
    </AuthShell>
  );
}
