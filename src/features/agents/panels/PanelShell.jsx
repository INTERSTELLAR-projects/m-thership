import { X } from "lucide-react";

// Right-hand drawer on laptop / iPad, bottom sheet on phones. The map stays interactive beside it.
export default function PanelShell({ onClose, children, wide = false, label = "Details" }) {
  return (
    <aside
      aria-label={label}
      className={`panel-in glass scroll-d absolute z-30 flex flex-col overflow-y-auto shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)]
        inset-x-0 bottom-0 max-h-[78%] rounded-t-2xl
        md:inset-x-auto md:bottom-3 md:right-3 md:top-3 md:max-h-none md:rounded-2xl ${wide ? "md:w-[520px]" : "md:w-[440px]"}`}
    >
      <button type="button" onClick={onClose} aria-label="Close panel" className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-lg text-[var(--ink-m)] transition hover:bg-white/5 hover:text-white">
        <X className="h-4 w-4" />
      </button>
      <span className="mx-auto mt-2 block h-1 w-10 rounded-full bg-white/15 md:hidden" />
      {children}
    </aside>
  );
}
