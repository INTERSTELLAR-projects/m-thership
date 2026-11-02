import { useState } from "react";

// In-app confirmation (no window.confirm).
export default function ConfirmDialog({ open, title, body, confirmLabel = "Delete", danger = true, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!open) return null;
  const go = async () => {
    setBusy(true);
    setErr("");
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] flex items-start justify-center bg-ink/45 p-4 pt-[16vh]" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-md border border-hair bg-canvas shadow-2xl">
        <div className="px-5 py-4">
          <h3 className="text-[17px] font-semibold tracking-[-0.03em]">{title}</h3>
          {body && <div className="mt-2 text-[13px] leading-relaxed text-ink/65">{body}</div>}
          {err && <p className="mt-2 text-[12px] text-red-700">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-hair px-5 py-3">
          <button type="button" onClick={onClose} className="h-9 px-4 text-[13px] text-ink/60 hover:text-ink">Cancel</button>
          <button type="button" disabled={busy} onClick={go} className={`h-9 px-5 text-[13px] font-medium text-white disabled:opacity-50 ${danger ? "bg-red-700 hover:bg-red-800" : "bg-[#ff3c00] hover:bg-ink"}`}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
