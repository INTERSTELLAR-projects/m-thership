import React from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function Section({ title, hint, children }) {
  return (
    <div className="border-b border-border pb-5 mb-5 last:border-0 last:mb-0">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{title}</h3>
      {hint && <p className="text-xs text-muted-foreground mb-3">{hint}</p>}
      <div className={`space-y-3 ${hint ? "" : "mt-3"}`}>{children}</div>
    </div>
  );
}

export function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <span className="text-sm">{label}</span>
        {hint && <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function ChoiceGrid({ value, options, onChange, cols = 3 }) {
  return (
    <div className={`grid gap-2 ${cols === 2 ? "grid-cols-2" : cols === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`text-xs rounded-sm border px-2 py-2 text-center transition ${
            String(value) === String(o.id)
              ? "border-[#ff3c00] bg-[#fff1ea] text-[#ff6a00] font-medium"
              : "border-border hover:bg-muted text-foreground/70"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ColorField({ label, value, onChange }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded border border-border cursor-pointer shrink-0 bg-transparent"
        />
        <span className="text-xs font-mono text-muted-foreground uppercase">{value}</span>
      </div>
    </div>
  );
}

export function RangeField({ label, value, min, max, step = 1, suffix = "", onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs font-mono text-muted-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-2 accent-[#ff3c00]"
      />
    </div>
  );
}