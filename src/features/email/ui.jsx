import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Small UI kit for Email Studio (Møthership styling: hairlines, ink, flame orange).

export function Btn({ children, variant = "outline", className = "", ...props }) {
  const tone = {
    flame: "bg-[#ff3c00] text-white hover:bg-ink border border-[#ff3c00] hover:border-ink",
    ink: "bg-ink text-white hover:bg-[#ff3c00] border border-ink hover:border-[#ff3c00]",
    outline: "border border-hair bg-card text-ink hover:border-[#ff3c00] hover:text-[#ff3c00]",
    ghost: "border border-transparent text-ink/60 hover:text-[#ff3c00]",
  }[variant];
  return (
    <button type="button" {...props} className={`inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap px-3 text-[12.5px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${tone} ${className}`}>
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mono-label flex items-center justify-between gap-2 text-[9px] text-ink/50">
        <span>{label}</span>
        {hint && <span className="normal-case tracking-normal text-ink/35">{hint}</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const inputCls = "w-full border border-hair bg-paper px-2.5 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-ink/30 focus:border-[#ff3c00]";

export function TextInput({ value, onChange, className = "", ...props }) {
  return <input {...props} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`${inputCls} ${className}`} />;
}

export function TextArea({ value, onChange, rows = 3, className = "", ...props }) {
  return <textarea {...props} rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`${inputCls} resize-y leading-snug ${className}`} />;
}

export function Select({ value, onChange, options, placeholder, className = "" }) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`${inputCls} h-9 py-0 ${className}`}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
}

export function Panel({ label, title, right, children, className = "", bodyClass = "" }) {
  return (
    <section className={`border border-hair bg-card ${className}`}>
      {(label || title || right) && (
        <header className="flex items-center justify-between gap-2 border-b border-hair px-3.5 py-2.5">
          <div className="min-w-0">
            {label && <p className="mono-label text-[8.5px] text-ink/45">{label}</p>}
            {title && <h3 className="truncate text-[13px] font-semibold tracking-[-0.01em]">{title}</h3>}
          </div>
          {right}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function Pill({ children, tone = "plain" }) {
  const cls = {
    plain: "border-hair text-ink/60",
    flame: "border-[#ff3c00]/50 bg-[#ff3c00]/10 text-[#d83300]",
    ink: "border-ink bg-ink text-white",
    warn: "border-amber-500/50 bg-amber-50 text-amber-800",
    muted: "border-hair text-ink/35",
  }[tone];
  return <span className={`mono-label inline-flex items-center border px-1.5 py-0.5 text-[9px] ${cls}`}>{children}</span>;
}

// In-app confirm (never window.confirm).
export function ConfirmDialog({ open, title, body, confirmLabel = "Confirm", danger = false, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) setBusy(false); }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {body && <DialogDescription>{body}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant={danger ? "ink" : "flame"} disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); onClose(); } }}>{confirmLabel}</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PromptDialog({ open, title, label, initial = "", confirmLabel = "Save", onSubmit, onClose }) {
  const [value, setValue] = useState(initial);
  useEffect(() => { if (open) setValue(initial); }, [open, initial]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <Field label={label}><TextInput autoFocus value={value} onChange={setValue} onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) { onSubmit(value.trim()); onClose(); } }} /></Field>
        <DialogFooter>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="flame" disabled={!value.trim()} onClick={() => { onSubmit(value.trim()); onClose(); }}>{confirmLabel}</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");
