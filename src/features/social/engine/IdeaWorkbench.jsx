import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Save, Scissors, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { TEMPLATES, switchTemplate } from "../templates";
import { Btn, Field, Panel, Select, TextInput, copyText } from "../ui";
import { RATIOS } from "./platforms";
import { Fit, RatioCanvas, SlideCanvas, slidesOf } from "./Ratios";
import { KEYS } from "./store";

// The idea's extraction (hook bank, Triple Hooks, quotes, carousel, clips) and 03 DESIGN: one visual shown at every
// platform ratio. Editing the design marks already-rendered variant images stale (they re-render on approval).

const SHOW = ["ig_feed", "square", "story", "yt_thumb", "wide", "pin", "gbp"];

export default function IdeaWorkbench({ eng, idea, onClose, onReview }) {
  const qc = useQueryClient();
  const { brand } = eng;
  const ex = idea.extraction || {};
  const [design, setDesign] = useState(idea.design || {});
  const [slides, setSlides] = useState(ex.carousel?.slides || []);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setDesign(idea.design || {}); setSlides(idea.extraction?.carousel?.slides || []); setDirty(false); }, [idea.id, idea.design, idea.extraction]);
  const spec = design.spec || {};
  const setSpec = (k, v) => { setDesign((d) => ({ ...d, spec: { ...(d.spec || {}), [k]: v } })); setDirty(true); };
  const live = { ...idea, design, extraction: { ...ex, carousel: { ...(ex.carousel || {}), slides } } };
  const variants = eng.variants.filter((v) => v.idea_id === idea.id);
  const setSlide = (i, k, v) => { setSlides((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x))); setDirty(true); };

  const save = async () => {
    try {
      await base44.entities.SocialIdea.update(idea.id, { design, extraction: live.extraction });
      setDirty(false);
      qc.invalidateQueries({ queryKey: KEYS.ideas(brand.key) });
      toast({ title: "Design saved", description: "Approved images re-render when you approve again." });
    } catch (e) { toast({ title: "Couldn't save", description: String(e?.message || e), variant: "destructive" }); }
  };
  const pickHook = (h) => setSpec("headline", h);

  return (
    <div className="space-y-3">
      <Panel label={`Idea · ${idea.source_type}`} title={idea.title} right={<div className="flex gap-1"><Btn variant="ghost" onClick={onReview}>Review {variants.filter((v) => v.status === "draft").length} drafts</Btn><button type="button" onClick={onClose} className="p-1 text-ink/45 hover:text-ink" title="Close"><X className="h-4 w-4" /></button></div>} bodyClass="space-y-3 p-3.5">
        {ex.summary && <p className="text-[12.5px] leading-snug text-ink/70">{ex.summary}</p>}
        {ex.primary_keyword && <p className="font-mono text-[10.5px] text-ink/55">Search phrase: <b className="text-ink">{ex.primary_keyword}</b>{ex.secondary_keyword ? ` · ${ex.secondary_keyword}` : ""}</p>}

        <div>
          <p className="mono-label mb-1 text-[9px] text-ink/50">Triple Hooks · context → lean → snapback</p>
          <div className="grid gap-2">
            {(ex.triple_hooks || []).map((h, i) => (
              <div key={i} className="border border-hair bg-paper p-2.5">
                <div className="grid gap-1 text-[12px] leading-snug">
                  <p><span className="mono-label mr-1.5 text-[8.5px] text-[#ff3c00]">Context</span>{h.context}</p>
                  <p><span className="mono-label mr-1.5 text-[8.5px] text-[#ff6a00]">Lean</span>{h.lean}</p>
                  <p><span className="mono-label mr-1.5 text-[8.5px] text-[#c47a00]">Snapback</span>{h.snapback}</p>
                </div>
                <div className="mt-1.5 flex gap-1">
                  <Btn variant="ghost" className="h-7 px-1.5 text-[11px]" onClick={() => pickHook(h.context)}>Use context line as headline</Btn>
                  <Btn variant="ghost" className="h-7 px-1.5 text-[11px]" onClick={async () => (await copyText(h.full)) && toast({ title: "Copied" })}><Copy className="h-3 w-3" />Copy</Btn>
                </div>
              </div>
            ))}
            {!ex.triple_hooks?.length && <p className="text-[12px] text-ink/45">No Triple Hooks yet.</p>}
          </div>
        </div>

        {ex.hooks?.length > 0 && (
          <details className="border border-hair bg-card">
            <summary className="cursor-pointer px-2.5 py-2 text-[12px] font-medium">Hook bank · {ex.hooks.length}</summary>
            <ol className="space-y-1 px-2.5 pb-2.5 text-[12px] leading-snug">
              {ex.hooks.map((h, i) => <li key={i} className="flex gap-2"><span className="font-mono text-[10px] text-ink/40">{String(i + 1).padStart(2, "0")}</span><button type="button" onClick={() => pickHook(h)} className="text-left hover:text-[#ff3c00]">{h}</button></li>)}
            </ol>
          </details>
        )}
        {ex.quotes?.length > 0 && (
          <details className="border border-hair bg-card">
            <summary className="cursor-pointer px-2.5 py-2 text-[12px] font-medium">Quotable lines · {ex.quotes.length}</summary>
            <ul className="space-y-1 px-2.5 pb-2.5 text-[12px] italic leading-snug text-ink/75">{ex.quotes.map((q, i) => <li key={i}>&ldquo;{q}&rdquo;</li>)}</ul>
          </details>
        )}
        <details className="border border-hair bg-card" open={!!ex.clips?.length}>
          <summary className="cursor-pointer px-2.5 py-2 text-[12px] font-medium"><Scissors className="mr-1 inline h-3.5 w-3.5" />Short-clip cut list · {ex.clips?.length || 0}</summary>
          <div className="px-2.5 pb-2.5">
            {(ex.clips || []).length === 0 && <p className="text-[11.5px] text-ink/45">No clips. Add a timestamped transcript to get a cut list.</p>}
            {(ex.clips || []).map((c, i) => (
              <div key={i} className="flex gap-2 border-t border-hair py-1.5 text-[12px] first:border-0">
                <span className="w-[86px] shrink-0 font-mono text-[10.5px] text-[#ff3c00]">{c.start ? `${c.start}–${c.end}` : "no timestamp"}</span>
                <span className="min-w-0"><b className="font-medium">{c.label}</b>{c.hook ? ` · “${c.hook}”` : ""}<span className="block text-[11px] text-ink/50">{c.why}{c.note ? ` (${c.note})` : ""}</span></span>
              </div>
            ))}
          </div>
        </details>
      </Panel>

      <Panel label="03 · Design" title="One visual → every ratio" right={<Btn variant={dirty ? "flame" : "outline"} onClick={save} disabled={!dirty}>{dirty ? <Save className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}{dirty ? "Save design" : "Saved"}</Btn>} bodyClass="space-y-3 p-3.5">
        <div className="grid gap-2 sm:grid-cols-2">
          {brand.isInterstellar && (
            <Field label="Template (Interstellar spec templates)">
              <Select value={design.template || ""} onChange={(k) => { setDesign((d) => ({ template: k, spec: k ? switchTemplate(d.spec || {}, k) : d.spec })); setDirty(true); }} placeholder="Brand card (no mockup)" options={TEMPLATES.map((t) => ({ value: t.key, label: t.label || t.key }))} />
            </Field>
          )}
          <Field label="Eyebrow"><TextInput value={spec.eyebrow} onChange={(v) => setSpec("eyebrow", v)} /></Field>
          <Field label="Headline (the search phrase or a direct answer)" className="sm:col-span-2"><TextInput value={spec.headline} onChange={(v) => setSpec("headline", v)} /></Field>
          <Field label="Accent words"><TextInput value={spec.accent_word} onChange={(v) => setSpec("accent_word", v)} /></Field>
          <Field label="CTA"><TextInput value={spec.cta} onChange={(v) => setSpec("cta", v)} /></Field>
          <Field label="Subhead" className="sm:col-span-2"><TextInput value={spec.subhead} onChange={(v) => setSpec("subhead", v)} /></Field>
        </div>
        <p className="text-[11px] text-ink/45">{brand.isInterstellar ? "Interstellar: flame gradient #ff3c00 → #ff6a00 → #ffaa00. Mock UI in templates uses fictional sample businesses." : `Colors from ${brand.name}'s Voice Guide. Edit them under Voice guide.`}</p>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {SHOW.map((k) => {
            const r = RATIOS[k];
            return (
              <figure key={k} className={k === "story" || k === "pin" ? "row-span-2" : ""}>
                <Fit w={r.w} h={r.h} className="border border-hair"><RatioCanvas ratio={k} idea={live} brand={brand} /></Fit>
                <figcaption className="mt-1 font-mono text-[9.5px] text-ink/50">{r.label} · {r.name}</figcaption>
              </figure>
            );
          })}
        </div>

        <div>
          <p className="mono-label mb-1 text-[9px] text-ink/50">Carousel / LinkedIn document · {slides.length} slides</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {slidesOf(live).map((s, i, a) => (
              <div key={i} className="w-[150px] shrink-0">
                <Fit w={1080} h={1350} className="border border-hair"><SlideCanvas slide={s} index={i} total={a.length} brand={brand} /></Fit>
              </div>
            ))}
          </div>
          <div className="mt-2 space-y-1">
            {slides.map((s, i) => (
              <div key={i} className="grid grid-cols-[22px_1fr_2fr] items-center gap-1.5">
                <span className="font-mono text-[10px] text-ink/40">{i + 1}</span>
                <TextInput value={s.heading} onChange={(v) => setSlide(i, "heading", v)} className="h-8 py-1 text-[12px]" />
                <TextInput value={s.body} onChange={(v) => setSlide(i, "body", v)} className="h-8 py-1 text-[12px]" />
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}
