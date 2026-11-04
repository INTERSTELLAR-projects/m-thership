import { forwardRef, useEffect, useRef, useState } from "react";
import { FLAME, MONO, SANS, SIZE } from "../templates/kit";
import { PostRender } from "../PostCanvas";
import { RATIOS } from "./platforms";

// DESIGN: one visual, every ratio. Interstellar renders its existing spec template (1080 square) inside a ratio frame
// in the flame gradient (#ff3c00 → #ff6a00 → #ffaa00, never gold). Client brands render a brand-neutral card in
// their own colors from their Voice Guide (Interstellar product mockups never appear on a client's feed).

export function brandStyle(brand) {
  const c = brand?.guide?.colors || {};
  const isI = !!brand?.isInterstellar;
  const primary = isI ? "#ff3c00" : c.primary || "#1a1a1a";
  const secondary = isI ? "#ff6a00" : c.secondary || primary;
  const accent = isI ? "#ffaa00" : c.accent || secondary;
  return {
    isI, primary, secondary, accent,
    ink: c.ink || "#1a1a1a",
    paper: isI ? "#ebe8e4" : c.paper || "#f7f6f4",
    gradient: isI ? FLAME : `linear-gradient(90deg, ${primary}, ${secondary} 55%, ${accent})`,
    name: brand?.name || "",
    handle: brand?.guide?.handle_line || "",
  };
}

const onColor = (hex) => {
  const h = String(hex || "#000").replace("#", "");
  const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h.slice(0, 6);
  const n = parseInt(f, 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.62 ? "#1a1a1a" : "#ffffff";
};

export function visualOf(idea) {
  const v = { ...(idea?.extraction?.visual || {}), ...(idea?.design?.spec || {}) };
  return { eyebrow: v.eyebrow || "", headline: v.headline || idea?.title || "", accent_word: v.accent_word || "", subhead: v.subhead || "", cta: v.cta || "" };
}

function Accent({ text, accent, style }) {
  const t = String(text || "");
  const a = String(accent || "").trim();
  const i = a ? t.toLowerCase().indexOf(a.toLowerCase()) : -1;
  if (i < 0) return <>{t}</>;
  return <>{t.slice(0, i)}<span style={style}>{t.slice(i, i + a.length)}</span>{t.slice(i + a.length)}</>;
}
const gradText = (g) => ({ backgroundImage: g, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", paddingBottom: "0.06em" });
const fitPx = (text, steps) => { const n = String(text || "").length; for (const [m, px] of steps) if (n <= m) return px; return steps[steps.length - 1][1]; };

/** Brand-neutral 1080 square card in the brand's colors (clients, or Interstellar without a template). */
export function NeutralCard({ visual, st }) {
  return (
    <div style={{ width: SIZE, height: SIZE, background: st.paper, color: st.ink, position: "relative", overflow: "hidden", fontFamily: SANS, padding: 96, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "absolute", right: -260, top: -260, width: 760, height: 760, borderRadius: "50%", background: `radial-gradient(circle, ${st.secondary}33, transparent 68%)` }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: 14, background: st.gradient }} />
      {visual.eyebrow && <span style={{ fontFamily: MONO, fontSize: 24, letterSpacing: "0.16em", textTransform: "uppercase", color: st.primary, position: "relative" }}>{visual.eyebrow}</span>}
      <h1 style={{ margin: "36px 0 0", fontSize: fitPx(visual.headline, [[40, 112], [70, 92], [110, 76], [999, 62]]), lineHeight: 1, letterSpacing: "-0.045em", fontWeight: 650, textWrap: "balance", position: "relative" }}>
        <Accent text={visual.headline} accent={visual.accent_word} style={st.isI ? gradText(st.gradient) : { color: st.primary }} />
      </h1>
      {visual.subhead && <p style={{ margin: "36px 0 0", fontSize: 36, lineHeight: 1.25, opacity: 0.72, maxWidth: 820, position: "relative" }}>{visual.subhead}</p>}
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
        {visual.cta ? <span style={{ background: st.primary, color: onColor(st.primary), fontSize: 28, fontWeight: 600, padding: "20px 32px" }}>{visual.cta}</span> : <span />}
        <span style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.6 }}>{st.name}</span>
      </div>
    </div>
  );
}

function CoreSquare({ idea, st }) {
  if (st.isI && idea?.design?.template) return <PostRender template={idea.design.template} spec={idea.design.spec} />;
  return <NeutralCard visual={visualOf(idea)} st={st} />;
}

function Square({ px, children }) {
  return (
    <div style={{ width: px, height: px, overflow: "hidden", position: "relative", flexShrink: 0 }}>
      <div style={{ width: SIZE, height: SIZE, transform: `scale(${px / SIZE})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}

/** One visual at a platform ratio (full pixel size; scale it with <Fit>). */
export const RatioCanvas = forwardRef(function RatioCanvas({ ratio, idea, brand }, ref) {
  const r = RATIOS[ratio] || RATIOS.square;
  const st = brandStyle(brand);
  const v = visualOf(idea);
  const core = <CoreSquare idea={idea} st={st} />;
  const base = { width: r.w, height: r.h, background: st.isI ? "#141414" : st.ink, color: "#fff", position: "relative", overflow: "hidden", fontFamily: SANS, boxSizing: "border-box" };
  const bar = <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: 10, background: st.gradient, zIndex: 2 }} />;
  const brandLine = (size) => <span style={{ fontFamily: MONO, fontSize: size, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7 }}>{st.handle || st.name}</span>;

  if (r.w === r.h) return <div ref={ref} className="social-post" style={base}>{core}</div>;

  if (r.h > r.w) {
    // Tall: hook above, the square design, CTA below. Story/Reel keeps the top ~250px and bottom ~340px clear of UI.
    const story = r.h / r.w > 1.6;
    const sq = r.w;
    const top = Math.round((r.h - sq) * (story ? 0.5 : 0.42));
    const bottom = r.h - sq - top;
    return (
      <div ref={ref} className="social-post" style={base}>
        {bar}
        <div style={{ height: top, padding: story ? "250px 80px 40px" : "40px 64px 0", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: story ? "flex-end" : "center" }}>
          {story ? (
            <h2 style={{ margin: 0, fontSize: fitPx(v.headline, [[40, 76], [80, 62], [999, 52]]), lineHeight: 1.02, letterSpacing: "-0.04em", fontWeight: 650, textWrap: "balance" }}>
              <Accent text={v.headline} accent={v.accent_word} style={gradText(st.gradient)} />
            </h2>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: MONO, fontSize: 24, letterSpacing: "0.16em", textTransform: "uppercase", color: st.accent }}>{v.eyebrow || st.name}</span>
              {brandLine(20)}
            </div>
          )}
        </div>
        <Square px={sq}>{core}</Square>
        <div style={{ height: bottom, padding: story ? "48px 80px 340px" : "0 64px", boxSizing: "border-box", display: "flex", alignItems: story ? "flex-start" : "center", justifyContent: "space-between", gap: 24 }}>
          {v.cta ? <span style={{ background: st.gradient, color: "#fff", fontSize: story ? 34 : 28, fontWeight: 600, padding: story ? "24px 36px" : "18px 28px" }}>{v.cta}</span> : <span />}
          {brandLine(story ? 24 : 20)}
        </div>
      </div>
    );
  }

  // Wide (16:9, 4:3): text column + the square design on the right.
  const thumb = ratio === "yt_thumb";
  const sq = r.h - (thumb ? 0 : 80);
  return (
    <div ref={ref} className="social-post" style={{ ...base, display: "flex", alignItems: "center" }}>
      {bar}
      <div style={{ flex: 1, padding: thumb ? "0 48px 0 64px" : "0 56px 0 72px", display: "flex", flexDirection: "column", gap: 28 }}>
        {v.eyebrow && !thumb && <span style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.16em", textTransform: "uppercase", color: st.accent }}>{v.eyebrow}</span>}
        <h2 style={{ margin: 0, fontSize: thumb ? fitPx(v.headline, [[30, 92], [60, 72], [999, 58]]) : fitPx(v.headline, [[40, 74], [80, 60], [999, 48]]), lineHeight: 1, letterSpacing: "-0.045em", fontWeight: 700, textWrap: "balance" }}>
          <Accent text={v.headline} accent={v.accent_word} style={gradText(st.gradient)} />
        </h2>
        {!thumb && v.cta && <span style={{ alignSelf: "flex-start", background: st.gradient, color: "#fff", fontSize: 24, fontWeight: 600, padding: "16px 26px" }}>{v.cta}</span>}
        {!thumb && brandLine(18)}
      </div>
      <div style={{ paddingRight: thumb ? 0 : 40 }}><Square px={sq}>{core}</Square></div>
    </div>
  );
});

/** Carousel / document slide in the brand style. */
export const SlideCanvas = forwardRef(function SlideCanvas({ ratio = "ig_feed", slide, index, total, brand }, ref) {
  const r = RATIOS[ratio] || RATIOS.ig_feed;
  const st = brandStyle(brand);
  const last = index === total - 1;
  return (
    <div ref={ref} className="social-post" style={{ width: r.w, height: r.h, background: last ? "#141414" : st.paper, color: last ? "#fff" : st.ink, fontFamily: SANS, padding: "110px 96px 96px", boxSizing: "border-box", position: "relative", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: 12, background: st.gradient }} />
      <span style={{ fontFamily: MONO, fontSize: 24, letterSpacing: "0.14em", color: last ? st.accent : st.primary }}>{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
      <h2 style={{ margin: "48px 0 0", fontSize: fitPx(slide?.heading, [[24, 96], [48, 80], [999, 64]]), lineHeight: 1, letterSpacing: "-0.045em", fontWeight: 650, textWrap: "balance" }}>{slide?.heading}</h2>
      {slide?.body && <p style={{ margin: "40px 0 0", fontSize: 40, lineHeight: 1.3, opacity: 0.78 }}>{slide.body}</p>}
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.55 }}>{st.handle || st.name}</span>
        {!last && <span style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.12em", color: st.primary }}>SWIPE →</span>}
      </div>
    </div>
  );
});

/** Scales a full-size node to the container width. */
export function Fit({ w, h, children, className = "" }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.2);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const update = () => el.clientWidth && setScale(el.clientWidth / w);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);
  return (
    <div ref={box} className={className} style={{ position: "relative", width: "100%", aspectRatio: `${w} / ${h}`, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}>{children}</div>
    </div>
  );
}

/** Carousel outline slides of an idea (cover is the ratio visual). */
export function slidesOf(idea) {
  return (idea?.extraction?.carousel?.slides || []).filter((x) => x?.heading);
}
