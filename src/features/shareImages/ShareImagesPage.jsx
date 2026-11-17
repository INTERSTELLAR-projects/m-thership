// Share images (/share-images): Justin's 1200x630 social sharing (Open Graph) images for every client website,
// drawn in the browser from a per-client ShareImageProfile (brand background, colors, logo, display font, page list).
// One image per standalone page, one per group of related pages, plus home and the default fallback.
// Download one JPG or the whole set as a ZIP named exactly <file_name>.jpg. Nothing is pushed to client sites here
// (see share-images/PUSH-PLAN.md for that plan).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Download, ExternalLink, ImagePlus, Save } from "lucide-react";
import "@/features/agents/agents.css";
import "./shareImages.css";
import Starfield from "@/features/agents/Starfield";
import { Spinner } from "@/features/agents/ui";
import { base44 } from "@/api/base44Client";
import Editor from "./Editor";
import Previews, { downloadZip } from "./Previews";
import { PRESETS, prepareAssets, clearBackgroundCache } from "./render";

const E = base44.entities;

const STARTER_PAGES = [
  { key: "home", file_name: "og-home", label: "", kind: "home", paths_note: "/" },
  { key: "about", file_name: "og-about", label: "About", kind: "page", paths_note: "/about" },
  { key: "contact", file_name: "og-contact", label: "Contact", kind: "page", paths_note: "/contact" },
  { key: "legal", file_name: "og-legal", label: "Legal", kind: "group", paths_note: "/privacy, /terms" },
  { key: "default", file_name: "og-default", label: "", kind: "default", paths_note: "any page without its own image" },
];

const FIELDS = ["client_id", "client_name", "site_app_id", "site_domain", "logo_url", "logo_dark_url", "background_style", "colors", "background_image_url", "font_family", "font_url", "font_weight", "label_case", "options", "pages", "notes"];
const pick = (o) => Object.fromEntries(FIELDS.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

function newDraft(client) {
  return {
    client_id: client.id, client_name: client.business || client.domain || "Client", site_app_id: client.site_app_id || "", site_domain: client.domain || "",
    logo_url: "", logo_dark_url: "", background_style: "gradient", colors: { ...PRESETS.gradient.colors }, background_image_url: "",
    font_family: "", font_url: "", font_weight: 800, label_case: "upper", options: {}, pages: STARTER_PAGES.map((p) => ({ ...p })), notes: "",
  };
}

function ClientPicker({ clients, profiles, onPick }) {
  const byClient = new Map(profiles.map((p) => [p.client_id, p]));
  const sorted = [...clients].sort((a, b) => Number(byClient.has(b.id)) - Number(byClient.has(a.id)) || String(a.business || a.domain).localeCompare(String(b.business || b.domain)));
  return (
    <div className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {sorted.map((c, i) => {
        const p = byClient.get(c.id);
        const preset = p ? PRESETS[p.background_style] : null;
        return (
          <button key={c.id} type="button" className="card thumb-in flex items-center gap-3 p-3.5" style={{ animation: `shi-in .5s cubic-bezier(.22,1,.36,1) ${Math.min(i, 20) * 30}ms both` }} onClick={() => onPick(c.id)}>
            <span className="h-10 w-16 shrink-0 rounded-md border border-[var(--hair-d2)]" style={{ background: preset ? `linear-gradient(135deg, ${p.colors?.primary || preset.colors.primary}, ${p.colors?.secondary || preset.colors.secondary} 70%, ${p.colors?.accent || preset.colors.accent})` : "rgba(255,255,255,.03)" }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-white">{c.business || c.domain}</span>
              <span className="mono block truncate text-[10.5px] text-[var(--ink-s)]">{p ? `${(p.pages || []).length} images · ${preset?.label || p.background_style}` : "Not set up yet"}{c.domain ? ` · ${c.domain}` : ""}</span>
            </span>
            {p ? <Check className="h-4 w-4 shrink-0 text-[#ff8a3d]" /> : <ImagePlus className="h-4 w-4 shrink-0 text-[var(--ink-s)]" />}
          </button>
        );
      })}
    </div>
  );
}

export default function ShareImagesPage() {
  const [params, setParams] = useSearchParams();
  const clientId = params.get("client") || "";
  const [clients, setClients] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loadErr, setLoadErr] = useState("");
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(null);
  const [assets, setAssets] = useState(null);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [zip, setZip] = useState("");

  const load = useCallback(async () => {
    try {
      const [cl, pr] = await Promise.all([E.CRMClient.list("business", 300), E.ShareImageProfile.list("-updated_date", 200)]);
      setClients((cl || []).filter((c) => c.status !== "Inactive" && c.status !== "Lost"));
      setProfiles(pr || []);
    } catch (e) { setLoadErr(e?.message || "Could not load"); setClients([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Open the chosen client's profile (or a fresh unsaved draft).
  useEffect(() => {
    if (!clientId || !clients) { setDraft(null); setSaved(null); return; }
    const prof = profiles.find((p) => p.client_id === clientId);
    const client = clients.find((c) => c.id === clientId);
    if (prof) { setDraft(structuredClone(prof)); setSaved(JSON.stringify(pick(prof))); }
    else if (client) { setDraft(newDraft(client)); setSaved(null); }
    setMsg("");
    // only when the client changes or the list first arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, clients]);

  // Fonts, logo and photo: reload only when their sources change.
  const assetKey = draft ? JSON.stringify([draft.logo_url, draft.font_url, draft.font_family, draft.font_weight, draft.background_style, draft.background_image_url]) : "";
  useEffect(() => {
    if (!draft) { setAssets(null); return undefined; }
    let live = true;
    setLoadingAssets(true);
    const t = setTimeout(async () => {
      const a = await prepareAssets(draft);
      if (!live) return;
      clearBackgroundCache();
      setAssets(a); setLoadingAssets(false);
    }, 250);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetKey]);

  // Debounced copy of the draft for drawing, so typing stays smooth.
  const [renderProfile, setRenderProfile] = useState(null);
  useEffect(() => { const t = setTimeout(() => setRenderProfile(draft), 180); return () => clearTimeout(t); }, [draft]);

  const dirty = draft ? JSON.stringify(pick(draft)) !== saved : false;
  const dupes = useMemo(() => {
    const seen = new Set(); const d = new Set();
    (draft?.pages || []).forEach((p) => { if (seen.has(p.file_name)) d.add(p.file_name); seen.add(p.file_name); });
    return d;
  }, [draft]);
  const missingNames = (draft?.pages || []).some((p) => !p.file_name);

  const save = async () => {
    if (!draft) return;
    if (dupes.size || missingNames) { setMsg("Every image needs its own file name before saving."); return; }
    setSaving(true); setMsg("");
    try {
      const body = { ...pick(draft), updated_at: new Date().toISOString() };
      const rec = draft.id ? await E.ShareImageProfile.update(draft.id, body) : await E.ShareImageProfile.create(body);
      const merged = { ...draft, ...body, id: rec?.id || draft.id };
      setDraft(merged); setSaved(JSON.stringify(pick(merged)));
      setProfiles((ps) => [merged, ...ps.filter((p) => p.id !== merged.id)]);
      setMsg("Saved");
    } catch (e) { setMsg(e?.message || "Could not save"); }
    setSaving(false);
  };

  const zipAll = async () => {
    if (!renderProfile || !assets) return;
    setZip("0");
    try { await downloadZip(renderProfile, assets, (i, n) => setZip(`${i}/${n}`)); }
    catch (e) { setMsg(e?.message || "ZIP failed"); }
    setZip("");
  };

  const client = clients?.find((c) => c.id === clientId);
  const pickClient = (id) => setParams(id ? { client: id } : {});

  return (
    <div className="agx shi grain-d relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-60"><Starfield /></div>
      <div className="shi-wrap">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-[var(--hair-d)] pb-4 pt-5">
          <div className="min-w-0">
            <p className="eyebrow flex items-center gap-2"><span className="inline-block h-[9px] w-[9px]" style={{ background: "linear-gradient(#ff3c00,#ff3c00) center/100% 1.5px no-repeat, linear-gradient(#ff3c00,#ff3c00) center/1.5px 100% no-repeat" }} />(Clients)</p>
            <h1 className="mt-1.5 text-[30px] font-semibold leading-[0.95] tracking-[-0.045em] text-white md:text-[40px]">Share <span className="text-[#ff3c00]">/Images</span></h1>
            <p className="mt-2 max-w-xl text-[13px] text-[var(--ink-m)]">
              {draft ? <>The 1200 × 630 images that show when {draft.client_name || "this client"}'s pages are shared. One per page, one per group of related pages, plus home and the default.</> : "Pick a client to design their social sharing images. One per page, one per group of related pages, plus home and the default."}
            </p>
          </div>
          {draft ? (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-d" onClick={() => pickClient("")}><ArrowLeft className="h-3.5 w-3.5" />All clients</button>
              <select className="inp !w-auto" value={clientId} onChange={(e) => pickClient(e.target.value)} aria-label="Client">
                {(clients || []).map((c) => <option key={c.id} value={c.id}>{c.business || c.domain}</option>)}
              </select>
              {draft.site_domain ? <a className="btn-d" href={`https://${draft.site_domain}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />{draft.site_domain}</a> : null}
              <button type="button" className="btn-d" onClick={save} disabled={saving || (!dirty && !!draft.id)}>{saving ? <Spinner /> : <Save className="h-3.5 w-3.5" />}{draft.id ? (dirty ? "Save changes" : "Saved") : "Save profile"}</button>
              <button type="button" className="btn-f" onClick={zipAll} disabled={!!zip || !assets || !(draft.pages || []).length}>{zip ? <><Spinner />{zip}</> : <><Download className="h-3.5 w-3.5" />Download all (.zip)</>}</button>
            </div>
          ) : null}
        </header>

        {clients === null ? (
          <div className="grid min-h-[50vh] place-items-center"><div className="flex items-center gap-3 text-[13px] text-[var(--ink-m)]"><Spinner size={18} />Loading clients…</div></div>
        ) : loadErr ? (
          <div className="grid min-h-[40vh] place-items-center text-[13px] text-[#ff8a7f]">Couldn't load: {loadErr}</div>
        ) : !draft ? (
          <ClientPicker clients={clients} profiles={profiles} onPick={pickClient} />
        ) : (
          <div className="grid gap-5 pt-5 lg:grid-cols-[400px_1fr]">
            <div className="lg:sticky lg:top-3 lg:max-h-[calc(100dvh-24px)] lg:overflow-y-auto lg:pr-1 scroll-d">
              <Editor draft={draft} setDraft={setDraft} notes={assets?.notes || []} />
            </div>
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--ink-m)]">
                <span className="mono text-[10.5px] uppercase tracking-[.14em] text-[var(--ink-s)]">{(draft.pages || []).length} images · 1200 × 630 · JPG 90</span>
                {assets?.font ? <span>Font: <span className="text-white">{assets.font.name}</span></span> : null}
                {loadingAssets ? <span className="flex items-center gap-1.5"><Spinner size={11} />Loading logo and font…</span> : null}
                {!draft.logo_url ? <span className="text-[#ffb27a]">Add a logo to see the real set.</span> : null}
                {dirty ? <span className="text-[#ffb27a]">Unsaved changes</span> : null}
                {msg ? <span className="text-white">{msg}</span> : null}
              </div>
              {renderProfile && assets ? <Previews profile={renderProfile} assets={assets} dupes={dupes} /> : (
                <div className="grid min-h-[30vh] place-items-center"><Spinner size={18} /></div>
              )}
              {client && !draft.id ? <p className="text-[12px] text-[var(--ink-s)]">This set isn't saved yet. Save profile keeps it for next time.</p> : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
