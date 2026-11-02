import { Plus, X } from "lucide-react";
import { inputCls } from "./ui";

// Generic editor for a template's `mock` object, driven by the value shapes in the spec (the
// example in templates.schema.json seeds every field). Strings -> inputs, numbers -> number
// inputs, booleans -> checkboxes, string arrays -> one-per-line textarea, number arrays ->
// comma list, object arrays -> repeatable rows, objects -> nested groups.

const human = (k) => String(k).replace(/_/g, " ");

function Leaf({ value, onChange }) {
  if (typeof value === "boolean") {
    return <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#ff3c00]" />;
  }
  if (typeof value === "number") {
    return <input type="number" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value))} className={inputCls} />;
  }
  return <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
}

function blankLike(sample) {
  if (Array.isArray(sample)) return [];
  if (sample && typeof sample === "object") return Object.fromEntries(Object.entries(sample).map(([k, v]) => [k, blankLike(v)]));
  if (typeof sample === "number") return 0;
  if (typeof sample === "boolean") return false;
  return "";
}

function ValueEditor({ name, value, onChange, depth = 0 }) {
  if (Array.isArray(value)) {
    const primitives = value.every((v) => v === null || typeof v !== "object");
    if (primitives && value.every((v) => typeof v === "number") && value.length) {
      return (
        <Row name={name}>
          <input value={value.join(", ")} onChange={(e) => onChange(e.target.value.split(",").map((x) => Number(x.trim())).filter(Number.isFinite))} className={inputCls} />
        </Row>
      );
    }
    if (primitives) {
      return (
        <Row name={name} hint="one per line">
          <textarea rows={Math.max(3, value.length + 1)} value={value.join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} onBlur={(e) => onChange(e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} className={`${inputCls} resize-y leading-snug`} />
        </Row>
      );
    }
    return (
      <div className="space-y-2">
        <div className="mono-label flex items-center justify-between text-[9px] text-ink/50">
          <span>{human(name)}</span>
          <button type="button" onClick={() => onChange([...value, blankLike(value[0] || {})])} className="inline-flex items-center gap-1 text-ink/50 hover:text-[#ff3c00]"><Plus className="h-3 w-3" />Add</button>
        </div>
        {value.map((item, i) => (
          <div key={i} className="relative border border-hair bg-paper/60 p-2.5 pr-8">
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="absolute right-1.5 top-1.5 p-1 text-ink/35 hover:text-[#ff3c00]" title="Remove"><X className="h-3.5 w-3.5" /></button>
            <ObjectEditor value={item} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  if (value && typeof value === "object") {
    return (
      <div className="space-y-2">
        <p className="mono-label text-[9px] text-ink/50">{human(name)}</p>
        <div className="border-l-2 border-hair pl-3"><ObjectEditor value={value} onChange={onChange} depth={depth + 1} /></div>
      </div>
    );
  }
  return (
    <Row name={name} inline={typeof value === "boolean"}>
      <Leaf value={value} onChange={onChange} />
    </Row>
  );
}

function Row({ name, hint, children, inline }) {
  return (
    <label className={inline ? "flex items-center justify-between gap-3" : "block"}>
      <span className="mono-label flex items-center justify-between text-[9px] text-ink/50"><span>{human(name)}</span>{hint && <span className="normal-case tracking-normal text-ink/35">{hint}</span>}</span>
      <div className={inline ? "" : "mt-1"}>{children}</div>
    </label>
  );
}

function ObjectEditor({ value, onChange, depth }) {
  const entries = Object.entries(value || {});
  const leavesOnly = entries.every(([, v]) => v === null || typeof v !== "object");
  return (
    <div className={leavesOnly && depth > 0 && entries.length <= 4 ? "grid gap-2 sm:grid-cols-2" : "space-y-3"}>
      {entries.map(([k, v]) => <ValueEditor key={k} name={k} value={v} depth={depth} onChange={(nv) => onChange({ ...value, [k]: nv })} />)}
    </div>
  );
}

export default function MockEditor({ mock, example, onChange }) {
  // Show every field the template knows about, even if this spec left it out.
  const merged = { ...(example || {}), ...(mock || {}) };
  return <ObjectEditor value={merged} onChange={onChange} depth={0} />;
}
