import { useEffect } from "react";
import { Presentation, X } from "lucide-react";
import { IS_PRESENTING, isPresentShortcut, togglePresentation, endPresentation } from "@/lib/presentation";

// Presentation mode controls (admin app only): the Alt+Shift+P shortcut and, while it is on, the chip that says so.
// See src/lib/presentation.js for what the mode does.
export function PresentationControls() {
  useEffect(() => {
    const onKey = (e) => { if (isPresentShortcut(e)) { e.preventDefault(); togglePresentation(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!IS_PRESENTING) return null;
  return (
    <div role="status" aria-live="polite" className="pointer-events-auto fixed right-3 top-[54px] z-[95] flex h-9 items-center gap-2 rounded-full border border-[#ff3c00] bg-white pl-3 pr-1 text-[12.5px] font-medium text-ink shadow-[0_8px_20px_-12px_rgba(255,60,0,0.9)]">
      <span className="pm-live-dot h-2 w-2 rounded-full bg-[#ff3c00]" aria-hidden="true" />
      <span>Presentation mode</span>
      <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#ff3c00]" style={{ background: "rgba(255,60,0,.10)", padding: "1px 5px" }}>Sample data</span>
      <button type="button" onClick={() => endPresentation()} className="flex h-7 items-center gap-1 rounded-full px-2 text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink" title="Leave Presentation mode (Alt+Shift+P)" aria-label="Leave Presentation mode">
        <X className="h-3.5 w-3.5" /><span className="hidden sm:inline">Exit</span>
      </button>
    </div>
  );
}

// Top bar button: switches Presentation mode on or off.
export function PresentationButton({ className = "" }) {
  return (
    <button
      type="button"
      onClick={togglePresentation}
      title={IS_PRESENTING ? "Leave Presentation mode (Alt+Shift+P)" : "Presentation mode: show Møthership with sample data (Alt+Shift+P)"}
      aria-pressed={IS_PRESENTING}
      className={`flex items-center gap-1.5 p-2 transition-colors ${IS_PRESENTING ? "text-[#ff3c00]" : "text-ink/60 hover:text-ink"} ${className}`}
    >
      <Presentation className="h-4 w-4" />
      <span className="hidden text-[12.5px] lg:inline">{IS_PRESENTING ? "Presenting" : "Present"}</span>
    </button>
  );
}

// Shown instead of a page that stays out of Presentation mode (it is built around real client names).
export function PresentationHidden() {
  return (
    <div className="mx-auto max-w-xl px-5 py-16 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#ff3c00]">(Presentation mode)</p>
      <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.035em] text-ink">Not part of the demo</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink/60">This page works from real client records, so it stays hidden while you present. Leave Presentation mode to open it.</p>
      <button type="button" onClick={() => endPresentation()} className="mt-6 inline-flex h-10 items-center gap-2 border border-hair bg-paper px-4 text-[13px] font-medium text-ink transition-colors hover:border-[#ff3c00] hover:text-[#ff3c00]" style={{ borderRadius: 4 }}>
        <X className="h-3.5 w-3.5" /> Leave Presentation mode
      </button>
    </div>
  );
}
