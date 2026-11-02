import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PILLARS, STATUSES } from "./brand";

// Small UI kit for the Social Studio pages (Møthership styling).

export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.key, s.label]));
export const PILLAR_LABEL = Object.fromEntries(PILLARS.map((p) => [p.key, p.label]));

const STATUS_TONE = {
  idea: "border-hair text-ink/55",
  draft: "border-ink/25 text-ink/75",
  ready: "border-[#ff6a00]/60 bg-[#ff6a00]/10 text-[#c44a00]",
  scheduled: "border-[#ff3c00]/50 bg-[#ff3c00]/10 text-[#d83300]",
  posted: "border-ink bg-ink text-white",
  skipped: "border-hair text-ink/35 line-through",
};

export function StatusBadge({ status }) {
  return <span className={`mono-label inline-flex items-center border px-1.5 py-0.5 text-[9px] ${STATUS_TONE[status] || STATUS_TONE.draft}`}>{STATUS_LABEL[status] || status || "Draft"}</span>;
}

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

export function TextInput({ value, onChange, ...props }) {
  return <input {...props} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`${inputCls} ${props.className || ""}`} />;
}

export function TextArea({ value, onChange, rows = 3, ...props }) {
  return <textarea {...props} rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`${inputCls} resize-y leading-snug ${props.className || ""}`} />;
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
      {(label || title) && (
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

/** In-app replacement for window.prompt. */
export function PromptDialog({ open, title, description, initial = "", confirmLabel = "Save", onConfirm, onClose }) {
  const [v, setV] = useState(initial);
  useEffect(() => { if (open) setV(initial); }, [open, initial]);
  const submit = () => { const t = v.trim(); if (t) onConfirm(t); };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className={inputCls} />
        <DialogFooter>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="flame" onClick={submit} disabled={!v.trim()}>{confirmLabel}</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** In-app replacement for window.confirm. */
export function ConfirmDialog({ open, title, description, confirmLabel = "Confirm", onConfirm, onClose }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="ink" onClick={onConfirm}>{confirmLabel}</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text || "");
    return true;
  } catch {
    return false;
  }
}

export function captionsText(p) {
  return [
    `# ${p.title || "Post"}`,
    "",
    "## Caption (Instagram / Facebook / X / TikTok)",
    p.caption || "",
    "",
    "## LinkedIn",
    p.caption_linkedin || p.caption || "",
    "",
    "## Alt text",
    p.alt_text || "",
  ].join("\n");
}
