// Profile editor for one client's share images: brand preset, colors, logo, font, layout tuning and the page list.
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CloudUpload, Plus, RotateCcw, Shuffle, Sparkles, Trash2, Wand2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Spinner } from "@/features/agents/ui";
import { PRESETS, PRESET_KEYS, DEFAULT_OPTIONS, DEFAULT_GRAIN, slugFile } from "./render";
import { suggestPages } from "./suggest";

const COLOR_KEYS = [["primary", "Base"], ["secondary", "Second"], ["accent", "Accent"], ["glow", "Glow"], ["text", "Label"]];
const NEEDS_PHOTO = new Set(["photo_blur", "stone", "patina"]);

function Section({ title, right, children }) {
  return (
    <section className="card">
      <header className="sec-h"><h3 className="text-[13.5px] font-semibold tracking-[-0.01em] text-white">{title}</h3>{right}</header>
      <div className="sec-b space-y-3">{children}</div>
    </section>
  );
}

// Two-click button in place of a confirm dialog: first click arms it, second click does it.
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

async function uploadFile(file) {
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return file_url;
}

function UrlWithUpload({ label, value, onChange, placeholder, note, onRehost }) {
  const input = useRef(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy("upload"); setErr("");
    try { onChange(await uploadFile(f)); } catch (x) { setErr(x?.message || "Upload failed"); }
    setBusy("");
  };
  const rehost = async () => {
    setBusy("rehost"); setErr("");
    try {
      const res = await base44.functions.invoke("share-image-rehost", { url: value });
      if (res.data?.file_url) onChange(res.data.file_url); else setErr(res.data?.error || "Could not copy it");
    } catch (x) { setErr(x?.response?.data?.error || x?.message || "Could not copy it"); }
    setBusy("");
  };
  return (
    <div>
      <span className="lbl">{label}</span>
      <div className="flex gap-2">
        <input className="inp" value={value || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value.trim())} />
        <button type="button" className="btn-d shrink-0" onClick={() => input.current?.click()} title="Upload a file to Møthership storage">
          {busy === "upload" ? <Spinner /> : <CloudUpload className="h-3.5 w-3.5" />}
        </button>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} />
      </div>
      {note ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-[#ffb27a]">
          <span>{note}</span>
          {onRehost && value ? <button type="button" className="chip" onClick={rehost} disabled={!!busy}>{busy === "rehost" ? <Spinner size={11} /> : null}Copy into Møthership storage</button> : null}
        </div>
      ) : null}
      {err ? <p className="mt-1 text-[11.5px] text-[#ff8a7f]">{err}</p> : null}
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, suffix = "px", onReset }) {
  return (
    <label className="block">
      <span className="lbl flex items-center justify-between"><span>{label}</span><span className="mono text-[var(--ink-d)]">{value}{suffix}{onReset ? <button type="button" className="ml-2 text-[var(--ink-s)] hover:text-white" onClick={(e) => { e.preventDefault(); onReset(); }} aria-label={`Reset ${label}`}><RotateCcw className="inline h-3 w-3" /></button> : null}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function PageRow({ p, i, n, set, move, remove }) {
  const auto = useRef(!p.file_name || p.file_name === `og-${slugFile(p.label)}`);
  const fixedLabel = p.kind === "home" || p.kind === "default";
  return (
    <div className="page-row rounded-lg border border-[var(--hair-d)] bg-white/[0.015] p-2.5" style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}>
      <div className="flex gap-2">
        <select className="inp !w-[92px] shrink-0" value={p.kind} onChange={(e) => set({ kind: e.target.value, ...(e.target.value === "home" || e.target.value === "default" ? { label: "" } : {}) })}>
          <option value="home">home</option><option value="page">page</option><option value="group">group</option><option value="default">default</option>
        </select>
        <input className="inp" value={p.label || ""} disabled={fixedLabel} placeholder={fixedLabel ? "Logo only" : "Label, e.g. How It Works"}
          onChange={(e) => set({ label: e.target.value, ...(auto.current ? { file_name: `og-${slugFile(e.target.value)}`, key: slugFile(e.target.value) } : {}) })} />
      </div>
      <div className="mt-2 flex gap-2">
        <input className="inp mono !text-[12px]" value={p.file_name || ""} placeholder="og-file-name"
          onChange={(e) => { auto.current = false; set({ file_name: slugFile(e.target.value) }); }} />
        <button type="button" className="btn-d !px-2" disabled={i === 0} onClick={() => move(-1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
        <button type="button" className="btn-d !px-2" disabled={i === n - 1} onClick={() => move(1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
        <ArmBtn className="btn-d !px-2" armedLabel="Remove?" onConfirm={remove} title="Remove from the list"><Trash2 className="h-3.5 w-3.5" /></ArmBtn>
      </div>
      <input className="inp mt-2 !h-[30px] !text-[12px]" value={p.paths_note || ""} placeholder="Used on, e.g. /privacy, /terms" onChange={(e) => set({ paths_note: e.target.value })} />
    </div>
  );
}

function SuggestPanel({ draft, onApply }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [proposal, setProposal] = useState(null);
  const run = async () => {
    setBusy(true); setErr(""); setProposal(null);
    try { setProposal(await suggestPages({ routesText: text, clientName: draft.client_name, domain: draft.site_domain, current: draft.pages })); }
    catch (x) { setErr(x?.message || "The suggestion did not come back"); }
    setBusy(false);
  };
  return (
    <div className="space-y-2 rounded-lg border border-dashed border-[var(--hair-d2)] p-2.5">
      <p className="text-[12px] text-[var(--ink-m)]">Paste the site's routes or sitemap. You get a grouped list to review; nothing changes until you apply it and Save.</p>
      <textarea className="inp mono !text-[11.5px]" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={"/\n/about\n/products/swing-doors\n/products/bifold-doors\n/privacy\n/terms"} />
      <button type="button" className="btn-f" onClick={run} disabled={busy || text.trim().length < 3}>{busy ? <Spinner /> : <Wand2 className="h-3.5 w-3.5" />}Suggest pages</button>
      {err ? <p className="text-[11.5px] text-[#ff8a7f]">{err}</p> : null}
      {proposal ? (
        <div className="space-y-2">
          {proposal.note ? <p className="text-[11.5px] text-[var(--ink-m)]">{proposal.note}</p> : null}
          <ul className="max-h-60 space-y-1 overflow-y-auto scroll-d">
            {proposal.pages.map((p) => (
              <li key={p.file_name} className="flex items-baseline gap-2 text-[12px]">
                <span className="mono w-[58px] shrink-0 text-[10px] uppercase tracking-[.1em] text-[var(--ink-s)]">{p.kind}</span>
                <span className="mono text-[var(--ink-d)]">{p.file_name}</span>
                <span className="truncate text-[var(--ink-m)]">{p.label}{p.paths_note ? ` · ${p.paths_note}` : ""}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <ArmBtn className="btn-f" armedLabel="Click again to replace" onConfirm={() => { onApply(proposal.pages, "replace"); setProposal(null); }}>Replace list</ArmBtn>
            <button type="button" className="btn-d" onClick={() => { onApply(proposal.pages, "merge"); setProposal(null); }}>Add the new ones</button>
            <button type="button" className="btn-d" onClick={() => setProposal(null)}>Discard</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Editor({ draft, setDraft, notes }) {
  const [showSuggest, setShowSuggest] = useState(false);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setColor = (k, v) => setDraft((d) => ({ ...d, colors: { ...(d.colors || {}), [k]: v } }));
  const opts = { ...DEFAULT_OPTIONS, ...(draft.options || {}) };
  const setOpt = (k, v) => setDraft((d) => ({ ...d, options: { ...(d.options || {}), [k]: v } }));
  const resetOpt = (k) => setDraft((d) => { const o = { ...(d.options || {}) }; delete o[k]; return { ...d, options: o }; });
  const preset = PRESETS[draft.background_style] || PRESETS.gradient;
  const colors = { ...preset.colors, ...(draft.colors || {}) };
  const pages = draft.pages || [];
  const setPages = (fn) => setDraft((d) => ({ ...d, pages: fn(d.pages || []) }));
  const logoNote = notes.find((n) => n.kind === "logo");
  const bgNote = notes.find((n) => n.kind === "background");
  const fontNote = notes.find((n) => n.kind === "font");

  const applySuggestion = (list, mode) => setPages((cur) => {
    if (mode === "replace") return list;
    const have = new Set(cur.map((p) => p.file_name));
    const add = list.filter((p) => !have.has(p.file_name) && p.kind !== "home" && p.kind !== "default");
    const di = cur.findIndex((p) => p.kind === "default");
    return di >= 0 ? [...cur.slice(0, di), ...add, ...cur.slice(di)] : [...cur, ...add];
  });

  return (
    <div className="space-y-3">
      <Section title="Background">
        <div className="grid grid-cols-4 gap-2">
          {PRESET_KEYS.map((k) => {
            const c = PRESETS[k].colors;
            return (
              <button key={k} type="button" title={PRESETS[k].hint} className={`preset ${draft.background_style === k ? "on" : ""}`}
                style={{ background: k === "grain_blur" ? `radial-gradient(60% 80% at 30% 40%, ${c.secondary}, ${c.primary} 70%)` : k === "starfield" ? `radial-gradient(1px 1px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 70% 60%, #fff, transparent), radial-gradient(1px 1px at 45% 80%, #fff, transparent), ${c.primary}` : k === "asphalt_stripes" ? `linear-gradient(90deg, transparent 58%, ${c.accent} 58% 66%, transparent 66% 70%, ${c.accent} 70% 78%, transparent 78%), ${c.secondary}` : `linear-gradient(135deg, ${c.primary}, ${c.secondary} 70%, ${c.accent})` }}
                onClick={() => set({ background_style: k })}>
                <span>{PRESETS[k].label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11.5px] text-[var(--ink-s)]">{preset.hint}</p>
        <div className="grid grid-cols-5 gap-2">
          {COLOR_KEYS.map(([k, l]) => (
            <label key={k} className="block">
              <span className="lbl">{l}</span>
              <div className="flex flex-col items-start gap-1">
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(colors[k]) ? colors[k] : "#000000"} onChange={(e) => setColor(k, e.target.value.toUpperCase())} />
                <input className="inp mono !h-[26px] !px-1.5 !text-[10.5px]" value={colors[k] || ""} onChange={(e) => setColor(k, e.target.value.trim())} aria-label={`${l} color hex`} />
              </div>
            </label>
          ))}
        </div>
        <button type="button" className="chip" onClick={() => set({ colors: { ...preset.colors } })}><RotateCcw className="h-3 w-3" />Use the preset's colors</button>
        {NEEDS_PHOTO.has(draft.background_style) ? (
          <UrlWithUpload label={draft.background_style === "photo_blur" ? "Background photo (blurred and darkened)" : "Texture photo (optional; drawn procedurally when empty)"}
            value={draft.background_image_url} onChange={(v) => set({ background_image_url: v })} placeholder="https://…" note={bgNote?.text} onRehost />
        ) : null}
      </Section>

      <Section title="Logo">
        <UrlWithUpload label="Logo for dark backgrounds (white / light)" value={draft.logo_url} onChange={(v) => set({ logo_url: v })} placeholder="https://…/logo-white.png" note={logoNote?.text} onRehost />
        <UrlWithUpload label="Dark logo for light backgrounds (optional, kept on file)" value={draft.logo_dark_url} onChange={(v) => set({ logo_dark_url: v })} placeholder="https://…/logo-dark.png" />
        {draft.logo_url ? (
          <div className="grid h-16 place-items-center rounded-lg border border-[var(--hair-d)]" style={{ background: "repeating-conic-gradient(#14151c 0 25%, #0e0f15 0 50%) 0 0 / 16px 16px" }}>
            <img src={draft.logo_url} alt="" className="max-h-12 max-w-[80%] object-contain" crossOrigin="anonymous" />
          </div>
        ) : null}
        <p className="text-[11.5px] text-[var(--ink-s)]">Client logos are used exactly as supplied, never redrawn.</p>
      </Section>

      <Section title="Label font">
        <div className="grid grid-cols-[1fr_92px] gap-2">
          <label className="block"><span className="lbl">Font name</span><input className="inp" value={draft.font_family || ""} placeholder="Archivo" onChange={(e) => set({ font_family: e.target.value })} /></label>
          <label className="block"><span className="lbl">Weight</span>
            <select className="inp" value={draft.font_weight || 800} onChange={(e) => set({ font_weight: Number(e.target.value) })}>
              {[600, 700, 800, 900].map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </label>
        </div>
        <label className="block"><span className="lbl">Font file URL (woff2 / ttf from the client's site)</span><input className="inp" value={draft.font_url || ""} placeholder="https://client.com/fonts/display.woff2" onChange={(e) => set({ font_url: e.target.value.trim() })} /></label>
        {fontNote ? <p className="text-[11.5px] text-[#ffb27a]">{fontNote.text}</p> : null}
        <div className="seg">
          <button type="button" className={draft.label_case !== "as_typed" ? "on" : ""} onClick={() => set({ label_case: "upper" })}>UPPERCASE</button>
          <button type="button" className={draft.label_case === "as_typed" ? "on" : ""} onClick={() => set({ label_case: "as_typed" })}>As typed</button>
        </div>
      </Section>

      <Section title="Layout">
        <Slider label="Home logo width" value={opts.home_logo_width} min={240} max={1000} step={10} onChange={(v) => setOpt("home_logo_width", v)} onReset={() => resetOpt("home_logo_width")} />
        <Slider label="Page logo height" value={opts.page_logo_height} min={48} max={220} step={2} onChange={(v) => setOpt("page_logo_height", v)} onReset={() => resetOpt("page_logo_height")} />
        <Slider label="Page logo max width" value={opts.page_logo_max_width} min={160} max={600} step={10} onChange={(v) => setOpt("page_logo_max_width", v)} onReset={() => resetOpt("page_logo_max_width")} />
        <Slider label="Label max width" value={opts.text_max_width} min={300} max={700} step={10} onChange={(v) => setOpt("text_max_width", v)} onReset={() => resetOpt("text_max_width")} />
        <Slider label="Grain" value={Math.round((opts.grain ?? DEFAULT_GRAIN[draft.background_style] ?? 0) * 100)} min={0} max={25} suffix="%" onChange={(v) => setOpt("grain", v / 100)} onReset={() => resetOpt("grain")} />
        <div className="flex items-center gap-2">
          <span className="lbl !mb-0 flex-1">Texture seed <span className="mono text-[var(--ink-d)]">{opts.seed}</span></span>
          <button type="button" className="chip" onClick={() => setOpt("seed", Math.floor(Math.random() * 99999) + 1)}><Shuffle className="h-3 w-3" />New texture</button>
        </div>
      </Section>

      <Section title={`Images (${pages.length})`} right={<button type="button" className="chip" onClick={() => setShowSuggest((v) => !v)}><Sparkles className="h-3 w-3" />Suggest pages</button>}>
        {showSuggest ? <SuggestPanel draft={draft} onApply={applySuggestion} /> : null}
        <div className="space-y-2">
          {pages.map((p, i) => (
            <PageRow key={`${i}-${pages.length}`} p={p} i={i} n={pages.length}
              set={(patch) => setPages((cur) => cur.map((x, j) => (j === i ? { ...x, ...patch } : x)))}
              move={(d) => setPages((cur) => { const a = [...cur]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); return a; })}
              remove={() => setPages((cur) => cur.filter((_, j) => j !== i))} />
          ))}
        </div>
        <button type="button" className="btn-d w-full" onClick={() => setPages((cur) => {
          const di = cur.findIndex((p) => p.kind === "default");
          const row = { key: "", file_name: "", label: "", kind: "page", paths_note: "" };
          return di >= 0 ? [...cur.slice(0, di), row, ...cur.slice(di)] : [...cur, row];
        })}><Plus className="h-3.5 w-3.5" />Add image</button>
      </Section>

      <Section title="Notes">
        <textarea className="inp" rows={3} value={draft.notes || ""} placeholder="Anything to remember about this set" onChange={(e) => set({ notes: e.target.value })} />
      </Section>
    </div>
  );
}
