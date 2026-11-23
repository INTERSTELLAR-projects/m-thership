// Portfolio (admin): one card per launched client website. Cards arrive as drafts (auto on launch, or seeded from
// verified custom domains); publish with one click. Preview images: the site's og:image, uploaded desktop / phone
// screenshots, and a live link. Results show publicly only when marked verified with a source.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ExternalLink, Eye, EyeOff, ImagePlus, Loader2, Plus, RefreshCw, Upload, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { base44 } from "@/api/base44Client";
import { call } from "./api";
import { useQuery } from "@tanstack/react-query";
import { Card, Pill, Loading, ErrorNote, Empty, btn, btnFlame, btnInk, input, area } from "./ui";
import { BUILT_LABEL, CaseStudy } from "./PortfolioView";

const pf = (action, args) => call("portfolio", action, args);
const PUBLIC_PATH = "/functions/portfolio";

export default function PortfolioPage() {
  const q = useQuery({ queryKey: ["portfolio", "list"], queryFn: () => pf("list"), retry: false });
  const [edit, setEdit] = useState(null);
  const [view, setView] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const items = q.data?.items || [];
  const act = async (key, action, args, done) => { setBusy(key); setMsg(""); try { const r = await pf(action, args); if (done) setMsg(typeof done === "function" ? done(r) : done); q.refetch(); } catch (e) { setMsg(e.message); } setBusy(""); };
  // Fill missing og:images once on open (reads only the public homepage).
  useEffect(() => { const ids = items.filter((i) => !i.og_image && !i.og_checked_at).map((i) => i.id); if (ids.length) pf("refresh_og", { ids }).then(() => q.refetch()).catch(() => null); }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="pb-20">
      <PageHeader breadcrumb="Leads / Portfolio" title="Our /Portfolio" rightText={`${items.filter((i) => i.status === "published").length} published · ${items.filter((i) => i.status === "draft").length} drafts`}>
        <a href={PUBLIC_PATH} target="_blank" rel="noreferrer" className={btn}><ExternalLink className="h-3.5 w-3.5" />Public page</a>
        <button type="button" onClick={() => setEdit({ built: ["website"], highlights: [], results: [], show_client_name: true })} className={btnFlame}><Plus className="h-3.5 w-3.5" />Add site</button>
      </PageHeader>
      <div className="space-y-4 px-4 pt-5 md:px-8">
        <div className="flex flex-wrap items-center gap-3 border border-hair bg-paper/85 px-4 py-3 text-[12.5px]">
          <span className="text-ink/65">Sites are added as drafts automatically when their own domain goes live.</span>
          <button type="button" onClick={() => act("sync", "sync", {}, (r) => `${(r.results || []).filter((x) => x.created).length} new draft(s) from launched sites.`)} disabled={!!busy} className={btn}>{busy === "sync" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Sync launched sites</button>
          <label className="ml-auto flex items-center gap-2"><input type="checkbox" checked={!!q.data?.noindex} onChange={(e) => act("noindex", "settings", { noindex: e.target.checked }, "Saved.")} className="accent-[#ff3c00]" />Hide public page from search engines (noindex)</label>
        </div>
        {msg ? <p role="status" className="text-[12.5px] text-ink/70">{msg}</p> : null}
        {q.isLoading ? <Loading /> : q.isError ? <ErrorNote error={q.error} /> : !items.length ? <Card><Empty icon={ImagePlus} title="No sites yet" hint="Launched sites land here as drafts. Add one by hand anytime." /></Card> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="portfolio-grid">
            {items.map((i) => {
              const img = i.image_desktop || i.og_image;
              return (
                <article key={i.id} className="border border-hair bg-paper">
                  <div className="relative aspect-[16/10] overflow-hidden bg-ink">
                    {img ? <img src={img} alt="" className="h-full w-full object-cover object-top" /> : <div className="grid h-full place-items-center font-mono text-[11px] uppercase tracking-[0.16em] text-white/70">{i.domain}</div>}
                    {!i.image_desktop ? <span className="absolute left-2 top-2 bg-amber-400 px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-ink">needs screenshot</span> : null}
                    {i.image_phone ? null : <span className="absolute right-2 top-2 bg-white/90 px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-ink">no phone shot</span>}
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="mono-label text-[9px] text-ink/45">{i.industry || "Industry?"}</p><p className="truncate text-[16px] font-semibold tracking-[-0.02em]">{i.client_name}</p></div><Pill tone={i.status === "published" ? "green" : i.status === "hidden" ? "muted" : "amber"}>{i.status}</Pill></div>
                    <a href={i.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] text-[#ff3c00] hover:underline">{i.domain}<ExternalLink className="h-3 w-3" /></a>
                    <p className="text-[12px] text-ink/55">{i.launched_at ? `Launched ${new Date(i.launched_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}{i.source === "seed" ? " · verified domain" : i.source === "auto" ? " · added on launch" : ""}</p>
                    <div className="flex flex-wrap gap-1">{(i.built || []).map((b) => <span key={b} className="bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-ink/65">{BUILT_LABEL[b]}</span>)}</div>
                    {!i.objective || !(i.highlights || []).length ? <p className="text-[11.5px] text-[#c24100]">Add the objective and 2–4 highlights before publishing.</p> : null}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {i.status !== "published" ? <button type="button" onClick={() => act(i.id, "set_status", { id: i.id, status: "published" }, `${i.client_name} published.`)} disabled={!!busy} className={btnFlame}><Check className="h-3.5 w-3.5" />Publish</button> : <button type="button" onClick={() => act(i.id, "set_status", { id: i.id, status: "hidden" }, "Hidden.")} disabled={!!busy} className={btn}><EyeOff className="h-3.5 w-3.5" />Hide</button>}
                      <button type="button" onClick={() => setEdit(i)} className={btn}>Edit</button>
                      <button type="button" onClick={() => setView(i)} className={btn}><Eye className="h-3.5 w-3.5" />Case study</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      {edit ? <EditDrawer item={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); q.refetch(); }} /> : null}
      {/* Overlays render into <body>: the page wrapper's enter animation leaves a transform, which would pin
          `fixed` to the (scrolled) page instead of the viewport and open them off-screen. */}
      {view ? createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas p-4 md:p-10" role="dialog" aria-modal="true" aria-label="Case study preview">
          <button type="button" onClick={() => setView(null)} className="fixed right-3 top-3 z-[60] inline-flex h-9 items-center gap-1.5 bg-ink px-3 text-[12.5px] text-white"><X className="h-3.5 w-3.5" />Close</button>
          <div className="mx-auto max-w-[1180px]"><CaseStudy item={{ ...view, name: view.show_client_name === false ? `${view.industry || "Local business"} website` : view.client_name, results: (view.results || []).filter((r) => r.verified_by) }} /></div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function EditDrawer({ item, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ ...item, highlightsText: (item.highlights || []).join("\n"), results: (item.results || []).map((r) => ({ ...r, verified: !!r.verified_by })) }));
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const upload = async (key, file) => {
    if (!file) return;
    setBusy(key);
    try { const { file_url } = await base44.integrations.Core.UploadFile({ file }); set(key, file_url); } catch { setErr("Upload failed."); }
    setBusy("");
  };
  const save = async () => {
    setBusy("save"); setErr("");
    try { await pf("save", { item: { ...f, highlights: f.highlightsText.split("\n").map((x) => x.trim()).filter(Boolean) } }); onSaved(); } catch (e) { setErr(e.message); }
    setBusy("");
  };
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" role="dialog" aria-modal="true" aria-label="Edit portfolio site">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-hair bg-canvas p-5">
        <div className="flex items-center justify-between"><p className="text-[16px] font-semibold">{item.id ? `Edit ${item.client_name}` : "Add a site"}</p><button type="button" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button></div>
        <div className="mt-4 space-y-3 text-[12.5px]">
          <label className="block">Client name<input value={f.client_name || ""} onChange={(e) => set("client_name", e.target.value)} className={`${input} mt-1`} /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.show_client_name !== false} onChange={(e) => set("show_client_name", e.target.checked)} className="accent-[#ff3c00]" />Show the client's name publicly</label>
          <div className="grid grid-cols-2 gap-2"><label>Industry<input value={f.industry || ""} onChange={(e) => set("industry", e.target.value)} className={`${input} mt-1`} /></label><label>Live URL (https)<input value={f.url || ""} onChange={(e) => set("url", e.target.value)} className={`${input} mt-1`} /></label></div>
          <label className="block">One-line description<input value={f.description || ""} onChange={(e) => set("description", e.target.value)} className={`${input} mt-1`} /></label>
          <label className="block">The objective (what they needed / the goal)<textarea rows={3} value={f.objective || ""} onChange={(e) => set("objective", e.target.value)} className={`${area} mt-1`} /></label>
          <div><p>What we built</p><div className="mt-1 flex flex-wrap gap-1.5">{Object.entries(BUILT_LABEL).map(([k, l]) => { const on = (f.built || []).includes(k); return <button key={k} type="button" onClick={() => set("built", on ? f.built.filter((x) => x !== k) : [...(f.built || []), k])} className={`px-2.5 py-1 ${on ? "bg-ink text-white" : "border border-hair bg-card"}`}>{l}</button>; })}</div></div>
          <label className="block">Approach / highlights (2–4, one per line)<textarea rows={4} value={f.highlightsText} onChange={(e) => set("highlightsText", e.target.value)} className={`${area} mt-1`} /></label>
          <div>
            <p>Results (only real numbers you can point to; unverified rows never show)</p>
            {(f.results || []).map((r, i) => (
              <div key={i} className="mt-1.5 grid grid-cols-[1fr_1fr_auto_auto] items-center gap-1.5">
                <input value={r.text} onChange={(e) => set("results", f.results.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} placeholder="Result" className={input} />
                <input value={r.source || ""} onChange={(e) => set("results", f.results.map((x, k) => (k === i ? { ...x, source: e.target.value } : x)))} placeholder="Source (e.g. Search Console, Oct)" className={input} />
                <label className="flex items-center gap-1"><input type="checkbox" checked={!!r.verified} onChange={(e) => set("results", f.results.map((x, k) => (k === i ? { ...x, verified: e.target.checked } : x)))} className="accent-[#ff3c00]" />Verified</label>
                <button type="button" aria-label="Remove" onClick={() => set("results", f.results.filter((_, k) => k !== i))}><X className="h-4 w-4 text-ink/40" /></button>
              </div>
            ))}
            <button type="button" onClick={() => set("results", [...(f.results || []), { text: "", source: "", verified: false }])} className={`${btn} mt-1.5`}><Plus className="h-3.5 w-3.5" />Result</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[["image_desktop", "Desktop screenshot"], ["image_phone", "Phone screenshot"]].map(([k, l]) => (
              <div key={k}><p>{l}</p><div className="mt-1 aspect-[16/10] overflow-hidden border border-hair bg-ink/[0.05]">{f[k] ? <img src={f[k]} alt="" className="h-full w-full object-cover object-top" /> : <div className="grid h-full place-items-center text-[11px] text-ink/45">needs screenshot</div>}</div>
                <label className={`${btn} mt-1.5 cursor-pointer`}>{busy === k ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}Upload<input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(k, e.target.files?.[0])} /></label></div>
            ))}
          </div>
          {f.og_image ? <p className="text-ink/55">Using the site's own share image until a screenshot is uploaded.</p> : null}
          {err ? <p role="alert" className="text-red-700">{err}</p> : null}
          <div className="flex gap-2 pt-2"><button type="button" onClick={save} disabled={!!busy} className={btnInk}>{busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Save</button><button type="button" onClick={onClose} className={btn}>Cancel</button></div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
