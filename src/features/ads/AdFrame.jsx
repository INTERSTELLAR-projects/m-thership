import { forwardRef, useEffect, useRef, useState } from "react";
import { PostRender } from "@/features/social/PostCanvas";
import { CANVAS, FLAME, INK, MONO, SIZE, isDark } from "@/features/social/templates/kit";

// Meta placement frames around a Social Studio post (which is always designed at 1080x1080).
//   1:1  1080x1080  feed
//   4:5  1080x1350  feed (largest feed footprint) — the post with brand bands above and below
//   9:16 1080x1920  Stories / Reels — the post scaled to 85% and kept out of the top ~14% and bottom ~35%,
//        where Meta's UI overlays sit (approximate safe zones from Meta's creative guidance; not re-verified).
export const RATIOS = {
  "1:1": { w: 1080, h: 1080, label: "1:1 · Feed", placements: "Facebook & Instagram feed" },
  "4:5": { w: 1080, h: 1350, label: "4:5 · Feed", placements: "Feed (recommended)" },
  "9:16": { w: 1080, h: 1920, label: "9:16 · Stories/Reels", placements: "Stories, Reels" },
};

export const AdRender = forwardRef(function AdRender({ template, spec, ratio = "1:1" }, ref) {
  const r = RATIOS[ratio] || RATIOS["1:1"];
  const dark = isDark(spec);
  const bg = dark ? INK : CANVAS;
  const fg = dark ? "rgba(255,255,255,0.55)" : "rgba(26,26,26,0.55)";
  if (ratio === "1:1") {
    return (
      <div ref={ref} style={{ width: r.w, height: r.h }}>
        <PostRender template={template} spec={spec} />
      </div>
    );
  }
  const story = ratio === "9:16";
  const scale = story ? 0.85 : 1;
  const postSize = SIZE * scale;
  const top = story ? 290 : (r.h - SIZE) / 2;
  return (
    <div ref={ref} style={{ width: r.w, height: r.h, background: bg, position: "relative", overflow: "hidden", fontFamily: MONO }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 8, background: FLAME }} />
      {!story && (
        <div style={{ position: "absolute", left: 72, right: 72, top: 52, display: "flex", justifyContent: "space-between", color: fg, fontSize: 22, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          <span>Interstellar Strategies</span>
          <span>The Future of Business</span>
        </div>
      )}
      <div style={{ position: "absolute", left: (r.w - postSize) / 2, top, width: postSize, height: postSize, overflow: "hidden", boxShadow: story ? "0 40px 80px -40px rgba(0,0,0,0.45)" : "none" }}>
        <div style={{ width: SIZE, height: SIZE, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <PostRender template={template} spec={spec} />
        </div>
      </div>
      {story && (
        <div style={{ position: "absolute", left: 0, right: 0, top: top + postSize + 56, textAlign: "center", color: fg, fontSize: 26, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Interstellar Strategies
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 8, background: FLAME }} />
    </div>
  );
});

/** Scales a frame to its container width. */
export default function ScaledAd({ template, spec, ratio = "1:1", className = "" }) {
  const r = RATIOS[ratio] || RATIOS["1:1"];
  const box = useRef(null);
  const [scale, setScale] = useState(0.25);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const update = () => { if (el.clientWidth) setScale(el.clientWidth / r.w); };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [r.w]);
  return (
    <div ref={box} className={className} style={{ position: "relative", width: "100%", aspectRatio: `${r.w} / ${r.h}`, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: r.w, height: r.h, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}>
        <AdRender template={template} spec={spec} ratio={ratio} />
      </div>
    </div>
  );
}
