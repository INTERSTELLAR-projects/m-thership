// Portfolio gallery + case-study view (lead-tier portal "Our work", and the admin preview). Public facts only:
// items arrive already filtered by the server (published, verified results only, name only when allowed).
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

export const BUILT_LABEL = { website: "Website", command_system: "Command System", seo_map_pack: "SEO & map pack", automations: "Automations" };

function Shot({ item, phone = false }) {
  const src = phone ? item.image_phone : item.image_desktop || item.og_image;
  if (src) return <img src={src} alt={`${item.name} ${phone ? "on a phone" : "website"}`} loading="lazy" className="h-full w-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.03]" />;
  return <div className="grid h-full w-full place-items-center bg-gradient-to-br from-ink to-[#3a1a10] font-mono text-[11px] uppercase tracking-[0.16em] text-white/75">{item.domain}</div>;
}

export default function PortfolioView({ items = [], heading = true }) {
  const [ind, setInd] = useState("all");
  const [built, setBuilt] = useState("all");
  const [open, setOpen] = useState(null);
  const inds = useMemo(() => [...new Set(items.map((i) => i.industry).filter(Boolean))].sort(), [items]);
  const builts = useMemo(() => [...new Set(items.flatMap((i) => i.built || []))], [items]);
  const shown = items.filter((i) => (ind === "all" || i.industry === ind) && (built === "all" || (i.built || []).includes(built)));
  const grid = useRef(null);
  useEffect(() => {
    const el = grid.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const cards = [...el.querySelectorAll("[data-pf]")];
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.style.opacity = "1"; e.target.style.transform = "none"; io.unobserve(e.target); } }), { threshold: 0.1 });
    cards.forEach((c, i) => { c.style.transitionDelay = `${(i % 6) * 60}ms`; io.observe(c); });
    const t = setTimeout(() => cards.forEach((c) => { c.style.opacity = "1"; c.style.transform = "none"; }), 2000);
    return () => { io.disconnect(); clearTimeout(t); };
  }, [shown.length, ind, built]);
  if (open) return <CaseStudy item={open} onBack={() => setOpen(null)} />;
  const Chips = ({ list, value, set, label }) => (list.length > 1 ? <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}><button type="button" aria-pressed={value === "all"} onClick={() => set("all")} className={`px-3 py-1.5 text-[12.5px] ${value === "all" ? "bg-ink text-white" : "border border-hair bg-paper hover:border-ink/40"}`}>All</button>{list.map((x) => <button key={x} type="button" aria-pressed={value === x} onClick={() => set(x)} className={`px-3 py-1.5 text-[12.5px] ${value === x ? "bg-ink text-white" : "border border-hair bg-paper hover:border-ink/40"}`}>{BUILT_LABEL[x] || x}</button>)}</div> : null);
  return (
    <div className="space-y-6">
      {heading ? (
        <div>
          <p className="label-cross">(Our work)</p>
          <h2 className="mt-3 text-[34px] font-semibold leading-[1] tracking-[-0.045em] md:text-[48px]">Built by Interstellar.</h2>
          <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink/60">Websites and the systems behind them, live on our clients' own domains.</p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3"><Chips list={inds} value={ind} set={setInd} label="Industry" /><Chips list={builts} value={built} set={setBuilt} label="What we built" /></div>
      {!shown.length ? <p className="border border-hair bg-paper px-5 py-12 text-center text-[13.5px] text-ink/55">New work is on its way.</p> : (
        <div ref={grid} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((i) => (
            <button key={i.id || i.slug} type="button" data-pf onClick={() => setOpen(i)} style={{ opacity: 0, transform: "translateY(16px)", transition: "opacity .6s cubic-bezier(.22,1,.36,1), transform .6s cubic-bezier(.22,1,.36,1)" }}
              className="group block border border-hair bg-paper text-left transition-shadow hover:border-[#ff3c00]/50 hover:shadow-[0_22px_40px_-28px_rgba(26,26,26,.55)]">
              <div className="aspect-[16/10] overflow-hidden bg-ink"><Shot item={i} /></div>
              <div className="p-4">
                <p className="mono-label text-[9.5px] text-ink/50">{i.industry || "Local business"}</p>
                <p className="mt-1 text-[19px] font-semibold tracking-[-0.03em]">{i.name}</p>
                {i.description ? <p className="mt-1 text-[13px] text-ink/60">{i.description}</p> : null}
                <div className="mt-2.5 flex flex-wrap gap-1">{(i.built || []).map((b) => <span key={b} className="bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink/65">{BUILT_LABEL[b]}</span>)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CaseStudy({ item: i, onBack }) {
  const Sec = ({ title, children }) => (children ? <section><p className="mono-label text-[10px] text-[#ff3c00]">{title}</p><div className="mt-1.5 text-[15px] leading-relaxed">{children}</div></section> : null);
  return (
    <article className="page-enter space-y-6" data-testid="case-study">
      {onBack ? <button type="button" onClick={onBack} className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink/50 hover:text-[#ff3c00]"><ArrowLeft className="h-3.5 w-3.5" />All work</button> : null}
      <div>
        <p className="mono-label text-[10px] text-ink/50">{i.industry}</p>
        <h2 className="mt-2 text-[36px] font-semibold leading-[1] tracking-[-0.045em] md:text-[52px]">{i.name}</h2>
        {i.description ? <p className="mt-2 max-w-2xl text-[15px] text-ink/60">{i.description}</p> : null}
        {i.url ? <a href={i.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex h-11 items-center gap-2 bg-[#ff3c00] px-5 text-[14px] font-medium text-white hover:bg-ink">Visit the live site<ArrowUpRight className="h-4 w-4" /></a> : null}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid items-start gap-3 sm:grid-cols-[3fr_1fr]">
          <div className="aspect-[16/10] overflow-hidden border border-hair bg-ink"><Shot item={i} /></div>
          {i.image_phone ? <div className="aspect-[9/19] overflow-hidden border border-hair bg-ink"><Shot item={i} phone /></div> : null}
        </div>
        <div className="space-y-5">
          <Sec title="The objective">{i.objective || null}</Sec>
          <Sec title="What we built"><div className="flex flex-wrap gap-1.5">{(i.built || []).map((b) => <span key={b} className="border border-hair bg-paper px-2 py-1 text-[12.5px]">{BUILT_LABEL[b]}</span>)}</div></Sec>
          <Sec title="Approach">{i.highlights?.length ? <ul className="list-disc space-y-1 pl-5">{i.highlights.map((h) => <li key={h}>{h}</li>)}</ul> : null}</Sec>
          <Sec title="Results">{i.results?.length ? <ul className="list-disc space-y-1 pl-5">{i.results.map((r) => <li key={r.text}>{r.text}{r.source ? <span className="text-[12px] text-ink/50"> ({r.source})</span> : null}</li>)}</ul> : null}</Sec>
          {i.launched_at ? <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink/45">Launched {new Date(i.launched_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p> : null}
        </div>
      </div>
    </article>
  );
}
