import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function Btn({ children, icon: Icon, onClick, variant = "flame", type = "button", disabled, className = "" }) {
  const cls = variant === "flame" ? "is-flame" : variant === "ink" ? "is-ink" : "is-outline";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`btn-roll ${cls} disabled:opacity-50 ${className}`}>
      <span className="roll"><span>{children}</span><span>{children}</span></span>
      {Icon && <span className="box"><Icon className="h-3.5 w-3.5" /></span>}
    </button>
  );
}

export function SmallBtn({ children, onClick, active, className = "", title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex h-7 items-center gap-1.5 border px-2.5 text-[12px] font-medium transition-colors ${
        active ? "border-ink bg-ink text-white" : "border-hair bg-paper text-ink/70 hover:border-ink/40 hover:text-ink"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Panel({ title, label, action, children, className = "", bodyClass = "" }) {
  return (
    <section className={`rounded-md border border-hair bg-card ${className}`}>
      {(title || label || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-hair px-4 py-3">
          <div>
            {label && <p className="mono-label text-[9.5px] text-ink/50">{label}</p>}
            {title && <h3 className="text-[15px] font-semibold tracking-[-0.02em]">{title}</h3>}
          </div>
          {action}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function Empty({ children, action }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="mx-auto max-w-md text-[13px] leading-relaxed text-ink/55">{children}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

const TONE = {
  flame: "bg-[#ff3c00] text-white",
  ink: "bg-ink text-white",
  green: "bg-green-600/10 text-green-800",
  red: "bg-red-600/10 text-red-700",
  amber: "bg-amber-500/15 text-amber-800",
  muted: "bg-ink/[0.07] text-ink/70",
};
export function Tag({ children, tone = "muted", className = "" }) {
  return <span className={`mono-label inline-flex items-center px-1.5 py-0.5 text-[9px] ${TONE[tone] || TONE.muted} ${className}`}>{children}</span>;
}

export function Stat({ value, label, accent, hint }) {
  return (
    <div className="border-r border-hair px-4 py-4 last:border-r-0">
      <p className={`text-[30px] font-semibold leading-none tracking-[-0.04em] tabular-nums ${accent ? "text-[#ff3c00]" : ""}`}>{value}</p>
      <p className="mono-label mt-2 text-[9.5px] text-ink/50">{label}</p>
      {hint ? <p className="mt-1 truncate text-[10.5px] text-ink/45">{hint}</p> : null}
    </div>
  );
}

const inputCls = "w-full border border-hair bg-paper px-3 py-2 text-[13.5px] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-[#ff3c00]";

export function Field({ f, value, onChange }) {
  const set = (v) => onChange(f.name, v);
  if (f.type === "textarea") return <textarea rows={f.rows || 4} className={inputCls} value={value ?? ""} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />;
  if (f.type === "select")
    return (
      <select className={inputCls} value={value ?? ""} onChange={(e) => set(e.target.value)}>
        {!f.required && <option value="">—</option>}
        {f.options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o.replace(/_/g, " ")}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    );
  if (f.type === "checkbox")
    return (
      <label className="flex cursor-pointer items-center gap-2 text-[13px]">
        <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} className="h-4 w-4 accent-[#ff3c00]" />
        {f.hint || "Yes"}
      </label>
    );
  if (f.type === "multi")
    return (
      <div className="flex flex-wrap gap-1.5">
        {f.options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const l = typeof o === "string" ? o : o.label;
          const on = (value || []).includes(v);
          return (
            <SmallBtn key={v} active={on} onClick={() => set(on ? (value || []).filter((x) => x !== v) : [...(value || []), v])}>{l}</SmallBtn>
          );
        })}
      </div>
    );
  if (f.type === "list")
    return <input className={inputCls} value={(value || []).join(", ")} placeholder={f.placeholder || "comma, separated"} onChange={(e) => set(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />;
  return (
    <input
      className={inputCls}
      type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "datetime" ? "datetime-local" : "text"}
      value={value ?? ""}
      placeholder={f.placeholder}
      onChange={(e) => set(f.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
    />
  );
}

export function FormDialog({ open, title, fields, initial, onClose, onSubmit, submitLabel = "Save", onDelete }) {
  const [vals, setVals] = useState(initial || {});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setVals(initial || {}); }, [open, initial]);
  if (!open) return null;
  const change = (k, v) => setVals((s) => ({ ...s, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await onSubmit(vals); onClose(); } finally { setBusy(false); }
  };
  return (
    <div role="dialog" className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-[8vh]" onMouseDown={onClose}>
      <form onSubmit={submit} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-xl border border-hair bg-canvas shadow-2xl">
        <div className="flex items-center justify-between border-b border-hair px-5 py-4">
          <h3 className="text-[18px] font-semibold tracking-[-0.03em]">{title}</h3>
          <button type="button" onClick={onClose} className="text-ink/50 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[62vh] space-y-4 overflow-y-auto px-5 py-5">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="mono-label mb-1.5 block text-[9.5px] text-ink/55">{f.label}{f.required ? " *" : ""}</label>
              <Field f={f} value={vals[f.name]} onChange={change} />
              {f.help && <p className="mt-1 text-[11.5px] text-ink/45">{f.help}</p>}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-hair px-5 py-4">
          {onDelete ? (
            <button type="button" onClick={async () => { if (window.confirm("Delete this?")) { await onDelete(); onClose(); } }} className="text-[12.5px] text-red-700 hover:underline">Delete</button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-10 px-4 text-[13px] text-ink/60 hover:text-ink">Cancel</button>
            <button type="submit" disabled={busy} className="h-10 bg-[#ff3c00] px-5 text-[13px] font-medium text-white transition-colors hover:bg-ink disabled:opacity-50">{busy ? "Saving…" : submitLabel}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
