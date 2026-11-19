import { useState } from "react";
import { ChevronDown } from "lucide-react";

// A data block that starts collapsed (Clients page rule: numbers stay out of the way until asked for).
// The open/closed choice is remembered per browser (a convenience only; it always renders without storage).
export default function Collapse({ id, label, hint, right, children, defaultOpen = false }) {
  const key = id ? `ms_collapse_${id}` : null;
  const [open, setOpen] = useState(() => {
    if (!key) return defaultOpen;
    try { const v = window.localStorage.getItem(key); return v === null ? defaultOpen : v === "1"; } catch { return defaultOpen; }
  });
  const toggle = () => setOpen((o) => { try { if (key) window.localStorage.setItem(key, o ? "0" : "1"); } catch { /* ignore */ } return !o; });
  return (
    <section className="rounded-md border border-hair bg-card">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="ms-kicker">{label}</span>
        {hint ? <span className="hidden truncate text-[12px] text-ink/45 sm:inline">{hint}</span> : null}
        <span className="ml-auto flex items-center gap-3">{right}<ChevronDown className={`h-4 w-4 text-ink/45 transition-transform ${open ? "rotate-180" : ""}`} /></span>
      </button>
      {open ? <div className="border-t border-hair p-4">{children}</div> : null}
    </section>
  );
}
