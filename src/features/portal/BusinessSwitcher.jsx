import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

// Business switcher for package-deal owners (one login on 2+ clients' portal_emails, e.g. Chase:
// Chasing Gains Coaching + Rein Nutrition). Shows only when there is more than one business.
// The list comes from the portal function (`businesses`), which already limits it to the clients this
// login may open; picking one only changes which client_id the portal sends, and the server re-checks it.

// Logo tile: the client's current logo (CRMClient.logo_url, the one their website uses), or a monogram in their
// brand color when no logo is on file.
export function Mark({ b, size = 22 }) {
  const [bad, setBad] = useState(false);
  const initials = String(b.business || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const r = size >= 30 ? 6 : 5;
  return b.logo_url && !bad ? (
    <span className="flex shrink-0 items-center justify-center overflow-hidden border border-hair bg-white" style={{ width: size, height: size, borderRadius: r }}>
      <img src={b.logo_url} alt="" className="h-full w-full object-contain" style={{ padding: Math.max(2, Math.round(size / 10)) }} onError={() => setBad(true)} />
    </span>
  ) : (
    <span className="pm-dots relative flex shrink-0 items-center justify-center overflow-hidden font-semibold tracking-[-0.02em] text-white" style={{ width: size, height: size, borderRadius: r, background: b.accent || "#1a1a1a", fontSize: Math.max(9, Math.round(size * 0.38)) }}>{initials}</span>
  );
}

// Portal header: the active business, front and centre (logo + name). Package owners get the switcher right on it.
export function ClientHeaderBrand({ client, businesses = [], onSwitch }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const multi = businesses.length > 1 && !!onSwitch;
  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); window.removeEventListener("keydown", esc); };
  }, [open]);
  if (!client) return null;
  const listed = businesses.find((x) => x.id === client.id) || {};
  const b = { business: client.business, logo_url: client.logo_url || client.logoUrl || listed.logo_url || "", accent: client.accent || listed.accent || "" };
  const inner = (
    <>
      <Mark b={b} size={36} />
      <span className="min-w-0 text-left">
        <span className="block truncate text-[15px] font-semibold leading-tight tracking-[-0.03em] sm:text-[17px]"><span className="sm:hidden">{short(b.business)}</span><span className="hidden sm:inline">{b.business}</span></span>
        <span className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45 sm:block">{multi ? "Switch business" : "Client portal"}</span>
      </span>
      {multi ? <ChevronDown className={`h-4 w-4 shrink-0 text-ink/45 transition-transform ${open ? "rotate-180" : ""}`} /> : null}
    </>
  );
  if (!multi) return <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:flex-none" data-client-brand>{inner}</div>;
  return (
    <div ref={ref} className="relative min-w-0 flex-1 lg:flex-none" data-client-brand>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} title="Switch business" className="flex w-full min-w-0 max-w-[340px] items-center gap-2.5 rounded-md py-1 pr-2 text-left transition-colors hover:bg-ink/[0.04]">{inner}</button>
      {open && (
        <div role="listbox" aria-label="Your businesses" className="absolute left-0 top-[calc(100%+8px)] z-40 w-[290px] overflow-hidden rounded-md border border-hair bg-card shadow-xl">
          <div className="h-[3px] flame-bg" />
          <p className="mono-label border-b border-hair px-3 py-2 text-[9.5px] text-ink/45">Your businesses</p>
          <ul className="py-1">
            {businesses.map((x) => (
              <li key={x.id}>
                <button type="button" role="option" aria-selected={x.id === client.id} onClick={() => { setOpen(false); if (x.id !== client.id) onSwitch(x.id); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-paper">
                  <Mark b={x} size={28} />
                  <span className="min-w-0 flex-1 truncate font-medium">{x.business}</span>
                  {x.portal_enabled === false && <span className="text-[10px] text-ink/40">portal off</span>}
                  {x.id === client.id && <Check className="h-4 w-4 shrink-0 text-[#ff3c00]" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
