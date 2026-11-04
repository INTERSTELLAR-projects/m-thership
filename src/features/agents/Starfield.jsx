import { useEffect, useRef } from "react";

// Night-sky canvas behind the constellation: a few hundred stars that twinkle, with a faint parallax
// against the map's pan. Draws once (no animation) when reduced motion is requested.
export default function Starfield({ offset = { x: 0, y: 0 } }) {
  const ref = useRef(null);
  const off = useRef(offset);
  off.current = offset;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stars = [];
    let w = 0, h = 0, raf = 0, dpr = 1;

    const seed = () => {
      const n = Math.round((w * h) / 4200);
      stars = Array.from({ length: n }, () => {
        const warm = Math.random() < 0.12;
        return {
          x: Math.random() * w, y: Math.random() * h,
          r: Math.random() < 0.06 ? 1.3 + Math.random() * 0.8 : 0.35 + Math.random() * 0.75,
          a: 0.25 + Math.random() * 0.6, s: 0.4 + Math.random() * 1.6, p: Math.random() * Math.PI * 2,
          d: 0.02 + Math.random() * 0.06, c: warm ? [255, 170 + Math.round(Math.random() * 40), 120] : [235, 238, 255],
        };
      });
    };
    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, rect.width); h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };
    const draw = (t) => {
      ctx.clearRect(0, 0, w, h);
      const ox = off.current.x || 0, oy = off.current.y || 0;
      for (const s of stars) {
        const tw = reduce ? 1 : 0.65 + 0.35 * Math.sin(t / 1000 * s.s + s.p);
        let x = (s.x + ox * s.d) % w; if (x < 0) x += w;
        let y = (s.y + oy * s.d) % h; if (y < 0) y += h;
        ctx.globalAlpha = s.a * tw;
        ctx.fillStyle = `rgb(${s.c[0]},${s.c[1]},${s.c[2]})`;
        ctx.beginPath(); ctx.arc(x, y, s.r, 0, Math.PI * 2); ctx.fill();
        if (s.r > 1.2) { ctx.globalAlpha = s.a * tw * 0.18; ctx.beginPath(); ctx.arc(x, y, s.r * 3.2, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    };
    const loop = (t) => { if (document.visibilityState === "visible") draw(t); raf = requestAnimationFrame(loop); };

    resize();
    const ro = new ResizeObserver(() => { resize(); if (reduce) draw(0); });
    ro.observe(canvas.parentElement);
    if (reduce) draw(0); else raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0" aria-hidden="true" />;
}
