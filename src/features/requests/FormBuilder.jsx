import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Copy, Check, Link2, Eye } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useInvalidate } from "@/lib/useData";
import { Btn, SmallBtn, Tag } from "@/features/clients/ui";
import RequestFormRenderer from "./RequestFormRenderer";
import { KIND_LABELS, KIND_ORDER, FIELD_TYPES, INDUSTRY_LABELS, buildDefaultForms, DEFAULT_CLAUDE_PROJECT } from "./formSchema";

const inputCls = "w-full border border-hair bg-paper px-3 py-2 text-[13px] text-ink outline-none focus:border-[#ff3c00]";
const randKey = () => Array.from(crypto.getRandomValues(new Uint8Array(18))).map((b) => b.toString(16).padStart(2, "0")).join("");
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "field";

/* ---- field row editor ---- */
function FieldRow({ f, i, n, onChange, onMove, onDelete }) {
  const set = (k, v) => onChange({ ...f, [k]: v });
  const hasOpts = f.type === "select" || f.type === "multi_select";
  return (
    <div className="border border-hair bg-paper p-3">
      <div className="grid gap-2 md:grid-cols-[1fr_170px_auto]">
        <input className={inputCls} value={f.label} placeholder="Question / label" onChange={(e) => set("label", e.target.value)} />
        <select className={inputCls} value={f.type} onChange={(e) => set("type", e.target.value)}>{FIELD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <div className="flex items-center gap-1">
          <label className="mr-2 flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={!!f.required} onChange={(e) => set("required", e.target.checked)} className="h-3.5 w-3.5 accent-[#ff3c00]" /> Required</label>
          <button type="button" disabled={i === 0} onClick={() => onMove(-1)} className="p-1 text-ink/40 hover:text-ink disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
          <button type="button" disabled={i === n - 1} onClick={() => onMove(1)} className="p-1 text-ink/40 hover:text-ink disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={onDelete} className="p-1 text-ink/40 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        {hasOpts ? <input className={inputCls} value={(f.options || []).join(", ")} placeholder="Options, comma separated" onChange={(e) => set("options", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
          : <input className={inputCls} value={f.placeholder || ""} placeholder="Placeholder (optional)" onChange={(e) => set("placeholder", e.target.value)} />}
        <input className={inputCls} value={f.help || ""} placeholder="Help text (optional)" onChange={(e) => set("help", e.target.value)} />
      </div>
    </div>
  );
}

/* ---- one form editor ---- */
export function FormEditor({ form, onSaved, onClose }) {
  const [v, setV] = useState(form);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [pv, setPv] = useState({});
  const [copied, setCopied] = useState(false);
  const invalidate = useInvalidate();
  useEffect(() => setV(form), [form]);
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
  const fields = v.fields || [];
  const setField = (i, nf) => set("fields", fields.map((x, j) => (j === i ? { ...nf, id: nf.id || slug(nf.label) } : x)));
  const move = (i, d) => { const a = [...fields]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); set("fields", a); };
  const add = () => set("fields", [...fields, { id: `q${fields.length + 1}_${Date.now().toString(36)}`, label: "", type: "short_text", required: false }]);

  const save = async () => {
    setBusy(true);
    try {
      const clean = { ...v, form_key: v.form_key || randKey(), fields: fields.map((f) => ({ ...f, id: f.id || slug(f.label) })) };
      const { id, created_date, updated_date, created_by, created_by_id, is_sample, ...data } = clean; // eslint-disable-line no-unused-vars
      const saved = id ? await base44.entities.RequestForm.update(id, data) : await base44.entities.RequestForm.create(data);
      invalidate("RequestForm");
      onSaved?.(saved);
    } finally { setBusy(false); }
  };
  const publicUrl = v.id && v.form_key ? `${window.location.origin}/r/${v.id}?k=${v.form_key}` : null;
  const copy = () => { if (publicUrl) { navigator.clipboard?.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } };

  return (
    <div className="border border-hair bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair px-5 py-4">
        <div className="flex items-center gap-2">
          <select className="border border-hair bg-paper px-2 py-1.5 text-[12.5px]" value={v.kind} onChange={(e) => set("kind", e.target.value)}>{KIND_ORDER.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}</select>
          <input className="min-w-[260px] border border-hair bg-paper px-3 py-1.5 text-[15px] font-semibold tracking-[-0.02em]" value={v.title || ""} placeholder="Form title" onChange={(e) => set("title", e.target.value)} />
          <label className="ml-2 flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={v.active !== false} onChange={(e) => set("active", e.target.checked)} className="h-3.5 w-3.5 accent-[#ff3c00]" /> Active</label>
        </div>
        <div className="flex gap-2">
          <SmallBtn onClick={() => setPreview((p) => !p)} active={preview}><Eye className="h-3 w-3" /> Preview</SmallBtn>
          {publicUrl && <SmallBtn onClick={copy} title="Public link for their website or app">{copied ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />} Public link</SmallBtn>}
          {onClose && <SmallBtn onClick={onClose}>Close</SmallBtn>}
          <Btn onClick={save} disabled={busy || !v.title}>{busy ? "Saving…" : "Save form"}</Btn>
        </div>
      </div>
      {preview ? (
        <div className="px-5 py-5"><p className="mono-label mb-3 text-[9.5px] text-ink/50">What the client sees</p><RequestFormRenderer form={v} vals={pv} onChange={(k, val) => setPv((s) => ({ ...s, [k]: val }))} /></div>
      ) : (
        <div className="grid gap-5 px-5 py-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-2">
            <input className={inputCls} value={v.intro || ""} placeholder="One line shown above the form" onChange={(e) => set("intro", e.target.value)} />
            {fields.map((f, i) => <FieldRow key={f.id || i} f={f} i={i} n={fields.length} onChange={(nf) => setField(i, nf)} onMove={(d) => move(i, d)} onDelete={() => set("fields", fields.filter((_, j) => j !== i))} />)}
            <SmallBtn onClick={add}><Plus className="h-3 w-3" /> Add question</SmallBtn>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mono-label mb-1.5 block text-[9.5px] text-ink/55">What Claude does with a submission</label>
              <textarea rows={9} className={inputCls} value={v.claude_instructions || ""} onChange={(e) => set("claude_instructions", e.target.value)} />
              {v.kind === "project_submission" && !v.claude_instructions && <button type="button" className="mt-1 text-[11.5px] text-[#ff3c00] hover:underline" onClick={() => set("claude_instructions", DEFAULT_CLAUDE_PROJECT)}>Use the default project-page instructions</button>}
            </div>
            <div>
              <label className="mono-label mb-1.5 block text-[9.5px] text-ink/55">Where it ends up</label>
              <input className={inputCls} value={v.publish_target || ""} placeholder="Projects page on their site" onChange={(e) => set("publish_target", e.target.value)} />
            </div>
            {publicUrl && (
              <div className="border border-hair bg-paper p-3 text-[11.5px] text-ink/60">
                <p className="mono-label mb-1 text-[9px] text-ink/50">Embed on their site or app</p>
                <p>Link any button to the public link, or POST to <code className="font-mono text-[10.5px]">/functions/submit-request</code> with <code className="font-mono text-[10.5px]">form_id</code> + <code className="font-mono text-[10.5px]">key</code>. Submissions land here either way.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- per-client forms panel ---- */
export default function ClientFormsPanel({ client, forms, onChange }) {
  const [editing, setEditing] = useState(null);
  const [industry, setIndustry] = useState("services");
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidate();
  const mine = forms.filter((f) => f.client_id === client.id);
  const sorted = KIND_ORDER.flatMap((k) => mine.filter((f) => f.kind === k));

  const seed = async () => {
    setBusy(true);
    try {
      const defaults = buildDefaultForms(client, industry).filter((d) => !mine.some((m) => m.kind === d.kind)).map((d) => ({ ...d, form_key: randKey() }));
      if (defaults.length) await base44.entities.RequestForm.bulkCreate(defaults);
      invalidate("RequestForm"); onChange?.();
    } finally { setBusy(false); }
  };
  const remove = async (f) => { if (!window.confirm(`Delete "${f.title}"?`)) return; await base44.entities.RequestForm.delete(f.id); invalidate("RequestForm"); onChange?.(); };
  const duplicate = async (f) => { const { id, created_date, updated_date, created_by, created_by_id, is_sample, ...d } = f; await base44.entities.RequestForm.create({ ...d, title: d.title + " (copy)", form_key: randKey(), submissions: 0 }); invalidate("RequestForm"); onChange?.(); }; // eslint-disable-line no-unused-vars

  return (
    <div className="space-y-3">
      {editing && <FormEditor form={editing} onSaved={() => { setEditing(null); onChange?.(); }} onClose={() => setEditing(null)} />}
      {!editing && (
        <>
          {sorted.length === 0 ? (
            <div className="border border-hair bg-card p-5">
              <p className="text-[14px] font-semibold">No forms yet for {client.business}.</p>
              <p className="mt-1 text-[12.5px] text-ink/55">Pick their industry and I&apos;ll create a tailored project form plus the standard website edit, new page, Ørigin 1.0 edit and question forms. Edit anything after.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select className="border border-hair bg-paper px-2 py-1.5 text-[12.5px]" value={industry} onChange={(e) => setIndustry(e.target.value)}>{Object.entries(INDUSTRY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <Btn onClick={seed} disabled={busy}>{busy ? "Creating…" : "Create their forms"}</Btn>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-hair border border-hair bg-card">
              {sorted.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><Tag tone={f.active === false ? "muted" : "flame"}>{KIND_LABELS[f.kind] || f.kind}</Tag><span className="text-[13.5px] font-medium">{f.title}</span></div>
                    <p className="mt-0.5 text-[11.5px] text-ink/50">{(f.fields || []).length} questions · {f.submissions || 0} submitted{f.publish_target ? ` · → ${f.publish_target}` : ""}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <SmallBtn onClick={() => setEditing(f)}>Edit</SmallBtn>
                    <SmallBtn onClick={() => duplicate(f)} title="Duplicate"><Copy className="h-3 w-3" /></SmallBtn>
                    <SmallBtn onClick={() => remove(f)} title="Delete"><Trash2 className="h-3 w-3" /></SmallBtn>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <SmallBtn onClick={() => setEditing({ client_id: client.id, client_name: client.business, kind: "project_submission", title: "", fields: [], active: true, submissions: 0 })}><Plus className="h-3 w-3" /> New form</SmallBtn>
            {sorted.length > 0 && sorted.length < 5 && (
              <span className="flex items-center gap-2 text-[12px] text-ink/50">Add the missing standard forms:
                <select className="border border-hair bg-paper px-2 py-1 text-[12px]" value={industry} onChange={(e) => setIndustry(e.target.value)}>{Object.entries(INDUSTRY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <SmallBtn onClick={seed}>Add</SmallBtn></span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
