import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, X, Sparkles, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import QrCanvas from "./QrCanvas";
import { PACKS, CTA_TEXTS, ICON_PRESETS, brandPack, applyPack } from "../lib/presets";
import { isHex } from "../lib/contrast";

const SAMPLE = "https://interstellar-strategies.com";
const inputCls = "w-full border border-hair bg-paper px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-[#ff3c00]";

export const Label = ({ children }) => <p className="mono-label mb-2 text-[9.5px] text-ink/50">{children}</p>;

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px] text-ink/75">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-[#ff3c00]" : "bg-ink/20"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

export function ColorField({ label, value, onChange }) {
  const [text, setText] = useState(value || "");
  useEffect(() => setText(value || ""), [value]);
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-ink/75">{label}</span>
      <div className="flex items-center gap-2">
        <input
          className="w-[86px] border border-hair bg-paper px-2 py-1 font-mono text-[12px] uppercase outline-none focus:border-[#ff3c00]"
          value={text}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value.startsWith("#") ? e.target.value : "#" + e.target.value;
            setText(v);
            if (isHex(v)) onChange(v.toLowerCase());
          }}
        />
        <input type="color" value={isHex(value) ? value : "#000000"} onChange={(e) => { setText(e.target.value); onChange(e.target.value); }} className="h-8 w-9 cursor-pointer border border-hair bg-paper p-0.5" />
      </div>
    </div>
  );
}

function Choice({ active, onClick, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 border px-2 py-2.5 text-[11.5px] transition-colors ${active ? "border-[#ff3c00] bg-[#fff1ea] text-ink" : "border-hair bg-paper text-ink/60 hover:border-ink/40"}`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

// ---- Style packs + saved templates ----
export function PacksPanel({ style, onApply, brand, templates = [], canDelete, onSaveTemplate, onDeleteTemplate, templateScopes }) {
  const packs = [brandPack(brand), ...PACKS].filter(Boolean);
  const [name, setName] = useState("");
  const [scope, setScope] = useState(templateScopes?.[0]?.value || "client");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setMsg("");
    try {
      await onSaveTemplate({ name: name.trim(), scope });
      setName("");
      setMsg("Template saved.");
    } catch (e) {
      setMsg(e?.response?.data?.error || e.message || "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <Label>Style packs</Label>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {packs.map((p) => (
            <button key={p.id} type="button" onClick={() => onApply(p.style)} className="card-hover group border border-hair bg-paper p-2 text-left">
              <div className="bg-white p-1.5">
                <QrCanvas value={SAMPLE} style={applyPack(p.brand ? {} : { logo_url: style.logo_url, logo_size: style.logo_size }, p.style)} pixelWidth={220} showError={false} />
              </div>
              <p className="mt-2 flex items-center gap-1 text-[12.5px] font-semibold">{p.brand && <Sparkles className="h-3 w-3 text-[#ff3c00]" />}{p.name}</p>
              <p className="text-[11px] leading-snug text-ink/50">{p.blurb}</p>
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Templates</Label>
        {templates.length === 0 ? (
          <p className="text-[12px] text-ink/50">No saved templates yet. Save the current look to reuse it.</p>
        ) : (
          <ul className="divide-y divide-hair border border-hair bg-paper">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                <div className="w-10 shrink-0 bg-white p-0.5"><QrCanvas value={SAMPLE} style={t.style} pixelWidth={96} showError={false} /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{t.name}</p>
                  <p className="mono-label text-[8.5px] text-ink/45">{t.scope === "global" ? "Interstellar" : t.client_name || "Yours"}</p>
                </div>
                <button type="button" onClick={() => onApply(t.style)} className="h-7 border border-hair px-2.5 text-[12px] hover:border-[#ff3c00] hover:text-[#ff3c00]">Apply</button>
                {canDelete(t) && (
                  <button type="button" onClick={() => onDeleteTemplate(t)} className="p-1 text-ink/40 hover:text-red-700" title="Delete template"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input className={`${inputCls} min-w-[160px] flex-1`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Save this look as a template…" maxLength={80} />
          {templateScopes && templateScopes.length > 1 && (
            <select className={`${inputCls} w-auto`} value={scope} onChange={(e) => setScope(e.target.value)}>
              {templateScopes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          )}
          <button type="button" disabled={!name.trim() || saving} onClick={save} className="h-9 bg-ink px-4 text-[12.5px] font-medium text-white hover:bg-[#ff3c00] disabled:opacity-40">{saving ? "Saving…" : "Save template"}</button>
        </div>
        {msg && <p className="mt-1.5 text-[11.5px] text-ink/55">{msg}</p>}
      </div>
    </div>
  );
}

// ---- Dot + eye shapes ----
const DOT_ICONS = {
  square: <svg viewBox="0 0 20 20" className="h-6 w-6"><rect x="2" y="2" width="7" height="7" /><rect x="11" y="2" width="7" height="7" /><rect x="2" y="11" width="7" height="7" /></svg>,
  rounded: <svg viewBox="0 0 20 20" className="h-6 w-6"><rect x="2" y="2" width="7" height="7" rx="2.5" /><rect x="11" y="2" width="7" height="7" rx="2.5" /><rect x="2" y="11" width="7" height="7" rx="2.5" /></svg>,
  dots: <svg viewBox="0 0 20 20" className="h-6 w-6"><circle cx="5.5" cy="5.5" r="3.3" /><circle cx="14.5" cy="5.5" r="3.3" /><circle cx="5.5" cy="14.5" r="3.3" /></svg>,
  diamond: <svg viewBox="0 0 20 20" className="h-6 w-6"><path d="M5.5 1.5 9.5 5.5 5.5 9.5 1.5 5.5Z" /><path d="M14.5 1.5 18.5 5.5 14.5 9.5 10.5 5.5Z" /><path d="M5.5 10.5 9.5 14.5 5.5 18.5 1.5 14.5Z" /></svg>,
};
const EYE_R = { square: 0, rounded: 4, "extra-rounded": 6, circle: 10 };

export function ShapePanel({ style, set }) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Pattern</Label>
        <div className="grid grid-cols-4 gap-2">
          {Object.keys(DOT_ICONS).map((k) => (
            <Choice key={k} active={style.dot_style === k} onClick={() => set({ dot_style: k })} label={k[0].toUpperCase() + k.slice(1)}>
              <span className="fill-current">{DOT_ICONS[k]}</span>
            </Choice>
          ))}
        </div>
      </div>
      <div>
        <Label>Corner eyes</Label>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(EYE_R).map(([k, r]) => (
            <Choice key={k} active={style.corner_style === k} onClick={() => set({ corner_style: k })} label={k === "extra-rounded" ? "Soft" : k[0].toUpperCase() + k.slice(1)}>
              <svg viewBox="0 0 20 20" className="h-6 w-6">
                <rect x="1.5" y="1.5" width="17" height="17" rx={r * 0.85} fill="none" stroke="currentColor" strokeWidth="2.6" />
                <rect x="6.5" y="6.5" width="7" height="7" rx={r * 0.35} fill="currentColor" />
              </svg>
            </Choice>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Colours ----
export function ColorPanel({ style, set }) {
  return (
    <div className="space-y-4">
      <div className="space-y-3 border border-hair bg-paper p-4">
        <ColorField label="Pattern" value={style.foreground} onChange={(v) => set({ foreground: v })} />
        <Toggle label="Gradient pattern" checked={style.gradient} onChange={(v) => set({ gradient: v })} />
        {style.gradient && (
          <>
            <ColorField label="Gradient end" value={style.gradient_color} onChange={(v) => set({ gradient_color: v })} />
            <div className="flex gap-2">
              {["linear", "radial"].map((t) => (
                <button key={t} type="button" onClick={() => set({ gradient_type: t })} className={`h-7 flex-1 border text-[12px] capitalize ${style.gradient_type === t ? "border-[#ff3c00] bg-[#fff1ea]" : "border-hair"}`}>{t}</button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="space-y-3 border border-hair bg-paper p-4">
        <ColorField label="Corner frames" value={style.corner_color} onChange={(v) => set({ corner_color: v })} />
        <ColorField label="Corner dots" value={style.eye_color} onChange={(v) => set({ eye_color: v })} />
      </div>
      <div className="space-y-3 border border-hair bg-paper p-4">
        <ColorField label="Background" value={style.background} onChange={(v) => set({ background: v })} />
        <Toggle label="Transparent background" checked={style.transparent_bg} onChange={(v) => set({ transparent_bg: v })} />
      </div>
    </div>
  );
}

// ---- Logo ----
export function LogoPanel({ style, set, brand }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setErr("Pick an image file (PNG, SVG, JPG).");
    if (file.size > 5 * 1024 * 1024) return setErr("Keep logos under 5 MB.");
    setBusy(true);
    setErr("");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set({ logo_url: file_url });
    } catch {
      setErr("Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      {style.logo_url ? (
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 border border-hair bg-paper p-2"><img src={style.logo_url} alt="Logo" className="h-full w-full object-contain" /></div>
          <button type="button" onClick={() => set({ logo_url: "" })} className="flex items-center gap-1.5 text-[12px] text-ink/60 hover:text-ink"><X className="h-3.5 w-3.5" /> Remove logo</button>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="flex w-full flex-col items-center gap-2 border border-dashed border-ink/25 py-6 transition-colors hover:border-[#ff3c00] hover:bg-paper">
          <ImagePlus className="h-5 w-5 text-ink/50" />
          <span className="text-[13px] text-ink/60">{busy ? "Uploading…" : "Upload a logo (PNG, SVG, JPG)"}</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
      {err && <p className="text-[12px] text-red-700">{err}</p>}
      {brand?.logo_url && style.logo_url !== brand.logo_url && (
        <button type="button" onClick={() => set({ logo_url: brand.logo_url })} className="flex w-full items-center gap-3 border border-hair bg-paper px-3 py-2 text-left hover:border-[#ff3c00]">
          <img src={brand.logo_url} alt="" className="h-8 w-8 object-contain" />
          <span className="text-[13px]">Use the {brand.company || "brand"} logo</span>
        </button>
      )}
      <div>
        <Label>Or an icon</Label>
        <div className="flex flex-wrap gap-2">
          {ICON_PRESETS.map((p) => (
            <button key={p.id} type="button" title={p.label} onClick={() => set({ logo_url: p.src })} className={`flex h-11 w-11 items-center justify-center border transition-colors ${style.logo_url === p.src ? "border-[#ff3c00] bg-[#fff1ea]" : "border-hair bg-paper hover:border-ink/40"}`}>
              <img src={p.src} alt={p.label} className="h-7 w-7" />
            </button>
          ))}
        </div>
      </div>
      {style.logo_url && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-[13px] text-ink/75">
              <span>Logo size</span>
              <span className="font-mono text-[11px] text-ink/50">{style.logo_size}%</span>
            </div>
            <input type="range" min={12} max={30} step={1} value={style.logo_size} onChange={(e) => set({ logo_size: Number(e.target.value) })} className="mt-2 w-full accent-[#ff3c00]" />
          </div>
          <Toggle label="Backing plate behind logo" checked={style.logo_bg !== false} onChange={(v) => set({ logo_bg: v })} />
          <p className="text-[11.5px] text-ink/50">Logos switch the code to error-correction level H, so up to 30% of it can be covered and it still scans.</p>
        </div>
      )}
    </div>
  );
}

// ---- Frame + CTA ----
const FRAMES = [
  ["none", "None"],
  ["banner-bottom", "Bottom"],
  ["banner-top", "Top"],
  ["border", "Frame"],
];
export function FramePanel({ style, set }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-2">
        {FRAMES.map(([k, l]) => (
          <Choice key={k} active={style.frame_style === k} onClick={() => set({ frame_style: k })} label={l}>
            <svg viewBox="0 0 24 24" className="h-6 w-6">
              {k === "none" && <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" />}
              {k === "banner-bottom" && <><rect x="3" y="2" width="18" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" /><rect x="3" y="17.5" width="18" height="4.5" fill="currentColor" /></>}
              {k === "banner-top" && <><rect x="3" y="2" width="18" height="4.5" fill="currentColor" /><rect x="3" y="8" width="18" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" /></>}
              {k === "border" && <><rect x="2.5" y="1.5" width="19" height="21" rx="3" fill="none" stroke="currentColor" strokeWidth="2.4" /><rect x="5" y="17" width="14" height="3" fill="currentColor" /></>}
            </svg>
          </Choice>
        ))}
      </div>
      {style.frame_style !== "none" && (
        <>
          <div>
            <Label>Call to action</Label>
            <input className={inputCls} value={style.frame_text} maxLength={28} onChange={(e) => set({ frame_text: e.target.value.toUpperCase() })} placeholder="SCAN ME" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CTA_TEXTS.map((t) => (
                <button key={t} type="button" onClick={() => set({ frame_text: t })} className={`flex items-center gap-1 border px-2 py-1 text-[10.5px] font-medium tracking-wide ${style.frame_text === t ? "border-[#ff3c00] text-[#ff3c00]" : "border-hair text-ink/60 hover:border-ink/40"}`}>
                  {style.frame_text === t && <Check className="h-3 w-3" />}{t}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3 border border-hair bg-paper p-4">
            <ColorField label="Frame colour" value={style.frame_color} onChange={(v) => set({ frame_color: v })} />
            <ColorField label="Text colour" value={style.frame_text_color || "#ffffff"} onChange={(v) => set({ frame_text_color: v })} />
            {style.frame_text_color && <button type="button" onClick={() => set({ frame_text_color: "" })} className="text-[11.5px] text-ink/55 hover:text-[#ff3c00]">Reset text colour to automatic</button>}
          </div>
        </>
      )}
    </div>
  );
}
