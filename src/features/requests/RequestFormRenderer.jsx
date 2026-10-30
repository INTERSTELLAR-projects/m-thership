import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

const inputCls = "w-full border border-hair bg-paper px-3 py-2 text-[13.5px] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-[#ff3c00]";

function Uploader({ value = [], onChange, accept }) {
  const inp = useRef(null);
  const [up, setUp] = useState(false);
  const upload = async (e) => {
    const list = Array.from(e.target.files || []);
    setUp(true);
    try {
      const urls = [];
      for (const file of list) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        urls.push(file_url);
      }
      onChange([...(value || []), ...urls]);
    } finally { setUp(false); e.target.value = ""; }
  };
  return (
    <div>
      <input ref={inp} type="file" multiple accept={accept} className="hidden" onChange={upload} />
      <div className="flex flex-wrap items-center gap-2">
        {(value || []).map((u) => (
          <span key={u} className="relative h-16 w-16 overflow-hidden border border-hair bg-paper">
            {/\.(png|jpe?g|webp|gif|heic)$/i.test(u.split("?")[0]) ? <img src={u} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[10px]">file</span>}
            <button type="button" onClick={() => onChange((value || []).filter((x) => x !== u))} className="absolute right-0 top-0 bg-ink p-0.5 text-white"><X className="h-3 w-3" /></button>
          </span>
        ))}
        <button type="button" onClick={() => inp.current?.click()} className="inline-flex h-16 w-24 flex-col items-center justify-center gap-1 border border-dashed border-ink/30 text-[11px] text-ink/60 hover:border-[#ff3c00] hover:text-[#ff3c00]">
          <Upload className="h-4 w-4" /> {up ? "Uploading…" : "Add"}
        </button>
      </div>
    </div>
  );
}

export function RequestField({ f, value, onChange }) {
  const set = (v) => onChange(f.id, v);
  switch (f.type) {
    case "long_text": return <textarea rows={4} className={inputCls} value={value ?? ""} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />;
    case "select": return (
      <select className={inputCls} value={value ?? ""} onChange={(e) => set(e.target.value)}>
        <option value="">Choose…</option>{(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>);
    case "multi_select": return (
      <div className="flex flex-wrap gap-1.5">
        {(f.options || []).map((o) => { const on = (value || []).includes(o); return (
          <button key={o} type="button" onClick={() => set(on ? (value || []).filter((x) => x !== o) : [...(value || []), o])} className={`h-8 border px-3 text-[12.5px] transition-colors ${on ? "border-ink bg-ink text-white" : "border-hair bg-paper text-ink/70 hover:border-ink/40"}`}>{o}</button>); })}
      </div>);
    case "checkbox": return <label className="flex cursor-pointer items-center gap-2 text-[13px]"><input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} className="h-4 w-4 accent-[#ff3c00]" />{f.help || "Yes"}</label>;
    case "photos": return <Uploader value={value} onChange={set} accept="image/*" />;
    case "files": return <Uploader value={value} onChange={set} />;
    case "date": case "number": case "email": case "url":
      return <input type={f.type === "url" ? "url" : f.type} className={inputCls} value={value ?? ""} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />;
    case "phone": return <input type="tel" className={inputCls} value={value ?? ""} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />;
    default: return <input type="text" className={inputCls} value={value ?? ""} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />;
  }
}

export function isComplete(form, vals) {
  return (form.fields || []).every((f) => {
    if (!f.required) return true;
    const v = vals[f.id];
    if (f.type === "checkbox") return v === true;
    if (Array.isArray(v)) return v.length > 0;
    return v != null && String(v).trim() !== "";
  });
}

/* Renders a RequestForm's fields. Controlled: vals + onChange(id, value). */
export default function RequestFormRenderer({ form, vals, onChange }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(form.fields || []).map((f) => (
        <div key={f.id} className={["long_text", "photos", "files", "multi_select", "checkbox"].includes(f.type) ? "md:col-span-2" : ""}>
          {f.type !== "checkbox" && <label className="mono-label mb-1.5 block text-[9.5px] text-ink/55">{f.label}{f.required ? " *" : ""}</label>}
          {f.type === "checkbox" && <label className="mono-label mb-1.5 block text-[9.5px] text-ink/55">{f.label}{f.required ? " *" : ""}</label>}
          <RequestField f={f} value={vals[f.id]} onChange={onChange} />
          {f.help && f.type !== "checkbox" && <p className="mt-1 text-[11.5px] text-ink/45">{f.help}</p>}
        </div>
      ))}
    </div>
  );
}
