import { openNavGuide } from "@/lib/navGuide";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, Search, X, Pin, PinOff, PanelLeftClose, PanelLeftOpen, HelpCircle } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { HUBS, MORE_HUBS, MORE_HUB, SETTINGS_ITEM, ALL_NAV, activeKey, hubFor } from "@/lib/nav";
import BrandLockup from "@/components/brand/BrandLockup";
import { usePins } from "@/components/navPrefs";
import { useNavBadges } from "@/components/navBadges";

// The sidebar is short: three screens (Command, Clients, Claude), then More (every deeper page, grouped) and Settings.
// The hub you are in unfolds its tabs underneath it; the same tabs sit across the top of the page (HubTabs).

function Badge({ n, active }) {
  if (!n) return null;
  return (
    <span className={`ml-auto shrink-0 rounded-sm px-1.5 py-px font-mono text-[10px] font-semibold tabular-nums ${active ? "bg-[#ff3c00] text-white" : "bg-[#ff3c00]/[0.12] text-[#c24100]"}`} aria-label={`${n} waiting`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

const hubCount = (hub, badges) => hub.tabs.reduce((s, t) => s + (t.badge ? badges[t.badge] || 0 : 0), 0);

function HubRow({ hub, active, onClose, n }) {
  return (
    <Link
      to={hub.path}
      onClick={onClose}
      aria-current={active ? "page" : undefined}
      title={hub.hint}
      className={`group relative flex items-center gap-3 py-[9px] pl-4 pr-3 text-[14px] transition-colors duration-200 ${
        active ? "bg-ink text-white" : "text-ink/75 hover:bg-ink/[0.05] hover:text-ink"
      }`}
    >
      {active && <span className="absolute bottom-0 left-0 top-0 w-[3px] bg-[#ff3c00]" />}
      <hub.icon className={`h-[17px] w-[17px] shrink-0 transition-colors ${active ? "text-[#ff3c00]" : "text-ink/45 group-hover:text-[#ff3c00]"}`} strokeWidth={1.75} />
      <span className="truncate font-semibold tracking-[-0.01em]">{hub.label}</span>
      <Badge n={n} active={active} />
    </Link>
  );
}

function SubItem({ item, active, onClose, badges = {}, pinned, onPin }) {
  const n = item.badge ? badges[item.badge] : 0;
  return (
    <div className="group relative">
      <Link
        to={item.path}
        onClick={onClose}
        aria-current={active ? "page" : undefined}
        className={`relative flex items-center gap-2.5 py-[6px] pl-11 pr-8 text-[12.5px] transition-colors ${
          active ? "font-medium text-ink" : "text-ink/60 hover:bg-ink/[0.04] hover:text-ink"
        }`}
      >
        <span className={`absolute left-[26px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ${active ? "bg-[#ff3c00]" : "bg-ink/15 group-hover:bg-ink/35"}`} />
        <span className="truncate">{item.label}</span>
        {n ? <Badge n={n} /> : item.arch ? <span className="ml-auto shrink-0 font-mono text-[8.5px] tracking-[0.08em] text-ink/30">{item.arch}</span> : null}
      </Link>
      {onPin && (
        <button
          type="button"
          onClick={() => onPin(item.key)}
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus:opacity-100 ${pinned ? "text-[#ff3c00]" : "text-ink/30 hover:text-ink"}`}
          aria-label={pinned ? `Unpin ${item.label}` : `Pin ${item.label} to the top`}
          title={pinned ? "Unpin" : "Pin to the top"}
        >
          {pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
        </button>
      )}
    </div>
  );
}

function PinnedItem({ item, active, onClose, onPin }) {
  return (
    <div className="group relative">
      <Link to={item.path} onClick={onClose} className={`flex items-center gap-3 py-[6px] pl-4 pr-8 text-[12.5px] ${active ? "font-medium text-ink" : "text-ink/65 hover:bg-ink/[0.04] hover:text-ink"}`}>
        <item.icon className={`h-[14px] w-[14px] shrink-0 ${active ? "text-[#ff3c00]" : "text-ink/40"}`} strokeWidth={1.75} />
        <span className="truncate">{item.label}</span>
        <span className="ml-auto shrink-0 font-mono text-[8.5px] uppercase tracking-[0.08em] text-ink/30">{item.group}</span>
      </Link>
      <button type="button" onClick={() => onPin(item.key)} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-[#ff3c00] transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus:opacity-100" aria-label={`Unpin ${item.label}`} title="Unpin">
        <PinOff className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function Sidebar({ onOpenCommand, open, onClose, pinned = false, onTogglePin }) {
  const { user } = useAuth();
  const location = useLocation();
  const email = user?.email || "";
  const initial = (user?.full_name || email || "?").trim().charAt(0).toUpperCase();
  const badges = useNavBadges();
  const [pins, setPins] = usePins();
  const here = hubFor(location);
  const current = activeKey(location);
  const pinnedItems = useMemo(() => (pins || []).map((k) => ALL_NAV.find((i) => i.key === k)).filter(Boolean), [pins]);
  const togglePin = (key) => setPins((p) => ((p || []).includes(key) ? p.filter((k) => k !== key) : [...(p || []), key]));

  const inMore = !!here && !HUBS.some((h) => h.id === here.hub.id);
  const [moreOpen, setMoreOpen] = useState(inMore);
  useEffect(() => { if (inMore) setMoreOpen(true); }, [inMore]);
  const renderHub = (hub) => {
    const active = here?.hub.id === hub.id;
    return (
      <div key={hub.id} data-nav-section={hub.id}>
        <HubRow hub={hub} active={active} onClose={onClose} n={hubCount(hub, badges)} />
        {active && (
          <div className="space-y-px py-1">
            {hub.tabs.map((t) => (
              <SubItem key={t.key} item={t} active={here.tab.key === t.key} onClose={onClose} badges={badges} pinned={(pins || []).includes(t.key)} onPin={togglePin} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[264px] max-w-[86vw] flex-col border-r border-hair bg-canvas transition-transform duration-300 ${
        open ? "translate-x-0" : "-translate-x-full"
      } ${pinned ? "md:static md:w-[236px] md:min-w-[236px] md:translate-x-0" : ""}`}
      data-sidebar
    >
      {/* Brand */}
      <div className="flex h-[60px] items-center justify-between border-b border-hair px-4">
        <Link to="/" onClick={onClose} className="flex min-w-0 items-center" aria-label="Møthership by Interstellar — home">
          <BrandLockup word="MØTHERSHIP" sub="by Interstellar" size={20} />
        </Link>
        <div className="flex items-center">
          {onTogglePin && (
            <button onClick={onTogglePin} className="hidden p-1.5 text-ink/45 hover:text-ink md:block" aria-label={pinned ? "Unpin the sidebar (use it as a drawer)" : "Pin the sidebar open"} title={pinned ? "Unpin: use as a drawer" : "Pin open on desktop"}>
              {pinned ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
          )}
          <button onClick={onClose} className={`p-1.5 text-ink/50 hover:text-ink ${pinned ? "md:hidden" : ""}`} aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quick navigate */}
      <div className="flex gap-1.5 border-b border-hair p-3">
        <button
          onClick={onOpenCommand}
          className="flex min-w-0 flex-1 items-center gap-2.5 border border-hair bg-paper px-3 py-2 text-xs text-ink/50 transition-colors hover:border-ink/40 hover:text-ink"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="truncate">Jump to page or client</span>
          <kbd className="ml-auto font-mono text-[10px] text-ink/40">⌘K</kbd>
        </button>
        <button type="button" onClick={() => { if (onClose) onClose(); openNavGuide(); }} aria-label="Where is everything? Page guide" title="Where is everything?"
          className="grid w-9 shrink-0 place-items-center border border-hair bg-paper text-ink/50 transition-colors hover:border-ink/40 hover:text-ink"><HelpCircle className="h-3.5 w-3.5" /></button>
      </div>

      <nav className="flex-1 overflow-y-auto overscroll-contain pb-3" aria-label="Møthership">
        {pinnedItems.length > 0 && (
          <div className="border-b border-hair py-2" data-pinned>
            <p className="flex items-center gap-1.5 px-4 pb-1 pt-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink/45"><Pin className="h-2.5 w-2.5" />Pinned</p>
            {pinnedItems.map((item) => <PinnedItem key={`pin:${item.key}`} item={item} active={item.key === current} onClose={onClose} onPin={togglePin} />)}
          </div>
        )}
        <div className="space-y-px pt-2" data-nav-primary>{HUBS.map(renderHub)}</div>
        {/* More: every deeper page, grouped. Opens by itself when you are on one of its pages. */}
        <details className="group mt-2 border-t border-hair pt-1" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)} data-nav-more>
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink/45 hover:text-ink">
            <span>More</span><span className="text-ink/35 group-open:hidden">Work · Marketing · Sales · Money · Agents · Tools</span>
          </summary>
          <div className="space-y-px">{[...MORE_HUBS, MORE_HUB].map(renderHub)}</div>
        </details>
      </nav>

      <div className="border-t border-hair">
        <Link
          to={SETTINGS_ITEM.path}
          onClick={onClose}
          className={`flex items-center gap-3 py-[9px] pl-4 pr-3 text-[13.5px] transition-colors ${current === SETTINGS_ITEM.key && !here ? "bg-ink text-white" : "text-ink/70 hover:bg-ink/[0.05] hover:text-ink"}`}
        >
          <SETTINGS_ITEM.icon className="h-[16px] w-[16px] shrink-0 text-ink/45" strokeWidth={1.75} />
          <span className="font-medium">Settings</span>
        </Link>
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
