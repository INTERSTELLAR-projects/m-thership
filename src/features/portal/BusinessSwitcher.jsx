import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

// Business switcher for package-deal owners (one login on 2+ clients' portal_emails, e.g. Chase:
// Chasing Gains Coaching + Rein Nutrition). Shows only when there is more than one business.
// The list comes from the portal function (`businesses`), which already limits it to the clients this
// login may open; picking one only changes which client_id the portal sends, and the server re-checks it.

function Mark({ b, size = 22 }) {
  const initials = String(b.business || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return b.logo_url ? (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-[5px] border border-hair bg-white" style={{ width: size, height: size }}>
      <img src={b.logo_url} alt="" className="h-full w-full object-contain p-[2px]" />
    </span>
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-[5px] text-[9px] font-semibold text-white" style={{ width: size, height: size, background: b.accent || "#151515" }}>{initials}</span>
  );
}

const short = (name) => String(name || "").replace(/\s+(coaching|llc|inc\.?|co\.?)$/i, "").replace(/\s*\(.*\)\s*$/, "").trim() || name;

// Desktop: a compact dropdown next to the brand lockup.
export function BusinessDropdown({ businesses = [], currentId, onSwitch }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); window.removeEventListener("keydown", esc); };
  }, [open]);
  if (businesses.length < 2) return null;
  const cur = businesses.find((b) => b.id === currentId) || businesses[0];
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Switch business"
        className="flex h-9 max-w-[230px] items-center gap-2 rounded-full border border-hair bg-card pl-1.5 pr-2.5 text-[13px] font-medium tracking-[-0.02em] hover:border-ink/30"
      >
        <Mark b={cur} />
        <span className="truncate">{short(cur.business)}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-ink/45 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="listbox" aria-label="Your businesses" className="absolute left-0 top-[calc(100%+6px)] z-40 w-[280px] overflow-hidden rounded-md border border-hair bg-card shadow-xl">
          <p className="mono-label border-b border-hair px-3 py-2 text-[9.5px] text-ink/45">Your businesses</p>
          <ul className="py-1">
            {businesses.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={b.id === cur.id}
                  onClick={() => { setOpen(false); onSwitch(b.id); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-paper"
                >
                  <Mark b={b} size={26} />
                  <span className="min-w-0 flex-1 truncate font-medium">{b.business}</span>
                  {b.portal_enabled === false && <span className="text-[10px] text-ink/40">portal off</span>}
                  {b.id === cur.id && <Check className="h-4 w-4 shrink-0 text-[#ff3c00]" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Mobile / tablet: a full-width segmented pill under the header ("Chasing Gains · Rein Nutrition").
export function BusinessPills({ businesses = [], currentId, onSwitch, className = "" }) {
  if (businesses.length < 2) return null;
  const cur = businesses.find((b) => b.id === currentId) || businesses[0];
  return (
    <div className={`border-b border-hair bg-canvas/95 px-4 py-2 backdrop-blur ${className}`}>
      <div role="tablist" aria-label="Switch business" className="flex gap-1 overflow-x-auto rounded-full border border-hair bg-card p-1">
        {businesses.map((b) => {
          const on = b.id === cur.id;
          return (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => !on && onSwitch(b.id)}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium tracking-[-0.01em] transition-colors ${on ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}
            >
              <Mark b={b} size={18} />
              <span className="truncate">{short(b.business)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
