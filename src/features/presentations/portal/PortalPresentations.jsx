// Portal > Studios > Presentations (HyperCare+, switched on): one prompt -> a planned outline -> an on-brand deck.
// Plan first (audience, goal, slide-by-slide message, missing facts), then build from the approved outline.
// Never invents stats, prices, testimonials or claims: missing facts are listed for the client to fill in.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, ChevronLeft, Layers, Loader2, Palette, Plus, Presentation as PresIcon, Sparkles, Trash2, Wand2 } from "lucide-react";
import ScaledSlide from "@/features/presentations/slides/ScaledSlide";
import SlideRenderer from "@/features/presentations/slides/SlideRenderer";
import { getTheme } from "@/features/presentations/lib/slideThemes";
import { planOutline, writeSlides } from "@/features/presentations/lib/deckSchema";
import { useDictation, DictateButton } from "@/features/voice/DictationBox";
import RequestHelpButton from "@/features/studios/RequestHelpButton";
import PortalDeckEditor from "./PortalDeckEditor";
import { deckCall, errText, loadDeckContext, portalBrief, EXAMPLES } from "./api";

const LAYOUT_LABEL = { cover: "Title", section: "Section", bullets: "Points", cards: "Cards", list: "List", compare: "Comparison", split: "Image + text", image: "Image", stats: "Stats", bigstat: "Big number", chart: "Chart", quote: "Quote", timeline: "Timeline", pricing: "Pricing", closing: "Call to action" };
const STAGES = ["Reading your brand and business facts", "Planning the story", "Writing the slides", "Checking every fact", "Designing"];

function Composer({ ctx, onPlanned }) {
  const [prompt, setPrompt] = useState("");
  const [audience, setAudience] = useState("");
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dictation = useDictation({ onText: (t) => setPrompt((p) => [p, t].filter(Boolean).join(" ")) });
  const plan = async () => {
    if (!prompt.trim()) return;
    setBusy(true); setErr("");
    try {
      const brief = portalBrief({ prompt, audience, slideCount: count, facts: ctx.facts });
      const outline = await planOutline({ brief, slideCount: count });
      onPlanned({ prompt, audience, count, brief, outline });
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  return (
    <section className="relative overflow-hidden rounded-2xl border border-hair bg-white p-5 shadow-[0_30px_60px_-40px_rgba(26,26,26,.5)] md:p-7">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(255,106,0,.18),transparent_65%)]" />
      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#ff3c00]">New deck</p>
      <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] md:text-[26px]">What&apos;s the deck for?</h2>
      <div className="relative mt-4">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="e.g. A 10-slide pitch for a new HOA client: why us, how a season works, what's included, next steps" className="w-full resize-none rounded-xl border border-hair bg-[#faf9f7] px-4 py-3.5 pr-14 text-[16px] leading-relaxed outline-none focus:border-[#ff3c00] focus:bg-white focus:ring-4 focus:ring-[#ff3c00]/10" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) plan(); }} />
        <div className="absolute bottom-3 right-3"><DictateButton dictation={dictation} /></div>
      </div>
      {dictation.mode === "listening" && <p className="mt-1.5 text-[12px] text-[#c22d00]">Listening… tap stop when you&apos;re done.</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">{EXAMPLES.map((x) => <button key={x} type="button" onClick={() => setPrompt(x)} className="rounded-full bg-ink/[0.05] px-3 py-1 text-[12px] text-ink/65 hover:bg-[#ff3c00]/10 hover:text-[#c22d00]">{x}</button>)}</div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 basis-56"><span className="mb-1 block text-[12px] font-semibold text-ink/60">Who&apos;s it for? <span className="font-normal text-ink/40">(optional)</span></span><input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. HOA board members" className="w-full rounded-md border border-hair px-3 py-2.5 text-[14px] outline-none focus:border-[#ff3c00]" /></label>
        <label><span className="mb-1 block text-[12px] font-semibold text-ink/60">Slides</span><select value={count} onChange={(e) => setCount(Number(e.target.value))} className="rounded-md border border-hair bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#ff3c00]">{[6, 8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <button type="button" disabled={!prompt.trim() || busy} onClick={plan} className="inline-flex h-[44px] items-center gap-2 rounded-md bg-[#ff3c00] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-ink disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} {busy ? "Planning…" : "Plan my deck"}</button>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink/50">
        <span className="inline-flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> {ctx.brand ? `In your brand (${ctx.source.toLowerCase()})` : "No brand kit on file yet: a clean neutral look"}</span>
        <span>· Uses only facts we have on file or you give us. Gaps are listed, never made up.</span>
      </p>
      {err && <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{err}</p>}
    </section>
  );
}

function OutlineReview({ plan, ctx, onBack, onBuilt }) {
  const [o, setO] = useState(plan.outline);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [err, setErr] = useState("");
  useEffect(() => { if (!busy) return undefined; const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 9000); return () => clearInterval(t); }, [busy]);
  const move = (i, d) => { const s = [...o.slides]; const [x] = s.splice(i, 1); s.splice(i + d, 0, x); setO({ ...o, slides: s }); };
  const build = async () => {
    setBusy(true); setStage(1); setErr("");
    try {
      const extraFacts = Object.entries(answers).filter(([, v]) => String(v).trim()).map(([k, v]) => `- ${o.needs[Number(k)]}: ${v.trim()}`).join("\n");
      const brief = extraFacts ? portalBrief({ prompt: plan.prompt, audience: plan.audience, slideCount: o.slides.length, facts: ctx.facts, extraFacts }) : plan.brief;
      setStage(2);
      const out = await writeSlides({ brief, outline: o, slideCount: o.slides.length });
      setStage(4);
      const needs = (out.deck.needs || []).filter((n) => !Object.entries(answers).some(([k, v]) => String(v).trim() && o.needs[Number(k)] === n));
      onBuilt({ ...out.deck, theme: ctx.brand ? "custom" : "paper", brand: ctx.brand || undefined, brand_source: ctx.source || "", outline: o, needs, prompt: plan.prompt, audience: plan.audience, generated_by: "portal_v1", brief: { topic: plan.prompt, audience: plan.audience, slideCount: o.slides.length, text: brief } });
    } catch (e) { setErr(errText(e)); setBusy(false); }
  };
  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[13px] text-ink/60 hover:text-ink"><ChevronLeft className="h-4 w-4" /> Start over</button>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] [&>*]:min-w-0">
        <section className="rounded-2xl border border-hair bg-white p-5 md:p-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#ff3c00]">Step 1 · The plan</p>
          <input value={o.title} onChange={(e) => setO({ ...o, title: e.target.value })} className="mt-1 w-full rounded-md border border-transparent px-1 text-[24px] font-semibold tracking-[-0.03em] outline-none hover:border-hair focus:border-[#ff3c00]" />
          <dl className="mt-3 grid gap-3 rounded-xl bg-[#faf9f7] p-4 text-[13.5px] sm:grid-cols-2">
            <div><dt className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink/45">Audience</dt><dd className="mt-0.5">{plan.audience || "As described in your request"}</dd></div>
            <div><dt className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink/45">Goal</dt><dd className="mt-0.5">{o.subtitle || "–"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink/45">The one thing they should remember</dt><dd className="mt-0.5 font-medium">{o.takeaway || "–"}</dd></div>
          </dl>
          <ol className="mt-4 space-y-2">
            {o.slides.map((s, i) => (
              <li key={i} className="group flex items-start gap-3 rounded-xl border border-hair px-3.5 py-3 hover:border-ink/25">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-white">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><input value={s.title} onChange={(e) => setO({ ...o, slides: o.slides.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} className="min-w-0 flex-1 rounded border border-transparent px-1 text-[14.5px] font-semibold outline-none hover:border-hair focus:border-[#ff3c00]" /><span className="rounded-full bg-[#ff3c00]/10 px-2 py-0.5 text-[11px] font-semibold text-[#c22d00]">{LAYOUT_LABEL[s.layout] || s.layout}</span></div>
                  <p className="px-1 text-[12.5px] text-ink/55">{s.purpose}</p>
                </div>
                <div className="flex shrink-0 flex-col opacity-60 group-hover:opacity-100">
                  <button type="button" aria-label="Move up" disabled={i < 2 || i === o.slides.length - 1} onClick={() => move(i, -1)} className="rounded p-0.5 hover:bg-ink/5 disabled:opacity-20"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Move down" disabled={i === 0 || i >= o.slides.length - 2} onClick={() => move(i, 1)} className="rounded p-0.5 hover:bg-ink/5 disabled:opacity-20"><ArrowDown className="h-3.5 w-3.5" /></button>
                </div>
                {i > 0 && i < o.slides.length - 1 && <button type="button" aria-label="Remove slide" onClick={() => setO({ ...o, slides: o.slides.filter((_, j) => j !== i) })} className="mt-1 shrink-0 rounded p-1 text-ink/35 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>}
              </li>
            ))}
          </ol>
        </section>
        <aside className="space-y-4">
          <section className="rounded-2xl border border-hair bg-white p-5">
            <p className="text-[14px] font-semibold">Make it stronger</p>
            <p className="mt-1 text-[12.5px] text-ink/55">We only use facts you&apos;ve given us. Fill in what you know (prices, numbers, real quotes); anything left blank stays off the slides.</p>
            {o.needs?.length ? (
              <div className="mt-3 space-y-3">{o.needs.map((n, i) => <label key={i} className="block"><span className="text-[12.5px] font-medium text-ink/75">{n}</span><input value={answers[i] || ""} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} placeholder="Leave blank to skip" className="mt-1 w-full rounded-md border border-hair px-3 py-2 text-[13.5px] outline-none focus:border-[#ff3c00]" /></label>)}</div>
            ) : <p className="mt-3 flex items-center gap-2 text-[13px] text-green-800"><Check className="h-4 w-4" /> Nothing missing.</p>}
          </section>
          <button type="button" onClick={build} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 py-4 text-[15px] font-semibold text-white transition-colors hover:bg-[#ff3c00] disabled:opacity-80">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5 text-[#ff6a00]" />} {busy ? "Building your deck…" : `Build ${o.slides.length} slides`}
          </button>
          {busy && <ol className="space-y-1.5 rounded-xl border border-hair bg-white p-4 text-[12.5px]">{STAGES.map((s, i) => <li key={s} className={`flex items-center gap-2 ${i < stage ? "text-green-700" : i === stage ? "font-semibold text-ink" : "text-ink/35"}`}>{i < stage ? <Check className="h-3.5 w-3.5" /> : i === stage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-3.5 w-3.5" />}{s}</li>)}</ol>}
          {err && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{err}</p>}
        </aside>
      </div>
    </div>
  );
}

function DeckCard({ d, onOpen }) {
  const theme = useMemo(() => getTheme(d.theme, d.brand), [d.theme, d.brand]);
  return (
    <button type="button" onClick={onOpen} className="group overflow-hidden rounded-xl border border-hair bg-white text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-26px_rgba(26,26,26,.6)]" data-deck-card>
      <div className="pointer-events-none border-b border-hair">{d.cover ? <ScaledSlide><SlideRenderer slide={d.cover} theme={theme} index={0} total={d.slide_count} deckTitle={d.title} /></ScaledSlide> : <div className="aspect-video bg-ink/5" />}</div>
      <div className="px-4 py-3"><p className="truncate text-[14.5px] font-semibold">{d.title}</p><p className="text-[12px] text-ink/50">{d.slide_count} slides · {new Date(d.updated_date || d.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{d.needs?.length ? ` · ${d.needs.length} facts to add` : ""}</p></div>
    </button>
  );
}

export default function PortalPresentations({ scopeId, business, preview }) {
  const qc = useQueryClient();
  const ctxQ = useQuery({ queryKey: ["deck-ctx", scopeId || "me"], queryFn: () => loadDeckContext(scopeId), retry: false, staleTime: 60_000 });
  const listQ = useQuery({ queryKey: ["deck-list", scopeId || "me"], queryFn: () => deckCall(scopeId, "list"), retry: false });
  const [plan, setPlan] = useState(null);
  const [open, setOpen] = useState(null); // deck object or id
  const [saveErr, setSaveErr] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["deck-list", scopeId || "me"] });

  const built = async (deck) => {
    try { const r = await deckCall(scopeId, "save", { deck }); setPlan(null); setOpen(r.deck); refresh(); }
    catch (e) { setSaveErr(errText(e)); setPlan(null); setOpen({ ...deck, id: null }); }
  };

  if (open) return <PortalDeckEditor key={open.id || "new"} initial={open} scopeId={scopeId} business={business} preview={preview} onBack={() => { setOpen(null); refresh(); }} />;

  return (
    <div className="space-y-6" data-portal-presentations>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="label-cross">(Decks &amp; proposals)</p>
          <h1 className="mt-2 text-[32px] font-semibold leading-[1.02] tracking-[-0.045em] md:text-[44px]">Presentations <span className="text-[#ff3c00]">/ on brand in minutes.</span></h1>
          <p className="mt-2 max-w-2xl text-[14.5px] text-ink/60">Describe the deck. We plan the story with you, then design every slide in {business ? `${business}'s` : "your"} colors, fonts and logo. Present it, or download a PDF or PowerPoint.</p>
        </div>
        <RequestHelpButton studio="presentations" studioLabel="Presentations" scopeId={scopeId} preview={preview} context="Presentations" placeholder="e.g. Build our investor update deck from the attached numbers, ready by Friday." />
      </div>
      {saveErr && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{saveErr}</p>}
      {ctxQ.isLoading ? <p className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-ink/40" /></p>
        : ctxQ.isError ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{errText(ctxQ.error)}</p>
          : plan ? <OutlineReview plan={plan} ctx={ctxQ.data} onBack={() => setPlan(null)} onBuilt={built} />
            : <Composer ctx={ctxQ.data} onPlanned={setPlan} />}
      {!plan && (
        <section>
          <div className="mb-3 flex items-center gap-2"><Layers className="h-4 w-4 text-[#ff3c00]" /><h2 className="text-[17px] font-semibold tracking-[-0.02em]">Your decks</h2></div>
          {listQ.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-ink/40" /> : listQ.data?.decks?.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{listQ.data.decks.map((d) => <DeckCard key={d.id} d={d} onOpen={async () => { try { const r = await deckCall(scopeId, "get", { id: d.id }); setOpen(r.deck); } catch (e) { setSaveErr(errText(e)); } }} />)}</div>
          ) : (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-hair bg-white/60 px-6 py-10 text-center"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ff3c00]/10 text-[#ff3c00]"><PresIcon className="h-5 w-5" /></span><p className="mt-3 text-[15px] font-semibold">No decks yet</p><p className="mt-1 max-w-sm text-[13px] text-ink/55">Your first one is a sentence away. Try one of the examples above.</p><Plus className="hidden" /></div>
          )}
        </section>
      )}
    </div>
  );
}
