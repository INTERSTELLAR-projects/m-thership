// Portal deck editor: edit by chat ("make slide 4 punchier"), reorder, regenerate one slide, swap layout, fill in
// missing facts, present, export PDF / PowerPoint. Autosaves through deck-client.
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronLeft, Download, FileText, Loader2, MessageSquare, Play, RefreshCw, Send, Shuffle, StickyNote, Trash2, TriangleAlert } from "lucide-react";
import ScaledSlide from "@/features/presentations/slides/ScaledSlide";
import SlideRenderer from "@/features/presentations/slides/SlideRenderer";
import ExportRenderer from "@/features/presentations/studio/ExportRenderer";
import PresentMode from "@/features/presentations/studio/PresentMode";
import useDeckExport from "@/features/presentations/hooks/useDeckExport";
import { getTheme } from "@/features/presentations/lib/slideThemes";
import { editDeck, regenerateSlide } from "@/features/presentations/lib/deckSchema";
import RequestHelpButton from "@/features/studios/RequestHelpButton";
import { deckCall, errText } from "./api";

const SWAP = [["cover", "Title"], ["bullets", "Points"], ["cards", "Cards"], ["list", "Numbered list"], ["compare", "Comparison"], ["split", "Image + text"], ["stats", "Stats"], ["bigstat", "Big number"], ["chart", "Chart"], ["timeline", "Timeline"], ["quote", "Quote (real quotes only)"], ["section", "Section divider"], ["closing", "Call to action"]];
const IDEAS = ["Make slide 2 punchier", "Shorten every slide", "Add a slide on how we work", "Make it more formal"];

export default function PortalDeckEditor({ initial, scopeId, business, preview, onBack }) {
  const [deck, setDeck] = useState(initial);
  const [id, setId] = useState(initial.id || null);
  const [cur, setCur] = useState(0);
  const [saving, setSaving] = useState("saved");
  const [busy, setBusy] = useState(""); // "", "chat", "slide"
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [slideAsk, setSlideAsk] = useState("");
  const [present, setPresent] = useState(false);
  const [notice, setNotice] = useState(null);
  const [facts, setFacts] = useState({});
  const [armDelete, setArmDelete] = useState(false);
  const exportRef = useRef(null);
  const { exporting, progress, run } = useDeckExport(exportRef, deck);
  const theme = useMemo(() => getTheme(deck.theme, deck.brand), [deck.theme, deck.brand]);
  const brief = deck.brief?.text || deck.prompt || deck.title;
  const slides = deck.slides || [];
  const slide = slides[Math.min(cur, slides.length - 1)];
  const first = useRef(true);

  // Autosave (debounced) after every change.
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    setSaving("saving");
    const t = setTimeout(async () => {
      try { const r = await deckCall(scopeId, "save", { id, deck }); if (!id) setId(r.deck.id); setSaving("saved"); }
      catch (e) { setSaving("error"); setNotice({ tone: "error", text: errText(e) }); }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck]);

  const setSlides = (s) => setDeck((d) => ({ ...d, slides: s }));
  const move = (i, dir) => { const s = [...slides]; const [x] = s.splice(i, 1); s.splice(i + dir, 0, x); setSlides(s); setCur(i + dir); };
  const chat = async (text) => {
    const q = (text || input).trim();
    if (!q || busy) return;
    setInput(""); setBusy("chat");
    const history = [...msgs, { role: "user", content: q }];
    setMsgs(history);
    try {
      const out = await editDeck({ deck, instruction: q, brief, history });
      setDeck((d) => ({ ...d, ...out.deck, theme: d.theme, brand: d.brand, needs: d.needs }));
      setMsgs([...history, { role: "assistant", content: out.reply + (out.removed?.length ? ` (I left out ${out.removed.length} detail${out.removed.length === 1 ? "" : "s"} I couldn't confirm.)` : "") }]);
    } catch (e) { setMsgs([...history, { role: "assistant", content: errText(e), error: true }]); } finally { setBusy(""); }
  };
  const regen = async (instruction) => {
    if (!slide || busy) return;
    setBusy("slide");
    try {
      const next = await regenerateSlide({ deck, slide, instruction, brief });
      setSlides(slides.map((s) => (s.id === slide.id ? next : s)));
      setSlideAsk("");
    } catch (e) { setNotice({ tone: "error", text: errText(e) }); } finally { setBusy(""); }
  };
  const addFacts = async () => {
    const lines = Object.entries(facts).filter(([, v]) => String(v).trim()).map(([k, v]) => `${deck.needs[Number(k)]}: ${String(v).trim()}`);
    if (!lines.length) return;
    const answered = new Set(Object.entries(facts).filter(([, v]) => String(v).trim()).map(([k]) => deck.needs[Number(k)]));
    await chat(`Here are facts to use. Add each one to the slide where it fits best (or one new slide if none fits), exactly as written:\n${lines.join("\n")}`);
    setDeck((d) => ({ ...d, needs: (d.needs || []).filter((n) => !answered.has(n)), brief: { ...(d.brief || {}), text: `${d.brief?.text || brief}\n\nFacts the presenter added:\n${lines.map((l) => `- ${l}`).join("\n")}` } }));
    setFacts({});
  };
  const doExport = async (kind) => {
    setNotice(null);
    try { const name = await run(kind); setNotice({ tone: "ok", text: `Downloaded ${name}.` }); } catch (e) { setNotice({ tone: "error", text: errText(e) }); }
  };

  return (
    <div className="space-y-4" data-deck-editor>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[13px] text-ink/60 hover:text-ink"><ChevronLeft className="h-4 w-4" /> Decks</button>
        <input value={deck.title || ""} onChange={(e) => setDeck({ ...deck, title: e.target.value })} className="min-w-0 flex-1 basis-60 rounded-md border border-transparent bg-transparent px-2 py-1 text-[20px] font-semibold tracking-[-0.03em] outline-none hover:border-hair focus:border-[#ff3c00] focus:bg-white" />
        <span className="text-[12px] text-ink/45">{saving === "saving" ? "Saving…" : saving === "error" ? "Not saved" : "Saved"}</span>
        <button type="button" onClick={() => setPresent(true)} className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-[13.5px] font-semibold text-white hover:bg-[#ff3c00]"><Play className="h-4 w-4" /> Present</button>
        <button type="button" disabled={!!exporting} onClick={() => doExport("pdf")} className="inline-flex h-10 items-center gap-2 rounded-md border border-hair bg-white px-3.5 text-[13.5px] font-semibold hover:border-ink/40 disabled:opacity-60">{exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF</button>
        <button type="button" disabled={!!exporting} onClick={() => doExport("pptx")} className="inline-flex h-10 items-center gap-2 rounded-md border border-hair bg-white px-3.5 text-[13.5px] font-semibold hover:border-ink/40 disabled:opacity-60">{exporting === "pptx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PowerPoint</button>
        <RequestHelpButton compact studio="presentations" studioLabel="Presentations" scopeId={scopeId} preview={preview} context={`Deck: ${deck.title}`} placeholder="e.g. Polish this deck and add our project photos before Thursday's meeting." />
      </div>
      {exporting && <p className="text-[12.5px] text-ink/55">Exporting {progress.done}/{progress.total}…</p>}
      {notice && <p role={notice.tone === "error" ? "alert" : undefined} className={`rounded-md border px-3 py-2 text-[13px] ${notice.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-900"}`}>{notice.text}</p>}

      <div className="grid gap-4 lg:grid-cols-[168px_minmax(0,1fr)_320px] [&>*]:min-w-0">
        {/* rail */}
        <ol className="order-2 flex gap-2 overflow-x-auto pb-1 lg:order-1 lg:max-h-[78vh] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1" aria-label="Slides">
          {slides.map((s, i) => (
            <li key={s.id || i} className="group relative w-36 shrink-0 lg:w-auto">
              <button type="button" onClick={() => setCur(i)} className={`block w-full overflow-hidden rounded-md border-2 transition-colors ${i === cur ? "border-[#ff3c00]" : "border-transparent hover:border-ink/20"}`}>
                <div className="pointer-events-none"><ScaledSlide><SlideRenderer slide={s} theme={theme} index={i} total={slides.length} deckTitle={deck.title} /></ScaledSlide></div>
              </button>
              <span className="absolute left-1 top-1 rounded bg-ink/70 px-1.5 text-[10px] font-semibold text-white">{i + 1}</span>
              {i === cur && (
                <div className="absolute right-1 top-1 flex gap-0.5">
                  <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)} className="rounded bg-white/90 p-0.5 shadow disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                  <button type="button" aria-label="Move later" disabled={i === slides.length - 1} onClick={() => move(i, 1)} className="rounded bg-white/90 p-0.5 shadow disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                </div>
              )}
            </li>
          ))}
        </ol>

        {/* stage */}
        <div className="order-1 space-y-3 lg:order-2">
          {slide ? (
            <div className={`relative overflow-hidden rounded-xl border border-hair shadow-[0_30px_70px_-40px_rgba(26,26,26,.7)] transition-opacity ${busy === "slide" ? "opacity-60" : ""}`} data-slide-stage>
              <ScaledSlide><SlideRenderer slide={slide} theme={theme} index={cur} total={slides.length} deckTitle={deck.title} /></ScaledSlide>
              {busy === "slide" && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff3c00]" /></div>}
            </div>
          ) : <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-hair text-ink/45">No slides</div>}
          {slide?.notes && <div className="rounded-xl border border-hair bg-white p-4 text-[13.5px] leading-relaxed text-ink/70"><p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink/45"><StickyNote className="h-3.5 w-3.5" /> Speaker notes</p>{slide.notes}</div>}
        </div>

        {/* tools */}
        <aside className="order-3 space-y-4">
          {slide && (
            <section className="rounded-xl border border-hair bg-white p-4">
              <p className="text-[13px] font-semibold">Slide {cur + 1}</p>
              <div className="mt-2 flex gap-2">
                <label className="min-w-0 flex-1"><span className="sr-only">Layout</span>
                  <select value="" onChange={(e) => e.target.value && regen(`Change the layout to "${e.target.value}" and refit the same content to it. Keep every fact; add none.`)} disabled={!!busy} className="w-full rounded-md border border-hair bg-white px-2.5 py-2 text-[13px] outline-none focus:border-[#ff3c00]">
                    <option value="">Swap layout…</option>{SWAP.filter(([k]) => k !== slide.layout).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </label>
                <button type="button" title="Regenerate this slide" disabled={!!busy} onClick={() => regen("")} className="inline-flex items-center gap-1.5 rounded-md border border-hair px-3 text-[13px] font-medium hover:border-ink/40 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" /> Redo</button>
              </div>
              <div className="mt-2 flex gap-2">
                <input value={slideAsk} onChange={(e) => setSlideAsk(e.target.value)} onKeyDown={(e) => e.key === "Enter" && slideAsk.trim() && regen(slideAsk)} placeholder="Change this slide… e.g. fewer words" className="min-w-0 flex-1 rounded-md border border-hair px-2.5 py-2 text-[13px] outline-none focus:border-[#ff3c00]" />
                <button type="button" aria-label="Apply" disabled={!slideAsk.trim() || !!busy} onClick={() => regen(slideAsk)} className="rounded-md bg-ink px-3 text-white disabled:opacity-40"><Shuffle className="h-4 w-4" /></button>
              </div>
              {slides.length > 2 && cur > 0 && (
                <button type="button" onClick={() => { if (!armDelete) { setArmDelete(true); setTimeout(() => setArmDelete(false), 3500); return; } setSlides(slides.filter((_, j) => j !== cur)); setCur(Math.max(0, cur - 1)); setArmDelete(false); }} className={`mt-3 inline-flex items-center gap-1.5 text-[12.5px] ${armDelete ? "font-semibold text-red-700" : "text-ink/45 hover:text-red-700"}`}><Trash2 className="h-3.5 w-3.5" /> {armDelete ? "Click again to remove this slide" : "Remove slide"}</button>
              )}
            </section>
          )}

          <section className="flex max-h-[46vh] flex-col rounded-xl border border-hair bg-white">
            <p className="flex items-center gap-1.5 border-b border-hair px-4 py-2.5 text-[13px] font-semibold"><MessageSquare className="h-4 w-4 text-[#ff3c00]" /> Edit by chat</p>
            <div className="min-h-[90px] flex-1 space-y-2 overflow-y-auto px-4 py-3 text-[13px]">
              {!msgs.length && <div className="flex flex-wrap gap-1.5">{IDEAS.map((x) => <button key={x} type="button" onClick={() => chat(x)} className="rounded-full bg-ink/[0.05] px-2.5 py-1 text-[12px] text-ink/65 hover:bg-[#ff3c00]/10 hover:text-[#c22d00]">{x}</button>)}</div>}
              {msgs.map((m, i) => <p key={i} className={`rounded-lg px-3 py-2 ${m.role === "user" ? "ml-6 bg-ink text-white" : m.error ? "mr-6 bg-red-50 text-red-800" : "mr-6 bg-[#faf9f7]"}`}>{m.content}</p>)}
              {busy === "chat" && <p className="mr-6 flex items-center gap-2 rounded-lg bg-[#faf9f7] px-3 py-2 text-ink/55"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Working on it…</p>}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); chat(); }} className="flex gap-2 border-t border-hair p-2.5">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. Make slide 4 punchier" className="min-w-0 flex-1 rounded-md border border-hair px-2.5 py-2 text-[13px] outline-none focus:border-[#ff3c00]" />
              <button type="submit" aria-label="Send" disabled={!input.trim() || !!busy} className="rounded-md bg-[#ff3c00] px-3 text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
            </form>
          </section>

          {deck.needs?.length > 0 && (
            <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-900"><TriangleAlert className="h-4 w-4" /> Facts to add ({deck.needs.length})</p>
              <p className="mt-1 text-[12px] text-amber-900/70">We left these out rather than guess. Add what you know.</p>
              <div className="mt-2 space-y-2">{deck.needs.map((n, i) => <label key={i} className="block"><span className="text-[12px] font-medium text-ink/75">{n}</span><input value={facts[i] || ""} onChange={(e) => setFacts({ ...facts, [i]: e.target.value })} className="mt-0.5 w-full rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[#ff3c00]" /></label>)}</div>
              <button type="button" disabled={!!busy || !Object.values(facts).some((v) => String(v).trim())} onClick={addFacts} className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"><Check className="h-3.5 w-3.5" /> Add to the deck</button>
            </section>
          )}
          {deck.brand_source && <p className="text-[11.5px] text-ink/45">Look: {deck.brand_source}{business ? ` · ${business}` : ""}</p>}
        </aside>
      </div>

      <ExportRenderer containerRef={exportRef} slides={slides} themeId={deck.theme} brand={deck.brand} deckTitle={deck.title} />
      {present && <PresentMode slides={slides} theme={theme} deckTitle={deck.title} startIndex={cur} onClose={() => setPresent(false)} />}
    </div>
  );
}
