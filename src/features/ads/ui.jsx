import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Btn } from "@/features/social/ui";

export { Btn, Field, Panel, Select, TextArea, TextInput, inputCls, ConfirmDialog, copyText } from "@/features/social/ui";

// Ads Studio UI bits (Møthership styling: light canvas, ink, flame orange; no window.alert/confirm).

const TONE = {
  pass: "border-green-700/30 bg-green-600/10 text-green-800",
  ok: "border-green-700/30 bg-green-600/10 text-green-800",
  executed: "border-ink bg-ink text-white",
  active: "border-[#ff3c00]/50 bg-[#ff3c00]/10 text-[#d83300]",
  warn: "border-[#ff6a00]/60 bg-[#ff6a00]/10 text-[#c44a00]",
  soft: "border-[#ff6a00]/60 bg-[#ff6a00]/10 text-[#c44a00]",
  proposed: "border-[#ff6a00]/60 bg-[#ff6a00]/10 text-[#c44a00]",
  pushed_paused: "border-[#ff6a00]/60 bg-[#ff6a00]/10 text-[#c44a00]",
  fail: "border-[#ff3c00] bg-[#ff3c00] text-white",
  hard: "border-[#ff3c00] bg-[#ff3c00] text-white",
  failed: "border-[#ff3c00] bg-[#ff3c00] text-white",
  error: "border-[#ff3c00] bg-[#ff3c00] text-white",
  blocked: "border-[#ff3c00]/60 text-[#d83300]",
  info: "border-hair text-ink/55",
  default: "border-ink/25 text-ink/70",
};

export function Pill({ tone, children, className = "" }) {
  return <span className={`mono-label inline-flex items-center whitespace-nowrap border px-1.5 py-0.5 text-[9px] ${TONE[tone] || TONE.default} ${className}`}>{children}</span>;
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-hair px-6 py-14 text-center">
      {Icon && <Icon className="mb-3 h-6 w-6 text-ink/25" />}
      <p className="text-sm font-medium text-ink/70">{title}</p>
      {children && <div className="mt-1 max-w-md text-xs leading-relaxed text-ink/50">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-0 border border-hair bg-card">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`relative flex h-9 items-center gap-1.5 px-3 text-[12.5px] transition-colors ${value === t.key ? "bg-ink text-white" : "text-ink/60 hover:text-[#ff3c00]"}`}
        >
          {t.icon && <t.icon className="h-3.5 w-3.5" />}
          {t.label}
          {t.count ? <span className={`mono-label ml-0.5 px-1 text-[9px] ${value === t.key ? "bg-[#ff3c00] text-white" : "bg-[#ff3c00]/10 text-[#d83300]"}`}>{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Approval dialog for anything that touches an ad platform: lists exactly what will happen and needs a tick. */
export function ApproveDialog({ open, title, lines = [], warning, confirmLabel = "Approve", busy, onConfirm, onClose, children }) {
  const [ok, setOk] = useState(false);
  useEffect(() => { if (open) setOk(false); }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Nothing changes on the ad platform until you approve this specific change.</DialogDescription>
        </DialogHeader>
        {lines.length > 0 && (
          <ul className="space-y-1.5 border border-hair bg-paper p-3 text-[12.5px]">
            {lines.map((l, i) => <li key={i} className="flex gap-2"><span className="text-[#ff3c00]">→</span><span>{l}</span></li>)}
          </ul>
        )}
        {children}
        {warning && <p className="border-l-2 border-[#ff3c00] bg-[#ff3c00]/5 px-3 py-2 text-[12px] text-[#a32d00]">{warning}</p>}
        <label className="flex items-start gap-2 text-[12.5px]">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 accent-[#ff3c00]" />
          <span>I approve this exact change.</span>
        </label>
        <DialogFooter>
          <Btn onClick={onClose} disabled={busy}>Cancel</Btn>
          <Btn variant="flame" disabled={!ok || busy} onClick={onConfirm}>{busy ? "Working…" : confirmLabel}</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Notice({ tone = "info", children }) {
  const cls = tone === "warn" ? "border-[#ff6a00]/50 bg-[#ff6a00]/[0.07] text-[#8a3a00]" : tone === "danger" ? "border-[#ff3c00]/60 bg-[#ff3c00]/[0.07] text-[#a32d00]" : "border-hair bg-card text-ink/70";
  return <div className={`border px-3 py-2 text-[12.5px] leading-relaxed ${cls}`}>{children}</div>;
}

export const fmtDate = (s) => (s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
