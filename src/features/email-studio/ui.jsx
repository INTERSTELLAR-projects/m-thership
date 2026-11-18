// Small UI kit for the client Email Studio (portal look: ink, hairlines, flame accents).
import { useEffect, useState } from "react";
import { Check, Copy, Loader2, X } from "lucide-react";

export const inputCls = "w-full rounded-md border border-hair bg-white px-3 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-[#ff3c00] focus:ring-2 focus:ring-[#ff3c00]/15";

export function Label({ children, hint, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-3">
      <span className="text-[12.5px] font-semibold tracking-[-0.01em] text-ink/80">{children}</span>
      {hint && <span className="text-[11px] text-ink/45">{hint}</span>}
    </label>
  );
}

export function Btn({ children, onClick, kind = "ink", icon: Icon, busy, disabled, type = "button", className = "", size = "md", title }) {
  const k = {
    flame: "bg-[#ff3c00] text-white hover:bg-ink",
    ink: "bg-ink text-white hover:bg-[#ff3c00]",
    ghost: "border border-hair bg-white text-ink hover:border-ink/40",
    soft: "bg-ink/[0.05] text-ink hover:bg-ink/[0.09]",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  }[kind];
  const s = size === "sm" ? "h-8 px-3 text-[12.5px]" : size === "lg" ? "h-12 px-6 text-[15px]" : "h-10 px-4 text-[13.5px]";
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled || busy} className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold tracking-[-0.01em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${k} ${s} ${className}`}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

const TONES = {
  draft: "bg-ink/[0.07] text-ink/70", scheduled: "bg-blue-600/10 text-blue-800", queued: "bg-amber-500/15 text-amber-800", sending: "bg-amber-500/15 text-amber-800",
  sent: "bg-green-600/10 text-green-800", partial: "bg-amber-500/15 text-amber-800", failed: "bg-red-600/10 text-red-700", cancelled: "bg-ink/[0.06] text-ink/50",
  paused: "bg-amber-500/15 text-amber-800", active: "bg-green-600/10 text-green-800", subscribed: "bg-green-600/10 text-green-800", pending: "bg-amber-500/15 text-amber-800",
  unsubscribed: "bg-ink/[0.07] text-ink/60", cleaned: "bg-red-600/10 text-red-700", test: "bg-[#ff3c00]/10 text-[#c22d00]",
};
export function Badge({ tone = "draft", children }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold capitalize ${TONES[tone] || TONES.draft}`}>{children || tone}</span>;
}

export function Toggle({ on, onChange, label, hint, disabled }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!on)} className="flex w-full items-start gap-3 text-left disabled:opacity-50">
      <span className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${on ? "bg-[#ff3c00]" : "bg-ink/20"}`}>
        <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
      </span>
      <span>
        <span className="block text-[13.5px] font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] leading-snug text-ink/55">{hint}</span>}
      </span>
    </button>
  );
}

export function Card({ children, className = "", pad = true }) {
  return <section className={`rounded-xl border border-hair bg-white ${pad ? "p-5" : ""} ${className}`}>{children}</section>;
}

export function Kpi({ label, value, sub, accent }) {
  return (
    <div className="min-w-0 rounded-xl border border-hair bg-white px-4 py-3.5">
      <p className="truncate text-[11.5px] font-medium text-ink/55">{label}</p>
      <p className={`mt-1 text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums ${accent ? "text-[#ff3c00]" : "text-ink"}`}>{value}</p>
      {sub != null && <p className="mt-1.5 truncate text-[11.5px] text-ink/50">{sub}</p>}
    </div>
  );
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-hair bg-white/60 px-6 py-12 text-center">
      {Icon && <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ff3c00]/10 text-[#ff3c00]"><Icon className="h-5 w-5" /></span>}
      <p className="mt-3 text-[16px] font-semibold tracking-[-0.02em]">{title}</p>
      {children && <p className="mt-1 max-w-md text-[13.5px] leading-relaxed text-ink/55">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children, action }) {
  const c = { info: "border-blue-200 bg-blue-50 text-blue-900", warn: "border-amber-200 bg-amber-50 text-amber-900", ok: "border-green-200 bg-green-50 text-green-900", error: "border-red-200 bg-red-50 text-red-800", test: "border-[#ff3c00]/30 bg-[#ff3c00]/[0.06] text-[#8a2e00]" }[tone];
  return (
    <div role={tone === "error" ? "alert" : undefined} className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-[13.5px] leading-snug ${c}`}>
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

// Right-hand drawer on desktop, full screen sheet on phones.
export function Drawer({ open, onClose, title, children, wide, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-ink/40" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div onMouseDown={(e) => e.stopPropagation()} className={`flex h-full w-full flex-col bg-[#faf9f7] shadow-2xl ${wide ? "md:max-w-3xl" : "md:max-w-lg"}`}>
        <header className="flex items-center justify-between gap-3 border-b border-hair bg-white px-5 py-4">
          <h3 className="min-w-0 truncate text-[17px] font-semibold tracking-[-0.03em]">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink"><X className="h-4 w-4" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="border-t border-hair bg-white px-5 py-3.5">{footer}</footer>}
      </div>
    </div>
  );
}

export function CopyField({ value, label, multiline }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1600); } catch { /* clipboard blocked */ }
  };
  return (
    <div>
      {label && <Label>{label}</Label>}
      <div className="flex items-stretch gap-2">
        {multiline
          ? <textarea readOnly value={value} rows={4} className={`${inputCls} font-mono text-[11.5px]`} onFocus={(e) => e.target.select()} />
          : <input readOnly value={value} className={`${inputCls} font-mono text-[12px]`} onFocus={(e) => e.target.select()} />}
        <Btn kind="ghost" icon={done ? Check : Copy} onClick={copy} className="self-start">{done ? "Copied" : "Copy"}</Btn>
      </div>
    </div>
  );
}

// Two-step inline confirm (never window.confirm): first click arms, second click acts.
export function ConfirmBtn({ children, confirmLabel = "Click again to confirm", onConfirm, kind = "danger", size = "sm", icon }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!armed) return undefined; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return (
    <Btn kind={armed ? "flame" : kind} size={size} icon={icon} busy={busy} onClick={async () => {
      if (!armed) { setArmed(true); return; }
      setBusy(true);
      try { await onConfirm(); } finally { setBusy(false); setArmed(false); }
    }}>{armed ? confirmLabel : children}</Btn>
  );
}

export function Segmented({ value, onChange, options, size = "md" }) {
  return (
    <div className="inline-flex rounded-lg border border-hair bg-white p-0.5">
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={`rounded-md font-medium transition-colors ${size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3.5 py-1.5 text-[13px]"} ${value === v ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}>{l}</button>
      ))}
    </div>
  );
}
