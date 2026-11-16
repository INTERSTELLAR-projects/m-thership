// "Add brand": creates one Brand record under the Interstellar root. Inline validation, no browser dialogs.
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import "@/features/agents/agents.css";
import "./brands.css";
import { brandErrors, rootOf, slugify, STATUS_LABEL } from "./graph";
import { useRefreshHouse } from "./useHouseData";

const EMPTY = { name: "", slug: "", tagline: "", niche: "", status: "planned", website_url: "", template_app_id: "", logo_url: "", offer_summary: "", notes: "", colors: { primary: "#ff6a00", accent: "#ffaa00", background: "#07080d" } };

function Row({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="mono mb-1.5 block text-[9.5px] uppercase tracking-[.14em] text-[var(--ink-s)]">{label}</span>
      {children}
      {error ? <span className="err block" role="alert">{error}</span> : hint ? <span className="mt-1 block text-[11px] text-[var(--ink-s)]">{hint}</span> : null}
    </label>
  );
}

export default function AddBrandDialog({ open, brands = [], onClose, onCreated }) {
  const [v, setV] = useState(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const first = useRef(null);
  const refresh = useRefreshHouse();

  useEffect(() => {
    if (!open) return undefined;
    setV(EMPTY); setSlugTouched(false); setErrors({}); setFail(""); setBusy(false);
    const t = setTimeout(() => first.current?.focus(), 30);
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const set = (k, val) => setV((s) => ({ ...s, [k]: val, ...(k === "name" && !slugTouched ? { slug: slugify(val) } : {}) }));
  const setColor = (k, val) => setV((s) => ({ ...s, colors: { ...s.colors, [k]: val } }));

  const submit = async (e) => {
    e.preventDefault();
    const clean = { ...v, name: v.name.trim(), slug: v.slug.trim(), template_app_id: v.template_app_id.trim() };
    const errs = brandErrors(clean, brands);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const root = rootOf(brands);
    setBusy(true); setFail("");
    try {
      const rec = {
        ...clean,
        parent_brand_id: root ? root.id : "",
        brand_app_ids: [],
        sort_order: brands.reduce((m, b) => Math.max(m, Number(b.sort_order) || 0), 0) + 1,
      };
      const created = await base44.entities.Brand.create(rec);
      refresh();
      onCreated?.(created || rec);
      onClose();
    } catch (err) {
      setFail(`Couldn't save the brand: ${String(err?.message || err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="agx hb-dialog fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[6vh]" style={{ background: "rgba(0,0,0,.62)" }} onMouseDown={onClose} role="dialog" aria-modal="true" aria-labelledby="hb-add-title" data-testid="add-brand-dialog">
      <form onSubmit={submit} onMouseDown={(e) => e.stopPropagation()} className="glass w-full max-w-xl rounded-2xl" noValidate>
        <div className="flex items-center justify-between border-b border-[var(--hair-d)] px-5 py-4">
          <div>
            <p className="eyebrow">House of Brands</p>
            <h2 id="hb-add-title" className="mt-0.5 text-[19px] font-semibold tracking-[-0.03em] text-white">Add a brand</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-[var(--ink-s)] hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[64vh] space-y-4 overflow-y-auto px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Row label="Brand name *" error={errors.name}><input ref={first} className="inp" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. a niche brand name" /></Row>
            <Row label="URL key *" error={errors.slug} hint={v.slug ? `/brands/${v.slug}` : "Lowercase, dashes"}><input className="inp mono" value={v.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase()); }} /></Row>
          </div>
          <Row label="Niche / industry" hint="The one industry this brand sells the 45-day rebuild into"><input className="inp" value={v.niche} onChange={(e) => set("niche", e.target.value)} /></Row>
          <Row label="Tagline"><input className="inp" value={v.tagline} onChange={(e) => set("tagline", e.target.value)} /></Row>
          <div className="grid gap-4 sm:grid-cols-2">
            <Row label="Status">
              <select className="inp" value={v.status} onChange={(e) => set("status", e.target.value)}>
                {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k} style={{ background: "#11131b" }}>{l}</option>)}
              </select>
            </Row>
            <Row label="Template app id" error={errors.template_app_id} hint="Its brain syncs as this brand's brain"><input className="inp mono" value={v.template_app_id} onChange={(e) => set("template_app_id", e.target.value)} /></Row>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[["primary", "Primary"], ["accent", "Accent"], ["background", "Background"]].map(([k, l]) => (
              <Row key={k} label={l} error={errors[`colors.${k}`]}>
                <span className="flex items-center gap-2">
                  <input type="color" aria-label={`${l} color picker`} value={/^#[0-9a-f]{6}$/i.test(v.colors[k]) ? v.colors[k] : "#000000"} onChange={(e) => setColor(k, e.target.value)} className="h-[34px] w-10 shrink-0 cursor-pointer rounded-md border border-[var(--hair-d2)] bg-transparent p-0.5" />
                  <input className="inp mono min-w-0" value={v.colors[k]} onChange={(e) => setColor(k, e.target.value.trim())} aria-label={`${l} color hex`} />
                </span>
              </Row>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Row label="Website"><input className="inp" value={v.website_url} onChange={(e) => set("website_url", e.target.value)} placeholder="https://" /></Row>
            <Row label="Logo URL"><input className="inp" value={v.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://" /></Row>
          </div>
          <Row label="Offer summary" hint="What the brand sells, in plain words"><textarea rows={3} className="inp" value={v.offer_summary} onChange={(e) => set("offer_summary", e.target.value)} /></Row>
          {fail ? <p className="err" role="alert">{fail}</p> : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--hair-d)] px-5 py-4">
          <button type="button" onClick={onClose} className="h-9 px-3 text-[13px] text-[var(--ink-m)] hover:text-white">Cancel</button>
          <button type="submit" disabled={busy} className="btn-d !border-[#ff6a00]/60 !bg-[#ff3c00]/20 hover:!bg-[#ff3c00]/30" data-testid="add-brand-submit">{busy ? "Saving…" : "Add brand"}</button>
        </div>
      </form>
    </div>
  );
}
