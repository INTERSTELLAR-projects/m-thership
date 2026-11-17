import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "@/features/agents/agents.css";
import "./calls.css";
import Starfield from "@/features/agents/Starfield";

export function Shell({ title, accent, sub, right, children }) {
  return (
    <div className="agx cpx grain-d relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-60"><Starfield /></div>
      <div className="cpx-wrap">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-[var(--hair-d)] pb-4 pt-5">
          <div className="min-w-0">
            <p className="eyebrow flex items-center gap-2"><span className="inline-block h-[9px] w-[9px]" style={{ background: "linear-gradient(#ff3c00,#ff3c00) center/100% 1.5px no-repeat, linear-gradient(#ff3c00,#ff3c00) center/1.5px 100% no-repeat" }} />(Clients)</p>
            <h1 className="mt-1.5 text-[30px] font-semibold leading-[0.95] tracking-[-0.045em] text-white md:text-[40px]">{title} {accent ? <span className="text-[#ff3c00]">/{accent}</span> : null}</h1>
            {sub ? <p className="mt-2 max-w-xl text-[13px] text-[var(--ink-m)]">{sub}</p> : null}
          </div>
          {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}

export function GlideTabs({ value, onChange, options, label = "Sections" }) {
  const ref = useRef(null);
  const [g, setG] = useState({ left: 3, width: 0 });
  useLayoutEffect(() => {
    const el = ref.current?.querySelector(`[data-k="${value}"]`);
    if (el) setG({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, options]);
  return (
    <div ref={ref} className="tabs" role="tablist" aria-label={label}>
      <span className="glide" style={{ left: g.left, width: g.width }} />
      {options.map(([k, l, Icon, badge]) => (
        <button key={k} data-k={k} type="button" role="tab" aria-selected={value === k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>
          {Icon ? <Icon className="h-3.5 w-3.5" /> : null}{l}
          {badge ? <span className="mono grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ff3c00] px-1 text-[10px] text-white">{badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

// Two-click button in place of a confirm dialog.
export function ArmBtn({ children, armedLabel, onConfirm, className = "btn-d", disabled, title }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return undefined; const t = setTimeout(() => setArmed(false), 3500); return () => clearTimeout(t); }, [armed]);
  return (
    <button type="button" title={title} disabled={disabled} className={`${className} ${armed ? "!border-[#ff6a00] !text-white" : ""}`}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
      {armed ? armedLabel : children}
    </button>
  );
}
