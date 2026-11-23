// Small shared pieces for the Lead Engine screens, in the Møthership system (canvas, ink, hairline, flame).
import { Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export const btn = "inline-flex h-9 items-center gap-1.5 border border-hair bg-card px-3 text-[12.5px] font-medium text-ink/75 transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-40";
export const btnFlame = "inline-flex h-9 items-center gap-1.5 bg-[#ff3c00] px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-ink disabled:opacity-40";
export const btnInk = "inline-flex h-9 items-center gap-1.5 bg-ink px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-[#ff3c00] disabled:opacity-40";
export const input = "h-10 w-full min-w-0 border border-hair bg-paper px-3 text-[13px] outline-none placeholder:text-ink/35 focus:border-[#ff3c00]";
export const area = "w-full border border-hair bg-paper px-3 py-2 text-[13px] leading-relaxed outline-none placeholder:text-ink/35 focus:border-[#ff3c00]";

export function Card({ title, kicker, right, children, className = "", pad = true, testid }) {
  return (
    <section className={cn("border border-hair bg-paper/85", className)} data-testid={testid}>
      {title || kicker || right ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hair px-4 py-2.5">
          <div className="min-w-0">
            {kicker ? <p className="mono-label text-[9.5px] text-ink/45">{kicker}</p> : null}
            {title ? <h3 className="truncate text-[14px] font-semibold tracking-[-0.01em]">{title}</h3> : null}
          </div>
          {right}
        </header>
      ) : null}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, accent }) {
  return (
    <div className="border border-hair bg-card px-4 py-3">
      <p className="mono-label text-[9.5px] text-ink/50">{label}</p>
      <p className="mt-1.5 text-[24px] font-semibold leading-none tracking-[-0.04em] tabular-nums" style={accent ? { color: accent } : undefined}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-ink/50">{hint}</p> : null}
    </div>
  );
}

export function Pill({ children, tone = "muted", title }) {
  const tones = { muted: "bg-ink/[0.06] text-ink/65", flame: "bg-[#ff3c00]/10 text-[#c24100]", ink: "bg-ink text-white", green: "bg-green-600/12 text-green-800", red: "bg-red-600/10 text-red-800", amber: "bg-amber-500/15 text-amber-800" };
  return <span title={title} className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]", tones[tone] || tones.muted)}>{children}</span>;
}

export const Loading = ({ label = "Loading…" }) => <div className="flex items-center justify-center gap-2 py-14 text-[13px] text-ink/50"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>;
export const ErrorNote = ({ error, children }) => (
  <p role="alert" className="flex items-start gap-2 border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-800"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{children || error?.message || String(error || "Something went wrong")}</p>
);
export const Empty = ({ icon: Icon, title, hint, action }) => (
  <div className="flex flex-col items-center px-6 py-12 text-center">
    {Icon ? <span className="grid h-11 w-11 place-items-center flame-bg text-white"><Icon className="h-5 w-5" /></span> : null}
    <p className="mt-3 text-[15px] font-semibold">{title}</p>
    {hint ? <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-ink/55">{hint}</p> : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);

export const STATUS_TONE = { draft: "muted", ready: "flame", sent: "ink", viewed: "green", refining: "amber", pending_approval: "amber", approved: "green", won: "green", lost: "red" };
