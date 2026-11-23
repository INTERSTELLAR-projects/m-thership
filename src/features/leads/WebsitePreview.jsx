// The lead's website preview, rendered from website_config (built by base44/shared/leadEngine.js buildPreview).
// A real multi-section responsive page in the lead's name, services, city and colors, on the Interstellar build
// foundation: hook-first hero with a word-by-word reveal, sections that reveal one at a time, designed placeholder
// slots (never fake photos or reviews), reduced-motion fallback, footer credit. Container queries make the phone /
// desktop toggle real inside Møthership and the portal. Images: the lead's own site photos only.
import { useEffect, useMemo, useRef, useState } from "react";

const FONT_URL = (d, b) => `https://fonts.googleapis.com/css2?family=${encodeURIComponent(d)}:wght@500;600;700;800&family=${encodeURIComponent(b)}:wght@400;500;600&display=swap`;
function useFonts(display, body) {
  useEffect(() => {
    if (!display) return;
    const id = `wp-font-${display}-${body}`.replace(/\W+/g, "-");
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id; l.rel = "stylesheet"; l.href = FONT_URL(display, body || "Inter");
    document.head.appendChild(l);
  }, [display, body]);
}

const CSS = `
.wp{container-type:inline-size;--r:2px;background:var(--wp-bg);color:var(--wp-ink);font-family:var(--wp-body),system-ui,sans-serif;font-size:16px;line-height:1.55;overflow-x:clip;-webkit-font-smoothing:antialiased}
.wp *{box-sizing:border-box}.wp a{color:inherit}
.wp h1,.wp h2,.wp h3{font-family:var(--wp-display),system-ui,sans-serif;letter-spacing:-0.02em;line-height:1.08;margin:0;text-wrap:balance;overflow-wrap:break-word;min-width:0}
.wp p{margin:0;text-wrap:pretty}
.wp-wrap{width:100%;max-width:1160px;margin:0 auto;padding:0 20px}
.wp-nav{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--wp-bg) 88%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid color-mix(in srgb,var(--wp-ink) 10%,transparent)}
.wp-nav .wp-wrap{display:flex;align-items:center;gap:16px;height:64px}
.wp-brand{display:flex;align-items:center;gap:10px;font-family:var(--wp-display);font-weight:800;font-size:18px;letter-spacing:-0.02em;min-width:0}
.wp-brand img{height:34px;width:auto;max-width:140px;object-fit:contain}
.wp-brand span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wp-links{display:none;gap:22px;margin-left:auto;font-size:14px;font-weight:500;opacity:.8}
.wp-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 20px;border-radius:var(--r);font-weight:600;font-size:15px;text-decoration:none;border:0;cursor:pointer;transition:transform .2s ease,background-color .2s ease,color .2s ease;white-space:nowrap}
.wp-btn:hover{transform:translateY(-1px)}.wp-btn:active{transform:translateY(0)}
.wp-btn:focus-visible,.wp a:focus-visible,.wp summary:focus-visible{outline:2px solid var(--wp-primary);outline-offset:3px}
.wp-btn--p{background:var(--wp-primary);color:var(--wp-on)}
.wp-btn--g{background:transparent;color:var(--wp-ink);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--wp-ink) 25%,transparent)}
.wp-nav .wp-btn{height:40px;padding:0 14px;font-size:14px;margin-left:auto}
.wp-hero{position:relative;padding:44px 0 36px}
.wp-hero-grid{display:grid;gap:28px}
.wp-kicker{font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:color-mix(in srgb,var(--wp-ink) 60%,transparent);display:flex;align-items:center;gap:10px}
.wp-kicker:before{content:"";width:22px;height:2px;background:var(--wp-primary)}
.wp-hero h1{font-size:clamp(38px,9cqi,74px);font-weight:800;margin-top:16px}
.wp-hero h1 .w{display:inline-block;opacity:0;transform:translateY(.45em);animation:wpRise .7s cubic-bezier(.22,1,.36,1) forwards}
.wp-hero .sub{font-size:18px;max-width:34em;margin-top:18px;color:color-mix(in srgb,var(--wp-ink) 72%,transparent)}
.wp-cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}
.wp-media{position:relative;aspect-ratio:4/3;border-radius:var(--r);overflow:hidden;background:var(--wp-deep)}
.wp-media img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .6s ease}
.wp-media:hover img{transform:scale(1.025)}
.wp-slot{position:relative;width:100%;height:100%;display:grid;place-items:center;overflow:hidden;background:linear-gradient(135deg,var(--wp-deep),color-mix(in srgb,var(--wp-deep) 70%,var(--wp-primary)))}
.wp-slot:before{content:"";position:absolute;inset:0;background-image:linear-gradient(color-mix(in srgb,#fff 7%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,#fff 7%,transparent) 1px,transparent 1px);background-size:28px 28px}
.wp-slot span{position:relative;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#fff;opacity:.75;border:1px dashed color-mix(in srgb,#fff 45%,transparent);padding:8px 12px;text-align:center}
.wp-trust{border-top:1px solid color-mix(in srgb,var(--wp-ink) 10%,transparent);border-bottom:1px solid color-mix(in srgb,var(--wp-ink) 10%,transparent);background:var(--wp-surface)}
.wp-trust .wp-wrap{display:flex;flex-wrap:wrap;gap:10px 28px;padding-top:16px;padding-bottom:16px;font-size:14px;font-weight:600}
.wp-trust i{font-style:normal;color:var(--wp-primary);margin-right:6px}
.wp-sec{padding:64px 0}
.wp-sec.alt{background:var(--wp-surface)}
.wp-sec h2{font-size:clamp(30px,5.6cqi,48px);font-weight:800}
.wp-eyebrow{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--wp-primary);margin-bottom:12px}
.wp-lede{margin-top:12px;max-width:40em;color:color-mix(in srgb,var(--wp-ink) 68%,transparent)}
.wp-svc{display:grid;gap:0;margin-top:30px;border-top:1px solid color-mix(in srgb,var(--wp-ink) 14%,transparent)}
.wp-svc a{display:grid;grid-template-columns:48px 1fr auto;align-items:center;gap:14px;padding:20px 4px;border-bottom:1px solid color-mix(in srgb,var(--wp-ink) 14%,transparent);text-decoration:none;transition:padding .25s ease,background-color .25s ease}
.wp-svc a:hover{padding-left:12px;background:color-mix(in srgb,var(--wp-primary) 6%,transparent)}
.wp-svc .n{font-size:13px;font-weight:600;color:color-mix(in srgb,var(--wp-ink) 45%,transparent);font-variant-numeric:tabular-nums}
.wp-svc h3{font-size:22px;font-weight:700}
.wp-svc .arr{font-size:20px;color:var(--wp-primary)}
.wp-note{margin-top:12px;font-size:12px;color:color-mix(in srgb,var(--wp-ink) 50%,transparent)}
.wp-steps{display:grid;gap:14px;margin-top:30px;counter-reset:st}
.wp-step{padding:22px;background:var(--wp-bg);border-radius:var(--r);border:1px solid color-mix(in srgb,var(--wp-ink) 10%,transparent)}
.wp-sec:not(.alt) .wp-step{background:var(--wp-surface)}
.wp-step b{display:block;font-family:var(--wp-display);font-size:30px;color:var(--wp-primary);line-height:1}
.wp-step h3{font-size:18px;margin-top:14px}.wp-step p{margin-top:6px;font-size:15px;color:color-mix(in srgb,var(--wp-ink) 66%,transparent)}
.wp-gal{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:28px}
.wp-gal>div{aspect-ratio:1;border-radius:var(--r);overflow:hidden}
.wp-gal img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .6s ease}.wp-gal>div:hover img{transform:scale(1.03)}
.wp-two{display:grid;gap:26px;align-items:center}
.wp-slotline{margin-top:16px;padding:16px;border:1px dashed color-mix(in srgb,var(--wp-ink) 25%,transparent);font-size:14px;color:color-mix(in srgb,var(--wp-ink) 55%,transparent)}
.wp-rating{display:flex;align-items:baseline;gap:12px;margin-top:22px}
.wp-rating b{font-family:var(--wp-display);font-size:64px;line-height:1;letter-spacing:-.04em}
.wp-stars{color:var(--wp-primary);font-size:20px;letter-spacing:2px}
.wp-faq{margin-top:26px;border-top:1px solid color-mix(in srgb,var(--wp-ink) 14%,transparent)}
.wp-faq details{border-bottom:1px solid color-mix(in srgb,var(--wp-ink) 14%,transparent)}
.wp-faq summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:12px;padding:18px 2px;font-weight:600;font-size:17px}
.wp-faq summary::-webkit-details-marker{display:none}
.wp-faq summary:after{content:"+";color:var(--wp-primary);font-size:22px;line-height:1;transition:transform .25s ease}
.wp-faq details[open] summary:after{transform:rotate(45deg)}
.wp-faq p{padding:0 2px 18px;color:color-mix(in srgb,var(--wp-ink) 66%,transparent)}
.wp-band{background:var(--wp-deep);color:#fff;padding:60px 0}
.wp-band h2{font-size:clamp(30px,5.4cqi,46px);font-weight:800;color:#fff;max-width:16em}
.wp-band .wp-btn--g{color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.35)}
.wp-form{margin-top:26px;padding:24px;background:var(--wp-bg);border-radius:var(--r);border:1px solid color-mix(in srgb,var(--wp-ink) 12%,transparent);max-width:620px}
.wp-form .bar{height:3px;background:color-mix(in srgb,var(--wp-ink) 10%,transparent);margin-bottom:18px}.wp-form .bar i{display:block;height:100%;width:33%;background:var(--wp-primary)}
.wp-form small{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:color-mix(in srgb,var(--wp-ink) 50%,transparent)}
.wp-form h3{font-size:26px;margin-top:8px}
.wp-opts{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.wp-opts span{padding:10px 14px;border:1.5px solid color-mix(in srgb,var(--wp-ink) 18%,transparent);border-radius:var(--r);font-size:14px;font-weight:500}
.wp-opts span:first-child{border-color:var(--wp-primary);background:color-mix(in srgb,var(--wp-primary) 10%,transparent)}
.wp-foot{background:var(--wp-ink);color:rgba(255,255,255,.75);padding:40px 0 26px;font-size:14px}
.wp-foot .row{display:flex;flex-wrap:wrap;gap:18px;justify-content:space-between}
.wp-foot b{color:#fff;font-family:var(--wp-display);font-size:20px}
.wp-credit{margin-top:26px;padding-top:16px;border-top:1px solid rgba(255,255,255,.12);display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;font-size:12px;color:rgba(255,255,255,.5)}
.wp-credit a{color:rgba(255,255,255,.75)}
.wp-rv{opacity:0;transform:translateY(22px);transition:opacity .7s cubic-bezier(.22,1,.36,1),transform .7s cubic-bezier(.22,1,.36,1)}
.wp-rv.in{opacity:1;transform:none}
@keyframes wpRise{to{opacity:1;transform:none}}
@container (min-width:760px){
  .wp-wrap{padding:0 40px}
  .wp-links{display:flex}.wp-nav .wp-btn{margin-left:0}
  .wp-hero{padding:72px 0 64px}
  .wp-hero-grid{grid-template-columns:1.1fr .9fr;align-items:end;gap:48px}
  .wp-media{aspect-ratio:4/5}
  .wp-sec{padding:96px 0}
  .wp-steps{grid-template-columns:repeat(4,minmax(0,1fr))}
  .wp-steps.three{grid-template-columns:repeat(3,minmax(0,1fr))}
  .wp-gal{grid-template-columns:repeat(3,minmax(0,1fr))}
  .wp-two{grid-template-columns:1fr 1fr;gap:56px}
  .wp-band{padding:88px 0}
  .wp-svc a{grid-template-columns:72px 1fr auto;padding:26px 4px}
  .wp-svc h3{font-size:28px}
}
@media (prefers-reduced-motion:reduce){.wp-hero h1 .w{animation:none;opacity:1;transform:none}.wp-rv{opacity:1;transform:none;transition:none}.wp *{transition:none!important}}
`;

function Slot({ label }) { return <div className="wp-slot"><span>{label}</span></div>; }
const stars = (r) => "★★★★★".slice(0, Math.round(r || 0)) + "☆☆☆☆☆".slice(0, 5 - Math.round(r || 0));

function useReveal(root, deps) {
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const items = [...el.querySelectorAll(".wp-rv")];
    if (typeof IntersectionObserver === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { items.forEach((x) => x.classList.add("in")); return undefined; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    items.forEach((x) => io.observe(x));
    // Safety: anything still hidden after 2.5s shows (screenshots, print, very tall frames).
    const t = setTimeout(() => items.forEach((x) => x.classList.add("in")), 2500);
    return () => { io.disconnect(); clearTimeout(t); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

export default function WebsitePreview({ config, onCta }) {
  const c = config || {};
  const th = c.theme || {};
  useFonts(th.font_display, th.font_body);
  const root = useRef(null);
  const [replay, setReplay] = useState(0);
  useReveal(root, [c.built_at, replay, (c.sections || []).length]);
  const style = useMemo(() => ({
    "--wp-primary": th.primary || "#ff3c00", "--wp-on": th.on_primary || "#fff", "--wp-ink": th.ink || "#151515", "--wp-deep": th.deep || th.ink || "#1f1f1f",
    "--wp-bg": th.bg || "#f4f2ee", "--wp-surface": th.surface || "#fff", "--wp-display": `"${th.font_display || "Archivo"}"`, "--wp-body": `"${th.font_body || "Inter"}"`,
  }), [th.primary, th.on_primary, th.ink, th.deep, th.bg, th.surface, th.font_display, th.font_body]);
  if (!config) return null;
  const hero = c.hero || {};
  const words = String(hero.headline || c.business || "").split(/\s+/).filter(Boolean);
  const secs = (c.sections || []).filter((s) => s.enabled !== false);
  const go = (e) => { e.preventDefault(); onCta?.(); };
  let alt = false;

  const render = (s) => {
    alt = !alt;
    const cls = `wp-sec${alt ? " alt" : ""}`;
    switch (s.type) {
      case "trust": alt = !alt; return s.items?.length ? <div key={s.key} className="wp-trust"><div className="wp-wrap">{s.items.map((t) => <span key={t}><i>✦</i>{t}</span>)}</div></div> : null;
      case "services": return (
        <section key={s.key} id="services" className={cls}><div className="wp-wrap wp-rv">
          <p className="wp-eyebrow">{s.label}</p><h2>{s.title}</h2>
          <div className="wp-svc">{(s.items || []).map((it, i) => <a key={it.title} href="#contact" onClick={go}><span className="n">{String(i + 1).padStart(2, "0")}</span><h3>{it.title}</h3><span className="arr" aria-hidden="true">→</span></a>)}</div>
          {s.note ? <p className="wp-note">{s.note}</p> : null}
        </div></section>
      );
      case "process": return (
        <section key={s.key} className={cls}><div className="wp-wrap wp-rv">
          <p className="wp-eyebrow">{s.label}</p><h2>{s.title === s.label ? "Simple from the first call." : s.title}</h2>
          <div className={`wp-steps${(s.items || []).length === 3 ? " three" : ""}`}>{(s.items || []).map((st, i) => <div key={st.title} className="wp-step"><b>{String(i + 1).padStart(2, "0")}</b><h3>{st.title}</h3><p>{st.text}</p></div>)}</div>
        </div></section>
      );
      case "gallery": return (
        <section key={s.key} id="work" className={cls}><div className="wp-wrap wp-rv">
          <p className="wp-eyebrow">{s.label}</p><h2>{s.title === s.label ? "The work speaks." : s.title}</h2>
          <div className="wp-gal">{(s.images || []).map((u) => <div key={u}><img src={u} alt="" loading="lazy" /></div>)}{Array.from({ length: s.slots || 0 }).map((_, i) => <div key={`s${i}`}><Slot label="Your photo" /></div>)}</div>
        </div></section>
      );
      case "about": case "team": return (
        <section key={s.key} id="about" className={cls}><div className="wp-wrap wp-two wp-rv">
          <div><p className="wp-eyebrow">{s.label}</p><h2>{s.title}</h2>{s.body ? <p className="wp-lede">{s.body}</p> : null}<p className="wp-slotline">{s.slot}</p></div>
          <div className="wp-media"><Slot label={s.type === "team" ? "Your team" : "Owner photo"} /></div>
        </div></section>
      );
      case "reviews": return (
        <section key={s.key} className={cls}><div className="wp-wrap wp-rv">
          <p className="wp-eyebrow">{s.label}</p><h2>{s.title}</h2>
          {s.rating != null ? <div className="wp-rating"><b>{s.rating}</b><div><div className="wp-stars" aria-label={`${s.rating} out of 5`}>{stars(s.rating)}</div><p>{s.review_count != null ? `${s.review_count} Google reviews` : "on Google"}</p></div></div> : null}
          <p className="wp-slotline">{s.slot}</p>
        </div></section>
      );
      case "area": case "visit": return (
        <section key={s.key} className={cls}><div className="wp-wrap wp-two wp-rv">
          <div><p className="wp-eyebrow">{s.label}</p><h2>{s.type === "visit" ? `Come see ${c.short || c.business}.` : `Proudly serving ${c.city || "your area"}.`}</h2>{s.body ? <p className="wp-lede">{s.body}</p> : null}
            {s.type === "visit" ? <p className="wp-lede">{[s.address, s.hours, s.phone].filter(Boolean).join(" · ") || "Address, hours and parking go here."}</p> : null}</div>
          <div className="wp-media" style={{ aspectRatio: "16/10" }}><Slot label="Map" /></div>
        </div></section>
      );
      case "faq": return (
        <section key={s.key} className={cls}><div className="wp-wrap wp-rv">
          <p className="wp-eyebrow">{s.label}</p><h2>{s.title}</h2>
          <div className="wp-faq">{(s.items || []).map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
        </div></section>
      );
      case "cta": alt = !alt; return (
        <section key={s.key} className="wp-band"><div className="wp-wrap wp-rv">
          <h2>{s.title}</h2>
          <div className="wp-cta"><a className="wp-btn wp-btn--p" href="#contact" onClick={go}>{s.button}</a>{c.phone ? <a className="wp-btn wp-btn--g" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a> : null}</div>
        </div></section>
      );
      case "contact": return (
        <section key={s.key} id="contact" className={cls}><div className="wp-wrap wp-rv">
          <p className="wp-eyebrow">{s.label}</p><h2>{s.title}</h2><p className="wp-lede">One question at a time. It lands straight in our system and we get back to you fast.</p>
          <div className="wp-form"><div className="bar"><i /></div><small>Question 1 of {(s.steps || []).length || 3}</small><h3>{(s.steps || [])[0]}</h3><div className="wp-opts">{((c.sections || []).find((x) => x.type === "services")?.items || []).slice(0, 4).map((it) => <span key={it.title}>{it.title}</span>)}<span>Something else</span></div></div>
        </div></section>
      );
      default: return null;
    }
  };

  return (
    <div ref={root} className="wp" style={style} data-testid="website-preview">
      <style>{CSS}</style>
      <nav className="wp-nav"><div className="wp-wrap">
        <div className="wp-brand">{c.logo_url ? <img src={c.logo_url} alt={c.business} /> : null}<span>{c.business}</span></div>
        <div className="wp-links"><a href="#services" onClick={(e) => e.preventDefault()}>Services</a><a href="#work" onClick={(e) => e.preventDefault()}>Work</a><a href="#about" onClick={(e) => e.preventDefault()}>About</a><a href="#contact" onClick={(e) => e.preventDefault()}>Contact</a></div>
        <a className="wp-btn wp-btn--p" href="#contact" onClick={go}>{hero.cta_primary || "Contact"}</a>
      </div></nav>
      <header className="wp-hero" key={replay}><div className="wp-wrap wp-hero-grid">
        <div>
          {hero.kicker ? <p className="wp-kicker">{hero.kicker}</p> : null}
          <h1 onClick={() => setReplay((n) => n + 1)} title="Replay">{words.map((w, i) => <span key={i}><span className="w" style={{ animationDelay: `${120 + i * 70}ms` }}>{w}</span>{i < words.length - 1 ? " " : ""}</span>)}</h1>
          {hero.sub ? <p className="sub">{hero.sub}</p> : null}
          <div className="wp-cta"><a className="wp-btn wp-btn--p" href="#contact" onClick={go}>{hero.cta_primary}</a><a className="wp-btn wp-btn--g" href={c.phone ? `tel:${c.phone.replace(/[^\d+]/g, "")}` : "#contact"} onClick={c.phone ? undefined : go}>{hero.cta_secondary}</a></div>
        </div>
        <div className="wp-media">{hero.image ? <img src={hero.image} alt={`${c.business} work`} /> : <Slot label="Your best photo here" />}</div>
      </div></header>
      {secs.map(render)}
      <footer className="wp-foot"><div className="wp-wrap">
        <div className="row"><div><b>{c.business}</b>{c.address ? <p style={{ marginTop: 6 }}>{c.address}</p> : null}</div><div>{c.phone ? <p>{c.phone}</p> : null}{c.hours ? <p style={{ marginTop: 4 }}>{c.hours}</p> : null}</div></div>
        <div className="wp-credit"><span>© {new Date().getFullYear()} {c.business}</span><a href={c.footer?.credit_url || "https://interstellar-strategies.com"} target="_blank" rel="noreferrer">{c.footer?.credit || "Web design by Interstellar Strategies"}</a></div>
      </div></footer>
    </div>
  );
}
