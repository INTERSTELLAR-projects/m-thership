// Quick-add lead bar, pinned at the top of Command (both modes). Business, website, Google Business Profile link,
// one line on what they do, brand and source. Optional: reference links and uploaded screen recordings or images of
// the look Justin wants (stored on the lead as lead_references). "Add & scrape" starts the scrape right away.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Paperclip, Link2, Loader2, Sparkles, ArrowUpRight, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useBrands } from "@/features/brands/useHouseData";
import { SOURCES, createLead, scrapeLead } from "./engine";

const EMPTY = { business: "", website: "", gbp_url: "", one_liner: "", brand_id: "", source: "referral", links: "", files: [] };
const input = "h-10 w-full min-w-0 border border-hair bg-paper px-3 text-[13px] outline-none placeholder:text-ink/35 focus:border-[#ff3c00]";

export default function QuickAddLead({ compact = false }) {
  const [f, setF] = useState(EMPTY);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState(null);
  const [err, setErr] = useState("");
  const { data: brands = [] } = useBrands();
  const qc = useQueryClient();
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const upload = async (e) => {
    const list = [...(e.target.files || [])].slice(0, 6);
    if (!list.length) return;
    setBusy("upload");
    try {
      const up = [];
      for (const file of list) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        up.push({ kind: "file", url: file_url, name: file.name, type: file.type || "", note: "Look reference" });
      }
      setF((x) => ({ ...x, files: [...x.files, ...up] }));
    } catch { setErr("Upload failed. Try a smaller file."); } finally { setBusy(""); e.target.value = ""; }
  };

  const submit = async (scrape) => {
    if (!f.business.trim()) { setErr("Add the business name."); return; }
    setErr(""); setBusy(scrape ? "scrape" : "add");
    try {
      const links = f.links.split(/\s+/).map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u)).map((url) => ({ kind: "link", url, name: url }));
      const lead = await createLead({ ...f, references: [...links, ...f.files] });
      let res = null;
      if (scrape) res = await scrapeLead(lead.id).catch((e) => ({ error: e?.response?.data?.error || e?.message }));
      setDone({ lead, res });
      setF(EMPTY); setMore(false);
      qc.invalidateQueries({ queryKey: ["CRMClient"] });
    } catch (e) {
      setErr(e?.message || "Could not add the lead.");
    } finally { setBusy(""); }
  };

  return (
    <section className="border border-hair bg-paper/90" aria-label="Quick-add lead" data-testid="quick-add-lead">
      <form onSubmit={(e) => { e.preventDefault(); submit(true); }} className="p-3 md:p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="label-cross text-[10.5px]">(Add lead) · any source, any brand</p>
          <button type="button" onClick={() => setMore((v) => !v)} className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45 hover:text-[#ff3c00]">{more ? "Less" : "References +"}</button>
        </div>
        <div className={`grid gap-2 ${compact ? "md:grid-cols-[1.2fr_1fr_1fr]" : "md:grid-cols-[1.2fr_1fr_1fr_1.4fr]"}`}>
          <input value={f.business} onChange={set("business")} placeholder="Business name" aria-label="Business name" className={input} />
          <input value={f.website} onChange={set("website")} placeholder="Website" aria-label="Website" className={input} />
          <input value={f.gbp_url} onChange={set("gbp_url")} placeholder="Google Business Profile link" aria-label="Google Business Profile link" className={input} />
          <input value={f.one_liner} onChange={set("one_liner")} placeholder="What they do, one line" aria-label="What they do" className={`${input} ${compact ? "md:col-span-3" : ""}`} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={f.brand_id} onChange={set("brand_id")} aria-label="Brand" className="h-9 border border-hair bg-paper px-2 text-[12.5px]">
            <option value="">Interstellar</option>
            {brands.filter((b) => b.slug !== "interstellar").map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div role="group" aria-label="Source" className="flex flex-wrap gap-1">
            {SOURCES.map((s) => (
              <button key={s.value} type="button" aria-pressed={f.source === s.value} onClick={() => setF((x) => ({ ...x, source: s.value }))}
                className={`h-9 px-2.5 text-[12px] ${f.source === s.value ? "bg-ink text-white" : "border border-hair text-ink/65 hover:border-ink/40"}`}>{s.label}</button>
            ))}
          </div>
          <div className="ml-auto flex gap-1.5">
            <button type="button" disabled={!!busy} onClick={() => submit(false)} className="inline-flex h-9 items-center gap-1.5 border border-hair px-3 text-[12.5px] hover:border-ink disabled:opacity-50">
              {busy === "add" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Add
            </button>
            <button type="submit" disabled={!!busy} className="inline-flex h-9 items-center gap-1.5 bg-[#ff3c00] px-3 text-[12.5px] font-medium text-white hover:bg-ink disabled:opacity-50">
              {busy === "scrape" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{busy === "scrape" ? "Scraping…" : "Add & scrape"}
            </button>
          </div>
        </div>
        {more ? (
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Link2 className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-ink/35" />
              <textarea value={f.links} onChange={set("links")} rows={2} placeholder="Reference links (sites whose look he likes), one per line" aria-label="Reference links" className="w-full border border-hair bg-paper py-2 pl-8 pr-3 text-[12.5px] outline-none focus:border-[#ff3c00]" />
            </label>
            <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 self-start border border-dashed border-hair px-3 text-[12.5px] text-ink/65 hover:border-[#ff3c00]">
              {busy === "upload" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}Screen recording or images
              <input type="file" accept="video/*,image/*" multiple onChange={upload} className="sr-only" />
            </label>
            {f.files.length ? <ul className="flex flex-wrap gap-1.5 md:col-span-2">{f.files.map((x, i) => <li key={x.url} className="inline-flex items-center gap-1 border border-hair px-2 py-1 text-[11.5px] text-ink/65">{x.name}<button type="button" aria-label={`Remove ${x.name}`} onClick={() => setF((y) => ({ ...y, files: y.files.filter((_, k) => k !== i) }))}><X className="h-3 w-3" /></button></li>)}</ul> : null}
          </div>
        ) : null}
        {err ? <p className="mt-2 text-[12px] text-red-700" role="alert">{err}</p> : null}
        {done ? (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-ink/70" role="status">
            <b className="font-medium text-ink">{done.lead.business}</b> added as a lead
            {done.res ? (done.res.error ? <span className="text-red-700">· scrape failed: {done.res.error}</span> : <span>· scraped, Brain {done.res.completeness ?? 0}%{done.res.not_found?.length ? ` · ${done.res.not_found.length} not found` : ""}</span>) : null}
            <Link to={`/clients/${done.lead.id}`} className="inline-flex items-center gap-0.5 text-[#ff3c00] hover:underline">Open lead card<ArrowUpRight className="h-3 w-3" /></Link>
          </p>
        ) : null}
      </form>
    </section>
  );
}
