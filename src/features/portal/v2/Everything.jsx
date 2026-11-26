// Portal v2: the "Everything" grid (home screen) and the Everything sheet (header button on desktop, hamburger on
// phones). Same tiles everywhere, from portalMap.js. Big tap targets, plain words, one tap to anywhere.
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Lock, X, LogOut, ArrowLeft, CalendarDays, ArrowUpRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import BrandLockup from "@/components/brand/BrandLockup";
import { BusinessPills } from "@/features/portal/BusinessSwitcher";

const SMPL_GRAD = "linear-gradient(135deg, #35BAEC 0%, #CF41C1 55%, #FF9810 100%)";

function Tile({ i, cur, onPick, unread, dense }) {
  const Icon = i.icon;
  const badge = i.k === "messages" ? unread : i.k === "brain" ? i.badge : 0;
  return (
    <button
      type="button"
      data-tile={i.k}
      aria-current={cur ? "page" : undefined}
      onClick={() => onPick(i.k)}
      className={`group/tile relative flex w-full items-center gap-3 rounded-md border text-left transition-[border-color,background-color,transform] duration-200 motion-safe:hover:-translate-y-px ${dense ? "min-h-[60px] px-3 py-2.5" : "min-h-[72px] px-3.5 py-3"} ${cur ? "border-[#ff3c00] bg-white" : "border-hair bg-card hover:border-[#ff3c00]/50 hover:bg-white"}`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors ${i.cobrand ? "text-white" : cur || i.bonus ? "flame-bg text-white" : "bg-ink/[0.06] text-ink/70 group-hover/tile:bg-ink group-hover/tile:text-white"}`}
        style={i.cobrand ? { background: SMPL_GRAD } : undefined}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 text-[14.5px] font-semibold leading-tight tracking-[-0.015em]">
          {i.label}
          {i.bonus && <span className="mono-label bg-[#ff3c00]/10 px-1 py-[1px] text-[8px] text-[#ff3c00]">Free</span>}
          {i.locked && <span className="mono-label inline-flex items-center gap-0.5 bg-ink/[0.07] px-1 py-[1px] text-[8px] text-ink/55"><Lock className="h-2 w-2" aria-hidden="true" />{i.locked}</span>}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-ink/55">{i.desc}</span>
      </span>
      {badge > 0 && <span className="flex h-5 min-w-5 items-center justify-center bg-[#ff3c00] px-1.5 font-mono text-[10.5px] text-white" aria-label={`${badge} new`}>{badge}</span>}
    </button>
  );
}

export function EverythingGrid({ groups, tab, onPick, unread = 0, dense = false }) {
  return (
    <div className="space-y-6" data-everything>
      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`grp-${g.id}`}>
          <div className="mb-2.5 flex items-baseline gap-2">
            <h3 id={`grp-${g.id}`} className="mono-label text-[10px] text-ink/60">{g.label}</h3>
            <span className="truncate text-[11.5px] text-ink/40">· {g.hint}</span>
          </div>
          <div className={`grid gap-2 ${dense ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
            {g.items.map((i) => <Tile key={i.k} i={i} cur={tab === i.k} onPick={onPick} unread={unread} dense={dense} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

export function EverythingSheet({ open, onClose, groups, tab, onPick, unread, client, preview, businesses = [], onSwitch, onSchedule }) {
  const panel = useRef(null);
  const lastFocus = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    lastFocus.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => (panel.current?.querySelector("[aria-current='page']") || panel.current?.querySelector("button"))?.focus(), 30);
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab") return;
      const f = [...(panel.current?.querySelectorAll("button:not([disabled]), a[href]") || [])].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); lastFocus.current?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  const pick = (k) => { onClose(); onPick(k); window.scrollTo({ top: 0 }); };
  return createPortal(
    <div className="fixed inset-0 z-[55]" data-everything-sheet>
      <div className="absolute inset-0 bg-ink/50 motion-safe:animate-[pv2Fade_.18s_ease-out]" onClick={onClose} />
      <div
        ref={panel} role="dialog" aria-modal="true" aria-label="Everything in your portal"
        className="absolute inset-y-0 right-0 flex w-full max-w-[760px] flex-col border-l border-hair bg-canvas shadow-2xl motion-safe:animate-[pv2Slide_.28s_cubic-bezier(.22,1,.36,1)]"
      >
        <div className="h-[3px] shrink-0 bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" aria-hidden="true" />
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-hair px-4 pb-4 pt-4 sm:px-6">
          <div className="min-w-0">
            <BrandLockup word="INTERSTELLAR" sub="Workspace" size={17} />
            <p className="mt-3 truncate text-[17px] font-semibold tracking-[-0.02em]">{client?.business || "Your business"}</p>
          </div>
          <button type="button" onClick={onClose} className="-mr-2 flex h-11 w-11 items-center justify-center text-ink/60 hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {businesses.length > 1 && onSwitch && <div className="shrink-0 border-b border-hair"><BusinessPills businesses={businesses} currentId={client?.id} onSwitch={(id) => { onClose(); onSwitch(id); }} /></div>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          <button type="button" onClick={() => pick("home")} aria-current={tab === "home" ? "page" : undefined} className={`mb-5 flex min-h-[52px] w-full items-center justify-between rounded-md border px-4 text-[15px] font-semibold ${tab === "home" ? "border-[#ff3c00] bg-white" : "border-hair bg-card hover:border-ink/30"}`}>
            Home <ArrowUpRight className="h-4 w-4 text-ink/40" />
          </button>
          <EverythingGrid groups={groups} tab={tab} onPick={pick} unread={unread} dense />
        </div>
        <div className="grid shrink-0 gap-2 border-t border-hair px-4 py-3 sm:grid-cols-2 sm:px-6">
          <button type="button" onClick={() => { onClose(); onSchedule(); }} className="flame-bg flex h-12 items-center justify-center gap-2 text-[14px] font-semibold text-white">
            <CalendarDays className="h-4 w-4" /> Schedule a call
          </button>
          {preview ? (
            <a href={client ? `/clients/${client.id}` : "/"} className="flex h-12 items-center justify-center gap-2 border border-hair bg-card text-[14px] font-medium"><ArrowLeft className="h-4 w-4" /> Back to Møthership</a>
          ) : (
            <button type="button" onClick={() => base44.auth.logout()} className="flex h-12 items-center justify-center gap-2 border border-hair bg-card text-[14px] font-medium hover:border-[#ff3c00] hover:text-[#ff3c00]"><LogOut className="h-4 w-4" /> Sign out</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Motion used by the v2 portal (kept here so the feature owns its keyframes). Reduced motion: no animation at all.
export function PortalV2Motion() {
  return (
    <style>{`
@keyframes pv2Fade{from{opacity:0}to{opacity:1}}
@keyframes pv2Slide{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}
@keyframes pv2Rise{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}
@keyframes pv2Pulse{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:1;transform:scale(1.25)}}
@keyframes pv2Sweep{from{background-position:0% 50%}to{background-position:200% 50%}}
.pv2-rise>*{animation:pv2Rise .55s cubic-bezier(.22,1,.36,1) both}
.pv2-rise>*:nth-child(2){animation-delay:60ms}.pv2-rise>*:nth-child(3){animation-delay:120ms}.pv2-rise>*:nth-child(4){animation-delay:180ms}.pv2-rise>*:nth-child(5){animation-delay:240ms}.pv2-rise>*:nth-child(6){animation-delay:300ms}
.pv2-live{animation:pv2Pulse 2.2s ease-in-out infinite}
.pv2-sweep{background:linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00,#ff6a00,#ff3c00);background-size:200% 100%;animation:pv2Sweep 6s linear infinite}
.pv2-grain{position:relative;isolation:isolate}
.pv2-grain::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:-1;opacity:.5;mix-blend-mode:screen;background-image:radial-gradient(rgba(255,106,0,.22) 1px,transparent 1.2px);background-size:3px 3px}
@media (prefers-reduced-motion: reduce){.pv2-rise>*,.pv2-live,.pv2-sweep{animation:none!important}}
`}</style>
  );
}
