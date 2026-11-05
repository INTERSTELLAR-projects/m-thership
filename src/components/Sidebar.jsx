import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, Search, X, ChevronRight, Pin, PinOff, Compass, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { NAV_GROUPS, SETTINGS_ITEM, ALL_NAV, START_HERE, activeKey } from "@/lib/nav";
import BrandLockup from "@/components/brand/BrandLockup";
import { usePins, useCollapsed, useStartHereOpen } from "@/components/navPrefs";
import { useNavBadges } from "@/components/navBadges";

// Sections a first-time visitor sees open; everything else starts folded so the nav reads as a short list.
const DEFAULT_OPEN = new Set(["command", "clients"]);

function Badge({ n, active }) {
  if (!n) return null;
  return (
    <span className={`ml-auto shrink-0 rounded-sm px-1.5 py-px font-mono text-[10px] font-semibold tabular-nums ${active ? "bg-[#ff3c00] text-white" : "bg-[#ff3c00]/[0.12] text-[#c24100]"}`} aria-label={`${n} waiting`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

function NavItem({ item, active, onClose, badges = {}, pinned, onPin }) {
  const n = item.badge ? badges[item.badge] : 0;
  return (
    <div className="group relative">
      <Link
        to={item.path}
        onClick={onClose}
        aria-current={active ? "page" : undefined}
        className={`relative flex items-center gap-3 py-[8px] pl-3 pr-8 text-[13.5px] transition-colors duration-200 ${
          active ? "bg-ink text-white" : "text-ink/70 hover:bg-ink/[0.05] hover:text-ink"
        }`}
      >
        {active && <span className="absolute bottom-0 left-0 top-0 w-[3px] bg-[#ff3c00]" />}
        <item.icon className={`h-[16px] w-[16px] shrink-0 transition-colors ${active ? "text-[#ff3c00]" : "text-ink/45 group-hover:text-[#ff3c00]"}`} strokeWidth={1.75} />
        <span className="truncate font-medium tracking-[-0.01em]">{item.label}</span>
        {n ? <Badge n={n} active={active} /> : item.arch ? <span className={`ml-auto shrink-0 font-mono text-[8.5px] tracking-[0.08em] ${active ? "text-white/50" : "text-ink/30 group-hover:text-ink/50"}`}>{item.arch}</span> : null}
      </Link>
      {onPin && (
        <button
          type="button"
          onClick={() => onPin(item.key)}
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus:opacity-100 ${
            active ? "text-white/60 hover:text-white" : pinned ? "text-[#ff3c00]" : "text-ink/30 hover:text-ink"
          }`}
          aria-label={pinned ? `Unpin ${item.label}` : `Pin ${item.label} to the top`}
          title={pinned ? "Unpin" : "Pin to the top"}
        >
          {pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
        </button>
      )}
    </div>
  );
}

function StartHere({ badges, onClose, open, setOpen }) {
  const todo = START_HERE.reduce((n, s) => n + (s.badge && badges[s.badge] ? 1 : 0), 0);
  return (
    <div className="border-b border-hair px-3 py-2.5" data-start-here>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left" aria-expanded={open}>
        <Compass className="h-3.5 w-3.5 text-[#ff3c00]" />
        <span className="text-[12.5px] font-semibold tracking-[-0.01em]">Start here</span>
        <span className="text-[11px] text-ink/45">{todo ? `${todo} need you` : "daily flow"}</span>
        <ChevronRight className={`ml-auto h-3.5 w-3.5 text-ink/40 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <ol className="mt-2 space-y-px">
          {START_HERE.map((s, i) => {
            const n = s.badge ? badges[s.badge] : 0;
            return (
              <li key={s.path}>
                <Link to={s.path} onClick={onClose} title={s.hint} className="group flex items-center gap-2.5 px-1 py-1.5 text-[12.5px] text-ink/70 hover:bg-ink/[0.05] hover:text-ink">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ink/20 font-mono text-[9px] text-ink/55 group-hover:border-[#ff3c00] group-hover:text-[#ff3c00]">{i + 1}</span>
                  <span className="truncate">{s.label}</span>
                  <Badge n={n} />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default function Sidebar({ onOpenCommand, open, onClose }) {
  const { user } = useAuth();
  const location = useLocation();
  const email = user?.email || "";
  const initial = (user?.full_name || email || "?").trim().charAt(0).toUpperCase();
  const badges = useNavBadges();
  const [pins, setPins] = usePins();
  const [collapsed, setCollapsed] = useCollapsed();
  const [startOpen, setStartOpen] = useStartHereOpen();
  const current = activeKey(location);
  const pinnedItems = useMemo(() => (pins || []).map((k) => ALL_NAV.find((i) => i.key === k)).filter(Boolean), [pins]);
  const togglePin = (key) => setPins((p) => ((p || []).includes(key) ? p.filter((k) => k !== key) : [...(p || []), key]));

  const isCollapsed = (g) => {
    // The section holding the page you're on always shows.
    if (g.items.some((i) => i.key === current)) return false;
    if (collapsed && Object.prototype.hasOwnProperty.call(collapsed, g.id)) return !!collapsed[g.id];
    return !DEFAULT_OPEN.has(g.id);
  };
  const toggle = (g) => setCollapsed((c) => ({ ...(c || Object.fromEntries(NAV_GROUPS.map((x) => [x.id, !DEFAULT_OPEN.has(x.id)]))), [g.id]: !isCollapsed(g) }));
  const allOpen = NAV_GROUPS.every((g) => !isCollapsed(g));
  const setAll = (fold) => setCollapsed(Object.fromEntries(NAV_GROUPS.map((g) => [g.id, fold])));

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[264px] max-w-[86vw] flex-col border-r border-hair bg-canvas transition-transform duration-300 ${
        open ? "translate-x-0" : "-translate-x-full"
      } md:static md:w-[236px] md:min-w-[236px] md:translate-x-0`}
      data-sidebar
    >
      {/* Brand */}
      <div className="flex h-[60px] items-center justify-between border-b border-hair px-4">
        <Link to="/" onClick={onClose} className="flex min-w-0 items-center" aria-label="Møthership by Interstellar — home">
          <BrandLockup word="MØTHERSHIP" sub="by Interstellar" size={20} />
        </Link>
        <button onClick={onClose} className="p-1.5 text-ink/50 hover:text-ink md:hidden" aria-label="Close menu">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Quick navigate */}
      <div className="border-b border-hair p-3">
        <button
          onClick={onOpenCommand}
          className="flex w-full items-center gap-2.5 border border-hair bg-paper px-3 py-2 text-xs text-ink/50 transition-colors hover:border-ink/40 hover:text-ink"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Jump to a page or client…</span>
          <kbd className="ml-auto font-mono text-[10px] text-ink/40">⌘K</kbd>
        </button>
      </div>

      <StartHere badges={badges} onClose={onClose} open={!!startOpen} setOpen={setStartOpen} />

      <nav className="flex-1 overflow-y-auto overscroll-contain pb-3" aria-label="Møthership">
        {pinnedItems.length > 0 && (
          <div className="border-b border-hair py-2" data-pinned>
            <p className="flex items-center gap-1.5 px-4 pb-1 pt-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink/45"><Pin className="h-2.5 w-2.5" />Pinned</p>
            <div className="space-y-px">
              {pinnedItems.map((item) => <NavItem key={`pin:${item.key}`} item={item} active={item.key === current} onClose={onClose} badges={badges} pinned onPin={togglePin} />)}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end px-3 pt-2">
          <button type="button" onClick={() => setAll(allOpen)} className="flex items-center gap-1 px-1 py-0.5 text-[10.5px] text-ink/40 hover:text-ink" title={allOpen ? "Collapse all sections" : "Expand all sections"}>
            {allOpen ? <ChevronsDownUp className="h-3 w-3" /> : <ChevronsUpDown className="h-3 w-3" />}{allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>

        {NAV_GROUPS.map((g) => {
          const folded = isCollapsed(g);
          const n = g.items.reduce((s, i) => s + (i.badge ? badges[i.badge] || 0 : 0), 0);
          return (
            <div key={g.id} className="mb-1" data-nav-section={g.id}>
              <button
                type="button"
                onClick={() => toggle(g)}
                aria-expanded={!folded}
                className="group flex w-full items-center gap-2 px-4 py-2 text-left"
              >
                <ChevronRight className={`h-3 w-3 shrink-0 text-ink/35 transition-transform group-hover:text-ink/70 ${folded ? "" : "rotate-90"}`} />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55 group-hover:text-ink">{g.label}</span>
                {folded && n ? <Badge n={n} /> : folded ? <span className="ml-auto font-mono text-[9.5px] text-ink/30">{g.items.length}</span> : null}
              </button>
              {!folded && (
                <div className="space-y-px pb-1">
                  {g.items.map((item) => (
                    <NavItem key={item.key} item={item} active={item.key === current} onClose={onClose} badges={badges} pinned={(pins || []).includes(item.key)} onPin={togglePin} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-hair">
        <NavItem item={SETTINGS_ITEM} active={current === SETTINGS_ITEM.key} onClose={onClose} />
        <div className="flex items-center gap-3 border-t border-hair px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#ff3c00] text-[12px] font-semibold text-white">{initial}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-ink">{email}</p>
            <p className="mono-label text-[9px] text-[#ff3c00]">{user?.role === "admin" ? "Admin" : "Client"}</p>
          </div>
          <button onClick={() => base44.auth.logout()} className="p-1.5 text-ink/45 transition-colors hover:text-[#ff3c00]" aria-label="Log out" title="Log out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
