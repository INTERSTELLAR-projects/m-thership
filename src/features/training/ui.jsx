// Small building blocks for People > Training (admin + portal + trainee player). Brand: ink on paper, flame
// gradient (#ff3c00 -> #ff6a00 -> #ffaa00) for progress and primary actions. No browser alert/confirm dialogs:
// destructive actions use <ConfirmButton> (click, then "Yes, delete").
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";

export const inputCls = "w-full border border-hair bg-paper px-3 py-2 text-[13.5px] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-[#ff3c00]";
export const labelCls = "mono-label mb-1.5 block text-[9.5px] text-ink/55";

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className={labelCls}>{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-ink/45">{hint}</span>}
    </label>
  );
}

export function Button({ children, onClick, kind = "ghost", icon: Icon, busy, disabled, type = "button", className = "", title, size = "md" }) {
  const h = size === "sm" ? "h-8 px-2.5 text-[12px]" : "h-10 px-4 text-[13px]";
  const look = {
    flame: "flame-bg text-white shadow-[0_8px_20px_-12px_rgba(255,60,0,.9)] hover:brightness-105",
    ink: "bg-ink text-white hover:bg-[#ff3c00]",
    ghost: "border border-hair bg-card text-ink hover:border-ink/40",
    quiet: "text-ink/60 hover:text-ink",
    danger: "border border-red-200 bg-red-50 text-red-800 hover:border-red-400",
  }[kind];
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled || busy} className={`inline-flex shrink-0 items-center justify-center gap-1.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${h} ${look} ${className}`}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}

// Two-step destructive action (replaces confirm()).
export function ConfirmButton({ children, confirmText = "Yes, delete", onConfirm, icon, size = "sm", className = "" }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!armed) return undefined; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  if (!armed) return <Button size={size} kind="quiet" icon={icon} onClick={() => setArmed(true)} className={className}>{children}</Button>;
  return (
    <span className="inline-flex items-center gap-1">
      <Button size={size} kind="danger" busy={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); setArmed(false); } }}>{confirmText}</Button>
      <Button size={size} kind="quiet" onClick={() => setArmed(false)}>Cancel</Button>
    </span>
  );
}

const CHIP = {
  flame: "bg-[#ff3c00] text-white",
  soft: "bg-[#ff3c00]/10 text-[#c83000]",
  ink: "bg-ink text-white",
  green: "bg-green-700/10 text-green-800",
  red: "bg-red-600/10 text-red-700",
  amber: "bg-amber-500/15 text-amber-800",
  muted: "bg-ink/[0.07] text-ink/65",
};
export function Chip({ children, tone = "muted", className = "" }) {
  return <span className={`mono-label inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] leading-[1.4] ${CHIP[tone] || CHIP.muted} ${className}`}>{children}</span>;
}

export function Bar({ pct = 0, className = "h-1.5" }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className={`overflow-hidden bg-ink/[0.08] ${className}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)] transition-[width] duration-500" style={{ width: `${v}%` }} />
    </div>
  );
}

export function Modal({ open, onClose, title, kicker, children, footer, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => ref.current?.querySelector("input, textarea, select, button")?.focus(), 30);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/55" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden border border-hair bg-canvas shadow-2xl ${wide ? "max-w-[880px]" : "max-w-[600px]"}`}>
        <div className="h-[3px] shrink-0 bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" aria-hidden="true" />
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-hair px-5 pb-4 pt-5">
          <div className="min-w-0">
            {kicker && <p className="mono-label text-[9.5px] text-[#ff3c00]">({kicker})</p>}
            <h2 className="mt-1 text-[21px] font-semibold leading-tight tracking-[-0.03em]">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center text-ink/55 hover:text-ink" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-hair bg-[#f7f5f2] px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Notice({ tone = "info", children, className = "" }) {
  const look = tone === "error" ? "border-red-200 bg-red-50 text-red-800" : tone === "warn" ? "border-amber-300/60 bg-amber-50 text-amber-900" : tone === "ok" ? "border-green-200 bg-green-50 text-green-800" : "border-hair bg-card text-ink/70";
  return <div role={tone === "error" ? "alert" : undefined} className={`border px-3 py-2 text-[12.5px] leading-relaxed ${look} ${className}`}>{children}</div>;
}

export const fmtDay = (d) => (d ? new Date(String(d).length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
export const ago = (d) => {
  if (!d) return "never";
  const s = (Date.now() - Date.parse(d)) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};
export const todayIso = () => new Date().toLocaleDateString("en-CA");
export const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
