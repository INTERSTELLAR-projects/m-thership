// Small on-brand building blocks for the Accounting & Tax center.
import { useState } from "react";
import { AlertTriangle, ExternalLink, Info, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DISCLAIMER } from "./taxConfig";

export function Heading({ title, accent, sub, right }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[26px] font-semibold leading-none tracking-[-0.04em] text-ink md:text-[30px]">
          {title} <span className="text-[#ff3c00]">/{accent}</span>
        </h2>
        {sub && <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-ink/55">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Card({ title, sub, right, children, className = "", dark, pad = "p-5" }) {
  return (
    <section className={`relative overflow-hidden rounded-md border ${pad} ${dark ? "band-dark grain border-ink" : "border-hair bg-card"} ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className={`label-cross ${dark ? "!text-white/80" : ""}`}>{title}</h3>}
            {sub && <p className={`mt-1 text-[11.5px] ${dark ? "text-white/50" : "text-ink/50"}`}>{sub}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, hero, tone }) {
  return (
    <div className={`relative flex min-h-[118px] flex-col overflow-hidden rounded-md border p-4 ${hero ? "band-dark grain border-ink" : "border-hair bg-card"}`}>
      <span className={`mono-label ${hero ? "text-white/55" : "text-ink/50"}`}>{label}</span>
      <p className={`mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums ${hero ? "flame-text" : tone === "warn" ? "text-[#c23000]" : "text-ink"}`}>{value}</p>
      {sub && <p className={`mt-auto pt-2 text-[11px] leading-snug ${hero ? "text-white/55" : "text-ink/50"}`}>{sub}</p>}
    </div>
  );
}

export function Btn({ children, onClick, kind = "ghost", busy, disabled, className = "", type = "button", title }) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-45";
  const styles = {
    flame: "flame-bg text-white shadow-[0_8px_20px_-12px_rgba(255,60,0,.8)] hover:brightness-110",
    ink: "bg-ink text-white hover:bg-ink/85",
    ghost: "border border-hair bg-card text-ink/75 hover:border-[#ff3c00]/50 hover:text-ink",
    danger: "border border-red-600/25 bg-card text-red-700 hover:bg-red-600/5",
    subtle: "text-ink/55 hover:text-ink",
  };
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled || busy} className={`${base} ${styles[kind]} ${className}`}>
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

// Two-step confirm (no window.confirm): first click arms, second click runs.
export function ConfirmBtn({ children, confirmText = "Click again to confirm", onConfirm, kind = "danger", className = "" }) {
  const [armed, setArmed] = useState(false);
  return (
    <Btn kind={armed ? "danger" : kind === "danger" ? "ghost" : kind} className={className}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else { setArmed(true); setTimeout(() => setArmed(false), 3500); } }}>
      {armed ? confirmText : children}
    </Btn>
  );
}

export const inputCls = "w-full rounded-md border border-hair bg-white/70 px-2.5 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-ink/30 focus:border-[#ff3c00]/60";

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mono-label !text-[9.5px] text-ink/55">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-[10.5px] leading-snug text-ink/45">{hint}</span>}
    </label>
  );
}

export function NumberInput({ value, onChange, placeholder, step = "any" }) {
  return <input type="number" step={step} className={inputCls} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
}

export function Select({ value, onChange, options, className = "" }) {
  return (
    <select className={`${inputCls} ${className}`} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}
    </select>
  );
}

export function Pill({ children, tone = "ink", className = "" }) {
  const t = {
    ink: "border-ink/15 bg-ink/[0.04] text-ink/65",
    flame: "border-[#ff3c00]/25 bg-[#ff3c00]/[0.08] text-[#c23000]",
    good: "border-emerald-700/20 bg-emerald-700/[0.07] text-emerald-800",
    warn: "border-amber-700/25 bg-amber-500/[0.10] text-amber-900",
    dark: "border-white/20 bg-white/10 text-white/80",
  }[tone];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] ${t} ${className}`}>{children}</span>;
}

export function Disclaimer({ compact }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-md border border-ink/15 bg-ink/[0.03] ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/45" />
      <p className="text-[11.5px] leading-relaxed text-ink/60">{DISCLAIMER}</p>
    </div>
  );
}

export function AssumptionBanner({ onFix }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border-2 border-[#ff3c00] bg-[#ff3c00]/[0.07] px-4 py-3">
      <AlertTriangle className="h-5 w-5 shrink-0 text-[#ff3c00]" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink">Assuming: single-member LLC taxed as a sole proprietor (Schedule C), filing single, Oregon resident in Molalla, no other income, no estimated payments made.</p>
        <p className="mt-0.5 text-[11.5px] text-ink/60">Every number below rests on these assumptions until you fill in the Business Profile.</p>
      </div>
      {onFix && <Btn kind="flame" onClick={onFix}>Fill in the profile</Btn>}
    </div>
  );
}

export function SourceLink({ entry }) {
  if (!entry) return null;
  return (
    <a href={entry.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10.5px] text-[#ff3c00] hover:underline">
      {entry.source || "source"} <ExternalLink className="h-3 w-3" />
    </a>
  );
}

export function StatusTag({ status }) {
  if (status === "verified") return <Pill tone="good">verified</Pill>;
  if (status === "statutory") return <Pill tone="ink">statutory</Pill>;
  return <Pill tone="warn">needs confirmation</Pill>;
}

export function Modal({ open, onClose, title, children, wide }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={`max-h-[88vh] overflow-y-auto border-hair bg-[#f5f3f0] p-0 ${wide ? "max-w-4xl" : "max-w-lg"}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-hair bg-[#f5f3f0] px-5 py-3.5">
          <DialogTitle className="text-[15px] font-semibold tracking-[-0.02em] text-ink">{title}</DialogTitle>
          <button onClick={onClose} className="p-1 text-ink/45 hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export function Bar({ value, className = "" }) {
  const w = Math.max(0, Math.min(1, Number(value) || 0)) * 100;
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-ink/[0.08] ${className}`}>
      <div className="h-full rounded-full" style={{ width: `${w}%`, background: "linear-gradient(90deg,#ff3c00,#ff6a00 55%,#ffaa00)" }} />
    </div>
  );
}

export function Empty({ title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-hair px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink/70">{title}</p>
      {body && <p className="mt-1 max-w-md text-xs leading-relaxed text-ink/45">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
