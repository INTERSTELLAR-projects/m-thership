import { Check, CircleDashed } from "lucide-react";

// Small building blocks shared by the Social connections panel sections.

export function Toggle({ on, onChange, disabled, label, sub }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!on)} className="flex w-full items-start gap-3 py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-45">
      <span className={`mt-0.5 flex h-5 w-9 shrink-0 items-center border p-0.5 transition-colors ${on ? "border-[#ff3c00] bg-[#ff3c00]" : "border-ink/25 bg-paper"}`}>
        <span className={`h-3.5 w-3.5 transition-transform ${on ? "translate-x-4 bg-white" : "bg-ink/35"}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{label}</span>
        {sub && <span className="block text-[11.5px] leading-snug text-ink/50">{sub}</span>}
      </span>
    </button>
  );
}

export function Card({ label, title, right, children }) {
  return (
    <section className="border border-hair bg-card">
      <header className="flex items-center justify-between gap-2 border-b border-hair px-4 py-2.5">
        <div>
          <p className="mono-label text-[8.5px] text-ink/45">{label}</p>
          <h3 className="text-[14px] font-semibold tracking-[-0.02em]">{title}</h3>
        </div>
        {right}
      </header>
      <div className="space-y-3 px-4 py-3.5">{children}</div>
    </section>
  );
}

export const Pill = ({ ok, children }) => (
  <span className={`mono-label inline-flex items-center gap-1 border px-1.5 py-0.5 text-[8.5px] ${ok ? "border-ink bg-ink text-white" : "border-hair text-ink/50"}`}>
    {ok ? <Check className="h-2.5 w-2.5" /> : <CircleDashed className="h-2.5 w-2.5" />}{children}
  </span>
);
