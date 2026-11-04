import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Home, LineChart, MapPin, Target, Compass, ClipboardList, MessageSquare, FolderOpen, Palette, BookOpen,
  PenLine, QrCode, Crown, CalendarDays, ChevronDown, Menu, X, LogOut, ArrowLeft, UserRound, Check, Video, Loader2, ArrowUpRight,
  Megaphone, Mail, BadgeDollarSign, Calculator, UserPlus, Presentation, Lock, Sparkles,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import BrandLockup from "@/components/brand/BrandLockup";
import FuelMeter from "@/features/fuel/FuelMeter";

// ---------------------------------------------------------------------------------------------
// Grouped portal navigation. ONE config (NAV) drives the desktop dropdowns and the mobile drawer.
// Items whose tab isn't switched on for this client (Brand kit, Playbook) drop out on their own;
// a group with nothing left disappears. The Nøva assistant isn't in the nav: the floating
// "Ask Nøva" button is its one entry point. Account lives in the header's right cluster.
// ---------------------------------------------------------------------------------------------
export const NAV = [
  { id: "home", label: "Home", icon: Home, tab: "home" },
  {
    id: "growth", label: "Growth", eyebrow: "How you're growing",
    items: [
      { k: "results", label: "Results", desc: "Traffic, calls and how people find you", icon: LineChart },
      { k: "gbp", label: "Google Business", desc: "Your profile, reviews and review link", icon: MapPin },
      { k: "goals", label: "Goals", desc: "Targets, the plan and the cracks we're fixing", icon: Target },
      { k: "playbook", label: "Playbook", desc: "Your industry growth playbook", icon: Compass },
    ],
  },
  {
    id: "work", label: "Work", eyebrow: "Working together",
    items: [
      { k: "requests", label: "Requests", desc: "Ask for edits, content, designs and fixes", icon: ClipboardList },
      { k: "messages", label: "Messages", desc: "Chat with the Interstellar team", icon: MessageSquare },
      { k: "files", label: "Files", desc: "Finished deliverables we've handed over", icon: FolderOpen },
    ],
  },
  {
    id: "brand", label: "Brand", eyebrow: "Brand & tools", align: "right",
    items: [
      { k: "brand", label: "Brand kit", desc: "Logo rules, colors, fonts and voice", icon: Palette },
      { k: "resources", label: "Resources", desc: "Guides and how-tos for your business", icon: BookOpen },
      { k: "signatures", label: "Signatures", desc: "Animated, on-brand email signatures", icon: PenLine, bonus: true },
      { k: "qr", label: "QR Codes", desc: "Branded, trackable codes you can re-point", icon: QrCode, bonus: true },
    ],
  },
  {
    // Studios: HyperCare+ only (other plans see every item locked, tagged "HyperCare+"). Within HyperCare+, per-client
    // state off (hidden) / preview (locked, default) / on. PortalApp passes which tabs exist and which are locked;
    // locked items open the preview page (PortalStudios.jsx). The panel shows the client's fuel gauge on top.
    id: "studios", label: "Studios", eyebrow: "Included with HyperCare+", align: "right",
    items: [
      { k: "studio_social", label: "Social Studio", desc: "Plan, design and publish your posts", icon: Megaphone },
      { k: "studio_email", label: "Email Studio", desc: "Newsletters and promos to your list", icon: Mail },
      { k: "studio_ads", label: "Ads Studio", desc: "An ads agent that watches your spend", icon: BadgeDollarSign },
      { k: "studio_accounting", label: "Accounting & Taxes", desc: "Books, receipts and quarterly taxes", icon: Calculator },
      { k: "studio_hiring", label: "Hiring plan", desc: "When to hire, and who", icon: UserPlus },
      { k: "studio_presentations", label: "Presentations", desc: "On-brand decks and proposals", icon: Presentation },
      { k: "studio_simple_social", label: "Simple Social", desc: "AI generation: image, video, voice clipping and more", icon: Sparkles },
    ],
  },
  { id: "referrals", label: "Referrals", icon: Crown, tab: "referrals" },
];

// Labels for tabs reached outside the nav (shown on the mobile menu button).
const EXTRA_LABELS = { assistant: "Nøva", account: "Account" };

export function navFor(tabKeys, locked = new Set(), lockText = "Soon") {
  const has = new Set(tabKeys);
  return NAV.map((g) => (g.items ? { ...g, items: g.items.filter((i) => has.has(i.k)).map((i) => (locked.has(i.k) ? { ...i, locked: i.k === "studio_simple_social" ? "Soon" : lockText } : i)) } : g))
    .filter((g) => (g.items ? g.items.length > 0 : has.has(g.tab)));
}

export function labelFor(nav, tab) {
  for (const g of nav) {
    if (g.tab === tab) return g.label;
    const i = g.items?.find((x) => x.k === tab);
    if (i) return i.label;
  }
  return EXTRA_LABELS[tab] || "";
}

const groupUnread = (g, unread) => (g.items?.some((i) => i.k === "messages") ? unread : 0);

function Bonus() {
  return <span className="mono-label inline-flex items-center bg-[#ff3c00]/10 px-1 py-[1px] text-[8px] leading-[1.4] text-[#ff3c00]">Bonus</span>;
}
function Locked({ text = "Soon" }) {
  return <span className="mono-label inline-flex items-center gap-0.5 bg-ink/[0.07] px-1 py-[1px] text-[8px] leading-[1.4] text-ink/55"><Lock className="h-2 w-2" aria-hidden="true" />{typeof text === "string" ? text : "Soon"}</span>;
}
function Count({ n, label = "unread" }) {
  if (!n) return null;
  return <span className="inline-flex h-4 min-w-4 items-center justify-center bg-[#ff3c00] px-1 font-mono text-[10px] leading-none text-white" aria-label={`${n} ${label}`}>{n}</span>;
}

// ---------------------------------------------------------------------------------------------
// Desktop: top-level links + dropdown panels (disclosure pattern). Hover, click and keyboard:
// Enter / Space / ↓ opens and focuses the first item, ↑ the last; ↑ ↓ Home End move inside;
// ← → move between top-level items; Escape closes and returns focus; Tab out closes.
// ---------------------------------------------------------------------------------------------
export function DesktopNav({ nav, tab, setTab, unread, fuel, onRefuel }) {
  const [open, setOpen] = useState(null);
  const openedBy = useRef(null);
  const timer = useRef(null);
  const rootRef = useRef(null);
  const triggers = useRef({});

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(null); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const tops = () => [...(rootRef.current?.querySelectorAll("[data-top]") || [])];
  const itemsOf = (id) => [...(rootRef.current?.querySelectorAll(`[data-panel="${id}"] [data-item]`) || [])];
  const focusItem = (id, which) => requestAnimationFrame(() => {
    const list = itemsOf(id);
    (which === "last" ? list[list.length - 1] : list[0])?.focus();
  });
  const moveTop = (e) => {
    const list = tops();
    const i = list.indexOf(e.currentTarget.closest("[data-topwrap]")?.querySelector("[data-top]") || e.currentTarget);
    if (i < 0) return;
    e.preventDefault();
    setOpen(null);
    list[(i + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length]?.focus();
  };
  const go = (k) => { setOpen(null); setTab(k); window.scrollTo({ top: 0 }); };

  const onTriggerKey = (e, g) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") { e.preventDefault(); openedBy.current = "key"; setOpen(g.id); focusItem(g.id, "first"); }
    else if (e.key === "ArrowUp") { e.preventDefault(); openedBy.current = "key"; setOpen(g.id); focusItem(g.id, "last"); }
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") moveTop(e);
    else if (e.key === "Escape" && open) { e.preventDefault(); setOpen(null); }
  };
  const onPanelKey = (e, g) => {
    const list = itemsOf(g.id);
    const i = list.indexOf(document.activeElement);
    const to = (n) => { e.preventDefault(); list[(n + list.length) % list.length]?.focus(); };
    if (e.key === "ArrowDown") to(i + 1);
    else if (e.key === "ArrowUp") to(i - 1);
    else if (e.key === "Home") to(0);
    else if (e.key === "End") to(list.length - 1);
    else if (e.key === "Escape") { e.preventDefault(); setOpen(null); triggers.current[g.id]?.focus(); }
    else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && triggers.current[g.id]) moveTop({ key: e.key, currentTarget: triggers.current[g.id], preventDefault: () => e.preventDefault() });
  };

  return (
    <nav ref={rootRef} aria-label="Portal sections" data-portal-nav className="flex items-center gap-0.5">
      <NavMotion />
      {nav.map((g) => {
        if (!g.items) {
          const active = tab === g.tab;
          return (
            <div key={g.id} data-topwrap className="relative">
              <button
                type="button" data-top data-tab={g.tab}
                aria-current={active ? "page" : undefined}
                onClick={() => go(g.tab)}
                onKeyDown={(e) => (e.key === "ArrowRight" || e.key === "ArrowLeft") && moveTop(e)}
                onMouseEnter={() => { clearTimeout(timer.current); setOpen(null); }}
                className={`relative flex h-9 items-center px-3 text-[13.5px] font-medium tracking-[-0.01em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3c00]/50 ${active ? "text-ink" : "text-ink/55 hover:text-ink"}`}
              >
                {g.label}
                {active && <span className="absolute inset-x-3 -bottom-[12px] h-[2px] bg-[#ff3c00]" aria-hidden="true" />}
              </button>
            </div>
          );
        }
        const isOpen = open === g.id;
        const active = g.items.some((i) => i.k === tab);
        const badge = groupUnread(g, unread);
        const activeItem = g.items.find((i) => i.k === tab);
        return (
          <div
            key={g.id} data-topwrap className="relative"
            onMouseEnter={() => { clearTimeout(timer.current); if (open !== g.id) openedBy.current = "hover"; setOpen(g.id); }}
            onMouseLeave={() => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen((o) => (o === g.id ? null : o)), 160); }}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen((o) => (o === g.id ? null : o)); }}
          >
            <button
              ref={(el) => { triggers.current[g.id] = el; }}
              type="button" data-top data-group={g.id}
              aria-expanded={isOpen}
              aria-controls={`portal-menu-${g.id}`}
              aria-label={`${g.label}${activeItem ? `, current page ${activeItem.label}` : ""}${badge ? `, ${badge} unread` : ""}`}
              onClick={() => {
                if (isOpen && openedBy.current === "hover") { openedBy.current = "click"; return; }
                openedBy.current = "click";
                setOpen(isOpen ? null : g.id);
              }}
              onKeyDown={(e) => onTriggerKey(e, g)}
              className={`relative flex h-9 items-center gap-1.5 px-3 text-[13.5px] font-medium tracking-[-0.01em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3c00]/50 ${active || isOpen ? "text-ink" : "text-ink/55 hover:text-ink"}`}
            >
              {g.label}
              {badge > 0 && <Count n={badge} />}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""} ${active ? "text-[#ff3c00]" : "text-current opacity-60"}`} aria-hidden="true" />
              {active && <span className="absolute inset-x-3 -bottom-[12px] h-[2px] bg-[#ff3c00]" aria-hidden="true" />}
            </button>

            {/* pt-3 is a hover bridge so the pointer can travel from the trigger into the panel. */}
            <div
              id={`portal-menu-${g.id}`}
              data-panel={g.id}
              hidden={!isOpen}
              onKeyDown={(e) => onPanelKey(e, g)}
              className={`absolute top-full z-40 pt-[11px] ${g.align === "right" ? "right-0" : "left-0"}`}
            >
              <div className="w-[min(372px,calc(100vw-32px))] overflow-hidden border border-hair bg-[#f7f5f2] shadow-[0_24px_48px_-20px_rgba(26,26,26,.35)] motion-safe:animate-[portalMenuIn_.16s_ease-out]">
                <div className="h-[3px] bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" aria-hidden="true" />
                {g.id === "studios" && fuel && <FuelMeter fuel={fuel} compact onRefuel={onRefuel ? () => { setOpen(null); onRefuel(); } : undefined} />}
                <p className="mono-label px-4 pb-1.5 pt-3.5 text-[9.5px] text-ink/45">({g.eyebrow})</p>
                <ul className="px-1.5 pb-1.5">
                  {g.items.map((i) => {
                    const Icon = i.icon;
                    const cur = tab === i.k;
                    return (
                      <li key={i.k}>
                        <button
                          type="button" data-item data-tab={i.k}
                          aria-current={cur ? "page" : undefined}
                          onClick={() => go(i.k)}
                          className={`group/item flex w-full items-start gap-3 px-2.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ff3c00]/50 ${cur ? "bg-white" : "hover:bg-white focus-visible:bg-white"}`}
                        >
                          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center transition-colors ${cur || i.bonus ? "flame-bg text-white" : "bg-ink/[0.06] text-ink/70 group-hover/item:bg-ink group-hover/item:text-white"}`}>
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-[13.5px] font-semibold tracking-[-0.01em] text-ink">
                              {i.label}
                              {i.bonus && <Bonus />}
                              {i.locked && <Locked text={i.locked} />}
                              {i.k === "messages" && <Count n={unread} />}
                              {cur && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#ff3c00]" aria-hidden="true" />}
                            </span>
                            <span className="mt-0.5 block text-[12px] leading-snug text-ink/55">{i.desc}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------------------------
// Phones and tablets (< 1024px): a hamburger opens a full-height slide-in menu with the same groups
// as collapsible sections. Focus is trapped while open; Escape / backdrop / picking a page closes it.
// ---------------------------------------------------------------------------------------------
export function MobileNav({ nav, client, tab, setTab, unread, preview, onSchedule, fuel, onRefuel }) {
  const [open, setOpen] = useState(false);
  const activeGroup = nav.find((g) => g.items?.some((i) => i.k === tab))?.id;
  const [expanded, setExpanded] = useState(() => new Set(activeGroup ? [activeGroup] : ["growth"]));
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const wasOpen = useRef(false);

  useEffect(() => { if (open && activeGroup) setExpanded((s) => (s.has(activeGroup) ? s : new Set([...s, activeGroup]))); }, [open, activeGroup]);

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) btnRef.current?.focus();
      wasOpen.current = false;
      return undefined;
    }
    wasOpen.current = true;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => [...(panelRef.current?.querySelectorAll("button:not([disabled]), a[href]") || [])].filter((el) => el.offsetParent !== null);
    const t = setTimeout(() => (panelRef.current?.querySelector("[aria-current='page']") || focusables()[0])?.focus(), 30);
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!panelRef.current?.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const onResize = () => { if (window.innerWidth >= 1024) setOpen(false); };
    window.addEventListener("resize", onResize);
    return () => { clearTimeout(t); document.body.style.overflow = prevOverflow; document.removeEventListener("keydown", onKey); window.removeEventListener("resize", onResize); };
  }, [open]);

  const pick = (k) => { setTab(k); setOpen(false); window.scrollTo({ top: 0 }); };
  const toggle = (id) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const current = labelFor(nav, tab);

  const Row = ({ k, label, icon: Icon, desc, bonus, locked, indent }) => {
    const cur = tab === k;
    return (
      <button
        type="button" data-tab={k}
        aria-current={cur ? "page" : undefined}
        onClick={() => pick(k)}
        className={`relative flex w-full items-center gap-3 py-2.5 text-left transition-colors ${indent ? "pl-7 pr-5" : "px-5"} ${cur ? "bg-white text-ink" : "text-ink/75 hover:bg-white/60 hover:text-ink"}`}
      >
        {cur && <span className="absolute inset-y-2 left-0 w-[3px] bg-[#ff3c00]" aria-hidden="true" />}
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center ${cur || bonus ? "flame-bg text-white" : "bg-ink/[0.06] text-ink/70"}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[14.5px] font-medium tracking-[-0.01em]">{label}{bonus && <Bonus />}{locked && <Locked text={locked} />}{k === "messages" && <Count n={unread} />}</span>
          {desc && <span className="block truncate text-[11.5px] text-ink/50">{desc}</span>}
        </span>
      </button>
    );
  };

  return (
    <div className="flex items-center lg:hidden">
      <button
        ref={btnRef}
        type="button"
        data-portal-menu-button
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="portal-menu"
        aria-label={`Open menu${current ? `, current page ${current}` : ""}`}
        className="relative flex h-10 items-center gap-2 border border-hair bg-card px-3 text-[13px] font-medium text-ink hover:border-ink/30"
      >
        <span className="max-w-[88px] truncate sm:max-w-[160px]">{current || "Menu"}</span>
        <Menu className="h-4 w-4" aria-hidden="true" />
        {unread > 0 && tab !== "messages" && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#ff3c00]" aria-hidden="true" />}
      </button>

      {/* Portaled to <body>: the sticky header's backdrop-blur would otherwise trap this fixed layer inside the header. */}
      {createPortal(
        <div className={`fixed inset-0 z-50 lg:hidden ${open ? "visible" : "invisible"}`} aria-hidden={!open}>
          <div onClick={() => setOpen(false)} className={`absolute inset-0 bg-ink/45 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`} />
          <div
            ref={panelRef}
            id="portal-menu"
            data-portal-drawer
            role="dialog"
            aria-modal="true"
            aria-label="Portal menu"
            className={`absolute inset-y-0 right-0 flex h-full w-[min(380px,90vw)] flex-col border-l border-hair bg-canvas shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? "translate-x-0" : "translate-x-full"}`}
          >
            <div className="h-[3px] shrink-0 bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" aria-hidden="true" />
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-hair px-5 pb-4 pt-5">
              <div className="min-w-0">
                <BrandLockup word="MØTHERSHIP" sub="by Interstellar" size={18} />
                <p className="mono-label mt-4 text-[9.5px] text-ink/45">Client portal</p>
                <p className="truncate text-[16px] font-semibold tracking-[-0.02em]">{client?.business || "Your business"}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="-mr-2 -mt-1 flex h-10 w-10 items-center justify-center text-ink/55 hover:text-ink" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="shrink-0 border-b border-hair px-5 py-3">
              <button type="button" onClick={() => { setOpen(false); onSchedule(); }} className="flame-bg flex h-11 w-full items-center justify-center gap-2 text-[13.5px] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(255,60,0,.8)]">
                <CalendarDays className="h-4 w-4" aria-hidden="true" /> Schedule a call with Interstellar
              </button>
            </div>
            <nav aria-label="Portal sections" className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
              {nav.map((g) => {
                if (!g.items) return <Row key={g.id} k={g.tab} label={g.label} icon={g.icon} />;
                const isOpen = expanded.has(g.id);
                const badge = groupUnread(g, unread);
                const hasActive = g.items.some((i) => i.k === tab);
                return (
                  <section key={g.id} className="mt-1 border-t border-hair/70 first:mt-0">
                    <h2>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`portal-mgroup-${g.id}`}
                        onClick={() => toggle(g.id)}
                        className="flex w-full items-center gap-2 px-5 pb-2 pt-3.5 text-left"
                      >
                        <span className={`mono-label text-[10px] ${hasActive ? "text-[#ff3c00]" : "text-ink/50"}`}>{g.label}</span>
                        <span className="text-[11px] text-ink/40">· {g.eyebrow}</span>
                        {badge > 0 && !isOpen && <Count n={badge} />}
                        <ChevronDown className={`ml-auto h-4 w-4 text-ink/45 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                      </button>
                    </h2>
                    <ul id={`portal-mgroup-${g.id}`} hidden={!isOpen} className="pb-1">
                      {g.id === "studios" && fuel && <li className="px-3 pb-2"><FuelMeter fuel={fuel} compact onRefuel={onRefuel ? () => { setOpen(false); onRefuel(); } : undefined} /></li>}
                      {g.items.map((i) => <li key={i.k}><Row k={i.k} label={i.label} icon={i.icon} desc={i.desc} bonus={i.bonus} locked={i.locked} indent /></li>)}
                    </ul>
                  </section>
                );
              })}
            </nav>
            <div className="shrink-0 space-y-2 border-t border-hair px-5 py-4">
              <button type="button" data-tab="account" onClick={() => pick("account")} aria-current={tab === "account" ? "page" : undefined} className="flex h-10 w-full items-center justify-center gap-2 border border-hair bg-card text-[13px] font-medium hover:border-ink/30">
                <UserRound className="h-4 w-4" /> Account &amp; security
              </button>
              {preview ? (
                <a href={client ? `/clients/${client.id}` : "/"} className="flex h-10 items-center justify-center gap-2 border border-hair bg-card text-[13px] font-medium hover:border-ink/30">
                  <ArrowLeft className="h-4 w-4" /> Back to Møthership
                </a>
              ) : (
                <button type="button" onClick={() => base44.auth.logout()} className="flex h-10 w-full items-center justify-center gap-2 border border-hair bg-card text-[13px] font-medium hover:border-[#ff3c00] hover:text-[#ff3c00]">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// "Schedule a call" button (top right) + modal. Open times come from Justin's Google Calendar via
// the portal-booking function, which books a Google Meet for the signed-in client.
// ---------------------------------------------------------------------------------------------
export function ScheduleCallButton({ onClick }) {
  return (
    <button
      type="button"
      data-schedule-call
      onClick={onClick}
      aria-label="Schedule a call with Interstellar"
      className="flame-bg group flex h-10 shrink-0 items-center gap-2 px-3 text-[13px] font-semibold tracking-[-0.01em] text-white shadow-[0_8px_20px_-10px_rgba(255,60,0,.9)] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_12px_24px_-10px_rgba(255,60,0,.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas sm:px-4"
    >
      <CalendarDays className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">Schedule a call</span>
    </button>
  );
}

const PT = "America/Los_Angeles";
const viewerTz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return PT; } })();
const localTime = (at) => new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" });

export function ScheduleCallModal({ open, onClose, previewId, preview }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [day, setDay] = useState(null);
  const [slot, setSlot] = useState(null);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const panelRef = useRef(null);
  const lastFocus = useRef(null);

  const invoke = async (action, args = {}) => (await base44.functions.invoke("portal-booking", { action, client_id: previewId, ...args })).data;
  const load = async () => {
    setErr(""); setData(null);
    try {
      const r = await invoke("slots");
      setData(r);
      setDay((d) => (r.days.some((x) => x.date === d) ? d : r.days[0]?.date || null));
      setSlot(null);
    } catch (e) {
      setErr(e?.response?.data?.error || "We couldn't load open times. Try again in a moment.");
      setData({ days: [] });
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    lastFocus.current = document.activeElement;
    setDone(null); setTopic(""); setSlot(null);
    load();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => panelRef.current?.querySelector("[data-autofocus]")?.focus(), 30);
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab") return;
      const f = [...(panelRef.current?.querySelectorAll("button:not([disabled]), a[href], textarea, [tabindex='0']") || [])];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); lastFocus.current?.focus?.(); };
  }, [open]);

  if (!open) return null;
  const days = data?.days || [];
  const cur = days.find((d) => d.date === day);
  const minutes = data?.minutes || 30;
  const otherTz = viewerTz && viewerTz !== PT;

  const book = async () => {
    if (!cur || !slot || preview) return;
    setBusy(true); setErr("");
    try {
      const r = await invoke("book", { date: cur.date, time: slot.t, topic });
      setDone({ ...r, label: cur.label, slot });
    } catch (e) {
      const code = e?.response?.data?.code;
      setErr(e?.response?.data?.error || "Couldn't book that time. Try another or message us.");
      if (code === "slot_taken") load();
    } finally { setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" data-schedule-modal>
      <NavMotion />
      <div className="absolute inset-0 bg-ink/55 motion-safe:animate-[portalFade_.18s_ease-out]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog" aria-modal="true" aria-labelledby="sched-title"
        className="relative flex max-h-[92vh] w-full max-w-[660px] flex-col overflow-hidden border border-hair bg-canvas shadow-2xl motion-safe:animate-[portalMenuIn_.2s_ease-out]"
      >
        <div className="h-[3px] shrink-0 bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" aria-hidden="true" />
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-hair px-5 pb-4 pt-5 sm:px-6">
          <div className="min-w-0">
            <p className="mono-label text-[9.5px] text-[#ff3c00]">(Schedule a call)</p>
            <h2 id="sched-title" className="mt-1.5 text-[22px] font-semibold leading-tight tracking-[-0.035em] sm:text-[26px]">{done ? "You're booked." : "Book time with Interstellar"}</h2>
            {!done && <p className="mt-1 text-[13px] text-ink/60">A {minutes}-minute Google Meet with Interstellar. Pick a time and the invite lands in your inbox.</p>}
          </div>
          <button type="button" onClick={onClose} data-autofocus={done ? undefined : ""} className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center text-ink/55 hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="overflow-y-auto px-5 py-6 sm:px-6">
            <div className="flex items-start gap-4">
              <span className="flame-bg flex h-11 w-11 shrink-0 items-center justify-center text-white"><Check className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-[17px] font-semibold tracking-[-0.02em]">{done.label} · {done.time}</p>
                {otherTz && <p className="text-[12.5px] text-ink/55">{localTime(done.slot.at)} your time</p>}
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink/65">
                  {done.confirmed
                    ? <>A Google Calendar invite with the Meet link is on its way to <span className="font-medium text-ink">{done.email}</span>. It&apos;s also in your Requests history.</>
                    : <>We&apos;ve got your request. We&apos;ll confirm this time by email shortly. It&apos;s also in your Requests history.</>}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {done.meetLink && (
                    <a href={done.meetLink} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 bg-ink px-4 text-[13px] font-medium text-white hover:bg-[#ff3c00]">
                      <Video className="h-4 w-4" /> Google Meet link <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button type="button" data-autofocus onClick={onClose} className="h-10 border border-hair bg-card px-4 text-[13px] font-medium hover:border-ink/30">Done</button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {preview && (
                <p className="mb-4 border border-ink/15 bg-white/60 px-3 py-2 text-[12px] text-ink/65">Admin preview: you can see the open times, but booking only works from the client&apos;s own login.</p>
              )}
              {!data ? (
                <div className="flex items-center gap-2 py-10 text-[13px] text-ink/50"><Loader2 className="h-4 w-4 animate-spin" /> Checking the calendar…</div>
              ) : days.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[14px] font-medium">{err || "No open times in the next two weeks."}</p>
                  <p className="mt-1 text-[12.5px] text-ink/55">Send us a message and we&apos;ll find a time that works.</p>
                  {err && <button type="button" onClick={load} className="mt-3 text-[13px] font-medium text-[#ff3c00] hover:underline">Try again</button>}
                </div>
              ) : (
                <>
                  <p className="mono-label text-[9.5px] text-ink/50">1 · Pick a day</p>
                  <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6" role="group" aria-label="Days with open times">
                    {days.map((d) => {
                      const [wd, md] = d.label.split(", ");
                      const sel = d.date === day;
                      return (
                        <button
                          key={d.date} type="button" aria-pressed={sel}
                          onClick={() => { setDay(d.date); setSlot(null); setErr(""); }}
                          className={`flex w-[74px] shrink-0 flex-col items-center border px-2 py-2.5 transition-colors ${sel ? "border-ink bg-ink text-white" : "border-hair bg-card hover:border-ink/40"}`}
                        >
                          <span className={`mono-label text-[9px] ${sel ? "text-[#ffaa00]" : "text-ink/50"}`}>{wd}</span>
                          <span className="mt-1 text-[14px] font-semibold tracking-[-0.02em]">{md}</span>
                          <span className={`mt-0.5 text-[10.5px] ${sel ? "text-white/60" : "text-ink/45"}`}>{d.slots.length} open</span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="mono-label mt-5 text-[9.5px] text-ink/50">2 · Pick a time <span className="normal-case tracking-normal text-ink/40">(Pacific time{otherTz ? ", your time below" : ""})</span></p>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4" role="group" aria-label={`Open times on ${cur?.label || ""}`}>
                    {(cur?.slots || []).map((s) => {
                      const sel = slot?.t === s.t;
                      return (
                        <button
                          key={s.t} type="button" aria-pressed={sel}
                          onClick={() => { setSlot(s); setErr(""); }}
                          className={`flex flex-col items-center border px-2 py-2 text-[13px] font-medium tabular-nums transition-colors ${sel ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-hair bg-card hover:border-[#ff3c00] hover:text-[#ff3c00]"}`}
                        >
                          {s.t}
                          {otherTz && <span className={`text-[10px] font-normal ${sel ? "text-white/75" : "text-ink/45"}`}>{localTime(s.at)}</span>}
                        </button>
                      );
                    })}
                  </div>

                  <label htmlFor="sched-topic" className="mono-label mt-5 block text-[9.5px] text-ink/50">3 · What do you want to cover? <span className="normal-case tracking-normal text-ink/40">(optional)</span></label>
                  <textarea
                    id="sched-topic" rows={3} maxLength={1500} value={topic} onChange={(e) => setTopic(e.target.value)}
                    placeholder="New page ideas, a question about your results, next month's plan…"
                    className="mt-2 w-full resize-none border border-hair bg-card px-3 py-2.5 text-[13.5px] outline-none placeholder:text-ink/35 focus:border-ink/50"
                  />
                  {data.you && !preview && (
                    <p className="mt-2 text-[11.5px] text-ink/50">Booking as {[data.you.name, data.you.email, data.you.business].filter(Boolean).join(" · ")}</p>
                  )}
                  {data.fallback && <p className="mt-2 text-[11.5px] text-ink/50">We&apos;ll confirm the time by email.</p>}
                </>
              )}
            </div>
            {days.length > 0 && (
              <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-hair bg-[#f7f5f2] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p role={err ? "alert" : undefined} className={`text-[12px] ${err ? "text-red-700" : "text-ink/50"}`}>
                  {err || (slot && cur ? <>{cur.label} · {slot.t} PT · {minutes} min</> : "Pick a day and a time.")}
                </p>
                <button
                  type="button" onClick={book} disabled={!slot || busy || preview}
                  className="flame-bg flex h-11 items-center justify-center gap-2 px-5 text-[13.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                  {busy ? "Booking…" : "Confirm call"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

// Keyframes for the dropdown / modal entrance (kept here so the nav owns its own motion).
function NavMotion() {
  return <style>{"@keyframes portalMenuIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}@keyframes portalFade{from{opacity:0}to{opacity:1}}"}</style>;
}
