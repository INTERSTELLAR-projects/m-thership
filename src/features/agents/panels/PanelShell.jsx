import { useEffect, useRef, useSyncExternalStore } from "react";
import { X, ChevronsRight, ChevronsLeft } from "lucide-react";

// Panel geometry is shared with the map (so it can recenter into what is still visible). Width and the
// collapsed state are remembered per browser; nothing else is stored.
const KEY = "agx_panel_v2";
const MIN_W = 340, MAX_W = 720;
let state = (() => { try { return { width: 440, collapsed: false, ...JSON.parse(localStorage.getItem(KEY) || "{}"), open: false, wide: false }; } catch { return { width: 440, collapsed: false, open: false, wide: false }; } })();
const subs = new Set();
const emit = () => subs.forEach((f) => f());
export const panelStore = {
  get: () => state,
  set(patch) {
    state = { ...state, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify({ width: state.width, collapsed: state.collapsed })); } catch { /* ignore */ }
    emit();
  },
  subscribe(f) { subs.add(f); return () => subs.delete(f); },
};
export function usePanelState() {
  return useSyncExternalStore(panelStore.subscribe, panelStore.get, panelStore.get);
}
export const panelWidth = (s) => Math.max(MIN_W, Math.min(MAX_W, s.wide ? Math.max(s.width, 500) : s.width));

// Right-hand drawer on laptop / iPad (collapsible to a rail, drag the left edge to resize), bottom sheet on phones.
export default function PanelShell({ onClose, children, wide = false, label = "Details" }) {
  const s = usePanelState();
  const drag = useRef(null);
  useEffect(() => { panelStore.set({ open: true, wide }); return () => panelStore.set({ open: false }); }, [wide]);
  const w = panelWidth({ ...s, wide });

  const onDown = (e) => {
    e.preventDefault();
    drag.current = { x: e.clientX, w };
    const move = (ev) => { if (drag.current) panelStore.set({ width: Math.max(MIN_W, Math.min(MAX_W, drag.current.w + (drag.current.x - ev.clientX))) }); };
    const up = () => { drag.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const onKey = (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); panelStore.set({ width: Math.min(MAX_W, w + 24) }); }
    if (e.key === "ArrowRight") { e.preventDefault(); panelStore.set({ width: Math.max(MIN_W, w - 24) }); }
  };

  if (s.collapsed) {
    return (
      <aside aria-label={`${label} (collapsed)`} data-ui="" data-testid="panel-rail" className="panel-in glass absolute bottom-3 right-3 top-3 z-30 hidden w-11 flex-col items-center gap-2 rounded-2xl py-2 md:flex">
        <button type="button" onClick={() => panelStore.set({ collapsed: false })} aria-label={`Expand ${label}`} title="Expand panel" className="grid h-8 w-8 place-items-center rounded-lg text-[var(--ink-m)] hover:bg-white/5 hover:text-white"><ChevronsLeft className="h-4 w-4" /></button>
        <button type="button" onClick={onClose} aria-label="Close panel" className="grid h-8 w-8 place-items-center rounded-lg text-[var(--ink-m)] hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>
        <span className="mono mt-2 select-none text-[10px] uppercase tracking-[.16em] text-[var(--ink-s)] [writing-mode:vertical-rl]">{label}</span>
      </aside>
    );
  }
  return (
    <aside
      aria-label={label}
      data-ui=""
      data-testid="panel"
      className="panel-in glass scroll-d absolute z-30 flex flex-col overflow-y-auto shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)]
        inset-x-0 bottom-0 max-h-[62%] rounded-t-2xl
        md:inset-x-auto md:bottom-3 md:right-3 md:top-3 md:max-h-none md:w-[var(--pw)] md:rounded-2xl"
      style={{ "--pw": `${w}px` }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        aria-valuenow={w}
        aria-valuemin={MIN_W}
        aria-valuemax={MAX_W}
        tabIndex={0}
        onPointerDown={onDown}
        onKeyDown={onKey}
        className="absolute bottom-0 left-0 top-0 z-20 hidden w-2 cursor-col-resize md:block [&:hover>span]:opacity-100 focus-visible:outline-none [&:focus-visible>span]:opacity-100"
      ><span className="absolute left-0.5 top-1/2 h-12 w-[3px] -translate-y-1/2 rounded-full bg-[#ff6a00] opacity-0 transition-opacity" /></div>
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
        <button type="button" onClick={() => panelStore.set({ collapsed: true })} aria-label="Collapse panel" title="Collapse panel" className="hidden h-8 w-8 place-items-center rounded-lg text-[var(--ink-m)] transition hover:bg-white/5 hover:text-white md:grid"><ChevronsRight className="h-4 w-4" /></button>
        <button type="button" onClick={onClose} aria-label="Close panel" className="grid h-8 w-8 place-items-center rounded-lg text-[var(--ink-m)] transition hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      <span className="mx-auto mt-2 block h-1 w-10 rounded-full bg-white/15 md:hidden" />
      {children}
    </aside>
  );
}
